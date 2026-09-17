#!/usr/bin/env node

/**
 * Definition: negative verification for the derived-change contract. A contract
 * that only ever sees valid input proves nothing, so this self-test feeds a
 * deliberately broken declaration for every rejection path and asserts that the
 * contract rejects it with the expected code.
 *
* It also runs the two tripwire controls for the preview claim: the negative
* control (preview must not reach the launch boundary) and the positive control
* (a real run must reach it and say so by name). Without the positive control a
* dead tripwire would look like a passing preview.
 *
 * Finally it checks that the validator itself has not lost assertions relative to
 * the fork handoff baseline. Editing scripts/check-scaffold.mjs is a known way
 * around every check in this repository, so that bypass gets an early warning
 * rather than only a sentence in the plan.
 *
 * Exit codes: 0 every rejection path rejected, 1 a path failed to reject.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  BUILD_DISPOSITIONS,
  BOUNDARY_PROBE_SCRIPTS,
  DerivedContractError,
  EXCLUDED_TESTS,
  FORBIDDEN_INSTALLATION_LITERALS,
  GUARD_SHA256,
  INSTALLATION_CONFIG_PATH,
  LANE_TIMEOUT_MS,
  MODIFIED_UPSTREAM_FILES,
  SAFE_TESTS,
  SAFE_TEST_COUNT,
  TRIPWIRE_ENV,
  UPSTREAM_FIXTURE_TEST_NAMES,
  WRANGLER_PATH,
  assertDerivedContract,
  assertFixtureTestContract,
  assertGuardIntact,
  assertModifiedUpstreamContract,
  assertNoForbiddenInstallationLiterals,
  assertNoLifecycleHooks,
  assertPinnedPnpm,
  assertProbeTargetGuarded,
  assertSafeTestListShape,
  assertShippedInstallationEmpty,
  assertWranglerUnconfigured,
  assertWorkflowsParked,
  assertWorktreeUnchanged,
  blockedNodeTargets,
  classifyBuildPair,
  describeLaunchOutcome,
  reapLaunchGroup,
  interruptExitCode,
} from "./lina-check-derived-contract.mjs";
import { launchTests, main as runnerMain } from "./lina-check-safe-tests.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const LABEL = "[lina-check-contract-selftest]";
const BASELINE_COMMIT = "1f36c10eeea8d3c36c477e7f91e0d405781556b3";
const BASELINE_ASSERTION_CALLS = 23;
// The count this change establishes. The floor must be the current expectation,
// not the historical baseline: a floor of 23 would let the 26-assertion
// validator shed three and still pass whenever the baseline object is absent.
// Adding assertions legitimately raises this number; it never lowers.
const VALIDATOR_ASSERTION_FLOOR = 29;
const ASSERTION_CALL = /^\s*assert(\.|\()/;
const VALIDATOR = "scripts/check-scaffold.mjs";
const DOCS = ["README.md", "AGENTS.md", "CONTRIBUTING.md", "VISION.md"];
const config = JSON.parse(readFileSync(join(root, "config", "lina-check-scaffold.json"), "utf8"));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

function baseInput() {
  const cloned = structuredClone(config);
  return {
    config: cloned,
    upstreamScripts: { review: "node dist/placeholder.js review" },
    packageScripts: structuredClone(pkg.scripts),
    baselinePaths: new Set([...SAFE_TESTS, ...EXCLUDED_TESTS, "src/clawsweeper.ts"]),
    presentPaths: new Set(Object.keys(cloned.derived.files)),
    coreAdditions: new Set(),
    docs: [...DOCS],
    readFile: () => "",
    isRegularFile: () => true,
  };
}

const first = (input) => Object.keys(input.config.derived.files)[0];

const cases = [
  ["derived-shape", (i) => delete i.config.derived.files],
  ["derived-empty", (i) => (i.config.derived.files = {})],
  [
    "derived-traversal",
    (i) => {
      i.config.derived.files["scripts/../lina-check-x.mjs"] = { reason: "bad" };
      i.presentPaths.add("scripts/../lina-check-x.mjs");
    },
  ],
  [
    "derived-location",
    (i) => {
      i.config.derived.files["src/lina-check-x.mjs"] = { reason: "bad" };
      i.presentPaths.add("src/lina-check-x.mjs");
    },
  ],
  ["derived-upstream-collision", (i) => i.baselinePaths.add(first(i))],
  ["derived-reason", (i) => (i.config.derived.files[first(i)] = { reason: "   " })],
  ["derived-missing", (i) => i.presentPaths.delete(first(i))],
  ["derived-symlink", (i) => (i.isRegularFile = () => false)],
  ["derived-undeclared", (i) => i.presentPaths.add("scripts/lina-check-rogue.mjs")],
  ["script-set", (i) => delete i.config.derived.scripts["lina:test-safe"]],
  ["script-upstream-name", (i) => (i.upstreamScripts["lina:test-safe"] = "x")],
  [
    "script-command",
    (i) => (i.config.derived.scripts["lina:test-safe"].command = "node scripts/elsewhere.mjs run"),
  ],
  [
    "script-command-substitution",
    (i) =>
      (i.config.derived.scripts["lina:test-safe:preview"].command =
        "node scripts/lina-check-safe-tests.mjs run"),
    "script-command",
  ],
  [
    "script-package-mismatch",
    (i) => (i.packageScripts["lina:test-safe"] = "node scripts/lina-check-safe-tests.mjs preview"),
  ],
  [
    "script-package-substitution",
    (i) =>
      (i.packageScripts["lina:test-safe:preview"] =
        "node scripts/lina-check-safe-tests.mjs run"),
    "script-package-mismatch",
  ],
  [
    "script-blocked-target",
    (i) => {
      const target = [...blockedNodeTargets(i.config.blockedScripts)][0];
      assert.ok(target, "expected at least one blocked node target");
      i.readFile = () => "import x from '" + target + "';";
    },
  ],
  [
    "safe-tests-mismatch-substitution",
    (i) => {
      const files = i.config.derived.safeTests.files;
      files[files.length - 1] = { path: EXCLUDED_TESTS[0], reason: "same count, swapped in" };
    },
    "safe-tests-mismatch",
  ],
  [
    "safe-tests-mismatch-reorder",
    (i) => {
      const files = i.config.derived.safeTests.files;
      [files[0], files[1]] = [files[1], files[0]];
    },
    "safe-tests-mismatch",
  ],
  [
    "safe-tests-mismatch-duplicate",
    (i) => {
      const files = i.config.derived.safeTests.files;
      files[1] = structuredClone(files[0]);
    },
    "safe-tests-mismatch",
  ],
  [
    "safe-tests-mismatch-count",
    (i) => i.config.derived.safeTests.files.pop(),
    "safe-tests-mismatch",
  ],
  [
    "safe-tests-null-entry",
    (i) => (i.config.derived.safeTests.files[0] = null),
    "safe-tests-mismatch",
  ],
  ["safe-tests-reason", (i) => (i.config.derived.safeTests.files[0].reason = "")],
  ["safe-tests-unknown-path", (i) => i.baselinePaths.delete(SAFE_TESTS[0])],
  ["excluded-tests-mismatch", (i) => delete i.config.derived.excludedTests[EXCLUDED_TESTS[0]]],
  [
    "excluded-tests-reason",
    (i) => (i.config.derived.excludedTests[EXCLUDED_TESTS[0]] = { reason: " " }),
  ],
  ["probe-mismatch", (i) => i.config.derived.boundaryProbes.scripts.shift()],
  [
    "probe-mismatch-extra",
    (i) => i.config.derived.boundaryProbes.scripts.push("review"),
    "probe-mismatch",
  ],
  ["probe-workflow-mismatch", (i) => i.config.derived.boundaryProbes.workflows.pop()],
  [
    "probe-not-blocked",
    (i) => delete i.config.blockedScripts[BOUNDARY_PROBE_SCRIPTS[0]],
  ],
  ["replaced-docs-mismatch", (i) => (i.docs = ["README.md"])],
];

function runDeclarationCases() {
  const summary = assertDerivedContract(baseInput());
  assert.equal(summary.safeTests, SAFE_TESTS.length);
  let checked = 0;
  for (const [name, mutate, expected] of cases) {
    const input = baseInput();
    mutate(input);
    let raised = null;
    try {
      assertDerivedContract(input);
    } catch (error) {
      raised = error;
    }
    assert.ok(raised, name + ": the contract accepted a declaration it must reject");
    assert.ok(
      raised instanceof DerivedContractError,
      name + ": expected DerivedContractError, saw " + String(raised && raised.name),
    );
    assert.equal(raised.code, expected === undefined ? name : expected, name);
    checked += 1;
  }
  return checked;
}

function runHelperCases() {
  assert.throws(() => assertProbeTargetGuarded({ "repair:execute-fix": "node dist/x.js" }, "repair:execute-fix"), {
    code: "probe-unguarded",
  });
  assert.throws(() => assertWorktreeUnchanged("", " M src/x.ts"), { code: "worktree-changed" });
  assertWorktreeUnchanged("same", "same");
  // A guard that still carries the expected command text can have been edited to
  // act first and print the familiar diagnostic afterwards. Digest, not text.
  assert.throws(() => assertGuardIntact(() => "tampered", () => "0".repeat(64)), {
    code: "guard-tampered",
  });
  assertGuardIntact(() => "whatever", () => GUARD_SHA256);
  assert.throws(
    () => assertNoLifecycleHooks({ "prerepair:execute-fix": "x" }, ["repair:execute-fix"]),
    { code: "probe-lifecycle-hook" },
  );
  assert.throws(
    () => assertNoLifecycleHooks({ "postapply-decisions": "x" }, ["apply-decisions"]),
    { code: "probe-lifecycle-hook" },
  );
  assertNoLifecycleHooks({ "repair:execute-fix": "x" }, ["repair:execute-fix"]);
  // GitHub reads both spellings, so a .yaml sibling must not read as parked.
  assert.throws(
    () => assertWorkflowsParked([{ workflow: "sweep", active: true, parked: true }]),
    { code: "workflow-active" },
  );
  assert.throws(
    () => assertWorkflowsParked([{ workflow: "sweep", active: false, parked: false }]),
    { code: "workflow-not-parked" },
  );
  assertWorkflowsParked([{ workflow: "sweep", active: false, parked: true }]);
  // Built-output freshness is decided per source/output pair. Comparing the
  // newest file anywhere under each tree would let a partial build refresh
  // unrelated output and hide a superseded module a restored test imports.
  assert.equal(
    classifyBuildPair({ outputExists: false, sourceMtimeMs: 1, outputMtimeMs: 2 }),
    "missing",
  );
  assert.equal(
    classifyBuildPair({ outputExists: true, sourceMtimeMs: 3, outputMtimeMs: 2 }),
    "stale",
  );
  assert.equal(
    classifyBuildPair({ outputExists: true, sourceMtimeMs: 2, outputMtimeMs: 2 }),
    "current",
  );
  assert.equal(
    classifyBuildPair({ outputExists: true, sourceMtimeMs: 1, outputMtimeMs: 2 }),
    "current",
  );
  assert.equal(
    classifyBuildPair({
      outputExists: true,
      sourceMtimeMs: Number.NEGATIVE_INFINITY,
      outputMtimeMs: 2,
    }),
    "unknown",
  );
  // The probe must not certify the guards under an unpinned package manager.
  assertPinnedPnpm("pnpm@12.4.1", "12.4.1");
  assert.throws(() => assertPinnedPnpm("pnpm@12.4.1", "11.0.0"), {
    code: "launcher-unpinned",
  });
  return 18;
}

/**
 * The lane's own invariants. The restored-test count used to be an inline
 * comparison inside the contract module, which meant the only way to exercise it
 * was to break the module; growing the lane from 13 tests to 206 made that cost real.
 * Both invariants are now functions, and every refusal is fed a case here.
 */
