<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useTablesStore } from '../stores/tables'
import { useOrdersStore } from '../stores/orders'
import { useSettingsStore } from '../stores/settings'
import { useReservationsStore } from '../stores/reservations'
import { formatMoney, getDB, type Staff } from '../db'
import { LogOut, ChefHat, Search, CalendarPlus } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { Section } from '../stores/tables'
import TableCard from '../components/tables/TableCard.vue'
import RequestReservationModal from '../components/reservations/RequestReservationModal.vue'

const router = useRouter()
const { t } = useI18n()
const auth = useAuthStore()
const tablesStore = useTablesStore()
const ordersStore = useOrdersStore()
const settings = useSettingsStore()
const reservationsStore = useReservationsStore()

const search = ref('')
const now = ref(Date.now())
const staffList = ref<Staff[]>([])
const showRequestModal = ref(false)

const activeSection = ref<Section>('MAIN_DINING')

const sections: { value: Section; label: string }[] = [
  { value: 'MAIN_DINING', label: 'Main dining' },
  { value: 'TERRACE', label: 'Terrace' },
  { value: 'OUTDOOR', label: 'Outdoor' }
]

onMounted(async () => {
  await Promise.all([tablesStore.reload(), ordersStore.load()])
  await ordersStore.syncFromDB()

  const db = await getDB()
  staffList.value = await db.getAll('staff')

  const emptyOrders = ordersStore.orders.filter(
    o => o.status === 'open' && o.items.length === 0
  )
  for (const o of emptyOrders) {
    await ordersStore.removeIfEmpty(o.id)
  }

  setInterval(() => { now.value = Date.now() }, 30 * 1000)

  setInterval(async () => {
    await Promise.all([
      tablesStore.reload(),
      ordersStore.syncFromDB()
    ])
  }, 10 * 1000)
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  let list = tablesStore.sorted.filter(t => t.section === activeSection.value)
  if (q) list = list.filter(t => t.name.toLowerCase().includes(q))
  return list
})

const venue = computed(() => settings.settings.venueName)
const staffName = computed(() => auth.currentStaff?.name ?? '')

const stats = computed(() => {
  const occupied = tablesStore.tables.filter(t =>
    ordersStore.tableHasOpenOrder(t.id)
  ).length
  const free = tablesStore.tables.length - occupied
  const todayPaid = ordersStore.todayStats
  return { occupied, free, totalToday: todayPaid.total, countToday: todayPaid.count }
})

function selectTable(id: string) {
  const ownerStaffId = ordersStore.tableOwnerStaffId(id)

  if (ownerStaffId && !auth.isAdmin) {
    if (ownerStaffId !== auth.currentStaff?.id) {
      const ownerStaff = staffList.value.find(s => s.id === ownerStaffId)
      const ownerName = ownerStaff?.name ?? t('tables.anotherWaiter')
      alert(t('tables.tableLockedBy', { name: ownerName }))
      return
    }
  }

  tablesStore.select(id)
  router.push('/pos')
}

function goAdmin() {
  router.push('/admin/menu')
}

function logout() {
  auth.logout()
  router.replace('/')
}

function getTableState(tableId: string) {
  const unpaid = ordersStore.unpaidOrdersForTable(tableId)
  if (unpaid.length === 0) {
    return { occupied: false, total: 0, openedAt: 0, items: 0, staffId: null, staffName: '' }
  }
  const firstOrder = unpaid[0]
  const total = unpaid.reduce((s, o) => s + o.total, 0)
  const items = unpaid.reduce((s, o) => s + o.items.reduce((si, i) => si + i.quantity, 0), 0)
  const staffId = firstOrder.staffId ?? null
  const ownerStaff = staffList.value.find(s => s.id === staffId)
  return {
    occupied: true,
    total,
    openedAt: firstOrder.openedAt,
    items,
    staffId,
    staffName: ownerStaff?.name ?? ''
  }
}

function getCardStatus(table: any): 'AVAILABLE' | 'ON_DINE' | 'RESERVED' {
  const state = getTableState(table.id)
  if (state.occupied) return 'ON_DINE'
  if (table.status === 'RESERVED') return 'RESERVED'
  return 'AVAILABLE'
}

function getMinutesActive(tableId: string): number | undefined {
  const state = getTableState(tableId)
  if (!state.occupied) return undefined
  return Math.floor((now.value - state.openedAt) / 60_000)
}

async function handleSubmitReservation(data: {
  tableId: string
  guestName: string
  guestPhone: string
  guestCount: number
  reservationTime: string
}) {
  try {
    await reservationsStore.createRequest({
      ...data,
      requestedBy: auth.currentStaff?.name
    })
    showRequestModal.value = false
    alert(auth.isAdmin
      ? 'Rezervimi u regjistrua'
      : 'Kërkesa u dërgua tek admini për konfirmim')
  } catch (e: any) {
    alert('Gabim: ' + (e.message || 'nuk mund të dërgohej kërkesa'))
  }
}
</script>

