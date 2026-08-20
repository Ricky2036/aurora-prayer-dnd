<script setup>
import { computed, ref } from 'vue'
import { GLYPHS } from '../../../assets/icons/glyphs'

/**
 * 电话：底部 Tab（最近通话 / 通讯录 / 拨号键盘）。
 * 拨号键盘：圆形数字键 + 号码回显 + 拨打/删除；拨号即生成一条「呼叫中」模拟态。
 */
const props = defineProps({ app: Object })

const tab = ref('keypad') // recents | contacts | keypad

const RECENTS = [
  { name: '王工（深圳）', type: 'missed', time: '22:28', tag: '手机' },
  { name: '陈静', type: 'outgoing', time: '21:47', tag: '手机' },
  { name: '顺丰快递', type: 'incoming', time: '19:02', tag: '快递' },
  { name: '妈妈', type: 'incoming', time: '昨天', tag: '手机' },
  { name: 'Leo', type: 'missed', time: '昨天', tag: '手机' },
  { name: '美团外卖', type: 'incoming', time: '周六', tag: '外卖' }
]

const CONTACTS = [
  { name: '陈静', initial: '陈', color: '#5AC8FA' },
  { name: 'Leo', initial: 'L', color: '#34C759' },
  { name: '妈妈', initial: '妈', color: '#FF2D55' },
  { name: '王工', initial: '王', color: '#FF9500' },
  { name: '张伟', initial: '张', color: '#AF52DE' },
  { name: '赵敏', initial: '赵', color: '#0A84FF' }
]

const KEYS = [
  ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
  ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
  ['*', ''], ['0', '+'], ['#', '']
]

const number = ref('')
const calling = ref(false)

function pressKey(k) {
  if (number.value.length < 15) number.value += k
}
function backspace() {
  number.value = number.value.slice(0, -1)
}
function call() {
  if (!number.value) return
  calling.value = true
  setTimeout(() => {
    calling.value = false
    number.value = ''
    tab.value = 'recents'
  }, 2200)
}

/** 号码分组显示：138 0000 0000 */
const formatted = computed(() => {
  const n = number.value
  if (n.length <= 3) return n
  if (n.length <= 7) return `${n.slice(0, 3)} ${n.slice(3)}`
  return `${n.slice(0, 3)} ${n.slice(3, 7)} ${n.slice(7)}`
})

const TABS = [
  { id: 'recents', label: '最近通话', glyph: 'schedule' },
  { id: 'contacts', label: '通讯录', glyph: 'person' },
  { id: 'keypad', label: '拨号键盘', glyph: 'dialpad' }
]
</script>

