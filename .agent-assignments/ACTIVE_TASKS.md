# Active task register

Only the integration owner edits this table. Remove or mark a row complete after its commit is integrated.

| Status | Agent | Task | Branch | Exclusive files/directories | Base commit | Handoff commit |
| --- | --- | --- | --- | --- | --- | --- |
| Inactive | Codex | Notification Center module (Transferred to Antigravity) | `codex/lane` | None (handed off) | `232b5bc` | — |
| Active | Workbuddy | Control Center module | `workbuddy/lane` | `src/components/system/ControlCenter.vue`; `src/components/system/cc/**`; `src/stores/controlStore.js`; `src/components/dev/ControlCenterFineTunePanel.vue`; Control Center-specific scripts/tests | `232b5bc` | — |
| Active | Antigravity | Independent apps, integration, Notification Center & Lock Screen Live Activities | `antigravity/lane` plus integration worktree | `src/components/apps/**`; `src/components/phone/ScreenView.vue`; `src/components/system/NotificationCenter.vue`; `src/components/system/LockScreen.vue`; `src/composables/useActiveActivities.js`; app-specific stores/assets/tests; integration-only shared registration files | `232b5bc` | `ea5bd15` |

Status values: `Active`, `Review`, `Merged`, or `Blocked`.
