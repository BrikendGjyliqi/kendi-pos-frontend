import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as ordersRepo from '../db/ordersRepo'

// Rrit types nga ordersRepo por mbaj compatibility me kod aktual (formatimet e ndryshme)
export type OrderStatus = ordersRepo.OrderStatus

export type OrderItem = {
  id: string
  orderId: string
  productId: string
  name: string
  price: number
  quantity: number
  note?: string | null
  comment?: string | null 
  addedAt: number
  categoryId?: string | null
}

export type Order = {
  id: string
  tableId: string
  status: OrderStatus
  subtotal: number
  discount: number
  total: number
  paymentMethod?: string | null
  cashGiven?: number | null
  fiscal?: boolean | null
  staffId?: string | null
  tipAmount?: number | null
  tipPercent?: number | null
  openedAt: number
  closedAt?: number | null
  paidAt?: number | null
  items: OrderItem[]
  discountPercent?: number
  discountAmount?: number
  discountReason?: string
  notes?: string
}

function toOrderItem(i: ordersRepo.OrderItem): OrderItem {
  return {
    id: i.id,
    orderId: i.orderId,
    productId: i.productId,
    name: i.name,
    price: i.price,
    quantity: i.quantity,
    note: i.note,
    comment: i.note,   // ← alias
    addedAt: i.addedAt,
    categoryId: null
  }
}

function toOrder(o: ordersRepo.Order): Order {
  return {
    id: o.id,
    tableId: o.tableId,
    status: o.status,
    subtotal: o.subtotal,
    discount: o.discount,
    total: o.total,
    paymentMethod: o.paymentMethod,
    cashGiven: o.cashGiven,
    fiscal: o.fiscal,
    staffId: o.staffId,
    tipAmount: o.tipAmount,
    tipPercent: o.tipPercent,
    openedAt: o.openedAt,
    closedAt: o.closedAt,
    paidAt: o.paidAt,
    items: o.items.map(toOrderItem)
  }
}

