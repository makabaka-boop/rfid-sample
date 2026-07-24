const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const dayjs = require('dayjs');
const { db, initDatabase } = require('./database');
const { generateToken, authMiddleware, adminMiddleware } = require('./middleware/auth');

const app = express();
const PORT = 8129;

app.use(cors());
app.use(express.json());

initDatabase();

const STATUS_FLOW = {
  待挂牌: ['已挂装'],
  已挂装: ['待调换', '待回收确认', '异常观察'],
  待调换: ['已挂装', '异常观察'],
  待回收确认: ['已回收', '异常观察'],
  已回收: ['待挂牌'],
  异常观察: ['已挂装', '待回收确认', '已回收']
};

const ACTIVE_HANG_STATUSES = ['已挂装', '待调换', '待回收确认', '异常观察'];
const OCCUPIED_HANG_STATUSES = ['已挂装', '待调换', '待回收确认', '异常观察'];

function generateRecordNo(prefix) {
  return `${prefix}${dayjs().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
}

function logOperation(userId, action, targetType, targetId, detail) {
  try {
    db.prepare('INSERT INTO operation_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)')
      .run(userId || null, action, targetType || null, targetId || null, detail || null);
  } catch (e) { /* ignore */ }
}

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: '用户名和密码不能为空' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ message: '用户不存在' });
  }
  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: '密码错误' });
  }
  const token = generateToken(user);
  logOperation(user.id, '登录', 'user', user.id, `${user.real_name}登录系统`);
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      realName: user.real_name,
      role: user.role
    }
  });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/users', authMiddleware, (req, res) => {
  const users = db.prepare('SELECT id, username, real_name, role, created_at FROM users').all();
  res.json({ data: users });
});

app.get('/api/tag-templates', authMiddleware, (req, res) => {
  const tpls = db.prepare('SELECT * FROM tag_templates ORDER BY id DESC').all();
  res.json({ data: tpls });
});

app.post('/api/tag-templates', authMiddleware, adminMiddleware, (req, res) => {
  const { templateCode, templateName, description, fields } = req.body;
  if (!templateCode || !templateName) {
    return res.status(400).json({ message: '模板编码和名称必填' });
  }
  const exists = db.prepare('SELECT id FROM tag_templates WHERE template_code = ?').get(templateCode);
  if (exists) return res.status(400).json({ message: '模板编码已存在' });
  const info = db.prepare('INSERT INTO tag_templates (template_code, template_name, description, fields) VALUES (?, ?, ?, ?)')
    .run(templateCode, templateName, description || '', fields || '{}');
  logOperation(req.user.id, '创建挂牌模板', 'tag_template', info.lastInsertRowid, JSON.stringify(req.body));
  res.json({ data: { id: info.lastInsertRowid }, message: '创建成功' });
});

app.get('/api/tags', authMiddleware, (req, res) => {
  const { page = 1, pageSize = 20, keyword, status, templateId } = req.query;
  let sql = `SELECT t.*, tt.template_name, 
             (SELECT COUNT(*) FROM hanging_records h WHERE h.tag_id = t.id) as hang_count
             FROM tags t 
             LEFT JOIN tag_templates tt ON t.template_id = tt.id WHERE 1=1`;
  const params = [];
  if (keyword) { sql += ' AND (t.tag_code LIKE ? OR t.rfid_code LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
  if (status) { sql += ' AND t.status = ?'; params.push(status); }
  if (templateId) { sql += ' AND t.template_id = ?'; params.push(templateId); }
  sql += ' ORDER BY t.id DESC';
  const total = db.prepare(`SELECT COUNT(*) as c FROM (${sql})`).get(...params).c;
  const offset = (page - 1) * pageSize;
  const data = db.prepare(sql + ' LIMIT ? OFFSET ?').all(...params, Number(pageSize), offset);
  res.json({ data, total, page: Number(page), pageSize: Number(pageSize) });
});

app.post('/api/tags', authMiddleware, (req, res) => {
  const { tagCode, templateId, rfidCode } = req.body;
  if (!tagCode) return res.status(400).json({ message: '挂牌编码必填' });
  const exists = db.prepare('SELECT id FROM tags WHERE tag_code = ?').get(tagCode);
  if (exists) return res.status(400).json({ message: '挂牌编码已存在' });
  const info = db.prepare('INSERT INTO tags (tag_code, template_id, rfid_code, status) VALUES (?, ?, ?, ?)')
    .run(tagCode, templateId || null, rfidCode || '', '待挂牌');
  logOperation(req.user.id, '创建挂牌', 'tag', info.lastInsertRowid, tagCode);
  res.json({ data: { id: info.lastInsertRowid }, message: '创建成功' });
});

app.get('/api/categories', authMiddleware, (req, res) => {
  const data = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, id ASC').all();
  res.json({ data });
});

app.post('/api/categories', authMiddleware, adminMiddleware, (req, res) => {
  const { categoryCode, categoryName, parentId, sortOrder } = req.body;
  if (!categoryCode || !categoryName) return res.status(400).json({ message: '编码和名称必填' });
  const exists = db.prepare('SELECT id FROM categories WHERE category_code = ?').get(categoryCode);
  if (exists) return res.status(400).json({ message: '分类编码已存在' });
  const info = db.prepare('INSERT INTO categories (category_code, category_name, parent_id, sort_order) VALUES (?, ?, ?, ?)')
    .run(categoryCode, categoryName, parentId || 0, sortOrder || 0);
  logOperation(req.user.id, '创建分类', 'category', info.lastInsertRowid, categoryName);
  res.json({ data: { id: info.lastInsertRowid }, message: '创建成功' });
});

app.get('/api/garments', authMiddleware, (req, res) => {
  const { page = 1, pageSize = 20, keyword, categoryId, season } = req.query;
  let sql = `SELECT g.*, c.category_name FROM garments g 
             LEFT JOIN categories c ON g.category_id = c.id WHERE 1=1`;
  const params = [];
  if (keyword) { sql += ' AND (g.garment_code LIKE ? OR g.garment_name LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
  if (categoryId) { sql += ' AND g.category_id = ?'; params.push(categoryId); }
  if (season) { sql += ' AND g.season = ?'; params.push(season); }
  sql += ' ORDER BY g.id DESC';
  const total = db.prepare(`SELECT COUNT(*) as c FROM (${sql})`).get(...params).c;
  const offset = (page - 1) * pageSize;
  const data = db.prepare(sql + ' LIMIT ? OFFSET ?').all(...params, Number(pageSize), offset);
  res.json({ data, total, page: Number(page), pageSize: Number(pageSize) });
});

app.get('/api/garments/:id', authMiddleware, (req, res) => {
  const garment = db.prepare(`SELECT g.*, c.category_name FROM garments g 
    LEFT JOIN categories c ON g.category_id = c.id WHERE g.id = ?`).get(req.params.id);
  if (!garment) return res.status(404).json({ message: '样衣不存在' });
  res.json({ data: garment });
});

app.post('/api/garments', authMiddleware, (req, res) => {
  const { garmentCode, garmentName, categoryId, season, color, size, fabric, description } = req.body;
  if (!garmentCode || !garmentName || !categoryId) return res.status(400).json({ message: '必填项缺失' });
  const exists = db.prepare('SELECT id FROM garments WHERE garment_code = ?').get(garmentCode);
  if (exists) return res.status(400).json({ message: '样衣编码已存在' });
  const info = db.prepare(`INSERT INTO garments 
    (garment_code, garment_name, category_id, season, color, size, fabric, description) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(garmentCode, garmentName, categoryId, season || '', color || '', size || '', fabric || '', description || '');
  logOperation(req.user.id, '创建样衣', 'garment', info.lastInsertRowid, garmentName);
  res.json({ data: { id: info.lastInsertRowid }, message: '创建成功' });
});

app.put('/api/garments/:id', authMiddleware, (req, res) => {
  const { garmentName, categoryId, season, color, size, fabric, description } = req.body;
  const garment = db.prepare('SELECT id FROM garments WHERE id = ?').get(req.params.id);
  if (!garment) return res.status(404).json({ message: '样衣不存在' });
  db.prepare(`UPDATE garments SET garment_name=?, category_id=?, season=?, color=?, size=?, fabric=?, description=? WHERE id=?`)
    .run(garmentName, categoryId, season || '', color || '', size || '', fabric || '', description || '', req.params.id);
  logOperation(req.user.id, '更新样衣', 'garment', req.params.id, garmentName);
  res.json({ message: '更新成功' });
});

app.get('/api/areas', authMiddleware, (req, res) => {
  const areas = db.prepare('SELECT * FROM display_areas ORDER BY floor, area_code').all();
  res.json({ data: areas });
});

app.post('/api/areas', authMiddleware, adminMiddleware, (req, res) => {
  const { areaCode, areaName, floor, zone, capacity } = req.body;
  if (!areaCode || !areaName) return res.status(400).json({ message: '必填项缺失' });
  const exists = db.prepare('SELECT id FROM display_areas WHERE area_code = ?').get(areaCode);
  if (exists) return res.status(400).json({ message: '区域编码已存在' });
  const info = db.prepare('INSERT INTO display_areas (area_code, area_name, floor, zone, capacity) VALUES (?, ?, ?, ?, ?)')
    .run(areaCode, areaName, floor || 1, zone || '', capacity || 10);
  res.json({ data: { id: info.lastInsertRowid }, message: '创建成功' });
});

app.get('/api/responsible-persons', authMiddleware, (req, res) => {
  const data = db.prepare('SELECT * FROM responsible_persons ORDER BY id DESC').all();
  res.json({ data });
});

app.post('/api/responsible-persons', authMiddleware, adminMiddleware, (req, res) => {
  const { personCode, personName, department, phone, email } = req.body;
  if (!personCode || !personName) return res.status(400).json({ message: '必填项缺失' });
  const exists = db.prepare('SELECT id FROM responsible_persons WHERE person_code = ?').get(personCode);
  if (exists) return res.status(400).json({ message: '编码已存在' });
  const info = db.prepare('INSERT INTO responsible_persons (person_code, person_name, department, phone, email) VALUES (?, ?, ?, ?, ?)')
    .run(personCode, personName, department || '', phone || '', email || '');
  res.json({ data: { id: info.lastInsertRowid }, message: '创建成功' });
});

app.get('/api/hanging/available-tags', authMiddleware, (req, res) => {
  const tags = db.prepare(`SELECT t.*, tt.template_name FROM tags t 
    LEFT JOIN tag_templates tt ON t.template_id = tt.id 
    WHERE t.status = '待挂牌' ORDER BY t.tag_code`).all();
  res.json({ data: tags });
});

app.get('/api/hanging/available-garments', authMiddleware, (req, res) => {
  const sql = `SELECT g.*, c.category_name FROM garments g 
    LEFT JOIN categories c ON g.category_id = c.id
    WHERE g.id NOT IN (SELECT garment_id FROM hanging_records WHERE status IN ('已挂装','待调换','待回收确认','异常观察'))
    ORDER BY g.id DESC`;
  const data = db.prepare(sql).all();
  res.json({ data });
});

function checkPositionConflict(areaId, layerNo, positionNo, excludeHangId = null) {
  let sql = `SELECT h.*, g.garment_name, t.tag_code, da.area_name 
    FROM hanging_records h 
    LEFT JOIN garments g ON h.garment_id = g.id
    LEFT JOIN tags t ON h.tag_id = t.id
    LEFT JOIN display_areas da ON h.area_id = da.id
    WHERE h.area_id = ? AND h.layer_no = ? AND h.position_no = ? 
    AND h.status IN ('已挂装','待调换','待回收确认','异常观察')`;
  const params = [areaId, layerNo, positionNo];
  if (excludeHangId) { sql += ' AND h.id != ?'; params.push(excludeHangId); }
  return db.prepare(sql).get(...params);
}

