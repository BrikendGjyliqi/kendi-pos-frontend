<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useProductsStore, type Product } from '../stores/products'
import { useSupplierOrdersStore } from '../stores/supplierOrders'
import { useAuthStore } from '../stores/auth'
import type { Supplier } from '../stores/suppliers'
import { X, Plus, Trash2, ClipboardList, Package, Send, AlertTriangle, CheckCircle2, FileText } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  supplier: Supplier | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'sent'): void
}>()

const productsStore = useProductsStore()
const supplierOrdersStore = useSupplierOrdersStore()
const auth = useAuthStore()

type Row = {
  productId: string
  quantityText: string
  note: string
}

const rows = ref<Row[]>([])
const notes = ref('')
const formError = ref<string | null>(null)
const sending = ref(false)

// State pas dergimit
const sentOrder = ref<{ orderRef: string; itemCount: number } | null>(null)

function newRow(): Row {
  return { productId: '', quantityText: '', note: '' }
}

watch(() => props.open, async (isOpen) => {
  if (!isOpen) {
    // Reset kur mbyllet
    sentOrder.value = null
    return
  }
  formError.value = null
  notes.value = ''
  sentOrder.value = null

  await productsStore.load()

  // Sugjero produkte me stok te ulet automatikisht
  const lowStock = productsStore.products
    .filter(p => p.trackStock && p.stockQuantity <= p.lowStockThreshold)
    .slice(0, 5)

  if (lowStock.length > 0) {
    rows.value = lowStock.map(p => ({
      productId: p.id,
      quantityText: suggestedQuantity(p),
      note: ''
    }))
    // Shto edhe 2 rreshta te zbrase
    rows.value.push(newRow(), newRow())
  } else {
    rows.value = [newRow(), newRow(), newRow()]
  }
}, { immediate: true })

function suggestedQuantity(p: Product): string {
  // Sugjero sasi qe mbush stokun deri ne 3× threshold
  const target = Math.max(p.lowStockThreshold * 3, 20)
  const needed = Math.max(0, target - p.stockQuantity)
  if (p.stockUnit === 'KG') return needed.toFixed(2)
  return String(Math.ceil(needed))
}

const stockProducts = computed(() =>
  productsStore.products.filter(p => p.trackStock)
    .sort((a, b) => a.name.localeCompare(b.name))
)

const lowStockProducts = computed(() =>
  productsStore.products.filter(p =>
    p.trackStock && p.stockQuantity <= p.lowStockThreshold
  )
)

function productById(id: string): Product | undefined {
  return productsStore.byId(id)
}

function unitFor(id: string): string {
  const p = productById(id)
  if (!p) return ''
  return p.stockUnit === 'KG' ? 'kg' : 'copë'
}

function currentStockFor(id: string): string {
  const p = productById(id)
  if (!p) return ''
  const unit = p.stockUnit === 'KG' ? 'kg' : 'copë'
  return `${Math.round(p.stockQuantity * 100) / 100} ${unit}`
}

