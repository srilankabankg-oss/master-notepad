<script setup lang="ts">
defineOptions({ name: 'BaseButton' })

withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'warning'
    size?: 'sm' | 'md'
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
  }>(),
  {
    variant: 'primary',
    size: 'md',
    disabled: false,
    type: 'button',
  },
)
</script>

<template>
  <button
    class="btn"
    :class="[
      `btn-${variant}`,
      size === 'sm' && 'btn-sm',
    ]"
    :disabled="disabled"
    :type="type"
  >
    <slot />
  </button>
</template>
