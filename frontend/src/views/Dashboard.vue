<template>
  <div class="page-container">
    <el-row :gutter="16" class="mb-16">
      <el-col :span="3" v-for="s in summaryCards" :key="s.label">
        <div class="stat-card flex-between" :style="{ cursor: s.click ? 'pointer' : 'default' }" @click="s.click && s.click()">
          <div>
            <div class="stat-label">{{ s.label }}</div>
            <div class="stat-value" :style="{ color: s.color }">{{ s.value }}</div>
          </div>
          <el-icon class="stat-icon" :style="{ color: s.color }"><component :is="s.icon" /></el-icon>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="mb-16">
      <el-col :span="4" v-for="s in anomalyCards" :key="s.label">
        <div class="stat-card flex-between" :style="{ cursor: s.click ? 'pointer' : 'default', borderLeft: '4px solid #f56c6c' }" @click="s.click && s.click()">
          <div>
            <div class="stat-label">{{ s.label }}</div>
            <div class="stat-value" :style="{ color: s.color, fontSize: '32px' }">{{ s.value }}</div>
          </div>
          <el-icon class="stat-icon" :size="36" :style="{ color: s.color }"><component :is="s.icon" /></el-icon>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="mb-16">
      <el-col :span="14">
        <div class="stat-card">
          <div class="detail-section-title">分类分布</div>
          <div ref="categoryChartRef" class="chart-container" style="height:320px;"></div>
        </div>
      </el-col>
      <el-col :span="10">
        <div class="stat-card">
          <div class="detail-section-title">状态分布</div>
          <div ref="statusChartRef" class="chart-container" style="height:320px;"></div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="mb-16">
      <el-col :span="14">
        <div class="stat-card">
          <div class="detail-section-title">陈列区域占用</div>
          <div ref="areaChartRef" class="chart-container" style="height:320px;"></div>
        </div>
      </el-col>
      <el-col :span="10">
        <div class="stat-card">
          <div class="detail-section-title">
            <span style="cursor:pointer;" @click="router.push('/anomaly-tickets')">异常类型分布</span>
          </div>
          <div ref="missingChartRef" class="chart-container" style="height:320px;"></div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="14">
        <div class="stat-card">
          <div class="detail-section-title">
            近30天挂装趋势
          </div>
          <div ref="trendChartRef" class="chart-container" style="height:300px;"></div>
        </div>
      </el-col>
      <el-col :span="10">
        <div class="stat-card">
          <div class="detail-section-title" style="border-left-color:#f56c6c;">
            <span style="color:#f56c6c;">⚠ 异常提醒</span>
          </div>
          <el-tabs v-model="activeTab">
            <el-tab-pane label="到期提醒" name="expiry">
              <el-empty v-if="!stats.expiryReminders?.length" description="暂无到期提醒" :image-size="80" />
              <el-table v-else :data="stats.expiryReminders" size="small" stripe>
                <el-table-column prop="tag_code" label="挂牌编号" width="120" />
                <el-table-column label="样衣" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.garment_name }}</template>
                </el-table-column>
                <el-table-column prop="area_name" label="区域" width="100" />
                <el-table-column label="到期状态" width="90" align="center">
                  <template #default="{ row }">
                    <el-tag v-if="Math.floor(row.days_left) < 0" type="danger" size="small">已超期</el-tag>
                    <el-tag v-else type="warning" size="small">即将到期</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="剩余天数" width="90" align="center">
                  <template #default="{ row }">
                    <span :style="{ color: Math.floor(row.days_left) < 0 ? '#f56c6c' : '#e6a23c' }">
                      {{ Math.floor(row.days_left) < 0 ? `超期${Math.abs(Math.floor(row.days_left))}天` : Math.floor(row.days_left) === 0 ? '今天' : `${Math.floor(row.days_left)}天` }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="90" align="center">
                  <template #default="{ row }">
                    <el-button link type="primary" size="small" @click="$router.push(`/hanging/${row.hang_id}`)">查看</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="待跟进异常" name="needFollowUp">
              <el-empty v-if="!stats.anomalies?.needFollowUpList?.length" description="暂无待跟进异常" :image-size="80" />
              <el-table v-else :data="stats.anomalies.needFollowUpList" size="small" stripe>
                <el-table-column prop="ticket_no" label="处置单号" width="180" />
                <el-table-column prop="anomaly_type" label="类型" width="100">
                  <template #default="{ row }"><el-tag type="danger" size="small">{{ row.anomaly_type }}</el-tag></template>
                </el-table-column>
                <el-table-column label="对象" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.tag_code || row.garment_name || '-' }}</template>
                </el-table-column>
                <el-table-column label="未跟进天数" width="100" align="center">
                  <template #default="{ row }">
                    <el-tag type="warning" size="small">{{ Math.floor(row.days_since_follow) }}天</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="最近跟进" width="160">
                  <template #default="{ row }">{{ row.last_follow_up_time || '-' }}</template>
                </el-table-column>
                <el-table-column label="操作" width="80" align="center">
                  <template #default="{ row }">
                    <el-button link type="primary" size="small" @click="$router.push(`/anomaly-tickets?needFollowUp=true`)">处理</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="今日需跟进" name="todayFollowUp">
              <el-empty v-if="!stats.anomalies?.todayFollowUpList?.length" description="今日暂无需跟进异常" :image-size="80" />
              <el-table v-else :data="stats.anomalies.todayFollowUpList" size="small" stripe>
                <el-table-column prop="ticket_no" label="处置单号" width="180" />
                <el-table-column prop="anomaly_type" label="类型" width="100">
                  <template #default="{ row }"><el-tag type="danger" size="small">{{ row.anomaly_type }}</el-tag></template>
                </el-table-column>
                <el-table-column label="对象" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.tag_code || row.garment_name || '-' }}</template>
                </el-table-column>
                <el-table-column label="下一步计划" min-width="160" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.next_step_plan || '-' }}</template>
                </el-table-column>
                <el-table-column label="操作" width="80" align="center">
                  <template #default="{ row }">
                    <el-button link type="primary" size="small" @click="$router.push(`/anomaly-tickets?todayNext=true`)">处理</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="调换过频" name="swap">
              <el-empty v-if="!stats.anomalies?.frequentSwaps?.length" description="暂无调换过频记录" :image-size="80" />
              <el-table v-else :data="stats.anomalies.frequentSwaps" size="small" stripe>
                <el-table-column prop="tag_code" label="挂牌编号" width="120" />
                <el-table-column prop="garment_name" label="样衣" show-overflow-tooltip />
                <el-table-column prop="swap_count" label="30天调换" width="90" align="center">
                  <template #default="{ row }">
                    <el-tag type="danger" size="small">{{ row.swap_count }} 次</el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="回收超时" name="overdue">
              <el-empty v-if="!stats.anomalies?.overdueRecovery?.length" description="暂无回收超时记录" :image-size="80" />
              <el-table v-else :data="stats.anomalies.overdueRecovery" size="small" stripe>
                <el-table-column prop="tag_code" label="挂牌" width="110" />
                <el-table-column prop="garment_name" label="样衣" show-overflow-tooltip />
                <el-table-column label="超期" width="80" align="center">
                  <template #default="{ row }">
                    <el-tag type="danger" size="small">{{ Math.floor(row.overdue_days) }}天</el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="复核缺失" name="review">
              <el-empty v-if="!stats.anomalies?.missingReviewGap?.length" description="暂无复核缺失记录" :image-size="80" />
              <el-table v-else :data="stats.anomalies.missingReviewGap" size="small" stripe>
                <el-table-column prop="missing_type" label="类型" width="100" />
                <el-table-column label="对象" show-overflow-tooltip>
                  <template #default="{ row }">
                    {{ row.tag_code || row.garment_name || '-' }}
                  </template>
                </el-table-column>
                <el-table-column label="超期" width="80" align="center">
                  <template #default="{ row }">
                    <el-tag type="warning" size="small">{{ Math.floor(row.pending_days) }}天</el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-col>
    </el-row>

    <div class="stat-card mt-16">
      <div class="detail-section-title" style="border-left-color:#e6a23c;">待回收确认（最近20条）</div>
      <el-table :data="stats.pendingConfirmList || []" size="small" stripe empty-text="暂无待确认记录">
        <el-table-column prop="record_no" label="回收单号" width="180" />
        <el-table-column prop="tag_code" label="挂牌编号" width="130" />
        <el-table-column prop="garment_name" label="样衣名称" show-overflow-tooltip />
        <el-table-column prop="area_name" label="区域" width="120" />
        <el-table-column prop="applicant_name" label="申请人" width="100" />
        <el-table-column prop="recover_time" label="申请时间" width="170" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="$router.push('/recovery')">去处理</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { Tickets, CollectionTag, ShoppingCartFull, Warning, RefreshRight, Clock, Bell, CircleCheck } from '@element-plus/icons-vue'
