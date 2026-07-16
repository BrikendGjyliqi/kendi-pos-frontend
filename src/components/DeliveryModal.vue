<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSuppliersStore } from '../stores/suppliers'
import { useProductsStore, type Product } from '../stores/products'
import { useDeliveriesStore } from '../stores/deliveries'
import { useAuthStore } from '../stores/auth'
import { X, Plus, Trash2, Truck, Package, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-vue-next'

export type PrefillItem = {
  productId: string | null
  extractedName: string
  quantity: number
  unit: string
  unitPriceEur: number
  matchConfidence: 'high' | 'medium' | 'low' | 'none'
}

export type PrefillData = {
  supplierId: string | null
  supplierName: string
  deliveryDate: string
  documentRef: string | null
  items: PrefillItem[]
  // File i skanuar
  fileBase64?: string
  fileName?: string
  contentType?: string
}

const props = defineProps<{
  open: boolean
  prefill?: PrefillData | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved'): void
}>()

const suppliersStore = useSuppliersStore()
const productsStore = useProductsStore()
const deliveriesStore = useDeliveriesStore()
const auth = useAuthStore()

type Row = {
  productId: string
  quantityText: string
  unitPriceText: string
  // Info nga AI (per shfaqje)
  extractedName?: string
  matchConfidence?: 'high' | 'medium' | 'low' | 'none'
}

const supplierId = ref<string>('')
const deliveryDate = ref<string>('')
const documentRef = ref<string>('')
const notes = ref<string>('')
const rows = ref<Row[]>([])
const formError = ref<string | null>(null)
const saving = ref(false)

const isFromAi = computed(() => !!props.prefill)

function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function newRow(): Row {
  return { productId: '', quantityText: '', unitPriceText: '' }
}

watch(() => props.open, async (isOpen) => {
  if (!isOpen) return
  formError.value = null

  // Sigurohu qe stores kane loaded
  await Promise.all([
    suppliersStore.load(),
    productsStore.load()
  ])

  if (props.prefill) {
    // Prefill nga AI
    supplierId.value = props.prefill.supplierId ?? ''
    deliveryDate.value = props.prefill.deliveryDate || todayLocal()
    documentRef.value = props.prefill.documentRef ?? ''
    notes.value = ''

    rows.value = props.prefill.items.map(item => ({
      productId: item.productId ?? '',
      quantityText: String(item.quantity),
      unitPriceText: item.unitPriceEur.toFixed(2),
      extractedName: item.extractedName,
      matchConfidence: item.matchConfidence
    }))

    if (rows.value.length === 0) {
      rows.value = [newRow(), newRow(), newRow()]
    }
  } else {
    // Modaliteti manual — form e zbraset
    supplierId.value = ''
    deliveryDate.value = todayLocal()
    documentRef.value = ''
    notes.value = ''
    rows.value = [newRow(), newRow(), newRow()]
  }
}, { immediate: true })

const stockProducts = computed(() =>
  productsStore.products.filter(p => p.trackStock)
    .sort((a, b) => a.name.localeCompare(b.name))
)

function productById(id: string): Product | undefined {
  return productsStore.byId(id)
}

function unitFor(id: string): string {
  const p = productById(id)
  if (!p) return ''
  return p.stockUnit === 'KG' ? 'kg' : 'copë'
}

function lineTotalCents(row: Row): number {
  const qty = parseFloat(row.quantityText.replace(',', '.')) || 0
  const price = parseFloat(row.unitPriceText.replace(',', '.')) || 0
  return Math.round(qty * price * 100)
}

const totalCents = computed(() =>
  rows.value.reduce((sum, r) => sum + lineTotalCents(r), 0)
)

const unmatchedCount = computed(() =>
  rows.value.filter(r => r.extractedName && !r.productId).length
)

const matchedCount = computed(() =>
  rows.value.filter(r => r.extractedName && r.productId).length
)

function formatMoney(cents: number): string {
  return '€ ' + (cents / 100).toFixed(2)
}

function addRow() {
  rows.value.push(newRow())
}

function removeRow(idx: number) {
  rows.value.splice(idx, 1)
  if (rows.value.length === 0) {
    rows.value.push(newRow())
  }
}

async function save() {
  formError.value = null

  if (!supplierId.value) {
    formError.value = 'Zgjidhni furnitorin'
    return
  }
  if (!deliveryDate.value) {
    formError.value = 'Zgjidhni datën e dorëzimit'
    return
  }

  const validRows = rows.value.filter(r => {
    const qty = parseFloat(r.quantityText.replace(',', '.'))
    return r.productId && !Number.isNaN(qty) && qty > 0
  })

  if (validRows.length === 0) {
    formError.value = 'Shtoni të paktën një produkt me sasi'
    return
  }

  const dateMs = new Date(deliveryDate.value + 'T12:00:00').getTime()

  saving.value = true
  try {
    await deliveriesStore.create({
      supplierId: supplierId.value,
      deliveryDate: dateMs,
      documentRef: documentRef.value.trim() || undefined,
      notes: notes.value.trim() || undefined,
      staffId: auth.currentStaff?.id,
      items: validRows.map(r => ({
        productId: r.productId,
        quantity: parseFloat(r.quantityText.replace(',', '.')),
        unitPriceCents: Math.round((parseFloat(r.unitPriceText.replace(',', '.')) || 0) * 100)
      })),
      fileBase64: props.prefill?.fileBase64,
      fileName: props.prefill?.fileName,
      contentType: props.prefill?.contentType
    })
    emit('saved')
    emit('close')
  } catch (e) {
    formError.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

function confidenceBadge(c?: string): { label: string; cls: string } {
  if (c === 'high') return { label: '✓ Match i saktë', cls: 'badge--high' }
  if (c === 'medium') return { label: '~ Match i mundshëm', cls: 'badge--medium' }
  if (c === 'low') return { label: '? Match i dobët', cls: 'badge--low' }
  return { label: '! Kërkon konfirmim', cls: 'badge--none' }
}
</script>

<template>
  <div v-if="open" class="modal-bg" @click.self="emit('close')">
    <div class="modal">
      <header class="modal-head">
        <div class="head-title">
          <div class="head-icon" :class="{ 'head-icon--ai': isFromAi }">
            <Sparkles v-if="isFromAi" :size="20" />
            <Truck v-else :size="20" />
          </div>
          <div>
            <h2>{{ isFromAi ? 'Dorëzim i skanuar nga AI' : 'Dorëzim i ri' }}</h2>
            <p class="eyebrow">
              {{ isFromAi
                ? 'Kontrollo dhe konfirmo të dhënat e nxjerra nga fleta'
                : 'Regjistro mallin që solli furnitori' }}
            </p>
          </div>
        </div>
        <button class="modal-close" @click="emit('close')">
          <X :size="20" />
        </button>
      </header>

      <!-- AI summary bar -->
      <div v-if="isFromAi" class="ai-summary">
        <div class="ai-stat ai-stat--ok">
          <CheckCircle2 :size="14" />
          <span>{{ matchedCount }} produkte u lidhën me DB</span>
        </div>
        <div v-if="unmatchedCount > 0" class="ai-stat ai-stat--warn">
          <AlertTriangle :size="14" />
          <span>{{ unmatchedCount }} kërkojnë vëmendjen tuaj</span>
        </div>
      </div>

      <div class="modal-body">
        <!-- Header info -->
        <div class="info-grid">
          <div class="field">
            <label>Furnitori *</label>
            <select v-model="supplierId" class="k-input">
              <option value="">Zgjidh furnitorin...</option>
              <option v-for="s in suppliersStore.sorted" :key="s.id" :value="s.id">
                {{ s.name }}
              </option>
            </select>
          </div>

          <div class="field">
            <label>Data e dorëzimit *</label>
            <input type="date" v-model="deliveryDate" class="k-input" />
          </div>

          <div class="field">
            <label>Nr. dokumentit</label>
            <input v-model="documentRef" class="k-input" placeholder="psh. FD-2026/1147" />
          </div>
        </div>

        <div class="field">
          <label>Shënime (opsional)</label>
          <input v-model="notes" class="k-input" placeholder="Shënim për këtë dorëzim..." />
        </div>

        <!-- Items table -->
        <div class="items-section">
          <div class="items-head">
            <h3>
              <Package :size="14" />
              Produktet e dorëzuara
            </h3>
            <span v-if="stockProducts.length === 0" class="warn-badge">
              Asnjë produkt nuk gjurmohet për stok
            </span>
          </div>

          <div class="items-table">
            <div class="items-header">
              <div>Produkti</div>
              <div class="ta-center">Sasia</div>
              <div class="ta-right">Çmimi/njësi €</div>
              <div class="ta-right">Vlera €</div>
              <div></div>
            </div>

            <div v-for="(row, i) in rows" :key="i" class="items-row"
              :class="{ 'items-row--needs-match': row.extractedName && !row.productId }">
              <div class="product-cell">
                <select v-model="row.productId" class="k-input k-input--sm">
                  <option value="">Zgjidh produktin...</option>
                  <option v-for="p in stockProducts" :key="p.id" :value="p.id">
                    {{ p.name }}
                  </option>
                </select>
                <div v-if="row.extractedName" class="extracted-info">
                  <span class="ai-label">Nga fleta:</span>
                  <span class="extracted-name">"{{ row.extractedName }}"</span>
                  <span class="confidence-badge" :class="confidenceBadge(row.matchConfidence).cls">
                    {{ confidenceBadge(row.matchConfidence).label }}
                  </span>
                </div>
              </div>

              <div class="qty-cell">
                <input v-model="row.quantityText" class="k-input k-input--sm ta-center"
                  placeholder="0" inputmode="decimal" />
                <span class="unit-label">{{ unitFor(row.productId) || '—' }}</span>
              </div>

              <input v-model="row.unitPriceText" class="k-input k-input--sm ta-right"
                placeholder="0.00" inputmode="decimal" />

              <div class="ta-right mono line-total">
                {{ formatMoney(lineTotalCents(row)) }}
              </div>

              <button class="remove-btn" @click="removeRow(i)" title="Hiq rreshtin">
                <Trash2 :size="14" />
              </button>
            </div>
          </div>

          <button class="add-row-btn" @click="addRow">
            <Plus :size="14" />
            Shto rresht
          </button>
        </div>

        <!-- Totals -->
        <div class="totals">
          <div class="total-row total-row--grand">
            <span>Totali i dorëzimit</span>
            <span class="mono">{{ formatMoney(totalCents) }}</span>
          </div>
        </div>

        <div v-if="formError" class="form-error">{{ formError }}</div>
      </div>

      <footer class="modal-foot">
        <button class="k-btn k-btn--ghost" @click="emit('close')" :disabled="saving">
          Anulo
        </button>
        <button class="k-btn k-btn--primary" @click="save" :disabled="saving">
          <Truck :size="14" />
          Konfirmo dorëzimin
        </button>
      </footer>
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
  max-width: 980px;
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

.head-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

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

.head-icon--ai {
  background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
  color: white;
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

.ai-summary {
  display: flex;
  gap: 8px;
  padding: 10px 22px;
  background: var(--surface-2);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}

.ai-stat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 600;
}

.ai-stat--ok {
  background: color-mix(in oklab, var(--brand) 12%, transparent);
  color: var(--brand);
}

.ai-stat--warn {
  background: color-mix(in oklab, #F59E0B 15%, transparent);
  color: #F59E0B;
}

.modal-body {
  padding: 22px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
  flex: 1;
}

.info-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr;
  gap: 12px;
}

.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 12px; font-weight: 500; color: var(--text-2); }

select.k-input {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3e%3cpath d='M1 1L5 5L9 1' stroke='%239BA6B2' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 14px center;
  padding-right: 36px;
}

.items-section {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.items-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.items-head h3 {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.warn-badge {
  font-size: 11px;
  padding: 3px 10px;
  background: var(--danger-soft);
  color: var(--danger);
  border-radius: var(--radius-full);
}

.items-table {
  background: var(--surface);
  border-radius: var(--radius);
  overflow: hidden;
  border: 1px solid var(--border);
}

.items-header {
  display: grid;
  grid-template-columns: 2.4fr 1.2fr 1.2fr 1.2fr 40px;
  gap: 10px;
  padding: 10px 12px;
  background: var(--surface-2);
  border-bottom: 1px solid var(--border);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-3);
}

.items-row {
  display: grid;
  grid-template-columns: 2.4fr 1.2fr 1.2fr 1.2fr 40px;
  gap: 10px;
  padding: 10px 12px;
  align-items: start;
  border-bottom: 1px solid var(--border);
}

.items-row:last-child { border-bottom: none; }

.items-row--needs-match {
  background: color-mix(in oklab, #F59E0B 6%, transparent);
}

.product-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.extracted-info {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 3px 0 0 4px;
}

.ai-label {
  font-size: 10px;
  color: var(--text-3);
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.extracted-name {
  font-size: 11px;
  color: var(--text-2);
  font-style: italic;
}

.confidence-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  font-weight: 600;
}

.badge--high {
  background: color-mix(in oklab, var(--brand) 15%, transparent);
  color: var(--brand);
}

.badge--medium {
  background: color-mix(in oklab, #F59E0B 15%, transparent);
  color: #F59E0B;
}

.badge--low, .badge--none {
  background: var(--danger-soft);
  color: var(--danger);
}

.k-input--sm {
  height: 34px;
  font-size: 13px;
  padding: 0 10px;
}

select.k-input--sm { padding-right: 28px; }

.qty-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.qty-cell input {
  flex: 1;
  min-width: 0;
}

.unit-label {
  font-size: 11px;
  color: var(--text-3);
  font-family: var(--font-mono);
  min-width: 26px;
}

.line-total {
  font-size: 13px;
  font-weight: 600;
  color: var(--money);
  font-variant-numeric: tabular-nums;
  padding-top: 8px;
}

.remove-btn {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--text-3);
  transition: all var(--duration) var(--ease);
  margin-top: 2px;
}
.remove-btn:hover { background: var(--danger-soft); color: var(--danger); }

.add-row-btn {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: var(--radius);
  background: transparent;
  border: 1px dashed var(--border-strong);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 500;
  transition: all var(--duration) var(--ease);
}

.add-row-btn:hover {
  background: var(--brand-soft);
  border-color: var(--brand-line);
  border-style: solid;
  color: var(--brand);
}

.ta-center { text-align: center; }
.ta-right { text-align: right; }

.totals {
  display: flex;
  justify-content: flex-end;
  padding: 4px 0;
}

.total-row--grand {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 40px;
  padding: 14px 20px;
  background: var(--brand-soft);
  border: 1px solid var(--brand-line);
  border-radius: var(--radius);
  min-width: 320px;
}

.total-row--grand span:first-child {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.total-row--grand .mono {
  font-size: 22px;
  font-weight: 700;
  color: var(--brand);
  font-variant-numeric: tabular-nums;
}

.form-error {
  font-size: 13px;
  color: var(--danger);
  padding: 10px 14px;
  background: var(--danger-soft);
  border-radius: 8px;
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 22px;
  border-top: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}

@media (max-width: 900px) {
  .info-grid { grid-template-columns: 1fr; }
  .items-header, .items-row {
    grid-template-columns: 2fr 1fr 1fr 1fr 34px;
    font-size: 11px;
  }
}
</style>