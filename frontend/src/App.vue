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

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 100%;
}

html, body {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #1f2937;
  background: #f3f4f6;
  -webkit-font-smoothing: antialiased;
}

#app {
  height: 100%;
}

input, select, textarea, button {
  font-family: inherit;
  font-size: inherit;
}

a {
  color: #1a56db;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
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