import { getOverviewStatsApi } from '@/api'

const router = useRouter()
const stats = reactive({
  summary: {}, categoryDistribution: [], areaOccupancy: [], missingTypeStats: [], anomalyTypeStats: [],
  pendingConfirmList: [], expiryReminders: [], anomalies: {}, trendData: []
})
const summaryCards = ref([])
const anomalyCards = ref([])
const activeTab = ref('expiry')

const categoryChartRef = ref()
const statusChartRef = ref()
const areaChartRef = ref()
const missingChartRef = ref()
const trendChartRef = ref()
let charts = []

async function loadData() {
  const res = await getOverviewStatsApi()
  Object.assign(stats, res.data)
  summaryCards.value = [
    { label: '挂牌总数', value: stats.summary.totalTags || 0, color: '#409eff', icon: Tickets, click: null },
    { label: '样衣总数', value: stats.summary.totalGarments || 0, color: '#67c23a', icon: CollectionTag, click: null },
    { label: '在挂数量', value: stats.summary.totalHanging || 0, color: '#e6a23c', icon: ShoppingCartFull, click: null },
    { label: '即将到期', value: stats.summary.expiringCount || 0, color: '#e6a23c', icon: Clock, click: null },
    { label: '已超期', value: stats.summary.overdueCount || 0, color: '#f56c6c', icon: Bell, click: null },
    { label: '待回收确认', value: stats.summary.pendingRecovery || 0, color: '#f56c6c', icon: RefreshRight, click: null },
    { label: '未处理缺件', value: stats.summary.unhandledMissing || 0, color: '#909399', icon: Warning, click: null }
  ]
  anomalyCards.value = [
    { label: '异常处置单总数', value: stats.summary.totalAnomaly || 0, color: '#909399', icon: CircleCheck, click: () => router.push('/anomaly-tickets') },
    { label: '待处理异常', value: stats.summary.pendingAnomaly || 0, color: '#f56c6c', icon: Warning, click: () => router.push('/anomaly-tickets?status=待处理') },
    { label: '超期异常', value: stats.summary.overdueAnomaly || 0, color: '#f56c6c', icon: Bell, click: () => router.push('/anomaly-tickets?overdue=true') },
    { label: '待跟进异常', value: stats.summary.needFollowUpAnomaly || 0, color: '#e6a23c', icon: Clock, click: () => router.push('/anomaly-tickets?needFollowUp=true') },
    { label: '今日需跟进', value: stats.summary.todayFollowUpAnomaly || 0, color: '#409eff', icon: Bell, click: () => router.push('/anomaly-tickets?todayNext=true') }
  ]
  await nextTick()
  renderCharts()
}

