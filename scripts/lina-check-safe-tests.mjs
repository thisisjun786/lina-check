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
 *   than its source. Existence alone is not freshness, and neither is the newest
 *   timestamp anywhere under dist/: a partial build such as build:repair would
*   refresh unrelated output while the module a restored test imports stays old.
*   Freshness is therefore decided per source/output pair.
 *
 *   Both directions are checked. A source without output is incomplete; an
 *   output without source is orphaned, because TypeScript does not remove the
 *   JavaScript left behind by a deleted or renamed module and a restored test
 *   importing that path would pass against code no longer in src/.
 *
 *   The comparison uses modification times, which are not build provenance.
 *   Restoring artifacts from an archive can invert the order, making current
 *   output look stale or older output stamped after its source look current.
 *   Content hashing would need build metadata this scaffold does not produce, so
 *   the limit is named rather than hidden: after any artifact restoration, run
 *   build:all before trusting a result.
 *
* A broken declaration is a configuration fault, not a test failure, so it exits
* 2 even when the failure surfaces as a thrown read or parse error.
*
* Every launch carries LANE_TIMEOUT_MS. A declared test that never returns would
* otherwise hang the lane rather than fail it, and a hung lane is the one result
* nobody can tell apart from work still in progress. A launch stopped at that
* bound is reported by name and exits 1.
 *
 * The child environment drops credential-shaped variables. That filter is
 * deliberately broad in the safety direction, so it can also drop non-credential
 * configuration and make a restored test behave differently from direct
 * execution. The removed names are printed before the run, so any such
 * divergence is visible rather than silent.
 */

import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { availableParallelism } from "node:os";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  SAFE_TESTS,
  TRIPWIRE_ENV,
  DERIVED_TESTS,
  LANE_TIMEOUT_MS,
  UPSTREAM_FIXTURE_TESTS,
  UPSTREAM_FIXTURE_TEST_NAMES,
  classifyBuildPair,
  describeLaunchOutcome,
  resolveFixtureFiles,
  reapLaunchGroup,
  interruptExitCode,
} from "./lina-check-derived-contract.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const LABEL = "[lina-check-safe-tests]";
const USAGE = "usage: node scripts/lina-check-safe-tests.mjs <run|preview> [--json]";
const SECRETISH = /TOKEN|SECRET|_KEY$|^GH_|^GITHUB_/;
const MAX_CONCURRENCY = 8;
/** Set by the stop handlers installed around the launch sequence. */
let pendingInterrupt = null;

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
  // The pin comes from the same declaration the validator checks against its own
  // literal, so a fixture cannot be built from some other commit.
  const pin = config.upstream && config.upstream.commit;
  if (typeof pin !== "string" || pin.length !== 40) {
    return { error: "declaration is missing a usable upstream.commit" };
  }
  return { paths, pin };
}

/**
 * Tests this fork wrote, kept in their own list so a report never blurs them
 * with the restored upstream set. Same rule as everywhere else here: the code
 * literal fixes the membership and the declaration only records why.
 */
