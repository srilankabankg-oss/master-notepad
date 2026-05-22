<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMeetingStore } from '@/stores/meetings'
import { useTaskStore } from '@/stores/tasks'
import { useEmployeeStore } from '@/stores/employees'
import type { Meeting, MeetingStage, MeetingType, MeetingPeriodicity, GroupingMethod } from '@/types/api'
import { formatDateTime } from '@/composables/useDateFormatter'
import TabGroup from '@/components/TabGroup.vue'
import BaseButton from '@/components/BaseButton.vue'

const route = useRoute()
const router = useRouter()
const meetingStore = useMeetingStore()
const taskStore = useTaskStore()
const employeeStore = useEmployeeStore()

const meetingId = Number(route.params.id)
const meeting = ref<Meeting | null>(null)
const loading = ref(true)
const error = ref('')
const activeTab = ref<'tasks' | 'attendance' | 'approvals' | 'distribution'>('tasks')

const ALL_STAGES: { key: MeetingStage; label: string }[] = [
  { key: 'draft', label: 'Черновик' },
  { key: 'preparation_clerk', label: 'Подготовка (делопроизводитель)' },
  { key: 'preparation_controller', label: 'Подготовка (контролирующие)' },
  { key: 'conducting', label: 'Ведение протокола' },
  { key: 'approval', label: 'Утверждение' },
  { key: 'distribution', label: 'Рассылка' },
  { key: 'completed', label: 'Завершено' },
]

const VALID_TRANSITIONS: Record<MeetingStage, MeetingStage[]> = {
  draft: ['preparation_clerk'],
  preparation_clerk: ['preparation_controller'],
  preparation_controller: ['conducting'],
  conducting: ['approval'],
  approval: ['distribution'],
  distribution: ['completed'],
  completed: [],
}

const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  strategic: 'Стратегическое',
  coordination: 'Координационное',
  operational: 'Оперативное',
  problem: 'Проблемное',
}

const PERIODICITY_LABELS: Record<MeetingPeriodicity, string> = {
  one_time: 'Разовое',
  recurring: 'Периодическое',
}

const GROUPING_LABELS: Record<GroupingMethod, string> = {
  by_topic: 'По темам',
  by_subcontractor: 'По подрядчикам',
}

const currentStageIndex = computed(() => ALL_STAGES.findIndex((s) => s.key === meeting.value?.stage))
const nextStage = computed<MeetingStage | null>(() => {
  if (!meeting.value) return null
  const transitions = VALID_TRANSITIONS[meeting.value.stage]
  return transitions.length > 0 ? transitions[0] : null
})

const stageDataEntries = computed(() => {
  if (!meeting.value?.stageData) return []
  return Object.entries(meeting.value.stageData)
})

async function loadAll() {
  try {
    const [fetched] = await Promise.all([
      meetingStore.fetchById(meetingId),
      taskStore.fetchAll({ protocolId: meetingId }),
      employeeStore.fetchAll(),
    ])
    meeting.value = (fetched as Meeting) || null
  } catch (e: unknown) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

async function goToNextStage() {
  if (!meeting.value || !nextStage.value) return
  try {
    const updated = await meetingStore.transition(meeting.value.id, { stage: nextStage.value })
    meeting.value = updated as Meeting
  } catch (e: unknown) {
    alert(String(e))
  }
}

function stageClass(stage: MeetingStage): string {
  if (!meeting.value) return ''
  const idx = ALL_STAGES.findIndex((s) => s.key === stage)
  const curIdx = currentStageIndex.value
  if (idx < curIdx) return 'stage-done'
  if (idx === curIdx) return 'stage-current'
  return 'stage-future'
}

const tabs = [
  { key: 'tasks', label: 'Задачи' },
  { key: 'attendance', label: 'Присутствие' },
  { key: 'approvals', label: 'Утверждение' },
  { key: 'distribution', label: 'Рассылка' },
]

onMounted(loadAll)
</script>

<template>
  <div class="view">
    <button class="btn btn-back" @click="router.push('/meetings')">← Назад к протоколам</button>

    <div v-if="loading" class="state-message">Загрузка...</div>
    <div v-else-if="error" class="state-message state-error">{{ error }}</div>

    <template v-else-if="meeting">
      <div class="meeting-header">
        <div>
          <h2 class="meeting-title">{{ meeting.title }}</h2>
          <div class="meeting-meta">
            <span class="meta-item">{{ formatDateTime(meeting.date) }}</span>
            <span class="meta-sep">·</span>
            <span class="meta-item">{{ MEETING_TYPE_LABELS[meeting.meetingType] }}</span>
            <span class="meta-sep">·</span>
            <span class="meta-item">{{ PERIODICITY_LABELS[meeting.periodicity] }}</span>
            <span class="meta-sep">·</span>
            <span class="meta-item">{{ GROUPING_LABELS[meeting.groupingMethod] }}</span>
          </div>
        </div>
        <BaseButton v-if="nextStage" variant="primary" @click="goToNextStage">
          → {{ ALL_STAGES.find((s) => s.key === nextStage)?.label }}
        </BaseButton>
      </div>

      <div class="stepper">
        <div
          v-for="(stage, idx) in ALL_STAGES"
          :key="stage.key"
          :class="['stepper-step', stageClass(stage.key)]"
        >
          <div class="stepper-dot" />
          <span class="stepper-label">{{ stage.label }}</span>
          <div v-if="idx < ALL_STAGES.length - 1" class="stepper-line" :class="stageClass(stage.key)" />
        </div>
      </div>

      <div v-if="Object.keys(meeting.stageData).length > 0" class="stage-data-card">
        <h3 class="section-title">Данные этапа</h3>
        <pre class="stage-data-json">{{ JSON.stringify(meeting.stageData, null, 2) }}</pre>
      </div>

      <TabGroup v-model="activeTab" :tabs="tabs" />

      <div v-if="activeTab === 'tasks'" class="tab-content">
        <div v-if="taskStore.items.length === 0" class="state-message">Нет задач</div>
        <div v-else class="task-list">
          <div v-for="t in taskStore.items" :key="t.id" class="item-card">
            <div class="item-head">
              <span class="item-author">{{ t.title }}</span>
              <span :class="['status-badge', `status-${t.status}`]">{{ t.status }}</span>
            </div>
            <div class="item-body" v-if="t.description">{{ t.description }}</div>
          </div>
        </div>
      </div>

      <div v-else-if="activeTab === 'attendance'" class="tab-content">
        <div class="state-message">Учёт присутствия</div>
      </div>

      <div v-else-if="activeTab === 'approvals'" class="tab-content">
        <div class="state-message">Утверждение протокола</div>
      </div>

      <div v-else-if="activeTab === 'distribution'" class="tab-content">
        <div class="state-message">Рассылка протокола</div>
      </div>
    </template>

    <div v-else class="state-message">Протокол не найден</div>
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

.meeting-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  gap: 1rem;
}

