<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import interact from 'interactjs'
import type { TableStatus } from '../../stores/tables'

const props = defineProps<{
  name: string
  seatCount: number
  status: TableStatus
  guestName?: string
  reservationTime?: string
  minutesActive?: number
  editMode?: boolean
  positionX?: number
  positionY?: number
  tableId?: string
  size?: number
}>()

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'position-changed', data: { x: number; y: number }): void
  (e: 'size-changed', size: number): void
}>()

const cardRef = ref<HTMLElement | null>(null)
const currentX = ref(props.positionX ?? 0)
const currentY = ref(props.positionY ?? 0)

const currentSize = ref(props.size ?? 150)
const minSize = 100
const maxSize = 250

// Sinkronizo kur ndryshojne props nga jashte
watch(() => props.positionX, (v) => { if (v !== undefined) currentX.value = v })
watch(() => props.positionY, (v) => { if (v !== undefined) currentY.value = v })
watch(() => props.size, (v) => { if (v !== undefined) currentSize.value = v })

// Setup / teardown interactjs kur ndryshon editMode
watch(() => props.editMode, (isEdit) => {
  if (!cardRef.value) return
  if (isEdit) {
    setupDraggable()
  } else {
    interact(cardRef.value).unset()
  }
})

onMounted(() => {
  if (props.editMode && cardRef.value) {
    setupDraggable()
  }
})

onUnmounted(() => {
  if (cardRef.value) {
    try { interact(cardRef.value).unset() } catch { /* ignore */ }
  }
})

function decreaseSize() {
  if (currentSize.value > minSize) {
    currentSize.value -= 10
    emit('size-changed', currentSize.value)
  }
}

function increaseSize() {
  if (currentSize.value < maxSize) {
    currentSize.value += 10
    emit('size-changed', currentSize.value)
  }
}

function setupDraggable() {
  if (!cardRef.value) return

  interact(cardRef.value).draggable({
    inertia: false,
    autoScroll: true,
    listeners: {
      move(event) {
        currentX.value = currentX.value + event.dx
        currentY.value = currentY.value + event.dy
      },
      end() {
        emit('position-changed', {
          x: Math.round(currentX.value),
          y: Math.round(currentY.value)
        })
      }
    }
  })
}

// Ngjyrat sipas statusit
const colors = computed(() => {
  switch (props.status) {
    case 'AVAILABLE':
      return {
        bg: 'rgba(156, 184, 156, 0.08)',
        border: 'rgba(156, 184, 156, 0.25)',
        chair: '#9CB89C',
        table: '#9CB89C',
        text: '#E8E4D8',
        accent: '#B8D0B8',
        badge: 'rgba(156, 184, 156, 0.2)',
        label: 'AVAILABLE'
      }
    case 'ON_DINE':
      return {
        bg: 'rgba(224, 160, 122, 0.08)',
        border: 'rgba(224, 160, 122, 0.25)',
        chair: '#E0A07A',
        table: '#E0A07A',
        text: '#E8E4D8',
        accent: '#E8B896',
        badge: 'rgba(224, 160, 122, 0.22)',
        label: 'ON DINE'
      }
    case 'RESERVED':
      return {
        bg: 'rgba(180, 165, 208, 0.08)',
        border: 'rgba(180, 165, 208, 0.25)',
        chair: '#B4A5D0',
        table: '#B4A5D0',
        text: '#E8E4D8',
        accent: '#C9BCE0',
        badge: 'rgba(180, 165, 208, 0.22)',
        label: 'RESERVED'
      }
  }
})

type ChairPos = {
  side: 'top' | 'bottom' | 'left' | 'right'
  offset: number
}

const chairPositions = computed<ChairPos[]>(() => {
  const n = props.seatCount
  const layouts: Record<number, ChairPos[]> = {
    2: [
      { side: 'top', offset: 83 },
      { side: 'bottom', offset: 83 }
    ],
    4: [
      { side: 'top', offset: 48 }, { side: 'top', offset: 118 },
      { side: 'bottom', offset: 48 }, { side: 'bottom', offset: 118 }
    ],
    6: [
      { side: 'top', offset: 37 }, { side: 'top', offset: 83 }, { side: 'top', offset: 129 },
      { side: 'bottom', offset: 37 }, { side: 'bottom', offset: 83 }, { side: 'bottom', offset: 129 }
    ],
    8: [
      { side: 'top', offset: 37 }, { side: 'top', offset: 83 }, { side: 'top', offset: 129 },
      { side: 'bottom', offset: 37 }, { side: 'bottom', offset: 83 }, { side: 'bottom', offset: 129 },
      { side: 'left', offset: 55 }, { side: 'right', offset: 55 }
    ],
    10: [
      { side: 'top', offset: 27 }, { side: 'top', offset: 65 }, { side: 'top', offset: 103 }, { side: 'top', offset: 141 },
      { side: 'bottom', offset: 27 }, { side: 'bottom', offset: 65 }, { side: 'bottom', offset: 103 }, { side: 'bottom', offset: 141 },
      { side: 'left', offset: 55 }, { side: 'right', offset: 55 }
    ]
  }
  return layouts[n] || layouts[4]
})

const badgeLabel = computed(() => {
  if (props.status === 'RESERVED' && props.reservationTime) {
    return `R · ${props.reservationTime}`
  }
  return colors.value.label
})

