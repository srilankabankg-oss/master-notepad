import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useEntityForm } from '@/composables/useEntityForm'

interface TestEntity {
  id: number
  name: string
}

interface TestCreate {
  name: string
}

describe('useEntityForm', () => {
  const defaultValues: TestCreate = { name: '' }
  const entityName = 'Подрядчик'

  function makeForm(overrides: Partial<Parameters<typeof useEntityForm<TestEntity, TestCreate>>[0]> = {}) {
    return useEntityForm<TestEntity, TestCreate>({
      entityName,
      defaultCreateValues: defaultValues,
      toCreateData: (entity: TestEntity) => ({ name: entity.name }),
      onSubmit: vi.fn().mockResolvedValue(undefined),
      validate: vi.fn().mockReturnValue(true),
      ...overrides,
    })
  }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('openCreate', () => {
    it('sets showForm=true, editingId=null, formData=defaults', () => {
      const form = makeForm()
      form.openCreate()
      expect(form.showForm.value).toBe(true)
      expect(form.editingId.value).toBeNull()
      expect(form.formData.value).toEqual(defaultValues)
    })
  })

  describe('openEdit', () => {
    it('sets showForm=true, editingId=entity.id, formData=mapped', () => {
      const form = makeForm()
      const entity: TestEntity = { id: 3, name: 'СтройГрупп' }
      form.openEdit(entity)
      expect(form.showForm.value).toBe(true)
      expect(form.editingId.value).toBe(3)
      expect(form.formData.value).toEqual({ name: 'СтройГрупп' })
    })
  })

  describe('closeForm', () => {
    it('sets showForm=false', () => {
      const form = makeForm()
      form.openCreate()
      form.closeForm()
      expect(form.showForm.value).toBe(false)
    })
  })

  describe('submitForm', () => {
    it('validate returns false → onSubmit NOT called', async () => {
      const validate = vi.fn().mockReturnValue(false)
      const onSubmit = vi.fn().mockResolvedValue(undefined)
      const form = makeForm({ validate, onSubmit })

      await form.submitForm()

      expect(validate).toHaveBeenCalled()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('valid form → onSubmit called with correct args, then modal closes', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined)
      const form = makeForm({ onSubmit })

      await form.submitForm()

      expect(onSubmit).toHaveBeenCalledWith({
        isEdit: false,
        id: null,
        values: defaultValues,
      })
      expect(form.showForm.value).toBe(false)
    })

    it('edit mode → onSubmit called with isEdit=true and entity id', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined)
      const form = makeForm({ onSubmit })
      const entity: TestEntity = { id: 7, name: 'Монолит' }
      form.openEdit(entity)

      await form.submitForm()

      expect(onSubmit).toHaveBeenCalledWith({
        isEdit: true,
        id: 7,
        values: { name: 'Монолит' },
      })
    })

    it('onSubmit throws → formError is set', async () => {
      const error = new Error('Save failed')
      const onSubmit = vi.fn().mockRejectedValue(error)
      const form = makeForm({ onSubmit })

      await form.submitForm()

      expect(form.formError.value).toBe('Save failed')
    })

    it('formLoading is true during async submit, false after', async () => {
      let resolveSubmit: (_value: void) => void
      const onSubmit = vi.fn().mockReturnValue(
        new Promise<void>((resolve) => { resolveSubmit = resolve }),
      )
      const form = makeForm({ onSubmit })

      const submitPromise = form.submitForm()
      expect(form.formLoading.value).toBe(true)

      resolveSubmit!()
      await submitPromise
      expect(form.formLoading.value).toBe(false)
    })
  })
})
