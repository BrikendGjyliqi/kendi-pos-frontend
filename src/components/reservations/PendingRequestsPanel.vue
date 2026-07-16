<script setup lang="ts">
import { Bell, Check, X, User } from 'lucide-vue-next'
import type { Reservation } from '../../stores/reservations'

const props = defineProps<{
  requests: Reservation[]
}>()

const emit = defineEmits<{
  (e: 'confirm', id: string): void
  (e: 'decline', id: string): void
}>()

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
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
  <div class="panel">
    <div class="panel-head">
      <div class="head-title">
        <Bell :size="16" class="head-icon" />
        <span>Reservation requests</span>
        <span v-if="requests.length > 0" class="badge">
          {{ requests.length }} pending
        </span>
      </div>
      <span class="head-sub">from waiters</span>
    </div>

    <div v-if="requests.length === 0" class="empty">
      <p>No pending requests</p>
    </div>

    <div v-else class="list">
      <div v-for="req in requests" :key="req.id" class="row">
        <div class="avatar">{{ initials(req.guestName) }}</div>

        <div class="info">
          <p class="line-1">
            <strong>{{ req.guestName }}</strong> · {{ req.tableName }} · {{ req.guestCount }} seats
          </p>
          <p class="line-2">
            <span v-if="req.requestedBy">
              <User :size="11" /> Requested by {{ req.requestedBy }} ·
            </span>
            {{ formatTime(req.reservationTime) }}
          </p>
        </div>

        <div class="actions">
          <button class="btn btn-confirm" @click="emit('confirm', req.id)">
            <Check :size="13" />
            Confirm
          </button>
          <button class="btn btn-decline" @click="emit('decline', req.id)">
            <X :size="13" />
            Decline
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  background: rgba(232, 228, 216, 0.03);
  border: 0.5px solid rgba(232, 228, 216, 0.08);
  border-radius: 12px;
  padding: 14px;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.head-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #E8E4D8;
}

.head-icon {
  color: #B4A5D0;
}

.badge {
  background: rgba(216, 90, 48, 0.15);
  color: #E8B896;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.head-sub {
  font-size: 11px;
  color: rgba(232, 228, 216, 0.4);
}

.empty {
  padding: 24px;
  text-align: center;
}

.empty p {
  margin: 0;
  font-size: 13px;
  color: rgba(232, 228, 216, 0.4);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: #16161A;
  border: 0.5px solid rgba(232, 228, 216, 0.06);
  border-radius: 8px;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(180, 165, 208, 0.2);
  color: #C9BCE0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 500;
  flex-shrink: 0;
}

.info {
  flex: 1;
  min-width: 0;
}

.line-1 {
  margin: 0;
  font-size: 13px;
  color: #E8E4D8;
}

.line-1 strong {
  font-weight: 500;
}

.line-2 {
  margin: 2px 0 0 0;
  font-size: 11px;
  color: rgba(232, 228, 216, 0.5);
  display: flex;
  align-items: center;
  gap: 4px;
}

.line-2 svg {
  vertical-align: -1px;
}

.actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  font-size: 12px;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  border: 0.5px solid transparent;
  transition: all 0.15s ease;
}

.btn-confirm {
  background: #9CB89C;
  color: #16161A;
  font-weight: 500;
  border: none;
}

.btn-confirm:hover {
  background: #B8D0B8;
}

.btn-decline {
  background: transparent;
  border-color: rgba(232, 228, 216, 0.2);
  color: rgba(232, 228, 216, 0.7);
}

.btn-decline:hover {
  border-color: rgba(216, 90, 48, 0.4);
  color: #E8B896;
}
</style>