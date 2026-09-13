<script setup>
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { getApp } from '../../config/apps'
import { appComponents } from '../apps/registry'
import PlaceholderApp from '../apps/PlaceholderApp.vue'
import AppIcon from '../ui/AppIcon.vue'
import GlassCircleButton from '../ui/GlassCircleButton.vue'
import { useSystemStore } from '../../stores/systemStore'
import { useI18nStore } from '../../stores/i18nStore'
import { useSpring } from '../../composables/useSpring'
import { screenRef } from '../../utils/screenRef'
import {
  DECK,
  deckClampFocus,
  deckMetrics,
  deckPhase,
  deckPose,
  deckZ,
  deckVisible
} from '../../utils/switcherDeck'

/**
 * 最近任务切换器（App Switcher / Recent）—— 固定层级堆叠（不是 Coverflow）。
 *
 * Ricky 2026-09-12 七条硬规则，几何全部落在 src/utils/switcherDeck.js（纯函数 + 单测）：
 *   ① 层级关系不变：z 只由列表索引 i 决定（z = 10000 - i），永不随焦点变 →
 *      「顶层的卡片一直到滑动到屏幕外都要在顶层」。旧版 z 跟着「距焦点远近」算，
 *      拖到一半时顶层卡会被下面的卡盖住（他原话：最顶部的卡片还能跑到下面去）。
 *   ② 下层卡片缩小后藏在上层卡片下方：transform-origin: 0 0（左边缘钉住）+ 按层 0.94^k 缩小。
 *   ③ 左侧边缘不出屏：最深层的左边缘 = 77.5 - 61.1 = 16.4px &gt; 0（单测守这条不变量）。
 *   ④ 底层阶梯式缩小、露出越来越少：stair(k) 几何级数 → 露出 52 / 17 / 5 px。
 *   ⑤ 同时最多四层：焦点层 + 3 层背景，第 5 张起不渲染。
 *   ⑥ 间距随滑动距离动态变化：层深连续推进 aEff = a + (x − u)，两端与整层深重合。
 *      第六轮把 u 的指数从 1.6 改成 1 —— 整条链从拖动第一帧起就与手指同速推进。
 *   ⑦ 「同样滑动距离顶层移动距离 8:3:2:1」——**第六轮作废**（Ricky 原话：「忘记我之前
 *      定死的什么 8:3:2:1 移动比例规则，还是你自己算吧」）。改为逐帧量测参考视频得到的两条
 *      实测约束：① 新来卡每滑一张右移 ≈ 0.19 卡宽（52px）；② 离场卡每滑一张右移
 *      = 一张卡的手指行程（234px，1:1 跟手）并停在右屏边内侧露出 ≈119px（实测量 272px / 96px）。
 *      第五轮曾用「牵连包络」把比例做成 8:3:2:1 并让两卡贴合，代价是必然回退（实测 77px）；
 *      第六轮改从【槽位间距】下手 —— 不引入任何会归零的包络，所以零回退与「连锁感」同时拿到。
 *
 * 参考实现：SoxiaLiSA/StackSwipe（MIT，Kotlin）——固定 zIndex、几何级数露边、
 * 阻尼橡皮筋、投影吸附。它没有缩放堆叠与 8:3:2:1，那两块是本项目自研。
 *
 * ── 2026-09-12 第三轮：Ricky 提交参考视频后的四条修正（详见 switcherDeck.js 顶部）──
 *   A. 卡片整体下移 → 不再用固定 Y_FRAC，改为「图标行 + 卡片」整体垂直居中于
 *      [状态栏底(--safe-top), 删除按钮顶]（实测锚点：54 / 840，gap = 77）。
 *   B. 背景层不再上浮 → 删除 Y_STEP_FRAC，y = cardCy - cardH·scale/2，
 *      所有层共用同一垂直中心。
 *   C. 图标 18 → 24px、字号 14 → 16px，并纳入整体居中的 blockH。
 *   D. 横滑动效：ios-deck 由 ζ=1.0 临界阻尼改为 ζ=0.65（τ 仍 ≈110ms，带 6.7% 过冲）；
 *      扇开包络松手时交给弹簧衰减（不再硬置零 → 消除背景层硬跳变）；
 *      拖动灵敏度 0.60 → 0.85 卡宽/张（对齐参考实测 0.87）。
 *
 * 动效：
 *   进入    HomeIndicator 停驻手势驱动 switcherProgress 0→1，前台应用围绕【屏幕中心】
 *           连续缩到卡位（跟手，逐帧直写无 transition）；进度用原始位移换算，
 *           越过满量程继续无极变小但不淡出；松手弹簧回到固定终点。
 *   浏览    横滑：手往右拖 → focus 增大 → 全部卡片往右走；焦点卡走幂律斜坡退出屏幕
 *           （起步接近 1:1 跟手、末段加速），背景层走阶梯 + 扇开。松手弹簧吸附到整卡。
 *   交接    跟手卡落位后由同位姿的堆叠前卡接管（几何逐像素相等，无跳变）。
 *
 * 预览实例通过 provide('appPreview') 与全局隔离（backRegistry 不注册返回处理器）。
 */

const system = useSystemStore()
const i18n = useI18nStore()
provide('appPreview', true)

/* 卡片左上角标签的位置：true = 卡内左上角，false = 卡顶上方左侧（iOS 观感） */
const LABEL_INSIDE = false

const rootRef = ref(null)
const screenW = ref(0)
const screenH = ref(0)
/* 布局锚点（修正 A）：「图标行 + 卡片」整体垂直居中于 [状态栏底, 删除按钮顶]。
   两者都从 CSS 变量读，避免与 StatusBar / .switcher-dock 的样式脱钩。 */
const safeTop = ref(0)
const homeInset = ref(DECK.DEFAULT_HOME_INSET)

/**
 * 屏幕尺寸 —— 必须早于「跟手卡/堆叠卡」的首次渲染就绪。
 *
 * 历史 bug（2026-09-12 修复）：旧实现只在切换器自己的 pointerdown 或 openSwitcher
 * 之后才 measure()，而进入手势发生在 HomeIndicator 上（它不会把 pointerdown 冒泡给
 * 切换器），于是整段手势里 screenW = 0 →
 *   ① 跟手卡 width/height = 0 → 前台应用预览整段消失（不是「跟手缩小」）；
 *   ② 堆叠卡出生在 (0,0) 全亮，再靠 0.24s transition 滑到槽位（邻居卡从左飞入）。
 * 现改为：挂载即从 ScreenView 的 .screen 元素同步量（它先于本组件存在），
 * 并用 ResizeObserver 跟随，保证任何时刻几何都是对的。
 */
