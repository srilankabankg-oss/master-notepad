<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useChecklistStore } from '@/stores/checklists'
import { useEmployeeStore } from '@/stores/employees'
import { api, errorMessage } from '@/api/client'
import type { Checklist, ChecklistCreate, ChecklistType } from '@/types/api'
import { useEmployeeName } from '@/composables/useEntityName'
import { useDeleteConfirm } from '@/composables/useDeleteConfirm'

const checklistStore = useChecklistStore()
const employeeStore = useEmployeeStore()

const activeType = ref<ChecklistType>('organization')
const ownerId = ref<number | undefined>(undefined)

const showForm = ref(false)
const editingChecklist = ref<Checklist | null>(null)
const formTitle = ref('')
const formItems = ref<{ text: string; completed: boolean }[]>([])
const formError = ref('')
const formLoading = ref(false)

const suggestModal = ref(false)
const suggestChecklistId = ref(0)
const suggestText = ref('')
const suggestError = ref('')
const suggestLoading = ref(false)

const getEmployeeName = useEmployeeName(employeeStore.items)

const { deleteItem } = useDeleteConfirm((id: number) => checklistStore.remove(id), 'чек-лист')

async function loadData() {
  await checklistStore.fetchAll(activeType.value, ownerId.value)
}

function openCreate() {
  editingChecklist.value = null
  formTitle.value = ''
  formItems.value = [{ text: '', completed: false }]
  formError.value = ''
  showForm.value = true
}

function openEdit(cl: Checklist) {
  editingChecklist.value = cl
  formTitle.value = cl.title
  formItems.value = cl.items.length ? [...cl.items.map((i) => ({ ...i }))] : [{ text: '', completed: false }]
  formError.value = ''
  showForm.value = true
}

function closeForm() { showForm.value = false }

function addFormItem() {
  formItems.value.push({ text: '', completed: false })
}

function removeFormItem(idx: number) {
  formItems.value.splice(idx, 1)
}

async function submitForm() {
  if (!formTitle.value.trim()) { formError.value = 'Название обязательно'; return }
  const validItems = formItems.value.filter((i) => i.text.trim())
  formLoading.value = true
  formError.value = ''
  try {
    const data: ChecklistCreate = { title: formTitle.value.trim(), type: activeType.value, ownerId: ownerId.value || null, items: validItems }
    if (editingChecklist.value) {
      await checklistStore.update(editingChecklist.value.id, { title: data.title, items: validItems })
    } else {
      await checklistStore.create(data)
    }
    showForm.value = false
    await loadData()
  } catch (e: unknown) {
    formError.value = errorMessage(e, 'Ошибка')
  } finally {
    formLoading.value = false
  }
}

async function toggleItem(checklistId: number, items: { text: string; completed: boolean }[], idx: number) {
  const newItems = items.map((it, i) => (i === idx ? { ...it, completed: !it.completed } : it))
  try {
    await checklistStore.update(checklistId, { items: newItems })
    await loadData()
  } catch (e: unknown) {
    alert(errorMessage(e, 'Ошибка'))
  }
}

function openSuggest(checklistId: number) {
  suggestChecklistId.value = checklistId
  suggestText.value = ''
  suggestError.value = ''
  suggestModal.value = true
}

async function submitSuggestion() {
  if (!suggestText.value.trim()) { suggestError.value = 'Текст предложения обязателен'; return }
  suggestLoading.value = true
  suggestError.value = ''
  try {
    await api.suggestions.create({
      checklistId: suggestChecklistId.value,
      employeeId: employeeStore.items[0]?.id || 1,
      suggestion: suggestText.value.trim(),
    })
    suggestModal.value = false
  } catch (e: unknown) {
    suggestError.value = errorMessage(e, 'Ошибка')
  } finally {
    suggestLoading.value = false
  }
}

function completedCount(items: { text: string; completed: boolean }[]): number {
  return items.filter((i) => i.completed).length
}

watch(activeType, () => loadData())
watch(ownerId, () => loadData())

onMounted(async () => {
  await Promise.all([employeeStore.fetchAll(), loadData()])
})
</script>

