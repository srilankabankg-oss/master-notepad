<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTenderStore } from '@/stores/tender'
import { useEmployeeStore } from '@/stores/employees'
import { errorMessage } from '@/api/client'
import type { TenderSummary, Subcontractor, Review, ContractorEvent, Meeting, Comment } from '@/types/api'

const route = useRoute()
const router = useRouter()
const tenderStore = useTenderStore()
const employeeStore = useEmployeeStore()

const subId = Number(route.params.id)
const summary = ref<TenderSummary | null>(null)
const loading = ref(true)
const error = ref('')

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

function eventTypeLabel(type: ContractorEvent['type']): string {
  return { positive: 'Позитивное', violation: 'Нарушение', info: 'Информация' }[type]
}

function eventTypeClass(type: ContractorEvent['type']): string {
  return `badge-${type}`
}

function getEmployeeName(id: number): string {
  const emp = employeeStore.items.find((e) => e.id === id)
  return emp ? emp.name : (id != null ? `#${id}` : '—')
}

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    await Promise.all([tenderStore.fetchSummary(subId), employeeStore.fetchAll()])
    summary.value = tenderStore.summary
  } catch (e: unknown) {
    error.value = errorMessage(e, 'Не удалось загрузить сводку')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="view">
    <button class="btn btn-back" @click="router.push('/subcontractors')">← Назад к списку подрядчиков</button>

    <div v-if="loading" class="state-message">Загрузка...</div>
    <div v-else-if="error" class="state-message state-error">{{ error }}</div>

    <template v-else-if="summary">
      <div class="detail-card">
        <div class="detail-header">
          <div>
            <h2 class="detail-name">{{ summary.subcontractor.name }}</h2>
            <div class="detail-meta">
              <span v-if="summary.subcontractor.company_name">{{ summary.subcontractor.company_name }}</span>
              <span v-if="summary.subcontractor.specialization" class="meta-sep">{{ summary.subcontractor.specialization }}</span>
            </div>
          </div>
          <div class="detail-rating">
            <span class="rating-value" :style="{ color: ratingColor(summary.rating ?? 0) }">
              {{ summary.rating ?? 'Нет оценок' }}
            </span>
          </div>
        </div>
        <div v-if="summary.subcontractor.description" class="detail-desc">{{ summary.subcontractor.description }}</div>
        <div v-if="summary.subcontractor.contact_info" class="detail-contact">{{ summary.subcontractor.contact_info }}</div>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-value">{{ summary.surveysCount }}</span>
          <span class="stat-label">Опросов</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ summary.violationsCount }}</span>
          <span class="stat-label">Нарушений</span>
        </div>
      </div>

      <div v-if="summary.reviews.length === 0" class="state-message">Нет отзывов</div>
      <div v-else class="section">
        <h3 class="section-title">Отзывы</h3>
        <div v-for="r in summary.reviews" :key="r.id" class="item-card">
          <div class="item-head">
            <span class="item-author">{{ getEmployeeName(r.employee_id) }}</span>
            <span class="item-rating" :style="{ color: ratingColor(r.rating) }">{{ r.rating }}/10</span>
            <span class="item-date">{{ formatDate(r.created_at) }}</span>
          </div>
          <div class="item-body">{{ r.content }}</div>
        </div>
      </div>

      <div v-if="summary.events.length === 0" class="state-message">Нет событий</div>
      <div v-else class="section">
        <h3 class="section-title">События</h3>
        <div v-for="ev in summary.events" :key="ev.id" class="item-card">
          <div class="item-head">
            <span :class="['event-badge-detail', eventTypeClass(ev.type)]">{{ eventTypeLabel(ev.type) }}</span>
            <span class="item-date">{{ formatDate(ev.event_date) }}</span>
            <span class="item-author">{{ getEmployeeName(ev.employee_id) }}</span>
          </div>
          <div class="item-body">{{ ev.description }}</div>
        </div>
      </div>

      <div v-if="summary.meetings.length === 0" class="state-message">Нет протоколов</div>
      <div v-else class="section">
        <h3 class="section-title">Протоколы совещаний</h3>
        <div v-for="m in summary.meetings" :key="m.id" class="item-card">
          <div class="item-head">
            <span class="item-author">{{ m.title }}</span>
            <span class="item-date">{{ formatDateTime(m.date) }}</span>
          </div>
          <div class="item-body"><strong>Повестка:</strong> {{ m.agenda }}</div>
          <div v-if="m.decisions" class="item-body"><strong>Решения:</strong> {{ m.decisions }}</div>
          <div v-if="m.notes" class="item-body"><strong>Заметки:</strong> {{ m.notes }}</div>
          <div v-if="m.attendees.length" class="item-body"><strong>Участники:</strong> {{ m.attendees.join(', ') }}</div>
        </div>
      </div>

      <div v-if="summary.comments.length === 0" class="state-message">Нет комментариев</div>
      <div v-else class="section">
        <h3 class="section-title">Комментарии</h3>
        <div v-for="c in summary.comments" :key="c.id" class="item-card">
          <div class="item-head">
            <span class="item-author">{{ getEmployeeName(c.employee_id) }}</span>
            <span class="item-date">{{ formatDate(c.created_at) }}</span>
          </div>
          <div class="item-body">{{ c.content }}</div>
        </div>
      </div>
    </template>

    <div v-else class="state-message">Нет данных</div>
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

.stats-row {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #1a56db;
}

.stat-label {
  font-size: 14px;
  color: #6b7280;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 8px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 4px 0;
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

.event-badge-detail {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
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

.state-message { padding: 32px 0; text-align: center; color: #6b7280; font-size: 15px; }
.state-error { color: #dc2626; }

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

  .stats-row {
    flex-direction: column;
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
}
</style>
