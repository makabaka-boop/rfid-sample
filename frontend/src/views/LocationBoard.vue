<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">库位占用看板</div>
    </div>

    <div class="filter-card">
      <el-form :inline="true" :model="filters" @submit.prevent>
        <el-form-item label="楼层">
          <el-select v-model="filters.floor" placeholder="全部楼层" clearable style="width:120px;" @change="loadData">
            <el-option v-for="f in floorOptions" :key="f" :label="`${f}楼`" :value="f" />
          </el-select>
        </el-form-item>
        <el-form-item label="区域">
          <el-select v-model="filters.areaId" placeholder="全部区域" clearable style="width:180px;" @change="loadData">
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
      <el-col :span="4">
        <div class="stat-card flex-between">
          <div>
            <div class="stat-label">总库位数</div>
            <div class="stat-value" style="color:#909399;">{{ boardData.summary?.totalCapacity || 0 }}</div>
          </div>
          <el-icon class="stat-icon" style="color:#909399;"><Grid /></el-icon>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card flex-between" style="cursor:pointer;" @click="filters.tagStatus='已挂装';loadData()">
          <div>
            <div class="stat-label">已占用</div>
            <div class="stat-value" style="color:#67c23a;">
              {{ boardData.summary?.hasFilter ? boardData.summary?.totalMatchedOccupied : boardData.summary?.totalOccupied || 0 }}
              <span v-if="boardData.summary?.hasFilter" style="font-size:13px;color:#909399;font-weight:400;">/{{ boardData.summary?.totalOccupied || 0 }}</span>
            </div>
          </div>
          <el-icon class="stat-icon" style="color:#67c23a;"><ShoppingCartFull /></el-icon>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card flex-between">
          <div>
            <div class="stat-label">空闲</div>
            <div class="stat-value" style="color:#409eff;">{{ boardData.summary?.totalFree || 0 }}</div>
          </div>
          <el-icon class="stat-icon" style="color:#409eff;"><Plus /></el-icon>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card flex-between" style="cursor:pointer;border-left:4px solid #f56c6c;" @click="filters.tagStatus='异常观察';loadData()">
          <div>
            <div class="stat-label">异常库位</div>
            <div class="stat-value" style="color:#f56c6c;">{{ boardData.summary?.totalAbnormal || 0 }}</div>
          </div>
          <el-icon class="stat-icon" style="color:#f56c6c;"><Warning /></el-icon>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card flex-between" style="cursor:pointer;" @click="filters.tagStatus='待回收确认';loadData()">
          <div>
            <div class="stat-label">待回收确认</div>
            <div class="stat-value" style="color:#e6a23c;">{{ boardData.summary?.totalPendingRecovery || 0 }}</div>
          </div>
          <el-icon class="stat-icon" style="color:#e6a23c;"><RefreshLeft /></el-icon>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card flex-between" style="cursor:pointer;" @click="filters.tagStatus='待调换';loadData()">
          <div>
            <div class="stat-label">待调换</div>
            <div class="stat-value" style="color:#409eff;">{{ boardData.summary?.totalPendingSwap || 0 }}</div>
          </div>
          <el-icon class="stat-icon" style="color:#409eff;"><Switch /></el-icon>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="mb-16">
      <el-col :span="18">
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
                :class="{ 'area-block-highlight': filters.areaId === area.id }"
                @click="selectArea(area)"
              >
                <div class="area-name">{{ area.areaName }}</div>
                <div class="area-capacity">容量: {{ area.capacity }}</div>
                <div class="area-progress">
                  <el-progress
                    :percentage="area.occupancyRate"
                    :color="getOccupancyColor(area.occupancyRate)"
                    :stroke-width="8"
                    :show-text="false"
                  />
                </div>
                <div class="area-stats-row">
                  <span class="area-rate">{{ area.occupancyRate }}%</span>
                  <span class="area-count">
                    <span style="color:#67c23a;">{{ area.occupiedCount }}占</span>
                    <span style="color:#409eff;">{{ area.freeCount }}空</span>
                    <span v-if="area.abnormalCount > 0" style="color:#f56c6c;">{{ area.abnormalCount }}异常</span>
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
              @click="jumpToArea(item)"
            >
              <span class="ranking-num" :class="idx < 3 ? `ranking-top-${idx+1}` : ''">{{ idx + 1 }}</span>
              <div class="ranking-info">
                <div class="ranking-name">{{ item.areaName }}</div>
                <div class="ranking-detail">{{ item.floor }}楼 · {{ item.occupiedCount }}/{{ item.capacity }}位
                  <span v-if="item.abnormalCount > 0" style="color:#f56c6c;">· {{ item.abnormalCount }}异常</span>
                </div>
              </div>
              <div class="ranking-rate" :style="{ color: getOccupancyColor(item.occupancyRate) }">{{ item.occupancyRate }}%</div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <div v-for="area in boardData.areas || []" :key="area.id" class="stat-card mb-16">
      <div class="area-section-header">
        <div>
          <span class="area-section-title">{{ area.areaName }}</span>
          <span class="area-section-meta">{{ area.floor }}楼 · {{ area.zone || '' }}</span>
        </div>
        <div class="area-section-stats">
          <el-tag type="success" size="small">已占用 {{ area.occupiedCount }}</el-tag>
          <el-tag type="info" size="small">空闲 {{ area.freeCount }}</el-tag>
          <el-tag v-if="area.abnormalCount > 0" type="danger" size="small">异常 {{ area.abnormalCount }}</el-tag>
          <el-tag v-if="area.pendingRecoveryCount > 0" type="warning" size="small">待回收 {{ area.pendingRecoveryCount }}</el-tag>
          <el-tag v-if="area.pendingSwapCount > 0" type="primary" size="small">待调换 {{ area.pendingSwapCount }}</el-tag>
        </div>
      </div>

      <div v-for="layer in area.layers" :key="layer.layerNo" class="layer-row">
        <div class="layer-label">第{{ layer.layerNo }}层</div>
        <div class="positions-grid">
          <div
            v-for="pos in layer.positions"
            :key="pos.positionNo"
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
                >
                  {{ pos.expectedOffDate }}
                  <span v-if="pos.expiryStatus === 'overdue'">(超期{{ Math.abs(pos.daysLeft) }}天)</span>
                  <span v-else-if="pos.expiryStatus === 'expiring'">({{ pos.daysLeft }}天后)</span>
                </el-tag>
              </div>
              <div v-if="pos.hasAnomaly" class="pos-badges">
                <el-tag v-if="pos.hasActiveTicket" type="danger" size="small" effect="plain">异常单</el-tag>
                <el-tag v-if="pos.hasMissingPart" type="warning" size="small" effect="plain">缺件</el-tag>
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Search, Refresh, Grid, ShoppingCartFull, Plus, Warning, RefreshLeft, Switch } from '@element-plus/icons-vue'
import { TAG_STATUS_OPTIONS, getStatusTagType } from '@/utils/constants'
import { getLocationBoardApi, getAreasApi, getResponsiblePersonsApi } from '@/api'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const areas = ref([])
const responsiblePersons = ref([])
const boardData = reactive({ summary: {}, floorSummary: [], areas: [], occupancyRanking: [] })

