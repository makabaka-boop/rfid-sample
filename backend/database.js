const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'data.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      real_name TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tag_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_code TEXT UNIQUE NOT NULL,
      template_name TEXT NOT NULL,
      description TEXT,
      fields TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_code TEXT UNIQUE NOT NULL,
      template_id INTEGER,
      rfid_code TEXT,
      status TEXT DEFAULT '待挂牌',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES tag_templates(id)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_code TEXT UNIQUE NOT NULL,
      category_name TEXT NOT NULL,
      parent_id INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS garments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      garment_code TEXT UNIQUE NOT NULL,
      garment_name TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      season TEXT,
      color TEXT,
      size TEXT,
      fabric TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS display_areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      area_code TEXT UNIQUE NOT NULL,
      area_name TEXT NOT NULL,
      floor INTEGER DEFAULT 1,
      zone TEXT,
      capacity INTEGER DEFAULT 10,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS responsible_persons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_code TEXT UNIQUE NOT NULL,
      person_name TEXT NOT NULL,
      department TEXT,
      phone TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hanging_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_no TEXT UNIQUE NOT NULL,
      tag_id INTEGER NOT NULL,
      garment_id INTEGER NOT NULL,
      area_id INTEGER NOT NULL,
      layer_no INTEGER NOT NULL,
      position_no INTEGER NOT NULL,
      responsible_id INTEGER NOT NULL,
      operator_id INTEGER,
      hang_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      expected_off_date DATE,
      status TEXT DEFAULT '已挂装',
      remark TEXT,
      FOREIGN KEY (tag_id) REFERENCES tags(id),
      FOREIGN KEY (garment_id) REFERENCES garments(id),
      FOREIGN KEY (area_id) REFERENCES display_areas(id),
      FOREIGN KEY (responsible_id) REFERENCES responsible_persons(id),
      FOREIGN KEY (operator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS swap_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_no TEXT UNIQUE NOT NULL,
      original_hang_id INTEGER NOT NULL,
      original_garment_id INTEGER,
      original_area_id INTEGER,
      original_layer_no INTEGER,
      original_position_no INTEGER,
      new_garment_id INTEGER NOT NULL,
      new_area_id INTEGER,
      new_layer_no INTEGER,
      new_position_no INTEGER,
      swap_reason TEXT,
      operator_id INTEGER,
      swap_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (original_hang_id) REFERENCES hanging_records(id),
      FOREIGN KEY (original_garment_id) REFERENCES garments(id),
      FOREIGN KEY (original_area_id) REFERENCES display_areas(id),
      FOREIGN KEY (new_garment_id) REFERENCES garments(id),
      FOREIGN KEY (new_area_id) REFERENCES display_areas(id),
      FOREIGN KEY (operator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS recovery_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_no TEXT UNIQUE NOT NULL,
      hang_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      garment_id INTEGER NOT NULL,
      recover_operator_id INTEGER,
      recover_time DATETIME,
      confirm_operator_id INTEGER,
      confirm_time DATETIME,
      status TEXT DEFAULT '待回收确认',
      original_status TEXT,
      remark TEXT,
      FOREIGN KEY (hang_id) REFERENCES hanging_records(id),
      FOREIGN KEY (tag_id) REFERENCES tags(id),
      FOREIGN KEY (garment_id) REFERENCES garments(id),
      FOREIGN KEY (recover_operator_id) REFERENCES users(id),
      FOREIGN KEY (confirm_operator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS missing_part_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_no TEXT UNIQUE NOT NULL,
      hang_id INTEGER,
      tag_id INTEGER,
      garment_id INTEGER,
      missing_type TEXT NOT NULL,
      missing_description TEXT NOT NULL,
      reporter_id INTEGER,
      report_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      handler_id INTEGER,
      handle_time DATETIME,
      handle_result TEXT,
      status TEXT DEFAULT '未处理',
      FOREIGN KEY (hang_id) REFERENCES hanging_records(id),
      FOREIGN KEY (tag_id) REFERENCES tags(id),
      FOREIGN KEY (garment_id) REFERENCES garments(id),
      FOREIGN KEY (reporter_id) REFERENCES users(id),
      FOREIGN KEY (handler_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS anomaly_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_no TEXT UNIQUE NOT NULL,
      hang_id INTEGER,
      tag_id INTEGER,
      garment_id INTEGER,
      anomaly_type TEXT NOT NULL,
      description TEXT NOT NULL,
      responsible_id INTEGER,
      reporter_id INTEGER,
      report_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      expected_handle_date DATE,
      status TEXT DEFAULT '待处理',
      current_handler_id INTEGER,
      handle_result TEXT,
      handle_time DATETIME,
      close_user_id INTEGER,
      close_time DATETIME,
      close_remark TEXT,
      FOREIGN KEY (hang_id) REFERENCES hanging_records(id),
      FOREIGN KEY (tag_id) REFERENCES tags(id),
      FOREIGN KEY (garment_id) REFERENCES garments(id),
      FOREIGN KEY (responsible_id) REFERENCES responsible_persons(id),
      FOREIGN KEY (reporter_id) REFERENCES users(id),
      FOREIGN KEY (current_handler_id) REFERENCES users(id),
      FOREIGN KEY (close_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS anomaly_handover_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      from_user_id INTEGER,
      to_user_id INTEGER NOT NULL,
      handover_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      handover_remark TEXT,
      FOREIGN KEY (ticket_id) REFERENCES anomaly_tickets(id),
      FOREIGN KEY (from_user_id) REFERENCES users(id),
      FOREIGN KEY (to_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS anomaly_follow_ups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      handler_id INTEGER,
      follow_up_content TEXT NOT NULL,
      images TEXT,
      remark TEXT,
      next_step_plan TEXT,
      expected_next_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES anomaly_tickets(id),
      FOREIGN KEY (handler_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      detail TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_tags_status ON tags(status);
    CREATE INDEX IF NOT EXISTS idx_garments_category ON garments(category_id);
    CREATE INDEX IF NOT EXISTS idx_hang_tag ON hanging_records(tag_id);
    CREATE INDEX IF NOT EXISTS idx_hang_garment ON hanging_records(garment_id);
    CREATE INDEX IF NOT EXISTS idx_hang_area ON hanging_records(area_id, layer_no, position_no);
    CREATE INDEX IF NOT EXISTS idx_hang_status ON hanging_records(status);
    CREATE INDEX IF NOT EXISTS idx_swap_original ON swap_records(original_hang_id);
    CREATE INDEX IF NOT EXISTS idx_recovery_status ON recovery_records(status);
    CREATE INDEX IF NOT EXISTS idx_missing_status ON missing_part_notes(status);
    CREATE INDEX IF NOT EXISTS idx_anomaly_status ON anomaly_tickets(status);
    CREATE INDEX IF NOT EXISTS idx_anomaly_hang ON anomaly_tickets(hang_id);
    CREATE INDEX IF NOT EXISTS idx_anomaly_tag ON anomaly_tickets(tag_id);
    CREATE INDEX IF NOT EXISTS idx_followup_ticket ON anomaly_follow_ups(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_followup_created ON anomaly_follow_ups(created_at);
  `);

  migrateDatabase();
  seedInitialData();
}

function migrateDatabase() {
  const swapCols = db.prepare(`PRAGMA table_info(swap_records)`).all();
  const swapColNames = swapCols.map(c => c.name);
  if (!swapColNames.includes('original_garment_id')) {
    db.prepare(`ALTER TABLE swap_records ADD COLUMN original_garment_id INTEGER`).run();
  }
  if (!swapColNames.includes('original_area_id')) {
    db.prepare(`ALTER TABLE swap_records ADD COLUMN original_area_id INTEGER`).run();
  }
  if (!swapColNames.includes('original_layer_no')) {
    db.prepare(`ALTER TABLE swap_records ADD COLUMN original_layer_no INTEGER`).run();
  }
  if (!swapColNames.includes('original_position_no')) {
    db.prepare(`ALTER TABLE swap_records ADD COLUMN original_position_no INTEGER`).run();
  }
  if (!swapColNames.includes('expected_off_date')) {
    db.prepare(`ALTER TABLE swap_records ADD COLUMN expected_off_date DATE`).run();
  }

  const hangCols = db.prepare(`PRAGMA table_info(hanging_records)`).all();
  const hangColNames = hangCols.map(c => c.name);
  if (!hangColNames.includes('expected_off_date')) {
    db.prepare(`ALTER TABLE hanging_records ADD COLUMN expected_off_date DATE`).run();
  }

  const recCols = db.prepare(`PRAGMA table_info(recovery_records)`).all();
  const recColNames = recCols.map(c => c.name);
  if (!recColNames.includes('original_status')) {
    db.prepare(`ALTER TABLE recovery_records ADD COLUMN original_status TEXT`).run();
  }
}

function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`INSERT INTO users (username, password, real_name, role) VALUES (?, ?, ?, ?)`).run(
      'admin', hash, '系统管理员', 'admin'
    );
    const hash2 = bcrypt.hashSync('user123', 10);
    db.prepare(`INSERT INTO users (username, password, real_name, role) VALUES (?, ?, ?, ?)`).run(
      'operator01', hash2, '张挂装', 'user'
    );
    db.prepare(`INSERT INTO users (username, password, real_name, role) VALUES (?, ?, ?, ?)`).run(
      'operator02', hash2, '李回收', 'user'
    );
  }

  const tagTplCount = db.prepare('SELECT COUNT(*) as count FROM tag_templates').get().count;
  if (tagTplCount === 0) {
    const tpls = [
      ['TPL001', '标准样衣挂牌', '通用样衣展示挂牌模板', '{"fields":["款号","季节","颜色","尺码","面料"]}'],
      ['TPL002', '高级定制挂牌', '高端定制系列挂牌模板', '{"fields":["款号","设计师","面料成分","工艺说明"]}'],
      ['TPL003', '季节主题挂牌', '按季节主题分类挂牌', '{"fields":["主题","系列","款号","上架时间"]}']
    ];
    const stmt = db.prepare('INSERT INTO tag_templates (template_code, template_name, description, fields) VALUES (?, ?, ?, ?)');
    tpls.forEach(t => stmt.run(...t));

    const tags = [];
    for (let i = 1; i <= 20; i++) {
      tags.push([`TAG${String(i).padStart(5, '0')}`, (i % 3) + 1, `RFID${String(i).padStart(8, '0')}`]);
    }
    const tagStmt = db.prepare('INSERT INTO tags (tag_code, template_id, rfid_code) VALUES (?, ?, ?)');
    tags.forEach(t => tagStmt.run(...t));
  }

  const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  if (catCount === 0) {
    const cats = [
      ['CAT001', '上装', 0, 1],
      ['CAT002', '下装', 0, 2],
      ['CAT003', '连衣裙', 0, 3],
      ['CAT004', '外套', 0, 4],
      ['CAT005', '配饰', 0, 5],
      ['CAT101', 'T恤', 1, 1],
      ['CAT102', '衬衫', 1, 2],
      ['CAT103', '卫衣', 1, 3],
      ['CAT201', '牛仔裤', 2, 1],
      ['CAT202', '休闲裤', 2, 2],
      ['CAT203', '半身裙', 2, 3],
      ['CAT401', '风衣', 4, 1],
      ['CAT402', '夹克', 4, 2],
      ['CAT403', '西装', 4, 3]
    ];
    const stmt = db.prepare('INSERT INTO categories (category_code, category_name, parent_id, sort_order) VALUES (?, ?, ?, ?)');
    cats.forEach(c => stmt.run(...c));
  }

  const garmentCount = db.prepare('SELECT COUNT(*) as count FROM garments').get().count;
  if (garmentCount === 0) {
    const garments = [
      ['GM2024001', '纯棉圆领T恤', 6, '2024春', '白色', 'M,L,XL', '100%棉', '经典休闲款'],
      ['GM2024002', '商务修身衬衫', 7, '2024春', '浅蓝色', 'S,M,L,XL', '70%棉30%涤', '商务通勤必备'],
      ['GM2024003', '加绒套头卫衣', 8, '2024春', '灰色', 'M,L,XL,XXL', '80%棉20%涤', '舒适保暖'],
      ['GM2024004', '直筒牛仔裤', 9, '2024春', '深蓝', '28-36', '98%棉2%氨纶', '经典水洗'],
      ['GM2024005', '弹力休闲裤', 10, '2024春', '卡其色', 'S-XXL', '65%棉33%涤2%氨纶', '商务休闲两穿'],
      ['GM2024006', 'A字半身裙', 11, '2024春', '黑色', 'S,M,L', '聚酯纤维', '优雅通勤'],
      ['GM2024007', '印花连衣裙', 3, '2024夏', '花色', 'S,M,L,XL', '雪纺', '度假风'],
      ['GM2024008', '系带风衣', 12, '2024春', '驼色', 'S,M,L', '70%棉30%涤', '经典英伦风'],
      ['GM2024009', '机车夹克', 13, '2024春', '黑色', 'S,M,L,XL', 'PU皮', '酷帅街头风'],
      ['GM2024010', '双排扣西装', 14, '2024春', '藏青', 'S,M,L,XL', '羊毛混纺', '正装商务'],
      ['GM2024011', 'V领针织衫', 6, '2024春', '米色', 'S,M,L', '100%羊毛', '百搭打底'],
      ['GM2024012', '高腰阔腿裤', 10, '2024春', '黑色', 'S,M,L,XL', '西装面料', '显高显瘦'],
      ['GM2024013', '法式茶歇裙', 3, '2024夏', '复古碎花', 'S,M,L', '棉混纺', '浪漫优雅'],
      ['GM2024014', '廓形毛呢大衣', 12, '2024秋冬', '燕麦色', 'S,M,L', '90%羊毛10%羊绒', '高端品质'],
      ['GM2024015', '棒球服外套', 13, '2024春', '拼色', 'M,L,XL', 'PU拼接', '运动潮流']
    ];
    const stmt = db.prepare('INSERT INTO garments (garment_code, garment_name, category_id, season, color, size, fabric, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    garments.forEach(g => stmt.run(...g));
  }

  const areaCount = db.prepare('SELECT COUNT(*) as count FROM display_areas').get().count;
  if (areaCount === 0) {
    const areas = [
      ['AREA-A', 'A区-春季新品', 1, '主通道左侧', 15],
      ['AREA-B', 'B区-夏季热卖', 1, '主通道右侧', 15],
      ['AREA-C', 'C区-经典系列', 2, '北侧专区', 20],
      ['AREA-D', 'D区-高端定制', 2, 'VIP室旁', 10],
      ['AREA-E', 'E区-促销折扣', 1, '入口处', 25]
    ];
    const stmt = db.prepare('INSERT INTO display_areas (area_code, area_name, floor, zone, capacity) VALUES (?, ?, ?, ?, ?)');
    areas.forEach(a => stmt.run(...a));
  }

  const personCount = db.prepare('SELECT COUNT(*) as count FROM responsible_persons').get().count;
  if (personCount === 0) {
    const persons = [
      ['RSP001', '王设计', '设计部', '13800000001', 'wang@company.com'],
      ['RSP002', '赵陈列', '陈列部', '13800000002', 'zhao@company.com'],
      ['RSP003', '孙销售', '销售部', '13800000003', 'sun@company.com'],
      ['RSP004', '周采购', '采购部', '13800000004', 'zhou@company.com'],
      ['RSP005', '吴仓储', '仓储部', '13800000005', 'wu@company.com']
    ];
    const stmt = db.prepare('INSERT INTO responsible_persons (person_code, person_name, department, phone, email) VALUES (?, ?, ?, ?, ?)');
    persons.forEach(p => stmt.run(...p));
  }
}

module.exports = { db, initDatabase };
