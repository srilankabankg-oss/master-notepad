import { describe, it, expect } from 'vitest'
import { statusLabel } from '@/composables/useStatusLabel'

describe('statusLabel', () => {
  it('statusLabel("pending") → "На рассмотрении"', () => {
    expect(statusLabel('pending')).toBe('На рассмотрении')
  })

  it('statusLabel("approved") → "Одобрено"', () => {
    expect(statusLabel('approved')).toBe('Одобрено')
  })

  it('statusLabel("rejected") → "Отклонено"', () => {
    expect(statusLabel('rejected')).toBe('Отклонено')
  })
})
