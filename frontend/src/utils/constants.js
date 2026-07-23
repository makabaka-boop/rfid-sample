export const TAG_STATUS_OPTIONS = [
  { value: '待挂牌', label: '待挂牌', type: 'warning' },
  { value: '已挂装', label: '已挂装', type: 'success' },
  { value: '待调换', label: '待调换', type: 'primary' },
  { value: '待回收确认', label: '待回收确认', type: 'danger' },
  { value: '已回收', label: '已回收', type: 'info' },
  { value: '异常观察', label: '异常观察', type: 'danger' }
]

export const RECOVERY_STATUS_OPTIONS = [
  { value: '待回收确认', label: '待回收确认', type: 'warning' },
  { value: '已回收', label: '已回收', type: 'success' },
  { value: '已驳回', label: '已驳回', type: 'info' }
]

export const MISSING_STATUS_OPTIONS = [
  { value: '未处理', label: '未处理', type: 'danger' },
  { value: '处理中', label: '处理中', type: 'warning' },
  { value: '已处理', label: '已处理', type: 'success' }
]

export const MISSING_TYPE_OPTIONS = [
  { value: '挂牌丢失', label: '挂牌丢失' },
  { value: '挂牌损坏', label: '挂牌损坏' },
  { value: '样衣破损', label: '样衣破损' },
  { value: '样衣污渍', label: '样衣污渍' },
  { value: '配件缺失', label: '配件缺失' },
  { value: '尺码标缺失', label: '尺码标缺失' },
  { value: '其他', label: '其他' }
]

export const ANOMALY_STATUS_OPTIONS = [
  { value: '待处理', label: '待处理', type: 'danger' },
  { value: '处理中', label: '处理中', type: 'warning' },
  { value: '已关闭', label: '已关闭', type: 'success' }
]

export const ANOMALY_TYPE_OPTIONS = [
  { value: '挂牌丢失', label: '挂牌丢失' },
  { value: '挂牌损坏', label: '挂牌损坏' },
  { value: '样衣破损', label: '样衣破损' },
  { value: '样衣污渍', label: '样衣污渍' },
  { value: '样衣遗失', label: '样衣遗失' },
  { value: '配件缺失', label: '配件缺失' },
  { value: '尺码标缺失', label: '尺码标缺失' },
  { value: '陈列错误', label: '陈列错误' },
  { value: '超期未处理', label: '超期未处理' },
  { value: '其他', label: '其他' }
]

export function getAnomalyStatusTagType(status) {
  const map = {
    '待处理': 'danger',
    '处理中': 'warning',
    '已关闭': 'success'
  }
  return map[status] || 'info'
}

export function getStatusClass(status) {
  const map = {
    '待挂牌': 'status-pending',
    '已挂装': 'status-hanged',
    '待调换': 'status-swap',
    '待回收确认': 'status-recovery',
    '已回收': 'status-done',
    '已驳回': 'status-done',
    '异常观察': 'status-abnormal',
    '未处理': 'status-recovery',
    '处理中': 'status-pending',
    '已处理': 'status-done'
  }
  return map[status] || 'status-done'
}

export function getStatusTagType(status) {
  const map = {
    '待挂牌': 'warning',
    '已挂装': 'success',
    '待调换': 'primary',
    '待回收确认': 'warning',
    '已回收': 'info',
    '已驳回': 'info',
    '异常观察': 'danger',
    '未处理': 'danger',
    '处理中': 'warning',
    '已处理': 'success',
    '待处理': 'danger'
  }
  return map[status] || 'info'
}

export const EXPIRY_STATUS_OPTIONS = [
  { value: 'expiring', label: '即将到期', type: 'warning' },
  { value: 'overdue', label: '已超期', type: 'danger' },
  { value: 'normal', label: '正常', type: 'success' }
]

export function getExpiryStatusTagType(status) {
  const map = {
    'expiring': 'warning',
    'overdue': 'danger',
    'normal': 'success'
  }
  return map[status] || 'info'
}

export function getExpiryStatusLabel(status) {
  const map = {
    'expiring': '即将到期',
    'overdue': '已超期',
    'normal': '正常'
  }
  return map[status] || '未设置'
}

export function getDaysLeftText(daysLeft, expiryStatus) {
  if (daysLeft === null || daysLeft === undefined) return '-'
  if (expiryStatus === 'overdue') {
    return `已超期${Math.abs(daysLeft)}天`
  }
  if (daysLeft === 0) return '今天到期'
  if (daysLeft === 1) return '明天到期'
  return `剩余${daysLeft}天`
}
