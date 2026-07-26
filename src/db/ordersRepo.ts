import { getSqliteDb } from './sqlite'
import { api } from '../api/client'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
export type OrderStatus = 'open' | 'closed' | 'paid' | 'cancelled'

export type OrderItem = {
  id: string
  orderId: string
  productId: string
  name: string
  price: number
  quantity: number
  note: string | null
  addedAt: number
}

export type Order = {
  id: string
  tableId: string
  status: OrderStatus
  subtotal: number
  discount: number
  total: number
  paymentMethod: string | null
  cashGiven: number | null
  fiscal: boolean | null
  staffId: string | null
  tipAmount: number | null
  tipPercent: number | null
  openedAt: number
  closedAt: number | null
  paidAt: number | null
  items: OrderItem[]
}

type BackendOrderItem = {
  id: string
  productId: string
  name: string
  price: number
  quantity: number
  note: string | null
  addedAt: number
}

type BackendOrder = {
  id: string
  tableId: string
  status: string
  subtotal: number
  discount: number
  total: number
  paymentMethod: string | null
  cashGiven: number | null
  fiscal: boolean | null
  staffId: string | null
  tipAmount: number | null
  tipPercent: number | null
  openedAt: number
  closedAt: number | null
  paidAt: number | null
  items: BackendOrderItem[]
}

type SqliteOrder = {
  id: string
  table_id: string
  status: string
  subtotal: number
  discount: number
  total: number
  payment_method: string | null
  cash_given: number | null
  fiscal: number | null
  staff_id: string | null
  tip_amount: number | null
  tip_percent: number | null
  opened_at: number
  closed_at: number | null
  paid_at: number | null
}

type SqliteOrderItem = {
  id: string
  order_id: string
  product_id: string
  name: string
  price: number
  quantity: number
  note: string | null
  added_at: number
}

// ─────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────
function itemFromSqlite(row: SqliteOrderItem): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    name: row.name,
    price: row.price,
    quantity: row.quantity,
    note: row.note,
    addedAt: row.added_at
  }
}

function orderFromSqlite(row: SqliteOrder, items: OrderItem[]): Order {
  return {
    id: row.id,
    tableId: row.table_id,
    status: row.status as OrderStatus,
    subtotal: row.subtotal,
    discount: row.discount,
    total: row.total,
    paymentMethod: row.payment_method,
    cashGiven: row.cash_given,
    fiscal: row.fiscal === null ? null : row.fiscal === 1,
    staffId: row.staff_id,
    tipAmount: row.tip_amount,
    tipPercent: row.tip_percent,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    paidAt: row.paid_at,
    items
  }
}

function itemFromBackend(i: BackendOrderItem, orderId: string): OrderItem {
  return {
    id: i.id,
    orderId,
    productId: i.productId,
    name: i.name,
    price: i.price,
    quantity: i.quantity,
    note: i.note,
    addedAt: i.addedAt
  }
}

function orderFromBackend(o: BackendOrder): Order {
  return {
    id: o.id,
    tableId: o.tableId,
    status: o.status as OrderStatus,
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
    items: (o.items ?? []).map(i => itemFromBackend(i, o.id))
  }
}

// ─────────────────────────────────────────────────────────
// LOCAL operations
// ─────────────────────────────────────────────────────────
async function getAllLocal(): Promise<Order[]> {
  const db = await getSqliteDb()
  const orderRows = await db.select<SqliteOrder[]>(
    'SELECT * FROM orders ORDER BY opened_at DESC'
  )

  const orders: Order[] = []
  for (const row of orderRows) {
    const itemRows = await db.select<SqliteOrderItem[]>(
      'SELECT * FROM order_items WHERE order_id = ? ORDER BY added_at ASC',
      [row.id]
    )
    const items = itemRows.map(itemFromSqlite)
    orders.push(orderFromSqlite(row, items))
  }
  return orders
}

