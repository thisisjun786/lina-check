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
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
 * Identity of one control, so a receipt cannot describe a different mutation
 * than the one the tool now defines. Counting controls is not enough: swapping
 * a mutation while the count and the file set stay the same leaves the old
 * result looking current.
 */
export function controlFingerprint(control) {
  return createHash("sha256")
    .update([control.file, control.what, control.from, control.to].join("\u0000"))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Crash recovery.
 *
 * The mutation is written into the working tree before a blocking call, so a
 * hard kill can leave it there and quietly weaken every later run. The original
 * bytes are parked outside the repository first, and any run starts by putting
 * back what a previous run failed to restore.
 */
/**
 * One lock per checkout and per process.
 *
 * A single fixed path in the system temporary directory is shared by every
 * checkout on the host, so one run could restore another's in-progress mutation
 * or delete its recovery record. The name carries a digest of this repository
 * root and this process id; recovery only reads records belonging to this root.
 *
 * Two concurrent runs in the same checkout are still not supported: they would
 * mutate the same test files. The lock makes that visible rather than safe.
 */
const ROOT_KEY = createHash("sha256").update(root).digest("hex").slice(0, 12);
const LOCK_PREFIX = "lina-check-failure-control." + ROOT_KEY + ".";
const LOCK = join(tmpdir(), LOCK_PREFIX + process.pid + ".lock.json");

export function lockPrefixFor(repositoryRoot) {
  return (
    "lina-check-failure-control." +
    createHash("sha256").update(repositoryRoot).digest("hex").slice(0, 12) +
    "."
  );
}

/**
 * The exclusive record for this checkout, held for the length of a run.
 *
 * The record is refreshed between controls, so the bound measures silence
 * rather than total duration: a long run keeps its lock, while an abandoned one
 * ages out. Without ageing at all, a recycled pid would refuse every later run
 * and leave an interrupted mutation unrepaired.
 */
const RUN_LOCK = join(tmpdir(), LOCK_PREFIX + "run.lock.d");
const RUN_OWNER = join(RUN_LOCK, "owner.json");
const RUN_LOCK_STALE_MS = 10 * 60 * 1000;

/** Whether a process id is still running, treating a permission error as alive. */
export function processAlive(pid, kill = process.kill.bind(process)) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

/**
 * Take the checkout for this run, or refuse.
 *
 * Two runs in the same checkout mutate the same test files, so the second one
 * must not start rather than interleave. A record whose owner is gone is stale
 * and may be taken over; one whose owner is alive is not.
 */
export function lockIsStale(record, now = Date.now(), alive = processAlive) {
  if (!record || !Number.isInteger(record.pid)) return true;
  if (record.pid === process.pid) return true;
  if (!alive(record.pid)) return true;
  // Alive, but the number may have been recycled since it was written.
  return !Number.isInteger(record.at) || now - record.at > RUN_LOCK_STALE_MS;
}

function acquireCheckout() {
  const record = () => JSON.stringify({ pid: process.pid, at: Date.now() });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      // A directory is the mutex: mkdir either creates it or fails, in one step,
      // so two runs starting together cannot both believe they hold the
      // checkout. The owner record lives inside it.
      mkdirSync(RUN_LOCK);
      writeFileSync(RUN_OWNER, record());
      return {
        // Refreshed between controls so the bound measures silence, not length.
        beat: () => {
          if (!existsSync(RUN_OWNER)) return;
          try {
            const held = JSON.parse(readFileSync(RUN_OWNER, "utf8"));
            if (held.pid !== process.pid) return;
          } catch {
            return;
          }
          writeFileSync(RUN_OWNER, record());
        },
        release: () => {
          if (!existsSync(RUN_LOCK)) return;
          try {
            const held = JSON.parse(readFileSync(RUN_OWNER, "utf8"));
            if (held.pid === process.pid) rmSync(RUN_LOCK, { recursive: true, force: true });
          } catch {
            rmSync(RUN_LOCK, { recursive: true, force: true });
          }
        },
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      let held = null;
      try {
        held = JSON.parse(readFileSync(RUN_OWNER, "utf8"));
      } catch {
        held = null;
      }
      if (!lockIsStale(held))
        throw new Error(
          "another failure-control run holds this checkout (pid " +
            String(held?.pid) +
            "); wait for it rather than interleaving mutations",
          { cause: error },
        );
      // Takeover has to be atomic too, or two contenders that both judged the
      // same lock stale can each delete the other's fresh one. Moving the
      // directory aside is a single step: exactly one contender succeeds, and
      // the loser sees ENOENT and re-reads what is there now.
      const aside = RUN_LOCK + "." + process.pid + "." + Date.now() + ".stale";
      try {
        renameSync(RUN_LOCK, aside);
      } catch (moveError) {
        if (moveError?.code !== "ENOENT") throw moveError;
        continue;
      }
      rmSync(aside, { recursive: true, force: true });
    }
  }
  throw new Error("could not take the checkout lock at " + RUN_LOCK);
}
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
  const restored = [];
  for (const name of readdirSync(tmpdir())) {
    if (!name.startsWith(LOCK_PREFIX) || !name.endsWith(".lock.json")) continue;
    // A record whose owner is still running belongs to that run. Restoring from
    // it would undo a mutation mid-flight and drop the only way to repair it.
    const owner = Number(name.slice(LOCK_PREFIX.length).replace(".lock.json", ""));
    if (owner !== process.pid && processAlive(owner)) continue;
    const lock = join(tmpdir(), name);
    try {
      const parked = JSON.parse(readFileSync(lock, "utf8"));
      writeFileSync(parked.path, parked.source);
      restored.push(parked.path);
    } catch {
      // A truncated record cannot be restored from; removing it is still right,
      // because leaving it would make every later run report the same failure.
    }
    rmSync(lock, { force: true });
  }
  return restored.length > 0 ? restored.join(", ") : null;
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
  const checkout = acquireCheckout();
  const recovered = recoverInterrupted();
  if (recovered) process.stderr.write(LABEL + " restored an interrupted mutation in " + recovered + "\n");
  const results = [];
  try {
  for (const control of controls) {
    checkout.beat();
    const path = join(root, control.file);
    const before = digest(path);
    const source = readFileSync(path, "utf8");
    if (!source.includes(control.from))
      throw new Error("anchor not found in " + control.file + ": " + control.what);
    const baseline = runSuite(control.file);
    // Each suite run can take the whole per-run timeout, so the lease is
    // refreshed between them as well as before them.
    checkout.beat();
    let mutated;
    try {
      park(path, source);
      writeFileSync(path, source.replace(control.from, control.to));
      mutated = runSuite(control.file);
    } finally {
      writeFileSync(path, source);
      unpark(path);
    }
    checkout.beat();
    if (digest(path) !== before) throw new Error("restore left " + control.file + " changed");
    const verdict = judge(baseline, mutated);
    results.push({
      file: control.file,
      mutation: control.what,
      fingerprint: controlFingerprint(control),
      // The bytes this result was produced against. A control identity says the
      // mutation is the same one; this says the suite it ran on is too. Without
      // it a suite can change around an intact anchor and the recorded baseline
      // and detection stop describing anything current.
      suite_digest: before,
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
  } finally {
    checkout.release();
  }
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
