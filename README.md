# Kendi POS

Sistemi profesional i shitjes per kafe dhe restaurante — i ndertuar me Vue 3, TypeScript, Pinia, IndexedDB dhe PWA.

## Çfarë eshte e re ne kete version

- **Dizajn i ri profesional** — paletë teal e qetë, tipografi Inter, modi i errët si default
- **IndexedDB** zëvendëson localStorage (asnjë rrezik humbjeje të të dhënave)
- **Menaxhim i plotë i menysë** — krijo/ndrysho/fshi kategori dhe produkte pa preku kodin
- **PIN-based login** — më i shpejtë se email/password për staff
- **Menaxhim i përdoruesve** — admin + banakier me role
- **PWA** — mund të instalohet në tablet si aplikacion native
- **Modi i errët / i ndritshëm** — togglueshëm nga cilësimet
- **Pa hardcoded data** — krejt menjaja menaxhohet nga admin paneli

## Start i shpejtë

```bash
npm install
npm run dev
```

Hap [http://localhost:5173](http://localhost:5173)

### PIN-et parazgjedhura

- **Admin**: `0000`
- **Banakier**: `1234`

Ndryshoji në `/admin/staff` pas hyrjes së parë.

## Struktura e projektit

```
src/
├── App.vue                # Root component
├── main.ts                # Entry point (seed + bootstrap)
├── assets/main.css        # Sistemi i dizajnit (tokens, base, utilities)
├── db/
│   ├── index.ts           # IndexedDB schema + helpers
│   └── seed.ts            # Te dhena fillestare (vetem ne fillim)
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
    ├── TablesView.vue     # Pamja e tavolinave
    ├── PosView.vue        # Marrja e porosive (zemra e sistemit)
    └── admin/
        ├── AdminLayout.vue
        ├── MenuView.vue     # CRUD produkte/kategori
        ├── StaffView.vue    # Menaxhim personeli
        └── SettingsView.vue # Cilesime + zona e rrezikshme
```

## Detaje teknike

### Çmimet ne cents
Te gjitha çmimet ruhen si **integer ne cents** (jo float). €1.20 → 120.
Kjo parandalon gabimet e rrumbullakimit. Perdor `formatMoney()` per shfaqje
dhe `parseMoney()` per input.

### Schema e IndexedDB
- `categories` — kategori produktesh me ngjyrë
- `products` — produkte (index by-category)
- `tables` — tavolina
- `orders` — porosi (status: open / paid / cancelled)
- `staff` — përdorues me PIN
- `settings` — key-value për konfigurim

### Ndryshimi i schema
Nese ndryshon schema e DB, rrit `DB_VERSION` ne `src/db/index.ts` dhe shto
migration ne callback-un `upgrade()`.

## Çka pritet ne Phase 2 (jo ende)

- Raporte (ditore, javore, mujore, Z-report)
- Printim faturash (ESC/POS)
- Modifikues produktesh (psh. pa qumësht, ekstra shot)
- Historia e porosive te mbyllura
- Fiskalizimi i plote ATK (Kosova)
- Backend Spring Boot + sinkronizim multi-device

## License

Privat — i pari nga Brikend Gjyliqi.
