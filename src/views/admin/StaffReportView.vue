<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '../../api/client'
import { User, Shield, Printer } from 'lucide-vue-next'

type Staff = {
  id: string
  name: string
  role: string
}

type OrderItem = {
  productId: string
  name: string
  price: number
  quantity: number
}

type Order = {
  id: string
  tableId: string
  status: string
  total: number
  paymentMethod?: string
  paidAt?: number | null
  closedAt?: number | null
  staffId?: string
  items: OrderItem[]
}

type ProductStats = { name: string; qty: number; revenue: number }

type StaffReport = {
  date: string
  staffId: string
  totalRevenue: number
  cashTotal: number
  cardTotal: number
  orderCount: number
  products: ProductStats[]
  orders: Order[]
}

const staffList = ref<Staff[]>([])
const selectedStaffId = ref<string | null>(null)
const selectedDate = ref(new Date().toISOString().slice(0, 10))
const report = ref<StaffReport | null>(null)

function formatMoney(cents: number): string {
  return '€ ' + (cents / 100).toFixed(2)
}

async function loadReport() {
  if (!selectedStaffId.value) {
    report.value = null
    return
  }
  report.value = await api.get<StaffReport>(
    `/reports/staff?staffId=${selectedStaffId.value}&date=${selectedDate.value}`
  )
}

onMounted(async () => {
  staffList.value = await api.get<Staff[]>('/staff')
  if (staffList.value.length > 0) {
    selectedStaffId.value = staffList.value[0].id
    await loadReport()
  }
})

watch([selectedStaffId, selectedDate], loadReport)

const selectedStaff = computed(() =>
  staffList.value.find(s => s.id === selectedStaffId.value) ?? null
)

const staffOrders = computed(() => report.value?.orders ?? [])
const totalRevenue = computed(() => report.value?.totalRevenue ?? 0)
const cashTotal = computed(() => report.value?.cashTotal ?? 0)
const cardTotal = computed(() => report.value?.cardTotal ?? 0)
const productSales = computed(() => report.value?.products ?? [])

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('sq-AL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}

function formatTime(ts?: number | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' })
}

function prevDay() {
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() - 1)
  selectedDate.value = d.toISOString().slice(0, 10)
}

function nextDay() {
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() + 1)
  if (d.toISOString().slice(0, 10) <= new Date().toISOString().slice(0, 10)) {
    selectedDate.value = d.toISOString().slice(0, 10)
  }
}

const isToday = computed(() =>
  selectedDate.value === new Date().toISOString().slice(0, 10)
)

