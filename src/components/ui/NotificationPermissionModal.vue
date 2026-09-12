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
  <Transition name="npm-slide">
    <div v-if="visible" class="npm-overlay" @click.self="handleDeny">
      <div class="npm-card">
        <!-- 顶部铃铛图标（控制中心响铃图标） -->
        <div class="npm-icon-box">
          <svg width="36" height="36" viewBox="-2 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M15.2037 22.4572C14.5574 24.1557 12.8497 25.3333 10.9079 25.3333C8.9661 25.3333 7.2581 24.1557 6.61179 22.4572H15.2037ZM10.9079 0C11.539 0.000166901 12.0508 0.511778 12.0508 1.14286V1.7939C15.9602 2.33919 19.0002 5.64069 19.111 9.69606L19.2372 14.3062C19.2672 15.4046 19.6759 16.4592 20.3945 17.2906L21.4894 18.5565C22.1844 19.3609 21.6996 20.5791 20.7078 20.7429H1.10844C0.116346 20.5792 -0.368188 19.361 0.327189 18.5565L1.42168 17.2906C2.1402 16.4593 2.5494 15.4045 2.57942 14.3062L2.70554 9.69606C2.81638 5.64075 5.85574 2.33925 9.76506 1.7939V1.14286C9.76506 0.511699 10.2768 3.96322e-05 10.9079 0Z"
              fill="#1C1C1E"
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
  overflow: hidden;
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
  will-change: transform;
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

/* 下方往上推出衔接动效 */
.npm-slide-enter-active,
.npm-slide-leave-active {
  transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.npm-slide-enter-active .npm-card {
  transition: transform 0.42s cubic-bezier(0.16, 1, 0.28, 1);
}

.npm-slide-leave-active .npm-card {
  transition: transform 0.28s cubic-bezier(0.35, 0, 0.65, 0.1);
}

.npm-slide-enter-from,
.npm-slide-leave-to {
  opacity: 0;
}

.npm-slide-enter-from .npm-card,
.npm-slide-leave-to .npm-card {
  transform: translate3d(0, calc(100% + 36px), 0);
}
</style>