function declaredDerivedTests() {
  const path = join(root, "config", "lina-check-scaffold.json");
  let declared;
  try {
    declared = JSON.parse(readFileSync(path, "utf8")).derived.derivedTests;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { error: "derived-test declaration could not be read: " + detail };
  }
  const names = Object.keys(declared ?? {}).sort();
  if (names.length !== DERIVED_TESTS.length || names.some((v, i) => v !== DERIVED_TESTS[i]))
    return { error: "declared derived tests differ from the DERIVED_TESTS literal" };
  const missing = names.filter((value) => !existsSync(join(root, value)));
  if (missing.length > 0)
    return { error: "declared derived test is absent: " + missing.join(", ") };
  return { paths: names };
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

function distState() {
  const sourceDir = join(root, "src");
  const outputDir = join(root, "dist");
  if (!existsSync(outputDir)) return { present: false, disposition: "absent", detail: null, pairs: 0 };
  if (!existsSync(sourceDir))
    return { present: true, disposition: "unknown", detail: "src/ is absent", pairs: 0 };
  let pairs = 0;
  for (const entry of readdirSync(sourceDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".ts") || entry.name.endsWith(".d.ts")) continue;
    const source = join(entry.parentPath, entry.name);
    const rel = relative(sourceDir, source);
    const output = join(outputDir, rel.slice(0, -".ts".length) + ".js");
    const outputExists = existsSync(output);
    const verdict = classifyBuildPair({
      outputExists,
      sourceMtimeMs: statSync(source).mtimeMs,
      outputMtimeMs: outputExists ? statSync(output).mtimeMs : Number.NEGATIVE_INFINITY,
    });
    if (verdict === "missing")
      return { present: true, disposition: "incomplete", detail: rel, pairs };
    if (verdict !== "current")
      return { present: true, disposition: verdict, detail: rel, pairs };
    pairs += 1;
  }
  // Reverse direction: built output whose source is gone still satisfies every
  // remaining pair, yet can supply the module a restored test imports.
  for (const entry of readdirSync(outputDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
    const rel = relative(outputDir, join(entry.parentPath, entry.name));
    if (!existsSync(join(sourceDir, rel.slice(0, -".js".length) + ".ts")))
      return { present: true, disposition: "orphaned", detail: rel, pairs };
  }
  if (pairs === 0) return { present: true, disposition: "empty", detail: null, pairs };
  return { present: true, disposition: "fresh", detail: null, pairs };
}

/**
 * The only place this script starts a child process.
 *
 * Exported so the launch-boundary control can call it directly. Driving the
 * control through the CLI made it depend on the built-output preflight, which
 * refuses earlier and would let a broken tripwire pass unnoticed.
 */
/**
 * Materialise the pinned upstream copies a fixture test needs, outside the
 * repository. Read straight from the pin with git show rather than copied by
 * hand, so the fixture cannot drift from upstream, and placed under the system
 * temporary directory so the working tree is untouched.
 */
/**
 * One pin, one set of bytes. Twenty-two fixture tests sharing the pinned .github
 * tree would otherwise mean more than a thousand git invocations for content
 * that cannot differ between them. The caches live for one process, so a run
 * still reads the pin fresh rather than trusting anything left on disk.
 */
const pinnedPathCache = new Map();
const pinnedByteCache = new Map();

function pinnedPaths(pin) {
  if (!pinnedPathCache.has(pin))
    pinnedPathCache.set(
      pin,
      execFileSync("git", ["-C", root, "ls-tree", "-r", "--name-only", "-z", pin], {
        maxBuffer: 64 * 1024 * 1024,
      })
        .toString()
        .split("\u0000")
        .filter(Boolean),
    );
  return pinnedPathCache.get(pin);
}

function pinnedBytes(pin, file) {
  const key = pin + ":" + file;
  if (!pinnedByteCache.has(key))
    pinnedByteCache.set(
      key,
      execFileSync("git", ["-C", root, "show", key], { maxBuffer: 16 * 1024 * 1024 }),
    );
  return pinnedByteCache.get(key);
}

export function makeUpstreamFixture(testPath, pin) {
  const files = resolveFixtureFiles(testPath, pinnedPaths(pin));
  const dir = mkdtempSync(join(tmpdir(), "lina-check-upstream-"));
  // The caller only learns the directory name on a successful return, so a
  // throw partway through would strand whatever was already written. Clean up
  // here and let the original error through.
  try {
    for (const file of files) {
      const bytes = pinnedBytes(pin, file);
      const target = join(dir, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes);
    }
    return dir;
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

export function launchTests(paths, concurrency, options = {}) {
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
    cwd: options.cwd ?? root,
    stdio: "inherit",
    env,
    // The lane had no bound at all. One declared test that never returned would
    // have hung it instead of failing it, which is the one result a lane must
    // never produce, because nobody can tell it apart from work in progress.
    timeout: LANE_TIMEOUT_MS,
    // Its own process group, so a launch stopped at the bound can be reaped
    // whole. Restored tests start node, git, curl and local servers, and the
    // timeout signal reaches only the process spawnSync started. The cost is
    // that an interactive interrupt no longer reaches the tests: Ctrl-C stops
    // the lane and leaves the group behind.
    detached: true,
  });
}

/**
 * Exported with an injectable built-output probe so the routing control can
 * exercise this function, not just the launch helper, without needing a build.
 * Production callers pass nothing and get the real probe.
 */
export function main(argv, deps = {}) {
  const probeDist = deps.distState ?? distState;
  // Injectable so the self-test can drive the launch sequence itself. The
  // ordering rule this function has to keep — reap a timed-out group before the
  // next launch, and before any cleanup — is not observable from outside.
  const launch = deps.launchTests ?? launchTests;
  const fixture = deps.makeFixture ?? makeUpstreamFixture;
  const reap = deps.reap ?? ((outcome) => reapLaunchGroup(outcome, (pid, signal) => process.kill(pid, signal)));
  // A launch runs in its own process group, so an interrupt aimed at the lane
  // does not reach it. Without this the lane would die and leave the group
  // behind. Handling the signal instead defers the exit until the launch in
  // flight returns — spawnSync blocks the loop, so a handler cannot run sooner
  // — and reaps that group before leaving.
  const interruptedBy = deps.interrupted ?? (() => pendingInterrupt);
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
  const derived = declaredDerivedTests();
  if (derived.error) {
    process.stderr.write(LABEL + " " + derived.error + "\n");
    return 2;
  }
  const dist = probeDist();
  const concurrency = Math.min(availableParallelism(), MAX_CONCURRENCY);
  const command = ["node", "--test", "--test-concurrency=" + concurrency, ...paths];
  if (mode === "preview") {
    const report = {
      mode: "preview",
      executed: false,
      files: paths,
      distPresent: dist.present,
      distDisposition: dist.disposition,
      distPairs: dist.pairs,
      command,
      upstreamTarget: "unit-subset",
      upstreamFixtureTests: [...UPSTREAM_FIXTURE_TEST_NAMES],
      derivedTests: [...derived.paths],
    };
    if (json) {
      process.stdout.write(JSON.stringify(report) + "\n");
    } else {
      process.stdout.write(
        LABEL + " preview: " + paths.length + " declared tests, nothing executed\n",
      );
      for (const value of paths) process.stdout.write("  " + value + "\n");
      process.stdout.write(
        LABEL + " preview: " + derived.paths.length + " derived tests, nothing executed\n",
      );
      for (const value of derived.paths) process.stdout.write("  " + value + "\n");
      process.stdout.write(LABEL + " built output: " + dist.disposition + "\n");
    }
    return 0;
  }
  if (dist.disposition !== "fresh") {
    const reason = {
      absent: "dist/ is absent",
      empty: "dist/ holds no built JavaScript",
      incomplete: "a source file has no built output, so these tests would import a missing or superseded module",
      orphaned: "built output remains for a source file that no longer exists, so these tests could import code absent from src/",
      stale: "a built file is older than its source, so these tests would validate superseded code",
      unknown: "built-output freshness could not be determined",
    };
    process.stderr.write(
      LABEL +
        " " +
        reason[dist.disposition] +
        (dist.detail === null ? "" : " (" + dist.detail + ")") +
        "; run: corepack pnpm run build:all\n",
    );
    return 3;
  }
  process.stderr.write(
    LABEL +
      " files=" +
      paths.length +
      " derived=" +
      derived.paths.length +
      " concurrency=" +
      concurrency +
      "\n",
  );
  // Most tests run at the repository root. A declared fixture test runs against
  // pinned upstream bytes instead, because it asserts upstream operational
  // values this fork deliberately no longer carries.
  const fixtureNames = paths.filter((value) => Boolean(UPSTREAM_FIXTURE_TESTS[value]));
  // Derived tests run at the repository root against this fork's real files.
  // That is the point of them: the fixture lane exists for upstream assertions
  // about upstream bytes, and these assert what this fork actually does.
  const rootPaths = [...paths.filter((value) => !UPSTREAM_FIXTURE_TESTS[value]), ...derived.paths];
  // Judge each launch the moment it returns. Collecting every outcome first and
  // judging afterwards left a real hole: the first failure returned, so a later
  // launch stopped at the bound was never reaped and its descendants outlived
  // the lane. A fixture cleanup that threw skipped the same step.
  const failures = [];
  const settle = (outcome) => {
    const verdict = describeLaunchOutcome(outcome, LANE_TIMEOUT_MS);
    // Any signalled end leaves the same mess, not only the bound: an operator
    // interrupt or an out-of-memory kill stops the runner while the processes
    // its tests started keep their ports. The cleanup rule is the launch group,
    // so it applies wherever the group can still be alive.
    if (verdict.kind === "timeout" || verdict.kind === "signal" || interruptedBy()) {
      const reaped = reap(outcome);
      process.stderr.write(
        LABEL +
          " reaping the launch group: " +
          (reaped.reaped ? String(reaped.group) : "nothing to reap (" + reaped.reason + ")") +
          "\n",
      );
    }
    if (verdict.kind !== "ok") failures.push({ verdict, outcome });
    return verdict;
  };
  const stopSignals = ["SIGINT", "SIGTERM"];
  const onStop = (signal) => {
    pendingInterrupt = signal;
  };
  for (const signal of stopSignals) process.on(signal, onStop);
  try {
    if (rootPaths.length > 0) settle(launch(rootPaths, concurrency));
    for (const name of fixtureNames) {
      if (interruptedBy()) break;
      const directory = fixture(name, declaration.pin);
      process.stderr.write(LABEL + " upstream-fixture: " + name + " at " + declaration.pin.slice(0, 8) + "\n");
      try {
        // Absolute path: the test resolves imports relative to its own file, while
        // its declared reads follow the working directory into the fixture.
        settle(launch([join(root, name)], 1, { cwd: directory }));
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  } finally {
    for (const signal of stopSignals) process.off(signal, onStop);
  }
  const stopped = interruptedBy();
  if (stopped) {
    process.stderr.write(LABEL + " stopped by " + stopped + " after the launch in flight returned\n");
    return interruptExitCode(stopped);
  }
  const first = failures[0];
  if (first === undefined) return 0;
  if (first.verdict.kind === "unstarted")
    throw new Error("could not start the node test runner", { cause: first.outcome.error });
  process.stderr.write(LABEL + " " + first.verdict.detail + "\n");
  return first.verdict.exitCode;
}

/**
 * Compare resolved paths, not the raw argv value. Started through a symlink the
 * two spellings differ, and a plain URL comparison would silently skip main and
 * exit 0 while the caller believed the tests ran.
 */
function startedDirectly() {
  const invoked = process.argv[1];
  if (invoked === undefined) return false;
  if (import.meta.url === pathToFileURL(invoked).href) return true;
  try {
    return realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (startedDirectly()) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      LABEL + " " + (error instanceof Error ? error.message : String(error)) + "\n",
    );
    process.exitCode = 1;
  }
}
