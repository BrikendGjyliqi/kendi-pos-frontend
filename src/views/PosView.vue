<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useTablesStore } from '../stores/tables'
import { useOrdersStore } from '../stores/orders'
import { useCategoriesStore } from '../stores/categories'
import { useProductsStore } from '../stores/products'
import { formatMoney, type Product, type Order } from '../db'
import {
  ArrowLeft, Plus, Minus, X, Search, MessageSquare,
  Banknote, CreditCard, Trash2, ChevronDown
} from 'lucide-vue-next'

const router = useRouter()
const auth = useAuthStore()
const tablesStore = useTablesStore()
const ordersStore = useOrdersStore()
const categoriesStore = useCategoriesStore()
const productsStore = useProductsStore()

const search = ref('')
const selectedCategoryId = ref<string | null>(null)
const commentEditing = ref<number | null>(null)
const currentOrderId = ref<string | null>(null)
const showPayment = ref(false)
const cashInput = ref('')
const paymentMethod = ref<'cash' | 'card'>('cash')
const showActionsMenu = ref(false)

// ─── Tip state ───
const tipPercent = ref<number>(0)
const customTipInput = ref<string>('')
const showCustomTip = ref(false)

const selectedTable = computed(() => tablesStore.selected)

onMounted(async () => {
  if (!selectedTable.value) {
    router.replace('/tables')
    return
  }

  await Promise.all([
    categoriesStore.load(),
    productsStore.load(),
    ordersStore.load()
  ])

  if (categoriesStore.sorted.length > 0 && !selectedCategoryId.value) {
    selectedCategoryId.value = categoriesStore.sorted[0].id
  }

  const existing = ordersStore.openOrderForTable(selectedTable.value!.id)
  currentOrderId.value = existing?.id ?? null
})

const currentOrder = computed<Order | null>(() => {
  if (!currentOrderId.value) return null
  return ordersStore.byId(currentOrderId.value) ?? null
})

const closedOrders = computed<Order[]>(() => {
  if (!selectedTable.value) return []
  return ordersStore.closedOrdersForTable(selectedTable.value.id)
})

const grandTotal = computed(() => {
  if (!selectedTable.value) return 0
  return ordersStore.tableTotal(selectedTable.value.id)
})

const hasAnythingToPay = computed(() => {
  return grandTotal.value > 0
})

const filteredProducts = computed<Product[]>(() => {
  return productsStore.search(search.value, selectedCategoryId.value ?? undefined)
})

// Sa nga secili produkt osht i shtu tashme ne porosine aktive
const productQuantityInOrder = computed(() => {
  const map = new Map<string, number>()
  if (!currentOrder.value) return map
  for (const item of currentOrder.value.items) {
    map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity)
  }
  // Shto edhe items nga closed orders (ende s'jane paguar, po jane pjese e llogaris)
  for (const co of closedOrders.value) {
    for (const item of co.items) {
      map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity)
    }
  }
  return map
})

// Sa mund te shitesh ende prej ky produkt
function remainingStock(product: Product): number | null {
  const p = product as any
  if (!p.trackStock) return null
  const inOrder = productQuantityInOrder.value.get(product.id) ?? 0
  return Math.max(0, p.stockQuantity - inOrder)
}

// A duhet me qene i bllokuar produkti (stoku = 0)
function isProductBlocked(product: Product): boolean {
  const p = product as any
  if (!p.trackStock || !p.autoDeductOnSale) return false
  return remainingStock(product) === 0
}

// A duhet me qene warning (stoku i ulet)
function isProductLowStock(product: Product): boolean {
  const p = product as any
  if (!p.trackStock || !p.autoDeductOnSale) return false
  const remaining = remainingStock(product)
  if (remaining === null) return false
  return remaining > 0 && remaining <= (p.lowStockThreshold ?? 0)
}

function stockLabel(product: Product): string {
  const p = product as any
  const remaining = remainingStock(product)
  if (remaining === null) return ''
  const unit = p.stockUnit === 'KG' ? 'kg' : 'copë'
  return `${Math.round(remaining * 100) / 100} ${unit}`
}

const itemCount = computed(() =>
  currentOrder.value?.items.reduce((s, i) => s + i.quantity, 0) ?? 0
)

const currentTime = ref('')
function updateTime() {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit'
  })
}
updateTime()
setInterval(updateTime, 30 * 1000)

