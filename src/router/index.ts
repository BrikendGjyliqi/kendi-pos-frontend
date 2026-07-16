import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { public: true }
    },
    {
      path: '/tables',
      name: 'tables',
      component: () => import('../views/TablesView.vue')
    },
    {
      path: '/pos',
      name: 'pos',
      component: () => import('../views/PosView.vue')
    },
    {
      path: '/admin',
      component: () => import('../views/admin/AdminLayout.vue'),
      meta: { admin: true },
      children: [
        {
          path: '',
          redirect: '/admin/menu'
        },
        {
          path: 'menu',
          name: 'admin-menu',
          component: () => import('../views/admin/MenuView.vue')
        },
        {
          path: 'manage-tables',
          name: 'admin-manage-tables',
          component: () => import('../views/admin/ManageTablesView.vue')
        },
        {
          path: 'reservations',
          name: 'admin-reservations',
          component: () => import('../views/admin/ReservationsView.vue')
        },
        {
          path: 'reservations-history',
          name: 'admin-reservations-history',
          component: () => import('../views/admin/ReservationsHistoryView.vue')
        },
        {
          path: 'stock',
          name: 'admin-stock',
          component: () => import('../views/admin/StockView.vue')
        },
        {
          path: 'suppliers',
          name: 'admin-suppliers',
          component: () => import('../views/admin/SuppliersView.vue')
        },
        {
          path: 'staff',
          name: 'admin-staff',
          component: () => import('../views/admin/StaffView.vue')
        },
        {
          path: 'settings',
          name: 'admin-settings',
          component: () => import('../views/admin/SettingsView.vue')
        },
        {
          path: 'history',
          name: 'admin-history',
          component: () => import('../views/admin/OrderHistoryView.vue')
        },
        {
          path: 'delivery-history',
          name: 'admin-delivery-history',
          component: () => import('../views/admin/DeliveryHistoryView.vue')
        },
        {
          path: 'reports',
          name: 'admin-reports',
          component: () => import('../views/admin/ReportsView.vue')
        },
        {
          path: 'staff-report',
          name: 'admin-staff-report',
          component: () => import('../views/admin/StaffReportView.vue')
        }
      ]
    },
    // Catch-all redirect
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

// ─── Auth guards ───
router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Public routes always allowed
  if (to.meta.public) {
    // If already logged in, redirect to tables
    if (auth.isAuthenticated && to.name === 'login') {
      return { name: 'tables' }
    }
    return true
  }

  // Try to restore session if not authenticated
  if (!auth.isAuthenticated) {
    await auth.restore()
  }

  // Still not authenticated → login
  if (!auth.isAuthenticated) {
    return { name: 'login' }
  }

  // Admin-only routes
  if (to.meta.admin && !auth.isAdmin) {
    return { name: 'tables' }
  }

  return true
})

export default router