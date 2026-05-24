<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTenderStore } from '@/stores/tender'
import { useEmployeeStore } from '@/stores/employees'
import { errorMessage } from '@/api/client'
import { useEmployeeName } from '@/composables/useEntityName'
import { ratingColor } from '@/composables/useRating'
import { formatDate, formatDateTime } from '@/composables/useDateFormatter'
import EventBadge from '@/components/EventBadge.vue'
import type { TenderSummary } from '@/types/api'

const route = useRoute()
const router = useRouter()
const tenderStore = useTenderStore()
const employeeStore = useEmployeeStore()

const subId = Number(route.params.id)
const summary = ref<TenderSummary | null>(null)
const loading = ref(true)
const error = ref('')

const getEmployeeName = useEmployeeName(employeeStore.items)

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
              <span v-if="summary.subcontractor.companyName">{{ summary.subcontractor.companyName }}</span>
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
        <div v-if="summary.subcontractor.contactInfo" class="detail-contact">{{ summary.subcontractor.contactInfo }}</div>
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
            <span class="item-author">{{ getEmployeeName(r.employeeId) }}</span>
            <span class="item-rating" :style="{ color: ratingColor(r.rating) }">{{ r.rating }}/10</span>
            <span class="item-date">{{ formatDate(r.createdAt) }}</span>
          </div>
          <div class="item-body">{{ r.content }}</div>
        </div>
      </div>

      <div v-if="summary.events.length === 0" class="state-message">Нет событий</div>
      <div v-else class="section">
        <h3 class="section-title">События</h3>
        <div v-for="ev in summary.events" :key="ev.id" class="item-card">
          <div class="item-head">
            <EventBadge :type="ev.type" />
            <span class="item-date">{{ formatDate(ev.eventDate) }}</span>
            <span class="item-author">{{ getEmployeeName(ev.employeeId) }}</span>
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
          <div v-if="m.attendees?.length" class="item-body"><strong>Участники:</strong> {{ m.attendees.join(', ') }}</div>
        </div>
      </div>

      <div v-if="!summary.comments?.length" class="state-message">Нет комментариев</div>
      <div v-else class="section">
        <h3 class="section-title">Комментарии</h3>
        <div v-for="c in summary.comments" :key="c.id" class="item-card">
          <div class="item-head">
            <span class="item-author">{{ getEmployeeName(c.employeeId) }}</span>
            <span class="item-date">{{ formatDate(c.createdAt) }}</span>
          </div>
          <div class="item-body">{{ c.content }}</div>
        </div>
      </div>
    </template>

    <div v-else class="state-message">Нет данных</div>
  </div>
</template>

<style scoped>
.view { max-width: 56.25rem; container-type: inline-size; }

.btn-back {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0;
  margin-bottom: 1rem;
}

.btn-back:hover { color: var(--color-primary); }

.detail-card {
  background: var(--color-bg-card);
  border-radius: 0.625rem;
  padding: 1.5rem;
  box-shadow: 0 0.0625rem 0.1875rem rgba(0, 0, 0, 0.08);
  margin-bottom: 1.25rem;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.detail-name {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--color-text);
}

.detail-meta {
  margin-top: 0.25rem;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  display: flex;
  gap: 0.5rem;
}

.meta-sep::before { content: '·'; margin-right: 0.5rem; }

.detail-rating {
  text-align: center;
}

.rating-value {
  font-size: 1.75rem;
  font-weight: 700;
}

.detail-desc {
  margin-top: 0.75rem;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

.detail-contact {
  margin-top: 0.375rem;
  color: var(--color-text-muted);
  font-size: 0.8125rem;
}

.stats-row {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.stat-card {
  background: var(--color-bg-card);
  border: 0.0625rem solid var(--color-border);
  border-radius: 0.5rem;
  padding: 0.875rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex: 1;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-primary);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 0.25rem 0;
}

.item-card {
  background: var(--color-bg-card);
  border: 0.0625rem solid var(--color-border);
  border-radius: 0.5rem;
  padding: 0.875rem 1rem;
}

.item-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.375rem;
}

.item-author {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--color-text);
}

.item-rating {
  font-weight: 700;
  font-size: 0.875rem;
}

.item-date {
  font-size: 0.75rem;
  color: var(--color-text-meta);
  margin-left: auto;
}

.item-body {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.event-badge-detail {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.625rem;
  border-radius: 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
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
  .detail-header {
    flex-direction: column;
    gap: 0.75rem;
  }

  .detail-card {
    padding: 1.125rem;
  }

  .detail-name {
    font-size: 1.25rem;
  }

  .rating-value {
    font-size: 1.5rem;
  }

  .stats-row {
    flex-direction: column;
  }

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
