import { getSqliteDb } from './sqlite'
import { api } from '../api/client'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
export type ReservationStatus =
  | 'PENDING_REQUEST'
  | 'CONFIRMED'
  | 'ARRIVED'
  | 'NO_SHOW'
  | 'CANCELLED'
  | 'DECLINED'

export type Reservation = {
  id: string
  tableId: string
  tableName: string
  guestName: string
  guestPhone: string | null
  guestCount: number
  reservationTime: string
  status: ReservationStatus
  requestedBy: string | null
  confirmedAt: string | null
  arrivedAt: string | null
  noShowAt: string | null
  createdAt: number
  updatedAt: number
}

type BackendReservation = {
  id: number
  tableId: number
  tableName: string
  guestName: string
  guestPhone: string | null
  guestCount: number
  reservationTime: string
  status: ReservationStatus
  requestedBy: string | null
  confirmedAt: string | null
  arrivedAt: string | null
  noShowAt: string | null
  createdAt: string
}

type SqliteReservation = {
  id: string
  table_id: string
  guest_name: string
  guest_phone: string | null
  guest_count: number
  reservation_time: string
  status: string
  requested_by: string | null
  confirmed_at: string | null
  arrived_at: string | null
  no_show_at: string | null
  created_at: number
  updated_at: number
}

