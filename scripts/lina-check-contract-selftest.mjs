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
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  DerivedContractError,
  EXCLUDED_TESTS,
  GUARD_SHA256,
  SAFE_TESTS,
  TRIPWIRE_ENV,
  assertDerivedContract,
  assertGuardIntact,
  assertNoLifecycleHooks,
  assertPinnedPnpm,
  assertProbeTargetGuarded,
  assertWorkflowsParked,
  assertWorktreeUnchanged,
  blockedNodeTargets,
  classifyBuildPair,
} from "./lina-check-derived-contract.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const LABEL = "[lina-check-contract-selftest]";
const BASELINE_COMMIT = "1f36c10eeea8d3c36c477e7f91e0d405781556b3";
const BASELINE_ASSERTION_CALLS = 23;
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

function runTripwireControls() {
  const env = { ...process.env, [TRIPWIRE_ENV]: "1" };
  const script = "scripts/lina-check-safe-tests.mjs";
  const preview = spawnSync(process.execPath, [script, "preview", "--json"], {
    cwd: root,
    encoding: "utf8",
    env,
  });
  assert.equal(preview.status, 0, "negative control: preview must not reach the launch boundary");
  assert.equal(JSON.parse(preview.stdout).executed, false);
  const run = spawnSync(process.execPath, [script, "run"], { cwd: root, encoding: "utf8", env });
  assert.notEqual(run.status, 0, "positive control: a run must reach the launch boundary");
  assert.ok(
    (run.stderr === null ? "" : run.stderr).includes(TRIPWIRE_ENV),
    "positive control: the failure must name " + TRIPWIRE_ENV,
  );
  return 2;
}

function countAssertionCalls(source) {
  return source.split("\n").filter((line) => ASSERTION_CALL.test(line)).length;
}

function runAssertionIntegrity() {
  const shown = spawnSync("git", ["-C", root, "show", BASELINE_COMMIT + ":" + VALIDATOR], {
    encoding: "utf8",
  });
  assert.equal(shown.status, 0, "could not read the baseline validator from git");
  const baseline = countAssertionCalls(shown.stdout);
  assert.equal(
    baseline,
    BASELINE_ASSERTION_CALLS,
    "the recorded baseline assertion count no longer matches the baseline commit",
  );
  const current = countAssertionCalls(readFileSync(join(root, VALIDATOR), "utf8"));
  assert.ok(current >= baseline, "the validator now has fewer assertions than the baseline");
  const diff = spawnSync("git", ["-C", root, "diff", BASELINE_COMMIT, "--", VALIDATOR], {
    encoding: "utf8",
  });
  assert.equal(diff.status, 0, "could not diff the validator against the baseline");
  const removed = diff.stdout
    .split("\n")
    .filter((line) => line.startsWith("-") && ASSERTION_CALL.test(line.slice(1)));
  assert.deepEqual(removed, [], "an assertion line was removed: " + removed.join(" | "));
  return { baseline, current };
}

try {
  const declarations = runDeclarationCases();
  const helpers = runHelperCases();
  const controls = runTripwireControls();
  const integrity = runAssertionIntegrity();
  process.stdout.write(
    LABEL +
      " rejected=" +
      declarations +
      " helpers=" +
      helpers +
      " tripwireControls=" +
      controls +
      " assertionCalls=" +
      integrity.baseline +
      "->" +
      integrity.current +
      "\n",
  );
  process.exitCode = 0;
} catch (error) {
  process.stderr.write(
    LABEL + " " + (error instanceof Error ? error.message : String(error)) + "\n",
  );
  process.exitCode = 1;
}
