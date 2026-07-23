<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">样衣档案</div>
      <el-button type="primary" :icon="Plus" @click="openCreateDialog">新增样衣</el-button>
    </div>

    <div class="filter-card">
      <el-form :inline="true" :model="filters" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="款号/名称" clearable style="width:180px;" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="filters.categoryId" placeholder="全部" clearable style="width:160px;">
            <el-option v-for="c in categories" :key="c.id" :label="c.category_name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="季节">
          <el-select v-model="filters.season" placeholder="全部" clearable style="width:140px;">
            <el-option label="2024春" value="2024春" />
            <el-option label="2024夏" value="2024夏" />
            <el-option label="2024秋冬" value="2024秋冬" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="loadData(1)">查询</el-button>
          <el-button :icon="Refresh" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="table-card">
      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="garment_code" label="款号" width="130" fixed />
        <el-table-column prop="garment_name" label="款名" min-width="180" show-overflow-tooltip />
        <el-table-column prop="category_name" label="分类" width="100" />
        <el-table-column prop="season" label="季节" width="90" />
        <el-table-column prop="color" label="颜色" width="90" />
        <el-table-column prop="size" label="尺码" width="130" show-overflow-tooltip />
        <el-table-column prop="fabric" label="面料" min-width="140" show-overflow-tooltip />
        <el-table-column prop="description" label="备注" min-width="140" show-overflow-tooltip />
        <el-table-column prop="created_at" label="创建时间" width="170" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button link type="primary" size="small" @click="openHangDialog(row)" v-if="canHang(row)">挂装</el-button>
            <el-button link type="danger" size="small" @click="openAnomalyDialog(row)">登记异常</el-button>
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

    <el-dialog v-model="dialogVisible" :title="dialogMode === 'create' ? '新增样衣' : '编辑样衣'" width="560px">
      <el-form :model="form" :rules="formRules" ref="formRef" label-width="80px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="款号" prop="garmentCode">
              <el-input v-model="form.garmentCode" :disabled="dialogMode==='edit'" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="款名" prop="garmentName">
              <el-input v-model="form.garmentName" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="分类" prop="categoryId">
              <el-select v-model="form.categoryId" style="width:100%;">
                <el-option v-for="c in categories" :key="c.id" :label="c.category_name" :value="c.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="季节">
              <el-input v-model="form.season" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="颜色">
              <el-input v-model="form.color" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="尺码">
              <el-input v-model="form.size" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="面料">
          <el-input v-model="form.fabric" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input type="textarea" v-model="form.description" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible=false">取消</el-button>
        <el-button type="primary" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="hangDialogVisible" title="执行挂装" width="600px">
      <el-alert type="info" :closable="false" style="margin-bottom:16px;">
        样衣：<b>{{ targetGarment?.garment_name }}</b>（{{ targetGarment?.garment_code }}）
      </el-alert>
      <el-form :model="hangForm" :rules="hangRules" ref="hangFormRef" label-width="100px">
        <el-form-item label="挂牌" prop="tagId">
          <el-select v-model="hangForm.tagId" filterable style="width:100%;" placeholder="选择可挂的挂牌">
            <el-option v-for="t in availableTags" :key="t.id" :label="`${t.tag_code} - ${t.template_name || '标准模板'}`" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="陈列区域" prop="areaId">
              <el-select v-model="hangForm.areaId" style="width:100%;" @change="validatePosition">
                <el-option v-for="a in areas" :key="a.id" :label="`${a.area_code} ${a.area_name}`" :value="a.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="层" prop="layerNo">
              <el-input-number v-model="hangForm.layerNo" :min="1" :max="10" style="width:100%;" @change="validatePosition" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="位" prop="positionNo">
              <el-input-number v-model="hangForm.positionNo" :min="1" :max="50" style="width:100%;" @change="validatePosition" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="责任人" prop="responsibleId">
          <el-select v-model="hangForm.responsibleId" filterable style="width:100%;">
            <el-option v-for="p in responsiblePersons" :key="p.id" :label="`${p.person_name}（${p.department}）`" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="预计下架日期">
          <el-date-picker
            v-model="hangForm.expectedOffDate"
            type="date"
            placeholder="选择预计下架日期"
            value-format="YYYY-MM-DD"
            style="width:100%;"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="hangForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="hangDialogVisible=false">取消</el-button>
        <el-button type="primary" :loading="hangLoading" @click="submitHang">确认挂装</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="anomalyDialogVisible" title="登记异常处置单" width="560px">
      <el-alert type="warning" :closable="false" style="margin-bottom:16px;">
        样衣：<b>{{ anomalyGarment?.garment_name }}</b>（{{ anomalyGarment?.garment_code }}）
      </el-alert>
      <el-form :model="anomalyForm" :rules="anomalyRules" ref="anomalyFormRef" label-width="100px">
        <el-form-item label="关联挂装" prop="hangId">
          <el-select v-model="anomalyForm.hangId" filterable style="width:100%;" placeholder="选择该样衣的已挂装记录">
            <el-option v-for="h in garmentHangingOptions" :key="h.id" :label="`${h.tag_code} - ${h.area_name} L${h.layer_no}-P${h.position_no}`" :value="h.id" />
          </el-select>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="异常类型" prop="anomalyType">
              <el-select v-model="anomalyForm.anomalyType" style="width:100%;">
                <el-option v-for="t in anomalyTypes" :key="t.value" :label="t.label" :value="t.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="责任人" prop="responsibleId">
              <el-select v-model="anomalyForm.responsibleId" filterable style="width:100%;" placeholder="请选择责任人">
                <el-option v-for="p in responsiblePersons" :key="p.id" :label="`${p.person_name}（${p.department}）`" :value="p.id" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="期望处理日期">
          <el-date-picker
            v-model="anomalyForm.expectedHandleDate"
            type="date"
            placeholder="选择期望处理完成日期"
            value-format="YYYY-MM-DD"
            style="width:100%;"
          />
        </el-form-item>
        <el-form-item label="问题描述" prop="description">
          <el-input v-model="anomalyForm.description" type="textarea" :rows="4" placeholder="请详细描述异常情况" />
        </el-form-item>
        <div style="color:#e6a23c; font-size:12px; padding:8px; background:#fdf6ec; border-radius:4px;">
          <el-icon><Warning /></el-icon>
          &nbsp;若选择了关联挂装，登记异常后该挂牌和挂装状态将自动变更为"异常观察"
        </div>
      </el-form>
      <template #footer>
        <el-button @click="anomalyDialogVisible=false">取消</el-button>
        <el-button type="danger" :loading="anomalyLoading" @click="submitAnomaly">确认登记</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Refresh, Warning } from '@element-plus/icons-vue'