// ─────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────
function fromSqlite(row: SqliteReservation, tableName: string = 'Unknown'): Reservation {
  return {
    id: row.id,
    tableId: row.table_id,
    tableName,
    guestName: row.guest_name,
    guestPhone: row.guest_phone,
    guestCount: row.guest_count,
    reservationTime: row.reservation_time,
    status: row.status as ReservationStatus,
    requestedBy: row.requested_by,
    confirmedAt: row.confirmed_at,
    arrivedAt: row.arrived_at,
    noShowAt: row.no_show_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function fromBackend(r: BackendReservation): Reservation {
  return {
    id: String(r.id),
    tableId: String(r.tableId),
    tableName: r.tableName,
    guestName: r.guestName,
    guestPhone: r.guestPhone,
    guestCount: r.guestCount,
    reservationTime: r.reservationTime,
    status: r.status,
    requestedBy: r.requestedBy,
    confirmedAt: r.confirmedAt,
    arrivedAt: r.arrivedAt,
    noShowAt: r.noShowAt,
    createdAt: new Date(r.createdAt).getTime(),
    updatedAt: Date.now()
  }
}

async function getTableName(tableId: string): Promise<string> {
  const db = await getSqliteDb()
  const rows = await db.select<{ name: string }[]>(
    'SELECT name FROM restaurant_tables WHERE id = ?',
    [tableId]
  )
  return rows[0]?.name ?? 'Unknown'
}

// ─────────────────────────────────────────────────────────
// LOCAL operations
// ─────────────────────────────────────────────────────────
async function getAllLocal(): Promise<Reservation[]> {
  const db = await getSqliteDb()
  const rows = await db.select<SqliteReservation[]>(
    'SELECT * FROM reservations ORDER BY reservation_time DESC'
  )
  const results: Reservation[] = []
  for (const row of rows) {
    const tableName = await getTableName(row.table_id)
    results.push(fromSqlite(row, tableName))
  }
  return results
}

async function saveLocal(reservation: Reservation): Promise<void> {
  const db = await getSqliteDb()
  await db.execute(
    `INSERT OR REPLACE INTO reservations (
      id, table_id, guest_name, guest_phone, guest_count, reservation_time,
      status, requested_by, confirmed_at, arrived_at, no_show_at,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reservation.id, reservation.tableId, reservation.guestName,
      reservation.guestPhone, reservation.guestCount, reservation.reservationTime,
      reservation.status, reservation.requestedBy,
      reservation.confirmedAt, reservation.arrivedAt, reservation.noShowAt,
      reservation.createdAt, reservation.updatedAt
    ]
  )
}

async function saveLocalBatch(reservations: Reservation[]): Promise<void> {
  for (const r of reservations) {
    await saveLocal(r)
  }
}

async function fetchFromBackend(): Promise<Reservation[]> {
  const raw = await api.get<BackendReservation[]>('/reservations')
  return raw.map(fromBackend)
}

async function queueSync(
  entityId: string,
  action: string,
  payload: any,
  endpoint: string,
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH'
): Promise<void> {
  const db = await getSqliteDb()
  await db.execute(
    `INSERT INTO pending_sync (
      entity_type, entity_id, action, payload, endpoint, method, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['reservation', entityId, action, JSON.stringify(payload), endpoint, method, Date.now()]
  )
  console.log(`[Sync] Queued ${action} for reservation ${entityId}`)
}

// ─────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────

export async function getAll(): Promise<Reservation[]> {
  const localData = await getAllLocal()

  fetchFromBackend()
    .then(async (remoteData) => {
      if (remoteData.length > 0) {
        await saveLocalBatch(remoteData)
        console.log(`[Reservations] Synced ${remoteData.length} reservations from backend`)
      }
    })
    .catch((err) => {
      console.warn('[Reservations] Backend fetch failed (offline?):', err.message)
    })

  return localData
}

export async function refresh(): Promise<Reservation[]> {
  try {
    const remoteData = await fetchFromBackend()
    if (remoteData && remoteData.length > 0) {
      await saveLocalBatch(remoteData)
      return remoteData
    }
    return await getAllLocal()
  } catch (err) {
    console.warn('[Reservations] Refresh failed, using local:', err)
    return getAllLocal()
  }
}

export async function createRequest(data: {
  tableId: string
  guestName: string
  guestPhone?: string | null
  guestCount: number
  reservationTime: string
  requestedBy?: string | null
}): Promise<Reservation> {
  const now = Date.now()
  const id = crypto.randomUUID()

  const tableName = await getTableName(data.tableId)

  const reservation: Reservation = {
    id,
    tableId: data.tableId,
    tableName,
    guestName: data.guestName.trim(),
    guestPhone: data.guestPhone ?? null,
    guestCount: data.guestCount,
    reservationTime: data.reservationTime,
    status: 'PENDING_REQUEST',
    requestedBy: data.requestedBy ?? null,
    confirmedAt: null,
    arrivedAt: null,
    noShowAt: null,
    createdAt: now,
    updatedAt: now
  }

  await saveLocal(reservation)

  try {
    const created = await api.post<BackendReservation>('/reservations/requests', {
      tableId: Number(data.tableId),
      guestName: data.guestName,
      guestPhone: data.guestPhone,
      guestCount: data.guestCount,
      reservationTime: data.reservationTime,
      requestedBy: data.requestedBy
    })
    const backendId = String(created.id)
    if (backendId !== id) {
      const db = await getSqliteDb()
      await db.execute('DELETE FROM reservations WHERE id = ?', [id])
      const updated = fromBackend(created)
      await saveLocal(updated)
      return updated
    }
    return reservation
  } catch {
    await queueSync(id, 'CREATE', {
      tableId: Number(data.tableId),
      guestName: data.guestName,
      guestPhone: data.guestPhone,
      guestCount: data.guestCount,
      reservationTime: data.reservationTime,
      requestedBy: data.requestedBy
    }, '/reservations/requests', 'POST')
    return reservation
  }
}

export async function confirm(id: string): Promise<Reservation | null> {
  return await updateStatus(id, 'CONFIRMED', 'confirm', {
    confirmedAt: new Date().toISOString()
  })
}

export async function decline(id: string): Promise<Reservation | null> {
  return await updateStatus(id, 'DECLINED', 'decline', {})
}

export async function markArrived(id: string): Promise<Reservation | null> {
  return await updateStatus(id, 'ARRIVED', 'arrived', {
    arrivedAt: new Date().toISOString()
  })
}

export async function markNoShow(id: string): Promise<Reservation | null> {
  return await updateStatus(id, 'NO_SHOW', 'no-show', {
    noShowAt: new Date().toISOString()
  })
}

async function updateStatus(
  id: string,
  newStatus: ReservationStatus,
  actionName: string,
  extraFields: Partial<Reservation>
): Promise<Reservation | null> {
  const db = await getSqliteDb()
  const existing = await db.select<SqliteReservation[]>(
    'SELECT * FROM reservations WHERE id = ?', [id]
  )
  if (existing.length === 0) return null

  const tableName = await getTableName(existing[0].table_id)
  const current = fromSqlite(existing[0], tableName)

  const updated: Reservation = {
    ...current,
    ...extraFields,
    status: newStatus,
    updatedAt: Date.now()
  }

  await saveLocal(updated)

  try {
    await api.patch(`/reservations/${id}/${actionName}`)
  } catch {
    await queueSync(id, actionName.toUpperCase(), {}, `/reservations/${id}/${actionName}`, 'PATCH')
  }

  return updated
}