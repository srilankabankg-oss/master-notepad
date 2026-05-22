<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMeetingStore } from '@/stores/meetings'
import { useEmployeeStore } from '@/stores/employees'
import type { Meeting, MeetingCreate, MeetingType, MeetingPeriodicity, GroupingMethod } from '@/types/api'
import { useEntityForm } from '@/composables/useEntityForm'
import { errorMessage } from '@/api/client'
import BaseButton from '@/components/BaseButton.vue'
import Modal from '@/components/Modal.vue'

const router = useRouter()
const meetingStore = useMeetingStore()
const employeeStore = useEmployeeStore()

const MEETING_TYPES: { value: MeetingType; label: string }[] = [
  { value: 'strategic', label: 'Стратегическое' },
  { value: 'coordination', label: 'Координационное' },
  { value: 'operational', label: 'Оперативное' },
  { value: 'problem', label: 'Проблемное' },
]

const PERIODICITY_OPTIONS: { value: MeetingPeriodicity; label: string }[] = [
  { value: 'one_time', label: 'Разовое' },
  { value: 'recurring', label: 'Периодическое' },
]

const GROUPING_OPTIONS: { value: GroupingMethod; label: string }[] = [
  { value: 'by_topic', label: 'По темам' },
  { value: 'by_subcontractor', label: 'По подрядчикам' },
]

const showForm = ref(false)
const formError = ref('')
const formLoading = ref(false)

const {
  showForm: showModal,
  editingId,
  formData,
  formError: modalFormError,
  formLoading: modalFormLoading,
  openCreate,
  openEdit,
  closeForm,
  submitForm,
} = useEntityForm<Meeting, MeetingCreate>({
  entityName: 'Протокол',
  defaultCreateValues: {
    title: '',
    date: new Date().toISOString().slice(0, 16),
    subcontractorId: null,
    attendees: [],
    agenda: '',
    decisions: '',
    notes: '',
  },
  toCreateData: (m: any) => ({
    title: m.title,
    date: new Date(m.date).toISOString().slice(0, 16),
    subcontractorId: m.subcontractorId ?? null,
    attendees: m.attendees ?? [],
    agenda: m.agenda,
    decisions: m.decisions ?? '',
    notes: m.notes ?? '',
  }),
  onSubmit: async ({ isEdit, id, values }) => {
    if (isEdit && id) await meetingStore.update(id, values)
    else await meetingStore.create(values)
  },
  validate: () => {
    if (!formData.value.title.trim()) { formError.value = 'Название обязательно'; return false }
    if (!formData.value.agenda.trim()) { formError.value = 'Повестка обязательна'; return false }
    return true
  },
})

onMounted(() => {
  employeeStore.fetchAll()
})
</script>

<template>
  <div class="view">
    <div class="view-header">
      <h2 class="view-title">Создать протокол совещания</h2>
      <BaseButton variant="secondary" @click="router.push('/meetings')">← К списку</BaseButton>
    </div>

    <div class="form-card">
      <form @submit.prevent="submitForm" class="form">
        <div class="form-row">
          <label class="field">
            <span class="field-label">Название *</span>
            <input v-model="formData.title" class="input" required />
          </label>
          <label class="field">
            <span class="field-label">Дата и время</span>
            <input type="datetime-local" v-model="formData.date" class="input" />
          </label>
        </div>

        <div class="form-row">
          <label class="field">
            <span class="field-label">Тип совещания</span>
            <select v-model="formData.meetingType" class="input">
              <option v-for="t in MEETING_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">Периодичность</span>
            <select v-model="formData.periodicity" class="input">
              <option v-for="p in PERIODICITY_OPTIONS" :key="p.value" :value="p.value">{{ p.label }}</option>
            </select>
          </label>
        </div>

        <div class="form-row">
          <label class="field">
            <span class="field-label">Группировка</span>
            <select v-model="formData.groupingMethod" class="input">
              <option v-for="g in GROUPING_OPTIONS" :key="g.value" :value="g.value">{{ g.label }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">Подрядчик</span>
            <select v-model="formData.subcontractorId" class="input">
              <option :value="null">Без подрядчика</option>
              <option v-for="s in meetingStore.items" :key="s.id" :value="s.id">{{ s.title }}</option>
            </select>
          </label>
        </div>

        <label class="field">
          <span class="field-label">Участники</span>
          <div class="attendees-list">
            <label v-for="emp in employeeStore.items" :key="emp.id" class="attendee-item">
              <input type="checkbox" :value="emp.id" v-model="formData.attendees" />
              <span>{{ emp.name }}</span>
            </label>
          </div>
        </label>

        <label class="field">
          <span class="field-label">Повестка *</span>
          <textarea v-model="formData.agenda" class="input textarea" rows="4" placeholder="Опишите повестку совещания..." />
        </label>

        <label class="field">
          <span class="field-label">Решения</span>
          <textarea v-model="formData.decisions" class="input textarea" rows="3" placeholder="Принятые решения..." />
        </label>

        <label class="field">
          <span class="field-label">Заметки</span>
          <textarea v-model="formData.notes" class="input textarea" rows="2" placeholder="Дополнительные заметки..." />
        </label>

        <div v-if="formError" class="form-error">{{ formError }}</div>

        <div class="form-actions">
          <BaseButton variant="secondary" type="button" @click="router.push('/meetings')">Отмена</BaseButton>
          <BaseButton variant="primary" type="submit" :disabled="formLoading">{{ formLoading ? 'Сохранение...' : 'Создать протокол' }}</BaseButton>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.view { max-width: 50rem; container-type: inline-size; }

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

.form-card {
  background: var(--color-bg-card);
  border: 0.0625rem solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1.75rem;
  box-shadow: var(--shadow-card);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: flex;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.field-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

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

.textarea {
  resize: vertical;
  min-height: 3.75rem;
}

.attendees-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  border: 0.0625rem solid var(--color-border-input);
  border-radius: var(--radius-sm);
  background: var(--color-bg-card);
  max-height: 12rem;
  overflow-y: auto;
}

.attendee-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.attendee-item input[type="checkbox"] {
  width: 1rem;
  height: 1rem;
  accent-color: var(--color-primary);
  cursor: pointer;
  flex-shrink: 0;
}

.form-error {
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

@container (max-width: 40rem) {
  .view-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .form-row {
    flex-direction: column;
    gap: 0.75rem;
  }

  .form-card {
    padding: 1.25rem;
  }

  .attendees-list {
    max-height: 9rem;
  }
}
</style>