import { ANOMALY_TYPE_OPTIONS } from '@/utils/constants'
import { getCategoriesApi, getAreasApi, getResponsiblePersonsApi,
  getGarmentsApi, createGarmentApi, updateGarmentApi,
  getAvailableTagsApi, createHangingApi,
  createAnomalyTicketApi, getHangingRecordsApi } from '@/api'

const router = useRouter()
const loading = ref(false)
const tableData = ref([])
const total = ref(0)
const categories = ref([])
const areas = ref([])
const responsiblePersons = ref([])
const availableTags = ref([])

const filters = reactive({ page: 1, pageSize: 20, keyword: '', categoryId: '', season: '' })

const dialogVisible = ref(false)
const dialogMode = ref('create')
const formRef = ref()
const form = reactive({ id: null, garmentCode: '', garmentName: '', categoryId: '', season: '', color: '', size: '', fabric: '', description: '' })
const formRules = {
  garmentCode: [{ required: true, message: '请输入款号', trigger: 'blur' }],
  garmentName: [{ required: true, message: '请输入款名', trigger: 'blur' }],
  categoryId: [{ required: true, message: '请选择分类', trigger: 'change' }]
}

const hangDialogVisible = ref(false)
const targetGarment = ref(null)
const hangFormRef = ref()
const hangLoading = ref(false)
const hangForm = reactive({ tagId: '', areaId: '', layerNo: 1, positionNo: 1, responsibleId: '', expectedOffDate: '', remark: '' })
const hangRules = {
  tagId: [{ required: true, message: '请选择挂牌', trigger: 'change' }],
  areaId: [{ required: true, message: '请选择区域', trigger: 'change' }],
  layerNo: [{ required: true, message: '请输入层号', trigger: 'blur' }],
  positionNo: [{ required: true, message: '请输入位号', trigger: 'blur' }],
  responsibleId: [{ required: true, message: '请选择责任人', trigger: 'change' }]
}