function checkTagAlreadyHanged(tagId, excludeHangId = null) {
  let sql = `SELECT h.*, g.garment_name FROM hanging_records h 
    LEFT JOIN garments g ON h.garment_id = g.id
    WHERE h.tag_id = ? AND h.status IN ('已挂装','待调换','待回收确认','异常观察')`;
  const params = [tagId];
  if (excludeHangId) { sql += ' AND h.id != ?'; params.push(excludeHangId); }
  return db.prepare(sql).get(...params);
}

function checkGarmentAlreadyHanged(garmentId, excludeHangId = null) {
  let sql = `SELECT h.*, t.tag_code FROM hanging_records h 
    LEFT JOIN tags t ON h.tag_id = t.id
    WHERE h.garment_id = ? AND h.status IN ('已挂装','待调换','待回收确认','异常观察')`;
  const params = [garmentId];
  if (excludeHangId) { sql += ' AND h.id != ?'; params.push(excludeHangId); }
  return db.prepare(sql).get(...params);
}

function checkUnresolvedMissingPart(tagId, garmentId) {
  const sql = `SELECT * FROM missing_part_notes 
    WHERE status != '已处理' 
    AND (tag_id = ? OR garment_id = ?)`;
  return db.prepare(sql).all(tagId, garmentId);
}

