/**
 * Admission coverage for the LINA Check installation profile.
 *
 * The upstream suite for this decision, test/hosted-target-admission.test.ts,
 * cannot run in this fork: it opens .github/workflows/hosted-target-admission.yml
 * and every workflow here is parked, so that file does not exist. Its assertions
 * are also about the parked workflow's text, including the owner comparison this
 * change removes. Editing it to match new behaviour would be weakening a gate,
 * so the behaviour is covered here instead, on all four paths that admit a
 * target: the shared decision the Worker and the queue call, the Node webhook
 * classifier, and target fanout.
 *
 * These tests start no processes and make no network requests. The one place a
 * request could occur is given a reader that throws, so a passing run proves the
 * request was never attempted rather than merely permitted.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  hostedTargetPolicyFromRegistry,
  isHostedTargetEligible,
  resolveHostedTargetEligibility,
} from "../dist/hosted-target-admission.js";
import {
  UNCONFIGURED_INSTALLATION,
  githubTransportPermitted,
  installationAdmitsRepository,
  installationConfigured,
  installationFromEnv,
  parseInstallationProfile,
} from "../dist/lina-check-installation-contract.js";
import { loadInstallationProfile } from "../dist/lina-check-installation.js";
import { classifyItemWebhook } from "../dist/repair/comment-webhook.js";
import { admitSelectedRepositories } from "../dist/repair/target-fanout.js";

function profileOf(targets: Record<string, unknown>) {
  const parsed = parseInstallationProfile({
    schema_version: 1,
    configured: true,
    branding: { product_name: "", short_name: "", user_agent: "", dashboard_host: "" },
    targets,
    state: { state_repo: "", state_ref: "" },
    github_app: { client_id: "", bot_login: "" },
  });
  assert.equal(parsed.ok, true, "fixture profile must parse: " + parsed.detail);
  return parsed.profile;
}

const named = profileOf({ fallback_owners: [], repositories: ["acme/granted"], registry_url: "" });
const byOwner = profileOf({
  fallback_owners: ["acme"],
  repositories: [],
  registry_url: "https://example.invalid/targets.json",
});

/** A registry that describes more than any installation here grants. */
const REGISTRY = {
  schema_version: 2,
  repositories: [{ target_repo: "acme/described" }, { target_repo: "other/described" }],
  generic_fallbacks: [
    {
      owner: "acme",
      deny_repositories: ["acme/forbidden"],
      allow_repo_name_pattern: "^[a-z0-9-]+$",
    },
    { owner: "other", deny_repositories: [], allow_repo_name_pattern: "^[a-z0-9-]+$" },
  ],
};

function policy(installation: unknown) {
  const built = hostedTargetPolicyFromRegistry(REGISTRY, installation);
  assert.ok(built, "registry fixture must parse");
  return built;
}

const eligible = (repo: string, installation: unknown) =>
  isHostedTargetEligible(repo, policy(installation));

test("an unconfigured installation admits nothing the registry lists", () => {
  assert.equal(eligible("acme/described", UNCONFIGURED_INSTALLATION), false);
  assert.equal(eligible("acme/anything", UNCONFIGURED_INSTALLATION), false);
  assert.equal(eligible("other/described", UNCONFIGURED_INSTALLATION), false);
});

test("an explicit grant stands without a registry entry", () => {
  // Requiring a registry entry as well is what made the Worker and the Node
  // paths disagree about the same installation.
  assert.equal(eligible("acme/granted", named), true);
  assert.equal(eligible("ACME/Granted", named), true, "the target query is case-insensitive");
});

test("the registry describes but never grants", () => {
  assert.equal(eligible("acme/described", named), false);
  assert.equal(eligible("other/described", named), false);
});

test("a fallback owner is a pattern the installation still chooses", () => {
  assert.equal(eligible("acme/anything", byOwner), true);
  assert.equal(eligible("acme/forbidden", byOwner), false, "registry deny list is honoured");
  assert.equal(eligible("acme/Bad_Name", byOwner), false, "registry name pattern is honoured");
  assert.equal(eligible("other/anything", byOwner), false, "an ungranted owner is refused");
});

test("the Worker and queue resolver defers to the installation", async () => {
  const resolve = (repo: string, options: Record<string, unknown>) =>
    resolveHostedTargetEligibility(repo, fetch, options);
  assert.equal(
    (await resolve("acme/granted", { installation: UNCONFIGURED_INSTALLATION })).outcome,
    "terminal",
    "no installation means no registry request and no eligibility",
  );
  // The production call shape: Worker and queue pass an installation and nothing
  // else. Asserting with configuredRepositories took a branch only tests use and
  // hid the fact that an explicit grant was returning terminal here.
  assert.equal(
    (await resolve("acme/granted", { installation: named })).outcome,
    "eligible",
    "an explicit grant must be admitted without a registry on the production path",
  );
  assert.equal(
    (await resolve("acme/notgranted", { installation: named })).outcome,
    "terminal",
    "a repository the installation never named is still refused",
  );
  assert.equal(
    (
      await resolve("acme/described", {
        installation: UNCONFIGURED_INSTALLATION,
        configuredRepositories: ["acme/described"],
      })
    ).outcome,
    "terminal",
    "prepared repositories must not grant without an installation",
  );
});

test("only a real function can use the predicate seam", async () => {
  // Cloudflare vars and secrets are strings, so nothing a deployment can set
  // reaches this branch. Anything that is not a function must grant nothing.
  for (const predicate of ["true", 1, {}, [], "function", null]) {
    const outcome = await resolveHostedTargetEligibility("acme/granted", fetch, {
      installation: UNCONFIGURED_INSTALLATION,
      predicate,
    });
    assert.equal(outcome.outcome, "terminal", "non-function predicate: " + String(predicate));
  }
});

test("transport permission is not the admission gate", () => {
  const withCredential = { GITHUB_TOKEN: "ghp_example" };
  assert.equal(githubTransportPermitted(withCredential), true, "a credential permits transport");
  assert.equal(
    installationConfigured(installationFromEnv(withCredential)),
    false,
    "a credential does not configure an installation",
  );
  assert.equal(
    eligible("acme/granted", installationFromEnv(withCredential)),
    false,
    "a credential admits nothing",
  );
});

test("the Node webhook classifier refuses under the shipped empty profile", () => {
  const classified = classifyItemWebhook({
    event: "issues",
    payload: {
      action: "opened",
      repository: { full_name: "acme/granted", has_issues: true, default_branch: "main" },
      issue: { number: 1 },
      installation: { id: 1 },
    },
  });
  assert.equal(classified.accepted, false);
  assert.equal(classified.reason, "repository not eligible");
});

test("the profile the webhook consults is the shipped empty one", () => {
  const loaded = loadInstallationProfile();
  assert.equal(installationConfigured(loaded.profile), false);
  assert.equal(installationAdmitsRepository(loaded.profile, "acme/granted"), false);
});

test("fanout never probes a target it did not admit", async () => {
  const reader = () => {
    throw new Error("fanout must not probe a target it never admitted");
  };
  const listed = [{ targetRepo: "acme/granted" }, { targetRepo: "acme/described" }];
  const admitted = await admitSelectedRepositories(listed, {
    policy: policy(UNCONFIGURED_INSTALLATION),
    token: "t",
    reader,
  });
  assert.deepEqual(admitted, []);
});
