<script setup lang="ts">
import { X, Edit3, Trash2, Circle, CheckCircle2, Clock } from 'lucide-vue-next'
import type { TableStatus } from '../../stores/tables'

const props = defineProps<{
  tableName: string
  currentStatus: TableStatus
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'change-status', status: TableStatus): void
  (e: 'edit'): void
  (e: 'delete'): void
}>()

const statusOptions: { value: TableStatus; label: string; color: string }[] = [
  { value: 'AVAILABLE', label: 'Available', color: '#9CB89C' },
  { value: 'ON_DINE', label: 'On dine', color: '#E0A07A' },
  { value: 'RESERVED', label: 'Reserved', color: '#B4A5D0' }
]

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
          <h2>{{ tableName }}</h2>
          <p class="subtitle">Choose an action</p>
        </div>
        <button class="close-btn" @click="emit('close')" aria-label="Close">
          <X :size="18" />
        </button>
      </div>

      <div class="section">
        <p class="section-label">Change status</p>
        <div class="status-options">
          <button
            v-for="opt in statusOptions"
            :key="opt.value"
            class="status-btn"
            :class="{ active: currentStatus === opt.value }"
            :style="{ '--status-color': opt.color }"
            @click="emit('change-status', opt.value)"
          >
            <CheckCircle2 v-if="currentStatus === opt.value" :size="16" />
            <Circle v-else :size="16" />
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="section">
        <p class="section-label">Actions</p>
        <button class="action-btn" @click="emit('edit')">
          <Edit3 :size="16" />
          Edit table
          <span class="action-hint">Rename, change seats or section</span>
        </button>
        <button class="action-btn action-danger" @click="emit('delete')">
          <Trash2 :size="16" />
          Delete table
          <span class="action-hint">This action cannot be undone</span>
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
  max-width: 420px;
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

.section {
  margin-bottom: 20px;
}

.section:last-child {
  margin-bottom: 0;
}

.section-label {
  margin: 0 0 8px 0;
  font-size: 11px;
  color: rgba(232, 228, 216, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 500;
}

.status-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.status-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(232, 228, 216, 0.03);
  border: 0.5px solid rgba(232, 228, 216, 0.1);
  border-radius: 8px;
  color: rgba(232, 228, 216, 0.7);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s ease;
  text-align: left;
}

.status-btn:hover {
  background: rgba(232, 228, 216, 0.06);
  border-color: rgba(232, 228, 216, 0.2);
  color: #E8E4D8;
}

.status-btn.active {
  background: color-mix(in srgb, var(--status-color) 15%, transparent);
  border-color: var(--status-color);
  color: var(--status-color);
  font-weight: 500;
}

.action-btn {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  gap: 2px 10px;
  padding: 12px 14px;
  background: rgba(232, 228, 216, 0.03);
  border: 0.5px solid rgba(232, 228, 216, 0.1);
  border-radius: 8px;
  color: #E8E4D8;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s ease;
  text-align: left;
  width: 100%;
  margin-bottom: 6px;
  font-weight: 500;
}

.action-btn:last-child {
  margin-bottom: 0;
}

.action-btn svg {
  grid-row: 1 / 3;
  align-self: center;
}

.action-btn:hover {
  background: rgba(232, 228, 216, 0.06);
  border-color: rgba(232, 228, 216, 0.2);
}

.action-hint {
  grid-column: 2;
  font-size: 11px;
  color: rgba(232, 228, 216, 0.5);
  font-weight: 400;
}

.action-danger {
  color: #E8B896;
}

.action-danger:hover {
  background: rgba(216, 90, 48, 0.1);
  border-color: rgba(216, 90, 48, 0.3);
  color: #E8B896;
}
</style>