import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api/client'

export type SupplierOrderItem = {
  id?: string
  productId: string
  productName: string
  quantity: number
  stockUnit?: string
  note?: string
}

export type SupplierOrder = {
  id: string
  supplierId: string
  supplierName: string
  status: string
  orderRef: string
  notes?: string
  staffId?: string
  createdAt: number
  sentAt?: number
  items: SupplierOrderItem[]
}

export const useSupplierOrdersStore = defineStore('supplierOrders', () => {
  const orders = ref<SupplierOrder[]>([])
  const loaded = ref(false)

  async function load() {
    if (loaded.value) return
    orders.value = await api.get<SupplierOrder[]>('/supplier-orders')
    loaded.value = true
  }

  async function reload() {
    orders.value = await api.get<SupplierOrder[]>('/supplier-orders')
  }

  async function loadForSupplier(supplierId: string): Promise<SupplierOrder[]> {
    return await api.get<SupplierOrder[]>(`/supplier-orders?supplierId=${supplierId}`)
  }

  async function create(data: {
    supplierId: string
    notes?: string
    staffId?: string
    items: Array<{
      productId: string
      quantity: number
      note?: string
    }>
  }): Promise<SupplierOrder> {
    const created = await api.post<SupplierOrder>('/supplier-orders', data)
    orders.value.unshift(created)
    return created
  }

  async function remove(id: string) {
    await api.delete(`/supplier-orders/${id}`)
    orders.value = orders.value.filter(o => o.id !== id)
  }

  function pdfUrl(orderId: string): string {
    const baseUrl = (api as any).baseUrl || 'http://localhost:8080/api'
    return `${baseUrl}/supplier-orders/${orderId}/pdf`
  }

  return {
    orders,
    loaded,
    load,
    reload,
    loadForSupplier,
    create,
    remove,
    pdfUrl
  }
})