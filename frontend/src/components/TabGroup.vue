<script setup lang="ts">
defineOptions({ name: 'TabGroup' })

const props = defineProps<{ modelValue: string; tabs: { key: string; label: string }[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="tabs">
    <button
      v-for="tab in props.tabs"
      :key="tab.key"
      :class="['tab', { active: props.modelValue === tab.key }]"
      @click="emit('update:modelValue', tab.key)"
    >{{ tab.label }}</button>
  </div>
</template>

<style scoped>
.tabs { display: flex; gap: 0.25rem; border-bottom: 0.0625rem solid var(--color-border); margin-bottom: var(--space-4); }
.tab { padding: 0.5rem 0.875rem; border: none; background: none; cursor: pointer; font-size: 0.875rem; font-weight: 500; color: var(--color-text-muted); border-bottom: 0.125rem solid transparent; transition: all 0.15s; }
.tab:hover { color: var(--color-text-secondary); }
.tab.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }
</style>
