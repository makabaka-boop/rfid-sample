<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">回收确认</div>
      <div style="display:flex; gap:10px;">
        <el-tag type="danger" effect="dark">待确认：{{ pendingCount }}</el-tag>
        <el-tag type="success">已回收：{{ recoveredCount }}</el-tag>
      </div>
    </div>

    <div class="filter-card">
      <el-form :inline="true" :model="filters" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="回收单/款号/挂牌" clearable style="width:180px;" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部" clearable style="width:150px;">
            <el-option v-for="s in statusList" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="申请日期">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始"
            end-placeholder="结束"
            value-format="YYYY-MM-DD"
            style="width:260px;"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="loadData(1)">查询</el-button>
          <el-button :icon="Refresh" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="table-card">
      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="record_no" label="回收单号" width="200" fixed />
        <el-table-column prop="tag_code" label="挂牌编号" width="130" />
        <el-table-column label="样衣" min-width="180">
          <template #default="{ row }">
            <div><b>{{ row.garment_name }}</b></div>
            <div style="font-size:12px;color:#606266;">{{ row.garment_code }} · {{ row.category_name || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="陈列位置" width="180">
          <template #default="{ row }">
            <div>{{ row.area_name || '-' }}</div>
            <div style="font-size:12px;color:#606266;" v-if="row.area_name">第{{ row.layer_no }}层 · 第{{ row.position_no }}位</div>
          </template>
        </el-table-column>
        <el-table-column prop="recover_op_name" label="申请人" width="100" />
        <el-table-column prop="recover_time" label="申请时间" width="170" />
        <el-table-column label="超期" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.status === '待回收确认' && getOverdueDays(row.recover_time) > 2" type="danger" size="small">
              {{ getOverdueDays(row.recover_time) }}天
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="复核人" width="100">
          <template #default="{ row }">{{ row.confirm_op_name || '-' }}</template>
        </el-table-column>
        <el-table-column prop="confirm_time" label="复核时间" width="170">
          <template #default="{ row }">{{ row.confirm_time || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === '待回收确认'" link type="success" size="small" @click="confirmRecovery(row)">确认回收</el-button>
            <el-button v-if="row.status === '待回收确认'" link type="info" size="small" @click="rejectRecovery(row)">驳回</el-button>
            <el-button link type="primary" size="small" @click="$router.push(`/hanging/${row.hang_id}`)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        class="mt-16"
        background
        layout="total, sizes, prev, pager, next, jumper"
        :total="total"
        :page-size="filters.pageSize"
        :page-sizes="[10,20,50,100]"
        :current-page="filters.page"
        @size-change="s => { filters.pageSize = s; loadData(1) }"
        @current-change="p => loadData(p)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh } from '@element-plus/icons-vue'
import { RECOVERY_STATUS_OPTIONS, getStatusTagType } from '@/utils/constants'
import dayjs from 'dayjs'
import { getRecoveryRecordsApi, confirmRecoveryApi, rejectRecoveryApi } from '@/api'

const loading = ref(false)
const tableData = ref([])
const total = ref(0)
const statusCounts = ref({ pending: 0, recovered: 0 })
const statusList = RECOVERY_STATUS_OPTIONS
const dateRange = ref([])

const filters = reactive({ page: 1, pageSize: 20, keyword: '', status: '', startDate: '', endDate: '' })

const pendingCount = computed(() => statusCounts.value.pending)
const recoveredCount = computed(() => statusCounts.value.recovered)

function getOverdueDays(time) {
  if (!time) return 0
  return dayjs().diff(dayjs(time), 'day')
}

async function loadData(page) {
  if (page) filters.page = page
  const [sd, ed] = dateRange.value || [null, null]
  filters.startDate = sd || ''
  filters.endDate = ed || ''
  loading.value = true
  try {
    const res = await getRecoveryRecordsApi(filters)
    tableData.value = res.data
    total.value = res.total
    if (res.status_counts) {
      statusCounts.value = res.status_counts
    }
  } finally { loading.value = false }
}

function resetFilters() {
  Object.assign(filters, { page: 1, keyword: '', status: '' })
  dateRange.value = []
  loadData()
}

function confirmRecovery(row) {
  ElMessageBox.prompt('请输入复核备注（可选）', `确认回收挂牌 ${row.tag_code}？`, {
    confirmButtonText: '确认回收', cancelButtonText: '取消',
    type: 'success', inputType: 'textarea', inputPlaceholder: '复核意见...'
  }).then(async ({ value }) => {
    await confirmRecoveryApi({ recoveryId: row.id, confirmRemark: value || '' })
    ElMessage.success('回收已确认，挂牌标记为已回收')
    loadData()
  }).catch(() => {})
}

function rejectRecovery(row) {
  ElMessageBox.prompt('请输入驳回理由', `驳回回收申请 ${row.record_no}`, {
    confirmButtonText: '确认驳回', cancelButtonText: '取消',
    type: 'warning', inputType: 'textarea', inputPlaceholder: '必须填写驳回原因...'
  }).then(async ({ value }) => {
    if (!value || !value.trim()) return ElMessage.warning('驳回理由必填')
    await rejectRecoveryApi({ recoveryId: row.id, rejectReason: value })
    ElMessage.success('已驳回，挂装状态恢复')
    loadData()
  }).catch(() => {})
}

onMounted(() => {
  filters.status = '待回收确认'
  loadData()
})
</script>
