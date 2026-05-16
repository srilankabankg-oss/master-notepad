<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSubcontractorStore } from '@/stores/subcontractors'
import { useReviewStore } from '@/stores/reviews'
import { useCommentStore } from '@/stores/comments'
import { useMeetingStore } from '@/stores/meetings'
import { useSurveyStore } from '@/stores/surveys'
import { useEventStore } from '@/stores/events'
import { useEmployeeStore } from '@/stores/employees'
import { errorMessage } from '@/api/client'
import type { Subcontractor, Review, Comment, Meeting, Survey, ReviewCreate, CommentCreate, MeetingCreate, SurveyCreate, ContractorEvent, ContractorEventCreate, EventType } from '@/types/api'

const route = useRoute()
const router = useRouter()
const subcontractorStore = useSubcontractorStore()
const reviewStore = useReviewStore()
const commentStore = useCommentStore()
const meetingStore = useMeetingStore()
const surveyStore = useSurveyStore()
const eventStore = useEventStore()
const employeeStore = useEmployeeStore()

const subId = Number(route.params.id)
const sub = ref<Subcontractor | null>(null)
const loading = ref(true)
const error = ref('')
const activeTab = ref<'reviews' | 'comments' | 'meetings' | 'surveys' | 'events'>('reviews')

const reviewForm = ref(false)
const reviewData = ref<ReviewCreate>({ subcontractorId: subId, employeeId: 0, content: '', rating: 5 })
const reviewError = ref('')
const reviewSaving = ref(false)

const commentForm = ref(false)
const commentData = ref<CommentCreate>({ subcontractorId: subId, employeeId: 0, content: '' })
const commentError = ref('')
const commentSaving = ref(false)

const meetingForm = ref(false)
const meetingEditingId = ref<number | null>(null)
const meetingData = ref<MeetingCreate>({
  title: '', date: new Date().toISOString().slice(0, 16), subcontractorId: subId,
  attendees: [], agenda: '', decisions: '', notes: '',
})
const meetingAttendeesText = ref('')
const meetingError = ref('')
const meetingSaving = ref(false)

const surveyForm = ref(false)
const surveyData = ref<SurveyCreate>({ title: '', subcontractorId: subId, createdBy: 0 })
const surveyError = ref('')
const surveySaving = ref(false)

const surveyResponseForm = ref(false)
const surveyResponseSurveyId = ref(0)
const surveyResponseAnswers = ref<Record<string, string>>({})
const surveyResponseError = ref('')

const eventTypes: EventType[] = ['positive', 'violation', 'info']

const eventForm = ref(false)
const eventEditingId = ref<number | null>(null)
const eventData = ref<ContractorEventCreate>({
  subcontractorId: subId, employeeId: 0, type: 'info', description: '',
  eventDate: new Date().toISOString().slice(0, 16),
})
const eventError = ref('')
const eventSaving = ref(false)

const employeesLoaded = ref(false)

function ratingColor(rating: number): string {
  if (rating >= 7) return '#16a34a'
  if (rating >= 5) return '#ca8a04'
  return '#dc2626'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU')
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ru-RU')
}

async function loadSubcontractor() {
  loading.value = true
  error.value = ''
  try {
    sub.value = await subcontractorStore.fetchById(subId)
  } catch (e: unknown) {
    error.value = errorMessage(e, 'Не удалось загрузить подрядчика')
  } finally {
    loading.value = false
  }
}

async function loadReviews() {
  await reviewStore.fetchAll(subId)
}

async function loadComments() {
  await commentStore.fetchAll(subId)
}

async function loadMeetings() {
  await meetingStore.fetchAll(subId)
}

async function loadSurveys() {
  await surveyStore.fetchAll()
}

async function loadEvents() {
  await eventStore.fetchAll(subId)
}

async function loadEmployees() {
  if (!employeesLoaded.value) {
    await employeeStore.fetchAll()
    employeesLoaded.value = true
  }
}

