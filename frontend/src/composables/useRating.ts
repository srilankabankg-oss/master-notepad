/**
 * Composable for rating display helpers — color and text formatting.
 */

/**
 * Returns a CSS color string based on the rating value.
 *
 * - `#16a34a` (green)  — rating ≥ 7
 * - `#ca8a04` (yellow) — rating ≥ 5 and < 7
 * - `#dc2626` (red)    — rating < 5
 * - `#9ca3af` (gray)   — rating is undefined / null
 *
 * @param rating - Numeric rating or undefined
 * @returns Hex color string
 */
export function ratingColor(rating: number | undefined): string {
  if (rating === undefined) return '#9ca3af'
  if (rating >= 7) return '#16a34a'
  if (rating >= 5) return '#ca8a04'
  return '#dc2626'
}

/**
 * Returns the rating as a formatted string or an em dash for undefined values.
 *
 * @param rating - Numeric rating or undefined
 * @returns Rating string or '—'
 */
export function ratingText(rating: number | undefined): string {
  return rating !== undefined ? String(rating) : '—'
}