function runLaneShapeCases() {
  let observed = 0;
  // Clean control first: a checker that refuses everything would satisfy every
  // rejection below and prove nothing.
  assert.equal(assertSafeTestListShape([...SAFE_TESTS], SAFE_TEST_COUNT), SAFE_TEST_COUNT);
  const shapeCases = [
    ["safe-test-shape", "not a list"],
    ["safe-test-count", [...SAFE_TESTS].slice(1)],
    ["safe-test-count", [...SAFE_TESTS, "test/zzz-widened.test.ts"]],
    ["safe-test-order", [...SAFE_TESTS].reverse()],
    ["safe-test-order", [SAFE_TESTS[0], SAFE_TESTS[0], ...SAFE_TESTS.slice(2)]],
  ];
  for (const [code, list] of shapeCases) {
    assert.throws(() => assertSafeTestListShape(list, SAFE_TEST_COUNT), { code }, "expected " + code);
    observed += 1;
  }

  // A launch that never started and a launch stopped at the lane bound both carry
  // a status a bare success check would misread, so every branch is named. The
  // timeout case is written the way spawnSync actually reports one, which is all
  // three signals at once: a null status, a SIGTERM, and an ETIMEDOUT error. A
  // hand-written signal-only object passes against a classifier that reads the
  // error first and calls a timeout a failed launch, so it would have proved
  // nothing.
  const timedOut = Object.assign(new Error("spawnSync ETIMEDOUT"), { code: "ETIMEDOUT" });
  const outcomes = [
    [{ status: 0 }, "ok", 0],
    [{ status: 3 }, "failed", 3],
    [{ status: null }, "failed", 1],
    [{ status: null, signal: "SIGTERM", error: timedOut }, "timeout", 1],
    [{ signal: "SIGTERM" }, "signal", 1],
    [{ error: new Error("spawn ENOENT") }, "unstarted", null],
    [null, "unusable", 1],
  ];
  for (const [outcome, kind, exitCode] of outcomes) {
    const verdict = describeLaunchOutcome(outcome, LANE_TIMEOUT_MS);
    assert.equal(verdict.kind, kind, "expected " + kind);
    assert.equal(verdict.exitCode, exitCode, "exit code for " + kind);
    observed += 1;
  }
  assert.ok(
    describeLaunchOutcome(
      { status: null, signal: "SIGTERM", error: timedOut },
      LANE_TIMEOUT_MS,
    ).detail.includes(String(LANE_TIMEOUT_MS)),
    "a launch stopped at the bound must name the bound",
  );
  observed += 1;
  // The shape is reproduced rather than asserted from memory: spawnSync is the
  // only thing that decides what a timeout looks like.
  const observedTimeout = spawnSync(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    timeout: 100,
  });
  assert.equal(observedTimeout.error?.code, "ETIMEDOUT", "spawnSync must report a timeout error");
  assert.equal(
    describeLaunchOutcome(observedTimeout, LANE_TIMEOUT_MS).kind,
    "timeout",
    "a real spawnSync timeout must be classified as one",
  );
  observed += 1;

  // The bound stops the runner; the tests it started can still be alive. The
  // reap is driven with an injected kill so this walks every branch without
  // signalling anything.
  const signalled = [];
  const spy = (pid, signal) => signalled.push([pid, signal]);
  assert.deepEqual(reapLaunchGroup({ pid: 4242 }, spy), { reaped: true, group: -4242 });
  assert.deepEqual(signalled, [[-4242, "SIGKILL"]]);
  for (const outcome of [null, {}, { pid: 1 }, { pid: 0 }, { pid: -3 }, { pid: 1.5 }]) {
    const result = reapLaunchGroup(outcome, spy);
    assert.equal(result.reaped, false, "must refuse " + JSON.stringify(outcome));
    observed += 1;
  }
  assert.equal(signalled.length, 1, "a refused reap must signal nothing");
  const failing = reapLaunchGroup({ pid: 4242 }, () => {
    throw Object.assign(new Error("no such process"), { code: "ESRCH" });
  });
  assert.deepEqual(failing, { reaped: false, reason: "ESRCH" });
  observed += 2;

  // Windows has no signalable process group, so the reap must say that rather
  // than report a swallowed throw, which reads like "nothing left to reap".
  const onWindows = reapLaunchGroup({ pid: 4242 }, () => {
    throw new Error("the kill must not be attempted on win32");
  }, "win32");
  assert.equal(onWindows.reaped, false);
  assert.match(onWindows.reason, /win32/);
  assert.equal(reapLaunchGroup({ pid: 4242 }, spy, "linux").reaped, true);
  observed += 3;

  // Ordering, which is the part reapLaunchGroup cannot check about itself. The
  // first version judged every launch after all of them had run and returned on
  // the first failure, so a later launch stopped at the bound kept its
  // descendants. Drive the real sequence with an early failure in front of a
  // timeout and watch for the reap.
  const boundedOut = {
    pid: 5150,
    status: null,
    signal: "SIGTERM",
    error: Object.assign(new Error("spawnSync ETIMEDOUT"), { code: "ETIMEDOUT" }),
  };
  const reaped = [];
  const launched = [];
  const directories = [];
  const exitCode = runnerMain(["run"], {
    distState: () => ({ present: true, disposition: "fresh", detail: null, pairs: 1 }),
    launchTests: (paths) => {
      launched.push(paths.length);
      // The root batch fails first; the first fixture launch then times out.
      if (launched.length === 1) return { pid: 4141, status: 3 };
      if (launched.length === 2) return boundedOut;
      return { pid: 4242, status: 0 };
    },
    makeFixture: () => {
      const directory = mkdtempSync(join(tmpdir(), "lina-check-selftest-"));
      directories.push(directory);
      return directory;
    },
    reap: (outcome) => {
      // Record where in the sequence the reap happened, not just that it did.
      // "Reaped eventually" is exactly the property the broken version also had.
      reaped.push({
        outcome,
        launchesSoFar: launched.length,
        fixtureStillPresent: existsSync(directories[directories.length - 1]),
      });
      return { reaped: true, group: -outcome.pid };
    },
  });
  assert.equal(exitCode, 3, "the first failure still decides the exit code");
  assert.equal(reaped.length, 1, "a timeout after an earlier failure must still be reaped");
  assert.equal(reaped[0].outcome, boundedOut, "the reaped outcome must be the timed-out launch");
  assert.equal(
    reaped[0].launchesSoFar,
    2,
    "the reap must happen before the next launch, not after the run",
  );
  assert.equal(
    reaped[0].fixtureStillPresent,
    true,
    "the reap must happen before that launch's fixture directory is removed",
  );
  assert.ok(launched.length > 2, "an earlier failure must not stop the remaining launches");
  for (const directory of directories)
    assert.equal(existsSync(directory), false, "every fixture directory must be removed");
  observed += 6;

  // A signalled end is not a timeout, but it leaves the same group behind. An
  // operator interrupt or an out-of-memory kill stops the runner while the
  // processes its tests started keep running, so this path reaps too.
  const signalled2 = { pid: 6260, status: null, signal: "SIGKILL" };
  const signalReaped = [];
  const signalExit = runnerMain(["run"], {
    distState: () => ({ present: true, disposition: "fresh", detail: null, pairs: 1 }),
    launchTests: () => signalled2,
    makeFixture: () => mkdtempSync(join(tmpdir(), "lina-check-selftest-")),
    reap: (outcome) => {
      signalReaped.push(outcome);
      return { reaped: true, group: -outcome.pid };
    },
  });
  assert.equal(signalExit, 1, "a signalled launch exits 1");
  assert.equal(signalReaped.length, 24, "every signalled launch must be reaped");
  // An ordinary failure has no group left to reap and must not be signalled.
  const quietReaped = [];
  const quietExit = runnerMain(["run"], {
    distState: () => ({ present: true, disposition: "fresh", detail: null, pairs: 1 }),
    launchTests: () => ({ pid: 6261, status: 2 }),
    makeFixture: () => mkdtempSync(join(tmpdir(), "lina-check-selftest-")),
    reap: (outcome) => {
      quietReaped.push(outcome);
      return { reaped: true, group: -outcome.pid };
    },
  });
  assert.equal(quietExit, 2, "an ordinary failure keeps its exit code");
  assert.deepEqual(quietReaped, [], "an ordinary failure must not reap anything");
  observed += 4;

  // An interrupt aimed at the lane does not reach a detached launch, so the
  // lane defers its exit until the launch in flight returns and reaps that
  // group on the way out. Anything else leaves the tests running.
  assert.equal(interruptExitCode("SIGINT"), 130);
  assert.equal(interruptExitCode("SIGTERM"), 143);
  assert.equal(interruptExitCode("SIGHUP"), 1);
  const stopReaped = [];
  const stopLaunched = [];
  let stopAfterFirst = null;
  const stopExit = runnerMain(["run"], {
    distState: () => ({ present: true, disposition: "fresh", detail: null, pairs: 1 }),
    launchTests: () => {
      stopLaunched.push(1);
      stopAfterFirst = "SIGINT";
      return { pid: 7070, status: 0 };
    },
    makeFixture: () => mkdtempSync(join(tmpdir(), "lina-check-selftest-")),
    reap: (outcome) => {
      stopReaped.push(outcome);
      return { reaped: true, group: -outcome.pid };
    },
    interrupted: () => stopAfterFirst,
  });
  assert.equal(stopExit, 130, "an interrupted lane reports the interrupt, not success");
  assert.equal(stopLaunched.length, 1, "an interrupt must stop the remaining launches");
  assert.equal(stopReaped.length, 1, "the launch in flight must be reaped on the way out");
  observed += 6;
  return observed;
}

