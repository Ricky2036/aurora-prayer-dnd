<script setup>
import { ref, watch } from 'vue'
import WheelTimePicker from './WheelTimePicker.vue'

const props = defineProps({
  title: {
    type: String,
    default: '选择时间'
  },
  modelValue: {
    type: String,
    default: '07:00'
  },
  confirmText: {
    type: String,
    default: '确定'
  }
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])

const timeVal = ref(props.modelValue || '07:00')

watch(
  () => props.modelValue,
  (val) => {
    if (val) timeVal.value = val
  }
)

function onPickerChange(val) {
  timeVal.value = val
  emit('update:modelValue', val)
}

function handleConfirm() {
  emit('confirm', timeVal.value)
}

function handleCancel() {
  emit('cancel')
}
</script>

<template>
  <div class="time-picker-backdrop" @click.self="handleCancel">
    <div class="time-picker-sheet">
      <!-- 顶部 Header -->
      <div class="tpm-header">
        <div class="tpm-header-placeholder"></div>
        <div class="tpm-title">{{ title }}</div>
        <button class="tpm-close-btn" title="关闭" @click="handleCancel">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M1 1L13 13M1 13L13 1"
              stroke="#FFFFFF"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>

      <!-- 双列时间滚轮 -->
      <div class="tpm-picker-body">
        <WheelTimePicker
          :model-value="timeVal"
          @update:model-value="onPickerChange"
        />
      </div>

      <!-- 底部确定按钮 -->
      <div class="tpm-footer">
        <button class="tpm-confirm-btn" @click="handleConfirm">
          {{ confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.time-picker-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  z-index: 500;
  display: flex;
  align-items: flex-end;
  animation: backdropFade 0.22s ease-out;
}

@keyframes backdropFade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.time-picker-sheet {
  width: 100%;
  background: #1c1c1e;
  border-radius: 28px 28px 0 0;
  padding: 16px 20px 32px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.55);
  animation: sheetSlideUp 0.26s cubic-bezier(0.2, 0.9, 0.3, 1);
}

@keyframes sheetSlideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.tpm-header {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  margin-bottom: 8px;
}

.tpm-header-placeholder {
  width: 32px;
  height: 32px;
}

.tpm-title {
  font-size: 17px;
  font-weight: 600;
  color: #ffffff;
  text-align: center;
  letter-spacing: -0.3px;
}

.tpm-close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #323234;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s;
}

.tpm-close-btn:active {
  background: #48484a;
}

.tpm-picker-body {
  padding: 12px 0 20px;
}

.tpm-footer {
  padding-top: 10px;
}

.tpm-confirm-btn {
  width: 100%;
  height: 50px;
  border-radius: 25px;
  background: #ff9f0a;
  color: #ffffff;
  font-size: 17px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s, transform 0.1s;
}

.tpm-confirm-btn:active {
  opacity: 0.88;
  transform: scale(0.99);
}
</style>
