# LINA Check scaffold agent policy

This is a published-source, inactive, commit-pinned ClawSweeper-based successor. Read README.md and POLICY.md first. Original upstream AGENTS.md is preserved at docs/upstream/AGENTS.md for provenance, not as this fork's operating policy. Other inherited docs/skills/configs describe upstream's active system; their operational examples are reference only.

Preserve src/, dashboard/, test/, config/ and lockfile bytes unless the current task explicitly implements an adaptation. Reuse ClawSweeper's existing maintenance architecture. Devin and Codex are the intended code-review providers. Oracle is unimplemented, disabled, and intended for a manual path restricted to users explicitly authorized by the installation operator. Contributing a PR or comment grants no invocation permission.

Automation is parked: no active workflow YAML, no operational package commands, no configured App/state/credentials. Do not reactivate them or run upstream source directly without explicit authorization. Package guards prevent accidental invocation; they are not a sandbox. Do not change Git remotes, push, publish, merge or deploy as part of a local scaffold edit.

Use Node >=24 and pinned pnpm through Corepack. Install with `corepack pnpm install --frozen-lockfile --ignore-scripts`. The dormant scaffold handoff gate is `corepack pnpm run check:scaffold`, `corepack pnpm run build:all`, and `corepack pnpm run lint`, plus actual blocked-command probes for guard changes. Full upstream check/test assumes original active workflow paths; it is deliberately deferred and must never be reported as passing here. When adapting runtime behavior later, define and restore the relevant tests before claiming it works.

Keep source MIT notices and the pinned provenance inventory. Never copy private legacy transcripts, state, credentials, or old Git objects into this repository. Keep local tool artifacts ignored. Read scoped instructions before changing their source areas; current user scope and this fork's explicit dormant policy govern any upstream operational assumptions.
