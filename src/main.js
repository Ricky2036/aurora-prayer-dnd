import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/tokens.css'
import './styles/reset.css'
import './styles/global.css'
import { useSystemStore } from './stores/systemStore'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.mount('#app')

// 调试钩子（原型验收用）
window.__system = useSystemStore(pinia)
