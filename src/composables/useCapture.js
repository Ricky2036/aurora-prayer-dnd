import { ref } from 'vue'

/**
 * 录屏 / 截图能力（模块级单例）。
 *
 * 为什么是单例：控制中心点「录屏」开始录制后，用户可能去控制台点「停止录制」；
 * 反过来也一样。两边必须操作同一个 MediaRecorder，所以状态提到模块作用域，
 * 由 App.vue（控制台）和 ControlCenter.vue 共用。
 *
 * 两种录制预设：
 * - 控制台：默认连金属外壳一起录 + 圆角透明裁切 + 转码 ProRes .mov（做演示素材用）
 * - 控制中心：不带壳、不裁圆角、直出 MP4 不转码（录的是手机屏幕本身）
 */

const isRecording = ref(false)
const isTranscoding = ref(false)
const isCapturing = ref(false)
/** 最近一次失败原因，方便排查「点了没反应」这类问题 */
const lastError = ref('')
/** 录制时长 mm:ss，屏幕上的录制指示器和控制台按钮共用同一份 */
const recordElapsed = ref('00:00')
/** 控制台「带壳录制」开关，只影响控制台发起的录制（默认不带壳） */
const recordWithFrame = ref(false)
/** 控制台「带壳截图」开关，只影响控制台发起的截图（默认不带壳） */
const screenshotWithFrame = ref(false)

/* ================= 轻量提示（toast） ================= */
/**
 * 为什么必须有它：截图/录屏依赖系统的「屏幕共享」授权。用户点了取消、
 * 浏览器不支持、或页面不在安全上下文时，getDisplayMedia 会直接抛错 ——
 * 以前这些错误只写进 console，界面上一点动静都没有，看起来就是「点了没反应」。
 */
const toasts = ref([])
let toastSeq = 0

function notify(text, kind = 'info', ms = 3200) {
  const id = ++toastSeq
  toasts.value = [...toasts.value.filter((t) => t.text !== text), { id, text, kind }]
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, ms)
  return id
}

/**
 * 把浏览器抛的英文错误翻译成人话。
 * @param {number} elapsedMs 从发起请求到失败用了多久 —— 用来区分「用户真取消」
 *   和「被策略秒拒」：秒拒通常 <400ms，连选择框都没弹出来。
 */
function describeCaptureError(err, elapsedMs = Infinity) {
  switch (err?.name) {
    case 'NotAllowedError': {
      if (isEmbedded()) return '内嵌预览禁止屏幕采集，请在 Chrome / Edge 新标签页里打开本页面再试'
      if (elapsedMs < 400) return '屏幕采集被浏览器策略拒绝（若用 macOS，请到 系统设置 → 隐私与安全性 → 屏幕录制 里放行浏览器）'
      return '屏幕共享被拒绝或已取消'
    }
    case 'NotFoundError':
      return '没有可用的屏幕 / 窗口来源'
    case 'NotReadableError':
      return '系统不允许读取屏幕内容（请检查系统隐私设置里的「屏幕录制」权限）'
    case 'AbortError':
      return '屏幕采集被系统中断'
    case 'NotSupportedError':
    case 'OverconstrainedError':
      return '当前浏览器不支持所需的屏幕采集能力'
    case 'SecurityError':
      return '页面非安全上下文，无法调用屏幕采集'
    default:
      return err?.message || String(err || '未知错误')
  }
}

/** 页面是不是被嵌在 iframe 里（IDE 预览面板、文档内嵌预览等） */
function isEmbedded() {
  try {
    return window.self !== window.top
  } catch (e) {
    // 跨源访问 window.top 会抛错，能抛就说明一定在 iframe 里
    return true
  }
}

/**
 * 内嵌场景的元凶：父页面没给 iframe 开 display-capture 权限，
 * 浏览器会在**不弹任何选择框**的情况下直接抛 NotAllowedError ——
 * 表象就是「点了没反应」或「提示已取消」，非常具有迷惑性。
 */
function displayCaptureAllowed() {
  try {
    const policy = document.permissionsPolicy || document.featurePolicy
    if (!policy || typeof policy.allowsFeature !== 'function') return null // 判断不了
    return policy.allowsFeature('display-capture')
  } catch (e) {
    return null
  }
}

