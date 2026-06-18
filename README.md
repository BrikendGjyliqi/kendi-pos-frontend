 Kendi POS

Professional point-of-sale system for cafes and restaurants — built with Vue 3, TypeScript, Pinia, IndexedDB and PWA.

What's new in this version

- New professional design — calm teal palette, Inter typography, dark mode as default
- IndexedDB replaces localStorage (no risk of data loss)
- Full menu management — create/edit/delete categories and products without touching the code
- PIN-based login — faster than email/password for staff
- User management — admin + barista with roles
- PWA — can be installed on a tablet as a native app
- Dark / light mode — toggleable from settings
- No hardcoded data — the entire menu is managed from the admin panel

 Quick start

```
npm install
npm run dev
```

Open http://localhost:5173

 Default PINs

- Admin: `0000`
- Barista: `1234`

Change them in `/admin/staff` after first login.

Project structure

```
src/
├── App.vue                # Root component
├── main.ts                # Entry point (seed + bootstrap)
├── assets/main.css        # Design system (tokens, base, utilities)
├── db/
│   ├── index.ts           # IndexedDB schema + helpers
│   └── seed.ts            # Initial data (only on first run)
├── stores/                # Pinia stores
│   ├── auth.ts
│   ├── categories.ts
│   ├── products.ts
│   ├── tables.ts
│   ├── orders.ts
│   └── settings.ts
├── router/index.ts        # Routes + auth guards
└── views/
    ├── LoginView.vue      # PIN keypad
    ├── TablesView.vue     # Tables view
    ├── PosView.vue        # Order taking (the heart of the system)
    └── admin/
        ├── AdminLayout.vue
        ├── MenuView.vue     # CRUD products/categories
        ├── StaffView.vue    # Staff management
        └── SettingsView.vue # Settings + danger zone
```

 Technical details

 Prices in cents

All prices are stored as integers in cents (not floats). €1.20 → 120. This prevents rounding errors. Use `formatMoney()` for display and `parseMoney()` for input.

 IndexedDB schema

- `categories` — product categories with color
- `products` — products (indexed by category)
- `tables` — tables
- `orders` — orders (status: open / paid / cancelled)
- `staff` — users with PIN
- `settings` — key-value for configuration

 Changing the schema

If you change the DB schema, increment `DB_VERSION` in `src/db/index.ts` and add a migration in the `upgrade()` callback.

 Planned for Phase 2 (not yet)

- Reports (daily, weekly, monthly, Z-report)
- Receipt printing (ESC/POS)
- Product modifiers (e.g. no milk, extra shot)
- History of closed orders
- Full ATK fiscalization (Kosovo)
- Spring Boot backend + multi-device sync

 License

Private — first of its kind by Brikend Gjyliqi.
