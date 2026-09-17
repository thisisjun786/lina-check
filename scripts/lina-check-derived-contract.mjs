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

/**
 * Plan units whose documents may be declared as derived files. Listing them here
 * rather than widening the pattern to all of devlog/_plan keeps a new directory
 * name from silently becoming an accepted location.
 */
export const PLAN_UNITS = Object.freeze([PLAN_UNIT, PLAN_UNIT_JUN198]);

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

/**
 * Restored tests that run against pinned upstream bytes rather than this fork's
 * files, with the files each one needs.
 *
 * test/repository-profiles.test.ts asserts the dashboard target variables still
 * name the upstream project's repositories. Emptying them is the point of this
 * change, so the assertion cannot hold here. Dropping the suite would have cost
 * its profile and schema coverage too, which has nothing to do with the target
 * lists, so instead its two working-directory reads are pointed at the pin.
 *
 * This proves the upstream profile resolver still behaves on upstream input. It
 * proves nothing about this fork's configuration; that is asserted separately by
 * check:scaffold against the real files.
 */
export const UPSTREAM_FIXTURE_TESTS = Object.freeze({
  "test/repository-profiles.test.ts": Object.freeze([
    "config/target-repositories.json",
    "dashboard/wrangler.toml",
  ]),
});

export const UPSTREAM_FIXTURE_TEST_NAMES = Object.freeze(Object.keys(UPSTREAM_FIXTURE_TESTS).sort());

export function assertFixtureTestContract(declared, baselinePaths) {
  const names = Object.keys(declared ?? {}).sort();
  if (!sameList(names, [...UPSTREAM_FIXTURE_TEST_NAMES])) fail("fixture-test-set", names.join(","));
  for (const name of names) {
    if (!SAFE_TESTS.includes(name)) fail("fixture-test-unrestored", name);
    if (!nonEmptyReason(declared[name])) fail("fixture-test-reason", name);
    const files = UPSTREAM_FIXTURE_TESTS[name];
    if (!sameList([...(declared[name].files ?? [])], [...files]))
      fail("fixture-test-files", name);
    for (const file of files)
      if (!baselinePaths.has(file)) fail("fixture-test-path", file);
  }
  return { tests: names.length };
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
  "LINA_CHECK_INSTALLATION_CONFIGURED",
  "LINA_CHECK_TARGET_OWNERS",
  "LINA_CHECK_TARGET_REGISTRY_URL",
  "LINA_CHECK_TARGET_REPOS",
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
