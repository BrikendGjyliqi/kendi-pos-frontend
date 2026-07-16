import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api/client'

export type StockUnit = 'PIECE' | 'KG'

export type Product = {
  id: string
  name: string
  price: number
  categoryId: string
  sortOrder: number
  active: boolean
  createdAt: number
  // Stock tracking
  trackStock: boolean
  autoDeductOnSale: boolean
  stockUnit: StockUnit | null
  stockQuantity: number
  lowStockThreshold: number
}

export const useProductsStore = defineStore('products', () => {
  const products = ref<Product[]>([])
  const loaded = ref(false)

  const active = computed(() => products.value.filter(p => p.active))

  const stockTracked = computed(() =>
    products.value.filter(p => p.trackStock)
  )

  const lowStock = computed(() =>
    stockTracked.value.filter(p => p.stockQuantity <= p.lowStockThreshold)
  )

  function byId(id: string): Product | undefined {
    return products.value.find(p => p.id === id)
  }

  function byCategoryId(categoryId: string): Product[] {
    return active.value
      .filter(p => p.categoryId === categoryId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  function search(term: string, categoryId?: string): Product[] {
    const q = term.trim().toLowerCase()
    let list = active.value
    if (categoryId) list = list.filter(p => p.categoryId === categoryId)
    if (q) list = list.filter(p => p.name.toLowerCase().includes(q))
    return list.sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async function load() {
    if (loaded.value) return
    products.value = await api.get<Product[]>('/products')
    loaded.value = true
  }

  async function reload() {
    products.value = await api.get<Product[]>('/products')
  }

  async function create(data: {
    name: string
    price: number
    categoryId: string
    trackStock?: boolean
    autoDeductOnSale?: boolean
    stockUnit?: StockUnit | null
    stockQuantity?: number
    lowStockThreshold?: number
  }): Promise<Product> {
    const inCat = products.value.filter(p => p.categoryId === data.categoryId)
    const maxOrder = inCat.reduce((m, p) => Math.max(m, p.sortOrder), 0)
    const newProd = await api.post<Product>('/products', {
      name: data.name.trim(),
      price: Math.max(0, Math.round(data.price)),
      categoryId: data.categoryId,
      sortOrder: maxOrder + 1,
      trackStock: data.trackStock ?? false,
      autoDeductOnSale: data.autoDeductOnSale ?? false,
      stockUnit: data.stockUnit ?? null,
      stockQuantity: data.stockQuantity ?? 0,
      lowStockThreshold: data.lowStockThreshold ?? 0
    })
    products.value.push(newProd)
    return newProd
  }

  async function update(
    id: string,
    changes: Partial<Product>
  ) {
    const existing = products.value.find(p => p.id === id)
    if (!existing) return
    const payload = {
      ...existing,
      ...changes,
      name: changes.name?.trim() ?? existing.name,
      price: changes.price !== undefined ? Math.max(0, Math.round(changes.price)) : existing.price
    }
    const updated = await api.put<Product>(`/products/${id}`, payload)
    const idx = products.value.findIndex(p => p.id === id)
    if (idx >= 0) products.value[idx] = updated
  }

  // Rregullo stokun (shto/hiq)
  async function adjustStock(id: string, delta: number): Promise<Product | null> {
    const updated = await api.post<Product>(`/products/${id}/adjust-stock`, { delta })
    const idx = products.value.findIndex(p => p.id === id)
    if (idx >= 0) products.value[idx] = updated
    return updated
  }

  // Vendos stokun ne nje vlere te caktuar
  async function setStock(id: string, quantity: number): Promise<Product | null> {
    const updated = await api.post<Product>(`/products/${id}/set-stock`, { quantity })
    const idx = products.value.findIndex(p => p.id === id)
    if (idx >= 0) products.value[idx] = updated
    return updated
  }

  async function remove(id: string) {
    await api.delete(`/products/${id}`)
    products.value = products.value.filter(p => p.id !== id)
  }

  return {
    products,
    active,
    stockTracked,
    lowStock,
    loaded,
    byId,
    byCategoryId,
    search,
    load,
    reload,
    create,
    update,
    adjustStock,
    setStock,
    remove
  }
})