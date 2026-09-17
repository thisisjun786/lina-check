/**
 * Definition: validate the LINA Check derived-change declaration found in
 * config/lina-check-scaffold.json against literals owned by this module.
 *
 * Ownership rule: the literals below decide WHICH derived files, derived
 * scripts, restored upstream tests and boundary-probe targets are permitted.
 * The configuration file owns only the recorded reason for each entry, so
 * editing configuration alone cannot widen any of these sets.
 *
 * Every rejection throws DerivedContractError with a stable code, so the
 * accompanying self-test can assert that each rejection path really rejects.
 */

import { createHash } from "node:crypto";

export const TRIPWIRE_ENV = "LINA_CHECK_SPAWN_TRIPWIRE";
export const PLAN_UNIT = "devlog/_plan/260917_jun135_part_a";
export const PLAN_UNIT_JUN198 = "devlog/_plan/260917_jun198_install_profile";
export const PLAN_UNIT_JUN203 = "devlog/_plan/260917_jun203_safe_test_lane";
export const PLAN_UNIT_JUN223 = "devlog/_plan/260917_jun223_lost_coverage";

/**
 * Plan units whose documents may be declared as derived files. Listing them here
 * rather than widening the pattern to all of devlog/_plan keeps a new directory
 * name from silently becoming an accepted location.
 */
export const PLAN_UNITS = Object.freeze([
  PLAN_UNIT,
  PLAN_UNIT_JUN198,
  PLAN_UNIT_JUN203,
  PLAN_UNIT_JUN223,
]);

export const DERIVED_SCRIPT_NAMES = Object.freeze([
  "lina:boundary-probe",
  "lina:contract-selftest",
  "lina:test-safe",
  "lina:test-safe:preview",
]);

/**
 * Exact command for each derived script. Pinning the names alone is not enough:
 * a matching pair of edits to the configuration and package.json could otherwise
 * point lina:test-safe:preview at the run mode, or point a script at an inert
 * module, while every name check still passed.
 */
export const DERIVED_SCRIPT_COMMANDS = Object.freeze({
  "lina:boundary-probe": "node scripts/lina-check-boundary-probe.mjs",
  "lina:contract-selftest": "node scripts/lina-check-contract-selftest.mjs",
  "lina:test-safe": "node scripts/lina-check-safe-tests.mjs run",
  "lina:test-safe:preview": "node scripts/lina-check-safe-tests.mjs preview",
});

/**
 * The probe must not invoke anything unless the guard it relies on is unchanged.
 *
 * The digest duplicates the guard's bytes on purpose. A legitimate guard edit is
 * meant to require a deliberate, reviewable digest update: that coupling is the
 * security property, not an oversight. Deriving the expected value from the file
 * being checked would make the check vacuous.
 */
export const GUARD_PATH = "scripts/scaffold-disabled.mjs";
export const GUARD_SHA256 = "3ca3cf5b1fa79fa18b5f492e70415ccb19d44fbfcbed5fe099a5d928bfd7b573";

/** GitHub reads both spellings, so parking only the .yml form proves nothing. */
export const WORKFLOW_EXTENSIONS = Object.freeze([".yml", ".yaml"]);

/**
 * Decide whether one source file's built output may be trusted.
 *
 * Comparing the newest file anywhere under src/ with the newest file anywhere
 * under dist/ is not sufficient: a partial build such as build:repair refreshes
 * unrelated output and makes the whole tree look current while the module a
 * restored test imports stays old. Freshness is therefore decided per
 * source/output pair. Kept pure so the self-test can cover every case without
 * touching the filesystem.
 */
export function classifyBuildPair({ outputExists, sourceMtimeMs, outputMtimeMs }) {
  if (!outputExists) return "missing";
  if (!Number.isFinite(sourceMtimeMs) || !Number.isFinite(outputMtimeMs)) return "unknown";
  return sourceMtimeMs > outputMtimeMs ? "stale" : "current";
}

/**
 * Every disposition the runner may report for built output. Consumers validate
 * against this set, so a malformed or tampered report is rejected instead of
 * quietly taking a lenient branch.
 */
export const BUILD_DISPOSITIONS = Object.freeze([
  "absent",
  "empty",
  "fresh",
  "incomplete",
  "orphaned",
  "stale",
  "unknown",
]);

/**
 * This project pins pnpm through Corepack (AGENTS.md). A probe that silently
 * accepted an arbitrary PATH pnpm would certify the guards under an unsupported
 * package manager, so the observed version must equal the pinned one.
 */
export function assertPinnedPnpm(packageManagerField, observedVersion) {
  const expected = String(packageManagerField).replace(/^pnpm@/, "");
  if (observedVersion !== expected)
    fail("launcher-unpinned", "expected pnpm " + expected + ", observed " + observedVersion);
}

/**
 * Upstream tests restored for execution: hermetic and compatible with the parked
 * profile. Membership is decided here; the declaration in configuration records
 * only why each entry is safe to run, so editing configuration alone cannot widen
 * the lane.
 */
export const SAFE_TESTS = Object.freeze([
  "test/actions-checkout-v7.test.ts",
  "test/agent-input-scan-fixtures.test.ts",
  "test/apply-author-pr-budget-policy.test.ts",
  "test/apply-close-policy-guards.test.ts",
  "test/apply-close-retry-policy.test.ts",
  "test/apply-cursor-trace.test.ts",
  "test/apply-guard-read-cache.test.ts",
  "test/apply-label-sync.test.ts",
  "test/apply-live-state.test.ts",
  "test/apply-managed-locale-pr.test.ts",
  "test/apply-obsolete-fix-pr-policy.test.ts",
  "test/apply-pr-coverage-proof-close.test.ts",
  "test/apply-pr-coverage-proof-recheck.test.ts",
  "test/apply-pr-duplicate-proof.test.ts",
  "test/apply-pr-duplicate-ref-proof.test.ts",
  "test/apply-pr-promotion.test.ts",
  "test/apply-pr-supersession-promotion.test.ts",
  "test/apply-pr-supersession-safety.test.ts",
  "test/apply-product-direction-policy.test.ts",
  "test/apply-same-author-pair-close.test.ts",
  "test/apply-stale-version-bug-policy.test.ts",
  "test/apply-stalled-pr-policies.test.ts",
  "test/apply-unsponsored-feature-policy.test.ts",
  "test/assist-artifact.test.ts",
  "test/audit-health-roundtrip.test.ts",
  "test/automerge-metrics.test.ts",
  "test/automerge-workflow-scheduler.test.ts",
  "test/bay-inline-proof.test.ts",
  "test/bay-queue-disposition.test.ts",
  "test/bulk-filer-policy.test.ts",
  "test/canonical-state-readers.test.ts",
  "test/check-dashboard-strict.test.ts",
  "test/check-docs.test.ts",
  "test/clawsweeper-command-dispatch.test.ts",
  "test/clawsweeper-record-metadata.test.ts",
  "test/clawsweeper-text.test.ts",
  "test/close-reasons.test.ts",
  "test/codex-app-server-output.test.ts",
  "test/codex-output-last-message.test.ts",
  "test/command-proof-review.test.ts",
  "test/compatibility-proof.test.ts",
  "test/context.test.ts",
  "test/dashboard-health.test.ts",
  "test/dashboard-operational-health.test.ts",
  "test/dashboard-public-observability.test.ts",
  "test/dashboard-review-proof-execution.test.ts",
  "test/dashboard-review-proof-producer-auth.test.ts",
  "test/dashboard-review-proof-zip.test.ts",
  "test/decision-parser.test.ts",
  "test/durable-storage.test.ts",
  "test/exact-review-health.test.ts",
  "test/exact-review-lifecycle-bay.test.ts",
  "test/exact-review-publication-retry.test.ts",
  "test/exact-review-read-model-equivalence.test.ts",
  "test/exact-review-scheduled-capacity.test.ts",
  "test/fixed-sha-pull-resolution.test.ts",
  "test/github-json.test.ts",
  "test/idea-archive-revival.test.ts",
  "test/label-mutation-batch.test.ts",
  "test/live-proof-report.test.ts",
  "test/live-read-generation.test.ts",
  "test/manual-publication-authority.test.ts",
  "test/manual-publication-policy.test.ts",
  "test/openclaw-bay-proof-network.test.ts",
  "test/openclaw-file-role.test.ts",
  "test/oversized-pr-freshness.test.ts",
  "test/pages-workflow.test.ts",
  "test/parked-command-finalization.test.ts",
  "test/pr-admission-input.test.ts",
  "test/pr-close-coverage-proof.test.ts",
  "test/pr-comment-activity-revision.test.ts",
  "test/pr-hydration-snapshot.test.ts",
  "test/pr-label-policy.test.ts",
  "test/pr-proof-automation.test.ts",
  "test/pr-review-comment-risk.test.ts",
  "test/pr-review-labels.test.ts",
  "test/pr-surface-policy.test.ts",
  "test/pr-surface-stats.test.ts",
  "test/primary-body.test.ts",
  "test/queue-pressure.test.ts",
  "test/recent-durable-publication-events.test.ts",
  "test/related-context.test.ts",
  "test/repair/action-session.test.ts",
  "test/repair/adaptive-review-budget.test.ts",
  "test/repair/automerge-e2e-container.test.ts",
  "test/repair/automerge-e2e-workflow.test.ts",
  "test/repair/automerge-outcome.test.ts",
  "test/repair/automerge-shepherd.test.ts",
  "test/repair/automerge-status-timeline.test.ts",
  "test/repair/automerge-telemetry-workflow.test.ts",
  "test/repair/closed-publication-retirement.test.ts",
  "test/repair/codex-transient.test.ts",
  "test/repair/collect-codex-debug.test.ts",
  "test/repair/command-ack-convergence.test.ts",
  "test/repair/command-action-ledger.test.ts",
  "test/repair/command-ops-action-ledger.test.ts",
  "test/repair/command-proof-batch.test.ts",
  "test/repair/command-proof-profiles.test.ts",
  "test/repair/comment-router-config.test.ts",
  "test/repair/comment-router-core.test.ts",
  "test/repair/comment-router-ledger-merge.test.ts",
  "test/repair/comment-router-read-model.test.ts",
  "test/repair/comment-router-utils.test.ts",
  "test/repair/comment-webhook-body.test.ts",
  "test/repair/conflict-self-heal-core.test.ts",
  "test/repair/contained-command-sandbox.test.ts",
  "test/repair/containment-preflight.test.ts",
  "test/repair/detached-cleanup.test.ts",
  "test/repair/deterministic-automerge-result.test.ts",
  "test/repair/direct-re-review-admission.test.ts",
  "test/repair/endor-autofix-intake.test.ts",
  "test/repair/error-fingerprint.test.ts",
  "test/repair/event-apply-proof.test.ts",
  "test/repair/event-record-store.test.ts",
  "test/repair/exact-review-batch-publisher.test.ts",
  "test/repair/exact-review-batch-queue-client.test.ts",
  "test/repair/exact-review-command-queue.test.ts",
  "test/repair/execute-fix-github.test.ts",
  "test/repair/execute-fix-policy.test.ts",
  "test/repair/execute-fix-validation.test.ts",
  "test/repair/execute-fix-worker-errors.test.ts",
  "test/repair/external-messages.test.ts",
  "test/repair/fanout-hydration-routing.test.ts",
  "test/repair/fix-edit-policy.test.ts",
  "test/repair/focused-state-hydration.test.ts",
  "test/repair/gitcrawl-cluster-history.test.ts",
  "test/repair/gitcrawl-store.test.ts",
  "test/repair/glob-files.test.ts",
  "test/repair/issue-implementation-status.test.ts",
  "test/repair/issue-source-guard.test.ts",
  "test/repair/issue-worker-recovery.test.ts",
  "test/repair/job-intent.test.ts",
  "test/repair/live-worker-capacity.test.ts",
  "test/repair/mechanical-rebase-conflicts.test.ts",
  "test/repair/notify-events.test.ts",
  "test/repair/notify-github-activity.test.ts",
  "test/repair/notify-maintainer-report.test.ts",
  "test/repair/notify-merge.test.ts",
  "test/repair/pr-title.test.ts",
  "test/repair/publish-github-info.test.ts",
  "test/repair/publish-main.test.ts",
  "test/repair/publish-markdown.test.ts",
  "test/repair/record-tuple.test.ts",
  "test/repair/repair-branch-push-errors.test.ts",
  "test/repair/repair-containment-smoke-workflow.test.ts",
  "test/repair/repair-merge-message.test.ts",
  "test/repair/replacement-branch-head.test.ts",
  "test/repair/replacement-labels.test.ts",
  "test/repair/requeue-job-key.test.ts",
  "test/repair/resolve-result-targets.test.ts",
  "test/repair/review-dispatch-coordination.test.ts",
  "test/repair/security-boundary.test.ts",
  "test/repair/source-pr-checkout.test.ts",
  "test/repair/spam-comment-intake.test.ts",
  "test/repair/spam-scanner-core.test.ts",
  "test/repair/state-append-client.test.ts",
  "test/repair/state-delta-paths.test.ts",
  "test/repair/state-repo-guardrails.test.ts",
  "test/repair/state-writer-coordinator.test.ts",
  "test/repair/state-writer-telemetry-recorder.test.ts",
  "test/repair/status-check-rollup.test.ts",
  "test/repair/sweep-status-merge.test.ts",
  "test/repair/tag-clawsweeper-targets.test.ts",
  "test/repair/telegram-proof-evidence.test.ts",
  "test/repair/telegram-qa-evidence.test.ts",
  "test/repair/terminal-command-status-fence.test.ts",
  "test/repair/text-utils.test.ts",
  "test/repair/update-review-status.test.ts",
  "test/repair/url-safety.test.ts",
  "test/repair/validate-all.test.ts",
  "test/repair/validation-command-utils.test.ts",
  "test/repair/workflow-sparse-checkout.test.ts",
  "test/report-evidence-neutralization.test.ts",
  "test/report-metadata-audit.test.ts",
  "test/repository-managed-pr-policy.test.ts",
  "test/repository-profiles.test.ts",
  "test/review-activity-cursor.test.ts",
  "test/review-checkout-access.test.ts",
  "test/review-comment-markers.test.ts",
  "test/review-comment-noise.test.ts",
  "test/review-comment-noop.test.ts",
  "test/review-comment-publication.test.ts",
  "test/review-comment-rendering.test.ts",
  "test/review-content-cache.test.ts",
  "test/review-coverage-manifest.test.ts",
  "test/review-history.test.ts",
  "test/review-observability.test.ts",
  "test/review-placeholder-recovery.test.ts",
  "test/review-preparation.test.ts",
  "test/review-prompt-context.test.ts",
  "test/review-prompt-policy.test.ts",
  "test/review-proof-client.test.ts",
  "test/review-recovery-label-backfill.test.ts",
  "test/review-reliability-workflow.test.ts",
  "test/review-retry-fencing-proof.test.ts",
  "test/review-run-telemetry.test.ts",
  "test/review-state-contract.test.ts",
  "test/review-structural-cache.test.ts",
  "test/scheduler-policy.test.ts",
  "test/stable-json.test.ts",
  "test/state-writer-coordinator.test.ts",
  "test/state-writer-telemetry.test.ts",
  "test/state-writer-workflow.test.ts",
  "test/sweep-status.test.ts",
  "test/worker-records-request.test.ts",
  "test/workflow-runner-labels.test.ts",
]);

