# Kendi POS — Frontend

**Vue 3 + TypeScript + Tauri desktop app** for the Kendi POS restaurant management system.

Built for cafés and restaurants in Kosovo. Runs as a native desktop application via Tauri, communicating with a Spring Boot backend over REST.

---

## What's in this version

- **Native desktop app** — Tauri wraps the Vue frontend into a Windows executable
- **Full table management** — drag-and-drop floor plan editor, per-table sizing, section support (Main Dining / Terrace / Outdoor)
- **Complete reservation workflow** — waiter requests, admin confirmation, arrived/no-show tracking with automatic table state sync
- **Reservation history and analytics** — filter by date range, search by guest, CSV export, show-up rate metrics
- **AI-powered invoice scanning** — upload PDF invoices, extract line items automatically via Anthropic Claude
- **Multi-role authentication** — admin (full access) and cashier (POS only) with PIN-based login
- **Real-time sync** — auto-refresh every 10 seconds keeps all clients consistent
- **Warm Charcoal + Sage theme** — professional dark UI designed for long shifts
- **Albanian language support** — full i18n with Gheg dialect throughout

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- Rust and Tauri prerequisites for desktop build ([see Tauri docs](https://tauri.app/start/prerequisites/))
- **Backend must be running** on `http://localhost:8080` (see [kendi-pos-backend](https://github.com/BrikendGjyliqi/kendi-pos-backend))
- **PostgreSQL** running (via Docker in the backend repo)

### 1. Install dependencies

```bash
npm install
```

### 2. Development mode (web)

```bash
npm run dev
```

Opens at `http://localhost:5173`.

### 3. Development mode (Tauri desktop)

```bash
npm run tauri dev
```

Launches the Tauri window with hot reload.

### 4. Production build (desktop installer)

```bash
npm run tauri build
```

Creates a `.msi` installer in `src-tauri/target/release/bundle/msi/`.

### Default PINs

- **Admin**: `0000`
- **Cashier**: `1234`

Change these under `/admin/staff` after first login.

---

## Architecture

### Tech Stack

- **Vue 3** with Composition API and `<script setup>`
- **TypeScript** throughout
- **Vite** as the build tool
- **Tauri** for native desktop packaging
- **Pinia** for state management
- **Vue Router** with authentication guards
- **vue-i18n** for Albanian localization
- **Lucide Vue Next** for icons
- **interact.js** for drag-and-drop table positioning

### Project Structure
src/
├── App.vue
├── main.ts
├── api/
│   └── client.ts              # Fetch wrapper for backend REST API
├── assets/
├── components/
│   ├── reservations/          # Reservation-specific components
│   │   ├── PendingRequestsPanel.vue
│   │   ├── ConfirmedReservationsList.vue
│   │   └── RequestReservationModal.vue
│   ├── tables/                # Table management components
│   │   ├── TableCard.vue           # SVG chairs, dynamic per seat count
│   │   ├── AddTableModal.vue
│   │   ├── EditTableModal.vue
│   │   └── TableActionsModal.vue
│   ├── DeliveryModal.vue
│   ├── ProductFormModal.vue
│   └── SupplierOrderModal.vue
├── composables/               # Reusable composition functions
├── db/                        # Legacy IndexedDB (staff cache)
├── i18n/                      # Albanian translations
├── router/index.ts            # Routes + auth/role guards
├── stores/                    # Pinia stores
│   ├── auth.ts
│   ├── categories.ts
│   ├── deliveries.ts
│   ├── orders.ts
│   ├── products.ts
│   ├── reservations.ts        # Reservation lifecycle management
│   ├── settings.ts
│   ├── suppliers.ts
│   ├── supplierOrders.ts
│   └── tables.ts              # Tables with position, size, section
├── views/
│   ├── LoginView.vue          # PIN keypad
│   ├── PosView.vue            # Order-taking interface
│   ├── TablesView.vue         # Cashier's floor plan
│   └── admin/
│       ├── AdminLayout.vue
│       ├── DeliveryHistoryView.vue
│       ├── ManageTablesView.vue           # Drag-drop table editor
│       ├── MenuView.vue
│       ├── OrderHistoryView.vue
│       ├── ReportsView.vue
│       ├── ReservationsView.vue           # Pending requests + confirmed list
│       ├── ReservationsHistoryView.vue    # Analytics + CSV export
│       ├── SettingsView.vue
│       ├── StaffReportView.vue
│       ├── StaffView.vue
│       ├── StockView.vue
│       └── SuppliersView.vue
└── src-tauri/                 # Rust code for Tauri desktop wrapper

---

## Key Features

### Table Management with Drag-and-Drop

Admin can visually arrange tables on a floor plan:

- Toggle **Edit layout** mode to enable drag-and-drop
- Reposition tables by dragging them anywhere on the canvas
- Resize individual tables with `+` and `−` buttons (100–250px range)
- Positions and sizes save automatically to the backend
- Cashiers see the same layout in read-only mode

Uses `interact.js` for smooth pointer-based interaction. Each table renders as an SVG with dynamically positioned chairs based on seat count (2, 4, 6, 8, or 10).

### Reservation Workflow

Complete lifecycle from request to arrival:

1. **Waiter** clicks "Rezervo" on TablesView → fills guest details → submits request
2. **Admin** sees the request in `ReservationsView` → confirms or declines
3. On confirmation, the table becomes `RESERVED` (mauve badge with `R`)
4. When the waiter opens an order for that table, the reservation automatically becomes `ARRIVED` and the table becomes `ON_DINE` (backend handles this atomically)
5. Admin can also manually mark `ARRIVED` or `NO_SHOW` from the confirmed list
6. When the order is paid, the table returns to `AVAILABLE`

All state transitions are visible to all users in real-time via 10-second auto-refresh.

### Reservation History and Analytics

`ReservationsHistoryView` provides business insights:

- Filter by date range (Today, Last 7 days, Last 30 days, or custom)
- Filter by status (Arrived, No-show, Declined, Cancelled)
- Search by guest name, phone, or table
- Sort newest or oldest first
- Metrics: show-up rate percentage, total arrived, total no-shows
- Export filtered results to CSV

Useful for identifying trends (e.g., high no-show rate on Friday evenings may justify requiring a deposit).

### AI Invoice Scanning

Upload a PDF supplier invoice and Claude extracts:
- Supplier name
- Line items (product, quantity, unit, price)
- Total amount

Line items are pre-filled into the delivery form for admin to review and confirm before saving.

### Multi-Role Authentication

- **Admin** — Full access to menu, stock, staff, reports, table management, and reservations
- **Cashier** — POS operations only, cannot modify menu or settings
- PIN-based login (4 digits, BCrypt-hashed on the backend)
- Session persists via `sessionStorage` and restores on refresh

### Real-Time Consistency

TablesView and ManageTablesView both auto-refresh every 10 seconds. This means:
- When admin confirms a reservation, the cashier's view updates automatically
- When a waiter opens an order, the admin sees the table become occupied within 10 seconds
- No manual refresh required during a shift

---

## API Integration

All API calls go through `src/api/client.ts`:

```typescript
import { api } from './api/client'

const tables = await api.get<Table[]>('/tables')
await api.post('/reservations/requests', { ... })
await api.patch(`/tables/${id}/position`, { positionX, positionY })
```

Backend URL is currently hardcoded to `http://localhost:8080/api`. For production, this would move to an environment variable.

The client supports `GET`, `POST`, `PUT`, `PATCH`, and `DELETE`, automatically handles JSON serialization, and throws typed errors on non-2xx responses.

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

Output: `src-tauri/target/release/bundle/msi/Kendi POS_X.X.X_x64_en-US.msi`

Install this on Windows to run Kendi POS as a native app.

---

## Backend

The Spring Boot backend lives in a separate repository:
**[kendi-pos-backend](https://github.com/BrikendGjyliqi/kendi-pos-backend)**

The frontend expects the backend on `http://localhost:8080`. Start the backend before running the frontend.

---

## What's Next

- **Offline-first architecture** — SQLite in Tauri as local source of truth, sync engine for background reconciliation with backend (this is the core academic contribution of the thesis)
- **JWT authentication** with proper role-based `@PreAuthorize` guards
- **Auto no-show scheduler** — cron job to mark reservations as NO_SHOW after configurable delay
- **Real-time notifications** — sound + badge when new reservation request arrives
- **Fiscal integration** (ATK Kosovo)
- **Receipt printing** (ESC/POS)

---

## License

Private — part of the diploma thesis "Design and Implementation of an Offline-First POS System for Restaurants in Kosovo" at the University of Hildesheim.

Author: **Brikend Gjyliqi**