function isLowStock(id: string): boolean {
  const p = productById(id)
  return !!p && p.stockQuantity <= p.lowStockThreshold
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

const validItems = computed(() =>
  rows.value.filter(r => {
    const qty = parseFloat(r.quantityText.replace(',', '.'))
    return r.productId && !Number.isNaN(qty) && qty > 0
  })
)

async function send() {
  formError.value = null

  if (!props.supplier) {
    formError.value = 'Furnitori mungon'
    return
  }
  if (validItems.value.length === 0) {
    formError.value = 'Shto të paktën një produkt me sasi'
    return
  }

  sending.value = true
  try {
    const created = await supplierOrdersStore.create({
      supplierId: props.supplier.id,
      notes: notes.value.trim() || undefined,
      staffId: auth.currentStaff?.id,
      items: validItems.value.map(r => ({
        productId: r.productId,
        quantity: parseFloat(r.quantityText.replace(',', '.')),
        note: r.note.trim() || undefined
      }))
    })

    sentOrder.value = {
      orderRef: created.orderRef,
      itemCount: created.items.length
    }

    emit('sent')
  } catch (e) {
    formError.value = (e as Error).message
  } finally {
    sending.value = false
  }
}

function openPdf() {
  if (!sentOrder.value) return
  // Gjej order-in e krijuar dhe hape PDF
  const order = supplierOrdersStore.orders.find(o => o.orderRef === sentOrder.value!.orderRef)
  if (order) {
    window.open(supplierOrdersStore.pdfUrl(order.id), '_blank')
  }
}

function closeModal() {
  emit('close')
}
</script>

<template>
  <div v-if="open" class="modal-bg" @click.self="closeModal">
    <div class="modal">
      <!-- ─── SUCCESS STATE ─── -->
      <div v-if="sentOrder" class="success-view">
        <div class="success-icon">
          <CheckCircle2 :size="56" />
        </div>
        <h2>Kërkesa u dërgua me sukses!</h2>
        <p class="success-text">
          Porosia <strong>{{ sentOrder.orderRef }}</strong> me
          <strong>{{ sentOrder.itemCount }} produkte</strong>
          u regjistrua për <strong>{{ supplier?.name }}</strong>.
        </p>

        <div class="success-next">
          <p class="next-label">Hapat e ardhshëm:</p>
          <ol>
            <li>Shkarko PDF-in e porosisë</li>
            <li>Dërgoja furnitorit me WhatsApp, email, ose në letër</li>
            <li>Kur vjen malli, skano fletë-dërgesën për ta lidhur automatikisht</li>
          </ol>
        </div>

        <div class="success-actions">
          <button class="k-btn k-btn--ghost" @click="closeModal">
            Mbyll
          </button>
          <button class="k-btn k-btn--primary" @click="openPdf">
            <FileText :size="14" />
            Shkarko PDF
          </button>
        </div>
      </div>

      <!-- ─── FORM STATE ─── -->
      <template v-else>
        <header class="modal-head">
          <div class="head-title">
            <div class="head-icon">
              <ClipboardList :size="20" />
            </div>
            <div>
              <h2>Krijo porosi për furnitorin</h2>
              <p class="eyebrow">
                Furnitori: <strong>{{ supplier?.name }}</strong>
                <span v-if="supplier?.contactPerson"> · {{ supplier.contactPerson }}</span>
              </p>
            </div>
          </div>
          <button class="modal-close" @click="closeModal">
            <X :size="20" />
          </button>
        </header>

        <!-- Low stock alert -->
        <div v-if="lowStockProducts.length > 0" class="low-stock-bar">
          <AlertTriangle :size="14" />
          <span>
            Ke <strong>{{ lowStockProducts.length }}</strong> produkte me stok të ulët —
            sistemi i ka shtuar automatikisht në porosi.
          </span>
        </div>

        <div class="modal-body">
          <div class="items-section">
            <div class="items-head">
              <h3>
                <Package :size="14" />
                Produktet për porosi
              </h3>
              <span class="counter">{{ validItems.length }} produkte të zgjedhura</span>
            </div>

            <div class="items-table">
              <div class="items-header">
                <div>Produkti</div>
                <div class="ta-center">Stoku aktual</div>
                <div class="ta-center">Sasia për porosi</div>
                <div>Shënim (opsional)</div>
                <div></div>
              </div>

              <div v-for="(row, i) in rows" :key="i" class="items-row"
                :class="{ 'items-row--low': isLowStock(row.productId) }">
                <select v-model="row.productId" class="k-input k-input--sm">
                  <option value="">Zgjidh produktin...</option>
                  <option v-for="p in stockProducts" :key="p.id" :value="p.id">
                    {{ p.name }}
                    <template v-if="p.stockQuantity <= p.lowStockThreshold">⚠</template>
                  </option>
                </select>

                <div class="ta-center mono stock-cell">
                  <span v-if="row.productId" :class="{ 'low': isLowStock(row.productId) }">
                    {{ currentStockFor(row.productId) }}
                  </span>
                  <span v-else class="dim">—</span>
                </div>

                <div class="qty-cell">
                  <input v-model="row.quantityText" class="k-input k-input--sm ta-center"
                    placeholder="0" inputmode="decimal" />
                  <span class="unit-label">{{ unitFor(row.productId) || '—' }}</span>
                </div>

                <input v-model="row.note" class="k-input k-input--sm"
                  placeholder="psh. 3 gajbe" />

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

          <div class="field">
            <label>Shënime për furnitorin (opsional)</label>
            <textarea v-model="notes" class="k-input" rows="2"
              placeholder="psh. Ju lutem sillni deri të Enjten..." />
          </div>

          <div v-if="formError" class="form-error">{{ formError }}</div>
        </div>

        <footer class="modal-foot">
          <button class="k-btn k-btn--ghost" @click="closeModal" :disabled="sending">
            Anulo
          </button>
          <button class="k-btn k-btn--primary" @click="send"
            :disabled="sending || validItems.length === 0">
            <Send :size="14" />
            {{ sending ? 'Duke dërguar...' : 'Dërgo kërkesën' }}
          </button>
        </footer>
      </template>
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
  max-width: 1020px;
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

.modal-head h2 {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin-bottom: 2px;
}

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

.low-stock-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  background: color-mix(in oklab, #F59E0B 10%, transparent);
  border-bottom: 1px solid color-mix(in oklab, #F59E0B 25%, transparent);
  color: #B45309;
  font-size: 12px;
  flex-shrink: 0;
}

.modal-body {
  padding: 22px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
  flex: 1;
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

.counter {
  font-size: 11px;
  color: var(--text-3);
  font-family: var(--font-mono);
  padding: 2px 8px;
  background: var(--surface);
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
  grid-template-columns: 2.2fr 1.2fr 1.4fr 1.8fr 40px;
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
  grid-template-columns: 2.2fr 1.2fr 1.4fr 1.8fr 40px;
  gap: 10px;
  padding: 8px 12px;
  align-items: center;
  border-bottom: 1px solid var(--border);
}

.items-row:last-child { border-bottom: none; }

.items-row--low {
  background: color-mix(in oklab, #F59E0B 6%, transparent);
}

.k-input--sm {
  height: 34px;
  font-size: 13px;
  padding: 0 10px;
}

select.k-input--sm {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3e%3cpath d='M1 1L5 5L9 1' stroke='%239BA6B2' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 26px;
}

.stock-cell {
  font-size: 12px;
  color: var(--text-2);
}

.stock-cell .low {
  color: #B45309;
  font-weight: 600;
}

.stock-cell .dim { color: var(--text-3); }

.qty-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.qty-cell input { flex: 1; min-width: 0; }

.unit-label {
  font-size: 11px;
  color: var(--text-3);
  font-family: var(--font-mono);
  min-width: 26px;
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

.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 12px; font-weight: 500; color: var(--text-2); }

textarea.k-input {
  resize: vertical;
  font-family: inherit;
  min-height: 50px;
  padding: 10px 12px;
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

/* ─── Success state ─── */
.success-view {
  padding: 60px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
}

.success-icon {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: color-mix(in oklab, var(--brand) 15%, transparent);
  color: var(--brand);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  animation: pop-in 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes pop-in {
  0% { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.success-view h2 {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text);
}

.success-text {
  font-size: 14px;
  color: var(--text-2);
  max-width: 500px;
  line-height: 1.6;
}

.success-next {
  margin-top: 16px;
  padding: 20px 24px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  max-width: 500px;
  text-align: left;
  width: 100%;
}

.next-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 10px;
}

.success-next ol {
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.success-next li {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.5;
}

.success-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

@media (max-width: 800px) {
  .items-header, .items-row {
    grid-template-columns: 2fr 1fr 1.2fr 1.4fr 32px;
    font-size: 11px;
  }
}
</style>