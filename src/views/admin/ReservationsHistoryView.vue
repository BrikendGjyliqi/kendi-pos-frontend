<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Search, Download, TrendingUp, TrendingDown, Phone, Armchair, Filter } from 'lucide-vue-next'
import { useReservationsStore, type Reservation, type RangeStats } from '../../stores/reservations'

const reservationsStore = useReservationsStore()

const reservations = ref<Reservation[]>([])
const stats = ref<RangeStats | null>(null)
const loading = ref(false)
const search = ref('')

// Date filters
const today = new Date().toISOString().split('T')[0]
const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

const fromDate = ref(monthAgo)
const toDate = ref(today)
const statusFilter = ref<'ALL' | 'ARRIVED' | 'NO_SHOW' | 'DECLINED' | 'CANCELLED'>('ALL')
const sortOrder = ref<'newest' | 'oldest'>('newest')

// Quick presets
type Preset = 'today' | 'week' | 'month' | 'custom'
const activePreset = ref<Preset>('month')

function applyPreset(preset: Preset) {
  activePreset.value = preset
  const now = new Date()
  if (preset === 'today') {
    fromDate.value = now.toISOString().split('T')[0]
    toDate.value = now.toISOString().split('T')[0]
  } else if (preset === 'week') {
    fromDate.value = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    toDate.value = now.toISOString().split('T')[0]
  } else if (preset === 'month') {
    fromDate.value = monthAgo
    toDate.value = today
  }
}

async function loadData() {
  loading.value = true
  try {
    const [historyData, statsData] = await Promise.all([
      reservationsStore.loadHistory(statusFilter.value, fromDate.value, toDate.value),
      reservationsStore.loadRangeStats(fromDate.value, toDate.value)
    ])
    reservations.value = historyData
    stats.value = statsData
  } catch (e) {
    console.error('Failed to load history:', e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})

watch([fromDate, toDate, statusFilter], () => {
  activePreset.value = 'custom'
  loadData()
})

// Filter dhe sort ne frontend
const filteredReservations = computed(() => {
  let list = [...reservations.value]

  // Search
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    list = list.filter(r =>
      r.guestName.toLowerCase().includes(q) ||
      r.guestPhone?.toLowerCase().includes(q) ||
      r.tableName.toLowerCase().includes(q)
    )
  }

  // Sort
  list.sort((a, b) => {
    const dA = new Date(a.reservationTime).getTime()
    const dB = new Date(b.reservationTime).getTime()
    return sortOrder.value === 'newest' ? dB - dA : dA - dB
  })

  return list
})

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function statusLabel(status: string): string {
  switch (status) {
    case 'ARRIVED': return 'Arrived'
    case 'NO_SHOW': return 'No-show'
    case 'DECLINED': return 'Declined'
    case 'CANCELLED': return 'Cancelled'
    default: return status
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'ARRIVED': return '#9CB89C'
    case 'NO_SHOW': return '#E8B896'
    case 'DECLINED': return '#B4A5D0'
    case 'CANCELLED': return 'rgba(232, 228, 216, 0.5)'
    default: return '#E8E4D8'
  }
}

