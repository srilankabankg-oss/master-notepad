<script setup lang="ts">
import { ref } from 'vue'
import type { Comment, CommentCreate } from '@/types/api'
import { useCommentStore } from '@/stores/comments'
import { useEmployeeStore } from '@/stores/employees'
import { errorMessage } from '@/api/client'
import { useDeleteConfirm } from '@/composables/useDeleteConfirm'
import { useEntityForm } from '@/composables/useEntityForm'
import Modal from '@/components/Modal.vue'
import BaseButton from '@/components/BaseButton.vue'

const props = defineProps<{ subId: number }>()
const emit = defineEmits<{ refresh: [] }>()

const commentStore = useCommentStore()
const employeeStore = useEmployeeStore()

const { deleteItem } = useDeleteConfirm((id: number) => commentStore.remove(id), 'комментарий')

const {
  showForm, editingId, formData, formError, formLoading,
  openCreate, openEdit, closeForm, submitForm,
} = useEntityForm<Comment, CommentCreate>({
  entityName: 'Комментарий',
  defaultCreateValues: { subcontractorId: props.subId, employeeId: 0, content: '' },
  toCreateData: (c) => ({ subcontractorId: c.subcontractorId, employeeId: c.employeeId, content: c.content }),
  onSubmit: async ({ isEdit, id, values }) => {
    if (isEdit && id != null) await commentStore.update(id, values)
    else await commentStore.create(values)
    emit('refresh')
  },
  validate: () => {
    if (!formData.value.content.trim()) { formError.value = 'Текст комментария обязателен'; return false }
    if (!formData.value.employeeId) { formError.value = 'Выберите сотрудника'; return false }
    return true
  },
})

async function deleteComment(id: number) {
  if (!confirm('Удалить комментарий?')) return
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
    <BaseButton variant="primary" size="sm" @click="openCreate">Добавить комментарий</BaseButton>

    <Modal v-model="showForm" :title="editingId ? 'Изменить комментарий' : 'Новый комментарий'">
      <form @submit.prevent="submitForm" class="form">
        <label class="field">
          <span class="field-label">Сотрудник</span>
          <select v-model="formData.employeeId" class="input">
            <option :value="0" disabled>Выберите сотрудника</option>
            <option v-for="emp in employeeStore.items" :key="emp.id" :value="emp.id">{{ emp.name }}</option>
          </select>
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

    <div v-if="commentStore.items.length === 0 && !showForm" class="state-message">Нет комментариев</div>

    <div v-for="c in commentStore.items" :key="c.id" class="item-card">
      <div class="item-head">
        <span class="item-author">{{ employeeStore.items.find(e => e.id === c.employeeId)?.name || `#${c.employeeId}` }}</span>
        <span class="item-date">{{ c.createdAt }}</span>
        <BaseButton variant="ghost" size="sm" @click="openEdit(c)">Изменить</BaseButton>
        <BaseButton variant="ghost" size="sm" @click="deleteComment(c.id)">Удалить</BaseButton>
      </div>
      <div class="item-body">{{ c.content }}</div>
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
