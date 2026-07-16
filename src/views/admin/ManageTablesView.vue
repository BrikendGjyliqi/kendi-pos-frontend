<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Plus, Move, Check } from 'lucide-vue-next'
import { useTablesStore, type Section, type Table, type TableStatus } from '../../stores/tables'
import TableCard from '../../components/tables/TableCard.vue'
import AddTableModal from '../../components/tables/AddTableModal.vue'
import EditTableModal from '../../components/tables/EditTableModal.vue'
import TableActionsModal from '../../components/tables/TableActionsModal.vue'

const tablesStore = useTablesStore()

const activeSection = ref<Section>('MAIN_DINING')
const showAddModal = ref(false)
const showEditModal = ref(false)
const showActionsModal = ref(false)
const selectedTable = ref<Table | null>(null)
const errorMsg = ref<string | null>(null)
const editLayoutMode = ref(false)

const sections: { value: Section; label: string }[] = [
  { value: 'MAIN_DINING', label: 'Main dining' },
  { value: 'TERRACE', label: 'Terrace' },
  { value: 'OUTDOOR', label: 'Outdoor' }
]

onMounted(async () => {
  await tablesStore.reload()
})

const filteredTables = computed(() =>
  tablesStore.sorted.filter(t => t.section === activeSection.value)
)

const existingNames = computed(() =>
  tablesStore.tables.map(t => t.name)
)

const stats = computed(() => tablesStore.stats)

// ─── Add ───
async function handleAddSave(data: { name: string; seatCount: number; section: Section }) {
  errorMsg.value = null
  try {
    await tablesStore.createFull(data)
    showAddModal.value = false
    activeSection.value = data.section
  } catch (e: any) {
    errorMsg.value = e.message || 'Failed to create table'
  }
}

// ─── Actions ───
function handleTableClick(tableId: string) {
  if (editLayoutMode.value) return
  const table = tablesStore.byId(tableId)
  if (!table) return
  selectedTable.value = table
  showActionsModal.value = true
}

function closeActionsModal() {
  showActionsModal.value = false
  selectedTable.value = null
}

// ─── Change status ───
async function handleChangeStatus(status: TableStatus) {
  if (!selectedTable.value) return
  errorMsg.value = null
  try {
    await tablesStore.updateStatus(selectedTable.value.id, status)
    closeActionsModal()
  } catch (e: any) {
    errorMsg.value = e.message || 'Failed to change status'
  }
}

// ─── Edit ───
function openEditModal() {
  showActionsModal.value = false
  showEditModal.value = true
}

async function handleEditSave(data: { name: string; seatCount: number; section: Section }) {
  if (!selectedTable.value) return
  errorMsg.value = null
  try {
    await tablesStore.update(selectedTable.value.id, data)
    showEditModal.value = false
    selectedTable.value = null
    activeSection.value = data.section
  } catch (e: any) {
    errorMsg.value = e.message || 'Failed to update table'
  }
}

function closeEditModal() {
  showEditModal.value = false
  selectedTable.value = null
}

// ─── Delete ───
async function handleDelete() {
  if (!selectedTable.value) return
  const confirmed = confirm(
    `Are you sure you want to delete "${selectedTable.value.name}"? This cannot be undone.`
  )
  if (!confirmed) return

  errorMsg.value = null
  try {
    await tablesStore.remove(selectedTable.value.id)
    closeActionsModal()
  } catch (e: any) {
    errorMsg.value = e.message || 'Failed to delete table'
  }
}

// ─── Drag & Drop ───
async function handlePositionChanged(tableId: string, x: number, y: number) {
  try {
    await tablesStore.updatePosition(tableId, x, y)
  } catch (e: any) {
    errorMsg.value = e.message || 'Failed to save position'
  }
}

// ─── Size ───
async function handleSizeChanged(tableId: string, size: number) {
  try {
    await tablesStore.updateSize(tableId, size)
  } catch (e: any) {
    errorMsg.value = e.message || 'Failed to save size'
  }
}

function toggleEditLayout() {
  editLayoutMode.value = !editLayoutMode.value
}
</script>