// Export si CSV
function exportCsv() {
  const headers = ['Date', 'Time', 'Guest', 'Phone', 'Table', 'Seats', 'Status', 'Requested by']
  const rows = filteredReservations.value.map(r => [
    formatDate(r.reservationTime),
    formatTime(r.reservationTime),
    r.guestName,
    r.guestPhone || '',
    r.tableName,
    String(r.guestCount),
    statusLabel(r.status),
    r.requestedBy || ''
  ])
  
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `reservations_${fromDate.value}_${toDate.value}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="history-view">
    <!-- Header -->
    <header class="head">
      <div class="head-left">
        <h1>Reservations history</h1>
        <p class="subtitle" v-if="stats">
          {{ formatDate(fromDate + 'T00:00:00') }} — {{ formatDate(toDate + 'T00:00:00') }} ·
          {{ reservations.length }} records
        </p>
      </div>
      <button class="btn-secondary" @click="exportCsv" :disabled="filteredReservations.length === 0">
        <Download :size="14" />
        Export CSV
      </button>
    </header>

    <!-- Stats cards -->
    <div v-if="stats" class="stats-grid">
      <div class="stat-card stat-primary">
        <div class="stat-header">
          <span class="stat-label">Show-up rate</span>
          <TrendingUp v-if="stats.showUpRate >= 70" :size="14" class="stat-trend stat-trend-up" />
          <TrendingDown v-else :size="14" class="stat-trend stat-trend-down" />
        </div>
        <p class="stat-value stat-value-lg">{{ Math.round(stats.showUpRate) }}%</p>
        <p class="stat-hint">
          {{ stats.arrived }} of {{ stats.arrived + stats.noShow }} confirmed
        </p>
      </div>

      <div class="stat-card">
        <span class="stat-label">Arrived</span>
        <p class="stat-value stat-arrived">{{ stats.arrived }}</p>
      </div>

      <div class="stat-card">
        <span class="stat-label">No-shows</span>
        <p class="stat-value stat-noshow">{{ stats.noShow }}</p>
      </div>

      <div class="stat-card">
        <span class="stat-label">Declined</span>
        <p class="stat-value stat-declined">{{ stats.declined }}</p>
      </div>

      <div class="stat-card">
        <span class="stat-label">Cancelled</span>
        <p class="stat-value stat-cancelled">{{ stats.cancelled }}</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <!-- Date presets -->
      <div class="filter-group">
        <label>Period</label>
        <div class="segmented">
          <button :class="{ active: activePreset === 'today' }" @click="applyPreset('today')">Today</button>
          <button :class="{ active: activePreset === 'week' }" @click="applyPreset('week')">Last 7 days</button>
          <button :class="{ active: activePreset === 'month' }" @click="applyPreset('month')">Last 30 days</button>
        </div>
      </div>

      <!-- Custom date range -->
      <div class="filter-group">
        <label>Custom range</label>
        <div class="date-range">
          <input v-model="fromDate" type="date" />
          <span class="date-sep">to</span>
          <input v-model="toDate" type="date" />
        </div>
      </div>

      <!-- Status filter -->
      <div class="filter-group">
        <label>Status</label>
        <select v-model="statusFilter">
          <option value="ALL">All statuses</option>
          <option value="ARRIVED">Arrived</option>
          <option value="NO_SHOW">No-show</option>
          <option value="DECLINED">Declined</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <!-- Sort -->
      <div class="filter-group">
        <label>Sort</label>
        <select v-model="sortOrder">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      <!-- Search -->
      <div class="filter-group filter-search">
        <label>Search</label>
        <div class="search-box">
          <Search :size="14" />
          <input v-model="search" type="text" placeholder="Guest name, phone or table..." />
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="loading">
      <p>Loading reservations...</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="filteredReservations.length === 0" class="empty-state">
      <Filter :size="24" />
      <p>No reservations found for these filters</p>
    </div>

    <!-- Reservations list -->
    <div v-else class="list">
      <div v-for="res in filteredReservations" :key="res.id" class="row">
        <div class="date-col">
          <p class="date">{{ formatDate(res.reservationTime) }}</p>
          <p class="time">{{ formatTime(res.reservationTime) }}</p>
        </div>

        <div class="divider"></div>

        <div class="guest">
          <p class="guest-name">{{ res.guestName }}</p>
          <p v-if="res.guestPhone" class="guest-phone">
            <Phone :size="11" /> {{ res.guestPhone }}
          </p>
        </div>

        <div class="table-info">
          <Armchair :size="13" />
          <span>{{ res.tableName }} · {{ res.guestCount }} seats</span>
        </div>

        <div v-if="res.requestedBy" class="requested-by">
          by {{ res.requestedBy }}
        </div>

        <div class="status-col">
          <span
            class="status-badge"
            :style="{
              background: statusColor(res.status) + '20',
              color: statusColor(res.status),
              borderColor: statusColor(res.status) + '40'
            }"
          >
            {{ statusLabel(res.status) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-view {
  background: #16161A;
  min-height: 100vh;
  padding: 24px 28px;
  color: #E8E4D8;
}

/* Header */
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  gap: 16px;
}

.head-left h1 {
  margin: 0 0 6px 0;
  font-size: 24px;
  font-weight: 500;
  letter-spacing: -0.01em;
}

.subtitle {
  margin: 0;
  font-size: 13px;
  color: rgba(232, 228, 216, 0.55);
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 14px;
  font-size: 13px;
  background: transparent;
  color: #E8E4D8;
  border: 0.5px solid rgba(232, 228, 216, 0.2);
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s ease;
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(232, 228, 216, 0.05);
}

.btn-secondary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr 1fr 1fr;
  gap: 12px;
  margin-bottom: 24px;
}

.stat-card {
  background: rgba(232, 228, 216, 0.03);
  border: 0.5px solid rgba(232, 228, 216, 0.08);
  border-radius: 10px;
  padding: 14px 16px;
}

.stat-primary {
  background: rgba(156, 184, 156, 0.08);
  border-color: rgba(156, 184, 156, 0.25);
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.stat-label {
  font-size: 11px;
  color: rgba(232, 228, 216, 0.55);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.stat-trend-up {
  color: #9CB89C;
}

.stat-trend-down {
  color: #E8B896;
}

.stat-value {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.stat-value-lg {
  font-size: 32px;
  color: #9CB89C;
  margin: 4px 0 4px 0;
}

.stat-hint {
  margin: 0;
  font-size: 11px;
  color: rgba(232, 228, 216, 0.5);
}

.stat-arrived { color: #9CB89C; }
.stat-noshow { color: #E8B896; }
.stat-declined { color: #B4A5D0; }
.stat-cancelled { color: rgba(232, 228, 216, 0.5); }

/* Filters */
.filters {
  display: grid;
  grid-template-columns: auto 1fr auto auto 2fr;
  gap: 12px;
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(232, 228, 216, 0.02);
  border: 0.5px solid rgba(232, 228, 216, 0.08);
  border-radius: 12px;
}

.filter-group label {
  display: block;
  font-size: 11px;
  color: rgba(232, 228, 216, 0.55);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.segmented {
  display: inline-flex;
  gap: 3px;
  background: rgba(232, 228, 216, 0.05);
  padding: 3px;
  border-radius: 8px;
}

.segmented button {
  padding: 6px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  color: rgba(232, 228, 216, 0.6);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.segmented button.active {
  background: #9CB89C;
  color: #16161A;
  font-weight: 500;
}

.segmented button:not(.active):hover {
  color: #E8E4D8;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 6px;
}

.date-range input {
  background: rgba(232, 228, 216, 0.05);
  border: 0.5px solid rgba(232, 228, 216, 0.15);
  border-radius: 6px;
  padding: 6px 10px;
  color: #E8E4D8;
  font-size: 12px;
  font-family: inherit;
}

.date-range input:focus {
  outline: none;
  border-color: #9CB89C;
}

.date-sep {
  color: rgba(232, 228, 216, 0.4);
  font-size: 11px;
}

.filter-group select {
  background: rgba(232, 228, 216, 0.05);
  border: 0.5px solid rgba(232, 228, 216, 0.15);
  border-radius: 6px;
  padding: 7px 10px;
  color: #E8E4D8;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23E8E4D8' stroke-width='2' stroke-linecap='round'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 12px;
  padding-right: 30px;
}

.filter-group select option {
  background: #16161A;
  color: #E8E4D8;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(232, 228, 216, 0.05);
  border: 0.5px solid rgba(232, 228, 216, 0.15);
  border-radius: 6px;
  padding: 6px 10px;
  color: rgba(232, 228, 216, 0.5);
}

.search-box:focus-within {
  border-color: #9CB89C;
  color: #E8E4D8;
}

.search-box input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #E8E4D8;
  font-size: 12px;
  font-family: inherit;
}

/* List */
.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  background: rgba(232, 228, 216, 0.02);
  border: 0.5px solid rgba(232, 228, 216, 0.06);
  border-radius: 10px;
  transition: background 0.15s ease;
}

.row:hover {
  background: rgba(232, 228, 216, 0.04);
}

.date-col {
  min-width: 90px;
}

.date {
  margin: 0;
  font-size: 13px;
  color: #E8E4D8;
  font-weight: 500;
}

.time {
  margin: 2px 0 0 0;
  font-size: 11px;
  color: rgba(232, 228, 216, 0.55);
}

.divider {
  width: 1px;
  height: 32px;
  background: rgba(232, 228, 216, 0.08);
}

.guest {
  flex: 1;
  min-width: 0;
}

.guest-name {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: #E8E4D8;
}

.guest-phone {
  margin: 2px 0 0 0;
  font-size: 11px;
  color: rgba(232, 228, 216, 0.55);
  display: flex;
  align-items: center;
  gap: 4px;
}

.guest-phone svg {
  vertical-align: -1px;
}

.table-info {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(232, 228, 216, 0.05);
  border-radius: 6px;
  color: rgba(232, 228, 216, 0.75);
  font-size: 12px;
  flex-shrink: 0;
}

.requested-by {
  font-size: 11px;
  color: rgba(232, 228, 216, 0.4);
  font-style: italic;
  min-width: 100px;
}

.status-col {
  flex-shrink: 0;
}

.status-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  border: 0.5px solid;
  letter-spacing: 0.3px;
}

/* Loading & Empty */
.loading, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 12px;
  color: rgba(232, 228, 216, 0.5);
}

.loading p, .empty-state p {
  margin: 0;
  font-size: 14px;
}

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }

  .filters {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 720px) {
  .history-view {
    padding: 16px;
  }

  .row {
    flex-wrap: wrap;
  }
}
</style>