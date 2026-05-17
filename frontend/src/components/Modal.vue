<script setup lang="ts">
defineOptions({ name: 'Modal' })

withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
  }>(),
  {
    title: '',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function onOverlayClick() {
  close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-overlay" @click.self="onOverlayClick">
        <div class="modal" role="dialog" aria-modal="true" :aria-label="title">
          <div class="modal-header">
            <h3 class="modal-title">{{ title }}</h3>
            <button class="modal-close" aria-label="Закрыть" @click="close">
              &times;
            </button>
          </div>
          <div class="modal-body">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-5);
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0;
  width: 1.75rem;
  height: 1.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
}

.modal-close:hover {
  background: var(--color-bg);
  color: var(--color-text);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
