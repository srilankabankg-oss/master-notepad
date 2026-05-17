import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import type { Employee, Subcontractor } from '@/types/api'
import { useEmployeeName } from '@/composables/useEntityName'
import { useSubcontractorName } from '@/composables/useEntityName'

describe('useEmployeeName', () => {
  it('returns name for matching id', () => {
    const employees = ref<Employee[]>([
      { id: 1, name: 'Иван', email: 'i@test.ru', position: null, createdAt: '', updatedAt: '' },
    ])
    const getName = useEmployeeName(employees.value)
    expect(getName(1)).toBe('Иван')
  })

  it('returns "#999" for unknown id', () => {
    const employees = ref<Employee[]>([])
    const getName = useEmployeeName(employees.value)
    expect(getName(999)).toBe('#999')
  })
})

describe('useSubcontractorName', () => {
  it('returns name for matching id', () => {
    const subcontractors = ref<Subcontractor[]>([
      { id: 1, name: 'ООО СтройГрупп', companyName: null, contactInfo: null, specialization: null, description: null, createdAt: '', updatedAt: '' },
    ])
    const getName = useSubcontractorName(subcontractors.value)
    expect(getName(1)).toBe('ООО СтройГрупп')
  })

  it('returns "#999" for unknown id', () => {
    const subcontractors = ref<Subcontractor[]>([])
    const getName = useSubcontractorName(subcontractors.value)
    expect(getName(999)).toBe('#999')
  })
})
