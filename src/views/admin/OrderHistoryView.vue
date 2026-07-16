<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '../../api/client'
import { useCategoriesStore } from '../../stores/categories'
import { useTablesStore } from '../../stores/tables'
import { useOrdersStore, type Order } from '../../stores/orders'
import { Search, ChevronDown, ChevronUp } from 'lucide-vue-next'

const categoriesStore = useCategoriesStore()
const tablesStore = useTablesStore()
const ordersStore = useOrdersStore()

const orders = ref<Order[]>([])
const search = ref('')
const filterStatus = ref<'all' | 'paid' | 'cancelled'>('all')
const filterDate = ref('')
const expandedId = ref<string | null>(null)

function formatMoney(cents: number): string {
  return '€ ' + (cents / 100).toFixed(2)
}

onMounted(async () => {
  await Promise.all([
    categoriesStore.load(),
    tablesStore.load()
  ])
  // Merr historiken nga backend
  orders.value = await api.get<Order[]>('/reports/history')
})

function tableName(id: string): string {
  return tablesStore.byId(id)?.name ?? id
}

function formatTs(ts?: number | null): string {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleDateString('sq-AL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' })
}

function formatDateOnly(ts?: number | null): string {
  if (!ts) return ''
  return new Date(ts).toISOString().slice(0, 10)
}

const filtered = computed(() => {
  let list = orders.value

  if (filterStatus.value !== 'all') {
    list = list.filter(o => o.status === filterStatus.value)
  }

  if (filterDate.value) {
    list = list.filter(o => formatDateOnly(o.closedAt) === filterDate.value)
  }

  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    list = list.filter(o =>
      tableName(o.tableId).toLowerCase().includes(q) ||
      o.items.some(i => i.name.toLowerCase().includes(q))
    )
  }

  return list
})

const totalFiltered = computed(() =>
  filtered.value.filter(o => o.status === 'paid').reduce((s, o) => s + o.total, 0)
)

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

function payMethod(o: Order): string {
  if (o.paymentMethod === 'cash') return 'Kesh'
  if (o.paymentMethod === 'card') return 'Kartë'
  return '—'
}
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Analitikë</p>
        <h1>Historia e porosive</h1>
      </div>
    </header>

    <!-- Filters -->
    <div class="filters">
      <div class="search-box">
        <Search :size="15" />
        <input v-model="search" placeholder="Kërko tavolinë ose produkt..." />
      </div>

      <div class="filter-tabs">
        <button :class="['tab', filterStatus === 'all' && 'tab--active']" @click="filterStatus = 'all'">
          Të gjitha
        </button>
        <button :class="['tab', filterStatus === 'paid' && 'tab--active']" @click="filterStatus = 'paid'">
          Të paguara
        </button>
        <button :class="['tab', filterStatus === 'cancelled' && 'tab--active']" @click="filterStatus = 'cancelled'">
          Të anuluara
        </button>
      </div>

      <input type="date" v-model="filterDate" class="date-input" />
    </div>

    <!-- Summary -->
    <div class="summary">
      <div class="summary-item">
        <span class="summary-label">Porosi</span>
        <span class="summary-val">{{ filtered.length }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Total i paguar</span>
        <span class="summary-val money">{{ formatMoney(totalFiltered) }}</span>
      </div>
    </div>

    <!-- Orders list -->
    <div class="orders k-card">
      <div v-if="filtered.length === 0" class="k-empty">
        <p>Nuk u gjet asnjë porosi</p>
      </div>

      <div v-for="order in filtered" :key="order.id" class="order-row">
        <!-- Header row -->
        <div class="order-head" @click="toggleExpand(order.id)">
          <div class="order-head-left">
            <span class="order-table">{{ tableName(order.tableId) }}</span>
            <span :class="['order-status', order.status === 'paid' ? 'status--paid' : 'status--cancelled']">
              {{ order.status === 'paid' ? 'E paguar' : 'E anuluar' }}
            </span>
            <span class="order-method">{{ payMethod(order) }}</span>
          </div>
          <div class="order-head-right">
            <span class="order-time">{{ formatTs(order.closedAt) }}</span>
            <span class="order-total mono">{{ formatMoney(order.total) }}</span>
            <component :is="expandedId === order.id ? ChevronUp : ChevronDown" :size="16" class="order-chevron" />
          </div>
        </div>

        <!-- Expanded items -->
        <div v-if="expandedId === order.id" class="order-items">
          <div v-for="(item, i) in order.items" :key="i" class="order-item">
            <span class="item-qty">×{{ item.quantity }}</span>
            <span class="item-name">{{ item.name }}</span>
            <span v-if="item.comment" class="item-comment">{{ item.comment }}</span>
            <span class="item-price mono">{{ formatMoney(item.price * item.quantity) }}</span>
          </div>
          <div class="order-item-total">
            <span>Totali</span>
            <span class="mono">{{ formatMoney(order.total) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 24px 28px;
  gap: 18px;
  overflow: hidden;
}

.page-head .eyebrow { margin-bottom: 4px; }
.page-head h1 { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; }

/* Filters */
.filters {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-3);
  flex: 1;
  min-width: 200px;
  transition: border-color var(--duration) var(--ease);
}
.search-box:focus-within { border-color: var(--brand); }
.search-box input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font-size: 14px;
}
.search-box input::placeholder { color: var(--text-3); }