export const useOrdersStore = defineStore('orders', () => {
  const orders = ref<Order[]>([])
  const loaded = ref(false)

  const openOrders = computed(() => orders.value.filter(o => o.status === 'open'))
  const closedOrders = computed(() => orders.value.filter(o => o.status === 'closed'))
  const paidOrders = computed(() => orders.value.filter(o => o.status === 'paid'))

  const todayStats = computed(() => {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const paid = orders.value.filter(o =>
      o.status === 'paid' && o.paidAt && o.paidAt >= startOfDay.getTime()
    )
    return {
      total: paid.reduce((sum, o) => sum + o.total, 0),
      count: paid.length,
      cash: paid.filter(o => o.paymentMethod === 'cash').reduce((s, o) => s + o.total, 0),
      card: paid.filter(o => o.paymentMethod === 'card').reduce((s, o) => s + o.total, 0)
    }
  })

  function openOrderFor(tableId: string) {
    return orders.value.find(o => o.tableId === tableId && o.status === 'open')
  }

  function unpaidOrdersForTable(tableId: string) {
    return orders.value.filter(o =>
      o.tableId === tableId && (o.status === 'open' || o.status === 'closed')
    )
  }

  function tableHasOpenOrder(tableId: string) {
    return orders.value.some(o =>
      o.tableId === tableId && (o.status === 'open' || o.status === 'closed')
    )
  }

  function tableTotal(tableId: string) {
    return unpaidOrdersForTable(tableId).reduce((sum, o) => sum + o.total, 0)
  }

  function tableOwnerStaffId(tableId: string) {
    const openOrder = unpaidOrdersForTable(tableId).find(o => o.status === 'open')
    return openOrder?.staffId ?? null
  }

  async function load() {
  if (loaded.value) return
  try {
    const repoOrders = await ordersRepo.getAll()
    orders.value = repoOrders.map(toOrder)
    loaded.value = true
    console.log(`[Orders Store] Loaded ${orders.value.length} orders (offline-first)`)
  } catch (err) {
    console.error('[Orders Store] Load failed:', err)
    orders.value = []
    loaded.value = true
  }

  // Auto-refresh ne background
  setTimeout(async () => {
    try {
      const fresh = await ordersRepo.refresh()
      orders.value = fresh.map(toOrder)
      console.log(`[Orders Store] Auto-refreshed ${fresh.length} orders`)
    } catch {
      // silent
    }
  }, 1000)
}

 async function syncFromDB() {
  try {
    const fresh = await ordersRepo.refresh()
    if (fresh && fresh.length >= 0) {
      orders.value = fresh.map(toOrder)
    }
  } catch {
    // silent - offline mode
  }
}

 async function ensureOpenOrder(tableId: string, staffId: string | null) {
  const existing = openOrderFor(tableId)
  if (existing) return existing

  const created = await ordersRepo.create({
    tableId,
    staffId,
    items: []
  })
  const order = toOrder(created)
  orders.value.push(order)

  // Kur nje order krijohet per tavoline te rezervuar, backend automatikisht:
  // - reservation → ARRIVED
  // - table → ON_DINE
  // Duhet me refresh tables + reservations qe UI te reflekton kete
  try {
    const { useTablesStore } = await import('./tables')
    const { useReservationsStore } = await import('./reservations')
    const tablesStore = useTablesStore()
    const reservationsStore = useReservationsStore()
    
    // Refresh ne background (mos bllokojme)
    tablesStore.reload().catch(() => {})
    reservationsStore.reload().catch(() => {})
  } catch (err) {
    console.warn('[Orders] Failed to refresh related stores:', err)
  }

  return order
}

 async function addProductToOrder(
  tableIdOrOrderId: string,
  product: { id: string; name: string; price: number },
  quantity = 1,
  staffId: string | null = null
) {
  let order = orders.value.find(o => o.id === tableIdOrOrderId)
  if (!order) {
    order = openOrderFor(tableIdOrOrderId)
    if (!order) order = await ensureOpenOrder(tableIdOrOrderId, staffId)
  }

  const existingItem = order.items.find(i => i.productId === product.id)
  let newItems: ordersRepo.OrderItem[]

  if (existingItem) {
    newItems = order.items.map(i =>
      i.productId === product.id
        ? {
            id: i.id,
            orderId: order!.id,
            productId: i.productId,
            name: i.name,
            price: i.price,
            quantity: i.quantity + quantity,
            note: i.note ?? null,
            addedAt: i.addedAt
          }
        : {
            id: i.id,
            orderId: order!.id,
            productId: i.productId,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            note: i.note ?? null,
            addedAt: i.addedAt
          }
    )
  } else {
    const newItem: ordersRepo.OrderItem = {
      id: crypto.randomUUID(),
      orderId: order.id,
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity,
      note: null,
      addedAt: Date.now()
    }
    newItems = [
      ...order.items.map(i => ({
        id: i.id,
        orderId: order!.id,
        productId: i.productId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        note: i.note ?? null,
        addedAt: i.addedAt
      })),
      newItem
    ]
  }

  const updated = await ordersRepo.update(order.id, { items: newItems })
  if (!updated) return
  const idx = orders.value.findIndex(o => o.id === order!.id)
  if (idx >= 0) orders.value[idx] = toOrder(updated)
}

 async function setQuantity(orderId: string, itemIdOrIndex: string | number, quantity: number) {
  const order = orders.value.find(o => o.id === orderId)
  if (!order) return

  // Konverto productId ne index nese eshte string
  let itemIndex: number
  if (typeof itemIdOrIndex === 'string') {
    itemIndex = order.items.findIndex(i => i.productId === itemIdOrIndex)
    if (itemIndex === -1) return
  } else {
    itemIndex = itemIdOrIndex
  }

  const newItems: ordersRepo.OrderItem[] = order.items.map((i, idx) => ({
    id: i.id,
    orderId: order.id,
    productId: i.productId,
    name: i.name,
    price: i.price,
    quantity: idx === itemIndex ? Math.max(0, quantity) : i.quantity,
    note: i.note ?? null,
    addedAt: i.addedAt
  }))

  const filtered = newItems.filter(i => i.quantity > 0)
  const updated = await ordersRepo.update(orderId, { items: filtered })
  if (!updated) return
  const idx = orders.value.findIndex(o => o.id === orderId)
  if (idx >= 0) orders.value[idx] = toOrder(updated)
}

  async function removeItem(orderId: string, itemIndex: number) {
    const order = orders.value.find(o => o.id === orderId)
    if (!order) return

    const newItems: ordersRepo.OrderItem[] = order.items
      .filter((_, idx) => idx !== itemIndex)
      .map(i => ({
        id: i.id,
        orderId: order.id,
        productId: i.productId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        note: i.note ?? null,
        addedAt: i.addedAt
      }))

    const updated = await ordersRepo.update(orderId, { items: newItems })
    if (!updated) return
    const idx = orders.value.findIndex(o => o.id === orderId)
    if (idx >= 0) orders.value[idx] = toOrder(updated)
  }

 async function setItemNote(orderId: string, itemIdOrIndex: string | number, note: string) {
  const order = orders.value.find(o => o.id === orderId)
  if (!order) return

  let itemIndex: number
  if (typeof itemIdOrIndex === 'string') {
    itemIndex = order.items.findIndex(i => i.productId === itemIdOrIndex)
    if (itemIndex === -1) return
  } else {
    itemIndex = itemIdOrIndex
  }

  const newItems: ordersRepo.OrderItem[] = order.items.map((i, idx) => ({
    id: i.id,
    orderId: order.id,
    productId: i.productId,
    name: i.name,
    price: i.price,
    quantity: i.quantity,
    note: idx === itemIndex ? (note || null) : (i.note ?? null),
    addedAt: i.addedAt
  }))

  const updated = await ordersRepo.update(orderId, { items: newItems })
  if (!updated) return
  const idx = orders.value.findIndex(o => o.id === orderId)
  if (idx >= 0) orders.value[idx] = toOrder(updated)
}

  async function setDiscount(orderId: string, discount: number) {
    const updated = await ordersRepo.update(orderId, { discount })
    if (!updated) return
    const idx = orders.value.findIndex(o => o.id === orderId)
    if (idx >= 0) orders.value[idx] = toOrder(updated)
  }

 async function closeOrder(orderId?: string) {
  // Nese s'jepet orderId, mbylle order-in aktual (openOrders[0])
  const targetId = orderId ?? openOrders.value[0]?.id
  if (!targetId) return

  const updated = await ordersRepo.close(targetId)
  if (!updated) {
    orders.value = orders.value.filter(o => o.id !== targetId)
    return
  }
  const idx = orders.value.findIndex(o => o.id === targetId)
  if (idx >= 0) orders.value[idx] = toOrder(updated)
}

async function payOrder(
  orderIdOrMethod: string,
  paymentOrMethod?: any,
  cashGiven?: number,
  fiscal?: boolean,
  tipAmount?: number,
  tipPercent?: number
) {
  let orderId: string
  let payment: {
    method: string
    cashGiven?: number
    fiscal?: boolean
    tipAmount?: number
    tipPercent?: number
  }

  // Nese arg-i i dyte eshte object, formati eshte (orderId, payment)
  if (typeof paymentOrMethod === 'object' && paymentOrMethod !== null) {
    orderId = orderIdOrMethod
    payment = paymentOrMethod
  } else {
    // Format i vjeter: (orderId, method, cashGiven, fiscal, tipAmount, tipPercent)
    orderId = orderIdOrMethod
    payment = {
      method: paymentOrMethod as string,
      cashGiven,
      fiscal,
      tipAmount,
      tipPercent
    }
  }

  const updated = await ordersRepo.pay(orderId, payment)
  if (!updated) return
  const idx = orders.value.findIndex(o => o.id === orderId)
  if (idx >= 0) orders.value[idx] = toOrder(updated)
}


 async function payAllForTable(
  tableId: string,
  methodOrPayment: any,
  fiscal?: boolean,
  tipAmount?: number,
  tipPercent?: number
) {
  let payment: {
    method: string
    cashGiven?: number
    fiscal?: boolean
    tipAmount?: number
    tipPercent?: number
  }

  if (typeof methodOrPayment === 'object' && methodOrPayment !== null) {
    payment = methodOrPayment
  } else {
    payment = {
      method: methodOrPayment as string,
      fiscal,
      tipAmount,
      tipPercent
    }
  }

  const results = await ordersRepo.payAllForTable(tableId, payment)
  for (const updated of results) {
    const idx = orders.value.findIndex(o => o.id === updated.id)
    if (idx >= 0) orders.value[idx] = toOrder(updated)
  }
}

  async function cancelOrder(orderId: string) {
    const updated = await ordersRepo.cancel(orderId)
    if (!updated) return
    const idx = orders.value.findIndex(o => o.id === orderId)
    if (idx >= 0) orders.value[idx] = toOrder(updated)
  }

  async function removeIfEmpty(orderId: string) {
    const order = orders.value.find(o => o.id === orderId)
    if (!order) return
    if (order.items.length > 0) return
    await ordersRepo.remove(orderId)
    orders.value = orders.value.filter(o => o.id !== orderId)
  }

  function closedOrderForTable(tableId: string) {
    return orders.value.find(o => o.tableId === tableId && o.status === 'closed')
  }
  function closedOrdersForTable(tableId: string) {
  return orders.value.filter(o => o.tableId === tableId && o.status === 'closed')
}


// Rrit sasine e nje item
async function increaseQuantity(orderId: string, itemIndex: number) {
  const order = orders.value.find(o => o.id === orderId)
  if (!order) return
  const item = order.items[itemIndex]
  if (!item) return
  await setQuantity(orderId, itemIndex, item.quantity + 1)
}

// Zvogelo sasine e nje item
async function decreaseQuantity(orderId: string, itemIndex: number) {
  const order = orders.value.find(o => o.id === orderId)
  if (!order) return
  const item = order.items[itemIndex]
  if (!item) return
  if (item.quantity <= 1) {
    await removeItem(orderId, itemIndex)
  } else {
    await setQuantity(orderId, itemIndex, item.quantity - 1)
  }
}

// Update discount by percent
async function setDiscountPercent(orderId: string, percent: number) {
  const order = orders.value.find(o => o.id === orderId)
  if (!order) return
  const discount = Math.round(order.subtotal * (percent / 100))
  await setDiscount(orderId, discount)
}

// Cleanup: fshi orders qe jane vetem items = 0
async function cleanupEmpty() {
  const empty = orders.value.filter(o => o.status === 'open' && o.items.length === 0)
  for (const o of empty) {
    await removeIfEmpty(o.id)
  }
}

// Backwards compatibility aliases
function byId(id: string): Order | undefined {
  return orders.value.find(o => o.id === id)
}

function openOrderForTable(tableId: string) {
  return openOrderFor(tableId)
}

async function cancelAllForTable(tableId: string) {
  const unpaid = unpaidOrdersForTable(tableId)
  for (const order of unpaid) {
    await cancelOrder(order.id)
  }
}

// Alias per addProductToOrder
async function addProduct(
  tableIdOrOrderId: string,
  product: { id: string; name: string; price: number },
  quantity = 1,
  staffId: string | null = null
) {
  await addProductToOrder(tableIdOrOrderId, product, quantity, staffId)
}

// Alias per setItemNote
async function setComment(orderId: string, itemIdOrIndex: string | number, comment: string) {
  await setItemNote(orderId, itemIdOrIndex, comment)
}

 return {
  orders,
  loaded,
  openOrders,
  closedOrders,
  paidOrders,
  todayStats,
  load,
  syncFromDB,
  byId,                    // ← e re
  openOrderFor,
  openOrderForTable,       // ← e re (alias)
  unpaidOrdersForTable,
  tableHasOpenOrder,
  tableTotal,
  tableOwnerStaffId,
  closedOrderForTable,
  closedOrdersForTable,
  ensureOpenOrder,
  addProduct,              // ← e re (alias)
  addProductToOrder,
  setQuantity,
  increaseQuantity,
  decreaseQuantity,
  removeItem,
  setItemNote,
  setComment,              // ← e re (alias)
  setDiscount,
  setDiscountPercent,
  closeOrder,
  payOrder,
  payAllForTable,
  cancelOrder,
  cancelAllForTable,       // ← e re
  removeIfEmpty,
  cleanupEmpty
}
})