<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSuppliersStore, type Supplier } from '../../stores/suppliers'
import { Plus, Pencil, Trash2, X, Search, Truck, Phone, Mail, MapPin, User } from 'lucide-vue-next'
import SupplierOrderModal from '../../components/SupplierOrderModal.vue'
import { ClipboardList } from 'lucide-vue-next'

const suppliersStore = useSuppliersStore()

const search = ref('')
const modal = ref<{ open: boolean; supplier: Supplier | null }>({ open: false, supplier: null })
const form = ref({
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  notes: ''
})
const formError = ref<string | null>(null)

  const orderModal = ref<{ open: boolean; supplier: Supplier | null }>({
  open: false, supplier: null
})

function openOrderModal(s: Supplier) {
  orderModal.value = { open: true, supplier: s }
}

function closeOrderModal() {
  orderModal.value = { open: false, supplier: null }
}



const saving = ref(false)

onMounted(async () => {
  await suppliersStore.load()
})

const filteredSuppliers = computed(() => {
  const q = search.value.trim().toLowerCase()
  let list = suppliersStore.sorted
  if (q) {
    list = list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.contactPerson?.toLowerCase() ?? '').includes(q) ||
      (s.phone?.toLowerCase() ?? '').includes(q) ||
      (s.email?.toLowerCase() ?? '').includes(q)
    )
  }
  return list
})

function openNew() {
  form.value = { name: '', contactPerson: '', phone: '', email: '', address: '', notes: '' }
  formError.value = null
  modal.value = { open: true, supplier: null }
}

function openEdit(s: Supplier) {
  form.value = {
    name: s.name,
    contactPerson: s.contactPerson ?? '',
    phone: s.phone ?? '',
    email: s.email ?? '',
    address: s.address ?? '',
    notes: s.notes ?? ''
  }
  formError.value = null
  modal.value = { open: true, supplier: s }
}

function closeModal() {
  modal.value = { open: false, supplier: null }
}

