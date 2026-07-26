import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '../api/client'
import * as productsRepo from '../db/productsRepo'

export type StockUnit = 'PIECE' | 'KG'

export type Product = {
  id: string
  name: string
  price: number
  categoryId: string | null
  imageUrl: string | null
  sortOrder: number
  createdAt: number
  updatedAt: number
  trackStock: boolean
  autoDeductOnSale: boolean
  stockUnit: StockUnit
  stockQuantity: number
  pricePerKg: number | null
  defaultWeightG: number | null
  active: boolean
  lowStockThreshold: number | null
}

type CreateProductInput = {
  name: string
  price: number
  categoryId?: string | null
  imageUrl?: string | null
  sortOrder?: number
  trackStock?: boolean
  autoDeductOnSale?: boolean
  stockUnit?: StockUnit
  stockQuantity?: number
  pricePerKg?: number | null
  defaultWeightG?: number | null
}

type UpdateProductInput = Partial<CreateProductInput>

// ─────────────────────────────────────────────────────────
// Helpers per convert API ↔ store types
// ─────────────────────────────────────────────────────────
function toProduct(p: productsRepo.Product): Product {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    categoryId: p.categoryId,
    imageUrl: p.imageUrl,
    sortOrder: p.sortOrder,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    trackStock: p.trackStock,
    autoDeductOnSale: p.autoDeductOnSale,
    stockUnit: p.stockUnit,
    stockQuantity: p.stockQuantity,
    pricePerKg: p.pricePerKg,
    defaultWeightG: p.defaultWeightG,
    active: true,
    lowStockThreshold: null
  }
}

