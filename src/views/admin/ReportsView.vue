<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '../../api/client'
import { useSettingsStore } from '../../stores/settings'
import { Printer, FileText, X, Send, Calendar } from 'lucide-vue-next'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'

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

type ProductStats = { name: string; qty: number; revenue: number }

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

function todayLocal(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const selectedDate = ref(todayLocal())
const report = ref<ZReport | null>(null)
const settings = useSettingsStore()

// Monthly modal state
const monthlyModal = ref(false)
const monthlyFrom = ref('')
const monthlyTo = ref('')
const monthlyLoading = ref(false)
const monthlyData = ref<ZReport[]>([])
const monthlyError = ref<string | null>(null)

function formatMoney(cents: number): string {
  return '€ ' + (cents / 100).toFixed(2)
}

async function loadReport() {
  report.value = await api.get<ZReport>(`/reports/z-report?date=${selectedDate.value}`)
}

onMounted(loadReport)
watch(selectedDate, loadReport)

const todayOrders = computed(() => report.value?.orders ?? [])
const totalRevenue = computed(() => report.value?.totalRevenue ?? 0)
const cashTotal = computed(() => report.value?.cashTotal ?? 0)
const cardTotal = computed(() => report.value?.cardTotal ?? 0)
const productSales = computed(() => report.value?.topProducts ?? [])

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('sq-AL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}

function formatTime(ts?: number | null): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' })
}

function prevDay() {
  const d = new Date(selectedDate.value + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  selectedDate.value = `${year}-${month}-${day}`
}

function nextDay() {
  const d = new Date(selectedDate.value + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const nextStr = `${year}-${month}-${day}`
  if (nextStr <= todayLocal()) {
    selectedDate.value = nextStr
  }
}

const isToday = computed(() =>
  selectedDate.value === todayLocal()
)

// ─── PDF: Z-Report ditor ───
async function printReport() {
  if (!report.value) return

  const cashOrders = todayOrders.value.filter(o => o.paymentMethod === 'cash').length
  const cardOrders = todayOrders.value.filter(o => o.paymentMethod === 'card').length
  const avgOrder = todayOrders.value.length
    ? Math.round(totalRevenue.value / todayOrders.value.length)
    : 0

  const doc = new jsPDF()

  // Header
  doc.setFontSize(10)
  doc.setTextColor(150)
  doc.text('ANALITIKE', 20, 20)

  doc.setFontSize(24)
  doc.setTextColor(50)
  doc.text('Raportet', 20, 32)

  doc.setFontSize(14)
  doc.setTextColor(80)
  doc.text('Z-Report - Kendi POS', 20, 45)

  doc.setFontSize(11)
  doc.setTextColor(120)
  doc.text(formatDate(selectedDate.value), 20, 53)

  // Total shitje
  doc.setDrawColor(110, 231, 183)
  doc.setFillColor(240, 253, 244)
  doc.roundedRect(20, 62, 170, 28, 3, 3, 'FD')
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text('Total shitje', 25, 71)
  doc.setFontSize(20)
  doc.setTextColor(5, 150, 105)
  doc.text(formatMoney(totalRevenue.value), 25, 82)
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(`${todayOrders.value.length} porosi`, 25, 88)

  // Kesh
  doc.setDrawColor(220)
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(20, 95, 82, 28, 3, 3, 'FD')
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text('Kesh', 25, 104)
  doc.setFontSize(16)
  doc.setTextColor(50)
  doc.text(formatMoney(cashTotal.value), 25, 115)
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(`${cashOrders} porosi`, 25, 121)

  // Karte
  doc.roundedRect(108, 95, 82, 28, 3, 3, 'FD')
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text('Karte', 113, 104)
  doc.setFontSize(16)
  doc.setTextColor(50)
  doc.text(formatMoney(cardTotal.value), 113, 115)
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(`${cardOrders} porosi`, 113, 121)

  // Mesatarja
  doc.roundedRect(20, 128, 170, 24, 3, 3, 'FD')
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text('Mesatarja / porosi', 25, 137)
  doc.setFontSize(16)
  doc.setTextColor(50)
  doc.text(formatMoney(avgOrder), 25, 147)

  // Produktet me te shitura
  if (productSales.value.length > 0) {
    doc.setFontSize(11)
    doc.setTextColor(80)
    doc.text('PRODUKTET ME TE SHITURA', 20, 165)

    autoTable(doc, {
      startY: 170,
      head: [['#', 'Produkti', 'Sasia', 'Totali']],
      body: productSales.value.map((p, i) => [
        (i + 1).toString(),
        p.name,
        `x ${p.qty}`,
        formatMoney(p.revenue)
      ]),
      theme: 'plain',
      headStyles: { fillColor: [245, 245, 245], textColor: [100, 100, 100], fontSize: 9 },
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: 15, textColor: [150, 150, 150] },
        1: { cellWidth: 90 },
        2: { cellWidth: 30, textColor: [120, 120, 120] },
        3: { cellWidth: 40, textColor: [5, 150, 105], fontStyle: 'bold' }
      }
    })
  }

  try {
    const filePath = await save({
      defaultPath: `raport_${selectedDate.value}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })

    if (filePath) {
      const pdfBytes = doc.output('arraybuffer')
      await writeFile(filePath, new Uint8Array(pdfBytes))
    }
  } catch (e) {
    console.error('PDF save failed:', e)
  }
}

// ─── Monthly report ───
function openMonthlyModal() {
  const now = new Date()
  const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0)

  monthlyFrom.value = toDateStr(firstOfPrevMonth)
  monthlyTo.value = toDateStr(lastOfPrevMonth)
  monthlyError.value = null
  monthlyData.value = []
  monthlyModal.value = true
}

function closeMonthlyModal() {
  monthlyModal.value = false
  monthlyData.value = []
}

function toDateStr(d: Date): string {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

async function generateMonthly() {
  monthlyError.value = null
  if (!monthlyFrom.value || !monthlyTo.value) {
    monthlyError.value = 'Zgjidhni datat'
    return
  }
  if (monthlyFrom.value > monthlyTo.value) {
    monthlyError.value = 'Data e fillimit duhet të jetë para datës së fundit'
    return
  }

  monthlyLoading.value = true
  try {
    const from = new Date(monthlyFrom.value + 'T12:00:00')
    const to = new Date(monthlyTo.value + 'T12:00:00')
    const results: ZReport[] = []

    const d = new Date(from)
    while (d <= to) {
      const dateStr = toDateStr(d)
      try {
        const dayReport = await api.get<ZReport>(`/reports/z-report?date=${dateStr}`)
        results.push(dayReport)
      } catch (e) {
        results.push({
          date: dateStr,
          totalRevenue: 0,
          cashTotal: 0,
          cardTotal: 0,
          orderCount: 0,
          avgOrder: 0,
          topProducts: [],
          orders: []
        })
      }
      d.setDate(d.getDate() + 1)
    }

    monthlyData.value = results
  } catch (e) {
    monthlyError.value = (e as Error).message
  } finally {
    monthlyLoading.value = false
  }
}

const monthlyTotals = computed(() => {
  return {
    revenue: monthlyData.value.reduce((s, d) => s + d.totalRevenue, 0),
    cash: monthlyData.value.reduce((s, d) => s + d.cashTotal, 0),
    card: monthlyData.value.reduce((s, d) => s + d.cardTotal, 0)
  }
})

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('sq-AL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateShortWeekday(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('sq-AL', { weekday: 'short' })
}

// ─── PDF: Raporti mujor ───
async function printMonthly() {
  if (monthlyData.value.length === 0) return

  const doc = new jsPDF()

  doc.setFontSize(10)
  doc.setTextColor(150)
  doc.text('RAPORT MUJOR', 20, 20)

  doc.setFontSize(20)
  doc.setTextColor(50)
  doc.text(settings.settings.venueName || 'Kendi Cafe', 20, 32)

  doc.setFontSize(11)
  doc.setTextColor(120)
  doc.text(`${formatDateShort(monthlyFrom.value)} - ${formatDateShort(monthlyTo.value)}`, 20, 40)

  // Totali i shitjeve (main)
  doc.setDrawColor(110, 231, 183)
  doc.setFillColor(240, 253, 244)
  doc.roundedRect(20, 48, 170, 26, 3, 3, 'FD')
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text('Totali i shitjeve', 25, 57)
  doc.setFontSize(18)
  doc.setTextColor(5, 150, 105)
  doc.text(formatMoney(monthlyTotals.value.revenue), 25, 68)

  // Kesh
  doc.setDrawColor(220)
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(20, 78, 82, 24, 3, 3, 'FD')
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text('Kesh', 25, 87)
  doc.setFontSize(14)
  doc.setTextColor(50)
  doc.text(formatMoney(monthlyTotals.value.cash), 25, 97)

  // Karte
  doc.roundedRect(108, 78, 82, 24, 3, 3, 'FD')
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text('Karte', 113, 87)
  doc.setFontSize(14)
  doc.setTextColor(50)
  doc.text(formatMoney(monthlyTotals.value.card), 113, 97)

  // Tabela ditore
  autoTable(doc, {
    startY: 110,
    head: [['Data', 'Dite', 'Totali', 'Kesh', 'Karte']],
    body: monthlyData.value.map(d => [
      formatDateShort(d.date),
      formatDateShortWeekday(d.date),
      formatMoney(d.totalRevenue),
      formatMoney(d.cashTotal),
      formatMoney(d.cardTotal)
    ]),
    foot: [[
      'TOTALI', '',
      formatMoney(monthlyTotals.value.revenue),
      formatMoney(monthlyTotals.value.cash),
      formatMoney(monthlyTotals.value.card)
    ]],
    theme: 'plain',
    headStyles: { fillColor: [245, 245, 245], textColor: [100, 100, 100], fontSize: 9 },
    footStyles: { fillColor: [250, 250, 250], textColor: [50, 50, 50], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      2: { textColor: [5, 150, 105], fontStyle: 'bold', halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' }
    }
  })

  try {
    const filePath = await save({
      defaultPath: `raport_mujor_${monthlyFrom.value}_${monthlyTo.value}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })

    if (filePath) {
      const pdfBytes = doc.output('arraybuffer')
      await writeFile(filePath, new Uint8Array(pdfBytes))
    }
  } catch (e) {
    console.error('PDF save failed:', e)
  }
}

function sendToAccountant() {
  const email = settings.settings.accountantEmail
  if (!email) {
    alert('Nuk keni caktuar email të kontabilistit. Shkoni te Cilësimet për ta shtuar.')
    return
  }

  const subject = `Raporti mujor Kendi Cafe — ${formatDateShort(monthlyFrom.value)} deri ${formatDateShort(monthlyTo.value)}`
  const body = `Përshëndetje,%0D%0A%0D%0ABashkangjitur do të gjeni raportin mujor të shitjeve për periudhën ${formatDateShort(monthlyFrom.value)} - ${formatDateShort(monthlyTo.value)}.%0D%0A%0D%0ATotali i shitjeve: ${formatMoney(monthlyTotals.value.revenue)}%0D%0AKesh: ${formatMoney(monthlyTotals.value.cash)}%0D%0AKartë: ${formatMoney(monthlyTotals.value.card)}%0D%0A%0D%0AJu lutem konfirmoni pranimin.%0D%0A%0D%0AFaleminderit,%0D%0A${settings.settings.venueName}`

  window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${body}`
}
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Analitikë</p>
        <h1>Raportet</h1>
      </div>
      <div class="head-actions no-print">
        <button class="k-btn k-btn--primary" @click="openMonthlyModal">
          <FileText :size="16" />
          Raporti mujor
        </button>
        <button class="k-btn k-btn--ghost" @click="printReport">
          <Printer :size="16" />
          Printo raportin
        </button>
      </div>
    </header>

    <!-- Date nav -->
    <div class="date-nav no-print">
      <button class="nav-btn" @click="prevDay">←</button>
      <input type="date" v-model="selectedDate" class="date-input" />
      <button class="nav-btn" @click="nextDay" :disabled="isToday">→</button>
    </div>

    <!-- Print header -->
    <div class="print-header print-only">
      <h2>Z-Report — Kendi POS</h2>
      <p>{{ formatDate(selectedDate) }}</p>
    </div>

    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card stat-card--main">
        <p class="stat-label">Total shitje</p>
        <p class="stat-val money">{{ formatMoney(totalRevenue) }}</p>
        <p class="stat-sub">{{ todayOrders.length }} porosi</p>
      </div>

      <div class="stat-card">
        <p class="stat-label">Kesh</p>
        <p class="stat-val">{{ formatMoney(cashTotal) }}</p>
        <p class="stat-sub">{{ todayOrders.filter(o => o.paymentMethod === 'cash').length }} porosi</p>
      </div>

      <div class="stat-card">
        <p class="stat-label">Kartë</p>
        <p class="stat-val">{{ formatMoney(cardTotal) }}</p>
        <p class="stat-sub">{{ todayOrders.filter(o => o.paymentMethod === 'card').length }} porosi</p>
      </div>

      <div class="stat-card">
        <p class="stat-label">Mesatarja / porosi</p>
        <p class="stat-val">{{ todayOrders.length ? formatMoney(Math.round(totalRevenue / todayOrders.length)) : '€ 0.00' }}</p>
      </div>
    </div>

    <div v-if="todayOrders.length === 0" class="k-empty">
      <p>Nuk ka shitje për {{ formatDate(selectedDate) }}</p>
    </div>

    <div v-if="todayOrders.length > 0" class="sections">
      <!-- Top produktet -->
      <div class="section k-card">
        <h2 class="section-title">Produktet më të shitura</h2>
        <div class="products-list">
          <div v-for="(p, i) in productSales" :key="p.name" class="product-row">
            <span class="product-rank">{{ i + 1 }}</span>
            <span class="product-name">{{ p.name }}</span>
            <span class="product-qty mono">× {{ p.qty }}</span>
            <div class="product-bar-wrap">
              <div class="product-bar" :style="{ width: productSales.length ? (p.revenue / productSales[0].revenue * 100) + '%' : '0%' }"></div>
            </div>
            <span class="product-revenue mono">{{ formatMoney(p.revenue) }}</span>
          </div>
        </div>
      </div>

      <!-- Historiku i porosive -->
      <div class="section k-card">
        <h2 class="section-title">Porositë e ditës</h2>
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
            <tr v-for="order in todayOrders" :key="order.id">
              <td class="mono">{{ formatTime(order.paidAt ?? order.closedAt) }}</td>
              <td>{{ order.tableId }}</td>
              <td>{{ order.items.reduce((s, i) => s + i.quantity, 0) }}</td>
              <td>{{ order.paymentMethod === 'cash' ? 'Kesh' : 'Kartë' }}</td>
              <td class="mono money">{{ formatMoney(order.total) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ─── MONTHLY REPORT MODAL ─── -->
    <div v-if="monthlyModal" class="modal-bg" @click.self="closeMonthlyModal">
      <div class="modal">
        <header class="modal-head">
          <div class="head-title">
            <div class="head-icon">
              <FileText :size="20" />
            </div>
            <div>
              <h2>Raporti mujor</h2>
              <p class="eyebrow">Për kontabilistin</p>
            </div>
          </div>
          <button class="modal-close" @click="closeMonthlyModal">
            <X :size="20" />
          </button>
        </header>

        <div class="modal-body">
          <!-- Date range picker -->
          <div class="date-range">
            <div class="field">
              <label>
                <Calendar :size="12" />
                Prej
              </label>
              <input type="date" v-model="monthlyFrom" class="k-input" />
            </div>
            <div class="range-arrow">→</div>
            <div class="field">
              <label>
                <Calendar :size="12" />
                Deri
              </label>
              <input type="date" v-model="monthlyTo" class="k-input" />
            </div>
            <button class="k-btn k-btn--primary generate-btn" @click="generateMonthly"
              :disabled="monthlyLoading">
              {{ monthlyLoading ? 'Duke ngarkuar...' : 'Gjenero' }}
            </button>
          </div>

          <div v-if="monthlyError" class="form-error">{{ monthlyError }}</div>

          <!-- Results -->
          <div v-if="monthlyData.length > 0" class="monthly-report" id="monthly-report">
            <div class="report-summary">
              <div class="summary-card">
                <p class="summary-label">Totali i shitjeve</p>
                <p class="summary-val money">{{ formatMoney(monthlyTotals.revenue) }}</p>
              </div>
              <div class="summary-card">
                <p class="summary-label">Kesh</p>
                <p class="summary-val">{{ formatMoney(monthlyTotals.cash) }}</p>
              </div>
              <div class="summary-card">
                <p class="summary-label">Kartë</p>
                <p class="summary-val">{{ formatMoney(monthlyTotals.card) }}</p>
              </div>
            </div>

            <table class="monthly-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Ditë</th>
                  <th class="ta-right">Totali</th>
                  <th class="ta-right">Kesh</th>
                  <th class="ta-right">Kartë</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="day in monthlyData" :key="day.date"
                  :class="{ 'row-empty': day.totalRevenue === 0 }">
                  <td class="mono">{{ formatDateShort(day.date) }}</td>
                  <td class="dim">{{ formatDateShortWeekday(day.date) }}</td>
                  <td class="ta-right mono money">{{ formatMoney(day.totalRevenue) }}</td>
                  <td class="ta-right mono">{{ formatMoney(day.cashTotal) }}</td>
                  <td class="ta-right mono">{{ formatMoney(day.cardTotal) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2"><strong>TOTALI</strong></td>
                  <td class="ta-right mono money"><strong>{{ formatMoney(monthlyTotals.revenue) }}</strong></td>
                  <td class="ta-right mono"><strong>{{ formatMoney(monthlyTotals.cash) }}</strong></td>
                  <td class="ta-right mono"><strong>{{ formatMoney(monthlyTotals.card) }}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <footer v-if="monthlyData.length > 0" class="modal-foot">
          <button class="k-btn k-btn--ghost" @click="closeMonthlyModal">
            Mbyll
          </button>
          <button class="k-btn k-btn--ghost" @click="printMonthly">
            <Printer :size="14" />
            Ruaj si PDF
          </button>
          <button class="k-btn k-btn--primary" @click="sendToAccountant">
            <Send :size="14" />
            Dërgo te kontabilisti
          </button>
        </footer>
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

.head-actions {
  display: flex;
  gap: 10px;
}

.date-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  align-self: flex-end;
}

.nav-btn {
  width: 36px;
  height: 36px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
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

.stats-grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr 1fr 1fr;
  gap: 14px;
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
.stat-val { font-size: 26px; font-weight: 700; color: var(--text); letter-spacing: -0.01em; }
.stat-val.money { color: var(--money); font-variant-numeric: tabular-nums; }
.stat-sub { font-size: 12px; color: var(--text-3); margin-top: 6px; }

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

.orders-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.orders-table th {
  text-align: left; padding: 10px 16px;
  font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--text-3); border-bottom: 1px solid var(--border);
}
.orders-table td { padding: 12px 16px; color: var(--text-2); border-bottom: 1px solid var(--border); }
.orders-table tbody tr:hover td { background: var(--surface-2); }
.money { color: var(--money); font-variant-numeric: tabular-nums; }

.print-only { display: none; }
.print-header h2 { font-size: 20px; font-weight: 700; }

.modal-bg {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: var(--overlay);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: fade-in 180ms var(--ease);
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  width: 100%;
  max-width: 780px;
  max-height: 92vh;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: modal-in 240ms var(--ease);
}

@keyframes modal-in {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to { opacity: 1; transform: none; }
}

.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.head-title { display: flex; align-items: center; gap: 12px; }

.head-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius);
  background: var(--brand-soft);
  color: var(--brand);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.modal-head h2 { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; margin-bottom: 2px; }

.modal-close {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--text-2);
  transition: background var(--duration) var(--ease);
}
.modal-close:hover { background: var(--surface-2); }

.modal-body {
  padding: 22px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
  flex: 1;
}

.date-range {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 140px;
}

.field label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.range-arrow {
  font-size: 18px;
  color: var(--text-3);
  padding-bottom: 8px;
}

.generate-btn {
  height: 40px;
}

.form-error {
  font-size: 13px;
  color: var(--danger);
  padding: 10px 14px;
  background: var(--danger-soft);
  border-radius: 8px;
}

.report-summary {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}

.summary-card {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 18px;
}

.summary-label {
  font-size: 11px;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 6px;
}

.summary-val {
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.summary-val.money { color: var(--money); }

.monthly-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.monthly-table th {
  text-align: left;
  padding: 10px 14px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-3);
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
}

.monthly-table td {
  padding: 8px 14px;
  color: var(--text-2);
  border-bottom: 1px solid var(--border);
}

.monthly-table tfoot td {
  border-bottom: none;
  border-top: 2px solid var(--border-strong);
  color: var(--text);
  padding-top: 12px;
  padding-bottom: 12px;
}

.monthly-table tbody tr:hover td { background: var(--surface-2); }
.monthly-table .row-empty td { color: var(--text-3); }
.ta-right { text-align: right; }
.dim { color: var(--text-3); text-transform: capitalize; }

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 22px;
  border-top: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
  flex-wrap: wrap;
}

@media (max-width: 900px) {
  .stats-grid { grid-template-columns: 1fr; }
  .product-bar-wrap { display: none; }
  .product-row { grid-template-columns: 24px 1fr auto auto; }
  .date-range { flex-direction: column; align-items: stretch; }
  .range-arrow { display: none; }
  .report-summary { grid-template-columns: 1fr; }
}
</style>