// ─── Actions ───

function goBack() {
  tablesStore.select(null)
  router.push('/tables')
}

async function finishOrder() {
  if (currentOrderId.value) {
    const order = ordersStore.byId(currentOrderId.value)
    if (!order) {
      // skip
    } else if (order.items.length === 0) {
      await ordersStore.removeIfEmpty(currentOrderId.value)
    } else {
      await ordersStore.closeOrder(currentOrderId.value)
    }
  }
  currentOrderId.value = null
  tablesStore.select(null)
  router.push('/tables')
}

async function startNewOrder() {
  if (!selectedTable.value) return
  if (currentOrderId.value) {
    const cur = ordersStore.byId(currentOrderId.value)
    if (cur && cur.items.length > 0) {
      await ordersStore.closeOrder(currentOrderId.value)
    } else if (cur) {
      await ordersStore.removeIfEmpty(currentOrderId.value)
    }
  }
  const order = await ordersStore.ensureOpenOrder(
    selectedTable.value.id,
    auth.currentStaff?.id
  )
  currentOrderId.value = order.id
}

async function addProduct(product: Product) {
  if (!selectedTable.value) return

  // Kontrollo stokun
  const p = product as any
  if (p.trackStock && p.autoDeductOnSale) {
    const remaining = remainingStock(product)
    if (remaining !== null && remaining <= 0) {
      // Alert i vogel dhe mos vazhdo
      showStockAlert(product.name, 'jashtë stoku')
      return
    }
  }

  if (!currentOrderId.value) {
    const order = await ordersStore.ensureOpenOrder(
      selectedTable.value.id,
      auth.currentStaff?.id
    )
    currentOrderId.value = order.id
  }

  await ordersStore.addProduct(currentOrderId.value, product)
}

// Toast alert per stok
const stockAlert = ref<{ show: boolean; productName: string; message: string }>({
  show: false, productName: '', message: ''
})

function showStockAlert(productName: string, message: string) {
  stockAlert.value = { show: true, productName, message }
  setTimeout(() => {
    stockAlert.value.show = false
  }, 3500)
}

async function increase(index: number) {
  if (!currentOrder.value) return
  const item = currentOrder.value.items[index]

  // Kontrollo stokun para se me increase
  const product = productsStore.byId(item.productId) as any
  if (product?.trackStock && product?.autoDeductOnSale) {
    // Sa aktualisht ne krejt porosite e hapura
    const totalInOrders = productQuantityInOrder.value.get(item.productId) ?? 0
    if (totalInOrders + 1 > product.stockQuantity) {
      showStockAlert(item.name, `mbetën vetëm ${Math.round(product.stockQuantity - totalInOrders)} në stok`)
      return
    }
  }

  await ordersStore.setQuantity(currentOrder.value.id, index, item.quantity + 1)
}

async function decrease(index: number) {
  if (!currentOrder.value) return
  const item = currentOrder.value.items[index]
  await ordersStore.setQuantity(currentOrder.value.id, index, item.quantity - 1)
}

async function removeItem(index: number) {
  if (!currentOrder.value) return
  await ordersStore.removeItem(currentOrder.value.id, index)
}

async function updateComment(index: number, val: string) {
  if (!currentOrder.value) return
  await ordersStore.setComment(currentOrder.value.id, index, val)
}

function toggleComment(index: number) {
  commentEditing.value = commentEditing.value === index ? null : index
  if (commentEditing.value !== null) {
    nextTick(() => {
      const input = document.querySelector<HTMLInputElement>(
        `[data-comment-input="${index}"]`
      )
      input?.focus()
    })
  }
}

function selectCategory(id: string | null) {
  selectedCategoryId.value = id
  search.value = ''
}

// ─── Payment ───

function openPayment() {
  if (!hasAnythingToPay.value) return
  if (currentOrder.value && currentOrder.value.items.length > 0) {
    ordersStore.closeOrder(currentOrder.value.id)
  }
  showPayment.value = true
  cashInput.value = ''
  paymentMethod.value = 'cash'
  tipPercent.value = 0
  customTipInput.value = ''
  showCustomTip.value = false
}

function closePayment() {
  showPayment.value = false
  cashInput.value = ''
  tipPercent.value = 0
  customTipInput.value = ''
  showCustomTip.value = false
}

function pressCash(d: string) {
  if (d === '.' && cashInput.value.includes('.')) return
  cashInput.value += d
}

