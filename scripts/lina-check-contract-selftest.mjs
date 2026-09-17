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
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  BUILD_DISPOSITIONS,
  BOUNDARY_PROBE_SCRIPTS,
  DerivedContractError,
  DERIVED_TESTS,
  DERIVED_TEST_EXTERNAL_IMPORTS,
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
  assertDerivedTestContract,
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
  derivedTestClosure,
  derivedTestExternalImports,
  externalImportDigest,
  reapLaunchGroup,
  resolveRelativeImport,
  interruptExitCode,
} from "./lina-check-derived-contract.mjs";
import { childEnv, launchTests, main as runnerMain } from "./lina-check-safe-tests.mjs";
import {
  declarations as coverageDeclarations,
  executedNames as coverageExecutedNames,
  generate as coverageGenerate,
  main as coverageMapMain,
  stripComments as coverageStripComments,
  testNames as coverageTestNames,
} from "./lina-check-coverage-map.mjs";
import {
  CONTROLS as FAILURE_CONTROLS,
  controlFingerprint,
  judge as judgeFailureControl,
  lockIsStale,
  lockPrefixFor,
  processAlive,
} from "./lina-check-failure-controls.mjs";

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
async function runLaneShapeCases() {
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
  const exitCode = await runnerMain(["run"], {
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
  const signalExit = await runnerMain(["run"], {
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
  const quietExit = await runnerMain(["run"], {
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
  const stopExit = await runnerMain(["run"], {
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

  // The injected form above proves the decision, not the delivery. A handler is
  // a libuv callback and cannot run while this module holds the stack, so the
  // claim only means something against a real signal. Send one in a child.
  const runner = join(root, "scripts/lina-check-safe-tests.mjs");
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      [
        "import { mkdtempSync } from 'node:fs';",
        "import { tmpdir } from 'node:os';",
        "import { join } from 'node:path';",
        "import { main } from " + JSON.stringify(runner) + ";",
        "let sent = false;",
        "const code = await main(['run'], {",
        "  distState: () => ({ present: true, disposition: 'fresh', detail: null, pairs: 1 }),",
        "  launchTests: () => {",
        "    if (!sent) { sent = true; process.kill(process.pid, 'SIGINT'); }",
        "    return { pid: 9090, status: 0 };",
        "  },",
        "  makeFixture: () => mkdtempSync(join(tmpdir(), 'lina-check-signal-')),",
        "  reap: () => ({ reaped: true, group: -9090 }),",
        "});",
        "process.stdout.write('LANE_EXIT=' + code + '\\n');",
      ].join("\n"),
    ],
    { cwd: root, encoding: "utf8", timeout: 60000 },
  );
  assert.equal(child.status, 0, "the signal probe must finish: " + String(child.stderr).slice(-400));
  assert.match(
    child.stdout,
    /LANE_EXIT=130/,
    "a real SIGINT during a launch must stop the lane and report 130, saw: " + child.stdout,
  );
  observed += 2;

  // A stop that lands while the fixture is being built must not still start
  // that fixture's test. The gap between the loop's check and the launch is the
  // fixture build, which is where this one arrives.
  const lateLaunched = [];
  let lateStop = null;
  const lateExit = await runnerMain(["run"], {
    distState: () => ({ present: true, disposition: "fresh", detail: null, pairs: 1 }),
    launchTests: () => {
      lateLaunched.push(1);
      return { pid: 8080, status: 0 };
    },
    makeFixture: () => {
      lateStop = "SIGTERM";
      return mkdtempSync(join(tmpdir(), "lina-check-selftest-"));
    },
    reap: () => ({ reaped: true, group: -8080 }),
    interrupted: () => lateStop,
  });
  assert.equal(lateExit, 143, "a stop during the fixture build still reports the interrupt");
  assert.equal(
    lateLaunched.length,
    1,
    "only the root batch may have launched; the fixture's test must not start",
  );
  observed += 2;
  return observed;
}

async function runTripwireControls() {
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
    await runnerMain(["run"], {
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

/**
 * The derived-test contract, which nothing in this self-test used to exercise.
 *
 * That gap mattered more than a missing negative case usually does: the contract
 * is the only thing standing between a derived test and the process-starting
 * surface, and it was never run here, so its rejections were assumptions. The
 * closure control below is the one that would have caught the real hole, where a
 * declared test's own body is clean and a helper it imports starts a process.
 */
const INTAKE_HELPER = "test/helpers/command-intake-fixture.mjs";

function runDerivedTestCases() {
  const readFile = (path) => readFileSync(join(root, path), "utf8");
  const base = () => ({
    declared: structuredClone(config.derived.derivedTests),
    baselinePaths: new Set([...SAFE_TESTS, ...EXCLUDED_TESTS]),
    presentPaths: new Set(DERIVED_TESTS),
    readFile,
  });
  let observed = 0;

  // Clean control against the real declaration and the real files. Without it
  // every rejection below would also pass against a contract that refused
  // everything, which would prove nothing about this repository.
  const summary = assertDerivedTestContract(base());
  assert.equal(summary.tests, DERIVED_TESTS.length);
  assert.ok(
    summary.scanned >= DERIVED_TESTS.length,
    "the closure scan must read at least the declared files",
  );

  const cases = [
    ["derived-test-set", (i) => delete i.declared[DERIVED_TESTS[0]]],
    [
      "derived-test-set",
      (i) => (i.declared["test/lina-check-invented.test.ts"] = { reason: "sneaking one in" }),
    ],
    ["derived-test-reason", (i) => (i.declared[DERIVED_TESTS[0]] = { reason: "  " })],
    ["derived-test-missing", (i) => i.presentPaths.delete(DERIVED_TESTS[0])],
    ["derived-test-upstream-collision", (i) => i.baselinePaths.add(DERIVED_TESTS[0])],
    [
      "derived-test-spawns",
      (i) => {
        const real = i.readFile;
        i.readFile = (path) =>
          path === DERIVED_TESTS[0] ? "import { spawnSync } from 'x';" : real(path);
      },
    ],
  ];
  for (const [code, mutate] of cases) {
    const input = base();
    mutate(input);
    assert.throws(() => assertDerivedTestContract(input), { code }, "expected " + code);
    observed += 1;
  }

  // Positive control for the closure scan, run against the real helper bytes.
  // The fixture body carries no denied token of its own; the only way this can
  // be refused is by following the import into test/helpers and reading what is
  // actually there. A scan that stopped at the declared file would accept it.
  const closureInput = base();
  const realRead = closureInput.readFile;
  closureInput.readFile = (path) =>
    path === DERIVED_TESTS[0]
      ? 'import { startIntakeFixture } from "./helpers/command-intake-fixture.mjs";\n'
      : realRead(path);
  let refused = null;
  try {
    assertDerivedTestContract(closureInput);
  } catch (error) {
    refused = error;
  }
  assert.ok(refused, "positive control: an imported process-starting helper must be refused");
  assert.equal(refused.code, "derived-test-spawns");
  assert.match(
    refused.message,
    new RegExp(INTAKE_HELPER.split(".").join("\\.")),
    "the refusal must name the helper, not just the declared file",
  );
  assert.match(refused.message, /fork\(|child_process/);
  observed += 3;

  // The same control for the two loading forms the keyword scan cannot see on
  // its own. A derived test can reach a helper through CommonJS, directly or
  // through createRequire, and both were invisible to the first version of this
  // closure. Each is fed in separately so a regression in one is not hidden by
  // the other.
  const commonJsForms = [
    ['const helper = require("./helpers/command-intake-fixture.mjs");\n', "require"],
    [
      'const load = createRequire(import.meta.url)("./helpers/command-intake-fixture.mjs");\n',
      "createRequire",
    ],
    [
      'const load = createRequire(import.meta.url);\nconst helper = load("./helpers/command-intake-fixture.mjs");\n',
      "an assigned createRequire loader",
    ],
    [
      'import { createRequire as makeRequire } from "node:module";\n' +
        "const load = makeRequire(import.meta.url);\n" +
        'const helper = load("./helpers/command-intake-fixture.mjs");\n',
      "a createRequire imported under another name",
    ],
    [
      'import { createRequire as makeRequire } from "node:module";\n' +
        'const helper = makeRequire(import.meta.url)("./helpers/command-intake-fixture.mjs");\n',
      "an aliased immediate call",
    ],
    [
      'import { createRequire as makeRequire } from "module";\n' +
        "const load = makeRequire(import.meta.url);\n" +
        'const helper = load("./helpers/command-intake-fixture.mjs");\n',
      "createRequire imported from the bare module specifier",
    ],
    [
      'import { startIntakeFixture } from "./helpers/command-intake-fixture.mjs?cachebust";\n',
      "a specifier carrying a query string",
    ],
    [
      "await import(\u0060./helpers/command-intake-fixture.mjs\u0060);\n",
      "a no-substitution template literal specifier",
    ],
    [
      'import * as nodeModule from "node:module";\n' +
        "const load = nodeModule.createRequire(import.meta.url);\n" +
        'const helper = load("./helpers/command-intake-fixture.mjs");\n',
      "createRequire reached through a namespace import",
    ],
    [
      'import * as nodeModule from "node:module";\n' +
        'const helper = nodeModule.createRequire(import.meta.url)("./helpers/command-intake-fixture.mjs");\n',
      "a namespace immediate call",
    ],
    [
      'import nodeModule from "node:module";\n' +
        "const load = nodeModule.createRequire(import.meta.url);\n" +
        'const helper = load("./helpers/command-intake-fixture.mjs");\n',
      "createRequire reached through a default import",
    ],
    [
      "const load = require;\n" +
        'const helper = load("./helpers/command-intake-fixture.mjs");\n',
      "the ambient require under another name",
    ],
    [
      "const load /* alias */ = require;\n" +
        'const helper = load("./helpers/command-intake-fixture.mjs");\n',
      "an aliased require with a comment in the assignment",
    ],
  ];
  for (const [body, form] of commonJsForms) {
    const input = base();
    const inner = input.readFile;
    input.readFile = (path) => (path === DERIVED_TESTS[0] ? body : inner(path));
    let caught = null;
    try {
      assertDerivedTestContract(input);
    } catch (error) {
      caught = error;
    }
    assert.ok(caught, "positive control: a helper loaded through " + form + " must be refused");
    assert.equal(caught.code, "derived-test-spawns", form);
    assert.match(
      caught.message,
      new RegExp(INTAKE_HELPER.split(".").join("\\.")),
      form + ": the refusal must name the helper it followed",
    );
    observed += 3;
  }

  // A worker thread has its own module state, so nothing it starts is visible
  // to the instrumentation in the observed process. The surface is denied in
  // the declared file itself, so the refusal names the token rather than a
  // helper path.
  const worker = base();
  const restWorker = worker.readFile;
  worker.readFile = (path) =>
    path === DERIVED_TESTS[0]
      ? 'import { Worker } from "node:worker_threads";\nnew Worker(url);\n'
      : restWorker(path);
  let workerRefusal = null;
  try {
    assertDerivedTestContract(worker);
  } catch (error) {
    workerRefusal = error;
  }
  assert.ok(workerRefusal, "a worker thread must be refused");
  assert.equal(workerRefusal.code, "derived-test-spawns");
  assert.match(workerRefusal.message, /worker_threads|new Worker/);
  observed += 2;

  // Runtime module resolution and constructed code. Naming modules is not
  // enough on its own: a computed string reaches the same module, so the
  // mechanisms are denied and the argument stops mattering.
  for (const mechanism of [
    'const threads = process.getBuiltinModule("worker_" + "threads");\n',
    'const binding = process.binding("spawn_sync");\n',
    'const run = new Function("return 1");\n',
  ]) {
    const constructed = base();
    const restConstructed = constructed.readFile;
    constructed.readFile = (path) =>
      path === DERIVED_TESTS[0] ? mechanism : restConstructed(path);
    assert.throws(
      () => assertDerivedTestContract(constructed),
      { code: "derived-test-spawns" },
      "expected a refusal for: " + mechanism.trim(),
    );
    observed += 1;
  }

  // A declared test naming a file that cannot be read must be refused rather
  // than quietly scanned less.
  const unreadable = base();
  const readable = unreadable.readFile;
  unreadable.readFile = (path) =>
    path === DERIVED_TESTS[0] ? 'import x from "./helpers/absent.mjs";\n' : readable(path);
  assert.throws(() => assertDerivedTestContract(unreadable), { code: "derived-test-unreadable" });
  observed += 1;

  // A loader this scan cannot follow must be refused rather than read as clean.
  // Tracking bindings covers the spellings that occur; handing the loader to
  // something else is the case where "found nothing" would be a lie.
  const opaque = base();
  const plain = opaque.readFile;
  opaque.readFile = (path) =>
    path === DERIVED_TESTS[0] ? "handOff(createRequire);\n" : plain(path);
  assert.throws(() => assertDerivedTestContract(opaque), {
    code: "derived-test-unresolvable-require",
  });
  // A loader that is followed as far as its binding and then handed on is the
  // same hole one step later, so it is refused too.
  const passedOn = base();
  const others = passedOn.readFile;
  passedOn.readFile = (path) =>
    path === DERIVED_TESTS[0]
      ? "const load = createRequire(import.meta.url);\nhandOff(load);\n"
      : others(path);
  assert.throws(() => assertDerivedTestContract(passedOn), {
    code: "derived-test-unresolvable-require",
  });
  // A loader called with something this scan cannot read as a specifier.
  const computed = base();
  const remaining = computed.readFile;
  computed.readFile = (path) =>
    path === DERIVED_TESTS[0]
      ? "const load = createRequire(import.meta.url);\nload(chosenHelper);\n"
      : remaining(path);
  assert.throws(() => assertDerivedTestContract(computed), {
    code: "derived-test-unresolvable-require",
  });
  // A member access whose object is not a tracked module binding. Skipping it
  // silently is how the default-import form escaped before: the bare name looked
  // like somebody else's property.
  const untracked = base();
  const others2 = untracked.readFile;
  untracked.readFile = (path) =>
    path === DERIVED_TESTS[0]
      ? 'const helper = something.createRequire(import.meta.url)("./helpers/x.mjs");\n'
      : others2(path);
  assert.throws(() => assertDerivedTestContract(untracked), {
    code: "derived-test-unresolvable-require",
  });
  // The ambient require handed to something else is the same hole as an
  // assigned createRequire loader, one function earlier.
  const handedRequire = base();
  const others3 = handedRequire.readFile;
  handedRequire.readFile = (path) =>
    path === DERIVED_TESTS[0] ? "handOff(require);\n" : others3(path);
  assert.throws(() => assertDerivedTestContract(handedRequire), {
    code: "derived-test-unresolvable-require",
  });
  // ...and the word in prose is not a use of it. Without this the rule would
  // refuse any comment that happens to contain the word.
  const prose = base();
  const others4 = prose.readFile;
  prose.readFile = (path) =>
    path === DERIVED_TESTS[0]
      ? "// these cases require a configured installation\nconst value = 1;\n"
      : others4(path);
  assertDerivedTestContract(prose);
  // A pattern is not a loader either. Without this the rule refuses any test
  // that matches on the word, which several legitimately might.
  const pattern = base();
  const others5 = pattern.readFile;
  pattern.readFile = (path) =>
    path === DERIVED_TESTS[0]
      ? "const spelling = /require/;\nassert.match(source, spelling);\n"
      : others5(path);
  assertDerivedTestContract(pattern);
  // Division is not a regular expression, so the heuristic must not swallow the
  // rest of the line as pattern text.
  const division = base();
  const others6 = division.readFile;
  division.readFile = (path) =>
    path === DERIVED_TESTS[0] ? "const ratio = total / count / 2;\n" : others6(path);
  assertDerivedTestContract(division);
  // A dynamic import whose specifier is computed names a module without naming
  // it, which is the last way to make a load invisible to this scan.
  const computedImport = base();
  const others7 = computedImport.readFile;
  computedImport.readFile = (path) =>
    path === DERIVED_TESTS[0]
      ? 'const target = "./helpers/command-intake-fixture.mjs";\nawait import(target);\n'
      : others7(path);
  assert.throws(() => assertDerivedTestContract(computedImport), {
    code: "derived-test-unresolvable-import",
  });
  // A literal one is followed, so the rule is not a ban on dynamic import.
  const literalImport = base();
  const others8 = literalImport.readFile;
  literalImport.readFile = (path) =>
    path === DERIVED_TESTS[0]
      ? 'await import("./helpers/command-intake-fixture.mjs");\n'
      : others8(path);
  assert.throws(() => assertDerivedTestContract(literalImport), { code: "derived-test-spawns" });
  // import.meta is not a call and must not be refused as one.
  const importMeta = base();
  const others9 = importMeta.readFile;
  importMeta.readFile = (path) =>
    path === DERIVED_TESTS[0] ? "const url = import.meta.url;\nconst x = url;\n" : others9(path);
  assertDerivedTestContract(importMeta);
  // Reading the argument vector is how a test tells the observed run from the
  // lane. Two invocations always differ somewhere, so the settled question is
  // whether a derived test may look, and it may not.
  for (const signal of [
    "if (!process.execArgv.includes('--import')) start();\n",
    "const how = process.argv[1];\n",
    "const options = process.env.NODE_OPTIONS;\n",
    "if (process.env.NO_COLOR) skip();\n",
    "const forced = process.env.FORCE_COLOR;\n",
    // Indirect spellings: an exact substring check on process.argv misses both.
    "const { argv } = process;\nconst how = argv[1];\n",
    'const how = process["argv"][1];\n',
    'if (process.env.NODE_TEST_CONTEXT) skipLaunch();\n',
  ]) {
    const looking = base();
    const rest2 = looking.readFile;
    looking.readFile = (path) => (path === DERIVED_TESTS[0] ? signal : rest2(path));
    assert.throws(() => assertDerivedTestContract(looking), {
      code: "derived-test-observation-signal",
    });
  }
  // The interpreter path is not the invocation, and a restored runner case needs
  // it, so it must stay allowed.
  const execPath = base();
  const rest3 = execPath.readFile;
  execPath.readFile = (path) =>
    path === DERIVED_TESTS[0] ? "const node = process.execPath;\nconst x = node;\n" : rest3(path);
  assertDerivedTestContract(execPath);
  observed += 20;
  // A name the scan can read is one thing, a name computed at run time
  // another. process["arg" + "v"] reaches the argument vector and spells
  // neither half of it, so every form this scan cannot read is refused.
  for (const unreadable of [
    'const how = process["arg" + "v"][1];\n',
    'const p = process;\nconst k = "ar" + "gv";\nconst how = p[k];\n',
    'const env = process.env;\nconst k = "NODE_TEST" + "_CONTEXT";\nif (env[k]) skip();\n',
    'const k = "NODE_TEST" + "_CONTEXT";\nif (process.env[k]) skip();\n',
    'const k = "proc" + "ess";\nconst p = globalThis[k];\nconst x = p;\n',
    'import proc from "node:process";\nconst x = proc;\n',
    "const { env } = process;\nconst x = env;\n",
    // A dotted property can name the invocation without spelling argv, which
    // is why the permitted properties are a list rather than the leftovers.
    "const how = process.report.getReport().header.commandLine;\n",
    'process.stdout.write("ok 1 - forged\\n");\n',
    // Every value reaches the Function constructor through its prototype
    // chain, so an allowlist on the first property is not a bound on what the
    // value can do. The second of these needs no process object at all.
    'const F = process.execPath.constructor.constructor;\nconst p = F("return pro" + "cess")();\n',
    'const F = [].constructor.constructor;\nconst x = F;\n',
    'const C = ({})["constructor"];\nconst x = C;\n',
    "const proto = target.__proto__;\nconst x = proto;\n",
    "const value = Reflect.get(target, key);\nconst x = value;\n",
    // Function is callable without new, whitespace is allowed before the
    // parenthesis, and either global can be held in a binding first. The name
    // is what is refused, so none of the three spellings survives.
    'const p = Function("return globalThis")();\n',
    'const p = eval ("pro" + "cess");\n', // justified: a refusal control, not a call
    'const run = Function;\nconst p = run("return 1")();\n',
    // import.meta.main is true under node --test and false when the
    // observation imports the file, which tells a test which run it is in.
    "if (import.meta.main) startLane();\n",
    "const meta = import.meta;\nconst x = meta;\n",
    // node:vm compiles a string. The names that run one are denied; the two the
    // pinned worker harness re-exports are not, and the controls below show
    // both halves of that split.
    'import { runInThisContext } from "node:vm";\nrunInThisContext("1");\n',
    'import * as vm from "node:vm";\nconst run = vm.runInNewContext;\nconst x = run;\n',
    // JavaScript decodes Unicode escapes inside identifiers, so this reads the
    // argument vector while spelling neither denied word.
    "const how = pro\\u0063ess.arg\\u0076[1];\n",
    // A permitted object turns back into a denied verb when the method name is
    // assembled: new Script(...)["run" + "InThisContext"]() names neither.
    'const S = Script;\nnew S("1")["run" + "InThisContext"]();\n',
    'const method = "runIn" + "NewContext";\nvmApi[method]("1");\n',
    // Pulled out first, called through a plain name afterwards, so the call
    // rule above never sees a parenthesis behind the bracket.
    'const { ["run" + "InThisContext"]: go } = new Script(source);\ngo();\n',
    // The call stack names the file that started the run: the observation's
    // generated runner in one case and the lane's entry frames in the other.
    'if (!new Error().stack.includes(".runner.mjs")) startLane();\n',
   "Error.captureStackTrace(holder);\nconst x = holder;\n",
    // A brace inside a string inside an interpolation used to end the
    // interpolation, and everything after it was blanked as template text.
    // process.report is only visible to the rules that read the blanked copy,
    // so this control fails against the old brace counting and passes now.
    'const label = `${"}" + process.report.getReport()}`;\nconst x = label;\n',
 ]) {
    const computed = base();
    const rest4 = computed.readFile;
    computed.readFile = (path) => (path === DERIVED_TESTS[0] ? unreadable : rest4(path));
    assert.throws(
      () => assertDerivedTestContract(computed),
      { code: "derived-test-computed-observation" },
      unreadable,
    );
  }
  // The rule refuses unreadable forms, it does not ban the process object. A
  // rule that refused these would be unusable, and this repository uses each.
  for (const readable of [
    "function restoreEnv(name, value) {\n" +
      "  if (value === undefined) {\n    delete process.env[name];\n    return;\n  }\n" +
      "  process.env[name] = value;\n}\n",
    'const home = process.env["LINA_CHECK_HOME"];\nconst x = home;\n',
    'mock.method(globalThis, "fetch", () => {});\n',
    "const command = [process.execPath];\nconst x = command;\n",
    // A class body declares a constructor rather than reading one, and the
    // worker harness the closure reaches defines several.
    "class Harness {\n  constructor(rows) {\n    this.rows = rows;\n  }\n}\n",
    // A prototype is inert without the constructor access refused above, and
    // the same harness reads one.
    "const proto = Object.getPrototypeOf(env);\nconst x = proto;\n",
    // The module URL is what createRequire needs, and every file in the closure
    // that reaches import.meta reaches only this property.
    "const here = import.meta.url;\nconst x = here;\n",
    // The harness names both of these and evaluates nothing with them.
    'import { Script, createContext } from "node:vm";\nconst x = [Script, createContext];\n',
    // A literal key is readable, and refusing every computed access would stop
    // ordinary lookups the closure makes.
    'const table = { run: () => 1 };\nconst value = table["run"]();\nconst x = value;\n',
    // An object literal builds a value rather than reading one, and the worker
    // harness in the closure builds exactly this.
    "const merged = { [item.key]: item };\nconst x = merged;\n",
  ]) {
  // An unclassified builtin used to pass as safely as a listed one, which is
  // how node:vm reached the closure without anything deciding about it.
  for (const specifier of ["node:http", "lodash", "/etc/passwd"]) {
    const unlisted = base();
    const rest8 = unlisted.readFile;
    unlisted.readFile = (path) =>
      path === DERIVED_TESTS[0]
        ? 'import thing from "' + specifier + '";\nconst x = thing;\n'
        : rest8(path);
    assert.throws(() => assertDerivedTestContract(unlisted), {
      code: "derived-test-unlisted-module",
    });
  }
  const listed = base();
  const rest9 = listed.readFile;
  listed.readFile = (path) =>
    path === DERIVED_TESTS[0]
      ? 'import assert2 from "node:assert/strict";\nassert2.ok(true);\n'
      : rest9(path);
  assertDerivedTestContract(listed);
  // A namespace import of node:module was tracked only as the spelling
  // binding.createRequire, so any other use of the binding reached the same
  // factory under a name the tracker never saw.
  for (const opaque of [
    'import * as nodeModule from "node:module";\nconst make = nodeModule["create" + "Require"];\nconst x = make;\n',
    'import * as nodeModule from "node:module";\nconst listing = nodeModule.builtinModules;\nconst x = listing;\n',
    'import * as nodeModule from "node:module";\nhandOff(nodeModule);\n',
  ]) {
    const namespaced = base();
    const rest10 = namespaced.readFile;
    namespaced.readFile = (path) => (path === DERIVED_TESTS[0] ? opaque : rest10(path));
    assert.throws(
      () => assertDerivedTestContract(namespaced),
      { code: "derived-test-unresolvable-require" },
      opaque,
    );
  }
  // The listed properties still pass, or the rule would be a ban on namespace
  // imports rather than a rule about what this scan can read.
  const namespaceListed = base();
  const rest11 = namespaceListed.readFile;
  namespaceListed.readFile = (path) =>
    path === DERIVED_TESTS[0]
      ? 'import * as nodeModule from "node:module";\nnodeModule.syncBuiltinESMExports();\n'
      : rest11(path);
  assertDerivedTestContract(namespaceListed);
  // Every export of node:module other than the two listed was implicitly
  // permitted, including register, whose loader hook runs outside this isolate
  // where the observation's instrumentation does not reach.
  for (const named of [
    'import { register } from "node:module";\nregister("./hook.mjs");\n',
    'import { stripTypeScriptTypes } from "node:module";\nconst x = stripTypeScriptTypes;\n',
  ]) {
    const unlistedNamed = base();
    const rest12 = unlistedNamed.readFile;
    unlistedNamed.readFile = (path) => (path === DERIVED_TESTS[0] ? named : rest12(path));
    assert.throws(
      () => assertDerivedTestContract(unlistedNamed),
      { code: "derived-test-unresolvable-require" },
      named,
    );
  }
    const permittedAccess = base();
    const rest5 = permittedAccess.readFile;
    permittedAccess.readFile = (path) => (path === DERIVED_TESTS[0] ? readable : rest5(path));
    assertDerivedTestContract(permittedAccess);
  }
  // Outside the test tree the scan declares instead of following, so the
  // declaration has to be a real ceiling. The dashboard module below is the one
  // external edge this file may spell: the rest are blocked upstream
  // entrypoints, which is why the ceiling holds digests rather than paths.
  const API_TEST = "test/lina-check-github-api.test.ts";
  const API_MODULE = "dashboard/github-api.ts";
  const undeclared = base();
  const rest6 = undeclared.readFile;
  undeclared.readFile = (path) =>
    path === DERIVED_TESTS[0]
      ? 'import { githubApiUrl } from "../' + API_MODULE + '";\nconst x = githubApiUrl;\n'
      : rest6(path);
  assert.throws(() => assertDerivedTestContract(undeclared), {
    code: "derived-test-undeclared-import",
  });
  // The same import from the test whose ceiling carries it is accepted, so the
  // rule is a ceiling and not a ban on reaching product code.
  const declaredImport = base();
  const rest7 = declaredImport.readFile;
  declaredImport.readFile = (path) =>
    path === API_TEST
      ? 'import { githubApiUrl } from "../' + API_MODULE + '";\nconst x = githubApiUrl;\n'
      : rest7(path);
  assertDerivedTestContract(declaredImport);
  // A collector that returned nothing would satisfy every check above, so the
  // real edge is read once from the real files and matched against the ceiling.
  assert.deepEqual(derivedTestExternalImports(API_TEST, readFile), [API_MODULE]);
  assert.ok(
    DERIVED_TEST_EXTERNAL_IMPORTS[API_TEST].includes(externalImportDigest(API_MODULE)),
    "the ceiling must pin the edge the collector reads",
  );
  observed += 52;
  // The spelling this repository actually uses must still be accepted, or the
  // rule above would just be a ban on createRequire.
  const permitted = base();
  const rest = permitted.readFile;
  permitted.readFile = (path) =>
    path === DERIVED_TESTS[0]
      ? 'import { createRequire, syncBuiltinESMExports } from "node:module";\n' +
        'const nodeFs = createRequire(import.meta.url)("node:fs") as { readFileSync: unknown };\n' +
        "nodeFs.readFileSync = () => 1;\nsyncBuiltinESMExports();\n"
      : rest(path);
  assertDerivedTestContract(permitted);
  observed += 2;

  // The helper is real and still carries what the control depends on. If it is
  // ever cleaned up, the control above would silently stop proving anything.
  assert.ok(
    readFile(INTAKE_HELPER).includes("fork("),
    INTAKE_HELPER + " no longer carries the surface this control depends on",
  );
  const closure = derivedTestClosure(DERIVED_TESTS[0], readFile);
  assert.equal(closure[0], DERIVED_TESTS[0], "the entry is part of its own closure");
  assert.equal(
    resolveRelativeImport("test/a.test.ts", "./helpers/command-intake-fixture.mjs"),
    INTAKE_HELPER,
  );
  assert.equal(resolveRelativeImport("test/a.test.ts", "../dist/x.js"), "dist/x.js");
  assert.equal(resolveRelativeImport("test/a.test.ts", "node:fs"), null);
  observed += 5;
  return observed;
}

/**
 * Runtime observation: the declared derived tests, run in one process with the
 * process-starting surface instrumented, must start nothing.
 *
 * A static scan cannot see through a product module, so this is the half that
 * covers everything outside the test tree. The positive control runs first and
 * on the same hook: a zero from an instrument that was never proven to record
 * anything is not evidence.
 */
const LAUNCH_LOG_ENV = "LINA_CHECK_LAUNCH_LOG";
/** Reporter colour must not decide whether an observed case is seen. */
// The escape is built rather than written into the pattern: a literal control
// character in a regular expression is refused by the linter, and escaping it
// by hand is exactly the kind of detail that rots.
const ANSI = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g");
const stripAnsi = (text) => String(text ?? "").replace(ANSI, "");

/**
 * Names the reporter printed as passing.
 *
 * The tick alone is not enough: a runtime t.todo() and a skipped case both keep
 * it and add a directive the summary does not count, so reading the tick would
 * let the coverage map certify a case that never ran.
 */
function passingCaseNames(stdout) {
  return [...stripAnsi(stdout).matchAll(/^\s*✔ (.*?) \(\d+(?:\.\d+)?ms\)(.*)$/gm)]
    .filter((match) => !/#\s*(?:TODO|SKIP)/i.test(match[2]))
    .map((match) => match[1]);
}
const DERIVED_TEST_CASE_FLOOR = 147;
const PRELOAD_SOURCE = [
  'import { appendFileSync } from "node:fs";',
  'import { createRequire, syncBuiltinESMExports } from "node:module";',
  "",
  "const log = process.env." + LAUNCH_LOG_ENV + ";",
  'if (!log) throw new Error("' + LAUNCH_LOG_ENV + ' must name the observation file");',
  "// Taken out of the environment once it is read. Left in place it is a signal",
  "// the tests under observation can branch on, which would let a derived test",
  "// behave one way here and another in the ordinary lane.",
  "delete process.env." + LAUNCH_LOG_ENV + ";",
  'const started = createRequire(import.meta.url)("node:child_process");',
  'for (const name of ["spawn", "spawnSync", "exec", "execFile", "execFileSync", "execSync", "fork"]) {',
  "  const original = started[name];",
  "  started[name] = function observed(...args) {",
  "    // Recorded at the attempt, so a swallowed failure still leaves a mark.",
  '    appendFileSync(log, JSON.stringify({ name, command: String(args[0]) }) + "\\n");',
  "    return original.apply(this, args);",
  "  };",
  "}",
  "syncBuiltinESMExports();",
  "",
].join("\n");
const SENTINEL_SOURCE = [
  'import test from "node:test";',
  'import { spawnSync } from "node:child_process";',
  "",
  'test("sentinel starts one harmless process", () => {',
  '  spawnSync(process.execPath, ["-e", ""], { encoding: "utf8" });',
  "});",
  "",
].join("\n");

function runDerivedTestObservation() {
  const directory = mkdtempSync(join(tmpdir(), "lina-check-launch-"));
  try {
    return observeDerivedTests(directory);
  } finally {
    // Two generated modules and two logs per run, otherwise left behind on every
    // success and on every assertion failure alike.
    rmSync(directory, { recursive: true, force: true });
  }
}

/** The lane's filtered environment, with a credential-shaped name planted first. */
function plantedCredential() {
  const saved = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = "ghp_probe";
  try {
    return childEnv().env;
  } finally {
    if (saved === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = saved;
  }
}

function observeDerivedTests(directory) {
  const preload = join(directory, "preload.mjs");
  const sentinel = join(directory, "sentinel.test.mjs");
  writeFileSync(preload, PRELOAD_SOURCE);
  writeFileSync(sentinel, SENTINEL_SOURCE);
  const observe = (name, imports) => {
    const log = join(directory, name + ".jsonl");
    writeFileSync(log, "");
    // A real module rather than --import plus -e: both are visible to the code
    // under observation. The preload is imported statically, so it installs
    // before any test module loads.
    const runner = join(directory, name + ".runner.mjs");
    writeFileSync(
      runner,
      "import " +
        JSON.stringify(pathToFileURL(preload).href) +
        ";\n" +
        imports.map((path) => "await import(" + JSON.stringify(pathToFileURL(path).href) + ");").join("\n") +
        "\n",
    );
    // The lane strips credential-shaped names before launching tests, so the
    // observation uses the lane's own filter rather than a copy of the idea.
    const { env: filtered } = childEnv();
    const result = spawnSync(process.execPath, [runner], {
      cwd: root,
      encoding: "utf8",
      timeout: 600_000,
      env: { ...filtered, [LAUNCH_LOG_ENV]: log },
    });
    const launches = readFileSync(log, "utf8").split("\n").filter(Boolean).map(JSON.parse);
    return { result: { ...result, stdout: stripAnsi(result.stdout) }, launches };
  };

  const control = observe("control", [sentinel]);
  // Nothing in the observed process may advertise the observation.
  const tell = join(directory, "tell.jsonl");
  const probe = join(directory, "tell.runner.mjs");
  writeFileSync(
    probe,
    "import " +
      JSON.stringify(pathToFileURL(preload).href) +
      ";\n" +
      "process.stdout.write(JSON.stringify({ execArgv: process.execArgv, argv: process.argv.slice(1), log: process.env." +
      LAUNCH_LOG_ENV +
      " ?? null, token: process.env.GITHUB_TOKEN ?? null }));\n",
  );
  writeFileSync(tell, "");
  const told = spawnSync(process.execPath, [probe], {
    cwd: root,
    encoding: "utf8",
    // The credential is planted in this process's environment, because that is
    // what the filter reads. Adding it after filtering would prove nothing.
    env: { ...plantedCredential(), [LAUNCH_LOG_ENV]: tell },
  });
  assert.equal(told.status, 0, "the observation probe must run: " + String(told.stderr).slice(-300));
  const seen = JSON.parse(told.stdout);
  assert.deepEqual(seen.execArgv, [], "the observed process must carry no preload flag");
  assert.equal(seen.log, null, "the log variable must be gone before any test loads");
  assert.equal(
    seen.argv.some((entry) => entry.includes("--import") || entry === "-e"),
    false,
    "the observed process must not advertise how it was started",
  );
  assert.equal(
    seen.token,
    null,
    "a credential-shaped variable must be filtered the way the lane filters it",
  );

  assert.equal(
    control.result.status,
    0,
    "positive control: the sentinel must run: " + String(control.result.stderr).slice(-400),
  );
  assert.ok(
    control.launches.length >= 1,
    "positive control: the hook recorded nothing, so a zero elsewhere means nothing",
  );
  assert.ok(
    control.launches.some((entry) => entry.name === "spawnSync"),
    "positive control: the sentinel\u0027s launch must be recorded by name",
  );
  assert.equal(
    stripAnsi(
      String.fromCharCode(27) +
        "[32m\u2714 a coloured case (1.2ms)" +
        String.fromCharCode(27) +
        "[39m",
    ),
    "\u2714 a coloured case (1.2ms)",
  );

  // One process per declared file, the way the lane runs them, so a fixture or
  // a band left behind by one derived test cannot change another's result here
  // while leaving the lane unaffected.
  const launches = [];
  const passing = new Set();
  let cases = 0;
  DERIVED_TESTS.forEach((path, index) => {
    const observed = observe("derived-" + index, [join(root, path)]);
    assert.equal(
      observed.result.status,
      0,
      path + " must pass under observation: " + String(observed.result.stderr).slice(-600),
    );
    const passed = /pass (\d+)/.exec(observed.result.stdout);
    assert.ok(passed, "could not read a pass count for " + path);
    cases += Number(passed[1]);
    assert.match(observed.result.stdout, /fail 0/, path + " reported failures");
    for (const name of passingCaseNames(observed.result.stdout)) passing.add(name);
    launches.push(...observed.launches);
  });
  assert.ok(
    cases >= DERIVED_TEST_CASE_FLOOR,
    "observed " + cases + " derived cases, below the floor of " + DERIVED_TEST_CASE_FLOOR,
  );
  assert.deepEqual(
    launches,
    [],
    "a derived test started a process: " + JSON.stringify(launches),
  );

  const recovered = coverageGenerate().receipt.records.filter(
    (record) => record.disposition === "recovered",
  );
  const missing = recovered.filter((record) => !passing.has(record.case)).map((record) => record.case);
  assert.deepEqual(
    missing,
    [],
    "the map calls these records recovered but they did not pass in the observed run: " +
      missing.join(" | "),
  );
  assert.ok(recovered.length > 0, "the map recovered nothing, so this control proves nothing");

  return {
    cases,
    launches: launches.length,
    control: control.launches.length,
    boundRecords: recovered.length,
  };
}

function runAssertionIntegrity() {
  return runAssertionIntegrityInner();
}

/**
 * The coverage map is a claim about two sets of test files, and a committed
 * table that nothing regenerates goes stale invisibly: the prose still reads
 * correctly while the counts describe a tree that no longer exists. Regenerate
 * it here and refuse any drift from the committed files.
 */
function runCoverageMapCase() {
  assert.equal(
    coverageMapMain(["check"]),
    0,
    "the committed coverage map no longer matches the suites it describes",
  );
  // Control: the same generator must refuse a tree where a restored record has
  // lost its derived counterpart, or "current" would mean nothing.
  const stripped = (path) =>
    path === "test/lina-check-actions-runtime.test.ts"
      ? ""
      : readFileSync(join(root, path), "utf8");
  assert.throws(
    () => coverageMapMain(["check"], stripped),
    /no disposition recorded for/,
    "a record with no derived counterpart and no written reason must fail generation",
  );

  // How records are read out of a file, which is where a line-by-line scan was
  // wrong in both directions at once.
  const multiline = [
    "test(",
    '  "a name on the next line",',
    "  () => {},",
    ");",
  ].join("\n");
  assert.deepEqual(
    coverageTestNames(multiline),
    ["a name on the next line"],
    "a declaration split across lines is still a record",
  );
  assert.deepEqual(
    coverageTestNames('/*\ntest("commented out", () => {});\n*/\n'),
    [],
    "a declaration inside a block comment is not a record",
  );
  assert.deepEqual(
    coverageTestNames('// test("commented out", () => {});\n'),
    [],
    "a declaration inside a line comment is not a record",
  );
  assert.match(
    coverageStripComments('const url = "https://example.invalid/x"; // trailing\n'),
    /https:\/\/example\.invalid\/x/,
    "a comment marker inside a string is not a comment",
  );
  const skipped = 'test("runs", () => {});\ntest("does not run", { skip: true }, () => {});\n';
  assert.deepEqual(coverageTestNames(skipped), ["runs", "does not run"]);
  assert.deepEqual(
    coverageExecutedNames(skipped),
    ["runs"],
    "a skipped case is declared but does not execute, so it cannot count as restored",
  );
  assert.deepEqual(
    coverageDeclarations(skipped).map((entry) => entry.skipped),
    [false, true],
  );

  // The other two ways a case can be declared without running, and the one that
  // looks like it but runs.
  const memberSkip = 'test.skip("member skip", () => {});\ntest.todo("member todo");\n';
  assert.deepEqual(coverageExecutedNames(memberSkip), [], "test.skip and test.todo do not run");
  assert.deepEqual(coverageTestNames(memberSkip), ["member skip", "member todo"]);
  assert.deepEqual(
    coverageExecutedNames('test("runs anyway", { skip: false }, () => {});\n'),
    ["runs anyway"],
    "{ skip: false } is a case that runs",
  );
  assert.deepEqual(coverageExecutedNames('test.only("only runs", () => {});\n'), ["only runs"]);
  return "verified";
}

/**
 * The failure controls are an operator tool, so nothing here runs them: they
 * edit test files. What is checked is the part that can go wrong silently — the
 * rule that decides what counts as detection, and whether the committed receipt
 * still describes this tree.
 */
function runFailureControlCases() {
  let observed = 0;
  // The reporter prints a runtime t.todo() with the same tick as a pass, so the
  // name parse is checked on synthetic output before it is trusted on real
  // output. A directive line must not enter the passing set.
  const sample = [
    "✔ a real case (1.2ms)",
    "✔ a deferred case (0.1ms) # TODO not written yet",
    "✔ a skipped case (0.1ms) # SKIP",
    "✖ a failing case (2ms)",
  ].join("\n");
  assert.deepEqual(passingCaseNames(sample), ["a real case"]);
  observed += 1;
  // The control identity must move when the mutation moves, or the receipt
  // comparison below would accept a swapped control.
  const sampleControl = FAILURE_CONTROLS[0];
  assert.notEqual(
    controlFingerprint(sampleControl),
    controlFingerprint({ ...sampleControl, to: sampleControl.to + " " }),
    "the control identity must depend on the mutation text",
  );
  assert.notEqual(
    controlFingerprint(sampleControl),
    controlFingerprint({ ...sampleControl, file: "test/other.test.ts" }),
  );
  observed += 2;
  // The recovery record is scoped to a checkout. A single shared name would let
  // one checkout restore or delete another's in-progress mutation.
  assert.notEqual(
    lockPrefixFor("/home/example/checkout-a"),
    lockPrefixFor("/home/example/checkout-b"),
  );
  assert.equal(lockPrefixFor(root), lockPrefixFor(root), "the same root must map to one prefix");
  observed += 2;
  // Liveness decides whether a recovery record is stale. Treating a live run's
  // record as stale is how two runs would interleave and lose the repair path.
  assert.equal(processAlive(process.pid), true, "this process must read as alive");
  assert.equal(processAlive(0), false);
  assert.equal(processAlive(-1), false);
  assert.equal(
    processAlive(4242, () => {
      throw Object.assign(new Error("no such process"), { code: "ESRCH" });
    }),
    false,
  );
  assert.equal(
    processAlive(4242, () => {
      throw Object.assign(new Error("not permitted"), { code: "EPERM" });
    }),
    true,
    "a process owned by somebody else is still running",
  );
  observed += 5;
  // Staleness of the checkout lock. A live owner holds it; a dead one does not;
  // and a recorded pid that is alive but old is treated as recycled, or a reused
  // number would refuse every later run and leave a mutation unrepaired.
  const now = 1_000_000_000;
  assert.equal(lockIsStale({ pid: 4242, at: now }, now, () => true), false);
  assert.equal(lockIsStale({ pid: 4242, at: now }, now, () => false), true);
  assert.equal(lockIsStale({ pid: 4242, at: now - 60 * 60 * 1000 }, now, () => true), true);
  // The record is refreshed between controls, so a run longer than the bound
  // keeps its lock as long as it is still making progress.
  assert.equal(lockIsStale({ pid: 4242, at: now - 60_000 }, now, () => true), false);
  assert.equal(lockIsStale({ pid: 4242 }, now, () => true), true, "no timestamp reads as stale");
  assert.equal(lockIsStale(null, now, () => true), true);
  observed += 6;
  // The observation must not leave its own signal in the environment, or a test
  // could behave one way under observation and another in the lane.
  assert.match(
    PRELOAD_SOURCE,
    new RegExp("delete process\\.env\\." + LAUNCH_LOG_ENV),
    "the preload must remove its log variable before the tests load",
  );
  observed += 1;
  const pass = { status: 0, signal: null, error: null, failing: 0 };
  assert.equal(judgeFailureControl(pass, { status: 1, signal: null, error: null, failing: 1 }).detected, true);
  const rejected = [
    ["a suite that already fails", { status: 1 }, { status: 1, failing: 1 }],
    ["a timeout", pass, { status: null, signal: "SIGTERM", error: "ETIMEDOUT", failing: null }],
    ["a signal", pass, { status: null, signal: "SIGKILL", error: null, failing: null }],
    ["a launch that never started", pass, { status: null, signal: null, error: "ENOENT", failing: null }],
    ["an exit code that is not a test failure", pass, { status: 7, signal: null, error: null, failing: 1 }],
    ["a failure with no failing case", pass, { status: 1, signal: null, error: null, failing: 0 }],
  ];
  for (const [name, baseline, mutated] of rejected) {
    const verdict = judgeFailureControl(baseline, mutated);
    assert.equal(verdict.detected, false, name + " must not count as detection");
    assert.ok(verdict.reason.length > 0, name + " must say why");
    observed += 1;
  }

  // Receipt freshness, checked without mutating anything: every control still
  // has its anchor in the file it targets, the receipt covers exactly the
  // recovered suites, and nothing in it is undetected.
  const receipt = JSON.parse(
    readFileSync(join(root, "devlog/_plan/260917_jun223_lost_coverage/evidence/failure_controls.json"), "utf8"),
  );
  assert.equal(receipt.undetected.length, 0, "the committed receipt records an undetected control");
  assert.equal(receipt.mutations, FAILURE_CONTROLS.length, "the receipt describes a different control set");
  // Identity, not just arity: a swapped mutation keeps the count and the file
  // set intact while the recorded result belongs to a run that never happened.
  assert.deepEqual(
    receipt.results.map((entry) => entry.fingerprint).sort(),
    FAILURE_CONTROLS.map((control) => controlFingerprint(control)).sort(),
    "the committed receipt does not describe the current controls",
  );
  for (const entry of receipt.results)
    assert.ok(
      typeof entry.fingerprint === "string" && entry.fingerprint.length === 16,
      "a receipt entry carries no control identity",
    );
  for (const control of FAILURE_CONTROLS) {
    const source = readFileSync(join(root, control.file), "utf8");
    // Exactly one occurrence, because the mutation replaces the first match.
    // A repeated anchor moves the mutation to a place the control never named,
    // and a failure from there still reads as detection.
    assert.equal(
      source.split(control.from).length - 1,
      1,
      "control anchor must match exactly once: " + control.file + " :: " + control.what,
    );
    observed += 1;
  }
  // The suite bytes each result was produced against. An intact anchor does not
  // mean an unchanged suite: a recovered case can gain an unrelated failure or
  // lose the path the mutation sits on, and the recorded baseline would still
  // read as current.
  for (const entry of receipt.results) {
    const current = createHash("sha256")
      .update(readFileSync(join(root, entry.file)))
      .digest("hex");
    assert.equal(
      entry.suite_digest,
      current,
      entry.file + " changed since its control ran; rerun: node scripts/lina-check-failure-controls.mjs --write",
    );
    observed += 1;
  }
  const recoveredSuites = new Set(
    coverageGenerate()
      .receipt.records.filter((record) => record.disposition === "recovered")
      .map((record) => record.covered_by),
  );
  const covered = new Set(FAILURE_CONTROLS.map((control) => control.file));
  for (const suite of recoveredSuites)
    assert.ok(covered.has(suite), "no failure control for recovered suite " + suite);
  observed += 1;
  return observed;
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
  const laneShape = await runLaneShapeCases();
  const installation = await runInstallationCases();
  const upstream = runModifiedUpstreamCases();
  const controls = await runTripwireControls();
  const derivedTests = runDerivedTestCases();
  const observation = runDerivedTestObservation();
  const coverageMap = runCoverageMapCase();
  const failureControls = runFailureControlCases();
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
      " derivedTestContract=" +
      derivedTests +
      " derivedCases=" +
      observation.cases +
      " derivedLaunches=" +
      observation.launches +
      " launchControl=" +
      observation.control +
      " coverageMap=" +
      coverageMap +
      " failureControls=" +
      failureControls +
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
