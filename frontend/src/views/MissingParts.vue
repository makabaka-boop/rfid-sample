<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">缺件说明</div>
      <el-button type="danger" :icon="Plus" @click="openCreateDialog">上报缺件</el-button>
    </div>

    <div class="filter-card">
      <el-form :inline="true" :model="filters" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="单号/挂牌/款号" clearable style="width:200px;" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="filters.missingType" placeholder="全部" clearable style="width:140px;">
            <el-option v-for="t in typeOptions" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部" clearable style="width:120px;">
            <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="上报日期">
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
        <el-table-column prop="record_no" label="缺件单号" width="200" fixed />
        <el-table-column prop="missing_type" label="类型" width="110">
          <template #default="{ row }"><el-tag type="danger" size="small">{{ row.missing_type }}</el-tag></template>
        </el-table-column>
        <el-table-column label="关联对象" min-width="200">
          <template #default="{ row }">
            <div v-if="row.tag_code" style="font-size:12px;">挂牌：<b>{{ row.tag_code }}</b></div>
            <div v-if="row.garment_code" style="font-size:12px;">样衣：<b>{{ row.garment_code }}</b> {{ row.garment_name || '' }}</div>
            <div v-if="row.hang_record_no" style="font-size:12px;color:#909399;">挂装单：{{ row.hang_record_no }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="missing_description" label="问题描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="reporter_name" label="上报人" width="90" />
        <el-table-column prop="report_time" label="上报时间" width="170" />
        <el-table-column label="超期" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.status !== '已处理' && getPendingDays(row.report_time) > 3" type="warning" size="small">{{ getPendingDays(row.report_time) }}天</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="handler_name" label="处理人" width="90">
          <template #default="{ row }">{{ row.handler_name || '-' }}</template>
        </el-table-column>
        <el-table-column prop="handle_time" label="处理时间" width="170">
          <template #default="{ row }">{{ row.handle_time || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status !== '已处理'" link type="primary" size="small" @click="openHandleDialog(row)">处理</el-button>
            <el-button v-if="row.hang_id" link type="primary" size="small" @click="$router.push(`/hanging/${row.hang_id}`)">关联挂装</el-button>
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

    <el-dialog v-model="createDialogVisible" title="上报缺件/异常" width="560px">
      <el-form :model="createForm" :rules="createRules" ref="createFormRef" label-width="100px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="关联挂装">
              <el-select v-model="createForm.hangId" filterable clearable style="width:100%;" @change="onHangChange">
                <el-option v-for="h in hangOptions" :key="h.id" :label="`${h.tag_code} - ${h.garment_name}`" :value="h.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="缺件类型" prop="missingType">
              <el-select v-model="createForm.missingType" style="width:100%;">
                <el-option v-for="t in typeOptions" :key="t.value" :label="t.label" :value="t.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="问题描述" prop="missingDescription">
          <el-input v-model="createForm.missingDescription" type="textarea" :rows="4" placeholder="请详细描述缺件/异常情况" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible=false">取消</el-button>
        <el-button type="danger" :loading="submitLoading" @click="submitCreate">确认上报</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="handleDialogVisible" title="处理缺件" width="520px">
      <el-alert type="info" :closable="false" style="margin-bottom:16px;">
        类型：{{ handleRow?.missing_type }} &nbsp;|&nbsp; 上报：{{ handleRow?.report_time }}
      </el-alert>
      <el-descriptions :column="1" size="small" border style="margin-bottom:16px;">
        <el-descriptions-item label="问题描述">{{ handleRow?.missing_description }}</el-descriptions-item>
      </el-descriptions>
      <el-form label-width="90px">
        <el-form-item label="处理结果">
          <el-input v-model="handleResult" type="textarea" :rows="4" placeholder="请填写处理措施、结果等" />
        </el-form-item>
        <div style="color:#e6a23c; font-size:12px; padding:8px; background:#fdf6ec; border-radius:4px;">
          <el-icon><WarningFilled /></el-icon>
          &nbsp;处理完成后，若关联挂牌的所有缺件均已处理，挂牌状态将从"异常观察"自动恢复为"待挂牌"
        </div>
      </el-form>
      <template #footer>
        <el-button @click="handleDialogVisible=false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submitHandle">标记已处理</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Search, Refresh, WarningFilled } from '@element-plus/icons-vue'
import { MISSING_TYPE_OPTIONS, MISSING_STATUS_OPTIONS, getStatusTagType } from '@/utils/constants'
import dayjs from 'dayjs'
import { getMissingPartsApi, createMissingPartApi, handleMissingPartApi, getHangingRecordsApi } from '@/api'

const loading = ref(false)
const tableData = ref([])
const total = ref(0)
const dateRange = ref([])
const typeOptions = MISSING_TYPE_OPTIONS
const statusOptions = MISSING_STATUS_OPTIONS
const hangOptions = ref([])
const submitLoading = ref(false)

const filters = reactive({ page: 1, pageSize: 20, keyword: '', missingType: '', status: '', startDate: '', endDate: '' })

function getPendingDays(time) {
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
    const res = await getMissingPartsApi(filters)
    tableData.value = res.data
    total.value = res.total
  } finally { loading.value = false }
}

function resetFilters() {
  Object.assign(filters, { page: 1, keyword: '', missingType: '', status: '' })
  dateRange.value = []
  loadData()
}

const createDialogVisible = ref(false)
const createFormRef = ref()
const createForm = reactive({ hangId: '', tagId: '', garmentId: '', missingType: '', missingDescription: '' })
const createRules = {
  missingType: [{ required: true, message: '请选择类型', trigger: 'change' }],
  missingDescription: [{ required: true, message: '请填写描述', trigger: 'blur' }]
}

async function openCreateDialog() {
  Object.assign(createForm, { hangId: '', tagId: '', garmentId: '', missingType: '', missingDescription: '' })
  try {
    const res = await getHangingRecordsApi({ pageSize: 200, status: '已挂装' })
    hangOptions.value = res.data
  } catch (e) {}
  createDialogVisible.value = true
}

function onHangChange(id) {
  const h = hangOptions.value.find(x => x.id === id)
  if (h) {
    createForm.tagId = h.tag_id
    createForm.garmentId = h.garment_id
  } else {
    createForm.tagId = ''
    createForm.garmentId = ''
  }
}

async function submitCreate() {
  await createFormRef.value.validate()
  submitLoading.value = true
  try {
    await createMissingPartApi(createForm)
    ElMessage.success('缺件已上报')
    createDialogVisible.value = false
    loadData()
  } finally { submitLoading.value = false }
}

const handleDialogVisible = ref(false)
const handleRow = ref(null)
const handleResult = ref('')

function openHandleDialog(row) {
  handleRow.value = row
  handleResult.value = ''
  handleDialogVisible.value = true
}

async function submitHandle() {
  if (!handleResult.value.trim()) return ElMessage.warning('请填写处理结果')
  submitLoading.value = true
  try {
    await handleMissingPartApi(handleRow.value.id, { handleResult: handleResult.value })
    ElMessage.success('处理完成')
    handleDialogVisible.value = false
    loadData()
  } finally { submitLoading.value = false }
}

onMounted(loadData)
</script>
