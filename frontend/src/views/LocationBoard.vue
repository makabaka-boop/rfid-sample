<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">库位占用看板</div>
      <div style="display:flex;gap:8px;">
        <el-button :icon="Filter" :type="filters.onlyFree ? 'primary' : 'default'" @click="toggleOnlyFree">
          {{ filters.onlyFree ? '显示全部' : '只看空闲库位' }}
        </el-button>
        <el-button :icon="Download" @click="handleExport">导出明细</el-button>
      </div>
    </div>

    <div class="filter-card">
      <el-form :inline="true" :model="filters" @submit.prevent>
        <el-form-item label="楼层">
          <el-select v-model="filters.floor" placeholder="全部楼层" clearable style="width:120px;" @change="loadData">
            <el-option v-for="f in floorOptions" :key="f" :label="`${f}楼`" :value="f" />
          </el-select>
        </el-form-item>
        <el-form-item label="区域">
          <el-select v-model="filters.areaId" placeholder="全部区域" clearable style="width:180px;" @change="onAreaChange">
            <el-option v-for="a in areas" :key="a.id" :label="a.area_name" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="挂牌状态">
          <el-select v-model="filters.tagStatus" placeholder="全部状态" clearable style="width:140px;" @change="loadData">
            <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="负责人">
          <el-select v-model="filters.responsibleId" placeholder="全部负责人" clearable filterable style="width:150px;" @change="loadData">
            <el-option v-for="p in responsiblePersons" :key="p.id" :label="p.person_name" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input v-model="filters.keyword" placeholder="样衣/挂牌编码" clearable style="width:180px;" @keyup.enter="loadData" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="loadData">查询</el-button>
          <el-button :icon="Refresh" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <el-row :gutter="16" class="mb-16">
      <el-col :span="3">
        <div class="stat-card flex-between">
          <div>
            <div class="stat-label">总库位数</div>
            <div class="stat-value" style="color:#909399;">{{ boardData.summary?.totalCapacity || 0 }}</div>
          </div>
          <el-icon class="stat-icon" style="color:#909399;"><Grid /></el-icon>
        </div>
      </el-col>
      <el-col :span="3">
        <div class="stat-card flex-between" style="cursor:pointer;" @click="setFilter('tagStatus','已挂装')">
          <div>
            <div class="stat-label">已占用</div>
            <div class="stat-value" style="color:#67c23a;">
              {{ displayOccupied }}
            </div>
          </div>
          <el-icon class="stat-icon" style="color:#67c23a;"><ShoppingCartFull /></el-icon>
        </div>
      </el-col>
      <el-col :span="3">
        <div class="stat-card flex-between" style="cursor:pointer;" @click="toggleOnlyFreeDirect">
          <div>
            <div class="stat-label">空闲</div>
            <div class="stat-value" style="color:#409eff;">{{ boardData.summary?.totalFree || 0 }}</div>
          </div>
          <el-icon class="stat-icon" style="color:#409eff;"><Plus /></el-icon>
        </div>
      </el-col>
      <el-col :span="3">
        <div class="stat-card flex-between" style="cursor:pointer;border-left:4px solid #f56c6c;" @click="setFilter('tagStatus','异常观察')">
          <div>
            <div class="stat-label">异常库位</div>
            <div class="stat-value" style="color:#f56c6c;">{{ boardData.summary?.totalAbnormal || 0 }}</div>
          </div>
          <el-icon class="stat-icon" style="color:#f56c6c;"><Warning /></el-icon>
        </div>
      </el-col>
      <el-col :span="3">
        <div class="stat-card flex-between" style="cursor:pointer;" @click="setFilter('tagStatus','待回收确认')">
          <div>
            <div class="stat-label">待回收</div>
            <div class="stat-value" style="color:#e6a23c;">{{ boardData.summary?.totalPendingRecovery || 0 }}</div>
          </div>
          <el-icon class="stat-icon" style="color:#e6a23c;"><RefreshLeft /></el-icon>
        </div>
      </el-col>
      <el-col :span="3">
        <div class="stat-card flex-between" style="cursor:pointer;" @click="setFilter('tagStatus','待调换')">
          <div>
            <div class="stat-label">待调换</div>
            <div class="stat-value" style="color:#409eff;">{{ boardData.summary?.totalPendingSwap || 0 }}</div>
          </div>
          <el-icon class="stat-icon" style="color:#409eff;"><Switch /></el-icon>
        </div>
      </el-col>
      <el-col :span="3">
        <div class="stat-card flex-between" style="cursor:pointer;border-left:4px solid #e6a23c;" @click="$router.push('/hanging-records?expiryStatus=expiring')">
          <div>
            <div class="stat-label">即将到期</div>
            <div class="stat-value" style="color:#e6a23c;">{{ boardData.summary?.totalExpiringSoon || 0 }}</div>
          </div>
          <el-icon class="stat-icon" style="color:#e6a23c;"><Clock /></el-icon>
        </div>
      </el-col>
      <el-col :span="3">
        <div
          class="stat-card flex-between"
          style="cursor:pointer;"
          :style="boardData.summary?.totalHighOccupancyAreas > 0 ? 'border-left:4px solid #f56c6c;' : ''"
          @click="highlightHighOccupancy = !highlightHighOccupancy"
        >
          <div>
            <div class="stat-label">高占用区域</div>
            <div class="stat-value" :style="{ color: (boardData.summary?.totalHighOccupancyAreas||0) > 0 ? '#f56c6c' : '#67c23a' }">{{ boardData.summary?.totalHighOccupancyAreas || 0 }}</div>
          </div>
          <el-icon class="stat-icon" :style="{ color: (boardData.summary?.totalHighOccupancyAreas||0) > 0 ? '#f56c6c' : '#67c23a' }"><AlarmClock /></el-icon>
        </div>
      </el-col>
    </el-row>

    <el-alert
      v-if="boardData.summary?.totalHighOccupancyAreas > 0 && highlightHighOccupancy"
      type="warning"
      :closable="false"
      style="margin-bottom:16px;"
    >
      <template #title>
        检测到 {{ boardData.summary.totalHighOccupancyAreas }} 个高占用区域（占用率≥{{ boardData.summary.highOccupancyThreshold }}%），建议及时调整陈列避免拥挤
      </template>
    </el-alert>

    <el-row :gutter="16" class="mb-16">
      <el-col :span="12">
        <div class="stat-card">
          <div class="detail-section-title">楼层区域分布</div>
          <div v-for="floor in boardData.floorSummary || []" :key="floor.floor" class="floor-section">
            <div class="floor-header">
              <span class="floor-title">{{ floor.floor }}楼</span>
              <span class="floor-stats">
                共{{ floor.totalCapacity }}位 · 占用{{ floor.occupied }} · 空闲{{ floor.free }} ·
                <span :style="{ color: floor.abnormal > 0 ? '#f56c6c' : '#909399' }">异常{{ floor.abnormal }}</span>
              </span>
            </div>
            <div class="area-grid">
              <div
                v-for="area in getAreasByFloor(floor.floor)"
                :key="area.id"
                class="area-block"
                :class="{
                  'area-block-highlight': filters.areaId === area.id,
                  'area-block-high-occupancy': area.isHighOccupancy && highlightHighOccupancy
                }"
                @click="selectArea(area)"
              >
                <div class="area-name-row">
                  <span class="area-name">{{ area.areaName }}</span>
                  <el-tag v-if="area.isHighOccupancy" type="danger" size="small" effect="dark">高占用</el-tag>
                </div>
                <div class="area-capacity">容量: {{ area.capacity }} · 空闲: {{ area.freeCount }}</div>
                <div class="area-progress">
                  <el-progress
                    :percentage="area.occupancyRate"
                    :color="getOccupancyColor(area.occupancyRate)"
                    :stroke-width="8"
                    :show-text="false"
                  />
                </div>
                <div class="area-stats-row">
                  <span class="area-rate" :style="{ color: getOccupancyColor(area.occupancyRate) }">{{ area.occupancyRate }}%</span>
                  <span class="area-count">
                    <span style="color:#67c23a;">{{ area.occupiedCount }}占</span>
                    <span v-if="area.abnormalCount > 0" style="color:#f56c6c;">{{ area.abnormalCount }}异常</span>
                    <span v-if="area.expiringSoonCount > 0" style="color:#e6a23c;">{{ area.expiringSoonCount }}临期</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="detail-section-title" style="border-left-color:#e6a23c;">占用率排行</div>
          <div class="ranking-list">
            <div
              v-for="(item, idx) in boardData.occupancyRanking || []"
              :key="item.id"
              class="ranking-item"
              :class="{ 'ranking-high': item.isHighOccupancy }"
              @click="jumpToArea(item)"
            >
              <span class="ranking-num" :class="idx < 3 ? `ranking-top-${idx+1}` : ''">{{ idx + 1 }}</span>
              <div class="ranking-info">
                <div class="ranking-name">
                  {{ item.areaName }}
                  <el-tag v-if="item.isHighOccupancy" type="danger" size="small" effect="plain" style="margin-left:4px;">高</el-tag>
                </div>
                <div class="ranking-detail">{{ item.floor }}楼 · {{ item.occupiedCount }}/{{ item.capacity }}位
                  <span v-if="item.abnormalCount > 0" style="color:#f56c6c;">· {{ item.abnormalCount }}异常</span>
                </div>
              </div>
              <div class="ranking-rate" :style="{ color: getOccupancyColor(item.occupancyRate) }">{{ item.occupancyRate }}%</div>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="detail-section-title" style="border-left-color:#67c23a;">负责人统计</div>
          <div class="resp-list">
            <div
              v-for="(r, idx) in (boardData.responsibleStats || []).slice(0, 10)"
              :key="r.responsibleId"
              class="resp-item"
              :class="{ 'resp-item-active': filters.responsibleId === r.responsibleId }"
              @click="setFilter('responsibleId', filters.responsibleId === r.responsibleId ? '' : r.responsibleId)"
            >
              <span class="resp-name">{{ r.responsibleName || '未分配' }}</span>
              <span class="resp-counts">
                <span class="resp-badge resp-badge-green">{{ r.totalLocations }}</span>
                <span v-if="r.abnormalCount > 0" class="resp-badge resp-badge-red">{{ r.abnormalCount }}异</span>
                <span v-if="r.expiringCount > 0" class="resp-badge resp-badge-orange">{{ r.expiringCount }}临</span>
                <span v-if="r.overdueCount > 0" class="resp-badge resp-badge-red">{{ r.overdueCount }}超</span>
              </span>
            </div>
            <el-empty v-if="!(boardData.responsibleStats || []).length" description="暂无数据" :image-size="60" />
          </div>
        </div>
      </el-col>
    </el-row>

    <div
      v-for="area in boardData.areas || []"
      :key="area.id"
      class="stat-card mb-16"
      :class="{ 'area-card-high-occupancy': area.isHighOccupancy && highlightHighOccupancy }"
    >
      <div class="area-section-header">
        <div>
          <span class="area-section-title">
            {{ area.areaName }}
            <el-tag v-if="area.isHighOccupancy" type="danger" size="small" effect="dark" style="margin-left:6px;">高占用{{ area.occupancyRate }}%</el-tag>
          </span>
          <span class="area-section-meta">{{ area.floor }}楼 · {{ area.zone || '' }} · 容量{{ area.capacity }}</span>
        </div>
        <div class="area-section-stats">
          <el-tag type="success" size="small">已占用 {{ area.occupiedCount }}</el-tag>
          <el-tag type="info" size="small">空闲 {{ area.freeCount }}</el-tag>
          <el-tag v-if="area.abnormalCount > 0" type="danger" size="small">异常 {{ area.abnormalCount }}</el-tag>
          <el-tag v-if="area.pendingRecoveryCount > 0" type="warning" size="small">待回收 {{ area.pendingRecoveryCount }}</el-tag>
          <el-tag v-if="area.pendingSwapCount > 0" type="primary" size="small">待调换 {{ area.pendingSwapCount }}</el-tag>
          <el-tag v-if="area.expiringSoonCount > 0" type="warning" size="small" effect="plain">临期 {{ area.expiringSoonCount }}</el-tag>
          <el-tag v-if="area.overdueCount > 0" type="danger" size="small" effect="plain">超期 {{ area.overdueCount }}</el-tag>
          <el-button size="small" type="primary" link @click="openHangDialog(area)">
            <el-icon style="margin-right:2px;"><Plus /></el-icon>挂装到空闲位
          </el-button>
        </div>
      </div>

      <div v-for="layer in area.layers" :key="layer.layerNo" class="layer-row">
        <div class="layer-label">第{{ layer.layerNo }}层</div>
        <div class="positions-grid">
          <div
            v-for="pos in layer.positions"
            :key="pos.positionNo"
            v-show="!filters.onlyFree || pos.status === 'free'"
            class="position-card"
            :class="getPositionCardClass(pos)"
            @click="handlePositionClick(area, layer.layerNo, pos)"
          >
            <div class="pos-header">
              <span class="pos-no">{{ pos.positionNo }}</span>
              <span v-if="pos.status === 'free'" class="pos-status-free">空闲</span>
              <el-tag v-else :type="getStatusTagType(pos.hangStatus)" size="small" effect="dark">{{ pos.hangStatus }}</el-tag>
            </div>
            <template v-if="pos.status === 'occupied'">
              <div class="pos-info">
                <div class="pos-garment" :title="pos.garmentName">{{ pos.garmentName }}</div>
                <div class="pos-detail">{{ pos.garmentCode }}</div>
                <div class="pos-detail tag-code">{{ pos.tagCode }}</div>
              </div>
              <div class="pos-footer">
                <div class="pos-person">{{ pos.responsibleName }}</div>
                <div class="pos-time">{{ formatDate(pos.hangTime) }}</div>
              </div>
              <div v-if="pos.expectedOffDate" class="pos-expiry">
                <el-tag
                  :type="pos.expiryStatus === 'overdue' ? 'danger' : pos.expiryStatus === 'expiring' ? 'warning' : 'success'"
                  size="small"
                  effect="dark"
                >
                  <el-icon v-if="pos.expiryStatus === 'overdue'" style="margin-right:2px;"><WarningFilled /></el-icon>
                  {{ pos.expectedOffDate }}
                  <span v-if="pos.expiryStatus === 'overdue'">(超期{{ Math.abs(pos.daysLeft) }}天)</span>
                  <span v-else-if="pos.expiryStatus === 'expiring'">({{ pos.daysLeft }}天后)</span>
                </el-tag>
              </div>
              <div v-if="pos.hasAnomaly" class="pos-badges">
                <el-tag v-if="pos.hasActiveTicket" type="danger" size="small" effect="plain" style="cursor:pointer;" @click.stop="goAnomalyList(pos)">异常单</el-tag>
                <el-tag v-if="pos.hasMissingPart" type="warning" size="small" effect="plain">缺件</el-tag>
              </div>
              <div v-if="pos.lastStatusUpdate" class="pos-update-time" :title="'最近状态更新: ' + pos.lastStatusUpdate">
                <el-icon><Clock /></el-icon> {{ formatDateTime(pos.lastStatusUpdate) }}
              </div>
            </template>
            <template v-else>
              <div class="pos-free-icon">
                <el-icon :size="28" color="#dcdfe6"><Plus /></el-icon>
              </div>
              <div class="pos-free-text">点击挂装</div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="hangDialogVisible" title="选择空闲库位挂装" width="560px">
      <div v-if="selectedArea" style="margin-bottom:12px;">
        <b>{{ selectedArea.areaName }}</b>（{{ selectedArea.floor }}楼） · 容量 {{ selectedArea.capacity }} · 空闲 {{ freePositions.length }} 位
      </div>
      <el-empty v-if="!freePositions.length" description="该区域暂无空闲库位" :image-size="80" />
      <div v-else class="free-pos-grid">
        <div
          v-for="fp in freePositions"
          :key="`${fp.layerNo}_${fp.positionNo}`"
          class="free-pos-item"
          @click="selectFreePosition(fp)"
        >
          {{ fp.label }}
        </div>
      </div>
      <template #footer>
        <el-button @click="hangDialogVisible = false">取消</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, Refresh, Grid, ShoppingCartFull, Plus, Warning, RefreshLeft, Switch, Clock, AlarmClock, Filter, Download, WarningFilled } from '@element-plus/icons-vue'
