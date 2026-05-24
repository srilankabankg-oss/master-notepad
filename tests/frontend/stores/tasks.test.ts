import { describe, test, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore } from '@/stores/tasks'

describe('Task Store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  test('initial state', () => {
    const store = useTaskStore()
    expect(store.items).toEqual([])
    expect(store.loading).toBe(false)
  })

  test('manual mutation', () => {
    const store = useTaskStore()
    store.items = [{ id: 1, taskNumber: 'TASK-2025-00001', title: 'Test', status: 'created', protocolId: 1, sortOrder: 0 } as any]
    expect(store.items.length).toBe(1)
  })
})