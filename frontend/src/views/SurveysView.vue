<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useSurveyStore } from '@/stores/surveys'
import { useSubcontractorStore } from '@/stores/subcontractors'
import { useEmployeeStore } from '@/stores/employees'
import type { Survey, SurveyCreate, SurveyResponse } from '@/types/api'
import { errorMessage } from '@/api/client'
import { useSubcontractorName, useEmployeeName } from '@/composables/useEntityName'
import { formatDateTime } from '@/composables/useDateFormatter'
import { useEntityForm } from '@/composables/useEntityForm'
import { useDeleteConfirm } from '@/composables/useDeleteConfirm'
import Modal from '@/components/Modal.vue'
import BaseButton from '@/components/BaseButton.vue'

const surveyStore = useSurveyStore()
const subcontractorStore = useSubcontractorStore()
const employeeStore = useEmployeeStore()

const getSubcontractorName = useSubcontractorName(subcontractorStore.items)
const getEmployeeName = useEmployeeName(employeeStore.items)

const { showForm, formData, formError, formLoading, openCreate, closeForm, submitForm } = useEntityForm({
  entityName: 'Опрос',
  defaultCreateValues: { title: '', subcontractorId: 0, createdBy: 0 },
  toCreateData: (s: Survey) => ({ title: s.title, subcontractorId: s.subcontractorId, createdBy: s.createdBy }),
  onSubmit: async () => { await surveyStore.create(formData.value) },
  validate: () => {
    if (!formData.value.title.trim()) { formError.value = 'Название обязательно'; return false }
    if (!formData.value.subcontractorId) { formError.value = 'Выберите подрядчика'; return false }
    if (!formData.value.createdBy) { formError.value = 'Выберите создателя'; return false }
    return true
  },
})

const { deleteItem } = useDeleteConfirm((id: number) => surveyStore.remove(id), 'опрос')

const responseForm = ref(false)
const responseSurvey = ref<Survey | null>(null)
const responseAnswers = ref<Record<string, string>>({})
const responseEmployeeId = ref(0)
const responseError = ref('')
const responseLoading = ref(false)
const showResponses = ref(false)
const responseList = ref<SurveyResponse[]>([])
const responsesLoading = ref(false)

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
    await surveyStore.respond(responseSurvey.value.id, { employeeId: responseEmployeeId.value, answers })
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
  await Promise.all([surveyStore.fetchAll(), subcontractorStore.fetchAll(), employeeStore.fetchAll()])
})
</script>

<template>
  <div class="view">
    <div class="view-header">
      <h2 class="view-title">Опросы</h2>
      <BaseButton variant="primary" @click="openCreate">Создать опрос</BaseButton>
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
              Подрядчик: {{ getSubcontractorName(s.subcontractorId) }} |
              Создал: {{ getEmployeeName(s.createdBy) }} |
              {{ s.questions.length }} вопросов
            </div>
          </div>
        </div>
        <ul class="question-list">
          <li v-for="(q, qi) in s.questions" :key="qi">{{ q }}</li>
        </ul>
        <div class="survey-actions">
          <BaseButton size="sm" variant="ghost" @click="openRespond(s)">Ответить</BaseButton>
          <BaseButton size="sm" variant="ghost" @click="viewResponses(s.id)">Ответы</BaseButton>
          <BaseButton size="sm" variant="danger" @click="deleteItem(s.id)">Удалить</BaseButton>
        </div>
      </div>
    </div>

    <Modal v-model="showForm" :title="'Новый опрос'">
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
        <BaseButton variant="secondary" type="button" @click="closeForm">Отмена</BaseButton>
        <BaseButton variant="primary" type="button" :disabled="formLoading" @click="submitForm">Создать</BaseButton>
      </div>
    </Modal>

    <Modal v-model="responseForm" :title="'Ответ на опрос: ' + responseSurvey?.title">
      <label class="field">
        <span class="field-label">Сотрудник *</span>
        <select v-model="responseEmployeeId" class="input">
          <option :value="0" disabled>Выберите</option>
          <option v-for="e in employeeStore.items" :key="e.id" :value="e.id">{{ e.name }}</option>
        </select>
      </label>
      <label v-for="(q, qi) in responseSurvey?.questions || []" :key="qi" class="field">
        <span class="field-label">{{ q }}</span>
        <textarea v-model="responseAnswers[q]" class="input textarea" rows="2" placeholder="Ваш ответ..." />
      </label>
      <div v-if="responseError" class="form-error">{{ responseError }}</div>
      <div class="form-actions">
        <BaseButton variant="secondary" type="button" @click="responseForm = false">Отмена</BaseButton>
        <BaseButton variant="primary" type="button" :disabled="responseLoading" @click="submitResponse">Отправить</BaseButton>
      </div>
    </Modal>

    <Modal v-model="showResponses" :title="'Ответы на опрос'">
      <div v-if="responsesLoading" class="state-message">Загрузка...</div>
      <div v-else-if="responseList.length === 0" class="state-message">Нет ответов</div>
      <div v-else class="responses-list">
        <div v-for="(resp, ri) in responseList" :key="resp.id" class="response-card">
          <div class="response-head">Сотрудник #{{ resp.employeeId }} — {{ formatDateTime(resp.createdAt) }}</div>
          <div v-for="(answer, q) in resp.answers" :key="q" class="response-item">
            <strong>{{ q }}</strong>
            <p>{{ answer }}</p>
          </div>
        </div>
      </div>
      <div class="form-actions">
        <BaseButton variant="secondary" type="button" @click="showResponses = false">Закрыть</BaseButton>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.view { max-width: 56.25rem; container-type: inline-size; }

.survey-list { display: flex; flex-direction: column; gap: 0.875rem; }

.survey-card {
  background: var(--color-bg-card); border: 0.0625rem solid var(--color-border);
  border-radius: var(--radius-md); padding: 1.25rem;
}

.survey-head { margin-bottom: 0.75rem; }
.survey-title { font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); color: var(--color-text); margin: 0; }
.survey-meta { font-size: var(--font-size-xs); color: var(--color-text-meta); margin-top: 0.125rem; }

.question-list {
  margin: 0 0 var(--space-3) var(--space-5); font-size: 0.8125rem; color: var(--color-text-muted);
}

.question-list li { margin-bottom: 0.1875rem; }

.survey-actions { display: flex; gap: 0.25rem; }

.form-hint { font-size: var(--font-size-xs); color: var(--color-text-meta); margin: 0; }

.responses-list { display: flex; flex-direction: column; gap: var(--space-3); }

.response-card {
  border: 0.0625rem solid var(--color-border); border-radius: var(--radius-md); padding: 0.875rem;
  background: var(--color-bg-subtle);
}

.response-head { font-size: 0.8125rem; font-weight: var(--font-weight-medium); color: var(--color-text-secondary); margin-bottom: 0.5rem; }

.response-item { margin-bottom: 0.5rem; }
.response-item strong { font-size: 0.8125rem; color: var(--color-text-secondary); }
.response-item p { font-size: var(--font-size-base); color: var(--color-text-secondary); margin: 0.125rem 0 0; }

@container (max-width: 40rem) {
  .view-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .survey-head {
    flex-direction: column;
  }

  .survey-card {
    padding: 1rem;
  }
}
</style>
