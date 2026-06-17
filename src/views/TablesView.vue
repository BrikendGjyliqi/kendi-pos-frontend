<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useTablesStore } from '../stores/tables'
import { useOrdersStore } from '../stores/orders'
import { useSettingsStore } from '../stores/settings'
import { formatMoney, getDB, type Staff } from '../db'
import { Settings, LogOut, Plus, ChefHat, Search } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()
const auth = useAuthStore()
const tablesStore = useTablesStore()
const ordersStore = useOrdersStore()
const settings = useSettingsStore()

const search = ref('')
const now = ref(Date.now())
const staffList = ref<Staff[]>([])

onMounted(async () => {
  await Promise.all([tablesStore.load(), ordersStore.load()])

  // Sync nga DB qe te kapem orders e fundit (closed, paid etj qe ndodhen ne sesione tjera)
  await ordersStore.syncFromDB()

  // Ngarko listen e stafit per te ditur emrin e ownerit te tavolinave
  const db = await getDB()
  staffList.value = await db.getAll('staff')

  // Pastro automatikisht orders te zbrazta (€0.00) qe mund te kene mbetur
  const emptyOrders = ordersStore.orders.filter(
    o => o.status === 'open' && o.items.length === 0
  )
  for (const o of emptyOrders) {
    await ordersStore.removeIfEmpty(o.id)
  }

  // Live "time since" updates
  setInterval(() => { now.value = Date.now() }, 30 * 1000)
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = tablesStore.sorted
  if (!q) return list
  return list.filter(t => t.name.toLowerCase().includes(q))
})

const venue = computed(() => settings.settings.venueName)
const staffName = computed(() => auth.currentStaff?.name ?? '')

// Stats line for the header
const stats = computed(() => {
  const occupied = tablesStore.tables.filter(t =>
    ordersStore.tableHasOpenOrder(t.id)
  ).length
  const free = tablesStore.tables.length - occupied
  const todayPaid = ordersStore.todayStats
  return { occupied, free, totalToday: todayPaid.total, countToday: todayPaid.count }
})

function selectTable(id: string) {
  // Kontrollo nese tavolina ka porosi te hapur nga staff tjeter
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

/** "12m" / "1h 4m" since order opened */
function timeSince(ms: number): string {
  const diff = Math.max(0, now.value - ms)
  const min = Math.floor(diff / 60_000)
  if (min < 1) return t('tables.now')
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const rem = min % 60
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`
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
</script>

<template>
  <div class="tables">
    <!-- Header -->
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

    <!-- Grid -->
    <section class="grid-wrap">
      <div v-if="filtered.length > 0" class="grid">
        <button v-for="table in filtered" :key="table.id" class="cell"
          :class="{
            occupied: getTableState(table.id).occupied,
            locked: getTableState(table.id).occupied
              && getTableState(table.id).staffId
              && getTableState(table.id).staffId !== auth.currentStaff?.id
              && !auth.isAdmin
          }"
          @click="selectTable(table.id)">
          <div class="cell-top">
            <h2>{{ table.name }}</h2>
            <span v-if="getTableState(table.id).occupied" class="cell-dot" aria-hidden="true"></span>
          </div>

          <div class="cell-body">
            <template v-if="getTableState(table.id).occupied">
              <p class="cell-total tabular">{{ formatMoney(getTableState(table.id).total) }}</p>
              <p class="cell-meta">
                {{ getTableState(table.id).items }} {{ t('pos.items') }} · {{ timeSince(getTableState(table.id).openedAt) }}
              </p>
              <p v-if="getTableState(table.id).staffName" class="cell-staff">
                <span v-if="getTableState(table.id).staffId !== auth.currentStaff?.id && !auth.isAdmin">🔒</span>
                {{ getTableState(table.id).staffName }}
              </p>
            </template>
            <template v-else>
              <p class="cell-empty">{{ t('tables.free') }}</p>
            </template>
          </div>
        </button>
      </div>

      <div v-else class="k-empty">
        <p>{{ t('tables.noTables') }}</p>
      </div>
    </section>
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

/* ─── Header ─── */
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

.search input::placeholder { color: var(--text-3); }

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

/* ─── Grid ─── */
.grid-wrap {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
  padding-bottom: 24px;
}

.cell {
  position: relative;
  min-height: 140px;
  padding: 18px;
  text-align: left;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  color: var(--text);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  transition: all var(--duration) var(--ease);
  cursor: pointer;
  font-family: inherit;
}

.cell:hover {
  border-color: var(--border-strong);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.cell:active {
  transform: translateY(0);
}

.cell.occupied {
  background: var(--surface-2);
  border-color: var(--brand-line);
}

.cell.occupied:hover {
  border-color: var(--brand);
  box-shadow: 0 0 0 4px var(--brand-soft);
}

.cell-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.cell-top h2 {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.cell-dot {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--brand);
  box-shadow: 0 0 0 0 var(--brand-soft);
  animation: pulse 2.4s infinite;
  flex-shrink: 0;
  margin-top: 6px;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 var(--brand-soft); }
  50% { box-shadow: 0 0 0 6px var(--brand-soft); }
}

.cell-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cell-total {
  font-size: 22px;
  font-weight: 700;
  color: var(--money);
  letter-spacing: -0.01em;
}

.cell-meta {
  font-size: 12px;
  color: var(--text-3);
}

.cell-empty {
  font-size: 14px;
  color: var(--text-3);
}

.cell-staff {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
}

.cell.locked {
  opacity: 0.65;
  cursor: not-allowed;
  border-color: var(--border) !important;
  background: var(--surface) !important;
}

.cell.locked:hover {
  border-color: var(--border) !important;
  box-shadow: none !important;
  transform: none;
}

.cell.locked .cell-staff {
  color: var(--warning, #d97706);
  font-weight: 600;
}

/* ─── Responsive ─── */
@media (max-width: 1100px) {
  .head { flex-wrap: wrap; }
  .head-right { width: 100%; justify-content: space-between; }
  .search input { width: 140px; }
}

@media (max-width: 720px) {
  .tables { padding: 16px; gap: 16px; }
  .head-left h1 { font-size: 24px; }
  .stats { gap: 10px; font-size: 13px; }
  .grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
  .cell { min-height: 110px; padding: 14px; }
  .cell-top h2 { font-size: 18px; }
  .cell-total { font-size: 18px; }
}
</style>