<script setup lang="ts">
import { ref } from 'vue'
import type { Meeting, MeetingCreate } from '@/types/api'
import { useMeetingStore } from '@/stores/meetings'
import { useSubcontractorStore } from '@/stores/subcontractors'
import { errorMessage } from '@/api/client'
import { useDeleteConfirm } from '@/composables/useDeleteConfirm'
import Modal from '@/components/Modal.vue'
import BaseButton from '@/components/BaseButton.vue'

const props = defineProps<{ subId: number }>()
const emit = defineEmits<{ refresh: [] }>()

const meetingStore = useMeetingStore()
const subcontractorStore = useSubcontractorStore()

const { deleteItem } = useDeleteConfirm((id: number) => meetingStore.remove(id), 'протокол')

const meetingForm = ref(false)
const editingId = ref<number | null>(null)
const formData = ref<MeetingCreate>({
  title: '', date: new Date().toISOString().slice(0, 16), subcontractorId: props.subId,
  attendees: [], agenda: '', decisions: '', notes: '',
})
const attendeesText = ref('')
const formError = ref('')
const saving = ref(false)

function openCreate() {
  editingId.value = null
  formData.value = { title: '', date: new Date().toISOString().slice(0, 16), subcontractorId: props.subId, attendees: [], agenda: '', decisions: '', notes: '' }
  attendeesText.value = ''
  formError.value = ''
  meetingForm.value = true
}

function openEdit(m: Meeting) {
  editingId.value = m.id
  formData.value = { title: m.title, date: new Date(m.date).toISOString().slice(0, 16), subcontractorId: m.subcontractorId, attendees: m.attendees, agenda: m.agenda, decisions: m.decisions || '', notes: m.notes || '' }
  attendeesText.value = m.attendees.join(', ')
  formError.value = ''
  meetingForm.value = true
}

const attendees = () => attendeesText.value.split(',').map(s => s.trim()).filter(Boolean)

async function submitMeeting() {
  if (!formData.value.title.trim()) { formError.value = 'Название обязательно'; return }
  if (!formData.value.agenda.trim()) { formError.value = 'Повестка обязательна'; return }
  saving.value = true
  formError.value = ''
  try {
    if (editingId.value) await meetingStore.update(editingId.value, { ...formData.value, attendees: attendees() })
    else await meetingStore.create({ ...formData.value, attendees: attendees() })
    meetingForm.value = false
    emit('refresh')
  } catch (e: unknown) {
    formError.value = errorMessage(e, 'Ошибка')
  } finally {
    saving.value = false
  }
}

async function deleteMeeting(id: number) {
  if (!confirm('Удалить протокол?')) return
  try {
    await deleteItem(id)
    emit('refresh')
  } catch {
    // alert handled by useDeleteConfirm
  }
}
</script>

<template>
  <div class="tab-content">
    <BaseButton variant="primary" size="sm" @click="openCreate">Добавить протокол</BaseButton>

    <Modal v-model="meetingForm" :title="editingId ? 'Изменить протокол' : 'Новый протокол'">
      <form @submit.prevent="submitMeeting" class="form">
        <label class="field">
          <span class="field-label">Название *</span>
          <input v-model="formData.title" class="input" />
        </label>
        <label class="field">
          <span class="field-label">Дата</span>
          <input type="datetime-local" v-model="formData.date" class="input" />
        </label>
        <label class="field">
          <span class="field-label">Участники (через запятую)</span>
          <input v-model="attendeesText" class="input" />
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
          <BaseButton variant="secondary" type="button" @click="meetingForm = false">Отмена</BaseButton>
          <BaseButton variant="primary" type="submit" :disabled="saving">Сохранить</BaseButton>
        </div>
      </form>
    </Modal>

    <div v-if="meetingStore.items.length === 0 && !meetingForm" class="state-message">Нет протоколов</div>

    <div v-for="m in meetingStore.items" :key="m.id" class="item-card">
      <div class="item-head">
        <span class="item-author">{{ m.title }}</span>
        <span class="item-date">{{ m.date }}</span>
        <BaseButton variant="ghost" size="sm" @click="openEdit(m)">Изменить</BaseButton>
        <BaseButton variant="ghost" size="sm" @click="deleteMeeting(m.id)">Удалить</BaseButton>
      </div>
      <div class="item-body"><strong>Повестка:</strong> {{ m.agenda }}</div>
      <div v-if="m.decisions" class="item-body"><strong>Решения:</strong> {{ m.decisions }}</div>
      <div v-if="m.notes" class="item-body"><strong>Заметки:</strong> {{ m.notes }}</div>
      <div v-if="m.attendees?.length" class="item-body"><strong>Участники:</strong> {{ m.attendees.join(', ') }}</div>
    </div>
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
}
</style>