function runTripwireControls() {
  const env = { ...process.env, [TRIPWIRE_ENV]: "1" };
  const script = "scripts/lina-check-safe-tests.mjs";
  const preview = spawnSync(process.execPath, [script, "preview", "--json"], {
    cwd: root,
    encoding: "utf8",
    env,
  });
  assert.equal(preview.status, 0, "negative control: preview must not reach the launch boundary");
  const report = JSON.parse(preview.stdout);
  assert.equal(report.executed, false);
  // Validate the disposition before branching on it. Anything other than fresh
  // takes the lenient path, so an invalid value would skip the positive control
  // and still exit successfully.
  assert.ok(
    BUILD_DISPOSITIONS.includes(report.distDisposition),
    "negative control: preview reported an invalid distDisposition " +
      String(report.distDisposition),
  );
  // Positive control, isolated from the built-output preflight: call the launch
  // site directly rather than through the CLI. Driving it through the CLI made it
  // depend on dist/ being fresh, and skipping it there would let a broken
  // tripwire exit successfully. This needs no built output, so it always runs.
  const saved = process.env[TRIPWIRE_ENV];
  process.env[TRIPWIRE_ENV] = "1";
  let tripped = null;
  try {
    launchTests(["test/stable-json.test.ts"], 1);
  } catch (error) {
    tripped = error;
  } finally {
    if (saved === undefined) delete process.env[TRIPWIRE_ENV];
    else process.env[TRIPWIRE_ENV] = saved;
  }
  assert.ok(tripped, "positive control: launchTests must refuse while the tripwire is set");
  assert.ok(
    String(tripped.message).includes(TRIPWIRE_ENV),
    "positive control: the refusal must name " + TRIPWIRE_ENV,
  );
  // Routing control. The direct call above proves the tripwire is alive, but not
  // that run mode still routes through it: if main stopped calling launchTests,
  // that control would keep passing. Drive main itself, injecting a fresh
  // built-output verdict so the control needs no build and never has to be
  // skipped. Production callers get the real probe.
  const savedRouting = process.env[TRIPWIRE_ENV];
  process.env[TRIPWIRE_ENV] = "1";
  let routed = null;
  try {
    runnerMain(["run"], {
      distState: () => ({ present: true, disposition: "fresh", detail: null, pairs: 1 }),
    });
  } catch (error) {
    routed = error;
  } finally {
    if (savedRouting === undefined) delete process.env[TRIPWIRE_ENV];
    else process.env[TRIPWIRE_ENV] = savedRouting;
  }
  assert.ok(routed, "routing control: run mode must reach the launch boundary");
  assert.ok(
    String(routed.message).includes(TRIPWIRE_ENV),
    "routing control: the refusal must name " + TRIPWIRE_ENV,
  );
  return { ran: 3, routing: "verified" };
}