function updateTagStatus(tagId, status) {
  if (!STATUS_FLOW || true) {
    db.prepare('UPDATE tags SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, tagId);
  }
}

function getExpiryStatus(expectedOffDate) {
  if (!expectedOffDate) return null;
  const today = dayjs().startOf('day');
  const expireDate = dayjs(expectedOffDate).startOf('day');
  const daysLeft = expireDate.diff(today, 'day');
  if (daysLeft < 0) return { status: 'overdue', daysLeft };
  if (daysLeft <= 7) return { status: 'expiring', daysLeft };
  return { status: 'normal', daysLeft };
}

app.post('/api/hanging', authMiddleware, (req, res) => {
  const { tagId, garmentId, areaId, layerNo, positionNo, responsibleId, remark, expectedOffDate } = req.body;
  if (!tagId || !garmentId || !areaId || !layerNo || !positionNo || !responsibleId) {
    return res.status(400).json({ message: '必填项缺失' });
  }

  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(tagId);
  if (!tag) return res.status(404).json({ message: '挂牌不存在' });

  if (tag.status === '异常观察') {
    const pendingMissing = checkUnresolvedMissingPart(tagId, garmentId);
    if (pendingMissing.length > 0) {
      return res.status(400).json({ message: `该挂牌存在${pendingMissing.length}条未处理的缺件说明，处理完成前不可挂装` });
    }
  }

  if (tag.status !== '待挂牌' && tag.status !== '异常观察') {
    return res.status(400).json({ message: `挂牌当前状态为"${tag.status}"，不可挂装` });
  }

  const tagHanged = checkTagAlreadyHanged(tagId);
  if (tagHanged) return res.status(400).json({ message: `该挂牌已挂在样衣[${tagHanged.garment_name}]上，不能同时挂在两件样衣` });

  const garmentHanged = checkGarmentAlreadyHanged(garmentId);
  if (garmentHanged) return res.status(400).json({ message: `该样衣已被挂牌[${garmentHanged.tag_code}]挂装` });

  const conflict = checkPositionConflict(areaId, layerNo, positionNo);
  if (conflict) {
    return res.status(400).json({
      message: `区域[${conflict.area_name}]第${layerNo}层第${positionNo}位已被样衣[${conflict.garment_name}]占用`
    });
  }

  const recordNo = generateRecordNo('HANG');
  const tx = db.transaction(() => {
    const hangInfo = db.prepare(`INSERT INTO hanging_records 
      (record_no, tag_id, garment_id, area_id, layer_no, position_no, responsible_id, operator_id, status, remark, expected_off_date) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, '已挂装', ?, ?)`)
      .run(recordNo, tagId, garmentId, areaId, layerNo, positionNo, responsibleId, req.user.id, remark || '', expectedOffDate || null);
    updateTagStatus(tagId, '已挂装');
    return hangInfo;
  });
  const result = tx();
  logOperation(req.user.id, '挂装', 'hanging_record', result.lastInsertRowid, `挂牌#${tag.tag_code} -> 样衣`);
  res.json({ data: { id: result.lastInsertRowid, recordNo }, message: '挂装成功' });
});

app.get('/api/hanging-records', authMiddleware, (req, res) => {
  const { page = 1, pageSize = 20, categoryId, areaId, responsibleId, status, startDate, endDate, hasMissing, keyword, expiryStatus } = req.query;
  let sql = `SELECT h.*, 
    t.tag_code, t.rfid_code, tt.template_name,
    g.garment_code, g.garment_name, g.season, g.color, c.category_name,
    da.area_name, da.area_code, da.floor,
    rp.person_name, rp.person_code, rp.department,
    u.real_name as operator_name,
    (SELECT COUNT(*) FROM missing_part_notes m WHERE m.hang_id = h.id AND m.status != '已处理') as unresolved_missing_count,
    (SELECT COUNT(*) FROM swap_records s WHERE s.original_hang_id = h.id) as swap_count,
    julianday(h.expected_off_date) - julianday(date('now')) as days_left
    FROM hanging_records h
    LEFT JOIN tags t ON h.tag_id = t.id
    LEFT JOIN tag_templates tt ON t.template_id = tt.id
    LEFT JOIN garments g ON h.garment_id = g.id
    LEFT JOIN categories c ON g.category_id = c.id
    LEFT JOIN display_areas da ON h.area_id = da.id
    LEFT JOIN responsible_persons rp ON h.responsible_id = rp.id
    LEFT JOIN users u ON h.operator_id = u.id
    WHERE 1=1`;
  const params = [];
  if (keyword) {
    sql += ' AND (t.tag_code LIKE ? OR g.garment_code LIKE ? OR g.garment_name LIKE ? OR h.record_no LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (categoryId) { sql += ' AND g.category_id = ?'; params.push(categoryId); }
  if (areaId) { sql += ' AND h.area_id = ?'; params.push(areaId); }
  if (responsibleId) { sql += ' AND h.responsible_id = ?'; params.push(responsibleId); }
  if (status) { sql += ' AND h.status = ?'; params.push(status); }
  if (startDate) { sql += ' AND h.hang_time >= ?'; params.push(startDate); }
  if (endDate) { sql += ' AND h.hang_time <= ?'; params.push(endDate + ' 23:59:59'); }
  if (hasMissing === 'true') {
    sql += ' AND EXISTS (SELECT 1 FROM missing_part_notes m WHERE m.hang_id = h.id AND m.status != \'已处理\')';
  } else if (hasMissing === 'false') {
    sql += ' AND NOT EXISTS (SELECT 1 FROM missing_part_notes m WHERE m.hang_id = h.id AND m.status != \'已处理\')';
  }
  if (expiryStatus === 'overdue') {
    sql += " AND h.expected_off_date IS NOT NULL AND h.expected_off_date < date('now') AND h.status IN ('已挂装','待调换','异常观察','待回收确认')";
  } else if (expiryStatus === 'expiring') {
    sql += " AND h.expected_off_date IS NOT NULL AND h.expected_off_date >= date('now') AND h.expected_off_date <= date('now', '+7 day') AND h.status IN ('已挂装','待调换','异常观察','待回收确认')";
  } else if (expiryStatus === 'normal') {
    sql += " AND h.expected_off_date IS NOT NULL AND h.expected_off_date > date('now', '+7 day') AND h.status IN ('已挂装','待调换','异常观察','待回收确认')";
  }
  sql += ' ORDER BY h.id DESC';
  const total = db.prepare(`SELECT COUNT(*) as c FROM (${sql})`).get(...params).c;
  const offset = (page - 1) * pageSize;
  const rawData = db.prepare(sql + ' LIMIT ? OFFSET ?').all(...params, Number(pageSize), offset);
  const data = rawData.map(row => {
    const expiry = getExpiryStatus(row.expected_off_date);
    return { ...row, expiry_status: expiry?.status || null, days_left: expiry?.daysLeft ?? null };
  });
  res.json({ data, total, page: Number(page), pageSize: Number(pageSize) });
});

app.get('/api/slot-board', authMiddleware, (req, res) => {
  const { floor, areaId, status, responsibleId, keyword, onlyFree } = req.query;

  const areasRaw = db.prepare('SELECT * FROM display_areas ORDER BY floor, area_code').all();
  const floors = [...new Set(areasRaw.map(a => a.floor))].sort((a, b) => a - b);

  let areaFilterSql = 'WHERE 1=1';
  const areaParams = [];
  if (floor) { areaFilterSql += ' AND floor = ?'; areaParams.push(Number(floor)); }
  if (areaId) { areaFilterSql += ' AND id = ?'; areaParams.push(areaId); }
  const areas = db.prepare(`SELECT * FROM display_areas ${areaFilterSql} ORDER BY floor, area_code`).all(...areaParams);

  let hangSql = `SELECT h.*,
    t.tag_code, t.rfid_code, tt.template_name,
    g.garment_code, g.garment_name, g.season, g.color, c.category_name,
    da.area_name, da.area_code, da.floor,
    rp.id as responsible_id, rp.person_name, rp.person_code, rp.department,
    u.real_name as operator_name,
    julianday(h.expected_off_date) - julianday(date('now')) as days_left,
    (SELECT COUNT(*) FROM missing_part_notes m WHERE m.hang_id = h.id AND m.status != '已处理') as unresolved_missing_count,
    (SELECT COUNT(*) FROM anomaly_tickets a WHERE a.hang_id = h.id AND a.status != '已关闭') as open_anomaly_count,
    (SELECT COALESCE(MAX(times.t), 0) FROM (
      SELECT h2.hang_time as t FROM hanging_records h2 WHERE h2.id = h.id
      UNION ALL SELECT MAX(s.swap_time) FROM swap_records s WHERE s.original_hang_id = h.id
      UNION ALL SELECT MAX(r.recover_time) FROM recovery_records r WHERE r.hang_id = h.id
      UNION ALL SELECT MAX(m.report_time) FROM missing_part_notes m WHERE m.hang_id = h.id
      UNION ALL SELECT MAX(a.report_time) FROM anomaly_tickets a WHERE a.hang_id = h.id
    ) times) as last_status_update
    FROM hanging_records h
    LEFT JOIN tags t ON h.tag_id = t.id
    LEFT JOIN tag_templates tt ON t.template_id = tt.id
    LEFT JOIN garments g ON h.garment_id = g.id
    LEFT JOIN categories c ON g.category_id = c.id
    LEFT JOIN display_areas da ON h.area_id = da.id
    LEFT JOIN responsible_persons rp ON h.responsible_id = rp.id
    LEFT JOIN users u ON h.operator_id = u.id
    WHERE h.status IN ('已挂装','待调换','待回收确认','异常观察')`;
  const hangParams = [];
  const allHangs = db.prepare(hangSql).all(...hangParams);

  function matchesDisplayFilters(h) {
    if (status) {
      const statusList = Array.isArray(status) ? status : [status];
      if (!statusList.includes(h.status)) return false;
    }
    if (responsibleId && Number(h.responsible_id) !== Number(responsibleId)) return false;
    if (keyword) {
      const kw = keyword.toLowerCase();
      const hay = `${h.tag_code || ''} ${h.garment_code || ''} ${h.garment_name || ''} ${h.record_no || ''} ${h.person_name || ''}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  }

  const anomalyTicketsForHangs = db.prepare(`SELECT id, hang_id, ticket_no, anomaly_type, status
    FROM anomaly_tickets WHERE status != '已关闭' AND hang_id IS NOT NULL`).all();
  const anomalyMap = new Map();
  anomalyTicketsForHangs.forEach(a => {
    if (!anomalyMap.has(a.hang_id)) anomalyMap.set(a.hang_id, []);
    anomalyMap.get(a.hang_id).push({ id: a.id, ticket_no: a.ticket_no, anomaly_type: a.anomaly_type, status: a.status });
  });

  const DEFAULT_POS_PER_LAYER = 5;
  const areaResults = areas.map(area => {
    const areaHangs = allHangs.filter(h => h.area_id === area.id);

    let visibleHangs = areaHangs.filter(matchesDisplayFilters);
    if (onlyFree === 'true') {
      visibleHangs = [];
    }

    const activeCount = areaHangs.length;
    const occupiedCount = areaHangs.filter(h => h.status === '已挂装').length;
    const pendingSwapCount = areaHangs.filter(h => h.status === '待调换').length;
    const pendingRecoveryCount = areaHangs.filter(h => h.status === '待回收确认').length;
    const abnormalCount = areaHangs.filter(h => h.status === '异常观察').length;
    const expiringCount = areaHangs.filter(h => {
      const e = getExpiryStatus(h.expected_off_date);
      return e && (e.status === 'expiring' || e.status === 'overdue');
    }).length;
    const freeCount = Math.max((area.capacity || 0) - activeCount, 0);
    const occupancyRate = area.capacity ? Math.round((activeCount / area.capacity) * 1000) / 1000 : 0;
    const highOccupancy = occupancyRate >= 0.9;

    const maxLayerFromHangs = areaHangs.reduce((m, h) => Math.max(m, h.layer_no), 0);
    const maxPosFromHangs = areaHangs.reduce((m, h) => Math.max(m, h.position_no), 0);
    const layerCount = Math.max(Math.ceil((area.capacity || 0) / DEFAULT_POS_PER_LAYER), maxLayerFromHangs, 1);
    const posPerLayer = Math.max(DEFAULT_POS_PER_LAYER, maxPosFromHangs);

    const hangMap = new Map();
    visibleHangs.forEach(h => {
      const expiry = getExpiryStatus(h.expected_off_date);
      hangMap.set(`${h.layer_no}-${h.position_no}`, {
        id: h.id,
        record_no: h.record_no,
        tag_code: h.tag_code,
        rfid_code: h.rfid_code,
        template_name: h.template_name,
        garment_code: h.garment_code,
        garment_name: h.garment_name,
        season: h.season,
        color: h.color,
        category_name: h.category_name,
        person_id: h.responsible_id,
        person_name: h.person_name,
        person_code: h.person_code,
        department: h.department,
        operator_name: h.operator_name,
        hang_time: h.hang_time,
        expected_off_date: h.expected_off_date,
        status: h.status,
        remark: h.remark,
        expiry_status: expiry?.status || null,
        days_left: expiry?.daysLeft ?? null,
        unresolved_missing_count: h.unresolved_missing_count,
        open_anomaly_count: h.open_anomaly_count,
        anomaly_tickets: anomalyMap.get(h.id) || [],
        last_status_update: h.last_status_update || h.hang_time
      });
    });

    const layers = [];
    const freeSlots = [];
    for (let l = 1; l <= layerCount; l++) {
      const slots = [];
      for (let p = 1; p <= posPerLayer; p++) {
        const key = `${l}-${p}`;
        const hang = hangMap.get(key);
        if (hang) {
          slots.push({ layer_no: l, position_no: p, status: hang.status, occupied: true, hang });
        } else {
          const isFilteredOut = areaHangs.some(h => h.layer_no === l && h.position_no === p);
          const isFree = !isFilteredOut;
          if (isFree && !onlyFree) freeSlots.push({ layer_no: l, position_no: p });
          slots.push({
            layer_no: l,
            position_no: p,
            status: 'free',
            occupied: false,
            filtered_out: isFilteredOut,
            hang: null
          });
        }
      }
      layers.push({ layer_no: l, slots });
    }

    if (onlyFree === 'true') {
      const onlyFreeSlots = [];
      for (let l = 1; l <= layerCount; l++) {
        for (let p = 1; p <= posPerLayer; p++) {
          const occupied = areaHangs.some(h => h.layer_no === l && h.position_no === p);
          if (!occupied) onlyFreeSlots.push({ layer_no: l, position_no: p });
        }
      }
      return {
        id: area.id, area_code: area.area_code, area_name: area.area_name,
        floor: area.floor, zone: area.zone, capacity: area.capacity,
        free_slots: onlyFreeSlots,
        occupied_count: occupiedCount, free_count: freeCount,
        active_count: activeCount, occupancy_rate: occupancyRate, high_occupancy: highOccupancy
      };
    }

    return {
      id: area.id,
      area_code: area.area_code,
      area_name: area.area_name,
      floor: area.floor,
      zone: area.zone,
      capacity: area.capacity,
      occupied_count: occupiedCount,
      free_count: freeCount,
      abnormal_count: abnormalCount,
      pending_recovery_count: pendingRecoveryCount,
      pending_swap_count: pendingSwapCount,
      expiring_count: expiringCount,
      active_count: activeCount,
      occupancy_rate: occupancyRate,
      high_occupancy: highOccupancy,
      recommended_free_slots: freeSlots.slice(0, 10),
      layers
    };
  });

  let summaryTotalCap = 0, summaryTotalActive = 0, summaryTotalAbnormal = 0;
  let summaryTotalRecovery = 0, summaryTotalSwap = 0, summaryTotalExpiring = 0;
  let highOccupancyAreas = [];
  areaResults.forEach(a => {
    summaryTotalCap += a.capacity || 0;
    summaryTotalActive += a.active_count;
    summaryTotalAbnormal += a.abnormal_count || 0;
    summaryTotalRecovery += a.pending_recovery_count || 0;
    summaryTotalSwap += a.pending_swap_count || 0;
    summaryTotalExpiring += a.expiring_count || 0;
    if (a.high_occupancy) highOccupancyAreas.push({ id: a.id, area_name: a.area_name, floor: a.floor, occupancy_rate: a.occupancy_rate });
  });

  const responsibleStatsMap = new Map();
  allHangs.forEach(h => {
    const pid = h.responsible_id;
    if (!pid) return;
    if (!responsibleStatsMap.has(pid)) {
      responsibleStatsMap.set(pid, {
        responsible_id: pid,
        person_name: h.person_name,
        person_code: h.person_code,
        department: h.department,
        total_slots: 0,
        abnormal_count: 0,
        pending_recovery_count: 0,
        pending_swap_count: 0,
        expiring_count: 0
      });
    }
    const stat = responsibleStatsMap.get(pid);
    stat.total_slots++;
    if (h.status === '异常观察') stat.abnormal_count++;
    if (h.status === '待回收确认') stat.pending_recovery_count++;
    if (h.status === '待调换') stat.pending_swap_count++;
    const e = getExpiryStatus(h.expected_off_date);
    if (e && (e.status === 'expiring' || e.status === 'overdue')) stat.expiring_count++;
  });
  const responsibleStats = [...responsibleStatsMap.values()].sort((a, b) => b.total_slots - a.total_slots);

  const responsiblePersons = db.prepare('SELECT id, person_code, person_name, department FROM responsible_persons ORDER BY id').all();

  res.json({
    data: {
      summary: {
        total_areas: areas.length,
        total_capacity: summaryTotalCap,
        total_occupied: summaryTotalActive,
        total_free: Math.max(summaryTotalCap - summaryTotalActive, 0),
        total_abnormal: summaryTotalAbnormal,
        total_pending_recovery: summaryTotalRecovery,
        total_pending_swap: summaryTotalSwap,
        total_expiring: summaryTotalExpiring,
        high_occupancy_areas: highOccupancyAreas,
        global_occupancy_rate: summaryTotalCap ? Math.round((summaryTotalActive / summaryTotalCap) * 1000) / 1000 : 0
      },
      areas: areaResults,
      responsible_stats: responsibleStats,
      filters: {
        floors,
        responsible_persons: responsiblePersons
      }
    }
  });
});

app.get('/api/slot-board/free-slots', authMiddleware, (req, res) => {
  const { areaId } = req.query;
  const areas = areaId
    ? db.prepare('SELECT * FROM display_areas WHERE id = ?').all(areaId)
    : db.prepare('SELECT * FROM display_areas ORDER BY floor, area_code').all();

  const result = areas.map(area => {
    const hangs = db.prepare(`SELECT layer_no, position_no FROM hanging_records
      WHERE area_id = ? AND status IN ('已挂装','待调换','待回收确认','异常观察')`).all(area.id);
    const occupied = new Set(hangs.map(h => `${h.layer_no}-${h.position_no}`));
    const DEFAULT_POS_PER_LAYER = 5;
    const maxLayer = Math.max(Math.ceil((area.capacity || 0) / DEFAULT_POS_PER_LAYER), ...hangs.map(h => h.layer_no), 1);
    const maxPos = Math.max(DEFAULT_POS_PER_LAYER, ...hangs.map(h => h.position_no));
    const freeSlots = [];
    for (let l = 1; l <= maxLayer; l++) {
      for (let p = 1; p <= maxPos; p++) {
        if (!occupied.has(`${l}-${p}`)) {
          freeSlots.push({ layer_no: l, position_no: p });
        }
      }
    }
    return {
      area_id: area.id,
      area_name: area.area_name,
      area_code: area.area_code,
      floor: area.floor,
      capacity: area.capacity,
      free_count: freeSlots.length,
      recommended_slots: freeSlots.slice(0, 12)
    };
  });

  res.json({ data: result });
});

app.get('/api/slot-board/export', authMiddleware, (req, res) => {
  const { floor, areaId, status, responsibleId, keyword, onlyFree } = req.query;

  function esc(v) {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  }

  let areaFilterSql = 'WHERE 1=1';
  const areaParams = [];
  if (floor) { areaFilterSql += ' AND floor = ?'; areaParams.push(Number(floor)); }
  if (areaId) { areaFilterSql += ' AND id = ?'; areaParams.push(areaId); }
  const areas = db.prepare(`SELECT * FROM display_areas ${areaFilterSql} ORDER BY floor, area_code`).all(...areaParams);

  if (onlyFree === 'true') {
    const allActiveHangs = db.prepare(`SELECT area_id, layer_no, position_no FROM hanging_records
      WHERE status IN ('已挂装','待调换','待回收确认','异常观察')`).all();
    const occupiedMap = new Map();
    allActiveHangs.forEach(h => {
      if (!occupiedMap.has(h.area_id)) occupiedMap.set(h.area_id, new Set());
      occupiedMap.get(h.area_id).add(`${h.layer_no}-${h.position_no}`);
    });

    const DEFAULT_POS_PER_LAYER = 5;
    const header = ['楼层', '区域编码', '区域名称', '层号', '位号'];
    const csvLines = [header.join(',')];
    areas.forEach(area => {
      const occupied = occupiedMap.get(area.id) || new Set();
      const areaActiveHangs = allActiveHangs.filter(h => h.area_id === area.id);
      const maxLayer = Math.max(Math.ceil((area.capacity || 0) / DEFAULT_POS_PER_LAYER), ...areaActiveHangs.map(h => h.layer_no), 1);
      const maxPos = Math.max(DEFAULT_POS_PER_LAYER, ...areaActiveHangs.map(h => h.position_no));
      for (let l = 1; l <= maxLayer; l++) {
        for (let p = 1; p <= maxPos; p++) {
          if (!occupied.has(`${l}-${p}`)) {
            csvLines.push([area.floor, area.area_code, area.area_name, l, p].map(esc).join(','));
          }
        }
      }
    });

    const csv = '\uFEFF' + csvLines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="free-slots-${dayjs().format('YYYYMMDD-HHmmss')}.csv"`);
    return res.send(csv);
  }

  let hangSql = `SELECT h.*,
    t.tag_code, t.rfid_code,
    g.garment_code, g.garment_name, g.season, g.color, c.category_name,
    da.area_name, da.area_code, da.floor,
    rp.person_name, rp.person_code,
    u.real_name as operator_name,
    julianday(h.expected_off_date) - julianday(date('now')) as days_left,
    (SELECT COUNT(*) FROM anomaly_tickets a WHERE a.hang_id = h.id AND a.status != '已关闭') as open_anomaly_count,
    (SELECT COALESCE(MAX(times.t), 0) FROM (
      SELECT h2.hang_time as t FROM hanging_records h2 WHERE h2.id = h.id
      UNION ALL SELECT MAX(s.swap_time) FROM swap_records s WHERE s.original_hang_id = h.id
      UNION ALL SELECT MAX(r.recover_time) FROM recovery_records r WHERE r.hang_id = h.id
      UNION ALL SELECT MAX(m.report_time) FROM missing_part_notes m WHERE m.hang_id = h.id
      UNION ALL SELECT MAX(a.report_time) FROM anomaly_tickets a WHERE a.hang_id = h.id
    ) times) as last_status_update
    FROM hanging_records h
    LEFT JOIN tags t ON h.tag_id = t.id
    LEFT JOIN garments g ON h.garment_id = g.id
    LEFT JOIN categories c ON g.category_id = c.id
    LEFT JOIN display_areas da ON h.area_id = da.id
    LEFT JOIN responsible_persons rp ON h.responsible_id = rp.id
    LEFT JOIN users u ON h.operator_id = u.id
    WHERE h.status IN ('已挂装','待调换','待回收确认','异常观察')`;
  const hangParams = [];
  if (floor) { hangSql += ' AND da.floor = ?'; hangParams.push(Number(floor)); }
  if (areaId) { hangSql += ' AND h.area_id = ?'; hangParams.push(areaId); }
  if (responsibleId) { hangSql += ' AND h.responsible_id = ?'; hangParams.push(Number(responsibleId)); }
  if (status) {
    const statusList = Array.isArray(status) ? status : [status];
    hangSql += ` AND h.status IN (${statusList.map(() => '?').join(',')})`;
    hangParams.push(...statusList);
  }
  if (keyword) {
    hangSql += ' AND (t.tag_code LIKE ? OR g.garment_code LIKE ? OR g.garment_name LIKE ? OR h.record_no LIKE ? OR rp.person_name LIKE ?)';
    const kw = `%${keyword}%`;
    hangParams.push(kw, kw, kw, kw, kw);
  }
  hangSql += ' ORDER BY da.floor, da.area_code, h.layer_no, h.position_no';
  const rows = db.prepare(hangSql).all(...hangParams);

  const header = ['楼层', '区域编码', '区域名称', '层号', '位号', '状态', '挂牌编码', 'RFID', '样衣编码', '样衣名称', '分类', '季节', '颜色', '负责人', '负责人部门', '操作人', '挂装时间', '预计下架日期', '到期状态', '剩余天数', '未关闭异常单数', '最近状态更新时间', '挂装单号'];
  const csvLines = [header.join(',')];
  rows.forEach(r => {
    const expiry = getExpiryStatus(r.expected_off_date);
    const expiryLabel = expiry ? (expiry.status === 'overdue' ? '已超期' : expiry.status === 'expiring' ? '即将到期' : '正常') : '未设置';
    const daysLeftText = expiry ? (expiry.status === 'overdue' ? `超期${Math.abs(expiry.daysLeft)}天` : expiry.daysLeft === 0 ? '今天到期' : `${expiry.daysLeft}天`) : '-';
    const vals = [
      r.floor, r.area_code, r.area_name, r.layer_no, r.position_no, r.status,
      r.tag_code, r.rfid_code, r.garment_code, r.garment_name, r.category_name,
      r.season, r.color, r.person_name, r.department, r.operator_name,
      r.hang_time, r.expected_off_date || '', expiryLabel, daysLeftText,
      r.open_anomaly_count || 0, r.last_status_update || r.hang_time, r.record_no
    ].map(v => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    });
    csvLines.push(vals.join(','));
  });

  const csv = '\uFEFF' + csvLines.join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="slot-board-${dayjs().format('YYYYMMDD-HHmmss')}.csv"`);
  res.send(csv);
});

app.get('/api/hanging-records/:id', authMiddleware, (req, res) => {
  const hang = db.prepare(`SELECT h.*, 
    t.tag_code, t.rfid_code, t.status as tag_status, tt.template_name, tt.fields,
    g.garment_code, g.garment_name, g.season, g.color, g.size, g.fabric, g.description, c.category_name,
    da.area_name, da.area_code, da.floor,
    rp.person_name, rp.person_code, rp.department, rp.phone, rp.email,
    u.real_name as operator_name,
    julianday(h.expected_off_date) - julianday(date('now')) as days_left
    FROM hanging_records h
    LEFT JOIN tags t ON h.tag_id = t.id
    LEFT JOIN tag_templates tt ON t.template_id = tt.id
    LEFT JOIN garments g ON h.garment_id = g.id
    LEFT JOIN categories c ON g.category_id = c.id
    LEFT JOIN display_areas da ON h.area_id = da.id
    LEFT JOIN responsible_persons rp ON h.responsible_id = rp.id
    LEFT JOIN users u ON h.operator_id = u.id
    WHERE h.id = ?`).get(req.params.id);
  if (!hang) return res.status(404).json({ message: '记录不存在' });

  const expiry = getExpiryStatus(hang.expected_off_date);
  const hangWithExpiry = { ...hang, expiry_status: expiry?.status || null, days_left: expiry?.daysLeft ?? null };

  const swaps = db.prepare(`SELECT s.*,
    og.garment_code as original_garment_code, og.garment_name as original_garment_name,
    ng.garment_code as new_garment_code, ng.garment_name as new_garment_name,
    oda.area_code as original_area_code, oda.area_name as original_area,
    nda.area_code as new_area_code, nda.area_name as new_area,
    u.real_name as operator_name
    FROM swap_records s
    LEFT JOIN garments og ON s.original_garment_id = og.id
    LEFT JOIN garments ng ON s.new_garment_id = ng.id
    LEFT JOIN display_areas oda ON s.original_area_id = oda.id
    LEFT JOIN display_areas nda ON s.new_area_id = nda.id
    LEFT JOIN users u ON s.operator_id = u.id
    WHERE s.original_hang_id = ? ORDER BY s.swap_time DESC`).all(req.params.id);

  const missingParts = db.prepare(`SELECT m.*, 
    u1.real_name as reporter_name, u2.real_name as handler_name
    FROM missing_part_notes m
    LEFT JOIN users u1 ON m.reporter_id = u1.id
    LEFT JOIN users u2 ON m.handler_id = u2.id
    WHERE m.hang_id = ? ORDER BY m.report_time DESC`).all(req.params.id);

  res.json({ data: { ...hangWithExpiry, swaps, missingParts } });
});

app.post('/api/swap', authMiddleware, (req, res) => {
  const { originalHangId, newGarmentId, newAreaId, newLayerNo, newPositionNo, swapReason, expectedOffDate } = req.body;
  if (!originalHangId || !newGarmentId) return res.status(400).json({ message: '必填项缺失' });

  const originalHang = db.prepare('SELECT * FROM hanging_records WHERE id = ?').get(originalHangId);
  if (!originalHang) return res.status(404).json({ message: '原挂装记录不存在' });
  if (!['已挂装', '待调换'].includes(originalHang.status)) {
    return res.status(400).json({ message: `当前状态"${originalHang.status}"不允许调换` });
  }

  const pendingMissing = checkUnresolvedMissingPart(originalHang.tag_id, newGarmentId);
  if (pendingMissing.length > 0) {
    return res.status(400).json({ message: `存在${pendingMissing.length}条未处理的缺件说明，处理完成前不可调换` });
  }

  const newGarment = db.prepare('SELECT * FROM garments WHERE id = ?').get(newGarmentId);
  if (!newGarment) return res.status(404).json({ message: '新样衣不存在' });

  const garmentHanged = checkGarmentAlreadyHanged(newGarmentId, originalHangId);
  if (garmentHanged) return res.status(400).json({ message: `新样衣已被挂牌[${garmentHanged.tag_code}]挂装` });

  let finalAreaId = newAreaId || originalHang.area_id;
  let finalLayerNo = newLayerNo || originalHang.layer_no;
  let finalPositionNo = newPositionNo || originalHang.position_no;

  if (newAreaId || newLayerNo || newPositionNo) {
    const conflict = checkPositionConflict(finalAreaId, finalLayerNo, finalPositionNo, originalHangId);
    if (conflict) {
      return res.status(400).json({
        message: `区域[${conflict.area_name}]第${finalLayerNo}层第${finalPositionNo}位已被样衣[${conflict.garment_name}]占用`
      });
    }
  }

  const recentSwaps = db.prepare(`SELECT COUNT(*) as c FROM swap_records s 
    WHERE s.original_hang_id = ? AND s.swap_time >= datetime('now', '-7 day')`).get(originalHangId).c;
  const frequentWarning = recentSwaps >= 3 ? `警告：该挂牌近7天已调换${recentSwaps}次，调换过频` : null;

  const recordNo = generateRecordNo('SWP');
  const finalExpectedOffDate = expectedOffDate || originalHang.expected_off_date;
  const tx = db.transaction(() => {
    const swapInfo = db.prepare(`INSERT INTO swap_records 
      (record_no, original_hang_id, original_garment_id, original_area_id, original_layer_no, original_position_no,
       new_garment_id, new_area_id, new_layer_no, new_position_no, swap_reason, operator_id, expected_off_date) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(recordNo, originalHangId, originalHang.garment_id, originalHang.area_id, originalHang.layer_no, originalHang.position_no,
           newGarmentId, newAreaId || null, newLayerNo || null, newPositionNo || null, swapReason || '', req.user.id, finalExpectedOffDate);

    db.prepare(`UPDATE hanging_records SET 
      garment_id = ?, area_id = ?, layer_no = ?, position_no = ?, status = '已挂装', expected_off_date = ?
      WHERE id = ?`)
      .run(newGarmentId, finalAreaId, finalLayerNo, finalPositionNo, finalExpectedOffDate, originalHangId);
    return swapInfo;
  });
  tx();
  logOperation(req.user.id, '调换', 'swap_record', null, `挂装记录#${originalHangId}`);
  res.json({ data: { recordNo, frequentWarning }, message: frequentWarning || '调换成功' });
});

