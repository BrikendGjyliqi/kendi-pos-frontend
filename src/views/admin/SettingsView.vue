<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSettingsStore } from '../../stores/settings'
import { useOrdersStore } from '../../stores/orders'
import { formatMoney } from '../../db'
import { Sun, Moon, Database, AlertTriangle } from 'lucide-vue-next'
import { setLocale } from '../../i18n'
import { useI18n } from 'vue-i18n'

const settings = useSettingsStore()
const { locale } = useI18n()

function changeLanguage(lang: 'sq' | 'en') {
  setLocale(lang)
}
const ordersStore = useOrdersStore()

const localVenueName = ref(settings.settings.venueName)
const localVenueLocation = ref(settings.settings.venueLocation)
const saved = ref<string | null>(null)

watch(() => settings.settings.venueName, v => { localVenueName.value = v })
watch(() => settings.settings.venueLocation, v => { localVenueLocation.value = v })

async function saveVenue() {
  await settings.set('venueName', localVenueName.value.trim())
  await settings.set('venueLocation', localVenueLocation.value.trim())
  saved.value = 'venue'
  setTimeout(() => { saved.value = null }, 2000)
}

const stats = computed(() => ordersStore.todayStats)

async function clearOrders() {
  if (!confirm('Fshi të gjitha porositë (përfshirë të paguarat)? Veprimi nuk mund të kthehet.')) return
  if (!confirm('A je i sigurt? Kjo do të fshijë çdo histori shitjeje.')) return

  const { api } = await import('../../api/client')
  // Merr krejt porosit nga backend dhe fshi nje per nje
  const allOrders = await api.get<Array<{ id: string }>>('/orders')
  for (const o of allOrders) {
    try {
      await api.delete(`/orders/${o.id}`)
    } catch (e) {
      console.error('Failed to delete order', o.id, e)
    }
  }
  // Pastro edhe memorien e store
  ordersStore.orders.length = 0
  alert('Të gjitha porositë u fshinë.')
}

async function resetEverything() {
  const confirmation = prompt('Shkruaj "FSHIJ TËRË" për të vazhduar. Kjo fshin GJITHQKA — produkte, kategori, tavolina, porosi.')
  if (confirmation !== 'FSHIJ TËRË') return

  const { api } = await import('../../api/client')

  // Fshi krejt porosit
  const allOrders = await api.get<Array<{ id: string }>>('/orders')
  for (const o of allOrders) {
    try { await api.delete(`/orders/${o.id}`) } catch {}
  }

  // Fshi krejt produktet
  const allProducts = await api.get<Array<{ id: string }>>('/products')
  for (const p of allProducts) {
    try { await api.delete(`/products/${p.id}`) } catch {}
  }

  // Fshi krejt kategorite
  const allCats = await api.get<Array<{ id: string }>>('/categories')
  for (const c of allCats) {
    try { await api.delete(`/categories/${c.id}`) } catch {}
  }

  // Fshi krejt tavolinat
  const allTables = await api.get<Array<{ id: string }>>('/tables')
  for (const t of allTables) {
    try { await api.delete(`/tables/${t.id}`) } catch {}
  }

  alert('Baza e të dhënave u rivendos. Faqja do të rifreskohet.')
  location.reload()
}
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Menaxhim</p>
        <h1>Cilësimet</h1>
      </div>
    </header>

    <div class="sections">
      <!-- Venue -->
      <section class="section k-card">
        <header class="section-head">
          <h2>Informacioni i biznesit</h2>
          <p>Emri që shfaqet kudo në sistem dhe në faturat e printuara.</p>
        </header>

        <div class="section-body">
          <div class="field">
            <label>Emri i biznesit</label>
            <input v-model="localVenueName" class="k-input" placeholder="Kendi Cafe" />
          </div>

          <div class="field">
            <label>Lokacioni</label>
            <input v-model="localVenueLocation" class="k-input" placeholder="Veternik, Prishtinë" />
          </div>

          <div class="field-actions">
            <button class="k-btn k-btn--primary" @click="saveVenue">Ruaj ndryshimet</button>
            <span v-if="saved === 'venue'" class="saved-flag">✓ Ruajtur</span>
          </div>
        </div>
      </section>

      <!-- Theme -->
      <section class="section k-card">
        <header class="section-head">
          <h2>Pamja</h2>
          <p>Modi i errët është rekomanduar për turne të gjatë; modi i ndritshëm për ditë me dritë.</p>
        </header>

        <div class="section-body">
          <div class="theme-options">
            <button class="theme-option" :class="{ active: !settings.isDark }"
              @click="settings.set('theme', 'light')">
              <Sun :size="18" />
              <span>I ndritshëm</span>
            </button>
            <button class="theme-option" :class="{ active: settings.isDark }"
              @click="settings.set('theme', 'dark')">
              <Moon :size="18" />
              <span>I errët</span>
            </button>
          </div>
        </div>
      </section>

      <!-- Language -->