import { TAG_STATUS_OPTIONS, getStatusTagType } from '@/utils/constants'
import { getLocationBoardApi, getAreasApi, getResponsiblePersonsApi, getFreePositionsApi, exportLocationBoardApi } from '@/api'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const areas = ref([])
const responsiblePersons = ref([])
const boardData = reactive({ summary: {}, floorSummary: [], areas: [], occupancyRanking: [], responsibleStats: [] })
const highlightHighOccupancy = ref(true)

const floorOptions = [1, 2, 3, 4, 5]
const statusOptions = TAG_STATUS_OPTIONS.filter(s => ['已挂装', '待调换', '待回收确认', '异常观察'].includes(s.value))

const filters = reactive({
  floor: '', areaId: '', tagStatus: '', responsibleId: '', keyword: '', onlyFree: false
})

const displayOccupied = computed(() => {
  if (boardData.summary?.hasFilter || filters.onlyFree) {
    return boardData.summary?.totalMatchedOccupied || 0
  }
  return boardData.summary?.totalOccupied || 0
})

function getAreasByFloor(floor) {
  return (boardData.areas || []).filter(a => a.floor === floor)
}

function getOccupancyColor(rate) {
  if (rate >= 85) return '#f56c6c'
  if (rate >= 70) return '#e6a23c'
  return '#67c23a'
}

