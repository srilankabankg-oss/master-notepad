<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useEmployeeStore } from '@/stores/employees'
import type { EmployeeCreate } from '@/types/api'
import { useEntityForm } from '@/composables/useEntityForm'
import { useDeleteConfirm } from '@/composables/useDeleteConfirm'
import Modal from '@/components/Modal.vue'

const store = useEmployeeStore()

const searchQuery = ref('')
const positionFilter = ref('')
const sortBy = ref<'name' | 'email' | 'position'>('name')
const sortDir = ref<'asc' | 'desc'>('asc')

const positions = computed(() => {
  const set = new Set(store.items.map(e => e.position).filter(Boolean))
  return Array.from(set).sort()
})

const filtered = computed(() => {
  let list = [...store.items]

  if (positionFilter.value) {
    list = list.filter(e => e.position === positionFilter.value)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      (e.position || '').toLowerCase().includes(q)
    )
  }

  list.sort((a, b) => {
    const va = (a[sortBy.value] || '').toLowerCase()
    const vb = (b[sortBy.value] || '').toLowerCase()
    const cmp = va.localeCompare(vb)
    return sortDir.value === 'asc' ? cmp : -cmp
  })

  return list
})

function toggleSort(col: 'name' | 'email' | 'position') {
  if (sortBy.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = col
    sortDir.value = 'asc'
  }
}

function sortIndicator(col: 'name' | 'email' | 'position') {
  if (sortBy.value !== col) return ''
  return sortDir.value === 'asc' ? ' ▲' : ' ▼'
}

function clearFilters() {
  searchQuery.value = ''
  positionFilter.value = ''
}

const { showForm, editingId, formData, formError, formLoading, openCreate, openEdit, closeForm, submitForm } = useEntityForm({
  entityName: 'Сотрудник',
  defaultCreateValues: { name: '', email: '', position: '' },
  toCreateData: (emp: any) => ({ name: emp.name, email: emp.email, position: emp.position || '' }),
  onSubmit: async ({ isEdit, id, values }: { isEdit: boolean; id: number | null; values: EmployeeCreate }) => {
    if (isEdit && id) await store.update(id, values)
    else await store.create(values)
  },
  validate: () => {
    if (!formData.value.name.trim()) { formError.value = 'Имя обязательно'; return false }
    if (!formData.value.email.trim()) { formError.value = 'Email обязателен'; return false }
    return true
  },
})

const { deleteItem } = useDeleteConfirm((id: number) => store.remove(id), 'сотрудника')

onMounted(() => {
  store.fetchAll()
})
</script>

<template>
  <div class="view">
    <div class="view-header">
      <h2 class="view-title">Список сотрудников</h2>
      <button class="btn btn-primary" @click="openCreate">Добавить сотрудника</button>
    </div>

    <div class="filter-bar">
      <label class="filter-label">
        Поиск:
        <input v-model="searchQuery" type="text" class="input filter-input" placeholder="Имя, email или должность..." />
      </label>
      <label class="filter-label">
        Должность:
        <select v-model="positionFilter" class="input filter-select">
          <option value="">Все</option>
          <option v-for="pos in positions" :key="pos" :value="pos">{{ pos }}</option>
        </select>
      </label>
      <button class="btn btn-sm btn-ghost" @click="clearFilters">Сбросить</button>
    </div>

    <div v-if="store.loading" class="state-message">Загрузка...</div>
    <div v-else-if="store.error" class="state-message state-error">{{ store.error }}</div>
    <div v-else-if="filtered.length === 0" class="state-message">Нет сотрудников</div>

    <table v-else class="table">
      <thead>
        <tr>
          <th class="th-sortable" @click="toggleSort('name')">Имя{{ sortIndicator('name') }}</th>
          <th class="th-sortable" @click="toggleSort('email')">Email{{ sortIndicator('email') }}</th>
          <th class="th-sortable" @click="toggleSort('position')">Должность{{ sortIndicator('position') }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="emp in filtered" :key="emp.id">
          <td class="cell-name" data-label="Имя">{{ emp.name }}</td>
          <td data-label="Email">{{ emp.email }}</td>
          <td data-label="Должность">{{ emp.position || '-' }}</td>
          <td>
            <button class="btn btn-sm btn-ghost" @click="openEdit(emp)">Изменить</button>
            <button class="btn btn-sm btn-ghost btn-danger" @click="deleteItem(emp.id)">Удалить</button>
          </td>
        </tr>
      </tbody>
    </table>

    <Modal v-model="showForm" :title="editingId ? 'Изменить сотрудника' : 'Новый сотрудник'">
      <form @submit.prevent="submitForm" class="form">
        <label class="field">
          <span class="field-label">Имя *</span>
          <input v-model="formData.name" class="input" required />
        </label>
        <label class="field">
          <span class="field-label">Email *</span>
          <input v-model="formData.email" type="email" class="input" required />
        </label>
        <label class="field">
          <span class="field-label">Должность</span>
          <input v-model="formData.position" class="input" />
        </label>
        <div v-if="formError" class="form-error">{{ formError }}</div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" @click="closeForm">Отмена</button>
          <button type="submit" class="btn btn-primary" :disabled="formLoading">
            {{ formLoading ? 'Сохранение...' : 'Сохранить' }}
          </button>
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

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.filter-label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.filter-input {
  min-width: 16rem;
}

.filter-select {
  min-width: 12rem;
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

.th-sortable {
  cursor: pointer;
  user-select: none;
  transition: color 0.15s;
}

.th-sortable:hover {
  color: var(--color-primary);
}

.table td {
  padding: 0.75rem 1rem;
  border-bottom: 0.0625rem solid var(--color-bg);
  color: var(--color-text-secondary);
}

.cell-name {
  font-weight: 500;
  color: var(--color-primary);
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

  .filter-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-input,
  .filter-select {
    min-width: 0;
    width: 100%;
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
}
</style>