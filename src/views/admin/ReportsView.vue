<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '../../api/client'
import { useTablesStore } from '../../stores/tables'

const tablesStore = useTablesStore()

type ProductStats = { name: string; qty: number; revenue: number }
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
  items: OrderItem[]
}

type ZReport = {
  date: string
  totalRevenue: number
  cashTotal: number
  cardTotal: number
  orderCount: number
  avgOrder: number
  topProducts: ProductStats[]
  orders: Order[]
}

const report = ref<ZReport | null>(null)
const selectedDate = ref(new Date().toISOString().slice(0, 10))

function formatMoney(cents: number): string {
  return '€ ' + (cents / 100).toFixed(2)
}

async function loadReport() {
  report.value = await api.get<ZReport>(`/reports/z-report?date=${selectedDate.value}`)
}

onMounted(async () => {
  await tablesStore.load()
  await loadReport()
})

watch(selectedDate, loadReport)

const totalRevenue = computed(() => report.value?.totalRevenue ?? 0)
const cashTotal = computed(() => report.value?.cashTotal ?? 0)
const cardTotal = computed(() => report.value?.cardTotal ?? 0)
const orderCount = computed(() => report.value?.orderCount ?? 0)
const avgOrder = computed(() => report.value?.avgOrder ?? 0)
const productSales = computed(() => report.value?.topProducts ?? [])
const dateOrders = computed(() => report.value?.orders ?? [])  // template mund ta perdore; po e lemë bosh

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('sq-AL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function printReport() {
  window.print()
}

function prevDay() {
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() - 1)
  selectedDate.value = d.toISOString().slice(0, 10)
}

function nextDay() {
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() + 1)
  const today = new Date().toISOString().slice(0, 10)
  if (d.toISOString().slice(0, 10) <= today) {
    selectedDate.value = d.toISOString().slice(0, 10)
  }
}

const isToday = computed(() =>
  selectedDate.value === new Date().toISOString().slice(0, 10)
)
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Analitikë</p>
        <h1>Raportet</h1>
      </div>
      <button class="k-btn k-btn--ghost no-print" @click="printReport">
        <Printer :size="16" />
        Printo Z-Report
      </button>
    </header>

    <!-- Date picker -->
    <div class="date-nav no-print">
      <button class="nav-btn" @click="prevDay">←</button>
      <div class="date-center">
        <Calendar :size="15" />
        <input type="date" v-model="selectedDate" class="date-input" />
      </div>
      <button class="nav-btn" @click="nextDay" :disabled="isToday">→</button>
    </div>

    <!-- Print header (only shown when printing) -->
    <div class="print-header print-only">
      <h2>Z-Report — Kendi POS</h2>
      <p>{{ formatDate(selectedDate) }}</p>
    </div>

    <!-- Stats grid -->
    <div class="stats-grid">
      <div class="stat-card stat-card--main">
        <p class="stat-label">Total shitje</p>
        <p class="stat-val money">{{ formatMoney(totalRevenue) }}</p>
        <p class="stat-sub">{{ orderCount }} porosi</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Kesh</p>
        <p class="stat-val">{{ formatMoney(cashTotal) }}</p>
        <p class="stat-sub">{{ dateOrders.filter(o => o.paymentMethod === 'cash').length }} porosi</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Kartë</p>
        <p class="stat-val">{{ formatMoney(cardTotal) }}</p>
        <p class="stat-sub">{{ dateOrders.filter(o => o.paymentMethod === 'card').length }} porosi</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Mesatarja / porosi</p>
        <p class="stat-val">{{ formatMoney(avgOrder) }}</p>
      </div>
    </div>

    <!-- Top products -->
    <div class="section k-card">
      <h2 class="section-title">Produktet me të shitura</h2>

      <div v-if="productSales.length === 0" class="k-empty">
        <p>Nuk ka shitje për këtë ditë</p>
      </div>

      <div v-else class="products-list">
        <div v-for="(p, i) in productSales" :key="p.name" class="product-row">
          <span class="product-rank">{{ i + 1 }}</span>
          <span class="product-name">{{ p.name }}</span>
          <span class="product-qty">× {{ p.qty }}</span>
          <div class="product-bar-wrap">
            <div class="product-bar"
              :style="{ width: (p.revenue / productSales[0].revenue * 100) + '%' }">
            </div>
          </div>
          <span class="product-revenue mono">{{ formatMoney(p.revenue) }}</span>
        </div>
      </div>
    </div>

    <!-- Orders breakdown -->
    <div class="section k-card">
      <h2 class="section-title">Porositë e ditës</h2>

      <div v-if="dateOrders.length === 0" class="k-empty">
        <p>Nuk ka porosi për {{ formatDate(selectedDate) }}</p>
      </div>

      <table v-else class="orders-table">
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
          <tr v-for="order in dateOrders" :key="order.id">
            <td class="mono">
              {{ (order.paidAt ?? order.closedAt) ? new Date(order.paidAt ?? order.closedAt!).toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' }) : '—' }}
            </td>
            <td>{{ tablesStore.byId(order.tableId)?.name ?? '—' }}</td>
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

/* Date nav */
.date-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.nav-btn {
  width: 40px;
  height: 40px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 16px;
  transition: all var(--duration) var(--ease);
}
.nav-btn:hover:not(:disabled) { background: var(--surface-2); }
.nav-btn:disabled { opacity: 0.3; }

.date-center {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  height: 40px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-3);
}

.date-input {
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font-size: 14px;
  font-family: var(--font-mono);
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1fr;
  gap: 14px;
  flex-shrink: 0;
}

.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
}

