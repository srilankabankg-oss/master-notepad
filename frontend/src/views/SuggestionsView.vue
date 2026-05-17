<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useSuggestionStore } from '@/stores/suggestions'
import { useEmployeeStore } from '@/stores/employees'
import type { SuggestionStatus } from '@/types/api'
import { errorMessage } from '@/api/client'

const suggestionStore = useSuggestionStore()
const employeeStore = useEmployeeStore()

const filterChecklistId = ref<number | undefined>(undefined)
const filterInput = ref('')

function applyFilter() {
  const val = filterInput.value.trim()
  filterChecklistId.value = val ? Number(val) : undefined
}

function clearFilter() {
  filterInput.value = ''
  filterChecklistId.value = undefined
}

function getEmployeeName(id: number): string {
  return employeeStore.items.find((e) => e.id === id)?.name || (id != null ? `#${id}` : '—')
}

function statusLabel(status: SuggestionStatus): string {
  const map: Record<SuggestionStatus, string> = {
    pending: 'На рассмотрении',
    approved: 'Одобрено',
    rejected: 'Отклонено',
  }
  return map[status]
}

async function approve(id: number) {
  try {
    await suggestionStore.update(id, { status: 'approved' })
  } catch (e: unknown) {
    alert(errorMessage(e, 'Ошибка'))
  }
}

async function reject(id: number) {
  try {
    await suggestionStore.update(id, { status: 'rejected' })
  } catch (e: unknown) {
    alert(errorMessage(e, 'Ошибка'))
  }
}

async function deleteSuggestion(id: number) {
  if (!confirm('Удалить предложение?')) return
  try {
    await suggestionStore.remove(id)
  } catch (e: unknown) {
    alert(errorMessage(e, 'Ошибка'))
  }
}

async function loadData() {
  await suggestionStore.fetchAll(filterChecklistId.value)
}

watch(filterChecklistId, () => loadData())

onMounted(async () => {
  await Promise.all([employeeStore.fetchAll(), loadData()])
})
</script>

<template>
  <div class="view">
    <div class="view-header">
      <h2 class="view-title">Предложения по улучшению</h2>
    </div>

    <div class="filter-bar">
      <label class="filter-label">
        ID чек-листа:
        <input
          v-model="filterInput"
          type="number"
          class="input filter-input"
          placeholder="Введите ID..."
          @keyup.enter="applyFilter"
        />
      </label>
      <button class="btn btn-sm btn-ghost" @click="applyFilter">Применить</button>
      <button v-if="filterChecklistId !== undefined" class="btn btn-sm btn-ghost" @click="clearFilter">Сбросить</button>
    </div>

    <div v-if="suggestionStore.loading" class="state-message">Загрузка...</div>
    <div v-else-if="suggestionStore.error" class="state-message state-error">{{ suggestionStore.error }}</div>
    <div v-else-if="suggestionStore.items.length === 0" class="state-message">Нет предложений</div>

    <div v-else class="table-wrap">
      <table class="suggestions-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Чек-лист</th>
            <th>Сотрудник</th>
            <th>Предложение</th>
            <th>Статус</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in suggestionStore.items" :key="s.id">
            <td class="cell-id" data-label="ID">{{ s.id }}</td>
            <td class="cell-id" data-label="Чек-лист">#{{ s.checklistId }}</td>
            <td data-label="Сотрудник">{{ getEmployeeName(s.employeeId) }}</td>
            <td class="cell-text" data-label="Предложение">{{ s.suggestion }}</td>
            <td data-label="Статус">
              <span :class="['status-badge', `status-${s.status}`]">
                {{ statusLabel(s.status) }}
              </span>
            </td>
            <td class="cell-actions">
              <button
                v-if="s.status === 'pending'"
                class="btn btn-sm btn-success"
                @click="approve(s.id)"
              >
                Одобрить
              </button>
              <button
                v-if="s.status === 'pending'"
                class="btn btn-sm btn-warning"
                @click="reject(s.id)"
              >
                Отклонить
              </button>
              <button
                class="btn btn-sm btn-ghost btn-danger"
                @click="deleteSuggestion(s.id)"
              >
                Удалить
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.view { max-width: 62.5rem; container-type: inline-size; }

.view-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 1.25rem;
}