async function saveLocal(order: Order): Promise<void> {
  const db = await getSqliteDb()

  // Ruaj order-in
  await db.execute(
    `INSERT OR REPLACE INTO orders (
      id, table_id, status, subtotal, discount, total,
      payment_method, cash_given, fiscal, staff_id,
      tip_amount, tip_percent, opened_at, closed_at, paid_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      order.id, order.tableId, order.status, order.subtotal, order.discount, order.total,
      order.paymentMethod, order.cashGiven,
      order.fiscal === null ? null : (order.fiscal ? 1 : 0),
      order.staffId, order.tipAmount, order.tipPercent,
      order.openedAt, order.closedAt, order.paidAt
    ]
  )

  // Fshi items ekzistuese dhe ri-ruaj
  await db.execute('DELETE FROM order_items WHERE order_id = ?', [order.id])
  for (const item of order.items) {
    await db.execute(
      `INSERT INTO order_items (
        id, order_id, product_id, name, price, quantity, note, added_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.id, order.id, item.productId, item.name, item.price, item.quantity, item.note, item.addedAt]
    )
  }
}

async function saveLocalBatch(orders: Order[]): Promise<void> {
  for (const order of orders) {
    await saveLocal(order)
  }
}

async function deleteLocal(id: string): Promise<void> {
  const db = await getSqliteDb()
  await db.execute('DELETE FROM order_items WHERE order_id = ?', [id])
  await db.execute('DELETE FROM orders WHERE id = ?', [id])
}

// ─────────────────────────────────────────────────────────
// REMOTE operations
// ─────────────────────────────────────────────────────────
async function fetchFromBackend(): Promise<Order[]> {
  const results: BackendOrder[] = []

  try {
    const openOrders = await api.get<BackendOrder[]>('/orders?status=open')
    if (Array.isArray(openOrders)) results.push(...openOrders)
  } catch (err) {
    console.warn('[Orders] Failed to fetch open orders:', err)
  }

  try {
    const closedOrders = await api.get<BackendOrder[]>('/orders?status=closed')
    if (Array.isArray(closedOrders)) results.push(...closedOrders)
  } catch (err) {
    console.warn('[Orders] Failed to fetch closed orders:', err)
  }

  return results.map(orderFromBackend)
}