.stat-card--main {
  background: var(--surface-2);
  border-color: var(--brand-line);
}

.stat-label { font-size: 12px; color: var(--text-3); margin-bottom: 8px; }
.stat-val { font-size: 28px; font-weight: 700; color: var(--text); letter-spacing: -0.01em; }
.stat-val.money { color: var(--money); font-variant-numeric: tabular-nums; }
.stat-sub { font-size: 12px; color: var(--text-3); margin-top: 6px; }

/* Sections */
.section { padding: 20px 22px; }
.section-title {
  font-size: 14px;
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
  grid-template-columns: 24px 1fr auto 120px auto;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}

.product-rank { color: var(--text-3); font-family: var(--font-mono); font-size: 12px; }
.product-name { color: var(--text); font-weight: 500; }
.product-qty { color: var(--text-3); font-family: var(--font-mono); font-size: 12px; }

.product-bar-wrap {
  height: 6px;
  background: var(--surface-2);
  border-radius: 99px;
  overflow: hidden;
}

.product-bar {
  height: 100%;
  background: var(--brand);
  border-radius: 99px;
  transition: width 0.4s var(--ease);
  min-width: 4px;
}

.product-revenue { color: var(--money); font-weight: 600; }

/* Table */
.orders-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.orders-table th {
  text-align: left;
  padding: 10px 16px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-3);
  border-bottom: 1px solid var(--border);
}

.orders-table td {
  padding: 12px 16px;
  color: var(--text-2);
  border-bottom: 1px solid var(--border);
}

.orders-table tfoot td {
  border-bottom: none;
  border-top: 2px solid var(--border-strong);
  color: var(--text);
}

.orders-table tbody tr:hover td { background: var(--surface-2); }
.money { color: var(--money); font-variant-numeric: tabular-nums; }

/* Print */
@media print {
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  .page { padding: 0; gap: 12px; overflow: visible; }
  .stat-card { border: 1px solid #ccc !important; }
  .k-card { border: 1px solid #ccc !important; }
  body { background: white !important; color: black !important; }
}

.print-only { display: none; }
.print-header { margin-bottom: 8px; }
.print-header h2 { font-size: 20px; font-weight: 700; }
.print-header p { font-size: 14px; color: var(--text-2); }

@media (max-width: 900px) {
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .product-row { grid-template-columns: 24px 1fr auto auto; }
  .product-bar-wrap { display: none; }
}
</style>