.meeting-title {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 0.375rem;
}

.meeting-meta {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  flex-wrap: wrap;
}

.meta-sep { color: var(--color-border-input); }
.meta-item { white-space: nowrap; }

.stepper {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 2rem;
  padding: 0 0.5rem;
  position: relative;
}

.stepper-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  flex: 1;
  position: relative;
}

.stepper-dot {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  border: 0.1875rem solid var(--color-border);
  background: var(--color-bg-card);
  flex-shrink: 0;
  z-index: 1;
  transition: all 0.2s;
}

.stepper-label {
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--color-text-muted);
  text-align: center;
  line-height: 1.3;
  max-width: 5rem;
}

.stepper-line {
  position: absolute;
  top: 0.625rem;
  left: calc(50% + 0.75rem);
  right: calc(-50% + 0.75rem);
  height: 0.125rem;
  background: var(--color-border);
  z-index: 0;
}

.stage-done .stepper-dot {
  background: var(--color-success);
  border-color: var(--color-success);
}

.stage-done .stepper-label {
  color: var(--color-text-secondary);
  font-weight: 600;
}

.stage-done .stepper-line {
  background: var(--color-success);
}

.stage-current .stepper-dot {
  background: var(--color-primary);
  border-color: var(--color-primary);
  box-shadow: 0 0 0 0.25rem rgba(26, 86, 219, 0.2);
}

.stage-current .stepper-label {
  color: var(--color-primary);
  font-weight: 700;
}

.stage-future .stepper-dot {
  background: var(--color-bg-card);
  border-color: var(--color-border);
}

.stage-future .stepper-label {
  color: var(--color-text-muted);
}

.stage-data-card {
  background: var(--color-bg-card);
  border: 0.0625rem solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 1rem 1.25rem;
  margin-bottom: 1.25rem;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin: 0 0 0.75rem;
}

.stage-data-json {
  margin: 0;
  font-size: 0.8125rem;
  font-family: 'SF Mono', 'Fira Code', Menlo, Consolas, monospace;
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
  background: var(--color-bg-subtle);
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  max-height: 18rem;
  overflow-y: auto;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.task-list { display: flex; flex-direction: column; gap: 0.625rem; }

.item-card {
  background: var(--color-bg-card);
  border: 0.0625rem solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.875rem 1rem;
}

.item-head {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin-bottom: 0.25rem;
}

.item-author {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--color-text);
}

.item-body {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.status-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 0.75rem;
  font-size: 0.6875rem;
  font-weight: 600;
  white-space: nowrap;
}

.status-submitted  { background: var(--color-badge-info-bg); color: var(--color-badge-info-text); }
.status-reviewing  { background: var(--color-badge-warning-bg); color: var(--color-warning-hover); }
.status-accepted   { background: var(--color-badge-positive-bg); color: var(--color-success); }
.status-rejected   { background: var(--color-badge-rejected-bg); color: var(--color-danger); }

.state-message { padding: 2.5rem 0; text-align: center; color: var(--color-text-muted); font-size: 0.9375rem; }
.state-error { color: var(--color-danger); }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary { background: var(--color-primary); color: var(--color-bg-card); }
.btn-primary:hover { background: var(--color-primary-hover); }

@container (max-width: 40rem) {
  .meeting-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .meeting-title {
    font-size: 1.125rem;
  }

  .stepper {
    gap: 0;
    overflow-x: auto;
    padding-bottom: 0.5rem;
  }

  .stepper-label {
    font-size: 0.625rem;
    max-width: 3.5rem;
  }

  .stepper-line {
    left: calc(50% + 0.5rem);
    right: calc(-50% + 0.5rem);
  }
}
</style>
