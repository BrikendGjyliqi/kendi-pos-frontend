import { getSqliteDb } from './sqlite'
import { api } from '../api/client'
import bcrypt from 'bcryptjs'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
export type Staff = {
  id: string
  name: string
  role: string
  active: boolean
  createdAt: number
}

// Kete perdorim vetem brenda repo - s'e ekspozojme jashte
type StaffWithHash = Staff & {
  pinHash: string
}

type BackendStaffCache = {
  id: string
  name: string
  role: string
  pinHash: string
  active: boolean
  createdAt: number
}

type SqliteStaff = {
  id: string
  name: string
  pin_hash: string
  role: string
  active: number
  created_at: number
}

// ─────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────
function fromSqlite(row: SqliteStaff): StaffWithHash {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    pinHash: row.pin_hash,
    active: row.active === 1,
    createdAt: row.created_at
  }
}

function fromBackend(s: BackendStaffCache): StaffWithHash {
  return {
    id: s.id,
    name: s.name,
    role: s.role,
    pinHash: s.pinHash,
    active: s.active,
    createdAt: s.createdAt
  }
}

function stripHash(s: StaffWithHash): Staff {
  return {
    id: s.id,
    name: s.name,
    role: s.role,
    active: s.active,
    createdAt: s.createdAt
  }
}

// ─────────────────────────────────────────────────────────
// LOCAL operations
// ─────────────────────────────────────────────────────────
async function getAllLocal(): Promise<StaffWithHash[]> {
  const db = await getSqliteDb()
  const rows = await db.select<SqliteStaff[]>(
    'SELECT * FROM staff WHERE active = 1'
  )
  return rows.map(fromSqlite)
}

async function saveLocalBatch(staff: StaffWithHash[]): Promise<void> {
  const db = await getSqliteDb()
  for (const s of staff) {
    await db.execute(
      `INSERT OR REPLACE INTO staff (
        id, name, pin_hash, role, active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [s.id, s.name, s.pinHash, s.role, s.active ? 1 : 0, s.createdAt]
    )
  }
}

// ─────────────────────────────────────────────────────────
// REMOTE operations
// ─────────────────────────────────────────────────────────
async function fetchFromBackend(): Promise<StaffWithHash[]> {
  const raw = await api.get<BackendStaffCache[]>('/staff/cache')
  return raw.map(fromBackend)
}

// ─────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────

/**
 * Sync i staff cache-it nga backend.
 * Thirret pas nje login online te suksesshem.
 */
export async function syncFromBackend(): Promise<void> {
  try {
    const staff = await fetchFromBackend()
    if (staff.length > 0) {
      await saveLocalBatch(staff)
      console.log(`[StaffRepo] Cached ${staff.length} staff members locally`)
    }
  } catch (err) {
    console.warn('[StaffRepo] Failed to sync staff cache:', err)
  }
}

/**
 * Validim i PIN-it lokalisht duke perdorur BCrypt.
 * Kthen staff nese PIN eshte i sakte, null nese jo.
 */
export async function validatePinLocally(pin: string): Promise<Staff | null> {
  const allStaff = await getAllLocal()

  for (const staff of allStaff) {
    try {
      const match = await bcrypt.compare(pin, staff.pinHash)
      if (match) {
        console.log(`[StaffRepo] Local PIN validation succeeded for ${staff.name}`)
        return stripHash(staff)
      }
    } catch (err) {
      console.warn(`[StaffRepo] Bcrypt error for ${staff.name}:`, err)
    }
  }

  return null
}

/**
 * Kontrolla nese ka staff cache lokalisht
 */
export async function hasLocalCache(): Promise<boolean> {
  const db = await getSqliteDb()
  const result = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM staff WHERE active = 1'
  )
  return (result[0]?.count ?? 0) > 0
}

/**
 * Merr staff nga id (perdoret ne restore session)
 */
export async function getById(id: string): Promise<Staff | null> {
  const db = await getSqliteDb()
  const rows = await db.select<SqliteStaff[]>(
    'SELECT * FROM staff WHERE id = ? AND active = 1',
    [id]
  )
  if (rows.length === 0) return null
  return stripHash(fromSqlite(rows[0]))
}