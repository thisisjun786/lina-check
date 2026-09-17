#!/usr/bin/env node

/**
 * Definition: failure controls for the recovered coverage.
 *
 * A recovered suite that cannot fail is not carrying coverage. Each control
 * replaces one recovered expectation with a wrong one, runs that suite, and
 * requires the suite to fail; the file is then restored and its digest compared,
 * so a control that dies midway cannot leave a weakened test behind.
 *
 * There is one control per recovered suite, which is the width the PR review
 * asked for. It is still a sample and not a proof: it shows each suite reacts to
 * a wrong result somewhere, not that every assertion inside it still bites.
 *
 * This is an operator-run tool, not a gate. It edits test files while it runs,
 * and a gate that mutates the working tree would be a worse trade than the
 * evidence it produces. lina:contract-selftest stays read-only.
 *
 * Usage: node scripts/lina-check-failure-controls.mjs [--write]
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const LABEL = "[lina-check-failure-controls]";
const RECEIPT = "devlog/_plan/260917_jun223_lost_coverage/evidence/failure_controls.json";

/**
 * One per recovered suite. Each mutation must assert a wrong result: removing an
 * input shrinks what is checked instead, which can never fail, and an earlier
 * draft of this file made exactly that mistake.
 */
export const CONTROLS = Object.freeze([
  {
    file: "test/lina-check-actions-runtime.test.ts",
    what: "expect a cache action generation the tree does not use",
    from: '"actions/cache@v6", "actions/cache/restore@v6", "actions/cache/save@v6"',
    to: '"actions/cache@v7", "actions/cache/restore@v7", "actions/cache/save@v7"',
  },
  {
    file: "test/lina-check-actions-runtime.test.ts",
    what: "drop the parked workflows from the traversal, the way the excluded suite does",
    from: "  /\\.(?:md|ya?ml)$/.test(name) || /\\.ya?ml\\.disabled$/.test(name);",
    to: "  /\\.(?:md|ya?ml)$/.test(name);",
  },
  {
    file: "test/lina-check-github-api.test.ts",
    what: "accept a remote override the validator refuses",
    from: "assert.throws(() => githubApiBaseUrl({ GITHUB_API_URL: value }), /invalid GITHUB_API_URL/);",
    to: "assert.doesNotThrow(() => githubApiBaseUrl({ GITHUB_API_URL: value }));",
  },
  {
    file: "test/lina-check-response-deadlines.test.ts",
    what: "claim the refused path attempted a request",
    from: 'assert.equal(attempts, 0, "no request may be attempted without a permitted transport");',
    to: 'assert.equal(attempts, 1, "no request may be attempted without a permitted transport");',
  },
  {
    file: "test/lina-check-hosted-admission.test.ts",
    what: "claim a registry-denied repository is eligible",
    from: 'assert.equal(isHostedTargetEligible("openclaw/clawsweeper-state", policy), false);',
    to: 'assert.equal(isHostedTargetEligible("openclaw/clawsweeper-state", policy), true);',
  },
  {
    file: "test/lina-check-webhook-admission.test.ts",
    what: "claim an unconfigured installation admits the command",
    from: 'assert.equal(result.accepted, false, "an unconfigured installation admits no repository");',
    to: 'assert.equal(result.accepted, true, "an unconfigured installation admits no repository");',
  },
  {
    file: "test/lina-check-close-policy.test.ts",
    what: "read the unparked workflow spelling again",
    from: ".github/workflows/sweep.yml.disabled",
    to: ".github/workflows/sweep.yml",
  },
  {
    file: "test/lina-check-action-ledger.test.ts",
    what: "read the unparked workflow spelling again",
    from: ".github/workflows/sweep.yml.disabled",
    to: ".github/workflows/sweep.yml",
  },
  {
    file: "test/lina-check-failure-telemetry.test.ts",
    what: "unpin the clock reading again",
    from: "store.listSync({ limit: 1, now: NOW })",
    to: "store.listSync({ limit: 1 })",
  },
  {
    file: "test/lina-check-scheduled-review.test.ts",
    what: "move the settling boundary so an unchanged item reads as changed",
    from: 'assert.equal(classifyScheduledReviewNoop(boundary).noop, true, "30s settling is inside");',
    to: 'assert.equal(classifyScheduledReviewNoop(boundary).noop, false, "30s settling is inside");',
  },
  {
    file: "test/lina-check-node-test-runner.test.ts",
    what: "expect the concurrency cap not to apply",
    from: "assert.equal(calculateTestConcurrency(32), 16);",
    to: "assert.equal(calculateTestConcurrency(32), 32);",
  },
]);

const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

/**
 * Crash recovery.
 *
 * The mutation is written into the working tree before a blocking call, so a
 * hard kill can leave it there and quietly weaken every later run. The original
 * bytes are parked outside the repository first, and any run starts by putting
 * back what a previous run failed to restore.
 */
const LOCK = join(tmpdir(), "lina-check-failure-control.lock.json");
const pending = new Map();

