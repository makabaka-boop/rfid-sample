<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">库位占用看板</div>
      <div>
        <el-button :icon="Download" @click="handleExport" :loading="exporting">导出明细</el-button>
        <el-button :icon="Refresh" @click="loadData">刷新</el-button>
      </div>
    </div>

    <div class="filter-card">
      <el-form :inline="true" :model="filters" @submit.prevent>
        <el-form-item label="楼层">
          <el-select v-model="filters.floor" placeholder="全部楼层" clearable style="width:130px;">
            <el-option v-for="f in floors" :key="f" :label="`${f}楼`" :value="f" />
          </el-select>
        </el-form-item>
        <el-form-item label="区域">
          <el-select v-model="filters.areaId" placeholder="全部区域" clearable filterable style="width:200px;">
            <el-option v-for="a in areasAll" :key="a.id" :label="`${a.area_name}（${a.floor}楼）`" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="挂牌状态">
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width:150px;">
            <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="负责人">
          <el-select v-model="filters.responsibleId" placeholder="全部负责人" clearable filterable style="width:160px;">
            <el-option v-for="p in responsiblePersons" :key="p.id" :label="`${p.person_name}（${p.department}）`" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input v-model="filters.keyword" placeholder="样衣/挂牌/单号/负责人" clearable style="width:220px;" @keyup.enter="loadData()" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="loadData()">查询</el-button>
          <el-button :icon="Refresh" @click="resetFilters">重置</el-button>
          <el-button type="success" plain :icon="Aim" @click="toggleOnlyFree">
            {{ onlyFree ? '显示全部' : '仅看空闲' }}
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <el-alert
      v-if="highOccupancyAreas.length && !filters.status"
      type="warning"
      :closable="false"
      class="mb-16"
      show-icon
    >
      <template #title>
        <span style="font-weight:600;">高占用区域提醒：</span>
        <span v-for="(a, i) in highOccupancyAreas" :key="a.id">
          <el-link type="warning" :underline="false" @click="jumpToArea(a.id)">{{ a.floor }}楼-{{ a.area_name }}</el-link>
          <span style="color:#e6a23c;">({{ Math.round(a.occupancy_rate * 100) }}%)</span>
          <span v-if="i < highOccupancyAreas.length - 1" style="margin:0 4px;">、</span>
        </span>
        <span style="color:#909399; margin-left:8px;">建议尽快调整陈列以预留空位</span>
      </template>
    </el-alert>

    <el-row :gutter="12" class="mb-16">
      <el-col :span="3" v-for="s in summaryCards" :key="s.label">
        <div class="stat-card flex-between" :style="{ cursor: s.click ? 'pointer' : 'default', borderLeft: `4px solid ${s.color}` }" @click="s.click && s.click()">
          <div>
            <div class="stat-label">{{ s.label }}</div>
            <div class="stat-value" :style="{ color: s.color }">{{ s.value }}</div>
          </div>
          <el-icon class="stat-icon" :style="{ color: s.color }"><component :is="s.icon" /></el-icon>
        </div>
      </el-col>
    </el-row>

    <div class="legend-bar">
      <span class="legend-title">图例：</span>
      <span class="legend-item"><span class="legend-dot slot-free"></span>空闲</span>
      <span class="legend-item"><span class="legend-dot slot-occupied"></span>已挂装</span>
      <span class="legend-item"><span class="legend-dot slot-swap"></span>待调换</span>
      <span class="legend-item"><span class="legend-dot slot-recovery"></span>待回收确认</span>
      <span class="legend-item"><span class="legend-dot slot-abnormal"></span>异常观察</span>
      <span class="legend-item"><span class="legend-dot slot-filtered"></span>已被过滤</span>
      <span class="legend-item" style="margin-left:auto; color:#c0c4cc; font-size:12px;">
        数据更新时间：{{ dataUpdateTime }}
      </span>
    </div>

    <div v-if="responsibleStats.length && !filters.status" class="stat-card mb-16">
      <div class="detail-section-title">负责人维度统计</div>
      <el-table :data="responsibleStats" size="small" stripe>
        <el-table-column label="负责人" min-width="120">
          <template #default="{ row }">
            <span style="font-weight:600;">{{ row.person_name }}</span>
            <span style="color:#909399; font-size:12px; margin-left:6px;">{{ row.department }}</span>
          </template>
        </el-table-column>
        <el-table-column label="负责库位" width="100" align="center">
          <template #default="{ row }"><b style="color:#409eff;">{{ row.total_slots }}</b></template>
        </el-table-column>
        <el-table-column label="异常库位" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.abnormal_count > 0" type="danger" size="small" style="cursor:pointer;" @click="filterByResponsible(row.responsible_id, '异常观察')">{{ row.abnormal_count }}</el-tag>
            <span v-else style="color:#c0c4cc;">0</span>
          </template>
        </el-table-column>
        <el-table-column label="待回收" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.pending_recovery_count > 0" type="warning" size="small" style="cursor:pointer;" @click="filterByResponsible(row.responsible_id, '待回收确认')">{{ row.pending_recovery_count }}</el-tag>
            <span v-else style="color:#c0c4cc;">0</span>
          </template>
        </el-table-column>
        <el-table-column label="待调换" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.pending_swap_count > 0" type="info" size="small" style="cursor:pointer;" @click="filterByResponsible(row.responsible_id, '待调换')">{{ row.pending_swap_count }}</el-tag>
            <span v-else style="color:#c0c4cc;">0</span>
          </template>
        </el-table-column>
        <el-table-column label="即将到期/超期" width="130" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.expiring_count > 0" :type="row.expiring_count > 0 ? 'danger' : 'warning'" size="small" style="cursor:pointer;" @click="filterByResponsible(row.responsible_id)">{{ row.expiring_count }}</el-tag>
            <span v-else style="color:#c0c4cc;">0</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="filterByResponsible(row.responsible_id)">只看该负责人</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div v-loading="loading">
      <el-empty v-if="!boardData.areas?.length" description="暂无展示区域数据" />
      <div v-for="area in boardData.areas" :key="area.id" :id="`area-${area.id}`" class="area-card" :class="{ 'area-high-occupancy': area.high_occupancy }">
        <div class="area-header">
          <div class="area-title-row">
            <span class="area-name">{{ area.area_name }}</span>
            <el-tag size="small" type="info">{{ area.area_code }}</el-tag>
            <el-tag size="small">{{ area.floor }}楼</el-tag>
            <span v-if="area.zone" class="area-zone">{{ area.zone }}</span>
            <el-tag v-if="area.high_occupancy" type="danger" size="small" effect="dark">高占用</el-tag>
          </div>
          <div class="area-stats">
            <span class="stat-pill">容量 <b>{{ area.capacity }}</b></span>
            <span class="stat-pill stat-occupied">已占用 <b>{{ area.active_count }}</b></span>
            <span class="stat-pill stat-free" style="cursor:pointer;" @click="quickFilterFree(area)">空闲 <b>{{ area.free_count }}</b></span>
            <span class="stat-pill stat-swap" v-if="area.pending_swap_count">待调换 <b>{{ area.pending_swap_count }}</b></span>
            <span class="stat-pill stat-recovery" v-if="area.pending_recovery_count">待回收 <b>{{ area.pending_recovery_count }}</b></span>
            <span class="stat-pill stat-expiring" v-if="area.expiring_count">临期 <b>{{ area.expiring_count }}</b></span>
            <span class="stat-pill stat-abnormal" :style="{ cursor: area.abnormal_count ? 'pointer' : 'default' }" @click="area.abnormal_count && filterByAbnormal(area)">
              异常 <b>{{ area.abnormal_count }}</b>
            </span>
            <span class="occupancy-rate">
              占用率
              <el-progress :percentage="Math.round(area.occupancy_rate * 100)" :stroke-width="10" :show-text="false" style="width:100px; display:inline-block; margin:0 8px;" :color="occupancyColor(area.occupancy_rate)" />
              <b :style="{ color: occupancyColor(area.occupancy_rate) }">{{ Math.round(area.occupancy_rate * 100) }}%</b>
            </span>
          </div>
        </div>

        <div v-if="area.recommended_free_slots?.length && area.active_count < area.capacity" class="recommend-bar">
          <el-icon><Aim /></el-icon>
          <span>推荐空闲库位：</span>
          <el-tag
            v-for="s in area.recommended_free_slots"
            :key="`r-${s.layer_no}-${s.position_no}`"
            size="small"
            type="success"
            effect="plain"
            style="cursor:pointer; margin:2px;"
            @click="goHangAt(area, s.layer_no, s.position_no)"
          >第{{ s.layer_no }}层-{{ s.position_no }}号位</el-tag>
          <span v-if="area.free_count > area.recommended_free_slots.length" style="color:#909399; font-size:12px; margin-left:8px;">
            等共{{ area.free_count }}个空闲位
          </span>
        </div>

        <div v-if="onlyFree && area.free_slots?.length" class="free-slots-grid">
          <div
            v-for="s in area.free_slots"
            :key="`f-${s.layer_no}-${s.position_no}`"
            class="free-slot-chip"
            @click="goHangAt(area, s.layer_no, s.position_no)"
          >
            <el-icon><Plus /></el-icon>
            第{{ s.layer_no }}层-{{ s.position_no }}号位
          </div>
        </div>

        <div v-else class="layers-grid">
          <div v-for="layer in area.layers" :key="layer.layer_no" class="layer-row">
            <div class="layer-label">第{{ layer.layer_no }}层</div>
            <div class="slots-row">
              <div
                v-for="slot in layer.slots"
                :key="`${layer.layer_no}-${slot.position_no}`"
                class="slot-card"
                :class="slotClass(slot)"
                @click="onSlotClick(area, slot)"
              >
                <div class="slot-header">
                  <span class="slot-pos">{{ slot.position_no }}号位</span>
                  <el-tag v-if="slot.occupied" :type="statusTagType(slot.status)" size="small" effect="dark">{{ slot.status }}</el-tag>
                  <el-tag v-else-if="slot.filtered_out" type="info" size="small">已过滤</el-tag>
                  <el-tag v-else type="success" size="small" effect="plain">空闲</el-tag>
                </div>
                <template v-if="slot.occupied && slot.hang">
                  <div class="slot-body">
                    <div class="slot-row slot-name" :title="slot.hang.garment_name">
                      <el-icon><CollectionTag /></el-icon>
                      <span>{{ slot.hang.garment_name }}</span>
                    </div>
                    <div class="slot-row slot-code">{{ slot.hang.garment_code }}</div>
                    <div class="slot-row">
                      <el-icon><Tickets /></el-icon>
                      <span>{{ slot.hang.tag_code }}</span>
                    </div>
                    <div class="slot-row">
                      <el-icon><User /></el-icon>
                      <span>{{ slot.hang.person_name || '-' }}</span>
                    </div>
                    <div class="slot-row">
                      <el-icon><Clock /></el-icon>
                      <span>{{ formatDate(slot.hang.hang_time) }}</span>
                    </div>
                    <div class="slot-row">
                      <el-icon><Calendar /></el-icon>
                      <span>
                        下架：{{ slot.hang.expected_off_date || '未设置' }}
                        <el-tag v-if="slot.hang.expiry_status" :type="expiryTagType(slot.hang.expiry_status)" size="small" style="margin-left:4px;">
                          {{ expiryLabel(slot.hang) }}
                        </el-tag>
                      </span>
                    </div>
                    <div class="slot-row slot-update-row" :title="`最近状态更新：${formatDate(slot.hang.last_status_update)}`">
                      <el-icon><Refresh /></el-icon>
                      <span>更新：{{ formatDate(slot.hang.last_status_update) }}</span>
                    </div>
                    <div v-if="slot.hang.anomaly_tickets?.length || slot.hang.unresolved_missing_count > 0" class="slot-alerts">
                      <el-popover
                        v-if="slot.hang.anomaly_tickets?.length"
                        placement="top"
                        :width="280"
                        trigger="click"
                        @click.stop
                      >
                        <template #reference>
                          <el-tag type="danger" size="small" style="cursor:pointer;">异常单{{ slot.hang.anomaly_tickets.length }}</el-tag>
                        </template>
                        <div v-for="tk in slot.hang.anomaly_tickets" :key="tk.id" class="anomaly-ticket-item">
                          <el-link type="primary" :underline="false" @click.stop="goAnomalyTicket(tk.id)">
                            {{ tk.ticket_no }}
                          </el-link>
                          <el-tag size="small" :type="tk.status === '待处理' ? 'danger' : 'warning'" style="margin-left:6px;">{{ tk.status }}</el-tag>
                          <span style="color:#909399; font-size:12px; margin-left:6px;">{{ tk.anomaly_type }}</span>
                        </div>
                      </el-popover>
                      <el-tag v-if="slot.hang.unresolved_missing_count > 0" type="warning" size="small">缺件{{ slot.hang.unresolved_missing_count }}</el-tag>
                    </div>
                  </div>
                </template>
                <div v-else class="slot-body slot-body-empty">
                  <el-icon :size="28"><Plus /></el-icon>
                  <span>{{ slot.filtered_out ? '状态未匹配' : '点击发起挂装' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Search, Refresh, Plus, Tickets, CollectionTag, User, Clock, Calendar, Grid, ShoppingCartFull, Warning, Bell, Switch, Download, Aim } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getSlotBoardApi, getAreasApi, exportSlotBoardApi } from '@/api'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const exporting = ref(false)