function measure() {
  const el = rootRef.value || screenRef.el
  if (!el) return
  const w = el.offsetWidth
  const h = el.offsetHeight
  if (w && w !== screenW.value) screenW.value = w
  if (h && h !== screenH.value) screenH.value = h
  /* 锚点：状态栏高度（--safe-top）与底部安全区（--home-indicator-inset） */
  const cs = getComputedStyle(el)
  const st = parseFloat(cs.getPropertyValue('--safe-top'))
  if (Number.isFinite(st) && st > 0 && st !== safeTop.value) safeTop.value = st
  const hi = parseFloat(cs.getPropertyValue('--home-indicator-inset'))
  if (Number.isFinite(hi) && hi !== homeInset.value) homeInset.value = hi
}

let ro = null

/* ---- 几何：全部来自纯函数模块（可单测）---- */
const metrics = computed(() =>
  deckMetrics(screenW.value, screenH.value, {
    topInset: safeTop.value > 0 ? safeTop.value : undefined,
    homeInset: homeInset.value
  })
)
const cardW = computed(() => metrics.value.cardW)
const cardH = computed(() => metrics.value.cardH)
const RADIUS = computed(() => metrics.value.radius)
const previewScale = computed(() => metrics.value.previewScale)

/* ---- 内部 z 层级 ----
   .app-switcher 自带层叠上下文，内部只须自洽。
   堆叠卡 z = deckZ(i) = 10000 - i（固定，规则①）；chrome 永远压在最上。 */
const Z_FOLLOW = 12000 // 跟手缩放卡（进场中，压在堆叠卡上）
const Z_EXPAND = 13000 // 点卡片恢复的放大卡
const Z_CHROME = 14000 // 底部垃圾桶

/* ---- 焦点（小数，单位=张），spring 驱动 —— 丝滑的来源 ---- */
const { value: focus, animateTo: focusTo, snapTo: focusSnap } = useSpring(0, 'ios-gentle')
/* 进场进度弹簧：手势交接的 switcherProgress（~0.8）连续推到 1 */
const { value: openP, animateTo: openTo, snapTo: openSnap, stop: openStop } = useSpring(1, 'ios-gentle')
watch(openP, (v) => system.setSwitcherProgress(v))
const apps = computed(() => system.recentApps)
const frontIndex = computed(() => {
  const i = apps.value.indexOf(system.activeAppId)
  return i < 0 ? 0 : i
})

/* 可见性。
 * 第五轮新增 linger：「桌面路径取消上滑」时进度会瞬间归零，若立刻卸载会让已经升到
 * 一半的卡片「啪」地消失。这里在归零后多留 340ms，让 CSS 收场过渡播完再卸载。 */
const linger = ref(false)
let lingerTimer = null
const visible = computed(() => system.appSwitcherOpen || system.switcherProgress > 0 || linger.value)

watch(
  () => system.switcherProgress,
  (p, prev) => {
    if (system.activeAppId || system.appSwitcherOpen) return
    if (p > 0.001) {
      clearTimeout(lingerTimer)
      linger.value = true
      return
    }
    if (prev > 0.02) {
      clearTimeout(lingerTimer)
      lingerTimer = setTimeout(() => { linger.value = false }, 340)
    }
  }
)

/* ---- 桌面路径的入场反馈（第五轮）----
   问题：桌面（无前台应用）上滑时，deck 只在 appSwitcherOpen 之后才渲染，而桌面又没有
   跟手卡 → 屏幕上【一张卡都没有】，只剩一层黑遮罩。Ricky 的原话是「手感非常差」。
   修法：手势期间就把 deck 渲染出来，入场进度直接跟随 switcherProgress ——
   上滑多少、卡片就升多少（自下方 30% 处上浮 + 淡入）。 */
const homeEntranceP = computed(() =>
  system.activeAppId ? 0 : Math.min(1, system.switcherProgress)
)
/** 桌面路径 = 没有前台应用。入场自下方上浮、取消时原路下沉（方向必须一致，
 *  否则「取消」会变成卡片往上被吸走）。注意它不依赖 appSwitcherOpen ——
 *  手势进行中的那一段也必须是真值，退场才沉得下去。 */
const deskPath = computed(() => !system.activeAppId)
/** 桌面手势进行中（此时背景卡需要逐帧跟手，必须关掉 CSS 过渡） */
const homeEntranceFollowing = computed(
  () => deskPath.value && !system.appSwitcherOpen && system.switcherProgress > 0
)
/** deck 的渲染条件。
 *  第五轮补：桌面路径不能只认「手势进行中」—— 松手取消那一瞬间进度归零，若立刻卸载，
 *  卡片就是【瞬间消失】，既没有下沉也来不及淡出（实测 45ms 内 deck=0）。
 *  所以桌面路径改为「只要本组件还在场（visible，含 linger 的 340ms 退场缓冲）就渲染」，
 *  让 stackStyle 的收场分支能把「原路下沉 + 淡出」播完。 */
/* 停驻预提交（第七轮·批次 2，需求⑫）——
   「应用内卡片上滑进入多任务，需要跟随滑动方向跟手移动，**停留超过一定时间时左侧卡片进场**，
     松手后丝滑归位」（Ricky 2026-09-13，参考视频 981c9428…mp4 逐帧量测）。

   逐帧事实（v12 参考视频 444×960 / 24fps / 346 帧，/tmp/vwork/v12measure.py）：
     f52–f65  跟手上滑，前台应用自全屏连续缩到卡位（卡顶 y 95 → 119）
     f66–f102 **停驻 1.5s**：仍是【单张】跟手卡，左侧邻居【没有】出现
     f103–f116 左侧邻居「微信」自左侧滑入 + 前卡落位 → 整套 deck 就位
   也就是说参考实现里「左侧卡片进场」发生在**手指仍按住**的那段时间里，
   而本项目旧实现只在 appSwitcherOpen（= 松手）那一帧把整套 deck 一次性铺出来
   （探针实测：松手 +0ms deck=3 三张卡已经在终点位）→ 卡片的「闪一下」（需求③ 同源）。

   修法：`system.switcherDwell`（HomeIndicator 判定「上滑 >5% 后停住 120ms」）一旦成立，
   在【松手之前】就把邻居卡编排进场：
     · renderDeck 放行 → 堆叠卡挂载（先以 opacity 0 / 左移 36px 的「待进场」态渲染一帧）
     · 下一帧 neighborsIn = true → 靠 CSS 过渡（0.32s 弹簧曲线 + 0.22s 透明度）滑入淡入
     · hasFollow = true → 堆叠【前卡】仍由跟手卡顶替（opacity 0），避免与跟手卡双重曝光
   松手时 openSwitcher 走原路径（openSnap → openTo(1)）：邻居已经就位，只有跟手卡
   继续弹簧落到 C 槽位再交接 → 零闪断。 */