function getPositionCardClass(pos) {
  const classes = []
  if (pos.status === 'free') { classes.push('pos-free'); return classes.join(' ') }
  if (!pos.filterMatched) classes.push('pos-dimmed')
  if (pos.hasAnomaly) { classes.push('pos-abnormal'); return classes.join(' ') }
  if (pos.hangStatus === '待回收确认') { classes.push('pos-recovery'); return classes.join(' ') }
  if (pos.hangStatus === '待调换') { classes.push('pos-swap'); return classes.join(' ') }
  if (pos.hangStatus === '异常观察') { classes.push('pos-abnormal'); return classes.join(' ') }
  if (pos.expiryStatus === 'overdue') classes.push('pos-overdue')
  else if (pos.expiryStatus === 'expiring') classes.push('pos-expiring')
  classes.push('pos-occupied')
  return classes.join(' ')
}

function formatDate(dt) {
  if (!dt) return '-'
  return dt.substring(0, 10)
}

function formatDateTime(dt) {
  if (!dt) return '-'
  return dt.substring(5, 16)
}

function setFilter(key, value) {
  filters[key] = value
  filters.onlyFree = false
  loadData()
}

function toggleOnlyFree() {
  filters.onlyFree = !filters.onlyFree
  if (filters.onlyFree) {
    filters.tagStatus = ''
    filters.responsibleId = ''
    filters.keyword = ''
  }
  loadData()
}

