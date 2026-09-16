#!/usr/bin/env node

/**
 * Definition: run or preview exactly the upstream tests declared in
 * config/lina-check-scaffold.json, checked against the SAFE_TESTS literal in
 * lina-check-derived-contract.mjs. The declaration is the only source of
 * targets; there is no glob and no environment override, so the restored set
 * cannot widen silently.
 *
 * Modes: run, preview. Preview never reaches the test-launch boundary. Setting
 * LINA_CHECK_SPAWN_TRIPWIRE makes that boundary fail loudly, so non-execution
 * can be observed rather than trusted.
 *
 * Exit codes: 0 ok, 1 test failure, 2 usage or declaration violation,
 * 3 built output unusable for a run, meaning dist/ is absent, empty, or older
 *   than the newest src/ change. Existence alone is not freshness: a stale dist/
 *   would let the restored tests validate superseded code and still pass.
 *
 * A broken declaration is a configuration fault, not a test failure, so it exits
 * 2 even when the failure surfaces as a thrown read or parse error.
 *
 * The child environment drops credential-shaped variables. That filter is
 * deliberately broad in the safety direction, so it can also drop non-credential
 * configuration and make a restored test behave differently from direct
 * execution. The removed names are printed before the run, so any such
 * divergence is visible rather than silent.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { SAFE_TESTS, TRIPWIRE_ENV, distDisposition } from "./lina-check-derived-contract.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const LABEL = "[lina-check-safe-tests]";
const USAGE = "usage: node scripts/lina-check-safe-tests.mjs <run|preview> [--json]";
const SECRETISH = /TOKEN|SECRET|_KEY$|^GH_|^GITHUB_/;
const MAX_CONCURRENCY = 8;

function declaredTests() {
  const path = join(root, "config", "lina-check-scaffold.json");
  let config;
  try {
    config = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    // A declaration that cannot be read or parsed is a configuration fault.
    // Letting it reach the outer handler would report it as a test failure.
    const detail = error instanceof Error ? error.message : String(error);
    return { error: "declaration could not be read from " + path + ": " + detail };
  }
  const files = config.derived && config.derived.safeTests && config.derived.safeTests.files;
  if (!Array.isArray(files)) return { error: "declaration is missing derived.safeTests.files" };
  const paths = files.map((entry) => (entry ? entry.path : undefined));
  if (
    paths.length !== SAFE_TESTS.length ||
    paths.some((value, index) => value !== SAFE_TESTS[index])
  )
    return { error: "declared restored tests differ from the SAFE_TESTS literal" };
  const missing = paths.filter((value) => !existsSync(join(root, value)));
  if (missing.length > 0) return { error: "declared test file is absent: " + missing.join(", ") };
  return { paths };
}

function childEnv() {
  const env = { ...process.env };
  const removed = [];
  for (const key of Object.keys(env))
    if (SECRETISH.test(key)) {
      delete env[key];
      removed.push(key);
    }
  return { env, removed: removed.sort() };
}

function newestMtimeMs(directory, pattern) {
  if (!existsSync(directory)) return Number.NEGATIVE_INFINITY;
  let newest = Number.NEGATIVE_INFINITY;
  for (const entry of readdirSync(directory, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !pattern.test(entry.name)) continue;
    const mtimeMs = statSync(join(entry.parentPath, entry.name)).mtimeMs;
    if (mtimeMs > newest) newest = mtimeMs;
  }
  return newest;
}

function distState() {
  const present = existsSync(join(root, "dist"));
  const srcNewestMs = newestMtimeMs(join(root, "src"), /\.ts$/);
  const distNewestMs = newestMtimeMs(join(root, "dist"), /\.js$/);
  return {
    present,
    srcNewestMs,
    distNewestMs,
    disposition: distDisposition({ present, srcNewestMs, distNewestMs }),
  };
}

/** The only place this script starts a child process. */
function launchTests(paths, concurrency) {
  if (process.env[TRIPWIRE_ENV])
    throw new Error(
      TRIPWIRE_ENV + " tripped: launchTests() was reached, so this was not a preview",
    );
  const { env, removed } = childEnv();
  // Name what the filter took, so fixture divergence is observable.
  process.stderr.write(
    LABEL +
      " env filtered: " +
      (removed.length === 0 ? "none" : removed.length + " (" + removed.join(", ") + ")") +
      "\n",
  );
  return spawnSync(process.execPath, ["--test", "--test-concurrency=" + concurrency, ...paths], {
    cwd: root,
    stdio: "inherit",
    env,
  });
}

function main(argv) {
  const mode = argv[0];
  if (mode !== "run" && mode !== "preview") {
    process.stderr.write(USAGE + "\n");
    return 2;
  }
  if (argv.slice(1).some((value) => value !== "--json")) {
    process.stderr.write(USAGE + "\n");
    return 2;
  }
  const json = argv.includes("--json");
  const declaration = declaredTests();
  if (declaration.error) {
    process.stderr.write(LABEL + " " + declaration.error + "\n");
    return 2;
  }
  const paths = declaration.paths;
  const dist = distState();
  const concurrency = Math.min(availableParallelism(), MAX_CONCURRENCY);
  const command = ["node", "--test", "--test-concurrency=" + concurrency, ...paths];
  if (mode === "preview") {
    const report = {
      mode: "preview",
      executed: false,
      files: paths,
      distPresent: dist.present,
      distDisposition: dist.disposition,
      command,
      upstreamTarget: "unit-subset",
    };
    if (json) {
      process.stdout.write(JSON.stringify(report) + "\n");
    } else {
      process.stdout.write(
        LABEL + " preview: " + paths.length + " declared tests, nothing executed\n",
      );
      for (const value of paths) process.stdout.write("  " + value + "\n");
      process.stdout.write(LABEL + " built output: " + dist.disposition + "\n");
    }
    return 0;
  }
  if (dist.disposition !== "fresh") {
    const reason = {
      absent: "dist/ is absent",
      empty: "dist/ holds no built JavaScript",
      stale: "dist/ is older than the newest src/ change, so these tests would validate superseded code",
      unknown: "src/ could not be inspected, so built-output freshness is unknown",
    };
    process.stderr.write(
      LABEL + " " + reason[dist.disposition] + "; run: corepack pnpm run build:all\n",
    );
    return 3;
  }
  process.stderr.write(LABEL + " files=" + paths.length + " concurrency=" + concurrency + "\n");
  const outcome = launchTests(paths, concurrency);
  if (outcome.error)
    throw new Error("could not start the node test runner", { cause: outcome.error });
  if (outcome.signal) {
    process.stderr.write(LABEL + " terminated by signal " + outcome.signal + "\n");
    return 1;
  }
  return outcome.status === null ? 1 : outcome.status;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(
    LABEL + " " + (error instanceof Error ? error.message : String(error)) + "\n",
  );
  process.exitCode = 1;
}
