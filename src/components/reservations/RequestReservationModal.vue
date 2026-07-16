<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { X } from 'lucide-vue-next'
import { useTablesStore } from '../../stores/tables'

const props = defineProps<{
  requestedBy?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', data: {
    tableId: string
    guestName: string
    guestPhone: string
    guestCount: number
    reservationTime: string
  }): void
}>()

const tablesStore = useTablesStore()

const guestName = ref('')
const guestPhone = ref('')
const guestCount = ref<number>(2)
const tableId = ref<string>('')
const dateValue = ref('')
const timeValue = ref('')
const saving = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  if (!tablesStore.loaded) await tablesStore.load()

  // Default: sot ne 20:00
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  dateValue.value = `${yyyy}-${mm}-${dd}`
  timeValue.value = '20:00'

  // Zgjidh tavolinen e pare AVAILABLE si default
  const firstAvailable = tablesStore.tables.find(t => t.status === 'AVAILABLE')
  if (firstAvailable) tableId.value = firstAvailable.id
})

const availableTables = computed(() =>
  tablesStore.sorted.filter(t => t.status === 'AVAILABLE')
)

const isValid = computed(() => {
  return guestName.value.trim().length > 0
    && tableId.value !== ''
    && guestCount.value >= 1
    && dateValue.value !== ''
    && timeValue.value !== ''
})

async function handleSubmit() {
  error.value = null

  if (!isValid.value) {
    error.value = 'Please fill all required fields'
    return
  }

  const reservationTime = `${dateValue.value}T${timeValue.value}:00`

  saving.value = true
  try {
    emit('submit', {
      tableId: tableId.value,
      guestName: guestName.value.trim(),
      guestPhone: guestPhone.value.trim(),
      guestCount: guestCount.value,
      reservationTime
    })
  } finally {
    saving.value = false
  }
}

function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <div class="modal-backdrop" @click="handleBackdropClick">
    <div class="modal">
      <div class="modal-head">
        <div>
          <h2>Request reservation</h2>
          <p class="subtitle">Send to admin for approval</p>
        </div>
        <button class="close-btn" @click="emit('close')" aria-label="Close">
          <X :size="18" />
        </button>
      </div>

      <div class="form">
        <div class="field">
          <label>Guest name</label>
          <input
            v-model="guestName"
            type="text"
            placeholder="e.g. Blerta Krasniqi"
            maxlength="100"
          />
        </div>

        <div class="field">
          <label>Phone (optional)</label>
          <input
            v-model="guestPhone"
            type="text"
            placeholder="+383 44 123 456"
            maxlength="30"
          />
        </div>

        <div class="row-2">
          <div class="field">
            <label>Guests</label>
            <input
              v-model.number="guestCount"
              type="number"
              min="1"
              max="20"
            />
          </div>

          <div class="field">
            <label>Table</label>
            <select v-model="tableId">
              <option value="" disabled>Select a table</option>
              <option
                v-for="table in availableTables"
                :key="table.id"
                :value="table.id"
              >
                {{ table.name }} ({{ table.seatCount }} seats)
              </option>
            </select>
          </div>
        </div>

        <div class="row-2">
          <div class="field">
            <label>Date</label>
            <input v-model="dateValue" type="date" />
          </div>

          <div class="field">
            <label>Time</label>
            <input v-model="timeValue" type="time" />
          </div>
        </div>

        <div v-if="error" class="error-msg">{{ error }}</div>
      </div>

      <div class="modal-foot">
        <button class="btn-secondary" @click="emit('close')">Cancel</button>
        <button
          class="btn-primary"
          :disabled="!isValid || saving"
          @click="handleSubmit"
        >
          {{ saving ? 'Sending...' : 'Send request' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 24px;
  backdrop-filter: blur(2px);
}

.modal {
  background: #16161A;
  border: 0.5px solid rgba(232, 228, 216, 0.08);
  border-radius: 16px;
  padding: 24px;
  width: 100%;
  max-width: 500px;
  color: #E8E4D8;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.modal-head h2 {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 500;
}

.subtitle {
  margin: 0;
  font-size: 12px;
  color: rgba(232, 228, 216, 0.55);
}

.close-btn {
  background: transparent;
  border: none;
  color: rgba(232, 228, 216, 0.6);
  padding: 4px;
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
}

.close-btn:hover {
  background: rgba(232, 228, 216, 0.05);
  color: #E8E4D8;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 20px;
}

.row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.field label {
  display: block;
  font-size: 12px;
  color: rgba(232, 228, 216, 0.7);
  margin-bottom: 6px;
}

.field input, .field select {
  width: 100%;
  background: rgba(232, 228, 216, 0.05);
  border: 0.5px solid rgba(232, 228, 216, 0.15);
  border-radius: 8px;
  padding: 10px 12px;
  color: #E8E4D8;
  font-size: 13px;
  font-family: inherit;
  box-sizing: border-box;
  transition: border-color 0.15s ease;
}

.field input:focus, .field select:focus {
  outline: none;
  border-color: #9CB89C;
}

.field input::placeholder {
  color: rgba(232, 228, 216, 0.35);
}

.field select {
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23E8E4D8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 14px;
  padding-right: 36px;
}

.field select option {
  background: #16161A;
  color: #E8E4D8;
}

.error-msg {
  padding: 10px 12px;
  background: rgba(216, 90, 48, 0.1);
  border: 0.5px solid rgba(216, 90, 48, 0.3);
  border-radius: 8px;
  color: #E8B896;
  font-size: 12px;
}

.modal-foot {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 0.5px solid rgba(232, 228, 216, 0.08);
}

.btn-secondary, .btn-primary {
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s ease;
}

.btn-secondary {
  background: transparent;
  border: 0.5px solid rgba(232, 228, 216, 0.2);
  color: #E8E4D8;
}

.btn-secondary:hover {
  background: rgba(232, 228, 216, 0.05);
}

.btn-primary {
  background: #9CB89C;
  color: #16161A;
  border: none;
  font-weight: 500;
}

.btn-primary:hover:not(:disabled) {
  background: #B8D0B8;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>