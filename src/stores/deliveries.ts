import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api/client'
import { useProductsStore } from './products'

export type DeliveryItem = {
  id?: string
  productId: string
  productName: string
  quantity: number
  unitPriceCents: number
  lineTotalCents: number
}

export type Delivery = {
  id: string
  supplierId: string
  supplierName: string
  deliveryDate: number
  status: string
  totalCents: number
  documentRef?: string
  notes?: string
  staffId?: string
  createdAt: number
  invoiceFileName?: string
  invoiceContentType?: string
  items: DeliveryItem[]
}

export const useDeliveriesStore = defineStore('deliveries', () => {
  const deliveries = ref<Delivery[]>([])
  const loaded = ref(false)

  async function load() {
    if (loaded.value) return
    deliveries.value = await api.get<Delivery[]>('/deliveries')
    loaded.value = true
  }

  async function reload() {
    deliveries.value = await api.get<Delivery[]>('/deliveries')
  }

  async function create(data: {
    supplierId: string
    deliveryDate: number
    documentRef?: string
    notes?: string
    staffId?: string
    items: Array<{
      productId: string
      quantity: number
      unitPriceCents: number
    }>
    // Opsional: file per ruajtje pas AI scan
    fileBase64?: string
    fileName?: string
    contentType?: string
  }): Promise<Delivery> {
    const payload = {
      supplierId: data.supplierId,
      deliveryDate: data.deliveryDate,
      documentRef: data.documentRef,
      notes: data.notes,
      staffId: data.staffId,
      items: data.items.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPriceCents: Math.max(0, Math.round(i.unitPriceCents))
      }))
    }
    const created = await api.post<Delivery>('/deliveries', payload)

    // Nese kishte file (nga AI scan), attach-oje
    if (data.fileBase64 && data.fileName) {
      try {
        const withFile = await api.post<Delivery>(`/deliveries/${created.id}/attach-file`, {
          fileBase64: data.fileBase64,
          fileName: data.fileName,
          contentType: data.contentType || 'application/pdf'
        })
        deliveries.value.unshift(withFile)
      } catch (e) {
        console.warn('Failed to attach file to delivery:', e)
        deliveries.value.unshift(created)
      }
    } else {
      deliveries.value.unshift(created)
    }

    // Refresh stokun
    try {
      const productsStore = useProductsStore()
      await productsStore.reload()
    } catch (e) {
      console.warn('Failed to refresh products after delivery:', e)
    }

    return created
  }

  async function remove(id: string) {
    await api.delete(`/deliveries/${id}`)
    deliveries.value = deliveries.value.filter(d => d.id !== id)

    try {
      const productsStore = useProductsStore()
      await productsStore.reload()
    } catch (e) {
      console.warn('Failed to refresh products after delivery delete:', e)
    }
  }

  function fileUrl(deliveryId: string): string {
    // URL absolute per hape ne tab te ri
    const baseUrl = (api as any).baseUrl || 'http://localhost:8080/api'
    return `${baseUrl}/deliveries/${deliveryId}/file`
  }

  return {
    deliveries,
    loaded,
    load,
    reload,
    create,
    remove,
    fileUrl
  }
})