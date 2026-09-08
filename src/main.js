import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/tokens.css'
import './styles/reset.css'
import './styles/global.css'
import { useSystemStore } from './stores/systemStore'
import { useControlStore } from './stores/controlStore'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.mount('#app')

import { useRecorderStore } from './stores/recorderStore'
import { useNotificationsStore } from './stores/notificationsStore'

// 调试钩子（原型验收用）
const system = useSystemStore(pinia)
const control = useControlStore(pinia)
const recorder = useRecorderStore(pinia)
const notifications = useNotificationsStore(pinia)
window.__system = system
window.__control = control
window.__recorder = recorder
window.__notifications = notifications

const urlParams = new URLSearchParams(window.location.search)
if (urlParams.get('overlay') === 'controlCenter') {
  system.unlock()
  system.settleOverlay('controlCenter', true)
}
if (urlParams.get('edit') === '1') {
  control.setEditing(true)
}
if (urlParams.get('finetune') === '1') {
  control.setFineTuningMode(true)
}
if (urlParams.get('privacy') === '1') {
  control.setShowPrivacyIndicators(true)
}
