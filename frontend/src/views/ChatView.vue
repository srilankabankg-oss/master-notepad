<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { api, errorMessage } from '@/api/client'
import type { AskResponse } from '@/types/api'

interface Message {
  role: 'user' | 'assistant'
  text: string
  sources?: AskResponse['sources']
  confidence?: number
}

const messages = ref<Message[]>([])
const inputText = ref('')
const loading = ref(false)
const error = ref('')
const messagesContainer = ref<HTMLElement | null>(null)

async function scrollToBottom() {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function handleInput(e: Event) {
  const target = e.target as HTMLTextAreaElement
  target.style.height = 'auto'
  target.style.height = `${Math.min(target.scrollHeight, 10 * 24)}px`
}

async function sendMessage() {
  const question = inputText.value.trim()
  if (!question || loading.value) return

  messages.value.push({ role: 'user', text: question })
  inputText.value = ''
  error.value = ''
  loading.value = true
  await scrollToBottom()

  try {
    const response = await api.ai.ask({ question })
    messages.value.push({
      role: 'assistant',
      text: response.answer,
      sources: response.sources,
      confidence: response.confidence,
    })
  } catch (e: unknown) {
    error.value = errorMessage(e, 'Не удалось получить ответ от ассистента')
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}
</script>

<template>
  <div class="chat-wrapper">
    <div
      v-if="messages.length === 0 && !loading && !error"
      class="chat-empty"
    >
      <p class="chat-empty-text">Задайте вопрос о подрядчиках, чек-листах или событиях</p>
    </div>

    <div
      ref="messagesContainer"
      v-else
      class="chat-messages"
    >
      <div
        v-for="(msg, idx) in messages"
        :key="idx"
        :class="['chat-message', `chat-message--${msg.role}`]"
      >
        <div class="chat-bubble">
          <p class="chat-text">{{ msg.text }}</p>
          <div
            v-if="msg.sources && msg.sources.length > 0"
            class="chat-sources"
          >
            <p class="chat-sources-label">Источники:</p>
            <div class="chat-source-cards">
              <div
                v-for="(src, si) in msg.sources"
                :key="si"
                class="chat-source-card"
              >
                <span class="chat-source-type">{{ src.entity_type }}</span>
                <span class="chat-source-title">{{ src.content.slice(0, 80) }}</span>
                <p class="chat-source-excerpt">{{ src.content }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="loading" class="chat-loading">
        <span class="chat-loading-text">Ассистент думает</span>
        <span class="chat-loading-dots">
          <span>.</span><span>.</span><span>.</span>
        </span>
      </div>

      <div v-if="error" class="chat-error">{{ error }}</div>
    </div>

    <div class="chat-input-area">
      <textarea
        v-model="inputText"
        class="chat-input"
        placeholder="Введите вопрос..."
        rows="1"
        :disabled="loading"
        @input="handleInput"
        @keydown="onKeydown"
      />
      <button
        class="chat-send-btn"
        :disabled="loading || !inputText.trim()"
        @click="sendMessage"
      >
        Отправить
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-wrapper {
  margin: -1.5rem -2rem;
  height: calc(100vh - 3.75rem);
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

.chat-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
}

.chat-empty-text {
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
  text-align: center;
  max-width: 20rem;
  line-height: 1.6;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6) var(--space-8);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.chat-message {
  display: flex;
}

.chat-message--user {
  justify-content: flex-end;
}

.chat-message--assistant {
  justify-content: flex-start;
}

.chat-bubble {
  max-width: 75%;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  line-height: 1.6;
}

.chat-message--user .chat-bubble {
  background: var(--color-primary);
  color: var(--color-bg-card);
  border-bottom-right-radius: var(--space-1);
}

.chat-message--assistant .chat-bubble {
  background: var(--color-bg-card);
  color: var(--color-text);
  border: 0.0625rem solid var(--color-border);
  border-bottom-left-radius: var(--space-1);
}

.chat-text {
  font-size: var(--font-size-base);
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-sources {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 0.0625rem solid var(--color-border);
}

.chat-message--user .chat-sources {
  border-top-color: rgba(255, 255, 255, 0.2);
}

.chat-sources-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.chat-message--user .chat-sources-label {
  color: rgba(255, 255, 255, 0.8);
}

.chat-source-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.chat-source-card {
  background: rgba(0, 0, 0, 0.04);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
}

.chat-message--user .chat-source-card {
  background: rgba(255, 255, 255, 0.12);
}

.chat-source-type {
  display: inline-block;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
  background: var(--color-badge-info-bg);
  color: var(--color-badge-info-text);
  margin-right: var(--space-2);
}

.chat-message--user .chat-source-type {
  background: rgba(255, 255, 255, 0.2);
  color: var(--color-bg-card);
}

.chat-source-title {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.chat-source-excerpt {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-top: var(--space-1);
}

.chat-message--user .chat-source-excerpt {
  color: rgba(255, 255, 255, 0.75);
}

.chat-loading {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-4);
}

.chat-loading-text {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
}

.chat-loading-dots span {
  animation: blink 1.4s infinite;
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
}

.chat-loading-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.chat-loading-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes blink {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 1; }
}

.chat-error {
  padding: var(--space-3) var(--space-4);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
  background: var(--color-badge-violation-bg);
  border-radius: var(--radius-md);
}

.chat-input-area {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-8) var(--space-5);
  border-top: 0.0625rem solid var(--color-border);
  background: var(--color-bg-card);
  align-items: flex-end;
}

.chat-input {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  border: 0.0625rem solid var(--color-border-input);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  color: var(--color-text);
  background: var(--color-bg);
  outline: none;
  resize: none;
  max-height: 15rem;
  line-height: 1.5;
  transition: border-color 0.15s;
}

.chat-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 0.1875rem rgba(26, 86, 219, 0.1);
}

.chat-send-btn {
  padding: var(--space-2) var(--space-5);
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-bg-card);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
  height: 2.5rem;
}

.chat-send-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.chat-send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 767px) {
  .chat-wrapper {
    margin: -1rem;
  }

  .chat-messages {
    padding: var(--space-4) var(--space-4);
  }

  .chat-bubble {
    max-width: 90%;
  }

  .chat-input-area {
    padding: var(--space-3) var(--space-4) var(--space-4);
  }

  .chat-send-btn {
    padding: var(--space-2) var(--space-4);
  }
}
</style>