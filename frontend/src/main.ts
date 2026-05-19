import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles.css'

const app = createApp(App)

app.config.errorHandler = (err, instance, info) => {
  console.error('Vue error:', err)
  console.error('Component:', instance)
  console.error('Info:', info)
}

app.config.warnHandler = (msg, instance, trace) => {
  console.warn(`Vue warning: ${msg}`, { instance, trace })
}

app.use(createPinia())
app.use(router)
app.mount('#app')