async function save() {
  formError.value = null
  if (!form.value.name.trim()) {
    formError.value = 'Emri i furnitorit është i nevojshëm'
    return
  }
  saving.value = true
  try {
    if (modal.value.supplier) {
      await suppliersStore.update(modal.value.supplier.id, {
        name: form.value.name.trim(),
        contactPerson: form.value.contactPerson.trim() || undefined,
        phone: form.value.phone.trim() || undefined,
        email: form.value.email.trim() || undefined,
        address: form.value.address.trim() || undefined,
        notes: form.value.notes.trim() || undefined
      })
    } else {
      await suppliersStore.create({
        name: form.value.name,
        contactPerson: form.value.contactPerson,
        phone: form.value.phone,
        email: form.value.email,
        address: form.value.address,
        notes: form.value.notes
      })
    }
    closeModal()
  } catch (e) {
    formError.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

async function remove(s: Supplier) {
  if (!confirm(`Fshi furnitorin "${s.name}"?`)) return
  try {
    await suppliersStore.remove(s.id)
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
        <h1>Furnitorët</h1>
      </div>
      <button class="k-btn k-btn--primary" @click="openNew">
        <Plus :size="16" />
        Shto furnitor
      </button>
    </header>

    <div class="stat-pill">
      <Truck :size="14" />
      <span>{{ suppliersStore.sorted.length }} furnitorë</span>
    </div>

    <div class="search-box">
      <Search :size="16" />
      <input v-model="search" placeholder="Kërko sipas emrit, personit, telefonit..." />
    </div>

    <!-- Cards grid -->
    <div v-if="filteredSuppliers.length > 0" class="grid">
      <div v-for="s in filteredSuppliers" :key="s.id" class="card">
        <header class="card-head">
          <div class="card-title">
            <div class="avatar">
              <Truck :size="18" />
            </div>
            <div>
              <h3>{{ s.name }}</h3>
              <p v-if="s.contactPerson" class="contact-person">
                <User :size="11" />
                {{ s.contactPerson }}
              </p>
            </div>
          </div>
          <div class="card-actions">
           <button class="row-btn row-btn--primary" @click="openOrderModal(s)" title="Krijo porosi">
              <ClipboardList :size="14" />
            </button>
            <button class="row-btn" @click="openEdit(s)" title="Ndrysho">
              <Pencil :size="14" />
            </button>
            <button class="row-btn row-btn--danger" @click="remove(s)" title="Fshij">
              <Trash2 :size="14" />
            </button>
          </div>
        </header>

        <div class="card-body">
          <div v-if="s.phone" class="info-row">
            <Phone :size="13" />
            <a :href="`tel:${s.phone}`">{{ s.phone }}</a>
          </div>
          <div v-if="s.email" class="info-row">
            <Mail :size="13" />
            <a :href="`mailto:${s.email}`">{{ s.email }}</a>
          </div>
          <div v-if="s.address" class="info-row">
            <MapPin :size="13" />
            <span>{{ s.address }}</span>
          </div>
          <div v-if="!s.phone && !s.email && !s.address" class="info-row dim">
            <span>Asnjë kontakt i regjistruar</span>
          </div>
        </div>

        <footer v-if="s.notes" class="card-foot">
          <p>{{ s.notes }}</p>
        </footer>
      </div>
    </div>

    <div v-else-if="suppliersStore.sorted.length === 0" class="k-empty">
      <Truck :size="32" />
      <p>Ende asnjë furnitor.</p>
      <p class="small">Shtoni furnitorët tuaj për të organizuar dërgesat dhe stokun.</p>
    </div>

    <div v-else class="k-empty">
      <p>Asnjë furnitor për "{{ search }}"</p>
    </div>

    <!-- Modal -->
    <div v-if="modal.open" class="modal-bg" @click.self="closeModal">
      <div class="modal">
        <header class="modal-head">
          <h2>{{ modal.supplier ? 'Ndrysho furnitorin' : 'Furnitor i ri' }}</h2>
          <button class="modal-close" @click="closeModal">
            <X :size="18" />
          </button>
        </header>

        <form class="modal-body" @submit.prevent="save">
          <div class="field">
            <label>Emri i kompanisë *</label>
            <input v-model="form.name" class="k-input" placeholder="psh. Elkos Group" autofocus />
          </div>

          <div class="field">
            <label>Personi kontakt</label>
            <input v-model="form.contactPerson" class="k-input" placeholder="psh. Bekim Krasniqi" />
          </div>

          <div class="field-row">
            <div class="field">
              <label>Telefoni</label>
              <input v-model="form.phone" class="k-input" placeholder="+383 44 123 456" />
            </div>
            <div class="field">
              <label>Email</label>
              <input v-model="form.email" class="k-input" placeholder="info@elkos.com" />
            </div>
          </div>

          <div class="field">
            <label>Adresa</label>
            <input v-model="form.address" class="k-input" placeholder="Rr. ..., Prishtinë" />
          </div>

          <div class="field">
            <label>Shënime</label>
            <textarea v-model="form.notes" class="k-input" rows="3"
              placeholder="Vjen çdo të hënë, mban shishet e zbrazëta, etj." />
          </div>

          <p v-if="formError" class="form-error">{{ formError }}</p>

          <div class="modal-actions">
            <button type="button" class="k-btn k-btn--ghost" @click="closeModal" :disabled="saving">
              Anulo
            </button>
            <button type="submit" class="k-btn k-btn--primary" :disabled="saving">
              {{ modal.supplier ? 'Ruaj ndryshimet' : 'Krijo' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <SupplierOrderModal
  :open="orderModal.open"
  :supplier="orderModal.supplier"
  @close="closeOrderModal"
/>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  padding: 24px 28px;
  gap: 18px;
  overflow-y: auto;
  height: 100%;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-shrink: 0;
}
.page-head .eyebrow { margin-bottom: 4px; }
.page-head h1 { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; }

.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  font-size: 12px;
  color: var(--text-2);
  font-weight: 500;
  align-self: flex-start;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-3);
  max-width: 500px;
}
.search-box:focus-within { border-color: var(--brand); color: var(--text); }
.search-box input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font-size: 14px;
}

/* Grid */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all var(--duration) var(--ease);
  display: flex;
  flex-direction: column;
}

.card:hover {
  border-color: var(--border-strong);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 18px 12px;
  gap: 8px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius);
  background: var(--brand-soft);
  color: var(--brand);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-title h3 {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-person {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-3);
  margin-top: 2px;
}

.card-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity var(--duration) var(--ease);
}

.card:hover .card-actions { opacity: 1; }

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

.row-btn:hover { background: var(--surface-2); color: var(--text); }
.row-btn--danger:hover { background: var(--danger-soft); color: var(--danger); }

.card-body {
  padding: 0 18px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-2);
}

.info-row.dim { color: var(--text-3); font-style: italic; }

.info-row a {
  color: var(--text-2);
  text-decoration: none;
  transition: color var(--duration) var(--ease);
}
.info-row a:hover { color: var(--brand); }

.card-foot {
  padding: 12px 18px;
  background: var(--surface-2);
  border-top: 1px solid var(--border);
  margin-top: auto;
}

.card-foot p {
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.5;
  font-style: italic;
}

/* Empty */
.k-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-3);
  gap: 8px;
  text-align: center;
}
.k-empty p { font-size: 14px; }
.k-empty .small { font-size: 12px; }

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
  animation: fade-in 180ms var(--ease);
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  width: 100%;
  max-width: 520px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  animation: modal-in 240ms var(--ease);
}

@keyframes modal-in {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to { opacity: 1; transform: none; }
}

.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.modal-head h2 { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; }

.modal-close {
  width: 32px; height: 32px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 8px;
  color: var(--text-2);
  transition: background var(--duration) var(--ease);
}
.modal-close:hover { background: var(--surface-2); }

.modal-body {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}

.field { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.field label { font-size: 12px; font-weight: 500; color: var(--text-2); }
.field-row { display: flex; gap: 12px; }

textarea.k-input {
  resize: vertical;
  font-family: inherit;
  min-height: 60px;
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

@media (max-width: 700px) {
  .field-row { flex-direction: column; }
}

.row-btn--primary {
  color: var(--brand);
}
.row-btn--primary:hover {
  background: var(--brand-soft);
  color: var(--brand);
}
</style>