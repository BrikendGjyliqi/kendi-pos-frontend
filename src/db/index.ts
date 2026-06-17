/**
 * Kendi POS — IndexedDB data layer
 *
 * Why IndexedDB over localStorage:
 *  - Async (won't block UI when DB grows)
 *  - Indexed queries (find products by category in O(log n))
 *  - Transactional (no partial writes on crash)
 *  - Holds GBs of data, not 5MB
 *  - True offline-first foundation
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

// ─────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────

export type ID = string

export type Category = {
  id: ID
  name: string
  color: string         // hex color used as visual identifier
  sortOrder: number
  createdAt: number
}

export type Product = {
  id: ID
  name: string
  price: number         // in cents (€1.20 → 120) — never use floats for money
  categoryId: ID
  sku?: string
  sortOrder: number
  active: boolean
  createdAt: number
}

export type Table = {
  id: ID
  name: string
  sortOrder: number
  createdAt: number
}

export type OrderItem = {
  productId: ID
  name: string          // snapshot — products may rename later
  price: number         // snapshot in cents
  categoryId: ID
  quantity: number
  comment: string
  addedAt: number
}

export type Order = {
  id: ID
  tableId: ID
  // open = aktiv, ende po shtohen produkte (vetem 1 per tavoline)
  // closed = porosia u perfundua por nuk osht paguar ende
  // paid = osht paguar (final state)
  // cancelled = u anulua
  status: 'open' | 'closed' | 'paid' | 'cancelled'
  items: OrderItem[]
  subtotal: number
  discount: number
  total: number
  paymentMethod?: 'cash' | 'card' | 'other'
  cashGiven?: number
  fiscal?: boolean
  staffId?: ID
  openedAt: number
  closedAt?: number
  paidAt?: number          // kur u paguar (separate nga closedAt)
}

export type Staff = {
  status: string
  id: ID
  name: string
  pin: string           // 4-digit PIN
  role: 'admin' | 'cashier'
  active: boolean
  createdAt: number
}

export type Setting = {
  key: string
  value: unknown
}

// ─────────────────────────────────────────────────────────────
//  Schema
// ─────────────────────────────────────────────────────────────

interface KendiDB extends DBSchema {
  categories: {
    key: string
    value: Category
    indexes: { 'by-sortOrder': number }
  }
  products: {
    key: string
    value: Product
    indexes: {
      'by-category': string
      'by-sortOrder': number
    }
  }
  tables: {
    key: string
    value: Table
    indexes: { 'by-sortOrder': number }
  }
  orders: {
    key: string
    value: Order
    indexes: {
      'by-table': string
      'by-status': string
      'by-openedAt': number
    }
  }
  staff: {
    key: string
    value: Staff
    indexes: { 'by-pin': string }
  }
  settings: {
    key: string
    value: Setting
  }
}

// ─────────────────────────────────────────────────────────────
//  DB connection (singleton)
// ─────────────────────────────────────────────────────────────

const DB_NAME = 'kendi-pos'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<KendiDB>> | null = null

export function getDB(): Promise<IDBPDatabase<KendiDB>> {
  if (!dbPromise) {
    dbPromise = openDB<KendiDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Categories
        const cats = db.createObjectStore('categories', { keyPath: 'id' })
        cats.createIndex('by-sortOrder', 'sortOrder')

        // Products
        const prods = db.createObjectStore('products', { keyPath: 'id' })
        prods.createIndex('by-category', 'categoryId')
        prods.createIndex('by-sortOrder', 'sortOrder')

        // Tables
        const tbls = db.createObjectStore('tables', { keyPath: 'id' })
        tbls.createIndex('by-sortOrder', 'sortOrder')

        // Orders
        const ords = db.createObjectStore('orders', { keyPath: 'id' })
        ords.createIndex('by-table', 'tableId')
        ords.createIndex('by-status', 'status')
        ords.createIndex('by-openedAt', 'openedAt')

        // Staff
        const stf = db.createObjectStore('staff', { keyPath: 'id' })
        stf.createIndex('by-pin', 'pin', { unique: true })

        // Settings (single key-value store)
        db.createObjectStore('settings', { keyPath: 'key' })
      }
    })
  }
  return dbPromise
}

// ─────────────────────────────────────────────────────────────
//  ID generator
// ─────────────────────────────────────────────────────────────

export function uid(): ID {
  // crypto.randomUUID kerkon HTTPS ose localhost — perdor fallback per HTTP ne LAN
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback: 16-byte random hex (i mjafton si UUID)
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  // Format UUID v4
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// ─────────────────────────────────────────────────────────────
//  Money helpers — always store/calculate in cents
// ─────────────────────────────────────────────────────────────

export function formatMoney(cents: number, currency = '€'): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${currency} ${(abs / 100).toFixed(2)}`
}

export function parseMoney(input: string): number {
  const cleaned = input.replace(/[^\d.,]/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return Number.isNaN(num) ? 0 : Math.round(num * 100)
}

export function calcSubtotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
}