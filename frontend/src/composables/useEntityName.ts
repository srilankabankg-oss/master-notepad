import type { Employee, Subcontractor } from '@/types/api'

/**
 * Returns a lookup function that resolves an employee ID to its name.
 * Falls back to `#${id}` when the employee is not found.
 */
export function useEmployeeName(
  items: Employee[] | Record<string, unknown>,
): (id: number) => string {
  const list: Employee[] = 'value' in items ? (items as { value: Employee[] }).value : (items as Employee[])
  return (id: number): string => {
    const employee = list.find((e) => e.id === id)
    return employee ? employee.name : `#${id}`
  }
}

/**
 * Returns a lookup function that resolves a subcontractor ID to its name.
 * Falls back to `#${id}` when the subcontractor is not found.
 */
export function useSubcontractorName(
  items: Subcontractor[] | Record<string, unknown>,
): (id: number) => string {
  const list: Subcontractor[] = 'value' in items ? (items as { value: Subcontractor[] }).value : (items as Subcontractor[])
  return (id: number): string => {
    const subcontractor = list.find((s) => s.id === id)
    return subcontractor ? subcontractor.name : `#${id}`
  }
}
