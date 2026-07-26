import './assets/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useSettingsStore } from './stores/settings'
import { i18n } from './i18n'
import { getSqliteDb, getTablesInfo } from './db/sqlite'
import { startSyncEngine } from './sync/syncEngine'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.use(i18n)

  // ═══════════════════════════════════════════════════════════
  // OFFLINE-FIRST: Initialize SQLite local database
  // ═══════════════════════════════════════════════════════════
  try {
    await getSqliteDb()
    const tablesInfo = await getTablesInfo()
    console.log('[Kendi POS] SQLite ready:', tablesInfo)
  } catch (e) {
    console.error('[Kendi POS] Failed to init SQLite:', e)
  }

  // Apply saved theme as early as possible
  try {
    const settings = useSettingsStore()
    await settings.load()
  } catch (e) {
    console.error('[Kendi POS] Failed to load settings:', e)
  }

  app.use(router)
  app.mount('#app')

  // ═══════════════════════════════════════════════════════════
  // OFFLINE-FIRST: Start sync engine (background polling)
  // ═══════════════════════════════════════════════════════════
  startSyncEngine()
}

bootstrap()