<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settings'
import { Delete } from 'lucide-vue-next'

const router = useRouter()
const { t } = useI18n()
const auth = useAuthStore()
const settings = useSettingsStore()

const pin = ref('')
const error = ref<string | null>(null)
const PIN_LENGTH = 4

const venueName = computed(() => settings.settings.venueName)

onMounted(async () => {
  // If already authenticated, skip
  const restored = await auth.restore()
  if (restored) {
    router.replace('/tables')
  }
})

async function press(digit: string) {
  if (pin.value.length >= PIN_LENGTH) return
  error.value = null
  pin.value += digit

  if (pin.value.length === PIN_LENGTH) {
    await attemptLogin()
  }
}

function backspace() {
  error.value = null
  pin.value = pin.value.slice(0, -1)
}

function clearPin() {
  error.value = null
  pin.value = ''
}

async function attemptLogin() {
  const ok = await auth.loginWithPin(pin.value)
  if (ok) {
    router.replace('/tables')
  } else {
    error.value = auth.error
    // Shake & clear
    setTimeout(() => {
      pin.value = ''
    }, 600)
  }
}

// Keyboard support — typists can use the keyboard, not just touch
function handleKeydown(e: KeyboardEvent) {
  if (e.key >= '0' && e.key <= '9') {
    press(e.key)
  } else if (e.key === 'Backspace') {
    backspace()
  } else if (e.key === 'Escape') {
    clearPin()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

const dots = computed(() =>
  Array.from({ length: PIN_LENGTH }, (_, i) => i < pin.value.length)
)
</script>

<template>
  <div class="login">
    <div class="login-bg" aria-hidden="true"></div>

    <main class="login-card">
      <header class="brand">
        <div class="brand-mark">
          <svg viewBox="0 0 64 64" fill="none">
            <rect width="64" height="64" rx="14" fill="var(--brand-deep)" />
            <path d="M20 16 L20 48 M20 32 L40 16 M20 32 L40 48"
              stroke="#FAFAF7" stroke-width="6"
              stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <h1>Kendi POS</h1>
        <p class="venue">{{ venueName }}</p>
      </header>

      <div class="pin-row">
        <div class="pin-dots" :class="{ shake: !!error }">
          <span v-for="(filled, i) in dots" :key="i" class="pin-dot"
            :class="{ filled, error: !!error }"></span>
        </div>
        <p class="error" :class="{ visible: !!error }">{{ error || '\u00A0' }}</p>
      </div>

      <div class="keypad">
        <button v-for="n in [1, 2, 3, 4, 5, 6, 7, 8, 9]" :key="n"
          class="key" @click="press(String(n))" :disabled="auth.loading">
          {{ n }}
        </button>
        <button class="key key--ghost" @click="clearPin" :disabled="auth.loading || !pin">
          C
        </button>
        <button class="key" @click="press('0')" :disabled="auth.loading">0</button>
        <button class="key key--ghost" @click="backspace" :disabled="auth.loading || !pin">
          <Delete :size="22" />
        </button>
      </div>

      <footer class="hint">
        <p>{{ t('login.defaultPin') }}: <strong>0000</strong> ({{ t('staff.admin') }}) · <strong>1234</strong> ({{ t('staff.cashier') }})</p>
      </footer>
    </main>
  </div>
</template>

<style scoped>
.login {
  position: relative;
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow: hidden;
}

.login-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 60% 50% at 20% 20%, var(--brand-soft), transparent 60%),
    radial-gradient(ellipse 50% 60% at 80% 80%, rgba(91, 196, 184, 0.06), transparent 60%);
  pointer-events: none;
}

.login-card {
  position: relative;
  width: 100%;
  max-width: 420px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 40px 32px 28px;
  box-shadow: var(--shadow-xl);
  animation: card-in 280ms var(--ease) both;
}

@keyframes card-in {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: none; }
}

.brand {
  text-align: center;
  margin-bottom: 28px;
}

.brand-mark {
  width: 54px;
  height: 54px;
  margin: 0 auto 14px;
}

.brand h1 {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text);
  margin-bottom: 4px;
}

.venue {
  font-size: 13px;
  color: var(--text-2);
}

/* ─── PIN dots ─── */
.pin-row {
  margin-bottom: 28px;
}

.pin-dots {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 8px;
}

.pin-dots.shake { animation: shake 400ms; }

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

.pin-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: transparent;
  border: 2px solid var(--border-strong);
  transition: all var(--duration) var(--ease);
}

.pin-dot.filled {
  background: var(--brand);
  border-color: var(--brand);
}

.pin-dot.error {
  border-color: var(--danger);
  background: var(--danger);
}

.error {
  text-align: center;
  font-size: 13px;
  color: var(--danger);
  min-height: 18px;
  opacity: 0;
  transition: opacity var(--duration) var(--ease);
}

.error.visible { opacity: 1; }

/* ─── Keypad ─── */
.keypad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.key {
  height: 64px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 24px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background var(--duration) var(--ease),
              border-color var(--duration) var(--ease),
              transform 80ms var(--ease);
}

.key:not(:disabled):hover {
  background: var(--surface-3);
  border-color: var(--border-strong);
}

.key:not(:disabled):active {
  transform: scale(0.96);
  background: var(--brand-soft);
  border-color: var(--brand);
}

.key--ghost {
  background: transparent;
  color: var(--text-2);
}

.key--ghost:not(:disabled):hover {
  background: var(--surface-2);
  color: var(--text);
}

.key:disabled { opacity: 0.4; }

/* ─── Hint ─── */
.hint {
  margin-top: 22px;
  text-align: center;
  padding-top: 18px;
  border-top: 1px solid var(--border);
}

.hint p {
  font-size: 12px;
  color: var(--text-3);
}

.hint strong {
  font-family: var(--font-mono);
  color: var(--text-2);
  font-weight: 500;
}
</style>
