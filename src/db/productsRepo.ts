import { getSqliteDb } from './sqlite'
import { api } from '../api/client'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
export type StockUnit = 'PIECE' | 'KG'

export type Product = {
  id: string
  name: string
  price: number
  categoryId: string | null
  imageUrl: string | null
  sortOrder: number
  trackStock: boolean
  autoDeductOnSale: boolean
  stockUnit: StockUnit
  stockQuantity: number
  pricePerKg: number | null
  defaultWeightG: number | null
  createdAt: number
  updatedAt: number
}

// Nga backend vjen keshtu (Java conventions)
type BackendProduct = {
  id: string
  name: string
  price: number
  categoryId: string | null
  imageUrl: string | null
  sortOrder: number
  trackStock: boolean
  autoDeductOnSale: boolean
  stockUnit: StockUnit
  stockQuantity: number
  pricePerKg: number | null
  defaultWeightG: number | null
}

// Nga SQLite vjen keshtu (snake_case + integer for booleans)
type SqliteProduct = {
  id: string
  name: string
  price: number
  category_id: string | null
  image_url: string | null
  sort_order: number
  track_stock: number
  auto_deduct_on_sale: number
  stock_unit: string
  stock_quantity: number
  price_per_kg: number | null
  default_weight_g: number | null
  created_at: number
  updated_at: number
}

