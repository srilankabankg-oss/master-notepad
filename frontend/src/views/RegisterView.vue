<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const name = ref('')
const email = ref('')
const password = ref('')
const position = ref('')
const localError = ref<string | null>(null)

async function handleRegister() {
  localError.value = null
  if (!name.value.trim() || !email.value.trim() || !password.value.trim()) {
    localError.value = 'Заполните обязательные поля'
    return
  }
  if (password.value.length < 6) {
    localError.value = 'Пароль должен содержать минимум 6 символов'
    return
  }
  try {
    await auth.register({
      name: name.value,
      email: email.value,
      password: password.value,
      position: position.value || undefined,
    })
    router.push('/subcontractors')
  } catch {
    localError.value = auth.error
  }
}
</script>

<template>
  <div class="auth-wrapper">
    <div class="auth-card">
      <h1 class="auth-title">Регистрация</h1>

      <form @submit.prevent="handleRegister" class="auth-form">
        <label class="field">
          <span class="field-label">Имя *</span>
          <input
            v-model="name"
            type="text"
            class="input"
            autocomplete="name"
            required
          />
        </label>

        <label class="field">
          <span class="field-label">Email *</span>
          <input
            v-model="email"
            type="email"
            class="input"
            autocomplete="email"
            required
          />
        </label>

        <label class="field">
          <span class="field-label">Пароль *</span>
          <input
            v-model="password"
            type="password"
            class="input"
            autocomplete="new-password"
            required
            minlength="6"
          />
        </label>

        <label class="field">
          <span class="field-label">Должность</span>
          <input
            v-model="position"
            type="text"
            class="input"
            autocomplete="organization-title"
          />
        </label>

        <div v-if="localError" class="form-error">{{ localError }}</div>

        <button
          type="submit"
          class="btn btn-primary auth-submit"
          :disabled="auth.loading"
        >
          {{ auth.loading ? 'Регистрация...' : 'Зарегистрироваться' }}
        </button>
      </form>

      <p class="auth-footer">
        Уже есть аккаунт?
        <router-link to="/login">Войти</router-link>
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