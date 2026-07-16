<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCategoriesStore } from '../../stores/categories'
import { useProductsStore } from '../../stores/products'
import { formatMoney, type Category, type Product } from '../../db'
import { CATEGORY_COLORS } from '../../db/seed'
import { Plus, Pencil, Trash2, X, Search, Package, AlertTriangle } from 'lucide-vue-next'

const categoriesStore = useCategoriesStore()
const productsStore = useProductsStore()

const selectedCategoryId = ref<string | null>(null)
const search = ref('')

// Modals
const catModal = ref<{ open: boolean; cat: Category | null }>({ open: false, cat: null })
const prodModal = ref<{ open: boolean; prod: Product | null }>({ open: false, prod: null })

// Form state
const catForm = ref({ name: '', color: CATEGORY_COLORS[0] })
const prodForm = ref({
  name: '',
  priceText: '',
  categoryId: '',
  // Stock tracking
  trackStock: false,
  autoDeductOnSale: false,
  stockUnit: 'PIECE' as 'PIECE' | 'KG',
  initialStockText: '',
  lowStockThresholdText: ''
})
const formError = ref<string | null>(null)

onMounted(async () => {
  await Promise.all([categoriesStore.load(), productsStore.load()])
  if (categoriesStore.sorted.length > 0) {
    selectedCategoryId.value = categoriesStore.sorted[0].id
  }
})

const selectedCategory = computed(() =>
  selectedCategoryId.value ? categoriesStore.byId(selectedCategoryId.value) : null
)

const filteredProducts = computed(() => {
  if (!selectedCategoryId.value) return []
  return productsStore.search(search.value, selectedCategoryId.value)
})

const categoryStats = computed(() => {
  const stats = new Map<string, number>()
  for (const p of productsStore.products) {
    stats.set(p.categoryId, (stats.get(p.categoryId) ?? 0) + 1)
  }
  return stats
})

function formatStock(qty: number, unit: 'PIECE' | 'KG'): string {
  if (unit === 'KG') return qty.toFixed(2) + ' kg'
  return String(Math.round(qty)) + ' cope'
}

// ─── Category CRUD ───
function openNewCategory() {
  catForm.value = { name: '', color: CATEGORY_COLORS[0] }
  formError.value = null
  catModal.value = { open: true, cat: null }
}

function openEditCategory(cat: Category) {
  catForm.value = { name: cat.name, color: cat.color }
  formError.value = null
  catModal.value = { open: true, cat }
}

async function saveCategory() {
  formError.value = null
  const name = catForm.value.name.trim()
  if (!name) {
    formError.value = 'Emri është i nevojshëm'
    return
  }
  try {
    if (catModal.value.cat) {
      await categoriesStore.update(catModal.value.cat.id, {
        name,
        color: catForm.value.color
      })
    } else {
      const created = await categoriesStore.create({
        name,
        color: catForm.value.color
      })
      selectedCategoryId.value = created.id
    }
    catModal.value = { open: false, cat: null }
  } catch (e) {
    formError.value = (e as Error).message
  }
}

async function deleteCategory(cat: Category) {
  if (!confirm(`Fshi kategorinë "${cat.name}"?`)) return
  try {
    await categoriesStore.remove(cat.id)
    if (selectedCategoryId.value === cat.id) {
      selectedCategoryId.value = categoriesStore.sorted[0]?.id ?? null
    }
  } catch (e) {
    alert((e as Error).message)
  }
}

// ─── Product CRUD ───
function openNewProduct() {
  if (!selectedCategoryId.value) {
    alert('Krijoni një kategori së pari')
    return
  }
  prodForm.value = {
    name: '',
    priceText: '',
    categoryId: selectedCategoryId.value,
    trackStock: false,
    autoDeductOnSale: false,
    stockUnit: 'PIECE',
    initialStockText: '',
    lowStockThresholdText: ''
  }
  formError.value = null
  prodModal.value = { open: true, prod: null }
}

function openEditProduct(prod: Product) {
  const p = prod as any // fields e reja mund te mos jene ne type Product ende
  prodForm.value = {
    name: prod.name,
    priceText: (prod.price / 100).toFixed(2),
    categoryId: prod.categoryId,
    trackStock: p.trackStock ?? false,
    autoDeductOnSale: p.autoDeductOnSale ?? false,
    stockUnit: (p.stockUnit ?? 'PIECE') as 'PIECE' | 'KG',
    initialStockText: p.stockQuantity != null ? String(p.stockQuantity) : '',
    lowStockThresholdText: p.lowStockThreshold != null ? String(p.lowStockThreshold) : ''
  }
  formError.value = null
  prodModal.value = { open: true, prod }
}