const floorOptions = [1, 2, 3, 4, 5]
const statusOptions = TAG_STATUS_OPTIONS.filter(s => ['已挂装', '待调换', '待回收确认', '异常观察'].includes(s.value))

const filters = reactive({
  floor: '', areaId: '', tagStatus: '', responsibleId: '', keyword: ''
})

function getAreasByFloor(floor) {
  return (boardData.areas || []).filter(a => a.floor === floor)
}

function getOccupancyColor(rate) {
  if (rate >= 90) return '#f56c6c'
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
  classes.push('pos-occupied')
  return classes.join(' ')
}

function formatDate(dt) {
  if (!dt) return '-'
  return dt.substring(0, 10)
}

function selectArea(area) {
  filters.areaId = area.id
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
    const res = await getLocationBoardApi(params)
    Object.assign(boardData, res.data)
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  Object.assign(filters, { floor: '', areaId: '', tagStatus: '', responsibleId: '', keyword: '' })
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
  color: #303133;
  background: #409eff;
  color: #fff;
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
.area-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
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
  gap: 8px;
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
}
.ranking-detail {
  font-size: 11px;
  color: #909399;
}
.ranking-rate {
  font-size: 16px;
  font-weight: 700;
}

.area-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid #ebeef5;
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
  padding-top: 8px;
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
  min-height: 140px;
  display: flex;
  flex-direction: column;
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
.pos-dimmed {
  opacity: 0.4;
  filter: grayscale(0.5);
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
.pos-free-icon {
  margin-bottom: 4px;
  opacity: 0.6;
}
.pos-free-text {
  font-size: 12px;
  color: #c0c4cc;
}
</style>
