<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskStore } from '@/stores/tasks'
import { useEmployeeStore } from '@/stores/employees'
import { useMeetingStore } from '@/stores/meetings'
import type { Task, TaskCreate, TaskStatus } from '@/types/api'
import { useEmployeeName } from '@/composables/useEntityName'
import { useEntityForm } from '@/composables/useEntityForm'
import { useDeleteConfirm } from '@/composables/useDeleteConfirm'
import { taskStatusLabel, taskStatusClass } from '@/composables/useStatusLabel'
import { formatDate } from '@/composables/useDateFormatter'
import { errorMessage } from '@/api/client'
import BaseButton from '@/components/BaseButton.vue'
import Modal from '@/components/Modal.vue'

const router = useRouter()
const taskStore = useTaskStore()
const employeeStore = useEmployeeStore()
const meetingStore = useMeetingStore()

const filterStatus = ref<TaskStatus | ''>('')
const filterProtocolId = ref<number | ''>('')
const filterEmployeeId = ref<number | ''>('')
const searchText = ref('')

const getEmployeeName = useEmployeeName(employeeStore.items)
const getProtocolTitle = (id: number): string => {
  const m = meetingStore.items.find((x) => x.id === id)
  return m ? m.title : `#${id}`
}

const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'submitted', label: 'Отправлена' },
  { value: 'reviewing', label: 'На рассмотрении' },
  { value: 'accepted', label: 'Принята' },
  { value: 'rejected', label: 'Отклонена' },
]

const { deleteItem } = useDeleteConfirm((id: number) => taskStore.remove(id), 'задачу')

const {
  showForm, editingId, formData, formError, formLoading,
  openCreate, openEdit, closeForm, submitForm,
} = useEntityForm<Task, TaskCreate>({
  entityName: 'Задача',
  defaultCreateValues: { protocolId: 0, employeeId: 0, title: '', description: '', deadline: '' },
  toCreateData: (t) => ({ protocolId: t.protocolId, employeeId: t.employeeId, title: t.title, description: t.description || '', deadline: t.deadline || '' }),
  onSubmit: async ({ isEdit, id, values }) => {
    if (isEdit && id) await taskStore.update(id, values)
    else await taskStore.create(values)
  },
  validate: () => {
    if (!formData.value.title.trim()) { formError.value = 'Название обязательно'; return false }
    if (!formData.value.protocolId) { formError.value = 'Выберите протокол'; return false }
    if (!formData.value.employeeId) { formError.value = 'Выберите ответственного'; return false }
    return true
  },
})

async function applyFilters() {
  await taskStore.fetchAll({
    status: filterStatus.value || undefined,
    protocolId: filterProtocolId.value || undefined,
    employeeId: filterEmployeeId.value || undefined,
    search: searchText.value.trim() || undefined,
  })
}

function clearFilters() {
  filterStatus.value = ''
  filterProtocolId.value = ''
  filterEmployeeId.value = ''
  searchText.value = ''
  applyFilters()
}

watch([filterStatus, filterProtocolId, filterEmployeeId], () => applyFilters())

async function markTaskDone(id: number) {
  try {
    await taskStore.markDone(id)
  } catch (e: unknown) {
    alert(errorMessage(e, 'Ошибка'))
  }
}

onMounted(async () => {
  await Promise.all([employeeStore.fetchAll(), meetingStore.fetchAll(), applyFilters()])
})
</script>

<template>
  <div class="view">
    <div class="view-header">
      <h2 class="view-title">Задачи</h2>
      <BaseButton variant="primary" @click="openCreate">Создать задачу</BaseButton>
    </div>

    <div class="filter-bar">
      <label class="filter-label">
        Статус:
        <select v-model="filterStatus" class="input filter-select">
          <option value="">Все</option>
          <option v-for="s in TASK_STATUSES" :key="s.value" :value="s.value">{{ s.label }}</option>
        </select>
      </label>
      <label class="filter-label">
        Протокол:
        <select v-model="filterProtocolId" class="input filter-select">
          <option :value="''">Все</option>
          <option v-for="m in meetingStore.items" :key="m.id" :value="m.id">{{ m.title }}</option>
        </select>
      </label>
      <label class="filter-label">
        Ответственный:
        <select v-model="filterEmployeeId" class="input filter-select">
          <option :value="''">Все</option>
          <option v-for="e in employeeStore.items" :key="e.id" :value="e.id">{{ e.name }}</option>
        </select>
      </label>
      <label class="filter-label">
        Поиск:
        <input v-model="searchText" type="text" class="input filter-input" placeholder="Название..." @keyup.enter="applyFilters" />
      </label>
      <button class="btn btn-sm btn-ghost" @click="clearFilters">Сбросить</button>
    </div>

    <div v-if="taskStore.loading" class="state-message">Загрузка...</div>
    <div v-else-if="taskStore.error" class="state-message state-error">{{ taskStore.error }}</div>
    <div v-else-if="taskStore.items.length === 0" class="state-message">Нет задач</div>

    <div v-else class="table-wrap">
      <table class="tasks-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Название</th>
            <th>Статус</th>
            <th>Ответственный</th>
            <th>Срок</th>
            <th>Протокол</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in taskStore.items" :key="t.id" class="table-row-clickable" @click="router.push(`/tasks/${t.id}`)">
            <td class="cell-id" data-label="#">TASK-{{ t.id }}</td>
            <td class="cell-title" data-label="Название">{{ t.title }}</td>
            <td data-label="Статус">
              <span :class="['status-badge', taskStatusClass(t.status)]">{{ taskStatusLabel(t.status) }}</span>
            </td>
            <td data-label="Ответственный">{{ getEmployeeName(t.employeeId) }}</td>
            <td data-label="Срок">{{ t.deadline ? formatDate(t.deadline) : '—' }}</td>
            <td data-label="Протокол">{{ getProtocolTitle(t.protocolId) }}</td>
            <td @click.stop>
              <BaseButton size="sm" variant="ghost" @click="openEdit(t)">Изменить</BaseButton>
              <BaseButton v-if="t.status !== 'accepted'" size="sm" variant="success" @click="markTaskDone(t.id)">Выполнить</BaseButton>
              <BaseButton size="sm" variant="ghost" class="btn-danger-text" @click="deleteItem(t.id)">Удалить</BaseButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Modal v-model="showForm" :title="editingId ? 'Изменить задачу' : 'Новая задача'">
      <form @submit.prevent="submitForm" class="form">
        <label class="field">
          <span class="field-label">Протокол *</span>
          <select v-model="formData.protocolId" class="input">
            <option :value="0" disabled>Выберите протокол</option>
            <option v-for="m in meetingStore.items" :key="m.id" :value="m.id">{{ m.title }}</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">Ответственный *</span>
          <select v-model="formData.employeeId" class="input">
            <option :value="0" disabled>Выберите сотрудника</option>
            <option v-for="e in employeeStore.items" :key="e.id" :value="e.id">{{ e.name }}</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">Название *</span>
          <input v-model="formData.title" class="input" required />
        </label>
        <label class="field">
          <span class="field-label">Описание</span>
          <textarea v-model="formData.description" class="input textarea" rows="3" />
        </label>
        <label class="field">
          <span class="field-label">Срок выполнения</span>
          <input type="date" v-model="formData.deadline" class="input" />
        </label>
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
.view { max-width: 68.75rem; container-type: inline-size; }

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

