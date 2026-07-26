import { getSqliteDb } from '../db/sqlite'
import { api } from '../api/client'
import { syncStatus, pendingCount, lastSyncAt, lastError } from './state'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
type PendingSyncRow = {
  id: number
  entity_type: string
  entity_id: string
  action: string
  payload: string
  endpoint: string
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  created_at: number
  retry_count?: number
}

// ─────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────
async function isBackendOnline(): Promise<boolean> {
  try {
    // AbortController me timeout 3s qe mos me pritur shume
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)

    const res = await fetch('http://localhost:8080/api/health', {
      signal: controller.signal
    })

    clearTimeout(timeoutId)
    return res.ok
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────
// Queue operations
// ─────────────────────────────────────────────────────────
async function getPendingCount(): Promise<number> {
  const db = await getSqliteDb()
  const rows = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM pending_sync'
  )
  return rows[0]?.count ?? 0
}

async function getPendingItems(): Promise<PendingSyncRow[]> {
  const db = await getSqliteDb()
  return await db.select<PendingSyncRow[]>(
    'SELECT * FROM pending_sync ORDER BY created_at ASC LIMIT 50'
  )
}

async function removePending(id: number): Promise<void> {
  const db = await getSqliteDb()
  await db.execute('DELETE FROM pending_sync WHERE id = ?', [id])
}

// ─────────────────────────────────────────────────────────
// Send single item to backend
// ─────────────────────────────────────────────────────────
async function sendItem(item: PendingSyncRow): Promise<boolean> {
  try {
    const payload = item.payload ? JSON.parse(item.payload) : null

    switch (item.method) {
      case 'POST':
        await api.post(item.endpoint, payload ?? {})
        break
      case 'PUT':
        await api.put(item.endpoint, payload ?? {})
        break
      case 'PATCH':
        await api.patch(item.endpoint, payload ?? {})
        break
      case 'DELETE':
        await api.delete(item.endpoint)
        break
    }

    console.log(`[Sync] ✓ ${item.action} ${item.entity_type} ${item.entity_id}`)
    return true
  } catch (err: any) {
    console.warn(`[Sync] ✗ Failed ${item.action} ${item.entity_type} ${item.entity_id}:`, err.message)
    return false
  }
}

// ─────────────────────────────────────────────────────────
// Flush queue — dergo krejt items
// ─────────────────────────────────────────────────────────
async function flushQueue(): Promise<{ sent: number; failed: number }> {
  const items = await getPendingItems()
  if (items.length === 0) return { sent: 0, failed: 0 }

  let sent = 0
  let failed = 0

  for (const item of items) {
    const success = await sendItem(item)
    if (success) {
      await removePending(item.id)
      sent++
    } else {
      failed++
      // Nese deshton, ndalu — ndoshta backend ka rene serish
      break
    }
  }

  return { sent, failed }
}

// ─────────────────────────────────────────────────────────
// Main sync tick — kontrollo dhe sinkronizo
// ─────────────────────────────────────────────────────────
async function tick(): Promise<void> {
  try {
    // 1. Update pending count
    pendingCount.value = await getPendingCount()

    // 2. Check backend
    const online = await isBackendOnline()

    if (!online) {
      syncStatus.value = 'offline'
      return
    }

    // 3. Nese s'ka pending, veç mark online
    if (pendingCount.value === 0) {
      syncStatus.value = 'online'
      return
    }

    // 4. Ka pending — flush
    syncStatus.value = 'syncing'
    console.log(`[Sync] Flushing ${pendingCount.value} pending items...`)

    const result = await flushQueue()

    if (result.sent > 0) {
      console.log(`[Sync] Sent ${result.sent} items to backend`)
      lastSyncAt.value = Date.now()
    }

    // 5. Update final state
    pendingCount.value = await getPendingCount()
    syncStatus.value = pendingCount.value > 0 ? 'syncing' : 'online'

    if (result.failed > 0) {
      lastError.value = `${result.failed} items failed to sync`
    } else {
      lastError.value = null
    }
  } catch (err: any) {
    console.error('[Sync] Tick error:', err)
    lastError.value = err.message
  }
}

// ─────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────
let intervalId: number | null = null
const TICK_INTERVAL_MS = 15000 // 15 sekonda

export function startSyncEngine(): void {
  if (intervalId !== null) {
    console.log('[Sync] Already running')
    return
  }

  console.log('[Sync] Starting sync engine (every 15s)')

  // Tick i pare menjehere
  tick()

  // Pastaj cdo 15 sekonda
  intervalId = window.setInterval(tick, TICK_INTERVAL_MS)
}

export function stopSyncEngine(): void {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
    console.log('[Sync] Stopped')
  }
}

/**
 * Manual sync — thirret nga UI button
 */
export async function syncNow(): Promise<void> {
  console.log('[Sync] Manual sync triggered')
  await tick()
}

/**
 * Debug helper — kthe pending items nga queue
 */
export async function debugQueue(): Promise<void> {
  const db = await getSqliteDb()
  const items = await db.select<PendingSyncRow[]>(
    'SELECT * FROM pending_sync ORDER BY created_at ASC'
  )
  console.log(`[Debug] ${items.length} pending items in queue:`)
  for (const item of items) {
    console.log({
      id: item.id,
      entity: `${item.entity_type}:${item.entity_id}`,
      action: item.action,
      method: item.method,
      endpoint: item.endpoint,
      payload_preview: item.payload?.substring(0, 300)
    })
  }
}

// Expose per debug ne console
if (typeof window !== 'undefined') {
  ;(window as any).__syncDebug = { debugQueue, syncNow }
}