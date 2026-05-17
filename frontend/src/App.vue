<script setup lang="ts">
import AppSidebar from '@/components/AppSidebar.vue'
import AppHeader from '@/components/AppHeader.vue'
</script>

<template>
  <div class="app-layout">
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
