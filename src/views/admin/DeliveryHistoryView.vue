<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDeliveriesStore, type Delivery } from '../../stores/deliveries'
import { useSuppliersStore } from '../../stores/suppliers'
import { Truck, FileText, Search, Package, Calendar, Eye, Trash2, ChevronDown, ChevronRight, Filter } from 'lucide-vue-next'

const deliveriesStore = useDeliveriesStore()
const suppliersStore = useSuppliersStore()

const search = ref('')
const supplierFilter = ref<string>('')
const dateFrom = ref<string>('')
const dateTo = ref<string>('')
const expandedId = ref<string | null>(null)

onMounted(async () => {
  await Promise.all([
    deliveriesStore.load(),
    suppliersStore.load()
  ])
})

const filteredDeliveries = computed(() => {
  let list = deliveriesStore.deliveries

  if (supplierFilter.value) {
    list = list.filter(d => d.supplierId === supplierFilter.value)
  }

  if (dateFrom.value) {
    const fromMs = new Date(dateFrom.value + 'T00:00:00').getTime()
    list = list.filter(d => d.deliveryDate >= fromMs)
  }

  if (dateTo.value) {
    const toMs = new Date(dateTo.value + 'T23:59:59').getTime()
    list = list.filter(d => d.deliveryDate <= toMs)
  }

  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter(d =>
      d.supplierName.toLowerCase().includes(q) ||
      (d.documentRef?.toLowerCase() ?? '').includes(q) ||
      d.items.some(i => i.productName.toLowerCase().includes(q))
    )
  }

  return list
})

const stats = computed(() => {
  const list = filteredDeliveries.value
  const totalValue = list.reduce((sum, d) => sum + d.totalCents, 0)
  const totalItems = list.reduce((sum, d) =>
    sum + d.items.reduce((s, i) => s + i.quantity, 0), 0
  )
  const withFile = list.filter(d => !!d.invoiceFileName).length
  return {
    count: list.length,
    totalValue,
    totalItems,
    withFile
  }
})

function formatMoney(cents: number): string {
  return '€ ' + (cents / 100).toFixed(2)
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('sq-AL', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString('sq-AL', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

async function deleteDelivery(d: Delivery) {
  if (!confirm(`Fshi dorëzimin nga ${d.supplierName}?\nStoku do të zbritet automatikisht.`)) return
  try {
    await deliveriesStore.remove(d.id)
  } catch (e) {
    alert((e as Error).message)
  }
}

function viewFile(d: Delivery) {
  window.open(deliveriesStore.fileUrl(d.id), '_blank')
}

function clearFilters() {
  search.value = ''
  supplierFilter.value = ''
  dateFrom.value = ''
  dateTo.value = ''
}

const hasActiveFilters = computed(() =>
  !!(search.value || supplierFilter.value || dateFrom.value || dateTo.value)
)
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Analitikë</p>
        <h1>Historia e dorëzimeve</h1>
      </div>
    </header>

    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <p class="stat-label">Gjithsej dorëzime</p>
        <p class="stat-val">{{ stats.count }}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Vlera totale</p>
        <p class="stat-val money">{{ formatMoney(stats.totalValue) }}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Artikuj të pranuar</p>
        <p class="stat-val">{{ Math.round(stats.totalItems) }}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Me file bashkangjitur</p>
        <p class="stat-val">{{ stats.withFile }} / {{ stats.count }}</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <div class="search-box">
        <Search :size="16" />
        <input v-model="search" placeholder="Kërko sipas furnitorit, dokumentit, produktit..." />
      </div>

      <select v-model="supplierFilter" class="k-input filter-input">
        <option value="">Të gjithë furnitorët</option>
        <option v-for="s in suppliersStore.sorted" :key="s.id" :value="s.id">
          {{ s.name }}
        </option>
      </select>

      <input type="date" v-model="dateFrom" class="k-input filter-input" placeholder="Nga" />
      <input type="date" v-model="dateTo" class="k-input filter-input" placeholder="Deri" />

      <button v-if="hasActiveFilters" class="k-btn k-btn--ghost k-btn--sm" @click="clearFilters">
        Pastro
      </button>
    </div>

    <!-- List -->
    <div v-if="filteredDeliveries.length > 0" class="deliveries-list">
      <div v-for="d in filteredDeliveries" :key="d.id" class="delivery-card"
        :class="{ 'delivery-card--expanded': expandedId === d.id }">
        <div class="delivery-head" @click="toggleExpand(d.id)">
          <button class="expand-btn" :aria-label="expandedId === d.id ? 'Mbyll' : 'Hape'">
            <ChevronDown v-if="expandedId === d.id" :size="16" />
            <ChevronRight v-else :size="16" />
          </button>

          <div class="delivery-icon">
            <Truck :size="18" />
          </div>

          <div class="delivery-main">
            <div class="delivery-title">
              <h3>{{ d.supplierName }}</h3>
              <span v-if="d.documentRef" class="doc-ref">
                <FileText :size="11" />
                {{ d.documentRef }}
              </span>
              <span v-if="d.invoiceFileName" class="file-badge" title="Ka file bashkangjitur">
                <FileText :size="10" />
                PDF
              </span>
            </div>
            <div class="delivery-meta">
              <span class="meta-item">
                <Calendar :size="11" />
                {{ formatDate(d.deliveryDate) }}
              </span>
              <span class="meta-item">
                <Package :size="11" />
                {{ d.items.length }} produkte
              </span>
              <span class="meta-item mono">
                {{ Math.round(d.items.reduce((s, i) => s + i.quantity, 0)) }} artikuj
              </span>
            </div>
          </div>

          <div class="delivery-total mono">{{ formatMoney(d.totalCents) }}</div>

          <div class="delivery-actions" @click.stop>
            <button v-if="d.invoiceFileName" class="row-btn" @click="viewFile(d)" title="Shiko file">
              <Eye :size="14" />
            </button>
            <button class="row-btn row-btn--danger" @click="deleteDelivery(d)" title="Fshij">
              <Trash2 :size="14" />
            </button>
          </div>
        </div>

        <!-- Expanded details -->
        <div v-if="expandedId === d.id" class="delivery-details">
          <div class="details-meta">
            <div class="detail-item">
              <span class="detail-label">Regjistruar:</span>
              <span>{{ formatDateTime(d.createdAt) }}</span>
            </div>
            <div v-if="d.notes" class="detail-item">
              <span class="detail-label">Shënime:</span>
              <span>{{ d.notes }}</span>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Produkti</th>
                <th class="ta-center">Sasia</th>
                <th class="ta-right">Çmimi/njësi</th>
                <th class="ta-right">Vlera</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in d.items" :key="item.id">
                <td>{{ item.productName }}</td>
                <td class="ta-center mono">{{ item.quantity }}</td>
                <td class="ta-right mono">{{ formatMoney(item.unitPriceCents) }}</td>
                <td class="ta-right mono money">{{ formatMoney(item.lineTotalCents) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" class="ta-right"><strong>TOTALI</strong></td>
                <td class="ta-right mono money"><strong>{{ formatMoney(d.totalCents) }}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>

    <div v-else-if="deliveriesStore.deliveries.length === 0" class="k-empty">
      <Truck :size="32" />
      <p>Ende asnjë dorëzim nuk osht regjistru.</p>
      <p class="small">Regjistro dërgesat nga <strong>Stoku → Dorëzim i ri</strong> ose <strong>Skano fletë</strong>.</p>
    </div>

    <div v-else class="k-empty">
      <p>Asnjë dorëzim për filtrat e zgjedhur.</p>
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

.page-head .eyebrow { margin-bottom: 4px; }
.page-head h1 { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px 20px;
}

.stat-label {
  font-size: 11px;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 6px;
}

.stat-val {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
}

.stat-val.money {
  color: var(--money);
  font-variant-numeric: tabular-nums;
}

.filters {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-3);
  min-width: 260px;
  flex: 1;
  max-width: 400px;
}
.search-box:focus-within { border-color: var(--brand); color: var(--text); }
.search-box input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font-size: 14px;
}

.filter-input {
  height: 40px;
  width: auto;
  min-width: 160px;
}

select.filter-input {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3e%3cpath d='M1 1L5 5L9 1' stroke='%239BA6B2' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 14px center;
  padding-right: 36px;
}

.deliveries-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.delivery-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all var(--duration) var(--ease);
}

.delivery-card:hover { border-color: var(--border-strong); }

.delivery-card--expanded {
  border-color: var(--brand-line);
  box-shadow: var(--shadow);
}

.delivery-head {
  display: grid;
  grid-template-columns: 30px 44px 1fr auto auto;
  gap: 14px;
  align-items: center;
  padding: 14px 18px;
  cursor: pointer;
  transition: background var(--duration) var(--ease);
}

.delivery-head:hover { background: var(--surface-2); }

.expand-btn {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--text-3);
  background: transparent;
  transition: all var(--duration) var(--ease);
}
.expand-btn:hover { background: var(--surface-3); color: var(--text); }

.delivery-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius);
  background: var(--brand-soft);
  color: var(--brand);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.delivery-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.delivery-title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.delivery-title h3 {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
}

