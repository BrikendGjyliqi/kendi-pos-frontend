import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api/client'
import { useProductsStore } from './products'

export type OrderItem = {
  id?: string
  productId: string
  name: string
  price: number
  categoryId: string
  quantity: number
  comment: string
  addedAt: number
}

export type Order = {
  id: string
  tableId: string
  status: 'open' | 'closed' | 'paid' | 'cancelled'
  items: OrderItem[]
  subtotal: number
  discount: number
  total: number
  paymentMethod?: 'cash' | 'card' | 'other'
  cashGiven?: number
  fiscal?: boolean
  staffId?: string
  openedAt: number
  closedAt?: number
  paidAt?: number
}

export type Product = {
  id: string
  name: string
  price: number
  categoryId: string
}

export const useOrdersStore = defineStore('orders', () => {
  const orders = ref<Order[]>([])
  const loaded = ref(false)

  const openOrders = computed(() => orders.value.filter(o => o.status === 'open'))
  const paidOrders = computed(() => orders.value.filter(o => o.status === 'paid'))

  function byId(id: string): Order | undefined {
    return orders.value.find(o => o.id === id)
  }

  function ordersByTable(tableId: string): Order[] {
    return orders.value
      .filter(o => o.tableId === tableId)
      .sort((a, b) => a.openedAt - b.openedAt)
  }

  function activeOrderForTable(tableId: string): Order | null {
    return orders.value.find(o => o.tableId === tableId && o.status === 'open') ?? null
  }

  function closedOrdersForTable(tableId: string): Order[] {
    return orders.value
      .filter(o => o.tableId === tableId && o.status === 'closed')
      .sort((a, b) => a.openedAt - b.openedAt)
  }

  function unpaidOrdersForTable(tableId: string): Order[] {
    return orders.value
      .filter(o => o.tableId === tableId && (o.status === 'open' || o.status === 'closed'))
      .sort((a, b) => a.openedAt - b.openedAt)
  }

  function tableTotal(tableId: string): number {
    return unpaidOrdersForTable(tableId).reduce((sum, o) => sum + o.total, 0)
  }

  function tableHasOpenOrder(tableId: string): boolean {
    return unpaidOrdersForTable(tableId).length > 0
  }

  function tableOwnerStaffId(tableId: string): string | undefined {
    const list = unpaidOrdersForTable(tableId)
    return list[0]?.staffId
  }

  const todayStats = computed(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const todayPaid = paidOrders.value.filter(o => (o.paidAt ?? o.closedAt ?? 0) >= start.getTime())
    const total = todayPaid.reduce((sum, o) => sum + o.total, 0)
    return { count: todayPaid.length, total }
  })

  // ─── Loading ───
  async function load() {
    if (loaded.value) return
    orders.value = await api.get<Order[]>('/orders')
    loaded.value = true
  }

  async function syncFromDB() {
    const fresh = await api.get<Order[]>('/orders')
    for (const f of fresh) {
      const idx = orders.value.findIndex(o => o.id === f.id)
      if (idx >= 0) orders.value[idx] = f
      else orders.value.push(f)
    }
  }

  // Refresh products stock pas payment-it
  async function refreshStock() {
    try {
      const productsStore = useProductsStore()
      await productsStore.reload()
    } catch (e) {
      console.warn('Failed to refresh product stock:', e)
    }
  }

  // ─── Operations ───

  async function ensureOpenOrder(tableId: string, staffId?: string): Promise<Order> {
    const existing = activeOrderForTable(tableId)
    if (existing) return existing

    const order = await api.post<Order>('/orders', {
      tableId,
      status: 'open',
      items: [],
      subtotal: 0,
      discount: 0,
      total: 0,
      staffId
    })
    orders.value.push(order)
    return order
  }

  async function closeOrder(orderId: string) {
    const order = byId(orderId)
    if (!order || order.status !== 'open') return
    if (order.items.length === 0) {
      await removeIfEmpty(orderId)
      return
    }
    const updated = await api.post<Order>(`/orders/${orderId}/close`)
    if (updated) {
      const idx = orders.value.findIndex(o => o.id === orderId)
      if (idx >= 0) orders.value[idx] = updated
    }
  }

  async function addProduct(orderId: string, product: Product) {
    const order = byId(orderId)
    if (!order || order.status !== 'open') return

    const existing = order.items.find(i => i.productId === product.id && !i.comment)
    if (existing) {
      existing.quantity++
    } else {
      order.items.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        categoryId: product.categoryId,
        quantity: 1,
        comment: '',
        addedAt: Date.now()
      })
    }
    await persist(order)
  }

  async function setQuantity(orderId: string, index: number, qty: number) {
    const order = byId(orderId)
    if (!order || order.status !== 'open') return
    if (qty <= 0) order.items.splice(index, 1)
    else order.items[index].quantity = qty
    await persist(order)
  }

  async function setComment(orderId: string, index: number, comment: string) {
    const order = byId(orderId)
    if (!order || order.status !== 'open') return
    order.items[index].comment = comment
    await persist(order)
  }

  async function removeItem(orderId: string, index: number) {
    const order = byId(orderId)
    if (!order || order.status !== 'open') return
    order.items.splice(index, 1)
    await persist(order)
  }

  async function setDiscount(orderId: string, discount: number) {
    const order = byId(orderId)
    if (!order || order.status !== 'open') return
    order.discount = Math.max(0, Math.round(discount))
    await persist(order)
  }

  async function pay(orderId: string, opts: {
    method: 'cash' | 'card' | 'other'
    cashGiven?: number
    fiscal?: boolean
  }) {
    const updated = await api.post<Order>(`/orders/${orderId}/pay`, opts)
    if (updated) {
      const idx = orders.value.findIndex(o => o.id === orderId)
      if (idx >= 0) orders.value[idx] = updated
    }
    await refreshStock()
  }

  async function payAllForTable(tableId: string, opts: {
    method: 'cash' | 'card' | 'other'
    cashGiven?: number
    fiscal?: boolean
    tipAmount?: number
    tipPercent?: number
  }) {
    const updated = await api.post<Order[]>(`/orders/table/${tableId}/pay-all`, opts)
    if (updated) {
      for (const u of updated) {
        const idx = orders.value.findIndex(o => o.id === u.id)
        if (idx >= 0) orders.value[idx] = u
      }
    }
    await refreshStock()
  }

  async function cancel(orderId: string) {
    const updated = await api.post<Order>(`/orders/${orderId}/cancel`)
    if (updated) {
      const idx = orders.value.findIndex(o => o.id === orderId)
      if (idx >= 0) orders.value[idx] = updated
    }
  }

  async function cancelAllForTable(tableId: string) {
    const list = unpaidOrdersForTable(tableId)
    for (const o of list) {
      await cancel(o.id)
    }
  }

  async function removeIfEmpty(orderId: string): Promise<boolean> {
    const order = byId(orderId)
    if (!order || order.status !== 'open' || order.items.length > 0) return false
    await api.delete(`/orders/${orderId}`)
    orders.value = orders.value.filter(o => o.id !== orderId)
    return true
  }

  async function persist(order: Order) {
    order.subtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0)
    order.total = Math.max(0, order.subtotal - order.discount)
    const updated = await api.put<Order>(`/orders/${order.id}`, order)
    if (updated) {
      const idx = orders.value.findIndex(o => o.id === order.id)
      if (idx >= 0) orders.value[idx] = updated
    }
  }

  return {
    orders,
    openOrders,
    paidOrders,
    loaded,
    byId,
    ordersByTable,
    activeOrderForTable,
    closedOrdersForTable,
    unpaidOrdersForTable,
    tableTotal,
    tableHasOpenOrder,
    tableOwnerStaffId,
    todayStats,
    load,
    syncFromDB,
    ensureOpenOrder,
    closeOrder,
    addProduct,
    setQuantity,
    setComment,
    removeItem,
    setDiscount,
    pay,
    payAllForTable,
    cancel,
    cancelAllForTable,
    removeIfEmpty,
    openOrderForTable: activeOrderForTable
  }
})