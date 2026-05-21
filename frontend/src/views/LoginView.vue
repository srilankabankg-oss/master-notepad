<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const localError = ref<string | null>(null)

async function handleLogin() {
  localError.value = null
  if (!email.value.trim() || !password.value.trim()) {
    localError.value = 'Заполните все поля'
    return
  }
  try {
    await auth.login({ email: email.value, password: password.value })
    router.push('/subcontractors')
  } catch {
    localError.value = auth.error
  }
}
</script>

<template>
  <div class="auth-wrapper">
    <div class="auth-card">
      <h1 class="auth-title">Вход в систему</h1>

      <form @submit.prevent="handleLogin" class="auth-form">
        <label class="field">
          <span class="field-label">Email</span>
          <input
            v-model="email"
            type="email"
            class="input"
            autocomplete="email"
            required
          />
        </label>

        <label class="field">
          <span class="field-label">Пароль</span>
          <input
            v-model="password"
            type="password"
            class="input"
            autocomplete="current-password"
            required
          />
        </label>

        <div v-if="localError" class="form-error">{{ localError }}</div>

        <button
          type="submit"
          class="btn btn-primary auth-submit"
          :disabled="auth.loading"
        >
          {{ auth.loading ? 'Вход...' : 'Войти' }}
        </button>
      </form>

      <p class="auth-footer">
        Нет аккаунта?
        <router-link to="/register">Зарегистрироваться</router-link>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--space-4);
  background: var(--color-bg);
}

.auth-card {
  width: 100%;
  max-width: 26rem;
  background: var(--color-bg-card);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  padding: var(--space-8);
}

.auth-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  text-align: center;
  margin-bottom: var(--space-6);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.auth-submit {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  margin-top: var(--space-2);
}

.auth-footer {
  margin-top: var(--space-6);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
</style>