<template>
  <div class="view">
    <div class="view-header">
      <h2 class="view-title">Чек-листы</h2>
      <button class="btn btn-primary" @click="openCreate">Создать чек-лист</button>
    </div>

    <div class="filter-bar">
      <label class="filter-label">
        Тип:
        <select v-model="activeType" class="input filter-select">
          <option value="organization">Организационные</option>
          <option value="personal">Персональные</option>
        </select>
      </label>
      <label v-if="activeType === 'personal'" class="filter-label">
        Сотрудник:
        <select v-model="ownerId" class="input filter-select">
          <option :value="undefined">Все</option>
          <option v-for="e in employeeStore.items" :key="e.id" :value="e.id">{{ e.name }}</option>
        </select>
      </label>
    </div>

    <div v-if="checklistStore.loading" class="state-message">Загрузка...</div>
    <div v-else-if="checklistStore.error" class="state-message state-error">{{ checklistStore.error }}</div>
    <div v-else-if="checklistStore.items.length === 0" class="state-message">Нет чек-листов</div>

    <div v-else class="checklist-list">
      <div v-for="cl in checklistStore.items" :key="cl.id" class="checklist-card">
        <div class="checklist-head">
          <div>
            <h3 class="checklist-title">{{ cl.title }}</h3>
            <span class="checklist-meta">
              {{ cl.type === 'organization' ? 'Организационный' : 'Персональный' }}
              <template v-if="cl.ownerId"> — {{ getEmployeeName(cl.ownerId) }}</template>
            </span>
          </div>
          <div class="checklist-progress">{{ completedCount(cl.items) }}/{{ cl.items.length }}</div>
        </div>
        <ul class="checklist-items">
          <li v-for="(item, idx) in cl.items" :key="idx" :class="['checklist-item', { completed: item.completed }]">
            <label class="checklist-label">
              <input type="checkbox" :checked="item.completed" @change="toggleItem(cl.id, cl.items, idx)" />
              <span>{{ item.text }}</span>
            </label>
          </li>
        </ul>
        <div class="checklist-actions">
          <button class="btn btn-sm btn-ghost" @click="openEdit(cl)">Изменить</button>
          <button class="btn btn-sm btn-ghost" @click="openSuggest(cl.id)">Предложить улучшение</button>
          <button class="btn btn-sm btn-ghost btn-danger" @click="deleteItem(cl.id)">Удалить</button>
        </div>
      </div>
    </div>

    <div v-if="showForm" class="modal-overlay" @click.self="closeForm">
      <div class="modal">
        <h3 class="modal-title">{{ editingChecklist ? 'Изменить чек-лист' : 'Новый чек-лист' }}</h3>
        <div class="form">
          <label class="field">
            <span class="field-label">Название *</span>
            <input v-model="formTitle" class="input" />
          </label>
          <div class="field">
            <span class="field-label">Пункты</span>
            <div v-for="(item, idx) in formItems" :key="idx" class="form-item-row">
              <input v-model="item.text" class="input" :placeholder="`Пункт ${idx + 1}`" />
              <button type="button" class="btn btn-sm btn-ghost btn-danger" @click="removeFormItem(idx)" :disabled="formItems.length <= 1">×</button>
            </div>
            <button type="button" class="btn btn-sm btn-ghost btn-add-item" @click="addFormItem">+ Добавить пункт</button>
          </div>
          <div v-if="formError" class="form-error">{{ formError }}</div>
          <div class="form-actions">
            <button class="btn btn-secondary" @click="closeForm">Отмена</button>
            <button class="btn btn-primary" :disabled="formLoading" @click="submitForm">Сохранить</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="suggestModal" class="modal-overlay" @click.self="suggestModal = false">
      <div class="modal">
        <h3 class="modal-title">Предложить улучшение</h3>
        <div class="form">
          <label class="field">
            <span class="field-label">Предложение *</span>
            <textarea v-model="suggestText" class="input textarea" rows="4" placeholder="Опишите ваше предложение..." />
          </label>
          <div v-if="suggestError" class="form-error">{{ suggestError }}</div>
          <div class="form-actions">
            <button class="btn btn-secondary" @click="suggestModal = false">Отмена</button>
            <button class="btn btn-primary" :disabled="suggestLoading" @click="submitSuggestion">Отправить</button>
          </div>
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

.view-title { font-size: 1.125rem; font-weight: 600; color: var(--color-text); }

.filter-bar {
  display: flex; gap: 1.25rem; margin-bottom: 1.125rem;
}

.filter-label {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.875rem; font-weight: 500; color: var(--color-text-secondary);
}

.filter-select { width: 13.75rem; }

.checklist-list { display: flex; flex-direction: column; gap: 1rem; }

.checklist-card {
  background: var(--color-bg-card); border: 0.0625rem solid var(--color-border);
  border-radius: 0.5rem; padding: 1.25rem;
}

.checklist-head {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 0.875rem;
}

.checklist-title { font-size: 1rem; font-weight: 600; color: var(--color-text); margin: 0 0 0.125rem; }
.checklist-meta { font-size: 0.75rem; color: var(--color-text-meta); }
.checklist-progress { font-size: 0.875rem; font-weight: 600; color: var(--color-primary); white-space: nowrap; }

.checklist-items { list-style: none; display: flex; flex-direction: column; gap: 0.375rem; margin-bottom: 0.75rem; }

.checklist-label {
  display: flex; align-items: center; gap: 0.625rem;
  font-size: 0.875rem; color: var(--color-text-secondary); cursor: pointer;
}

.checklist-label input[type="checkbox"] {
  width: 1rem; height: 1rem; accent-color: var(--color-primary); cursor: pointer; flex-shrink: 0;
}

.checklist-item.completed .checklist-label span {
  text-decoration: line-through; color: var(--color-text-meta);
}

.checklist-actions { display: flex; gap: 0.25rem; }

.form-item-row { display: flex; gap: 0.5rem; align-items: center; }
.form-item-row .input { flex: 1; }

.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}

.modal {
  background: var(--color-bg-card); border-radius: 0.75rem;
  padding: 1.75rem; width: 33.75rem; max-width: 90vw;
  box-shadow: 0 1.25rem 3.75rem rgba(0, 0, 0, 0.15);
}

.modal-title { font-size: 1.125rem; font-weight: 600; margin-bottom: 1.25rem; color: var(--color-text); }

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
    gap: 0.625rem;
  }

  .filter-select {
    width: 100%;
  }

  .checklist-head {
    flex-direction: column;
    gap: 0.5rem;
  }

  .checklist-card {
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
