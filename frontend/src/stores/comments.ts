import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, errorMessage } from '@/api/client'
import type { Comment, CommentCreate, CommentUpdate } from '@/types/api'

export const useCommentStore = defineStore('comments', () => {
  const items = ref<Comment[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll(subcontractorId?: number) {
    loading.value = true
    error.value = null
    try {
      items.value = await api.comments.list(subcontractorId)
    } catch (e: unknown) {
      error.value = errorMessage(e, 'Не удалось загрузить комментарии')
    } finally {
      loading.value = false
    }
  }

  async function create(data: CommentCreate) {
    const item = await api.comments.create(data)
    items.value.push(item)
    return item
  }

  async function update(id: number, data: CommentUpdate) {
    const updated = await api.comments.update(id, data)
    const idx = items.value.findIndex((c) => c.id === id)
    if (idx !== -1) items.value[idx] = updated
    return updated
  }

  async function remove(id: number) {
    await api.comments.delete(id)
    items.value = items.value.filter((c) => c.id !== id)
  }

  return { items, loading, error, fetchAll, create, update, remove }
})
