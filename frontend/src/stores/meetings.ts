import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, errorMessage } from '@/api/client'
import type { MeetingStage } from '@/types/api'
import type { Meeting, MeetingCreate } from '@/types/api'

export const useMeetingStore = defineStore('meetings', () => {
  const items = ref<Meeting[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll(subcontractorId?: number) {
    loading.value = true
    error.value = null
    try {
      items.value = await api.meetings.list(subcontractorId)
    } catch (e: unknown) {
      error.value = errorMessage(e, 'Не удалось загрузить протоколы')
    } finally {
      loading.value = false
    }
  }

  async function fetchById(id: number) {
    return api.meetings.get(id)
  }

  async function create(data: MeetingCreate) {
    const item = await api.meetings.create(data)
    items.value.push(item)
    return item
  }

  async function update(id: number, data: Partial<MeetingCreate>) {
    const updated = await api.meetings.update(id, data)
    const idx = items.value.findIndex((m) => m.id === id)
    if (idx !== -1) items.value[idx] = updated
    return updated
  }

  async function remove(id: number) {
    await api.meetings.delete(id)
    items.value = items.value.filter((m) => m.id !== id)
  }

  async function transition(id: number, data: { stage: MeetingStage }) {
    return api.meetings.transition(id, data)
  }

  return { items, loading, error, fetchAll, fetchById, create, update, remove, transition }
})
