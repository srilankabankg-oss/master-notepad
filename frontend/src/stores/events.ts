import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, errorMessage } from '@/api/client'
import type { ContractorEvent, ContractorEventCreate } from '@/types/api'

export const useEventStore = defineStore('events', () => {
  const items = ref<ContractorEvent[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll(subcontractorId?: number) {
    loading.value = true
    error.value = null
    try {
      items.value = await api.events.list(subcontractorId)
    } catch (e: unknown) {
      error.value = errorMessage(e, 'Не удалось загрузить события')
    } finally {
      loading.value = false
    }
  }

  async function fetchById(id: number) {
    return api.events.get(id)
  }

  async function create(data: ContractorEventCreate) {
    const item = await api.events.create(data)
    items.value.push(item)
    return item
  }

  async function update(id: number, data: Partial<ContractorEventCreate>) {
    const updated = await api.events.update(id, data)
    const idx = items.value.findIndex((e) => e.id === id)
    if (idx !== -1) items.value[idx] = updated
    return updated
  }

  async function remove(id: number) {
    await api.events.delete(id)
    items.value = items.value.filter((e) => e.id !== id)
  }

  async function suggestToChecklist(id: number, checklistId: number, employeeId: number) {
    return api.events.suggest(id, checklistId, employeeId)
  }

  return { items, loading, error, fetchAll, fetchById, create, update, remove, suggestToChecklist }
})