const boardData = reactive({ summary: {}, areas: [], responsible_stats: [], filters: { floors: [], responsible_persons: [] } })
const areasAll = ref([])
const onlyFree = ref(false)
const dataUpdateTime = ref('')
const floors = computed(() => boardData.filters?.floors || [])
const responsiblePersons = computed(() => boardData.filters?.responsible_persons || [])
const responsibleStats = computed(() => boardData.responsible_stats || [])
const highOccupancyAreas = computed(() => boardData.summary?.high_occupancy_areas || [])

const statusOptions = [
  { value: '已挂装', label: '已挂装' },
  { value: '待调换', label: '待调换' },
  { value: '待回收确认', label: '待回收确认' },
  { value: '异常观察', label: '异常观察' }
]

const filters = reactive({
  floor: route.query.floor ? Number(route.query.floor) : '',
  areaId: route.query.areaId ? Number(route.query.areaId) : '',
  status: route.query.status || '',
  responsibleId: route.query.responsibleId ? Number(route.query.responsibleId) : '',
  keyword: route.query.keyword || ''
})

const summaryCards = computed(() => {
  const s = boardData.summary || {}
  return [
    { label: '区域总数', value: s.total_areas || 0, color: '#409eff', icon: Grid, click: null },
    { label: '总容量', value: s.total_capacity || 0, color: '#909399', icon: ShoppingCartFull, click: null },
    { label: '已占用', value: s.total_occupied || 0, color: '#67c23a', icon: CollectionTag, click: () => { filters.status = ''; loadData() } },
    { label: '空闲库位', value: s.total_free || 0, color: '#409eff', icon: Plus, click: () => { filters.status = ''; toggleOnlyFreeDirect() } },
    { label: '临期/超期', value: s.total_expiring || 0, color: '#e6a23c', icon: Bell, click: null },
    { label: '待调换', value: s.total_pending_swap || 0, color: '#e6a23c', icon: Switch, click: () => { filters.status = '待调换'; loadData() } },
    { label: '待回收确认', value: s.total_pending_recovery || 0, color: '#f56c6c', icon: Bell, click: () => { filters.status = '待回收确认'; loadData() } },
    { label: '异常库位', value: s.total_abnormal || 0, color: '#f56c6c', icon: Warning, click: () => { filters.status = '异常观察'; loadData() } }
  ]
})

