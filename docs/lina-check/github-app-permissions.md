# GitHub App permission scope

What an installation operator would have to grant, derived from the GitHub calls
this source actually makes. No App was created or installed to produce this, and
nothing here is applied to this repository: `config/lina-check-installation.json`
ships with an empty `github_app` section and the Worker carries no client ID.

## How this was derived

Upstream's workflow files request a permission set, but that set belongs to the
upstream installation and was assembled for workflows this fork keeps parked.
Copying it would grant whatever upstream happened to need. So the direction is
reversed: collect the REST and GraphQL calls in `src/` and `dashboard/`, map each
endpoint to the permission GitHub requires for it, and keep only rows with a call
behind them.

## Scope by stage

Permissions are staged, because this fork is dormant. Granting the write set now
would hand an installation the ability to act before anything verifies what it
would act on.

### Stage 0 — as shipped

None. No App, no installation, no credentials. Every admission decision denies
because the installation profile is empty, and every GitHub request is refused
before it is built when there is no configuration and no credential.

### Stage 1 — reading

Enough to observe issues, pull requests and CI without changing anything.

| Permission | Level | Endpoints behind it |
| -- | -- | -- |
| Metadata | read | `/repos/{repo}`, `/repos/{repo}/installation` |
| Issues | read | `/repos/{repo}/issues`, `/issues/{n}`, `/issues/{n}/timeline`, `/search/issues` |
| Pull requests | read | `/repos/{repo}/pulls/{n}`, `/pulls/{n}/reviews` |
| Actions | read | `/actions/runs`, `/actions/workflows/{id}/runs`, `/actions/runs/{id}/jobs`, `/actions/artifacts/{id}/zip` |
| Checks | read | `/repos/{repo}/commits/{sha}/check-runs` |
| Commit statuses | read | `/repos/{repo}/commits/{sha}/status` |

### Stage 2 — writing to target repositories

Only once the write behaviour is verified. This is the set that lets the system
comment, label and close.

| Permission | Level | Endpoints behind it |
| -- | -- | -- |
| Issues | write | `/issues/{n}/comments`, `/issues/comments/{id}`, `/issues/comments/{id}/reactions`, `/issues/{n}/labels`, `/repos/{repo}/labels`, `/issues/{n}` PATCH |
| Pull requests | write | `/pulls/{n}` PATCH, `/pulls/{n}/merge` |

Issues write covers pull request comments and labels too: GitHub treats pull
requests as issues for those routes.

### Stage 3 — the control and state repositories

These are not target repositories and should be a separate installation scope.
Granting Contents write on every target so the control repository can receive a
dispatch would be far wider than the calls require.

| Permission | Level | Where | Endpoints behind it |
| -- | -- | -- | -- |
| Contents | write | control repository | `/repos/{repo}/dispatches` |
| Contents | write | state repository | `/repos/{stateRepo}/contents/{path}` |

## Webhook events

Events are not permissions, but an installation has to choose them, and the
classifier only accepts these.

`issue_comment`, `issues`, `pull_request`, `pull_request_review`,
`pull_request_review_comment`, `workflow_run`, `workflow_job`, `check_run`, `check_suite`.

## Requested upstream, no call found here

Upstream's parked workflows request permissions through
`create-github-app-token` steps. Those requests are the upstream installation's
choice and are listed here only so the difference is visible, not as a
recommendation. An operator granting this fork's set should work from the tables
above.

## What this does not establish

A permission table is not an authorization model. Holding a token is not the same
as being allowed to act: admission is decided separately by the installation
profile, and an empty profile denies every target regardless of what the App can
reach. Nor is this a runtime observation. Every row comes from reading source,
because no request was made and no App exists.