<template>
  <div class="manage-tables">
    <header class="head">
      <div class="head-left">
        <h1>Manage tables</h1>
        <p class="subtitle">
          {{ stats.total }} tables ·
          <span class="text-available">{{ stats.available }} available</span> ·
          <span class="text-occupied">{{ stats.onDine }} occupied</span> ·
          <span class="text-reserved">{{ stats.reserved }} reserved</span>
        </p>
      </div>
      <div class="head-actions">
        <button
          class="btn-secondary"
          :class="{ 'btn-active': editLayoutMode }"
          @click="toggleEditLayout"
        >
          <Check v-if="editLayoutMode" :size="16" />
          <Move v-else :size="16" />
          {{ editLayoutMode ? 'Done editing' : 'Edit layout' }}
        </button>
        <button class="add-btn" :disabled="editLayoutMode" @click="showAddModal = true">
          <Plus :size="16" />
          Add table
        </button>
      </div>
    </header>

    <div class="controls">
      <div class="segmented">
        <button
          v-for="s in sections"
          :key="s.value"
          :class="{ active: activeSection === s.value }"
          @click="activeSection = s.value"
        >
          {{ s.label }}
        </button>
      </div>

      <div class="legend">
        <span class="legend-item">
          <span class="dot dot-available"></span> Available
        </span>
        <span class="legend-item">
          <span class="dot dot-occupied"></span> Occupied
        </span>
        <span class="legend-item">
          <span class="dot dot-reserved"></span> Reserved
        </span>
      </div>
    </div>

    <div v-if="editLayoutMode" class="edit-hint">
      <Move :size="14" />
      <span>Drag to reposition. Use +/− on each table to resize. Changes save automatically.</span>
    </div>

    <div v-if="errorMsg" class="error-banner">
      {{ errorMsg }}
      <button @click="errorMsg = null">✕</button>
    </div>

    <section class="floor-plan">
      <div v-if="filteredTables.length > 0" class="canvas" :class="{ 'canvas-edit': editLayoutMode }">
        <TableCard
          v-for="table in filteredTables"
          :key="table.id"
          :table-id="table.id"
          :name="table.name"
          :seat-count="table.seatCount ?? 4"
          :status="table.status ?? 'AVAILABLE'"
          :edit-mode="editLayoutMode"
          :position-x="table.positionX ?? 0"
          :position-y="table.positionY ?? 0"
          :size="table.size ?? 150"
          @click="handleTableClick(table.id)"
          @position-changed="(pos) => handlePositionChanged(table.id, pos.x, pos.y)"
          @size-changed="(size) => handleSizeChanged(table.id, size)"
        />
      </div>

      <div v-else class="empty-state">
        <p>No tables in {{ sections.find(s => s.value === activeSection)?.label }}</p>
        <button class="add-btn-sm" @click="showAddModal = true">
          <Plus :size="14" />
          Add first table
        </button>
      </div>
    </section>

    <AddTableModal
      v-if="showAddModal"
      :existing-names="existingNames"
      @close="showAddModal = false"
      @save="handleAddSave"
    />

    <TableActionsModal
      v-if="showActionsModal && selectedTable"
      :table-name="selectedTable.name"
      :current-status="selectedTable.status ?? 'AVAILABLE'"
      @close="closeActionsModal"
      @change-status="handleChangeStatus"
      @edit="openEditModal"
      @delete="handleDelete"
    />

    <EditTableModal
      v-if="showEditModal && selectedTable"
      :table="selectedTable"
      :existing-names="existingNames"
      @close="closeEditModal"
      @save="handleEditSave"
    />
  </div>
</template>

<style scoped>
.manage-tables {
  background: #16161A;
  min-height: 100vh;
  padding: 24px 28px;
  color: #E8E4D8;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  gap: 16px;
}

.head-left h1 {
  margin: 0 0 6px 0;
  font-size: 24px;
  font-weight: 500;
  letter-spacing: -0.01em;
}

.subtitle {
  margin: 0;
  font-size: 13px;
  color: rgba(232, 228, 216, 0.55);
}

.text-available { color: #9CB89C; }
.text-occupied { color: #E0A07A; }
.text-reserved { color: #B4A5D0; }

.head-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 14px;
  font-size: 13px;
  background: transparent;
  color: #E8E4D8;
  border: 0.5px solid rgba(232, 228, 216, 0.2);
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s ease;
}

.btn-secondary:hover {
  background: rgba(232, 228, 216, 0.05);
}

.btn-secondary.btn-active {
  background: rgba(156, 184, 156, 0.15);
  border-color: #9CB89C;
  color: #9CB89C;
}

.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 14px;
  font-size: 13px;
  background: #9CB89C;
  color: #16161A;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s ease;
}

.add-btn:hover:not(:disabled) {
  background: #B8D0B8;
}

.add-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.segmented {
  display: flex;
  gap: 4px;
  background: rgba(232, 228, 216, 0.05);
  padding: 4px;
  border-radius: 10px;
}

.segmented button {
  padding: 7px 14px;
  background: transparent;
  border: none;
  border-radius: 7px;
  font-size: 13px;
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

.legend {
  display: flex;
  gap: 14px;
  font-size: 12px;
  color: rgba(232, 228, 216, 0.7);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot-available { background: #9CB89C; }
.dot-occupied { background: #E0A07A; }
.dot-reserved { background: #B4A5D0; }

.edit-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(180, 165, 208, 0.08);
  border: 0.5px solid rgba(180, 165, 208, 0.25);
  border-radius: 8px;
  color: #C9BCE0;
  font-size: 12px;
  margin-bottom: 16px;
}

.error-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: rgba(216, 90, 48, 0.1);
  border: 0.5px solid rgba(216, 90, 48, 0.3);
  border-radius: 8px;
  color: #E8B896;
  font-size: 13px;
  margin-bottom: 16px;
}

.error-banner button {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
}

.floor-plan {
  padding-bottom: 24px;
}

.canvas {
  position: relative;
  min-height: 600px;
  border-radius: 12px;
  padding: 20px;
}

.canvas-edit {
  background:
    linear-gradient(rgba(232, 228, 216, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(232, 228, 216, 0.02) 1px, transparent 1px);
  background-size: 20px 20px;
  border: 0.5px dashed rgba(232, 228, 216, 0.1);
}

.canvas :deep(.table-card) {
  position: absolute;
  top: 20px;
  left: 20px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 16px;
  background: rgba(232, 228, 216, 0.02);
  border: 0.5px dashed rgba(232, 228, 216, 0.15);
  border-radius: 14px;
}

.empty-state p {
  margin: 0;
  color: rgba(232, 228, 216, 0.55);
  font-size: 14px;
}

.add-btn-sm {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 12px;
  background: rgba(156, 184, 156, 0.15);
  color: #9CB89C;
  border: 0.5px solid rgba(156, 184, 156, 0.3);
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
}

.add-btn-sm:hover {
  background: rgba(156, 184, 156, 0.25);
}

@media (max-width: 720px) {
  .manage-tables {
    padding: 16px;
  }

  .head-left h1 {
    font-size: 20px;
  }
}
</style>