/**
 * The restored-test count this change establishes. It is an invariant, not a
 * description: a silent widening or a dropped entry must fail at import rather
 * than at the first run that quietly covered less than the last one did.
 */
export const SAFE_TEST_COUNT = 206;

/**
 * The shape every restored-test list must hold, kept as a function so the
 * self-test can feed it a wrong count, an unsorted list and a duplicate and
 * observe each refusal. An inline comparison could only ever be exercised by
 * breaking the module itself, which is not a test.
 */
export function assertSafeTestListShape(list, expectedCount) {
  if (!Array.isArray(list)) fail("safe-test-shape", "the restored-test list must be an array");
  if (list.length !== expectedCount)
    fail("safe-test-count", list.length + " paths, expected " + expectedCount);
  if (!isSortedUnique(list)) fail("safe-test-order", "restored tests must be sorted and unique");
  return list.length;
}

/** Hermetic but structurally incompatible with the dormant profile; never restored. */
export const EXCLUDED_TESTS = Object.freeze([
  "test/actions-runtime.test.ts",
  "test/clawsweeper-action-ledger.test.ts",
  "test/dashboard-github-api.test.ts",
  "test/exact-review-failure-telemetry.test.ts",
  "test/github-response-deadlines.test.ts",
  "test/hosted-target-admission.test.ts",
  "test/repair/comment-webhook.test.ts",
  "test/review-close-policy.test.ts",
  "test/run-node-tests.test.ts",
  "test/scheduled-review-noop.test.ts",
]);

/**
 * Restored tests that run against pinned upstream bytes rather than this fork's
 * files, because their working-directory reads land on files this fork parks or
 * replaces. The runner materialises the declared paths from the pin into a
 * temporary directory and moves only the working directory; the test bytes are
 * untouched, so this reaches reads resolved through the working directory and
 * nothing else.
 *
 * githubTree is a rule rather than a copied list. A test that walks
 * .github/workflows must see the whole pinned tree: restoring part of it lets the
 * traversal shrink in silence and report unexamined workflows as examined. The
 * membership is therefore derived from the pin and checked against
 * PINNED_GITHUB_TREE_SIZE, which catches a tree that changed size instead of
 * trusting a hand-copied list to have stayed complete.
 *
 * What a green fixture result proves is that upstream logic still behaves on
 * upstream input. It proves nothing about this fork's own files; those are
 * asserted separately by check:scaffold.
 */
export const PINNED_GITHUB_PREFIX = ".github/";
export const PINNED_GITHUB_TREE_SIZE = 56;

export function pinnedGithubTree(paths) {
  const files = [...paths].filter((path) => path.startsWith(PINNED_GITHUB_PREFIX)).sort();
  if (files.length !== PINNED_GITHUB_TREE_SIZE)
    fail("fixture-github-tree", files.length + " paths under " + PINNED_GITHUB_PREFIX);
  return files;
}

export const UPSTREAM_FIXTURE_TESTS = Object.freeze({
  "test/actions-checkout-v7.test.ts": Object.freeze({
    githubTree: true,
    files: Object.freeze([]),
  }),
  "test/assist-artifact.test.ts": Object.freeze({
    githubTree: true,
    files: Object.freeze([
      "src/clawsweeper-assist.ts",
    ]),
  }),
  "test/canonical-state-readers.test.ts": Object.freeze({
    githubTree: true,
    files: Object.freeze([
      "scripts/hydrate-state.ts",
    ]),
  }),
  "test/pages-workflow.test.ts": Object.freeze({
    githubTree: true,
    files: Object.freeze([]),
  }),
  "test/repair/automerge-e2e-workflow.test.ts": Object.freeze({
    githubTree: true,
    files: Object.freeze([]),
  }),
  "test/repair/automerge-telemetry-workflow.test.ts": Object.freeze({
    githubTree: true,
    files: Object.freeze([]),
  }),
  "test/repair/command-ops-action-ledger.test.ts": Object.freeze({
    githubTree: true,
    files: Object.freeze([
      "src/repair/requeue-job.ts",
      "src/repair/update-command-status.ts",
    ]),
  }),
  "test/repair/comment-router-core.test.ts": Object.freeze({
    githubTree: true,
    files: Object.freeze([
      "scripts/dispatch-receipt-owner.sh",
      "src/repair/comment-router-core.ts",
      "src/repair/comment-router.ts",
    ]),
  }),
  "test/repair/fanout-hydration-routing.test.ts": Object.freeze({
    githubTree: true,
    files: Object.freeze([]),
  }),
  "test/repair/focused-state-hydration.test.ts": Object.freeze({
    githubTree: true,
    files: Object.freeze([]),
  }),
  "test/repair/gitcrawl-store.test.ts": Object.freeze({
    githubTree: true,
    files: Object.freeze([
      "docs/limits.md",
      "docs/related-issue-discovery.md",
      "docs/repair/README.md",
      "docs/repair/internal-features.md",
      "src/repair/dispatch-jobs.ts",
      "src/repair/import-gitcrawl-clusters.ts",
      "src/repair/import-gitcrawl-low-signal-prs.ts",
      "src/repair/select-cluster-candidate.ts",
    ]),
  }),
  "test/repair/issue-implementation-status.test.ts": Object.freeze({
    githubTree: true,
    files: Object.freeze([]),
  }),
  "test/repair/repair-containment-smoke-workflow.test.ts": Object.freeze({
    githubTree: true,
    files: Object.freeze([]),
  }),
  "test/repair/resolve-result-targets.test.ts": Object.freeze({
    githubTree: true,
    files: Object.freeze([]),
  }),
  "test/repair/tag-clawsweeper-targets.test.ts": Object.freeze({
    githubTree: true,
    files: Object.freeze([
      "src/repair/tag-clawsweeper-targets.ts",
    ]),
  }),
  "test/repair/workflow-sparse-checkout.test.ts": Object.freeze({
    githubTree: true,
    files: Object.freeze([
      "package.json",
      "scripts/prepare-exact-review-batch.mjs",
      "tsconfig.repair.json",
    ]),
  }),
  "test/report-metadata-audit.test.ts": Object.freeze({
    githubTree: true,
    files: Object.freeze([]),
  }),
  "test/repository-profiles.test.ts": Object.freeze({
    githubTree: false,
    files: Object.freeze([
      "config/target-repositories.json",
      "dashboard/wrangler.toml",
    ]),
  }),
  "test/review-comment-rendering.test.ts": Object.freeze({
    githubTree: true,
    files: Object.freeze([
      "src/clawsweeper-apply-close-execution.ts",
      "src/clawsweeper-apply-decision-workflow.ts",
      "src/clawsweeper-item-context.ts",
      "src/clawsweeper-review-command-workflow.ts",
      "src/clawsweeper-review-comment-leases.ts",
      "src/clawsweeper-review-comments-workflow.ts",
      "src/clawsweeper-review-preparation.ts",
      "src/clawsweeper-review-runtime.ts",
      "src/clawsweeper-runtime.ts",
    ]),
  }),
  "test/review-prompt-context.test.ts": Object.freeze({
    githubTree: true,
    files: Object.freeze([
      "prompts/review-item.md",
      "schema/clawsweeper-decision.schema.json",
    ]),
  }),
  "test/review-reliability-workflow.test.ts": Object.freeze({
    githubTree: true,
    files: Object.freeze([]),
  }),
  "test/state-writer-workflow.test.ts": Object.freeze({
    githubTree: true,
    files: Object.freeze([
      "scripts/apply-workflow-helpers.sh",
      "src/repair/git-publish.ts",
    ]),
  }),
  "test/workflow-runner-labels.test.ts": Object.freeze({
    githubTree: true,
    files: Object.freeze([]),
  }),
});

export const UPSTREAM_FIXTURE_TEST_NAMES = Object.freeze(Object.keys(UPSTREAM_FIXTURE_TESTS).sort());

/** The concrete working-directory contents one fixture test is entitled to see. */
export function resolveFixtureFiles(name, paths) {
  const spec = UPSTREAM_FIXTURE_TESTS[name];
  if (!spec) fail("fixture-test-set", name);
  const files = [...(spec.githubTree ? pinnedGithubTree(paths) : []), ...spec.files].sort();
  if (!isSortedUnique(files)) fail("fixture-test-files", name + ": duplicate fixture path");
  return files;
}

/**
 * Upper bound on one test-runner launch. The lane had no bound at all, and a
 * candidate that never terminated would have hung it rather than failing it. A
 * launch stopped at the bound surfaces as a signal outcome, which
 * describeLaunchOutcome reports by name.
 */
