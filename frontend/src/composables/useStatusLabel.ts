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
