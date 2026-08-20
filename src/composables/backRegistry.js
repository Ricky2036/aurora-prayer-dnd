import { onUnmounted } from 'vue'

/**
 * 应用内「返回」处理器栈：全局侧滑手势先问栈顶处理器，
 * 处理器返回 true 表示已消费（如关闭应用内二级页），否则回退到返回桌面。
 *
 * 用法（应用组件内）：
 *   useBackHandler(() => {
 *     if (inDetail.value) { inDetail.value = false; return true }
 *     return false
 *   })
 */

const stack = []

/**
 * 注册一个返回处理器，组件卸载时自动移除。
 * @param fn () => boolean  返回 true = 已处理（不回桌面）
 */
export function useBackHandler(fn) {
  stack.push(fn)
  const remove = () => {
    const i = stack.indexOf(fn)
    if (i >= 0) stack.splice(i, 1)
  }
  onUnmounted(remove)
  return remove
}

/** 执行栈顶处理器；无处理器或返回 false → 需要回桌面 */
export function runBackHandler() {
  const fn = stack[stack.length - 1]
  if (!fn) return false
  try {
    return fn() === true
  } catch {
    return false
  }
}

/** 当前是否有应用内处理器（决定侧滑语义是「上级页」还是「回桌面」） */
export function hasBackHandler() {
  return stack.length > 0
}
