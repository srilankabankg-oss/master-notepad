import { describe, it, expect } from 'vitest'
import { calculateWeightedRating } from './rating'

describe('calculateWeightedRating', () => {
  it('should return 0 with no reviews and no events', () => {
    expect(calculateWeightedRating([], [])).toBe(0)
  })

  it('should return exact rating value with a single review and no events', () => {
    expect(calculateWeightedRating([{ rating: 7 }], [])).toBe(7.0)
  })

  it('should return correct weighted average with multiple reviews and no events', () => {
    expect(calculateWeightedRating([{ rating: 8 }, { rating: 6 }], [])).toBe(7.0)
  })

  it('should apply a single violation penalty', () => {
    // 8 - 0.5 = 7.5
    expect(calculateWeightedRating([{ rating: 8 }], ['violation'])).toBe(7.5)
  })

  it('should apply multiple violation penalties', () => {
    // 8 - 0.5 * 2 = 7.0
    expect(calculateWeightedRating([{ rating: 8 }], ['violation', 'violation'])).toBe(7.0)
  })

  it('should clamp to 0 when violations push rating below minimum', () => {
    // 1 - 0.5 * 3 = -0.5 → clamped to 0
    expect(calculateWeightedRating([{ rating: 1 }], ['violation', 'violation', 'violation'])).toBe(0)
  })

  it('should apply a single positive bonus', () => {
    // 7 + 0.3 = 7.3
    expect(calculateWeightedRating([{ rating: 7 }], ['positive'])).toBe(7.3)
  })

  it('should apply multiple positive bonuses', () => {
    // 7 + 0.3 * 2 = 7.6
    expect(calculateWeightedRating([{ rating: 7 }], ['positive', 'positive'])).toBe(7.6)
  })

  it('should clamp to 10 when positives push rating above maximum', () => {
    // 10 + 0.3 * 4 = 11.2 → clamped to 10
    expect(calculateWeightedRating([{ rating: 10 }], ['positive', 'positive', 'positive', 'positive'])).toBe(10)
  })

  it('should combine violation penalty and positive bonus', () => {
    // 7 - 0.5 + 0.3 = 6.8
    expect(calculateWeightedRating([{ rating: 7 }], ['violation', 'positive'])).toBe(6.8)
  })

  it('should ignore info events', () => {
    expect(calculateWeightedRating([{ rating: 7 }], ['info', 'info'])).toBe(7.0)
  })

  it('should apply positive bonus even when there are zero reviews', () => {
    // base = 0 (no reviews), positives = 1 → 0 + 0.3 = 0.3
    expect(calculateWeightedRating([], ['positive'])).toBe(0.3)
  })

  it('should round result to 1 decimal place', () => {
    // (7 + 8) / 2 = 7.5
    expect(calculateWeightedRating([{ rating: 7 }, { rating: 8 }], [])).toBe(7.5)
  })
})
