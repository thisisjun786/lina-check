/**
 * Comment webhook admission, recovered on a configured installation.
 *
 * The upstream suite for this, test/repair/comment-webhook.test.ts, loses 27 of
 * its 38 records to one cause and the other 11 to different ones, and the two
 * must not be blurred. The 27 assume upstream's admission: an unconfigured
 * installation takes no target at all, so every "accepts" assertion fails. The
 * remaining 11 fail because they drive handleGitHubWebhook over HTTP with durable
 * intake, or because they reach test/helpers/command-intake-fixture.mjs, which
 * starts a process from inside the helper.
 *
 * What is restored here is the first group, through the real admission functions.
 * The installation is made configured the way the packet requires: the profile
 * loader's file read is banded, the real classifier is then called, and the band
 * and the loader cache are both restored in finally. Nothing replaces an
 * admission function with a constant, so a "grant everything" regression still
 * fails the refusal cases below.
 *
 * The HTTP and durable-intake records are recorded as losses in the plan unit.
 */
import { createRequire, syncBuiltinESMExports } from "node:module";
import nodeTest from "node:test";

import { resetInstallationProfileCache } from "../dist/lina-check-installation.js";

// The ESM namespace for a builtin is frozen, so the band is applied to the
// module object itself and the ESM bindings are refreshed afterwards.
const nodeFs = createRequire(import.meta.url)("node:fs") as {
  readFileSync: (...args: unknown[]) => unknown;
  existsSync: (...args: unknown[]) => unknown;
};

const INSTALLATION_FILE = "config/lina-check-installation.json";

/** What this fixture grants. Nothing else is admitted, which is the point. */
const CONFIGURED_INSTALLATION = {
  schema_version: 1,
  configured: true,
  branding: { product_name: "", short_name: "", user_agent: "", dashboard_host: "" },
  targets: {
    fallback_owners: ["openclaw", "steipete"],
    repositories: ["partner/configured-repo"],
    registry_url: "https://example.invalid/targets.json",
  },
  state: { state_repo: "", state_ref: "" },
  github_app: { client_id: "", bot_login: "" },
};

/**
 * Band the loader's file read, not the admission decision.
 *
 * The cache is dropped on the way in and on the way out, so neither this file
 * nor anything after it observes a profile built from a banded read.
 */
async function withConfiguredInstallation<T>(run: () => T | Promise<T>): Promise<T> {
  const realRead = nodeFs.readFileSync;
  const realExists = nodeFs.existsSync;
  const isInstallation = (path: unknown) => String(path).endsWith(INSTALLATION_FILE);
  nodeFs.readFileSync = (path: unknown, options: unknown) =>
    isInstallation(path) ? JSON.stringify(CONFIGURED_INSTALLATION) : realRead(path, options);
  nodeFs.existsSync = (path: unknown) => (isInstallation(path) ? true : realExists(path));
  syncBuiltinESMExports();
  resetInstallationProfileCache();
  try {
    return await run();
  } finally {
    nodeFs.readFileSync = realRead;
    nodeFs.existsSync = realExists;
    syncBuiltinESMExports();
    resetInstallationProfileCache();
  }
}
/** Every restored case runs inside the band and leaves nothing behind. */
const test = (name: string, fn: (t: unknown) => unknown) =>
  nodeTest(name, async (t) => {
    await withConfiguredInstallation(() => fn(t));
  });



import assert from "node:assert/strict";
import crypto from "node:crypto";

import { adaptiveCodexTimeoutMsForTest, classifyItemWebhook, classifyIssueCommentWebhook, classifyWebhook, renderFastAckComment, verifyGitHubSignature } from "../dist/repair/comment-webhook.js";
import { REPOSITORY_PROFILES } from "../dist/repository-profiles.js";

test("comment webhook accepts maintainer ClawSweeper commands", () => {
  const result = classifyIssueCommentWebhook({
    event: "issue_comment",
    payload: {
      action: "created",
      repository: { full_name: "openclaw/openclaw", default_branch: "trunk" },
      issue: { number: 71898 },
      installation: { id: 123 },
      comment: {
        id: 456,
        body: "@clawsweeper automerge",
        author_association: "MEMBER",
      },
    },
  });

  assert.deepEqual(result, {
    accepted: true,
    type: "issue_comment",
    targetRepo: "openclaw/openclaw",
    targetBranch: "trunk",
    itemNumber: 71898,
    itemKind: "issue",
    itemState: "",
    commentId: 456,
    installationId: 123,
    sourceAction: "created",
    commentBody: "@clawsweeper automerge",
    commentAuthor: "",
    commentUrl: "",
    maintainerAuthorized: true,
  });
});

