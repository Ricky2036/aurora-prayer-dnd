<script setup>
/** iOS 开关（51×31），标准 v-model */
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

function toggle() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <button
    class="toggle-switch"
    :class="{ on: modelValue, disabled }"
    role="switch"
    :aria-checked="modelValue"
    @click="toggle"
  >
    <span class="knob"></span>
  </button>
</template>

<style scoped>
.toggle-switch {
  position: relative;
  width: 51px;
  height: 31px;
  border-radius: 15.5px;
  background: #E9E9EA;
  transition: background 0.25s ease;
  flex: none;
}
.toggle-switch.on { background: var(--ios-green); }
.toggle-switch.disabled { opacity: 0.45; }
.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 27px;
  height: 27px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.22), 0 0 1px rgba(0, 0, 0, 0.1);
  transition: transform 0.25s cubic-bezier(0.3, 0.9, 0.35, 1.15);
}
.toggle-switch.on .knob { transform: translateX(20px); }
.toggle-switch:active .knob { width: 30px; }
.toggle-switch.on:active .knob { transform: translateX(17px); }
</style>
