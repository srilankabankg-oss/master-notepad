import { describe, it, expect } from 'vitest'
import {
  eventTypeLabel,
  eventTypeClass,
  eventTypes,
} from '@/composables/useEventLabels'

describe('eventTypeLabel', () => {
  it('eventTypeLabel("positive") → "Позитивное"', () => {
    expect(eventTypeLabel('positive')).toBe('Позитивное')
  })

  it('eventTypeLabel("violation") → "Нарушение"', () => {
    expect(eventTypeLabel('violation')).toBe('Нарушение')
  })

  it('eventTypeLabel("info") → "Информация"', () => {
    expect(eventTypeLabel('info')).toBe('Информация')
  })
})

describe('eventTypeClass', () => {
  it('eventTypeClass("positive") → "badge-positive"', () => {
    expect(eventTypeClass('positive')).toBe('badge-positive')
  })
})

describe('eventTypes', () => {
  it('eventTypes → ["positive", "violation", "info"]', () => {
    expect(eventTypes).toEqual(['positive', 'violation', 'info'])
  })
})