const preCommit = ref(false)
/** 邻居卡「待进场」态的水平偏移：自左侧滑入（仅应用内停驻路径使用） */
const NEIGHBOR_ENTER_DX = 36

const renderDeck = computed(
  () => system.appSwitcherOpen || preCommit.value || (deskPath.value && visible.value)
)
/** 桌面路径的【退场窗口】：进度已归零、靠 linger 撑着的那 340ms。
 *  只在这个窗口里给遮罩开透明度过渡 —— 跟手期绝不能开（逐帧直写会被二次低通成滞后），
 *  应用内上滑那条路径也绝不能开（同一原因），所以判据必须精确到「正在退场」。 */
const homeRetreat = computed(
  () =>
    deskPath.value &&
    !system.appSwitcherOpen &&
    visible.value &&
    system.switcherProgress <= 0.001
)
/* 桌面入场：卡片自下方【屏幕高度 30%】处上浮 + 淡入（e = 进度，逐帧跟手） */
const ENTRANCE_RISE_FRAC = 0.3

/* ---- 层过渡进度（第四轮）----
   顶卡退出与背景层推进共用【同一个进度】（详见 switcherDeck.js 头部「定律一」）。
   旧实现背景层用原始焦点小数 x、顶卡用 x^EXIT_POW —— 背景层抢跑，把「向中间的
   位移 + 放大」提前做完，观感就是 Ricky 说的「底层卡片先做向中间位移放大的动画」。
   现在统一由 deckPhase 给出 u，deckPose 内部把背景层的连续层深折算成 a + (x − u)，
   两端与原始层深重合 → 层边界零跳变、不需要额外的扇开弹簧。 */
const phase = computed(() => deckPhase(focus.value))
const xFrac = computed(() => phase.value.x)

/* 焦点弹簧动画期间关闭 CSS transition —— 否则逐帧推进的 spring 会被 0.24s 过渡
   二次低通，松手后的吸附变成「慢慢飘过去」，没有弹簧的干脆手感。 */
const focusMoving = ref(false)
function focusToIndex(idx, opts = {}) {
  focusMoving.value = true
  focusTo(idx, { preset: 'ios-deck', ...opts, onDone: () => { focusMoving.value = false } })
}

/* 邻居进场编排：
   - 手势路径：开关打开瞬间即「已在槽位」（藏在前卡后面，前卡缩小自然露出），无滑入；
   - 桌面路径：下一帧起自下方上浮，逐张 60ms 错峰（参考视频入场）。 */
const neighborsIn = ref(false)
const entranceDone = ref(false)
const homePath = ref(false)
const hasFollow = ref(false)
let dwellTimer = null
let settleTimer = null

function markEntrance() {
  clearTimeout(settleTimer)
  settleTimer = setTimeout(() => { entranceDone.value = true }, apps.value.length * 60 + 320)
}

watch(
  () => system.appSwitcherOpen,
  (open) => {
    clearTimeout(dwellTimer)
    clearTimeout(settleTimer)
    if (!open) {
      /* 关闭时必须【停掉进场弹簧 + 进度归零】。
         历史 bug（2026-09-12 修复）：resumeApp/dismissAll 只置 appSwitcherOpen=false，
         而 openP 已停在 1 且 watch(openP) 会把进度写回 1 → visible 恒为 true →
         遮罩（含 backdrop-filter 模糊）永久糊在屏幕上，切回应用后整屏发虚。 */
      openStop()
      system.setSwitcherProgress(0)
      system.switcherDwell = false
      neighborsIn.value = false
      entranceDone.value = false
      homePath.value = false
      hasFollow.value = false
      preCommit.value = false
      return
    }
    /* 同步编排（不放到 nextTick）：邻居卡要和开关置位在同一帧就带上目标样式，
       否则会先以 opacity 0 渲染一帧、再补 0.2s 淡入。measure() 走 .screen 兜底，
       不依赖本组件 dom 是否已挂载。 */
    measure()
    focusSnap(frontIndex.value)
    homePath.value = !system.activeAppId
    /* 跟手卡是否正在顶替堆叠前卡。
       第七轮修正：旧判据 `switcherProgress < 1` 在【上滑越过满量程】（进度 >1，
       卡片按 0.55^(p-1) 继续缩小到比 C 槽位还小）时会翻成 false → 堆叠前卡
       （C 槽位尺寸）在跟手卡下面露出来 = 双重曝光。改为只看「有没有跟手卡」
       （进度 >0 且尚未交接完成），与 followStyle 的存续条件严格一致。 */
    hasFollow.value = !!system.activeAppId && system.switcherProgress > 0
    if (homePath.value) {
      /* 桌面路径（无前台应用可缩放）。两种来法必须分开处理：
         ① 手势停驻激活 —— 卡片此刻【已经在屏上跟手入场中】（进度 >0），
            直接让它就位即可；若还去播「自下方上浮」会先跳回屏幕下方再升起，很怪。
         ② 直开（调试 / 程序化）—— 卡片尚未在场，走 60ms 后错峰上浮的入场编排。 */
      const wasFollowing = system.switcherProgress > 0.02
      system.setSwitcherProgress(1)
      openSnap(1)
      if (wasFollowing) {
        neighborsIn.value = true
        entranceDone.value = true
        return
      }
      dwellTimer = setTimeout(() => { neighborsIn.value = true; markEntrance() }, 60)
      return
    }
    // 手势路径：进度从交接点连续推到 1（不论小于还是【大于】1 —— 手指越过满量程时
    // 交接进度会 >1，必须双向都能弹回固定终点，否则跟手卡永远压在堆叠卡上、切换器卡死）；
    // 邻居卡立即就位（不滑入、不淡入）
    openSnap(system.switcherProgress)
    openTo(1)
    neighborsIn.value = true
    entranceDone.value = true
  },
  { immediate: true }
)

