import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as tablesRepo from '../db/tablesRepo'

export type Section = 'MAIN_DINING' | 'TERRACE' | 'OUTDOOR'
export type TableStatus = 'AVAILABLE' | 'ON_DINE' | 'RESERVED'

export type Table = {
  id: string
  name: string
  sortOrder: number
  createdAt: number
  seatCount?: number
  section?: Section
  status?: TableStatus
  positionX?: number
  positionY?: number
  size?: number
}

function toTable(t: tablesRepo.Table): Table {
  return {
    id: t.id,
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

  const bySection = computed(() => (section: Section) =>
    sorted.value.filter(t => t.section === section)
  )

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

  // ─────────────────────────────────────────────────────────
  // OFFLINE-FIRST
  // ─────────────────────────────────────────────────────────
  async function load() {
    if (loaded.value) return
    const repoTables = await tablesRepo.getAll()
    tables.value = repoTables.map(toTable)
    loaded.value = true
    console.log(`[Tables Store] Loaded ${tables.value.length} tables (offline-first)`)

    // Auto-refresh ne background
    setTimeout(async () => {
      try {
        const fresh = await tablesRepo.refresh()
        tables.value = fresh.map(toTable)
        console.log(`[Tables Store] Auto-refreshed ${fresh.length} tables`)
      } catch {
        // silent
      }
    }, 1000)
  }

  async function reload() {
    const fresh = await tablesRepo.refresh()
    tables.value = fresh.map(toTable)
  }

  async function createFull(data: {
    name: string
    seatCount: number
    section: Section
  }): Promise<Table> {
    const maxOrder = tables.value.reduce((m, t) => Math.max(m, t.sortOrder), 0)
    const created = await tablesRepo.create({
      name: data.name.trim(),
      seatCount: data.seatCount,
      section: data.section,
      sortOrder: maxOrder + 1
    })
    const table = toTable(created)
    tables.value.push(table)
    return table
  }

  async function create(name: string): Promise<Table> {
    return createFull({
      name,
      seatCount: 4,
      section: 'MAIN_DINING'
    })
  }

  async function update(id: string, changes: Partial<Pick<Table, 'name' | 'sortOrder' | 'seatCount' | 'section'>>) {
    const updated = await tablesRepo.update(id, changes)
    if (!updated) return
    const idx = tables.value.findIndex(t => t.id === id)
    if (idx >= 0) tables.value[idx] = toTable(updated)
  }

  async function updateStatus(id: string, status: TableStatus) {
    const updated = await tablesRepo.updateStatus(id, status)
    if (!updated) return
    const idx = tables.value.findIndex(t => t.id === id)
    if (idx >= 0) tables.value[idx] = toTable(updated)
  }

  async function updatePosition(id: string, positionX: number, positionY: number) {
    const updated = await tablesRepo.updatePosition(id, positionX, positionY)
    if (!updated) return
    const idx = tables.value.findIndex(t => t.id === id)
    if (idx >= 0) tables.value[idx] = toTable(updated)
  }

  async function updateSize(id: string, size: number) {
    const updated = await tablesRepo.updateSize(id, size)
    if (!updated) return
    const idx = tables.value.findIndex(t => t.id === id)
    if (idx >= 0) tables.value[idx] = toTable(updated)
  }

  async function remove(id: string) {
    await tablesRepo.remove(id)
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
    updateSize,
    remove
  }
})