function park(path, source) {
  pending.set(path, source);
  writeFileSync(LOCK, JSON.stringify({ path, source }));
}

function unpark(path) {
  pending.delete(path);
  if (existsSync(LOCK)) rmSync(LOCK, { force: true });
}

export function recoverInterrupted() {
  if (!existsSync(LOCK)) return null;
  const parked = JSON.parse(readFileSync(LOCK, "utf8"));
  writeFileSync(parked.path, parked.source);
  rmSync(LOCK, { force: true });
  return parked.path;
}

function restoreAll() {
  for (const [path, source] of pending) writeFileSync(path, source);
  pending.clear();
  if (existsSync(LOCK)) rmSync(LOCK, { force: true });
}

process.on("exit", restoreAll);
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"])
  process.on(signal, () => {
    restoreAll();
    process.exit(128 + (signal === "SIGINT" ? 2 : signal === "SIGTERM" ? 15 : 1));
  });

/** One suite run, read for what actually happened rather than for a truthy code. */
function runSuite(file) {
  const run = spawnSync(process.execPath, ["--test", file], {
    cwd: root,
    encoding: "utf8",
    timeout: 300_000,
  });
  const failing = /^# fail (\d+)$|fail (\d+)/m.exec(run.stdout ?? "");
  return {
    status: run.status,
    signal: run.signal ?? null,
    error: run.error ? (run.error.code ?? run.error.message) : null,
    failing: failing ? Number(failing[1] ?? failing[2]) : null,
  };
}

/**
 * A control proves sensitivity only when three things hold together: the suite
 * passes before the mutation, fails after it, and fails because a case failed.
 *
 * The first version asked only whether the exit code was non-zero, which counts
 * a timeout, a launch that never started, and a suite that was already failing
 * as evidence. All three produce a green receipt while proving nothing.
 */
export function judge(baseline, mutated) {
  if (baseline.status !== 0)
    return { detected: false, reason: "the suite does not pass before the mutation" };
  if (mutated.error) return { detected: false, reason: "the mutated run errored: " + mutated.error };
  if (mutated.signal)
    return { detected: false, reason: "the mutated run ended on " + mutated.signal };
  if (mutated.status !== 1)
    return { detected: false, reason: "the mutated run exited " + String(mutated.status) };
  if (!(mutated.failing >= 1))
    return { detected: false, reason: "the mutated run reported no failing case" };
  return { detected: true, reason: "" };
}

export function runControls(controls = CONTROLS) {
  const recovered = recoverInterrupted();
  if (recovered) process.stderr.write(LABEL + " restored an interrupted mutation in " + recovered + "\n");
  const results = [];
  for (const control of controls) {
    const path = join(root, control.file);
    const before = digest(path);
    const source = readFileSync(path, "utf8");
    if (!source.includes(control.from))
      throw new Error("anchor not found in " + control.file + ": " + control.what);
    const baseline = runSuite(control.file);
    let mutated;
    try {
      park(path, source);
      writeFileSync(path, source.replace(control.from, control.to));
      mutated = runSuite(control.file);
    } finally {
      writeFileSync(path, source);
      unpark(path);
    }
    if (digest(path) !== before) throw new Error("restore left " + control.file + " changed");
    const verdict = judge(baseline, mutated);
    results.push({
      file: control.file,
      mutation: control.what,
      baseline_exit: baseline.status,
      mutated_exit: mutated.status,
      mutated_signal: mutated.signal,
      mutated_error: mutated.error,
      failing_cases: mutated.failing,
      detected: verdict.detected,
      not_detected_because: verdict.reason,
      restored_identical: true,
    });
  }
  return results;
}

export function main(argv) {
  const results = runControls();
  const undetected = results.filter((entry) => !entry.detected);
  const receipt = {
    purpose:
      "One control per recovered suite. Each replaces a recovered expectation with a wrong one; " +
      "a suite that cannot detect it is not carrying coverage. Sampled evidence, not a proof that " +
      "every assertion inside a recovered case still bites.",
    detection_rule:
      "Detected means the suite exits 0 before the mutation and exits 1 with at least one failing " +
      "case after it. A timeout, a signal, a launch error or an already-failing suite is not detection.",
    suites_covered: new Set(results.map((entry) => entry.file)).size,
    mutations: results.length,
    detected: results.filter((entry) => entry.detected).length,
    undetected: undetected.map((entry) => entry.mutation),
    results,
  };
  if (argv.includes("--write"))
    writeFileSync(join(root, RECEIPT), JSON.stringify(receipt, null, 2) + "\n");
  process.stdout.write(
    LABEL + " suites=" + receipt.suites_covered + " controls=" + receipt.mutations +
      " detected=" + receipt.detected + " undetected=" + undetected.length + "\n",
  );
  return undetected.length === 0 ? 0 : 1;
}

if (process.argv[1] && process.argv[1].endsWith("lina-check-failure-controls.mjs"))
  process.exitCode = main(process.argv.slice(2));
