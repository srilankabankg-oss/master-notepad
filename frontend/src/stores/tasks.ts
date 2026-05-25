import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, errorMessage } from '@/api/client'
import type { Task, TaskCreate, TaskUpdate, TaskStatus } from '@/types/api'

export const useTaskStore = defineStore('tasks', () => {
  const items = ref<Task[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll(params?: { status?: TaskStatus; protocolId?: number; assigneeId?: number; search?: string }) {
    loading.value = true
    error.value = null
    try {
      items.value = await api.tasks.list(params)
    } catch (e: unknown) {
      error.value = errorMessage(e, 'Не удалось загрузить задачи')
    } finally {
      loading.value = false
    }
  }

  async function fetchById(id: number) {
    return api.tasks.get(id)
  }

  async function create(data: TaskCreate) {
    const item = await api.tasks.create(data)
    items.value.push(item)
    return item
  }

  async function update(id: number, data: TaskUpdate) {
    const updated = await api.tasks.update(id, data)
    const idx = items.value.findIndex((t) => t.id === id)
    if (idx !== -1) items.value[idx] = updated
    return updated
  }

  async function remove(id: number) {
    await api.tasks.delete(id)
    items.value = items.value.filter((t) => t.id !== id)
  }

  async function transition(id: number, data: { status: TaskStatus }) {
    return api.tasks.transition(id, data)
  }

  async function markDone(id: number) {
    const updated = await api.tasks.markDone(id)
    const idx = items.value.findIndex((t) => t.id === id)
    if (idx !== -1) items.value[idx] = updated
    return updated
  }

  async function reorder(tasks: { id: number; order: number }[]) {
    return api.tasks.reorder(tasks)
  }

  return { items, loading, error, fetchAll, fetchById, create, update, remove, transition, markDone, reorder }
})
