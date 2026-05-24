import { describe, test, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import TasksView from '@/views/TasksView.vue'

describe('TasksView', () => {
  beforeEach(() => setActivePinia(createPinia()))

  test('renders', () => {
    const wrapper = mount(TasksView, {
      global: { stubs: { Modal: true, BaseButton: true, routerLink: true } },
    })
    expect(wrapper.find('.tasks-view').exists()).toBe(true)
  })
})