<script setup>
import { computed } from 'vue'
import { useI18nStore } from '../../stores/i18nStore'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  appId: {
    type: String,
    default: 'voicememos'
  },
  appName: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['allow', 'deny', 'update:visible'])

const i18n = useI18nStore()

const resolvedAppName = computed(() => {
  if (props.appName) return props.appName
  const name = i18n.appName(props.appId)
  if (name && name !== props.appId) return name
  return '录音'
})

const promptTitle = computed(() => {
  if (typeof i18n.notifAuthPrompt === 'function') {
    return i18n.notifAuthPrompt(resolvedAppName.value)
  }
  return `要允许“${resolvedAppName.value}”向您发送通知吗？`
})

function handleAllow() {
  emit('allow')
  emit('update:visible', false)
}

function handleDeny() {
  emit('deny')
  emit('update:visible', false)
}
</script>

<template>
  <Transition name="npm-fade">
    <div v-if="visible" class="npm-overlay" @click.self="handleDeny">
      <div class="npm-card">
        <!-- 顶部铃铛图标（参考设计稿带振铃波纹） -->
        <div class="npm-icon-box">
          <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
            <!-- 铃铛主体 -->
            <path
              d="M24 7.5C18.2 7.5 13.5 12.2 13.5 18V26.5L10.8 29.2C10.1 29.9 10.6 31.2 11.6 31.2H36.4C37.4 31.2 37.9 29.9 37.2 29.2L34.5 26.5V18C34.5 12.2 29.8 7.5 24 7.5Z"
              fill="#262628"
            />
            <!-- 铃铛下摆撞针 -->
            <path
              d="M20.2 33.2C20.8 35.6 22.2 37 24 37C25.8 37 27.2 35.6 27.8 33.2H20.2Z"
              fill="#262628"
            />
            <!-- 左侧振铃波纹 -->
            <path
              d="M8 17.5C6.7 19.5 6 21.9 6 24.5C6 27.1 6.7 29.5 8 31.5"
              stroke="#262628"
              stroke-width="2.6"
              stroke-linecap="round"
            />
            <path
              d="M4.5 20.8C4 22 3.7 23.2 3.7 24.5C3.7 25.8 4 27 4.5 28.2"
              stroke="#262628"
              stroke-width="2.6"
              stroke-linecap="round"
            />
            <!-- 右侧振铃波纹 -->
            <path
              d="M40 17.5C41.3 19.5 42 21.9 42 24.5C42 27.1 41.3 29.5 40 31.5"
              stroke="#262628"
              stroke-width="2.6"
              stroke-linecap="round"
            />
            <path
              d="M43.5 20.8C44 22 44.3 23.2 44.3 24.5C44.3 25.8 44 27 43.5 28.2"
              stroke="#262628"
              stroke-width="2.6"
              stroke-linecap="round"
            />
          </svg>
        </div>

        <!-- 询问提示文案 -->
        <div class="npm-title">{{ promptTitle }}</div>

        <!-- 操作按钮组 -->
        <div class="npm-actions">
          <button class="npm-btn npm-btn-allow" type="button" @click="handleAllow">
            {{ i18n.t('notifAuthAllow') || '允许' }}
          </button>
          <button class="npm-btn npm-btn-deny" type="button" @click="handleDeny">
            {{ i18n.t('notifAuthDeny') || '不允许' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.npm-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 500;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 16px;
  box-sizing: border-box;
}

.npm-card {
  width: 100%;
  background: #ffffff;
  border-radius: 28px;
  padding: 32px 24px 22px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.28);
  transform-origin: bottom center;
}

.npm-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
}

.npm-title {
  margin: 18px 0 26px;
  font-size: 17.5px;
  font-weight: 500;
  color: #111111;
  text-align: center;
  line-height: 1.45;
  letter-spacing: -0.2px;
}

.npm-actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.npm-btn {
  width: 100%;
  height: 52px;
  border-radius: 26px;
  border: none;
  background: #f1f2f4;
  color: #1c1c1e;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, transform 0.12s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.npm-btn:active {
  background: #e3e4e7;
  transform: scale(0.985);
}

/* 动效 */
.npm-fade-enter-active,
.npm-fade-leave-active {
  transition: opacity 0.24s ease;
}

.npm-fade-enter-active .npm-card,
.npm-fade-leave-active .npm-card {
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.24s ease;
}

.npm-fade-enter-from,
.npm-fade-leave-to {
  opacity: 0;
}

.npm-fade-enter-from .npm-card,
.npm-fade-leave-to .npm-card {
  transform: translateY(40px) scale(0.96);
  opacity: 0;
}
</style>