async function submitReview() {
  if (!reviewData.value.content.trim()) { reviewError.value = 'Текст отзыва обязателен'; return }
  if (!reviewData.value.employeeId) { reviewError.value = 'Выберите сотрудника'; return }
  reviewSaving.value = true
  reviewError.value = ''
  try {
    await reviewStore.create({ ...reviewData.value, subcontractorId: subId })
    reviewForm.value = false
    await loadReviews()
    await loadSubcontractor()
  } catch (e: unknown) {
    reviewError.value = errorMessage(e, 'Ошибка')
  } finally {
    reviewSaving.value = false
  }
}

async function deleteReview(id: number) {
  if (!confirm('Удалить отзыв?')) return
  try {
    await reviewStore.remove(id)
    await loadSubcontractor()
  } catch (e: unknown) {
    alert(errorMessage(e, 'Ошибка удаления'))
  }
}

async function submitComment() {
  if (!commentData.value.content.trim()) { commentError.value = 'Текст комментария обязателен'; return }
  if (!commentData.value.employeeId) { commentError.value = 'Выберите сотрудника'; return }
  commentSaving.value = true
  commentError.value = ''
  try {
    await commentStore.create({ ...commentData.value, subcontractorId: subId })
    commentForm.value = false
    await loadComments()
  } catch (e: unknown) {
    commentError.value = errorMessage(e, 'Ошибка')
  } finally {
    commentSaving.value = false
  }
}

async function deleteComment(id: number) {
  if (!confirm('Удалить комментарий?')) return
  try {
    await commentStore.remove(id)
  } catch (e: unknown) {
    alert(errorMessage(e, 'Ошибка удаления'))
  }
}

async function submitMeeting() {
  if (!meetingData.value.title.trim()) { meetingError.value = 'Название обязательно'; return }
  if (!meetingData.value.agenda.trim()) { meetingError.value = 'Повестка обязательна'; return }
  meetingSaving.value = true
  meetingError.value = ''
  try {
    if (meetingEditingId.value) {
      await meetingStore.update(meetingEditingId.value, {
        ...meetingData.value,
        attendees: meetingAttendeesText.value.split(',').map((s) => s.trim()).filter(Boolean),
      })
    } else {
      await meetingStore.create({
        ...meetingData.value,
        attendees: meetingAttendeesText.value.split(',').map((s) => s.trim()).filter(Boolean),
      })
    }
    meetingForm.value = false
    await loadMeetings()
  } catch (e: unknown) {
    meetingError.value = errorMessage(e, 'Ошибка')
  } finally {
    meetingSaving.value = false
  }
}

function openMeetingCreate() {
  meetingEditingId.value = null
  meetingData.value = {
    title: '', date: new Date().toISOString().slice(0, 16), subcontractorId: subId,
    attendees: [], agenda: '', decisions: '', notes: '',
  }
  meetingAttendeesText.value = ''
  meetingError.value = ''
  meetingForm.value = true
}

function openMeetingEdit(m: Meeting) {
  meetingEditingId.value = m.id
  meetingData.value = {
    title: m.title,
    date: new Date(m.date).toISOString().slice(0, 16),
    subcontractorId: m.subcontractor_id,
    attendees: m.attendees,
    agenda: m.agenda,
    decisions: m.decisions || '',
    notes: m.notes || '',
  }
  meetingAttendeesText.value = m.attendees.join(', ')
  meetingError.value = ''
  meetingForm.value = true
}

async function deleteMeeting(id: number) {
  if (!confirm('Удалить протокол?')) return
  try {
    await meetingStore.remove(id)
  } catch (e: unknown) {
    alert(errorMessage(e, 'Ошибка удаления'))
  }
}

async function submitSurvey() {
  if (!surveyData.value.title.trim()) { surveyError.value = 'Название обязательно'; return }
  if (!surveyData.value.createdBy) { surveyError.value = 'Выберите сотрудника'; return }
  surveySaving.value = true
  surveyError.value = ''
  try {
    await surveyStore.create({ ...surveyData.value, subcontractorId: subId })
    surveyForm.value = false
    await loadSurveys()
  } catch (e: unknown) {
    surveyError.value = errorMessage(e, 'Ошибка')
  } finally {
    surveySaving.value = false
  }
}

