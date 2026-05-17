export function calculateWeightedRating(reviews: { rating: number }[], eventTypes: string[]): number {
  const weightedSum = reviews.reduce((acc, r) => acc + r.rating * 1.0, 0)
  const totalWeight = reviews.length
  const base = totalWeight > 0 ? weightedSum / totalWeight : 0
  const violations = eventTypes.filter(t => t === 'violation').length
  const positives = eventTypes.filter(t => t === 'positive').length
  let adjusted = base - violations * 0.5
  adjusted = Math.max(adjusted, 0)
  adjusted = adjusted + positives * 0.3
  adjusted = Math.min(adjusted, 10)
  return Math.round(adjusted * 10) / 10
}