<template>
  <div class="tables">
    <header class="head">
      <div class="head-left">
        <p class="eyebrow">{{ venue }}</p>
        <h1>{{ t('tables.title') }}</h1>
        <div class="stats">
          <span class="stat">
            <span class="k-dot k-dot--warning"></span>
            {{ stats.occupied }} {{ t('tables.occupied') }}
          </span>
          <span class="stat">
            <span class="k-dot k-dot--text-3"></span>
            {{ stats.free }} {{ t('tables.free') }}
          </span>
          <span class="stat-divider">·</span>
          <span class="stat stat--money">
            {{ formatMoney(stats.totalToday) }} {{ t('tables.todaySales') }}
            <span class="stat-count">({{ stats.countToday }} {{ t('reports.orders') }})</span>
          </span>
        </div>
      </div>

      <div class="head-right">
        <div class="search">
          <Search :size="16" />
          <input v-model="search" :placeholder="t('tables.searchPlaceholder')" />
        </div>

        <button class="k-btn k-btn--ghost" @click="showRequestModal = true">
          <CalendarPlus :size="16" />
          Rezervo
        </button>

        <button v-if="auth.isAdmin" class="k-btn k-btn--ghost" @click="goAdmin">
          <ChefHat :size="16" />
          Admin
        </button>

        <div class="user">
          <span class="user-name">{{ staffName }}</span>
          <span class="user-role">{{ auth.isAdmin ? t('staff.admin') : t('staff.cashier') }}</span>
        </div>

        <button class="k-btn k-btn--subtle k-btn--sm" @click="logout" :title="t('nav.logout')">
          <LogOut :size="16" />
        </button>
      </div>
    </header>

    <div class="section-tabs">
      <div class="segmented">
        <button
          v-for="s in sections"
          :key="s.value"
          :class="{ active: activeSection === s.value }"
          @click="activeSection = s.value"
        >
          {{ s.label }}
        </button>
      </div>
    </div>

    <section class="grid-wrap">
      <div v-if="filtered.length > 0" class="floor-plan">
        <TableCard
          v-for="table in filtered"
          :key="table.id"
          :table-id="table.id"
          :name="table.name"
          :seat-count="table.seatCount ?? 4"
          :status="getCardStatus(table)"
          :position-x="table.positionX ?? 0"
          :position-y="table.positionY ?? 0"
          :minutes-active="getMinutesActive(table.id)"
          :size="table.size ?? 150"
          @click="selectTable(table.id)"
        />
      </div>

      <div v-else class="k-empty">
        <p>{{ t('tables.noTables') }}</p>
      </div>
    </section>

    <RequestReservationModal
      v-if="showRequestModal"
      :requested-by="auth.currentStaff?.name"
      @close="showRequestModal = false"
      @submit="handleSubmitReservation"
    />
  </div>
</template>

<style scoped>
.tables {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 24px 28px;
  gap: 22px;
  overflow: hidden;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
  flex-shrink: 0;
}

.head-left .eyebrow {
  margin-bottom: 4px;
}

.head-left h1 {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 12px;
}

.stats {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 14px;
}

.stat {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-2);
}

.stat--money {
  color: var(--money);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.stat-count {
  color: var(--text-3);
  font-weight: 400;
  margin-left: 2px;
}

.stat-divider {
  color: var(--text-3);
}

.head-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-3);
  transition: border-color var(--duration) var(--ease);
}

.search:focus-within {
  border-color: var(--brand);
  color: var(--text);
}

.search input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 14px;
  color: var(--text);
  width: 180px;
}

.search input::placeholder {
  color: var(--text-3);
}

.user {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 0 10px;
  border-left: 1px solid var(--border);
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.user-role {
  font-size: 11px;
  color: var(--text-3);
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.section-tabs {
  flex-shrink: 0;
}

.section-tabs .segmented {
  display: inline-flex;
  gap: 4px;
  background: var(--surface-2, rgba(232, 228, 216, 0.05));
  padding: 4px;
  border-radius: 10px;
}

.section-tabs .segmented button {
  padding: 7px 14px;
  background: transparent;
  border: none;
  border-radius: 7px;
  font-size: 13px;
  color: var(--text-2, rgba(232, 228, 216, 0.6));
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s ease;
}

.section-tabs .segmented button.active {
  background: var(--brand, #9CB89C);
  color: var(--brand-contrast, #16161A);
  font-weight: 500;
}

.section-tabs .segmented button:not(.active):hover {
  color: var(--text, #E8E4D8);
}

.grid-wrap {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

.floor-plan {
  position: relative;
  min-height: 600px;
  padding: 20px;
  padding-bottom: 24px;
}

.floor-plan :deep(.table-card) {
  position: absolute;
  top: 20px;
  left: 20px;
}

@media (max-width: 1100px) {
  .head { flex-wrap: wrap; }
  .head-right { width: 100%; justify-content: space-between; }
  .search input { width: 140px; }
}

@media (max-width: 720px) {
  .tables { padding: 16px; gap: 16px; }
  .head-left h1 { font-size: 24px; }
  .stats { gap: 10px; font-size: 13px; }
  .floor-plan { min-height: 400px; padding: 12px; }
}
</style>