<template>
  <div class="phone-app">
    <!-- 呼叫中全屏模拟 -->
    <Transition name="fade">
      <div v-if="calling" class="calling-overlay">
        <div class="co-avatar">{{ number.slice(0, 1) }}</div>
        <div class="co-number">{{ formatted }}</div>
        <div class="co-status">正在呼叫…</div>
        <div class="co-end" @click="calling = false; number = ''">
          <svg width="26" height="26" viewBox="0 0 24 24" style="transform: rotate(135deg)">
            <path :d="GLYPHS.phone" fill="#fff" />
          </svg>
        </div>
      </div>
    </Transition>

    <div class="pa-header">
      <div class="large-title">{{ TABS.find(t => t.id === tab).label }}</div>
    </div>

    <!-- 最近通话 -->
    <div v-if="tab === 'recents'" class="pa-body scrollable">
      <div v-for="(r, i) in RECENTS" :key="i" class="recent-cell">
        <div class="rc-main">
          <div class="rc-name" :class="{ missed: r.type === 'missed' }">{{ r.name }}</div>
          <div class="rc-sub">
            <svg width="11" height="11" viewBox="0 0 24 24" style="margin-right:3px">
              <path v-if="r.type === 'outgoing'" d="M9 5v2h6.6L4.4 18.2 5.8 19.6 17 8.4V15h2V5H9z" fill="#8E8E93" />
              <path v-else :d="GLYPHS.phone" :fill="r.type === 'missed' ? '#FF3B30' : '#8E8E93'" />
            </svg>
            {{ r.tag }}
          </div>
        </div>
        <span class="rc-time">{{ r.time }}</span>
        <svg width="20" height="20" viewBox="0 0 24 24"><path :d="GLYPHS.info" fill="#0A84FF" /></svg>
      </div>
    </div>

    <!-- 通讯录 -->
    <div v-else-if="tab === 'contacts'" class="pa-body scrollable">
      <div v-for="(c, i) in CONTACTS" :key="i" class="contact-cell">
        <div class="ct-avatar" :style="{ background: c.color }">{{ c.initial }}</div>
        <div class="ct-name">{{ c.name }}</div>
      </div>
    </div>

    <!-- 拨号键盘 -->
    <div v-else class="pa-body keypad-body">
      <div class="number-display">{{ formatted || '&nbsp;' }}</div>
      <div class="keypad-grid">
        <button
          v-for="[num, letters] in KEYS"
          :key="num"
          class="key"
          @click="pressKey(num)"
        >
          <span class="key-num">{{ num }}</span>
          <span v-if="letters" class="key-letters">{{ letters }}</span>
        </button>
      </div>
      <div class="keypad-actions">
        <div class="ka-placeholder"></div>
        <button class="call-btn" :class="{ ready: number }" @click="call">
          <svg width="28" height="28" viewBox="0 0 24 24"><path :d="GLYPHS.phone" fill="#fff" /></svg>
        </button>
        <button class="backspace" :style="{ visibility: number ? 'visible' : 'hidden' }" @click="backspace" @contextmenu.prevent>
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z" fill="#8E8E93" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 底部 Tab 栏 -->
    <div class="tab-bar">
      <button
        v-for="t in TABS"
        :key="t.id"
        class="tab-item"
        :class="{ active: tab === t.id }"
        @click="tab = t.id"
      >
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path :d="GLYPHS[t.glyph]" :fill="tab === t.id ? '#007AFF' : '#8E8E93'" />
        </svg>
        <span>{{ t.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.phone-app {
  height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.pa-header { flex: none; }
.large-title {
  font: var(--text-large-title);
  color: var(--label);
  padding: calc(var(--safe-top) + 18px) 20px 10px;
}
.pa-body { flex: 1; min-height: 0; }

/* 最近通话 */
.recent-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 16px;
}
.recent-cell:active { background: #F2F2F7; }
.rc-main { flex: 1; border-bottom: 0.5px solid rgba(60,60,67,0.12); padding-bottom: 9px; min-width: 0; }
.recent-cell:last-child .rc-main { border-bottom: none; }
.rc-name { font: var(--text-body); color: var(--label); }
.rc-name.missed { color: var(--ios-red); }
.rc-sub {
  font: var(--text-footnote);
  color: var(--label-secondary);
  display: flex;
  align-items: center;
  margin-top: 1px;
}
.rc-time { font: var(--text-footnote); color: var(--label-secondary); }

/* 通讯录 */
.contact-cell {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
}
.contact-cell:active { background: #F2F2F7; }
.ct-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: #fff;
  font: 500 16px/1 var(--font-stack);
  display: flex;
  align-items: center;
  justify-content: center;
}
.ct-name {
  flex: 1;
  font: var(--text-body);
  color: var(--label);
  border-bottom: 0.5px solid rgba(60,60,67,0.12);
  padding-bottom: 10px;
}
.contact-cell:last-child .ct-name { border-bottom: none; }

/* 拨号键盘 */
.keypad-body {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding-bottom: 12px;
}
.number-display {
  text-align: center;
  font: 300 34px/1.2 var(--font-stack);
  color: var(--label);
  letter-spacing: 1px;
  font-variant-numeric: tabular-nums;
  min-height: 44px;
  margin-bottom: 14px;
}
.keypad-grid {
  display: grid;
  grid-template-columns: repeat(3, 76px);
  gap: 14px 20px;
  justify-content: center;
}
.key {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: #E9E9EB;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: background 0.1s ease, transform 0.1s ease;
}
.key:active { background: #C7C7CC; transform: scale(0.95); }
.key-num { font: 400 30px/1 var(--font-stack); color: var(--label); }
.key-letters {
  font: 600 9px/1.2 var(--font-stack);
  color: var(--label-secondary);
  letter-spacing: 1.5px;
  margin-top: 1px;
}
.keypad-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 40px;
  margin-top: 14px;
}
.ka-placeholder { width: 48px; }
.call-btn {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: #C7C7CC;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, transform 0.1s ease;
}
.call-btn.ready { background: var(--ios-green); }
.call-btn.ready:active { transform: scale(0.92); }
.backspace {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Tab 栏 */
.tab-bar {
  flex: none;
  display: flex;
  height: calc(var(--safe-bottom) + 49px);
  padding-bottom: var(--safe-bottom);
  background: rgba(248, 248, 250, 0.9);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-top: 0.5px solid rgba(60, 60, 67, 0.14);
}
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font: 500 10px/1 var(--font-stack);
  color: var(--ios-gray);
}
.tab-item.active { color: var(--ios-blue); }

/* 呼叫中 */
.calling-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: linear-gradient(180deg, #2c2c2e 0%, #1c1c1e 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 140px;
  color: #fff;
}
.co-avatar {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: #48484d;
  font: 400 36px/1 var(--font-stack);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}
.co-number { font: 300 30px/1.2 var(--font-stack); letter-spacing: 1px; }
.co-status {
  font: var(--text-callout);
  color: rgba(255, 255, 255, 0.65);
  margin-top: 8px;
  animation: breathe 1.6s ease-in-out infinite;
}
@keyframes breathe { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
.co-end {
  position: absolute;
  bottom: 90px;
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: var(--ios-red);
  display: flex;
  align-items: center;
  justify-content: center;
}
.co-end:active { transform: scale(0.92); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