export const LANE_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * The exit code a lane stopped by an operator reports. 128 plus the signal
 * number is the shell convention, and reporting it is how an interrupted lane
 * is told apart from a lane whose tests failed.
 */
export function interruptExitCode(signal) {
  if (signal === "SIGINT") return 130;
  if (signal === "SIGTERM") return 143;
  return 1;
}

/**
 * Turn one spawnSync result into the lane's verdict. Pure, so the self-test can
 * walk every branch; the interesting ones are the launch that never started and
 * the launch stopped at the bound, which a bare status check reads as success.
 */
export function describeLaunchOutcome(outcome, timeoutMs = LANE_TIMEOUT_MS) {
  if (typeof outcome !== "object" || outcome === null)
    return { kind: "unusable", detail: "the launcher returned no result", exitCode: 1 };
  // A launch stopped at the bound carries an ETIMEDOUT error AND a SIGTERM
  // signal AND a null status, so it answers to three different checks at once.
  // Reading the error first calls it a launch that never started, which is the
  // opposite of what happened; this branch has to come before both.
  if (outcome.error && outcome.error.code === "ETIMEDOUT")
    return {
      kind: "timeout",
      detail: "the test runner did not finish inside the lane bound of " + timeoutMs + " ms",
      exitCode: 1,
    };
  if (outcome.error)
    return {
      kind: "unstarted",
      detail: String(outcome.error.message ?? outcome.error),
      exitCode: null,
    };
  if (outcome.signal)
    return {
      kind: "signal",
      detail: "terminated by signal " + outcome.signal,
      exitCode: 1,
    };
  if (outcome.status === 0) return { kind: "ok", detail: null, exitCode: 0 };
  return {
    kind: "failed",
    detail: "the test runner exited " + String(outcome.status),
    exitCode: outcome.status === null ? 1 : outcome.status,
  };
}

/**
 * Kill what a timed-out launch left behind.
 *
 * spawnSync's own timeout signals the process it started and nothing else, and
 * the restored lane contains tests that start node, git, curl and local
 * servers. A runner stopped at the bound can therefore exit while a descendant
 * of one of its tests is still holding a port. The launch runs in its own
 * process group so the whole group can be signalled here; the kill is injected
 * so the self-test can walk this without killing anything.
 */
export function reapLaunchGroup(outcome, kill, platform = process.platform) {
  const pid = outcome === null || typeof outcome !== "object" ? undefined : outcome.pid;
  // A pid of 0 or 1 would address this process's own group or init.
  if (!Number.isInteger(pid) || pid <= 1) return { reaped: false, reason: "no usable process group" };
  // A negative pid addresses a process group on POSIX and nothing on Windows,
  // where the call throws and would otherwise be swallowed as "already gone".
  // Saying so is the point: a silent false here reads exactly like the ordinary
  // case where every descendant already exited.
  if (platform === "win32")
    return { reaped: false, reason: "process groups are not signalable on win32; descendants may survive" };
  try {
    kill(-pid, "SIGKILL");
    return { reaped: true, group: -pid };
  } catch (error) {
    // The group is already gone when every descendant exited with the runner,
    // which is the ordinary case and not a failure.
    return { reaped: false, reason: error?.code ?? String(error) };
  }
}

/**
 * Tests this fork wrote, kept separate from the restored upstream set so a
 * report never blurs the two. These cover the admission decision, which the
 * upstream suite for it cannot: test/hosted-target-admission.test.ts opens
 * .github/workflows/hosted-target-admission.yml, and every workflow here is
 * parked, so that file does not exist.
 */
export const DERIVED_TESTS = Object.freeze([
  "test/lina-check-action-ledger.test.ts",
  "test/lina-check-actions-runtime.test.ts",
  "test/lina-check-admission.test.ts",
  "test/lina-check-close-policy.test.ts",
  "test/lina-check-failure-telemetry.test.ts",
  "test/lina-check-github-api.test.ts",
  "test/lina-check-hosted-admission.test.ts",
  "test/lina-check-node-test-runner.test.ts",
  "test/lina-check-response-deadlines.test.ts",
  "test/lina-check-scheduled-review.test.ts",
  "test/lina-check-webhook-admission.test.ts",
]);

/**
 * The modules outside test/ that each derived test may reach, by digest.
 *
 * The closure scan follows imports inside the test tree and reads what it
 * finds. It cannot do that outside: product modules legitimately carry the
 * process-starting surface, and one derived test imports the lane runner on
 * purpose, because that runner's behaviour is the coverage being recovered.
 * Dropping those edges quietly was the gap - a derived test could reach any
 * product module at all and nothing recorded it.
 *
 * So the edge is declared instead of followed, and the declaration is a
 * ceiling: an external import fails until its digest is written here, where
 * it is reviewed.
 *
 * Digests rather than paths, because several of these modules are blocked
 * upstream entrypoints and a derived script may not spell one. That rule is
 * not worked around here: a digest cannot be handed to a loader, so this file
 * still cannot reach any of them. The refusal prints the path it read, and
 * 030_detectors.md carries the list in plain text.
 *
 * The check is one-directional on purpose. The self-test's positive controls
 * replace a declared test's source with two lines, and requiring equality
 * would fail every one of them for the imports that substitution removed.
 */
export const DERIVED_TEST_EXTERNAL_IMPORTS = Object.freeze({
  "test/lina-check-action-ledger.test.ts": Object.freeze([
    // action-ledger.js
    "66c3255a3ba2903ab7954d357677550764d781ad9e005d750e48105d2a5703c1",
    // clawsweeper-apply-lease-guards.js
    "958c27ceac4444b619e6119357512b7dbb17ef53b33ada9bcd715f7ed84c8185",
    // clawsweeper.js
    "12c3a7da1057f064ceff94cc92b6a9c5cb00b476de9ca475707a82a1ae153fa5",
    // github-retry.js
    "03c185b4e47a2dc0acf3e50a1b4f9dad332b3b8ca973808328c120a9ce9dfee2",
  ]),
  "test/lina-check-actions-runtime.test.ts": Object.freeze([
  ]),
  "test/lina-check-admission.test.ts": Object.freeze([
    // hosted-target-admission.js
    "4b655a11a0f8fb81b2692c9f105ae829e1167625476eb11a4a6150d580591435",
    // lina-check-installation-contract.js
    "0dc6a2db497908af56111e6a14bde552d4e51406b54952941706a8e59f8e7dd9",
    // lina-check-installation.js
    "7fef8c67b1e73da21b431884aa5cb45e6e1301d146be825e098fd5973d314e58",
    // comment-webhook.js
    "7c740526e6ea952ff5bcf2aea2e695c5bdb52ddb26bac9b0e0cab5d14bb4fb2b",
    // target-fanout.js
    "f36196b1ac2d92d6177436ab1687f94778287a11416c7c83e410caa7f27d304c",
  ]),
  "test/lina-check-close-policy.test.ts": Object.freeze([
    // clawsweeper.js
    "12c3a7da1057f064ceff94cc92b6a9c5cb00b476de9ca475707a82a1ae153fa5",
    // commit-sweeper.js
    "105c7300c3163d2782ee8ef796c7e8433329c342b596c0e15576397e71f61db5",
    // review-activity-cursor.js
    "ddebf60605ee872990d0e3b9c7245467aa071675d0663705813e32b2c0f9b64d",
  ]),
  "test/lina-check-failure-telemetry.test.ts": Object.freeze([
    // exact-review-direct-publication.ts
    "c2b20dbf7d247f07f921795056a221013e12854694a6f3fcc256397359b7e647",
    // exact-review-failure-telemetry.ts
    "5a144f36afb5c8fafad1211df581fd3ef749460680f01796c5757861b9008786",
    // exact-review-lifecycle-telemetry.ts
    "b83f0a5082e0396088193fe7192c70a91760eb6e53a81e4f4c7c4d4e5f82ce86",
    // exact-review-lifecycle.ts
    "8419ea22913c7c66c388734da53a0f3fb1c5c4587373ae8914ebe49ad42f3111",
    // exact-review-publication-batches.ts
    "0493adb6ffb44ce62a836a1f02ea8a5ccc5396a153d98926b9cce503c9050b91",
    // exact-review-queue.ts
    "e5bdadd917f0a8ef9fe68b215dc829fec8c05efa7caa22175cb99b20e5e32865",
    // live-activity.ts
    "abc4bd9921834831ef4171ca8717cb5abce0693264dbfa5a14e58494d259e3c1",
    // worker.ts
    "0fd97372e43f15e9566104704eedb826e81459de4ada426dcb30816955009cb9",
    // canonical-record-baseline.js
    "e02180896a7717c59deabfb3674d12bea48a4eb2e5a66d8946e1c3db5506205b",
    // publish-main.js
    "229bfdd401c511fd80f0830cc30f05a2006005de8940c79f7e1d2651ae2c7312",
  ]),
  "test/lina-check-github-api.test.ts": Object.freeze([
    // github-api.ts
    "b139b8c8ca26956af5fc06004c3591715abae88634282d879a8a97ff19a0f396",
  ]),
  "test/lina-check-hosted-admission.test.ts": Object.freeze([
    // hosted-target-admission.ts
    "7aaad37da1be2aa308ca4805c9c5c9f6d59a3b5fbb64818a4ed22e3aafc450c6",
    // lina-check-installation-contract.ts
    "80f2e2103bc3c74628282b4863103fc4fd83706730ac19f4853f1e51a0b0693e",
  ]),
  "test/lina-check-node-test-runner.test.ts": Object.freeze([
    // run-node-tests.mjs
    "cf80f818b2664e049804d1cd031cb6828392fc33e66b3670b3615775647a60cb",
  ]),
  "test/lina-check-response-deadlines.test.ts": Object.freeze([
    // exact-review-queue.ts
    "e5bdadd917f0a8ef9fe68b215dc829fec8c05efa7caa22175cb99b20e5e32865",
    // github-api.ts
    "b139b8c8ca26956af5fc06004c3591715abae88634282d879a8a97ff19a0f396",
  ]),
  "test/lina-check-scheduled-review.test.ts": Object.freeze([
    // clawsweeper.js
    "12c3a7da1057f064ceff94cc92b6a9c5cb00b476de9ca475707a82a1ae153fa5",
    // classify-scheduled-review-noop.ts
    "0818365ad1bf903015a2e332abb61551292750fd65528782357c42880cc986b2",
  ]),
  "test/lina-check-webhook-admission.test.ts": Object.freeze([
    // lina-check-installation.js
    "7fef8c67b1e73da21b431884aa5cb45e6e1301d146be825e098fd5973d314e58",
    // comment-webhook.js
    "7c740526e6ea952ff5bcf2aea2e695c5bdb52ddb26bac9b0e0cab5d14bb4fb2b",
    // repository-profiles.js
    "1d069a37b325a42eb3578a09ca135f7811547847c3738152b0a10671dfbe2b31",
  ]),
});

/** Stable name for one external module, so a ceiling can pin it. */
export function externalImportDigest(path) {
  return createHash("sha256").update(String(path)).digest("hex");
}

/**
 * A derived test may import a blocked entrypoint to inspect its behaviour, which
 * a derived script may not. That difference is only safe while the test cannot
 * start anything, so the process-spawning surface is denied by name. Without
 * this, the .mjs blocked-target rule would simply move to a .ts file.
 */
const SPAWN_SURFACE = Object.freeze([
  "node:child_process",
  "child_process",
  "spawnSync",
  "execFileSync",
  "execSync",
  "fork(",
  // A worker thread has its own module state, so the runtime instrumentation in
  // the observed process does not reach anything it starts. Denying the surface
  // keeps the rule intact: a derived test starts nothing, and nothing it can
  // reach starts anything outside what the observation can see.
  "node:worker_threads",
  "worker_threads",
  "new Worker(",
  // Mechanisms that resolve a module or run constructed code at run time. The
  // entries above name modules, which a computed string can evade; these name
  // the ways of getting one at all, so what the argument evaluates to stops
  // mattering. A derived test has no use for any of them: it imports what it
  // needs by name.
  "getBuiltinModule",
  "process.binding",
  "eval(", // justified: a denial-list entry naming the surface, not a call
  "new Function(",
]);

