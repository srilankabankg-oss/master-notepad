import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/subcontractors' },
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
      path: '/surveys',
      name: 'surveys',
      component: () => import('@/views/SurveysView.vue'),
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
  ],
})

export default router
