import { ref } from 'vue'
import { errorMessage } from '@/api/client'

/**
 * Composable encapsulating the reusable "modal form" pattern used across
 * entity views (SubcontractorsView, ReviewsView, MeetingsView,
 * EmployeesView, ChecklistsView, EventsView).
 *
 * Manages reactive form state, open/close lifecycle, validation hook,
 * and the submit flow (create vs edit) with error handling.
 *
 * @template TEntity - The full entity type (must have `id: number`)
 * @template TCreate  - The create/patch payload type
 *
 * @param options - Configuration object
 * @param options.entityName       - Human-readable entity name for error messages
 * @param options.defaultCreateValues - Initial values for the create form
 * @param options.toCreateData     - Maps an existing entity back to create-form shape
 * @param options.onSubmit         - Called with `{ isEdit, id, values }` on submit
 * @param options.validate         - Returns `true` when the form is valid
 *
 * @returns Reactive form state and control functions
 */
export function useEntityForm<
  TEntity extends { id: number },
  TCreate,
>(options: {
  /** Human-readable entity name used in error messages. */
  entityName: string
  /** Default / initial values for a blank create form. */
  defaultCreateValues: TCreate
  /** Converts an existing entity instance back to the create-form shape. */
  toCreateData: (entity: TEntity) => TCreate
  /**
   * Persists the form.  `isEdit` is `true` when updating, `false` on create.
   * Resolves on success, throws on failure.
   */
  onSubmit: (data: { isEdit: boolean; id: number | null; values: TCreate }) => Promise<void>
  /**
   * Client-side validation guard.  Returns `true` when the form passes.
   * Should set `formError` on the caller's side before returning `false`.
   */
  validate: () => boolean
}) {
  const { entityName, defaultCreateValues, toCreateData, onSubmit, validate } = options

  /** Whether the modal overlay is visible. */
  const showForm = ref(false)
  /** ID of the entity being edited, or `null` for a new entity. */
  const editingId = ref<number | null>(null)
  /** Two-way-bound form values. */
  const formData = ref<TCreate>(structuredClone(defaultCreateValues) as TCreate)
  /** Inline validation / API error text. */
  const formError = ref('')
  /** `true` while the async submit is in-flight. */
  const formLoading = ref(false)

  /**
   * Opens the modal in create mode with blank defaults.
   */
  function openCreate(): void {
    editingId.value = null
    formData.value = structuredClone(defaultCreateValues) as TCreate
    formError.value = ''
    showForm.value = true
  }

  /**
   * Opens the modal in edit mode, pre-populating fields from the entity.
   *
   * @param entity - The entity instance to edit
   */
  function openEdit(entity: TEntity): void {
    editingId.value = entity.id
    formData.value = toCreateData(entity)
    formError.value = ''
    showForm.value = true
  }

  /** Closes the modal and resets transient state. */
  function closeForm(): void {
    showForm.value = false
  }

  /**
   * Runs `validate()`, then calls `onSubmit` distinguishing create vs edit.
   * On success the modal closes; on failure the error is surfaced via
   * `formError`.
   */
  async function submitForm(): Promise<void> {
    if (!validate()) return
    formLoading.value = true
    formError.value = ''
    try {
      await onSubmit({
        isEdit: editingId.value !== null,
        id: editingId.value,
        values: formData.value,
      })
      showForm.value = false
    } catch (e: unknown) {
      formError.value = errorMessage(e, `Ошибка сохранения ${entityName.toLowerCase()}`)
    } finally {
      formLoading.value = false
    }
  }

  return {
    showForm,
    editingId,
    formData,
    formError,
    formLoading,
    openCreate,
    openEdit,
    closeForm,
    submitForm,
  }
}
