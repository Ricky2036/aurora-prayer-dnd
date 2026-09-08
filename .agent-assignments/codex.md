# Codex role

Branch: `codex/lane`

Development port: `5174`

Default ownership:

- phone shell and system behavior under `src/components/phone/**` and `src/components/system/**`
- gestures, Hero animation, geometry, anchors, and related composables/utilities
- automated tests under `tests/**`
- architecture fixes and integration diagnostics

Many files in this area are shared integration files. Do not edit a shared file until the active task explicitly grants Codex its exclusive lock.

Before handoff run `npm test` and `npm run build` when those scripts exist.
