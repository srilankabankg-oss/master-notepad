<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useEventStore } from '@/stores/events'
import { useSubcontractorStore } from '@/stores/subcontractors'
import { useEmployeeStore } from '@/stores/employees'
import { useChecklistStore } from '@/stores/checklists'
import type { ContractorEvent, ContractorEventCreate, EventType } from '@/types/api'
import { errorMessage } from '@/api/client'

const eventStore = useEventStore()
const subcontractorStore = useSubcontractorStore()
const employeeStore = useEmployeeStore()
const checklistStore = useChecklistStore()

const filterSubId = ref<number | undefined>(undefined)
const eventTypes: EventType[] = ['positive', 'violation', 'info']

const showForm = ref(false)
const editingId = ref<number | null>(null)
const formData = ref<ContractorEventCreate>({
  subcontractorId: 0,
  employeeId: 0,
  type: 'info',
  description: '',
  eventDate: new Date().toISOString().slice(0, 16),
})
const formError = ref('')
const formLoading = ref(false)

const suggestModal = ref(false)
const suggestEventId = ref<number | null>(null)
const suggestChecklistId = ref<number>(0)
const suggestEmployeeId = ref<number>(0)
const suggestError = ref('')
const suggestLoading = ref(false)

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ru-RU')
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU')
}

function getSubcontractorName(id: number): string {
  return subcontractorStore.items.find((s) => s.id === id)?.name || (id != null ? `#${id}` : '—')
}

function getEmployeeName(id: number): string {
  return employeeStore.items.find((e) => e.id === id)?.name || (id != null ? `#${id}` : '—')
}

function eventTypeLabel(type: EventType): string {
  return { positive: 'Позитивное', violation: 'Нарушение', info: 'Информация' }[type]
}

function eventTypeClass(type: EventType): string {
  return `badge-${type}`
}

function openCreate() {
  editingId.value = null
  formData.value = {
    subcontractorId: filterSubId.value || 0,
    employeeId: 0,
    type: 'info',
    description: '',
    eventDate: new Date().toISOString().slice(0, 16),
  }
  formError.value = ''
  showForm.value = true
}

function openEdit(ev: ContractorEvent) {
  editingId.value = ev.id
  formData.value = {
    subcontractorId: ev.subcontractor_id,
    employeeId: ev.employee_id,
    type: ev.type,
    description: ev.description,
    eventDate: new Date(ev.event_date).toISOString().slice(0, 16),
  }
  formError.value = ''
  showForm.value = true
}

function closeForm() { showForm.value = false }

async function submitForm() {
  if (!formData.value.description.trim()) { formError.value = 'Описание обязательно'; return }
  if (!formData.value.subcontractorId) { formError.value = 'Выберите подрядчика'; return }
  if (!formData.value.employeeId) { formError.value = 'Выберите сотрудника'; return }
  formLoading.value = true
  formError.value = ''
  try {
    if (editingId.value) {
      await eventStore.update(editingId.value, { ...formData.value })
    } else {
      await eventStore.create({ ...formData.value })
    }
    showForm.value = false
  } catch (e: unknown) {
    formError.value = errorMessage(e, 'Ошибка')
  } finally {
    formLoading.value = false
  }
}

async function deleteItem(id: number) {
  if (!confirm('Удалить событие?')) return
  try { await eventStore.remove(id) } catch (e: unknown) { alert(errorMessage(e, 'Ошибка')) }
}

function openSuggest(ev: ContractorEvent) {
  suggestEventId.value = ev.id
  suggestChecklistId.value = 0
  suggestEmployeeId.value = ev.employee_id
  suggestError.value = ''
  suggestModal.value = true
}

function closeSuggest() { suggestModal.value = false }

