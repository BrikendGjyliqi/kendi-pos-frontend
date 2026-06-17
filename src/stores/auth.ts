import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api/client'

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

  /** Restore session from sessionStorage */
  async function restore(): Promise<boolean> {
    const raw = sessionStorage.getItem(AUTH_KEY)
    if (!raw) return false

    try {
      const session = JSON.parse(raw) as { staffId: string }
      const staff = await api.get<Staff>(`/staff/${session.staffId}`)
      if (staff && staff.active) {
        currentStaff.value = staff
        return true
      }
    } catch {
      // skip
    }
    sessionStorage.removeItem(AUTH_KEY)
    return false
  }

  /** Login with 4-digit PIN against backend */
  async function loginWithPin(pin: string): Promise<boolean> {
    error.value = null
    loading.value = true
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
      return true
    } catch (e: any) {
      error.value = 'PIN i pasaktë'
      return false
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