async function saveProduct() {
  formError.value = null
  const name = prodForm.value.name.trim()
  if (!name) {
    formError.value = 'Emri është i nevojshëm'
    return
  }
  const priceNum = parseFloat(prodForm.value.priceText.replace(',', '.'))
  if (Number.isNaN(priceNum) || priceNum < 0) {
    formError.value = 'Çmim i pavlefshëm'
    return
  }
  const priceCents = Math.round(priceNum * 100)

  // Stock fields
  const trackStock = prodForm.value.trackStock
  const autoDeductOnSale = trackStock && prodForm.value.autoDeductOnSale
  const stockUnit = trackStock ? prodForm.value.stockUnit : null
  const stockQuantity = trackStock
    ? parseFloat(prodForm.value.initialStockText.replace(',', '.')) || 0
    : 0
  const lowStockThreshold = trackStock
    ? parseFloat(prodForm.value.lowStockThresholdText.replace(',', '.')) || 0
    : 0

  const payload: any = {
    name,
    price: priceCents,
    categoryId: prodForm.value.categoryId,
    trackStock,
    autoDeductOnSale,
    stockUnit,
    lowStockThreshold
  }

  // Vetem per produkt te ri e dergojme stockQuantity fillestar
  // (per update, stoku ndryshohet vetem me endpoint adjust-stock ne StockView)
  if (!prodModal.value.prod) {
    payload.stockQuantity = stockQuantity
  }

  if (prodModal.value.prod) {
    await productsStore.update(prodModal.value.prod.id, payload)
  } else {
    await productsStore.create(payload)
  }
  prodModal.value = { open: false, prod: null }
}

async function deleteProduct(prod: Product) {
  if (!confirm(`Fshi produktin "${prod.name}"?`)) return
  await productsStore.remove(prod.id)
}

function closeCatModal() {
  catModal.value = { open: false, cat: null }
}

function closeProdModal() {
  prodModal.value = { open: false, prod: null }
}
</script>

