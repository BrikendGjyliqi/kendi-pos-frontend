<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { Check, X, Phone, Armchair } from 'lucide-vue-next'
import type { Reservation } from '../../stores/reservations'

const props = defineProps<{
  reservations: Reservation[]
}>()

const emit = defineEmits<{
  (e: 'arrived', id: string): void
  (e: 'no-show', id: string): void
}>()

// Live time updates
const now = ref(Date.now())
let interval: number | undefined

onMounted(() => {
  interval = window.setInterval(() => { now.value = Date.now() }, 30_000)
})
onUnmounted(() => {
  if (interval) window.clearInterval(interval)
})

function reservationTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// Status label per rezervim (late / arriving now / in X min)
function statusInfo(iso: string) {
  const diffMin = Math.round((new Date(iso).getTime() - now.value) / 60_000)

  if (diffMin < -5) {
    return { label: `${Math.abs(diffMin)} min late`, level: 'late' }
  }
  if (diffMin < 15) {
    return { label: 'Arriving now', level: 'imminent' }
  }
  if (diffMin < 60) {
    return { label: `in ${diffMin} min`, level: 'normal' }
  }
  const h = Math.floor(diffMin / 60)
  const m = diffMin % 60
  return { label: m === 0 ? `in ${h}h` : `in ${h}h ${m}m`, level: 'normal' }
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}
</script>

<template>
  <div v-if="reservations.length === 0" class="empty">
    <p>No confirmed reservations</p>
  </div>

  <div v-else class="list">
    <div
      v-for="res in reservations"
      :key="res.id"
      class="row"
      :class="`row-${statusInfo(res.reservationTime).level}`"
    >
      <div class="time-col">
        <p class="time">{{ reservationTime(res.reservationTime) }}</p>
        <p class="status-label">{{ statusInfo(res.reservationTime).label }}</p>
      </div>

      <div class="divider"></div>

      <div class="guest">
        <p class="guest-name">{{ res.guestName }}</p>
        <p v-if="res.guestPhone" class="guest-phone">
          <Phone :size="11" /> {{ res.guestPhone }}
        </p>
      </div>

      <div class="table-badge">
        <Armchair :size="13" />
        <span>{{ res.tableName }} · {{ res.guestCount }} seats</span>
      </div>

      <div class="actions">
        <button class="btn btn-arrived" @click="emit('arrived', res.id)">
          <Check :size="13" />
          Arrived
        </button>
        <button
          class="btn btn-noshow"
          :class="{ 'btn-noshow-active': statusInfo(res.reservationTime).level === 'late' }"
          @click="emit('no-show', res.id)"
        >
          <X :size="13" />
          No-show
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.empty {
  padding: 40px 20px;
  text-align: center;
  background: rgba(232, 228, 216, 0.02);
  border: 0.5px dashed rgba(232, 228, 216, 0.15);
  border-radius: 12px;
}

.empty p {
  margin: 0;
  font-size: 13px;
  color: rgba(232, 228, 216, 0.5);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  background: rgba(232, 228, 216, 0.02);
  border: 0.5px solid rgba(232, 228, 216, 0.08);
  border-radius: 10px;
}

.row-late {
  background: rgba(216, 90, 48, 0.06);
  border-color: rgba(216, 90, 48, 0.2);
}

.row-imminent {
  background: rgba(224, 160, 122, 0.06);
  border-color: rgba(224, 160, 122, 0.2);
}

.time-col {
  min-width: 70px;
  text-align: center;
}

.time {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
  color: #E8E4D8;
}

.status-label {
  margin: 2px 0 0 0;
  font-size: 10px;
  font-weight: 500;
  color: rgba(232, 228, 216, 0.5);
}

.row-late .status-label {
  color: #E8B896;
}

.row-imminent .status-label {
  color: #E0A07A;
}

.divider {
  width: 1px;
  height: 40px;
  background: rgba(232, 228, 216, 0.1);
}

.guest {
  flex: 1;
  min-width: 0;
}

.guest-name {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #E8E4D8;
}

.guest-phone {
  margin: 2px 0 0 0;
  font-size: 12px;
  color: rgba(232, 228, 216, 0.5);
  display: flex;
  align-items: center;
  gap: 4px;
}

.guest-phone svg {
  vertical-align: -1px;
}

.table-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(180, 165, 208, 0.15);
  border-radius: 6px;
  color: #C9BCE0;
  font-size: 12px;
  font-weight: 500;
  flex-shrink: 0;
}

.actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  font-size: 12px;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  border: 0.5px solid transparent;
  font-weight: 500;
  transition: all 0.15s ease;
}

.btn-arrived {
  background: #9CB89C;
  color: #16161A;
  border: none;
}

.btn-arrived:hover {
  background: #B8D0B8;
}

.btn-noshow {
  background: transparent;
  border-color: rgba(232, 228, 216, 0.2);
  color: rgba(232, 228, 216, 0.7);
}

.btn-noshow:hover {
  border-color: rgba(216, 90, 48, 0.4);
  color: #E8B896;
}

.btn-noshow-active {
  border-color: rgba(216, 90, 48, 0.4);
  color: #E8B896;
}

@media (max-width: 900px) {
  .row {
    flex-wrap: wrap;
  }
}
</style>