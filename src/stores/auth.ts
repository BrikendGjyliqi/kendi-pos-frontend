import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api/client'
import * as staffRepo from '../db/staffRepo'

const AUTH_KEY = 'kendi.auth.session'

type Staff = {
  id: string
  name: string
  role: string
  active: boolean
  createdAt: number
}

type LoginResponse = {
  token: string
  staffId: string
  name: string
  role: string
}

export const useAuthStore = defineStore('auth', () => {
  const currentStaff = ref<Staff | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => currentStaff.value !== null)
  const isAdmin = computed(() => currentStaff.value?.role === 'admin')

  /**
   * Restore session nga sessionStorage.
   * Se pari provo backend, nese deshton perdor cache lokal.
   */
  async function restore(): Promise<boolean> {
    const raw = sessionStorage.getItem(AUTH_KEY)
    if (!raw) return false

    try {
      const session = JSON.parse(raw) as { staffId: string }

      // Se pari provo backend
      try {
        const staff = await api.get<Staff>(`/staff/${session.staffId}`)
        if (staff && staff.active) {
          currentStaff.value = staff
          return true
        }
      } catch {
        // Backend deshton - provo cache lokal
        console.log('[Auth] Backend unavailable, restoring from local cache')
        const cached = await staffRepo.getById(session.staffId)
        if (cached) {
          currentStaff.value = cached
          return true
        }
      }
    } catch {
      // skip
    }
    sessionStorage.removeItem(AUTH_KEY)
    return false
  }

  /**
   * Login me PIN.
   * Se pari provo backend, nese deshton provo cache lokal me BCrypt.
   */
  async function loginWithPin(pin: string): Promise<boolean> {
    error.value = null
    loading.value = true
    try {
      // ─────────────────────────────────────────
      // Provo backend se pari (online path)
      // ─────────────────────────────────────────
      try {
        const res = await api.post<LoginResponse>('/auth/login', { pin })

        currentStaff.value = {
          id: res.staffId,
          name: res.name,
          role: res.role,
          active: true,
          createdAt: Date.now()
        }
        sessionStorage.setItem(AUTH_KEY, JSON.stringify({
          token: res.token,
          staffId: res.staffId
        }))

        // Pas login te suksesshem, sync staff cache per offline use
        staffRepo.syncFromBackend().catch(err =>
          console.warn('[Auth] Cache sync failed:', err)
        )

        console.log(`[Auth] Online login succeeded for ${res.name}`)
        return true
      } catch (backendErr: any) {
        // Backend deshton - provo cache lokal
        console.log('[Auth] Backend unavailable, trying local cache...')

        const hasCache = await staffRepo.hasLocalCache()
        if (!hasCache) {
          error.value = 'Nuk ka lidhje me serverin dhe nuk ka cache lokal'
          return false
        }

        const staff = await staffRepo.validatePinLocally(pin)
        if (staff) {
          currentStaff.value = staff
          sessionStorage.setItem(AUTH_KEY, JSON.stringify({
            token: 'offline',
            staffId: staff.id
          }))
          console.log(`[Auth] Offline login succeeded for ${staff.name}`)
          return true
        } else {
          error.value = 'PIN i pasaktë'
          return false
        }
      }
    } finally {
      loading.value = false
    }
  }

  function logout() {
    currentStaff.value = null
    sessionStorage.removeItem(AUTH_KEY)
  }

  return {
    currentStaff,
    loading,
    error,
    isAuthenticated,
    isAdmin,
    restore,
    loginWithPin,
    logout
  }
})