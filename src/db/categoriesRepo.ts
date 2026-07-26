import { getSqliteDb } from './sqlite'
import { api } from '../api/client'

export type Category = {
  id: string
  name: string
  color: string | null
  sortOrder: number
  createdAt: number
  updatedAt: number
}

type BackendCategory = {
  id: string
  name: string
  color: string | null
  sortOrder: number
  createdAt?: number
}

type SqliteCategory = {
  id: string
  name: string
  color: string | null
  sort_order: number
  created_at: number
  updated_at: number
}

function fromSqlite(row: SqliteCategory): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function fromBackend(c: BackendCategory): Category {
  return {
    id: c.id,
    name: c.name,
    color: c.color,
    sortOrder: c.sortOrder,
    createdAt: c.createdAt ?? Date.now(),
    updatedAt: Date.now()
  }
}

async function getAllLocal(): Promise<Category[]> {
  const db = await getSqliteDb()
  const rows = await db.select<SqliteCategory[]>(
    'SELECT * FROM categories ORDER BY sort_order ASC, name ASC'
  )
  return rows.map(fromSqlite)
}

async function saveLocalBatch(categories: Category[]): Promise<void> {
  const db = await getSqliteDb()
  for (const c of categories) {
    await db.execute(
      `INSERT OR REPLACE INTO categories (
        id, name, color, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [c.id, c.name, c.color, c.sortOrder, c.createdAt, c.updatedAt]
    )
  }
}

async function saveLocal(category: Category): Promise<void> {
  await saveLocalBatch([category])
}

async function deleteLocal(id: string): Promise<void> {
  const db = await getSqliteDb()
  await db.execute('DELETE FROM categories WHERE id = ?', [id])
}

async function fetchFromBackend(): Promise<Category[]> {
  const raw = await api.get<BackendCategory[]>('/categories')
  return raw.map(fromBackend)
}

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
    ['category', entityId, action, JSON.stringify(payload), endpoint, method, Date.now()]
  )
  console.log(`[Sync] Queued ${action} for category ${entityId}`)
}

export async function getAll(): Promise<Category[]> {
  const localData = await getAllLocal()

  fetchFromBackend()
    .then(async (remoteData) => {
      if (remoteData.length > 0) {
        await saveLocalBatch(remoteData)
        console.log(`[Categories] Synced ${remoteData.length} categories from backend`)
      }
    })
    .catch((err) => {
      console.warn('[Categories] Backend fetch failed (offline?), using local:', err.message)
    })

  return localData
}

export async function refresh(): Promise<Category[]> {
  try {
    const remoteData = await fetchFromBackend()
    await saveLocalBatch(remoteData)
    return remoteData
  } catch (err) {
    console.warn('[Categories] Refresh failed, using local:', err)
    return getAllLocal()
  }
}

export async function create(data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<Category> {
  const now = Date.now()
  const id = crypto.randomUUID()

  const category: Category = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now
  }

  await saveLocal(category)

  try {
    await api.post('/categories', {
      id: category.id,
      name: category.name,
      color: category.color,
      sortOrder: category.sortOrder
    })
  } catch {
    await queueSync(id, 'CREATE', {
      id: category.id,
      name: category.name,
      color: category.color,
      sortOrder: category.sortOrder
    }, '/categories', 'POST')
  }

  return category
}

export async function update(id: string, changes: Partial<Category>): Promise<Category | null> {
  const db = await getSqliteDb()
  const existing = await db.select<SqliteCategory[]>(
    'SELECT * FROM categories WHERE id = ?',
    [id]
  )
  if (existing.length === 0) return null

  const current = fromSqlite(existing[0])
  const updated: Category = {
    ...current,
    ...changes,
    id,
    updatedAt: Date.now()
  }

  await saveLocal(updated)

  try {
    await api.put(`/categories/${id}`, {
      id: updated.id,
      name: updated.name,
      color: updated.color,
      sortOrder: updated.sortOrder
    })
  } catch {
    await queueSync(id, 'UPDATE', {
      id: updated.id,
      name: updated.name,
      color: updated.color,
      sortOrder: updated.sortOrder
    }, `/categories/${id}`, 'PUT')
  }

  return updated
}

export async function remove(id: string): Promise<void> {
  await deleteLocal(id)
  try {
    await api.delete(`/categories/${id}`)
  } catch {
    await queueSync(id, 'DELETE', {}, `/categories/${id}`, 'DELETE')
  }
}