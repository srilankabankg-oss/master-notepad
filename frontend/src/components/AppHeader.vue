<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()

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
    }
    return titles[route.name as string] || ''
  })
</script>

<template>
  <header class="app-header">
    <h1 class="app-title">{{ pageTitle }}</h1>
  </header>
</template>

<style scoped>
.app-header {
  height: 3.75rem;
  padding: 0 2rem;
  display: flex;
  align-items: center;
  border-bottom: 0.0625rem solid var(--color-border);
  background: var(--color-bg-card);
}

@media (max-width: 767px) {
  .app-header {
    padding-left: 3.75rem;
  }
}

.app-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}
</style>
