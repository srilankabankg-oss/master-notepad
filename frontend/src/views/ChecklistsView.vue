<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useChecklistStore } from '@/stores/checklists'
import { useEmployeeStore } from '@/stores/employees'
import { api, errorMessage } from '@/api/client'
import type { Checklist, ChecklistCreate, ChecklistType } from '@/types/api'

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

async function deleteChecklist(id: number) {
  if (!confirm('Удалить чек-лист?')) return
  try {
    await checklistStore.remove(id)
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

function getEmployeeName(id: number | null): string {
  if (!id) return '-'
  return employeeStore.items.find((e) => e.id === id)?.name || (id != null ? `#${id}` : '—')
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
              <template v-if="cl.owner_id"> — {{ getEmployeeName(cl.owner_id) }}</template>
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
          <button class="btn btn-sm btn-ghost btn-danger" @click="deleteChecklist(cl.id)">Удалить</button>
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
            <button type="button" class="btn btn-sm btn-ghost" @click="addFormItem" style="margin-top: 4px">+ Добавить пункт</button>
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
.view { max-width: 900px; container-type: inline-size; }

.view-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 20px;
}

.view-title { font-size: 18px; font-weight: 600; color: #111827; }

.filter-bar {
  display: flex; gap: 20px; margin-bottom: 18px;
}

.filter-label {
  display: flex; align-items: center; gap: 8px;
  font-size: 14px; font-weight: 500; color: #374151;
}

.filter-select { width: 220px; }

.checklist-list { display: flex; flex-direction: column; gap: 16px; }

.checklist-card {
  background: #ffffff; border: 1px solid #e5e7eb;
  border-radius: 8px; padding: 20px;
}

.checklist-head {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 14px;
}

.checklist-title { font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 2px; }
.checklist-meta { font-size: 12px; color: #9ca3af; }
.checklist-progress { font-size: 14px; font-weight: 600; color: #1a56db; white-space: nowrap; }

.checklist-items { list-style: none; display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }

.checklist-label {
  display: flex; align-items: center; gap: 10px;
  font-size: 14px; color: #374151; cursor: pointer;
}

.checklist-label input[type="checkbox"] {
  width: 16px; height: 16px; accent-color: #1a56db; cursor: pointer; flex-shrink: 0;
}

.checklist-item.completed .checklist-label span {
  text-decoration: line-through; color: #9ca3af;
}

.checklist-actions { display: flex; gap: 4px; }

.form-item-row { display: flex; gap: 8px; align-items: center; }
.form-item-row .input { flex: 1; }

.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}

.modal {
  background: #ffffff; border-radius: 12px;
  padding: 28px; width: 540px; max-width: 90vw;
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
    gap: 10px;
  }

  .filter-select {
    width: 100%;
  }

  .checklist-head {
    flex-direction: column;
    gap: 8px;
  }

  .checklist-card {
    padding: 16px;
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
