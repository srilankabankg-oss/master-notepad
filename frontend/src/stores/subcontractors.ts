import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, errorMessage } from '@/api/client'
import type { Subcontractor, SubcontractorCreate } from '@/types/api'

export const useSubcontractorStore = defineStore('subcontractors', () => {
  const items = ref<Subcontractor[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      items.value = await api.subcontractors.list()
    } catch (e: unknown) {
      error.value = errorMessage(e, 'Не удалось загрузить подрядчиков')
    } finally {
      loading.value = false
    }
  }

  async function fetchById(id: number | string) {
    return api.subcontractors.get(id)
  }

  async function create(data: SubcontractorCreate) {
    const item = await api.subcontractors.create(data)
    items.value.push(item)
    return item
  }

  async function update(id: number, data: Partial<SubcontractorCreate>) {
    const updated = await api.subcontractors.update(id, data)
    const idx = items.value.findIndex((s) => s.id === id)
    if (idx !== -1) items.value[idx] = updated
    return updated
  }

  async function remove(id: number) {
    await api.subcontractors.delete(id)
    items.value = items.value.filter((s) => s.id !== id)
  }

  return { items, loading, error, fetchAll, fetchById, create, update, remove }
})