function backspaceCash() {
  cashInput.value = cashInput.value.slice(0, -1)
}

function quickCash(amount: number) {
  cashInput.value = String(amount)
}

// ─── Tip functions ───
function selectTipPercent(pct: number) {
  tipPercent.value = pct
  showCustomTip.value = false
  customTipInput.value = ''
}

function selectCustomTip() {
  showCustomTip.value = true
  tipPercent.value = 0
}

function updateCustomTip(val: string) {
  customTipInput.value = val
  const num = parseFloat(val)
  tipPercent.value = Number.isNaN(num) ? 0 : Math.max(0, Math.min(100, num))
}

// ─── Tip calculations ───
const tipAmountCents = computed(() => {
  if (tipPercent.value === 0) return 0
  return Math.round(grandTotal.value * tipPercent.value / 100)
})

const totalWithTip = computed(() => grandTotal.value + tipAmountCents.value)

const cashGivenCents = computed(() => {
  const parsed = parseFloat(cashInput.value)
  return Number.isNaN(parsed) ? 0 : Math.round(parsed * 100)
})

const changeCents = computed(() => {
  if (paymentMethod.value !== 'cash') return 0
  return Math.max(0, cashGivenCents.value - totalWithTip.value)
})

const canFinish = computed(() => {
  if (grandTotal.value === 0) return false
  if (paymentMethod.value === 'card') return true
  return cashGivenCents.value >= totalWithTip.value
})

const paymentInProgress = ref(false)

async function confirmPayment() {
  if (paymentInProgress.value) return
  if (!canFinish.value || !selectedTable.value) return

  paymentInProgress.value = true

  try {
    await ordersStore.payAllForTable(selectedTable.value.id, {
      method: paymentMethod.value,
      cashGiven: paymentMethod.value === 'cash' ? cashGivenCents.value : undefined,
      fiscal: true,
      tipAmount: tipAmountCents.value > 0 ? tipAmountCents.value : undefined,
      tipPercent: tipPercent.value > 0 ? tipPercent.value : undefined
    })

    showPayment.value = false
    cashInput.value = ''
    tipPercent.value = 0
    customTipInput.value = ''
    showCustomTip.value = false
    currentOrderId.value = null
    tablesStore.select(null)
    setTimeout(() => {
      router.replace('/tables')
    }, 50)
  } finally {
    paymentInProgress.value = false
  }
}

// ─── Table-level actions ───
function toggleActionsMenu() {
  showActionsMenu.value = !showActionsMenu.value
}

async function cancelOrder() {
  if (!selectedTable.value) return
  if (!ordersStore.tableHasOpenOrder(selectedTable.value.id)) return
  if (!confirm('Anulo të gjitha porositë e kësaj tavoline? Veprimi nuk mund të kthehet.')) return
  await ordersStore.cancelAllForTable(selectedTable.value.id)
  currentOrderId.value = null
  tablesStore.select(null)
  router.push('/tables')
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.actions-menu') && !target.closest('.actions-trigger')) {
    showActionsMenu.value = false
  }
}
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

function catColor(id: string): string {
  return categoriesStore.byId(id)?.color ?? '#5BC4B8'
}

function catName(id: string): string {
  return categoriesStore.byId(id)?.name ?? ''
}
</script>

