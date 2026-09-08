/**
 * 通知图标库：支持本地应用图标图片（PNG）与系统内联 SVG 图标。
 * 18 个应用图标从 Google Play 官方下载，天气图标同桌面天气图标一致。
 */

import alipay from '../../assets/icons/notification-apps/alipay.png'
import amazon from '../../assets/icons/notification-apps/amazon.png'
import facebook from '../../assets/icons/notification-apps/facebook.png'
import gmail from '../../assets/icons/notification-apps/gmail.png'
import google from '../../assets/icons/notification-apps/google.png'
import instagram from '../../assets/icons/notification-apps/instagram.png'
import linkedin from '../../assets/icons/notification-apps/linkedin.png'
import netflix from '../../assets/icons/notification-apps/netflix.png'
import pinterest from '../../assets/icons/notification-apps/pinterest.png'
import snapchat from '../../assets/icons/notification-apps/snapchat.png'
import spotify from '../../assets/icons/notification-apps/spotify.png'
import telegram from '../../assets/icons/notification-apps/telegram.png'
import tiktok from '../../assets/icons/notification-apps/tiktok.png'
import uber from '../../assets/icons/notification-apps/uber.png'
import weather from '../../assets/icons/notification-apps/weather.png'
import wechat from '../../assets/icons/notification-apps/wechat.png'
import whatsapp from '../../assets/icons/notification-apps/whatsapp.png'
import x from '../../assets/icons/notification-apps/x.png'
import youtube from '../../assets/icons/notification-apps/youtube.png'

const IC_IMG = (img) => ({ image: img })
const IC_SVG = (bg, svg, style = '') => ({ bg, svg, style })

export const NOTIF_ICONS = {
  wechat: IC_IMG(wechat),
  whatsapp: IC_IMG(whatsapp),
  facebook: IC_IMG(facebook),
  instagram: IC_IMG(instagram),
  tiktok: IC_IMG(tiktok),
  spotify: IC_IMG(spotify),
  gmail: IC_IMG(gmail),
  amazon: IC_IMG(amazon),
  snapchat: IC_IMG(snapchat),
  uber: IC_IMG(uber),
  google: IC_IMG(google),
  pinterest: IC_IMG(pinterest),
  x: IC_IMG(x),
  netflix: IC_IMG(netflix),
  telegram: IC_IMG(telegram),
  youtube: IC_IMG(youtube),
  weather: IC_IMG(weather),
  linkedin: IC_IMG(linkedin),
  alipay: IC_IMG(alipay),

  system: IC_SVG('#636366', '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/><path d="M4 21h16" stroke-opacity="0.5"/></svg>'),

  // 兜底：多彩渐变圆点
  default: IC_SVG('linear-gradient(135deg,#A855F7 0%,#3B82F6 100%)', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="rgba(255,255,255,0.85)"/></svg>')
}
