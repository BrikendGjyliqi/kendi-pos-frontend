<script setup lang="ts">
import { ref, watch } from 'vue'
import { useCategoriesStore } from '../stores/categories'
import { useProductsStore, type Product } from '../stores/products'
import { X, Package } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  prod: Product | null
  defaultCategoryId?: string | null
  defaultTrackStock?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', prod: Product): void
}>()

const categoriesStore = useCategoriesStore()
const productsStore = useProductsStore()

const form = ref({
  name: '',
  priceText: '',
  categoryId: '',
  trackStock: false,
  autoDeductOnSale: false,
  stockUnit: 'PIECE' as 'PIECE' | 'KG',
  initialStockText: '',
  lowStockThresholdText: ''
})
const formError = ref<string | null>(null)
const saving = ref(false)

watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  formError.value = null
  if (props.prod) {
    const p = props.prod as any
    form.value = {
      name: props.prod.name,
      priceText: (props.prod.price / 100).toFixed(2),
      categoryId: props.prod.categoryId,
      trackStock: p.trackStock ?? false,
      autoDeductOnSale: p.autoDeductOnSale ?? false,
      stockUnit: (p.stockUnit ?? 'PIECE') as 'PIECE' | 'KG',
      initialStockText: p.stockQuantity != null ? String(p.stockQuantity) : '',
      lowStockThresholdText: p.lowStockThreshold != null ? String(p.lowStockThreshold) : ''
    }
  } else {
    form.value = {
      name: '',
      priceText: '',
      categoryId: props.defaultCategoryId ?? categoriesStore.sorted[0]?.id ?? '',
      trackStock: props.defaultTrackStock ?? false,
      autoDeductOnSale: props.defaultTrackStock ?? false,
      stockUnit: 'PIECE',
      initialStockText: '',
      lowStockThresholdText: ''
    }
  }
}, { immediate: true })

async function save() {
  formError.value = null
  const name = form.value.name.trim()
  if (!name) {
    formError.value = 'Emri është i nevojshëm'
    return
  }
  if (!form.value.categoryId) {
    formError.value = 'Zgjidhni një kategori'
    return
  }
  const priceNum = parseFloat(form.value.priceText.replace(',', '.'))
  if (Number.isNaN(priceNum) || priceNum < 0) {
    formError.value = 'Çmim i pavlefshëm'
    return
  }
  const priceCents = Math.round(priceNum * 100)

  const trackStock = form.value.trackStock
  const autoDeductOnSale = trackStock && form.value.autoDeductOnSale
  const stockUnit = trackStock ? form.value.stockUnit : null
  const stockQuantity = trackStock
    ? parseFloat(form.value.initialStockText.replace(',', '.')) || 0
    : 0
  const lowStockThreshold = trackStock
    ? parseFloat(form.value.lowStockThresholdText.replace(',', '.')) || 0
    : 0

  const payload: any = {
    name,
    price: priceCents,
    categoryId: form.value.categoryId,
    trackStock,
    autoDeductOnSale,
    stockUnit,
    lowStockThreshold
  }

  saving.value = true
  try {
    let result: Product
    if (props.prod) {
      await productsStore.update(props.prod.id, payload)
      result = productsStore.byId(props.prod.id)!
    } else {
      payload.stockQuantity = stockQuantity
      result = await productsStore.create(payload)
    }
    emit('saved', result)
    emit('close')
  } catch (e) {
    formError.value = (e as Error).message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="open" class="modal-bg" @click.self="emit('close')">
    <div class="modal modal--wide">
      <header class="modal-head">
        <h2>{{ prod ? 'Ndrysho produktin' : 'Produkt i ri' }}</h2>
        <button class="modal-close" @click="emit('close')">
          <X :size="18" />
        </button>
      </header>

      <form class="modal-body" @submit.prevent="save">
        <div class="field">
          <label>Emri</label>
          <input v-model="form.name" class="k-input" placeholder="psh. Coca Cola" autofocus />
        </div>

        <div class="field-row">
          <div class="field">
            <label>Çmimi (€)</label>
            <input v-model="form.priceText" class="k-input" placeholder="0.00" inputmode="decimal" />
          </div>

          <div class="field">
            <label>Kategoria</label>
            <select v-model="form.categoryId" class="k-input">
              <option v-for="cat in categoriesStore.sorted" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="stock-section">
          <label class="checkbox-row">
            <input type="checkbox" v-model="form.trackStock" />
            <div>
              <p class="checkbox-title">
                <Package :size="14" />
                Gjurmo stokun për këtë produkt
              </p>
              <p class="checkbox-hint">Për pije të paketuara, ushqim, alkool</p>
            </div>
          </label>

          <div v-if="form.trackStock" class="stock-fields">
            <div class="field-row">
              <div class="field">
                <label>Njësia</label>
                <select v-model="form.stockUnit" class="k-input">
                  <option value="PIECE">Copë / Shishe</option>
                  <option value="KG">Kilogramë</option>
                </select>
              </div>

              <div v-if="!prod" class="field">
                <label>Stoku fillestar</label>
                <input v-model="form.initialStockText" class="k-input"
                  placeholder="0" inputmode="decimal" />
              </div>

              <div class="field">
                <label>Limiti i ulët</label>
                <input v-model="form.lowStockThresholdText" class="k-input"
                  placeholder="0" inputmode="decimal" />
              </div>
            </div>

            <label class="checkbox-row checkbox-row--nested">
              <input type="checkbox" v-model="form.autoDeductOnSale"
                :disabled="form.stockUnit === 'KG'" />
              <div>
                <p class="checkbox-title">Zbrit automatikisht në shitje</p>
                <p class="checkbox-hint" v-if="form.stockUnit === 'PIECE'">
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
          <button type="button" class="k-btn k-btn--ghost" @click="emit('close')" :disabled="saving">
            Anulo
          </button>
          <button type="submit" class="k-btn k-btn--primary" :disabled="saving">
            {{ prod ? 'Ruaj ndryshimet' : 'Krijo' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
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

.modal-head h2 { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; }

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

.field { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.field label { font-size: 12px; font-weight: 500; color: var(--text-2); }
.field-row { display: flex; gap: 12px; }

select.k-input {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3e%3cpath d='M1 1L5 5L9 1' stroke='%239BA6B2' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 14px center;
  padding-right: 36px;
}

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

@media (max-width: 900px) {
  .field-row { flex-direction: column; }
}
</style>