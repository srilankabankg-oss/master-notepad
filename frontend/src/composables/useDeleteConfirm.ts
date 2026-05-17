import { errorMessage } from '@/api/client'

/**
 * Wrap `confirm()` + `store.remove()` + `alert(errorMessage)` into one call.
 * @param removeFn   Store `remove(id)` method
 * @param entityName Name used in confirm dialog and error alerts
 * @returns `deleteItem(id)` — call directly from template click handlers
 */
export function useDeleteConfirm(
  removeFn: (id: number) => Promise<void>,
  entityName: string,
) {
  async function deleteItem(id: number) {
    if (!confirm(`Удалить ${entityName.toLowerCase()}?`)) return
    try {
      await removeFn(id)
    } catch (e: unknown) {
      alert(errorMessage(e, 'Ошибка'))
    }
  }

  return { deleteItem }
}
