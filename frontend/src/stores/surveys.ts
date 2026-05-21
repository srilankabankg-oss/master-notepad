import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, errorMessage } from '@/api/client'
import type { Survey, SurveyCreate, SurveyResponseCreate } from '@/types/api'

export const useSurveyStore = defineStore('surveys', () => {
  const items = ref<Survey[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      items.value = await api.surveys.list()
    } catch (e: unknown) {
      error.value = errorMessage(e, 'Не удалось загрузить опросы')
    } finally {
      loading.value = false
    }
  }

  async function fetchById(id: number) {
    return api.surveys.get(id)
  }

  async function create(data: SurveyCreate) {
    const item = await api.surveys.create(data)
    items.value.push(item)
    return item
  }

  async function update(id: number, data: Partial<SurveyCreate>) {
    const item = await api.surveys.update(id, data)
    const idx = items.value.findIndex((s) => s.id === id)
    if (idx !== -1) items.value[idx] = item
    return item
  }

  async function remove(id: number) {
    await api.surveys.delete(id)
    items.value = items.value.filter((s) => s.id !== id)
  }

  async function respond(id: number, data: SurveyResponseCreate) {
    return api.surveys.respond(id, data)
  }

  async function responses(id: number) {
    return api.surveys.responses(id)
  }

  return { items, loading, error, fetchAll, fetchById, create, update, remove, respond, responses }
})
