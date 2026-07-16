import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api/client'

export type Supplier = {
  id: string
  name: string
  contactPerson?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  active: boolean
  createdAt: number
}

export const useSuppliersStore = defineStore('suppliers', () => {
  const suppliers = ref<Supplier[]>([])
  const loaded = ref(false)

  const activeSuppliers = computed(() =>
    suppliers.value.filter(s => s.active)
      .sort((a, b) => a.name.localeCompare(b.name))
  )

  const sorted = computed(() =>
    [...suppliers.value].sort((a, b) => a.name.localeCompare(b.name))
  )

  function byId(id: string): Supplier | undefined {
    return suppliers.value.find(s => s.id === id)
  }

  async function load() {
    if (loaded.value) return
    suppliers.value = await api.get<Supplier[]>('/suppliers')
    loaded.value = true
  }

  async function reload() {
    suppliers.value = await api.get<Supplier[]>('/suppliers')
  }

  async function create(data: {
    name: string
    contactPerson?: string
    phone?: string
    email?: string
    address?: string
    notes?: string
  }): Promise<Supplier> {
    const created = await api.post<Supplier>('/suppliers', {
      name: data.name.trim(),
      contactPerson: data.contactPerson?.trim() || null,
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      address: data.address?.trim() || null,
      notes: data.notes?.trim() || null,
      active: true
    })
    suppliers.value.push(created)
    return created
  }

  async function update(id: string, changes: Partial<Supplier>) {
    const existing = suppliers.value.find(s => s.id === id)
    if (!existing) return
    const payload = { ...existing, ...changes }
    const updated = await api.put<Supplier>(`/suppliers/${id}`, payload)
    const idx = suppliers.value.findIndex(s => s.id === id)
    if (idx >= 0) suppliers.value[idx] = updated
  }

  async function remove(id: string) {
    await api.delete(`/suppliers/${id}`)
    suppliers.value = suppliers.value.filter(s => s.id !== id)
  }

  return {
    suppliers,
    activeSuppliers,
    sorted,
    loaded,
    byId,
    load,
    reload,
    create,
    update,
    remove
  }
})