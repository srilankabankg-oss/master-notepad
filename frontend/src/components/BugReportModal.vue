<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '@/api/client'

const route = useRoute()
const show = ref(false)
const description = ref('')
const sending = ref(false)
const sent = ref(false)
const error = ref('')

function open() {
  description.value = ''
  sent.value = false
  error.value = ''
  show.value = true
}

async function submit() {
  if (!description.value.trim()) return
  sending.value = true
  error.value = ''
  try {
    await api.bugs.report({
      page: (route.name as string) || route.path,
      description: description.value.trim(),
    })
    sent.value = true
  } catch (e: unknown) {
    error.value = 'Не удалось отправить'
  } finally {
    sending.value = false
  }
}

defineExpose({ open })
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="bug-overlay" @click.self="show = false">
      <div class="bug-modal">
        <div class="bug-header">
          <h2>Сообщить о баге</h2>
          <button class="bug-close" @click="show = false">✕</button>
        </div>

        <p v-if="sent" class="bug-success">Спасибо! Сообщение записано.</p>

        <template v-else>
          <p class="bug-page">Страница: {{ (route.name as string) || route.path }}</p>
          <textarea
            v-model="description"
            class="bug-input"
            placeholder="Опишите проблему..."
            rows="5"
            maxlength="2000"
          />
          <div v-if="error" class="bug-error">{{ error }}</div>
          <div class="bug-actions">
            <button class="btn btn-secondary" @click="show = false">Отмена</button>
            <button class="btn btn-primary" :disabled="sending || !description.trim()" @click="submit">
              {{ sending ? 'Отправка...' : 'Отправить' }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.bug-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.bug-modal {
  background: #fff; border-radius: 12px; padding: 2rem; max-width: 440px; width: 90%;
  box-shadow: 0 4px 24px rgba(0,0,0,0.15);
}
.bug-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
.bug-header h2 { margin: 0; font-size: 1.1rem; }
.bug-close { border: none; background: none; font-size: 1.2rem; cursor: pointer; color: #6b7280; }
.bug-page { font-size: 0.85rem; color: #6b7280; margin-bottom: 0.75rem; }
.bug-input {
  width: 100%; padding: 0.625rem 0.75rem; border: 1px solid #d1d5db; border-radius: 8px;
  font-size: 0.9rem; resize: vertical; font-family: inherit; box-sizing: border-box;
}
.bug-input:focus { outline: none; border-color: #f59e0b; box-shadow: 0 0 0 3px rgba(245,158,11,0.1); }
.bug-success { color: #059669; font-size: 0.95rem; padding: 1rem 0; }
.bug-error { color: #dc2626; font-size: 0.85rem; margin-top: 0.5rem; }
.bug-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
.btn { padding: 0.5rem 1.25rem; border-radius: 6px; border: none; cursor: pointer; font-size: 0.9rem; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary { background: #1a56db; color: #fff; }
.btn-secondary { background: #e5e7eb; color: #374151; }
</style>