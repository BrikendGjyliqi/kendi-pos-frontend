import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api/client'
import * as reservationsRepo from '../db/reservationsRepo'

export type ReservationStatus = reservationsRepo.ReservationStatus
export type Reservation = reservationsRepo.Reservation

export type ReservationStats = {
  arrivedToday: number
  noShowToday: number
  upcomingToday: number
  showUpRate: number
}

export type RangeStats = {
  arrived: number
  noShow: number
  declined: number
  cancelled: number
  confirmed: number
  showUpRate: number
  fromDate: string
  toDate: string
}

export const useReservationsStore = defineStore('reservations', () => {
  const reservations = ref<Reservation[]>([])
  const stats = ref<ReservationStats>({
    arrivedToday: 0,
    noShowToday: 0,
    upcomingToday: 0,
    showUpRate: 0
  })
  const loaded = ref(false)

  const pending = computed(() =>
    reservations.value.filter(r => r.status === 'PENDING_REQUEST')
  )

  const confirmed = computed(() =>
    reservations.value
      .filter(r => r.status === 'CONFIRMED')
      .sort((a, b) => new Date(a.reservationTime).getTime() - new Date(b.reservationTime).getTime())
  )

  const pendingCount = computed(() => pending.value.length)
  const confirmedCount = computed(() => confirmed.value.length)

  // ─────────────────────────────────────────────────────────
  // OFFLINE-FIRST: Load nga SQLite + sync ne background
  // ─────────────────────────────────────────────────────────
  async function load() {
    if (loaded.value) return
    const repoData = await reservationsRepo.getAll()
    reservations.value = repoData
    loaded.value = true
    console.log(`[Reservations Store] Loaded ${reservations.value.length} reservations (offline-first)`)

    // Auto-refresh ne background
    setTimeout(async () => {
      try {
        const fresh = await reservationsRepo.refresh()
        reservations.value = fresh
        await loadStats()
      } catch {
        // silent - offline
      }
    }, 1000)
  }

  async function reload() {
    const fresh = await reservationsRepo.refresh()
    reservations.value = fresh
    await loadStats()
  }

  async function loadStats() {
    // Stats vetem online - llogaritja backend
    try {
      stats.value = await api.get<ReservationStats>('/reservations/stats/today')
    } catch {
      // silent - kur backend jonpe, stats mbeten njesoj
    }
  }

  // ─────────────────────────────────────────────────────────
  // Kamerier krijoi kerkese
  // ─────────────────────────────────────────────────────────
  async function createRequest(data: {
    tableId: string
    guestName: string
    guestPhone?: string
    guestCount: number
    reservationTime: string
    requestedBy?: string
  }): Promise<Reservation> {
    const newRes = await reservationsRepo.createRequest({
      tableId: data.tableId,
      guestName: data.guestName,
      guestPhone: data.guestPhone ?? null,
      guestCount: data.guestCount,
      reservationTime: data.reservationTime,
      requestedBy: data.requestedBy ?? null
    })

    // Update in-memory list
    const idx = reservations.value.findIndex(r => r.id === newRes.id)
    if (idx >= 0) reservations.value[idx] = newRes
    else reservations.value.push(newRes)

    return newRes
  }

  // ─────────────────────────────────────────────────────────
  // Admin actions
  // ─────────────────────────────────────────────────────────
  async function confirm(id: string): Promise<Reservation | null> {
    const updated = await reservationsRepo.confirm(id)
    if (!updated) return null
    updateInList(updated)
    return updated
  }

  async function decline(id: string): Promise<Reservation | null> {
    const updated = await reservationsRepo.decline(id)
    if (!updated) return null
    updateInList(updated)
    return updated
  }

  async function markArrived(id: string): Promise<Reservation | null> {
    const updated = await reservationsRepo.markArrived(id)
    if (!updated) return null
    updateInList(updated)
    return updated
  }

  async function markNoShow(id: string): Promise<Reservation | null> {
    const updated = await reservationsRepo.markNoShow(id)
    if (!updated) return null
    updateInList(updated)
    return updated
  }

  function updateInList(updated: Reservation): void {
    const idx = reservations.value.findIndex(r => r.id === updated.id)
    if (idx >= 0) reservations.value[idx] = updated
    else reservations.value.push(updated)
  }

  // ─────────────────────────────────────────────────────────
  // History dhe stats - vetem online (analytics)
  // ─────────────────────────────────────────────────────────
  async function loadHistory(status?: string, from?: string, to?: string): Promise<Reservation[]> {
    const params = new URLSearchParams()
    if (status) params.append('status', status)
    if (from) params.append('from', from)
    if (to) params.append('to', to)
    
    const query = params.toString() ? '?' + params.toString() : ''
    return await api.get<Reservation[]>('/reservations/history' + query)
  }

  async function loadRangeStats(from: string, to: string): Promise<RangeStats> {
    return await api.get<RangeStats>(`/reservations/stats/range?from=${from}&to=${to}`)
  }

  return {
    reservations,
    stats,
    pending,
    confirmed,
    pendingCount,
    confirmedCount,
    loaded,
    load,
    reload,
    loadStats,
    createRequest,
    confirm,
    decline,
    markArrived,
    markNoShow,
    loadHistory,
    loadRangeStats
  }
})