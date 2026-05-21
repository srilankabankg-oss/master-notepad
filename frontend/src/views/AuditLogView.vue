<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, errorMessage } from '@/api/client'
import type { AuditLogEntry } from '@/types/api'
import { formatDateTime } from '@/composables/useDateFormatter'

const ENTITY_TYPES: { value: string; label: string }[] = [
  { value: 'subcontractor', label: 'Подрядчик' },
  { value: 'review', label: 'Отзыв' },
  { value: 'comment', label: 'Комментарий' },
  { value: 'checklist', label: 'Чек-лист' },
  { value: 'suggestion', label: 'Предложение' },
  { value: 'meeting', label: 'Протокол' },
  { value: 'survey', label: 'Опрос' },
  { value: 'employee', label: 'Сотрудник' },
  { value: 'event', label: 'Событие' },
]

function entityTypeLabel(type: string): string {
  return ENTITY_TYPES.find((t) => t.value === type)?.label ?? type
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    create: 'Создание',
    update: 'Обновление',
    delete: 'Удаление',
  }
  return labels[action] ?? action
}

function actionBadgeClass(action: string): string {
  const classes: Record<string, string> = {
    create: 'audit-action--create',
    update: 'audit-action--update',
    delete: 'audit-action--delete',
  }
  return classes[action] ?? ''
}

const entries = ref<AuditLogEntry[]>([] as AuditLogEntry[])
const loading = ref(false)
const error = ref('')

const filterEntityType = ref('')
const filterEntityId = ref<number | null>(null)
const expandedRows = ref<Set<number>>(new Set())

