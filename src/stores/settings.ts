import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { getDB } from '../db'

type AppSettings = {
  venueName: string
  venueLocation: string
  currency: string
  theme: 'dark' | 'light'
}

const DEFAULTS: AppSettings = {
  venueName: 'Kendi Cafe',
  venueLocation: '',
  currency: '€',
  theme: 'dark'
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ ...DEFAULTS })
  const loaded = ref(false)

  const isDark = computed(() => settings.value.theme === 'dark')

  async function load() {
    const db = await getDB()
    const all = await db.getAll('settings')
    for (const s of all) {
      if (s.key in settings.value) {
        ;(settings.value as Record<string, unknown>)[s.key] = s.value
      }
    }
    loaded.value = true
    applyTheme()
  }

  async function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    settings.value[key] = value
    const db = await getDB()
    await db.put('settings', { key, value })
    if (key === 'theme') applyTheme()
  }

  function applyTheme() {
    const root = document.documentElement
    if (settings.value.theme === 'light') {
      root.classList.add('light')
    } else {
      root.classList.remove('light')
    }
  }

  function toggleTheme() {
    return set('theme', settings.value.theme === 'dark' ? 'light' : 'dark')
  }

  return {
    settings,
    loaded,
    isDark,
    load,
    set,
    toggleTheme
  }
})