.filter-tabs { display: flex; gap: 6px; }

.tab {
  height: 40px;
  padding: 0 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 500;
  transition: all var(--duration) var(--ease);
}
.tab:hover { background: var(--surface-2); color: var(--text); }
.tab--active { background: var(--brand-soft); border-color: var(--brand-line); color: var(--text); }

.date-input {
  height: 40px;
  padding: 0 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 13px;
  outline: none;
  font-family: var(--font-mono);
}
.date-input:focus { border-color: var(--brand); }

/* Summary */
.summary {
  display: flex;
  gap: 20px;
  flex-shrink: 0;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.summary-label { font-size: 13px; color: var(--text-2); }
.summary-val { font-size: 20px; font-weight: 700; color: var(--text); }
.summary-val.money { color: var(--money); font-variant-numeric: tabular-nums; }

/* Orders */
.orders {
  flex: 1;
  overflow-y: auto;
}

.order-row {
  border-bottom: 1px solid var(--border);
}
.order-row:last-child { border-bottom: none; }

.order-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  cursor: pointer;
  transition: background var(--duration) var(--ease);
  gap: 16px;
}
.order-head:hover { background: var(--surface-2); }

.order-head-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.order-table {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}

.order-status {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: var(--radius-full);
}
.status--paid { background: var(--money-soft); color: var(--money); }
.status--cancelled { background: var(--danger-soft); color: var(--danger); }

.order-method {
  font-size: 12px;
  color: var(--text-3);
  font-family: var(--font-mono);
}

.order-head-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.order-time { font-size: 12px; color: var(--text-3); }
.order-total { font-size: 16px; font-weight: 700; color: var(--text); }
.order-chevron { color: var(--text-3); }

/* Expanded items */
.order-items {
  padding: 0 18px 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--surface-2);
}

.order-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--surface);
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.item-qty {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-3);
  min-width: 28px;
}
.item-name { flex: 1; color: var(--text); font-weight: 500; }
.item-comment {
  font-size: 11px;
  color: var(--text-3);
  font-style: italic;
  background: var(--surface-2);
  padding: 2px 8px;
  border-radius: 6px;
}
.item-price { color: var(--money); font-weight: 600; }

.order-item-total {
  display: flex;
  justify-content: space-between;
  padding: 10px 12px 4px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  border-top: 1px solid var(--border);
  margin-top: 4px;
}
</style>