<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useMeetingStore } from '@/stores/meetings'
import { useSubcontractorStore } from '@/stores/subcontractors'
import type { Meeting, MeetingCreate } from '@/types/api'
import { errorMessage } from '@/api/client'

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

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ru-RU')
}

function getSubcontractorName(id: number | null): string {
  if (!id) return '-'
  return subcontractorStore.items.find((s) => s.id === id)?.name || `#${id}`
}

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
    subcontractorId: m.subcontractor_id,
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

async function deleteItem(id: number) {
  if (!confirm('Удалить протокол?')) return
  try { await meetingStore.remove(id) } catch (e: unknown) { alert(errorMessage(e, 'Ошибка')) }
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
      <button class="btn btn-primary" @click="openCreate">Добавить протокол</button>
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
              <span v-if="m.subcontractor_id"> — {{ getSubcontractorName(m.subcontractor_id) }}</span>
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
          <div v-if="m.attendees.length" class="meeting-section">
            <strong>Участники:</strong>
            <p>{{ m.attendees.join(', ') }}</p>
          </div>
        </div>
        <div class="meeting-actions">
          <button class="btn btn-sm btn-ghost" @click="openEdit(m)">Изменить</button>
          <button class="btn btn-sm btn-ghost btn-danger" @click="deleteItem(m.id)">Удалить</button>
        </div>
      </div>
    </div>

    <div v-if="showForm" class="modal-overlay" @click.self="closeForm">
      <div class="modal">
        <h3 class="modal-title">{{ editingId ? 'Изменить протокол' : 'Новый протокол' }}</h3>
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
            <button class="btn btn-secondary" @click="closeForm">Отмена</button>
            <button class="btn btn-primary" :disabled="formLoading" @click="submitForm">Сохранить</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view { max-width: 900px; container-type: inline-size; }

.view-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 20px;
}

.view-title { font-size: 18px; font-weight: 600; color: #111827; }

.filter-bar { margin-bottom: 18px; }

.filter-label {
  display: flex; align-items: center; gap: 8px;
  font-size: 14px; font-weight: 500; color: #374151;
}

.filter-select { width: 260px; }

.meeting-list { display: flex; flex-direction: column; gap: 14px; }

.meeting-card {
  background: #ffffff; border: 1px solid #e5e7eb;
  border-radius: 8px; padding: 20px;
}

.meeting-head { margin-bottom: 12px; }
.meeting-title { font-size: 16px; font-weight: 600; color: #111827; margin: 0; }
.meeting-meta { font-size: 12px; color: #9ca3af; margin-top: 2px; }

.meeting-body { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }

.meeting-section strong {
  font-size: 13px; font-weight: 600; color: #374151;
}

.meeting-section p {
  font-size: 14px; color: #4b5563; margin: 2px 0 0; line-height: 1.5;
}

.meeting-actions { display: flex; gap: 4px; }

.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}

.modal {
  background: #ffffff; border-radius: 12px;
  padding: 28px; width: 540px; max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.modal-title { font-size: 18px; font-weight: 600; margin-bottom: 20px; color: #111827; }

.form { display: flex; flex-direction: column; gap: 16px; }
.field { display: flex; flex-direction: column; gap: 4px; }
.field-label { font-size: 13px; font-weight: 500; color: #374151; }

.input {
  padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;
  font-size: 14px; color: #111827; background: #ffffff; outline: none;
}

.input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26, 86, 219, 0.1); }
.textarea { resize: vertical; min-height: 60px; }

.form-error { color: #dc2626; font-size: 13px; }
.form-actions { display: flex; justify-content: flex-end; gap: 8px; }

.state-message { padding: 40px 0; text-align: center; color: #6b7280; font-size: 15px; }
.state-error { color: #dc2626; }

.btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;
  border: none; cursor: pointer; transition: background 0.15s;
}

.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary { background: #1a56db; color: #ffffff; }
.btn-primary:hover:not(:disabled) { background: #1e40af; }
.btn-secondary { background: #e5e7eb; color: #374151; }
.btn-secondary:hover:not(:disabled) { background: #d1d5db; }
.btn-sm { padding: 4px 10px; font-size: 13px; }
.btn-ghost { background: transparent; color: #6b7280; }
.btn-ghost:hover { background: #f3f4f6; color: #374151; }
.btn-danger { color: #dc2626; }
.btn-danger:hover { background: #fef2f2; color: #b91c1c; }

@container (max-width: 640px) {
  .view-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
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
    padding: 16px;
  }

  .modal-overlay {
    align-items: flex-end;
  }

  .modal {
    width: 100%;
    max-width: 100vw;
    border-radius: 12px 12px 0 0;
    padding: 24px 16px;
    max-height: 90vh;
    overflow-y: auto;
  }
}
</style>