async function deleteSurvey(id: number) {
  if (!confirm('Удалить опрос?')) return
  try {
    await surveyStore.remove(id)
  } catch (e: unknown) {
    alert(errorMessage(e, 'Ошибка удаления'))
  }
}

function openResponseForm(survey: Survey) {
  surveyResponseSurveyId.value = survey.id
  surveyResponseAnswers.value = {}
  surveyResponseError.value = ''
  surveyResponseForm.value = true
}

async function submitResponse() {
  if (!surveyResponseAnswers.value || Object.keys(surveyResponseAnswers.value).length === 0) {
    surveyResponseError.value = 'Заполните хотя бы один ответ'
    return
  }
  try {
    await surveyStore.respond(surveyResponseSurveyId.value, {
      employeeId: employeeStore.items[0]?.id || 1,
      answers: surveyResponseAnswers.value,
    })
    surveyResponseForm.value = false
  } catch (e: unknown) {
    surveyResponseError.value = errorMessage(e, 'Ошибка')
  }
}

function eventTypeLabel(type: EventType): string {
  return { positive: 'Позитивное', violation: 'Нарушение', info: 'Информация' }[type]
}

function eventTypeClass(type: EventType): string {
  return `badge-${type}`
}

async function submitEvent() {
  if (!eventData.value.description.trim()) { eventError.value = 'Описание обязательно'; return }
  if (!eventData.value.employeeId) { eventError.value = 'Выберите сотрудника'; return }
  eventSaving.value = true
  eventError.value = ''
  try {
    if (eventEditingId.value) {
      await eventStore.update(eventEditingId.value, { ...eventData.value })
    } else {
      await eventStore.create({ ...eventData.value, subcontractorId: subId })
    }
    eventForm.value = false
    await loadEvents()
  } catch (e: unknown) {
    eventError.value = errorMessage(e, 'Ошибка')
  } finally {
    eventSaving.value = false
  }
}

function openEventCreate() {
  eventEditingId.value = null
  eventData.value = {
    subcontractorId: subId, employeeId: 0, type: 'info', description: '',
    eventDate: new Date().toISOString().slice(0, 16),
  }
  eventError.value = ''
  eventForm.value = true
}

function openEventEdit(ev: ContractorEvent) {
  eventEditingId.value = ev.id
  eventData.value = {
    subcontractorId: ev.subcontractor_id,
    employeeId: ev.employee_id,
    type: ev.type,
    description: ev.description,
    eventDate: new Date(ev.event_date).toISOString().slice(0, 16),
  }
  eventError.value = ''
  eventForm.value = true
}

async function deleteEvent(id: number) {
  if (!confirm('Удалить событие?')) return
  try {
    await eventStore.remove(id)
  } catch (e: unknown) {
    alert(errorMessage(e, 'Ошибка удаления'))
  }
}

function getEmployeeName(id: number): string {
  const emp = employeeStore.items.find((e) => e.id === id)
  return emp ? emp.name : `#${id}`
}

const subSurveys = ref<Survey[]>([])
watch(() => surveyStore.items, () => {
  subSurveys.value = surveyStore.items.filter((s) => s.subcontractor_id === subId)
}, { immediate: true, deep: true })

onMounted(async () => {
  await Promise.all([loadSubcontractor(), loadReviews(), loadComments(), loadMeetings(), loadSurveys(), loadEvents(), loadEmployees()])
})
</script>

