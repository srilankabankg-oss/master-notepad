<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed, ref } from 'vue'
import BugReportModal from './BugReportModal.vue'

const route = useRoute()
const showHelp = ref(false)
const bugModal = ref<InstanceType<typeof BugReportModal> | null>(null)

const isDev = import.meta.env.DEV

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    subcontractors: 'Подрядчики',
    'subcontractor-detail': 'Карточка подрядчика',
    reviews: 'Отзывы',
    checklists: 'Чек-листы',
    meetings: 'Протоколы встреч',
    surveys: 'Опросы',
    'tender-select': 'Тендерные справки',
    'tender-summary': 'Тендерная справка',
    employees: 'Сотрудники',
    suggestions: 'Предложения',
    events: 'События',
    chat: 'Ассистент',
    'audit-log': 'Журнал изменений',
    tasks: 'Задачи',
  }
  return titles[route.name as string] || ''
})

const pageHelp = computed(() => {
  const helps: Record<string, string> = {
    subcontractors: 'Здесь список всех подрядчиков. Кликните на строку, чтобы открыть карточку с отзывами, событиями и протоколами. Чтобы добавить — кнопка «Добавить подрядчика».',
    'subcontractor-detail': 'Карточка подрядчика: переключайте вкладки для просмотра отзывов, комментариев, протоколов, опросов и событий. Кнопка «Тендерная справка» над списком откроет сводку.',
    reviews: 'Все отзывы сотрудников о подрядчиках. Фильтруйте по подрядчику через выпадающий список. Кнопка «Добавить отзыв» создаёт новый с оценкой от 1 до 10.',
    meetings: 'Протоколы встреч v2 с жизненным циклом (черновик→подготовка→ведение→утверждение→рассылка). Кнопка «Добавить протокол» создаёт новый. Нажмите на строку, чтобы открыть детали и перейти на следующий этап.',
    tasks: 'Задачи с нумерацией TASK-YYYY-NNNNN. Фильтруйте по статусу, протоколу и ответственному. Кнопка «Создать задачу» добавляет новую. Задачу можно перенести в другой протокол.',
    suggestions: 'Предложения по улучшению чек-листов. Любой сотрудник может предложить пункт — администратор утверждает или отклоняет. Укажите ID чек-листа и нажмите «Применить», чтобы увидеть предложения по нему.',
    'audit-log': 'Журнал всех изменений в системе. Фильтруйте по типу сущности и ID — кнопка «Применить».',
    employees: 'Сотрудники организации. Кнопка «Добавить сотрудника» — для регистрации нового.',
    checklists: 'Чек-листы для проверки объектов. Переключайте тип: Организационные (видны всем) / Персональные (только автору). Отмечайте пункты — прогресс обновляется автоматически.',
    events: 'Журнал событий по подрядчикам: положительные, нарушения, информационные. Фильтруйте по подрядчику.',
    surveys: 'Опросы сотрудников о подрядчиках. Кнопка «Создать опрос» — новый опрос. Кнопка «Ответить» — заполнить.',
    'tender-select': 'Выберите подрядчика из списка, чтобы открыть тендерную справку — сводку с рейтингом, отзывами, событиями и протоколами.',
    'tender-summary': 'Тендерная справка: сводка по подрядчику — рейтинг, отзывы, события, протоколы, комментарии. Всё в одном месте для быстрой оценки.',
    chat: 'AI-ассистент: задайте вопрос о подрядчиках, протоколах, задачах или событиях. ИИ ищет ответ в данных системы и показывает источники.',
  }
  return helps[route.name as string] || 'Выберите раздел в боковом меню.'
})
</script>

<template>
  <header class="app-header">
    <h1 class="app-title">{{ pageTitle }}</h1>
    <div class="header-actions">
      <button v-if="isDev" class="bug-btn" title="Сообщить о баге" @click="bugModal?.open()">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16">
          <path d="M8 2a3 3 0 0 0-3 3v1H3l-1 7h12l-1-7h-2V5a3 3 0 0 0-3-3Z" />
          <line x1="5" y1="9" x2="11" y2="9" />
          <line x1="6" y1="11" x2="10" y2="11" />
        </svg>
      </button>
      <button class="help-btn" @click="showHelp = true" title="Справка по разделу">?</button>
    </div>
  </header>

  <Teleport to="body">
    <div v-if="showHelp" class="modal-overlay" @click.self="showHelp = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ pageTitle }}</h2>
          <button class="modal-close" @click="showHelp = false">✕</button>
        </div>
        <p>{{ pageHelp }}</p>
        <button class="btn btn-primary" @click="showHelp = false">Понятно</button>
      </div>
    </div>
  </Teleport>

  <BugReportModal ref="bugModal" />
</template>

<style scoped>
.app-header {
  height: 3.75rem;
  padding: 0 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 0.0625rem solid var(--color-border);
  background: var(--color-bg-card);
}

.app-title { font-size: 1.25rem; font-weight: 600; color: var(--color-text); margin: 0; }

.header-actions { display: flex; align-items: center; gap: 0.5rem; }

.help-btn {
  width: 28px; height: 28px; border-radius: 50%; border: 2px solid #1a56db; background: #fff;
  color: #1a56db; font-weight: 700; font-size: 0.9rem; cursor: pointer; display: flex;
  align-items: center; justify-content: center; transition: all 0.15s;
}
.help-btn:hover { background: #1a56db; color: #fff; }

.bug-btn {
  width: 28px; height: 28px; border-radius: 50%; border: 2px solid #f59e0b; background: #fff;
  color: #f59e0b; cursor: pointer; display: flex;
  align-items: center; justify-content: center; transition: all 0.15s;
}
.bug-btn:hover { background: #f59e0b; color: #fff; }

.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.modal-content {
  background: #fff; border-radius: 12px; padding: 2rem; max-width: 440px; width: 90%; box-shadow: 0 4px 24px rgba(0,0,0,0.15);
}
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.modal-header h2 { margin: 0; font-size: 1.15rem; }
.modal-close { border: none; background: none; font-size: 1.2rem; cursor: pointer; color: #6b7280; }
.modal-content p { color: #374151; line-height: 1.6; margin-bottom: 1.5rem; }
.btn { padding: 0.5rem 1.5rem; border-radius: 6px; border: none; cursor: pointer; font-size: 0.9rem; }
.btn-primary { background: #1a56db; color: #fff; }

@media (max-width: 767px) { .app-header { padding-left: 3.75rem; } }
</style>