test("comment webhook ignores ClawSweeper proof-nudge comments", () => {
  const result = classifyIssueCommentWebhook({
    event: "issue_comment",
    payload: {
      action: "created",
      repository: { full_name: "openclaw/openclaw", default_branch: "main" },
      issue: { number: 86422 },
      installation: { id: 123 },
      comment: {
        id: 456,
        body: [
          "@contributor thanks for the PR. ClawSweeper is still waiting on real behavior proof.",
          "",
          "Once proof is added, @clawsweeper re-review can check it.",
          "",
          '<!-- clawsweeper-proof-nudge item="86422" sha="abc123" at="2026-06-02T00:00:00.000Z" v="1" -->',
        ].join("\n"),
        author_association: "MEMBER",
        user: { login: "clawsweeper[bot]" },
      },
    },
  });

  assert.deepEqual(result, { accepted: false, reason: "proof nudge comment" });
});

test("comment webhook rejects inline ClawSweeper mentions before visible ack", () => {
  const result = classifyIssueCommentWebhook({
    event: "issue_comment",
    payload: {
      action: "created",
      repository: { full_name: "openclaw/openclaw", default_branch: "main" },
      issue: { number: 87801 },
      installation: { id: 123 },
      comment: {
        id: 456,
        body: "the closed PR 87835 was closed as already implemented by PR 87890 @clawsweeper re-review and if necessary close this issue",
        author_association: "MEMBER",
      },
    },
  });

  assert.deepEqual(result, { accepted: false, reason: "no routable ClawSweeper command" });
});

test("comment webhook accepts ClawSweeper mention commands on their own line", () => {
  const result = classifyIssueCommentWebhook({
    event: "issue_comment",
    payload: {
      action: "created",
      repository: { full_name: "openclaw/openclaw", default_branch: "main" },
      issue: { number: 87801 },
      installation: { id: 123 },
      comment: {
        id: 456,
        body: "The issue may already be fixed.\n@clawsweeper re-review based on the latest comments\nThanks.",
        author_association: "MEMBER",
      },
    },
  });

  assert.equal(result.accepted, true);
});

test("comment webhook rejects contributor commands before visible ack", () => {
  const result = classifyIssueCommentWebhook({
    event: "issue_comment",
    payload: {
      action: "created",
      repository: { full_name: "openclaw/openclaw" },
      issue: { number: 71898 },
      installation: { id: 123 },
      comment: {
        id: 456,
        body: "@clawsweeper automerge",
        author_association: "CONTRIBUTOR",
      },
    },
  });

  assert.equal(result.accepted, false);
  assert.match(result.reason, /not allowed/);
});

test("comment webhook accepts author read-only re-review commands", () => {
  const result = classifyIssueCommentWebhook({
    event: "issue_comment",
    payload: {
      action: "created",
      repository: { full_name: "openclaw/openclaw" },
      issue: { number: 76991, user: { login: "nickmopen" } },
      installation: { id: 123 },
      comment: {
        id: 456,
        body: "@clawsweeper Re-run",
        author_association: "CONTRIBUTOR",
        user: { login: "NickMOpen" },
      },
    },
  });

  assert.deepEqual(result, {
    accepted: true,
    type: "issue_comment",
    targetRepo: "openclaw/openclaw",
    targetBranch: "main",
    itemNumber: 76991,
    itemKind: "issue",
    itemState: "",
    commentId: 456,
    installationId: 123,
    sourceAction: "created",
    commentBody: "@clawsweeper Re-run",
    commentAuthor: "NickMOpen",
    commentUrl: "",
    maintainerAuthorized: false,
  });
});

