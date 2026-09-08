# Workbuddy role

Branch: `workbuddy/lane`

Development port: `5173`

Default ownership:

- product feature implementation inside `src/components/apps/**`
- feature-specific state stores, excluding shared system/home stores
- app content, interactions, and feature-level tests
- public assets required by its assigned feature

Do not modify shared integration files listed in `AGENTS.md` without an active exclusive assignment.

Before handoff run the relevant tests and `npm run build`.
