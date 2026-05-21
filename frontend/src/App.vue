<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import AppSidebar from '@/components/AppSidebar.vue'
import AppHeader from '@/components/AppHeader.vue'

const auth = useAuthStore()
</script>

<template>
  <div v-if="!auth.isAuthenticated" class="auth-layout">
    <router-view />
  </div>
  <div v-else class="app-layout">
    <AppSidebar />
    <div class="app-main">
      <AppHeader />
      <main class="app-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style>
:root {
  --bp-sm: 40rem;
  --bp-md: 48rem;
  --bp-lg: 64rem;
  --sidebar-width: 15rem;
}
</style>

<style scoped>
.auth-layout {
  min-height: 100vh;
  background: var(--color-bg);
}

.app-layout {
  display: flex;
  min-height: 100vh;
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.app-content {
  flex: 1;
  padding: 1.5rem 2rem;
  overflow-y: auto;
  container-type: inline-size;
  container-name: app-content;
}

@media (max-width: 767px) {
  .app-content {
    padding: 1rem;
  }
}
</style>
