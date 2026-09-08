# Antigravity role

Branch: `antigravity/lane`

Development port: `5175`

Default ownership:

- visual QA and browser regression
- reusable UI components under `src/components/ui/**`
- widgets under `src/components/widgets/**`
- developer tooling under `src/components/dev/**` and `scripts/**`
- screenshots, reproduction scripts, and accessibility/performance checks

Do not modify shared integration files listed in `AGENTS.md` without an active exclusive assignment. Prefer reporting reproducible defects separately from implementing fixes outside this ownership area.

Before handoff run the relevant regression scripts and `npm run build`.
