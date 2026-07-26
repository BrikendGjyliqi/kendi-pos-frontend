<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '../../api/client'
import { useAuthStore } from '../../stores/auth'
import { Plus, Pencil, Trash2, Shield, User, X } from 'lucide-vue-next'

type Staff = {
  id: string
  name: string
  pin: string
  role: 'admin' | 'cashier'
}

const auth = useAuthStore()
const staff = ref<Staff[]>([])
const loaded = ref(false)

const modal = ref<{ open: boolean; staff: Staff | null }>({ open: false, staff: null })
const form = ref({ name: '', pin: '', role: 'cashier' as 'admin' | 'cashier' })
const formError = ref<string | null>(null)

const sortedStaff = computed(() =>
  [...staff.value].sort((a, b) => {
    if (a.role === b.role) return a.name.localeCompare(b.name)
    return a.role === 'admin' ? -1 : 1
  })
)

async function loadStaff() {
  try {
    staff.value = await api.get<Staff[]>('/staff')
  } catch (e) {
    console.error('Failed to load staff:', e)
  } finally {
    loaded.value = true
  }
}

onMounted(loadStaff)

function openNew() {
  form.value = { name: '', pin: '', role: 'cashier' }
  formError.value = null
  modal.value = { open: true, staff: null }
}

function openEdit(s: Staff) {
  form.value = { name: s.name, pin: s.pin, role: s.role }
  formError.value = null
  modal.value = { open: true, staff: s }
}

function closeModal() {
  modal.value = { open: false, staff: null }
}

async function save() {
  formError.value = null
  const name = form.value.name.trim()
  if (!name) {
    formError.value = 'Emri është i nevojshëm'
    return
  }
  if (!/^\d{4}$/.test(form.value.pin)) {
    formError.value = 'PIN duhet të jetë 4 shifra'
    return
  }

  try {
    if (modal.value.staff) {
      const updated = await api.put<Staff>(`/staff/${modal.value.staff.id}`, {
        name,
        pin: form.value.pin,
        role: form.value.role
      })
      staff.value = staff.value.map(s => s.id === updated.id ? updated : s)
    } else {
      const created = await api.post<Staff>('/staff', {
        name,
        pin: form.value.pin,
        role: form.value.role
      })
      staff.value.push(created)
    }
    closeModal()
  } catch (e) {
    formError.value = (e as Error).message
  }
}

async function remove(s: Staff) {
  if (s.id === auth.currentStaff?.id) {
    alert('Nuk mund të fshini veten')
    return
  }
  if (!confirm(`Fshi përdoruesin "${s.name}"?`)) return
  try {
    await api.delete(`/staff/${s.id}`)
    staff.value = staff.value.filter(x => x.id !== s.id)
  } catch (e) {
    alert((e as Error).message)
  }
}
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Menaxhim</p>
        <h1>Personeli</h1>
      </div>
      <button class="k-btn k-btn--primary" @click="openNew">
        <Plus :size="16" />
        Shto përdorues
      </button>
    </header>

    <div class="staff-card k-card">
      <div v-if="sortedStaff.length > 0" class="staff-list">
        <div v-for="s in sortedStaff" :key="s.id" class="staff-row">
          <div class="staff-icon" :class="{ admin: s.role === 'admin' }">
            <Shield v-if="s.role === 'admin'" :size="16" />
            <User v-else :size="16" />
          </div>
          <div class="staff-info">
            <div class="staff-name">
              {{ s.name }}
              <span v-if="s.id === auth.currentStaff?.id" class="staff-you">(ti)</span>
            </div>
            <div class="staff-role">
              {{ s.role === 'admin' ? 'Admin' : 'Banakier' }}
              <span class="staff-pin mono">PIN: {{ s.pin }}</span>
            </div>
          </div>
          <div class="staff-actions">
            <button class="row-btn" @click="openEdit(s)" title="Ndrysho">
              <Pencil :size="14" />
            </button>
            <button class="row-btn row-btn--danger" @click="remove(s)" title="Fshij">
              <Trash2 :size="14" />
            </button>
          </div>
        </div>
      </div>

      <div v-else-if="loaded" class="k-empty">
        <p>Asnjë përdorues</p>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="modal.open" class="modal-bg" @click.self="closeModal">
      <div class="modal">
        <header class="modal-head">
          <h2>{{ modal.staff ? 'Ndrysho përdorues' : 'Shto përdorues' }}</h2>
          <button class="modal-close" @click="closeModal">
            <X :size="20" />
          </button>
        </header>

        <div class="modal-body">
          <div class="field">
            <label>Emri</label>
            <input v-model="form.name" type="text" class="k-input" placeholder="Emri i plotë" />
          </div>

          <div class="field">
            <label>PIN (4 shifra)</label>
            <input v-model="form.pin" type="text" maxlength="4" inputmode="numeric"
              class="k-input" placeholder="0000" />
          </div>

          <div class="field">
            <label>Roli</label>
            <div class="role-selector">
              <button
                :class="['role-btn', form.role === 'admin' && 'role-btn--active']"
                @click="form.role = 'admin'">
                <Shield :size="14" />
                Admin
              </button>
              <button
                :class="['role-btn', form.role === 'cashier' && 'role-btn--active']"
                @click="form.role = 'cashier'">
                <User :size="14" />
                Banakier
              </button>
            </div>
          </div>

          <div v-if="formError" class="form-error">{{ formError }}</div>
        </div>

        <footer class="modal-foot">
          <button class="k-btn k-btn--ghost" @click="closeModal">Anulo</button>
          <button class="k-btn k-btn--primary" @click="save">
            {{ modal.staff ? 'Ruaj' : 'Shto' }}
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.page-head h1 {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.staff-list {
  display: flex;
  flex-direction: column;
}

.staff-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}

.staff-row:last-child {
  border-bottom: none;
}

.staff-row:hover {
  background: var(--surface-2);
}

.staff-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius);
  background: var(--surface-2);
  color: var(--text-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.staff-icon.admin {
  background: var(--brand-soft);
  color: var(--brand);
}

.staff-info {
  flex: 1;
}

.staff-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 6px;
}

.staff-you {
  font-size: 11px;
  color: var(--text-3);
  font-weight: 400;
}

.staff-role {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.staff-pin {
  font-size: 11px;
  color: var(--text-3);
  background: var(--surface-2);
  padding: 2px 6px;
  border-radius: 4px;
}

.staff-actions {
  display: flex;
  gap: 6px;
}

.row-btn {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--text-2);
  transition: all var(--duration) var(--ease);
}

.row-btn:hover {
  background: var(--surface-2);
  color: var(--text);
}

.row-btn--danger:hover {
  background: var(--danger-soft);
  color: var(--danger);
}

/* Modal */
.modal-bg {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: var(--overlay);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal {
  width: 100%;
  max-width: 440px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border);
}

.modal-head h2 {
  font-size: 17px;
  font-weight: 700;
}

.modal-close {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--text-2);
}

.modal-close:hover {
  background: var(--surface-2);
}

.modal-body {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
}

.role-selector {
  display: flex;
  gap: 8px;
}

.role-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-2);
  font-size: 13px;
  transition: all var(--duration) var(--ease);
}

.role-btn:hover {
  background: var(--surface);
  color: var(--text);
}

.role-btn--active {
  background: var(--brand-soft);
  border-color: var(--brand-line);
  color: var(--brand);
}

.form-error {
  font-size: 13px;
  color: var(--danger);
  padding: 10px 14px;
  background: var(--danger-soft);
  border-radius: 8px;
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 22px;
  border-top: 1px solid var(--border);
}
</style>