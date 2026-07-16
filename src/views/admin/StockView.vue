<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useProductsStore, type Product } from '../../stores/products'
import { useCategoriesStore } from '../../stores/categories'
import { Package, AlertTriangle, Plus, Minus, Edit3, X, Search, Filter, Sparkles } from 'lucide-vue-next'
import ProductFormModal from '../../components/ProductFormModal.vue'
import DeliveryModal from '../../components/DeliveryModal.vue'
import { Truck } from 'lucide-vue-next'


const productsStore = useProductsStore()
const categoriesStore = useCategoriesStore()

const search = ref('')
const filter = ref<'all' | 'low'>('all')

// Modals
const addStockModal = ref<{ open: boolean; prod: Product | null }>({ open: false, prod: null })
const setStockModal = ref<{ open: boolean; prod: Product | null }>({ open: false, prod: null })
const addStockForm = ref({ delta: '', reason: '' })
const setStockForm = ref({ quantity: '' })
const formError = ref<string | null>(null)
const saving = ref(false)

onMounted(async () => {
  await Promise.all([
    categoriesStore.load(),
    productsStore.load()
  ])
  // Reload gjithmone qe te kemi stok te freskt
  await productsStore.reload()
})

// Krejt produktet qe gjurmojne stokun
const stockProducts = computed(() =>
  productsStore.products.filter(p => p.trackStock)
)

const newProductModal = ref(false)

const deliveryModal = ref(false)

// AI Scan
const scanning = ref(false)
const scanError = ref<string | null>(null)
const prefillData = ref<any>(null)
const fileInput = ref<HTMLInputElement | null>(null)

function triggerFilePicker() {
  fileInput.value?.click()
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  scanError.value = null
  scanning.value = true

  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('http://localhost:8080/api/ai/invoice/scan', {
      method: 'POST',
      body: formData
    })

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Skanimi dështoi')
    }

    // Konverto response-in ne format qe DeliveryModal e kupton
    const extracted = result.extracted
    prefillData.value = {
      supplierId: extracted.supplierId,
      supplierName: extracted.supplierName,
      deliveryDate: extracted.deliveryDate,
      documentRef: extracted.documentRef,
      items: extracted.items.map((item: any) => ({
        productId: item.productId,
        extractedName: item.extractedName,
        quantity: item.quantity,
        unit: item.unit,
        unitPriceEur: item.unitPriceEur,
        matchConfidence: item.matchConfidence
      })),
       fileBase64: result.fileBase64,
      fileName: result.fileName,
      contentType: result.contentType
    }

    // Hape delivery modal me prefill
    deliveryModal.value = true
  } catch (e) {
    scanError.value = (e as Error).message
    alert('Gabim gjatë skanimit: ' + (e as Error).message)
  } finally {
    scanning.value = false
    // Reset file input qe te mund te riperdoret
    if (input) input.value = ''
  }
}

function onDeliveryClosed() {
  deliveryModal.value = false
  prefillData.value = null
}

function openDelivery() {
  deliveryModal.value = true
}

async function onDeliverySaved() {
  await productsStore.reload()
}

function openNewProduct() {
  newProductModal.value = true
}

async function onProductSaved() {
  await productsStore.reload()
}

const filteredProducts = computed(() => {
  let list = stockProducts.value

  // Filter i uleti
  if (filter.value === 'low') {
    list = list.filter(p => p.stockQuantity <= p.lowStockThreshold)
  }

  // Search
  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (categoriesStore.byId(p.categoryId)?.name.toLowerCase() ?? '').includes(q)
    )
  }

  return list.sort((a, b) => a.name.localeCompare(b.name))
})

const lowStockCount = computed(() =>
  stockProducts.value.filter(p => p.stockQuantity <= p.lowStockThreshold).length
)

function catName(id: string): string {
  return categoriesStore.byId(id)?.name ?? '—'
}

function catColor(id: string): string {
  return categoriesStore.byId(id)?.color ?? '#5BC4B8'
}

function formatStock(qty: number, unit: string | null): string {
  if (unit === 'KG') return qty.toFixed(2) + ' kg'
  return String(Math.round(qty)) + ' cope'
}

function isLow(p: Product): boolean {
  return p.stockQuantity <= p.lowStockThreshold
}

// ─── Add stock modal ───
function openAddStock(prod: Product) {
  addStockForm.value = { delta: '', reason: '' }
  formError.value = null
  addStockModal.value = { open: true, prod }
}

