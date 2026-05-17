<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useReviewStore } from '@/stores/reviews'
import { useSubcontractorStore } from '@/stores/subcontractors'
import { useEmployeeStore } from '@/stores/employees'
import type { ReviewCreate, Review } from '@/types/api'
import { useEmployeeName, useSubcontractorName } from '@/composables/useEntityName'
import { ratingColor } from '@/composables/useRating'
import { useEntityForm } from '@/composables/useEntityForm'
import { useDeleteConfirm } from '@/composables/useDeleteConfirm'
import RatingBadge from '@/components/RatingBadge.vue'
import Modal from '@/components/Modal.vue'
import BaseButton from '@/components/BaseButton.vue'

const reviewStore = useReviewStore()
const subcontractorStore = useSubcontractorStore()
const employeeStore = useEmployeeStore()

const filterSubId = ref<number | undefined>(undefined)
const getEmployeeName = useEmployeeName(employeeStore.items)
const getSubcontractorName = useSubcontractorName(subcontractorStore.items)

const { showForm, editingId, formData, formError, formLoading, openCreate, openEdit, closeForm, submitForm } = useEntityForm({
  entityName: 'Отзыв',
  defaultCreateValues: { subcontractorId: 0, employeeId: 0, content: '', rating: 5 },
  toCreateData: (r: Review) => ({ subcontractorId: r.subcontractorId, employeeId: r.employeeId, content: r.content, rating: r.rating }),
  onSubmit: async ({ isEdit, id, values }: { isEdit: boolean; id: number | null; values: ReviewCreate }) => {
    if (isEdit && id) await reviewStore.update(id, values)
    else await reviewStore.create(values)
    await loadData()
  },
  validate: () => {
    if (!formData.value.content.trim()) { formError.value = 'Текст отзыва обязателен'; return false }
    if (!formData.value.subcontractorId) { formError.value = 'Выберите подрядчика'; return false }
    if (!formData.value.employeeId) { formError.value = 'Выберите сотрудника'; return false }
    return true
  },
})

const { deleteItem } = useDeleteConfirm((id: number) => reviewStore.remove(id), 'отзыв')

async function loadData() {
  await reviewStore.fetchAll(filterSubId.value)
}

watch(filterSubId, () => loadData())

onMounted(async () => {
  await Promise.all([subcontractorStore.fetchAll(), employeeStore.fetchAll(), loadData()])
})
</script>

<template>
  <div class="view">
    <div class="view-header">
      <h2 class="view-title">Отзывы</h2>
      <BaseButton variant="primary" @click="openCreate">Добавить отзыв</BaseButton>
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

    <div v-if="reviewStore.loading" class="state-message">Загрузка...</div>
    <div v-else-if="reviewStore.error" class="state-message state-error">{{ reviewStore.error }}</div>
    <div v-else-if="reviewStore.items.length === 0" class="state-message">Нет отзывов</div>

    <div v-else class="review-list">
      <div v-for="r in reviewStore.items" :key="r.id" class="review-card">
        <div class="review-head">
          <div>
            <span class="review-author">{{ getEmployeeName(r.employeeId) }}</span>
            <span class="review-sub">— {{ getSubcontractorName(r.subcontractorId) }}</span>
          </div>
          <RatingBadge :rating="r.rating" />
        </div>
        <div class="review-body">{{ r.content }}</div>
        <div class="review-actions">
          <BaseButton size="sm" variant="ghost" @click="openEdit(r)">Изменить</BaseButton>
          <BaseButton size="sm" variant="danger" @click="deleteItem(r.id)">Удалить</BaseButton>
        </div>
      </div>
    </div>

    <Modal v-model="showForm" :title="editingId ? 'Изменить отзыв' : 'Новый отзыв'">
      <form @submit.prevent="submitForm" class="form">
        <label class="field">
          <span class="field-label">Подрядчик</span>
          <select v-model="formData.subcontractorId" class="input">
            <option :value="0" disabled>Выберите</option>
            <option v-for="s in subcontractorStore.items" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">Сотрудник</span>
          <select v-model="formData.employeeId" class="input">
            <option :value="0" disabled>Выберите</option>
            <option v-for="e in employeeStore.items" :key="e.id" :value="e.id">{{ e.name }}</option>
          </select>
        </label>
        <label class="field">
          <span class="field-label">Оценка (1-10)</span>
          <div class="rating-slider">
            <input type="range" min="1" max="10" v-model.number="formData.rating" class="slider" />
            <span class="slider-val">{{ formData.rating }}</span>
          </div>
        </label>
        <label class="field">
          <span class="field-label">Текст</span>
          <textarea v-model="formData.content" class="input textarea" rows="4" />
        </label>
        <div v-if="formError" class="form-error">{{ formError }}</div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" @click="closeForm">Отмена</button>
          <button type="submit" class="btn btn-primary" :disabled="formLoading">{{ formLoading ? 'Сохранение...' : 'Сохранить' }}</button>
        </div>
      </form>
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

.review-list { display: flex; flex-direction: column; gap: 0.75rem; }

.review-card {
  background: var(--color-bg-card); border: 0.0625rem solid var(--color-border);
  border-radius: 0.5rem; padding: 1rem;
}

.review-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 0.5rem;
}

.review-author { font-weight: 600; color: var(--color-text); }
.review-sub { font-size: 0.8125rem; color: var(--color-text-muted); margin-left: 0.375rem; }
.review-body { font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.6; }
.review-actions { margin-top: 0.5rem; display: flex; gap: 0.25rem; }

.rating-slider {
  display: flex; align-items: center; gap: 0.75rem;
}

.slider { flex: 1; accent-color: var(--color-primary); height: 0.375rem; }
.slider-val { font-size: 0.875rem; font-weight: 600; color: var(--color-primary); min-width: 1.5rem; }

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

  .review-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.375rem;
  }

  .review-card {
    padding: 0.875rem;
  }
}
</style>
