import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, errorMessage } from '@/api/client'
import type { Checklist, ChecklistCreate, ChecklistUpdate } from '@/types/api'

export const useChecklistStore = defineStore('checklists', () => {
  const items = ref<Checklist[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll(type?: Checklist['type'], ownerId?: number) {
    loading.value = true
    error.value = null
    try {
      items.value = await api.checklists.list(type, ownerId)
    } catch (e: unknown) {
      error.value = errorMessage(e, 'Не удалось загрузить чек-листы')
    } finally {
      loading.value = false
    }
  }

  async function fetchById(id: number) {
    return api.checklists.get(id)
  }

  async function create(data: ChecklistCreate) {
    const item = await api.checklists.create(data)
    items.value.push(item)
    return item
  }

  async function update(id: number, data: ChecklistUpdate) {
    const updated = await api.checklists.update(id, data)
    const idx = items.value.findIndex((c) => c.id === id)
    if (idx !== -1) items.value[idx] = updated
    return updated
  }

  async function remove(id: number) {
    await api.checklists.delete(id)
    items.value = items.value.filter((c) => c.id !== id)
  }

  return { items, loading, error, fetchAll, fetchById, create, update, remove }
})
