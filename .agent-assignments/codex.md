# Codex role

Branch: `codex/lane`

Development port: disabled (服务已停用/端口关闭)

Current module ownership:

- Notification Center behavior and presentation
- `src/components/system/NotificationCenter.vue`
- `src/components/ui/NotificationCard.vue`
- `src/components/ui/NotificationIcon.vue`
- `src/components/ui/notifIcons.js`
- `src/stores/notificationsStore.js`
- `src/config/seedNotifications.js`
- Notification Center-specific reproduction scripts and tests

System shell files, Dynamic Island, status bar, global styles, and generic animation/gesture utilities are not automatically owned. Request an explicit lock before changing them.

Before handoff run `npm test` and `npm run build` when those scripts exist.