<template>
  <div class="page">
    <!-- Page header -->
    <header class="page-head">
      <div>
        <p class="eyebrow">Menaxhim</p>
        <h1>Menyja</h1>
      </div>
    </header>

    <!-- Two-column body -->
    <div class="body">
      <!-- LEFT: Categories sidebar -->
      <aside class="cats">
        <header class="cats-head">
          <h2>Kategoritë <span class="count">{{ categoriesStore.sorted.length }}</span></h2>
          <button class="k-btn k-btn--subtle k-btn--sm" @click="openNewCategory">
            <Plus :size="14" />
            Shto
          </button>
        </header>

        <div class="cats-list">
          <button v-for="cat in categoriesStore.sorted" :key="cat.id" class="cat-item"
            :class="{ active: selectedCategoryId === cat.id }"
            @click="selectedCategoryId = cat.id">
            <span class="cat-color" :style="{ background: cat.color }"></span>
            <span class="cat-name">{{ cat.name }}</span>
            <span class="cat-count">{{ categoryStats.get(cat.id) ?? 0 }}</span>
            <div class="cat-actions">
              <button class="row-btn" @click.stop="openEditCategory(cat)" title="Ndrysho">
                <Pencil :size="13" />
              </button>
              <button class="row-btn row-btn--danger" @click.stop="deleteCategory(cat)" title="Fshij">
                <Trash2 :size="13" />
              </button>
            </div>
          </button>

          <div v-if="categoriesStore.sorted.length === 0" class="k-empty">
            <p>Asnjë kategori. Krijo një për të filluar.</p>
          </div>
        </div>
      </aside>

      <!-- RIGHT: Products of selected category -->
      <section class="prods">
        <header class="prods-head">
          <div class="prods-head-left">
            <h2 v-if="selectedCategory">
              <span class="prods-color" :style="{ background: selectedCategory.color }"></span>
              {{ selectedCategory.name }}
            </h2>
            <h2 v-else>Zgjidh një kategori</h2>
            <span class="count" v-if="selectedCategory">
              {{ filteredProducts.length }} produkte
            </span>
          </div>

          <div class="prods-head-right">
            <div class="search">
              <Search :size="14" />
              <input v-model="search" placeholder="Kërko..." />
            </div>
            <button class="k-btn k-btn--primary k-btn--sm" @click="openNewProduct"
              :disabled="!selectedCategory">
              <Plus :size="14" />
              Shto produkt
            </button>
          </div>
        </header>

        <div class="prods-list">
          <div v-if="filteredProducts.length > 0" class="prods-table">
            <div v-for="prod in filteredProducts" :key="prod.id" class="prod-row">
              <div class="prod-name">
                {{ prod.name }}
                <span v-if="(prod as any).trackStock" class="stock-badge"
                  :class="{ 'stock-badge--low': (prod as any).stockQuantity <= (prod as any).lowStockThreshold }">
                  <Package v-if="(prod as any).stockQuantity > (prod as any).lowStockThreshold" :size="10" />
                  <AlertTriangle v-else :size="10" />
                  {{ formatStock((prod as any).stockQuantity, (prod as any).stockUnit) }}
                </span>
              </div>
              <div class="prod-price tabular">{{ formatMoney(prod.price) }}</div>
              <div class="prod-actions">
                <button class="row-btn" @click="openEditProduct(prod)" title="Ndrysho">
                  <Pencil :size="14" />
                </button>
                <button class="row-btn row-btn--danger" @click="deleteProduct(prod)" title="Fshij">
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
          </div>

          <div v-else-if="selectedCategory" class="k-empty">
            <p v-if="search">Asnjë produkt për "{{ search }}"</p>
            <p v-else>Asnjë produkt në këtë kategori</p>
          </div>

          <div v-else class="k-empty">
            <p>Zgjidh një kategori nga e majta për të parë produktet</p>
          </div>
        </div>
      </section>
    </div>

    <!-- ─── Category Modal ─── -->
    <div v-if="catModal.open" class="modal-bg" @click.self="closeCatModal">
      <div class="modal">
        <header class="modal-head">
          <h2>{{ catModal.cat ? 'Ndrysho kategorinë' : 'Kategori e re' }}</h2>
          <button class="modal-close" @click="closeCatModal">
            <X :size="18" />
          </button>
        </header>

        <form class="modal-body" @submit.prevent="saveCategory">
          <div class="field">
            <label>Emri</label>
            <input v-model="catForm.name" class="k-input" placeholder="psh. Kafe" autofocus />
          </div>

          <div class="field">
            <label>Ngjyra</label>
            <div class="color-swatches">
              <button v-for="c in CATEGORY_COLORS" :key="c" type="button" class="swatch"
                :class="{ selected: catForm.color === c }" :style="{ background: c }"
                @click="catForm.color = c" :aria-label="c"></button>
            </div>
          </div>

          <p v-if="formError" class="form-error">{{ formError }}</p>

          <div class="modal-actions">
            <button type="button" class="k-btn k-btn--ghost" @click="closeCatModal">
              Anulo
            </button>
            <button type="submit" class="k-btn k-btn--primary">
              {{ catModal.cat ? 'Ruaj ndryshimet' : 'Krijo' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ─── Product Modal ─── -->
    <div v-if="prodModal.open" class="modal-bg" @click.self="closeProdModal">
      <div class="modal modal--wide">
        <header class="modal-head">
          <h2>{{ prodModal.prod ? 'Ndrysho produktin' : 'Produkt i ri' }}</h2>
          <button class="modal-close" @click="closeProdModal">
            <X :size="18" />
          </button>
        </header>

        <form class="modal-body" @submit.prevent="saveProduct">
          <div class="field">
            <label>Emri</label>
            <input v-model="prodForm.name" class="k-input" placeholder="psh. Espresso" autofocus />
          </div>

          <div class="field-row">
            <div class="field">
              <label>Çmimi (€)</label>
              <input v-model="prodForm.priceText" class="k-input" placeholder="0.00" inputmode="decimal" />
            </div>

            <div class="field">
              <label>Kategoria</label>
              <select v-model="prodForm.categoryId" class="k-input">
                <option v-for="cat in categoriesStore.sorted" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
            </div>
          </div>

          <!-- Stock tracking section -->
          <div class="stock-section">
            <label class="checkbox-row">
              <input type="checkbox" v-model="prodForm.trackStock" />
              <div>
                <p class="checkbox-title">
                  <Package :size="14" />
                  Gjurmo stokun për këtë produkt
                </p>
                <p class="checkbox-hint">Për pije të paketuara, ushqim, alkool</p>
              </div>
            </label>

            <div v-if="prodForm.trackStock" class="stock-fields">
              <div class="field-row">
                <div class="field">
                  <label>Njësia</label>
                  <select v-model="prodForm.stockUnit" class="k-input">
                    <option value="PIECE">Copë / Shishe</option>
                    <option value="KG">Kilogramë</option>
                  </select>
                </div>

                <div v-if="!prodModal.prod" class="field">
                  <label>Stoku fillestar</label>
                  <input v-model="prodForm.initialStockText" class="k-input"
                    placeholder="0" inputmode="decimal" />
                </div>

                <div class="field">
                  <label>Limiti i ulët</label>
                  <input v-model="prodForm.lowStockThresholdText" class="k-input"
                    placeholder="0" inputmode="decimal" />
                </div>
              </div>

              <label class="checkbox-row checkbox-row--nested">
                <input type="checkbox" v-model="prodForm.autoDeductOnSale"
                  :disabled="prodForm.stockUnit === 'KG'" />
                <div>
                  <p class="checkbox-title">Zbrit automatikisht në shitje</p>
                  <p class="checkbox-hint" v-if="prodForm.stockUnit === 'PIECE'">
                    Për çdo shitje, stoku pakësohet me 1 (rekomandohet për pije)
                  </p>
                  <p class="checkbox-hint" v-else>
                    Kilogramët zbriten vetëm me recetë (së shpejti)
                  </p>
                </div>
              </label>
            </div>
          </div>

          <p v-if="formError" class="form-error">{{ formError }}</p>

          <div class="modal-actions">
            <button type="button" class="k-btn k-btn--ghost" @click="closeProdModal">
              Anulo
            </button>
            <button type="submit" class="k-btn k-btn--primary">
              {{ prodModal.prod ? 'Ruaj ndryshimet' : 'Krijo' }}
            </button>
          </div>
        </form>
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
  gap: 22px;
  overflow: hidden;
}

.page-head { flex-shrink: 0; }
.page-head .eyebrow { margin-bottom: 4px; }
.page-head h1 {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

/* ─── Body ─── */
.body {
  flex: 1;
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 16px;
  overflow: hidden;
}

/* ─── Categories sidebar ─── */
.cats {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.cats-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}

.cats-head h2 {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--text-3);
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.count {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 2px 8px;
  background: var(--surface-2);
  border-radius: var(--radius-full);
  color: var(--text-2);
  text-transform: none;
  letter-spacing: 0;
}

.cats-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cat-item {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text);
  text-align: left;
  transition: background var(--duration) var(--ease);
  position: relative;
}

.cat-item:hover { background: var(--surface-2); }
.cat-item.active { background: var(--brand-soft); }

.cat-color {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cat-name {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cat-count {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-3);
}

.cat-actions { display: none; gap: 4px; }
.cat-item:hover .cat-actions { display: flex; }

/* ─── Products area ─── */
.prods {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.prods-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  gap: 16px;
  flex-wrap: wrap;
}

.prods-head-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.prods-head h2 {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.prods-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.prods-head-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-3);
  transition: border-color var(--duration) var(--ease);
}
.search:focus-within { border-color: var(--brand); color: var(--text); }

.search input {
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font-size: 13px;
  width: 160px;
}
.search input::placeholder { color: var(--text-3); }

.prods-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.prods-table {
  display: flex;
  flex-direction: column;
}

.prod-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 16px;
  align-items: center;
  padding: 12px 18px;
  border-bottom: 1px solid var(--border);
  transition: background var(--duration) var(--ease);
}

