<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Survey, SurveyCreate } from '@/types/api'
import { useSurveyStore } from '@/stores/surveys'
import { useEmployeeStore } from '@/stores/employees'
import { errorMessage } from '@/api/client'
import { useDeleteConfirm } from '@/composables/useDeleteConfirm'
import Modal from '@/components/Modal.vue'
import BaseButton from '@/components/BaseButton.vue'

const props = defineProps<{ subId: number }>()
const emit = defineEmits<{ refresh: [] }>()

const surveyStore = useSurveyStore()
const employeeStore = useEmployeeStore()

const { deleteItem } = useDeleteConfirm((id) => surveyStore.remove(id), 'опрос')

const subSurveys = computed(() => surveyStore.items.filter(s => s.subcontractorId === props.subId))

// Survey create form
const surveyForm = ref(false)
const surveyData = ref<SurveyCreate>({ title: '', subcontractorId: props.subId, createdBy: 0 })
const surveyError = ref('')
const surveySaving = ref(false)

// Survey response form
const responseForm = ref(false)
const responseSurveyId = ref(0)
const responseAnswers = ref<Record<string, string>>({})
const responseError = ref('')

function openResponseForm(survey: Survey) {
  responseSurveyId.value = survey.id
  responseAnswers.value = {}
  responseError.value = ''
  responseForm.value = true
}

async function submitSurvey() {
  if (!surveyData.value.title.trim()) { surveyError.value = 'Название обязательно'; return }
  if (!surveyData.value.createdBy) { surveyError.value = 'Выберите сотрудника'; return }
  surveySaving.value = true
  surveyError.value = ''
  try {
    await surveyStore.create({ ...surveyData.value, subcontractorId: props.subId })
    surveyForm.value = false
    emit('refresh')
  } catch (e: unknown) {
    surveyError.value = errorMessage(e, 'Ошибка')
  } finally {
    surveySaving.value = false
  }
}

async function submitResponse() {
  if (!responseAnswers.value || Object.keys(responseAnswers.value).length === 0) {
    responseError.value = 'Заполните хотя бы один ответ'; return
  }
  try {
    await surveyStore.respond(responseSurveyId.value, { employeeId: employeeStore.items[0]?.id || 1, answers: responseAnswers.value })
    responseForm.value = false
  } catch (e: unknown) {
    responseError.value = errorMessage(e, 'Ошибка')
  }
}
</script>

<template>
  <div class="tab-content">
    <BaseButton variant="primary" size="sm" @click="surveyForm = true; surveyError = ''; surveyData = { title: '', subcontractorId: subId, createdBy: 0 }">Создать опрос</BaseButton>

    <Modal v-model="surveyForm" title="Новый опрос">
      <form @submit.prevent="submitSurvey" class="form">
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
        <div class="form-actions">
          <BaseButton variant="secondary" type="button" @click="surveyForm = false">Отмена</BaseButton>
          <BaseButton variant="primary" type="submit" :disabled="surveySaving">Создать</BaseButton>
        </div>
      </form>
    </Modal>

    <div v-if="subSurveys.length === 0 && !surveyForm" class="state-message">Нет опросов</div>

    <div v-for="s in subSurveys" :key="s.id" class="item-card">
      <div class="item-head">
        <span class="item-author">{{ s.title }}</span>
        <span>{{ s.questions.length }} вопросов</span>
        <span class="item-date">{{ s.createdAt }}</span>
        <BaseButton variant="ghost" size="sm" @click="openResponseForm(s)">Ответить</BaseButton>
        <BaseButton variant="ghost" size="sm" @click="deleteItem(s.id)">Удалить</BaseButton>
      </div>
      <ul class="question-list">
        <li v-for="(q, qi) in s.questions" :key="qi">{{ q }}</li>
      </ul>
    </div>

    <Modal v-model="responseForm" title="Ответ на опрос">
      <label v-for="(q, qi) in subSurveys.find(s => s.id === responseSurveyId)?.questions || []" :key="qi" class="field">
        <span class="field-label">{{ q }}</span>
        <textarea v-model="responseAnswers[q]" class="input textarea" rows="2" placeholder="Ваш ответ..." />
      </label>
      <div v-if="responseError" class="form-error">{{ responseError }}</div>
      <div class="form-actions">
        <BaseButton variant="secondary" type="button" @click="responseForm = false">Отмена</BaseButton>
        <BaseButton variant="primary" type="button" @click="submitResponse">Отправить</BaseButton>
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