/** 动手之前先体检，能提前说清原因就不要等到抛错 */
function ensureSupport() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
    return '当前浏览器不支持屏幕采集，请使用 Chrome / Edge 桌面版'
  }
  if (!window.isSecureContext) {
    return '当前页面不是安全上下文（需 https 或 localhost），无法调用屏幕采集'
  }
  if (isEmbedded() && displayCaptureAllowed() === false) {
    return '内嵌预览禁止屏幕采集，请在 Chrome / Edge 新标签页里打开本页面再试'
  }
  return ''
}

let mediaRecorder = null
let recordedChunks = []
let activeStream = null
let videoEl = null
let canvasEl = null
let animationId = 0
let isDrawing = false
/** 本次录制的输出配置，停止时决定「转码成 .mov」还是「直接存 MP4」 */
let session = null
/** 本次采集是否开启了「圆角归零」采集态，结束时负责还原 */
let captureModeOn = false

/* ================= 公共小工具 ================= */

/* ================= 录制计时 ================= */
let recTimer = null

function startElapsed() {
  stopElapsed()
  const t0 = Date.now()
  const tick = () => {
    const s = Math.floor((Date.now() - t0) / 1000)
    recordElapsed.value = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }
  tick()
  recTimer = setInterval(tick, 1000)
}