function toggleOnlyFreeDirect() {
  toggleOnlyFree()
}

function selectArea(area) {
  filters.areaId = filters.areaId === area.id ? '' : area.id
  loadData()
}

function onAreaChange() {
  loadData()
}

function jumpToArea(item) {
  filters.areaId = item.id
  filters.floor = item.floor
  loadData()
}

function handlePositionClick(area, layerNo, pos) {
  if (pos.status === 'occupied') {
    router.push(`/hanging/${pos.hangId}`)
  } else {
    router.push({ path: '/hanging-records', query: { areaId: area.id, layerNo, positionNo: pos.positionNo } })
  }
}

function goAnomalyList(pos) {
  router.push({ path: '/anomaly-tickets', query: { hangId: pos.hangId } })
}

const hangDialogVisible = ref(false)
const selectedArea = ref(null)
const freePositions = ref([])

async function openHangDialog(area) {
  selectedArea.value = area
  try {
    const res = await getFreePositionsApi({ areaId: area.id })
    freePositions.value = res.data.freePositions || []
  } catch (e) {
    freePositions.value = area.freePositions || []
  }
  hangDialogVisible.value = true
}

function selectFreePosition(fp) {
  hangDialogVisible.value = false
  router.push({ path: '/hanging-records', query: { areaId: selectedArea.value.id, layerNo: fp.layerNo, positionNo: fp.positionNo } })
}

