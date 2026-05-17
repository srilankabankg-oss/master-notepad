<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSubcontractorStore } from '@/stores/subcontractors'
import type { SubcontractorCreate } from '@/types/api'
import { useEntityForm } from '@/composables/useEntityForm'
import { useDeleteConfirm } from '@/composables/useDeleteConfirm'
import { ratingColor } from '@/composables/useRating'
import BaseButton from '@/components/BaseButton.vue'
import RatingBadge from '@/components/RatingBadge.vue'
import Modal from '@/components/Modal.vue'

const router = useRouter()
const store = useSubcontractorStore()

const { showForm, editingId, formData, formError, formLoading, openCreate, openEdit, closeForm, submitForm } = useEntityForm({
  entityName: 'Подрядчик',
  defaultCreateValues: { name: '', companyName: '', specialization: '', contactInfo: '', description: '' },
  toCreateData: (sub: any) => ({ name: sub.name, companyName: sub.companyName || '', specialization: sub.specialization || '', contactInfo: sub.contactInfo || '', description: sub.description || '' }),
  onSubmit: async ({ isEdit, id, values }: { isEdit: boolean; id: number | null; values: SubcontractorCreate }) => {
    if (isEdit && id) await store.update(id, values)
    else await store.create(values)
  },
  validate: () => {
    if (!formData.value.name.trim()) { formError.value = 'Название обязательно'; return false }
    return true
  },
})

const { deleteItem } = useDeleteConfirm((id: number) => store.remove(id), 'подрядчик')

onMounted(() => {
  store.fetchAll()
})
</script>

<template>
  <div class="view">
    <div class="view-header">
      <h2 class="view-title">Список подрядчиков</h2>
      <BaseButton variant="primary" @click="openCreate">Добавить подрядчика</BaseButton>
    </div>

    <div v-if="store.loading" class="state-message">Загрузка...</div>
    <div v-else-if="store.error" class="state-message state-error">{{ store.error }}</div>
    <div v-else-if="store.items.length === 0" class="state-message">Нет подрядчиков</div>

    <table v-else class="table">
      <thead>
        <tr>
          <th>Название</th>
          <th>Компания</th>
          <th>Специализация</th>
          <th>Рейтинг</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="sub in store.items"
          :key="sub.id"
          class="table-row-clickable"
          @click="router.push(`/subcontractors/${sub.id}`)"
        >
          <td class="cell-name" data-label="Название">{{ sub.name }}</td>
          <td data-label="Компания">{{ sub.companyName || '-' }}</td>
          <td data-label="Специализация">{{ sub.specialization || '-' }}</td>
          <td data-label="Рейтинг">
            <RatingBadge :rating="sub.rating" />
          </td>
          <td @click.stop>
            <BaseButton size="sm" variant="ghost" @click="openEdit(sub)">Изменить</BaseButton>
            <BaseButton size="sm" variant="ghost" @click="deleteItem(sub.id)" class="btn-danger-text">Удалить</BaseButton>
          </td>
        </tr>
      </tbody>
    </table>

    <Modal v-model="showForm" :title="editingId ? 'Изменить подрядчика' : 'Новый подрядчик'">
      <form @submit.prevent="submitForm" class="form">
        <label class="field"><span class="field-label">Название *</span><input v-model="formData.name" class="input" required /></label>
        <label class="field"><span class="field-label">Компания</span><input v-model="formData.companyName" class="input" /></label>
        <label class="field"><span class="field-label">Специализация</span><input v-model="formData.specialization" class="input" /></label>
        <label class="field"><span class="field-label">Контактная информация</span><input v-model="formData.contactInfo" class="input" /></label>
        <label class="field"><span class="field-label">Описание</span><textarea v-model="formData.description" class="input textarea" rows="3" /></label>
        <div v-if="formError" class="form-error">{{ formError }}</div>
        <div class="form-actions">
          <BaseButton variant="secondary" type="button" @click="closeForm">Отмена</BaseButton>
          <BaseButton variant="primary" type="submit" :disabled="formLoading">{{ formLoading ? 'Сохранение...' : 'Сохранить' }}</BaseButton>
        </div>
      </form>
    </Modal>
  </div>
</template>

<style scoped>
.view {
  max-width: 68.75rem;
  container-type: inline-size;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

.view-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
}

.table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-bg-card);
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 0.0625rem 0.1875rem rgba(0, 0, 0, 0.08);
}

.table th {
  text-align: left;
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--color-bg-subtle);
  border-bottom: 0.0625rem solid var(--color-border);
}

.table td {
  padding: 0.75rem 1rem;
  border-bottom: 0.0625rem solid var(--color-bg);
  color: var(--color-text-secondary);
}

.table-row-clickable {
  cursor: pointer;
  transition: background 0.1s;
}

.table-row-clickable:hover {
  background: var(--color-bg-subtle);
}

.cell-name {
  font-weight: 500;
  color: var(--color-primary);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: var(--color-bg-card);
  border-radius: 0.75rem;
  padding: 1.75rem;
  width: 30rem;
  max-width: 90vw;
  box-shadow: 0 1.25rem 3.75rem rgba(0, 0, 0, 0.15);
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1.25rem;
  color: var(--color-text);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.input {
  padding: 0.5rem 0.75rem;
  border: 0.0625rem solid var(--color-border-input);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: var(--color-text);
  background: var(--color-bg-card);
  outline: none;
  transition: border-color 0.15s;
}

.input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 0.1875rem rgba(26, 86, 219, 0.1);
}

.textarea {
  resize: vertical;
  min-height: 3.75rem;
}

.form-error {
  color: var(--color-danger);
  font-size: 0.8125rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.state-message {
  padding: 2.5rem 0;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.9375rem;
}

.state-error {
  color: var(--color-danger);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary);
  color: var(--color-bg-card);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-secondary {
  background: var(--color-border);
  color: var(--color-text-secondary);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-border-input);
}

.btn-sm {
  padding: 0.25rem 0.625rem;
  font-size: 0.8125rem;
}

.btn-ghost {
  background: transparent;
  color: var(--color-text-muted);
}

.btn-ghost:hover {
  background: var(--color-bg);
  color: var(--color-text-secondary);
}

.btn-danger {
  color: var(--color-danger);
}

.btn-danger:hover {
  background: var(--color-badge-violation-bg);
  color: var(--color-danger-hover);
}

@container (max-width: 40rem) {
  .view-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .table thead {
    display: none;
  }

  .table tbody,
  .table tr,
  .table td {
    display: block;
  }

  .table tr {
    padding: 0.875rem 1rem;
    border-bottom: 0.0625rem solid var(--color-border);
  }

  .table tr:last-child {
    border-bottom: none;
  }

  .table td {
    padding: 0.25rem 0;
    border-bottom: none;
  }

  .table td:first-child {
    font-weight: 600;
    font-size: 0.9375rem;
    color: var(--color-primary);
  }

  .table td:not(:first-child):not(:last-child)::before {
    content: attr(data-label);
    display: inline-block;
    width: 6.875rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }

  .table td:last-child {
    padding-top: 0.5rem;
  }

  .modal-overlay {
    align-items: flex-end;
  }

  .modal {
    width: 100%;
    max-width: 100vw;
    border-radius: 0.75rem 0.75rem 0 0;
    padding: 1.5rem 1rem;
    max-height: 90vh;
    overflow-y: auto;
  }
}
</style>