test("comment webhook rejects stale re-review commands on closed PRs before fast ack", () => {
  const result = classifyIssueCommentWebhook({
    event: "issue_comment",
    payload: {
      action: "edited",
      repository: { full_name: "openclaw/openclaw" },
      issue: {
        number: 76991,
        state: "closed",
        closed_at: "2026-05-19T05:02:03Z",
        pull_request: {},
      },
      installation: { id: 123 },
      comment: {
        id: 456,
        body: "@clawsweeper re-review",
        created_at: "2026-05-18T19:30:48Z",
        updated_at: "2026-05-23T18:14:04Z",
        author_association: "MEMBER",
        user: { login: "user" },
      },
    },
  });

  assert.deepEqual(result, {
    accepted: false,
    reason: "PR closed after this re_review command",
  });
});

test("comment webhook still accepts post-close re-review commands for router response", () => {
  const result = classifyIssueCommentWebhook({
    event: "issue_comment",
    payload: {
      action: "created",
      repository: { full_name: "openclaw/openclaw" },
      issue: {
        number: 76991,
        state: "closed",
        closed_at: "2026-05-19T05:02:03Z",
        pull_request: {},
      },
      installation: { id: 123 },
      comment: {
        id: 456,
        body: "@clawsweeper re-review",
        created_at: "2026-05-19T05:03:00Z",
        updated_at: "2026-05-19T05:03:00Z",
        author_association: "MEMBER",
        user: { login: "user" },
      },
    },
  });

  assert.deepEqual(result, {
    accepted: true,
    type: "issue_comment",
    targetRepo: "openclaw/openclaw",
    targetBranch: "main",
    itemNumber: 76991,
    itemKind: "pull_request",
    itemState: "closed",
    commentId: 456,
    installationId: 123,
    sourceAction: "created",
    commentBody: "@clawsweeper re-review",
    commentAuthor: "user",
    commentUrl: "",
    maintainerAuthorized: true,
    commentUpdatedAt: "2026-05-19T05:03:00Z",
    commentBodySha256: crypto.createHash("sha256").update("@clawsweeper re-review").digest("hex"),
  });
});

test("comment webhook rejects malformed and unconfigured repository commands before probing", () => {
  for (const targetRepo of ["not-a-repo", "other-owner/public-repo"]) {
    const result = classifyIssueCommentWebhook({
      event: "issue_comment",
      payload: {
        action: "created",
        repository: {
          full_name: targetRepo,
          private: false,
          archived: false,
          fork: false,
          has_issues: true,
        },
        issue: { number: 1 },
        installation: { id: 123 },
        comment: { id: 456, body: "/clawsweeper status", author_association: "MEMBER" },
      },
    });

    assert.deepEqual(result, { accepted: false, reason: "repository not eligible" }, targetRepo);
  }
});

test("comment webhook accepts an explicitly configured external-owner repository", () => {
  const profile = {
    ...REPOSITORY_PROFILES[0]!,
    targetRepo: "partner/configured-repo",
    slug: "partner-configured-repo",
    displayName: "Configured partner",
    checkoutDir: "configured-repo",
    promptNote: "Use the configured partner repository policy.",
  };
  REPOSITORY_PROFILES.push(profile);
  try {
    const result = classifyIssueCommentWebhook({
      event: "issue_comment",
      payload: {
        action: "created",
        repository: {
          full_name: "partner/configured-repo",
          default_branch: "main",
          private: false,
          archived: false,
          fork: false,
          has_issues: true,
        },
        issue: { number: 7, state: "open" },
        installation: { id: 123 },
        comment: {
          id: 456,
          body: "@clawsweeper re-review",
          author_association: "MEMBER",
        },
      },
    });

    assert.equal(result.accepted, true);
    assert.equal("targetRepo" in result ? result.targetRepo : "", "partner/configured-repo");
  } finally {
    REPOSITORY_PROFILES.splice(REPOSITORY_PROFILES.indexOf(profile), 1);
  }
});

test("comment webhook rejects non-author read-only re-review commands", () => {
  const result = classifyIssueCommentWebhook({
    event: "issue_comment",
    payload: {
      action: "created",
      repository: { full_name: "openclaw/openclaw" },
      issue: { number: 76991, user: { login: "nickmopen" } },
      installation: { id: 123 },
      comment: {
        id: 456,
        body: "@clawsweeper re-run",
        author_association: "CONTRIBUTOR",
        user: { login: "somebody-else" },
      },
    },
  });

  assert.equal(result.accepted, false);
  assert.match(result.reason, /not allowed/);
});

