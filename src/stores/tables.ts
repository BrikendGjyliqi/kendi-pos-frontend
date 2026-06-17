import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api/client'

export type Table = {
  id: string
  name: string
  sortOrder: number
  createdAt: number
}

export const useTablesStore = defineStore('tables', () => {
  const tables = ref<Table[]>([])
  const selectedId = ref<string | null>(null)
  const loaded = ref(false)

  const sorted = computed(() =>
    [...tables.value].sort((a, b) => a.sortOrder - b.sortOrder)
  )

  const selected = computed(() =>
    tables.value.find(t => t.id === selectedId.value) ?? null
  )

  function byId(id: string): Table | undefined {
    return tables.value.find(t => t.id === id)
  }

  function select(id: string | null) {
    selectedId.value = id
  }

  async function load() {
    if (loaded.value) return
    tables.value = await api.get<Table[]>('/tables')
    loaded.value = true
  }

  async function reload() {
    tables.value = await api.get<Table[]>('/tables')
  }

  async function create(name: string): Promise<Table> {
    const maxOrder = tables.value.reduce((m, t) => Math.max(m, t.sortOrder), 0)
    const newTable = await api.post<Table>('/tables', {
      name: name.trim(),
      sortOrder: maxOrder + 1
    })
    tables.value.push(newTable)
    return newTable
  }

  async function update(id: string, changes: Partial<Pick<Table, 'name' | 'sortOrder'>>) {
    const existing = tables.value.find(t => t.id === id)
    if (!existing) return
    const payload = {
      ...existing,
      ...changes,
      name: changes.name?.trim() ?? existing.name
    }
    const updated = await api.put<Table>(`/tables/${id}`, payload)
    const idx = tables.value.findIndex(t => t.id === id)
    if (idx >= 0) tables.value[idx] = updated
  }

  async function remove(id: string) {
    await api.delete(`/tables/${id}`)
    tables.value = tables.value.filter(t => t.id !== id)
  }

  return {
    tables,
    sorted,
    selectedId,
    selected,
    loaded,
    byId,
    select,
    load,
    reload,
    create,
    update,
    remove
  }
})