<template>
  <div class="pos">
    <!-- ─── Top bar ─── -->
    <header class="topbar">
      <button class="back" @click="goBack" aria-label="Kthehu">
        <ArrowLeft :size="20" />
      </button>

      <div class="title">
        <h1>{{ selectedTable?.name ?? '—' }}</h1>
        <span class="eyebrow">Porosi e hapur · {{ itemCount }} artikuj</span>
      </div>

      <div class="topbar-right">
        <div class="time mono">{{ currentTime }}</div>

        <div class="actions-wrap">
          <button class="actions-trigger" @click.stop="toggleActionsMenu">
            Veprime
            <ChevronDown :size="14" />
          </button>
          <div v-if="showActionsMenu" class="actions-menu">
            <button @click="cancelOrder">
              <Trash2 :size="14" />
              Anulo porosinë
            </button>
          </div>
        </div>
      </div>
    </header>

    <div class="body">
      <!-- ─── Order sidebar ─── -->
      <aside class="order">
        <header class="order-head">
          <h2>POROSIA</h2>
          <button v-if="currentOrder && currentOrder.items.length > 0"
            class="new-order-btn" @click="startNewOrder" title="Porosi e re">
            <Plus :size="14" />
            Porosi e re
          </button>
        </header>

        <div v-if="closedOrders.length > 0" class="closed-orders">
          <div v-for="(co, ci) in closedOrders" :key="co.id" class="closed-order">
            <div class="co-head">
              <span class="co-title">Porosia #{{ ci + 1 }}</span>
              <span class="co-total mono">{{ formatMoney(co.total) }}</span>
            </div>
            <div class="co-items">
              <div v-for="(item, ii) in co.items" :key="ii" class="co-item">
                <span class="co-item-qty mono">×{{ item.quantity }}</span>
                <span class="co-item-name">{{ item.name }}</span>
                <span class="co-item-price mono">{{ formatMoney(item.price * item.quantity) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="closedOrders.length > 0 && currentOrder" class="active-order-label">
          <span class="eyebrow">Porosia #{{ closedOrders.length + 1 }} (aktive)</span>
          <span class="eyebrow">{{ itemCount }} artikuj</span>
        </div>
        <div v-else-if="currentOrder" class="active-order-label">
          <span class="eyebrow">{{ itemCount }} artikuj</span>
        </div>

        <div class="order-items" v-if="currentOrder && currentOrder.items.length > 0">
          <div v-for="(item, index) in currentOrder.items" :key="index" class="order-item">
            <div class="oi-color" :style="{ background: catColor(item.categoryId) }"></div>

            <div class="oi-info">
              <div class="oi-name-row">
                <span class="oi-name">{{ item.name }}</span>
                <button class="oi-remove" @click="removeItem(index)" aria-label="Hiq">
                  <X :size="14" />
                </button>
              </div>

              <div class="oi-meta">
                <span class="oi-price mono">{{ formatMoney(item.price) }}</span>
                <span class="oi-meta-sep">·</span>
                <span class="oi-total mono">{{ formatMoney(item.price * item.quantity) }}</span>
              </div>

              <div v-if="item.comment || commentEditing === index" class="oi-comment">
                <input :data-comment-input="index" :value="item.comment"
                  @input="(e) => updateComment(index, (e.target as HTMLInputElement).value)"
                  placeholder="Shëno komentin për kuzhinën..." class="oi-comment-input"
                  @blur="commentEditing = null" />
              </div>
              <button v-else class="oi-add-comment" @click="toggleComment(index)">
                <MessageSquare :size="12" />
                Shto koment
              </button>
            </div>

            <div class="oi-qty">
              <button class="qty-btn" @click="decrease(index)" aria-label="Pakëso">
                <Minus :size="14" />
              </button>
              <span class="qty-val mono">{{ item.quantity }}</span>
              <button class="qty-btn" @click="increase(index)" aria-label="Shto">
                <Plus :size="14" />
              </button>
            </div>
          </div>
        </div>

        <div v-else-if="closedOrders.length === 0" class="order-empty">
          <p>Asnjë produkt në porosi.</p>
          <p class="small">Klikoni mbi një produkt nga e djathta për t'a shtuar.</p>
        </div>

        <div v-else class="order-empty order-empty--mini">
          <p class="small">Klikoni një produkt për të filluar porosinë e re.</p>
        </div>

        <footer class="order-foot">
          <div class="totals">
            <div v-if="closedOrders.length > 0" class="total-row">
              <span>Porositë e mbyllura</span>
              <span class="mono">{{ formatMoney(closedOrders.reduce((s, o) => s + o.total, 0)) }}</span>
            </div>
            <div v-if="currentOrder && currentOrder.items.length > 0" class="total-row">
              <span>Porosia aktive</span>
              <span class="mono">{{ formatMoney(currentOrder.total) }}</span>
            </div>
            <div class="total-row total-row--grand">
              <span>TOTALI</span>
              <span class="mono">{{ formatMoney(grandTotal) }}</span>
            </div>
          </div>

          <div class="action-row">
            <button class="action-btn action-btn--finish" @click="finishOrder">
              Përfundo
            </button>
            <button class="action-btn action-btn--fiscal"
              :disabled="!hasAnythingToPay"
              @click="openPayment">
              {{ closedOrders.length > 0 ? 'Fiskalizo të gjitha' : 'Fiskalizo' }}
            </button>
          </div>
        </footer>
      </aside>

      <!-- ─── Catalog ─── -->
      <main class="catalog">
        <header class="catalog-head">
          <div class="search-box">
            <Search :size="16" />
            <input v-model="search" placeholder="Kërko produkt..." />
          </div>
        </header>

        <div class="cats">
          <button class="cat" :class="{ active: selectedCategoryId === null }"
            @click="selectCategory(null)">
            Të gjitha
          </button>
          <button v-for="cat in categoriesStore.sorted" :key="cat.id" class="cat"
            :class="{ active: selectedCategoryId === cat.id }" @click="selectCategory(cat.id)">
            <span class="cat-dot" :style="{ background: cat.color }"></span>
            {{ cat.name }}
          </button>
        </div>

        <div class="products-wrap">
          <div v-if="filteredProducts.length > 0" class="products">
            <button v-for="product in filteredProducts" :key="product.id" class="product" :class="{
              'product--blocked': isProductBlocked(product),
              'product--low': isProductLowStock(product)
            }" :disabled="isProductBlocked(product)" @click="addProduct(product)">
              <span class="product-color" :style="{ background: catColor(product.categoryId) }"></span>
              <div class="product-name">{{ product.name }}</div>
              <div class="product-price mono">{{ formatMoney(product.price) }}</div>

              <!-- Badge stoku -->
              <div v-if="isProductBlocked(product)" class="stock-badge stock-badge--blocked">
                Jashtë stoku
              </div>
              <div v-else-if="isProductLowStock(product)" class="stock-badge stock-badge--warn">
                {{ stockLabel(product) }}
              </div>
            </button>
          </div>

          <div v-else class="k-empty">
            <p v-if="search">Asnjë produkt për "{{ search }}"</p>
            <p v-else>Asnjë produkt në këtë kategori</p>
          </div>
        </div>
      </main>
    </div>

    <!-- ═══════════ PAYMENT MODAL ═══════════ -->
    <div v-if="showPayment" class="modal-bg" @click.self="closePayment">
      <div class="modal">
        <header class="modal-head">
          <div>
            <h2>Fiskalizo porosinë</h2>
            <p class="eyebrow">{{ selectedTable?.name }} · {{ itemCount }} artikuj</p>
          </div>
          <button class="modal-close" @click="closePayment">
            <X :size="20" />
          </button>
        </header>

        <div class="modal-body">
          <section class="pay-left">
            <div class="pay-row">
              <span class="pay-label">Nëntotali</span>
              <span class="pay-val mono">{{ formatMoney(grandTotal) }}</span>
            </div>

            <div v-if="tipAmountCents > 0" class="pay-row pay-row--tip">
              <span class="pay-label">Bakshish ({{ tipPercent }}%)</span>
              <span class="pay-val mono">+ {{ formatMoney(tipAmountCents) }}</span>
            </div>

            <div class="pay-row pay-row--grand">
              <span class="pay-label">Totali për pagesë</span>
              <span class="pay-val pay-val--grand mono">{{ formatMoney(totalWithTip) }}</span>
            </div>

            <div class="pay-row pay-row--input">
              <span class="pay-label">
                {{ paymentMethod === 'cash' ? 'Pagesa kesh' : 'Pagesa me kartë' }}
              </span>
              <span class="pay-val pay-val--input mono">
                {{ paymentMethod === 'card' ? formatMoney(totalWithTip) : formatMoney(cashGivenCents) }}
              </span>
            </div>

            <div class="pay-row pay-row--change">
              <span class="pay-label">Kusur</span>
              <span class="pay-val pay-val--change mono">{{ formatMoney(changeCents) }}</span>
            </div>
          </section>

          <section class="pay-right">
            <div class="method-tabs">
              <button class="method-tab" :class="{ active: paymentMethod === 'cash' }"
                @click="paymentMethod = 'cash'">
                <Banknote :size="16" />
                Kesh
              </button>
              <button class="method-tab" :class="{ active: paymentMethod === 'card' }"
                @click="paymentMethod = 'card'">
                <CreditCard :size="16" />
                Kartë
              </button>
            </div>

            <div class="tip-section">
              <p class="tip-label">Bakshish</p>
              <div class="tip-buttons">
                <button class="tip-btn" :class="{ active: tipPercent === 0 && !showCustomTip }"
                  @click="selectTipPercent(0)">
                  Jo
                </button>
                <button class="tip-btn" :class="{ active: tipPercent === 5 && !showCustomTip }"
                  @click="selectTipPercent(5)">
                  5%
                </button>
                <button class="tip-btn" :class="{ active: tipPercent === 10 && !showCustomTip }"
                  @click="selectTipPercent(10)">
                  10%
                </button>
                <button class="tip-btn" :class="{ active: tipPercent === 15 && !showCustomTip }"
                  @click="selectTipPercent(15)">
                  15%
                </button>
                <button class="tip-btn" :class="{ active: showCustomTip }"
                  @click="selectCustomTip">
                  %…
                </button>
              </div>

              <div v-if="showCustomTip" class="tip-custom">
                <input type="number" min="0" max="100" step="1"
                  :value="customTipInput"
                  @input="(e) => updateCustomTip((e.target as HTMLInputElement).value)"
                  placeholder="Sa %?" class="tip-custom-input" />
                <span class="tip-custom-suffix">%</span>
              </div>
            </div>

            <div v-if="paymentMethod === 'cash'" class="pay-keypad">
              <button v-for="n in [1, 2, 3, 4, 5, 6, 7, 8, 9]" :key="n"
                @click="pressCash(String(n))">
                {{ n }}
              </button>
              <button @click="pressCash('.')">.</button>
              <button @click="pressCash('0')">0</button>
              <button @click="backspaceCash">⌫</button>
            </div>

            <div v-if="paymentMethod === 'cash'" class="quick-cash">
              <button v-for="amt in [5, 10, 20, 50, 100]" :key="amt"
                class="quick-btn" @click="quickCash(amt)">
                €{{ amt }}
              </button>
            </div>

            <div class="pay-actions">
              <button class="k-btn k-btn--ghost k-btn--lg" @click="closePayment">
                Anulo
              </button>
              <button class="k-btn k-btn--primary k-btn--lg" @click="confirmPayment"
                :disabled="!canFinish">
                Përfundo & mbyll tavolinën
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>

  <!-- Stock alert toast -->
<transition name="toast">
  <div v-if="stockAlert.show" class="stock-toast">
    <div class="toast-icon">⚠</div>
    <div class="toast-content">
      <strong>{{ stockAlert.productName }}</strong>
      <span>{{ stockAlert.message }}</span>
    </div>
  </div>
</transition>

</template>

<style scoped>
.pos {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg);
  overflow: hidden;
}

