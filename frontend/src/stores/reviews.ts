import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, errorMessage } from '@/api/client'
import type { Review, ReviewCreate } from '@/types/api'

export const useReviewStore = defineStore('reviews', () => {
  const items = ref<Review[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll(subcontractorId?: number) {
    loading.value = true
    error.value = null
    try {
      items.value = await api.reviews.list(subcontractorId)
    } catch (e: unknown) {
      error.value = errorMessage(e, 'Не удалось загрузить отзывы')
    } finally {
      loading.value = false
    }
  }

  async function fetchById(id: number) {
    return api.reviews.get(id)
  }

  async function create(data: ReviewCreate) {
    const item = await api.reviews.create(data)
    items.value.push(item)
    return item
  }

  async function update(id: number, data: Partial<ReviewCreate>) {
    const updated = await api.reviews.update(id, data)
    const idx = items.value.findIndex((r) => r.id === id)
    if (idx !== -1) items.value[idx] = updated
    return updated
  }

  async function remove(id: number) {
    await api.reviews.delete(id)
    items.value = items.value.filter((r) => r.id !== id)
  }

  return { items, loading, error, fetchAll, fetchById, create, update, remove }
})
