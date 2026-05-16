import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, errorMessage } from '@/api/client'
import type { Suggestion, SuggestionCreate, SuggestionUpdate } from '@/types/api'

export const useSuggestionStore = defineStore('suggestions', () => {
  const items = ref<Suggestion[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll(checklistId?: number) {
    loading.value = true
    error.value = null
    try {
      items.value = await api.suggestions.list(checklistId)
    } catch (e: unknown) {
      error.value = errorMessage(e, 'Не удалось загрузить предложения')
    } finally {
      loading.value = false
    }
  }

  async function fetchById(id: number) {
    return api.suggestions.get(id)
  }

  async function create(data: SuggestionCreate) {
    const item = await api.suggestions.create(data)
    items.value.push(item)
    return item
  }

  async function update(id: number, data: SuggestionUpdate) {
    const updated = await api.suggestions.update(id, data)
    const idx = items.value.findIndex((s) => s.id === id)
    if (idx !== -1) items.value[idx] = updated
    return updated
  }

  async function remove(id: number) {
    await api.suggestions.delete(id)
    items.value = items.value.filter((s) => s.id !== id)
  }

  return { items, loading, error, fetchAll, fetchById, create, update, remove }
})
