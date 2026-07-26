import Database from '@tauri-apps/plugin-sql'

let dbInstance: Database | null = null

/**
 * Hape lidhjen me SQLite databaz lokal.
 * Databaza ruhet ne user data folder te Tauri app-it:
 * - Windows: %APPDATA%\com.kendipos.app\kendi_pos_local.db
 */
export async function getSqliteDb(): Promise<Database> {
  if (dbInstance) return dbInstance

  dbInstance = await Database.load('sqlite:kendi_pos_local.db')

  // Aplikoje migration ne startim
  await applyMigrations(dbInstance)

  return dbInstance
}

/**
 * Krijim i tabelave nese s'ekzistojne.
 * Kjo eshte skema paralele me PostgreSQL, po me tipa SQLite.
 */
async function applyMigrations(db: Database): Promise<void> {
  console.log('[SQLite] Applying migrations...')

  // Tabela per te ndjekur versionin e skemes
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const currentVersion = await getCurrentSchemaVersion(db)

  if (currentVersion < 1) {
    await applyMigrationV1(db)
    await recordMigration(db, 1)
  }

  if (currentVersion < 2) {
    await applyMigrationV2(db)
    await recordMigration(db, 2)
  }

  if (currentVersion < 3) {
    await applyMigrationV3(db)
    await recordMigration(db, 3)
  }

  console.log('[SQLite] Migrations complete.')
}

async function getCurrentSchemaVersion(db: Database): Promise<number> {
  const result = await db.select<{ max_version: number | null }[]>(
    'SELECT MAX(version) as max_version FROM schema_version'
  )
  return result[0]?.max_version ?? 0
}

async function recordMigration(db: Database, version: number): Promise<void> {
  await db.execute('INSERT INTO schema_version (version) VALUES (?)', [version])
}

// ═══════════════════════════════════════════════════════════════
// V1: Core POS entities
// ═══════════════════════════════════════════════════════════════
async function applyMigrationV1(db: Database): Promise<void> {
  console.log('[SQLite] Applying V1...')

  // Categories
  await db.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  // Products (pa FK per te lejuar sinkronizim nga backend pa varshmeri strikte)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      category_id TEXT,
      image_url TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      track_stock INTEGER NOT NULL DEFAULT 0,
      auto_deduct_on_sale INTEGER NOT NULL DEFAULT 0,
      stock_unit TEXT NOT NULL DEFAULT 'PIECE',
      stock_quantity REAL NOT NULL DEFAULT 0,
      price_per_kg INTEGER,
      default_weight_g INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  await db.execute('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)')

  // Staff
  await db.execute(`
    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    )
  `)

  // Settings (key-value)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
}

// ═══════════════════════════════════════════════════════════════
// V2: Tables and reservations
// ═══════════════════════════════════════════════════════════════
async function applyMigrationV2(db: Database): Promise<void> {
  console.log('[SQLite] Applying V2...')

  // Restaurant tables
  await db.execute(`
    CREATE TABLE IF NOT EXISTS restaurant_tables (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      seat_count INTEGER NOT NULL,
      section TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'AVAILABLE',
      position_x INTEGER NOT NULL DEFAULT 0,
      position_y INTEGER NOT NULL DEFAULT 0,
      size INTEGER NOT NULL DEFAULT 150,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  await db.execute('CREATE INDEX IF NOT EXISTS idx_tables_section ON restaurant_tables(section)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_tables_status ON restaurant_tables(status)')

  // Reservations (pa FK)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      guest_name TEXT NOT NULL,
      guest_phone TEXT,
      guest_count INTEGER NOT NULL,
      reservation_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING_REQUEST',
      requested_by TEXT,
      confirmed_at TEXT,
      arrived_at TEXT,
      no_show_at TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  await db.execute('CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_reservations_table ON reservations(table_id)')
}

// ═══════════════════════════════════════════════════════════════
// V3: Orders and sync queue
// ═══════════════════════════════════════════════════════════════
async function applyMigrationV3(db: Database): Promise<void> {
  console.log('[SQLite] Applying V3...')

  // Orders (pa FK)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      status TEXT NOT NULL,
      subtotal INTEGER NOT NULL DEFAULT 0,
      discount INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT,
      cash_given INTEGER,
      fiscal INTEGER,
      staff_id TEXT,
      tip_amount INTEGER,
      tip_percent INTEGER,
      opened_at INTEGER NOT NULL,
      closed_at INTEGER,
      paid_at INTEGER
    )
  `)

  await db.execute('CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id)')
  await db.execute('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)')

  // Order items (pa FK)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      quantity REAL NOT NULL,
      note TEXT,
      added_at INTEGER NOT NULL
    )
  `)

  await db.execute('CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)')

  // ═════════════════════════════════════════════════════════════
  // SYNC QUEUE - Zemra e offline-first
  // ═════════════════════════════════════════════════════════════
  await db.execute(`
    CREATE TABLE IF NOT EXISTS pending_sync (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_attempt_at INTEGER,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT
    )
  `)

  await db.execute('CREATE INDEX IF NOT EXISTS idx_pending_sync_created ON pending_sync(created_at)')
}

/**
 * Testim helper - kontrollon nese tabelat u krijuan sakte.
 * Perdoret vetem per debug.
 */
export async function getTablesInfo(): Promise<any> {
  const db = await getSqliteDb()
  const tables = await db.select<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  )

  const info: Record<string, number> = {}
  for (const table of tables) {
    if (table.name.startsWith('sqlite_')) continue
    const count = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM ${table.name}`
    )
    info[table.name] = count[0]?.count ?? 0
  }

  return info
}