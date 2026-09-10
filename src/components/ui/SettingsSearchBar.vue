<script setup>
import { ref } from 'vue'
import microphoneIcon from '../../assets/icons/settings/microphone.svg'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '搜索' },
  active: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'focus', 'blur', 'clear'])
const inputRef = ref(null)

function onInput(e) {
  emit('update:modelValue', e.target.value)
}

function clear() {
  emit('update:modelValue', '')
  emit('clear')
  inputRef.value?.focus()
}

function focus() {
  inputRef.value?.focus()
}

defineExpose({ focus, inputRef })
</script>

<template>
  <div class="settings-search-bar" @click="focus">
    <div class="search-left">
      <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        ref="inputRef"
        class="search-input"
        :value="modelValue"
        :placeholder="placeholder"
        @input="onInput"
        @focus="emit('focus')"
        @blur="emit('blur')"
      />
    </div>

    <div class="search-right">
      <button v-if="modelValue" type="button" class="btn-clear" aria-label="清空" @click.stop="clear">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <div v-else class="mic-icon-wrap" title="语音搜索">
        <img class="mic-icon" :src="microphoneIcon" width="18" height="18" alt="" aria-hidden="true" draggable="false" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-search-bar {
  height: 48px;
  background: #FFFFFF;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);
  border: 0.5px solid rgba(0, 0, 0, 0.05);
  cursor: text;
  user-select: none;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}

.settings-search-bar:focus-within {
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.05);
  border-color: rgba(0, 0, 0, 0.1);
}

.search-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.search-icon {
  flex: none;
  stroke: #8E8E93;
}

.search-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  outline: none;
  font-size: 15px;
  line-height: 1.4;
  color: #111111;
  font-family: inherit;
  padding: 0;
}

.search-input::placeholder {
  color: #8E8E93;
}

.search-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

.btn-clear {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #E5E5EA;
  color: #8E8E93;
  border: none;
  outline: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s ease, color 0.15s ease;
}

.btn-clear:hover {
  background: #D1D1D6;
  color: #3C3C43;
}

.mic-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
}

.mic-icon {
  display: block;
  object-fit: contain;
  opacity: 0.44;
  pointer-events: none;
  user-select: none;
}
</style>
