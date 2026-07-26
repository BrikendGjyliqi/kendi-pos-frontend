import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as categoriesRepo from '../db/categoriesRepo'

export type Category = {
  id: string
  name: string
  color: string
  sortOrder: number
  createdAt: number
  updatedAt?: number
}

// Convert nga Repository type ne Store type
function toCategory(c: categoriesRepo.Category): Category {
  return {
    id: c.id,
    name: c.name,
    color: c.color ?? '#6B7280',
    sortOrder: c.sortOrder,
    createdAt: c.createdAt,
    updatedAt: (c as any).updatedAt
  }
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

  // ─────────────────────────────────────────────────────────
  // OFFLINE-FIRST: Load nga SQLite + sync ne background
  // ─────────────────────────────────────────────────────────
  async function load() {
    if (loaded.value) return
    const repoCategories = await categoriesRepo.getAll()
    categories.value = repoCategories.map(toCategory)
    loaded.value = true
    console.log(`[Categories Store] Loaded ${categories.value.length} categories (offline-first)`)

    // Auto-refresh ne background nese eshte online
    setTimeout(async () => {
      try {
        const fresh = await categoriesRepo.refresh()
        if (fresh.length !== categories.value.length ||
            fresh.some(c => {
              const existing = categories.value.find(x => x.id === c.id)
              return !existing || existing.updatedAt !== c.updatedAt
            })) {
          categories.value = fresh.map(toCategory)
          console.log(`[Categories Store] Auto-refreshed ${fresh.length} categories`)
        }
      } catch {
        // silent
      }
    }, 1000)
  }

  async function reload() {
    const fresh = await categoriesRepo.refresh()
    categories.value = fresh.map(toCategory)
  }

  async function create(data: { name: string; color: string }): Promise<Category> {
    const maxOrder = categories.value.reduce((max, c) => Math.max(max, c.sortOrder), 0)
    const created = await categoriesRepo.create({
      name: data.name.trim(),
      color: data.color,
      sortOrder: maxOrder + 1
    })
    const category = toCategory(created)
    categories.value.push(category)
    return category
  }

  async function update(id: string, changes: Partial<Pick<Category, 'name' | 'color' | 'sortOrder'>>) {
    const updated = await categoriesRepo.update(id, {
      ...(changes.name !== undefined && { name: changes.name.trim() }),
      ...(changes.color !== undefined && { color: changes.color }),
      ...(changes.sortOrder !== undefined && { sortOrder: changes.sortOrder })
    })
    if (!updated) return

    const idx = categories.value.findIndex(c => c.id === id)
    if (idx >= 0) categories.value[idx] = toCategory(updated)
  }

  async function remove(id: string) {
    await categoriesRepo.remove(id)
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