.filter-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.125rem;
  flex-wrap: wrap;
}

.filter-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.filter-select { width: 13.75rem; }
.filter-input { width: 10rem; }

.table-wrap {
  background: var(--color-bg-card);
  border: 0.0625rem solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.tasks-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.tasks-table th {
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

.tasks-table td {
  padding: 0.75rem 1rem;
  color: var(--color-text-secondary);
  border-bottom: 0.0625rem solid var(--color-bg);
  vertical-align: middle;
}

.tasks-table tbody tr:last-child td { border-bottom: none; }
.tasks-table tbody tr:hover { background: var(--color-bg-subtle); }

.table-row-clickable {
  cursor: pointer;
  transition: background 0.1s;
}

.cell-id {
  font-size: 0.75rem;
  color: var(--color-text-meta);
  font-family: monospace;
  white-space: nowrap;
}

.cell-title {
  font-weight: 500;
  color: var(--color-text);
}

.status-badge {
  display: inline-block;
  padding: 0.1875rem 0.625rem;
  border-radius: 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.status-submitted  { background: var(--color-badge-info-bg); color: var(--color-badge-info-text); }
.status-reviewing  { background: var(--color-badge-warning-bg); color: var(--color-warning-hover); }
.status-accepted   { background: var(--color-badge-positive-bg); color: var(--color-success); }
.status-rejected   { background: var(--color-badge-rejected-bg); color: var(--color-danger); }

.form { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.25rem; }
.field-label { font-size: 0.8125rem; font-weight: 500; color: var(--color-text-secondary); }

.input {
  padding: 0.5rem 0.75rem;
  border: 0.0625rem solid var(--color-border-input);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  color: var(--color-text);
  background: var(--color-bg-card);
  outline: none;
  transition: border-color 0.15s;
}

.input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 0.1875rem rgba(26, 86, 219, 0.1);
}

.textarea { resize: vertical; min-height: 3.75rem; }
.form-error { color: var(--color-danger); font-size: 0.8125rem; }
.form-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }

.state-message { padding: 2.5rem 0; text-align: center; color: var(--color-text-muted); font-size: 0.9375rem; }
.state-error { color: var(--color-danger); }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}

.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary { background: var(--color-primary); color: var(--color-bg-card); }
.btn-primary:hover:not(:disabled) { background: var(--color-primary-hover); }
.btn-secondary { background: var(--color-secondary); color: var(--color-text-secondary); }
.btn-secondary:hover:not(:disabled) { background: var(--color-secondary-hover); }
.btn-sm { padding: 0.25rem 0.625rem; font-size: 0.8125rem; }
.btn-ghost { background: transparent; color: var(--color-text-muted); }
.btn-ghost:hover { background: var(--color-bg); color: var(--color-text-secondary); }
.btn-danger { color: var(--color-danger); }
.btn-danger:hover { background: var(--color-badge-violation-bg); color: var(--color-danger-hover); }
.btn-success { background: var(--color-success); color: var(--color-bg-card); }
.btn-success:hover { background: var(--color-success-hover); }

@container (max-width: 40rem) {
  .view-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .filter-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.625rem;
  }

  .filter-select,
  .filter-input {
    width: 100%;
  }

  .tasks-table thead {
    display: none;
  }

  .tasks-table tbody,
  .tasks-table tr,
  .tasks-table td {
    display: block;
  }

  .tasks-table tr {
    padding: 0.875rem 1rem;
    border-bottom: 0.0625rem solid var(--color-border);
  }

  .tasks-table tr:last-child {
    border-bottom: none;
  }

  .tasks-table td {
    padding: 0.25rem 0;
    border-bottom: none;
  }

  .tasks-table td:first-child {
    font-weight: 600;
    font-size: 0.9375rem;
    color: var(--color-primary);
  }

  .tasks-table td:not(:first-child):not(:last-child)::before {
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

  .tasks-table td:last-child {
    padding-top: 0.5rem;
  }
}
</style>
