<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useSurveyStore } from '@/stores/surveys'
import { useSubcontractorStore } from '@/stores/subcontractors'
import { useEmployeeStore } from '@/stores/employees'
import type { Survey, SurveyCreate, SurveyResponse } from '@/types/api'
import { errorMessage } from '@/api/client'

const surveyStore = useSurveyStore()
const subcontractorStore = useSubcontractorStore()
const employeeStore = useEmployeeStore()

const showForm = ref(false)
const formData = ref<SurveyCreate>({ title: '', subcontractorId: 0, createdBy: 0 })
const formError = ref('')
const formLoading = ref(false)

const responseForm = ref(false)
const responseSurvey = ref<Survey | null>(null)
const responseAnswers = ref<Record<string, string>>({})
const responseEmployeeId = ref(0)
const responseError = ref('')
const responseLoading = ref(false)
const responseList = ref<SurveyResponse[]>([])
const showResponses = ref(false)
const responsesLoading = ref(false)

function getSubcontractorName(id: number): string {
  return subcontractorStore.items.find((s) => s.id === id)?.name || (id != null ? `#${id}` : '—')
}

function getEmployeeName(id: number): string {
  return employeeStore.items.find((e) => e.id === id)?.name || (id != null ? `#${id}` : '—')
}

function openCreate() {
  formData.value = { title: '', subcontractorId: 0, createdBy: 0 }
  formError.value = ''
  showForm.value = true
}

async function submitCreate() {
  if (!formData.value.title.trim()) { formError.value = 'Название обязательно'; return }
  if (!formData.value.subcontractorId) { formError.value = 'Выберите подрядчика'; return }
  if (!formData.value.createdBy) { formError.value = 'Выберите создателя'; return }
  formLoading.value = true
  formError.value = ''
  try {
    await surveyStore.create(formData.value)
    showForm.value = false
  } catch (e: unknown) {
    formError.value = errorMessage(e, 'Ошибка')
  } finally {
    formLoading.value = false
  }
}

async function deleteSurvey(id: number) {
  if (!confirm('Удалить опрос?')) return
  try { await surveyStore.remove(id) } catch (e: unknown) { alert(errorMessage(e, 'Ошибка')) }
}

function openRespond(survey: Survey) {
  responseSurvey.value = survey
  responseAnswers.value = {}
  responseEmployeeId.value = 0
  responseError.value = ''
  responseForm.value = true
}

async function submitResponse() {
  const answers = responseAnswers.value
  if (!answers || Object.keys(answers).length === 0) {
    responseError.value = 'Заполните хотя бы один ответ'
    return
  }
    if (!responseSurvey.value) return
    if (!responseEmployeeId.value) {
      responseError.value = 'Выберите сотрудника'
      return
    }
    responseLoading.value = true
    responseError.value = ''
    try {
      await surveyStore.respond(responseSurvey.value.id, {
        employeeId: responseEmployeeId.value,
        answers,
      })
    responseForm.value = false
  } catch (e: unknown) {
    responseError.value = errorMessage(e, 'Ошибка')
  } finally {
    responseLoading.value = false
  }
}

async function viewResponses(surveyId: number) {
  responsesLoading.value = true
  try {
    responseList.value = await surveyStore.responses(surveyId)
    showResponses.value = true
  } catch (e: unknown) {
    alert(errorMessage(e, 'Ошибка'))
  } finally {
    responsesLoading.value = false
  }
}

onMounted(async () => {
  await Promise.all([
    surveyStore.fetchAll(),
    subcontractorStore.fetchAll(),
    employeeStore.fetchAll(),
  ])
})
</script>

