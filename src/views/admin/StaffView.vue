<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { api } from '../../api/client'
import { Plus, Pencil, Trash2, X, Shield, User } from 'lucide-vue-next'

const auth = useAuthStore()

type Staff = {
  id: string
  name: string
  role: 'admin' | 'cashier'
  active: boolean
  createdAt: number
}

const staff = ref<Staff[]>([])
const loaded = ref(false)

const modal = ref<{ open: boolean; staff: Staff | null }>({ open: false, staff: null })
const form = ref({ name: '', pin: '', role: 'cashier' as 'admin' | 'cashier' })
const formError = ref<string | null>(null)

onMounted(async () => {
  await load()
})

async function load() {
  staff.value = await api.get<Staff[]>('/staff')
  loaded.value = true
}

const sortedStaff = computed(() =>
  [...staff.value].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'admin' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
)

const adminCount = computed(() =>
  staff.value.filter(s => s.role === 'admin' && s.active).length
)

function openNew() {
  form.value = { name: '', pin: '', role: 'cashier' }
  formError.value = null
  modal.value = { open: true, staff: null }
}

function openEdit(s: Staff) {
  form.value = { name: s.name, pin: '', role: s.role }
  formError.value = null
  modal.value = { open: true, staff: s }
}

async function save() {
  formError.value = null
  const name = form.value.name.trim()
  const pin = form.value.pin.trim()

  if (!name) { formError.value = 'Emri është i nevojshëm'; return }

  // Kur krijon te ri, PIN i nevojshem; kur edit, mund t'lihet bosh
  if (!modal.value.staff && !/^\d{4}$/.test(pin)) {
    formError.value = 'PIN-i duhet të jetë 4 shifra'; return
  }
  if (modal.value.staff && pin && !/^\d{4}$/.test(pin)) {
    formError.value = 'PIN-i duhet të jetë 4 shifra'; return
  }

  // Mos i lejo me hek rolin Admin nga i fundit
  if (modal.value.staff?.role === 'admin' && form.value.role !== 'admin' && adminCount.value === 1) {
    formError.value = 'Nuk mund të largoni rolin Admin nga përdoruesi i fundit Admin'
    return
  }

  try {
    if (modal.value.staff) {
      // Update
      const updated = await api.put<Staff>(`/staff/${modal.value.staff.id}`, {
        name,
        pin: pin || null,
        role: form.value.role
      })
      const idx = staff.value.findIndex(s => s.id === updated.id)
      if (idx >= 0) staff.value[idx] = updated
    } else {
      // Create
      const created = await api.post<Staff>('/staff', {
        name,
        pin,
        role: form.value.role
      })
      staff.value.push(created)
    }
    modal.value = { open: false, staff: null }
  } catch (e: any) {
    formError.value = e.message || 'Gabim gjate ruajtjes'
  }
}

async function remove(s: Staff) {
  if (s.id === auth.currentStaff?.id) {
    alert('Nuk mund të fshini llogarinë tuaj')
    return
  }
  if (s.role === 'admin' && adminCount.value === 1) {
    alert('Nuk mund të fshini Adminin e fundit')
    return
  }
  if (!confirm(`Fshi përdoruesin "${s.name}"?`)) return

  await api.delete(`/staff/${s.id}`)
  staff.value = staff.value.filter(x => x.id !== s.id)
}

function closeModal() {
  modal.value = { open: false, staff: null }
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
              <span class="staff-pin mono">PIN: ••••</span>
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
          <h2>{{ modal.staff ? 'Ndrysho përdoruesin' : 'Përdorues i ri' }}</h2>
          <button class="modal-close" @click="closeModal">
            <X :size="18" />
          </button>
        </header>

        <form class="modal-body" @submit.prevent="save">
          <div class="field">
            <label>Emri</label>
            <input v-model="form.name" class="k-input" autofocus />
          </div>

          <div class="field">
            <label>PIN (4 shifra)</label>
            <input v-model="form.pin" class="k-input mono" maxlength="4" inputmode="numeric"
              placeholder="0000" />
          </div>

          <div class="field">
            <label>Roli</label>
            <select v-model="form.role" class="k-input">
              <option value="cashier">Banakier</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <p v-if="formError" class="form-error">{{ formError }}</p>

          <div class="modal-actions">
            <button type="button" class="k-btn k-btn--ghost" @click="closeModal">Anulo</button>
            <button type="submit" class="k-btn k-btn--primary">
              {{ modal.staff ? 'Ruaj' : 'Krijo' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 24px 28px;
  gap: 22px;
  overflow: hidden;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-shrink: 0;
}

.page-head .eyebrow { margin-bottom: 4px; }

.page-head h1 {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.staff-card {
  flex: 1;
  overflow: hidden;
  max-width: 720px;
}

.staff-list {
  height: 100%;
  overflow-y: auto;
}

.staff-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  transition: background var(--duration) var(--ease);
}

.staff-row:hover { background: var(--surface-2); }
.staff-row:last-child { border-bottom: none; }

.staff-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  color: var(--text-2);
}

.staff-icon.admin {
  background: var(--brand-soft);
  color: var(--brand);
}

.staff-info { flex: 1; min-width: 0; }

.staff-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.staff-you {
  font-size: 11px;
  color: var(--text-3);
  font-weight: 400;
  margin-left: 4px;
}

.staff-role {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--text-3);
  margin-top: 2px;
}

.staff-pin {
  padding: 2px 8px;
  background: var(--surface-2);
  border-radius: var(--radius-full);
  font-size: 11px;
}

.staff-actions {
  display: flex;
  gap: 4px;
}

.row-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
  background: transparent;
  transition: all var(--duration) var(--ease);
}

.row-btn:hover { background: var(--surface-3); color: var(--text); }
.row-btn--danger:hover { background: var(--danger-soft); color: var(--danger); }

/* Modal — reuse styles */
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
  max-width: 420px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
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
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-2);
  transition: background var(--duration) var(--ease);
}
.modal-close:hover { background: var(--surface-2); }

.modal-body {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 12px; font-weight: 500; color: var(--text-2); }

select.k-input {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3e%3cpath d='M1 1L5 5L9 1' stroke='%239BA6B2' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 14px center;
  padding-right: 36px;
}

.form-error {
  font-size: 13px;
  color: var(--danger);
  padding: 8px 12px;
  background: var(--danger-soft);
  border-radius: 8px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}
</style>