const infoLine = computed(() => {
  if (props.status === 'ON_DINE' && props.minutesActive !== undefined) {
    return `${props.seatCount} seats · ${props.minutesActive} min`
  }
  return `${props.seatCount} seats`
})


const cardStyle = computed(() => {
  const base: any = {
    background: colors.value.bg,
    borderColor: colors.value.border,
    width: currentSize.value + 'px'
  }

  if (props.editMode) {
    base.transform = `translate(${currentX.value}px, ${currentY.value}px)`
    base.touchAction = 'none' as const
  } else if (props.positionX || props.positionY) {
    base.transform = `translate(${props.positionX ?? 0}px, ${props.positionY ?? 0}px)`
  }

  return base
})

function handleClick() {
  // Ne edit mode, mos e emitto click (do te konfliktoje me drag)
  if (props.editMode) return
  emit('click')
}
</script>

<template>
  <button
    ref="cardRef"
    class="table-card"
    :class="{ 'edit-mode': editMode }"
    :style="cardStyle"
    @click="handleClick"
  >
    <span
      class="status-badge"
      :style="{ background: colors.badge, color: colors.accent }"
    >
      {{ badgeLabel }}
    </span>

    <div v-if="editMode" class="drag-hint">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
        <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
      </svg>
    </div>

  <div v-if="editMode" class="size-controls">
      <button class="size-btn" :disabled="currentSize <= minSize" @click.stop="decreaseSize" @mousedown.stop
        title="Smaller">−</button>
      <button class="size-btn" :disabled="currentSize >= maxSize" @click.stop="increaseSize" @mousedown.stop
        title="Larger">+</button>
    </div>

    <svg viewBox="0 0 180 130" class="table-svg">
      <template v-for="(chair, i) in chairPositions" :key="i">
        <template v-if="chair.side === 'top'">
          <rect :x="chair.offset" y="0" width="14" height="3" rx="1.5" :fill="colors.chair"/>
          <rect :x="chair.offset - 3" y="4" width="20" height="10" rx="2.5" :fill="colors.chair" opacity="0.55"/>
        </template>
        <template v-if="chair.side === 'bottom'">
          <rect :x="chair.offset - 3" y="116" width="20" height="10" rx="2.5" :fill="colors.chair" opacity="0.55"/>
          <rect :x="chair.offset" y="127" width="14" height="3" rx="1.5" :fill="colors.chair"/>
        </template>
        <template v-if="chair.side === 'left'">
          <rect x="0" :y="chair.offset" width="3" height="14" rx="1.5" :fill="colors.chair"/>
          <rect x="4" :y="chair.offset - 3" width="10" height="20" rx="2.5" :fill="colors.chair" opacity="0.55"/>
        </template>
        <template v-if="chair.side === 'right'">
          <rect x="166" :y="chair.offset - 3" width="10" height="20" rx="2.5" :fill="colors.chair" opacity="0.55"/>
          <rect x="177" :y="chair.offset" width="3" height="14" rx="1.5" :fill="colors.chair"/>
        </template>
      </template>

      <rect x="20" y="20" width="140" height="90" rx="10"
        :fill="colors.table" opacity="0.18"
        :stroke="colors.table" stroke-width="0.6"/>

      <text x="90" :y="guestName ? 54 : 60" text-anchor="middle"
        font-size="15" font-weight="500" :fill="colors.text">
        {{ name }}
      </text>
      <text x="90" :y="guestName ? 72 : 80" text-anchor="middle"
        font-size="11" :fill="colors.chair">
        {{ infoLine }}
      </text>
      <text v-if="guestName" x="90" y="92" text-anchor="middle"
        font-size="10" :fill="colors.accent" font-weight="500">
        {{ guestName }}
      </text>
    </svg>
  </button>
</template>

<style scoped>
.table-card {
  position: relative;
  border-radius: 12px;
  padding: 10px;
  border: 0.5px solid;
  cursor: pointer;
  font-family: inherit;
  transition: box-shadow 0.15s ease, width 0.15s ease;
  text-align: left;
}

.table-card:not(.edit-mode):hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.table-card.edit-mode {
  cursor: grab;
  user-select: none;
  z-index: 2;
}

.table-card.edit-mode:active {
  cursor: grabbing;
  z-index: 10;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
}


.size-controls {
  position: absolute;
  top: 6px;
  right: 60px;
  display: flex;
  gap: 3px;
  z-index: 2;
}

.size-controls .size-btn {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: rgba(232, 228, 216, 0.1);
  border: 0.5px solid rgba(232, 228, 216, 0.2);
  color: #E8E4D8;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  padding: 0;
  transition: all 0.15s ease;
}

.size-controls .size-btn:hover:not(:disabled) {
  background: rgba(232, 228, 216, 0.2);
}

.size-controls .size-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.status-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 8px;
  padding: 2px 6px;
  border-radius: 8px;
  font-weight: 500;
  letter-spacing: 0.3px;
  z-index: 1;
}

.drag-hint {
  position: absolute;
  top: 6px;
  left: 6px;
  color: rgba(232, 228, 216, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.table-svg {
  width: 100%;
  height: auto;
  margin-top: 10px;
  display: block;
  pointer-events: none;
}
</style>