/* ─── Top bar ─── */
.topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.back {
  width: 40px;
  height: 40px;
  border-radius: var(--radius);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-2);
  background: var(--surface-2);
  transition: all var(--duration) var(--ease);
}
.back:hover { color: var(--text); background: var(--surface-3); }

.title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.title h1 {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.topbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 14px;
}

.time {
  font-size: 14px;
  color: var(--text-2);
}

.actions-wrap { position: relative; }

.actions-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 36px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  transition: background var(--duration) var(--ease);
}
.actions-trigger:hover { background: var(--surface-3); }

.actions-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 50;
  min-width: 200px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.actions-menu button {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--danger);
  font-size: 14px;
  font-weight: 500;
  text-align: left;
}
.actions-menu button:hover { background: var(--danger-soft); }

/* ─── Body layout ─── */
.body {
  flex: 1;
  display: grid;
  grid-template-columns: 380px 1fr;
  overflow: hidden;
}

/* ─── Order panel ─── */
.order {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-right: 1px solid var(--border);
  overflow: hidden;
}

.order-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 20px 12px;
  flex-shrink: 0;
}
.order-head h2 {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--text-3);
  text-transform: uppercase;
}

.new-order-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: var(--brand-soft);
  border: 1px solid var(--brand-line);
  border-radius: var(--radius-full);
  color: var(--brand);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  transition: all var(--duration) var(--ease);
}
.new-order-btn:hover {
  background: var(--brand);
  color: white;
}

