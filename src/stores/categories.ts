import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api/client'

export type Category = {
  id: string
  name: string
  color: string
  sortOrder: number
  createdAt: number
}

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref<Category[]>([])
  const loaded = ref(false)

  const sorted = computed(() =>
    [...categories.value].sort((a, b) => a.sortOrder - b.sortOrder)
  )

  function byId(id: string): Category | undefined {
    return categories.value.find(c => c.id === id)
  }

  async function load() {
    if (loaded.value) return
    categories.value = await api.get<Category[]>('/categories')
    loaded.value = true
  }

  async function reload() {
    categories.value = await api.get<Category[]>('/categories')
  }

  async function create(data: { name: string; color: string }): Promise<Category> {
    const maxOrder = categories.value.reduce((max, c) => Math.max(max, c.sortOrder), 0)
    const newCat = await api.post<Category>('/categories', {
      name: data.name.trim(),
      color: data.color,
      sortOrder: maxOrder + 1
    })
    categories.value.push(newCat)
    return newCat
  }

  async function update(id: string, changes: Partial<Pick<Category, 'name' | 'color' | 'sortOrder'>>) {
    const existing = categories.value.find(c => c.id === id)
    if (!existing) return
    const updated = await api.put<Category>(`/categories/${id}`, {
      ...existing,
      ...changes,
      name: changes.name?.trim() ?? existing.name
    })
    const idx = categories.value.findIndex(c => c.id === id)
    if (idx >= 0) categories.value[idx] = updated
  }

  async function remove(id: string) {
    await api.delete(`/categories/${id}`)
    categories.value = categories.value.filter(c => c.id !== id)
  }

  return {
    categories,
    sorted,
    loaded,
    byId,
    load,
    reload,
    create,
    update,
    remove
  }
})