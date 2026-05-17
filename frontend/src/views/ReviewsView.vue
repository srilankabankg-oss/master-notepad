<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useReviewStore } from '@/stores/reviews'
import { useSubcontractorStore } from '@/stores/subcontractors'
import { useEmployeeStore } from '@/stores/employees'
import type { ReviewCreate, Review } from '@/types/api'
import { errorMessage } from '@/api/client'

const reviewStore = useReviewStore()
const subcontractorStore = useSubcontractorStore()
const employeeStore = useEmployeeStore()

const filterSubId = ref<number | undefined>(undefined)

const showForm = ref(false)
const editingId = ref<number | null>(null)
const formData = ref<ReviewCreate>({ subcontractorId: 0, employeeId: 0, content: '', rating: 5 })
const formError = ref('')
const formLoading = ref(false)

function ratingColor(rating: number): string {
  if (rating >= 7) return '#16a34a'
  if (rating >= 5) return '#ca8a04'
  return '#dc2626'
}

function getEmployeeName(id: number): string {
  return employeeStore.items.find((e) => e.id === id)?.name || (id != null ? `#${id}` : '—')
}

function getSubcontractorName(id: number): string {
  return subcontractorStore.items.find((s) => s.id === id)?.name || (id != null ? `#${id}` : '—')
}

function openCreate() {
  editingId.value = null
  formData.value = { subcontractorId: filterSubId.value || 0, employeeId: 0, content: '', rating: 5 }
  formError.value = ''
  showForm.value = true
}

function openEdit(r: Review) {
  editingId.value = r.id
  formData.value = { subcontractorId: r.subcontractor_id, employeeId: r.employee_id, content: r.content, rating: r.rating }
  formError.value = ''
  showForm.value = true
}

function closeForm() { showForm.value = false }

async function submitForm() {
  if (!formData.value.content.trim()) { formError.value = 'Текст отзыва обязателен'; return }
  if (!formData.value.subcontractorId) { formError.value = 'Выберите подрядчика'; return }
  if (!formData.value.employeeId) { formError.value = 'Выберите сотрудника'; return }
  formLoading.value = true
  formError.value = ''
  try {
    if (editingId.value) {
      await reviewStore.update(editingId.value, formData.value)
    } else {
      await reviewStore.create(formData.value)
    }
    showForm.value = false
  } catch (e: unknown) {
      formError.value = errorMessage(e)
  } finally {
    formLoading.value = false
  }
}

async function deleteItem(id: number) {
  if (!confirm('Удалить отзыв?')) return
  try { await reviewStore.remove(id) } catch (e: unknown) { alert(errorMessage(e, 'Ошибка')) }
}

async function loadData() {
  await reviewStore.fetchAll(filterSubId.value)
}

watch(filterSubId, () => loadData())

onMounted(async () => {
  await Promise.all([
    subcontractorStore.fetchAll(),
    employeeStore.fetchAll(),
    loadData(),
  ])
})
</script>

<template>
  <div class="view">
    <div class="view-header">
      <h2 class="view-title">Отзывы</h2>
      <button class="btn btn-primary" @click="openCreate">Добавить отзыв</button>
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
            <span class="review-author">{{ getEmployeeName(r.employee_id) }}</span>
            <span class="review-sub">— {{ getSubcontractorName(r.subcontractor_id) }}</span>
          </div>
          <span class="review-rating" :style="{ color: ratingColor(r.rating) }">{{ r.rating }}/10</span>
        </div>
        <div class="review-body">{{ r.content }}</div>
        <div class="review-actions">
          <button class="btn btn-sm btn-ghost" @click="openEdit(r)">Изменить</button>
          <button class="btn btn-sm btn-ghost btn-danger" @click="deleteItem(r.id)">Удалить</button>
        </div>
      </div>
    </div>

    <div v-if="showForm" class="modal-overlay" @click.self="closeForm">
      <div class="modal">
        <h3 class="modal-title">{{ editingId ? 'Изменить отзыв' : 'Новый отзыв' }}</h3>
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
            <button type="submit" class="btn btn-primary" :disabled="formLoading">Сохранить</button>
          </div>
        </form>
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

.review-list { display: flex; flex-direction: column; gap: 12px; }

.review-card {
  background: #ffffff; border: 1px solid #e5e7eb;
  border-radius: 8px; padding: 16px;
}

.review-head {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 8px;
}

.review-author { font-weight: 600; color: #111827; }
.review-sub { font-size: 13px; color: #6b7280; margin-left: 6px; }
.review-rating { font-size: 18px; font-weight: 700; }
.review-body { font-size: 14px; color: #374151; line-height: 1.6; }
.review-actions { margin-top: 8px; display: flex; gap: 4px; }

.rating-slider {
  display: flex; align-items: center; gap: 12px;
}

.slider { flex: 1; accent-color: #1a56db; height: 6px; }
.slider-val { font-size: 14px; font-weight: 600; color: #1a56db; min-width: 24px; }

.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}

.modal {
  background: #ffffff; border-radius: 12px;
  padding: 28px; width: 480px; max-width: 90vw;
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

  .review-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .review-card {
    padding: 14px;
  }

  .review-rating {
    font-size: 16px;
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