/* Closed orders (read-only history) */
.closed-orders {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 20px 14px;
  flex-shrink: 0;
  max-height: 35vh;
  overflow-y: auto;
}

.closed-order {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 12px;
}

.co-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  padding-bottom: 6px;
  border-bottom: 1px dashed var(--border);
}

.co-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-2);
}

.co-total {
  font-size: 13px;
  font-weight: 700;
  color: var(--money);
}

.co-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.co-item {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  gap: 8px;
  align-items: center;
  font-size: 12px;
}

.co-item-qty { color: var(--text-3); font-size: 11px; }
.co-item-name { color: var(--text-2); }
.co-item-price { color: var(--text-2); font-size: 11px; }

.active-order-label {
  display: flex;
  justify-content: space-between;
  padding: 4px 20px 8px;
  flex-shrink: 0;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

.order-empty--mini {
  padding: 16px 20px !important;
  text-align: center;
}

.order-items {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.order-item {
  display: grid;
  grid-template-columns: 4px 1fr auto;
  gap: 12px;
  padding: 12px 14px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  align-items: start;
}

.oi-color {
  width: 4px;
  align-self: stretch;
  border-radius: var(--radius-full);
}

.oi-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.oi-name-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.oi-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.3;
  flex: 1;
  word-break: break-word;
}

.oi-remove {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
  transition: all var(--duration) var(--ease);
  flex-shrink: 0;
}
.oi-remove:hover { background: var(--danger-soft); color: var(--danger); }

.oi-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.oi-price { color: var(--text-3); }
.oi-meta-sep { color: var(--text-3); }
.oi-total { color: var(--text); font-weight: 600; }

.oi-add-comment {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-3);
  padding: 2px 0;
}
.oi-add-comment:hover { color: var(--text-2); }