async function submitSuggest() {
  if (!suggestChecklistId.value) { suggestError.value = 'Выберите чек-лист'; return }
  if (!suggestEmployeeId.value) { suggestError.value = 'Выберите сотрудника'; return }
  suggestLoading.value = true
  suggestError.value = ''
  try {
    if (suggestEventId.value) {
      await eventStore.suggestToChecklist(suggestEventId.value, suggestChecklistId.value, suggestEmployeeId.value)
    }
    suggestModal.value = false
  } catch (e: unknown) {
    suggestError.value = errorMessage(e, 'Ошибка')
  } finally {
    suggestLoading.value = false
  }
}

async function loadData() {
  await eventStore.fetchAll(filterSubId.value)
}

watch(filterSubId, () => loadData())

onMounted(async () => {
  await Promise.all([
    subcontractorStore.fetchAll(),
    employeeStore.fetchAll(),
    checklistStore.fetchAll(),
    loadData(),
  ])
})
</script>

<template>
  <div class="view">
    <div class="view-header">
      <h2 class="view-title">События</h2>
      <button class="btn btn-primary" @click="openCreate">Добавить событие</button>
    </div>

    <div class="filter-bar">
      <label class="filter-label">
        Подрядчик:
        <select v-model="filterSubId" class="input filter-select">
          <option :value="undefined">Все</option>
          <option v-for="s in subcontractorStore.items" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </label>
    </div>

    <div v-if="eventStore.loading" class="state-message">Загрузка...</div>
    <div v-else-if="eventStore.error" class="state-message state-error">{{ eventStore.error }}</div>
    <div v-else-if="eventStore.items.length === 0" class="state-message">Нет событий</div>

    <div v-else class="event-list">
      <div v-for="ev in eventStore.items" :key="ev.id" class="event-card">
        <div class="event-head">
          <div class="event-head-left">
            <span :class="['event-badge', eventTypeClass(ev.type)]">{{ eventTypeLabel(ev.type) }}</span>
            <span class="event-date">{{ formatDate(ev.event_date) }}</span>
          </div>
          <div class="event-head-right">
            <span class="event-meta">{{ getSubcontractorName(ev.subcontractor_id) }}</span>
            <span class="event-meta-sep">&middot;</span>
            <span class="event-meta">{{ getEmployeeName(ev.employee_id) }}</span>
          </div>
        </div>
        <div class="event-body">{{ ev.description }}</div>
        <div class="event-actions">
          <button class="btn btn-sm btn-ghost" @click="openEdit(ev)">Изменить</button>
          <button class="btn btn-sm btn-ghost" @click="openSuggest(ev)">Предложить в чек-лист</button>
          <button class="btn btn-sm btn-ghost btn-danger" @click="deleteItem(ev.id)">Удалить</button>
        </div>
      </div>
    </div>

    <div v-if="showForm" class="modal-overlay" @click.self="closeForm">
      <div class="modal">
        <h3 class="modal-title">{{ editingId ? 'Изменить событие' : 'Новое событие' }}</h3>
        <div class="form">
          <label class="field">
            <span class="field-label">Подрядчик *</span>
            <select v-model="formData.subcontractorId" class="input">
              <option :value="0" disabled>Выберите подрядчика</option>
              <option v-for="s in subcontractorStore.items" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">Сотрудник *</span>
            <select v-model="formData.employeeId" class="input">
              <option :value="0" disabled>Выберите сотрудника</option>
              <option v-for="emp in employeeStore.items" :key="emp.id" :value="emp.id">{{ emp.name }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">Тип</span>
            <select v-model="formData.type" class="input">
              <option v-for="t in eventTypes" :key="t" :value="t">{{ eventTypeLabel(t) }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">Описание *</span>
            <textarea v-model="formData.description" class="input textarea" rows="3" />
          </label>
          <label class="field">
            <span class="field-label">Дата события</span>
            <input type="datetime-local" v-model="formData.eventDate" class="input" />
          </label>
          <div v-if="formError" class="form-error">{{ formError }}</div>
          <div class="form-actions">
            <button class="btn btn-secondary" @click="closeForm">Отмена</button>
            <button class="btn btn-primary" :disabled="formLoading" @click="submitForm">Сохранить</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="suggestModal" class="modal-overlay" @click.self="closeSuggest">
      <div class="modal">
        <h3 class="modal-title">Предложить в чек-лист</h3>
        <div class="form">
          <label class="field">
            <span class="field-label">Чек-лист *</span>
            <select v-model="suggestChecklistId" class="input">
              <option :value="0" disabled>Выберите чек-лист</option>
              <option v-for="c in checklistStore.items" :key="c.id" :value="c.id">{{ c.title }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">Сотрудник *</span>
            <select v-model="suggestEmployeeId" class="input">
              <option :value="0" disabled>Выберите сотрудника</option>
              <option v-for="emp in employeeStore.items" :key="emp.id" :value="emp.id">{{ emp.name }}</option>
            </select>
          </label>
          <div v-if="suggestError" class="form-error">{{ suggestError }}</div>
          <div class="form-actions">
            <button class="btn btn-secondary" @click="closeSuggest">Отмена</button>
            <button class="btn btn-primary" :disabled="suggestLoading" @click="submitSuggest">Предложить</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view { max-width: 56.25rem; container-type: inline-size; }

.view-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 1.25rem;
}

.view-title { font-size: 1.125rem; font-weight: 600; color: #111827; }

.filter-bar { margin-bottom: 1.125rem; }

.filter-label {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.875rem; font-weight: 500; color: #374151;
}

.filter-select { width: 16.25rem; }

.event-list { display: flex; flex-direction: column; gap: 0.75rem; }

.event-card {
  background: #ffffff; border: 0.0625rem solid #e5e7eb;
  border-radius: 0.5rem; padding: 1.125rem 1.25rem;
}

.event-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 0.625rem; flex-wrap: wrap; gap: 0.375rem;
}

.event-head-left { display: flex; align-items: center; gap: 0.625rem; }

.event-head-right { display: flex; align-items: center; gap: 0.375rem; }

.event-badge {
  display: inline-flex; align-items: center;
  padding: 0.125rem 0.625rem; border-radius: 0.75rem;
  font-size: 0.75rem; font-weight: 600;
}

.badge-positive { background: #dcfce7; color: #166534; }
.badge-violation { background: #fef2f2; color: #991b1b; }
.badge-info { background: #dbeafe; color: #1e40af; }

.event-date {
  font-size: 0.8125rem; color: #9ca3af; font-weight: 500;
}

.event-meta {
  font-size: 0.8125rem; color: #6b7280;
}

.event-meta-sep { color: #d1d5db; }

.event-body {
  font-size: 0.875rem; color: #374151; line-height: 1.6;
  margin-bottom: 0.625rem;
}

.event-actions { display: flex; gap: 0.25rem; }

.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}

.modal {
  background: #ffffff; border-radius: 0.75rem;
  padding: 1.75rem; width: 33.75rem; max-width: 90vw;
  box-shadow: 0 1.25rem 3.75rem rgba(0, 0, 0, 0.15);
}

.modal-title { font-size: 1.125rem; font-weight: 600; margin-bottom: 1.25rem; color: #111827; }

.form { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.25rem; }
.field-label { font-size: 0.8125rem; font-weight: 500; color: #374151; }

.input {
  padding: 0.5rem 0.75rem; border: 0.0625rem solid #d1d5db; border-radius: 0.375rem;
  font-size: 0.875rem; color: #111827; background: #ffffff; outline: none;
}

.input:focus { border-color: #1a56db; box-shadow: 0 0 0 0.1875rem rgba(26, 86, 219, 0.1); }
.textarea { resize: vertical; min-height: 3.75rem; }

.form-error { color: #dc2626; font-size: 0.8125rem; }
.form-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }

.state-message { padding: 2.5rem 0; text-align: center; color: #6b7280; font-size: 0.9375rem; }
.state-error { color: #dc2626; }

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

@container (max-width: 40rem) {
  .view-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .filter-bar {
    flex-direction: column;
  }

  .filter-select {
    width: 100%;
  }

  .event-card {
    padding: 0.875rem 1rem;
  }

  .event-head {
    flex-direction: column;
    align-items: flex-start;
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
