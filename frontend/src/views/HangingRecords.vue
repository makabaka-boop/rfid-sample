<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">挂装记录</div>
      <div>
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">新建挂装</el-button>
      </div>
    </div>

    <div class="filter-card">
      <el-form :inline="true" :model="filters" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="款号/挂牌/单号" clearable style="width:180px;" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="filters.categoryId" placeholder="全部" clearable style="width:150px;">
            <el-option v-for="c in categories" :key="c.id" :label="c.category_name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="区域">
          <el-select v-model="filters.areaId" placeholder="全部" clearable style="width:150px;">
            <el-option v-for="a in areas" :key="a.id" :label="a.area_name" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="责任人">
          <el-select v-model="filters.responsibleId" placeholder="全部" clearable filterable style="width:160px;">
            <el-option v-for="p in responsiblePersons" :key="p.id" :label="p.person_name" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部" clearable style="width:140px;">
            <el-option v-for="s in statusList" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="缺件">
          <el-select v-model="filters.hasMissing" placeholder="全部" clearable style="width:120px;">
            <el-option label="有缺件" value="true" />
            <el-option label="无缺件" value="false" />
          </el-select>
        </el-form-item>
        <el-form-item label="到期状态">
          <el-select v-model="filters.expiryStatus" placeholder="全部" clearable style="width:140px;">
            <el-option v-for="s in EXPIRY_STATUS_OPTIONS" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="挂装日期">
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
        <el-table-column prop="record_no" label="挂装单号" width="200" fixed />
        <el-table-column label="挂牌" width="130">
          <template #default="{ row }">
            <div><b>{{ row.tag_code }}</b></div>
            <div style="font-size:11px;color:#909399;">{{ row.template_name || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="样衣" min-width="180">
          <template #default="{ row }">
            <div><b>{{ row.garment_name }}</b></div>
            <div style="font-size:12px;color:#606266;">{{ row.garment_code }} · {{ row.category_name }} · {{ row.season || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="陈列位置" width="180">
          <template #default="{ row }">
            <div>{{ row.area_name }}</div>
            <div style="font-size:12px;color:#606266;">第{{ row.layer_no }}层 · 第{{ row.position_no }}位</div>
          </template>
        </el-table-column>
        <el-table-column prop="person_name" label="责任人" width="100" />
        <el-table-column label="调换次数" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.swap_count >= 3" type="danger" size="small">{{ row.swap_count }}次</el-tag>
            <el-tag v-else size="small">{{ row.swap_count || 0 }}次</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="缺件" width="80" align="center">
          <template #default="{ row }">
            <el-badge v-if="row.unresolved_missing_count > 0" :value="row.unresolved_missing_count" type="danger">
              <el-tag type="danger" size="small">有</el-tag>
            </el-badge>
            <el-tag v-else type="success" size="small">无</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="到期状态" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.expiry_status" :type="getExpiryStatusTagType(row.expiry_status)" size="small">
              {{ getExpiryStatusLabel(row.expiry_status) }}
            </el-tag>
            <span v-else style="color:#909399;font-size:12px;">未设置</span>
          </template>
        </el-table-column>
        <el-table-column label="剩余天数" width="110" align="center">
          <template #default="{ row }">
            <span :style="{ color: row.expiry_status === 'overdue' ? '#f56c6c' : row.expiry_status === 'expiring' ? '#e6a23c' : '#606266' }">
              {{ getDaysLeftText(row.days_left, row.expiry_status) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="expected_off_date" label="预计下架日期" width="140" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="hang_time" label="挂装时间" width="170" />
        <el-table-column label="操作" width="320" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="$router.push(`/hanging/${row.id}`)">详情</el-button>
            <el-button link type="primary" size="small" @click="openSwapDialog(row)" v-if="['已挂装','待调换'].includes(row.status)">调换</el-button>
            <el-button link type="danger" size="small" @click="quickRequestRecovery(row)" v-if="row.expiry_status === 'overdue' && ['已挂装','待调换','异常观察'].includes(row.status)">
              快捷回收
            </el-button>
            <el-button link type="warning" size="small" @click="requestRecovery(row)" v-if="row.expiry_status !== 'overdue' && ['已挂装','待调换','异常观察'].includes(row.status)">申请回收</el-button>
            <el-button link type="danger" size="small" @click="reportMissing(row)" v-if="['已挂装','异常观察'].includes(row.status)">上报缺件</el-button>
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

    <el-dialog v-model="createDialogVisible" title="新建挂装" width="620px">
      <el-form :model="createForm" :rules="createRules" ref="createFormRef" label-width="100px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="挂牌" prop="tagId">
              <el-select v-model="createForm.tagId" filterable style="width:100%;">
                <el-option v-for="t in availableTags" :key="t.id" :label="`${t.tag_code} - ${t.template_name || '标准'}`" :value="t.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="样衣" prop="garmentId">
              <el-select v-model="createForm.garmentId" filterable style="width:100%;">
                <el-option v-for="g in availableGarments" :key="g.id" :label="`${g.garment_code} ${g.garment_name}`" :value="g.id" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="陈列区域" prop="areaId">
              <el-select v-model="createForm.areaId" style="width:100%;">
                <el-option v-for="a in areas" :key="a.id" :label="a.area_name" :value="a.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="层号" prop="layerNo">
              <el-input-number v-model="createForm.layerNo" :min="1" :max="10" style="width:100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="位号" prop="positionNo">
              <el-input-number v-model="createForm.positionNo" :min="1" :max="50" style="width:100%;" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="责任人" prop="responsibleId">
          <el-select v-model="createForm.responsibleId" filterable style="width:100%;">
            <el-option v-for="p in responsiblePersons" :key="p.id" :label="`${p.person_name}（${p.department}）`" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="预计下架日期">
          <el-date-picker
            v-model="createForm.expectedOffDate"
            type="date"
            placeholder="选择预计下架日期"
            value-format="YYYY-MM-DD"
            style="width:100%;"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="createForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible=false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submitCreate">确认挂装</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="swapDialogVisible" title="调换样衣/位置" width="620px">
      <el-alert v-if="swapTarget" type="warning" :closable="false" style="margin-bottom:16px;">
        当前：<b>{{ swapTarget.garment_name }}</b> @ {{ swapTarget.area_name }} L{{ swapTarget.layer_no }}-P{{ swapTarget.position_no }}
      </el-alert>
      <el-form :model="swapForm" :rules="swapRules" ref="swapFormRef" label-width="100px">
        <el-form-item label="新样衣" prop="newGarmentId">
          <el-select v-model="swapForm.newGarmentId" filterable style="width:100%;">
            <el-option v-for="g in availableGarments" :key="g.id" :label="`${g.garment_code} ${g.garment_name}`" :value="g.id" />
          </el-select>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="新区域">
              <el-select v-model="swapForm.newAreaId" placeholder="不变更则留空" clearable style="width:100%;">
                <el-option v-for="a in areas" :key="a.id" :label="a.area_name" :value="a.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="新层号">
              <el-input-number v-model="swapForm.newLayerNo" :min="1" :max="10" :controls="false" style="width:100%;" placeholder="不变更留空" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="新位号">
              <el-input-number v-model="swapForm.newPositionNo" :min="1" :max="50" :controls="false" style="width:100%;" placeholder="不变更留空" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="预计下架日期">
          <el-date-picker
            v-model="swapForm.expectedOffDate"
            type="date"
            placeholder="不修改则留空，沿用原日期"
            value-format="YYYY-MM-DD"
            style="width:100%;"
          />
        </el-form-item>
        <el-form-item label="调换原因" prop="swapReason">
          <el-input v-model="swapForm.swapReason" type="textarea" :rows="2" placeholder="请说明调换原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="swapDialogVisible=false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submitSwap">确认调换</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="missingDialogVisible" title="上报缺件/异常" width="520px">
      <el-form :model="missingForm" :rules="missingRules" ref="missingFormRef" label-width="90px">
        <el-form-item label="缺件类型" prop="missingType">
          <el-select v-model="missingForm.missingType" style="width:100%;">
            <el-option v-for="t in missingTypes" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="问题描述" prop="missingDescription">
          <el-input v-model="missingForm.missingDescription" type="textarea" :rows="4" placeholder="请详细描述缺件/异常情况" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="missingDialogVisible=false">取消</el-button>
        <el-button type="danger" :loading="submitLoading" @click="submitMissing">确认上报</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Refresh } from '@element-plus/icons-vue'
import { TAG_STATUS_OPTIONS, MISSING_TYPE_OPTIONS, getStatusTagType, EXPIRY_STATUS_OPTIONS, getExpiryStatusTagType, getExpiryStatusLabel, getDaysLeftText } from '@/utils/constants'
import {
  getCategoriesApi, getAreasApi, getResponsiblePersonsApi, getHangingRecordsApi,
  getAvailableTagsApi, getAvailableGarmentsApi, createHangingApi,
  createSwapApi, requestRecoveryApi, createMissingPartApi
} from '@/api'

const loading = ref(false)
const tableData = ref([])
const total = ref(0)
const categories = ref([])
const areas = ref([])
const responsiblePersons = ref([])
const availableTags = ref([])
const availableGarments = ref([])
const statusList = TAG_STATUS_OPTIONS.filter(s => ['已挂装','待调换','待回收确认','已回收','异常观察'].includes(s.value))
const missingTypes = MISSING_TYPE_OPTIONS

const dateRange = ref([])
const filters = reactive({
  page: 1, pageSize: 20, keyword: '', categoryId: '', areaId: '',
  responsibleId: '', status: '', hasMissing: '', expiryStatus: '', startDate: '', endDate: ''
})

const createDialogVisible = ref(false)
const createFormRef = ref()
const submitLoading = ref(false)
const createForm = reactive({ tagId: '', garmentId: '', areaId: '', layerNo: 1, positionNo: 1, responsibleId: '', expectedOffDate: '', remark: '' })
const createRules = {
  tagId: [{ required: true, message: '请选择挂牌', trigger: 'change' }],
  garmentId: [{ required: true, message: '请选择样衣', trigger: 'change' }],
  areaId: [{ required: true, message: '请选择区域', trigger: 'change' }],
  responsibleId: [{ required: true, message: '请选择责任人', trigger: 'change' }]
}

const swapDialogVisible = ref(false)
const swapTarget = ref(null)
const swapFormRef = ref()
const swapForm = reactive({ originalHangId: '', newGarmentId: '', newAreaId: '', newLayerNo: '', newPositionNo: '', expectedOffDate: '', swapReason: '' })
const swapRules = {
  newGarmentId: [{ required: true, message: '请选择新样衣', trigger: 'change' }],
  swapReason: [{ required: true, message: '请填写调换原因', trigger: 'blur' }]
}

const missingDialogVisible = ref(false)
const missingFormRef = ref()
const missingForm = reactive({ hangId: '', tagId: '', garmentId: '', missingType: '', missingDescription: '' })
const missingRules = {
  missingType: [{ required: true, message: '请选择类型', trigger: 'change' }],
  missingDescription: [{ required: true, message: '请填写描述', trigger: 'blur' }]
}

async function loadMaster() {
  const [c, a, r] = await Promise.all([getCategoriesApi(), getAreasApi(), getResponsiblePersonsApi()])
  categories.value = c.data
  areas.value = a.data
  responsiblePersons.value = r.data
}

async function loadData(page) {
  if (page) filters.page = page
  const [sd, ed] = dateRange.value || [null, null]
  filters.startDate = sd || ''
  filters.endDate = ed || ''
  loading.value = true
  try {
    const res = await getHangingRecordsApi(filters)
    tableData.value = res.data
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  Object.assign(filters, { page: 1, keyword: '', categoryId: '', areaId: '', responsibleId: '', status: '', hasMissing: '', expiryStatus: '' })
  dateRange.value = []
  loadData()
}

async function openCreateDialog() {
  Object.assign(createForm, { tagId: '', garmentId: '', areaId: areas.value[0]?.id || '', layerNo: 1, positionNo: 1, responsibleId: responsiblePersons.value[0]?.id || '', expectedOffDate: '', remark: '' })
  try {
    const [t, g] = await Promise.all([getAvailableTagsApi(), getAvailableGarmentsApi()])
    availableTags.value = t.data
    availableGarments.value = g.data
    if (!availableTags.value.length) return ElMessage.warning('暂无可用挂牌')
    if (!availableGarments.value.length) return ElMessage.warning('暂无可挂的样衣')
    createDialogVisible.value = true
  } catch (e) {}
}

async function submitCreate() {
  await createFormRef.value.validate()
  submitLoading.value = true
  try {
    const res = await createHangingApi(createForm)
    ElMessage.success('挂装成功')
    createDialogVisible.value = false
    loadData()
  } finally { submitLoading.value = false }
}

async function openSwapDialog(row) {
  swapTarget.value = row
  Object.assign(swapForm, { originalHangId: row.id, newGarmentId: '', newAreaId: '', newLayerNo: '', newPositionNo: '', expectedOffDate: '', swapReason: '' })
  try {
    const res = await getAvailableGarmentsApi()
    availableGarments.value = res.data
    if (!availableGarments.value.length) return ElMessage.warning('暂无可换的样衣')
    swapDialogVisible.value = true
  } catch (e) {}
}

async function submitSwap() {
  await swapFormRef.value.validate()
  submitLoading.value = true
  try {
    const res = await createSwapApi(swapForm)
    const msg = res.frequentWarning ? `${res.message}（${res.frequentWarning}）` : res.message
    ElMessage({ message: msg, type: res.frequentWarning ? 'warning' : 'success', duration: 4000 })
    swapDialogVisible.value = false
    loadData()
  } finally { submitLoading.value = false }
}

function quickRequestRecovery(row) {
  ElMessageBox.confirm(`该挂装已超期${Math.abs(row.days_left)}天，确认快速申请回收？`, '超期挂装快速回收', {
    confirmButtonText: '确认回收',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    await requestRecoveryApi({ hangId: row.id, remark: `超期自动回收：已超期${Math.abs(row.days_left)}天` })
    ElMessage.success('回收申请已提交')
    loadData()
  }).catch(() => {})
}

function requestRecovery(row) {
  ElMessageBox.prompt('请输入回收备注（可选）', '确认申请回收？', {
    confirmButtonText: '提交',
    cancelButtonText: '取消',
    inputType: 'textarea',
    inputPlaceholder: '回收原因/备注...'
  }).then(async ({ value }) => {
    await requestRecoveryApi({ hangId: row.id, remark: value || '' })
    ElMessage.success('回收申请已提交')
    loadData()
  }).catch(() => {})
}

function reportMissing(row) {
  Object.assign(missingForm, { hangId: row.id, tagId: row.tag_id, garmentId: row.garment_id, missingType: '', missingDescription: '' })
  missingDialogVisible.value = true
}

async function submitMissing() {
  await missingFormRef.value.validate()
  submitLoading.value = true
  try {
    await createMissingPartApi(missingForm)
    ElMessage.success('缺件已上报，挂牌状态变更为异常观察')
    missingDialogVisible.value = false
    loadData()
  } finally { submitLoading.value = false }
}

onMounted(async () => {
  await loadMaster()
  loadData()
})
</script>