.oi-comment-input {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  padding: 6px 8px;
  color: var(--text);
  font-size: 12px;
  outline: none;
}
.oi-comment-input:focus { border-color: var(--brand); }

.oi-qty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.qty-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  transition: all var(--duration) var(--ease);
}
.qty-btn:hover { background: var(--surface-3); border-color: var(--brand-line); }

.qty-val {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  min-width: 24px;
  text-align: center;
}

.order-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: var(--text-3);
  text-align: center;
  gap: 6px;
}
.order-empty p { font-size: 14px; }
.order-empty .small { font-size: 12px; opacity: 0.8; }

.order-foot {
  flex-shrink: 0;
  padding: 16px 20px 20px;
  border-top: 1px solid var(--border);
  background: var(--surface);
}

.totals {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}

.total-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: var(--text-2);
}

.total-row--grand {
  margin-top: 6px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}
.total-row--grand .mono { color: var(--money); font-size: 22px; }

.action-row {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 10px;
}

.action-btn {
  height: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.01em;
  transition: all var(--duration) var(--ease);
}

.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.action-btn:active:not(:disabled) { transform: scale(0.98); }

.action-btn--finish {
  background: var(--surface-2);
  color: var(--text);
  border: 1px solid var(--border-strong);
}
.action-btn--finish:hover:not(:disabled) {
  background: var(--surface-3);
  border-color: var(--brand-line);
}

.action-btn--fiscal {
  background: var(--brand-deep);
  color: #FAFAF7;
  border: none;
}
.action-btn--fiscal:hover:not(:disabled) { background: var(--brand-hover); }

/* ─── Catalog ─── */
.catalog {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.catalog-head {
  padding: 16px 20px 12px;
  flex-shrink: 0;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-3);
  transition: border-color var(--duration) var(--ease);
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
.search-box input::placeholder { color: var(--text-3); }

.cats {
  display: flex;
  gap: 6px;
  padding: 0 20px 12px;
  overflow-x: auto;
  flex-shrink: 0;
}

.cat {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  transition: all var(--duration) var(--ease);
}

.cat:hover {
  border-color: var(--border-strong);
  color: var(--text);
}

.cat.active {
  background: var(--brand-soft);
  border-color: var(--brand-line);
  color: var(--text);
}

.cat-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.products-wrap {
  flex: 1;
  overflow-y: auto;
  padding: 4px 20px 24px;
}

.products {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}

.product {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 14px 12px;
  min-height: 96px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  text-align: left;
  transition: all var(--duration) var(--ease);
  overflow: hidden;
}

.product:hover {
  border-color: var(--border-strong);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.product:active { transform: scale(0.97); }

.product-color {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 3px;
}

.product-name {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.25;
  color: var(--text);
  padding-left: 4px;
}

.product-price {
  font-size: 13px;
  color: var(--money);
  font-weight: 600;
  padding-left: 4px;
}

/* ─── Payment modal ─── */
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
  animation: fade-in 200ms var(--ease);
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  width: 100%;
  max-width: 880px;
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
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
}

.modal-head h2 {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin-bottom: 2px;
}

.modal-close {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-2);
  background: var(--surface-2);
  transition: all var(--duration) var(--ease);
}
.modal-close:hover { background: var(--surface-3); color: var(--text); }

