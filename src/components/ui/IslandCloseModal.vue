<script setup>
import { computed } from 'vue'
import { useI18nStore } from '../../stores/i18nStore'
import ActionModal from './ActionModal.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  act: { type: Object, default: null },
  title: { type: String, default: '' },
  desc: { type: String, default: '' },
  cancelText: { type: String, default: '' },
  confirmText: { type: String, default: '' },
  danger: { type: Boolean, default: true }
})

const emit = defineEmits(['close-once', 'close-permanent', 'cancel', 'confirm', 'update:visible'])

const i18n = useI18nStore()

const modalTitle = computed(() => props.title || i18n.t('islandClosePromptTitle'))
const modalDesc = computed(() => props.desc || i18n.t('islandClosePromptDesc'))
const modalCancelText = computed(() => props.cancelText || i18n.t('islandCloseOnlyOnce'))
const modalConfirmText = computed(() => props.confirmText || i18n.t('islandClosePermanent'))

function onCancel() {
  emit('close-once')
  if (props.cancelText) {
    emit('cancel')
  }
}

function onConfirm() {
  emit('close-permanent')
  emit('confirm')
}

function onBackdrop() {
  emit('cancel')
}
</script>

<template>
  <ActionModal
    :visible="visible"
    :title="modalTitle"
    :desc="modalDesc"
    :cancel-text="modalCancelText"
    :confirm-text="modalConfirmText"
    :confirm-danger="danger"
    align-title="center"
    align-desc="left"
    @cancel="onCancel"
    @confirm="onConfirm"
    @backdrop="onBackdrop"
    @update:visible="(val) => emit('update:visible', val)"
  />
</template>