<template>
  <div class="view">
    <button class="btn btn-back" @click="router.push('/subcontractors')">← Назад к списку</button>

    <div v-if="loading" class="state-message">Загрузка...</div>
    <div v-else-if="error" class="state-message state-error">{{ error }}</div>

    <template v-else-if="sub">
      <div class="detail-card">
        <div class="detail-header">
          <div>
            <h2 class="detail-name">{{ sub.name }}</h2>
            <div class="detail-meta">
              <span v-if="sub.company_name">{{ sub.company_name }}</span>
              <span v-if="sub.specialization" class="meta-sep">{{ sub.specialization }}</span>
            </div>
          </div>
          <div class="detail-rating">
            <span class="rating-value" :style="{ color: ratingColor(sub.rating ?? 0) }">
              {{ sub.rating ?? 'Нет оценок' }}
            </span>
          </div>
        </div>
        <div v-if="sub.description" class="detail-desc">{{ sub.description }}</div>
        <div v-if="sub.contact_info" class="detail-contact">{{ sub.contact_info }}</div>
      </div>

      <div class="tabs">
        <button
          v-for="tab in (['reviews', 'comments', 'meetings', 'surveys', 'events'] as const)"
          :key="tab"
          :class="['tab', { active: activeTab === tab }]"
          @click="activeTab = tab"
        >
          {{ { reviews: 'Отзывы', comments: 'Комментарии', meetings: 'Протоколы', surveys: 'Опросы', events: 'События' }[tab] }}
        </button>
      </div>

      <div v-if="activeTab === 'reviews'" class="tab-content">
        <button class="btn btn-primary btn-sm" @click="reviewForm = true; reviewError = ''; reviewData = { subcontractorId: subId, employeeId: 0, content: '', rating: 5 }">Добавить отзыв</button>

        <div v-if="reviewForm" class="inline-form">
          <h4>Новый отзыв</h4>
          <label class="field">
            <span class="field-label">Сотрудник</span>
            <select v-model="reviewData.employeeId" class="input">
              <option :value="0" disabled>Выберите сотрудника</option>
              <option v-for="emp in employeeStore.items" :key="emp.id" :value="emp.id">{{ emp.name }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">Оценка (1-10)</span>
            <div class="rating-slider">
              <input type="range" min="1" max="10" v-model.number="reviewData.rating" class="slider" />
              <span class="slider-val">{{ reviewData.rating }}</span>
            </div>
          </label>
          <label class="field">
            <span class="field-label">Текст</span>
            <textarea v-model="reviewData.content" class="input textarea" rows="3" />
          </label>
          <div v-if="reviewError" class="form-error">{{ reviewError }}</div>
          <div class="form-row">
            <button class="btn btn-secondary btn-sm" @click="reviewForm = false">Отмена</button>
            <button class="btn btn-primary btn-sm" :disabled="reviewSaving" @click="submitReview">Сохранить</button>
          </div>
        </div>

        <div v-if="reviewStore.items.length === 0 && !reviewForm" class="state-message">Нет отзывов</div>

        <div v-for="r in reviewStore.items" :key="r.id" class="item-card">
          <div class="item-head">
            <span class="item-author">{{ getEmployeeName(r.employee_id) }}</span>
            <span class="item-rating" :style="{ color: ratingColor(r.rating) }">{{ r.rating }}/10</span>
            <span class="item-date">{{ formatDate(r.created_at) }}</span>
            <button class="btn btn-sm btn-ghost btn-danger" @click="deleteReview(r.id)">Удалить</button>
          </div>
          <div class="item-body">{{ r.content }}</div>
        </div>
      </div>

      <div v-if="activeTab === 'comments'" class="tab-content">
        <button class="btn btn-primary btn-sm" @click="commentForm = true; commentError = ''; commentData = { subcontractorId: subId, employeeId: 0, content: '' }">Добавить комментарий</button>

        <div v-if="commentForm" class="inline-form">
          <h4>Новый комментарий</h4>
          <label class="field">
            <span class="field-label">Сотрудник</span>
            <select v-model="commentData.employeeId" class="input">
              <option :value="0" disabled>Выберите сотрудника</option>
              <option v-for="emp in employeeStore.items" :key="emp.id" :value="emp.id">{{ emp.name }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">Текст</span>
            <textarea v-model="commentData.content" class="input textarea" rows="3" />
          </label>
          <div v-if="commentError" class="form-error">{{ commentError }}</div>
          <div class="form-row">
            <button class="btn btn-secondary btn-sm" @click="commentForm = false">Отмена</button>
            <button class="btn btn-primary btn-sm" :disabled="commentSaving" @click="submitComment">Сохранить</button>
          </div>
        </div>

        <div v-if="commentStore.items.length === 0 && !commentForm" class="state-message">Нет комментариев</div>

        <div v-for="c in commentStore.items" :key="c.id" class="item-card">
          <div class="item-head">
            <span class="item-author">{{ getEmployeeName(c.employee_id) }}</span>
            <span class="item-date">{{ formatDate(c.created_at) }}</span>
            <button class="btn btn-sm btn-ghost btn-danger" @click="deleteComment(c.id)">Удалить</button>
          </div>
          <div class="item-body">{{ c.content }}</div>
        </div>
      </div>

      <div v-if="activeTab === 'meetings'" class="tab-content">
        <button class="btn btn-primary btn-sm" @click="openMeetingCreate">Добавить протокол</button>

        <div v-if="meetingForm" class="inline-form">
          <h4>{{ meetingEditingId ? 'Изменить протокол' : 'Новый протокол' }}</h4>
          <label class="field">
            <span class="field-label">Название *</span>
            <input v-model="meetingData.title" class="input" />
          </label>
          <label class="field">
            <span class="field-label">Дата</span>
            <input type="datetime-local" v-model="meetingData.date" class="input" />
          </label>
          <label class="field">
            <span class="field-label">Участники (через запятую)</span>
            <input v-model="meetingAttendeesText" class="input" />
          </label>
          <label class="field">
            <span class="field-label">Повестка *</span>
            <textarea v-model="meetingData.agenda" class="input textarea" rows="3" />
          </label>
          <label class="field">
            <span class="field-label">Решения</span>
            <textarea v-model="meetingData.decisions" class="input textarea" rows="2" />
          </label>
          <label class="field">
            <span class="field-label">Заметки</span>
            <textarea v-model="meetingData.notes" class="input textarea" rows="2" />
          </label>
          <div v-if="meetingError" class="form-error">{{ meetingError }}</div>
          <div class="form-row">
            <button class="btn btn-secondary btn-sm" @click="meetingForm = false">Отмена</button>
            <button class="btn btn-primary btn-sm" :disabled="meetingSaving" @click="submitMeeting">Сохранить</button>
          </div>
        </div>

        <div v-if="meetingStore.items.length === 0 && !meetingForm" class="state-message">Нет протоколов</div>

        <div v-for="m in meetingStore.items" :key="m.id" class="item-card">
          <div class="item-head">
            <span class="item-author">{{ m.title }}</span>
            <span class="item-date">{{ formatDateTime(m.date) }}</span>
            <button class="btn btn-sm btn-ghost" @click="openMeetingEdit(m)">Изменить</button>
            <button class="btn btn-sm btn-ghost btn-danger" @click="deleteMeeting(m.id)">Удалить</button>
          </div>
          <div class="item-body"><strong>Повестка:</strong> {{ m.agenda }}</div>
          <div v-if="m.decisions" class="item-body"><strong>Решения:</strong> {{ m.decisions }}</div>
          <div v-if="m.notes" class="item-body"><strong>Заметки:</strong> {{ m.notes }}</div>
          <div v-if="m.attendees.length" class="item-body"><strong>Участники:</strong> {{ m.attendees.join(', ') }}</div>
        </div>
      </div>

      <div v-if="activeTab === 'surveys'" class="tab-content">
        <button class="btn btn-primary btn-sm" @click="surveyForm = true; surveyError = ''; surveyData = { title: '', subcontractorId: subId, createdBy: 0 }">Создать опрос</button>

        <div v-if="surveyForm" class="inline-form">
          <h4>Новый опрос</h4>
          <label class="field">
            <span class="field-label">Название *</span>
            <input v-model="surveyData.title" class="input" />
          </label>
          <label class="field">
            <span class="field-label">Создатель</span>
            <select v-model="surveyData.createdBy" class="input">
              <option :value="0" disabled>Выберите сотрудника</option>
              <option v-for="emp in employeeStore.items" :key="emp.id" :value="emp.id">{{ emp.name }}</option>
            </select>
          </label>
          <div v-if="surveyError" class="form-error">{{ surveyError }}</div>
          <div class="form-row">
            <button class="btn btn-secondary btn-sm" @click="surveyForm = false">Отмена</button>
            <button class="btn btn-primary btn-sm" :disabled="surveySaving" @click="submitSurvey">Создать</button>
          </div>
        </div>

        <div v-if="subSurveys.length === 0 && !surveyForm" class="state-message">Нет опросов</div>

        <div v-for="s in subSurveys" :key="s.id" class="item-card">
          <div class="item-head">
            <span class="item-author">{{ s.title }}</span>
            <span>{{ s.questions.length }} вопросов</span>
            <span class="item-date">{{ formatDate(s.created_at) }}</span>
            <button class="btn btn-sm btn-ghost" @click="openResponseForm(s)">Ответить</button>
            <button class="btn btn-sm btn-ghost btn-danger" @click="deleteSurvey(s.id)">Удалить</button>
          </div>
          <ul class="question-list">
            <li v-for="(q, qi) in s.questions" :key="qi">{{ q }}</li>
          </ul>
        </div>

        <div v-if="surveyResponseForm" class="modal-overlay" @click.self="surveyResponseForm = false">
          <div class="modal">
            <h3 class="modal-title">Ответ на опрос</h3>
            <div class="form">
              <label v-for="(q, qi) in subSurveys.find(s => s.id === surveyResponseSurveyId)?.questions || []" :key="qi" class="field">
                <span class="field-label">{{ q }}</span>
                <textarea
                  v-model="surveyResponseAnswers[q]"
                  class="input textarea"
                  rows="2"
                  :placeholder="'Ваш ответ...'"
                />
              </label>
              <div v-if="surveyResponseError" class="form-error">{{ surveyResponseError }}</div>
              <div class="form-actions">
                <button class="btn btn-secondary" @click="surveyResponseForm = false">Отмена</button>
                <button class="btn btn-primary" @click="submitResponse">Отправить</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'events'" class="tab-content">
        <button class="btn btn-primary btn-sm" @click="openEventCreate">Записать событие</button>

        <div v-if="eventForm" class="inline-form">
          <h4>{{ eventEditingId ? 'Изменить событие' : 'Новое событие' }}</h4>
          <label class="field">
            <span class="field-label">Сотрудник *</span>
            <select v-model="eventData.employeeId" class="input">
              <option :value="0" disabled>Выберите сотрудника</option>
              <option v-for="emp in employeeStore.items" :key="emp.id" :value="emp.id">{{ emp.name }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">Тип</span>
            <select v-model="eventData.type" class="input">
              <option v-for="t in eventTypes" :key="t" :value="t">{{ eventTypeLabel(t) }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">Описание *</span>
            <textarea v-model="eventData.description" class="input textarea" rows="3" />
          </label>
          <label class="field">
            <span class="field-label">Дата события</span>
            <input type="datetime-local" v-model="eventData.eventDate" class="input" />
          </label>
          <div v-if="eventError" class="form-error">{{ eventError }}</div>
          <div class="form-row">
            <button class="btn btn-secondary btn-sm" @click="eventForm = false">Отмена</button>
            <button class="btn btn-primary btn-sm" :disabled="eventSaving" @click="submitEvent">Сохранить</button>
          </div>
        </div>

        <div v-if="eventStore.items.length === 0 && !eventForm" class="state-message">Нет событий</div>

        <div v-for="ev in eventStore.items" :key="ev.id" class="item-card">
          <div class="item-head">
            <span :class="['event-badge-detail', eventTypeClass(ev.type)]">{{ eventTypeLabel(ev.type) }}</span>
            <span class="item-date">{{ formatDate(ev.event_date) }}</span>
            <span class="item-author">{{ getEmployeeName(ev.employee_id) }}</span>
            <button class="btn btn-sm btn-ghost" @click="openEventEdit(ev)">Изменить</button>
            <button class="btn btn-sm btn-ghost btn-danger" @click="deleteEvent(ev.id)">Удалить</button>
          </div>
          <div class="item-body">{{ ev.description }}</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.view { max-width: 900px; container-type: inline-size; }

.btn-back {
  background: none;
  border: none;
  color: #6b7280;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  margin-bottom: 16px;
}

.btn-back:hover { color: #1a56db; }

.detail-card {
  background: #ffffff;
  border-radius: 10px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  margin-bottom: 20px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.detail-name {
  font-size: 22px;
  font-weight: 700;
  color: #111827;
}

.detail-meta {
  margin-top: 4px;
  font-size: 14px;
  color: #6b7280;
  display: flex;
  gap: 8px;
}

.meta-sep::before { content: '·'; margin-right: 8px; }

.detail-rating {
  text-align: center;
}

.rating-value {
  font-size: 28px;
  font-weight: 700;
}

.detail-desc {
  margin-top: 12px;
  color: #374151;
  font-size: 14px;
}

.detail-contact {
  margin-top: 6px;
  color: #6b7280;
  font-size: 13px;
}

.tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid #e5e7eb;
  margin-bottom: 20px;
}

.tab {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.tab:hover { color: #374151; }

.tab.active {
  color: #1a56db;
  border-bottom-color: #1a56db;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.inline-form {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 4px;
}

.inline-form h4 {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.rating-slider {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider {
  flex: 1;
  accent-color: #1a56db;
  height: 6px;
}

.slider-val {
  font-size: 14px;
  font-weight: 600;
  color: #1a56db;
  min-width: 24px;
}

.form-row {
  display: flex;
  gap: 8px;
}

.item-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 14px 16px;
}

.item-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.item-author {
  font-weight: 600;
  font-size: 14px;
  color: #111827;
}

.item-rating {
  font-weight: 700;
  font-size: 14px;
}

.item-date {
  font-size: 12px;
  color: #9ca3af;
  margin-left: auto;
}

.item-body {
  font-size: 14px;
  color: #374151;
  line-height: 1.6;
}

.question-list {
  margin: 6px 0 0 18px;
  font-size: 13px;
  color: #6b7280;
}

.question-list li { margin-bottom: 2px; }

.state-message { padding: 32px 0; text-align: center; color: #6b7280; font-size: 15px; }
.state-error { color: #dc2626; }
.form-error { color: #dc2626; font-size: 13px; }

.event-badge-detail {
  display: inline-flex; align-items: center;
  padding: 2px 10px; border-radius: 12px;
  font-size: 12px; font-weight: 600;
}

.badge-positive { background: #dcfce7; color: #166534; }
.badge-violation { background: #fef2f2; color: #991b1b; }
.badge-info { background: #dbeafe; color: #1e40af; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
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

.field { display: flex; flex-direction: column; gap: 4px; }
.field-label { font-size: 13px; font-weight: 500; color: #374151; }

.input {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  color: #111827;
  background: #ffffff;
  outline: none;
}

.input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26, 86, 219, 0.1); }
.textarea { resize: vertical; min-height: 60px; }

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
.form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }

@container (max-width: 640px) {
  .detail-header {
    flex-direction: column;
    gap: 12px;
  }

  .detail-card {
    padding: 18px;
  }

  .detail-name {
    font-size: 20px;
  }

  .rating-value {
    font-size: 24px;
  }

  .tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .tab {
    padding: 10px 14px;
    font-size: 13px;
    white-space: nowrap;
  }

  .inline-form {
    padding: 16px;
  }

  .item-head {
    flex-wrap: wrap;
    gap: 8px;
  }

  .item-card {
    padding: 12px 14px;
  }

  .item-date {
    margin-left: 0;
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
