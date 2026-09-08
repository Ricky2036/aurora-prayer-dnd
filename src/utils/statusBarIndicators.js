/**
 * 状态栏功能指示器「单一事实来源」。
 * 桌面状态栏(StatusBar.vue) 与 下拉控制中心状态行(ControlCenter.vue) 共用，
 * 保证两处的图标优先级排序规则完全一致（Ricky 2026-09-08）。
 *
 * 优先级（priority 越大越靠右、越晚被隐藏）：
 *   vibrate(20) < mute(30) < hotspot(40) < bluetooth(50) < dnd(60)
 * 渲染顺序 = 优先级升序（DOM 左→右 = 低→高），故蓝牙(50)在最右、紧邻原生图标。
 * 隐藏顺序 = 优先级升序（先藏 vibrate，最后才藏蓝牙）。
 * 原生连接图标（信号/Wi-Fi/电池，来自 <StatusIcons>）视为最高优先级，
 * 永远显示、固定在最右（不在此列表内）。
 *
 * show(c): 传入 control store，返回该指示器当前是否应点亮。
 *   其中 DND 有两个状态字段（control.dnd 与 control.doNotDisturb 未互相同步），
 *   任一为 true 都点亮，两个入口都能在状态栏看到。
 */
export const indicatorDefs = [
  { key: 'vibrate', icon: 'vibrate', size: 18, sw: 2.5, priority: 20, show: (c) => c.soundMode === 'vibrate' },
  { key: 'mute', icon: 'bellOff', size: 18, sw: 2.5, priority: 30, show: (c) => c.soundMode === 'mute' },
  { key: 'hotspot', icon: 'radio', size: 18, sw: 2.5, priority: 40, show: (c) => c.hotspot },
  { key: 'bluetooth', icon: 'bluetooth', size: 16, sw: 2.4, priority: 50, show: (c) => c.bluetooth },
  { key: 'dnd', icon: 'moon', size: 18, sw: 2.5, priority: 60, show: (c) => c.dnd || c.doNotDisturb },
]

// 渲染顺序：优先级升序（左→右 = 低→高）
export const orderedIndicators = [...indicatorDefs].sort((a, b) => a.priority - b.priority)
