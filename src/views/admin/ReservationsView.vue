<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Plus } from 'lucide-vue-next'
import { useReservationsStore } from '../../stores/reservations'
import { useAuthStore } from '../../stores/auth'
import PendingRequestsPanel from '../../components/reservations/PendingRequestsPanel.vue'
import ConfirmedReservationsList from '../../components/reservations/ConfirmedReservationsList.vue'
import RequestReservationModal from '../../components/reservations/RequestReservationModal.vue'

const reservationsStore = useReservationsStore()
const auth = useAuthStore()

const activeTab = ref<'today' | 'tomorrow' | 'week'>('today')
const showRequestModal = ref(false)
const errorMsg = ref<string | null>(null)

onMounted(async () => {
  await reservationsStore.reload()
})

const stats = computed(() => reservationsStore.stats)

// Filter confirmed sipas tab
const filteredConfirmed = computed(() => {
  const all = reservationsStore.confirmed
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)
  const endOfTomorrow = new Date(startOfTomorrow.getTime() + 24 * 60 * 60 * 1000)
  const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000)

  return all.filter(r => {
    const t = new Date(r.reservationTime)
    if (activeTab.value === 'today') return t >= startOfToday && t < startOfTomorrow
    if (activeTab.value === 'tomorrow') return t >= startOfTomorrow && t < endOfTomorrow
    return t >= startOfToday && t < endOfWeek
  })
})

// ─── Actions ───
async function handleConfirm(id: string) {
  errorMsg.value = null
  try {
    await reservationsStore.confirm(id)
    await reservationsStore.loadStats()
  } catch (e: any) {
    errorMsg.value = e.message || 'Failed to confirm reservation'
  }
}

async function handleDecline(id: string) {
  errorMsg.value = null
  try {
    await reservationsStore.decline(id)
  } catch (e: any) {
    errorMsg.value = e.message || 'Failed to decline reservation'
  }
}

async function handleArrived(id: string) {
  errorMsg.value = null
  try {
    await reservationsStore.markArrived(id)
    await reservationsStore.loadStats()
  } catch (e: any) {
    errorMsg.value = e.message || 'Failed to mark as arrived'
  }
}

async function handleNoShow(id: string) {
  errorMsg.value = null
  const confirmed = confirm('Mark this reservation as no-show? The table will become available again.')
  if (!confirmed) return

  try {
    await reservationsStore.markNoShow(id)
    await reservationsStore.loadStats()
  } catch (e: any) {
    errorMsg.value = e.message || 'Failed to mark as no-show'
  }
}

async function handleSubmitRequest(data: {
  tableId: string
  guestName: string
  guestPhone: string
  guestCount: number
  reservationTime: string
}) {
  errorMsg.value = null
  try {
    await reservationsStore.createRequest({
      ...data,
      requestedBy: auth.currentStaff?.name
    })
    showRequestModal.value = false
  } catch (e: any) {
    errorMsg.value = e.message || 'Failed to create reservation request'
  }
}
</script>

<template>
  <div class="reservations">
    <!-- Header -->
    <header class="head">
      <div class="head-left">
        <h1>Reservations</h1>
        <p class="subtitle">
          <span class="text-arrived">{{ stats.arrivedToday }} arrived today</span> ·
          <span class="text-noshow">{{ stats.noShowToday }} no-shows</span> ·
          <span>{{ Math.round(stats.showUpRate) }}% show-up rate</span>
        </p>
      </div>
      <button class="add-btn" @click="showRequestModal = true">
        <Plus :size="16" />
        New reservation
      </button>
    </header>

    <!-- Error banner -->
    <div v-if="errorMsg" class="error-banner">
      {{ errorMsg }}
      <button @click="errorMsg = null">✕</button>
    </div>

    <!-- Pending requests panel -->
    <section class="section">
      <PendingRequestsPanel
        :requests="reservationsStore.pending"
        @confirm="handleConfirm"
        @decline="handleDecline"
      />
    </section>

    <!-- Confirmed reservations -->
    <section class="section">
      <div class="section-head">
        <h2>Confirmed reservations</h2>
        <div class="segmented">
          <button
            :class="{ active: activeTab === 'today' }"
            @click="activeTab = 'today'"
          >
            Today
          </button>
          <button
            :class="{ active: activeTab === 'tomorrow' }"
            @click="activeTab = 'tomorrow'"
          >
            Tomorrow
          </button>
          <button
            :class="{ active: activeTab === 'week' }"
            @click="activeTab = 'week'"
          >
            This week
          </button>
        </div>
      </div>

      <ConfirmedReservationsList
        :reservations="filteredConfirmed"
        @arrived="handleArrived"
        @no-show="handleNoShow"
      />
    </section>

    <!-- Stats summary -->
    <section class="stats-grid">
      <div class="stat-card">
        <p class="stat-label">Arrived today</p>
        <p class="stat-value stat-arrived">{{ stats.arrivedToday }}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">No-shows today</p>
        <p class="stat-value stat-noshow">{{ stats.noShowToday }}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Show-up rate</p>
        <p class="stat-value">{{ Math.round(stats.showUpRate) }}%</p>
      </div>
    </section>

    <!-- Modal -->
    <RequestReservationModal
      v-if="showRequestModal"
      :requested-by="auth.currentStaff?.name"
      @close="showRequestModal = false"
      @submit="handleSubmitRequest"
    />
  </div>
</template>

<style scoped>
.reservations {
  background: #16161A;
  min-height: 100vh;
  padding: 24px 28px;
  color: #E8E4D8;
}

/* ─── Header ─── */
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

.text-arrived { color: #9CB89C; }
.text-noshow { color: #E8B896; }

.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 14px;
  font-size: 13px;
  background: #9CB89C;
  color: #16161A;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s ease;
}

.add-btn:hover {
  background: #B8D0B8;
}

/* ─── Error banner ─── */
.error-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: rgba(216, 90, 48, 0.1);
  border: 0.5px solid rgba(216, 90, 48, 0.3);
  border-radius: 8px;
  color: #E8B896;
  font-size: 13px;
  margin-bottom: 16px;
}

.error-banner button {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
}

/* ─── Sections ─── */
.section {
  margin-bottom: 24px;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 12px;
}

.section-head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: #E8E4D8;
}

.segmented {
  display: flex;
  gap: 4px;
  background: rgba(232, 228, 216, 0.05);
  padding: 4px;
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
}

.segmented button.active {
  background: #9CB89C;
  color: #16161A;
  font-weight: 500;
}

.segmented button:not(.active):hover {
  color: #E8E4D8;
}

/* ─── Stats grid ─── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding-top: 16px;
  border-top: 0.5px solid rgba(232, 228, 216, 0.08);
}

.stat-card {
  background: rgba(232, 228, 216, 0.03);
  border-radius: 10px;
  padding: 12px 14px;
}

.stat-label {
  margin: 0;
  font-size: 11px;
  color: rgba(232, 228, 216, 0.55);
}

.stat-value {
  margin: 4px 0 0 0;
  font-size: 20px;
  font-weight: 500;
  color: #E8E4D8;
}

.stat-arrived { color: #9CB89C; }
.stat-noshow { color: #E8B896; }

@media (max-width: 720px) {
  .reservations {
    padding: 16px;
  }

  .head-left h1 {
    font-size: 20px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>