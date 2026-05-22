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
  status: 'submitted' | 'reviewing' | 'accepted' | 'rejected',
): string {
  const labels: Record<'submitted' | 'reviewing' | 'accepted' | 'rejected', string> = {
    submitted: 'Отправлена',
    reviewing: 'На рассмотрении',
    accepted: 'Принята',
    rejected: 'Отклонена',
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
