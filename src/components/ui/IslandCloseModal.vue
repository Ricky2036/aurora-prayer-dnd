<script setup>
import { useI18nStore } from '../../stores/i18nStore'

const props = defineProps({
  visible: { type: Boolean, default: false },
  act: { type: Object, default: null }
})

const emit = defineEmits(['close-once', 'close-permanent', 'cancel'])

const i18n = useI18nStore()

function onBackdropDismiss(e) {
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
      @click="onBackdropDismiss"
      @pointerdown="onBackdropDismiss"
      @touchstart="onBackdropDismiss"
      @pointermove.stop
      @pointerup.stop
      @touchmove.stop
      @touchend.stop
    >
      <div class="island-modal-card" @pointerdown.stop @touchstart.stop @click.stop>
        <div class="island-modal-title">
          {{ i18n.t('islandClosePromptTitle') }}
        </div>
        <div class="island-modal-desc">
          {{ i18n.t('islandClosePromptDesc') }}
        </div>

        <div class="island-modal-actions">
          <button class="modal-btn btn-only-once" @click="emit('close-once')">
            {{ i18n.t('islandCloseOnlyOnce') }}
          </button>
          <button class="modal-btn btn-permanent" @click="emit('close-permanent')">
            {{ i18n.t('islandClosePermanent') }}
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
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0 16px 24px;
  box-sizing: border-box;
}

.island-modal-card {
  width: 100%;
  max-width: 440px;
  border-radius: 32px;
  background: #FFFFFF;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.24);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 32px 24px 24px;
  box-sizing: border-box;
  user-select: none;
}

.island-modal-title {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: 21px;
  font-weight: 700;
  color: #111111;
  line-height: 1.35;
  text-align: center;
  letter-spacing: -0.2px;
  margin-bottom: 14px;
}

.island-modal-desc {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: 15.5px;
  font-weight: 400;
  color: #191919;
  line-height: 1.55;
  text-align: center;
  margin-bottom: 26px;
  padding: 0 4px;
}

.island-modal-actions {
  display: flex;
  gap: 12px;
  width: 100%;
}

.modal-btn {
  flex: 1;
  height: 52px;
  border-radius: 26px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: 16.5px;
  font-weight: 600;
  cursor: pointer;
  box-sizing: border-box;
  outline: none;
  background: #EFEFEF;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s ease, transform 0.1s ease;
}

.modal-btn:active {
  transform: scale(0.98);
}

.btn-only-once {
  color: #191919;
}

.btn-only-once:active {
  background: #E2E2E2;
}

.btn-permanent {
  color: #F53F3F;
}

.btn-permanent:active {
  background: #FCE8E8;
}

/* 进出场动画（从底部滑入 / 滑出） */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-fade-enter-active .island-modal-card,
.modal-fade-leave-active .island-modal-card {
  transition: transform 0.26s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .island-modal-card {
  transform: translateY(40px);
  opacity: 0;
}

.modal-fade-leave-to .island-modal-card {
  transform: translateY(40px);
  opacity: 0;
}
</style>