app.post('/api/recovery/request', authMiddleware, (req, res) => {
  const { hangId, remark } = req.body;
  if (!hangId) return res.status(400).json({ message: '挂装记录ID必填' });
  const hang = db.prepare('SELECT * FROM hanging_records WHERE id = ?').get(hangId);
  if (!hang) return res.status(404).json({ message: '挂装记录不存在' });
  if (!['已挂装', '待调换', '异常观察'].includes(hang.status)) {
    return res.status(400).json({ message: `当前状态"${hang.status}"不允许申请回收` });
  }

  const pendingRecovery = db.prepare(`SELECT * FROM recovery_records 
    WHERE hang_id = ? AND status = '待回收确认'`).get(hangId);
  if (pendingRecovery) return res.status(400).json({ message: '该挂装已存在待确认的回收申请' });

  const recordNo = generateRecordNo('RCV');
  const originalStatus = hang.status;
  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO recovery_records 
      (record_no, hang_id, tag_id, garment_id, recover_operator_id, recover_time, status, original_status, remark) 
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, '待回收确认', ?, ?)`)
      .run(recordNo, hangId, hang.tag_id, hang.garment_id, req.user.id, originalStatus, remark || '');
    db.prepare('UPDATE hanging_records SET status = ? WHERE id = ?').run('待回收确认', hangId);
    updateTagStatus(hang.tag_id, '待回收确认');
  });
  tx();
  logOperation(req.user.id, '申请回收', 'recovery_record', null, recordNo);
  res.json({ message: '回收申请已提交', data: { recordNo } });
});

app.get('/api/recovery-records', authMiddleware, (req, res) => {
  const { page = 1, pageSize = 20, status, startDate, endDate, keyword } = req.query;
  let sql = `SELECT r.*, 
    h.record_no as hang_record_no, h.layer_no, h.position_no,
    t.tag_code, g.garment_code, g.garment_name, c.category_name,
    da.area_name, u1.real_name as recover_op_name, u2.real_name as confirm_op_name
    FROM recovery_records r
    LEFT JOIN hanging_records h ON r.hang_id = h.id
    LEFT JOIN tags t ON r.tag_id = t.id
    LEFT JOIN garments g ON r.garment_id = g.id
    LEFT JOIN categories c ON g.category_id = c.id
    LEFT JOIN display_areas da ON h.area_id = da.id
    LEFT JOIN users u1 ON r.recover_operator_id = u1.id
    LEFT JOIN users u2 ON r.confirm_operator_id = u2.id
    WHERE 1=1`;
  const params = [];
  if (keyword) {
    sql += ' AND (t.tag_code LIKE ? OR g.garment_code LIKE ? OR r.record_no LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (status) { sql += ' AND r.status = ?'; params.push(status); }
  if (startDate) { sql += ' AND r.recover_time >= ?'; params.push(startDate); }
  if (endDate) { sql += ' AND r.recover_time <= ?'; params.push(endDate + ' 23:59:59'); }
  sql += ' ORDER BY r.id DESC';
  const total = db.prepare(`SELECT COUNT(*) as c FROM (${sql})`).get(...params).c;
  const offset = (page - 1) * pageSize;
  const data = db.prepare(sql + ' LIMIT ? OFFSET ?').all(...params, Number(pageSize), offset);

  const statusCounts = db.prepare(`SELECT status, COUNT(*) as count FROM recovery_records GROUP BY status`).all();
  const countsMap = {};
  statusCounts.forEach(s => { countsMap[s.status] = s.count; });

  res.json({
    data,
    total,
    page: Number(page),
    pageSize: Number(pageSize),
    status_counts: {
      pending: countsMap['待回收确认'] || 0,
      recovered: countsMap['已回收'] || 0
    }
  });
});

app.post('/api/recovery/confirm', authMiddleware, (req, res) => {
  const { recoveryId, confirmRemark } = req.body;
  if (!recoveryId) return res.status(400).json({ message: '回收记录ID必填' });
  const recovery = db.prepare('SELECT * FROM recovery_records WHERE id = ?').get(recoveryId);
  if (!recovery) return res.status(404).json({ message: '回收记录不存在' });
  if (recovery.status !== '待回收确认') {
    return res.status(400).json({ message: `当前状态"${recovery.status}"不可确认` });
  }

  const tx = db.transaction(() => {
    db.prepare(`UPDATE recovery_records SET 
      status = '已回收', confirm_operator_id = ?, confirm_time = CURRENT_TIMESTAMP, 
      remark = COALESCE(NULLIF(remark, ''), '') || COALESCE(?,'')
      WHERE id = ?`).run(req.user.id, confirmRemark ? `【复核】${confirmRemark}` : '', recoveryId);
    db.prepare('UPDATE hanging_records SET status = ? WHERE id = ?').run('已回收', recovery.hang_id);
    updateTagStatus(recovery.tag_id, '已回收');
  });
  tx();
  logOperation(req.user.id, '确认回收', 'recovery_record', recoveryId, recovery.record_no);
  res.json({ message: '回收确认完成' });
});

app.post('/api/recovery/reject', authMiddleware, (req, res) => {
  const { recoveryId, rejectReason } = req.body;
  if (!recoveryId || !rejectReason) return res.status(400).json({ message: '必填项缺失' });
  const recovery = db.prepare('SELECT * FROM recovery_records WHERE id = ?').get(recoveryId);
  if (!recovery) return res.status(404).json({ message: '回收记录不存在' });
  if (recovery.status !== '待回收确认') return res.status(400).json({ message: '当前状态不可驳回' });

  const restoredStatus = recovery.original_status || '已挂装';
  const tx = db.transaction(() => {
    db.prepare(`UPDATE recovery_records SET status = '已驳回', confirm_operator_id = ?, confirm_time = CURRENT_TIMESTAMP, remark = ? WHERE id = ?`)
      .run(req.user.id, `【驳回】${rejectReason}`, recoveryId);
    db.prepare('UPDATE hanging_records SET status = ? WHERE id = ?').run(restoredStatus, recovery.hang_id);
    updateTagStatus(recovery.tag_id, restoredStatus);
  });
  tx();
  res.json({ message: '已驳回回收申请' });
});

app.post('/api/missing-part', authMiddleware, (req, res) => {
  const { hangId, tagId, garmentId, missingType, missingDescription } = req.body;
  if (!missingType || !missingDescription) return res.status(400).json({ message: '缺件类型和描述必填' });
  const recordNo = generateRecordNo('MIS');
  const tx = db.transaction(() => {
    const info = db.prepare(`INSERT INTO missing_part_notes 
      (record_no, hang_id, tag_id, garment_id, missing_type, missing_description, reporter_id, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, '未处理')`)
      .run(recordNo, hangId || null, tagId || null, garmentId || null, missingType, missingDescription, req.user.id);
    if (tagId) {
      updateTagStatus(tagId, '异常观察');
      if (hangId) {
        db.prepare('UPDATE hanging_records SET status = ? WHERE id = ?').run('异常观察', hangId);
      }
    }
    return info;
  });
  const result = tx();
  logOperation(req.user.id, '上报缺件', 'missing_part', result.lastInsertRowid, missingType);
  res.json({ data: { id: result.lastInsertRowid, recordNo }, message: '缺件说明已记录' });
});

app.get('/api/missing-parts', authMiddleware, (req, res) => {
  const { page = 1, pageSize = 20, status, missingType, startDate, endDate, keyword } = req.query;
  let sql = `SELECT m.*, 
    t.tag_code, g.garment_code, g.garment_name, h.record_no as hang_record_no,
    u1.real_name as reporter_name, u2.real_name as handler_name
    FROM missing_part_notes m
    LEFT JOIN tags t ON m.tag_id = t.id
    LEFT JOIN garments g ON m.garment_id = g.id
    LEFT JOIN hanging_records h ON m.hang_id = h.id
    LEFT JOIN users u1 ON m.reporter_id = u1.id
    LEFT JOIN users u2 ON m.handler_id = u2.id
    WHERE 1=1`;
  const params = [];
  if (keyword) {
    sql += ' AND (m.record_no LIKE ? OR t.tag_code LIKE ? OR g.garment_code LIKE ? OR m.missing_description LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (status) { sql += ' AND m.status = ?'; params.push(status); }
  if (missingType) { sql += ' AND m.missing_type = ?'; params.push(missingType); }
  if (startDate) { sql += ' AND m.report_time >= ?'; params.push(startDate); }
  if (endDate) { sql += ' AND m.report_time <= ?'; params.push(endDate + ' 23:59:59'); }
  sql += ' ORDER BY m.id DESC';
  const total = db.prepare(`SELECT COUNT(*) as c FROM (${sql})`).get(...params).c;
  const offset = (page - 1) * pageSize;
  const data = db.prepare(sql + ' LIMIT ? OFFSET ?').all(...params, Number(pageSize), offset);
  res.json({ data, total, page: Number(page), pageSize: Number(pageSize) });
});

app.post('/api/missing-part/:id/handle', authMiddleware, (req, res) => {
  const { handleResult } = req.body;
  const missing = db.prepare('SELECT * FROM missing_part_notes WHERE id = ?').get(req.params.id);
  if (!missing) return res.status(404).json({ message: '记录不存在' });
  if (missing.status === '已处理') return res.status(400).json({ message: '该缺件已处理' });

  const tx = db.transaction(() => {
    db.prepare(`UPDATE missing_part_notes SET 
      status = '已处理', handler_id = ?, handle_time = CURRENT_TIMESTAMP, handle_result = ? 
      WHERE id = ?`).run(req.user.id, handleResult || '', req.params.id);

    if (missing.tag_id) {
      const remainUnresolved = db.prepare(`SELECT COUNT(*) as c FROM missing_part_notes 
        WHERE tag_id = ? AND status != '已处理' AND id != ?`).get(missing.tag_id, req.params.id).c;
      if (remainUnresolved === 0) {
        const tag = db.prepare('SELECT status FROM tags WHERE id = ?').get(missing.tag_id);
        if (tag && tag.status === '异常观察') {
          let recoveredStatus = '待挂牌';
          if (missing.hang_id) {
            const hang = db.prepare('SELECT id, status FROM hanging_records WHERE id = ?').get(missing.hang_id);
            if (hang && hang.status === '异常观察') {
              db.prepare('UPDATE hanging_records SET status = ? WHERE id = ?').run('已挂装', hang.id);
              recoveredStatus = '已挂装';
            }
          }
          updateTagStatus(missing.tag_id, recoveredStatus);
        }
      }
    }
  });
  tx();
  logOperation(req.user.id, '处理缺件', 'missing_part', req.params.id, missing.record_no);
  res.json({ message: '缺件处理完成' });
});

app.get('/api/statistics/overview', authMiddleware, (req, res) => {
  const totalTags = db.prepare('SELECT COUNT(*) as c FROM tags').get().c;
  const totalGarments = db.prepare('SELECT COUNT(*) as c FROM garments').get().c;
  const totalHanging = db.prepare(`SELECT COUNT(*) as c FROM hanging_records WHERE status IN ('已挂装','待调换','待回收确认','异常观察')`).get().c;
  const pendingRecovery = db.prepare('SELECT COUNT(*) as c FROM recovery_records WHERE status = \'待回收确认\'').get().c;
  const unhandledMissing = db.prepare('SELECT COUNT(*) as c FROM missing_part_notes WHERE status != \'已处理\'').get().c;

  const totalAnomaly = db.prepare('SELECT COUNT(*) as c FROM anomaly_tickets').get().c;
  const pendingAnomaly = db.prepare('SELECT COUNT(*) as c FROM anomaly_tickets WHERE status IN (\'待处理\',\'处理中\')').get().c;
  const overdueAnomaly = db.prepare(`SELECT COUNT(*) as c FROM anomaly_tickets 
    WHERE status != '已关闭' AND expected_handle_date IS NOT NULL AND expected_handle_date < date('now')`).get().c;
  const needFollowUpAnomaly = db.prepare(`SELECT COUNT(*) as c FROM anomaly_tickets a
    WHERE a.status != '已关闭' 
    AND EXISTS (SELECT 1 FROM anomaly_follow_ups f WHERE f.ticket_id = a.id)
    AND (SELECT MAX(f2.created_at) FROM anomaly_follow_ups f2 WHERE f2.ticket_id = a.id) < datetime('now', '-3 day')`).get().c;
  const todayFollowUpAnomaly = db.prepare(`SELECT COUNT(*) as c FROM anomaly_tickets a
    WHERE a.status != '已关闭' 
    AND (SELECT f.expected_next_date FROM anomaly_follow_ups f WHERE f.ticket_id = a.id ORDER BY f.created_at DESC LIMIT 1) = date('now')`).get().c;
  const anomalyTypeStats = db.prepare(`SELECT anomaly_type, COUNT(*) as count 
    FROM anomaly_tickets GROUP BY anomaly_type ORDER BY count DESC`).all();

  const expiringCount = db.prepare(`SELECT COUNT(*) as c FROM hanging_records 
    WHERE status IN ('已挂装','待调换','异常观察','待回收确认') 
    AND expected_off_date IS NOT NULL 
    AND expected_off_date >= date('now') 
    AND expected_off_date <= date('now', '+7 day')`).get().c;

  const overdueCount = db.prepare(`SELECT COUNT(*) as c FROM hanging_records 
    WHERE status IN ('已挂装','待调换','异常观察','待回收确认') 
    AND expected_off_date IS NOT NULL 
    AND expected_off_date < date('now')`).get().c;

  const statusDistribution = db.prepare(`SELECT status, COUNT(*) as count FROM tags GROUP BY status`).all();

  const categoryDistribution = db.prepare(`SELECT p.id, p.category_name, COUNT(g.id) as count
    FROM categories p
    LEFT JOIN categories c ON c.parent_id = p.id
    LEFT JOIN garments g ON g.category_id = c.id
    WHERE p.parent_id = 0
    GROUP BY p.id ORDER BY count DESC`).all();

  const areaOccupancyRaw = db.prepare(`SELECT da.id, da.area_code, da.area_name, da.floor, da.zone, da.capacity,
    SUM(CASE WHEN h.status IN ('已挂装','待调换','待回收确认','异常观察') THEN 1 ELSE 0 END) as active_count,
    SUM(CASE WHEN h.status = '已挂装' THEN 1 ELSE 0 END) as used_count,
    SUM(CASE WHEN h.status = '待调换' THEN 1 ELSE 0 END) as swap_count,
    SUM(CASE WHEN h.status = '待回收确认' THEN 1 ELSE 0 END) as recovery_count,
    SUM(CASE WHEN h.status = '异常观察' THEN 1 ELSE 0 END) as abnormal_count
    FROM display_areas da
    LEFT JOIN hanging_records h ON da.id = h.area_id AND h.status IN ('已挂装','待调换','待回收确认','异常观察')
    GROUP BY da.id ORDER BY da.floor, da.area_code`).all();
  const areaOccupancy = areaOccupancyRaw.map(a => ({
    ...a,
    free_count: Math.max((a.capacity || 0) - (a.active_count || 0), 0),
    occupancy_rate: a.capacity ? Math.round(((a.active_count || 0) / a.capacity) * 1000) / 1000 : 0
  }));
  const totalAbnormalSlots = areaOccupancy.reduce((s, a) => s + (a.abnormal_count || 0), 0);

  const missingTypeStats = db.prepare(`SELECT missing_type, COUNT(*) as count 
    FROM missing_part_notes GROUP BY missing_type ORDER BY count DESC`).all();

  const pendingConfirmList = db.prepare(`SELECT r.id, r.record_no, r.recover_time, 
    t.tag_code, g.garment_name, da.area_name, u.real_name as applicant_name
    FROM recovery_records r
    LEFT JOIN tags t ON r.tag_id = t.id
    LEFT JOIN garments g ON r.garment_id = g.id
    LEFT JOIN hanging_records h ON r.hang_id = h.id
    LEFT JOIN display_areas da ON h.area_id = da.id
    LEFT JOIN users u ON r.recover_operator_id = u.id
    WHERE r.status = '待回收确认' ORDER BY r.recover_time DESC LIMIT 20`).all();

  const frequentSwaps = db.prepare(`SELECT h.id as hang_id, t.tag_code, g.garment_name, COUNT(s.id) as swap_count,
    MIN(s.swap_time) as first_swap, MAX(s.swap_time) as last_swap
    FROM swap_records s
    JOIN hanging_records h ON s.original_hang_id = h.id
    JOIN tags t ON h.tag_id = t.id
    JOIN garments g ON h.garment_id = g.id
    WHERE s.swap_time >= datetime('now', '-30 day')
    GROUP BY h.id HAVING swap_count >= 3
    ORDER BY swap_count DESC LIMIT 10`).all();

  const overdueRecovery = db.prepare(`SELECT r.*, t.tag_code, g.garment_name, 
    julianday('now') - julianday(r.recover_time) as overdue_days
    FROM recovery_records r
    LEFT JOIN tags t ON r.tag_id = t.id
    LEFT JOIN garments g ON r.garment_id = g.id
    WHERE r.status = '待回收确认' AND julianday('now') - julianday(r.recover_time) > 2
    ORDER BY overdue_days DESC`).all();

  const missingReviewGap = db.prepare(`SELECT m.id, m.record_no, m.missing_type, m.missing_description,
    m.report_time, t.tag_code, g.garment_name,
    julianday('now') - julianday(m.report_time) as pending_days
    FROM missing_part_notes m
    LEFT JOIN tags t ON m.tag_id = t.id
    LEFT JOIN garments g ON m.garment_id = g.id
    WHERE m.status = '未处理' AND julianday('now') - julianday(m.report_time) > 3
    ORDER BY pending_days DESC`).all();

  const expiryReminders = db.prepare(`SELECT h.id as hang_id, h.record_no, h.expected_off_date,
    t.tag_code, g.garment_name, g.garment_code, da.area_name,
    julianday(h.expected_off_date) - julianday(date('now')) as days_left
    FROM hanging_records h
    JOIN tags t ON h.tag_id = t.id
    JOIN garments g ON h.garment_id = g.id
    LEFT JOIN display_areas da ON h.area_id = da.id
    WHERE h.status IN ('已挂装','待调换','异常观察','待回收确认') 
    AND h.expected_off_date IS NOT NULL 
    AND h.expected_off_date <= date('now', '+7 day')
    ORDER BY days_left ASC, h.expected_off_date ASC
    LIMIT 20`).all();

  const trendData = db.prepare(`SELECT 
    date(hang_time) as date,
    SUM(CASE WHEN status IN ('已挂装','待调换','待回收确认') THEN 1 ELSE 0 END) as hang_count
    FROM hanging_records 
    WHERE hang_time >= date('now', '-30 day')
    GROUP BY date(hang_time) ORDER BY date ASC`).all();

  const needFollowUpList = db.prepare(`SELECT a.id, a.ticket_no, a.anomaly_type, a.description, a.status,
    t.tag_code, g.garment_name,
    (SELECT MAX(f.created_at) FROM anomaly_follow_ups f WHERE f.ticket_id = a.id) as last_follow_up_time,
    julianday('now') - julianday((SELECT MAX(f.created_at) FROM anomaly_follow_ups f WHERE f.ticket_id = a.id)) as days_since_follow
    FROM anomaly_tickets a
    LEFT JOIN tags t ON a.tag_id = t.id
    LEFT JOIN garments g ON a.garment_id = g.id
    WHERE a.status != '已关闭' 
    AND EXISTS (SELECT 1 FROM anomaly_follow_ups f WHERE f.ticket_id = a.id)
    AND (SELECT MAX(f2.created_at) FROM anomaly_follow_ups f2 WHERE f2.ticket_id = a.id) < datetime('now', '-3 day')
    ORDER BY days_since_follow DESC LIMIT 20`).all();

  const todayFollowUpList = db.prepare(`SELECT a.id, a.ticket_no, a.anomaly_type, a.description, a.status,
    t.tag_code, g.garment_name,
    (SELECT f.next_step_plan FROM anomaly_follow_ups f WHERE f.ticket_id = a.id ORDER BY f.created_at DESC LIMIT 1) as next_step_plan,
    (SELECT MAX(f.created_at) FROM anomaly_follow_ups f WHERE f.ticket_id = a.id) as last_follow_up_time
    FROM anomaly_tickets a
    LEFT JOIN tags t ON a.tag_id = t.id
    LEFT JOIN garments g ON a.garment_id = g.id
    WHERE a.status != '已关闭' 
    AND (SELECT f.expected_next_date FROM anomaly_follow_ups f WHERE f.ticket_id = a.id ORDER BY f.created_at DESC LIMIT 1) = date('now')
    ORDER BY a.id DESC LIMIT 20`).all();

  res.json({
    data: {
      summary: {
        totalTags, totalGarments, totalHanging, pendingRecovery, unhandledMissing,
        expiringCount, overdueCount, statusDistribution,
        totalAnomaly, pendingAnomaly, overdueAnomaly,
        needFollowUpAnomaly, todayFollowUpAnomaly,
        totalAbnormalSlots
      },
      categoryDistribution,
      areaOccupancy,
      missingTypeStats,
      anomalyTypeStats,
      pendingConfirmList,
      expiryReminders,
      anomalies: {
        frequentSwaps,
        overdueRecovery,
        missingReviewGap,
        needFollowUpList,
        todayFollowUpList
      },
      trendData
    }
  });
});

app.get('/api/swap-records', authMiddleware, (req, res) => {
  const { page = 1, pageSize = 20, startDate, endDate, keyword } = req.query;
  let sql = `SELECT s.*,
    oh.record_no as original_hang_no,
    og.garment_code as original_garment_code, og.garment_name as original_garment_name,
    ng.garment_code as new_garment_code, ng.garment_name as new_garment_name,
    oda.area_code as original_area_code, oda.area_name as original_area_name,
    nda.area_code as new_area_code, nda.area_name as new_area_name,
    t.tag_code, u.real_name as operator_name
    FROM swap_records s
    JOIN hanging_records oh ON s.original_hang_id = oh.id
    JOIN tags t ON oh.tag_id = t.id
    JOIN garments og ON s.original_garment_id = og.id
    JOIN garments ng ON s.new_garment_id = ng.id
    LEFT JOIN display_areas oda ON s.original_area_id = oda.id
    LEFT JOIN display_areas nda ON s.new_area_id = nda.id
    LEFT JOIN users u ON s.operator_id = u.id
    WHERE 1=1`;
  const params = [];
  if (keyword) {
    sql += ' AND (t.tag_code LIKE ? OR s.record_no LIKE ? OR og.garment_name LIKE ? OR ng.garment_name LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (startDate) { sql += ' AND s.swap_time >= ?'; params.push(startDate); }
  if (endDate) { sql += ' AND s.swap_time <= ?'; params.push(endDate + ' 23:59:59'); }
  sql += ' ORDER BY s.id DESC';
  const total = db.prepare(`SELECT COUNT(*) as c FROM (${sql})`).get(...params).c;
  const offset = (page - 1) * pageSize;
  const data = db.prepare(sql + ' LIMIT ? OFFSET ?').all(...params, Number(pageSize), offset);
  res.json({ data, total, page: Number(page), pageSize: Number(pageSize) });
});

const ANOMALY_STATUS_OPTIONS = ['待处理', '处理中', '已关闭'];
const ANOMALY_TYPE_OPTIONS = [
  '挂牌丢失', '挂牌损坏', '样衣破损', '样衣污渍', '样衣遗失',
  '配件缺失', '尺码标缺失', '陈列错误', '超期未处理', '其他'
];

app.get('/api/anomaly-tickets/types', authMiddleware, (req, res) => {
  res.json({ data: ANOMALY_TYPE_OPTIONS });
});

app.get('/api/anomaly-tickets', authMiddleware, (req, res) => {
  const { page = 1, pageSize = 20, status, responsibleId, anomalyType, tagCode, garmentCode, startDate, endDate, keyword, overdue, hangId, needFollowUp, todayNext } = req.query;
  let sql = `SELECT a.*,
    t.tag_code, g.garment_code, g.garment_name, c.category_name,
    h.record_no as hang_record_no, h.status as hang_status,
    da.area_name, da.area_code, da.floor, h.layer_no, h.position_no,
    rp.person_name, rp.person_code, rp.department,
    u1.real_name as reporter_name,
    u2.real_name as handler_name,
    u3.real_name as closer_name,
    julianday(a.expected_handle_date) - julianday(date('now')) as days_left,
    (SELECT COUNT(*) FROM anomaly_follow_ups f WHERE f.ticket_id = a.id) as follow_up_count,
    (SELECT MAX(f.created_at) FROM anomaly_follow_ups f WHERE f.ticket_id = a.id) as last_follow_up_time,
    (SELECT f.next_step_plan FROM anomaly_follow_ups f WHERE f.ticket_id = a.id ORDER BY f.created_at DESC LIMIT 1) as next_step_plan,
    (SELECT f.expected_next_date FROM anomaly_follow_ups f WHERE f.ticket_id = a.id ORDER BY f.created_at DESC LIMIT 1) as expected_next_date
    FROM anomaly_tickets a
    LEFT JOIN hanging_records h ON a.hang_id = h.id
    LEFT JOIN tags t ON a.tag_id = t.id
    LEFT JOIN garments g ON a.garment_id = g.id
    LEFT JOIN categories c ON g.category_id = c.id
    LEFT JOIN display_areas da ON h.area_id = da.id
    LEFT JOIN responsible_persons rp ON a.responsible_id = rp.id
    LEFT JOIN users u1 ON a.reporter_id = u1.id
    LEFT JOIN users u2 ON a.current_handler_id = u2.id
    LEFT JOIN users u3 ON a.close_user_id = u3.id
    WHERE 1=1`;
  const params = [];
  if (keyword) {
    sql += ' AND (a.ticket_no LIKE ? OR a.description LIKE ? OR t.tag_code LIKE ? OR g.garment_code LIKE ? OR g.garment_name LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (status) { sql += ' AND a.status = ?'; params.push(status); }
  if (responsibleId) { sql += ' AND a.responsible_id = ?'; params.push(responsibleId); }
  if (anomalyType) { sql += ' AND a.anomaly_type = ?'; params.push(anomalyType); }
  if (tagCode) { sql += ' AND t.tag_code LIKE ?'; params.push(`%${tagCode}%`); }
  if (garmentCode) { sql += ' AND g.garment_code LIKE ?'; params.push(`%${garmentCode}%`); }
  if (startDate) { sql += ' AND a.report_time >= ?'; params.push(startDate); }
  if (endDate) { sql += ' AND a.report_time <= ?'; params.push(endDate + ' 23:59:59'); }
  if (overdue === 'true') {
    sql += " AND a.status != '已关闭' AND a.expected_handle_date IS NOT NULL AND a.expected_handle_date < date('now')";
  }
  if (hangId) { sql += ' AND a.hang_id = ?'; params.push(hangId); }
  if (needFollowUp === 'true') {
    sql += " AND a.status != '已关闭' AND (SELECT MAX(f.created_at) FROM anomaly_follow_ups f WHERE f.ticket_id = a.id) IS NOT NULL AND (SELECT MAX(f.created_at) FROM anomaly_follow_ups f WHERE f.ticket_id = a.id) < datetime('now', '-3 day')";
  } else if (needFollowUp === 'none') {
    sql += " AND a.status != '已关闭' AND NOT EXISTS (SELECT 1 FROM anomaly_follow_ups f WHERE f.ticket_id = a.id)";
  }
  if (todayNext === 'true') {
    sql += " AND a.status != '已关闭' AND (SELECT f.expected_next_date FROM anomaly_follow_ups f WHERE f.ticket_id = a.id ORDER BY f.created_at DESC LIMIT 1) = date('now')";
  }
  sql += ' ORDER BY a.id DESC';

  const total = db.prepare(`SELECT COUNT(*) as c FROM (${sql})`).get(...params).c;
  const offset = (page - 1) * pageSize;
  const rawData = db.prepare(sql + ' LIMIT ? OFFSET ?').all(...params, Number(pageSize), offset);

  const data = rawData.map(row => {
    let overdue = false;
    let daysLeft = null;
    if (row.expected_handle_date && row.status !== '已关闭') {
      const exp = getExpiryStatus(row.expected_handle_date);
      overdue = exp?.status === 'overdue';
      daysLeft = exp?.daysLeft ?? null;
    }
    let nextOverdue = false;
    if (row.expected_next_date && row.status !== '已关闭') {
      const exp = getExpiryStatus(row.expected_next_date);
      nextOverdue = exp?.status === 'overdue';
    }
    return { ...row, is_overdue: overdue, days_left: daysLeft, is_next_overdue: nextOverdue };
  });

  const statusCounts = db.prepare(`SELECT status, COUNT(*) as count FROM anomaly_tickets GROUP BY status`).all();
  const countsMap = {};
  statusCounts.forEach(s => { countsMap[s.status] = s.count; });

  const overdueCount = db.prepare(`SELECT COUNT(*) as c FROM anomaly_tickets 
    WHERE status != '已关闭' AND expected_handle_date IS NOT NULL AND expected_handle_date < date('now')`).get().c;

  const needFollowUpCount = db.prepare(`SELECT COUNT(*) as c FROM anomaly_tickets a
    WHERE a.status != '已关闭' 
    AND EXISTS (SELECT 1 FROM anomaly_follow_ups f WHERE f.ticket_id = a.id)
    AND (SELECT MAX(f2.created_at) FROM anomaly_follow_ups f2 WHERE f2.ticket_id = a.id) < datetime('now', '-3 day')`).get().c;

  const noFollowUpCount = db.prepare(`SELECT COUNT(*) as c FROM anomaly_tickets a
    WHERE a.status != '已关闭' 
    AND NOT EXISTS (SELECT 1 FROM anomaly_follow_ups f WHERE f.ticket_id = a.id)`).get().c;

  const todayNextCount = db.prepare(`SELECT COUNT(*) as c FROM anomaly_tickets a
    WHERE a.status != '已关闭' 
    AND (SELECT f.expected_next_date FROM anomaly_follow_ups f WHERE f.ticket_id = a.id ORDER BY f.created_at DESC LIMIT 1) = date('now')`).get().c;

  const typeStats = db.prepare(`SELECT anomaly_type, COUNT(*) as count 
    FROM anomaly_tickets GROUP BY anomaly_type ORDER BY count DESC`).all();

  res.json({
    data, total,
    page: Number(page), pageSize: Number(pageSize),
    status_counts: {
      pending: countsMap['待处理'] || 0,
      processing: countsMap['处理中'] || 0,
      closed: countsMap['已关闭'] || 0
    },
    overdue_count: overdueCount,
    follow_up_counts: {
      need_follow_up: needFollowUpCount,
      no_follow_up: noFollowUpCount,
      today_next: todayNextCount
    },
    type_stats: typeStats
  });
});

app.get('/api/anomaly-tickets/:id', authMiddleware, (req, res) => {
  const ticket = db.prepare(`SELECT a.*,
    t.tag_code, t.rfid_code, t.status as tag_status,
    g.garment_code, g.garment_name, g.season, g.color, g.size, c.category_name,
    h.record_no as hang_record_no, h.status as hang_status,
    da.area_name, da.area_code, da.floor, h.layer_no, h.position_no,
    rp.person_name, rp.person_code, rp.department, rp.phone, rp.email,
    u1.real_name as reporter_name,
    u2.real_name as handler_name,
    u3.real_name as closer_name,
    julianday(a.expected_handle_date) - julianday(date('now')) as days_left,
    (SELECT COUNT(*) FROM anomaly_follow_ups f WHERE f.ticket_id = a.id) as follow_up_count,
    (SELECT MAX(f.created_at) FROM anomaly_follow_ups f WHERE f.ticket_id = a.id) as last_follow_up_time
    FROM anomaly_tickets a
    LEFT JOIN hanging_records h ON a.hang_id = h.id
    LEFT JOIN tags t ON a.tag_id = t.id
    LEFT JOIN garments g ON a.garment_id = g.id
    LEFT JOIN categories c ON g.category_id = c.id
    LEFT JOIN display_areas da ON h.area_id = da.id
    LEFT JOIN responsible_persons rp ON a.responsible_id = rp.id
    LEFT JOIN users u1 ON a.reporter_id = u1.id
    LEFT JOIN users u2 ON a.current_handler_id = u2.id
    LEFT JOIN users u3 ON a.close_user_id = u3.id
    WHERE a.id = ?`).get(req.params.id);
  if (!ticket) return res.status(404).json({ message: '异常处置单不存在' });

  const expiry = ticket.expected_handle_date && ticket.status !== '已关闭' ? getExpiryStatus(ticket.expected_handle_date) : null;
  const ticketWithExpiry = { ...ticket, is_overdue: expiry?.status === 'overdue', days_left: expiry?.daysLeft ?? null };

  const handoverLogs = db.prepare(`SELECT hl.*,
    u1.real_name as from_user_name, u2.real_name as to_user_name
    FROM anomaly_handover_logs hl
    LEFT JOIN users u1 ON hl.from_user_id = u1.id
    LEFT JOIN users u2 ON hl.to_user_id = u2.id
    WHERE hl.ticket_id = ? ORDER BY hl.handover_time DESC`).all(req.params.id);

  const followUps = db.prepare(`SELECT f.*, u.real_name as handler_name
    FROM anomaly_follow_ups f
    LEFT JOIN users u ON f.handler_id = u.id
    WHERE f.ticket_id = ? ORDER BY f.created_at DESC`).all(req.params.id);
  const followUpsEnriched = followUps.map(row => ({
    ...row,
    images: row.images ? JSON.parse(row.images) : []
  }));

  res.json({ data: { ...ticketWithExpiry, handoverLogs, followUps: followUpsEnriched } });
});

app.post('/api/anomaly-tickets', authMiddleware, (req, res) => {
  const { hangId, anomalyType, description, responsibleId, expectedHandleDate } = req.body;
  if (!anomalyType || !description) {
    return res.status(400).json({ message: '异常类型和问题描述必填' });
  }
  if (!hangId) {
    return res.status(400).json({ message: '请选择关联挂装记录' });
  }

  const hang = db.prepare('SELECT * FROM hanging_records WHERE id = ?').get(hangId);
  if (!hang) return res.status(404).json({ message: '挂装记录不存在' });
  if (!['已挂装', '待调换', '异常观察'].includes(hang.status)) {
    return res.status(400).json({ message: `当前挂装状态"${hang.status}"不允许发起异常登记` });
  }

  const tagId = hang.tag_id;
  const garmentId = hang.garment_id;

  const ticketNo = generateRecordNo('EXC');
  const tx = db.transaction(() => {
    const info = db.prepare(`INSERT INTO anomaly_tickets 
      (ticket_no, hang_id, tag_id, garment_id, anomaly_type, description, responsible_id, reporter_id, expected_handle_date, status, current_handler_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '待处理', ?)`)
      .run(ticketNo, hangId, tagId, garmentId, anomalyType, description, responsibleId || null, req.user.id, expectedHandleDate || null, req.user.id);

    db.prepare('UPDATE hanging_records SET status = ? WHERE id = ?').run('异常观察', hangId);
    updateTagStatus(tagId, '异常观察');
    return info;
  });
  const result = tx();
  logOperation(req.user.id, '创建异常处置单', 'anomaly_ticket', result.lastInsertRowid, `${ticketNo} - ${anomalyType}`);
  res.json({ data: { id: result.lastInsertRowid, ticketNo }, message: '异常处置单已创建' });
});

app.post('/api/anomaly-tickets/:id/handle', authMiddleware, (req, res) => {
  const { handleResult } = req.body;
  const ticket = db.prepare('SELECT * FROM anomaly_tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ message: '异常处置单不存在' });
  if (ticket.status === '已关闭') return res.status(400).json({ message: '已关闭的处置单不可处理' });

  const tx = db.transaction(() => {
    const newResult = ticket.handle_result
      ? `${ticket.handle_result}\n${handleResult || ''}`
      : (handleResult || '');
    db.prepare(`UPDATE anomaly_tickets SET 
      status = '处理中', handle_result = ?, 
      handle_time = CURRENT_TIMESTAMP, current_handler_id = ?
      WHERE id = ?`).run(newResult, req.user.id, req.params.id);
  });
  tx();
  logOperation(req.user.id, '处理异常处置单', 'anomaly_ticket', req.params.id, ticket.ticket_no);
  res.json({ message: '异常处置单处理中' });
});

app.post('/api/anomaly-tickets/:id/handover', authMiddleware, (req, res) => {
  const { toUserId, handoverRemark } = req.body;
  if (!toUserId) return res.status(400).json({ message: '请选择转交接收人' });

  const ticket = db.prepare('SELECT * FROM anomaly_tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ message: '异常处置单不存在' });
  if (ticket.status === '已关闭') return res.status(400).json({ message: '已关闭的处置单不可转交' });

  const toUser = db.prepare('SELECT * FROM users WHERE id = ?').get(toUserId);
  if (!toUser) return res.status(404).json({ message: '接收人不存在' });

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO anomaly_handover_logs 
      (ticket_id, from_user_id, to_user_id, handover_remark)
      VALUES (?, ?, ?, ?)`).run(req.params.id, ticket.current_handler_id || req.user.id, toUserId, handoverRemark || '');
    db.prepare(`UPDATE anomaly_tickets SET 
      current_handler_id = ?, status = '处理中'
      WHERE id = ?`).run(toUserId, req.params.id);
  });
  tx();
  logOperation(req.user.id, '转交异常处置单', 'anomaly_ticket', req.params.id, `${ticket.ticket_no} -> ${toUser.real_name}`);
  res.json({ message: '转交成功' });
});

