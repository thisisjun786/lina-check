/**
 * GitHub API URL construction, recovered on both sides of this fork's refusal.
 *
 * The upstream suite for this, test/dashboard-github-api.test.ts, loses two of
 * its three cases here: githubApiUrl now asks githubTransportPermitted first, and
 * an unconfigured installation carrying no credential is refused before a URL is
 * ever built. githubApiBaseUrl itself never had that gate.
 *
 * Both directions are asserted. Only checking the refusal would accept a "refuse
 * everything" regression; only checking construction would drop the refusal
 * JUN-198 added. The credential is a synthetic string passed as an argument: no
 * environment variable of this process is read, and no request is made.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_GITHUB_API_URL, githubApiBaseUrl, githubApiUrl } from "../dashboard/github-api.ts";

/** Permits transport. It does not configure an installation and grants no target. */
const permitted = { GITHUB_TOKEN: "synthetic-credential" };

test("GitHub API URL uses the production origin by default", () => {
  assert.equal(githubApiBaseUrl({}), DEFAULT_GITHUB_API_URL);
  assert.equal(
    githubApiBaseUrl({ GITHUB_API_URL: "https://api.github.com" }),
    DEFAULT_GITHUB_API_URL,
  );
  assert.equal(githubApiUrl(permitted, "/graphql"), "https://api.github.com/graphql");
});

test("GitHub API URL honors a validated loopback override", () => {
  const env = { GITHUB_API_URL: "http://127.0.0.1:8788" };
  assert.equal(githubApiBaseUrl(env), "http://127.0.0.1:8788");
  assert.equal(
    githubApiUrl({ ...env, ...permitted }, "/repos/acme/granted"),
    "http://127.0.0.1:8788/repos/acme/granted",
  );
  assert.equal(
    githubApiBaseUrl({ GITHUB_API_URL: "http://localhost:8788" }),
    "http://localhost:8788",
  );
});

test("GitHub API URL rejects non-default remote or non-origin overrides", () => {
  for (const value of [
    "http://github.example.test",
    "http://localhost",
    "http://127.0.0.1",
    "http://127.0.0.1:8788/api",
    "https://api.github.test/v3",
    "https://user@example.test",
    "https://evil.example",
    "https://api.github.com:8443",
  ]) {
    assert.throws(() => githubApiBaseUrl({ GITHUB_API_URL: value }), /invalid GITHUB_API_URL/);
  }
});

test("an unconfigured installation with no credential builds no URL at all", () => {
  assert.throws(() => githubApiUrl({}, "/graphql"), /refusing a GitHub request/);
  assert.throws(
    () => githubApiUrl({ GITHUB_API_URL: "http://127.0.0.1:8788" }, "/graphql"),
    /refusing a GitHub request/,
    "a validated override is not a credential",
  );
});

test("a path assembled from unset configuration is refused before the credential check", () => {
  assert.throws(() => githubApiUrl(permitted, "/repos//installation"), /empty segment/);
  assert.throws(() => githubApiUrl(permitted, "graphql"), /must start with \//);
});