/* ---- 停驻 → 邻居卡提前进场（第七轮·批次 2，需求⑫）----
   见 preCommit 的注释。触发源用 HomeIndicator 已经算好的 `system.switcherDwell`
   （「上滑 >5% 后停住 120ms」），不新起一个计时器 —— 否则「松手能否进多任务」与
   「邻居卡什么时候进场」会变成两套阈值，早晚不一致。

   只在【应用内上滑】这条路径 + 切换器尚未打开时生效：
     · 桌面路径本来就在手势期渲染 deck（homeEntranceFollowing 自下方上浮），
       再叠一层「预提交」会和跟手上浮打架；
     · 切换器已打开时邻居卡早已就位，重复置位会打断交接的错峰编排。 */
watch(
  () => system.switcherDwell,
  (dwell) => {
    if (!dwell || system.appSwitcherOpen || preCommit.value) return
    if (!system.activeAppId) return
    if (system.switcherProgress <= 0.02) return // 上滑量不足，别把 deck 提前铺出来
    measure()
    /* deck 一开始就必须朝向【前台应用】那张卡：焦点默认 0，而前台应用未必是
       recentApps[0]（用户可能是从较早的任务切回来的）。 */
    focusSnap(frontIndex.value)
    /* 堆叠前卡继续由跟手卡顶替（opacity 0）。跟手卡此刻可能比 C 槽位还小
       （上滑越过满量程），不顶替就会在它下面露出第二张卡 = 双重曝光。 */
    hasFollow.value = true
    preCommit.value = true
    // 先让堆叠卡以「待进场」态（opacity 0 + 左移 36px）渲染一帧，下一帧再切目标态 ——
    // 同一帧内挂载 + 切换目标态浏览器不会跑过渡，卡片会「啪」地出现。
    requestAnimationFrame(() => {
      if (!preCommit.value) return
      neighborsIn.value = true
      markEntrance()
    })
  }
)

/* 预提交的撤销：手指重新滑起来时 HomeIndicator 会把 switcherDwell 撤掉，但这里【不】跟着
   立刻收场 —— 微调停留位置时的来回抽动比留在场上更难受。只有上滑量也退掉了
   （进度落到 12% 以下，等价于「这次手势放弃了」）才把邻居卡收回去。 */
watch(
  () => system.switcherProgress,
  (p) => {
    if (!preCommit.value || system.appSwitcherOpen) return
    if (p > 0.12) return
    preCommit.value = false
    neighborsIn.value = false
    hasFollow.value = false
  }
)

/* ---- 位姿：a = i - focus ----
   0 = 焦点层（屏幕正中），1/2/3 = 更早的背景层（向左阶梯 + 缩小 + 变暗），
   负数 = 比焦点更新的卡（向右退出屏幕）。详见 switcherDeck.js。
   第四轮起不再有「扇开弹簧」：位姿完全由 focus（含其小数进度 xFrac）唯一决定 ——
   拖动期逐帧跟手、松手后由 focus 弹簧推进，背景层与顶卡天然同相位。 */
function poseOf(i) {
  return deckPose(i - focus.value, metrics.value, xFrac.value)
}

/* 需要渲染的卡片：离焦点太远的直接剔除（规则⑤ 最多四层）。
   正在移除 / 正在展开的必须保留，否则动画会闪断。 */
const renderedCards = computed(() =>
  apps.value
    .map((id, i) => ({ id, i }))
    .filter(({ id, i }) => id === dismissing.value || id === expanding.value || deckVisible(i - focus.value))
)

/* 标签只跟「离焦点最近的那张」走，避免两张卡同时出现标签 */
const labelIndex = computed(() => {
  const last = Math.max(0, apps.value.length - 1)
  return Math.max(0, Math.min(last, Math.round(focus.value)))
})

/* 卡体（应用预览）的透明度 —— 只在「堆叠前卡被跟手卡顶替」时与卡根不同。
 *
 * 需求③「应用内上滑进入多任务后应用卡片会非常明显的闪一下」的根因在这里：
 *   跟手卡与堆叠前卡在交接那一刻几何逐像素相等（探针实测 follow 宽 274.8 / x 77.6，
 *   front 宽 275 / x 77.5），本可以硬切；但 .switcher-card 上挂着 `opacity 0.22s ease`，
 *   于是「跟手卡卸载」与「前卡 0→1 淡入」不同步 —— 实测前卡从 op 0.065 花 220ms 才变实，
 *   中间那 100ms 屏幕上是一张【半透明的卡】。
 * 解法：把透明度【下沉到卡体】（卡根恒为 1）。
 *   ① 卡体的 opacity 没有任何 CSS 过渡 → 交接那一帧硬切，天然零闪断；
 *   ② 卡根保持 1 → 标签行（卡根的兄弟节点）在【停驻期】就一直在场。
 *      若继续把透明度挂在卡根上，停驻期 C 位的「图标 + 应用名」会整段缺失、到交接那一帧
 *      才突然冒出来（Playwright 截图实测：b2-1-hold 里没有「计算器」标签，b2-2-settled 才有）；
 *      参考视频 981c9428…mp4 的停驻段（f100 / f104）C 位标签是全程在的。
 * 其余路径（桌面入场上浮、上滑移除淡出）的透明度仍挂在卡根 —— 那些场景需要【连标签一起】淡。 */
function bodyOpacityOf(i) {
  return i === frontIndex.value && hasFollow.value && !settledOne.value ? 0 : 1
}