export const useProductsStore = defineStore('products', () => {
  const products = ref<Product[]>([])
  const loaded = ref(false)

  const byId = computed(() => {
    const map = new Map<string, Product>()
    for (const p of products.value) map.set(p.id, p)
    return map
  })

  const byCategory = computed(() => {
    const map = new Map<string, Product[]>()
    for (const p of products.value) {
      if (!p.categoryId) continue
      const list = map.get(p.categoryId) ?? []
      list.push(p)
      map.set(p.categoryId, list)
    }
    return map
  })

  // ─────────────────────────────────────────────────────────
  // OFFLINE-FIRST: Load nga SQLite + sync ne background
  // ─────────────────────────────────────────────────────────
  async function load() {
    if (loaded.value) return
    const repoProducts = await productsRepo.getAll()
    products.value = repoProducts.map(toProduct)
    loaded.value = true
    console.log(`[Products Store] Loaded ${products.value.length} products (offline-first)`)

    // Ne background, provo sync me backend dhe update store nese ka te dhena te reja
    setTimeout(async () => {
      try {
        const fresh = await productsRepo.refresh()
        // Nese vjen ndryshim, update store
        if (fresh.length !== products.value.length ||
            fresh.some(p => {
              const existing = byId.value.get(p.id)
              return !existing || existing.updatedAt !== p.updatedAt
            })) {
          products.value = fresh.map(toProduct)
          console.log(`[Products Store] Auto-refreshed ${fresh.length} products`)
        }
      } catch {
        // silent - offline mode
      }
    }, 1000)
  }

  async function reload() {
    const fresh = await productsRepo.refresh()
    products.value = fresh.map(toProduct)
  }

  async function create(input: CreateProductInput): Promise<Product> {
    const productData = {
      name: input.name.trim(),
      price: Math.round(input.price),
      categoryId: input.categoryId ?? null,
      imageUrl: input.imageUrl ?? null,
      sortOrder: input.sortOrder ?? products.value.length,
      trackStock: input.trackStock ?? false,
      autoDeductOnSale: input.autoDeductOnSale ?? false,
      stockUnit: input.stockUnit ?? 'PIECE',
      stockQuantity: input.stockQuantity ?? 0,
      pricePerKg: input.pricePerKg ?? null,
      defaultWeightG: input.defaultWeightG ?? null
    }

    const created = await productsRepo.create(productData)
    const product = toProduct(created)
    products.value.push(product)
    return product
  }

  async function update(id: string, changes: UpdateProductInput) {
    const updated = await productsRepo.update(id, {
      ...(changes.name !== undefined && { name: changes.name.trim() }),
      ...(changes.price !== undefined && { price: Math.round(changes.price) }),
      ...(changes.categoryId !== undefined && { categoryId: changes.categoryId }),
      ...(changes.imageUrl !== undefined && { imageUrl: changes.imageUrl }),
      ...(changes.sortOrder !== undefined && { sortOrder: changes.sortOrder }),
      ...(changes.trackStock !== undefined && { trackStock: changes.trackStock }),
      ...(changes.autoDeductOnSale !== undefined && { autoDeductOnSale: changes.autoDeductOnSale }),
      ...(changes.stockUnit !== undefined && { stockUnit: changes.stockUnit }),
      ...(changes.stockQuantity !== undefined && { stockQuantity: changes.stockQuantity }),
      ...(changes.pricePerKg !== undefined && { pricePerKg: changes.pricePerKg }),
      ...(changes.defaultWeightG !== undefined && { defaultWeightG: changes.defaultWeightG })
    })

    if (!updated) return

    const idx = products.value.findIndex(p => p.id === id)
    if (idx !== -1) products.value[idx] = toProduct(updated)
  }

  async function remove(id: string) {
    await productsRepo.remove(id)
    products.value = products.value.filter(p => p.id !== id)
  }

  async function reorder(orderedIds: string[]) {
    // Update sort_order per cdo product
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i]
      const existing = products.value.find(p => p.id === id)
      if (!existing) continue
      await productsRepo.update(id, { sortOrder: i })
    }

    // Update in-memory
    products.value = products.value
      .map(p => {
        const idx = orderedIds.indexOf(p.id)
        return { ...p, sortOrder: idx === -1 ? p.sortOrder : idx }
      })
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

function search(query: string, categoryId?: string): Product[] {
    const q = query.trim().toLowerCase()
    let list = products.value
    if (categoryId) {
      list = list.filter(p => p.categoryId === categoryId)
    }
    if (q) {
      list = list.filter(p => p.name.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => a.sortOrder - b.sortOrder)
  }

  // ─────────────────────────────────────────────────────────
  // STOCK ADJUSTMENTS - Keto shkojne direkt ne backend
  // Sepse jane operacione atomike qe s'duan te bejne konflikt
  // ─────────────────────────────────────────────────────────

  async function adjustStock(id: string, delta: number, reason?: string, note?: string) {
    const updated = await api.post<any>(`/products/${id}/stock`, {
      delta,
      reason,
      note
    })
    const idx = products.value.findIndex(p => p.id === id)
    if (idx !== -1) {
      const product = toProduct({
        ...updated,
        createdAt: products.value[idx].createdAt,
        updatedAt: Date.now()
      })
      products.value[idx] = product
      // Perditeso edhe ne SQLite
      await productsRepo.update(id, { stockQuantity: product.stockQuantity })
    }
  }

  async function setStock(id: string, absoluteQty: number, reason?: string, note?: string) {
    const current = products.value.find(p => p.id === id)
    if (!current) return
    const delta = absoluteQty - current.stockQuantity
    await adjustStock(id, delta, reason ?? 'MANUAL', note)
  }

  async function importList(items: Array<{
    name: string
    barcode?: string
    unit?: string
    price?: number
    stock?: number
  }>) {
    const result = await api.post<any>('/products/import', { items })
    // Reload nga backend + update SQLite
    await reload()
    return result
  }

  // ─────────────────────────────────────────────────────────
  // DEBUG helpers - per te pare gjendjen e sync queue
  // ─────────────────────────────────────────────────────────
  async function getPendingSyncCount(): Promise<number> {
    return productsRepo.getPendingSyncCount()
  }

  return {
    products,
    loaded,
    byId,
    byCategory,
    load,
    reload,
    create,
    update,
    remove,
    reorder,
    search,
    adjustStock,
    setStock,
    importList,
    getPendingSyncCount
  }
})