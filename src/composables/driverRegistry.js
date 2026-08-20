/**
 * 叠层驱动注册表：ScreenView 创建驱动时注册，
 * 供叠层组件内部做反向手势时接管同一个 spring（避免双 spring 打架）。
 */
const drivers = new Map()

export function registerDriver(name, api) {
  drivers.set(name, api)
}

export function getDriver(name) {
  return drivers.get(name)
}