.view-title { font-size: 1.125rem; font-weight: 600; color: #111827; }

.filter-bar {
  display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.125rem;
}

.filter-label {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.875rem; font-weight: 500; color: #374151;
}

.filter-input { width: 10rem; }

.table-wrap {
  background: #ffffff; border: 0.0625rem solid #e5e7eb;
  border-radius: 0.5rem; overflow: hidden;
}

.suggestions-table {
  width: 100%; border-collapse: collapse;
  font-size: 0.875rem;
}

.suggestions-table th {
  text-align: left; padding: 0.75rem 1rem;
  font-size: 0.75rem; font-weight: 600; color: #6b7280;
  text-transform: uppercase; letter-spacing: 0.0.3125rem;
  background: #f9fafb; border-bottom: 0.0625rem solid #e5e7eb;
}

.suggestions-table td {
  padding: 0.75rem 1rem; color: #374151;
  border-bottom: 0.0625rem solid #f3f4f6; vertical-align: middle;
}

.suggestions-table tr:last-child td { border-bottom: none; }

.suggestions-table tbody tr:hover { background: #f9fafb; }

.cell-id {
  font-size: 0.75rem; color: #9ca3af; font-family: monospace; white-space: nowrap;
}

.cell-text {
  max-width: 20rem; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-actions {
  display: flex; gap: 0.25rem; white-space: nowrap;
}

.status-badge {
  display: inline-block; padding: 0.1875rem 0.625rem; border-radius: 0.75rem;
  font-size: 0.75rem; font-weight: 600; white-space: nowrap;
}

.status-pending   { background: #fef9c3; color: #a16207; }
.status-approved  { background: #dcfce7; color: #16a34a; }
.status-rejected  { background: #fee2e2; color: #dc2626; }

.btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0.5rem 1rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500;
  border: none; cursor: pointer; transition: background 0.15s;
}

.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary { background: #1a56db; color: #ffffff; }
.btn-primary:hover:not(:disabled) { background: #1e40af; }
.btn-secondary { background: #e5e7eb; color: #374151; }
.btn-secondary:hover:not(:disabled) { background: #d1d5db; }
.btn-sm { padding: 0.25rem 0.625rem; font-size: 0.8125rem; }
.btn-ghost { background: transparent; color: #6b7280; }
.btn-ghost:hover { background: #f3f4f6; color: #374151; }
.btn-danger { color: #dc2626; }
.btn-danger:hover { background: #fef2f2; color: #b91c1c; }

.btn-success {
  background: #16a34a; color: #ffffff;
}
.btn-success:hover { background: #15803d; }

.btn-warning {
  background: #ca8a04; color: #ffffff;
}
.btn-warning:hover { background: #a16207; }

.state-message { padding: 2.5rem 0; text-align: center; color: #6b7280; font-size: 0.9375rem; }
.state-error { color: #dc2626; }

.input {
  padding: 0.5rem 0.75rem; border: 0.0625rem solid #d1d5db; border-radius: 0.375rem;
  font-size: 0.875rem; color: #111827; background: #ffffff; outline: none;
}

.input:focus { border-color: #1a56db; box-shadow: 0 0 0 0.1875rem rgba(26, 86, 219, 0.1); }

@container (max-width: 40rem) {
  .view-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .filter-bar {
    flex-wrap: wrap;
  }

  .suggestions-table thead {
    display: none;
  }

  .suggestions-table tbody,
  .suggestions-table tr,
  .suggestions-table td {
    display: block;
  }

  .suggestions-table tr {
    padding: 0.875rem 1rem;
    border-bottom: 0.0625rem solid #e5e7eb;
  }

  .suggestions-table tr:last-child {
    border-bottom: none;
  }

  .suggestions-table td {
    padding: 0.25rem 0;
    border-bottom: none;
  }

  .suggestions-table td:nth-child(1) {
    font-weight: 600;
    font-size: 0.8125rem;
  }

  .suggestions-table td:not(:first-child):not(:last-child)::before {
    content: attr(data-label);
    display: inline-block;
    width: 6.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }

  .suggestions-table td:last-child {
    padding-top: 0.5rem;
  }

  .cell-text {
    max-width: none;
    white-space: normal;
  }

  .table-wrap {
    border: none;
    background: transparent;
  }
}
</style>
