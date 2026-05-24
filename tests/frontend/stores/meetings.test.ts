import { describe, test, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMeetingStore } from '@/stores/meetings'

describe('Meeting Store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  test('initial state', () => {
    const store = useMeetingStore()
    expect(store.items).toEqual([])
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })
})