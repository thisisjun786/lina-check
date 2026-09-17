/**
 * Node test-runner behaviour, recovered around this fork's package guards.
 *
 * The upstream suite for this, test/run-node-tests.test.ts, is excluded for one
 * case out of seven: "composed no-build scripts preserve standalone build
 * contracts" reads package.json and expects the upstream test commands. This fork
 * replaced every operational command with a guard, so that expectation cannot
 * hold and must not be restored as written. The runner itself is byte-identical
 * to the pin, so its six behavioural cases carry over unchanged.
 *
 * The last case drives the runner with an injected launcher. Nothing is started:
 * the fake child is an event emitter this file owns.
 */
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import {
  applyProcessOutcome,
  calculateTestConcurrency,
  configuredTestConcurrency,
  parseArguments,
  resolveTestFiles,
  runNodeTests,
} from "../scripts/run-node-tests.mjs";

function createFixture(files: string[]) {
  const root = mkdtempSync(join(tmpdir(), "lina-check-node-test-runner-"));
  for (const file of files) {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "// fixture\n");
  }
  return root;
}

test("test runner caps adaptive concurrency at sixteen", () => {
  assert.equal(calculateTestConcurrency(1), 1);
  assert.equal(calculateTestConcurrency(4), 4);
  assert.equal(calculateTestConcurrency(16), 16);
  assert.equal(calculateTestConcurrency(32), 16);
});

test("test runner environment override is validated and CLI choice takes precedence", () => {
  assert.equal(configuredTestConcurrency(undefined, {}), undefined);
  assert.equal(configuredTestConcurrency(undefined, { CLAWSWEEPER_TEST_CONCURRENCY: "8" }), 8);
  assert.equal(configuredTestConcurrency(2, { CLAWSWEEPER_TEST_CONCURRENCY: "invalid" }), 2);
  for (const value of ["", "0", "-1", "1.5", "invalid", "9007199254740992"]) {
    assert.throws(
      () => configuredTestConcurrency(undefined, { CLAWSWEEPER_TEST_CONCURRENCY: value }),
      /CLAWSWEEPER_TEST_CONCURRENCY must be/,
    );
  }
});

test("test runner expands named targets with sorted de-duplicated files", () => {
  const root = createFixture([
    "test/z.test.ts",
    "test/a.test.ts",
    "test/repair/b.test.ts",
    "dist/repair/z.test.js",
    "dist/repair/fix-prompt-builder.test.js",
  ]);
  try {
    assert.deepEqual(resolveTestFiles("unit", root), ["test/a.test.ts", "test/z.test.ts"]);
    assert.deepEqual(resolveTestFiles("repair", root), [
      "dist/repair/fix-prompt-builder.test.js",
      "dist/repair/z.test.js",
      "test/repair/b.test.ts",
    ]);
    assert.deepEqual(resolveTestFiles("all", root), [
      "dist/repair/fix-prompt-builder.test.js",
      "dist/repair/z.test.js",
      "test/a.test.ts",
      "test/repair/b.test.ts",
      "test/z.test.ts",
    ]);
    assert.deepEqual(resolveTestFiles("fix-prompt-builder", root), [
      "dist/repair/fix-prompt-builder.test.js",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("test runner parses CLI concurrency overrides and forwarded Node options", () => {
  assert.deepEqual(
    parseArguments([
      "all",
      "--test-concurrency=4",
      "--",
      "--experimental-test-coverage",
      "--test-coverage-lines=49",
    ]),
    {
      help: false,
      target: "all",
      concurrency: 4,
      nodeArguments: ["--experimental-test-coverage", "--test-coverage-lines=49"],
    },
  );
  assert.deepEqual(parseArguments(["unit", "--test-concurrency", "1"]), {
    help: false,
    target: "unit",
    concurrency: 1,
    nodeArguments: [],
  });
  assert.deepEqual(parseArguments(["all", "--", "--help", "-h"]), {
    help: false,
    target: "all",
    concurrency: undefined,
    nodeArguments: ["--help", "-h"],
  });
  assert.throws(() => parseArguments(["unit", "--test-concurrency", "0"]), /positive integer/);
  assert.throws(
    () => parseArguments(["unit", "--", "--test-concurrency=32"]),
    /runner owns those options/,
  );
});

test("test runner fails clearly when a target has no files", async () => {
  const root = createFixture([]);
  try {
    await assert.rejects(
      runNodeTests({ target: "unit", cwd: root }),
      /target unit did not match any files/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("test runner preserves child arguments, exit codes, and terminating signals", async () => {
  const root = createFixture(["test/a.test.ts"]);
  const signalSource = new EventEmitter();
  const started: { command?: string; arguments?: string[]; killed?: NodeJS.Signals } = {};
  const child = new EventEmitter() as EventEmitter & { kill(signal: NodeJS.Signals): boolean };
  child.kill = (signal) => {
    started.killed = signal;
    queueMicrotask(() => child.emit("exit", null, signal));
    return true;
  };
  try {
    const exitPromise = runNodeTests({
      target: "unit",
      concurrency: 4,
      cwd: root,
      signalSource,
      // Injected launcher. The runner never reaches a real one in this file.
      spawnProcess(command: string, arguments_: string[]) {
        started.command = command;
        started.arguments = arguments_;
        queueMicrotask(() => child.emit("exit", 23, null));
        return child;
      },
    });
    assert.deepEqual(await exitPromise, { code: 23, signal: null });
    assert.equal(started.command, process.execPath);
    assert.deepEqual(started.arguments, ["--test", "--test-concurrency=4", "test/a.test.ts"]);

    const signalPromise = runNodeTests({
      target: "unit",
      cwd: root,
      signalSource,
      spawnProcess: () => child,
    });
    signalSource.emit("SIGTERM");
    assert.deepEqual(await signalPromise, { code: null, signal: "SIGTERM" });
    assert.equal(started.killed, "SIGTERM");

    let exitCode;
    let signal;
    applyProcessOutcome({ code: 23, signal: null }, { setExitCode: (value) => (exitCode = value) });
    applyProcessOutcome(
      { code: null, signal: "SIGTERM" },
      { signalProcess: (_pid, value) => (signal = value) },
    );
    assert.equal(exitCode, 23);
    assert.equal(signal, "SIGTERM");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("this fork's composed test commands are guards, not builds", () => {
  // The replacement for the upstream case. Upstream asserted that test and
  // test:coverage compose a build with a no-build runner; here every one of those
  // names is the scaffold guard, so the contract to hold steady is that none of
  // them can start a build or a runner.
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { scripts: Record<string, string> };
  const guarded = [
    "test",
    "test:repair",
    "test:coverage",
    "test:coverage:changed",
    "test:no-build",
    "test:repair:no-build",
    "test:coverage:no-build",
    "test:coverage:changed:no-build",
  ];
  for (const name of guarded) {
    assert.equal(
      pkg.scripts[name],
      "node scripts/scaffold-disabled.mjs " + name,
      name + " must be the scaffold guard",
    );
    assert.ok(!Object.hasOwn(pkg.scripts, "pre" + name), "pre" + name + " would run alongside");
    assert.ok(!Object.hasOwn(pkg.scripts, "post" + name), "post" + name + " would run alongside");
  }
});
