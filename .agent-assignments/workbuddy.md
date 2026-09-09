# Workbuddy role

Branch: `workbuddy/lane`

Development port: `6666`

Current module ownership:

- Control Center behavior and presentation
- `src/components/system/ControlCenter.vue`
- `src/components/system/cc/**`
- `src/stores/controlStore.js`
- `src/components/dev/ControlCenterFineTunePanel.vue`
- Control Center-specific scripts and tests, including `scripts/debug-cc-drag.mjs` and `scripts/shots-cc.mjs`

Related reusable UI files such as `SliderControl.vue`, `ToggleSwitch.vue`, and global styles are not automatically owned. Request an explicit lock before changing them.

Do not modify shared integration files listed in `AGENTS.md` without an active exclusive assignment.

Before handoff run the relevant tests and `npm run build`.
