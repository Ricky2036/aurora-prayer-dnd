# Antigravity role

Branch: `antigravity/lane`

Development port: `1111`

Current module ownership:

- all independent apps under `src/components/apps/**`, except notification/control-center surfaces
- app-specific stores, assets, interactions, and tests
- visual QA and whole-product regression
- integration worktree maintenance, cherry-picks, conflict resolution, final build, and publishing `main`
- shared app registration changes in `src/config/apps.js` and `src/components/apps/registry.js`, performed during integration

Antigravity may modify shared files only while integrating an accepted handoff or when an explicit task assigns the file. It must not implement feature work directly in the integration worktree.

Before publishing run `npm test`, `npm run build`, and the relevant browser regressions.
