<script setup lang="ts">
import { ref } from 'vue'
import type { Review, ReviewCreate } from '@/types/api'
import { useReviewStore } from '@/stores/reviews'
import { useEmployeeStore } from '@/stores/employees'
import { errorMessage } from '@/api/client'
import { ratingColor } from '@/composables/useRating'
import { useDeleteConfirm } from '@/composables/useDeleteConfirm'
import { useEntityForm } from '@/composables/useEntityForm'
import Modal from '@/components/Modal.vue'
import BaseButton from '@/components/BaseButton.vue'

const props = defineProps<{ subId: number }>()
const emit = defineEmits<{ refresh: [] }>()

const reviewStore = useReviewStore()
const employeeStore = useEmployeeStore()

const { deleteItem } = useDeleteConfirm((id: number) => reviewStore.remove(id), 'отзыв')

const {
  showForm, editingId, formData, formError, formLoading,
  openCreate, openEdit, closeForm, submitForm,
} = useEntityForm<Review, ReviewCreate>({
  entityName: 'Отзыв',
  defaultCreateValues: { subcontractorId: props.subId, employeeId: 0, content: '', rating: 5 },
  toCreateData: (r) => ({ subcontractorId: r.subcontractorId, employeeId: r.employeeId, content: r.content, rating: r.rating }),
  onSubmit: async ({ isEdit, id, values }) => {
    if (isEdit && id != null) await reviewStore.update(id, values)
    else await reviewStore.create(values)
    emit('refresh')
  },
  validate: () => {
    if (!formData.value.content.trim()) { formError.value = 'Текст отзыва обязателен'; return false }
    if (!formData.value.employeeId) { formError.value = 'Выберите сотрудника'; return false }
    return true
  },
})

async function deleteReview(id: number) {
  if (!confirm('Удалить отзыв?')) return
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
    <BaseButton variant="primary" size="sm" @click="openCreate">Добавить отзыв</BaseButton>

    <Modal v-model="showForm" :title="editingId ? 'Изменить отзыв' : 'Новый отзыв'">
      <form @submit.prevent="submitForm" class="form">
        <label class="field">
          <span class="field-label">Сотрудник</span>
          <select v-model="formData.employeeId" class="input">
            <option :value="0" disabled>Выберите сотрудника</option>
            <option v-for="emp in employeeStore.items" :key="emp.id" :value="emp.id">{{ emp.name }}</option>
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
          <textarea v-model="formData.content" class="input textarea" rows="3" />
        </label>
        <div v-if="formError" class="form-error">{{ formError }}</div>
        <div class="form-actions">
          <BaseButton variant="secondary" type="button" @click="closeForm">Отмена</BaseButton>
          <BaseButton variant="primary" type="submit" :disabled="formLoading">Сохранить</BaseButton>
        </div>
      </form>
    </Modal>

    <div v-if="reviewStore.items.length === 0 && !showForm" class="state-message">Нет отзывов</div>

    <div v-for="r in reviewStore.items" :key="r.id" class="item-card">
      <div class="item-head">
        <span class="item-author">{{ employeeStore.items.find(e => e.id === r.employeeId)?.name || `#${r.employeeId}` }}</span>
        <span class="item-rating" :style="{ color: ratingColor(r.rating) }">{{ r.rating }}/10</span>
        <span class="item-date">{{ r.createdAt }}</span>
        <BaseButton variant="ghost" size="sm" @click="openEdit(r)">Изменить</BaseButton>
        <BaseButton variant="ghost" size="sm" @click="deleteReview(r.id)">Удалить</BaseButton>
      </div>
      <div class="item-body">{{ r.content }}</div>
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
  .item-date {
    margin-left: 0;
  }
}
</style>
