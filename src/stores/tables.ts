import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api/client'

export type Section = 'MAIN_DINING' | 'TERRACE' | 'OUTDOOR'
export type TableStatus = 'AVAILABLE' | 'ON_DINE' | 'RESERVED'

export type Table = {
  id: string
  name: string
  sortOrder: number
  createdAt: number
  // Fusha te reja (opsionale per backwards compatibility)
  seatCount?: number
  section?: Section
  status?: TableStatus
  positionX?: number
  positionY?: number
  size?: number
}

// Backend kthen id si numer, po frontend perdor string
type BackendTable = {
  id: number
  name: string
  seatCount: number
  section: Section
  status: TableStatus
  positionX: number
  positionY: number
  sortOrder: number
  createdAt: number
  size?: number
}

function fromBackend(t: BackendTable): Table {
  return {
    id: String(t.id),
    name: t.name,
    sortOrder: t.sortOrder,
    createdAt: t.createdAt,
    seatCount: t.seatCount,
    section: t.section,
    status: t.status,
    positionX: t.positionX,
    positionY: t.positionY,
    size: t.size
  }
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

  // Filter sipas seksionit (per Manage Tables)
  const bySection = computed(() => (section: Section) =>
    sorted.value.filter(t => t.section === section)
  )

  // Statistika per header
  const stats = computed(() => {
    const total = tables.value.length
    const available = tables.value.filter(t => t.status === 'AVAILABLE').length
    const onDine = tables.value.filter(t => t.status === 'ON_DINE').length
    const reserved = tables.value.filter(t => t.status === 'RESERVED').length
    return { total, available, onDine, reserved }
  })

  function byId(id: string): Table | undefined {
    return tables.value.find(t => t.id === id)
  }

  function select(id: string | null) {
    selectedId.value = id
  }

  async function load() {
    if (loaded.value) return
    const raw = await api.get<BackendTable[]>('/tables')
    tables.value = raw.map(fromBackend)
    loaded.value = true
  }

  async function reload() {
    const raw = await api.get<BackendTable[]>('/tables')
    tables.value = raw.map(fromBackend)
  }

  // Krijim me fusha te reja (per Manage Tables)
  async function createFull(data: {
    name: string
    seatCount: number
    section: Section
  }): Promise<Table> {
    const maxOrder = tables.value.reduce((m, t) => Math.max(m, t.sortOrder), 0)
    const raw = await api.post<BackendTable>('/tables', {
      name: data.name.trim(),
      seatCount: data.seatCount,
      section: data.section,
      sortOrder: maxOrder + 1
    })
    const newTable = fromBackend(raw)
    tables.value.push(newTable)
    return newTable
  }

  // Metoda e vjeter (per kompatibilitet me TablesView aktual)
  async function create(name: string): Promise<Table> {
    return createFull({
      name,
      seatCount: 4,
      section: 'MAIN_DINING'
    })
  }

  async function update(id: string, changes: Partial<Pick<Table, 'name' | 'sortOrder' | 'seatCount' | 'section'>>) {
    const existing = tables.value.find(t => t.id === id)
    if (!existing) return
    const payload = {
      name: changes.name?.trim() ?? existing.name,
      seatCount: changes.seatCount ?? existing.seatCount ?? 4,
      section: changes.section ?? existing.section ?? 'MAIN_DINING',
      sortOrder: changes.sortOrder ?? existing.sortOrder
    }
    const raw = await api.put<BackendTable>(`/tables/${id}`, payload)
    const updated = fromBackend(raw)
    const idx = tables.value.findIndex(t => t.id === id)
    if (idx >= 0) tables.value[idx] = updated
  }

  async function updateStatus(id: string, status: TableStatus) {
    const raw = await api.patch<BackendTable>(`/tables/${id}/status`, { status })
    const updated = fromBackend(raw)
    const idx = tables.value.findIndex(t => t.id === id)
    if (idx >= 0) tables.value[idx] = updated
  }

  async function updatePosition(id: string, positionX: number, positionY: number) {
    const raw = await api.patch<BackendTable>(`/tables/${id}/position`, { positionX, positionY })
    const updated = fromBackend(raw)
    const idx = tables.value.findIndex(t => t.id === id)
    if (idx >= 0) tables.value[idx] = updated
  }

  async function updateSize(id: string, size: number) {
  const raw = await api.patch<BackendTable>(`/tables/${id}/size`, { size })
  const updated = fromBackend(raw)
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
    bySection,
    stats,
    loaded,
    byId,
    select,
    load,
    reload,
    create,
    createFull,
    update,
    updateStatus,
    updatePosition,
    remove,
    updateSize
  }
})