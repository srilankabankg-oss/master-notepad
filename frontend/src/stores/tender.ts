import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api, errorMessage } from '@/api/client'
import type { TenderSummary } from '@/types/api'

export const useTenderStore = defineStore('tender', () => {
  const summary = ref<TenderSummary | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchSummary(id: number) {
    loading.value = true
    error.value = null
    try {
      summary.value = await api.tender.summary(id)
    } catch (e: unknown) {
      error.value = errorMessage(e, 'Не удалось загрузить сводку')
    } finally {
      loading.value = false
    }
  }

  return { summary, loading, error, fetchSummary }
})