function stopElapsed() {
  if (recTimer) clearInterval(recTimer)
  recTimer = null
  recordElapsed.value = '00:00'
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function timestamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

/**
 * 采集态开关：body.is-capturing 会把屏幕圆角归零（与移动端 .mobile-screen 同一套处理）。
 *
 * 为什么必须动 DOM：屏幕是圆角 + overflow:hidden，直录它的外接矩形时，
 * 四个角露出的是圆角外的黑色机身 —— 那是真实存在的像素，后期在 canvas 上
 * 怎么补都是补丁。把圆角归零后，外接矩形里就全是屏幕内容，四角自然就是壁纸。
 */
function setCaptureMode(on) {
  document.body.classList.toggle('is-capturing', !!on)
}

/** 屏幕本体（不含金属外壳）；移动端是 .mobile-screen */
function resolveScreenEl() {
  return document.querySelector('.screen') || document.querySelector('.mobile-screen')
}

/** 连外壳一起录时的外层容器 */
function resolveFrameEl() {
  return document.querySelector('.phone-scale')
}

/**
 * 用 Region Capture API 把采集区域裁到目标元素。
 * @returns {boolean} 是否裁剪成功 —— 失败时由调用方走「手动裁源矩形」兜底，
 *                    否则 Safari / Firefox 会直接录下整个浏览器窗口。
 */
async function applyCrop(track, el) {
  if (!window.CropTarget || !el || !track?.cropTo) return false
  try {
    const cropTarget = await window.CropTarget.fromElement(el)
    await track.cropTo(cropTarget)
    return true
  } catch (e) {
    console.warn('[capture] Region Capture 裁剪失败，改用手动裁源矩形', e)
    return false
  }
}

/**
 * Region Capture 不可用时的兜底：算出「目标元素在视频里的源矩形」，
 * 绘制时只取这一块 —— 保证输出的仍然只有屏幕本体，而不是整个桌面/浏览器窗口。
 */
function sourceRectFor(video, el) {
  if (!el || !video.videoWidth || !video.videoHeight) return null
  const r = el.getBoundingClientRect()
  if (!r.width || !r.height) return null
  const vw = video.videoWidth
  const vh = video.videoHeight
  const dpr = window.devicePixelRatio || 1
  // 采集源可能是「整块屏幕」也可能是「当前标签页」，按宽高比挑最接近的那个
  const screenW = (window.screen?.width || window.innerWidth) * dpr
  const screenH = (window.screen?.height || window.innerHeight) * dpr
  const tabW = window.innerWidth * dpr
  const tabH = window.innerHeight * dpr
  const isScreen = Math.abs(screenW / screenH - vw / vh) < Math.abs(tabW / tabH - vw / vh)
  const surfaceW = isScreen ? screenW : tabW
  const surfaceH = isScreen ? screenH : tabH
  if (!surfaceW || !surfaceH) return null
  const k = vw / surfaceW
  const ox = isScreen ? (window.screenX || 0) * dpr : 0
  const oy = isScreen ? (window.screenY || 0) * dpr : 0
  const x = (r.left * dpr + ox) * k
  const y = (r.top * dpr + oy) * k
  const w = r.width * dpr * k
  const h = r.height * dpr * k
  // 算出来越界就放弃，宁可整屏也不要截歪
  if (x < -1 || y < -1 || x + w > vw + 1 || y + h > vh + 1) return null
  return { x: Math.max(0, x), y: Math.max(0, y), w, h }
}

/**
 * 申请屏幕采集。Chrome 上带 displaySurface/preferCurrentTab 约束，
 * 但某些浏览器/版本会因约束不被满足直接抛 OverconstrainedError，
 * 这时降级成不带约束再要一次（用户主动取消不重试，避免反复弹窗）。
 */
async function requestDisplayStream() {
  const attempts = [
    { video: { displaySurface: 'browser' }, preferCurrentTab: true, audio: false },
    { video: true, audio: false }
  ]
  let lastErr = null
  for (let i = 0; i < attempts.length; i++) {
    try {
      return await navigator.mediaDevices.getDisplayMedia(attempts[i])
    } catch (err) {
      lastErr = err
      if (err?.name !== 'OverconstrainedError' && err?.name !== 'TypeError') throw err
    }
  }
  throw lastErr
}

function pickMimeType(preferMp4) {
  const mp4 = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4;codecs=h264', 'video/mp4']
  const webm = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  const list = preferMp4 ? [...mp4, ...webm] : [...webm, ...mp4]
  if (typeof MediaRecorder === 'undefined') return ''
  return list.find((m) => MediaRecorder.isTypeSupported(m)) || ''
}

function extensionOf(mimeType) {
  if (mimeType.includes('mp4')) return 'mp4'
  if (mimeType.includes('webm')) return 'webm'
  return 'bin'
}

/* ================= 录屏 ================= */

function teardownStream() {
  isDrawing = false
  if (animationId) cancelAnimationFrame(animationId)
  animationId = 0
  activeStream?.getTracks().forEach((t) => t.stop())
  activeStream = null
  videoEl?.remove()
  videoEl = null
  canvasEl?.remove()
  canvasEl = null
}

/**
 * @param {object} opts
 * @param {boolean} opts.withFrame  连金属外壳一起录（控制台可选）
 * @param {boolean} opts.rounded    做圆角透明裁切
 * @param {boolean} opts.transcode  停止后调 /__transcode_mov 转 ProRes .mov
 * @param {boolean} opts.preferMp4  优先 MP4 编码，停止后直接下载不转码
 * @param {Function} opts.beforeStart 拿到画面后、真正开录前的钩子（等控制中心收起等）
 */
async function startRecording(opts = {}) {
  const { withFrame = false, rounded = false, transcode = false, preferMp4 = false, beforeStart = null } = opts
  if (isRecording.value || isTranscoding.value) return

  const unsupported = ensureSupport()
  if (unsupported) {
    lastError.value = unsupported
    notify(unsupported, 'error', 5000)
    return
  }

  const frameEl = withFrame ? resolveFrameEl() : null
  const targetEl = frameEl || resolveScreenEl()
  const shapeEl = rounded ? (frameEl?.querySelector('.phone-frame') || targetEl) : null
  const shapeWidth = shapeEl?.offsetWidth || 1
  const shapeRadius = rounded ? (Number.parseFloat(getComputedStyle(shapeEl).borderTopLeftRadius) || 0) : 0
  const captureRadiusRatio = shapeRadius / shapeWidth

  // 不带壳直录：先把屏幕圆角归零，否则外接矩形的四个角会录到黑色机身
  const needCaptureMode = !withFrame && !rounded
  captureModeOn = needCaptureMode
  setCaptureMode(needCaptureMode)

  let stream
  const t0 = (typeof performance !== 'undefined' ? performance : Date).now()
  try {
    stream = await requestDisplayStream()
  } catch (err) {
    // 用户在系统选择器里点了「取消」，或浏览器/系统策略直接拒绝
    lastError.value = err?.message || String(err)
    console.warn('[capture] 未获取屏幕共享权限', err)
    const elapsed = (typeof performance !== 'undefined' ? performance : Date).now() - t0
    // 只有「用户真的在弹窗里点了取消」才算正常操作（用中性提示）；
    // 被策略秒拒 / 内嵌预览被禁要报出来，否则用户只会看到「已取消」而不知所以。
    const cancelled = err?.name === 'NotAllowedError' && elapsed >= 400 && !isEmbedded()
    notify(
      cancelled ? '已取消，未开始录制' : `录屏失败：${describeCaptureError(err, elapsed)}`,
      cancelled ? 'info' : 'error',
      5000
    )
    captureModeOn = false
    setCaptureMode(false)
    return
  }

  const cropped = await applyCrop(stream.getVideoTracks()[0], targetEl)

  activeStream = stream
  const video = document.createElement('video')
  video.srcObject = stream
  video.muted = true
  video.playsInline = true
  videoEl = video

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { alpha: true })
  canvasEl = canvas

  video.onloadedmetadata = async () => {
    try { await video.play() } catch (e) { /* 自动播放被拦截也继续，画面仍会推进 */ }

    // 等控制中心收起等前置动作做完再开录，避免把收起动画录进去
    if (beforeStart) await beforeStart()

    // Region Capture 没生效时，按屏幕元素在视频里的位置手动裁，避免录下整个窗口
    const src = cropped ? null : sourceRectFor(video, targetEl)
    if (src) console.info('[capture] Region Capture 不可用，已按屏幕元素手动裁剪')
    canvas.width = Math.round(src ? src.w : video.videoWidth)
    canvas.height = Math.round(src ? src.h : video.videoHeight)

    const drawFrame = () => {
      if (!isDrawing) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      const radius = canvas.width * captureRadiusRatio
      if (radius > 0) {
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(0, 0, canvas.width, canvas.height, radius)
        else ctx.rect(0, 0, canvas.width, canvas.height)
        ctx.clip()
      }
      if (src) ctx.drawImage(video, src.x, src.y, src.w, src.h, 0, 0, canvas.width, canvas.height)
      else ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      ctx.restore()
      animationId = requestAnimationFrame(drawFrame)
    }
    isDrawing = true
    drawFrame()

    const canvasStream = canvas.captureStream(60)
    recordedChunks = []
    const selectedMime = pickMimeType(preferMp4)
    session = { mimeType: selectedMime || 'video/webm', transcode, captureRadiusRatio }

    const recorderOptions = { videoBitsPerSecond: 10000000 }
    if (selectedMime) recorderOptions.mimeType = selectedMime

    mediaRecorder = new MediaRecorder(canvasStream, recorderOptions)
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data)
    }
    mediaRecorder.onstop = onRecorderStop
    mediaRecorder.start()
    isRecording.value = true
    startElapsed()
  }

  // 用户点浏览器自带的「停止共享」时也要正常收尾
  stream.getVideoTracks()[0].onended = stopRecording
}

