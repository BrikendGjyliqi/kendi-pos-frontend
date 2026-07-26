# Kendi POS — Frontend

**Vue 3 + TypeScript + Tauri desktop app** for the Kendi POS restaurant management system.

Built for cafés and restaurants in Kosovo. Runs as a native Windows desktop application via Tauri, communicates with a Spring Boot backend over REST, and continues to work seamlessly when the network drops thanks to a full **offline-first architecture** backed by local SQLite. Ships with an **AI Analytics Assistant** that turns natural-language business questions into live insights.

---

## Highlights

- **Offline-first by design** — all critical operations (order-taking, payments, reservations, table management) work with zero connectivity. A background sync engine reconciles with the backend when it returns.
- **AI Analytics Assistant** — ask business questions in natural Albanian ("Sa fitim pata sot?", "Cili produkt shitet me shume?") and receive answers with automatic charts. Powered by Claude Sonnet 4.5 with Text-to-SQL generation.
- **Native desktop app** — Tauri wraps the Vue frontend into a lightweight (~6 MB) Windows executable with native file dialogs.
- **Full table management** — drag-and-drop floor plan editor with per-table sizing and multi-section support (Main Dining / Terrace / Outdoor).
- **Complete reservation workflow** — waiter requests → admin confirmation → automatic ARRIVED transition when the order is opened → NO_SHOW handling.
- **PDF and CSV export** — professional reports (daily Z-report, monthly report, staff report) exported as PDF via `jsPDF`, reservation history exported as CSV, both using Tauri's native save dialog.
- **AI-powered invoice scanning** — upload PDF supplier invoices, extract line items automatically via the Anthropic Claude API.
- **Multi-role authentication** — Admin (full access) and Banakier / cashier (POS only) with 4-digit PIN login. Works offline via cached BCrypt hashes.
- **Warm Charcoal + Sage theme** — professional dark UI designed for long service shifts.
- **Albanian localization** — full i18n with Gheg dialect throughout the interface.

---

## Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────┐
│                    Tauri Desktop Window                       │
│                                                                │
│   ┌────────────────────┐        ┌──────────────────────┐     │
│   │      Vue 3 UI      │◄──────►│   Pinia Stores       │     │
│   │  (Composition API) │        │  (auth, orders, ...) │     │
│   └────────┬───────────┘        └──────────┬───────────┘     │
│            │                                │                  │
│            │                                ▼                  │
│            │                     ┌──────────────────────┐     │
│            │                     │  Repository Layer    │     │
│            │                     │  (products, orders,  │     │
│            │                     │   tables, staff, …)  │     │
│            │                     └──────────┬───────────┘     │
│            │                                │                  │
│            │                     ┌──────────▼───────────┐     │
│            │                     │   Local SQLite       │     │
│            │                     │  (source of truth    │     │
│            │                     │   when offline)      │     │
│            │                     └──────────┬───────────┘     │
│            │                                │                  │
│            │                     ┌──────────▼───────────┐     │
│            │                     │   Sync Engine        │     │
│            │                     │  (15s polling +      │     │
│            │                     │   pending queue)     │     │
│            └─────────────────────┴──────────┬───────────┘     │
│                                              │                  │
└──────────────────────────────────────────────┼─────────────────┘
                                               │ HTTP (when online)
                                               ▼
                              ┌─────────────────────────────┐
                              │   Spring Boot Backend       │
                              │   PostgreSQL (Docker)       │
                              │                             │
                              │   • REST API                │
                              │   • AI Analytics endpoint   │
                              │     (Text-to-SQL via Claude)│
                              └─────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- Rust and Tauri prerequisites for desktop builds ([see Tauri docs](https://tauri.app/start/prerequisites/))
- **Backend must be running** on `http://localhost:8080` (see [kendi-pos-backend](https://github.com/BrikendGjyliqi/kendi-pos-backend))
- **PostgreSQL** running (via Docker in the backend repo)

### 1. Install dependencies

```bash
npm install
```

### 2. Development mode (Tauri desktop, recommended)

```bash
npm run tauri dev
```

Launches the Tauri window with hot reload. **This is the correct way to run the app in development** because SQLite and native file dialogs only work inside a Tauri window.

### 3. Development mode (browser only, limited)

```bash
npm run dev
```

Opens at `http://localhost:5173`. Note: SQLite and file save dialogs will not work in the browser; use this only for pure UI iteration.

### 4. Production build (desktop installer)

```bash
npm run tauri build
```

Produces `src-tauri/target/release/bundle/msi/KENDI-POS_X.X.X_x64_en-US.msi`. Install this on Windows to run Kendi POS as a native app.

### Default PINs

- **Admin**: `0000`
- **Cashier**: `1234`

Change these under `/admin/staff` after first login.

---

## Tech Stack

| Layer            | Technology                                              |
|------------------|---------------------------------------------------------|
| UI framework     | Vue 3 with Composition API and `<script setup>`         |
| Language         | TypeScript (strict)                                     |
| Build tool       | Vite 6                                                  |
| Desktop wrapper  | Tauri 2 (Rust)                                          |
| State management | Pinia                                                   |
| Routing          | Vue Router with auth guards                             |
| Local storage    | SQLite via `tauri-plugin-sql`                           |
| PDF generation   | jsPDF + jspdf-autotable                                 |
| Charts           | Chart.js + vue-chartjs                                  |
| File dialogs     | `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`    |
| Offline auth     | `bcryptjs` for local PIN validation                     |
| Localization     | vue-i18n (Albanian, English)                            |
| Icons            | Lucide Vue Next                                         |
| Drag & drop      | interact.js                                             |

---

## Project Structure

```
src/
├── App.vue
├── main.ts                        # Bootstrap: init SQLite, start sync engine
├── api/
│   └── client.ts                  # Fetch wrapper for backend REST API
├── db/                            # Offline-first foundation
│   ├── sqlite.ts                  # Migrations V1-V3, connection helper
│   ├── productsRepo.ts            # Read from SQLite, sync in background
│   ├── categoriesRepo.ts
│   ├── tablesRepo.ts
│   ├── ordersRepo.ts              # Queues create/update/pay/cancel offline
│   ├── reservationsRepo.ts
│   └── staffRepo.ts               # Caches BCrypt PIN hashes for offline login
├── sync/
│   ├── syncEngine.ts              # 15-second health check + pending queue flush
│   └── state.ts                   # Reactive online/offline status
├── stores/                        # Pinia stores (thin wrappers over repos)
│   ├── auth.ts                    # BCrypt PIN validation (works offline)
│   ├── categories.ts
│   ├── deliveries.ts
│   ├── orders.ts
│   ├── products.ts
│   ├── reservations.ts
│   ├── settings.ts
│   ├── suppliers.ts
│   ├── supplierOrders.ts
│   └── tables.ts
├── components/
│   ├── reservations/
│   │   ├── PendingRequestsPanel.vue
│   │   ├── ConfirmedReservationsList.vue
│   │   └── RequestReservationModal.vue
│   ├── tables/
│   │   ├── TableCard.vue          # SVG chairs positioned by seat count
│   │   ├── AddTableModal.vue
│   │   ├── EditTableModal.vue
│   │   └── TableActionsModal.vue
│   ├── DeliveryModal.vue
│   ├── ProductFormModal.vue
│   └── SupplierOrderModal.vue
├── router/
│   └── index.ts                   # Routes + auth/role guards
├── i18n/                          # Albanian and English translations
├── views/
│   ├── LoginView.vue              # PIN keypad
│   ├── PosView.vue                # Order-taking interface
│   ├── TablesView.vue             # Cashier's floor plan
│   └── admin/
│       ├── AdminLayout.vue        # Sidebar navigation
│       ├── MenuView.vue
│       ├── ManageTablesView.vue   # Drag-drop table editor
│       ├── ReservationsView.vue
│       ├── ReservationsHistoryView.vue
│       ├── StockView.vue
│       ├── SuppliersView.vue
│       ├── DeliveryHistoryView.vue
│       ├── StaffView.vue          # Add / edit / delete staff
│       ├── SettingsView.vue
│       ├── OrderHistoryView.vue
│       ├── ReportsView.vue        # Z-report + monthly report (PDF export)
│       ├── StaffReportView.vue    # Per-staff analytics (PDF export)
│       └── AIAssistantView.vue    # Natural-language business chat with charts
└── src-tauri/                     # Rust code for Tauri desktop wrapper
    ├── src/lib.rs                 # Plugin registration (sql, dialog, fs)
    ├── capabilities/default.json  # Permissions for SQLite, dialogs, file writes
    └── Cargo.toml
```

---

## Offline-First Architecture

The core academic contribution of this thesis is the **offline-first data layer** that keeps the point-of-sale fully operational when the internet drops — a common scenario in Kosovo's smaller cafés and restaurants.

### How it works

1. **Local SQLite is the read source of truth.** All views read from SQLite via repositories (`productsRepo`, `ordersRepo`, `tablesRepo`, …). Reads never touch the network on the critical path.
2. **Writes are dual-tracked.** Every mutation is written to SQLite immediately and enqueued in a `pending_sync` table with an operation type (`CREATE`, `UPDATE`, `PAY`, `CANCEL`, `CLOSE`, …), payload, and attempt counter.
3. **Background sync engine** polls `/api/health` every 15 seconds. When the backend is reachable, it:
   - Drains the `pending_sync` queue in FIFO order
   - Retries failed items up to 5 times before flagging them
   - Pulls the latest server state to refresh local SQLite
4. **Client-generated UUIDs** are used across all offline-capable entities. This lets the client create objects offline and reference them immediately (in orders, in reservations) without waiting for a server-assigned ID.

### What works offline

| Feature                                | Offline?         |
|----------------------------------------|------------------|
| Login (PIN + BCrypt)                   | Yes              |
| Menu, categories, products             | Yes              |
| Table management + floor plan          | Yes              |
| Create / update / pay orders           | Yes (queued)     |
| Reservations (create, confirm, arrive) | Yes (queued)     |
| PDF and CSV export                     | Yes              |
| Analytics reports                      | Requires backend |
| AI Analytics Assistant                 | Requires backend |
| AI invoice scanning                    | Requires backend |

Reports and AI features are deliberately server-dependent: they are used by management during off-peak periods when connectivity is reliable, not by cashiers during service.

---

## Key Features

### AI Analytics Assistant

A conversational business intelligence layer built on top of the operational data. The owner asks questions in natural Albanian and receives answers derived from live database queries — with automatic chart visualisation when the result is comparative or time-series.

**Example questions the assistant handles today:**

- "Sa fitim pata sot?" → "Sot ke pas €24.00 total shitje me 5 porosi."
- "Cili produkt shitet me shume?" → Bar chart of top products with revenue and units
- "Cili banakier ka bo me shume shitje sot?" → Ranked list with amounts and order counts
- "Sa Coca-Cola kane mbet?" → Total stock across variants (Coca Cola 0.33l, Coca Cola 0/0.33l)
- "Krahaso sot me dje" → Side-by-side comparison with percentage change
- "Trend i shitjeve kete jave" → Line chart of daily revenue
- "Sa rezervime kena kete jave?" → Aggregated stats plus show-up rate

**How it works under the hood:**

1. The frontend sends the question to `POST /api/ai/analytics`.
2. The backend forwards it to Claude Sonnet 4.5 along with the PostgreSQL schema description and a set of formatting rules (cents-to-euros conversion, UUID handling, Albanian product-name variants).
3. Claude generates a `SELECT` query.
4. The backend validates the query (safety guard: `SELECT`/`WITH` only, blocks `DELETE`/`DROP`/`UPDATE`/`INSERT`/etc.) and executes it against PostgreSQL.
5. Rows are sent back to Claude, which composes a natural Albanian answer.
6. The backend auto-detects whether the result is chart-worthy (rankings → bar chart, time series → line chart) and returns the raw data alongside the answer.
7. The frontend renders the answer in a chat bubble, and if `chartType` is present, renders the accompanying chart via Chart.js.

**Chat quality-of-life touches:**

- Chat history persists in `localStorage` and survives page reloads
- "Kopjo" button on every AI response for quick sharing to WhatsApp or email
- Collapsible SQL viewer under each answer for transparency (helpful during thesis defence)
- "Pastro chat" button with confirmation to reset the conversation
- Six suggested starter questions for first-time users

The assistant currently supports read-only queries; it cannot modify data. This is a deliberate constraint enforced at the backend layer.

### Table Management with Drag-and-Drop

Admins visually arrange tables on a floor plan:

- Toggle **Edit layout** mode to enable drag-and-drop
- Reposition tables anywhere on the canvas
- Resize individual tables with `+` and `−` buttons (100–250 px range)
- Positions and sizes persist to the backend (and SQLite offline)
- Cashiers see the same layout in read-only mode

Uses `interact.js` for smooth pointer-based interaction. Each table renders as an SVG with dynamically positioned chairs based on seat count (2, 4, 6, 8, or 10).

### Reservation Workflow

Complete lifecycle from request to arrival:

1. **Waiter** clicks "Rezervo" on TablesView → fills guest details → submits request
2. **Admin** sees the request in `ReservationsView` → confirms or declines
3. On confirmation, the table becomes `RESERVED` (mauve badge with `R`)
4. When the waiter opens an order for that table, the reservation automatically becomes `ARRIVED` and the table becomes `ON_DINE` — handled atomically by the backend on `POST /orders`
5. Admin can also manually mark `ARRIVED` or `NO_SHOW` from the confirmed list
6. When the order is paid, the table returns to `AVAILABLE`

All state transitions propagate to all clients via 10-second auto-refresh and the sync engine.

### Reservation History and Analytics

`ReservationsHistoryView` provides business insights:

- Filter by date range (Today, Last 7 days, Last 30 days, or custom)
- Filter by status (Arrived, No-show, Declined, Cancelled)
- Search by guest name, phone, or table
- Sort newest or oldest first (by creation ID for a stable "most recent first" order)
- Metrics: show-up rate, total arrived, total no-shows, declined, cancelled
- **Export filtered results to CSV** via Tauri's native save dialog

Useful for identifying trends (e.g., a high no-show rate on Friday evenings may justify requiring a deposit).

### PDF Report Generation

Three professional PDF reports, all exported via Tauri's native save dialog (no browser download folders, no print pop-ups):

- **Daily Z-report** — total sales, cash vs card breakdown, average order, best-selling products
- **Monthly report** — day-by-day totals across a date range, with grand totals, ready to email to an accountant
- **Per-staff report** — individual performance including tips earned and orders handled

All reports use `jsPDF` with `jspdf-autotable` for clean, printable tables. The Save As dialog defaults to a sensible filename (e.g., `raport_2026-07-25.pdf`).

### AI Invoice Scanning

Upload a PDF supplier invoice and Claude extracts:

- Supplier name
- Line items (product, quantity, unit, price)
- Total amount

Line items are pre-filled into the delivery form for the admin to review and confirm before saving. Reduces a 5-minute manual data-entry task to under 30 seconds.

### Multi-Role Authentication

- **Admin** — full access to menu, stock, staff, reports, table management, and reservations
- **Cashier / Banakier** — POS operations only, cannot modify menu or settings
- PIN-based login (4 digits, BCrypt-hashed on the backend and cached locally)
- Session persists via `sessionStorage` and restores on refresh
- **Offline login works** by validating the entered PIN against a locally cached BCrypt hash

### Real-Time Consistency

TablesView, ManageTablesView, and ReservationsView all auto-refresh every 10 seconds. Combined with the sync engine, this means:

- When admin confirms a reservation, the cashier's view updates within 10 seconds
- When a waiter opens an order, the admin sees the table become occupied within 10 seconds
- When the network returns after an outage, all queued operations flush automatically
- No manual refresh required during a shift

---

## API Integration

All API calls go through `src/api/client.ts`:

```typescript
import { api } from './api/client'

const tables = await api.get<Table[]>('/tables')
await api.post('/reservations/requests', { ... })
await api.patch(`/tables/${id}/position`, { positionX, positionY })
await api.post('/ai/analytics', { question: 'Sa fitim pata sot?' })
```

The client supports `GET`, `POST`, `PUT`, `PATCH`, and `DELETE`, handles JSON serialization automatically, and throws typed errors on non-2xx responses.

Backend URL is currently hardcoded to `http://localhost:8080/api`. In production this would move to an environment variable.

---

## Design System

### Theme

- **Warm Charcoal** (`#16161A`) — primary background
- **Sage Green** (`#9CB89C`) — primary brand color
- **Cream** (`#E8E4D8`) — foreground text
- **Terracotta** (`#E0A07A`) — occupied tables, warnings
- **Mauve** (`#B4A5D0`) — reserved tables, admin actions

### Typography

- **Inter** for UI text
- Monospace for numbers and PINs
- Tabular numerals via `font-variant-numeric: tabular-nums`

### Currency Handling

Prices are stored as **integers in cents** (not floats). €1.20 → 120.

Use `formatMoney(120)` for display and `parseMoney('1.20')` for input. This eliminates floating-point rounding errors on totals.

---

## Development

### Hot reload

Both `npm run dev` (web) and `npm run tauri dev` (desktop) support hot module replacement.

### Type checking

```bash
npm run type-check
```

### Build for production (web only)

```bash
npm run build
```

Output lands in `dist/`.

### Build desktop installer

```bash
npm run tauri build
```

Output: `src-tauri/target/release/bundle/msi/KENDI-POS_X.X.X_x64_en-US.msi`

Install this on Windows to run Kendi POS as a native app.

### Tauri capabilities

The app requires the following permissions (declared in `src-tauri/capabilities/default.json`):

- `sql:*` — local SQLite access
- `dialog:allow-save` — native Save As dialog for exports
- `fs:allow-write-file`, `fs:allow-write-text-file` — writing PDFs and CSVs
- `fs:scope-desktop-recursive`, `fs:scope-download-recursive`, `fs:scope-document-recursive` — save locations

---

## Backend

The Spring Boot backend lives in a separate repository:
**[kendi-pos-backend](https://github.com/BrikendGjyliqi/kendi-pos-backend)**

The frontend expects the backend on `http://localhost:8080`. Start the backend before running the frontend (the app will boot in offline mode if the backend is unreachable, using cached SQLite data).

---

## Roadmap

Completed for the current thesis milestone:

- ✅ Full POS with menu, tables, orders, payments, tipping
- ✅ Reservation workflow with automatic state transitions
- ✅ Offline-first architecture (SQLite + sync engine + pending queue)
- ✅ Offline authentication via cached BCrypt hashes
- ✅ AI invoice scanning
- ✅ **AI Analytics Assistant with natural-language questions and auto-generated charts**
- ✅ PDF and CSV export via native Tauri dialogs
- ✅ Drag-and-drop floor plan editor
- ✅ Full Albanian localization
- ✅ Native Windows installer

Deferred to future work:

- JWT authentication with proper role-based `@PreAuthorize` guards
- Auto no-show scheduler (cron job to mark stale reservations)
- Real-time notifications (sound + badge on new reservation request)
- Fiscal integration (ATK Kosovo)
- Receipt printing (ESC/POS thermal printer)
- Conflict resolution for concurrent offline edits (currently last-write-wins)
- Proactive AI insights (daily business summary, predictive stock ordering)

---

## License

Private — part of the diploma thesis **"Design and Implementation of an Offline-First POS System for Restaurants in Kosovo"** at the University of Hildesheim.

Author: **Brikend Gjyliqi**
