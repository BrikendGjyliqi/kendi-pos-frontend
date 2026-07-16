<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../../stores/settings'
import { useOrdersStore } from '../../stores/orders'
import { useCategoriesStore } from '../../stores/categories'
import { useProductsStore } from '../../stores/products'
import { useAuthStore } from '../../stores/auth'
import { formatMoney } from '../../db'
import { AlertTriangle, RefreshCw, Trash2, Check, Sun, Moon } from 'lucide-vue-next'

const { t, locale } = useI18n()
const router = useRouter()
const settings = useSettingsStore()
const ordersStore = useOrdersStore()
const categoriesStore = useCategoriesStore()
const productsStore = useProductsStore()
const auth = useAuthStore()

const localVenueName = ref(settings.settings.venueName)
const localVenueLocation = ref(settings.settings.venueLocation)
const localAccountantEmail = ref(settings.settings.accountantEmail)
const saved = ref<string | null>(null)

watch(() => settings.settings.venueName, v => { localVenueName.value = v })
watch(() => settings.settings.accountantEmail, v => { localAccountantEmail.value = v })
watch(() => settings.settings.venueLocation, v => { localVenueLocation.value = v })

async function saveVenue() {
  await settings.set('venueName', localVenueName.value.trim())
  await settings.set('venueLocation', localVenueLocation.value.trim())
  saved.value = 'venue'
  setTimeout(() => { saved.value = null }, 2000)
}

async function saveAccountantEmail() {
  await settings.set('accountantEmail', localAccountantEmail.value.trim())
  saved.value = 'accountant'
  setTimeout(() => { saved.value = null }, 2000)
}

function changeLocale(newLocale: 'sq' | 'en') {
  locale.value = newLocale
  localStorage.setItem('kendi-locale', newLocale)
  saved.value = 'lang'
  setTimeout(() => { saved.value = null }, 2000)
}

const stats = computed(() => ordersStore.todayStats)

async function resetTables() {
  const confirmed = confirm(
    'Kjo do të mbyllë të gjitha tavolinat aktive (porositë e hapura fshihen).\nJeni të sigurt?'
  )
  if (!confirmed) return

  const openOrders = ordersStore.orders.filter(o => o.status === 'open')
  for (const order of openOrders) {
    if (order.items.length === 0) {
      await ordersStore.removeIfEmpty(order.id)
    } else {
      await ordersStore.cancel(order.id)
    }
  }

  saved.value = 'tables'
  setTimeout(() => { saved.value = null }, 2000)
}

async function resetToday() {
  const confirmed = confirm(
    'Kjo do të fshijë të gjitha porositë e sotme që janë të zbrazëta.\nJeni të sigurt?'
  )
  if (!confirmed) return

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const today = ordersStore.orders.filter(
    o => o.openedAt >= startOfDay.getTime() && o.status === 'open' && o.items.length === 0
  )

  for (const order of today) {
    await ordersStore.removeIfEmpty(order.id)
  }

  saved.value = 'today'
  setTimeout(() => { saved.value = null }, 2000)
}

async function wipeEverything() {
  const first = confirm(
    '⚠️ KUJDES: Kjo do të FSHIJË PËRGJITHMONË:\n\n' +
    '• Të gjitha porositë (të paguara, të hapura, të anuluara)\n' +
    '• Të gjitha produktet\n' +
    '• Të gjitha kategoritë\n\n' +
    'Ky veprim NUK MUND TË KTHEHET.\n\n' +
    'Vazhdoni?'
  )
  if (!first) return

  const second = confirm(
    '🚨 A jeni ABSOLUTISHT të sigurt?\n\n' +
    'Klikoni OK vetëm nëse doni të filloni nga zero.'
  )
  if (!second) return

  try {
    // Delete all orders
    for (const order of [...ordersStore.orders]) {
      try {
        await ordersStore.cancel(order.id)
      } catch (e) {}
    }

    // Delete all products
    for (const product of [...productsStore.products]) {
      try {
        await productsStore.remove(product.id)
      } catch (e) {}
    }

    // Delete all categories
    for (const cat of [...categoriesStore.sorted]) {
      try {
        await categoriesStore.remove(cat.id)
      } catch (e) {}
    }

    alert('Të gjitha të dhënat u fshinë. Sistemi do të rifreskohet.')
    auth.logout()
    router.push('/')
    setTimeout(() => location.reload(), 500)
  } catch (e) {
    alert('Gabim gjatë fshirjes: ' + (e as Error).message)
  }
}
</script>

