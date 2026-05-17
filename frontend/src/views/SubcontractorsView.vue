<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSubcontractorStore } from '@/stores/subcontractors'
import type { SubcontractorCreate } from '@/types/api'
import { errorMessage } from '@/api/client'

const router = useRouter()
const store = useSubcontractorStore()

const showForm = ref(false)
const editingId = ref<number | null>(null)
const formLoading = ref(false)
const formError = ref('')

const form = ref<SubcontractorCreate>({
  name: '',
  companyName: '',
  specialization: '',
  contactInfo: '',
  description: '',
})

function openCreate() {
  editingId.value = null
  form.value = { name: '', companyName: '', specialization: '', contactInfo: '', description: '' }
  formError.value = ''
  showForm.value = true
}

function openEdit(sub: any) {
  editingId.value = sub.id
  form.value = {
    name: sub.name,
    companyName: sub.company_name || '',
    specialization: sub.specialization || '',
    contactInfo: sub.contact_info || '',
    description: sub.description || '',
  }
  formError.value = ''
  showForm.value = true
}

function closeForm() {
  showForm.value = false
}

async function submitForm() {
  if (!form.value.name.trim()) {
    formError.value = 'Название обязательно'
    return
  }
  formLoading.value = true
  formError.value = ''
  try {
    if (editingId.value) {
      await store.update(editingId.value, form.value)
    } else {
      await store.create(form.value)
    }
    showForm.value = false
  } catch (e: unknown) {
    formError.value = errorMessage(e, 'Ошибка сохранения')
  } finally {
    formLoading.value = false
  }
}

async function deleteItem(id: number) {
  if (!confirm('Удалить подрядчика?')) return
  try {
    await store.remove(id)
  } catch (e: unknown) {
    alert(errorMessage(e, 'Ошибка удаления'))
  }
}

function ratingColor(rating: number | undefined): string {
  if (!rating) return '#9ca3af'
  if (rating >= 7) return '#16a34a'
  if (rating >= 5) return '#ca8a04'
  return '#dc2626'
}

onMounted(() => {
  store.fetchAll()
})
</script>

<template>
  <div class="view">
    <div class="view-header">
      <h2 class="view-title">Список подрядчиков</h2>
      <button class="btn btn-primary" @click="openCreate">Добавить подрядчика</button>
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
          <td data-label="Компания">{{ sub.company_name || '-' }}</td>
          <td data-label="Специализация">{{ sub.specialization || '-' }}</td>
          <td data-label="Рейтинг">
            <span class="rating-badge" :style="{ background: ratingColor(sub.rating) }">
              {{ sub.rating ?? '-' }}
            </span>
          </td>
          <td @click.stop>
            <button class="btn btn-sm btn-ghost" @click="openEdit(sub)">Изменить</button>
            <button class="btn btn-sm btn-ghost btn-danger" @click="deleteItem(sub.id)">Удалить</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="showForm" class="modal-overlay" @click.self="closeForm">
      <div class="modal">
        <h3 class="modal-title">{{ editingId ? 'Изменить подрядчика' : 'Новый подрядчик' }}</h3>
        <form @submit.prevent="submitForm" class="form">
          <label class="field">
            <span class="field-label">Название *</span>
            <input v-model="form.name" class="input" required />
          </label>
          <label class="field">
            <span class="field-label">Компания</span>
            <input v-model="form.companyName" class="input" />
          </label>
          <label class="field">
            <span class="field-label">Специализация</span>
            <input v-model="form.specialization" class="input" />
          </label>
          <label class="field">
            <span class="field-label">Контактная информация</span>
            <input v-model="form.contactInfo" class="input" />
          </label>
          <label class="field">
            <span class="field-label">Описание</span>
            <textarea v-model="form.description" class="input textarea" rows="3" />
          </label>
          <div v-if="formError" class="form-error">{{ formError }}</div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click="closeForm">Отмена</button>
            <button type="submit" class="btn btn-primary" :disabled="formLoading">
              {{ formLoading ? 'Сохранение...' : 'Сохранить' }}
            </button>
          </div>
        </form>
      </div>
    </div>
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
  color: #111827;
}

.table {
  width: 100%;
  border-collapse: collapse;
  background: #ffffff;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 0.0625rem 0.1875rem rgba(0, 0, 0, 0.08);
}

.table th {
  text-align: left;
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: #f9fafb;
  border-bottom: 0.0625rem solid #e5e7eb;
}

.table td {
  padding: 0.75rem 1rem;
  border-bottom: 0.0625rem solid #f3f4f6;
  color: #374151;
}

.table-row-clickable {
  cursor: pointer;
  transition: background 0.1s;
}

.table-row-clickable:hover {
  background: #f9fafb;
}

.cell-name {
  font-weight: 500;
  color: #1a56db;
}

.rating-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: 0.375rem;
  color: #ffffff;
  font-size: 0.8125rem;
  font-weight: 600;
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
  background: #ffffff;
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
  color: #111827;
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
  color: #374151;
}

.input {
  padding: 0.5rem 0.75rem;
  border: 0.0625rem solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #111827;
  background: #ffffff;
  outline: none;
  transition: border-color 0.15s;
}

.input:focus {
  border-color: #1a56db;
  box-shadow: 0 0 0 0.1875rem rgba(26, 86, 219, 0.1);
}

.textarea {
  resize: vertical;
  min-height: 3.75rem;
}

.form-error {
  color: #dc2626;
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
  color: #6b7280;
  font-size: 0.9375rem;
}

.state-error {
  color: #dc2626;
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
  background: #1a56db;
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background: #1e40af;
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: #d1d5db;
}

.btn-sm {
  padding: 0.25rem 0.625rem;
  font-size: 0.8125rem;
}

.btn-ghost {
  background: transparent;
  color: #6b7280;
}

.btn-ghost:hover {
  background: #f3f4f6;
  color: #374151;
}

.btn-danger {
  color: #dc2626;
}

.btn-danger:hover {
  background: #fef2f2;
  color: #b91c1c;
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
    border-bottom: 0.0625rem solid #e5e7eb;
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
    color: #1a56db;
  }

  .table td:not(:first-child):not(:last-child)::before {
    content: attr(data-label);
    display: inline-block;
    width: 6.875rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
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
