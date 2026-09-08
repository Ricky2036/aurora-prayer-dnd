<script setup>
import { useI18nStore } from '../../stores/i18nStore'

const props = defineProps({
  visible: { type: Boolean, default: false },
  act: { type: Object, default: null }
})

const emit = defineEmits(['close-once', 'close-permanent', 'cancel'])

const i18n = useI18nStore()

function onBackdropClick(e) {
  if (e.target === e.currentTarget) {
    emit('cancel')
  }
}
</script>

<template>
  <Transition name="modal-fade">
    <div
      v-if="visible"
      class="island-modal-backdrop"
      @click="onBackdropClick"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
      @touchstart.stop
      @touchmove.stop
      @touchend.stop
    >
      <div class="island-modal-card" @click.stop>
        <div class="island-modal-header">
          <div class="island-modal-title">
            {{ i18n.t('islandClosePromptTitle') }}
          </div>
          <div class="island-modal-desc">
            {{ i18n.t('islandClosePromptDesc') }}
          </div>
        </div>

        <div class="island-modal-actions">
          <button class="modal-btn btn-only-once" @click="emit('close-once')">
            {{ i18n.t('islandCloseOnlyOnce') }}
          </button>
          <button class="modal-btn btn-permanent" @click="emit('close-permanent')">
            {{ i18n.t('islandClosePermanent') }}
          </button>
          <button class="modal-btn btn-cancel" @click="emit('cancel')">
            {{ i18n.t('islandCloseCancel') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.island-modal-backdrop {
  position: absolute;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
}

.island-modal-card {
  width: min(310px, 100%);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  user-select: none;
}

.island-modal-header {
  padding: 22px 20px 16px;
  text-align: center;
}

.island-modal-title {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
  font-size: 17px;
  font-weight: 600;
  color: #111111;
  line-height: 1.35;
  letter-spacing: -0.2px;
}

.island-modal-desc {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
  font-size: 13px;
  font-weight: 400;
  color: rgba(60, 60, 67, 0.75);
  line-height: 1.45;
  margin-top: 8px;
}

.island-modal-actions {
  display: flex;
  flex-direction: column;
  border-top: 0.5px solid rgba(60, 60, 67, 0.2);
}

.modal-btn {
  width: 100%;
  height: 48px;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
  font-size: 16px;
  cursor: pointer;
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.2);
  transition: background 0.15s ease;
  box-sizing: border-box;
}

.modal-btn:last-child {
  border-bottom: none;
}

.modal-btn:active {
  background: rgba(0, 0, 0, 0.08);
}

.btn-only-once {
  color: #007aff;
  font-weight: 500;
}

.btn-permanent {
  color: #ff3b30;
  font-weight: 600;
}

.btn-cancel {
  color: rgba(60, 60, 67, 0.65);
  font-weight: 400;
}

/* 进出场动画 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-fade-enter-active .island-modal-card,
.modal-fade-leave-active .island-modal-card {
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .island-modal-card {
  transform: scale(0.9);
  opacity: 0;
}

.modal-fade-leave-to .island-modal-card {
  transform: scale(0.92);
  opacity: 0;
}
</style>
