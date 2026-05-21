<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const sidebarOpen = ref(false)

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function closeSidebar() {
  sidebarOpen.value = false
}

watch(() => route.path, () => {
  sidebarOpen.value = false
})

const navItems = [
  { to: '/subcontractors', label: 'Подрядчики', name: 'subcontractors' },
  { to: '/reviews', label: 'Отзывы', name: 'reviews' },
  { to: '/checklists', label: 'Чек-листы', name: 'checklists' },
  { to: '/meetings', label: 'Протоколы', name: 'meetings' },
  { to: '/surveys', label: 'Опросы', name: 'surveys' },
  { to: '/employees', label: 'Сотрудники', name: 'employees' },
  { to: '/suggestions', label: 'Предложения', name: 'suggestions' },
  { to: '/events', label: 'События', name: 'events' },
  { to: '/chat', label: 'Ассистент', name: 'chat' },
  { to: '/audit-log', label: 'Журнал изменений', name: 'audit-log' },
  { to: '/tender/1', label: 'Тендерная справка', name: 'tender-summary' },
]

function isActive(name: string) {
  return route.name === name || (name === 'subcontractors' && route.name === 'subcontractor-detail') || (name === 'tender-summary' && route.name === 'tender-summary')
}
</script>

<template>
  <div v-if="sidebarOpen" class="sidebar-backdrop" @click="closeSidebar" />
  <button class="hamburger" @click="toggleSidebar" aria-label="Открыть меню">
    <span class="hamburger-line" />
    <span class="hamburger-line" />
    <span class="hamburger-line" />
  </button>
  <aside :class="['sidebar', { 'sidebar--open': sidebarOpen }]">
    <div class="sidebar-brand">
      <svg class="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
        <circle cx="15" cy="15" r="2" />
      </svg>
      <span class="brand-text">Master Notepad</span>
    </div>
    <nav class="nav-list">
      <router-link
        v-for="item in navItems"
        :key="item.name"
        :to="item.to"
        :class="['nav-item', { active: isActive(item.name) }]"
        @click="closeSidebar"
      >
        {{ item.label }}
      </router-link>
    </nav>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 15rem;
  min-height: 100vh;
  background: var(--color-sidebar);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.25rem 1.25rem 1.5rem;
  border-bottom: 0.0625rem solid var(--color-sidebar-hover);
}

.brand-icon {
  width: 1.75rem;
  height: 1.75rem;
  color: var(--color-brand);
  flex-shrink: 0;
}

.brand-text {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-sidebar-text-active);
  white-space: nowrap;
}

.nav-list {
  display: flex;
  flex-direction: column;
  padding: 0.75rem 0.5rem;
  gap: 0.125rem;
}

.nav-item {
  display: block;
  padding: 0.625rem 1rem;
  border-radius: 0.5rem;
  color: var(--color-sidebar-text);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background 0.15s, color 0.15s;
}

.nav-item:hover {
  background: var(--color-sidebar-hover);
  color: var(--color-sidebar-text-active);
}

.nav-item.active {
  background: var(--color-primary);
  color: var(--color-bg-card);
}

.hamburger {
  display: none;
  position: fixed;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 50;
  flex-direction: column;
  gap: 0.3125rem;
  padding: 0.5rem;
  border: none;
  border-radius: 0.375rem;
  background: var(--color-sidebar);
  cursor: pointer;
}

.hamburger-line {
  display: block;
  width: 1.25rem;
  height: 0.125rem;
  background: var(--color-sidebar-text);
  border-radius: 0.0625rem;
  transition: background 0.15s;
}

.hamburger:hover .hamburger-line {
  background: var(--color-sidebar-text-active);
}

.sidebar-backdrop {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 150;
}

@media (max-width: 767px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    z-index: 200;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }

  .sidebar--open {
    transform: translateX(0);
    box-shadow: 0.25rem 0 1.25rem rgba(0, 0, 0, 0.3);
  }

  .hamburger {
    display: flex;
  }

  .sidebar-backdrop {
    display: block;
  }
}
</style>