async function onRecorderStop() {
  isRecording.value = false
  isTranscoding.value = true
  stopElapsed()
  teardownStream()
  // 还原屏幕圆角（采集态只在录制期间生效）
  if (captureModeOn) {
    captureModeOn = false
    setCaptureMode(false)
  }

  const cfg = session || { mimeType: 'video/webm', transcode: false, captureRadiusRatio: 0 }
  session = null
  const rawBlob = new Blob(recordedChunks, { type: cfg.mimeType })
  recordedChunks = []

  // 演示素材路径：转 Apple ProRes 4444 with Alpha（仅 dev server 提供该接口）
  if (cfg.transcode) {
    try {
      const res = await fetch(`/__transcode_mov?radiusRatio=${cfg.captureRadiusRatio}`, {
        method: 'POST',
        body: rawBlob
      })
      if (res.ok) {
        downloadBlob(await res.blob(), `tOS_Prototype_${timestamp()}.mov`)
        isTranscoding.value = false
        notify('录屏已保存（.mov，含透明圆角）', 'success')
        return
      }
    } catch (e) {
      console.warn('[capture] 本地转码接口未响应，回退直接下载原始视频', e)
      notify('转码服务未响应，已改为保存原始视频', 'info')
    }
  }

  downloadBlob(rawBlob, `tOS_Prototype_${timestamp()}.${extensionOf(cfg.mimeType)}`)
  isTranscoding.value = false
  notify(`录屏已保存（.${extensionOf(cfg.mimeType)}）`, 'success')
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop()
}

/** 控制台按钮用：没在录就开始（带壳/圆角/转码），正在录就停止 */
function toggleRecording(opts = {}) {
  if (isRecording.value) {
    stopRecording()
    return
  }
  return startRecording(opts)
}

