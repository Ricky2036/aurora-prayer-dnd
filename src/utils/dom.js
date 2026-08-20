/* DOM 工具：相对屏幕容器的坐标换算 */

/** 获取元素相对屏幕容器（.screen）的 rect */
export function rectRelativeToScreen(el, screenEl) {
  if (!el || !screenEl) return null
  const r = el.getBoundingClientRect()
  const s = screenEl.getBoundingClientRect()

  // getBoundingClientRect 包含舞台 transform，offsetWidth/offsetHeight 则是元素
  // getBoundingClientRect 包含舞台缩放，offsetWidth/offsetHeight 是唯一布局基准。
  // 两者相除即可在任意舞台缩放下还原到 .screen-view 的本地坐标系。
  const layoutWidth = screenEl.offsetWidth || s.width
  const layoutHeight = screenEl.offsetHeight || s.height
  const scaleX = layoutWidth ? s.width / layoutWidth : 1
  const scaleY = layoutHeight ? s.height / layoutHeight : scaleX

  return {
    x: (r.left - s.left) / scaleX,
    y: (r.top - s.top) / scaleY,
    // 稳定锚点没有自身 transform，布局尺寸应直接读取 offset 尺寸。若反推
    // 已缩放 DOMRect，60px 可能成为 59.99997px 并在 Blink 中向下量化 1/64px。
    width: el.offsetWidth || r.width / scaleX,
    height: el.offsetHeight || r.height / scaleY,
    get cx() { return this.x + this.width / 2 },
    get cy() { return this.y + this.height / 2 }
  }
}
