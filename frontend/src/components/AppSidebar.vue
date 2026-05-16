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
]

function isActive(name: string) {
  return route.name === name || (name === 'subcontractors' && route.name === 'subcontractor-detail')
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
  width: var(--sidebar-width, 240px);
  min-height: 100vh;
  background: #1e293b;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 20px 24px;
  border-bottom: 1px solid #334155;
}

.brand-icon {
  width: 28px;
  height: 28px;
  color: #60a5fa;
  flex-shrink: 0;
}

.brand-text {
  font-size: 16px;
  font-weight: 600;
  color: #f1f5f9;
  white-space: nowrap;
}

.nav-list {
  display: flex;
  flex-direction: column;
  padding: 12px 8px;
  gap: 2px;
}

.nav-item {
  display: block;
  padding: 10px 16px;
  border-radius: 8px;
  color: #cbd5e1;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.15s, color 0.15s;
}

.nav-item:hover {
  background: #334155;
  color: #f1f5f9;
}

.nav-item.active {
  background: #1a56db;
  color: #ffffff;
}

.hamburger {
  display: none;
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 50;
  flex-direction: column;
  gap: 5px;
  padding: 8px;
  border: none;
  border-radius: 6px;
  background: #1e293b;
  cursor: pointer;
}

.hamburger-line {
  display: block;
  width: 20px;
  height: 2px;
  background: #cbd5e1;
  border-radius: 1px;
  transition: background 0.15s;
}

.hamburger:hover .hamburger-line {
  background: #f1f5f9;
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
    box-shadow: 4px 0 20px rgba(0, 0, 0, 0.3);
  }

  .hamburger {
    display: flex;
  }

  .sidebar-backdrop {
    display: block;
  }
}
</style>