.modal-body {
  display: grid;
  grid-template-columns: 1fr 1.1fr;
  min-height: 480px;
}

.pay-left {
  padding: 24px;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--surface-2);
}

.pay-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 20px 0;
  border-bottom: 1px solid var(--border);
}
.pay-row:last-child { border-bottom: none; }

.pay-label {
  font-size: 13px;
  color: var(--text-2);
  font-weight: 500;
}

.pay-val {
  font-size: 36px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}

.pay-row--input .pay-val { color: var(--brand); }
.pay-row--change .pay-val--change { color: var(--money); }

.pay-right {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.method-tabs {
  display: flex;
  gap: 6px;
  padding: 4px;
  background: var(--surface-2);
  border-radius: var(--radius);
}

.method-tab {
  flex: 1;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 8px;
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
  transition: all var(--duration) var(--ease);
}

.method-tab.active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}

.pay-keypad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.pay-keypad button {
  height: 52px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 20px;
  font-weight: 600;
  transition: all var(--duration) var(--ease);
}
.pay-keypad button:hover { background: var(--surface-3); }
.pay-keypad button:active { transform: scale(0.95); background: var(--brand-soft); }

.quick-cash {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.quick-btn {
  height: 36px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
  transition: all var(--duration) var(--ease);
}
.quick-btn:hover {
  border-color: var(--brand-line);
  color: var(--brand);
}

.pay-actions {
  margin-top: auto;
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 10px;
}

/* ─── Responsive ─── */
@media (max-width: 1100px) {
  .body { grid-template-columns: 320px 1fr; }
}

@media (max-width: 900px) {
  .body { grid-template-columns: 1fr; }
  .order { display: none; }
  .modal-body { grid-template-columns: 1fr; }
  .pay-left { border-right: none; border-bottom: 1px solid var(--border); }
}

/* ─── Tip section ─── */
.tip-section {
  padding: 12px 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  margin-bottom: 12px;
}

.tip-label {
  font-size: 11px;
  font-family: var(--font-mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 8px;
  padding: 0 4px;
}

.tip-buttons {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.tip-btn {
  padding: 10px 4px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms ease;
}

.tip-btn:hover {
  background: var(--surface-3);
  border-color: var(--text-3);
}

.tip-btn.active {
  background: var(--brand-soft);
  border-color: var(--brand);
  color: var(--brand);
}

.tip-custom {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: var(--radius);
  background: var(--surface-2);
  border: 1px solid var(--brand);
}

.tip-custom-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text);
  font-size: 15px;
  font-family: var(--font-mono);
  outline: none;
}

.tip-custom-suffix {
  color: var(--text-3);
  font-family: var(--font-mono);
  font-size: 14px;
}

.pay-row--tip {
  color: var(--brand);
}

.pay-row--grand {
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 10px 0;
  margin: 6px 0;
  font-weight: 700;
}

.pay-val--grand {
  color: var(--brand);
  font-size: 18px;
}

/* Product stock states */
.product--low {
  border-color: #F59E0B;
  background: color-mix(in oklab, #F59E0B 4%, var(--surface));
}

.product--low:hover {
  border-color: #F59E0B;
  box-shadow: 0 0 0 1px #F59E0B;
}

.product--blocked {
  opacity: 0.4;
  cursor: not-allowed !important;
  pointer-events: none;
  filter: grayscale(0.6);
}

.stock-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-family: var(--font-mono);
  letter-spacing: 0.02em;
}

.stock-badge--warn {
  background: #F59E0B;
  color: white;
}

.stock-badge--blocked {
  background: var(--danger);
  color: white;
  text-transform: uppercase;
  font-size: 9px;
  letter-spacing: 0.08em;
}

/* Toast alert */
.stock-toast {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  background: var(--surface);
  border: 1px solid var(--danger);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  padding: 14px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 320px;
  max-width: 480px;
}

.toast-icon {
  font-size: 24px;
  color: var(--danger);
}

.toast-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toast-content strong {
  font-size: 14px;
  color: var(--text);
}

.toast-content span {
  font-size: 12px;
  color: var(--text-2);
}

/* Toast animation */
.toast-enter-active, .toast-leave-active {
  transition: all 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translate(-50%, 20px);
}

.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px);
}
</style>