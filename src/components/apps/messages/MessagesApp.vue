<script setup>
import { computed, nextTick, ref } from 'vue'
import AppNavBar from '../../ui/AppNavBar.vue'
import { GLYPHS } from '../../../assets/icons/glyphs'
import { useNotificationsStore } from '../../../stores/notificationsStore'
import { useBackHandler } from '../../../composables/backRegistry'

/**
 * 信息：会话列表 → 对话页（气泡流 + 输入栏发送 + 预置回复脚本）。
 */
const props = defineProps({ app: Object })
const notifications = useNotificationsStore()

const CONTACTS = [
  {
    id: 'chenjing', name: '陈静', color: '#5AC8FA', time: '23:44',
    preview: '明天评审会的资料我发你邮箱了，记得看一下 📮', unread: 1,
    messages: [
      { from: 'them', text: 'Ricky，明天下午评审会的议程定了', time: '23:40' },
      { from: 'them', text: '先发你过目一下？', time: '23:41' },
      { from: 'me', text: '好，发我吧，我路上看', time: '23:42' },
      { from: 'them', text: '明天评审会的资料我发你邮箱了，记得看一下 📮', time: '23:44' }
    ],
    replies: ['收到 👌', '没问题，我明天提前到', '好，那就这么定']
  },
  {
    id: 'team', name: '产品一群', color: '#34C759', time: '23:29',
    preview: 'Leo：新版原型出了吗？下午想过一遍', unread: 2,
    messages: [
      { from: 'them', text: '各位，这版交互走查啥时候开始？', time: '23:25' },
      { from: 'them', text: 'Leo：新版原型出了吗？下午想过一遍', time: '23:29' }
    ],
    replies: ['Leo：👍', 'Leo：那我拉个会']
  },
  {
    id: 'wanggong', name: '王工', color: '#FF9500', time: '22:10',
    preview: '接口文档我更新到 iWiki 了', unread: 0,
    messages: [
      { from: 'them', text: '接口文档我更新到 iWiki 了', time: '22:10' },
      { from: 'me', text: '收到，我下午看', time: '22:15' }
    ],
    replies: ['好的']
  },
  {
    id: 'mom', name: '妈妈', color: '#FF2D55', time: '20:03',
    preview: '周末回家吃饭吗？', unread: 0,
    messages: [
      { from: 'them', text: '周末回家吃饭吗？', time: '20:03' },
      { from: 'me', text: '回的，周六中午到', time: '20:20' }
    ],
    replies: ['好，给你做糖醋排骨']
  }
]

const stack = ref(['list'])
const activeId = ref(null)
const view = computed(() => stack.value[stack.value.length - 1])
const activeContact = computed(() => CONTACTS.find((c) => c.id === activeId.value))

function openChat(c) {
  activeId.value = c.id
  c.unread = 0
  // 清除该应用角标
  notifications.list = notifications.list.filter((n) => !(n.appId === 'messages' && n.title === c.name))
  stack.value.push('chat')
}
function pop() { if (stack.value.length > 1) stack.value.pop() }

/* 全局侧滑返回：对话页 → 会话列表（消费），列表页 → 交还系统回桌面 */
useBackHandler(() => {
  if (stack.value.length > 1) { pop(); return true }
  return false
})

/* 对话页：发送 + 预置回复 */
const draft = ref('')
const chatBodyRef = ref(null)

async function scrollToBottom() {
  await nextTick()
  const el = chatBodyRef.value
  if (el) el.scrollTop = el.scrollHeight
}

function send() {
  const text = draft.value.trim()
  if (!text || !activeContact.value) return
  const c = activeContact.value
  c.messages.push({ from: 'me', text, time: now() })
  draft.value = ''
  scrollToBottom()
  // 预置回复脚本
  setTimeout(() => {
    const reply = c.replies[Math.floor(Math.random() * c.replies.length)]
    c.messages.push({ from: 'them', text: reply, time: now() })
    scrollToBottom()
  }, 1100)
}