async function loadMaster() {
  const [a, r] = await Promise.all([getAreasApi(), getResponsiblePersonsApi()])
  areas.value = a.data
  responsiblePersons.value = r.data
}

async function loadData() {
  loading.value = true
  try {
    const params = {}
    if (filters.floor) params.floor = filters.floor
    if (filters.areaId) params.areaId = filters.areaId
    if (filters.tagStatus) params.tagStatus = filters.tagStatus
    if (filters.responsibleId) params.responsibleId = filters.responsibleId
    if (filters.keyword) params.keyword = filters.keyword
    if (filters.onlyFree) params.onlyFree = 'true'
    const res = await getLocationBoardApi(params)
    Object.assign(boardData, res.data)
  } finally {
    loading.value = false
  }
}

async function handleExport() {
  if (filters.onlyFree) {
    ElMessage.info('"只看空闲库位"模式下无数据可导出，请先关闭该模式后再导出占用库位明细')
    return
  }
  try {
    const params = {}
    if (filters.floor) params.floor = filters.floor
    if (filters.areaId) params.areaId = filters.areaId
    if (filters.tagStatus) params.tagStatus = filters.tagStatus
    if (filters.responsibleId) params.responsibleId = filters.responsibleId
    if (filters.keyword) params.keyword = filters.keyword
    const res = await exportLocationBoardApi(params)
    const blob = new Blob([res], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `库位明细_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.csv`
    link.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (e) {
    ElMessage.error('导出失败')
  }
}

function resetFilters() {
  Object.assign(filters, { floor: '', areaId: '', tagStatus: '', responsibleId: '', keyword: '', onlyFree: false })
  loadData()
}

onMounted(async () => {
  await loadMaster()
  if (route.query.floor) filters.floor = Number(route.query.floor)
  if (route.query.areaId) filters.areaId = Number(route.query.areaId)
  if (route.query.tagStatus) filters.tagStatus = route.query.tagStatus
  if (route.query.responsibleId) filters.responsibleId = Number(route.query.responsibleId)
  if (route.query.keyword) filters.keyword = route.query.keyword
  loadData()
})
</script>

<style scoped>
.floor-section {
  margin-bottom: 16px;
}
.floor-section:last-child {
  margin-bottom: 0;
}
.floor-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid #ebeef5;
}
.floor-title {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  background: #409eff;
  padding: 2px 12px;
  border-radius: 4px;
}
.floor-stats {
  font-size: 13px;
  color: #606266;
}
.area-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.area-block {
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.area-block:hover {
  border-color: #409eff;
  box-shadow: 0 2px 8px rgba(64,158,255,0.15);
}
.area-block-highlight {
  border-color: #409eff;
  background: #ecf5ff;
}
.area-block-high-occupancy {
  border-color: #f56c6c;
  background: #fef0f0;
}
.area-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  gap: 6px;
}
.area-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.area-capacity {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}
.area-progress {
  margin-bottom: 4px;
}
.area-stats-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}
.area-rate {
  font-weight: 600;
}
.area-count {
  display: flex;
  gap: 6px;
}