function countAssertionCalls(source) {
  return source.split("\n").filter((line) => ASSERTION_CALL.test(line)).length;
}

function runAssertionIntegrity() {
  return runAssertionIntegrityInner();
}

/**
 * The upstream-modification exception. Permission to change a file is the most
 * dangerous thing this contract hands out, so every way the declaration can be
 * wrong is fed in and observed to be refused.
 */
function runModifiedUpstreamCases() {
  const base = () => ({
    declared: structuredClone(config.derived.modifiedUpstreamFiles),
    baselinePaths: new Set(MODIFIED_UPSTREAM_FILES),
    presentPaths: new Set(MODIFIED_UPSTREAM_FILES),
    changed: () => true,
    isRegularFile: () => true,
  });
  const first = MODIFIED_UPSTREAM_FILES[0];
  let observed = 0;

  // Clean control: the real declaration must pass, or every rejection below
  // would be satisfied by a checker that simply refuses everything.
  assertModifiedUpstreamContract(base());

  const cases = [
    ["modified-upstream-shape", (i) => (i.declared = null)],
    ["modified-upstream-set", (i) => delete i.declared[first]],
    [
      "modified-upstream-set",
      (i) => (i.declared["src/clawsweeper.ts"] = { reason: "sneaking one in" }),
    ],
    ["modified-upstream-reason", (i) => (i.declared[first] = { reason: "  " })],
    ["modified-upstream-unknown", (i) => i.baselinePaths.delete(first)],
    ["modified-upstream-missing", (i) => i.presentPaths.delete(first)],
    ["modified-upstream-symlink", (i) => (i.isRegularFile = () => false)],
    // The one that keeps a stale exception from becoming permanent.
    ["modified-upstream-unchanged", (i) => (i.changed = () => false)],
  ];
  for (const [code, mutate] of cases) {
    const input = base();
    mutate(input);
    assert.throws(() => assertModifiedUpstreamContract(input), { code }, "expected " + code);
    observed += 1;
  }

  // Worker settings. Ordinary repository names are not forbidden literals, so
  // these are the assertions that notice a target list still pointing somewhere.
  const wrangler = readFileSync(join(root, WRANGLER_PATH), "utf8");
  assertWranglerUnconfigured(wrangler);
  const wranglerCases = [
    ["wrangler-nonempty-var", wrangler.replace('TARGET_REPOS = ""', 'TARGET_REPOS = "a/b"')],
    ["wrangler-nonempty-var", wrangler.replace('PUBLIC_BAY_REPOS = ""', 'PUBLIC_BAY_REPOS = "a/b"')],
    ["wrangler-missing-var", wrangler.replace('CLAWSWEEPER_REPO = ""', "")],
    ["wrangler-configured-key", wrangler + "\naccount_id = \"deadbeef\"\n"],
    ["wrangler-configured-key", wrangler + "\ncustom_domain = true\n"],
  ];
  for (const [code, source] of wranglerCases) {
    assert.throws(() => assertWranglerUnconfigured(source), { code }, "expected " + code);
    observed += 1;
  }

  // Fixture tests run against pinned bytes, so the mapping decides what a green
  // result actually means. The contract resolves the .github tree from the pin
  // rather than from a copied list, so the control needs the real listing.
  const listed = spawnSync(
    "git",
    ["-C", root, "ls-tree", "-r", "--name-only", "-z", config.upstream.commit],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  assert.equal(listed.status, 0, "could not list the pinned upstream tree");
  const fixtureBaseline = new Set(listed.stdout.split("\u0000").filter(Boolean));
  const declaredFixtures = config.derived.upstreamFixtureTests;
  const fixtureSummary = assertFixtureTestContract(declaredFixtures, fixtureBaseline);
  assert.equal(fixtureSummary.tests, UPSTREAM_FIXTURE_TEST_NAMES.length);
  const clone = () => structuredClone(declaredFixtures);
  const named = UPSTREAM_FIXTURE_TEST_NAMES[0];
  const walker = UPSTREAM_FIXTURE_TEST_NAMES.find((name) => declaredFixtures[name].githubTree);
  assert.ok(walker, "expected at least one fixture test to declare the pinned .github tree");
  const fixtureCases = [
    ["fixture-test-set", {}, fixtureBaseline],
    [
      "fixture-test-set",
      { ...clone(), "test/stable-json.test.ts": { reason: "x", githubTree: false, files: [] } },
      fixtureBaseline,
    ],
    [
      "fixture-test-files",
      (() => {
        const declared = clone();
        declared[named].files = [...declared[named].files, "package.json"];
        return declared;
      })(),
      fixtureBaseline,
    ],
    // An absent or null list must not read as an empty one. The entries that
    // declare no extra reads are exactly the ones where that coercion would be
    // invisible, so both spellings are fed in against such an entry.
    [
      "fixture-test-files",
      (() => {
        const declared = clone();
        const empty = UPSTREAM_FIXTURE_TEST_NAMES.find((n) => declared[n].files.length === 0);
        assert.ok(empty, "expected a fixture entry declaring no extra reads");
        delete declared[empty].files;
        return declared;
      })(),
      fixtureBaseline,
    ],
    [
      "fixture-test-files",
      (() => {
        const declared = clone();
        const empty = UPSTREAM_FIXTURE_TEST_NAMES.find((n) => declared[n].files.length === 0);
        declared[empty].files = null;
        return declared;
      })(),
      fixtureBaseline,
    ],
    // The flag is what decides whether a traversal sees every pinned workflow, so
    // dropping it must be refused as loudly as dropping a named file.
    [
      "fixture-test-tree-flag",
      (() => {
        const declared = clone();
        declared[walker].githubTree = false;
        return declared;
      })(),
      fixtureBaseline,
    ],
    [
      "fixture-test-reason",
      (() => {
        const declared = clone();
        declared[named].reason = " ";
        return declared;
      })(),
      fixtureBaseline,
    ],
    // A named read that is not in the pin, and a .github tree that lost a file.
    [
      "fixture-test-path",
      clone(),
      new Set([...fixtureBaseline].filter((path) => path !== "config/target-repositories.json")),
    ],
    [
      "fixture-github-tree",
      clone(),
      new Set([...fixtureBaseline].filter((path) => path !== ".github/workflows/sweep.yml")),
    ],
  ];
  for (const [code, declared, baseline] of fixtureCases) {
    assert.throws(
      () => assertFixtureTestContract(declared, baseline),
      { code },
      "expected " + code,
    );
    observed += 1;
  }
  return observed;
}

/**
 * Installation profile. Two different questions are checked here, and they are
 * deliberately not the same check.
 *
 * What ships: the entry point committed to this repository must stay empty, so
 * a populated installation cannot reach main and hand every clone somebody
 * else's targets. That is a static JSON assertion and needs no build.
 *
 * What is accepted: the runtime loader must refuse to grant anything from an
 * unconfigured profile. Upstream admitted an explicitly listed repository
 * before it ever consulted the owner set, so emptying an owner list alone would
 * not have denied an upstream target. Both denials are exercised by name.
 */
async function runInstallationCases() {
  let observed = 0;
  const reject = (mutate, code) => {
    const broken = JSON.parse(readFileSync(join(root, INSTALLATION_CONFIG_PATH), "utf8"));
    mutate(broken);
    assert.throws(() => assertShippedInstallationEmpty(broken), { code }, "expected " + code);
    observed += 1;
  };

  // Clean control. Without it every rejection below could pass against a checker
  // that rejects everything, which would prove nothing.
  const shipped = JSON.parse(readFileSync(join(root, INSTALLATION_CONFIG_PATH), "utf8"));
  assertShippedInstallationEmpty(shipped);

  reject((p) => (p.configured = true), "installation-shipped-configured");
  reject((p) => p.targets.fallback_owners.push("example"), "installation-shipped-nonempty");
  reject((p) => p.targets.repositories.push("example/repo"), "installation-shipped-nonempty");
  reject((p) => (p.targets.registry_url = "https://example.invalid/x.json"), "installation-shipped-nonempty");
  reject((p) => (p.state.state_repo = "example/state"), "installation-shipped-nonempty");
  reject((p) => (p.github_app.client_id = "example"), "installation-shipped-nonempty");
  reject((p) => (p.branding.product_name = "Example"), "installation-shipped-nonempty");
  reject((p) => (p.schema_version = 2), "installation-shipped-shape");
  reject((p) => delete p.targets, "installation-shipped-shape");

  // Forbidden literals. The needles are assembled from fragments in the contract
  // module, so the scan does not match the file that defines it; the clean
  // control below is what shows the scan is not simply inert.
  assertNoForbiddenInstallationLiterals(["src/lina-check-installation-contract.ts"], () => "clean");
  assertNoForbiddenInstallationLiterals(["devlog/_plan/x.md"], () => {
    throw new Error("prose must not be scanned");
  });
  for (const { value } of FORBIDDEN_INSTALLATION_LITERALS) {
    assert.throws(
      () => assertNoForbiddenInstallationLiterals(["src/x.ts"], () => "prefix " + value + " suffix"),
      { code: "installation-forbidden-literal" },
    );
    observed += 1;
  }

  const contract = await import("../dist/lina-check-installation-contract.js").catch((error) => {
    throw new Error(
      "built installation contract is unavailable; run build:all first (" +
        (error instanceof Error ? error.message : String(error)) +
        ")",
    );
  });

  const parsedShipped = contract.parseInstallationProfile(shipped);
  assert.equal(parsedShipped.ok, true, "the shipped profile must parse");
  const empty = parsedShipped.profile;
  assert.equal(contract.installationConfigured(empty), false);

  // The two denials that matter for this change, named so a regression is legible.
  assert.equal(
    contract.installationAdmitsRepository(empty, "openclaw/clawsweeper"),
    false,
    "an unconfigured installation must deny an explicitly listed upstream repository",
  );
  assert.equal(
    contract.installationAdmitsFallbackOwner(empty, "openclaw"),
    false,
    "an unconfigured installation must deny an upstream owner fallback",
  );
  assert.equal(
    contract.installationRegistryUrl(empty),
    null,
    "an unconfigured installation must not name a registry to fetch",
  );
  observed += 3;

  const denials = [
    ["installation-shape", 42],
    ["installation-schema", { ...shipped, schema_version: 99 }],
    ["installation-shape", { ...shipped, configured: "yes" }],
    [
      "installation-empty",
      { ...shipped, configured: true },
    ],
    [
      "installation-owner-shape",
      { ...shipped, targets: { ...shipped.targets, fallback_owners: ["not a login"] } },
    ],
    [
      "installation-owner-duplicate",
      {
        ...shipped,
        targets: {
          ...shipped.targets,
          fallback_owners: ["dup", "dup"],
          registry_url: "https://example.invalid/t.json",
        },
      },
    ],
    [
      "installation-repository-shape",
      { ...shipped, targets: { ...shipped.targets, repositories: ["missing-slash"] } },
    ],
    [
      "installation-repository-duplicate",
      { ...shipped, targets: { ...shipped.targets, repositories: ["a/b", "a/b"] } },
    ],
    // Case is not folded. The schema patterns are lowercase-only, so a parser
    // that lowercased first would accept what the published contract rejects.
    [
      "installation-owner-shape",
      { ...shipped, targets: { ...shipped.targets, fallback_owners: ["MixedCase"] } },
    ],
    [
      "installation-repository-shape",
      { ...shipped, targets: { ...shipped.targets, repositories: ["Acme/Tool"] } },
    ],
    // Whitespace is not normalised either. The schema patterns are anchored, so
    // trimming first would turn a typo the published contract rejects into a
    // stored grant.
    [
      "installation-owner-shape",
      { ...shipped, targets: { ...shipped.targets, fallback_owners: [" acme"] } },
    ],
    [
      "installation-owner-shape",
      { ...shipped, targets: { ...shipped.targets, fallback_owners: ["acme "] } },
    ],
    [
      "installation-repository-shape",
      { ...shipped, targets: { ...shipped.targets, repositories: [" acme/granted "] } },
    ],
    [
      "installation-repository-shape",
      { ...shipped, targets: { ...shipped.targets, repositories: ["acme/granted\t"] } },
    ],
    // A bare $ would accept these: JavaScript lets it match before a final line
    // terminator, and the entry would then be stored with a suffix no normalised
    // admission query can ever match.
    [
      "installation-owner-shape",
      { ...shipped, targets: { ...shipped.targets, fallback_owners: ["acme\n"] } },
    ],
    [
      "installation-repository-shape",
      { ...shipped, targets: { ...shipped.targets, repositories: ["acme/granted\n"] } },
    ],
    [
      "installation-repository-shape",
      { ...shipped, targets: { ...shipped.targets, repositories: ["acme/granted\r\n"] } },
    ],
    // note is optional but typed by the schema.
    ["installation-field-shape", { ...shipped, note: 1 }],
    // additionalProperties:false in every schema object. The dangerous direction
    // is a dropped restriction: a deny list written under a name this build does
    // not know would be ignored while the grant beside it stood.
    ["installation-unknown-field", { ...shipped, surprise: 1 }],
    [
      "installation-unknown-field",
      { ...shipped, targets: { ...shipped.targets, deny_repositories: ["a/b"] } },
    ],
    ["installation-unknown-field", { ...shipped, branding: { ...shipped.branding, theme: "x" } }],
    // Owners are patterns and the patterns live in the registry. Naming owners
    // with nowhere to read their rules parses clean and then refuses everything.
    [
      "installation-inoperable",
      {
        ...shipped,
        configured: true,
        targets: { fallback_owners: ["acme"], repositories: [], registry_url: "" },
      },
    ],
    [
      "installation-registry-shape",
      { ...shipped, targets: { ...shipped.targets, registry_url: "http://example.invalid" } },
    ],
    // A document the published schema rejects must not parse, or an operator
    // gets a profile that looks configured while carrying defaults they never wrote.
    [
      "installation-field-shape",
      { ...shipped, branding: { ...shipped.branding, product_name: 42 } },
    ],
    ["installation-field-shape", { ...shipped, state: { state_ref: "" } }],
    [
      "installation-field-shape",
      { ...shipped, github_app: { ...shipped.github_app, bot_login: null } },
    ],
  ];
  for (const [code, value] of denials) {
    const parsed = contract.parseInstallationProfile(value);
    assert.equal(parsed.ok, false, "expected " + code + " to be refused");
    assert.equal(parsed.code, code);
    observed += 1;
  }

  // A configured profile grants only what it names.
  const configured = contract.parseInstallationProfile({
    ...shipped,
    configured: true,
    targets: {
      fallback_owners: ["example-org"],
      repositories: ["example-org/tool"],
      registry_url: "https://example.invalid/targets.json",
    },
  });
  assert.equal(configured.ok, true);
  assert.equal(contract.installationAdmitsRepository(configured.profile, "Example-Org/Tool"), true);
  assert.equal(contract.installationAdmitsRepository(configured.profile, "other/tool"), false);
  assert.equal(contract.installationAdmitsFallbackOwner(configured.profile, "example-org"), true);
  assert.equal(contract.installationAdmitsFallbackOwner(configured.profile, "openclaw"), false);
  observed += 4;

  return observed;
}

function runAssertionIntegrityInner() {
  const current = countAssertionCalls(readFileSync(join(root, VALIDATOR), "utf8"));
  // The literal floor always applies and needs no Git history.
  assert.ok(
    current >= VALIDATOR_ASSERTION_FLOOR,
    "the validator has " +
      current +
      " assertion calls, below the recorded floor of " +
      VALIDATOR_ASSERTION_FLOOR,
  );
  const shown = spawnSync("git", ["-C", root, "show", BASELINE_COMMIT + ":" + VALIDATOR], {
    encoding: "utf8",
  });
  if (shown.status !== 0) {
    // The baseline object is unreachable. That is expected in a clone made after
    // this branch is squash-merged, where the baseline becomes a sibling rather
    // than an ancestor. Degrade to the literal floor and say so, rather than
    // failing and making the advertised self-test unusable.
    return { baseline: VALIDATOR_ASSERTION_FLOOR, current, mode: "floor" };
  }
  const baseline = countAssertionCalls(shown.stdout);
  assert.equal(
    baseline,
    BASELINE_ASSERTION_CALLS,
    "the recorded baseline assertion count no longer matches the baseline commit",
  );
  const diff = spawnSync("git", ["-C", root, "diff", BASELINE_COMMIT, "--", VALIDATOR], {
    encoding: "utf8",
  });
  assert.equal(diff.status, 0, "could not diff the validator against the baseline");
  const removed = diff.stdout
    .split("\n")
    .filter((line) => line.startsWith("-") && ASSERTION_CALL.test(line.slice(1)));
  assert.deepEqual(removed, [], "an assertion line was removed: " + removed.join(" | "));
  return { baseline, current, mode: "diff" };
}

try {
  const declarations = runDeclarationCases();
  const helpers = runHelperCases();
  const laneShape = runLaneShapeCases();
  const installation = await runInstallationCases();
  const upstream = runModifiedUpstreamCases();
  const controls = runTripwireControls();
  const integrity = runAssertionIntegrity();
  process.stdout.write(
    LABEL +
      " rejected=" +
      declarations +
      " helpers=" +
      helpers +
      " laneShape=" +
      laneShape +
      " installation=" +
      installation +
      " modifiedUpstream=" +
      upstream +
      " tripwireControls=" +
      controls.ran +
      " routing=" +
      controls.routing +
      " assertionCalls=" +
      integrity.baseline +
      "->" +
      integrity.current +
      " (" +
      integrity.mode +
      ")" +
      "\n",
  );
  process.exitCode = 0;
} catch (error) {
  process.stderr.write(
    LABEL + " " + (error instanceof Error ? error.message : String(error)) + "\n",
  );
  process.exitCode = 1;
}