test("webhook accepts eligible issue events for public OpenClaw repositories", () => {
  const result = classifyItemWebhook({
    event: "issues",
    payload: {
      action: "opened",
      repository: {
        full_name: "openclaw/fs-safe",
        private: false,
        archived: false,
        fork: false,
        has_issues: true,
      },
      issue: { number: 597, updated_at: "2026-07-26T08:45:00Z" },
      installation: { id: 123 },
    },
  });

  assert.deepEqual(result, {
    accepted: true,
    type: "item",
    targetRepo: "openclaw/fs-safe",
    targetBranch: "main",
    itemNumber: 597,
    itemKind: "issue",
    installationId: 123,
    sourceEvent: "issues",
    sourceAction: "opened",
    sourceUpdatedAt: "2026-07-26T08:45:00Z",
    supersedesInProgress: false,
  });
});

test("fallback issue events carry the hosted source revision material", () => {
  const title = "Keep issue retry identity aligned";
  const body = "The issue body is unchanged across routes.";
  const result = classifyItemWebhook({
    event: "issues",
    payload: {
      action: "edited",
      repository: {
        full_name: "openclaw/fs-safe",
        private: false,
        archived: false,
        fork: false,
        has_issues: true,
      },
      issue: {
        number: 598,
        title,
        body,
        locked: false,
        labels: [
          { name: "security" },
          { name: "bug" },
          { name: "clawsweeper:automerge" },
          { name: "status: 📣 needs proof" },
        ],
        updated_at: "2026-07-26T08:50:00Z",
      },
      installation: { id: 123 },
    },
  });

  assert.equal(result.accepted, true);
  if (!result.accepted || result.type !== "item") return;
  assert.equal(
    result.sourceContentRevision,
    crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          version: 2,
          title,
          body,
          locked: false,
          close_guard_labels: ["bug", "clawsweeper:automerge", "security"],
        }),
      )
      .digest("hex"),
  );
  assert.equal(result.sourceUpdatedAt, "2026-07-26T08:50:00Z");
});

test("webhook accepts eligible pull request events for configured steipete repositories", () => {
  const result = classifyWebhook({
    event: "pull_request",
    payload: {
      action: "synchronize",
      repository: {
        full_name: "steipete/camsnap",
        private: false,
        archived: false,
        fork: false,
        has_issues: true,
      },
      pull_request: { number: 42, head: { sha: "a".repeat(40) } },
      installation: { id: 456 },
    },
  });

  assert.deepEqual(result, {
    accepted: true,
    type: "item",
    targetRepo: "steipete/camsnap",
    targetBranch: "main",
    itemNumber: 42,
    itemKind: "pull_request",
    installationId: 456,
    sourceEvent: "pull_request",
    sourceAction: "synchronize",
    sourceHeadSha: "a".repeat(40),
    supersedesInProgress: true,
    codexTimeoutMs: 600_000,
    mediaProofTimeoutMs: 0,
  });
});

test("fallback PR lifecycle events carry the hosted source revision material", () => {
  const title = "Keep lifecycle identity aligned";
  const body = "Same content across a synchronize event.";
  const result = classifyWebhook({
    event: "pull_request",
    payload: {
      action: "synchronize",
      repository: {
        full_name: "openclaw/openclaw",
        private: false,
        archived: false,
        fork: false,
        has_issues: true,
      },
      pull_request: {
        number: 858,
        head: { sha: "a".repeat(40) },
        base: { sha: "b".repeat(40) },
        draft: false,
        title,
        body,
        locked: false,
        labels: [
          { name: "security" },
          { name: "bug" },
          { name: "clawsweeper:autofix" },
          { name: "rating: 🦪 silver shellfish" },
        ],
        updated_at: "2026-07-26T09:05:00Z",
      },
      installation: { id: 456 },
    },
  });

  assert.equal(result.accepted, true);
  if (!result.accepted || result.type !== "item") return;
  assert.equal(
    result.sourceContentRevision,
    crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          version: 2,
          title,
          body,
          locked: false,
          close_guard_labels: ["bug", "clawsweeper:autofix", "security"],
        }),
      )
      .digest("hex"),
  );
});