<template>
  <div class="view">
    <div class="view-header">
      <h2 class="view-title">Опросы</h2>
      <button class="btn btn-primary" @click="openCreate">Создать опрос</button>
    </div>

    <div v-if="surveyStore.loading" class="state-message">Загрузка...</div>
    <div v-else-if="surveyStore.error" class="state-message state-error">{{ surveyStore.error }}</div>
    <div v-else-if="surveyStore.items.length === 0" class="state-message">Нет опросов</div>

    <div v-else class="survey-list">
      <div v-for="s in surveyStore.items" :key="s.id" class="survey-card">
        <div class="survey-head">
          <div>
            <h3 class="survey-title">{{ s.title }}</h3>
            <div class="survey-meta">
              Подрядчик: {{ getSubcontractorName(s.subcontractor_id) }} |
              Создал: {{ getEmployeeName(s.created_by) }} |
              {{ s.questions.length }} вопросов
            </div>
          </div>
        </div>
        <ul class="question-list">
          <li v-for="(q, qi) in s.questions" :key="qi">{{ q }}</li>
        </ul>
        <div class="survey-actions">
          <button class="btn btn-sm btn-ghost" @click="openRespond(s)">Ответить</button>
          <button class="btn btn-sm btn-ghost" @click="viewResponses(s.id)">Ответы</button>
          <button class="btn btn-sm btn-ghost btn-danger" @click="deleteSurvey(s.id)">Удалить</button>
        </div>
      </div>
    </div>

    <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
      <div class="modal">
        <h3 class="modal-title">Новый опрос</h3>
        <div class="form">
          <label class="field">
            <span class="field-label">Название *</span>
            <input v-model="formData.title" class="input" />
          </label>
          <label class="field">
            <span class="field-label">Подрядчик *</span>
            <select v-model="formData.subcontractorId" class="input">
              <option :value="0" disabled>Выберите</option>
              <option v-for="s in subcontractorStore.items" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">Создатель *</span>
            <select v-model="formData.createdBy" class="input">
              <option :value="0" disabled>Выберите</option>
              <option v-for="e in employeeStore.items" :key="e.id" :value="e.id">{{ e.name }}</option>
            </select>
          </label>
          <p class="form-hint">Будут добавлены 5 стандартных вопросов</p>
          <div v-if="formError" class="form-error">{{ formError }}</div>
          <div class="form-actions">
            <button class="btn btn-secondary" @click="showForm = false">Отмена</button>
            <button class="btn btn-primary" :disabled="formLoading" @click="submitCreate">Создать</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="responseForm" class="modal-overlay" @click.self="responseForm = false">
      <div class="modal">
        <h3 class="modal-title">Ответ на опрос: {{ responseSurvey?.title }}</h3>
        <div class="form">
          <label class="field">
            <span class="field-label">Сотрудник *</span>
            <select v-model="responseEmployeeId" class="input">
              <option :value="0" disabled>Выберите</option>
              <option v-for="e in employeeStore.items" :key="e.id" :value="e.id">{{ e.name }}</option>
            </select>
          </label>
          <label v-for="(q, qi) in responseSurvey?.questions || []" :key="qi" class="field">
            <span class="field-label">{{ q }}</span>
            <textarea
              v-model="responseAnswers[q]"
              class="input textarea"
              rows="2"
              placeholder="Ваш ответ..."
            />
          </label>
          <div v-if="responseError" class="form-error">{{ responseError }}</div>
          <div class="form-actions">
            <button class="btn btn-secondary" @click="responseForm = false">Отмена</button>
            <button class="btn btn-primary" :disabled="responseLoading" @click="submitResponse">Отправить</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showResponses" class="modal-overlay" @click.self="showResponses = false">
      <div class="modal" style="max-height: 80vh; overflow-y: auto;">
        <h3 class="modal-title">Ответы на опрос</h3>
        <div v-if="responsesLoading" class="state-message">Загрузка...</div>
        <div v-else-if="responseList.length === 0" class="state-message">Нет ответов</div>
        <div v-else class="responses-list">
          <div v-for="(resp, ri) in responseList" :key="resp.id" class="response-card">
            <div class="response-head">Сотрудник #{{ resp.employee_id }} — {{ new Date(resp.created_at).toLocaleString('ru-RU') }}</div>
            <div v-for="(answer, q) in resp.answers" :key="q" class="response-item">
              <strong>{{ q }}</strong>
              <p>{{ answer }}</p>
            </div>
          </div>
        </div>
        <div class="form-actions" style="margin-top: 1rem;">
          <button class="btn btn-secondary" @click="showResponses = false">Закрыть</button>
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

.survey-list { display: flex; flex-direction: column; gap: 0.875rem; }

.survey-card {
  background: #ffffff; border: 0.0625rem solid #e5e7eb;
  border-radius: 0.5rem; padding: 1.25rem;
}

.survey-head { margin-bottom: 0.75rem; }
.survey-title { font-size: 1rem; font-weight: 600; color: #111827; margin: 0; }
.survey-meta { font-size: 0.75rem; color: #9ca3af; margin-top: 0.125rem; }

.question-list {
  margin: 0 0 0.75rem 1.25rem; font-size: 0.8125rem; color: #6b7280;
}

.question-list li { margin-bottom: 0.1875rem; }

.survey-actions { display: flex; gap: 0.25rem; }

.form-hint { font-size: 0.75rem; color: #9ca3af; margin: 0; }

.responses-list { display: flex; flex-direction: column; gap: 0.75rem; }

.response-card {
  border: 0.0625rem solid #e5e7eb; border-radius: 0.5rem; padding: 0.875rem;
  background: #f9fafb;
}

.response-head { font-size: 0.8125rem; font-weight: 500; color: #374151; margin-bottom: 0.5rem; }

.response-item { margin-bottom: 0.5rem; }
.response-item strong { font-size: 0.8125rem; color: #374151; }
.response-item p { font-size: 0.875rem; color: #4b5563; margin: 0.125rem 0 0; }

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

  .survey-head {
    flex-direction: column;
  }

  .survey-card {
    padding: 1rem;
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
