<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useMeetingStore } from '@/stores/meetings'
import { useSubcontractorStore } from '@/stores/subcontractors'
import { useSubcontractorName } from '@/composables/useEntityName'
import { formatDateTime } from '@/composables/useDateFormatter'
import { useDeleteConfirm } from '@/composables/useDeleteConfirm'
import type { Meeting, MeetingCreate } from '@/types/api'
import { errorMessage } from '@/api/client'
import Modal from '@/components/Modal.vue'
import BaseButton from '@/components/BaseButton.vue'

const meetingStore = useMeetingStore()
const subcontractorStore = useSubcontractorStore()

const filterSubId = ref<number | undefined>(undefined)

const showForm = ref(false)
const editingId = ref<number | null>(null)
const formData = ref<MeetingCreate>({
  title: '', date: new Date().toISOString().slice(0, 16), subcontractorId: null,
  attendees: [], agenda: '', decisions: '', notes: '',
})
const attendeesText = ref('')
const formError = ref('')
const formLoading = ref(false)

const getSubcontractorName = useSubcontractorName(subcontractorStore.items)

const { deleteItem } = useDeleteConfirm((id: number) => meetingStore.remove(id), 'протокол')

function openCreate() {
  editingId.value = null
  formData.value = {
    title: '', date: new Date().toISOString().slice(0, 16), subcontractorId: filterSubId.value || null,
    attendees: [], agenda: '', decisions: '', notes: '',
  }
  attendeesText.value = ''
  formError.value = ''
  showForm.value = true
}

function openEdit(m: Meeting) {
  editingId.value = m.id
  formData.value = {
    title: m.title,
    date: new Date(m.date).toISOString().slice(0, 16),
    subcontractorId: m.subcontractorId,
    attendees: [...m.attendees],
    agenda: m.agenda,
    decisions: m.decisions || '',
    notes: m.notes || '',
  }
  attendeesText.value = m.attendees.join(', ')
  formError.value = ''
  showForm.value = true
}

function closeForm() { showForm.value = false }

async function submitForm() {
  if (!formData.value.title.trim()) { formError.value = 'Название обязательно'; return }
  if (!formData.value.agenda.trim()) { formError.value = 'Повестка обязательна'; return }
  formLoading.value = true
  formError.value = ''
  try {
    const payload: MeetingCreate = {
      ...formData.value,
      attendees: attendeesText.value.split(',').map((s) => s.trim()).filter(Boolean),
    }
    if (editingId.value) {
      await meetingStore.update(editingId.value, payload)
    } else {
      await meetingStore.create(payload)
    }
    showForm.value = false
  } catch (e: unknown) {
    formError.value = errorMessage(e, 'Ошибка')
  } finally {
    formLoading.value = false
  }
}

async function loadData() {
  await meetingStore.fetchAll(filterSubId.value)
}

watch(filterSubId, () => loadData())

onMounted(async () => {
  await Promise.all([subcontractorStore.fetchAll(), loadData()])
})
</script>

