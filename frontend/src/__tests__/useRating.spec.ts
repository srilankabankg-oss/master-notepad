import { describe, it, expect } from 'vitest'
import { ratingColor, ratingText } from '@/composables/useRating'

describe('ratingColor', () => {
  it('ratingColor(9) → green (≥7)', () => {
    expect(ratingColor(9)).toBe('#16a34a')
  })

  it('ratingColor(7) → green (boundary)', () => {
    expect(ratingColor(7)).toBe('#16a34a')
  })

  it('ratingColor(6) → yellow (5–6)', () => {
    expect(ratingColor(6)).toBe('#ca8a04')
  })

  it('ratingColor(5) → yellow (boundary)', () => {
    expect(ratingColor(5)).toBe('#ca8a04')
  })

  it('ratingColor(3) → red (<5)', () => {
    expect(ratingColor(3)).toBe('#dc2626')
  })

  it('ratingColor(0) → red', () => {
    expect(ratingColor(0)).toBe('#dc2626')
  })

  it('ratingColor(undefined) → gray', () => {
    expect(ratingColor(undefined)).toBe('#9ca3af')
  })
})

describe('ratingText', () => {
  it('ratingText(8) → "8"', () => {
    expect(ratingText(8)).toBe('8')
  })

  it('ratingText(undefined) → "—"', () => {
    expect(ratingText(undefined)).toBe('—')
  })
})
