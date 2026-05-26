import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const publicRoutes = ['/login', '/register']
const enableAI = import.meta.env.VITE_ENABLE_AI !== 'false'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/subcontractors' },
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },
    { path: '/register', name: 'register', component: () => import('@/views/RegisterView.vue') },
    {
      path: '/subcontractors',
      name: 'subcontractors',
      component: () => import('@/views/SubcontractorsView.vue'),
    },
    {
      path: '/subcontractors/:id',
      name: 'subcontractor-detail',
      component: () => import('@/views/SubcontractorDetail.vue'),
    },
    {
      path: '/reviews',
      name: 'reviews',
      component: () => import('@/views/ReviewsView.vue'),
    },
    {
      path: '/checklists',
      name: 'checklists',
      component: () => import('@/views/ChecklistsView.vue'),
    },
    {
      path: '/meetings',
      name: 'meetings',
      component: () => import('@/views/MeetingsView.vue'),
    },
    {
      path: '/meetings/:id',
      name: 'meeting-detail',
      component: () => import('@/views/MeetingDetailView.vue'),
    },
    {
      path: '/surveys',
      name: 'surveys',
      component: () => import('@/views/SurveysView.vue'),
    },
    {
path: '/tender',
    name: 'tender-select',
    component: () => import('@/views/TenderSelectView.vue'),
  },
  {
    path: '/tender/:id',
    name: 'tender-summary',
    component: () => import('@/views/TenderSummaryView.vue'),
  },
    {
      path: '/employees',
      name: 'employees',
      component: () => import('@/views/EmployeesView.vue'),
    },
    {
      path: '/suggestions',
      name: 'suggestions',
      component: () => import('@/views/SuggestionsView.vue'),
    },
    {
      path: '/events',
      name: 'events',
      component: () => import('@/views/EventsView.vue'),
    },
    {
      path: '/tasks',
      name: 'tasks',
      component: () => import('@/views/TasksView.vue'),
    },
    {
      path: '/tasks/:id',
      name: 'task-detail',
      component: () => import('@/views/TasksView.vue'),
    },
    ...(enableAI ? [{
      path: '/chat',
      name: 'chat',
      component: () => import('@/views/ChatView.vue'),
    }] : []),
    {
      path: '/audit-log',
      name: 'audit-log',
      component: () => import('@/views/AuditLogView.vue'),
    },
  ],
})

router.beforeEach(async (to, _from, next) => {
  const auth = useAuthStore()
  if (!auth.user) {
    await auth.fetchMe()
  }
  if (!auth.isAuthenticated && !publicRoutes.includes(to.path)) {
    next('/login')
  } else if (auth.isAuthenticated && publicRoutes.includes(to.path)) {
    next('/subcontractors')
  } else {
    next()
  }
})

export default router
