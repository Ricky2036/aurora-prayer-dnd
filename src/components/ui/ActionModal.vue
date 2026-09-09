<script setup>
const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '' },
  desc: { type: String, default: '' },
  cancelText: { type: String, default: '取消' },
  confirmText: { type: String, default: '确定' },
  showCancel: { type: Boolean, default: true },
  confirmDanger: { type: Boolean, default: true },
  alignTitle: { type: String, default: 'center' },
  alignDesc: { type: String, default: 'left' },
  closeOnBackdrop: { type: Boolean, default: true }
})

const emit = defineEmits(['update:visible', 'confirm', 'cancel', 'backdrop', 'close'])

function onBackdropClick(e) {
  if (!props.closeOnBackdrop) return
  if (e.target === e.currentTarget) {
    emit('update:visible', false)
    emit('backdrop')
    emit('close', { trigger: 'backdrop' })
  }
}

function onCancel() {
  emit('update:visible', false)
  emit('cancel')
  emit('close', { trigger: 'cancel' })
}

function onConfirm() {
  emit('update:visible', false)
  emit('confirm')
  emit('close', { trigger: 'confirm' })
}
</script>

<template>
  <Transition name="action-modal-fade">
    <div
      v-if="visible"
      class="action-modal-backdrop"
      @click="onBackdropClick"
      @pointerdown="onBackdropClick"
      @touchstart="onBackdropClick"
      @pointermove.stop
      @pointerup.stop
      @touchmove.stop
      @touchend.stop
    >
      <div
        class="action-modal-card"
        @pointerdown.stop
        @touchstart.stop
        @click.stop
      >
        <slot name="header">
          <div
            v-if="title || $slots.title"
            class="action-modal-title"
            :style="{ textAlign: alignTitle }"
          >
            <slot name="title">{{ title }}</slot>
          </div>
        </slot>

        <div
          v-if="desc || $slots.default"
          class="action-modal-desc"
          :style="{ textAlign: alignDesc }"
        >
          <slot>{{ desc }}</slot>
        </div>

        <slot name="actions">
          <div class="action-modal-actions">
            <button
              v-if="showCancel"
              class="action-modal-btn btn-cancel"
              type="button"
              @click="onCancel"
            >
              {{ cancelText }}
            </button>
            <button
              class="action-modal-btn btn-confirm"
              :class="{ 'is-danger': confirmDanger }"
              type="button"
              @click="onConfirm"
            >
              {{ confirmText }}
            </button>
          </div>
        </slot>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.action-modal-backdrop {
  position: absolute;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0 16px 24px;
  box-sizing: border-box;
}

.action-modal-card {
  width: 100%;
  max-width: 440px;
  border-radius: 30px;
  background: #FFFFFF;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.22);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 28px 24px 24px;
  box-sizing: border-box;
  user-select: none;
}

.action-modal-title {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: 20px;
  font-weight: 700;
  color: #111111;
  line-height: 1.35;
  letter-spacing: -0.2px;
  margin-bottom: 14px;
}

.action-modal-desc {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: 15px;
  font-weight: 400;
  color: #2C2C2E;
  line-height: 1.55;
  margin-bottom: 26px;
  padding: 0 2px;
  word-break: break-word;
}

.action-modal-actions {
  display: flex;
  gap: 12px;
  width: 100%;
}

.action-modal-btn {
  flex: 1;
  height: 50px;
  border-radius: 25px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  box-sizing: border-box;
  outline: none;
  background: #EFEFEF;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s ease, transform 0.1s ease;
}

.action-modal-btn:active {
  transform: scale(0.98);
}

.btn-cancel {
  color: #111111;
}

.btn-cancel:active {
  background: #E2E2E2;
}

.btn-confirm.is-danger {
  color: #FF3B30;
}

.btn-confirm.is-danger:active {
  background: #FCE8E8;
}

.btn-confirm:not(.is-danger) {
  color: #007AFF;
}

.btn-confirm:not(.is-danger):active {
  background: #E5F1FF;
}

/* 进出场动画（从底部滑入 / 滑出） */
.action-modal-fade-enter-active,
.action-modal-fade-leave-active {
  transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.action-modal-fade-enter-active .action-modal-card,
.action-modal-fade-leave-active .action-modal-card {
  transition: transform 0.26s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease;
}

.action-modal-fade-enter-from,
.action-modal-fade-leave-to {
  opacity: 0;
}

.action-modal-fade-enter-from .action-modal-card {
  transform: translateY(40px);
  opacity: 0;
}

.action-modal-fade-leave-to .action-modal-card {
  transform: translateY(40px);
  opacity: 0;
}
</style>