test("webhook carries the semantic tuple through edited pull request fallback intake", () => {
  const title = "Clarify the review request";
  const body = "The revised context is ready for review.";
  const result = classifyWebhook({
    event: "pull_request",
    payload: {
      action: "edited",
      repository: {
        full_name: "openclaw/openclaw",
        private: false,
        archived: false,
        fork: false,
        has_issues: true,
      },
      pull_request: {
        number: 857,
        head: { sha: "a".repeat(40) },
        base: { sha: "b".repeat(40) },
        draft: false,
        title,
        body,
        locked: false,
        labels: [],
        updated_at: "2026-07-26T09:00:00Z",
      },
      installation: { id: 456 },
    },
  });

  assert.equal(result.accepted, true);
  if (!result.accepted || result.type !== "item") return;
  assert.equal(result.sourceBaseSha, "b".repeat(40));
  assert.equal(result.sourceIsDraft, false);
  assert.equal(result.sourceUpdatedAt, "2026-07-26T09:00:00Z");
  assert.equal(
    result.sourceContentRevision,
    crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          version: 2,
          title,
          body,
          locked: false,
          close_guard_labels: [],
        }),
      )
      .digest("hex"),
  );
});

test("adaptive Codex timeout preserves the default for small non-media PRs", () => {
  assert.equal(
    adaptiveCodexTimeoutMsForTest({
      changed_files: 4,
      additions: 120,
      deletions: 30,
      body: "Small cleanup without proof assets.",
    }),
    600_000,
  );
});

test("adaptive Codex timeout scales for large PRs", () => {
  assert.equal(
    adaptiveCodexTimeoutMsForTest({
      changed_files: 71,
      additions: 4176,
      deletions: 0,
      body: [
        "Proof:",
        "https://uploads.example.invalid/proof-a.mov",
        "https://uploads.example.invalid/proof-b.mp4.",
      ].join("\n"),
    }),
    1_268_800,
  );
});

test("adaptive Codex timeout stays capped separately from media preprocessing", () => {
  assert.equal(
    adaptiveCodexTimeoutMsForTest({
      changed_files: 1000,
      additions: 50_000,
      deletions: 10_000,
      body: [
        "https://uploads.example.invalid/one.mov",
        "https://uploads.example.invalid/two.mp4",
        "https://uploads.example.invalid/three.webm",
        "https://uploads.example.invalid/four.mkv",
        "https://uploads.example.invalid/five.avi",
      ].join("\n"),
    }),
    1_500_000,
  );
});

test("webhook preserves valid repository default branch for item dispatch", () => {
  const result = classifyItemWebhook({
    event: "issues",
    payload: {
      action: "opened",
      repository: {
        full_name: "openclaw/fs-safe",
        default_branch: "trunk",
        private: false,
        archived: false,
        fork: false,
        has_issues: true,
      },
      issue: { number: 597 },
      installation: { id: 123 },
    },
  });

  assert.equal(result.accepted, true);
  assert.equal(result.targetBranch, "trunk");
});

test("webhook falls back to main for invalid repository default branch", () => {
  const result = classifyItemWebhook({
    event: "issues",
    payload: {
      action: "opened",
      repository: {
        full_name: "openclaw/fs-safe",
        default_branch: "bad branch",
        private: false,
        archived: false,
        fork: false,
        has_issues: true,
      },
      issue: { number: 597 },
      installation: { id: 123 },
    },
  });

  assert.equal(result.accepted, true);
  assert.equal(result.targetBranch, "main");
});

test("webhook rejects private target repositories and accepts generic public repositories", () => {
  const privateResult = classifyItemWebhook({
    event: "issues",
    payload: {
      action: "opened",
      repository: {
        full_name: "steipete/private-tool",
        private: true,
        archived: false,
        fork: false,
        has_issues: true,
      },
      issue: { number: 1 },
      installation: { id: 456 },
    },
  });
  assert.deepEqual(privateResult, { accepted: false, reason: "repository not eligible" });

  const publicResult = classifyItemWebhook({
    event: "issues",
    payload: {
      action: "opened",
      repository: {
        full_name: "openclaw/example-tool",
        private: false,
        archived: false,
        fork: false,
        has_issues: true,
      },
      issue: { number: 1 },
      installation: { id: 456 },
    },
  });
  assert.equal(publicResult.accepted, true);
});

