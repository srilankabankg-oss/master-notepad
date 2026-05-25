/**
 * Composable for questionnaire / approval status label mapping.
 */

/**
 * Maps an approval status to its Russian display label.
 *
 * - `pending`  → `'На рассмотрении'`
 * - `approved` → `'Одобрено'`
 * - `rejected` → `'Отклонено'`
 *
 * @param status - Approval status identifier
 * @returns Localised label string
 */
export function statusLabel(
  status: 'pending' | 'approved' | 'rejected',
): string {
  const labels: Record<'pending' | 'approved' | 'rejected', string> = {
    pending: 'На рассмотрении',
    approved: 'Одобрено',
    rejected: 'Отклонено',
  }
  return labels[status]
}

/**
 * Maps a task status to its Russian display label.
 *
 * - `submitted` → `'Отправлена'`
 * - `reviewing` → `'На рассмотрении'`
 * - `accepted`  → `'Принята'`
 * - `rejected`  → `'Отклонена'`
 *
 * @param status - Task status identifier
 * @returns Localised label string
 */
export function taskStatusLabel(
  status: 'created' | 'in_progress' | 'done' | 'archived',
): string {
  const labels: Record<'created' | 'in_progress' | 'done' | 'archived', string> = {
    created: 'Создана',
    in_progress: 'В работе',
    done: 'Выполнена',
    archived: 'Архив',
  }
  return labels[status]
}

/**
 * Returns a CSS class for a task status badge.
 *
 * @param status - Task status identifier
 * @returns CSS class string
 */
export function taskStatusClass(status: string): string {
  return `status-${status}`
}