/* 堆叠渲染态：统一的「藏 → 进场」编排，CSS transition 负责丝滑。 */
function stackStyle(i) {
  const p = deckPose(i - focus.value, metrics.value, xFrac.value)
  let x = p.x
  let y = p.y
  let opacity = 1
  let delay = '0ms'
  if (i === frontIndex.value && hasFollow.value) {
    /* 跟手卡顶替中：卡根保持不透明（标签行要一直在），只把【卡体】藏起来 ——
       见 bodyOpacityOf 的注释（透明度下沉到卡体是需求③「闪一下」的正解）。 */
    opacity = 1
  } else if (homeEntranceFollowing.value) {
    /* 桌面手势进行中（第五轮新增）：卡片自下方 30% 处【跟手】上浮 ——
       上滑多少就升多少、同时亮多少（e = 进度）。逐帧直写：无 delay、无过渡。
       修的是 Ricky 的原话「先从桌面上滑的手感非常差，很难激活多任务」——
       此前这段路上屏幕上【一张卡都没有】，只剩一层黑遮罩，等于盲滑。 */
    const e = homeEntranceP.value
    opacity = e
    y += screenH.value * ENTRANCE_RISE_FRAC * (1 - e)
    delay = '0ms'
  } else if (!neighborsIn.value) {
    /* 桌面路径的收场态：藏在下方 30% 处。
       - 直开进场：由 CSS 过渡上浮（60ms 错峰）；
       - 手势取消：进度归零后落到这里 → 卡片原路【下沉】淡出（方向与入场一致）。 */
    opacity = 0
    if (deskPath.value) y += screenH.value * ENTRANCE_RISE_FRAC
    /* 应用内停驻预提交的「待进场」态：自左侧 36px 处滑入（需求⑫「左侧卡片进场」）。
       只在 preCommit 这一条路径上偏移 —— 其余路径的入场姿态各有各的语义，不能串味。 */
    else if (preCommit.value) x -= NEIGHBOR_ENTER_DX
    delay = entranceDone.value ? '0ms' : `${i * 60}ms`
  }

  /* 上滑移除跟手（第七轮·批次 2，需求⑧）——
     Ricky 原话：「上滑删除卡片时，卡片未跟手上滑移动」。
     旧实现在 onPointerMove 里对 v 模式直接 return，整段手势卡片零位移，
     只有松手越过 110px 才「啪」地飞出去；现在被按住的那张卡实时跟随手指的纵向位移，
     并随高度线性变淡（上滑越远越淡），松手时：过阈值 → 从当前位置直接飞出；
     未过阈值 → 靠 CSS 过渡弹回原位（drag 置空即恢复过渡，见 .is-dragging 规则）。

     vLetGo 是「松手后仍沿用一帧拖动态位姿」的接力棒：`.is-dragging` 摘掉的那一帧
     浏览器才认得 transition，若同帧就把 transform 改成目标值，before-change style 里
     transition 还是 none → 卡片瞬移，跟手的那段位移全白做。 */
  const vOff = drag.value?.mode === 'v' ? drag.value : vLetGo.value
  if (vOff && vOff.cardId === apps.value[i]) {
    const ddy = Math.min(0, vOff.dy)
    y += ddy
    opacity = Math.min(opacity, Math.max(0, 1 + ddy / 320))
    delay = '0ms'
  }

  return {
    width: cardW.value + 'px',
    height: cardH.value + 'px',
    transform: `translate3d(${x}px, ${y}px, 0) scale(${p.scale})`,
    filter: `brightness(${p.bright})`,
    zIndex: deckZ(i),
    borderRadius: RADIUS.value + 'px',
    opacity,
    transitionDelay: delay
  }
}

/** 卡片左上角标签（图标 + 名称）的位置 —— 见 LABEL_INSIDE 开关。
 *  卡外上方时 top = -(图标行高 + 间隙)，这两个值与 deckMetrics 的 LABEL_ROW_H/LABEL_GAP
 *  同源（修正 C：图标 18 → 24px，行高与间隙一起纳入「整体居中」的 blockH 计算）。 */
function labelStyle() {
  return LABEL_INSIDE
    ? { top: '10px', left: '12px' }
    : { top: -(DECK.LABEL_ROW_H + DECK.LABEL_GAP) + 'px', left: '0px' }
}

/* 交接判定：进场进度到位（跟手卡与前卡槽位几何重合）后交给堆叠前卡 */
const settledOne = computed(
  () => openP.value >= 0.999 && system.switcherProgress >= 0.999 && system.switcherProgress <= 1.001
)

/* ---- 跟手缩放（Ricky 2026-09-12 纠正）----
   ① 锚点 = 落点 = 【屏幕中心】：卡片原地缩小，全程不左右漂；
   ② 缩放严格跟随手指的上滑位移做【无极】变化 —— 上滑越远缩得越小，
      越过满量程（260px）之后继续按指数曲线变小；
   ③ 【绝不淡出】：卡片缩小但不允许「缩到不见」，并留一个可见下限兜底；
   ④ 松手后由弹簧回到固定终点（前卡槽位、最终大小）。 */
const MIN_FOLLOW_SCALE = 0.3
const followStyle = computed(() => {
  const p = system.switcherProgress
  if (p <= 0 || settledOne.value) return null
  const idx = frontIndex.value
  const slot = poseOf(idx)
  const slotCx = slot.x + cardW.value / 2
  const slotCy = slot.y + cardH.value / 2
  // p ≤ 1：屏幕中心 → 卡位中心（两者水平上同为屏幕中心，只有纵向在移动）
  const cx = screenW.value / 2 + (slotCx - screenW.value / 2) * Math.min(1, p)
  const cy = screenH.value / 2 + (slotCy - screenH.value / 2) * Math.min(1, p)
  const s =
    p <= 1
      ? 1 + (previewScale.value - 1) * p
      : Math.max(MIN_FOLLOW_SCALE, previewScale.value * Math.pow(0.55, p - 1))
  return {
    width: screenW.value + 'px',
    height: screenH.value + 'px',
    transform: `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%) scale(${s})`,
    borderRadius: (RADIUS.value * Math.min(1, p)) / Math.max(s, 0.01) + 'px',
    opacity: 1,
    zIndex: Z_FOLLOW
  }
})

/* 预览内容缩放：跟手/展开卡的外层 transform 已负责缩放，内容恒为 1；
   堆叠卡 = 卡宽/屏宽（与屏幕同比例缩放，零裁切） */
function contentScale(isFollow) {
  return isFollow ? 1 : previewScale.value
}

/* ---- 底部垃圾桶：进度后段才淡入，避免开场就「啪」地满亮 ---- */
const chromeOpacity = computed(
  () => Math.min(1, Math.max(0, (system.switcherProgress - 0.5) / 0.5))
)

/** 垃圾桶容器距屏幕底的像素（= home inset + DECK.DOCK_GAP）。
 *  第七轮：改成由这里【唯一给出】并内联绑到 :style，CSS 里不再抄一份 gap ——
 *  历史上 CSS 的 26px 与 DECK.DOCK_GAP 是两份副本，改一处必脱钩。 */
