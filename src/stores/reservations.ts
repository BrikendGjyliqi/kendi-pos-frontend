import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api/client'

export type ReservationStatus =
  | 'PENDING_REQUEST'
  | 'CONFIRMED'
  | 'ARRIVED'
  | 'NO_SHOW'
  | 'CANCELLED'
  | 'DECLINED'

export type Reservation = {
  id: string
  tableId: string
  tableName: string
  guestName: string
  guestPhone: string | null
  guestCount: number
  reservationTime: string
  status: ReservationStatus
  requestedBy: string | null
  confirmedAt: string | null
  arrivedAt: string | null
  noShowAt: string | null
  createdAt: string
}

type BackendReservation = {
  id: number
  tableId: number
  tableName: string
  guestName: string
  guestPhone: string | null
  guestCount: number
  reservationTime: string
  status: ReservationStatus
  requestedBy: string | null
  confirmedAt: string | null
  arrivedAt: string | null
  noShowAt: string | null
  createdAt: string
}

function fromBackend(r: BackendReservation): Reservation {
  return {
    id: String(r.id),
    tableId: String(r.tableId),
    tableName: r.tableName,
    guestName: r.guestName,
    guestPhone: r.guestPhone,
    guestCount: r.guestCount,
    reservationTime: r.reservationTime,
    status: r.status,
    requestedBy: r.requestedBy,
    confirmedAt: r.confirmedAt,
    arrivedAt: r.arrivedAt,
    noShowAt: r.noShowAt,
    createdAt: r.createdAt
  }
}

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

  // Filter per status
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

  async function load() {
    if (loaded.value) return
    await reload()
    loaded.value = true
  }

  async function reload() {
    const raw = await api.get<BackendReservation[]>('/reservations')
    reservations.value = raw.map(fromBackend)
    await loadStats()
  }

  async function loadStats() {
    try {
      stats.value = await api.get<ReservationStats>('/reservations/stats/today')
    } catch {
      // silent
    }
  }

  // Kamarier krijoi kerkese
  async function createRequest(data: {
    tableId: string
    guestName: string
    guestPhone?: string
    guestCount: number
    reservationTime: string
    requestedBy?: string
  }): Promise<Reservation> {
    const raw = await api.post<BackendReservation>('/reservations/requests', {
      tableId: Number(data.tableId),
      guestName: data.guestName.trim(),
      guestPhone: data.guestPhone || null,
      guestCount: data.guestCount,
      reservationTime: data.reservationTime,
      requestedBy: data.requestedBy || null
    })
    const newRes = fromBackend(raw)
    reservations.value.push(newRes)
    return newRes
  }

  // Admin veprime
  async function confirm(id: string): Promise<Reservation> {
    const raw = await api.patch<BackendReservation>(`/reservations/${id}/confirm`)
    return updateInList(raw)
  }

  async function decline(id: string): Promise<Reservation> {
    const raw = await api.patch<BackendReservation>(`/reservations/${id}/decline`)
    return updateInList(raw)
  }

  async function markArrived(id: string): Promise<Reservation> {
    const raw = await api.patch<BackendReservation>(`/reservations/${id}/arrived`)
    return updateInList(raw)
  }

  async function markNoShow(id: string): Promise<Reservation> {
    const raw = await api.patch<BackendReservation>(`/reservations/${id}/no-show`)
    return updateInList(raw)
  }

  function updateInList(raw: BackendReservation): Reservation {
    const updated = fromBackend(raw)
    const idx = reservations.value.findIndex(r => r.id === updated.id)
    if (idx >= 0) reservations.value[idx] = updated
    else reservations.value.push(updated)
    return updated
  }

  // Historik
async function loadHistory(status?: string, from?: string, to?: string): Promise<Reservation[]> {
  const params = new URLSearchParams()
  if (status) params.append('status', status)
  if (from) params.append('from', from)
  if (to) params.append('to', to)
  
  const query = params.toString() ? '?' + params.toString() : ''
  const raw = await api.get<BackendReservation[]>('/reservations/history' + query)
  return raw.map(fromBackend)
}

async function loadRangeStats(from: string, to: string) {
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