.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 340px;
  overflow-y: auto;
}
.ranking-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}
.ranking-item:hover {
  background: #f5f7fa;
}
.ranking-high {
  background: #fef0f0;
}
.ranking-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #dcdfe6;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}
.ranking-top-1 { background: #f56c6c; }
.ranking-top-2 { background: #e6a23c; }
.ranking-top-3 { background: #409eff; }
.ranking-info {
  flex: 1;
  min-width: 0;
}
.ranking-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
  display: flex;
  align-items: center;
}
.ranking-detail {
  font-size: 11px;
  color: #909399;
}
.ranking-rate {
  font-size: 16px;
  font-weight: 700;
}

.resp-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 340px;
  overflow-y: auto;
}
.resp-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 13px;
}
.resp-item:hover {
  background: #f5f7fa;
}
.resp-item-active {
  background: #ecf5ff;
  color: #409eff;
}
.resp-name {
  font-weight: 500;
  flex-shrink: 0;
}
.resp-counts {
  display: flex;
  gap: 4px;
}
.resp-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 600;
}
.resp-badge-green { background: #f0f9eb; color: #67c23a; }
.resp-badge-red { background: #fef0f0; color: #f56c6c; }
.resp-badge-orange { background: #fdf6ec; color: #e6a23c; }

.area-card-high-occupancy {
  border: 2px solid #f56c6c;
  box-shadow: 0 0 0 1px rgba(245,108,108,0.1);
}
.area-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid #ebeef5;
  flex-wrap: wrap;
  gap: 8px;
}
.area-section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-right: 8px;
}
.area-section-meta {
  font-size: 13px;
  color: #909399;
}
.area-section-stats {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.layer-row {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  align-items: flex-start;
}
.layer-row:last-child {
  margin-bottom: 0;
}
.layer-label {
  width: 60px;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  text-align: center;
  background: #f5f7fa;
  border-radius: 4px;
  padding: 8px 0;
}
.positions-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}

.position-card {
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
  min-height: 160px;
  display: flex;
  flex-direction: column;
  position: relative;
}
.position-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.pos-free {
  background: #fafbfc;
  border-color: #e4e7ed;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.pos-free:hover {
  border-color: #409eff;
  background: #ecf5ff;
}
.pos-occupied {
  background: #f0f9eb;
  border-color: #b3e19d;
}
.pos-occupied:hover {
  border-color: #67c23a;
}
.pos-expiring {
  background: #fdf6ec;
  border-color: #f5dab1;
}
.pos-overdue {
  background: #fef0f0;
  border-color: #fab6b6;
}
.pos-dimmed {
  opacity: 0.35;
  filter: grayscale(0.6);
}
.pos-dimmed:hover {
  opacity: 0.7;
  filter: grayscale(0.2);
}
.pos-swap {
  background: #ecf5ff;
  border-color: #a0cfff;
}
.pos-swap:hover {
  border-color: #409eff;
}
.pos-recovery {
  background: #fdf6ec;
  border-color: #f5dab1;
}
.pos-recovery:hover {
  border-color: #e6a23c;
}
.pos-abnormal {
  background: #fef0f0;
  border-color: #fab6b6;
  animation: pulse-border 2s infinite;
}
.pos-abnormal:hover {
  border-color: #f56c6c;
}
@keyframes pulse-border {
  0%, 100% { border-color: #fab6b6; }
  50% { border-color: #f56c6c; }
}

.pos-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.pos-no {
  font-size: 12px;
  font-weight: 700;
  color: #909399;
  background: #fff;
  padding: 1px 6px;
  border-radius: 3px;
}
.pos-status-free {
  font-size: 11px;
  color: #909399;
}
.pos-info {
  flex: 1;
}
.pos-garment {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}
.pos-detail {
  font-size: 11px;
  color: #606266;
  line-height: 1.4;
}
.tag-code {
  color: #409eff;
  font-family: monospace;
}
.pos-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px dashed rgba(0,0,0,0.08);
}
.pos-person {
  font-size: 11px;
  color: #606266;
}
.pos-time {
  font-size: 10px;
  color: #909399;
}
.pos-expiry {
  margin-top: 4px;
}
.pos-expiry .el-tag {
  font-size: 10px;
}
.pos-badges {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  flex-wrap: wrap;
}
.pos-update-time {
  font-size: 10px;
  color: #b0b3b8;
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 2px;
}
.pos-free-icon {
  margin-bottom: 4px;
  opacity: 0.6;
}
.pos-free-text {
  font-size: 12px;
  color: #c0c4cc;
}

.free-pos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}
.free-pos-item {
  text-align: center;
  padding: 10px 8px;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #606266;
  transition: all 0.2s;
}
.free-pos-item:hover {
  border-color: #409eff;
  background: #ecf5ff;
  color: #409eff;
}
</style>
