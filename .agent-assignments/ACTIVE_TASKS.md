# Active task register

Only the integration owner edits this table. Remove or mark a row complete after its commit is integrated.

| Status | Agent | Task | Branch | Exclusive files/directories | Base commit | Handoff commit |
| --- | --- | --- | --- | --- | --- | --- |
| Active | Codex | Notification Center module | `codex/lane` | `src/components/system/NotificationCenter.vue`; `src/components/ui/NotificationCard.vue`; `src/components/ui/NotificationIcon.vue`; `src/components/ui/notifIcons.js`; `src/stores/notificationsStore.js`; `src/config/seedNotifications.js` | `232b5bc` | — |
| Active | Workbuddy | Control Center module | `workbuddy/lane` | `src/components/system/ControlCenter.vue`; `src/components/system/cc/**`; `src/stores/controlStore.js`; `src/components/dev/ControlCenterFineTunePanel.vue`; Control Center-specific scripts/tests | `232b5bc` | — |
| Active | Antigravity | Independent apps and integration | `antigravity/lane` plus integration worktree | `src/components/apps/**`; app-specific stores/assets/tests; integration-only shared registration files | `232b5bc` | — |

Status values: `Active`, `Review`, `Merged`, or `Blocked`.
