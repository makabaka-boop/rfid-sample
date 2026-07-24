import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { public: true }
  },
  {
    path: '/',
    component: () => import('@/views/Layout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '流转概览', icon: 'DataAnalysis' }
      },
      {
        path: 'slot-board',
        name: 'SlotBoard',
        component: () => import('@/views/SlotBoard.vue'),
        meta: { title: '库位占用看板', icon: 'Grid' }
      },
      {
        path: 'garments',
        name: 'Garments',
        component: () => import('@/views/Garments.vue'),
        meta: { title: '样衣档案', icon: 'CollectionTag' }
      },
      {
        path: 'hanging-records',
        name: 'HangingRecords',
        component: () => import('@/views/HangingRecords.vue'),
        meta: { title: '挂装记录', icon: 'Tickets' }
      },
      {
        path: 'hanging/:id',
        name: 'HangingDetail',
        component: () => import('@/views/HangingDetail.vue'),
        meta: { title: '挂牌详情', hidden: true }
      },
      {
        path: 'recovery',
        name: 'Recovery',
        component: () => import('@/views/Recovery.vue'),
        meta: { title: '回收确认', icon: 'RefreshLeft' }
      },
      {
        path: 'swap-records',
        name: 'SwapRecords',
        component: () => import('@/views/SwapRecords.vue'),
        meta: { title: '调换记录', icon: 'Switch' }
      },
      {
        path: 'missing-parts',
        name: 'MissingParts',
        component: () => import('@/views/MissingParts.vue'),
        meta: { title: '缺件说明', icon: 'Warning' }
      },
      {
        path: 'anomaly-tickets',
        name: 'AnomalyTickets',
        component: () => import('@/views/AnomalyTickets.vue'),
        meta: { title: '异常处置单', icon: 'CircleCheck' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  if (to.meta.public) {
    if (auth.isLoggedIn && to.path === '/login') {
      next('/')
    } else {
      next()
    }
  } else {
    if (auth.isLoggedIn) {
      next()
    } else {
      next('/login')
    }
  }
})

export default router