/**
 * Surfaces that tell a derived test how it was started.
 *
 * Chasing indistinguishability between the observed run and the lane is an arms
 * race: two different invocations always differ somewhere. What can be settled
 * is whether a derived test is allowed to look. Reading the argument vector is
 * denied by name, so a load or a call cannot be made conditional on being
 * watched. process.execPath is not on this list: it names the interpreter, not
 * the invocation, and a restored runner case needs it.
 */
const OBSERVATION_SIGNAL = Object.freeze([
  // Bare identifiers, because an exact substring check on process.argv is
  // defeated by const { argv } = process or process["argv"]. Neither name has
  // any other use in a test: a derived test reads fixtures it wrote, not the
  // arguments its process was started with.
  "argv",
  "execArgv",
  "NODE_OPTIONS",
  "LINA_CHECK_LAUNCH_LOG",
  "FORCE_COLOR",
  "NO_COLOR",
  // Set by node --test and absent when the observation imports the tests
  // directly. Denying the read is the same choice as for the argument vector:
  // parity between two invocations is unreachable, permission is decidable.
  "NODE_TEST_CONTEXT",
]);

/**
 * Everything the test runner puts in the environment, by prefix.
 *
 * NODE_TEST_CONTEXT was listed by name and NODE_TEST_WORKER_ID was not, which
 * is the shape of mistake this file has made repeatedly. Node owns this
 * namespace and can add to it; the prefix covers what it adds. A derived test
 * reads fixtures it wrote, not the runner's bookkeeping.
 */
const RUNNER_ENVIRONMENT = /\bNODE_TEST_[A-Z0-9_]+\b/;

/**
 * Reaching the process object under a name this scan cannot read.
 *
 * The token list above asks whether a name appears in the source, and that
 * question is only decidable while the name is written down. process["arg" +
 * "v"] reaches the same property and spells neither half of it. Evaluating the
 * key is not something a text scan can do, so the rule is the one this file
 * already follows everywhere else: refuse the forms it cannot read, which
 * leaves exactly the spellings the token list does read.
 *
 *   process.env.<name>      read, because the token list sees <name>
 *   process.env["<name>"]   read: the literal sits in the scanned source
 *   process.env[key] = v    allowed, and delete too: a write carries nothing
 *                           back to the test about how it was started
 *   process.execPath        allowed: the interpreter path, not the invocation
 *   anything else           refused
 *
 * Bare process is refused because a binding to it moves every question above
 * one name further along, where this scan no longer asks it. Bracket access on
 * globalThis and global is refused for the same reason: it is the one form
 * that can name the process object without writing its name.
 *
 * The boundary is stated rather than implied. This does not prove the absence
 * of reflection over arbitrary objects; it does not have to. Nothing but the
 * process object tells a module how its process was started, and the process
 * object is now reachable only through spellings the token scan reads.
 */
