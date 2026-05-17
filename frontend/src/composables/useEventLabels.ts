/**
 * Composable for event-journal label helpers.
 */

/** Allowed event types. */
export const EVENT_TYPES = ['positive', 'violation', 'info'] as const

/** Readonly tuple of all event types. */
export const eventTypes: readonly ['positive', 'violation', 'info'] = EVENT_TYPES

/**
 * Maps an event type string to its Russian display label.
 *
 * @param type - Event type identifier
 * @returns Localised label string
 */
export function eventTypeLabel(
  type: 'positive' | 'violation' | 'info',
): string {
  const labels: Record<'positive' | 'violation' | 'info', string> = {
    positive: 'Позитивное',
    violation: 'Нарушение',
    info: 'Информация',
  }
  return labels[type]
}

/**
 * Returns a Tailwind badge class for the given event type.
 *
 * @param type - Event type string (any value; returned as-is in class name)
 * @returns CSS class string, e.g. `badge-positive`
 */
export function eventTypeClass(type: string): string {
  return `badge-${type}`
}
