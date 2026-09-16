#!/usr/bin/env node

/**
 * Definition: prove by actual execution that automatic code fix, automatic
 * close, automatic merge and automatic label mutation cannot be started through
 * the declared package-script entrances in this initial profile. The point is
 * not that the upstream code is gone - it is preserved - but that the entrances
 * this probe declares are closed. It does not enumerate every possible entrance:
 * direct node execution of built or source entrypoints bypasses these guards.
 *
 * Safety, in order, all before the first invocation:
 *   1. the scaffold guard's bytes are verified against a pinned digest, because
 *      a guard edited to act first and print the familiar diagnostic afterwards
 *      would otherwise be invoked and reported as closed;
 *   2. no pre/post lifecycle script exists for any target;
 *   3. each target's package script is still exactly the guard command.
 * Any of these failing stops the probe instead of invoking anything.
 *
 * The probe writes nothing into the repository and compares the git porcelain
 * status before and after. That comparison is not a byte-identical claim: it
 * cannot see ignored-file writes or effects outside the repository.
 *
 * Exit codes: 0 every declared entrance closed, 1 an entrance was open, a
 * workflow was active, the guard was altered, or the tree moved.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  BOUNDARY_PROBES,
  BOUNDARY_WORKFLOWS,
  WORKFLOW_EXTENSIONS,
  assertGuardIntact,
  assertNoLifecycleHooks,
  assertProbeTargetGuarded,
  assertWorkflowsParked,
  assertWorktreeUnchanged,
} from "./lina-check-derived-contract.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const LABEL = "[lina-check-boundary-probe]";
const WORKFLOW_DIR = join(root, ".github", "workflows");

function gitStatus() {
  const result = spawnSync("git", ["-C", root, "status", "--porcelain=v1"], { encoding: "utf8" });
  if (result.status !== 0) throw new Error("git status did not succeed");
  return result.stdout;
}

function invoke(script) {
  const result = spawnSync("corepack", ["pnpm", "run", script], { cwd: root, encoding: "utf8" });
  const stderr = result.stderr === null ? "" : result.stderr;
  const diagnostic = stderr.split("\n").find((line) => line.includes("is disabled"));
  return {
    exitCode: result.status,
    closed: result.status === 1 && diagnostic !== undefined,
    diagnostic: diagnostic === undefined ? null : diagnostic.trim(),
  };
}

function workflowState(workflow) {
  const active = WORKFLOW_EXTENSIONS.filter((extension) =>
    existsSync(join(WORKFLOW_DIR, workflow + extension)),
  );
  return {
    workflow,
    active: active.length > 0,
    activeNames: active.map((extension) => workflow + extension),
    parked: existsSync(join(WORKFLOW_DIR, workflow + ".yml.disabled")),
  };
}

function main() {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const scripts = BOUNDARY_PROBES.map(({ script }) => script);
  assertGuardIntact(
    (path) => readFileSync(join(root, path)),
    (bytes) => createHash("sha256").update(bytes).digest("hex"),
  );
  assertNoLifecycleHooks(pkg.scripts, scripts);
  for (const script of scripts) assertProbeTargetGuarded(pkg.scripts, script);

  const before = gitStatus();
  const probes = [];
  for (const { action, script } of BOUNDARY_PROBES) probes.push({ action, script, ...invoke(script) });
  const workflows = BOUNDARY_WORKFLOWS.map(workflowState);
  // Directory-wide sweep: a declared workflow list cannot see a file nobody declared.
  const strayActive = readdirSync(WORKFLOW_DIR).filter((name) => /\.ya?ml$/i.test(name));
  assertWorkflowsParked(workflows);
  assertWorktreeUnchanged(before, gitStatus());

  const entrancesClosed = probes.every(({ closed }) => closed);
  const workflowsParked = workflows.every(({ active, parked }) => !active && parked);
  const report = {
    probes,
    workflows,
    strayActiveWorkflowFiles: strayActive,
    entrancesClosed,
    workflowsParked,
    guardVerified: true,
    worktreeUnchanged: true,
    notProven: [
      "direct node execution of built or source entrypoints bypasses these package guards",
      "the remote Actions setting, App installation state and rulesets are not observed here",
      "this says nothing about whether the upstream capability exists; it does, and it builds",
      "the porcelain comparison cannot see ignored-file writes or effects outside the repository",
      "only the declared entrances were probed; this is not an exhaustive list of entrances",
    ],
  };
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  return entrancesClosed && workflowsParked && strayActive.length === 0 ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(
    LABEL + " " + (error instanceof Error ? error.message : String(error)) + "\n",
  );
  process.exitCode = 1;
}