function renderCharts() {
  charts.forEach(c => c.dispose())
  charts = []

  if (categoryChartRef.value) {
    const c = echarts.init(categoryChartRef.value)
    c.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0 },
      series: [{
        type: 'pie', radius: ['40%', '65%'], center: ['50%', '45%'],
        label: { formatter: '{b}\n{c}件' },
        data: (stats.categoryDistribution || []).map(d => ({ name: d.category_name, value: d.count }))
      }]
    })
    charts.push(c); window.addEventListener('resize', () => c.resize())
  }

  if (statusChartRef.value) {
    const c = echarts.init(statusChartRef.value)
    const sd = stats.summary.statusDistribution || []
    const colorMap = { '待挂牌': '#e6a23c', '已挂装': '#67c23a', '待调换': '#409eff', '待回收确认': '#f56c6c', '已回收': '#909399', '异常观察': '#f56c6c' }
    c.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c}' },
      legend: { bottom: 0, type: 'scroll' },
      series: [{
        type: 'pie', radius: ['35%', '60%'], center: ['50%', '45%'],
        label: { formatter: '{b}: {c}' },
        data: sd.map(d => ({ name: d.status, value: d.count, itemStyle: { color: colorMap[d.status] } }))
      }]
    })
    charts.push(c); window.addEventListener('resize', () => c.resize())
  }

  if (areaChartRef.value) {
    const c = echarts.init(areaChartRef.value)
    const d = stats.areaOccupancy || []
    c.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 50, right: 20, top: 20, bottom: 50 },
      legend: { bottom: 0, data: ['已使用', '容量'] },
      xAxis: { type: 'category', data: d.map(x => x.area_name), axisLabel: { rotate: 20, fontSize: 11 } },
      yAxis: { type: 'value' },
      series: [
        { name: '已使用', type: 'bar', stack: 'total', data: d.map(x => x.used_count || 0), itemStyle: { color: '#409eff' }, barWidth: 24, label: { show: true, position: 'top', formatter: '{c}' } },
        { name: '剩余容量', type: 'bar', stack: 'total', data: d.map(x => Math.max((x.capacity || 0) - (x.used_count || 0), 0)), itemStyle: { color: '#dcdfe6' } }
      ]
    })
    charts.push(c); window.addEventListener('resize', () => c.resize())
  }

  if (missingChartRef.value) {
    const c = echarts.init(missingChartRef.value)
    const anomalyData = stats.anomalyTypeStats && stats.anomalyTypeStats.length > 0
      ? stats.anomalyTypeStats.map(x => ({ name: x.anomaly_type, value: x.count }))
      : (stats.missingTypeStats || []).map(x => ({ name: x.missing_type, value: x.count || x.value }))
    c.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: 90, right: 20, top: 10, bottom: 30 },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: anomalyData.map(x => x.name).reverse() },
      series: [{
        type: 'bar', data: anomalyData.map(x => x.value).reverse(),
        itemStyle: { color: '#f56c6c' }, barWidth: 18,
        label: { show: true, position: 'right', formatter: '{c}条' }
      }]
    })
    c.off('click')
    c.on('click', (params) => {
      router.push(`/anomaly-tickets?anomalyType=${encodeURIComponent(params.name)}`)
    })
    charts.push(c); window.addEventListener('resize', () => c.resize())
  }

  if (trendChartRef.value) {
    const c = echarts.init(trendChartRef.value)
    const d = stats.trendData || []
    c.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 20, top: 20, bottom: 40 },
      xAxis: { type: 'category', boundaryGap: false, data: d.map(x => x.date), axisLabel: { rotate: 30, fontSize: 10 } },
      yAxis: { type: 'value' },
      series: [{
        type: 'line', smooth: true, data: d.map(x => x.hang_count || 0),
        areaStyle: { color: 'rgba(64,158,255,0.2)' },
        itemStyle: { color: '#409eff' }, lineStyle: { width: 2 }
      }]
    })
    charts.push(c); window.addEventListener('resize', () => c.resize())
  }
}

onMounted(loadData)
</script>
