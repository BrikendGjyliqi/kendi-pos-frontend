import { getSqliteDb } from './sqlite'
import { api } from '../api/client'

export type Section = 'MAIN_DINING' | 'TERRACE' | 'OUTDOOR'
export type TableStatus = 'AVAILABLE' | 'ON_DINE' | 'RESERVED'

export type Table = {
  id: string
  name: string
  seatCount: number
  section: Section
  status: TableStatus
  positionX: number
  positionY: number
  size: number
  sortOrder: number
  createdAt: number
  updatedAt: number
}

type BackendTable = {
  id: number
  name: string
  seatCount: number
  section: Section
  status: TableStatus
  positionX: number
  positionY: number
  size: number
  sortOrder: number
  createdAt: number
}

type SqliteTable = {
  id: string
  name: string
  seat_count: number
  section: string
  status: string
  position_x: number
  position_y: number
  size: number
  sort_order: number
  created_at: number
  updated_at: number
}

// ─────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────
function fromSqlite(row: SqliteTable): Table {
  return {
    id: row.id,
    name: row.name,
    seatCount: row.seat_count,
    section: row.section as Section,
    status: row.status as TableStatus,
    positionX: row.position_x,
    positionY: row.position_y,
    size: row.size,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function fromBackend(t: BackendTable): Table {
  return {
    id: String(t.id),
    name: t.name,
    seatCount: t.seatCount,
    section: t.section,
    status: t.status,
    positionX: t.positionX,
    positionY: t.positionY,
    size: t.size ?? 150,
    sortOrder: t.sortOrder,
    createdAt: t.createdAt,
    updatedAt: Date.now()
  }
}

// ─────────────────────────────────────────────────────────
// LOCAL operations
// ─────────────────────────────────────────────────────────
async function getAllLocal(): Promise<Table[]> {
  const db = await getSqliteDb()
  const rows = await db.select<SqliteTable[]>(
    'SELECT * FROM restaurant_tables ORDER BY sort_order ASC, name ASC'
  )
  return rows.map(fromSqlite)
}

async function saveLocalBatch(tables: Table[]): Promise<void> {
  const db = await getSqliteDb()
  for (const t of tables) {
    await db.execute(
      `INSERT OR REPLACE INTO restaurant_tables (
        id, name, seat_count, section, status, position_x, position_y,
        size, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        t.id, t.name, t.seatCount, t.section, t.status,
        t.positionX, t.positionY, t.size, t.sortOrder,
        t.createdAt, t.updatedAt
      ]
    )
  }
}

async function saveLocal(table: Table): Promise<void> {
  await saveLocalBatch([table])
}

async function deleteLocal(id: string): Promise<void> {
  const db = await getSqliteDb()
  await db.execute('DELETE FROM restaurant_tables WHERE id = ?', [id])
}

// ─────────────────────────────────────────────────────────
// REMOTE operations
// ─────────────────────────────────────────────────────────
async function fetchFromBackend(): Promise<Table[]> {
  const raw = await api.get<BackendTable[]>('/tables')
  return raw.map(fromBackend)
}

// ─────────────────────────────────────────────────────────
// SYNC QUEUE
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
    ['table', entityId, action, JSON.stringify(payload), endpoint, method, Date.now()]
  )
  console.log(`[Sync] Queued ${action} for table ${entityId}`)
}

// ─────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────

export async function getAll(): Promise<Table[]> {
  const localData = await getAllLocal()

  fetchFromBackend()
    .then(async (remoteData) => {
      if (remoteData.length > 0) {
        await saveLocalBatch(remoteData)
        console.log(`[Tables] Synced ${remoteData.length} tables from backend`)
      }
    })
    .catch((err) => {
      console.warn('[Tables] Backend fetch failed (offline?), using local:', err.message)
    })

  return localData
}

export async function refresh(): Promise<Table[]> {
  try {
    const remoteData = await fetchFromBackend()
    await saveLocalBatch(remoteData)
    return remoteData
  } catch (err) {
    console.warn('[Tables] Refresh failed, using local:', err)
    return getAllLocal()
  }
}

export async function create(data: {
  name: string
  seatCount: number
  section: Section
  sortOrder: number
}): Promise<Table> {
  const now = Date.now()
  const id = crypto.randomUUID()

  const table: Table = {
    id,
    name: data.name,
    seatCount: data.seatCount,
    section: data.section,
    status: 'AVAILABLE',
    positionX: 0,
    positionY: 0,
    size: 150,
    sortOrder: data.sortOrder,
    createdAt: now,
    updatedAt: now
  }

  await saveLocal(table)

  try {
    const created = await api.post<BackendTable>('/tables', {
      name: table.name,
      seatCount: table.seatCount,
      section: table.section,
      sortOrder: table.sortOrder
    })
    // Backend kthen id te vet - update lokal
    const backendId = String(created.id)
    if (backendId !== id) {
      const db = await getSqliteDb()
      await db.execute('DELETE FROM restaurant_tables WHERE id = ?', [id])
      table.id = backendId
      await saveLocal(table)
    }
  } catch {
    await queueSync(id, 'CREATE', {
      name: table.name,
      seatCount: table.seatCount,
      section: table.section,
      sortOrder: table.sortOrder
    }, '/tables', 'POST')
  }

  return table
}

export async function update(id: string, changes: Partial<Table>): Promise<Table | null> {
  const db = await getSqliteDb()
  const existing = await db.select<SqliteTable[]>(
    'SELECT * FROM restaurant_tables WHERE id = ?',
    [id]
  )
  if (existing.length === 0) return null

  const current = fromSqlite(existing[0])
  const updated: Table = {
    ...current,
    ...changes,
    id,
    updatedAt: Date.now()
  }

  await saveLocal(updated)

  try {
    await api.put(`/tables/${id}`, {
      name: updated.name,
      seatCount: updated.seatCount,
      section: updated.section,
      sortOrder: updated.sortOrder
    })
  } catch {
    await queueSync(id, 'UPDATE', {
      name: updated.name,
      seatCount: updated.seatCount,
      section: updated.section,
      sortOrder: updated.sortOrder
    }, `/tables/${id}`, 'PUT')
  }

  return updated
}

export async function updateStatus(id: string, status: TableStatus): Promise<Table | null> {
  const db = await getSqliteDb()
  const existing = await db.select<SqliteTable[]>(
    'SELECT * FROM restaurant_tables WHERE id = ?',
    [id]
  )
  if (existing.length === 0) return null

  const current = fromSqlite(existing[0])
  const updated: Table = { ...current, status, updatedAt: Date.now() }
  await saveLocal(updated)

  try {
    await api.patch(`/tables/${id}/status`, { status })
  } catch {
    await queueSync(id, 'UPDATE', { status }, `/tables/${id}/status`, 'PATCH')
  }

  return updated
}

export async function updatePosition(id: string, positionX: number, positionY: number): Promise<Table | null> {
  const db = await getSqliteDb()
  const existing = await db.select<SqliteTable[]>(
    'SELECT * FROM restaurant_tables WHERE id = ?',
    [id]
  )
  if (existing.length === 0) return null

  const current = fromSqlite(existing[0])
  const updated: Table = { ...current, positionX, positionY, updatedAt: Date.now() }
  await saveLocal(updated)

  try {
    await api.patch(`/tables/${id}/position`, { positionX, positionY })
  } catch {
    await queueSync(id, 'UPDATE', { positionX, positionY }, `/tables/${id}/position`, 'PATCH')
  }

  return updated
}

export async function updateSize(id: string, size: number): Promise<Table | null> {
  const db = await getSqliteDb()
  const existing = await db.select<SqliteTable[]>(
    'SELECT * FROM restaurant_tables WHERE id = ?',
    [id]
  )
  if (existing.length === 0) return null

  const current = fromSqlite(existing[0])
  const updated: Table = { ...current, size, updatedAt: Date.now() }
  await saveLocal(updated)

  try {
    await api.patch(`/tables/${id}/size`, { size })
  } catch {
    await queueSync(id, 'UPDATE', { size }, `/tables/${id}/size`, 'PATCH')
  }

  return updated
}

export async function remove(id: string): Promise<void> {
  await deleteLocal(id)
  try {
    await api.delete(`/tables/${id}`)
  } catch {
    await queueSync(id, 'DELETE', {}, `/tables/${id}`, 'DELETE')
  }
}