const dockBottom = computed(() => homeInset.value + DECK.DOCK_GAP)

function compOf(id) {
  return appComponents[id] || PlaceholderApp
}
function appOf(id) {
  return getApp(id)
}
function nameOf(id) {
  return i18n.appName(id) || getApp(id)?.name || id
}

/* ================= 手势 ================= */

const drag = ref(null)
/** 上滑移除松手后的「位姿接力」：{ cardId, dy }，只存活一帧（见 stackStyle / onPointerUp） */
const vLetGo = ref(null)
const dismissing = ref(null)

/* 速度追踪（环形缓冲 100ms）—— 松手投影用。
   关键：读取时先按【当前时间】剔除过期样本 —— 手指停住 100ms 以上就没有动量了，
   必须返回 0（否则「拖到一半停住再松手」会带着停顿前的旧速度继续翻页）。 */
const vt = []
function vtPush(x, t) {
  vt.push({ x, t })
  while (vt.length > 1 && t - vt[0].t > 100) vt.shift()
}
function vtVelocity(now = performance.now()) {
  while (vt.length > 1 && now - vt[0].t > 100) vt.shift()
  if (vt.length < 2) return 0
  const a = vt[0]
  const b = vt[vt.length - 1]
  const dt = b.t - a.t
  return dt > 0 ? (b.x - a.x) / dt : 0 // px/ms，向右为正
}

function onPointerDown(e) {
  if (dismissing.value) return
  measure()
  vLetGo.value = null
  vt.length = 0
  vtPush(e.clientX, performance.now())
  drag.value = {
    startX: e.clientX,
    startY: e.clientY,
    startFocus: focus.value,
    startT: performance.now(),
    mode: 'pending',
    dx: 0,
    dy: 0,
    cardId: null,
    vPx: 0
  }
  e.currentTarget.setPointerCapture(e.pointerId)
}

function onPointerMove(e) {
  const d = drag.value
  if (!d) return
  const dx = e.clientX - d.startX
  const dy = e.clientY - d.startY
  if (d.mode === 'pending') {
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
    d.mode = Math.abs(dy) > Math.abs(dx) * 1.4 ? (dy < 0 ? 'v' : 'down') : 'h'
    /* 上滑移除：在【模式锁定这一刻】就把拖动对象钉死（用按下点取命中卡）。
       不能等松手再 elementFromPoint —— 拖动期间卡片跟着手指上移、手指也可能滑出卡片
       范围，松手时命中判定会失手（拿到卡片外面的遮罩 → 整次上滑删不掉）。 */
    if (d.mode === 'v') d.cardId = hitCardId({ clientX: d.startX, clientY: d.startY })
  }
  if (d.mode === 'v') {
    /* 上滑移除【跟手】（第七轮·批次 2，需求⑧）：旧代码在这一行直接 return，
       拖动全程卡片零纵向位移 → Ricky 原话「上滑删除卡片时，卡片未跟手上滑移动」。
       这里只记录位移，真正的位姿偏移由 stackStyle 逐帧直写（无过渡 → 严格跟手）。 */
    d.dy = dy
    return
  }
  if (d.mode !== 'h') {
    d.dy = dy
    return
  }
  /* 跟手方向（Ricky 2026-09-12 纠正）：
     堆叠布局是「更早的卡在左、更新的卡在右」，手势要让【手往右拖，卡片也往右走】。
     位姿 x 随 focus 单调增，所以焦点跟手是 startFocus + dx/span（旧代码写成 - dx
     → 手往右拖卡片却往左走）。 */
  d.dx = dx
  vtPush(e.clientX, performance.now())
  d.vPx = vtVelocity()
  focusSnap(deckClampFocus(d.startFocus + dx / metrics.value.span, apps.value.length))
}

function onPointerUp(e) {
  const d = drag.value
  if (!d) return
  drag.value = null
  const dy = e.clientY - d.startY
  // 松手这一刻也采一个速度样本（并剔除 >100ms 的旧样本）→ 停住再松手 = 0 动量
  const tNow = performance.now()
  vtPush(e.clientX, tNow)
  const vFocus = (vtVelocity(tNow) * 1000) / metrics.value.span // 层/秒

  if (d.mode === 'h') {
    /* 松手吸附（参考 StackSwipe：projected = pos + vIndex × 提前量 → 四舍五入）：
       位移过半才翻页；速度只用来「补足」尚未过半的位移 —— 快甩即使只走了 1/3 张也翻页，
       而已经走满一整张的快滑不会额外多翻一张（否则 span=0.85 卡宽的快滑会一次跳两层）。
       提前量偏置钳制在 ±0.4 层，避免高速把判定推得离谱。 */
    const cur = focus.value
    const base = Math.floor(cur)
    const frac = cur - base
    const bias = Math.max(-0.4, Math.min(0.4, vFocus * 0.1))
    const idx0 = base + (frac > 0.5 - bias ? 1 : 0)
    const idx = Math.max(0, Math.min(apps.value.length - 1, idx0))
    focusToIndex(idx, { initialVelocity: Math.max(-6, Math.min(6, vFocus)) })
    return
  }
  if (d.mode === 'v') {
    /* 上滑移除判定：位移过半即飞出（阈值 110px 与旧的松手判据保持一致），
       拖动对象优先取模式锁定时钉下的卡片，取不到再退回松手点的命中判定。

       松手后把「拖动态位姿」再续一帧（vLetGo），下一帧才切目标态 —— 见 stackStyle
       里 vLetGo 的注释：`.is-dragging` 摘掉的那一帧 transition 才生效，同帧改目标值
       会退化成瞬移。 */
    const cardId = d.cardId || hitCardId(e)
    const willDismiss = !!cardId && dy < -110
    vLetGo.value = { cardId: d.cardId, dy: Math.min(0, dy) }
    requestAnimationFrame(() => {
      vLetGo.value = null
      if (willDismiss) dismissWithAnimation(cardId)
    })
    return
  }
  if (d.mode === 'down' && dy > 80) {
    system.closeSwitcher()
    return
  }
  // 点按：点卡片恢复，点空白关闭
  if (Math.abs(e.clientX - d.startX) < 8 && Math.abs(e.clientY - d.startY) < 8) {
    /* 底部工具条（垃圾桶/计数）自己处理点击，不能被「点空白关闭」抢走。
       历史 bug（2026-09-12 修复）：pointerdown 在根上做了 setPointerCapture，
       浏览器会把 click 也重定向到捕获元素（根），于是按钮上的 @click 永远收不到，
       垃圾桶那一击还会被误判成「点空白」→ closeSwitcher()，清空最近任务一直无效。
       这里改为在 tap 分支用 elementFromPoint（不受捕获影响）直接判定命中。 */
    const hitEl = document.elementFromPoint(e.clientX, e.clientY)
    const dockHit = hitEl?.closest?.('.switcher-dock')
    if (dockHit) {
      if (hitEl.closest('.switcher-trash')) clearAll()
      return
    }
    const cardId = hitCardId(e)
    if (cardId) resumeWithExpand(cardId)
    /* 点空白 = 回桌面（第七轮，需求⑪）。
       旧实现是 system.closeSwitcher()，它只把开关关掉、回到 baseLayer —— 从应用内
       上滑进来时 baseLayer 还是 'app'，于是「点空白」又回到了原来那个应用。
       与 iOS / 参考实现一致的行为是回桌面：清掉前台应用 + baseLayer 落到 home。
       最近任务列表保持不动（那不是「清理」）。 */
    else exitSwitcherToHome()
  }
}

