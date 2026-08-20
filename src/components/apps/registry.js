/**
 * 深度应用组件注册表：appId → 应用根组件。
 * 未注册的应用自动落到 PlaceholderApp。
 */
import PhoneApp from './phone/PhoneApp.vue'
import MessagesApp from './messages/MessagesApp.vue'
import SettingsApp from './settings/SettingsApp.vue'
import CalendarApp from './calendar/CalendarApp.vue'
import CameraApp from './camera/CameraApp.vue'

export const appComponents = {
  phone: PhoneApp,
  messages: MessagesApp,
  settings: SettingsApp,
  calendar: CalendarApp,
  camera: CameraApp
}
