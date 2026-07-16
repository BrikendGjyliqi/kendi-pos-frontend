import { createI18n } from 'vue-i18n'
import sq from './sq'
import en from './en'

const savedLocale = localStorage.getItem('kendi.locale') || 'sq'

export const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'sq',
  messages: { sq, en }
})

export function setLocale(locale: 'sq' | 'en') {
  i18n.global.locale.value = locale
  localStorage.setItem('kendi.locale', locale)
}