function closeAddStock() {
  addStockModal.value = { open: false, prod: null }
}

async function saveAddStock() {
  if (!addStockModal.value.prod) return
  const delta = parseFloat(addStockForm.value.delta.replace(',', '.'))
  if (Number.isNaN(delta) || delta <= 0) {
    formError.value = 'Sasia duhet të jetë numër pozitiv'
    return
  }
  saving.value = true
  try {
    await productsStore.adjustStock(addStockModal.value.prod.id, delta)
    closeAddStock()
  } catch (e) {
    formError.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

// ─── Set stock modal ───
function openSetStock(prod: Product) {
  setStockForm.value = { quantity: String(prod.stockQuantity) }
  formError.value = null
  setStockModal.value = { open: true, prod }
}

function closeSetStock() {
  setStockModal.value = { open: false, prod: null }
}

async function saveSetStock() {
  if (!setStockModal.value.prod) return
  const qty = parseFloat(setStockForm.value.quantity.replace(',', '.'))
  if (Number.isNaN(qty) || qty < 0) {
    formError.value = 'Sasia duhet të jetë numër ≥ 0'
    return
  }
  saving.value = true
  try {
    await productsStore.setStock(setStockModal.value.prod.id, qty)
    closeSetStock()
  } catch (e) {
    formError.value = (e as Error).message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page">
    <!-- Page header -->
    <header class="page-head">
      <div>
        <p class="eyebrow">Menaxhim</p>
        <h1>Stoku</h1>
      </div>
      <div class="head-stats">
        <div class="stat-pill">
          <Package :size="14" />
          <span>{{ stockProducts.length }} produkte të gjurmuara</span>
        </div>
        <div v-if="lowStockCount > 0" class="stat-pill stat-pill--warn">
          <AlertTriangle :size="14" />
          <span>{{ lowStockCount }} me stok të ulët</span>
        </div>
      </div>
    </header>

    <!-- Controls -->
   <!-- Controls -->
<div class="controls">
  <div class="search-box">
    <Search :size="16" />
    <input v-model="search" placeholder="Kërko produkt ose kategori..." />
  </div>

  <div class="filter-tabs">
    <button class="filter-tab" :class="{ active: filter === 'all' }" @click="filter = 'all'">
      Të gjitha
      <span class="count">{{ stockProducts.length }}</span>
    </button>
    <button class="filter-tab" :class="{ active: filter === 'low' }" @click="filter = 'low'">
      <AlertTriangle :size="12" />
      Stoku i ulët
      <span class="count">{{ lowStockCount }}</span>
    </button>
  </div>

 <div class="head-actions" style="margin-left: auto; display: flex; gap: 8px;">
  <button class="k-btn k-btn--ai" @click="triggerFilePicker" :disabled="scanning">
    <Sparkles :size="16" />
    {{ scanning ? 'AI po skanon...' : 'Skano fletë' }}
  </button>
  <button class="k-btn k-btn--ghost" @click="openDelivery">
    <Truck :size="16" />
    Dorëzim i ri
  </button>
  <button class="k-btn k-btn--primary" @click="openNewProduct">
    <Plus :size="16" />
    Shto produkt
  </button>
</div>

<!-- Hidden file input -->
<input
  ref="fileInput"
  type="file"
  accept="application/pdf,image/*"
  style="display: none;"
  @change="onFileSelected"
/>
</div>

    <!-- Table -->
    <div v-if="filteredProducts.length > 0" class="stock-table k-card">
      <div class="table-head">
        <div>Produkti</div>
        <div>Kategoria</div>
        <div>Njësia</div>
        <div class="ta-right">Stoku aktual</div>
        <div class="ta-right">Limiti i ulët</div>
        <div class="ta-right">Veprime</div>
      </div>

      <div v-for="p in filteredProducts" :key="p.id" class="table-row"
        :class="{ 'table-row--low': isLow(p) }">
        <div class="prod-cell">
          <span class="prod-name">{{ p.name }}</span>
          <span v-if="p.autoDeductOnSale" class="auto-badge" title="Zbritet automatikisht në shitje">
            Auto ↓
          </span>
        </div>
        <div>
          <span class="cat-tag">
            <span class="cat-dot" :style="{ background: catColor(p.categoryId) }"></span>
            {{ catName(p.categoryId) }}
          </span>
        </div>
        <div class="mono">{{ p.stockUnit === 'KG' ? 'kg' : 'copë' }}</div>
        <div class="ta-right">
          <span class="stock-val mono" :class="{ 'stock-val--low': isLow(p) }">
            <AlertTriangle v-if="isLow(p)" :size="12" />
            {{ formatStock(p.stockQuantity, p.stockUnit) }}
          </span>
        </div>
        <div class="ta-right mono dim">{{ formatStock(p.lowStockThreshold, p.stockUnit) }}</div>
        <div class="ta-right actions">
          <button class="k-btn k-btn--primary k-btn--sm" @click="openAddStock(p)" title="Shto stok">
            <Plus :size="13" />
            Shto
          </button>
          <button class="k-btn k-btn--ghost k-btn--sm" @click="openSetStock(p)" title="Rregullo">
            <Edit3 :size="13" />
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="stockProducts.length === 0" class="k-empty">
      <p>Asnjë produkt nuk po gjurmohet për stok.</p>
      <p class="small">Shko te <strong>Menyja</strong> → edito një produkt → aktivizo "Gjurmo stokun".</p>
    </div>

    <div v-else class="k-empty">
      <p v-if="filter === 'low'">Nuk ka produkte me stok të ulët. 🎉</p>
      <p v-else-if="search">Asnjë produkt për "{{ search }}"</p>
    </div>

    <!-- ─── ADD STOCK MODAL ─── -->
    <div v-if="addStockModal.open" class="modal-bg" @click.self="closeAddStock">
      <div class="modal">
        <header class="modal-head">
          <div>
            <h2>Shto stok</h2>
            <p class="eyebrow">{{ addStockModal.prod?.name }}</p>
          </div>
          <button class="modal-close" @click="closeAddStock">
            <X :size="18" />
          </button>
        </header>

        <form class="modal-body" @submit.prevent="saveAddStock">
          <div class="current-info">
            <span>Stoku aktual:</span>
            <span class="mono strong">
              {{ addStockModal.prod ? formatStock(addStockModal.prod.stockQuantity, addStockModal.prod.stockUnit) : '' }}
            </span>
          </div>

          <div class="field">
            <label>
              Sasia që po shtohet ({{ addStockModal.prod?.stockUnit === 'KG' ? 'kg' : 'copë' }})
            </label>
            <input v-model="addStockForm.delta" class="k-input" placeholder="0"
              inputmode="decimal" autofocus />
          </div>

          <div v-if="addStockForm.delta && addStockModal.prod" class="preview">
            <span>Pas shtimit:</span>
            <span class="mono strong preview-val">
              {{ formatStock(
                addStockModal.prod.stockQuantity + (parseFloat(addStockForm.delta.replace(',', '.')) || 0),
                addStockModal.prod.stockUnit
              ) }}
            </span>
          </div>

          <p v-if="formError" class="form-error">{{ formError }}</p>

          <div class="modal-actions">
            <button type="button" class="k-btn k-btn--ghost" @click="closeAddStock" :disabled="saving">
              Anulo
            </button>
            <button type="submit" class="k-btn k-btn--primary" :disabled="saving">
              <Plus :size="14" />
              Shto në stok
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ─── SET STOCK MODAL ─── -->
    <div v-if="setStockModal.open" class="modal-bg" @click.self="closeSetStock">
      <div class="modal">
        <header class="modal-head">
          <div>
            <h2>Rregullo stokun</h2>
            <p class="eyebrow">{{ setStockModal.prod?.name }}</p>
          </div>
          <button class="modal-close" @click="closeSetStock">
            <X :size="18" />
          </button>
        </header>

        <form class="modal-body" @submit.prevent="saveSetStock">
          <p class="hint">
            Përdore këtë vetëm për të korrigjuar një gabim
            ose kur ke bërë inventarin fizik.
          </p>

          <div class="field">
            <label>
              Stoku i ri ({{ setStockModal.prod?.stockUnit === 'KG' ? 'kg' : 'copë' }})
            </label>
            <input v-model="setStockForm.quantity" class="k-input" placeholder="0"
              inputmode="decimal" autofocus />
          </div>

          <p v-if="formError" class="form-error">{{ formError }}</p>

          <div class="modal-actions">
            <button type="button" class="k-btn k-btn--ghost" @click="closeSetStock" :disabled="saving">
              Anulo
            </button>
            <button type="submit" class="k-btn k-btn--primary" :disabled="saving">
              Ruaj
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
  <ProductFormModal
  :open="newProductModal"
  :prod="null"
  :default-track-stock="true"
  @close="newProductModal = false"
  @saved="onProductSaved"
/>

<DeliveryModal
  :open="deliveryModal"
  :prefill="prefillData"
  @close="onDeliveryClosed"
  @saved="onDeliverySaved"
/>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  padding: 24px 28px;
  gap: 20px;
  overflow-y: auto;
  height: 100%;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  flex-wrap: wrap;
}

.page-head .eyebrow { margin-bottom: 4px; }
.page-head h1 { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; }

.head-stats {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  font-size: 12px;
  color: var(--text-2);
  font-weight: 500;
}

.stat-pill--warn {
  background: var(--danger-soft);
  border-color: var(--danger);
  color: var(--danger);
}

/* Controls */
.controls {
  display: flex;
  gap: 12px;
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
  min-width: 280px;
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

.filter-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--surface-2);
  border-radius: var(--radius);
}

.filter-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: transparent;
  border-radius: 8px;
  color: var(--text-2);
  font-size: 13px;
  font-weight: 500;
  transition: all var(--duration) var(--ease);
}

.filter-tab:hover { color: var(--text); }

.filter-tab.active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}

