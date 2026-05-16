import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, errorMessage } from '@/api/client'
import type { Employee, EmployeeCreate } from '@/types/api'

export const useEmployeeStore = defineStore('employees', () => {
  const items = ref<Employee[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      items.value = await api.employees.list()
    } catch (e: unknown) {
      error.value = errorMessage(e, 'Не удалось загрузить сотрудников')
    } finally {
      loading.value = false
    }
  }

  async function fetchById(id: number) {
    return api.employees.get(id)
  }

  async function create(data: EmployeeCreate) {
    const item = await api.employees.create(data)
    items.value.push(item)
    return item
  }

  async function update(id: number, data: Partial<EmployeeCreate>) {
    const updated = await api.employees.update(id, data)
    const idx = items.value.findIndex((e) => e.id === id)
    if (idx !== -1) items.value[idx] = updated
    return updated
  }

  async function remove(id: number) {
    await api.employees.delete(id)
    items.value = items.value.filter((e) => e.id !== id)
  }

  return { items, loading, error, fetchAll, fetchById, create, update, remove }
})
