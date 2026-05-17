import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDeleteConfirm } from '@/composables/useDeleteConfirm'

describe('useDeleteConfirm', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.restoreAllMocks()
    confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true)
  })

  it('confirm returns true → deleteItem calls confirm and removeFn', async () => {
    const removeFn = vi.fn().mockResolvedValue(undefined)
    const { deleteItem } = useDeleteConfirm(removeFn, 'Подрядчик')

    await deleteItem(5)

    expect(confirmSpy).toHaveBeenCalledWith('Удалить подрядчик?')
    expect(removeFn).toHaveBeenCalledWith(5)
  })

  it('confirm returns false → removeFn is NOT called', async () => {
    confirmSpy.mockReturnValue(false)
    const removeFn = vi.fn().mockResolvedValue(undefined)
    const { deleteItem } = useDeleteConfirm(removeFn, 'Подрядчик')

    await deleteItem(5)

    expect(removeFn).not.toHaveBeenCalled()
  })
})