<section class="section k-card">
  <header class="section-head">
    <h2>Gjuha / Language</h2>
    <p>Zgjidh gjuhën e ndërfaqes.</p>
  </header>

  <div class="section-body">
    <div class="theme-options">
      <button class="theme-option" :class="{ active: locale === 'sq' }"
        @click="changeLanguage('sq')">
        <span>🇦🇱 Shqip</span>
      </button>
      <button class="theme-option" :class="{ active: locale === 'en' }"
        @click="changeLanguage('en')">
        <span>🇬🇧 English</span>
      </button>
    </div>
  </div>
</section>

      <!-- Stats today -->
      <section class="section k-card">
        <header class="section-head">
          <h2>Sot</h2>
          <p>Pamje e shpejtë e ditës.</p>
        </header>

        <div class="section-body">
          <div class="stats-grid">
            <div class="stat-box">
              <p class="stat-label">Porosi të mbyllura</p>
              <p class="stat-val">{{ stats.count }}</p>
            </div>
            <div class="stat-box">
              <p class="stat-label">Total shitje</p>
              <p class="stat-val money mono">{{ formatMoney(stats.total) }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Danger zone -->
      <section class="section k-card danger-zone">
        <header class="section-head">
          <h2>
            <AlertTriangle :size="16" class="danger-icon" />
            Zona e rrezikshme
          </h2>
          <p>Këto veprime janë të pakthyeshme. Përdori me kujdes.</p>
        </header>

        <div class="section-body">
          <div class="danger-action">
            <div class="danger-text">
              <h3>Pastro historinë e porosive</h3>
              <p>Fshi të gjitha porositë e mbyllura. Produkte, kategori dhe personeli mbeten.</p>
            </div>
            <button class="k-btn k-btn--danger" @click="clearOrders">
              Pastro porositë
            </button>
          </div>

          <div class="danger-action">
            <div class="danger-text">
              <h3>Rivendos krejt sistemin</h3>
              <p>Fshi gjithqka — produkte, kategori, tavolina, porosi, cilësime. Vetëm përdoruesit mbeten.</p>
            </div>
            <button class="k-btn k-btn--danger" @click="resetEverything">
              Rivendos sistemin
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.page {
  height: 100%;
  padding: 24px 28px;
  overflow-y: auto;
}

.page-head {
  margin-bottom: 24px;
}

.page-head .eyebrow { margin-bottom: 4px; }

.page-head h1 {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.sections {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 760px;
}

.section {
  padding: 22px 24px;
}

.section-head {
  margin-bottom: 18px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border);
}

.section-head h2 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.section-head p {
  font-size: 13px;
  color: var(--text-2);
}

.section-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 380px;
}

.field label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
}

.field-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}

.saved-flag {
  font-size: 13px;
  color: var(--money);
  font-weight: 600;
  animation: fade-in 200ms var(--ease);
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Theme switch */
.theme-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  max-width: 380px;
}

.theme-option {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-2);
  font-size: 14px;
  font-weight: 500;
  transition: all var(--duration) var(--ease);
}

.theme-option:hover {
  background: var(--surface-3);
  color: var(--text);
}

.theme-option.active {
  background: var(--brand-soft);
  border-color: var(--brand-line);
  color: var(--brand);
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  max-width: 480px;
}

.stat-box {
  padding: 16px 18px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.stat-label {
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 6px;
}

.stat-val {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
}

.stat-val.money {
  color: var(--money);
  font-variant-numeric: tabular-nums;
}

/* Danger zone */
.danger-zone {
  border-color: var(--danger-soft);
}

.danger-icon { color: var(--danger); }

.danger-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.danger-action:last-child { border-bottom: none; padding-bottom: 0; }

.danger-text { flex: 1; }

.danger-text h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 4px;
}

.danger-text p {
  font-size: 13px;
  color: var(--text-2);
  max-width: 50ch;
}
</style>