.prod-row:hover { background: var(--surface-2); }
.prod-row:last-child { border-bottom: none; }

.prod-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.stock-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-mono);
}

.stock-badge--low {
  background: var(--danger-soft);
  color: var(--danger);
}

.prod-price {
  font-size: 14px;
  font-weight: 600;
  color: var(--money);
  font-variant-numeric: tabular-nums;
}

.prod-actions { display: flex; gap: 4px; }

.row-btn {
  width: 30px;
  height: 30px;
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

/* ─── Modal ─── */
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
  max-width: 460px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  animation: modal-in 240ms var(--ease);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal--wide { max-width: 560px; }

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

.modal-head h2 {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
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
  overflow-y: auto;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.field label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
}

.field-row {
  display: flex;
  gap: 12px;
}

select.k-input {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3e%3cpath d='M1 1L5 5L9 1' stroke='%239BA6B2' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 14px center;
  padding-right: 36px;
}

.color-swatches {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 6px;
}

.swatch {
  aspect-ratio: 1;
  border-radius: 8px;
  position: relative;
  transition: transform var(--duration) var(--ease);
}

.swatch:hover { transform: scale(1.08); }

.swatch.selected::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 8px;
  border: 2px solid var(--text);
  box-shadow: 0 0 0 2px var(--surface);
}

/* Stock section */
.stock-section {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px;
  background: var(--surface-2);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.checkbox-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
}

.checkbox-row input[type="checkbox"] {
  width: 18px;
  height: 18px;
  margin-top: 2px;
  accent-color: var(--brand);
  cursor: pointer;
}

.checkbox-row--nested {
  padding-top: 12px;
  border-top: 1px dashed var(--border);
}

.checkbox-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.checkbox-hint {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 2px;
}

.stock-fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-left: 28px;
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

/* ─── Responsive ─── */
@media (max-width: 900px) {
  .body { grid-template-columns: 1fr; }
  .cats { max-height: 240px; }
  .field-row { flex-direction: column; }
}
</style>