// ─────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────
function fromSqlite(row: SqliteProduct): Product {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    categoryId: row.category_id,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    trackStock: row.track_stock === 1,
    autoDeductOnSale: row.auto_deduct_on_sale === 1,
    stockUnit: (row.stock_unit as StockUnit) ?? 'PIECE',
    stockQuantity: row.stock_quantity,
    pricePerKg: row.price_per_kg,
    defaultWeightG: row.default_weight_g,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function fromBackend(p: BackendProduct): Product {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    categoryId: p.categoryId,
    imageUrl: p.imageUrl,
    sortOrder: p.sortOrder,
    trackStock: p.trackStock,
    autoDeductOnSale: p.autoDeductOnSale,
    stockUnit: p.stockUnit,
    stockQuantity: p.stockQuantity,
    pricePerKg: p.pricePerKg,
    defaultWeightG: p.defaultWeightG,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}

// ─────────────────────────────────────────────────────────
// LOCAL operations (SQLite - source of truth per klientin)
// ─────────────────────────────────────────────────────────
async function getAllLocal(): Promise<Product[]> {
  const db = await getSqliteDb()
  const rows = await db.select<SqliteProduct[]>(
    'SELECT * FROM products ORDER BY sort_order ASC, name ASC'
  )
  return rows.map(fromSqlite)
}

async function saveLocalBatch(products: Product[]): Promise<void> {
  const db = await getSqliteDb()

  // Perdorim transaction per performance
  for (const p of products) {
    await db.execute(
      `INSERT OR REPLACE INTO products (
        id, name, price, category_id, image_url, sort_order,
        track_stock, auto_deduct_on_sale, stock_unit, stock_quantity,
        price_per_kg, default_weight_g, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.id,
        p.name,
        p.price,
        p.categoryId,
        p.imageUrl,
        p.sortOrder,
        p.trackStock ? 1 : 0,
        p.autoDeductOnSale ? 1 : 0,
        p.stockUnit,
        p.stockQuantity,
        p.pricePerKg,
        p.defaultWeightG,
        p.createdAt,
        p.updatedAt
      ]
    )
  }
}

async function saveLocal(product: Product): Promise<void> {
  await saveLocalBatch([product])
}

async function deleteLocal(id: string): Promise<void> {
  const db = await getSqliteDb()
  await db.execute('DELETE FROM products WHERE id = ?', [id])
}

// ─────────────────────────────────────────────────────────
// REMOTE operations (backend via API)
// ─────────────────────────────────────────────────────────
async function fetchFromBackend(): Promise<Product[]> {
  const raw = await api.get<BackendProduct[]>('/products')
  return raw.map(fromBackend)
}

// ─────────────────────────────────────────────────────────
// SYNC QUEUE - Zemra e offline-first per write operations
// ─────────────────────────────────────────────────────────
async function queueSync(
  entityId: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  payload: any,
  endpoint: string,
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH'
): Promise<void> {
  const db = await getSqliteDb()
  await db.execute(
    `INSERT INTO pending_sync (
      entity_type, entity_id, action, payload, endpoint, method, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['product', entityId, action, JSON.stringify(payload), endpoint, method, Date.now()]
  )
  console.log(`[Sync] Queued ${action} for product ${entityId}`)
}

// ─────────────────────────────────────────────────────────
// PUBLIC API - Ky perdoret nga store
// ─────────────────────────────────────────────────────────

/**
 * Merr te gjitha produktet.
 *
 * Strategji:
 * 1. Kthej menjehere nga SQLite (i shpejte, gjithmone punon)
 * 2. Ne background, provo backend
 * 3. Nese backend punon, update SQLite dhe kthej te dhena te fresketa
 */
export async function getAll(): Promise<Product[]> {
  // 1. Merr te dhena lokale (gjithmone punon, edhe offline)
  const localData = await getAllLocal()

  // 2. Ne background, provo te sync me backend
  fetchFromBackend()
    .then(async (remoteData) => {
      if (remoteData.length > 0) {
        await saveLocalBatch(remoteData)
        console.log(`[Products] Synced ${remoteData.length} products from backend`)
      }
    })
    .catch((err) => {
      console.warn('[Products] Backend fetch failed (offline?), using local data:', err.message)
    })

  return localData
}

/**
 * Force refresh nga backend (perdoret per pull-to-refresh).
 * Nese backend deshton, kthen te dhena lokale.
 */
export async function refresh(): Promise<Product[]> {
  try {
    const remoteData = await fetchFromBackend()
    await saveLocalBatch(remoteData)
    return remoteData
  } catch (err) {
    console.warn('[Products] Refresh failed, using local:', err)
    return getAllLocal()
  }
}

/**
 * Krijo produkt te ri.
 *
 * Strategji:
 * 1. Gjenero UUID lokalisht
 * 2. Ruaj ne SQLite (menjehere)
 * 3. Provo backend
 * 4. Nese deshton, shto ne pending_sync per retry me vone
 */
export async function create(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
  const now = Date.now()
  const id = crypto.randomUUID()

  const product: Product = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now
  }

  // 1. Ruaj lokal (menjehere - UI reagon menjehere)
  await saveLocal(product)

  // 2. Provo backend
  try {
    const backendPayload = {
      id: product.id,
      name: product.name,
      price: product.price,
      categoryId: product.categoryId,
      imageUrl: product.imageUrl,
      sortOrder: product.sortOrder,
      trackStock: product.trackStock,
      autoDeductOnSale: product.autoDeductOnSale,
      stockUnit: product.stockUnit,
      stockQuantity: product.stockQuantity,
      pricePerKg: product.pricePerKg,
      defaultWeightG: product.defaultWeightG
    }
    await api.post('/products', backendPayload)
    console.log(`[Products] Created ${id} on backend`)
  } catch (err) {
    console.warn(`[Products] Backend create failed, queued for sync:`, err)
    await queueSync(id, 'CREATE', {
      id: product.id,
      name: product.name,
      price: product.price,
      categoryId: product.categoryId,
      imageUrl: product.imageUrl,
      sortOrder: product.sortOrder,
      trackStock: product.trackStock,
      autoDeductOnSale: product.autoDeductOnSale,
      stockUnit: product.stockUnit,
      stockQuantity: product.stockQuantity,
      pricePerKg: product.pricePerKg,
      defaultWeightG: product.defaultWeightG
    }, '/products', 'POST')
  }

  return product
}

/**
 * Update produkt ekzistues.
 */
export async function update(id: string, changes: Partial<Product>): Promise<Product | null> {
  const db = await getSqliteDb()

  // 1. Merr produktin ekzistues
  const existing = await db.select<SqliteProduct[]>(
    'SELECT * FROM products WHERE id = ?',
    [id]
  )
  if (existing.length === 0) return null

  const current = fromSqlite(existing[0])
  const updated: Product = {
    ...current,
    ...changes,
    id,
    updatedAt: Date.now()
  }

  // 2. Ruaj lokal
  await saveLocal(updated)

  // 3. Provo backend
  try {
    const backendPayload = {
      id: updated.id,
      name: updated.name,
      price: updated.price,
      categoryId: updated.categoryId,
      imageUrl: updated.imageUrl,
      sortOrder: updated.sortOrder,
      trackStock: updated.trackStock,
      autoDeductOnSale: updated.autoDeductOnSale,
      stockUnit: updated.stockUnit,
      stockQuantity: updated.stockQuantity,
      pricePerKg: updated.pricePerKg,
      defaultWeightG: updated.defaultWeightG
    }
    await api.put(`/products/${id}`, backendPayload)
    console.log(`[Products] Updated ${id} on backend`)
  } catch (err) {
    console.warn(`[Products] Backend update failed, queued for sync:`, err)
    await queueSync(id, 'UPDATE', {
      id: updated.id,
      name: updated.name,
      price: updated.price,
      categoryId: updated.categoryId,
      imageUrl: updated.imageUrl,
      sortOrder: updated.sortOrder,
      trackStock: updated.trackStock,
      autoDeductOnSale: updated.autoDeductOnSale,
      stockUnit: updated.stockUnit,
      stockQuantity: updated.stockQuantity,
      pricePerKg: updated.pricePerKg,
      defaultWeightG: updated.defaultWeightG
    }, `/products/${id}`, 'PUT')
  }

  return updated
}

/**
 * Fshi produkt.
 */
export async function remove(id: string): Promise<void> {
  // 1. Fshi lokal
  await deleteLocal(id)

  // 2. Provo backend
  try {
    await api.delete(`/products/${id}`)
    console.log(`[Products] Deleted ${id} on backend`)
  } catch (err) {
    console.warn(`[Products] Backend delete failed, queued for sync:`, err)
    await queueSync(id, 'DELETE', {}, `/products/${id}`, 'DELETE')
  }
}

/**
 * Debug: kontrollo sa items jane ne pending_sync per products
 */
export async function getPendingSyncCount(): Promise<number> {
  const db = await getSqliteDb()
  const result = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM pending_sync WHERE entity_type = 'product'`
  )
  return result[0]?.count ?? 0
}