function now() {
  const d = new Date()
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function openChatAndScroll(c) {
  openChat(c)
  setTimeout(scrollToBottom, 60)
}

/** 连续同侧气泡的圆角处理（iOS：同侧相邻气泡贴合角 4px） */
function bubbleClass(m, i, msgs) {
  const prev = msgs[i - 1]
  const next = msgs[i + 1]
  const samePrev = prev && prev.from === m.from
  const sameNext = next && next.from === m.from
  return {
    bubble: true,
    me: m.from === 'me',
    them: m.from === 'them',
    'has-prev': samePrev,
    'has-next': sameNext
  }
}
</script>

<template>
  <div class="messages-app">
    <Transition :name="view === 'list' ? 'slide-back' : 'slide'" mode="out-in">
      <!-- ============ 会话列表 ============ -->
      <div v-if="view === 'list'" key="list" class="msg-page scrollable">
        <div class="list-header">
          <div class="large-title">信息</div>
          <button class="edit-btn">编辑</button>
        </div>
        <div class="conversation-list">
          <div
            v-for="c in CONTACTS"
            :key="c.id"
            class="conversation-cell"
            @click="openChatAndScroll(c)"
          >
            <div class="cc-avatar" :style="{ background: c.color }">{{ c.name.slice(0, 1) }}</div>
            <div class="cc-main">
              <div class="cc-top">
                <span class="cc-name">{{ c.name }}</span>
                <span class="cc-time">{{ c.time }}</span>
              </div>
              <div class="cc-preview">{{ c.preview }}</div>
            </div>
            <span v-if="c.unread" class="cc-badge">{{ c.unread }}</span>
            <svg class="cc-chevron" width="8" height="13" viewBox="0 0 8 13">
              <path d="M1 1l6 5.5L1 12" fill="none" stroke="#C7C7CC" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      <!-- ============ 对话页 ============ -->
      <div v-else key="chat" class="msg-page chat-page">
        <AppNavBar :title="activeContact?.name" back-label="信息" @back="pop">
          <template #right>
            <div class="chat-avatar" :style="{ background: activeContact?.color }">
              {{ activeContact?.name.slice(0, 1) }}
            </div>
          </template>
        </AppNavBar>

        <div ref="chatBodyRef" class="chat-body scrollable">
          <div class="chat-time-sep">今天 {{ activeContact?.time }}</div>
          <div
            v-for="(m, i) in activeContact?.messages"
            :key="i"
            class="bubble-row"
            :class="m.from"
          >
            <div :class="bubbleClass(m, i, activeContact.messages)">{{ m.text }}</div>
          </div>
        </div>

        <div class="chat-input-bar">
          <button class="ci-plus">
            <svg width="20" height="20" viewBox="0 0 24 24"><path :d="GLYPHS.plus" fill="#8E8E93" /></svg>
          </button>
          <div class="ci-field">
            <input
              v-model="draft"
              placeholder="iMessage 信息"
              @keyup.enter="send"
            />
          </div>
          <button class="ci-send" :class="{ ready: draft.trim() }" @click="send">
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M12 4l7 7-1.4 1.4L13 7.8V20h-2V7.8l-4.6 4.6L5 11l7-7z" fill="#fff" />
            </svg>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.messages-app {
  height: 100%;
  background: #fff;
  overflow: hidden;
}
.msg-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.slide-enter-active, .slide-leave-active,
.slide-back-enter-active, .slide-back-leave-active {
  transition: transform 0.32s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.32s ease;
}
.slide-enter-from { transform: translateX(100%); }
.slide-leave-to { transform: translateX(-28%); opacity: 0.7; }
.slide-back-enter-from { transform: translateX(-28%); opacity: 0.7; }
.slide-back-leave-to { transform: translateX(100%); }

/* 列表 */
.list-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: calc(var(--safe-top) + 18px) 20px 10px;
  flex: none;
}
.large-title { font: var(--text-large-title); color: var(--label); }
.edit-btn { color: var(--ios-blue); font: var(--text-body); }

.conversation-list { flex: 1; }
.conversation-cell {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px 16px 10px 14px;
  cursor: pointer;
}
.conversation-cell:active { background: #F2F2F7; }
.cc-avatar {
  flex: none;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  color: #fff;
  font: 500 19px/1 var(--font-stack);
  display: flex;
  align-items: center;
  justify-content: center;
}
.cc-main {
  flex: 1;
  min-width: 0;
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.12);
  padding-bottom: 10px;
}
.conversation-cell:last-child .cc-main { border-bottom: none; }
.cc-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.cc-name { font: var(--text-headline); color: var(--label); }
.cc-time { font: var(--text-footnote); color: var(--label-secondary); }
.cc-preview {
  font: var(--text-subhead);
  color: var(--label-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}
.cc-badge {
  flex: none;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  background: var(--ios-red);
  color: #fff;
  font: 600 12px/20px var(--font-stack);
  text-align: center;
  padding: 0 5px;
}
.cc-chevron { flex: none; }

/* 对话页 */
.chat-page { background: #fff; }
.chat-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  color: #fff;
  font: 500 13px/1 var(--font-stack);
  display: flex;
  align-items: center;
  justify-content: center;
}
.chat-body {
  flex: 1;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.chat-time-sep {
  text-align: center;
  font: var(--text-caption);
  color: var(--label-secondary);
  margin: 8px 0 12px;
}
.bubble-row { display: flex; }
.bubble-row.me { justify-content: flex-end; }
.bubble {
  max-width: 72%;
  padding: 8px 13px;
  border-radius: 18px;
  font: var(--text-body);
  line-height: 1.38;
  animation: bubble-in 0.24s cubic-bezier(0.3, 0.9, 0.35, 1.1);
}
@keyframes bubble-in {
  from { opacity: 0; transform: scale(0.85) translateY(6px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.bubble.me {
  background: var(--ios-blue);
  color: #fff;
}
.bubble.them {
  background: var(--bg-bubble-in);
  color: var(--label);
}
.bubble.me.has-prev { border-top-right-radius: 4px; }
.bubble.me.has-next { border-bottom-right-radius: 4px; }
.bubble.them.has-prev { border-top-left-radius: 4px; }
.bubble.them.has-next { border-bottom-left-radius: 4px; }

/* 输入栏 */
.chat-input-bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px calc(var(--safe-bottom) + 6px);
  background: rgba(248, 248, 250, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 0.5px solid rgba(60, 60, 67, 0.14);
}
.ci-plus {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #E9E9EB;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.ci-field {
  flex: 1;
  height: 34px;
  border: 1px solid #D1D1D6;
  border-radius: 17px;
  padding: 0 13px;
  display: flex;
  align-items: center;
  background: #fff;
}
.ci-field input {
  width: 100%;
  font: var(--text-body);
  color: var(--label);
}
.ci-field input::placeholder { color: var(--label-tertiary); }
.ci-send {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #C7C7CC;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  transition: background 0.18s ease, transform 0.12s ease;
}
.ci-send.ready { background: var(--ios-blue); }
.ci-send.ready:active { transform: scale(0.88); }
</style>