<template>
  <div class="view">
    <div class="view-header">
      <h2 class="view-title">Протоколы встреч</h2>
      <BaseButton variant="primary" @click="openCreate">Добавить протокол</BaseButton>
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

    <div v-if="meetingStore.loading" class="state-message">Загрузка...</div>
    <div v-else-if="meetingStore.error" class="state-message state-error">{{ meetingStore.error }}</div>
    <div v-else-if="meetingStore.items.length === 0" class="state-message">Нет протоколов</div>

    <div v-else class="meeting-list">
      <div v-for="m in meetingStore.items" :key="m.id" class="meeting-card">
        <div class="meeting-head">
          <div>
            <h3 class="meeting-title">{{ m.title }}</h3>
            <div class="meeting-meta">
              <span>{{ formatDateTime(m.date) }}</span>
              <span v-if="m.subcontractorId"> — {{ getSubcontractorName(m.subcontractorId) }}</span>
            </div>
          </div>
        </div>
        <div class="meeting-body">
          <div class="meeting-section">
            <strong>Повестка:</strong>
            <p>{{ m.agenda }}</p>
          </div>
          <div v-if="m.decisions" class="meeting-section">
            <strong>Решения:</strong>
            <p>{{ m.decisions }}</p>
          </div>
          <div v-if="m.notes" class="meeting-section">
            <strong>Заметки:</strong>
            <p>{{ m.notes }}</p>
          </div>
          <div v-if="m.attendees?.length" class="meeting-section">
            <strong>Участники:</strong>
            <p>{{ m.attendees.join(', ') }}</p>
          </div>
        </div>
        <div class="meeting-actions">
          <BaseButton variant="ghost" size="sm" @click="openEdit(m)">Изменить</BaseButton>
          <BaseButton variant="danger" size="sm" @click="deleteItem(m.id)">Удалить</BaseButton>
        </div>
      </div>
    </div>

    <Modal v-model="showForm" :title="editingId ? 'Изменить протокол' : 'Новый протокол'">
      <div class="form">
        <label class="field">
          <span class="field-label">Название *</span>
          <input v-model="formData.title" class="input" />
        </label>
        <label class="field">
          <span class="field-label">Дата</span>
          <input type="datetime-local" v-model="formData.date" class="input" />
        </label>
        <label class="field">
          <span class="field-label">Подрядчик</span>
          <select v-model="formData.subcontractorId" class="input">
            <option :value="null">Без подрядчика</option>
            <option v-for="s in subcontractorStore.items" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">Участники (через запятую)</span>
          <input v-model="attendeesText" class="input" placeholder="Иван Иванов, Петр Петров" />
        </label>
        <label class="field">
          <span class="field-label">Повестка *</span>
          <textarea v-model="formData.agenda" class="input textarea" rows="3" />
        </label>
        <label class="field">
          <span class="field-label">Решения</span>
          <textarea v-model="formData.decisions" class="input textarea" rows="2" />
        </label>
        <label class="field">
          <span class="field-label">Заметки</span>
          <textarea v-model="formData.notes" class="input textarea" rows="2" />
        </label>
        <div v-if="formError" class="form-error">{{ formError }}</div>
        <div class="form-actions">
          <BaseButton variant="secondary" @click="closeForm">Отмена</BaseButton>
          <BaseButton variant="primary" :disabled="formLoading" @click="submitForm">Сохранить</BaseButton>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.view { max-width: 56.25rem; container-type: inline-size; }

.view-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 1.25rem;
}

.view-title { font-size: 1.125rem; font-weight: 600; color: var(--color-text); }

.filter-bar { margin-bottom: 1.125rem; }

.filter-label {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.875rem; font-weight: 500; color: var(--color-text-secondary);
}

.filter-select { width: 16.25rem; }

.meeting-list { display: flex; flex-direction: column; gap: 0.875rem; }

.meeting-card {
  background: var(--color-bg-card); border: 0.0625rem solid var(--color-border);
  border-radius: 0.5rem; padding: 1.25rem;
}

.meeting-head { margin-bottom: 0.75rem; }
.meeting-title { font-size: 1rem; font-weight: 600; color: var(--color-text); margin: 0; }
.meeting-meta { font-size: 0.75rem; color: var(--color-text-meta); margin-top: 0.125rem; }

.meeting-body { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.75rem; }

.meeting-section strong {
  font-size: 0.8125rem; font-weight: 600; color: var(--color-text-secondary);
}

.meeting-section p {
  font-size: 0.875rem; color: var(--color-text-secondary); margin: 0.125rem 0 0; line-height: 1.5;
}

.meeting-actions { display: flex; gap: 0.25rem; }

.form { display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 0.25rem; }
.field-label { font-size: 0.8125rem; font-weight: 500; color: var(--color-text-secondary); }

.input {
  padding: 0.5rem 0.75rem; border: 0.0625rem solid var(--color-border-input); border-radius: 0.375rem;
  font-size: 0.875rem; color: var(--color-text); background: var(--color-bg-card); outline: none;
}

.input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 0.1875rem rgba(26, 86, 219, 0.1); }
.textarea { resize: vertical; min-height: 3.75rem; }

.form-error { color: var(--color-danger); font-size: 0.8125rem; }
.form-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }

.state-message { padding: 2.5rem 0; text-align: center; color: var(--color-text-muted); font-size: 0.9375rem; }
.state-error { color: var(--color-danger); }

.btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0.5rem 1rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500;
  border: none; cursor: pointer; transition: background 0.15s;
}

.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary { background: var(--color-primary); color: var(--color-bg-card); }
.btn-primary:hover:not(:disabled) { background: var(--color-primary-hover); }
.btn-secondary { background: var(--color-border); color: var(--color-text-secondary); }
.btn-secondary:hover:not(:disabled) { background: var(--color-border-input); }
.btn-sm { padding: 0.25rem 0.625rem; font-size: 0.8125rem; }
.btn-ghost { background: transparent; color: var(--color-text-muted); }
.btn-ghost:hover { background: var(--color-bg); color: var(--color-text-secondary); }
.btn-danger { color: var(--color-danger); }
.btn-danger:hover { background: var(--color-badge-violation-bg); color: var(--color-danger-hover); }

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

  .meeting-head {
    flex-direction: column;
  }

  .meeting-card {
    padding: 1rem;
  }
}
</style>
