<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSubcontractorStore } from '@/stores/subcontractors'
import { useReviewStore } from '@/stores/reviews'
import { useCommentStore } from '@/stores/comments'
import { useMeetingStore } from '@/stores/meetings'
import { useSurveyStore } from '@/stores/surveys'
import { useEventStore } from '@/stores/events'
import { useEmployeeStore } from '@/stores/employees'
import TabGroup from '@/components/TabGroup.vue'
import EntityHeader from '@/components/EntityHeader.vue'
import ReviewsTab from './subcontractor-detail/ReviewsTab.vue'
import CommentsTab from './subcontractor-detail/CommentsTab.vue'
import MeetingsTab from './subcontractor-detail/MeetingsTab.vue'
import SurveysTab from './subcontractor-detail/SurveysTab.vue'
import EventsTab from './subcontractor-detail/EventsTab.vue'

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
const sub = ref<Awaited<ReturnType<typeof subcontractorStore.fetchById>> | null>(null)
const loading = ref(true)
const error = ref('')
const activeTab = ref<'reviews' | 'comments' | 'meetings' | 'surveys' | 'events'>('reviews')

async function loadAll() {
  const [fetched] = await Promise.all([
    subcontractorStore.fetchById(subId),
    reviewStore.fetchAll(subId),
    commentStore.fetchAll(subId),
    meetingStore.fetchAll(subId),
    surveyStore.fetchAll(),
    eventStore.fetchAll(subId),
    employeeStore.fetchAll(),
  ])
  sub.value = fetched || null
}

onMounted(async () => {
  try {
    await loadAll()
  } catch (e: unknown) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
})

const tabs = [
  { key: 'reviews', label: 'Отзывы' },
  { key: 'comments', label: 'Комментарии' },
  { key: 'meetings', label: 'Протоколы' },
  { key: 'surveys', label: 'Опросы' },
  { key: 'events', label: 'События' },
]
</script>

<template>
  <div class="view">
    <button class="btn btn-back" @click="router.push('/subcontractors')">← Назад к списку</button>

    <div v-if="loading" class="state-message">Загрузка...</div>
    <div v-else-if="error" class="state-message state-error">{{ error }}</div>

    <template v-else-if="sub">
      <EntityHeader
        :name="sub.name"
        :company-name="sub.companyName"
        :specialization="sub.specialization"
        :rating="sub.rating"
        :description="sub.description"
        :contact-info="sub.contactInfo"
      />

      <TabGroup v-model="activeTab" :tabs="tabs" />

      <ReviewsTab :sub-id="subId" @refresh="loadAll" />
      <CommentsTab :sub-id="subId" @refresh="loadAll" />
      <MeetingsTab :sub-id="subId" @refresh="loadAll" />
      <SurveysTab :sub-id="subId" @refresh="loadAll" />
      <EventsTab :sub-id="subId" @refresh="loadAll" />
    </template>

    <div v-else class="state-message">Подрядчик не найден</div>
  </div>
</template>

<style scoped>
.view { max-width: 56.25rem; container-type: inline-size; }

@container (max-width: 40rem) {
  .btn-back { font-size: 0.8125rem; }
}
</style>
