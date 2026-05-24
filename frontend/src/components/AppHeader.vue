<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed, ref } from 'vue'

const route = useRoute()
const showHelp = ref(false)

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    subcontractors: 'Подрядчики',
    'subcontractor-detail': 'Карточка подрядчика',
    reviews: 'Отзывы',
    checklists: 'Чек-листы',
    meetings: 'Протоколы встреч',
    surveys: 'Опросы',
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
    subcontractors: 'Здесь список всех подрядчиков. Нажмите на строку чтобы открыть карточку с отзывами, событиями и протоколами.',
    'subcontractor-detail': 'Карточка подрядчика: вкладки с отзывами, комментариями, протоколами, опросами и событиями.',
    meetings: 'Протоколы встреч v2: 7 этапов жизненного цикла (черновик→подготовка→ведение→утверждение→рассылка). Для перехода между этапами откройте протокол.',
    tasks: 'Задачи с уникальной нумерацией TASK-YYYY-NNNNN. Задачу можно перенести в другой протокол. Подзадачи наследуют протокол родителя.',
    suggestions: 'Предложения по улучшению чек-листов. Любой сотрудник может предложить пункт. Администратор утверждает или отклоняет.',
    'audit-log': 'Журнал всех изменений в системе: кто, когда и что изменил. Фильтруйте по типу сущности.',
    employees: 'Сотрудники организации. Фильтр по должности и поиск по имени.',
    checklists: 'Чек-листы для проверки объектов. Организационные — для всех, личные — только для автора.',
    events: 'Журнал событий по подрядчикам: положительные, нарушения, информационные.',
    surveys: 'Опросы сотрудников о подрядчиках. Стандартный шаблон из 5 вопросов.',
    'tender-summary': 'Тендерная справка: сводка по подрядчику — рейтинг, отзывы, события, протоколы.',
    chat: 'AI-ассистент: задайте вопрос о подрядчиках, протоколах, задачах. ИИ ищет ответ в данных системы.',
    reviews: 'Все отзывы сотрудников о подрядчиках. Оценка от 1 до 10.',
  }
  return helps[route.name as string] || 'Выберите раздел в боковом меню.'
})
</script>

<template>
  <header class="app-header">
    <h1 class="app-title">{{ pageTitle }}</h1>
    <button class="help-btn" @click="showHelp = true" title="Справка по разделу">?</button>
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

.help-btn {
  width: 28px; height: 28px; border-radius: 50%; border: 2px solid #1a56db; background: #fff;
  color: #1a56db; font-weight: 700; font-size: 0.9rem; cursor: pointer; display: flex;
  align-items: center; justify-content: center; transition: all 0.15s;
}
.help-btn:hover { background: #1a56db; color: #fff; }

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