# Codex role

Branch: `codex/lane`

Development port: `8888`

Current module ownership:

- Notification Center and Dynamic Island behavior and presentation
- `src/components/system/NotificationCenter.vue`
- `src/components/system/DynamicIsland.vue`
- `src/components/system/MusicPlayerCard.vue`
- `src/components/ui/NotificationCard.vue`
- `src/components/ui/NotificationIcon.vue`
- `src/components/ui/notifIcons.js`
- `src/components/ui/IslandCloseModal.vue`
- `src/composables/useActiveActivities.js`
- `src/stores/notificationsStore.js`
- `src/config/seedNotifications.js`
- Notification Center and Dynamic Island-specific reproduction scripts and tests

Lock Screen notification integration (`src/components/system/LockScreen.vue`), StatusBar indicators (`src/components/phone/StatusBar.vue`), System shell files, global styles, and generic animation/gesture utilities are not automatically owned. Request an explicit lock in `ACTIVE_TASKS.md` before changing them.

Before handoff run `npm test` and `npm run build` when those scripts exist.
