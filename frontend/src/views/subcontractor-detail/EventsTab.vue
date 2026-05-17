<script setup lang="ts">
import { ref } from 'vue'
import type { ContractorEvent, ContractorEventCreate } from '@/types/api'
import { useEventStore } from '@/stores/events'
import { useEmployeeStore } from '@/stores/employees'
import { useChecklistStore } from '@/stores/checklists'
import { errorMessage } from '@/api/client'
import { useEmployeeName } from '@/composables/useEntityName'
import { formatDate } from '@/composables/useDateFormatter'
import { eventTypeLabel, EVENT_TYPES } from '@/composables/useEventLabels'
import { useEntityForm } from '@/composables/useEntityForm'
import { useDeleteConfirm } from '@/composables/useDeleteConfirm'
import EventBadge from '@/components/EventBadge.vue'
import Modal from '@/components/Modal.vue'
import BaseButton from '@/components/BaseButton.vue'

const props = defineProps<{ subId: number }>()
const emit = defineEmits<{ refresh: [] }>()

const eventStore = useEventStore()
const { items: employees } = useEmployeeStore()
const checklistStore = useChecklistStore()

const getEmployeeName = useEmployeeName(employees)

const eventTypes = [...EVENT_TYPES] as const

const { deleteItem } = useDeleteConfirm((id) => eventStore.remove(id), 'событие')

const {
  showForm, editingId, formData, formError, formLoading,
  openCreate, openEdit, closeForm, submitForm,
} = useEntityForm<ContractorEvent, ContractorEventCreate>({
  entityName: 'Событие',
  defaultCreateValues: { subcontractorId: props.subId, employeeId: 0, type: 'info', description: '', eventDate: new Date().toISOString().slice(0, 16) },
  toCreateData: (ev) => ({ subcontractorId: ev.subcontractorId, employeeId: ev.employeeId, type: ev.type, description: ev.description, eventDate: new Date(ev.eventDate).toISOString().slice(0, 16) }),
  onSubmit: async ({ isEdit, id, values }) => {
    if (isEdit && id != null) await eventStore.update(id, values)
    else await eventStore.create(values)
    emit('refresh')
  },
  validate: () => {
    if (!formData.value.description.trim()) { formError.value = 'Описание обязательно'; return false }
    if (!formData.value.employeeId) { formError.value = 'Выберите сотрудника'; return false }
    return true
  },
})

const suggestModal = ref(false)
const suggestEventId = ref<number | null>(null)
const suggestChecklistId = ref(0)
const suggestEmployeeId = ref(0)
const suggestError = ref('')
const suggestLoading = ref(false)

function openSuggest(ev: ContractorEvent) {
  suggestEventId.value = ev.id
  suggestChecklistId.value = 0
  suggestEmployeeId.value = ev.employeeId
  suggestError.value = ''
  suggestModal.value = true
}

async function submitSuggest() {
  if (!suggestChecklistId.value) { suggestError.value = 'Выберите чек-лист'; return }
  if (!suggestEmployeeId.value) { suggestError.value = 'Выберите сотрудника'; return }
  suggestLoading.value = true
  suggestError.value = ''
  try {
    if (suggestEventId.value) await eventStore.suggestToChecklist(suggestEventId.value, suggestChecklistId.value, suggestEmployeeId.value)
    suggestModal.value = false
  } catch (e: unknown) {
    suggestError.value = errorMessage(e, 'Ошибка')
  } finally {
    suggestLoading.value = false
  }
}
</script>

<template>
  <div class="tab-content">
    <BaseButton variant="primary" size="sm" @click="openCreate">Записать событие</BaseButton>

    <Modal v-model="showForm" :title="editingId ? 'Изменить событие' : 'Новое событие'">
      <form @submit.prevent="submitForm" class="form">
        <label class="field">
          <span class="field-label">Сотрудник *</span>
          <select v-model="formData.employeeId" class="input">
            <option :value="0" disabled>Выберите сотрудника</option>
            <option v-for="emp in employees" :key="emp.id" :value="emp.id">{{ emp.name }}</option>
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

    <div v-if="eventStore.items.length === 0 && !showForm" class="state-message">Нет событий</div>

    <div v-for="ev in eventStore.items" :key="ev.id" class="item-card">
      <div class="item-head">
        <EventBadge :type="ev.type" />
        <span class="item-date">{{ formatDate(ev.eventDate) }}</span>
        <span class="item-author">{{ getEmployeeName(ev.employeeId) }}</span>
        <BaseButton variant="ghost" size="sm" @click="openEdit(ev)">Изменить</BaseButton>
        <BaseButton variant="ghost" size="sm" @click="deleteItem(ev.id)">Удалить</BaseButton>
        <BaseButton variant="ghost" size="sm" @click="openSuggest(ev)">В чек-лист</BaseButton>
      </div>
      <div class="item-body">{{ ev.description }}</div>
    </div>

    <Modal v-model="suggestModal" title="Предложить в чек-лист">
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
            <option v-for="emp in employees" :key="emp.id" :value="emp.id">{{ emp.name }}</option>
          </select>
        </label>
        <div v-if="suggestError" class="form-error">{{ suggestError }}</div>
        <div class="form-actions">
          <BaseButton variant="secondary" type="button" @click="suggestModal = false">Отмена</BaseButton>
          <BaseButton variant="primary" type="button" :disabled="suggestLoading" @click="submitSuggest">Предложить</BaseButton>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
@container (max-width: 40rem) {
  .item-head {
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .item-card {
    padding: 0.75rem 0.875rem;
  }
  .item-date {
    margin-left: 0;
  }
}
</style>