/* ================= 截图 ================= */

/**
 * 截图（控制台 / 控制中心共用）。两种效果：
 * - **带壳**（withFrame=true）：把金属外壳一起截进来，画布含 alpha，可做圆角透明裁切。
 * - **不带壳**（withFrame=false，默认）：只截屏幕本体，**不做任何圆角裁切** ——
 *   先把屏幕圆角临时归零（body.is-capturing），外接矩形的四角才是壁纸而不是黑机身，
 *   输出是一张干干净净的直角矩形 PNG。
 *
 * 走与录屏同源的 getDisplayMedia + Region Capture，无第三方依赖。
 * @param {object} opts
 * @param {boolean} opts.withFrame 连外壳一起截
 * @param {boolean} opts.rounded   输出做圆角透明裁切（默认 false，即不裁切）
 */
async function captureScreenshot(opts = {}) {
  const { withFrame = false, rounded = false, beforeGrab = null } = opts
  if (isCapturing.value) return false

  const unsupported = ensureSupport()
  if (unsupported) {
    lastError.value = unsupported
    notify(unsupported, 'error', 5000)
    return false
  }

  isCapturing.value = true

  const frameEl = withFrame ? resolveFrameEl() : null
  const targetEl = frameEl || resolveScreenEl()
  // 与录屏同理：采外接矩形前先把圆角归零，四角才是壁纸而不是黑机身
  setCaptureMode(!withFrame)

  // 圆角裁切只在调用方显式要求时才做（带壳演示素材用）；不带壳一律不裁
  const shapeEl = rounded ? (frameEl?.querySelector('.phone-frame') || targetEl) : null
  const shapeWidth = shapeEl?.offsetWidth || 1
  const shapeRadius = rounded ? (Number.parseFloat(getComputedStyle(shapeEl).borderTopLeftRadius) || 0) : 0
  const captureRadiusRatio = shapeRadius / shapeWidth

  let stream
  const t0 = (typeof performance !== 'undefined' ? performance : Date).now()
  try {
    stream = await requestDisplayStream()
    const cropped = await applyCrop(stream.getVideoTracks()[0], targetEl)

    const video = document.createElement('video')
    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve
      video.onerror = reject
    })
    try { await video.play() } catch (e) { /* 忽略自动播放限制 */ }

    // 让调用方在「拿到画面」和「真正截图」之间插事（例如等控制中心收起动画播完）
    if (beforeGrab) await beforeGrab()
    // 等两帧，确保首帧已解码，否则偶发截到黑屏
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    const src = cropped ? null : sourceRectFor(video, targetEl)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(src ? src.w : video.videoWidth)
    canvas.height = Math.round(src ? src.h : video.videoHeight)
    const ctx = canvas.getContext('2d', { alpha: true })
    const radius = canvas.width * captureRadiusRatio
    ctx.save()
    if (radius > 0) {
      ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(0, 0, canvas.width, canvas.height, radius)
      else ctx.rect(0, 0, canvas.width, canvas.height)
      ctx.clip()
    }
    if (src) ctx.drawImage(video, src.x, src.y, src.w, src.h, 0, 0, canvas.width, canvas.height)
    else ctx.drawImage(video, 0, 0)
    ctx.restore()

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('canvas.toBlob 返回空')
    downloadBlob(blob, `aurora-phone_${timestamp()}.png`)
    notify('截图已保存', 'success')
    return true
  } catch (err) {
    lastError.value = err?.message || String(err)
    console.error('[capture] 截图失败', err)
    const elapsed = (typeof performance !== 'undefined' ? performance : Date).now() - t0
    const cancelled = err?.name === 'NotAllowedError' && elapsed >= 400 && !isEmbedded()
    notify(
      cancelled ? '已取消，未截图' : `截图失败：${describeCaptureError(err, elapsed)}`,
      cancelled ? 'info' : 'error',
      5000
    )
    return false
  } finally {
    stream?.getTracks().forEach((t) => t.stop())
    setCaptureMode(false)
    isCapturing.value = false
  }
}

export function useCapture() {
  return {
    isRecording,
    isTranscoding,
    isCapturing,
    lastError,
    recordElapsed,
    recordWithFrame,
    screenshotWithFrame,
    toasts,
    notify,
    startRecording,
    stopRecording,
    toggleRecording,
    captureScreenshot
  }
}