function printReport() {
  window.print()
}
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Analitikë</p>
        <h1>Raporti i personelit</h1>
      </div>
      <button class="k-btn k-btn--ghost no-print" @click="printReport">
        <Printer :size="16" />
        Printo raportin
      </button>
    </header>

    <!-- Controls -->
    <div class="controls no-print">
      <!-- Staff selector -->
      <div class="staff-selector">
        <button v-for="staff in staffList" :key="staff.id"
          :class="['staff-btn', selectedStaffId === staff.id && 'staff-btn--active']"
          @click="selectedStaffId = staff.id">
          <component :is="staff.role === 'admin' ? Shield : User" :size="14" />
          {{ staff.name }}
          <span class="staff-role">{{ staff.role === 'admin' ? 'Admin' : 'Banakier' }}</span>
        </button>
      </div>

      <!-- Date nav -->
      <div class="date-nav">
        <button class="nav-btn" @click="prevDay">←</button>
        <input type="date" v-model="selectedDate" class="date-input" />
        <button class="nav-btn" @click="nextDay" :disabled="isToday">→</button>
      </div>
    </div>

    <!-- Print header -->
    <div class="print-header print-only">
      <h2>Raport Personeli — {{ selectedStaff?.name }}</h2>
      <p>{{ formatDate(selectedDate) }}</p>
    </div>

    <!-- Stats -->
    <div class="stats-grid" v-if="selectedStaff">
      <div class="stat-card stat-card--main">
        <div class="stat-staff-info">
          <component :is="selectedStaff.role === 'admin' ? Shield : User" :size="22" />
          <div>
            <p class="stat-staff-name">{{ selectedStaff.name }}</p>
            <p class="stat-staff-role">{{ selectedStaff.role === 'admin' ? 'Admin' : 'Banakier' }}</p>
          </div>
        </div>
        <p class="stat-label">Total shitje</p>
        <p class="stat-val money">{{ formatMoney(totalRevenue) }}</p>
        <p class="stat-sub">{{ staffOrders.length }} porosi</p>
      </div>

      <div class="stat-card">
        <p class="stat-label">Kesh</p>
        <p class="stat-val">{{ formatMoney(cashTotal) }}</p>
        <p class="stat-sub">{{ staffOrders.filter(o => o.paymentMethod === 'cash').length }} porosi</p>
      </div>

      <div class="stat-card">
        <p class="stat-label">Kartë</p>
        <p class="stat-val">{{ formatMoney(cardTotal) }}</p>
        <p class="stat-sub">{{ staffOrders.filter(o => o.paymentMethod === 'card').length }} porosi</p>
      </div>

      <div class="stat-card">
        <p class="stat-label">Mesatarja / porosi</p>
        <p class="stat-val">{{ staffOrders.length ? formatMoney(Math.round(totalRevenue / staffOrders.length)) : '€ 0.00' }}</p>
      </div>
    </div>

    <div v-if="staffOrders.length === 0 && selectedStaff" class="k-empty">
      <p>{{ selectedStaff.name }} nuk ka asnjë shitje për {{ formatDate(selectedDate) }}</p>
    </div>

    <div v-if="staffOrders.length > 0" class="sections">
      <!-- Top produktet -->
      <div class="section k-card">
        <h2 class="section-title">Produktet e shitura</h2>
        <div class="products-list">
          <div v-for="(p, i) in productSales" :key="p.name" class="product-row">
            <span class="product-rank">{{ i + 1 }}</span>
            <span class="product-name">{{ p.name }}</span>
            <span class="product-qty mono">× {{ p.qty }}</span>
            <div class="product-bar-wrap">
              <div class="product-bar"
                :style="{ width: productSales.length ? (p.revenue / productSales[0].revenue * 100) + '%' : '0%' }">
              </div>
            </div>
            <span class="product-revenue mono">{{ formatMoney(p.revenue) }}</span>
          </div>
        </div>
      </div>

      <!-- Historiku i porosive -->
      <div class="section k-card">
        <h2 class="section-title">Porositë e {{ selectedStaff?.name }}</h2>
        <table class="orders-table">
          <thead>
            <tr>
              <th>Ora</th>
              <th>Tavolina</th>
              <th>Artikuj</th>
              <th>Pagesa</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in staffOrders" :key="order.id">
              <td class="mono">{{ formatTime(order.paidAt ?? order.closedAt) }}</td>
              <td>{{ order.tableId }}</td>
              <td>{{ order.items.reduce((s, i) => s + i.quantity, 0) }}</td>
              <td>{{ order.paymentMethod === 'cash' ? 'Kesh' : 'Kartë' }}</td>
              <td class="mono money">{{ formatMoney(order.total) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="font-weight:700; padding: 12px 16px;">TOTALI</td>
              <td class="mono money" style="font-weight:700; padding: 12px 16px;">{{ formatMoney(totalRevenue) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  padding: 24px 28px;
  gap: 18px;
  overflow-y: auto;
  height: 100%;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-shrink: 0;
}
.page-head .eyebrow { margin-bottom: 4px; }
.page-head h1 { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; }

/* Controls */
.controls {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
  flex-shrink: 0;
}

/* Staff selector */
.staff-selector { display: flex; gap: 8px; flex-wrap: wrap; }

.staff-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 500;
  transition: all var(--duration) var(--ease);
}
.staff-btn:hover { background: var(--surface-2); color: var(--text); }
.staff-btn--active {
  background: var(--brand-soft);
  border-color: var(--brand-line);
  color: var(--text);
}

.staff-role {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 6px;
  background: var(--surface-2);
  border-radius: var(--radius-full);
}

/* Date nav */
.date-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.nav-btn {
  width: 36px;
  height: 36px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 14px;
  transition: all var(--duration) var(--ease);
}
.nav-btn:hover:not(:disabled) { background: var(--surface-2); }
.nav-btn:disabled { opacity: 0.3; }

.date-input {
  height: 36px;
  padding: 0 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 13px;
  font-family: var(--font-mono);
  outline: none;
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr 1fr 1fr;
  gap: 14px;
  flex-shrink: 0;
}

.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
}
.stat-card--main { background: var(--surface-2); border-color: var(--brand-line); }

.stat-staff-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
  color: var(--brand);
}

.stat-staff-name { font-size: 16px; font-weight: 700; color: var(--text); }
.stat-staff-role { font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }

.stat-label { font-size: 12px; color: var(--text-3); margin-bottom: 8px; }
.stat-val { font-size: 26px; font-weight: 700; color: var(--text); letter-spacing: -0.01em; }
.stat-val.money { color: var(--money); font-variant-numeric: tabular-nums; }
.stat-sub { font-size: 12px; color: var(--text-3); margin-top: 6px; }

/* Sections */
.sections { display: flex; flex-direction: column; gap: 16px; }
.section { padding: 20px 22px; }
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 16px;
}

/* Products */
.products-list { display: flex; flex-direction: column; gap: 8px; }
.product-row {
  display: grid;
  grid-template-columns: 24px 1fr auto 100px auto;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}
.product-rank { color: var(--text-3); font-family: var(--font-mono); font-size: 12px; }
.product-name { color: var(--text); font-weight: 500; }
.product-qty { color: var(--text-3); }
.product-bar-wrap { height: 6px; background: var(--surface-2); border-radius: 99px; overflow: hidden; }
.product-bar { height: 100%; background: var(--brand); border-radius: 99px; min-width: 4px; }
.product-revenue { color: var(--money); font-weight: 600; }

/* Table */
.orders-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.orders-table th {
  text-align: left; padding: 10px 16px;
  font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--text-3); border-bottom: 1px solid var(--border);
}
.orders-table td { padding: 12px 16px; color: var(--text-2); border-bottom: 1px solid var(--border); }
.orders-table tfoot td { border-bottom: none; border-top: 2px solid var(--border-strong); color: var(--text); }
.orders-table tbody tr:hover td { background: var(--surface-2); }
.money { color: var(--money); font-variant-numeric: tabular-nums; }

/* Print */
@media print {
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  .page { padding: 0; overflow: visible; }
  body { background: white !important; color: black !important; }
}
.print-only { display: none; }
.print-header h2 { font-size: 20px; font-weight: 700; }

@media (max-width: 900px) {
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .product-bar-wrap { display: none; }
  .product-row { grid-template-columns: 24px 1fr auto auto; }
}
</style>