// ─────────────────────────────────────────────────────────
// SYNC QUEUE
// ─────────────────────────────────────────────────────────
async function queueSync(
  entityId: string,
  action: string,
  payload: any,
  endpoint: string,
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH'
): Promise<void> {
  const db = await getSqliteDb()
  await db.execute(
    `INSERT INTO pending_sync (
      entity_type, entity_id, action, payload, endpoint, method, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['order', entityId, action, JSON.stringify(payload), endpoint, method, Date.now()]
  )
  console.log(`[Sync] Queued ${action} for order ${entityId}`)
}

// ─────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────

export async function getAll(): Promise<Order[]> {
  const localData = await getAllLocal()

  fetchFromBackend()
    .then(async (remoteData) => {
      if (remoteData.length > 0) {
        await saveLocalBatch(remoteData)
        console.log(`[Orders] Synced ${remoteData.length} orders from backend`)
      }
    })
    .catch((err) => {
      console.warn('[Orders] Backend fetch failed (offline?), using local:', err.message)
    })

  return localData
}

export async function refresh(): Promise<Order[]> {
  try {
    const remoteData = await fetchFromBackend()
    if (remoteData && remoteData.length > 0) {
      await saveLocalBatch(remoteData)
      return remoteData
    }
    // Nese remoteData eshte bosh po s'ka error, ndoshta jane fshire ne server
    return await getAllLocal()
  } catch (err) {
    console.warn('[Orders] Refresh failed, using local:', err)
    return getAllLocal()
  }
}

/**
 * Krijim i nje porosie te re
 */
export async function create(data: {
  tableId: string
  staffId: string | null
  items?: OrderItem[]
}): Promise<Order> {
  const now = Date.now()
  const id = crypto.randomUUID()

  const order: Order = {
    id,
    tableId: data.tableId,
    status: 'open',
    subtotal: 0,
    discount: 0,
    total: 0,
    paymentMethod: null,
    cashGiven: null,
    fiscal: null,
    staffId: data.staffId,
    tipAmount: null,
    tipPercent: null,
    openedAt: now,
    closedAt: null,
    paidAt: null,
    items: data.items ?? []
  }

  // Rillogarite total
  recalculate(order)

  await saveLocal(order)

  try {
    const created = await api.post<BackendOrder>('/orders', {
      tableId: order.tableId,
      staffId: order.staffId,
      discount: 0,
      status: 'open',
      items: order.items.map(i => ({
        productId: i.productId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        note: i.note,
        addedAt: i.addedAt
      }))
    })
    // Backend kthen id te vet, update lokal
    if (created.id !== id) {
      await deleteLocal(id)
      const updated = orderFromBackend(created)
      await saveLocal(updated)
      return updated
    }
  } catch {
    await queueSync(id, 'CREATE', {
      id: order.id,
      tableId: order.tableId,
      staffId: order.staffId,
      discount: 0,
      status: 'open',
      items: order.items.map(i => ({
        id: i.id,
        productId: i.productId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        note: i.note,
        addedAt: i.addedAt
      }))
    }, '/orders', 'POST')
  }

  return order
}

/**
 * Update i porosie (items, discount)
 */
export async function update(id: string, changes: {
  items?: OrderItem[]
  discount?: number
}): Promise<Order | null> {
  const db = await getSqliteDb()
  const existing = await db.select<SqliteOrder[]>(
    'SELECT * FROM orders WHERE id = ?', [id]
  )
  if (existing.length === 0) return null

  const existingItems = await db.select<SqliteOrderItem[]>(
    'SELECT * FROM order_items WHERE order_id = ? ORDER BY added_at ASC',
    [id]
  )
  const current = orderFromSqlite(existing[0], existingItems.map(itemFromSqlite))

  const updated: Order = {
    ...current,
    items: changes.items ?? current.items,
    discount: changes.discount ?? current.discount
  }

  recalculate(updated)
  await saveLocal(updated)

  try {
   // Merr categoryId nga products cache per cdo item
    const productsData = await getSqliteDb().then(db =>
      db.select<{ id: string; category_id: string | null }[]>(
        'SELECT id, category_id FROM products'
      )
    )
    const catMap = new Map<string, string | null>()
    for (const p of productsData) catMap.set(p.id, p.category_id)

    await api.put(`/orders/${id}`, {
      discount: updated.discount,
      items: updated.items.map(i => ({
        productId: i.productId,
        categoryId: catMap.get(i.productId) ?? null,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        note: i.note,
        addedAt: i.addedAt
      }))
    })
  } catch {
    await queueSync(id, 'UPDATE', {
      discount: updated.discount,
      items: updated.items.map(i => ({
        id: i.id,
        productId: i.productId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        note: i.note,
        addedAt: i.addedAt
      }))
    }, `/orders/${id}`, 'PUT')
  }

  return updated
}

/**
 * Close order (para pageses)
 */
export async function close(id: string): Promise<Order | null> {
  const db = await getSqliteDb()
  const existing = await db.select<SqliteOrder[]>(
    'SELECT * FROM orders WHERE id = ?', [id]
  )
  if (existing.length === 0) return null

  const existingItems = await db.select<SqliteOrderItem[]>(
    'SELECT * FROM order_items WHERE order_id = ?', [id]
  )
  const current = orderFromSqlite(existing[0], existingItems.map(itemFromSqlite))

  if (current.items.length === 0) {
    // Fshije nese eshte zbrazur
    await deleteLocal(id)
    try {
      await api.post(`/orders/${id}/close`)
    } catch {
      await queueSync(id, 'CLOSE', {}, `/orders/${id}/close`, 'POST')
    }
    return null
  }

  const updated: Order = {
    ...current,
    status: 'closed',
    closedAt: Date.now()
  }

  await saveLocal(updated)

  try {
    await api.post(`/orders/${id}/close`)
  } catch {
    await queueSync(id, 'CLOSE', {}, `/orders/${id}/close`, 'POST')
  }

  return updated
}

/**
 * Pagese e porosie
 */
export async function pay(id: string, payment: {
  method: string
  cashGiven?: number
  fiscal?: boolean
  tipAmount?: number
  tipPercent?: number
}): Promise<Order | null> {
  const db = await getSqliteDb()
  const existing = await db.select<SqliteOrder[]>(
    'SELECT * FROM orders WHERE id = ?', [id]
  )
  if (existing.length === 0) return null

  const existingItems = await db.select<SqliteOrderItem[]>(
    'SELECT * FROM order_items WHERE order_id = ?', [id]
  )
  const current = orderFromSqlite(existing[0], existingItems.map(itemFromSqlite))

  const now = Date.now()
  const updated: Order = {
    ...current,
    status: 'paid',
    paymentMethod: payment.method,
    cashGiven: payment.cashGiven ?? null,
    fiscal: payment.fiscal ?? null,
    tipAmount: payment.tipAmount ?? null,
    tipPercent: payment.tipPercent ?? null,
    paidAt: now,
    closedAt: current.closedAt ?? now
  }

  await saveLocal(updated)

  try {
    await api.post(`/orders/${id}/pay`, payment)
  } catch {
    await queueSync(id, 'PAY', payment, `/orders/${id}/pay`, 'POST')
  }

  return updated
}

/**
 * Cancel order
 */
export async function cancel(id: string): Promise<Order | null> {
  const db = await getSqliteDb()
  const existing = await db.select<SqliteOrder[]>(
    'SELECT * FROM orders WHERE id = ?', [id]
  )
  if (existing.length === 0) return null

  const existingItems = await db.select<SqliteOrderItem[]>(
    'SELECT * FROM order_items WHERE order_id = ?', [id]
  )
  const current = orderFromSqlite(existing[0], existingItems.map(itemFromSqlite))

  const updated: Order = {
    ...current,
    status: 'cancelled',
    closedAt: Date.now()
  }

  await saveLocal(updated)

  try {
    await api.post(`/orders/${id}/cancel`)
  } catch {
    await queueSync(id, 'CANCEL', {}, `/orders/${id}/cancel`, 'POST')
  }

  return updated
}

/**
 * Pay all open/closed orders for a table
 */
export async function payAllForTable(tableId: string, payment: {
  method: string
  cashGiven?: number
  fiscal?: boolean
  tipAmount?: number
  tipPercent?: number
}): Promise<Order[]> {
  const db = await getSqliteDb()
  const rows = await db.select<SqliteOrder[]>(
    `SELECT * FROM orders WHERE table_id = ? AND status IN ('open', 'closed')`,
    [tableId]
  )

  const now = Date.now()
  const results: Order[] = []
  const totalSum = rows.reduce((s, o) => s + o.total, 0)
  const totalTip = payment.tipAmount ?? 0
  let tipAssigned = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const items = await db.select<SqliteOrderItem[]>(
      'SELECT * FROM order_items WHERE order_id = ?', [row.id]
    )
    const order = orderFromSqlite(row, items.map(itemFromSqlite))

    let share = 0
    if (totalTip > 0 && totalSum > 0) {
      if (i === rows.length - 1) share = totalTip - tipAssigned
      else {
        share = Math.round((totalTip * order.total) / totalSum)
        tipAssigned += share
      }
    }

    const updated: Order = {
      ...order,
      status: 'paid',
      paymentMethod: payment.method,
      cashGiven: i === 0 ? payment.cashGiven ?? null : null,
      fiscal: payment.fiscal ?? null,
      tipAmount: share > 0 ? share : null,
      tipPercent: share > 0 ? (payment.tipPercent ?? null) : null,
      paidAt: now,
      closedAt: order.closedAt ?? now
    }

    await saveLocal(updated)
    results.push(updated)
  }

  try {
    await api.post(`/orders/table/${tableId}/pay-all`, payment)
  } catch {
    await queueSync(tableId, 'PAY_ALL', payment, `/orders/table/${tableId}/pay-all`, 'POST')
  }

  return results
}

/**
 * Fshi order (perdoret kur eshte i zbrazur ne close)
 */
export async function remove(id: string): Promise<void> {
  await deleteLocal(id)
  try {
    await api.delete(`/orders/${id}`)
  } catch {
    await queueSync(id, 'DELETE', {}, `/orders/${id}`, 'DELETE')
  }
}

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────
function recalculate(order: Order): void {
  order.subtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0)
  order.total = Math.max(0, order.subtotal - order.discount)
}