.filter-tab .count {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 1px 6px;
  background: var(--surface-2);
  border-radius: var(--radius-full);
  color: var(--text-3);
}

.filter-tab.active .count {
  background: var(--brand-soft);
  color: var(--brand);
}

/* Table */
.stock-table {
  padding: 0;
  overflow: visible;
}

.table-head {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1fr 1.2fr 1.2fr 1.5fr;
  gap: 16px;
  padding: 14px 20px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-3);
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
}

.table-row {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1fr 1.2fr 1.2fr 1.5fr;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  align-items: center;
  transition: background var(--duration) var(--ease);
}

.table-row:last-child { border-bottom: none; }
.table-row:hover { background: var(--surface-2); }

.table-row--low {
  background: color-mix(in oklab, var(--danger) 4%, transparent);
}
.table-row--low:hover {
  background: color-mix(in oklab, var(--danger) 7%, transparent);
}

.prod-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.prod-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.auto-badge {
  font-size: 10px;
  font-family: var(--font-mono);
  padding: 2px 6px;
  background: var(--brand-soft);
  color: var(--brand);
  border-radius: var(--radius-full);
  letter-spacing: 0.05em;
}

.cat-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-2);
}

.cat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.stock-val {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.stock-val--low {
  color: var(--danger);
}

.ta-right {
  text-align: right;
  justify-self: end;
}

.dim { color: var(--text-3); }
.strong { font-weight: 700; color: var(--text); }

.actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

/* Modal */
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
  max-width: 440px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  animation: modal-in 240ms var(--ease);
}

