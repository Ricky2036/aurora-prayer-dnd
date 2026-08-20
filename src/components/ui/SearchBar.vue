<script setup>
import { GLYPHS } from '../../assets/icons/glyphs'

/** iOS 搜索框：圆角胶囊 + 放大镜 + 清除按钮 + 取消 */
const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '搜索' }
})
const emit = defineEmits(['update:modelValue', 'cancel'])

function clear() {
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="search-bar">
    <div class="sb-field">
      <svg class="sb-icon" width="15" height="15" viewBox="0 0 24 24">
        <path :d="GLYPHS.search" fill="#8E8E93" />
      </svg>
      <input
        :value="modelValue"
        :placeholder="placeholder"
        @input="emit('update:modelValue', $event.target.value)"
      />
      <button v-if="modelValue" class="sb-clear" @click="clear">
        <svg width="14" height="14" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="#C7C7CC" />
          <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#fff" stroke-width="1.8" stroke-linecap="round" />
        </svg>
      </button>
    </div>
    <button class="sb-cancel" @click="emit('cancel')">取消</button>
  </div>
</template>

<style scoped>
.search-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sb-field {
  flex: 1;
  height: 36px;
  border-radius: 10px;
  background: rgba(118, 118, 128, 0.12);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 9px;
}
.sb-icon { flex: none; }
.sb-field input {
  flex: 1;
  font: var(--text-body);
  color: var(--label);
  min-width: 0;
}
.sb-field input::placeholder { color: var(--label-tertiary); }
.sb-clear { display: flex; flex: none; }
.sb-cancel {
  color: var(--ios-blue);
  font: var(--text-body);
  flex: none;
}
</style>