function toggleRow(id: number) {
  const next = new Set(expandedRows.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  expandedRows.value = next
}

function changesJson(changes: Record<string, unknown>): string {
  return JSON.stringify(changes, null, 2)
}

async function loadEntries() {
  loading.value = true
  error.value = ''
  try {
    const type = filterEntityType.value || undefined
    const entityId = filterEntityId.value ?? undefined
    entries.value = await api.audit.list(type, entityId)
  } catch (e: unknown) {
    error.value = errorMessage(e, 'Не удалось загрузить журнал изменений')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  expandedRows.value = new Set()
  loadEntries()
}

onMounted(() => {
  loadEntries()
})
</script>

<template>
  <div class="view">
    <div class="view-header">
      <h2 class="view-title">Журнал изменений</h2>
    </div>

    <div class="audit-filters">
      <label class="filter-label">
        Тип сущности:
        <select v-model="filterEntityType" class="input filter-select">
          <option value="">Все</option>
          <option
            v-for="et in ENTITY_TYPES"
            :key="et.value"
            :value="et.value"
          >
            {{ et.label }}
          </option>
        </select>
      </label>
      <label class="filter-label">
        ID сущности:
        <input
          v-model.number="filterEntityId"
          type="number"
          class="input"
          placeholder="Например: 1"
        />
      </label>
      <button class="btn btn-primary btn-sm" @click="applyFilters">
        Применить
      </button>
    </div>

    <div v-if="loading" class="state-message">Загрузка...</div>
    <div v-else-if="error" class="state-message state-error">{{ error }}</div>
    <div v-else-if="entries.length === 0" class="state-message">Нет записей</div>

    <div v-else>
      <table class="audit-table">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Тип сущности</th>
            <th>ID</th>
            <th>Действие</th>
            <th>Сотрудник</th>
            <th>Изменения</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="entry in entries" :key="entry.id">
            <tr>
              <td class="audit-cell-date">
                {{ formatDateTime(entry.createdAt) }}
              </td>
              <td>
                <span class="audit-entity-badge">
                  {{ entityTypeLabel(entry.entityType) }}
                </span>
              </td>
              <td class="audit-cell-id">{{ entry.entityId }}</td>
              <td>
                <span
                  :class="['audit-action-badge', actionBadgeClass(entry.action)]"
                >
                  {{ actionLabel(entry.action) }}
                </span>
              </td>
              <td class="audit-cell-employee">
                {{ entry.employeeName ?? '—' }}
              </td>
              <td class="audit-cell-changes">
                <button
                  class="audit-expand-btn"
                  @click="toggleRow(entry.id)"
                >
                  {{ expandedRows.has(entry.id) ? 'Скрыть' : 'Показать' }}
                </button>
              </td>
            </tr>
            <tr v-if="expandedRows.has(entry.id)" class="audit-expanded-row">
              <td colspan="6">
                <pre class="audit-changes-json">{{ changesJson(entry.changes) }}</pre>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <div class="audit-cards">
        <div
          v-for="entry in entries"
          :key="entry.id"
          class="audit-card"
        >
          <div class="audit-card-row">
            <span class="audit-card-label">Дата</span>
            <span>{{ formatDateTime(entry.createdAt) }}</span>
          </div>
          <div class="audit-card-row">
            <span class="audit-card-label">Тип сущности</span>
            <span class="audit-entity-badge">
              {{ entityTypeLabel(entry.entityType) }}
            </span>
          </div>
          <div class="audit-card-row">
            <span class="audit-card-label">ID</span>
            <span>{{ entry.entityId }}</span>
          </div>
          <div class="audit-card-row">
            <span class="audit-card-label">Действие</span>
            <span
              :class="['audit-action-badge', actionBadgeClass(entry.action)]"
            >
              {{ actionLabel(entry.action) }}
            </span>
          </div>
          <div class="audit-card-row">
            <span class="audit-card-label">Сотрудник</span>
            <span>{{ entry.employeeName ?? '—' }}</span>
          </div>
          <div class="audit-card-row audit-card-row--column">
            <span class="audit-card-label">Изменения</span>
            <pre class="audit-changes-json audit-changes-json--card">{{ changesJson(entry.changes) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view {
  max-width: 64rem;
  container-type: inline-size;
}

.audit-filters {
  display: flex;
  align-items: flex-end;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
  flex-wrap: wrap;
}

.filter-select {
  width: 12rem;
}

.audit-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-bg-card);
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 0.0625rem solid var(--color-border);
}

.audit-table th,
.audit-table td {
  padding: var(--space-3) var(--space-4);
  text-align: left;
  font-size: var(--font-size-sm);
  border-bottom: 0.0625rem solid var(--color-border);
}

.audit-table th {
  background: var(--color-bg-subtle);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.audit-table tbody tr:last-child td {
  border-bottom: none;
}

.audit-cell-date {
  white-space: nowrap;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.audit-cell-id {
  font-variant-numeric: tabular-nums;
}

.audit-cell-employee {
  color: var(--color-text-secondary);
}

.audit-cell-changes {
  text-align: center;
}

.audit-entity-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  background: var(--color-secondary);
  color: var(--color-text-secondary);
}

.audit-action-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.audit-action--create {
  background: var(--color-badge-positive-bg);
  color: var(--color-badge-positive-text);
}

.audit-action--update {
  background: var(--color-badge-info-bg);
  color: var(--color-badge-info-text);
}

.audit-action--delete {
  background: var(--color-badge-violation-bg);
  color: var(--color-badge-violation-text);
}

.audit-expand-btn {
  padding: var(--space-1) var(--space-2);
  border: 0.0625rem solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-card);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.audit-expand-btn:hover {
  background: var(--color-bg);
  color: var(--color-text-secondary);
}

.audit-expanded-row td {
  background: var(--color-bg-subtle);
  padding: 0;
}

.audit-changes-json {
  margin: 0;
  padding: var(--space-4);
  font-size: var(--font-size-xs);
  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
  max-height: 18rem;
  overflow-y: auto;
  background: var(--color-bg-subtle);
}

.audit-changes-json--card {
  max-height: none;
  overflow: visible;
  background: transparent;
  padding: 0;
  margin-top: var(--space-1);
}

.audit-cards {
  display: none;
}

@media (max-width: 767px) {
  .audit-table {
    display: none;
  }

  .audit-cards {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .audit-card {
    background: var(--color-bg-card);
    border: 0.0625rem solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .audit-card-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--font-size-sm);
    gap: var(--space-2);
  }

  .audit-card-row--column {
    flex-direction: column;
    align-items: flex-start;
  }

  .audit-card-label {
    font-weight: var(--font-weight-medium);
    color: var(--color-text-muted);
    flex-shrink: 0;
  }
}

@container (max-width: 40rem) {
  .view-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .filter-select {
    width: 100%;
  }
}
</style>