const OBSERVATION_ROOT_MODULE = /(?:from|import|require)\s*\(?\s*["'](?:node:)?process["']/;
const GLOBAL_ROOT = /\b(?:globalThis|global)\b/g;
const PROCESS_ROOT = /\bprocess\b/g;

/**
 * The only properties of the process object a derived test may name.
 *
 * An allowlist, because a denial list was the wrong shape.
 * process.report.getReport().header.commandLine names the invocation without
 * spelling argv, and every further property of that kind would need its own
 * entry. Turning it around ends the sequence: a derived test needs the
 * environment it bands and the interpreter path a recovered runner case
 * compares against, and nothing else on this object.
 */
const PROCESS_PROPERTY = Object.freeze(["env", "execPath"]);

/**
 * Named routes from any value back to dynamic code or to a property whose name
 * is never written down.
 *
 * The allowlist above bounds the first property read off the process object. It
 * does not bound what that value can do: every JavaScript value reaches the
 * Function constructor through its prototype chain, so
 * process.execPath.constructor.constructor builds code that returns the process
 * object under a name this scan never sees. That route does not need process at
 * all - [].constructor.constructor is the same thing - so it is closed here
 * rather than in the process rule.
 *
 * A class body's constructor is a declaration, not a member access, and the
 * worker harness defines several. Only the access forms are refused.
 *
 * Object.getPrototypeOf stays allowed: the harness uses it, and a prototype is
 * inert without the constructor access this now refuses.
 */
const REFLECTIVE_ROUTE = Object.freeze([
  [/\.\s*constructor\b/, "a member access named constructor", false],
  [/\[\s*["'`]\s*constructor/, "constructor reached through a bracket", true],
  [/\b__proto__\b/, "__proto__", false],
  [/\bReflect\s*\./, "Reflect", false],
]);

/**
 * The globals that run constructed code, denied as names rather than as calls.
 *
 * The spawn-surface list names two call spellings. JavaScript has more:
 * whitespace is permitted between a callee and its parenthesis, Function is
 * callable without new, and either global can be held in a binding first. A
 * scan keyed to a call shape is one space away from missing all of them, so the
 * identifier is what is refused. No file in the closure names either one.
 */
const DYNAMIC_CODE_GLOBAL = /\b(?:eval|Function|AsyncFunction|GeneratorFunction)\b/;

/**
 * node:vm's evaluation surface, denied by name.
 *
 * Script and createContext are not on this list, and the omission is the point.
 * test/dashboard-worker-harness.ts imports both from node:vm and re-exports
 * them without ever evaluating anything; those bytes are upstream-pinned, so
 * check:scaffold proves they have not changed. Every way to actually run a
 * compiled script goes through one of the names below, and none of them appears
 * anywhere in the closure. Denying the two names the harness needs would cost a
 * recovered suite for nothing.
 */
const DYNAMIC_EVALUATION = /\b(?:runInThisContext|runInNewContext|runInContext|compileFunction|createScript|SourceTextModule|SyntheticModule)\b/;

/**
 * The bare specifiers a derived test's closure may name.
 *
 * Treating every unclassified builtin as safe was the last silent pass in this
 * scan: node:vm compiles strings, node:repl and node:inspector evaluate them,
 * and denying them one at a time repeats the sequence this file has already run
 * three times. These are the thirteen the closure actually uses. A package or
 * an unlisted builtin is refused, which also covers an absolute specifier,
 * since neither resolves inside this repository.
 */
const PERMITTED_MODULE = Object.freeze([
  "node:assert/strict",
  "node:crypto",
  "node:events",
  "node:fs",
  "node:module",
  "node:os",
  "node:path",
  "node:sqlite",
  "node:test",
  "node:timers/promises",
  "node:util",
  "node:vm",
  "node:zlib",
]);

/**
 * The only properties of import.meta a derived test may name.
 *
 * Same shape as the process rule, for the same reason. import.meta.main is true
 * when the lane launches a file through node --test and false when the
 * observation imports it, so it tells a test which run it is in without naming
 * any denied signal. Listing what is allowed ends the sequence: createRequire
 * needs the module URL, and nothing here needs anything else.
 */
const IMPORT_META_PROPERTY = Object.freeze(["url"]);
const IMPORT_META = /import\s*\.\s*meta\s*(?:\.\s*([A-Za-z_$][\w$]*))?/g;

/**
 * An identifier written with a Unicode escape.
 *
 * JavaScript decodes \u escapes inside identifiers, so pro\u0063ess.arg\u0076
 * is the argument vector and neither denied word appears in the text. Every
 * rule in this file reads text, so the escape has to be settled before them.
 *
 * Refused rather than decoded. codeOnly has already blanked strings, comments
 * and regular expressions, so a backslash-u surviving in that copy can only be
 * an escaped identifier, and no file in the closure contains one. Decoding
 * would move every offset this function computes for no gain.
 */
const ESCAPED_IDENTIFIER = /\\u/;

/**
 * The properties of an imported node:module binding this scan can read.
 *
 * A namespace or default import is tracked by the spelling binding.createRequire,
 * so binding["create" + "Require"] reaches the same factory under a name the
 * tracker never sees. Same answer as everywhere else in this file: list what is
 * readable, refuse the rest.
 */
const MODULE_PROPERTY = Object.freeze(["createRequire", "syncBuiltinESMExports"]);

/**
 * Whether a member call names its method through an expression this scan cannot
 * read, as in script["run" + "InThisContext"]().
 *
 * Narrower than refusing every computed member access, on purpose. Index reads
 * such as rows[i] or scripts[name] are ordinary and appear across the closure,
 * while a call through a constructed method name does not appear at all, and it
 * is the form that turns a permitted object back into a denied verb.
 */
function computedMemberCall(code) {
  for (let index = 0; index < code.length; index += 1) {
    if (code[index] !== "[") continue;
    const before = code.slice(0, index).replace(/\s+$/, "");
    if (!/[A-Za-z0-9_$)\]]$/.test(before)) continue;
    if (/\b(?:of|in|return|const|let|var|typeof|case|do|else|yield|await|new|delete|void|instanceof)$/.test(before))
      continue;
    const close = closingBracket(code, index);
    if (close === -1) continue;
    if (!/^\s*\(/.test(code.slice(close + 1))) continue;
    if (literalKey(code.slice(index + 1, close).trim())) continue;
    return code.slice(index, close + 1).trim();
  }
  return null;
}

/**
 * A computed property key in a destructuring pattern, as in
 * const { ["run" + "InThisContext"]: go } = script.
 *
 * The call rule above asks whether the bracket is followed by a parenthesis,
 * which this form answers no to: the method is pulled out first and called
 * through a plain name afterwards. The pattern is told from an object literal
 * by the assignment that follows it, because a literal builds a value and a
 * pattern reads one, and the worker harness builds { [item.key]: item }.
 */
function computedPatternKey(code) {
  for (const key of code.matchAll(/\]\s*:/g)) {
    let open = -1;
    let depth = 0;
    for (let index = key.index; index >= 0; index -= 1) {
      if (code[index] === "]") depth += 1;
      else if (code[index] === "[") {
        depth -= 1;
        if (depth === 0) {
          open = index;
          break;
        }
      }
    }
    if (open === -1) continue;
    if (literalKey(code.slice(open + 1, key.index).trim())) continue;
    let brace = -1;
    let braces = 0;
    for (let index = open; index >= 0; index -= 1) {
      if (code[index] === "}") braces += 1;
      else if (code[index] === "{") {
        braces -= 1;
        if (braces < 0) {
          brace = index;
          break;
        }
      }
    }
    if (brace === -1) continue;
    let close = -1;
    braces = 0;
    for (let index = brace; index < code.length; index += 1) {
      if (code[index] === "{") braces += 1;
      else if (code[index] === "}") {
        braces -= 1;
        if (braces === 0) {
          close = index;
          break;
        }
      }
    }
    if (close === -1) continue;
    if (/^\s*=[^=>]/.test(code.slice(close + 1))) return code.slice(open, key.index + 1).trim();
  }
  return null;
}

/**
 * The call stack names the file that started the run.
 *
 * new Error().stack carries the observation's generated runner path and the
 * lane's entry frames, which differ, so reading it is reading the invocation.
 * Same answer as for the argument vector: permission to look is denied.
 */
const STACK_SURFACE = /\.\s*stack\b|\b(?:captureStackTrace|prepareStackTrace)\b/;

/**
 * The operating system's own view of how this process was started.
 *
 * /proc/self/cmdline carries the observation's generated runner path and the
 * lane's test-runner arguments, so reading it is reading the invocation through
 * a permitted module rather than a denied property. Matched with both slashes,
 * because a regular expression beginning /process... opens with the same four
 * letters and one derived test has one.
 *
 * This is the spelled form. A path assembled from fragments is the same
 * residue as a computed key, and 030_detectors.md says so rather than implying
 * otherwise.
 */
const OS_INVOCATION_PATH = /\/proc\//;

/** Index of the bracket closing the one that opens at open, or -1. */
function closingBracket(code, open) {
  let depth = 0;
  for (let index = open; index < code.length; index += 1) {
    if (code[index] === "[") depth += 1;
    else if (code[index] === "]") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/**
 * Whether a bracket key is a single literal whose text the token scan reads.
 *
 * codeOnly blanks string contents and keeps the quotes, so a concatenation
 * still carries inner quotes and fails this test, while one literal does not.
 * A template counts only without substitution, for the same reason a dynamic
 * import does.
 */
function literalKey(key) {
  if (/^(["'])[^"']*\1$/.test(key)) return true;
  return /^`[^`]*`$/.test(key) && !key.includes("${");
}

/**
 * The first unreadable route to the invocation in this source, or null.
 */
export function observationAccessFault(rawSource) {
  const source = withoutComments(rawSource);
  if (OBSERVATION_ROOT_MODULE.test(source))
    return "the process module is imported, which puts the process object behind a name this scan cannot read";
  const code = codeOnly(source);
  if (ESCAPED_IDENTIFIER.test(code))
    return "an identifier written with a Unicode escape, which this scan reads as text";
  // The bracket form carries its name inside a string, which codeOnly blanks,
  // so that one rule reads the copy where string contents survive.
  for (const [pattern, reason, needsLiterals] of REFLECTIVE_ROUTE)
    if (pattern.test(needsLiterals ? source : code)) return reason;
  const dynamicCode = DYNAMIC_CODE_GLOBAL.exec(code);
  if (dynamicCode) return "the global " + dynamicCode[0] + " runs constructed code";
  const evaluation = DYNAMIC_EVALUATION.exec(code);
  if (evaluation) return evaluation[0] + " evaluates a string as code";
  const computedCall = computedMemberCall(code);
  if (computedCall !== null)
    return "a member call through the constructed name " + computedCall;
  const patternKey = computedPatternKey(code);
  if (patternKey !== null) return "a destructured property through the constructed name " + patternKey;
  const stackRead = STACK_SURFACE.exec(code);
  if (stackRead) return "the call stack through " + stackRead[0].trim() + ", which names the file that started the run";
  if (OS_INVOCATION_PATH.test(source))
    return "a path under /proc, which is the operating system's record of how this process was started";
  for (const match of code.matchAll(IMPORT_META)) {
    if (match[1] === undefined) return "import.meta reached in a form this scan cannot read";
    if (!IMPORT_META_PROPERTY.includes(match[1]))
      return "import.meta." + match[1] + " is not one of the permitted properties";
  }
  for (const match of code.matchAll(GLOBAL_ROOT)) {
    const rest = code.slice(match.index + match[0].length);
    if (/^\s*\[/.test(rest)) return "computed member access on " + match[0];
    if (/^\s*\./.test(rest)) continue;
    // Not a member access, so the value itself is in play. An argument is the
    // one place this repository needs it - t.mock.method(globalThis, "fetch",
    // ...) - and a binding is where a computed read would continue under a name
    // this rule no longer watches.
    const before = code.slice(0, match.index).replace(/\s+$/, "");
    if (/[(,]$/.test(before)) continue;
    return match[0] + " bound to a name rather than read through a property";
  }
  for (const match of code.matchAll(PROCESS_ROOT)) {
    const start = match.index + match[0].length;
    const rest = code.slice(start);
    const property = /^\s*\.\s*([A-Za-z_$][\w$]*)/.exec(rest);
    if (!property) return "process reached in a form this scan cannot read";
    if (!PROCESS_PROPERTY.includes(property[1]))
      return "process." + property[1] + " is not one of the permitted properties";
    if (property[1] !== "env") continue;
    const afterEnv = rest.slice(property[0].length);
    if (/^\s*\.\s*[A-Za-z_$]/.test(afterEnv)) continue;
    const bracket = /^\s*\[/.exec(afterEnv);
    if (!bracket) return "process.env reached in a form this scan cannot read";
    const open = start + property[0].length + bracket[0].length - 1;
    const close = closingBracket(code, open);
    if (close === -1) return "process.env[ with no closing bracket";
    if (literalKey(code.slice(open + 1, close).trim())) continue;
    const before = code.slice(0, match.index).replace(/\s+$/, "");
    const removed = /\bdelete$/.test(before);
    const assigned = /^\s*=[^=>]/.test(code.slice(close + 1));
    if (!removed && !assigned) return "computed read of process.env";
  }
  return null;
}

/**
 * Resolve a relative import the way the loader would, without node:path, so the
 * self-test can drive it on invented paths. A bare or absolute specifier returns
 * null: those are packages and built output, not files this repository owns
 * inside the test tree.
 */
export function resolveRelativeImport(fromPath, specifier) {
  if (typeof specifier !== "string" || !specifier.startsWith(".")) return null;
  const stack = [];
  for (const part of [...fromPath.split("/").slice(0, -1), ...specifier.split("/")]) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (stack.length === 0) return null;
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join("/");
}

/**
 * Every way a file in this repository can name another one statically.
 *
 * The first form covers import, dynamic import, and both re-export spellings,
 * because export * from and export { x } from both carry the from keyword. The
 * second covers CommonJS, including the require function obtained through
 * createRequire, which the keyword form cannot see: the specifier there is an
 * argument to the result of a call, not to a named keyword.
 */
// A no-substitution template literal is a valid specifier too, so the quote
// class has to include it or import(`./helper.mjs`) is invisible.
const IMPORT_SPECIFIER =
  /(?:from|import|require)\s*\(?\s*(?:["']([^"']+)["']|`([^`$]+)`)/g;
const CREATE_REQUIRE_SPECIFIER = /createRequire\([^)]*\)\s*\(\s*["']([^"']+)["']/g;
const FOLLOWABLE = /\.(?:ts|mts|cts|js|mjs|cjs)$/;
/** Node accepts both spellings, so a scan keyed to one of them is bypassable. */
const MODULE_NAMED_IMPORT = /import\s*\{([^}]*)\}\s*from\s*["'](?:node:)?module["']/g;
/** import * as x from "node:module" puts the factory behind a member access. */
const MODULE_NAMESPACE_IMPORT =
  /import\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s*from\s*["'](?:node:)?module["']/g;
/** The default import reaches the same factory through the same member access. */
const MODULE_DEFAULT_IMPORT =
  /import\s+([A-Za-z_$][\w$]*)\s*(?:,\s*\{[^}]*\})?\s*from\s*["'](?:node:)?module["']/g;
/**
 * The ambient CommonJS require is itself a loader that can be renamed:
 * const load = require; load("./helper"). Following only require("./x") reads
 * the alias as an ordinary assignment and the load disappears.
 */
const REQUIRE_ALIAS_BINDING = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\s*(?![\s]*\()/g;
const AMBIENT_REQUIRE_USE = /\brequire\b/g;
/**
 * A dynamic import whose argument is not a literal cannot be followed. The
 * negative lookbehind keeps an ordinary method named import — loader.import(x) —
 * out of the rule, which would otherwise refuse valid code.
 */
const DYNAMIC_IMPORT_CALL = /(?<![.\w$])import\s*\(/g;

/**
 * Source with comment and string contents blanked out, positions preserved.
 *
 * The ambient-require rule asks whether a mention is a call, and prose is full
 * of the word: a comment reading "these tests require a configured
 * installation" would otherwise be refused as an unfollowable loader. Only this
 * rule uses it; the specifier scan needs string contents intact.
 */

/**
 * Whether a slash at this point opens a regular expression rather than being
 * division. Decided by the last significant character before it, which is the
 * ordinary heuristic and enough for source this scan reads.
 */
function opensRegExp(before) {
  const trimmed = before.replace(/\s+$/, "");
  const previous = trimmed.slice(-1);
  if (previous === "") return true;
  // ++ and -- are postfix here, so the slash after them divides.
  if (trimmed.endsWith("++") || trimmed.endsWith("--")) return false;
  // A closing brace, parenthesis or bracket commonly precedes division, and
  // claiming a pattern there erases the rest of the expression, which is how a
  // loader call would disappear. Ambiguity resolves toward division.
  return "(,=:!&|?;+*%~^<>".includes(previous);
}
export function codeOnly(source) {
  let out = "";
  let index = 0;
  // One frame per nested construct, innermost last. An interpolation pushes a
  // code frame, so a brace inside a string inside an interpolation is read as
  // text rather than as the end of the interpolation. Counting raw braces was
  // the bug: `${"}" + launch()}` ended the interpolation at the string's brace
  // and blanked the call after it.
  const stack = [{ kind: "code", braces: 0 }];
  const top = () => stack[stack.length - 1];
  while (index < source.length) {
    const frame = top();
    const character = source[index];
    const two = source.slice(index, index + 2);
    if (frame.kind === "string" || frame.kind === "template") {
      if (character === "\\") {
        out += "  ";
        index += 2;
        continue;
      }
      if (frame.kind === "template" && two === "${") {
        out += "${";
        stack.push({ kind: "code", braces: 0 });
        index += 2;
        continue;
      }
      if (character === frame.quote) {
        stack.pop();
        out += character;
        index += 1;
        continue;
      }
      out += character === "\n" ? "\n" : " ";
      index += 1;
      continue;
    }
    if (character === '"' || character === "'") {
      stack.push({ kind: "string", quote: character });
      out += character;
      index += 1;
      continue;
    }
    if (character === "`") {
      stack.push({ kind: "template", quote: "`" });
      out += character;
      index += 1;
      continue;
    }
    if (two === "//") {
      while (index < source.length && source[index] !== "\n") {
        out += " ";
        index += 1;
      }
      continue;
    }
    if (two === "/*") {
      while (index < source.length && source.slice(index, index + 2) !== "*/") {
        out += source[index] === "\n" ? "\n" : " ";
        index += 1;
      }
      out += "  ";
      index += 2;
      continue;
    }
    // A regular expression is not code either: /require/ is a pattern, and
    // reading it as a use of the loader refuses a harmless line. Whether a
    // slash opens one is decided by what precedes it, the usual heuristic.
    if (character === "/" && opensRegExp(out)) {
      out += "/";
      index += 1;
      let escaped = false;
      while (index < source.length) {
        const inner = source[index];
        if (escaped) escaped = false;
        else if (inner === "\\") escaped = true;
        else if (inner === "/") break;
        else if (inner === "\n") break;
        out += inner === "\n" ? "\n" : " ";
        index += 1;
      }
      if (source[index] === "/") {
        out += "/";
        index += 1;
      }
      continue;
    }
    if (character === "{") frame.braces += 1;
    else if (character === "}") {
      // The brace that closes an interpolation belongs to the template, not to
      // the code inside it.
      if (frame.braces > 0) frame.braces -= 1;
      else if (stack.length > 1) stack.pop();
    }
    out += character;
    index += 1;
  }
  return out;
}
/**
 * Candidates CommonJS resolution would try for a specifier with no extension.
 * Dropping such a specifier silently is how an extensionless helper escapes.
 */
const EXTENSION_CANDIDATES = Object.freeze([
  ".js",
  ".cjs",
  ".mjs",
  ".ts",
  ".mts",
  ".cts",
  "/index.js",
  "/index.cjs",
  "/index.mjs",
  "/index.ts",
]);
const escapeRegExp = (value) => value.replace(/[.*+?^=!:!{}()|[\]/\\$]/g, "\\$&");


/**
 * Source with comments blanked and string contents kept, positions preserved.
 *
 * The specifier scans need the literal intact, so they cannot use codeOnly;
 * they still must not be defeated by a comment sitting between a keyword and
 * its argument, which is valid and was invisible.
 */
export function withoutComments(source) {
  let out = "";
  let index = 0;
  let quote = null;
  while (index < source.length) {
    const two = source.slice(index, index + 2);
    const character = source[index];
    if (quote) {
      if (character === "\\") {
        out += source.slice(index, index + 2);
        index += 2;
        continue;
      }
      if (character === quote) quote = null;
      out += character;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === "\u0060") {
      quote = character;
      out += character;
      index += 1;
      continue;
    }
    if (two === "//") {
      while (index < source.length && source[index] !== "\n") {
        out += " ";
        index += 1;
      }
      continue;
    }
    if (two === "/*") {
      while (index < source.length && source.slice(index, index + 2) !== "*/") {
        out += source[index] === "\n" ? "\n" : " ";
        index += 1;
      }
      out += "  ";
      index += 2;
      continue;
    }
    out += character;
    index += 1;
  }
  return out;
}
/** Index just past the parenthesis group that starts at open. */
function afterGroup(source, open) {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    else if (source[index] === ")") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return -1;
}

/**
 * Names that stand for createRequire in this file, import alias included.
 *
 * An alias is not cosmetic here: importing it under another name defeated every
 * pattern keyed to the literal spelling, which is the same bypass one rename
 * further along.
 */
export function createRequireNames(source) {
  const names = new Set(["createRequire"]);
  for (const statement of source.matchAll(MODULE_NAMED_IMPORT))
    for (const specifier of statement[1].split(",")) {
      const parts = specifier.trim().split(/\s+as\s+/);
      if (parts[0].trim() === "createRequire") names.add((parts[1] ?? parts[0]).trim());
    }
  // A namespace import is the same factory under a member access, so the name
  // this scan looks for is the whole dotted form.
  for (const statement of source.matchAll(MODULE_NAMESPACE_IMPORT))
    names.add(statement[1] + ".createRequire");
  for (const statement of source.matchAll(MODULE_DEFAULT_IMPORT))
    names.add(statement[1] + ".createRequire");
  return names;
}

/**
 * Every CommonJS specifier this file loads through createRequire, and every use
 * of it this scan cannot follow.
 *
 * Three forms are followed: the immediate call, a loader held in a binding and
 * called with a literal, and either of those reached through an import alias.
 * Anything else — a loader handed to another function, called with a computed
 * specifier, reassigned — is reported as unfollowable rather than counted as
 * nothing found. A scan that cannot see a load must not read as a clean one.
 */
export function analyseRequireUse(rawSource) {
  // Literals come from a copy with comments blanked and strings intact, so a
  // comment between a loader and its argument cannot hide the call.
  const source = withoutComments(rawSource);
  const specifiers = [];
  const unfollowable = [];
  const loaders = new Set();
  // Both scans read the same comment-free copy. Reading the binding from raw
  // source while the use check read the blanked copy left a gap exactly the
  // width of a comment: const load /* alias */ = require.
  const code = codeOnly(source);
  for (const binding of code.matchAll(REQUIRE_ALIAS_BINDING)) loaders.add(binding[1]);
  // A namespace or default import of node:module is tracked further down by the
  // spelling binding.createRequire. Every other use of that binding is settled
  // here: a listed property, or unfollowable. Without this, binding["create" +
  // "Require"] reaches the factory under a name the tracker never sees.
  let outsideImports = code;
  const moduleBindings = [];
  for (const pattern of [MODULE_NAMESPACE_IMPORT, MODULE_DEFAULT_IMPORT])
    for (const statement of source.matchAll(pattern)) {
      moduleBindings.push(statement[1]);
      outsideImports =
        outsideImports.slice(0, statement.index) +
        " ".repeat(statement[0].length) +
        outsideImports.slice(statement.index + statement[0].length);
    }
  for (const binding of moduleBindings)
    for (const use of outsideImports.matchAll(
      new RegExp("\\b" + escapeRegExp(binding) + "\\b\\s*(?:\\.\\s*([A-Za-z_$][\\w$]*)|(\\[))?", "g"),
    )) {
      if (use[2] !== undefined) unfollowable.push(binding + "[ computed ]");
      else if (use[1] === undefined) unfollowable.push(binding);
      else if (!MODULE_PROPERTY.includes(use[1])) unfollowable.push(binding + "." + use[1]);
    }
  // A named import from node:module was read only for createRequire, so every
  // other export of that module was implicitly permitted. register installs a
  // loader hook that runs outside this isolate, where the observation's
  // instrumentation does not reach, so the list decides here too.
  for (const statement of source.matchAll(MODULE_NAMED_IMPORT))
    for (const specifier of statement[1].split(",")) {
      const imported = specifier.trim().split(/\s+as\s+/)[0].trim();
      if (imported !== "" && !MODULE_PROPERTY.includes(imported))
        unfollowable.push("node:module " + imported);
    }
  // Every other mention of the ambient require must be a call; handing the
  // function itself to something else is a load this scan cannot follow.
  for (const use of code.matchAll(AMBIENT_REQUIRE_USE)) {
    const before = code.slice(Math.max(0, use.index - 60), use.index);
    const rest = code.slice(use.index + "require".length);
    if (/^\s*\(/.test(rest)) continue;
    if (/(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*$/.test(before)) continue;
    if (/import[^;]*\{[^}]*$/.test(before)) continue;
    if (/\.\s*$/.test(before)) continue;
    unfollowable.push("require");
  }
  const names = [...createRequireNames(source)];
  // Longest first: a dotted name contains the bare one, and matching the bare
  // one inside it would read a namespace call as an untracked use.
  names.sort((left, right) => right.length - left.length);
  const seenAt = new Set();
  for (const name of names) {
    const pattern = new RegExp("(?:\\b|\\.)?" + escapeRegExp(name) + "\\b", "g");
    for (const use of code.matchAll(pattern)) {
      const at = use.index + (use[0].length - name.length);
      if (seenAt.has(at)) continue;
      // A dotted name already covered this position; the bare name inside it is
      // not a separate use.
      if ([...seenAt].some((start) => at > start && at < start + 40 && source.slice(start, at).endsWith(".")))
        continue;
      seenAt.add(at);
      const before = code.slice(Math.max(0, at - 120), at);
      // The import specifier that brings the name in is not a use of it.
      if (/import[^;]*\{[^}]*$/.test(before)) continue;
      // A member access is only safe to skip when the object it hangs off is a
      // name this scan already tracks, because that dotted form was matched on
      // its own pass. Any other object is a loader this scan cannot follow, and
      // skipping it silently is the bypass this rule exists to prevent.
      if (!name.includes(".")) {
        const member = /([A-Za-z_$][\w$]*)\s*\.\s*$/.exec(before);
        if (member) {
          if (names.includes(member[1] + "." + name)) continue;
          unfollowable.push(member[1] + "." + name);
          continue;
        }
      }
      const rest = code.slice(at + name.length);
      if (!/^\s*\(/.test(rest)) {
        unfollowable.push(name);
        continue;
      }
      const open = at + name.length + rest.indexOf("(");
      const close = afterGroup(code, open);
      if (close === -1) {
        unfollowable.push(name);
        continue;
      }
      const after = source.slice(close);
      const immediate = /^\s*\(\s*(["'])([^"']*)\1/.exec(after);
      if (immediate) {
        specifiers.push(immediate[2]);
        continue;
      }
      if (/^\s*\(/.test(after)) {
        // Called, but with something this scan cannot read as a specifier.
        unfollowable.push(name);
        continue;
      }
      const declared = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*$/.exec(before);
      if (!declared) {
        unfollowable.push(name);
        continue;
      }
      loaders.add(declared[1]);
    }
  }
  for (const loader of loaders) {
    const pattern = new RegExp("\\b" + escapeRegExp(loader) + "\\b", "g");
    for (const use of code.matchAll(pattern)) {
      const before = code.slice(Math.max(0, use.index - 60), use.index);
      if (/(?:const|let|var)\s+$/.test(before)) continue;
      // Shape is read from the comment-free copy; the specifier itself has to
      // come from the original, because that copy blanks string contents.
      const shape = code.slice(use.index + loader.length);
      const rest = source.slice(use.index + loader.length);
      const call = /^\s*\(\s*(["'])[^"']*\1\s*\)/.test(shape);
      const literal = call ? /^\s*\(\s*(["'])([^"']*)\1\s*\)/.exec(rest) : null;
      if (literal) {
        specifiers.push(literal[2]);
        continue;
      }
      unfollowable.push(loader);
    }
  }
  return { specifiers, unfollowable };
}

/**
 * Every file inside the test tree a derived test can reach, entry included.
 *
 * The token scan used to read the declared file and stop there, which is exactly
 * one level short of the thing it was written to prevent: test/helpers holds a
 * module that starts a process from inside a helper, so a declared test could
 * import it and still show a clean body. Imports that leave the test tree are not
 * followed, because product modules legitimately carry that surface and are
 * covered instead by the runtime observation the self-test performs.
 */
function walkDerivedTest(entry, readFile) {
  const seen = new Set([entry]);
  const queue = [entry];
  const visited = [];
  const external = new Set();
  const bare = new Set();
  while (queue.length > 0) {
    const path = queue.shift();
    visited.push(path);
    let source;
    try {
      source = String(readFile(path));
    } catch (error) {
      // A declared test naming a file that cannot be read is a contract fault,
      // not a reason to scan less. Skipping it would be the quiet failure this
      // closure exists to prevent.
      fail("derived-test-unreadable", path + ": " + (error?.message ?? String(error)));
    }
    // Comments are blanked for the specifier scan too: an import with a
    // comment between the keyword and its argument is valid and was invisible.
    const scannable = withoutComments(source);
    for (const pattern of [IMPORT_SPECIFIER, CREATE_REQUIRE_SPECIFIER]) {
      for (const match of scannable.matchAll(pattern)) {
        // A template literal carries its specifier in the second group.
        follow(path, match[1] ?? match[2], readFile, seen, queue, external, bare);
      }
    }
    const required = analyseRequireUse(source);
    if (required.unfollowable.length > 0)
      fail(
        "derived-test-unresolvable-require",
        path + ": " + [...new Set(required.unfollowable)].join(", ") + " used in an unfollowable form",
      );
    // A computed dynamic import is the last way to name a module without
    // naming it. Refusing it keeps the rule the rest of this scan follows: a
    // load is either followed or refused, never silently skipped. It also
    // removes the value of any signal that tells a test it is being observed,
    // because a conditional load now has to use a specifier this scan reads.
    for (const call of codeOnly(source).matchAll(DYNAMIC_IMPORT_CALL)) {
      const rest = codeOnly(source).slice(call.index + call[0].length);
      // A quoted specifier is a literal. A template one only counts when it
      // carries no substitution: import(\u0060./helpers/\u0024{name}.mjs\u0060) names a module
      // this scan cannot resolve, and the backtick alone made it look literal.
      if (/^\s*["']/.test(rest)) continue;
      const template = /^\s*\u0060([^\u0060]*)\u0060/.exec(rest);
      if (template && !template[1].includes("\u0024{")) continue;
      fail(
        "derived-test-unresolvable-import",
        path + ": dynamic import with a specifier this scan cannot resolve",
      );
    }
    for (const specifier of required.specifiers)
      follow(path, specifier, readFile, seen, queue, external, bare);
  }
  return { visited, external: [...external].sort(), bare: [...bare].sort() };
}

/** Every file inside the test tree a derived test can reach, entry first. */
export function derivedTestClosure(entry, readFile) {
  return walkDerivedTest(entry, readFile).visited;
}

/** Every module outside the test tree that closure names, sorted. */
export function derivedTestExternalImports(entry, readFile) {
  return walkDerivedTest(entry, readFile).external;
}


/**
 * A URL suffix is not part of the file name. Node resolves
 * ./helper.mjs?cachebust to ./helper.mjs, so an end-anchored extension test on
 * the raw specifier drops the very import it is meant to follow.
 */
export function specifierPath(specifier) {
  return String(specifier).split("?")[0].split("#")[0];
}

/** Whether readFile can produce this path's source at all. */
function readable(path, readFile) {
  try {
    readFile(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Queue one specifier, or refuse it.
 *
 * Three outcomes, and the third is the one that matters: a specifier this scan
 * cannot resolve to a readable module is refused rather than dropped, because a
 * dropped edge cannot be told apart from a clean one.
 */
function follow(from, specifier, readFile, seen, queue, external, bare) {
  const resolved = resolveRelativeImport(from, specifierPath(specifier));
  // A bare or absolute specifier names something outside this repository. It is
  // collected rather than dropped: the permitted list decides it after the
  // token scans have had their say, so a denied surface still reports itself.
  if (resolved === null) {
    bare.add(specifierPath(specifier));
    return;
  }
  // Outside the test tree the scan stops reading and starts declaring: product
  // modules carry the spawn surface by design, so the edge is recorded for the
  // declaration check rather than dropped.
  if (!resolved.startsWith("test/")) {
    external.add(resolved);
    return;
  }
  if (seen.has(resolved)) return;
  if (FOLLOWABLE.test(resolved)) {
    seen.add(resolved);
    queue.push(resolved);
    return;
  }
  // Some other extension is data, not a module that could start anything.
  if (/\.[A-Za-z0-9]+$/.test(resolved)) return;
  // No extension: CommonJS resolution would try several. Follow the first that
  // reads, and refuse when none do.
  for (const candidate of EXTENSION_CANDIDATES) {
    const target = resolved + candidate;
    if (seen.has(target)) return;
    if (readable(target, readFile)) {
      seen.add(target);
      queue.push(target);
      return;
    }
  }
  fail(
    "derived-test-unresolvable-require",
    from + ": no readable module for the extensionless specifier " + specifier,
  );
}
export function assertDerivedTestContract({ declared, baselinePaths, presentPaths, readFile }) {
  const names = Object.keys(declared ?? {}).sort();
  if (!sameList(names, [...DERIVED_TESTS])) fail("derived-test-set", names.join(","));
  // The ceiling and the set it applies to are two literals in this file, so a
  // derived test added to one and not the other would otherwise be unbounded.
  if (!sameList(Object.keys(DERIVED_TEST_EXTERNAL_IMPORTS).sort(), [...DERIVED_TESTS]))
    fail("derived-test-undeclared-import", "the external-import ceiling does not cover DERIVED_TESTS");
  let scanned = 0;
  for (const path of names) {
    if (!nonEmptyReason(declared[path])) fail("derived-test-reason", path);
    if (baselinePaths.has(path)) fail("derived-test-upstream-collision", path);
    if (!presentPaths.has(path)) fail("derived-test-missing", path);
    if (SAFE_TESTS.includes(path) || EXCLUDED_TESTS.includes(path))
      fail("derived-test-upstream-collision", path);
    const walk = walkDerivedTest(path, readFile);
    for (const member of walk.visited) {
      const source = String(readFile(member));
      scanned += 1;
      for (const token of SPAWN_SURFACE)
        if (source.includes(token))
          fail(
            "derived-test-spawns",
            (member === path ? path : path + " -> " + member) + " -> " + token,
          );
      for (const token of OBSERVATION_SIGNAL)
        if (new RegExp("\\b" + token + "\\b").test(source))
          fail(
            "derived-test-observation-signal",
            (member === path ? path : path + " -> " + member) + " -> " + token,
          );
      const runnerName = RUNNER_ENVIRONMENT.exec(source);
      if (runnerName)
        fail(
          "derived-test-observation-signal",
          (member === path ? path : path + " -> " + member) + " -> " + runnerName[0],
        );
      const unreadable = observationAccessFault(source);
      if (unreadable !== null)
        fail(
          "derived-test-computed-observation",
          (member === path ? path : path + " -> " + member) + " -> " + unreadable,
        );
    }
    // Checked after the token scans so that a closure carrying both a denied
    // surface and an undeclared edge is reported by the surface, which is the
    // stronger statement about what the file can do.
    for (const target of walk.external)
      if (!DERIVED_TEST_EXTERNAL_IMPORTS[path].includes(externalImportDigest(target)))
        fail("derived-test-undeclared-import", path + " -> " + target);
    for (const specifier of walk.bare)
      if (!PERMITTED_MODULE.includes(specifier))
        fail("derived-test-unlisted-module", path + " -> " + specifier);
  }
  return { tests: names.length, scanned };
}

export function assertFixtureTestContract(declared, baselinePaths) {
  const names = Object.keys(declared ?? {}).sort();
  if (!sameList(names, [...UPSTREAM_FIXTURE_TEST_NAMES])) fail("fixture-test-set", names.join(","));
  let restored = 0;
  for (const name of names) {
    if (!SAFE_TESTS.includes(name)) fail("fixture-test-unrestored", name);
    if (!nonEmptyReason(declared[name])) fail("fixture-test-reason", name);
    const spec = UPSTREAM_FIXTURE_TESTS[name];
    // The tree flag is what decides whether a traversal sees every pinned
    // workflow, so it is compared as strictly as the file list beside it.
    if (declared[name].githubTree !== spec.githubTree) fail("fixture-test-tree-flag", name);
    // An absent list is not an empty list. Coercing it would let a declaration
    // that says nothing about its reads pass whenever the literal happens to
    // expect none, and the next entry to gain a file would inherit the silence.
    if (!Array.isArray(declared[name].files)) fail("fixture-test-files", name + ": files must be an array");
    if (!sameList([...declared[name].files], [...spec.files]))
      fail("fixture-test-files", name);
    const files = resolveFixtureFiles(name, baselinePaths);
    for (const file of files) if (!baselinePaths.has(file)) fail("fixture-test-path", file);
    restored += files.length;
  }
  return { tests: names.length, files: restored };
}

export const BOUNDARY_PROBES = Object.freeze([
  Object.freeze({ action: "auto-fix", script: "repair:execute-fix" }),
  Object.freeze({ action: "auto-fix", script: "repair:apply-result" }),
  Object.freeze({ action: "auto-close", script: "apply-decisions" }),
  Object.freeze({ action: "auto-close", script: "repair:finalize-open-prs" }),
  Object.freeze({ action: "auto-merge", script: "e2e:automerge" }),
  Object.freeze({ action: "auto-merge", script: "repair:publish-main" }),
  Object.freeze({ action: "auto-label", script: "repair:cleanup-replacement-labels" }),
  Object.freeze({ action: "auto-label", script: "repair:tag-clawsweeper" }),
]);

export const BOUNDARY_PROBE_SCRIPTS = Object.freeze(BOUNDARY_PROBES.map(({ script }) => script));

/** The installation entry point that ships with the fork. */
export const INSTALLATION_CONFIG_PATH = "config/lina-check-installation.json";
export const INSTALLATION_SCHEMA_PATH = "schema/lina-check-installation.schema.json";
export const WRANGLER_PATH = "dashboard/wrangler.toml";

/**
 * Upstream files this fork is allowed to change.
 *
 * Every judgement JUN-198 had to move lives inside a preserved upstream file,
 * so the byte assertion needed an exception. The exception is a code literal,
 * not a configuration list: the declaration in config records only why each
 * entry is here, so editing configuration alone cannot add a file.
 *
 * The set grew from three to seven across four review rounds. Each addition was
 * a place that still granted admission, or still reached the network, after the
 * previous edit; the history is in the plan unit.
 */
export const MODIFIED_UPSTREAM_FILES = Object.freeze([
  "dashboard/exact-review-queue.ts",
  "dashboard/github-api.ts",
  "dashboard/worker.ts",
  "dashboard/wrangler.toml",
  "src/hosted-target-admission.ts",
  "src/repair/comment-webhook.ts",
  "src/repair/target-fanout.ts",
]);

/**
 * Worker settings that must carry no value. Ordinary repository names are not
 * forbidden literals, so the forbidden-literal scan cannot see a target list
 * that still points somewhere; these keys are checked by name.
 */
export const WRANGLER_EMPTY_VARS = Object.freeze([
  "APPLY_OPTIONAL_TARGET_REPOS",
  "APPLY_TARGET_REPOS",
  "CLAWSWEEPER_APP_CLIENT_ID",
  "CLAWSWEEPER_CRABFLEET_URL",
  "CLAWSWEEPER_REPO",
  "EXACT_REVIEW_STATE_REPO",
  "LINA_CHECK_BOT_LOGIN",
  "LINA_CHECK_DASHBOARD_HOST",
  "LINA_CHECK_INSTALLATION_CONFIGURED",
  "LINA_CHECK_PRODUCT_NAME",
  "LINA_CHECK_SHORT_NAME",
  "LINA_CHECK_TARGET_OWNERS",
  "LINA_CHECK_TARGET_REGISTRY_URL",
  "LINA_CHECK_TARGET_REPOS",
  "LINA_CHECK_USER_AGENT",
  "PUBLIC_BAY_REPOS",
  "TARGET_REPOS",
]);

/** Settings whose very presence names the upstream installation. */
export const WRANGLER_ABSENT_KEYS = Object.freeze(["account_id", "custom_domain", "pattern"]);

export function assertWranglerUnconfigured(source) {
  for (const key of WRANGLER_ABSENT_KEYS) {
    const present = new RegExp("^\\s*" + key + "\\s*=", "m").test(source);
    if (present) fail("wrangler-configured-key", key);
  }
  for (const name of WRANGLER_EMPTY_VARS) {
    const match = new RegExp("^" + name + ' = "([^"]*)"', "m").exec(source);
    if (!match) fail("wrangler-missing-var", name);
    if (match[1] !== "") fail("wrangler-nonempty-var", name + '="' + match[1] + '"');
  }
  return { emptied: WRANGLER_EMPTY_VARS.length, removed: WRANGLER_ABSENT_KEYS.length };
}

/**
 * A declared file whose bytes still match upstream is refused. Without that, a
 * stale declaration would leave a permanent hole: the edit could be reverted and
 * nothing would notice, because the exception would still be in force.
 */
export function assertModifiedUpstreamContract({
  declared,
  baselinePaths,
  presentPaths,
  changed,
  isRegularFile,
}) {
  if (typeof declared !== "object" || declared === null)
    fail("modified-upstream-shape", "derived.modifiedUpstreamFiles is missing");
  const names = Object.keys(declared).sort();
  if (!sameList(names, [...MODIFIED_UPSTREAM_FILES]))
    fail("modified-upstream-set", names.join(","));
  for (const path of names) {
    if (!nonEmptyReason(declared[path])) fail("modified-upstream-reason", path);
    if (!baselinePaths.has(path)) fail("modified-upstream-unknown", path);
    if (!presentPaths.has(path)) fail("modified-upstream-missing", path);
    if (!isRegularFile(path)) fail("modified-upstream-symlink", path);
    if (!changed(path)) fail("modified-upstream-unchanged", path);
  }
  return { files: names.length };
}

/**
 * Values that must not reappear in code or configuration this fork owns: the
 * upstream maintainer account, the upstream Cloudflare account, the upstream
 * App client, the two upstream operational hosts, and the upstream profile
 * registry.
 *
 * Each value is assembled from fragments rather than written out. A scanner that
 * spelled its own needles would match the file that defines them, so a literal
 * table would fail the check it exists to perform. The fragments also keep the
 * upstream maintainer's account name out of this fork's source.
 */
export const FORBIDDEN_INSTALLATION_LITERALS = Object.freeze([
  Object.freeze({ label: "upstream maintainer account", value: ["stei", "pete"].join("") }),
  Object.freeze({
    label: "upstream Cloudflare account",
    value: ["91b59577", "e757131d68d55a471fe32aca"].join(""),
  }),
  Object.freeze({ label: "upstream App client", value: ["Iv23li", "OECG0slfuhz093"].join("") }),
  Object.freeze({ label: "upstream dashboard host", value: ["clawsweeper.", "openclaw.ai"].join("") }),
  Object.freeze({ label: "upstream fleet host", value: ["crabfleet.", "openclaw.ai"].join("") }),
  Object.freeze({
    label: "upstream profile registry",
    value: ["raw.githubusercontent.com/", "openclaw/clawsweeper"].join(""),
  }),
]);

/**
 * Where the forbidden-literal scan applies: files whose bytes this fork owns and
 * that carry behaviour. Prose under devlog/ and docs/ is excluded on purpose,
 * because a record of what was removed has to be able to name it. Untouched
 * upstream files are excluded because the byte assertion already fixes them and
 * preserving them is this repository's contract.
 */
const SCANNED_PREFIXES = Object.freeze(["src/", "dashboard/", "config/", "schema/", "scripts/"]);

export function scannedForForbiddenLiterals(paths) {
  return [...paths].filter((path) => SCANNED_PREFIXES.some((prefix) => path.startsWith(prefix)));
}

export function assertNoForbiddenInstallationLiterals(paths, readFile) {
  for (const path of scannedForForbiddenLiterals(paths)) {
    const source = readFile(path);
    for (const { label, value } of FORBIDDEN_INSTALLATION_LITERALS)
      if (source.includes(value)) fail("installation-forbidden-literal", path + " -> " + label);
  }
}

const EMPTY_INSTALLATION_STRINGS = Object.freeze([
  ["branding", "product_name"],
  ["branding", "short_name"],
  ["branding", "user_agent"],
  ["branding", "dashboard_host"],
  ["targets", "registry_url"],
  ["state", "state_repo"],
  ["state", "state_ref"],
  ["github_app", "client_id"],
  ["github_app", "bot_login"],
]);

/**
 * The shipped entry point must stay empty. This is a different question from
 * whether the loader rejects an empty profile at runtime: this one keeps a
 * populated installation from being committed, which would hand every clone of
 * this fork somebody else's targets.
 */
export function assertShippedInstallationEmpty(profile) {
  if (typeof profile !== "object" || profile === null)
    fail("installation-shipped-shape", "installation profile must be an object");
  if (profile.schema_version !== 1)
    fail("installation-shipped-shape", "schema_version must be 1");
  if (profile.configured !== false)
    fail("installation-shipped-configured", "shipped installation must be unconfigured");
  for (const key of ["branding", "targets", "state", "github_app"])
    if (typeof profile[key] !== "object" || profile[key] === null)
      fail("installation-shipped-shape", "missing section: " + key);
  for (const key of ["fallback_owners", "repositories"]) {
    const list = profile.targets[key];
    if (!Array.isArray(list)) fail("installation-shipped-shape", "targets." + key + " must be an array");
    if (list.length !== 0) fail("installation-shipped-nonempty", "targets." + key);
  }
  for (const [section, key] of EMPTY_INSTALLATION_STRINGS) {
    const value = profile[section][key];
    if (typeof value !== "string")
      fail("installation-shipped-shape", section + "." + key + " must be a string");
    if (value !== "") fail("installation-shipped-nonempty", section + "." + key);
  }
  return { sections: 4, emptyStrings: EMPTY_INSTALLATION_STRINGS.length };
}

/** Parked workflows whose triggers would reach one of the four automatic actions. */
export const BOUNDARY_WORKFLOWS = Object.freeze([
  "automerge-e2e",
  "clawsweeper-dispatch",
  "repair-comment-router",
  "repair-publish-results",
  "sweep",
]);

const DERIVED_FILE_PATTERNS = Object.freeze([
  /^scripts\/lina-check-[a-z-]+\.mjs$/,
  new RegExp(
    "^(" +
      PLAN_UNITS.map((unit) => unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") +
      ")\\/(evidence\\/)?[0-9a-z_-]+\\.(md|json)$",
  ),
  /^src\/lina-check-[a-z-]+\.ts$/,
  /^config\/lina-check-[a-z-]+\.json$/,
  /^schema\/lina-check-[a-z-]+\.schema\.json$/,
  /^docs\/lina-check\/[a-z0-9-]+\.md$/,
  /^test\/lina-check-[a-z-]+\.test\.ts$/,
]);
const DERIVED_SCRIPT_COMMAND = /^node (scripts\/lina-check-[a-z-]+\.mjs)(?: [a-z-]+)*$/;
const BLOCKED_NODE_TARGET = /\bnode ([\w./-]+\.(?:js|mjs|cjs|ts|mts))\b/g;

export class DerivedContractError extends Error {
  constructor(code, detail) {
    super(code + ": " + detail);
    this.name = "DerivedContractError";
    this.code = code;
  }
}

const fail = (code, detail) => {
  throw new DerivedContractError(code, detail);
};

const isSortedUnique = (list) =>
  list.every((value, index) => index === 0 || list[index - 1] < value);

const sameList = (left, right) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const nonEmptyReason = (entry) =>
  typeof entry === "object" &&
  entry !== null &&
  typeof entry.reason === "string" &&
  entry.reason.trim() !== "";

// Module invariants I1-I3. A broken literal must fail at import, not at call time.
assertSafeTestListShape(SAFE_TESTS, SAFE_TEST_COUNT);
if (!isSortedUnique(EXCLUDED_TESTS)) throw new Error("EXCLUDED_TESTS must be sorted and unique");
if (SAFE_TESTS.some((path) => EXCLUDED_TESTS.includes(path)))
  throw new Error("SAFE_TESTS and EXCLUDED_TESTS must be disjoint");
if (BOUNDARY_PROBE_SCRIPTS.length !== 8 || new Set(BOUNDARY_PROBE_SCRIPTS).size !== 8)
  throw new Error("BOUNDARY_PROBES must hold 8 distinct scripts");
if (!sameList(Object.keys(DERIVED_SCRIPT_COMMANDS).sort(), [...DERIVED_SCRIPT_NAMES]))
  throw new Error("DERIVED_SCRIPT_COMMANDS must cover exactly DERIVED_SCRIPT_NAMES");

export const guardCommand = (name) => "node scripts/scaffold-disabled.mjs " + name;

/** Refuse to invoke a probe target whose package script is no longer the scaffold guard. */
export function assertProbeTargetGuarded(packageScripts, name) {
  if (packageScripts[name] !== guardCommand(name)) fail("probe-unguarded", name);
}

/**
 * The command text pointing at the guard is not the same as the guard still being
 * a guard. Verify its bytes before the probe invokes anything, so a guard that was
 * edited to act first and print the familiar diagnostic afterwards cannot pass.
 */
export function assertGuardIntact(readFile, digest) {
  const actual = digest(readFile(GUARD_PATH));
  if (actual !== GUARD_SHA256) fail("guard-tampered", GUARD_PATH + " sha256=" + actual);
}

/** A pre/post script would run alongside the guarded command. */
export function assertNoLifecycleHooks(packageScripts, names) {
  for (const name of names)
    for (const prefix of ["pre", "post"])
      if (Object.hasOwn(packageScripts, prefix + name))
        fail("probe-lifecycle-hook", prefix + name);
}

/** entries: [{ workflow, active, parked }] with active covering every YAML spelling. */
export function assertWorkflowsParked(entries) {
  for (const entry of entries) {
    if (entry.active) fail("workflow-active", entry.workflow);
    if (!entry.parked) fail("workflow-not-parked", entry.workflow);
  }
}

export function assertWorktreeUnchanged(before, after) {
  if (before !== after) fail("worktree-changed", "git status changed across the probe");
}

/** Operational entrypoints reachable from the blocked upstream commands. */
export function blockedNodeTargets(blockedScripts) {
  const targets = new Set();
  for (const command of Object.values(blockedScripts))
    for (const match of command.matchAll(BLOCKED_NODE_TARGET)) targets.add(match[1]);
  return targets;
}

export function assertDerivedContract({
  config,
  upstreamScripts,
  packageScripts,
  baselinePaths,
  presentPaths,
  coreAdditions,
  docs,
  readFile,
  isRegularFile,
}) {
  const derived = config.derived;
  if (typeof derived !== "object" || derived === null) fail("derived-shape", "derived is missing");
  for (const key of ["files", "scripts", "safeTests", "excludedTests", "boundaryProbes"])
    if (typeof derived[key] !== "object" || derived[key] === null)
      fail("derived-shape", "derived." + key + " is missing");

  const declared = Object.keys(derived.files);
  if (declared.length === 0) fail("derived-empty", "derived.files declares nothing");
  for (const path of declared) {
    if (path.includes("..") || path.startsWith("/")) fail("derived-traversal", path);
    if (!DERIVED_FILE_PATTERNS.some((pattern) => pattern.test(path)))
      fail("derived-location", path);
    if (baselinePaths.has(path)) fail("derived-upstream-collision", path);
    if (!nonEmptyReason(derived.files[path])) fail("derived-reason", path);
    if (!presentPaths.has(path)) fail("derived-missing", path);
    if (!isRegularFile(path)) fail("derived-symlink", path);
  }

  const allowedPaths = new Set([...coreAdditions, ...declared]);
  for (const path of presentPaths)
    if (!baselinePaths.has(path) && !allowedPaths.has(path)) fail("derived-undeclared", path);

  const scriptNames = Object.keys(derived.scripts).sort();
  if (!sameList(scriptNames, [...DERIVED_SCRIPT_NAMES]))
    fail("script-set", scriptNames.join(","));
  const blockedTargets = blockedNodeTargets(config.blockedScripts);
  for (const name of scriptNames) {
    if (Object.hasOwn(upstreamScripts, name)) fail("script-upstream-name", name);
    const entry = derived.scripts[name];
    if (!nonEmptyReason(entry)) fail("derived-reason", name);
    const command = entry.command;
    const match = typeof command === "string" ? DERIVED_SCRIPT_COMMAND.exec(command) : null;
    if (!match || !declared.includes(match[1])) fail("script-command", name);
    if (command !== DERIVED_SCRIPT_COMMANDS[name]) fail("script-command", name);
    if (packageScripts[name] !== DERIVED_SCRIPT_COMMANDS[name])
      fail("script-package-mismatch", name);
  }
  for (const path of declared) {
    if (!path.endsWith(".mjs")) continue;
    const source = readFile(path);
    for (const target of blockedTargets)
      if (source.includes(target)) fail("script-blocked-target", path + " -> " + target);
  }

  const safe = derived.safeTests.files;
  // Read the path defensively: a null or non-object entry must surface as a
  // stable contract rejection, not as a TypeError from destructuring.
  if (
    !Array.isArray(safe) ||
    !sameList(
      safe.map((entry) => (typeof entry === "object" && entry !== null ? entry.path : undefined)),
      [...SAFE_TESTS],
    )
  )
    fail("safe-tests-mismatch", "declared restored tests differ from SAFE_TESTS");
  for (const entry of safe) {
    if (!nonEmptyReason(entry)) fail("safe-tests-reason", entry.path);
    if (!baselinePaths.has(entry.path)) fail("safe-tests-unknown-path", entry.path);
  }

  const excludedPaths = Object.keys(derived.excludedTests).sort();
  if (!sameList(excludedPaths, [...EXCLUDED_TESTS])) fail("excluded-tests-mismatch", "see literal");
  for (const path of excludedPaths)
    if (!nonEmptyReason(derived.excludedTests[path])) fail("excluded-tests-reason", path);

  const probes = derived.boundaryProbes.scripts;
  if (!Array.isArray(probes) || !sameList(probes, [...BOUNDARY_PROBE_SCRIPTS]))
    fail("probe-mismatch", "declared probe scripts differ from BOUNDARY_PROBE_SCRIPTS");
  for (const name of probes)
    if (!Object.hasOwn(config.blockedScripts, name)) fail("probe-not-blocked", name);
  const probeWorkflows = derived.boundaryProbes.workflows;
  if (!Array.isArray(probeWorkflows) || !sameList(probeWorkflows, [...BOUNDARY_WORKFLOWS]))
    fail("probe-workflow-mismatch", "declared probe workflows differ from BOUNDARY_WORKFLOWS");

  const replaced = derived.replacedUpstreamDocs;
  if (!Array.isArray(replaced) || !sameList([...replaced].sort(), [...docs].sort()))
    fail("replaced-docs-mismatch", "declared fork-owned docs differ from the upstream doc set");

  return {
    files: declared.length,
    scripts: scriptNames.length,
    safeTests: safe.length,
    probes: probes.length,
  };
}