app.post('/api/anomaly-tickets/:id/close', authMiddleware, (req, res) => {
  const { closeRemark } = req.body;
  const ticket = db.prepare('SELECT * FROM anomaly_tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ message: '异常处置单不存在' });
  if (ticket.status === '已关闭') return res.status(400).json({ message: '该处置单已关闭' });

  const tx = db.transaction(() => {
    db.prepare(`UPDATE anomaly_tickets SET 
      status = '已关闭', close_user_id = ?, close_time = CURRENT_TIMESTAMP, close_remark = ?
      WHERE id = ?`).run(req.user.id, closeRemark || '', req.params.id);

    if (ticket.hang_id) {
      const remainUnresolvedAnomaly = db.prepare(`SELECT COUNT(*) as c FROM anomaly_tickets 
        WHERE hang_id = ? AND status != '已关闭' AND id != ?`).get(ticket.hang_id, req.params.id).c;
      const remainUnresolvedMissing = db.prepare(`SELECT COUNT(*) as c FROM missing_part_notes 
        WHERE hang_id = ? AND status != '已处理'`).get(ticket.hang_id).c;
      const pendingRecovery = db.prepare(`SELECT COUNT(*) as c FROM recovery_records 
        WHERE hang_id = ? AND status = '待回收确认'`).get(ticket.hang_id).c;

      if (remainUnresolvedAnomaly === 0 && remainUnresolvedMissing === 0) {
        if (pendingRecovery > 0) {
          db.prepare('UPDATE hanging_records SET status = ? WHERE id = ?').run('待回收确认', ticket.hang_id);
          updateTagStatus(ticket.tag_id, '待回收确认');
        } else {
          const hang = db.prepare('SELECT status FROM hanging_records WHERE id = ?').get(ticket.hang_id);
          if (hang && hang.status === '异常观察') {
            db.prepare('UPDATE hanging_records SET status = ? WHERE id = ?').run('已挂装', ticket.hang_id);
            updateTagStatus(ticket.tag_id, '已挂装');
          }
        }
      }
    } else if (ticket.tag_id) {
      const remainUnresolvedAnomaly = db.prepare(`SELECT COUNT(*) as c FROM anomaly_tickets 
        WHERE tag_id = ? AND status != '已关闭' AND id != ?`).get(ticket.tag_id, req.params.id).c;
      const remainUnresolvedMissing = db.prepare(`SELECT COUNT(*) as c FROM missing_part_notes 
        WHERE tag_id = ? AND status != '已处理'`).get(ticket.tag_id).c;
      if (remainUnresolvedAnomaly === 0 && remainUnresolvedMissing === 0) {
        const tag = db.prepare('SELECT status FROM tags WHERE id = ?').get(ticket.tag_id);
        if (tag && tag.status === '异常观察') {
          updateTagStatus(ticket.tag_id, '待挂牌');
        }
      }
    }
  });
  tx();
  logOperation(req.user.id, '关闭异常处置单', 'anomaly_ticket', req.params.id, ticket.ticket_no);
  res.json({ message: '异常处置单已关闭，关联挂牌状态已根据剩余异常情况自动恢复' });
});

app.post('/api/anomaly-tickets/:id/follow-up', authMiddleware, (req, res) => {
  const { followUpContent, images, remark, nextStepPlan, expectedNextDate } = req.body;
  if (!followUpContent || !followUpContent.trim()) {
    return res.status(400).json({ message: '跟进内容必填' });
  }
  const ticket = db.prepare('SELECT * FROM anomaly_tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ message: '异常处置单不存在' });
  if (ticket.status === '已关闭') return res.status(400).json({ message: '已关闭的处置单不可添加跟进记录' });

  const tx = db.transaction(() => {
    const info = db.prepare(`INSERT INTO anomaly_follow_ups 
      (ticket_id, handler_id, follow_up_content, images, remark, next_step_plan, expected_next_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      req.params.id, req.user.id, followUpContent.trim(),
      images ? JSON.stringify(images) : null,
      remark || '',
      nextStepPlan || '',
      expectedNextDate || null
    );

    db.prepare(`UPDATE anomaly_tickets SET 
      status = '处理中', handle_time = CURRENT_TIMESTAMP, current_handler_id = ?
      WHERE id = ?`).run(req.user.id, req.params.id);

    return info;
  });
  const result = tx();
  logOperation(req.user.id, '添加异常跟进记录', 'anomaly_follow_up', result.lastInsertRowid, ticket.ticket_no);
  res.json({ data: { id: result.lastInsertRowid }, message: '跟进记录已添加' });
});

app.get('/api/anomaly-tickets/:id/follow-ups', authMiddleware, (req, res) => {
  const ticket = db.prepare('SELECT id FROM anomaly_tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ message: '异常处置单不存在' });

  const data = db.prepare(`SELECT f.*, u.real_name as handler_name
    FROM anomaly_follow_ups f
    LEFT JOIN users u ON f.handler_id = u.id
    WHERE f.ticket_id = ? ORDER BY f.created_at DESC`).all(req.params.id);

  const enriched = data.map(row => ({
    ...row,
    images: row.images ? JSON.parse(row.images) : []
  }));

  res.json({ data: enriched });
});

app.get('/api/hanging-records/:id/anomalies', authMiddleware, (req, res) => {
  const data = db.prepare(`SELECT a.*,
    u1.real_name as reporter_name, u2.real_name as handler_name,
    julianday(a.expected_handle_date) - julianday(date('now')) as days_left,
    (SELECT COUNT(*) FROM anomaly_follow_ups f WHERE f.ticket_id = a.id) as follow_up_count,
    (SELECT MAX(f.created_at) FROM anomaly_follow_ups f WHERE f.ticket_id = a.id) as last_follow_up_time,
    (SELECT f.next_step_plan FROM anomaly_follow_ups f WHERE f.ticket_id = a.id ORDER BY f.created_at DESC LIMIT 1) as next_step_plan,
    (SELECT f.expected_next_date FROM anomaly_follow_ups f WHERE f.ticket_id = a.id ORDER BY f.created_at DESC LIMIT 1) as expected_next_date
    FROM anomaly_tickets a
    LEFT JOIN users u1 ON a.reporter_id = u1.id
    LEFT JOIN users u2 ON a.current_handler_id = u2.id
    WHERE a.hang_id = ? ORDER BY a.report_time DESC`).all(req.params.id);
  const enriched = data.map(row => {
    let overdue = false;
    if (row.expected_handle_date && row.status !== '已关闭') {
      const exp = getExpiryStatus(row.expected_handle_date);
      overdue = exp?.status === 'overdue';
    }
    let nextOverdue = false;
    if (row.expected_next_date && row.status !== '已关闭') {
      const exp = getExpiryStatus(row.expected_next_date);
      nextOverdue = exp?.status === 'overdue';
    }
    return { ...row, is_overdue: overdue, is_next_overdue: nextOverdue };
  });

  const ticketIds = enriched.map(t => t.id);
  let allFollowUps = [];
  if (ticketIds.length > 0) {
    const placeholders = ticketIds.map(() => '?').join(',');
    allFollowUps = db.prepare(`SELECT f.*, u.real_name as handler_name
      FROM anomaly_follow_ups f
      LEFT JOIN users u ON f.handler_id = u.id
      WHERE f.ticket_id IN (${placeholders})
      ORDER BY f.ticket_id, f.created_at DESC`).all(...ticketIds);
    allFollowUps = allFollowUps.map(row => ({
      ...row,
      images: row.images ? JSON.parse(row.images) : []
    }));
  }

  const enrichedWithFollowUps = enriched.map(ticket => ({
    ...ticket,
    followUps: allFollowUps.filter(f => f.ticket_id === ticket.id)
  }));

  res.json({ data: enrichedWithFollowUps });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: '服务器内部错误', error: err.message });
});

app.listen(PORT, () => {
  console.log(`RFID样衣挂牌陈列流转系统后端已启动: http://localhost:${PORT}`);
});