test("webhook requeues unlocked and close-guard removal events", () => {
  const closeGuardLabels = [
    "security",
    "beta-blocker",
    "release-blocker",
    "maintainer",
    "clawsweeper:human-review",
    "clawsweeper:manual-only",
    "clawsweeper:automerge",
    "clawsweeper:autofix",
  ];
  const cases = [
    { event: "issues", action: "unlocked" },
    { event: "pull_request", action: "unlocked" },
    ...closeGuardLabels.flatMap((name) => [
      { event: "issues", action: "unlabeled", label: { name } },
      { event: "pull_request", action: "unlabeled", label: { name } },
    ]),
  ];
  for (const [index, { event, action, label }] of cases.entries()) {
    const itemNumber = 76990 + index;
    const result = classifyItemWebhook({
      event,
      payload: {
        action,
        repository: {
          full_name: "openclaw/fs-safe",
          private: false,
          archived: false,
          fork: false,
          has_issues: true,
        },
        ...(event === "issues"
          ? { issue: { number: itemNumber } }
          : { pull_request: { number: itemNumber } }),
        ...(label ? { label } : {}),
        installation: { id: 123 },
      },
    });

    assert.equal(result.accepted, true);
    assert.equal(result.sourceAction, action);
    assert.equal(result.supersedesInProgress, true);
  }
});

test("webhook rejects label additions and unrelated removals from exact-review intake", () => {
  for (const [event, payload] of [
    [
      "pull_request",
      {
        action: "labeled",
        repository: {
          full_name: "openclaw/openclaw",
          private: false,
          archived: false,
          fork: false,
          has_issues: true,
        },
        pull_request: { number: 76992 },
        installation: { id: 123 },
        sender: { login: "openclaw-clawsweeper[bot]" },
      },
    ],
    [
      "issues",
      {
        action: "unlabeled",
        repository: {
          full_name: "openclaw/fs-safe",
          private: false,
          archived: false,
          fork: false,
          has_issues: true,
        },
        issue: { number: 597 },
        label: { name: "clawsweeper:queueable-fix" },
        installation: { id: 123 },
        sender: { login: "steipete" },
      },
    ],
  ] as const) {
    assert.deepEqual(classifyItemWebhook({ event, payload }), {
      accepted: false,
      reason: "unsupported action",
    });
  }
});

test("fast ack comment carries source comment marker", () => {
  const body = renderFastAckComment(456);

  assert.match(body, /clawsweeper-command-ack:456/);
  assert.match(body, /ClawSweeper picked this up/);
});

test("webhook signature verification uses sha256 body hmac", () => {
  const secret = "test-secret";
  const body = JSON.stringify({ ok: true });
  const signature = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;

  assert.doesNotThrow(() => verifyGitHubSignature({ secret, signature, body }));
  assert.throws(
    () => verifyGitHubSignature({ secret, signature: "sha256=bad", body }),
    /invalid GitHub webhook signature/,
  );
});

/**
 * The control for the band itself.
 *
 * This case runs outside withConfiguredInstallation, so the loader reads the real
 * shipped profile, which is unconfigured. The payload is the one the first case
 * accepts. If the band ever granted admission by replacing a decision rather than
 * a file read, this case would still pass while meaning nothing; it is here so
 * that the accepting cases above cannot be satisfied by a "grant everything"
 * regression.
 */
nodeTest("the same maintainer command is refused without a configured installation", () => {
  resetInstallationProfileCache();
  const result = classifyIssueCommentWebhook({
    event: "issue_comment",
    payload: {
      action: "created",
      repository: { full_name: "openclaw/openclaw", default_branch: "trunk" },
      issue: { number: 71898 },
      installation: { id: 123 },
      comment: {
        id: 456,
        body: "@clawsweeper automerge",
        author_association: "MEMBER",
      },
    },
  });
  assert.equal(result.accepted, false, "an unconfigured installation admits no repository");
  assert.equal(result.reason, "repository not eligible");
});