.doc-ref {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-3);
  font-family: var(--font-mono);
  padding: 2px 8px;
  background: var(--surface-2);
  border-radius: var(--radius-full);
}

.file-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: var(--brand);
  padding: 2px 6px;
  background: var(--brand-soft);
  border: 1px solid var(--brand-line);
  border-radius: var(--radius-full);
  font-weight: 600;
}

.delivery-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 12px;
  color: var(--text-3);
  flex-wrap: wrap;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.delivery-total {
  font-size: 18px;
  font-weight: 700;
  color: var(--money);
  font-variant-numeric: tabular-nums;
}

.delivery-actions {
  display: flex;
  gap: 4px;
}

.row-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
  background: transparent;
  transition: all var(--duration) var(--ease);
}
.row-btn:hover { background: var(--surface-3); color: var(--text); }
.row-btn--danger:hover { background: var(--danger-soft); color: var(--danger); }

.delivery-details {
  padding: 16px 22px 20px;
  border-top: 1px solid var(--border);
  background: var(--surface-2);
}

.details-meta {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  font-size: 12px;
}

.detail-item { display: flex; gap: 6px; }
.detail-label { color: var(--text-3); font-weight: 500; }

.items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  background: var(--surface);
  border-radius: var(--radius);
  overflow: hidden;
}

.items-table th {
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

.items-table td {
  padding: 10px 14px;
  color: var(--text-2);
  border-bottom: 1px solid var(--border);
}

.items-table tfoot td {
  border-bottom: none;
  border-top: 2px solid var(--border-strong);
  color: var(--text);
}

.money { color: var(--money); font-variant-numeric: tabular-nums; }
.ta-center { text-align: center; }
.ta-right { text-align: right; }

.k-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-3);
  gap: 8px;
  text-align: center;
}
.k-empty p { font-size: 14px; }
.k-empty .small { font-size: 12px; }

@media (max-width: 1100px) {
  .stats-grid { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 800px) {
  .delivery-head {
    grid-template-columns: 26px 40px 1fr auto;
    gap: 10px;
  }
  .delivery-total { grid-column: 2 / 4; font-size: 15px; }
  .delivery-actions { grid-column: 4; }
}
</style>