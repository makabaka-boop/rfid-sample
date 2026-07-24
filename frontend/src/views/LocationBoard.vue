<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">库位占用看板</div>
      <div>
        <el-button :icon="Download" @click="handleExport">导出库位明细</el-button>
        <el-button :icon="Refresh" @click="loadData">刷新</el-button>
      </div>
    </div>

    <!-- 汇总卡片 -->
    <el-row :gutter="16" class="mb-16">
      <el-col :span="4" v-for="s in summaryCards" :key="s.label">
        <div class="stat-card flex-between" :style="{ borderLeft: `4px solid ${s.color}` }">
          <div>
            <div class="stat-label">{{ s.label }}</div>
            <div class="stat-value" :style="{ color: s.color, fontSize: '28px' }">{{ s.value }}</div>
          </div>
          <el-icon class="stat-icon" :size="32" :style="{ color: s.color }"><component :is="s.icon" /></el-icon>
        </div>
      </el-col>
    </el-row>

    <!-- 高占用区域提醒 -->
    <el-alert
      v-if="highOccupancyAreas.length"
      type="warning"
      :closable="false"
      show-icon
      class="mb-16 high-occ-alert"
    >
      <template #title>
        <span>高占用区域提醒（占用率 ≥ {{ board.summary.highOccupancyThreshold || 85 }}%，共 {{ highOccupancyAreas.length }} 个）：</span>
        <el-tag
          v-for="a in highOccupancyAreas"
          :key="a.id"
          type="danger"
          size="small"
          effect="plain"
          class="high-occ-tag"
          @click="jumpToArea(a.id)"
        >{{ a.areaName }} {{ Math.round(a.occupancyRate) }}%</el-tag>
      </template>
    </el-alert>

    <!-- 负责人维度统计 -->
    <div v-if="board.responsibleStats && board.responsibleStats.length" class="stat-card mb-16">
      <div class="detail-section-title" style="display:flex; justify-content:space-between; align-items:center;">
        <span>负责人维度统计</span>
        <el-button v-if="filters.responsibleId" link type="primary" size="small" @click="filters.responsibleId=''; loadData()">清除负责人筛选</el-button>
      </div>
      <el-table :data="board.responsibleStats" size="small" stripe>
        <el-table-column label="负责人" min-width="120">
          <template #default="{ row }">
            <span class="resp-link" @click="filterByResponsible(row.responsibleId)">{{ row.responsibleName || '未指定' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="totalLocations" label="负责库位" width="100" align="center" />
        <el-table-column label="异常库位" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.abnormalCount > 0" type="danger" size="small">{{ row.abnormalCount }}</el-tag>
            <span v-else style="color:#909399;">0</span>
          </template>
        </el-table-column>
        <el-table-column label="临期" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.expiringCount > 0" type="warning" size="small">{{ row.expiringCount }}</el-tag>
            <span v-else style="color:#909399;">0</span>
          </template>
        </el-table-column>
        <el-table-column label="超期" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.overdueCount > 0" type="danger" size="small" effect="dark">{{ row.overdueCount }}</el-tag>
            <span v-else style="color:#909399;">0</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 筛选 -->
    <div class="filter-card">
      <el-form :inline="true" :model="filters" @submit.prevent>
        <el-form-item label="楼层">
          <el-select v-model="filters.floor" placeholder="全部楼层" clearable style="width:130px;" @change="loadData">
            <el-option v-for="f in floorOptions" :key="f" :label="`${f}楼`" :value="f" />
          </el-select>
        </el-form-item>
        <el-form-item label="区域">
          <el-select v-model="filters.areaId" placeholder="全部区域" clearable style="width:170px;" @change="loadData">
            <el-option v-for="a in areas" :key="a.id" :label="a.area_name" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="挂牌状态">
          <el-select v-model="filters.tagStatus" placeholder="全部状态" clearable style="width:150px;" @change="loadData">
            <el-option v-for="s in TAG_STATUS_FILTER" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="负责人">
          <el-select v-model="filters.responsibleId" placeholder="全部" clearable filterable style="width:160px;" @change="loadData">
            <el-option v-for="p in responsiblePersons" :key="p.id" :label="p.person_name" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input v-model="filters.keyword" placeholder="样衣/挂牌" clearable style="width:180px;" @keyup.enter="loadData" @clear="loadData" />
        </el-form-item>
        <el-form-item label="只看空闲">
          <el-switch v-model="filters.onlyFree" @change="loadData" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="loadData">查询</el-button>
          <el-button :icon="Refresh" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
      <div class="legend">
        <span v-for="lg in legends" :key="lg.label" class="legend-item">
          <span class="legend-dot" :style="{ background: lg.color }"></span>{{ lg.label }}
        </span>
        <span v-if="hasFilter" class="filter-hint">
          <el-icon><Filter /></el-icon> 已启用筛选，仅展示匹配库位（共 {{ board.summary.totalMatchedOccupied || 0 }} 个匹配占用位）
        </span>
      </div>
    </div>

    <div v-loading="loading">
      <el-empty v-if="!visibleAreas.length" :description="hasFilter ? '没有符合筛选条件的库位' : '暂无展示区域'" />

      <div v-for="area in visibleAreas" :key="area.id" :id="`area-${area.id}`" class="area-block">
        <div class="area-head flex-between">
          <div class="area-title">
            <span class="area-name">{{ area.areaName }}</span>
            <el-tag size="small" type="info" class="ml-8">{{ area.floor }}楼</el-tag>
            <span class="area-zone" v-if="area.zone">· {{ area.zone }}</span>
            <el-tag v-if="area.isHighOccupancy" type="danger" size="small" effect="dark" class="ml-8">高占用</el-tag>
          </div>
          <div class="area-stats">
            <span>容量 <b>{{ area.capacity }}</b></span>
            <span class="dot-split">已占 <b style="color:#409eff;">{{ area.occupiedCount }}</b></span>
            <span class="dot-split">空闲 <b style="color:#909399;">{{ area.freeCount }}</b></span>
            <span class="dot-split">异常 <b style="color:#f56c6c;">{{ area.abnormalCount }}</b></span>
            <span v-if="hasFilter" class="dot-split">匹配 <b style="color:#67c23a;">{{ area.matchedOccupiedCount }}</b></span>
            <el-progress
              :percentage="Math.min(Math.round(area.occupancyRate), 100)"
              :color="occupancyColor(area.occupancyRate)"
              :stroke-width="10"
              style="width:150px; display:inline-block; margin-left:12px; vertical-align:middle;"
            />
          </div>
        </div>

        <div class="layers">
          <div v-for="layer in area.layers" :key="layer.layerNo" v-show="layerHasVisibleSlot(layer)" class="layer-row">
            <div class="layer-label">第{{ layer.layerNo }}层</div>
            <div class="slot-grid">
              <template v-for="pos in layer.positions" :key="pos.positionNo">
                <!-- 空闲位：筛选占用条件时隐藏空闲，除非只看空闲 -->
                <div
                  v-if="pos.status === 'free' && showFreeSlot"
                  class="slot-card slot-free"
                  @click="goCreate(area, layer.layerNo, pos.positionNo)"
                >
                  <div class="slot-pos">L{{ layer.layerNo }}-P{{ pos.positionNo }}</div>
                  <div class="slot-free-icon"><el-icon><Plus /></el-icon></div>
                  <div class="slot-free-text">空闲</div>
                  <div class="slot-free-hint">点击发起挂装</div>
                </div>

                <!-- 占用且匹配筛选：正常展示 -->
                <div
                  v-else-if="pos.status === 'occupied' && pos.filterMatched"
                  class="slot-card"
                  :class="slotClass(pos)"
                  @click="goDetail(pos)"
                >
                  <div class="slot-pos">L{{ layer.layerNo }}-P{{ pos.positionNo }}</div>
                  <div class="slot-garment">{{ pos.garmentName }}</div>
                  <div class="slot-line">{{ pos.garmentCode }}</div>
                  <div class="slot-line">挂牌 {{ pos.tagCode }}</div>
                  <div class="slot-line">责任 {{ pos.responsibleName || '-' }}</div>
                  <div class="slot-line">挂装 {{ formatTime(pos.hangTime) }}</div>
                  <div class="slot-line">
                    下架 {{ pos.expectedOffDate || '未设置' }}
                    <el-tag v-if="pos.expiryStatus === 'overdue'" type="danger" size="small" effect="dark" class="mini-tag">超期</el-tag>
                    <el-tag v-else-if="pos.expiryStatus === 'expiring'" type="warning" size="small" class="mini-tag">临期</el-tag>
                  </div>
                  <div class="slot-line slot-update" v-if="pos.lastStatusUpdate">
                    更新 {{ formatTime(pos.lastStatusUpdate) }}
                  </div>
                  <div class="slot-status flex-between">
                    <el-tag :type="getStatusTagType(pos.hangStatus)" size="small" effect="dark">{{ pos.hangStatus }}</el-tag>
                    <el-button
                      v-if="pos.hasAnomaly"
                      link
                      type="danger"
                      size="small"
                      class="slot-anomaly-btn"
                      @click.stop="goAnomaly(pos)"
                    >{{ pos.hasActiveTicket ? '查看异常' : '登记异常' }}</el-button>
                  </div>
                </div>

                <!-- 占用但被筛选过滤掉：显示为已过滤占位；只看空闲模式下不渲染占用位 -->
                <div
                  v-else-if="pos.status === 'occupied' && !pos.filterMatched && !filters.onlyFree"
                  class="slot-card slot-filtered"
                >
                  <div class="slot-pos">L{{ layer.layerNo }}-P{{ pos.positionNo }}</div>
                  <div class="filtered-text">已过滤</div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { Search, Refresh, Plus, Download, Grid, Box, TrendCharts, Warning, Filter } from '@element-plus/icons-vue'
import { getStatusTagType } from '@/utils/constants'
import { getLocationBoardApi, getAreasApi, getResponsiblePersonsApi, exportLocationBoardApi } from '@/api'

const route = useRoute()
const router = useRouter()

const TAG_STATUS_FILTER = ['已挂装', '待调换', '待回收确认', '异常观察']

const legends = [
  { label: '已挂装', color: '#67c23a' },
  { label: '待调换', color: '#409eff' },
  { label: '待回收确认', color: '#e6a23c' },
  { label: '异常观察', color: '#f56c6c' },
  { label: '空闲', color: '#c0c4cc' }
]

const loading = ref(false)
const areas = ref([])
const responsiblePersons = ref([])
const board = reactive({ summary: {}, floorSummary: [], responsibleStats: [], areas: [], occupancyRanking: [] })

const filters = reactive({ floor: '', areaId: '', tagStatus: '', responsibleId: '', keyword: '', onlyFree: false })

const floorOptions = computed(() => {
  const set = new Set(areas.value.map(a => a.floor))
  return Array.from(set).sort((a, b) => a - b)
})

// 是否启用了占用位专属筛选（状态/负责人/关键字）
const hasFilter = computed(() => !!(filters.tagStatus || filters.responsibleId || filters.keyword))

// 只看空闲开启时展示空闲位；启用占用筛选时隐藏空闲位
const showFreeSlot = computed(() => filters.onlyFree || !hasFilter.value)

// 筛选时隐藏无匹配库位的区域
const visibleAreas = computed(() => {
  const list = board.areas || []
  if (filters.onlyFree) {
    return list.filter(a => a.freeCount > 0)
  }
  if (hasFilter.value) {
    return list.filter(a => a.matchedOccupiedCount > 0)
  }
  return list
})

const summaryCards = computed(() => {
  const s = board.summary || {}
  return [
    { label: '展示区域', value: (board.areas || []).length, color: '#409eff', icon: Grid },
    { label: '总容量', value: s.totalCapacity || 0, color: '#606266', icon: Box },
    { label: '已占用', value: s.totalOccupied || 0, color: '#67c23a', icon: TrendCharts },
    { label: '空闲库位', value: s.totalFree || 0, color: '#909399', icon: Box },
    { label: '异常库位', value: s.totalAbnormal || 0, color: '#f56c6c', icon: Warning },
    { label: '整体占用率', value: `${occupancyRate.value}%`, color: occupancyColor(occupancyRate.value), icon: TrendCharts }
  ]
})

const occupancyRate = computed(() => {
  const s = board.summary || {}
  return s.totalCapacity > 0 ? Math.round((s.totalOccupied / s.totalCapacity) * 100) : 0
})

// 高占用区域（占用率 ≥ 阈值），用于顶部提醒
const highOccupancyAreas = computed(() => {
  return (board.occupancyRanking || []).filter(a => a.isHighOccupancy)
})

function occupancyColor(rate) {
  if (rate >= 85) return '#f56c6c'
  if (rate >= 60) return '#e6a23c'
  return '#67c23a'
}

// 该层是否有可见库位（避免只看空闲/筛选时出现只有层标签的空行）
function layerHasVisibleSlot(layer) {
  return layer.positions.some(pos => {
    if (pos.status === 'free') return showFreeSlot.value
    // 占用位：只看空闲模式下始终隐藏
    return !filters.onlyFree
  })
}

function slotClass(pos) {
  const map = {
    '已挂装': 'slot-hanged',
    '待调换': 'slot-swap',
    '待回收确认': 'slot-recovery',
    '异常观察': 'slot-abnormal'
  }
  // 有未闭合异常单/缺件但状态非异常观察时，也按异常样式提醒
  if (pos.hasAnomaly && pos.hangStatus !== '异常观察') return 'slot-abnormal'
  return map[pos.hangStatus] || 'slot-hanged'
}

function formatTime(t) {
  return t ? dayjs(t).format('MM-DD HH:mm') : '-'
}

async function loadMaster() {
  const [a, p] = await Promise.all([getAreasApi(), getResponsiblePersonsApi()])
  areas.value = a.data
  responsiblePersons.value = p.data
}

function buildParams() {
  const params = {}
  if (filters.floor) params.floor = filters.floor
  if (filters.areaId) params.areaId = filters.areaId
  if (filters.tagStatus) params.tagStatus = filters.tagStatus
  if (filters.responsibleId) params.responsibleId = filters.responsibleId
  if (filters.keyword) params.keyword = filters.keyword
  if (filters.onlyFree) params.onlyFree = 'true'
  return params
}

async function loadData() {
  loading.value = true
  try {
    const res = await getLocationBoardApi(buildParams())
    Object.assign(board, res.data)
    scrollToAreaIfNeeded()
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  Object.assign(filters, { floor: '', areaId: '', tagStatus: '', responsibleId: '', keyword: '', onlyFree: false })
  loadData()
}

function goDetail(pos) {
  router.push(`/hanging/${pos.hangId}`)
}

function goCreate(area, layerNo, positionNo) {
  router.push({
    path: '/hanging-records',
    query: { areaId: area.id, layerNo, positionNo }
  })
}

// 异常库位快捷跳转：已有未闭合异常单则查看，否则带 hangId 直接打开登记
function goAnomaly(pos) {
  if (pos.hasActiveTicket) {
    router.push({ path: '/anomaly-tickets', query: { hangId: pos.hangId } })
  } else {
    router.push({ path: '/anomaly-tickets', query: { hangId: pos.hangId, createFromBoard: '1' } })
  }
}

function jumpToArea(areaId) {
  const el = document.getElementById(`area-${areaId}`)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function filterByResponsible(responsibleId) {
  filters.responsibleId = responsibleId
  loadData()
}

async function handleExport() {
  try {
    const res = await exportLocationBoardApi(buildParams())
    const blob = new Blob([res], { type: 'text/csv;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `库位明细_${dayjs().format('YYYYMMDDHHmmss')}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (e) {
    ElMessage.error('导出失败')
  }
}

function scrollToAreaIfNeeded() {
  if (route.query.areaId) {
    setTimeout(() => {
      const el = document.getElementById(`area-${route.query.areaId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 200)
  }
}

onMounted(async () => {
  await loadMaster()
  if (route.query.floor) filters.floor = Number(route.query.floor)
  if (route.query.areaId) filters.areaId = Number(route.query.areaId)
  if (route.query.tagStatus) filters.tagStatus = String(route.query.tagStatus)
  if (route.query.responsibleId) filters.responsibleId = Number(route.query.responsibleId)
  loadData()
})
</script>

<style scoped>
.legend {
  display: flex;
  gap: 18px;
  margin-top: 4px;
  font-size: 13px;
  color: #606266;
  align-items: center;
  flex-wrap: wrap;
}
.legend-item { display: inline-flex; align-items: center; gap: 6px; }
.legend-dot { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
.filter-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #409eff;
  font-size: 12px;
}

.area-block {
  background: #fff;
  border-radius: 8px;
  padding: 18px 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0,21,41,0.08);
}
.area-head {
  padding-bottom: 12px;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 16px;
}
.area-name { font-size: 16px; font-weight: 600; color: #303133; }
.area-zone { color: #909399; font-size: 13px; margin-left: 6px; }
.area-stats { font-size: 13px; color: #606266; }
.dot-split { margin-left: 14px; }
.ml-8 { margin-left: 8px; }

.layers { display: flex; flex-direction: column; gap: 14px; }
.layer-row { display: flex; align-items: flex-start; gap: 12px; }
.layer-label {
  flex-shrink: 0;
  width: 52px;
  padding-top: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #909399;
}
.slot-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.slot-card {
  border-radius: 8px;
  padding: 10px 12px;
  min-height: 128px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: transform 0.12s, box-shadow 0.12s;
  position: relative;
}
.slot-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,21,41,0.15); }

.slot-pos { font-size: 12px; font-weight: 600; color: #909399; margin-bottom: 4px; }
.slot-garment {
  font-size: 14px; font-weight: 600; color: #303133;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.slot-line {
  font-size: 12px; color: #606266; line-height: 1.5;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.slot-status { margin-top: 6px; }
.slot-update { color: #909399; font-size: 11px; }
.slot-anomaly-btn { padding: 0; height: auto; }
.mini-tag { margin-left: 4px; transform: scale(0.85); }

.high-occ-alert :deep(.el-alert__title) { line-height: 1.9; }
.high-occ-tag { margin-left: 6px; cursor: pointer; }
.resp-link { color: #409eff; cursor: pointer; }
.resp-link:hover { text-decoration: underline; }

.slot-hanged { background: #f0f9eb; border-color: #b3e19d; }
.slot-swap { background: #ecf5ff; border-color: #a0cfff; }
.slot-recovery { background: #fdf6ec; border-color: #f3d19e; }
.slot-abnormal {
  background: #fef0f0; border-color: #f56c6c;
  animation: pulse-abnormal 1.6s infinite;
}
@keyframes pulse-abnormal {
  0% { box-shadow: 0 0 0 0 rgba(245,108,108,0.5); }
  70% { box-shadow: 0 0 0 8px rgba(245,108,108,0); }
  100% { box-shadow: 0 0 0 0 rgba(245,108,108,0); }
}

.slot-free {
  background: #fafafa;
  border: 2px dashed #dcdfe6;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: #c0c4cc;
}
.slot-free:hover { border-color: #409eff; color: #409eff; }
.slot-free-icon { font-size: 24px; }
.slot-free-text { font-size: 13px; margin-top: 6px; }
.slot-free-hint { font-size: 11px; margin-top: 2px; color: #c0c4cc; }

.slot-filtered {
  background: repeating-linear-gradient(45deg, #f7f8fa, #f7f8fa 8px, #f0f1f3 8px, #f0f1f3 16px);
  border: 1px dashed #dcdfe6;
  cursor: default;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.slot-filtered:hover { transform: none; box-shadow: none; }
.filtered-text { color: #c0c4cc; font-size: 13px; margin-top: 8px; }
</style>
