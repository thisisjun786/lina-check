/**
 * Action runtime pins, recovered for this fork's parked tree.
 *
 * The upstream suite for this, test/actions-runtime.test.ts, walks .github and
 * docs and keeps files matching /\.(?:md|ya?ml)$/. Every workflow in this fork is
 * parked as <name>.yml.disabled, so that filter drops all 35 of them: the
 * traversal shrinks in silence and reports unexamined workflows as examined.
 * The problem is the filter, not an absolute path.
 *
 * This keeps the same three assertions and the same fixed expectations, and
 * widens the filter to the parked spelling. The parked count is asserted first,
 * so a traversal that lost the workflows again fails here rather than passing
 * with less to look at.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const referenceRoots = [".github", "docs"];

/** Expected values, written out rather than read back from the tree. */
const appTokenRef =
  "actions/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1 # v3.2.0";
const cacheRefs = ["actions/cache@v6", "actions/cache/restore@v6", "actions/cache/save@v6"];
const PARKED_WORKFLOWS = 35;

/** Accepts the parked spelling as well, which is the whole point of this file. */
const isReference = (name: string) =>
  /\.(?:md|ya?ml)$/.test(name) || /\.ya?ml\.disabled$/.test(name);

function referenceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return referenceFiles(path);
    return isReference(entry.name) ? [path] : [];
  });
}

const lines = (path: string) => readFileSync(path, "utf8").split("\n");

test("the recovered traversal still reaches every parked workflow", () => {
  const parked = referenceFiles(".github/workflows").filter((path) =>
    path.endsWith(".disabled"),
  );
  assert.equal(
    parked.length,
    PARKED_WORKFLOWS,
    "a traversal that cannot see the parked workflows proves nothing about them",
  );
});

test("GitHub App token creation uses the approved immutable action pin everywhere", () => {
  const references = referenceRoots.flatMap(referenceFiles).flatMap((path) =>
    lines(path)
      .filter((line) => line.includes("actions/create-github-app-token@"))
      .map((line) => ({ path, reference: line.trim().replace(/^uses:\s*/, "") })),
  );

  assert.ok(references.length > 0, "expected GitHub App token action references");
  assert.deepEqual(
    [...new Set(references.map(({ reference }) => reference))],
    [appTokenRef],
    references.map(({ path, reference }) => path + ": " + reference).join("\n"),
  );
});

test("GitHub App token owner inputs do not consume the multi-owner repair policy", () => {
  const invalidOwnerInputs = referenceFiles(".github/workflows").flatMap((path) =>
    lines(path)
      .filter((line) => /^\s*owner:.*CLAWSWEEPER_ALLOWED_OWNER/.test(line))
      .map((line) => path + ": " + line.trim()),
  );

  assert.deepEqual(invalidOwnerInputs, []);
});

test("cache actions use one runtime generation everywhere", () => {
  const references = referenceRoots.flatMap(referenceFiles).flatMap((path) =>
    lines(path).flatMap((line) => line.match(/actions\/cache(?:\/(?:restore|save))?@v\d+/g) ?? []),
  );

  assert.ok(references.length > 0, "expected cache action references");
  assert.deepEqual([...new Set(references)].sort(), [...cacheRefs].sort());
});
