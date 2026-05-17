<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useEventStore } from '@/stores/events'
import { useSubcontractorStore } from '@/stores/subcontractors'
import { useEmployeeStore } from '@/stores/employees'
import { useChecklistStore } from '@/stores/checklists'
import type { ContractorEvent, ContractorEventCreate, EventType } from '@/types/api'
import { useEmployeeName, useSubcontractorName } from '@/composables/useEntityName'
import { formatDate } from '@/composables/useDateFormatter'
import { useEntityForm } from '@/composables/useEntityForm'
import { useDeleteConfirm } from '@/composables/useDeleteConfirm'
import { eventTypeLabel, EVENT_TYPES } from '@/composables/useEventLabels'
import EventBadge from '@/components/EventBadge.vue'
import Modal from '@/components/Modal.vue'
import BaseButton from '@/components/BaseButton.vue'

const eventStore = useEventStore()
const subcontractorStore = useSubcontractorStore()
const employeeStore = useEmployeeStore()
const checklistStore = useChecklistStore()

const filterSubId = ref<number | undefined>(undefined)
const eventTypes = EVENT_TYPES

const getEmployeeName = useEmployeeName(employeeStore.items)
const getSubcontractorName = useSubcontractorName(subcontractorStore.items)

const {
  showForm, editingId, formData, formError, formLoading,
  openCreate, openEdit, closeForm, submitForm,
} = useEntityForm({
  entityName: 'Событие',
  defaultCreateValues: {
    subcontractorId: 0, employeeId: 0, type: 'info' as EventType,
    description: '', eventDate: new Date().toISOString().slice(0, 16),
  },
  toCreateData: (ev: ContractorEvent) => ({
    subcontractorId: ev.subcontractorId,
    employeeId: ev.employeeId,
    type: ev.type,
    description: ev.description,
    eventDate: new Date(ev.eventDate).toISOString().slice(0, 16),
  }),
  onSubmit: async ({ isEdit, id, values }) => {
    if (isEdit && id !== null) await eventStore.update(id, values)
    else await eventStore.create(values)
  },
  validate: () => {
    if (!formData.value.description.trim()) { formError.value = 'Описание обязательно'; return false }
    if (!formData.value.subcontractorId) { formError.value = 'Выберите подрядчика'; return false }
    if (!formData.value.employeeId) { formError.value = 'Выберите сотрудника'; return false }
    return true
  },
})

const { deleteItem } = useDeleteConfirm((id: number) => eventStore.remove(id), 'событие')

const suggestModal = ref(false)
const suggestEventId = ref<number | null>(null)
const suggestChecklistId = ref<number>(0)
const suggestEmployeeId = ref<number>(0)
const suggestError = ref('')
const suggestLoading = ref(false)

function openSuggest(ev: ContractorEvent) {
  suggestEventId.value = ev.id
  suggestChecklistId.value = 0
  suggestEmployeeId.value = ev.employeeId
  suggestError.value = ''
  suggestModal.value = true
}

function closeSuggest() { suggestModal.value = false }

function errorMessage(e: unknown, fallback = 'Ошибка'): string {
  return e instanceof Error ? e.message : fallback
}

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
      <BaseButton variant="primary" @click="openCreate">Добавить событие</BaseButton>
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
            <EventBadge :type="ev.type" />
            <span class="event-date">{{ formatDate(ev.eventDate) }}</span>
          </div>
          <div class="event-head-right">
            <span class="event-meta">{{ getSubcontractorName(ev.subcontractorId) }}</span>
            <span class="event-meta-sep">&middot;</span>
            <span class="event-meta">{{ getEmployeeName(ev.employeeId) }}</span>
          </div>
        </div>
        <div class="event-body">{{ ev.description }}</div>
        <div class="event-actions">
          <BaseButton variant="ghost" size="sm" @click="openEdit(ev)">Изменить</BaseButton>
          <BaseButton variant="ghost" size="sm" @click="openSuggest(ev)">Предложить в чек-лист</BaseButton>
          <BaseButton variant="ghost" size="sm" @click="deleteItem(ev.id)">Удалить</BaseButton>
        </div>
      </div>
    </div>

    <Modal v-model="showForm" :title="editingId ? 'Изменить событие' : 'Новое событие'">
      <form @submit.prevent="submitForm" class="form">
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
          <BaseButton variant="secondary" type="button" @click="closeForm">Отмена</BaseButton>
          <BaseButton variant="primary" type="submit" :disabled="formLoading">Сохранить</BaseButton>
        </div>
      </form>
    </Modal>

    <Modal v-model="suggestModal" :title="'Предложить в чек-лист'">
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
          <BaseButton variant="secondary" type="button" @click="closeSuggest">Отмена</BaseButton>
          <BaseButton variant="primary" type="button" :disabled="suggestLoading" @click="submitSuggest">Предложить</BaseButton>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.view { max-width: 56.25rem; container-type: inline-size; }

.filter-bar { margin-bottom: var(--space-5); }

.filter-label {
  display: flex; align-items: center; gap: var(--space-2);
  font-size: var(--font-size-base); font-weight: var(--font-weight-medium); color: var(--color-text-secondary);
}

.filter-select { width: 16.25rem; }

.event-list { display: flex; flex-direction: column; gap: var(--space-3); }

.event-card {
  background: var(--color-bg-card); border: 0.0625rem solid var(--color-border);
  border-radius: var(--radius-md); padding: 1.125rem 1.25rem;
}

.event-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 0.625rem; flex-wrap: wrap; gap: 0.375rem;
}

.event-head-left { display: flex; align-items: center; gap: 0.625rem; }

.event-head-right { display: flex; align-items: center; gap: 0.375rem; }

.event-date {
  font-size: 0.8125rem; color: var(--color-text-meta); font-weight: 500;
}

.event-meta {
  font-size: 0.8125rem; color: var(--color-text-muted);
}

.event-meta-sep { color: var(--color-border-input); }

.event-body {
  font-size: var(--font-size-base); color: var(--color-text-secondary); line-height: 1.6;
  margin-bottom: 0.625rem;
}

.event-actions { display: flex; gap: 0.25rem; }

@container (max-width: 40rem) {
  .view-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
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
}
</style>