async function loadData() {
  loading.value = true
  try {
    const params = {}
    if (filters.floor !== '' && filters.floor !== null) params.floor = filters.floor
    if (filters.areaId) params.areaId = filters.areaId
    if (filters.status) params.status = filters.status
    if (filters.responsibleId) params.responsibleId = filters.responsibleId
    if (filters.keyword) params.keyword = filters.keyword
    if (onlyFree.value) params.onlyFree = 'true'
    const res = await getSlotBoardApi(params)
    Object.assign(boardData, res.data)
    dataUpdateTime.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    if (!areasAll.value.length) {
      const ares = await getAreasApi()
      areasAll.value = ares.data
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  Object.assign(filters, { floor: '', areaId: '', status: '', responsibleId: '', keyword: '' })
  onlyFree.value = false
  loadData()
}

function toggleOnlyFree() {
  onlyFree.value = !onlyFree.value
  if (onlyFree.value) filters.status = ''
  loadData()
}

function toggleOnlyFreeDirect() {
  onlyFree.value = true
  loadData()
}

function quickFilterFree(area) {
  filters.areaId = area.id
  filters.status = ''
  onlyFree.value = true
  loadData()
}

function filterByAbnormal(area) {
  filters.areaId = area.id
  filters.status = '异常观察'
  onlyFree.value = false
  loadData()
}

function filterByResponsible(rid, status) {
  filters.responsibleId = rid
  filters.status = status || ''
  filters.areaId = ''
  onlyFree.value = false
  loadData()
}

async function jumpToArea(areaId) {
  filters.areaId = areaId
  filters.status = ''
  onlyFree.value = false
  await loadData()
  await nextTick()
  const el = document.getElementById(`area-${areaId}`)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function handleExport() {
  exporting.value = true
  try {
    const params = {}
    if (filters.floor !== '' && filters.floor !== null) params.floor = filters.floor
    if (filters.areaId) params.areaId = filters.areaId
    if (filters.status) params.status = filters.status
    if (filters.responsibleId) params.responsibleId = filters.responsibleId
    if (filters.keyword) params.keyword = filters.keyword
    if (onlyFree.value) params.onlyFree = 'true'
    await exportSlotBoardApi(params)
    ElMessage.success('导出成功')
  } catch (e) {
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
}

function slotClass(slot) {
  return {
    'slot-occupied': slot.occupied && slot.status === '已挂装',
    'slot-swap': slot.occupied && slot.status === '待调换',
    'slot-recovery': slot.occupied && slot.status === '待回收确认',
    'slot-abnormal': slot.occupied && slot.status === '异常观察',
    'slot-free': !slot.occupied && !slot.filtered_out,
    'slot-filtered': !slot.occupied && slot.filtered_out,
    'slot-clickable': true,
    'slot-expiring': slot.occupied && slot.hang?.expiry_status === 'expiring',
    'slot-overdue': slot.occupied && slot.hang?.expiry_status === 'overdue'
  }
}

function statusTagType(status) {
  const map = { '已挂装': 'success', '待调换': 'warning', '待回收确认': 'danger', '异常观察': 'danger' }
  return map[status] || 'info'
}

function expiryTagType(s) {
  const map = { expiring: 'warning', overdue: 'danger', normal: 'success' }
  return map[s] || 'info'
}

function expiryLabel(hang) {
  if (hang.expiry_status === 'overdue') return `超期${Math.abs(hang.days_left)}天`
  if (hang.expiry_status === 'expiring') return hang.days_left === 0 ? '今天到期' : `${hang.days_left}天后到期`
  if (hang.expiry_status === 'normal') return '正常'
  return ''
}

function formatDate(dt) {
  if (!dt) return '-'
  return String(dt).replace('T', ' ').slice(0, 16)
}

function occupancyColor(rate) {
  if (rate >= 0.9) return '#f56c6c'
  if (rate >= 0.7) return '#e6a23c'
  return '#67c23a'
}

function onSlotClick(area, slot) {
  if (slot.occupied && slot.hang) {
    router.push(`/hanging/${slot.hang.id}`)
  } else if (!slot.filtered_out) {
    goHangAt(area, slot.layer_no, slot.position_no)
  } else {
    ElMessage.info('该库位存在挂装但被当前筛选条件过滤，请清空状态筛选查看')
  }
}

function goHangAt(area, layerNo, positionNo) {
  router.push({
    path: '/hanging-records',
    query: {
      presetAreaId: area.id,
      presetLayerNo: layerNo,
      presetPositionNo: positionNo,
      autoOpen: '1'
    }
  })
}

function goAnomalyTicket(ticketId) {
  router.push(`/anomaly-tickets?id=${ticketId}`)
}

onMounted(loadData)
</script>

<style scoped>
.legend-bar {
  background: #fff;
  padding: 10px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0,21,41,0.08);
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: #606266;
}
.legend-title { font-weight: 600; color: #303133; }
.legend-item { display: flex; align-items: center; gap: 6px; }
.legend-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid transparent;
}
.legend-dot.slot-free { background: #f0f9eb; border-color: #67c23a; }
.legend-dot.slot-occupied { background: #f0f9eb; border-color: #67c23a; }
.legend-dot.slot-swap { background: #ecf5ff; border-color: #409eff; }
.legend-dot.slot-recovery { background: #fdf6ec; border-color: #e6a23c; }
.legend-dot.slot-abnormal { background: #fef0f0; border-color: #f56c6c; }
.legend-dot.slot-filtered { background: #f4f4f5; border-color: #c0c4cc; }

.area-card {
  background: #fff;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0,21,41,0.08);
}
.area-card.area-high-occupancy {
  border-left: 4px solid #f56c6c;
}
.area-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px dashed #e4e7ed;
  margin-bottom: 12px;
}
.area-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.area-name { font-size: 18px; font-weight: 600; color: #303133; }
.area-zone { font-size: 13px; color: #909399; margin-left: 8px; }
.area-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 12px;
  background: #f4f4f5;
  color: #606266;
  font-size: 12px;
}
.stat-pill b { color: #303133; font-size: 14px; }
.stat-pill.stat-occupied { background: #f0f9eb; color: #529b2e; }
.stat-pill.stat-occupied b { color: #67c23a; }
.stat-pill.stat-free { background: #ecf5ff; color: #1d6fa5; }
.stat-pill.stat-free b { color: #409eff; }
.stat-pill.stat-swap { background: #fdf6ec; color: #b88230; }
.stat-pill.stat-swap b { color: #e6a23c; }
.stat-pill.stat-recovery { background: #fef0f0; color: #c45656; }
.stat-pill.stat-recovery b { color: #f56c6c; }
.stat-pill.stat-abnormal { background: #fef0f0; color: #c45656; border: 1px solid #fbc4c4; }
.stat-pill.stat-abnormal b { color: #f56c6c; }
.stat-pill.stat-expiring { background: #fdf6ec; color: #b88230; border: 1px solid #f5dab1; }
.stat-pill.stat-expiring b { color: #e6a23c; }
.occupancy-rate {
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  color: #606266;
}

.recommend-bar {
  background: #f0f9eb;
  border: 1px dashed #67c23a;
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 13px;
  color: #529b2e;
}
.recommend-bar .el-icon { color: #67c23a; }

.free-slots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}
.free-slot-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px;
  border: 2px dashed #67c23a;
  border-radius: 8px;
  background: #f0f9eb;
  color: #67c23a;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}
.free-slot-chip:hover {
  background: #67c23a;
  color: #fff;
  transform: translateY(-2px);
}

.layers-grid { display: flex; flex-direction: column; gap: 14px; }
.layer-row { display: flex; align-items: stretch; gap: 12px; }
.layer-label {
  flex-shrink: 0;
  width: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 6px;
  font-weight: 600;
  color: #606266;
  font-size: 13px;
}
.slots-row {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}
@media (max-width: 1400px) {
  .slots-row { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@media (max-width: 1100px) {
  .slots-row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

.slot-card {
  border-radius: 8px;
  padding: 10px 12px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 185px;
  display: flex;
  flex-direction: column;
}
.slot-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.slot-card.slot-free {
  background: #fafcff;
  border-color: #dcdfe6;
  border-style: dashed;
  color: #909399;
}
.slot-card.slot-free:hover { border-color: #409eff; background: #ecf5ff; color: #409eff; }
.slot-card.slot-occupied { background: #f0f9eb; border-color: #67c23a; }
.slot-card.slot-swap { background: #ecf5ff; border-color: #409eff; }
.slot-card.slot-recovery { background: #fdf6ec; border-color: #e6a23c; }
.slot-card.slot-abnormal { background: #fef0f0; border-color: #f56c6c; animation: abnormalPulse 2s infinite; }
.slot-card.slot-expiring { border-color: #e6a23c; box-shadow: 0 0 0 1px #e6a23c; }
.slot-card.slot-overdue { border-color: #f56c6c; box-shadow: 0 0 0 1px #f56c6c; animation: abnormalPulse 1.5s infinite; }
.slot-card.slot-filtered {
  background: #fafafa;
  border-color: #e4e7ed;
  color: #c0c4cc;
  cursor: not-allowed;
  opacity: 0.7;
}

@keyframes abnormalPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245,108,108,0.4); }
  50% { box-shadow: 0 0 0 4px rgba(245,108,108,0); }
}

.slot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px dashed rgba(0,0,0,0.08);
}
.slot-pos { font-weight: 600; font-size: 13px; color: #303133; }
.slot-free .slot-pos, .slot-filtered .slot-pos { color: inherit; }

.slot-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #303133;
}
.slot-body-empty {
  align-items: center;
  justify-content: center;
  color: inherit;
  font-size: 13px;
  gap: 6px;
}
.slot-row {
  display: flex;
  align-items: center;
  gap: 4px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.slot-row .el-icon { flex-shrink: 0; font-size: 12px; color: #909399; }
.slot-name { font-weight: 600; font-size: 13px; color: #303133; }
.slot-code { color: #909399; font-size: 11px; margin-left: 16px; }
.slot-update-row { color: #909399; font-size: 11px; }
.slot-alerts {
  margin-top: 4px;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.anomaly-ticket-item {
  padding: 6px 0;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
}
.anomaly-ticket-item:last-child { border-bottom: none; }
</style>
