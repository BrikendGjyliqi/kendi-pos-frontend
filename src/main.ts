import './assets/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useSettingsStore } from './stores/settings'
import { i18n } from './i18n'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.use(i18n)

  // Apply saved theme as early as possible
  try {
    const settings = useSettingsStore()
    await settings.load()
  } catch (e) {
    console.error('[Kendi POS] Failed to load settings:', e)
  }

  app.use(router)
  app.mount('#app')
}

bootstrap()