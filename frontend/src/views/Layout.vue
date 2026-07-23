<template>
  <el-container class="layout-container">
    <el-aside :width="collapsed ? '64px' : '220px'">
      <div style="padding: 18px 0; text-align:center; color:#fff; font-size:16px; font-weight:600; border-bottom:1px solid #1f2d3d;">
        <span v-if="!collapsed">RFID样衣流转</span>
        <span v-else>样衣</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#001529"
        text-color="#b7bdc6"
        active-text-color="#fff"
        :collapse="collapsed"
      >
        <el-menu-item v-for="r in menuRoutes" :key="r.path" :index="'/'+r.path">
          <el-icon><component :is="r.meta.icon" /></el-icon>
          <template #title>{{ r.meta.title }}</template>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header>
        <div class="flex-between" style="width:100%;">
          <div style="display:flex; align-items:center; gap:16px;">
            <el-icon size="20" style="cursor:pointer;" @click="collapsed = !collapsed">
              <Fold v-if="!collapsed" /><Expand v-else />
            </el-icon>
            <span class="system-title">{{ pageTitle }}</span>
          </div>
          <div class="user-info">
            <el-tag type="info" size="small">{{ auth.user?.role === 'admin' ? '管理员' : '操作员' }}</el-tag>
            <el-dropdown @command="handleCommand">
              <span style="cursor:pointer; display:flex; align-items:center; gap:6px;">
                <el-avatar :size="30" style="background:#409eff;">{{ auth.user?.realName?.charAt(0) }}</el-avatar>
                <span>{{ auth.user?.realName }}</span>
                <el-icon><ArrowDown /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="logout">退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </el-header>
      <el-main style="padding:0; overflow:auto;">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Fold, Expand, ArrowDown } from '@element-plus/icons-vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const collapsed = ref(false)

const layoutRoutes = router.options.routes.find(r => r.path === '/').children.filter(c => !c.meta?.hidden)
const menuRoutes = layoutRoutes

const activeMenu = computed(() => route.path)
const pageTitle = computed(() => route.meta?.title || '')

function handleCommand(cmd) {
  if (cmd === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', { type: 'warning' }).then(() => {
      auth.logout()
      ElMessage.success('已退出')
      router.push('/login')
    }).catch(() => {})
  }
}
</script>
