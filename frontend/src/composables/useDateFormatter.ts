/**
 * Composable for Russian-locale date and date-time formatting.
 */

/**
 * Formats a date string to a short locale date using Russian locale.
 *
 * @param dateStr - ISO date / datetime string (or any value accepted by `Date`)
 * @returns Formatted date string, e.g. `17.05.2026`
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU')
}

/**
 * Formats a date string to a full locale date-time string using Russian locale.
 *
 * @param dateStr - ISO date / datetime string (or any value accepted by `Date`)
 * @returns Formatted date-time string, e.g. `17.05.2026 14:30:00`
 */
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ru-RU')
}