@keyframes modal-in {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to { opacity: 1; transform: none; }
}

.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border);
}

.modal-head h2 {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin-bottom: 2px;
}

.modal-close {
  width: 32px;
  height: 32px;
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
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.current-info, .preview {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  background: var(--surface-2);
  border-radius: var(--radius);
  font-size: 13px;
  color: var(--text-2);
}

.preview {
  background: var(--brand-soft);
  border: 1px solid var(--brand-line);
}

.preview-val {
  color: var(--brand);
  font-size: 15px;
}

.hint {
  font-size: 12px;
  color: var(--text-3);
  padding: 10px 12px;
  background: var(--surface-2);
  border-radius: 8px;
  line-height: 1.5;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
}

.form-error {
  font-size: 13px;
  color: var(--danger);
  padding: 8px 12px;
  background: var(--danger-soft);
  border-radius: 8px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}

/* Responsive */
@media (max-width: 1000px) {
  .table-head, .table-row {
    grid-template-columns: 2fr 1fr 1fr 1.5fr;
  }
  .table-head > div:nth-child(3),
  .table-head > div:nth-child(5),
  .table-row > div:nth-child(3),
  .table-row > div:nth-child(5) {
    display: none;
  }
}

@media (max-width: 700px) {
  .search-box { min-width: 100%; }
}
.k-btn--ai {
  background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
  color: white;
  border: none;
  position: relative;
  overflow: hidden;
}

.k-btn--ai:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
}

.k-btn--ai:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>