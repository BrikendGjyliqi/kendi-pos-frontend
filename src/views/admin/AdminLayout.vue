<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, RouterView, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/auth'
import { useSettingsStore } from '../../stores/settings'
import { ArrowLeft, UtensilsCrossed, Users, Settings as SettingsIcon, Sun, Moon, LogOut, History, BarChart2, UserCheck } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const settings = useSettingsStore()

const venue = computed(() => settings.settings.venueName)

function backToPos() {
  router.push('/tables')
}

function logout() {
  auth.logout()
  router.replace('/')
}
</script>

<template>
  <div class="admin">
    <!-- ─── Sidebar ─── -->
    <aside class="sidebar">
      <header class="brand">
        <div class="mark">
          <svg viewBox="0 0 64 64" fill="none">
            <rect width="64" height="64" rx="14" fill="var(--brand-deep)" />
            <path d="M20 16 L20 48 M20 32 L40 16 M20 32 L40 48" stroke="#FAFAF7"
              stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div>
          <h1>Kendi {{ t('nav.admin') }}</h1>
          <p>{{ venue }}</p>
        </div>
      </header>

      <nav class="nav">
        <p class="nav-label">{{ t('nav.management') }}</p>
        <RouterLink to="/admin/menu" class="nav-link">
          <UtensilsCrossed :size="18" />
          {{ t('nav.menu') }}
        </RouterLink>
        <RouterLink to="/admin/staff" class="nav-link">
          <Users :size="18" />
          {{ t('nav.staff') }}
        </RouterLink>
        <RouterLink to="/admin/settings" class="nav-link">
          <SettingsIcon :size="18" />
          {{ t('nav.settings') }}
        </RouterLink>

        <p class="nav-label" style="margin-top: 16px">{{ t('nav.analytics') }}</p>
        <RouterLink to="/admin/history" class="nav-link">
          <History :size="18" />
          {{ t('nav.history') }}
        </RouterLink>
        <RouterLink to="/admin/reports" class="nav-link">
          <BarChart2 :size="18" />
          {{ t('nav.reports') }}
        </RouterLink>
        <RouterLink to="/admin/staff-report" class="nav-link">
          <UserCheck :size="18" />
          {{ t('nav.staffReport') }}
        </RouterLink>
      </nav>

      <footer class="sidebar-foot">
        <button class="theme-toggle" @click="settings.toggleTheme()">
          <Sun v-if="settings.isDark" :size="16" />
          <Moon v-else :size="16" />
          {{ settings.isDark ? t('settings.light') : t('settings.dark') }}
        </button>

        <button class="back-btn" @click="backToPos">
          <ArrowLeft :size="16" />
          {{ t('nav.backToPos') }}
        </button>

        <div class="user">
          <div class="user-info">
            <p class="user-name">{{ auth.currentStaff?.name }}</p>
            <p class="user-role">{{ t('staff.admin') }}</p>
          </div>
          <button class="logout" @click="logout" :title="t('nav.logout')">
            <LogOut :size="14" />
          </button>
        </div>
      </footer>
    </aside>

    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.admin {
  display: grid;
  grid-template-columns: 260px 1fr;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 20px 16px;
  overflow-y: auto;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px 22px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 20px;
}

.mark { width: 38px; height: 38px; flex-shrink: 0; }

.brand h1 { font-size: 14px; font-weight: 700; letter-spacing: -0.01em; margin-bottom: 1px; }
.brand p { font-size: 11px; color: var(--text-3); }

.nav { display: flex; flex-direction: column; gap: 2px; }

.nav-label {
  padding: 0 12px 8px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius);
  color: var(--text-2);
  font-size: 14px;
  font-weight: 500;
  transition: all var(--duration) var(--ease);
}

.nav-link:hover { background: var(--surface-2); color: var(--text); }
.nav-link.router-link-active { background: var(--brand-soft); color: var(--brand); }

.sidebar-foot {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.theme-toggle, .back-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 500;
  background: transparent;
  transition: all var(--duration) var(--ease);
  text-align: left;
}

.theme-toggle:hover, .back-btn:hover { background: var(--surface-2); color: var(--text); }

.user {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  margin-top: 6px;
  border-radius: var(--radius);
  background: var(--surface-2);
}

.user-info { min-width: 0; }

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  font-size: 10px;
  font-family: var(--font-mono);
  letter-spacing: 0.08em;
  color: var(--text-3);
  text-transform: uppercase;
}

.logout {
  width: 30px; height: 30px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 8px;
  color: var(--text-2);
  transition: all var(--duration) var(--ease);
  flex-shrink: 0;
}
.logout:hover { background: var(--danger-soft); color: var(--danger); }

.main { overflow-y: auto; background: var(--bg); }

@media (max-width: 900px) {
  .admin { grid-template-columns: 1fr; }
  .sidebar { display: none; }
}
</style>