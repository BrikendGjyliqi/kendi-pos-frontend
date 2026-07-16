<script setup lang="ts">
import { ref, computed } from 'vue'
import { X } from 'lucide-vue-next'
import type { Section, Table } from '../../stores/tables'
import TableCard from './TableCard.vue'

const props = defineProps<{
  table: Table
  existingNames: string[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', data: { name: string; seatCount: number; section: Section }): void
}>()

const name = ref(props.table.name)
const seatCount = ref<number>(props.table.seatCount ?? 4)
const section = ref<Section>(props.table.section ?? 'MAIN_DINING')
const saving = ref(false)
const error = ref<string | null>(null)

const seatOptions = [2, 4, 6, 8, 10]
const sectionOptions: { value: Section; label: string }[] = [
  { value: 'MAIN_DINING', label: 'Main dining' },
  { value: 'TERRACE', label: 'Terrace' },
  { value: 'OUTDOOR', label: 'Outdoor' }
]

const nameValid = computed(() => {
  const trimmed = name.value.trim()
  if (!trimmed) return false
  if (trimmed.length > 50) return false
  // Lejo emrin aktual, po jo emra te tjere qe ekzistojne
  if (trimmed !== props.table.name && props.existingNames.includes(trimmed)) return false
  return true
})

const previewName = computed(() => name.value.trim() || 'Table name')

async function handleSave() {
  error.value = null

  const trimmed = name.value.trim()
  if (!trimmed) {
    error.value = 'Name is required'
    return
  }
  if (trimmed.length > 50) {
    error.value = 'Name must be under 50 characters'
    return
  }
  if (trimmed !== props.table.name && props.existingNames.includes(trimmed)) {
    error.value = 'Table name already exists'
    return
  }

  saving.value = true
  try {
    emit('save', {
      name: trimmed,
      seatCount: seatCount.value,
      section: section.value
    })
  } finally {
    saving.value = false
  }
}

function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    emit('close')
  }
}
</script>

<template>
  <div class="modal-backdrop" @click="handleBackdropClick">
    <div class="modal">
      <div class="modal-head">
        <div>
          <h2>Edit table</h2>
          <p class="subtitle">Update table details</p>
        </div>
        <button class="close-btn" @click="emit('close')" aria-label="Close">
          <X :size="18" />
        </button>
      </div>

      <div class="modal-body">
        <div class="form-column">
          <div class="field">
            <label>Table name</label>
            <input
              v-model="name"
              type="text"
              placeholder="e.g. Table #7"
              maxlength="50"
              @keydown.enter="handleSave"
            />
          </div>

          <div class="field">
            <label>Section</label>
            <div class="segmented">
              <button
                v-for="opt in sectionOptions"
                :key="opt.value"
                :class="{ active: section === opt.value }"
                @click="section = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <div class="field">
            <label>Number of seats</label>
            <div class="seat-picker">
              <button
                v-for="n in seatOptions"
                :key="n"
                :class="{ active: seatCount === n }"
                @click="seatCount = n"
              >
                {{ n }}
              </button>
            </div>
          </div>

          <div v-if="error" class="error-msg">{{ error }}</div>
        </div>

        <div class="preview-column">
          <label class="preview-label">Preview</label>
          <TableCard
            :name="previewName"
            :seat-count="seatCount"
            :status="table.status ?? 'AVAILABLE'"
          />
          <p class="preview-note">
            {{ sectionOptions.find(s => s.value === section)?.label }}
          </p>
        </div>
      </div>

      <div class="modal-foot">
        <button class="btn-secondary" @click="emit('close')">Cancel</button>
        <button
          class="btn-primary"
          :disabled="!nameValid || saving"
          @click="handleSave"
        >
          {{ saving ? 'Saving...' : 'Save changes' }}
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
  max-width: 620px;
  color: #E8E4D8;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
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
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background 0.15s ease;
}

.close-btn:hover {
  background: rgba(232, 228, 216, 0.05);
  color: #E8E4D8;
}

.modal-body {
  display: grid;
  grid-template-columns: 1fr 200px;
  gap: 20px;
  margin-bottom: 24px;
}

.form-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field label {
  display: block;
  font-size: 12px;
  color: rgba(232, 228, 216, 0.7);
  margin-bottom: 6px;
}

.field input {
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

.field input:focus {
  outline: none;
  border-color: #9CB89C;
}

.segmented {
  display: flex;
  gap: 4px;
  background: rgba(232, 228, 216, 0.05);
  padding: 4px;
  border-radius: 10px;
}

.segmented button {
  flex: 1;
  padding: 8px;
  background: transparent;
  border: none;
  border-radius: 7px;
  font-size: 12px;
  color: rgba(232, 228, 216, 0.6);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s ease;
}

.segmented button.active {
  background: #9CB89C;
  color: #16161A;
  font-weight: 500;
}

.segmented button:not(.active):hover {
  color: #E8E4D8;
}

.seat-picker {
  display: flex;
  gap: 8px;
}

.seat-picker button {
  flex: 1;
  padding: 12px 0;
  background: transparent;
  border: 0.5px solid rgba(232, 228, 216, 0.15);
  border-radius: 8px;
  font-size: 14px;
  color: #E8E4D8;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s ease;
}

.seat-picker button:hover {
  border-color: rgba(232, 228, 216, 0.3);
}

.seat-picker button.active {
  background: rgba(156, 184, 156, 0.15);
  border-color: #9CB89C;
  color: #9CB89C;
  font-weight: 500;
}

.error-msg {
  padding: 10px 12px;
  background: rgba(216, 90, 48, 0.1);
  border: 0.5px solid rgba(216, 90, 48, 0.3);
  border-radius: 8px;
  color: #E8B896;
  font-size: 12px;
}

.preview-column {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-label {
  font-size: 12px;
  color: rgba(232, 228, 216, 0.7);
}

.preview-note {
  margin: 0;
  font-size: 10px;
  color: rgba(232, 228, 216, 0.5);
  text-align: center;
  font-style: italic;
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

@media (max-width: 640px) {
  .modal-body {
    grid-template-columns: 1fr;
  }
}
</style>