function hitCardId(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY)
  const card = el?.closest?.('.switcher-card')
  return card?.dataset?.appId || null
}

/* 上滑移除：飞出 + 其余卡片弹簧重排 */
function dismissWithAnimation(appId) {
  dismissing.value = appId
  setTimeout(() => {
    system.dismissApp(appId)
    dismissing.value = null
    const idx = Math.max(0, Math.min(apps.value.length - 1, Math.round(focus.value)))
    focusToIndex(idx)
  }, 240)
}

function dismissingStyle(i) {
  const p = deckPose(i - focus.value, metrics.value, xFrac.value)
  return {
    width: cardW.value + 'px',
    height: cardH.value + 'px',
    transform: `translate3d(${p.x}px, ${p.y - screenH.value * 1.1}px, 0) scale(${p.scale})`,
    opacity: 0,
    zIndex: deckZ(i),
    borderRadius: RADIUS.value + 'px'
  }
}

/* 点卡片恢复：卡位 →（围绕中心 scale 放大）→ 全屏，再正式切到 AppWindow（无缝衔接）。
   历史 bug（2026-09-12 修复）：旧实现直接改 width/height 到全屏 + transform 归位，
   宽高没有过渡 → 卡片会「瞬间变大再滑过去」。改为与跟手卡同一套「中心锚点 scale」几何。 */
const expanding = ref(null)
const expandTo = ref(false)
function resumeWithExpand(appId) {
  expanding.value = appId
  expandTo.value = false
  // 先渲染「起始态」，两帧后再切目标态，浏览器才会跑过渡
  requestAnimationFrame(() => requestAnimationFrame(() => { expandTo.value = true }))
  setTimeout(() => {
    system.resumeApp(appId)
    expanding.value = null
    expandTo.value = false
  }, 300)
}

function expandingStyle(i) {
  const idx = apps.value.indexOf(expanding.value)
  const slot = poseOf(idx < 0 ? i : idx)
  const cx = expandTo.value ? screenW.value / 2 : slot.x + cardW.value / 2
  const cy = expandTo.value ? screenH.value / 2 : slot.y + cardH.value / 2
  const s = expandTo.value ? 1 : previewScale.value
  return {
    width: screenW.value + 'px',
    height: screenH.value + 'px',
    transform: `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%) scale(${s})`,
    borderRadius: expandTo.value ? '0px' : RADIUS.value / Math.max(s, 0.01) + 'px',
    filter: 'brightness(1)',
    zIndex: Z_EXPAND,
    opacity: 1
  }
}

/* 卡片样式分派 —— 锚点几何（跟手/展开）居中缩放，堆叠几何以左上角为原点 */
function cardStyle(id, i) {
  if (id === dismissing.value) return dismissingStyle(i)
  if (id === expanding.value) return expandingStyle(i)
  return stackStyle(i)
}

/* 底部垃圾桶：清空最近任务回桌面 */
function clearAll() {
  system.dismissAll()
}

/** 点空白：关掉切换器并【回桌面】（需求⑪）。
 *  与 dismissAll 的区别 —— 这里【不清】最近任务，只是离开切换器回桌面。 */
function exitSwitcherToHome() {
  system.exitSwitcherToHome()
}

onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && screenRef.el) {
    ro = new ResizeObserver(measure)
    ro.observe(screenRef.el)
  }
})
watch(rootRef, (el) => { if (el) measure() })
onBeforeUnmount(() => {
  if (ro) { ro.disconnect(); ro = null }
  clearTimeout(dwellTimer)
  clearTimeout(settleTimer)
})
</script>