const anomalyTypes = ANOMALY_TYPE_OPTIONS
const anomalyDialogVisible = ref(false)
const anomalyGarment = ref(null)
const anomalyFormRef = ref()
const anomalyLoading = ref(false)
const garmentHangingOptions = ref([])
const anomalyForm = reactive({ hangId: '', anomalyType: '', description: '', responsibleId: '', expectedHandleDate: '' })
const anomalyRules = {
  hangId: [{ required: true, message: '请选择关联挂装记录', trigger: 'change' }],
  anomalyType: [{ required: true, message: '请选择异常类型', trigger: 'change' }],
  description: [{ required: true, message: '请填写问题描述', trigger: 'blur' }]
}

async function loadMaster() {
  const [c, a, r] = await Promise.all([getCategoriesApi(), getAreasApi(), getResponsiblePersonsApi()])
  categories.value = c.data.filter(x => x.parent_id !== 0).length ? c.data : c.data
  areas.value = a.data
  responsiblePersons.value = r.data
}

async function loadData(page) {
  if (page) filters.page = page
  loading.value = true
  try {
    const res = await getGarmentsApi(filters)
    tableData.value = res.data
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  Object.assign(filters, { page: 1, keyword: '', categoryId: '', season: '' })
  loadData()
}

function openCreateDialog() {
  dialogMode.value = 'create'
  Object.assign(form, { id: null, garmentCode: '', garmentName: '', categoryId: '', season: '', color: '', size: '', fabric: '', description: '' })
  dialogVisible.value = true
}

function openEditDialog(row) {
  dialogMode.value = 'edit'
  Object.assign(form, {
    id: row.id, garmentCode: row.garment_code, garmentName: row.garment_name,
    categoryId: row.category_id, season: row.season, color: row.color,
    size: row.size, fabric: row.fabric, description: row.description
  })
  dialogVisible.value = true
}

async function submitForm() {
  await formRef.value.validate()
  const payload = {
    garmentCode: form.garmentCode, garmentName: form.garmentName, categoryId: form.categoryId,
    season: form.season, color: form.color, size: form.size, fabric: form.fabric, description: form.description
  }
  if (dialogMode.value === 'create') await createGarmentApi(payload)
  else await updateGarmentApi(form.id, payload)
  ElMessage.success(dialogMode.value === 'create' ? '新增成功' : '更新成功')
  dialogVisible.value = false
  loadData()
}

function canHang(row) {
  return true
}

async function openHangDialog(row) {
  targetGarment.value = row
  Object.assign(hangForm, { tagId: '', areaId: areas.value[0]?.id || '', layerNo: 1, positionNo: 1, responsibleId: responsiblePersons.value[0]?.id || '', expectedOffDate: '', remark: '' })
  try {
    const res = await getAvailableTagsApi()
    availableTags.value = res.data
    if (!availableTags.value.length) {
      ElMessage.warning('暂无可用挂牌，请先创建新挂牌或回收已有挂牌')
      return
    }
    hangDialogVisible.value = true
  } catch (e) {}
}

function validatePosition() {}

async function submitHang() {
  await hangFormRef.value.validate()
  try {
    hangLoading.value = true
    await createHangingApi({ ...hangForm, garmentId: targetGarment.value.id })
    ElMessage.success('挂装成功')
    hangDialogVisible.value = false
    loadData()
  } finally {
    hangLoading.value = false
  }
}

async function openAnomalyDialog(row) {
  anomalyGarment.value = row
  Object.assign(anomalyForm, { hangId: '', anomalyType: '', description: '', responsibleId: '', expectedHandleDate: '' })
  garmentHangingOptions.value = []
  try {
    const res = await getHangingRecordsApi({ pageSize: 200, status: '已挂装' })
    garmentHangingOptions.value = res.data.filter(h => h.garment_id === row.id)
  } catch (e) {}
  if (garmentHangingOptions.value.length === 0) {
    ElMessage.warning('该样衣暂无已挂装记录，无法登记异常')
    return
  }
  anomalyDialogVisible.value = true
}

async function submitAnomaly() {
  await anomalyFormRef.value.validate()
  anomalyLoading.value = true
  try {
    await createAnomalyTicketApi(anomalyForm)
    ElMessage.success('异常处置单已登记')
    anomalyDialogVisible.value = false
  } finally {
    anomalyLoading.value = false
  }
}

onMounted(async () => {
  await loadMaster()
  loadData()
})
</script>
