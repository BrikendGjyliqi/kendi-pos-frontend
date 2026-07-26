import { ref, computed } from 'vue'

export type SyncStatus = 'online' | 'offline' | 'syncing'

// Reactive state — mund te perdoret ne cdo component
export const syncStatus = ref<SyncStatus>('offline')
export const pendingCount = ref(0)
export const lastSyncAt = ref<number | null>(null)
export const lastError = ref<string | null>(null)

// Computed
export const isOnline = computed(() => syncStatus.value === 'online')
export const isOffline = computed(() => syncStatus.value === 'offline')
export const isSyncing = computed(() => syncStatus.value === 'syncing')
export const hasPending = computed(() => pendingCount.value > 0)

// Helpers per debug ne console
if (typeof window !== 'undefined') {
  ;(window as any).__syncState = {
    syncStatus,
    pendingCount,
    lastSyncAt,
    lastError
  }
}