import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime } from '@/composables/useDateFormatter'

describe('formatDate', () => {
  it('formatDate("2026-05-17") returns string containing "17" and "2026"', () => {
    const result = formatDate('2026-05-17')
    expect(result).toContain('17')
    expect(result).toContain('2026')
  })
})

describe('formatDateTime', () => {
  it('formatDateTime("2026-05-17T10:30:00") returns string containing "10" and "17"', () => {
    const result = formatDateTime('2026-05-17T10:30:00')
    expect(result).toContain('10')
    expect(result).toContain('17')
  })
})
