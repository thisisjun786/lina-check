# LINA Check local scaffold policy

This checkout is a dormant ClawSweeper-based development starting point. It is not a deployed LINA Check service. Local build/lint and source-integrity checks are enabled; operational commands and GitHub workflows remain disabled.

ClawSweeper is the implementation base for repository management and next-action guidance. Devin/Codex code review and Jun-only Oracle invocation are intended integrations, not implemented capabilities. Auto-fix, close, merge, labels/comments and state publication remain inactive. The manifest documents intent; it does not implement permissions or runtime enforcement.

No push, public conversion, GitHub App installation, secret provisioning, model call, service migration, merge or deployment is implied by scaffold validation. Enabling automation requires an explicit follow-up that adapts upstream targets/permissions/state, implements appropriate gates, and verifies the selected behavior. Raw node/npx commands can bypass package guards and must not be used to start upstream operations in this stage.

The initial validation contract is check:scaffold + build:all + lint with pinned pnpm, plus blocked-command activation checks. Upstream full tests/check depend on intentionally parked workflow paths and are deferred. Preserve upstream license and provenance. Keep private legacy artifacts outside this source tree.
