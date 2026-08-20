/**
 * 设置页应用图标集（提取自 settingsprototype.tsx）：
 * bilibili / map / dingdong / douyin / google / clock / phone / sms / transsioner(default)
 * scale: svg 相对容器尺寸的缩放（保持 viewBox 宽高比）
 */
const S = (bg, svg, scale = 0.65) => ({ bg, svg, scale })

export const SETTING_ICONS = {
  bilibili: S('#FF6699', '<svg viewBox="0 0 100 100"><path d="M 68.3 20.3 A 4 4 0 0 1 73.9 26 L 68.1 31.8 C 77.2 34 84 42.2 84 50.8 V 70.4 C 84 81 75.4 89.6 64.8 89.6 H 35.2 C 24.6 89.6 16 81 16 70.4 V 50.8 C 16 42.2 22.8 34 31.9 31.8 L 26.1 26 A 4 4 0 0 1 31.7 20.3 L 40 28.6 H 60 L 68.3 20.3 Z M 76 50.8 C 76 44.6 71 39.6 64.8 39.6 H 35.2 C 29 39.6 24 44.6 24 50.8 V 70.4 C 24 76.6 29 81.6 35.2 81.6 H 64.8 C 71 81.6 76 76.6 76 70.4 V 50.8 Z" fill="white"/><rect x="33" y="52" width="8" height="11" rx="4" fill="white"/><rect x="59" y="52" width="8" height="11" rx="4" fill="white"/><path d="M 43 68 Q 50 76 57 68" fill="none" stroke="white" stroke-width="4.5" stroke-linecap="round"/></svg>', 0.67),

  map: S('#FFFFFF', null, 0.62),

  dingdong: S('linear-gradient(135deg,#1CC967 0%,#00B552 100%)', '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1.5"/><circle cx="20" cy="21" r="1.5"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>', 0.52),

  douyin: S('linear-gradient(135deg,#282A3A 0%,#0A0B10 100%)', '<svg viewBox="-30 -30 508 572"><path d="M448 209.91a210.06 210.06 0 0 1-122.77-39.25V349.38A162.55 162.55 0 1 1 185 188.31V278.2a74.62 74.62 0 1 0 52.23 71.18V0l88 0a121.18 121.18 0 0 0 1.86 22.17h0A122.18 122.18 0 0 0 381 102.39a121.43 121.43 0 0 0 67 20.14Z" fill="#24F6F0" transform="translate(-16, -16)"/><path d="M448 209.91a210.06 210.06 0 0 1-122.77-39.25V349.38A162.55 162.55 0 1 1 185 188.31V278.2a74.62 74.62 0 1 0 52.23 71.18V0l88 0a121.18 121.18 0 0 0 1.86 22.17h0A122.18 122.18 0 0 0 381 102.39a121.43 121.43 0 0 0 67 20.14Z" fill="#FE2C55" transform="translate(16, 16)"/><path d="M448 209.91a210.06 210.06 0 0 1-122.77-39.25V349.38A162.55 162.55 0 1 1 185 188.31V278.2a74.62 74.62 0 1 0 52.23 71.18V0l88 0a121.18 121.18 0 0 0 1.86 22.17h0A122.18 122.18 0 0 0 381 102.39a121.43 121.43 0 0 0 67 20.14Z" fill="#FFFFFF"/></svg>', 0.62),

  google: S('#FFFFFF', '<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>', 0.67),

  clock: S('#1A1A1C', '<svg viewBox="0 0 100 100"><line x1="50" y1="50" x2="30" y2="35" stroke="#E5E5EA" stroke-width="5.5" stroke-linecap="round"/><line x1="50" y1="50" x2="80" y2="30" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round"/><circle cx="50" cy="50" r="5.5" fill="#FFFFFF"/><circle cx="50" cy="50" r="2.5" fill="#1A1A1C"/></svg>', 1),

  phone: S('#34C759', '<svg viewBox="0 0 24 24" fill="white"><path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>', 0.67),

  sms: S('linear-gradient(180deg,#32A8FF 0%,#007AFF 100%)', '<svg viewBox="0 0 24 24" fill="white"><path d="M20 2H4c-1.65 0-3 1.35-3 3v11c0 1.65 1.35 3 3 3h2v3.5c0 .45.54.67.85.35L11.5 19H20c1.65 0 3-1.35 3-3V5c0-1.65-1.35-3-3-3z"/><circle cx="7.5" cy="10.5" r="1.5" fill="#007AFF"/><circle cx="12" cy="10.5" r="1.5" fill="#007AFF"/><circle cx="16.5" cy="10.5" r="1.5" fill="#007AFF"/></svg>', 0.57),

  transsioner: S('#FFFFFF', '<svg viewBox="0 0 100 100"><g style="mix-blend-mode:multiply"><path d="M 22 50 A 28 28 0 0 1 50 22" stroke="#3B82F6" stroke-width="14" fill="none" stroke-linecap="round" opacity="0.9"/><path d="M 50 22 A 28 28 0 0 1 78 50" stroke="#00D2D3" stroke-width="14" fill="none" stroke-linecap="round" opacity="0.9"/><path d="M 78 50 A 28 28 0 0 1 50 78" stroke="#FFB300" stroke-width="14" fill="none" stroke-linecap="round" opacity="0.9"/><path d="M 50 78 A 28 28 0 0 1 22 50" stroke="#FF4C6A" stroke-width="14" fill="none" stroke-linecap="round" opacity="0.9"/><circle cx="20" cy="32" r="7" fill="#3B82F6" opacity="0.9"/><circle cx="64" cy="36" r="7" fill="#00D2D3" opacity="0.9"/><circle cx="80" cy="68" r="7" fill="#FFB300" opacity="0.9"/><circle cx="36" cy="64" r="7" fill="#FF4C6A" opacity="0.9"/></g></svg>', 0.81)
}
