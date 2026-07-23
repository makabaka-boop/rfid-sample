<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">调换记录</div>
    </div>

    <div class="filter-card">
      <el-form :inline="true" :model="filters" @submit.prevent>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="挂牌/样衣/单号" clearable style="width:200px;" />
        </el-form-item>
        <el-form-item label="调换日期">
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
        <el-table-column prop="record_no" label="调换单号" width="200" fixed />
        <el-table-column prop="tag_code" label="挂牌编号" width="120" />
        <el-table-column label="调换明细" min-width="360">
          <template #default="{ row }">
            <div style="display:flex; align-items:center; gap:12px; padding:4px 0;">
              <div style="flex:1; padding:8px; background:#fef0f0; border-radius:6px;">
                <div style="font-size:12px; color:#909399;">原样衣</div>
                <div><b>{{ row.original_garment_name }}</b></div>
                <div style="font-size:12px; color:#606266;">{{ row.original_garment_code }}</div>
                <div style="font-size:12px; color:#606266;" v-if="row.original_area_name">{{ row.original_area_name }}</div>
              </div>
              <el-icon :size="24" color="#409eff"><Right /></el-icon>
              <div style="flex:1; padding:8px; background:#ecf5ff; border-radius:6px;">
                <div style="font-size:12px; color:#909399;">新样衣</div>
                <div><b>{{ row.new_garment_name }}</b></div>
                <div style="font-size:12px; color:#606266;">{{ row.new_garment_code }}</div>
                <div style="font-size:12px; color:#606266;">{{ row.new_area_name || row.original_area_name || '-' }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="operator_name" label="操作人" width="100" />
        <el-table-column prop="swap_time" label="调换时间" width="170" />
        <el-table-column prop="swap_reason" label="调换原因" min-width="180" show-overflow-tooltip />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="$router.push(`/hanging/${row.original_hang_id}`)">查看挂装</el-button>
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
import { ref, reactive, onMounted } from 'vue'
import { Search, Refresh, Right } from '@element-plus/icons-vue'
import { getSwapRecordsApi } from '@/api'

const loading = ref(false)
const tableData = ref([])
const total = ref(0)
const dateRange = ref([])
const filters = reactive({ page: 1, pageSize: 20, keyword: '', startDate: '', endDate: '' })

async function loadData(page) {
  if (page) filters.page = page
  const [sd, ed] = dateRange.value || [null, null]
  filters.startDate = sd || ''
  filters.endDate = ed || ''
  loading.value = true
  try {
    const res = await getSwapRecordsApi(filters)
    tableData.value = res.data
    total.value = res.total
  } finally { loading.value = false }
}

function resetFilters() {
  Object.assign(filters, { page: 1, keyword: '' })
  dateRange.value = []
  loadData()
}

onMounted(loadData)
</script>
