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

/** The probe must not invoke anything unless the guard it relies on is unchanged. */
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
 * This project pins pnpm through Corepack (AGENTS.md). A probe that silently
 * accepted an arbitrary PATH pnpm would certify the guards under an unsupported
 * package manager, so the observed version must equal the pinned one.
 */
export function assertPinnedPnpm(packageManagerField, observedVersion) {
  const expected = String(packageManagerField).replace(/^pnpm@/, "");
  if (observedVersion !== expected)
    fail("launcher-unpinned", "expected pnpm " + expected + ", observed " + observedVersion);
}

/** Upstream tests restored for execution: hermetic and compatible with the parked profile. */
export const SAFE_TESTS = Object.freeze([
  "test/apply-close-policy-guards.test.ts",
  "test/apply-label-sync.test.ts",
  "test/automerge-metrics.test.ts",
  "test/check-dashboard-strict.test.ts",
  "test/check-docs.test.ts",
  "test/close-reasons.test.ts",
  "test/label-mutation-batch.test.ts",
  "test/manual-publication-authority.test.ts",
  "test/manual-publication-policy.test.ts",
  "test/parked-command-finalization.test.ts",
  "test/pr-label-policy.test.ts",
  "test/repository-profiles.test.ts",
  "test/stable-json.test.ts",
]);

/** Hermetic but structurally incompatible with the dormant profile; never restored. */
export const EXCLUDED_TESTS = Object.freeze([
  "test/hosted-target-admission.test.ts",
  "test/run-node-tests.test.ts",
]);

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
  /^devlog\/_plan\/260917_jun135_part_a\/(evidence\/)?[0-9a-z_-]+\.(md|json)$/,
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
if (SAFE_TESTS.length !== 13 || !isSortedUnique(SAFE_TESTS))
  throw new Error("SAFE_TESTS must hold 13 sorted unique paths");
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
  if (!Array.isArray(safe) || !sameList(safe.map(({ path }) => path), [...SAFE_TESTS]))
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
