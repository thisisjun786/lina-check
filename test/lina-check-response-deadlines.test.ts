/**
 * GitHub response deadlines, recovered on a transport this fork permits.
 *
 * The upstream suite for this, test/github-response-deadlines.test.ts, never
 * reaches its own fetch mock here: githubApiUrl refuses an unconfigured
 * installation that carries no credential, and the refusal lands before the
 * request the suite is waiting on, so its promise is never settled. Under the
 * runner's default (no per-test bound) that file does not return at all.
 *
 * Both read paths already take env as their last argument, so a synthetic
 * credential passed as an argument restores the eight deadline cases unchanged.
 * The refusal is asserted separately, and asserted to settle and to leave fetch
 * untouched, so the recovery cannot quietly become the hang it replaced.
 */
import assert from "node:assert/strict";
import { setImmediate as nextTurn } from "node:timers/promises";
import test from "node:test";

import { exactReviewTerminalRun } from "../dashboard/exact-review-queue.ts";
import { githubAppJson, GitHubRequestError } from "../dashboard/github-api.ts";

/** Permits transport. It configures no installation and admits no repository. */
const permitted = { GITHUB_TOKEN: "synthetic-credential" };

const readers = {
  queue: () =>
    exactReviewTerminalRun("synthetic-token", { runId: "1", claimGeneration: 1 }, permitted),
  app: () => githubAppJson("/fixture", "synthetic-token", {}, permitted),
};

const refusals = {
  queue: () => exactReviewTerminalRun("synthetic-token", { runId: "1", claimGeneration: 1 }),
  app: () => githubAppJson("/fixture", "synthetic-token"),
};

/**
 * Replace the global fetch for one test and put it back afterwards.
 *
 * t.mock.method(globalThis, ...) would do the same, but it hands the global
 * object to a callee, and the derived-test contract reaches the root only
 * through a property read. Saving and restoring through globalThis.fetch is
 * the spelling the other derived suites already use.
 */
function stubFetch(t: { after: (cleanup: () => void) => void }, handler: unknown) {
  const original = globalThis.fetch;
  globalThis.fetch = handler as typeof globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
}

for (const [name, refuse] of Object.entries(refusals)) {
  test(name + " refuses an unconfigured installation before any request", async (t) => {
    // The excluded suite hung exactly here, so settling is half the assertion.
    // The other half is that nothing was attempted: githubAppJson catches the
    // refusal and rethrows it as "network failure", so the message alone cannot
    // tell a refusal apart from a request that went out and failed.
    let attempts = 0;
    stubFetch(t, async () => {
      attempts += 1;
      throw new Error("an unconfigured installation must not reach the network");
    });
    await assert.rejects(refuse());
    assert.equal(attempts, 0, "no request may be attempted without a permitted transport");
  });
}

for (const [name, read] of Object.entries(readers)) {
  for (const status of [200, 503, 429]) {
    test(`${name} bounds a stalled ${status} body and preserves its error class`, async (t) => {
      t.mock.timers.enable({ apis: ["setTimeout"] });
      t.mock.method(AbortSignal, "timeout", (milliseconds: number) => {
        const controller = new AbortController();
        setTimeout(() => controller.abort("timeout"), milliseconds);
        return controller.signal;
      });
      let markStarted!: () => void;
      const started = new Promise<void>((resolve) => {
        markStarted = resolve;
      });
      let bodyController!: ReadableStreamDefaultController;
      stubFetch(t, async (_input: unknown, init: RequestInit) => {
        const response = new Response(
          new ReadableStream({
            start(controller) {
              bodyController = controller;
              init.signal!.addEventListener(
                "abort",
                () => controller.error(new DOMException("body aborted", "AbortError")),
                { once: true },
              );
            },
          }),
          { status, headers: status === 429 ? { "retry-after": "7" } : {} },
        );
        const text = response.text.bind(response);
        response.text = () => {
          markStarted();
          return text();
        };
        return response;
      });
      const outcome = read().then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
      t.after(() => bodyController.error(new Error("fixture cleanup")));
      await started;
      t.mock.timers.tick(4500);
      const result = await Promise.race([outcome, nextTurn().then(() => null)]);
      assert.notEqual(result, null, "body remained pending after the request deadline");
      assert.ok(result && "error" in result);
      assert.ok(result.error instanceof GitHubRequestError);
      assert.equal(result.error.timedOut, status === 200);
      assert.equal(result.error.status, status === 200 ? undefined : status);
      assert.equal(result.error.rateLimited, status === 429);
      if (status === 429) assert.ok(result.error.rateLimitHint);
    });
  }

  test(`${name} preserves JSON parse failures after a successful body read`, async (t) => {
    stubFetch(t, async () => new Response("not JSON"));
    await assert.rejects(read(), SyntaxError);
  });
}
