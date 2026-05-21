import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api, errorMessage } from '@/api/client'
import type { AuthEmployee, LoginRequest, RegisterRequest } from '@/types/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthEmployee | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const isAuthenticated = computed(() => user.value !== null)

  async function login(data: LoginRequest) {
    loading.value = true
    error.value = null
    try {
      user.value = await api.auth.login(data)
    } catch (e) {
      error.value = errorMessage(e, 'Ошибка входа')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function register(data: RegisterRequest) {
    loading.value = true
    error.value = null
    try {
      user.value = await api.auth.register(data)
    } catch (e) {
      error.value = errorMessage(e, 'Ошибка регистрации')
      throw e
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      await api.auth.logout()
    } catch {
      /* ignore logout errors */
    }
    user.value = null
  }

  async function fetchMe() {
    try {
      user.value = await api.auth.me()
    } catch {
      user.value = null
    }
  }

  return { user, loading, error, isAuthenticated, login, register, logout, fetchMe }
})