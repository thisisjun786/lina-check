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

export const TRIPWIRE_ENV = "LINA_CHECK_SPAWN_TRIPWIRE";
export const PLAN_UNIT = "devlog/_plan/260917_jun135_part_a";
export const PLAN_UNIT_JUN198 = "devlog/_plan/260917_jun198_install_profile";
export const PLAN_UNIT_JUN203 = "devlog/_plan/260917_jun203_safe_test_lane";

/**
 * Plan units whose documents may be declared as derived files. Listing them here
 * rather than widening the pattern to all of devlog/_plan keeps a new directory
 * name from silently becoming an accepted location.
 */
export const PLAN_UNITS = Object.freeze([PLAN_UNIT, PLAN_UNIT_JUN198, PLAN_UNIT_JUN203]);

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
export function reapLaunchGroup(outcome, kill) {
  const pid = outcome === null || typeof outcome !== "object" ? undefined : outcome.pid;
  // A pid of 0 or 1 would address this process's own group or init.
  if (!Number.isInteger(pid) || pid <= 1) return { reaped: false, reason: "no usable process group" };
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
export const DERIVED_TESTS = Object.freeze(["test/lina-check-admission.test.ts"]);

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
]);

export function assertDerivedTestContract({ declared, baselinePaths, presentPaths, readFile }) {
  const names = Object.keys(declared ?? {}).sort();
  if (!sameList(names, [...DERIVED_TESTS])) fail("derived-test-set", names.join(","));
  for (const path of names) {
    if (!nonEmptyReason(declared[path])) fail("derived-test-reason", path);
    if (baselinePaths.has(path)) fail("derived-test-upstream-collision", path);
    if (!presentPaths.has(path)) fail("derived-test-missing", path);
    if (SAFE_TESTS.includes(path) || EXCLUDED_TESTS.includes(path))
      fail("derived-test-upstream-collision", path);
    const source = readFile(path);
    for (const token of SPAWN_SURFACE)
      if (source.includes(token)) fail("derived-test-spawns", path + " -> " + token);
  }
  return { tests: names.length };
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