<template>
  <div
    v-if="visible"
    ref="rootRef"
    class="app-switcher"
    :class="{ 'is-dragging': !!drag, 'is-focus-moving': focusMoving, 'is-home-entrance': homeEntranceFollowing, 'is-home-retreat': homeRetreat, 'is-dismissing': !!dismissing || !!expanding }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <!-- 背景模糊压暗：跟手势进度淡入 -->
    <div class="switcher-dim" :style="{ opacity: Math.min(1, system.switcherProgress) }"></div>

    <div class="switcher-track">
      <!-- 跟手缩放卡：手势进行中（progress<1）只有它，把全屏应用连续缩到卡位 -->
      <div
        v-if="followStyle && system.activeAppId"
        class="switcher-card is-follow"
        :style="followStyle"
      >
        <div class="switcher-card-body">
          <div
            class="switcher-card-content"
            :style="{
              width: screenW + 'px',
              height: screenH + 'px',
              transform: `scale(${contentScale(true)})`,
              transformOrigin: '0 0'
            }"
          >
            <component :is="compOf(system.activeAppId)" :app="appOf(system.activeAppId)" />
          </div>
        </div>
      </div>

      <!-- 堆叠卡片组：切换器打开后渲染；桌面路径在【手势进行中】就要渲染，
           否则上滑期间屏幕上一张卡都没有（只剩黑遮罩）= 盲滑，手感极差。
           前卡在进场进度 <1 时由跟手卡顶替（同位姿无缝交接），其余卡片按进度淡入。
           层级由 deckZ(i) = 10000 - i 决定 —— 顶卡一直到最后飞出屏幕都在最上层。 -->
      <template v-if="renderDeck">
        <div
          v-for="c in renderedCards"
          :key="c.id"
          class="switcher-card is-deck"
          :data-app-id="c.id"
          :data-index="c.i"
          :data-depth="+(c.i - focus).toFixed(3)"
          :style="cardStyle(c.id, c.i)"
        >
          <!-- 卡片上方一行：应用图标 + 名称（第七轮改）。
               参考图（Ricky 2026-09-13 需求⑨）：**每张卡都有自己的图标**，
               但**只有 C 位那张显示应用名称** —— 后面两层只画图标，形成向左上的图标阶梯。
               ⚠️ 必须传 ignore-hidden：AppWindow 在前台应用打开期间会调用
               home.hideIcon(activeAppId)，把该应用的图标置成全局隐藏态。
               C 位初始正好就是前台应用 → 不加这个 prop 时「设置」那张卡的图标是空的
               （名称还在，因为名称不吃隐藏态）。这是 Ricky 截图里「设置的图标消失了」的根因。 -->
          <div v-if="!dismissing" class="switcher-card-label" :style="labelStyle()">
            <AppIcon :app="appOf(c.id)" :size="24" :show-label="false" ignore-hidden />
            <span v-if="c.i === labelIndex">{{ nameOf(c.id) }}</span>
          </div>
          <!-- 卡体单独吃一份透明度（bodyOpacityOf）：前卡被跟手卡顶替时只淡卡体、
               卡根留 1 —— 这样标签行在停驻期就一直在场，交接那一帧也不用淡入（需求③）。 -->
          <div class="switcher-card-body" :style="{ opacity: bodyOpacityOf(c.i) }">
            <div
              class="switcher-card-content"
              :style="{
                width: screenW + 'px',
                height: screenH + 'px',
                transform: `scale(${c.id === expanding ? 1 : previewScale})`,
                transformOrigin: '0 0'
              }"
            >
              <component :is="compOf(c.id)" :app="appOf(c.id)" />
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 底部：清空后台（与通知中心同款磨砂圆钮；进度到位后淡入） -->
    <div
      v-if="system.appSwitcherOpen || preCommit"
      class="switcher-dock"
      :style="{ opacity: chromeOpacity, zIndex: Z_CHROME, bottom: dockBottom + 'px' }"
    >
      <GlassCircleButton
        class="switcher-trash"
        :label="i18n.t('clearAllNotifs')"
        @click.stop="clearAll"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/>
        </svg>
      </GlassCircleButton>
    </div>
  </div>
</template>

<style scoped>
.app-switcher {
  position: absolute;
  inset: 0;
  z-index: 95; /* 低于 Home 手势条（96），保证底部手势可用 */
  touch-action: none;
  user-select: none;
  overflow: hidden;
}

.switcher-dim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(26px) saturate(140%);
  -webkit-backdrop-filter: blur(26px) saturate(140%);
}
/* 桌面路径退场（上滑未激活就松手）：遮罩跟着卡片一起淡出。
   只在 .is-home-retreat 这个精确窗口里开 —— 跟手期与应用内上滑路径都必须逐帧直写。 */
.app-switcher.is-home-retreat .switcher-dim {
  transition: opacity 0.28s ease;
}

.switcher-track {
  position: absolute;
  inset: 0;
}

.switcher-card {
  position: absolute;
  left: 0;
  top: 0;
  /* 锚点几何（跟手缩放 / 点卡恢复）：围绕中心缩放 */
  transform-origin: center center;
  will-change: transform, filter;
}
/* 堆叠几何：以【左上角】为原点缩放 —— 左边缘被钉住，下层才会「露出越来越少的左侧阶梯」
   （若用 center，缩放会把左边缘往右推，阶梯会被吃掉，最深层还会漂出屏）。
   垂直方向的「居中」由 deckPose 的 y = cardCy - cardH·scale/2 显式补偿（修正 B）：
   原点在左上角不再意味着顶对齐，所有层的垂直中心恒等于 cardCy。 */
.switcher-card.is-deck {
  transform-origin: 0 0;
}
/* 非拖拽 / 非焦点弹簧推进 / 非桌面跟手入场时开过渡（重排、移除、恢复、桌面入场收场）。
   - .is-follow 的 transform 由手势/进场弹簧逐帧直写，挂 transition 会被二次低通，
     表现为「跟手滞后、松手后慢慢飘」→ 必须排除；
   - .is-focus-moving 是松手后的吸附弹簧，同理必须排除；
   - .is-home-entrance 是桌面路径上滑【跟手】期（进度逐帧直写卡片 y/opacity）——
     AppSwitcher 自己不持有这次拖拽（拖动发生在 HomeIndicator 上，drag 恒为 null），
     所以 .is-dragging 挡不住它；不排除的话同样会滞后发飘。
     手势取消后会自然退出这个类 → 过渡恢复 → 卡片顺势下沉淡出。
   - 曲线 0.32s / cubic-bezier(0.32, 1.16, 0.6, 1)：与 ios-deck 弹簧（τ≈110ms、
     过冲 6.7%）的收尾观感一致，末段带一点回弹余韵，不再是死板的 ease-out。 */
.app-switcher:not(.is-dragging):not(.is-focus-moving):not(.is-home-entrance) .switcher-card:not(.is-follow) {
  transition:
    transform 0.32s cubic-bezier(0.32, 1.16, 0.6, 1),
    opacity 0.22s ease,
    filter 0.28s ease;
}

.switcher-card-label {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 7px;
  height: 24px; /* = DECK.LABEL_ROW_H（改这里要同步 switcherDeck.js） */
  color: rgba(255, 255, 255, 0.95);
  font: 500 16px/1 var(--font-stack);
  white-space: nowrap;
  pointer-events: none;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.55);
}

.switcher-card-body {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
  background: #0a0a0c;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.42);
}

.switcher-card-content {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none; /* 预览只看不摸 */
  background: var(--bg-grouped, #f2f2f7);
}

.switcher-dock {
  position: absolute;
  left: 0;
  right: 0;
  /* bottom 由模板内联绑定（dockBottom = homeInset + DECK.DOCK_GAP）——
     第七轮起这里是唯一来源，CSS 不再抄一份 gap，避免两处脱钩。 */
  display: flex;
  flex-direction: column;
  align-items: center;
  /* z-index 由模板绑 Z_CHROME 给（压在所有卡片之上） */
}
</style>
