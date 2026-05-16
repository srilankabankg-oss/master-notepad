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
  height: 60px;
  padding: 0 32px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}

.app-title {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}
</style>
