#!/usr/bin/env node

/**
 * Definition: prove by actual execution that automatic code fix, automatic
 * close, automatic merge and automatic label mutation cannot run in this
 * initial profile. The point is not that the upstream code is gone - it is
 * preserved - but that every entrance to it is closed.
 *
 * Safety: each target is checked against the scaffold guard mapping BEFORE it is
 * invoked, so this probe can never become live fire in a checkout whose guards
 * were removed. The probe writes nothing into the repository and verifies that
 * the working tree is byte-identical before and after.
 *
 * Exit codes: 0 every entrance closed, 1 an entrance was open or the tree moved.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  BOUNDARY_PROBES,
  BOUNDARY_WORKFLOWS,
  assertProbeTargetGuarded,
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

function main() {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const before = gitStatus();
  const probes = [];
  for (const { action, script } of BOUNDARY_PROBES) {
    assertProbeTargetGuarded(pkg.scripts, script);
    const outcome = invoke(script);
    probes.push({ action, script, ...outcome });
  }
  const workflows = BOUNDARY_WORKFLOWS.map((workflow) => ({
    workflow,
    activeYaml: existsSync(join(WORKFLOW_DIR, workflow + ".yml")),
    parked: existsSync(join(WORKFLOW_DIR, workflow + ".yml.disabled")),
  }));
  assertWorktreeUnchanged(before, gitStatus());
  const entrancesClosed = probes.every(({ closed }) => closed);
  const workflowsParked = workflows.every(({ activeYaml, parked }) => !activeYaml && parked);
  const report = {
    probes,
    workflows,
    entrancesClosed,
    workflowsParked,
    worktreeUnchanged: true,
    notProven: [
      "direct node execution of built or source entrypoints bypasses these package guards",
      "the remote Actions setting, App installation state and rulesets are not observed here",
      "this says nothing about whether the upstream capability exists; it does, and it builds",
    ],
  };
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  return entrancesClosed && workflowsParked ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(
    LABEL + " " + (error instanceof Error ? error.message : String(error)) + "\n",
  );
  process.exitCode = 1;
}