<template>
  <div class="page">
    <header class="page-head">
      <p class="eyebrow">Menaxhim</p>
      <h1>Cilësimet</h1>
    </header>

    <!-- Kryesor -->
    <div class="grid">
      <!-- Venue info -->
      <section class="k-card">
        <div class="card-head">
          <h2>Të dhënat e lokalit</h2>
          <p>Këto shfaqen në fatura dhe faqet e printuara.</p>
        </div>

        <div class="card-body">
          <div class="field">
            <label>Emri i lokalit</label>
            <input v-model="localVenueName" class="k-input" placeholder="psh. Kendi Cafe" />
          </div>
          <div class="field">
            <label>Lokacioni</label>
            <input v-model="localVenueLocation" class="k-input" placeholder="Veternik, Prishtinë" />
          </div>

          <div class="save-row">
            <button class="k-btn k-btn--primary k-btn--sm" @click="saveVenue">
              Ruaj ndryshimet
            </button>
            <transition name="fade">
              <span v-if="saved === 'venue'" class="saved-badge">
                <Check :size="12" />
                U ruajt
              </span>
            </transition>
          </div>
        </div>
      </section>

      <!-- Kontabiliteti -->
      <section class="k-card">
        <div class="card-head">
          <h2>Kontabiliteti</h2>
          <p>Emaili ku dërgohen raportet mujore.</p>
        </div>

        <div class="card-body">
          <div class="field">
            <label>Email i kontabilistit</label>
            <input v-model="localAccountantEmail" @change="saveAccountantEmail"
              type="email" class="k-input" placeholder="kontabilisti@example.com" />
          </div>

          <transition name="fade">
            <span v-if="saved === 'accountant'" class="saved-badge">
              <Check :size="12" />
              U ruajt
            </span>
          </transition>
        </div>
      </section>

      <!-- Theme -->
      <section class="k-card">
        <div class="card-head">
          <h2>Pamja</h2>
          <p>Modi i errët është rekomanduar për turne të gjatë; modi i ndritshëm për ditë me dritë.</p>
        </div>

        <div class="card-body">
          <div class="theme-toggle">
            <button class="theme-btn" :class="{ active: !settings.isDark }"
              @click="settings.toggleTheme()" :disabled="!settings.isDark">
              <Sun :size="16" />
              I ndritshëm
            </button>
            <button class="theme-btn" :class="{ active: settings.isDark }"
              @click="settings.toggleTheme()" :disabled="settings.isDark">
              <Moon :size="16" />
              I errët
            </button>
          </div>
        </div>
      </section>

      <!-- Language -->
      <section class="k-card">
        <div class="card-head">
          <h2>Gjuha / Language</h2>
          <p>Zgjidh gjuhën e ndërfaqes.</p>
        </div>

        <div class="card-body">
          <div class="theme-toggle">
            <button class="theme-btn" :class="{ active: locale === 'sq' }"
              @click="changeLocale('sq')" :disabled="locale === 'sq'">
              🇦🇱 Shqip
            </button>
            <button class="theme-btn" :class="{ active: locale === 'en' }"
              @click="changeLocale('en')" :disabled="locale === 'en'">
              🇬🇧 English
            </button>
          </div>
          <transition name="fade">
            <span v-if="saved === 'lang'" class="saved-badge">
              <Check :size="12" />
              U ruajt
            </span>
          </transition>
        </div>
      </section>
    </div>

    <!-- Menaxhimi i të dhënave -->
    <div class="section-title">Menaxhimi i të dhënave</div>
    <div class="grid">
      <section class="k-card">
        <div class="card-head">
          <h2>Rifresko tavolinat</h2>
          <p>Fshin porositë e hapura pa artikuj. Të dhënat e paguara ruhen.</p>
        </div>
        <div class="card-body">
          <button class="k-btn k-btn--ghost" @click="resetTables">
            <RefreshCw :size="14" />
            Rifresko tavolinat
          </button>
          <transition name="fade">
            <span v-if="saved === 'tables'" class="saved-badge">
              <Check :size="12" />
              U bë
            </span>
          </transition>
        </div>
      </section>

      <section class="k-card">
        <div class="card-head">
          <h2>Rifresko porositë e sotme</h2>
          <p>Fshin porositë e sotme që janë të zbrazëta. Të dhënat e paguara ruhen.</p>
        </div>
        <div class="card-body">
          <button class="k-btn k-btn--ghost" @click="resetToday">
            <RefreshCw :size="14" />
            Rifresko sot
          </button>
          <transition name="fade">
            <span v-if="saved === 'today'" class="saved-badge">
              <Check :size="12" />
              U bë
            </span>
          </transition>
        </div>
      </section>
    </div>

    <!-- Zona e rrezikshme -->
    <div class="section-title danger-title">
      <AlertTriangle :size="16" />
      Zona e rrezikshme
    </div>
    <section class="k-card danger">
      <div class="card-head">
        <h2>Fshi gjithçka</h2>
        <p>Fshin krejt porositë, produktet dhe kategoritë. Ky veprim s'kthehet.</p>
      </div>
      <div class="card-body">
        <button class="k-btn k-btn--danger" @click="wipeEverything">
          <Trash2 :size="14" />
          Fshi gjithçka
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page {
  padding: 24px 28px;
  overflow-y: auto;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-head { margin-bottom: 8px; }
.page-head .eyebrow { margin-bottom: 4px; }
.page-head h1 { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
}

.k-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.k-card.danger { border-color: var(--danger); }

.card-head {
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
}
.card-head h2 { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
.card-head p { font-size: 12px; color: var(--text-3); line-height: 1.4; }

.card-body {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 12px; font-weight: 500; color: var(--text-2); }

.save-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}

.saved-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--brand);
  font-weight: 500;
}

.theme-toggle {
  display: flex;
  gap: 8px;
}

.theme-btn {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  border-radius: var(--radius);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all var(--duration) var(--ease);
}
.theme-btn:hover:not(:disabled) { background: var(--surface-3); color: var(--text); }
.theme-btn.active {
  background: var(--brand-soft);
  border-color: var(--brand-line);
  color: var(--brand);
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-3);
  padding: 8px 4px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.danger-title { color: var(--danger); }

.fade-enter-active, .fade-leave-active { transition: opacity 200ms ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>