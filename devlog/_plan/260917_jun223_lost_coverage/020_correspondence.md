# 020 · 레코드별 대응표

제외 열 파일의 테스트 레코드 144개를 하나씩 세어 처분을 붙였다. 최상위 141개에 `comment-webhook` 의 중첩 subtest 3개를 더한 수다. 엄밀한 leaf 로 세면 중첩을 가진 부모 하나가 leaf 가 아니므로 143개가 된다.

이 표와 `evidence/record_disposition.json` 은 `scripts/lina-check-coverage-map.mjs` 가 만든다. 원본 파일에서 케이스 이름을 읽고, 회복 파일에서 같은 이름이 실제로 실행되는지 대조해 회복을 정한다. 회복되지 않은 이름은 사유가 미리 적혀 있어야 하고, 없으면 생성이 실패한다. 반대로 사유가 적혀 있는데 이름이 회복돼 있어도 실패한다. `lina:contract-selftest` 가 같은 생성을 check 모드로 다시 돌려 커밋된 두 파일과 대조하므로, 어느 쪽 테스트가 바뀌든 표가 조용히 낡지 않는다.

## 집계

| 원본 파일 | 레코드 | 회복 | 부분 | 영구 손실 |
| -- | --: | --: | --: | --: |
| `test/actions-runtime.test.ts` | 3 | 3 | 0 | 0 |
| `test/clawsweeper-action-ledger.test.ts` | 26 | 19 | 0 | 7 |
| `test/dashboard-github-api.test.ts` | 3 | 3 | 0 | 0 |
| `test/exact-review-failure-telemetry.test.ts` | 12 | 12 | 0 | 0 |
| `test/github-response-deadlines.test.ts` | 8 | 8 | 0 | 0 |
| `test/hosted-target-admission.test.ts` | 7 | 6 | 0 | 1 |
| `test/repair/comment-webhook.test.ts` | 38 | 26 | 8 | 4 |
| `test/review-close-policy.test.ts` | 33 | 33 | 0 | 0 |
| `test/run-node-tests.test.ts` | 7 | 6 | 1 | 0 |
| `test/scheduled-review-noop.test.ts` | 7 | 6 | 0 | 1 |
| **합계** | **144** | **122** | **9** | **13** |

중복 케이스 ID 0건, 고유 ID 144개.

## 레코드

### `test/actions-runtime.test.ts`

| # | 케이스 | 처분 | 대응 검사 / 사유 |
| --: | -- | -- | -- |
| 1 | GitHub App token creation uses the approved immutable action pin everywhere | 회복 | `test/lina-check-actions-runtime.test.ts` |
| 2 | GitHub App token owner inputs do not consume the multi-owner repair policy | 회복 | `test/lina-check-actions-runtime.test.ts` |
| 3 | cache actions use one runtime generation everywhere | 회복 | `test/lina-check-actions-runtime.test.ts` |

### `test/clawsweeper-action-ledger.test.ts`

| # | 케이스 | 처분 | 대응 검사 / 사유 |
| --: | -- | -- | -- |
| 1 | primary command success survives best-effort action ledger flush failure | 영구 손실 | Calls main(["check"]), which resolves the repository root from the module location and requires .github/workflows/sweep.yml. Every workflow here is parked, so the command ends at "Missing workflow" before the assertion. |
| 2 | primary command failure is not masked by action ledger flush failure | 영구 손실 | Calls main(["check"]), which resolves the repository root from the module location and requires .github/workflows/sweep.yml. Every workflow here is parked, so the command ends at "Missing workflow" before the assertion. |
| 3 | explicit action ledger finalization keeps flush failure strict | 영구 손실 | Calls main(["check"]), which resolves the repository root from the module location and requires .github/workflows/sweep.yml. Every workflow here is parked, so the command ends at "Missing workflow" before the assertion. |
| 4 | action event import rejects an invalid expected producer run ID | 영구 손실 | Calls main(["check"]), which resolves the repository root from the module location and requires .github/workflows/sweep.yml. Every workflow here is parked, so the command ends at "Missing workflow" before the assertion. |
| 5 | action event import rejects an invalid maximum producer run attempt | 영구 손실 | Calls main(["check"]), which resolves the repository root from the module location and requires .github/workflows/sweep.yml. Every workflow here is parked, so the command ends at "Missing workflow" before the assertion. |
| 6 | action event import keeps exact and maximum producer attempts mutually exclusive | 영구 손실 | Calls main(["check"]), which resolves the repository root from the module location and requires .github/workflows/sweep.yml. Every workflow here is parked, so the command ends at "Missing workflow" before the assertion. |
| 7 | action event import rejects an invalid expected producer SHA | 영구 손실 | Calls main(["check"]), which resolves the repository root from the module location and requires .github/workflows/sweep.yml. Every workflow here is parked, so the command ends at "Missing workflow" before the assertion. |
| 8 | review and apply outcome classifiers cover terminal and resumable states | 회복 | `test/lina-check-action-ledger.test.ts` |
| 9 | failed-review retry events distinguish dispatch, exhaustion, and backpressure | 회복 | `test/lina-check-action-ledger.test.ts` |
| 10 | action event publication accepts only sorted canonical event and binding paths | 회복 | `test/lina-check-action-ledger.test.ts` |
| 11 | apply and retry business idempotency ignore batch order but bind source revision | 회복 | `test/lina-check-action-ledger.test.ts` |
| 12 | lane instrumentation uses stable slots with explicit parent and phase ordering | 회복 | `test/lina-check-action-ledger.test.ts` |
| 13 | review candidates start lazily and deferred items cannot remain active | 회복 | `test/lina-check-action-ledger.test.ts` |
| 14 | apply receipts start per item and persist mutation observation before finalization | 회복 | `test/lina-check-action-ledger.test.ts` |
| 15 | apply mutation receipts bind every GitHub request attempt and preserve no-op truth | 회복 | `test/lina-check-action-ledger.test.ts` |
| 16 | GitHub throttles abort apply lease checks and preserve durable lease ownership | 회복 | `test/lina-check-action-ledger.test.ts` |
| 17 | runtime yields bind the active item and terminal Codex failures preserve retryability | 회복 | `test/lina-check-action-ledger.test.ts` |
| 18 | blocked exact close publication discards staged labels before writing the report | 회복 | `test/lina-check-action-ledger.test.ts` |
| 19 | retry dispatch outcomes distinguish definite rejection, ambiguity, and acceptance | 회복 | `test/lina-check-action-ledger.test.ts` |
| 20 | untrusted Codex processes cannot inherit action-ledger producer authority | 회복 | `test/lina-check-action-ledger.test.ts` |
| 21 | apply failure finalization survives report publication errors | 회복 | `test/lina-check-action-ledger.test.ts` |
| 22 | apply report publication uses digest evidence without a durable record path | 회복 | `test/lina-check-action-ledger.test.ts` |
| 23 | retry and review publication lanes finalize unexpected failures | 회복 | `test/lina-check-action-ledger.test.ts` |
| 24 | sweep publishes complete immutable shards for every review and apply producer | 회복 | `test/lina-check-action-ledger.test.ts` |
| 25 | comment router publishes immutable command receipts for initial and retry invocations | 회복 | `test/lina-check-action-ledger.test.ts` |
| 26 | the ledger distinguishes a blocked fallback from ordinary kept-open comment work | 회복 | `test/lina-check-action-ledger.test.ts` |

### `test/dashboard-github-api.test.ts`

| # | 케이스 | 처분 | 대응 검사 / 사유 |
| --: | -- | -- | -- |
| 1 | GitHub API URL uses the production origin by default | 회복 | `test/lina-check-github-api.test.ts` |
| 2 | GitHub API URL honors a validated loopback override | 회복 | `test/lina-check-github-api.test.ts` |
| 3 | GitHub API URL rejects non-default remote or non-origin overrides | 회복 | `test/lina-check-github-api.test.ts` |

### `test/exact-review-failure-telemetry.test.ts`

| # | 케이스 | 처분 | 대응 검사 / 사유 |
| --: | -- | -- | -- |
| 1 | review failure telemetry validates only closed sanitized classifications | 회복 | `test/lina-check-failure-telemetry.test.ts` |
| 2 | review failure telemetry validates terminal status receipts | 회복 | `test/lina-check-failure-telemetry.test.ts` |
| 3 | terminal status receipts accept explicit null nullable fields | 회복 | `test/lina-check-failure-telemetry.test.ts` |
| 4 | terminal status delivery failures alert without changing attempt identity | 회복 | `test/lina-check-failure-telemetry.test.ts` |
| 5 | unavailable terminal status does not raise a delivery failure incident | 회복 | `test/lina-check-failure-telemetry.test.ts` |
| 6 | review failure fingerprints are synchronous, stable, and source-sensitive | 회복 | `test/lina-check-failure-telemetry.test.ts` |
| 7 | review failure source fingerprints distinguish PR base revisions | 회복 | `test/lina-check-failure-telemetry.test.ts` |
| 8 | review failure telemetry deduplicates attempts and detects repeated source failures | 회복 | `test/lina-check-failure-telemetry.test.ts` |
| 9 | review failure telemetry does not join failures across source revisions | 회복 | `test/lina-check-failure-telemetry.test.ts` |
| 10 | review failure telemetry repairs schema readiness after an outer rollback | 회복 | `test/lina-check-failure-telemetry.test.ts` |
| 11 | review failure telemetry enforces retention without stats polling | 회복 | `test/lina-check-failure-telemetry.test.ts` |
| 12 | review failure telemetry persists and expires dropped-attempt health | 회복 | `test/lina-check-failure-telemetry.test.ts` |

### `test/github-response-deadlines.test.ts`

| # | 케이스 | 처분 | 대응 검사 / 사유 |
| --: | -- | -- | -- |
| 1 | queue bounds a stalled 200 body and preserves its error class | 회복 | `test/lina-check-response-deadlines.test.ts` |
| 2 | queue bounds a stalled 503 body and preserves its error class | 회복 | `test/lina-check-response-deadlines.test.ts` |
| 3 | queue bounds a stalled 429 body and preserves its error class | 회복 | `test/lina-check-response-deadlines.test.ts` |
| 4 | app bounds a stalled 200 body and preserves its error class | 회복 | `test/lina-check-response-deadlines.test.ts` |
| 5 | app bounds a stalled 503 body and preserves its error class | 회복 | `test/lina-check-response-deadlines.test.ts` |
| 6 | app bounds a stalled 429 body and preserves its error class | 회복 | `test/lina-check-response-deadlines.test.ts` |
| 7 | queue preserves JSON parse failures after a successful body read | 회복 | `test/lina-check-response-deadlines.test.ts` |
| 8 | app preserves JSON parse failures after a successful body read | 회복 | `test/lina-check-response-deadlines.test.ts` |

### `test/hosted-target-admission.test.ts`

| # | 케이스 | 처분 | 대응 검사 / 사유 |
| --: | -- | -- | -- |
| 1 | hosted target eligibility is configured profiles plus owner fallbacks | 회복 | `test/lina-check-hosted-admission.test.ts` |
| 2 | hosted target eligibility reads configured profiles and fallback deny policy together | 회복 | `test/lina-check-hosted-admission.test.ts` |
| 3 | hosted target registry lookup stays inside queue caller deadlines | 회복 | `test/lina-check-hosted-admission.test.ts` |
| 4 | hosted target metadata classification is authenticated, fresh, and fail-closed | 회복 | `test/lina-check-hosted-admission.test.ts` |
| 5 | hosted target metadata retry hints honor bounded GitHub quota headers | 회복 | `test/lina-check-hosted-admission.test.ts` |
| 6 | hosted admission heredocs execute as ESM without network access | 영구 손실 | Extracts two heredoc scripts from the workflow and runs each as a separate process. A derived test starts nothing. |
| 7 | scheduled, manual, target-sweep, and comment workflows admit targets before privileged jobs | 회복 | `test/lina-check-hosted-admission.test.ts` |

### `test/repair/comment-webhook.test.ts`

| # | 케이스 | 처분 | 대응 검사 / 사유 |
| --: | -- | -- | -- |
| 1 | comment webhook accepts maintainer ClawSweeper commands | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 2 | comment webhook ignores ClawSweeper proof-nudge comments | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 3 | comment webhook ignores command-bearing assist and visual publications before ack or dispatch | 부분 | `test/lina-check-webhook-admission.test.ts` (일부) handleGitHubWebhook with durable intake. The command classification it turns on is restored by the accepted and ignored classifier cases; the intake and ack sequencing is not. |
| 4 | standalone webhook terminal admission blocks delayed private and missing targets | 부분 | `test/lina-check-webhook-admission.test.ts` (일부) Standalone HTTP handler plus target probing. The admission verdicts are restored through the classifier and the hosted metadata probe; the HTTP path and the delayed-probe ordering are not. |
| 5 | standalone webhook retryable admission defers without intake or target effects | 부분 | `test/lina-check-webhook-admission.test.ts` (일부) Same handler. The retryable classification is restored in the hosted metadata probe cases; the deferral's effect on intake is not. |
| 6 | standalone webhook admits public targets before durable command intake | 부분 | `test/lina-check-webhook-admission.test.ts` (일부) Same handler. Admission is restored as a decision; its ordering against durable intake is not. |
| 7 | comment webhook rejects inline ClawSweeper mentions before visible ack | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 8 | comment webhook accepts ClawSweeper mention commands on their own line | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 9 | comment webhook rejects contributor commands before visible ack | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 10 | comment webhook accepts author read-only re-review commands | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 11 | comment webhook rejects stale re-review commands on closed PRs before fast ack | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 12 | comment webhook still accepts post-close re-review commands for router response | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 13 | comment webhook rejects malformed and unconfigured repository commands before probing | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 14 | comment webhook accepts an explicitly configured external-owner repository | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 15 | comment webhook rejects non-author read-only re-review commands | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 16 | webhook accepts eligible issue events for public OpenClaw repositories | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 17 | fallback issue events carry the hosted source revision material | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 18 | webhook accepts eligible pull request events for configured steipete repositories | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 19 | fallback PR lifecycle events carry the hosted source revision material | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 20 | webhook carries the semantic tuple through edited pull request fallback intake | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 21 | adaptive Codex timeout preserves the default for small non-media PRs | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 22 | adaptive Codex timeout scales for large PRs | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 23 | adaptive Codex timeout stays capped separately from media preprocessing | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 24 | pull request webhooks dispatch adaptive Codex timeout payload | 부분 | `test/lina-check-webhook-admission.test.ts` (일부) The timeout values are restored by the three adaptive-timeout cases; carrying them through a dispatched payload is not. |
| 25 | webhook preserves valid repository default branch for item dispatch | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 26 | webhook falls back to main for invalid repository default branch | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 27 | webhook rejects private target repositories and accepts generic public repositories | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 28 | webhook requeues unlocked and close-guard removal events | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 29 | webhook rejects label additions and unrelated removals from exact-review intake | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 30 | fast ack comment carries source comment marker | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 31 | concurrent duplicate command webhooks converge on one fast ack comment | 부분 | `test/lina-check-webhook-admission.test.ts` (일부) Needs concurrent handler invocations against a durable store. The ack marker itself is restored by the fast-ack rendering case. |
| 32 | comment webhook settles duplicate fast ack comments after dispatch | 부분 | `test/lina-check-webhook-admission.test.ts` (일부) Settlement is a property of repeated handler runs against a store, not of a classification. |
| 33 | webhook signature verification uses sha256 body hmac | 회복 | `test/lina-check-webhook-admission.test.ts` |
| 34 | webhook GitHub requests have a deadline through the response body | 부분 | `test/lina-check-webhook-admission.test.ts` (일부) The body deadline is restored against both read paths in the recovered deadline suite; driving it through the webhook needs a loopback server. |
| 35 | standalone HTTP webhook preserves intake failure classification | 영구 손실 | Reaches test/helpers/command-intake-fixture.mjs, which starts a process from inside the helper. Out of bounds for a derived test. |
| 36 | webhook GitHub requests have a deadline through the response body > success *(중첩)* | 영구 손실 | Subtest of the loopback-server case; it exists only inside that server run. |
| 37 | webhook GitHub requests have a deadline through the response body > headers *(중첩)* | 영구 손실 | Subtest of the loopback-server case; it exists only inside that server run. |
| 38 | webhook GitHub requests have a deadline through the response body > body *(중첩)* | 영구 손실 | Subtest of the loopback-server case; it exists only inside that server run. |

### `test/review-close-policy.test.ts`

| # | 케이스 | 처분 | 대응 검사 / 사유 |
| --: | -- | -- | -- |
| 1 | review prompt documents gated backlog close policies | 회복 | `test/lina-check-close-policy.test.ts` |
| 2 | review prompt closes independently disproven nonexistent-source bug reports | 회복 | `test/lina-check-close-policy.test.ts` |
| 3 | external desktop-product bugs close without inventing upstream maintainer work | 회복 | `test/lina-check-close-policy.test.ts` |
| 4 | close-first triage keeps actionable upstream work and invites better reports | 회복 | `test/lina-check-close-policy.test.ts` |
| 5 | all exact-review publication paths inherit the shared automatic-close policy | 회복 | `test/lina-check-close-policy.test.ts` |
| 6 | unsponsored feature issue proposals emit source-bound trusted close markers | 회복 | `test/lina-check-close-policy.test.ts` |
| 7 | protected labels are normalized and only maintainer-only items stay plannable | 회복 | `test/lina-check-close-policy.test.ts` |
| 8 | parseGhJson adds gh command context to malformed JSON errors | 회복 | `test/lina-check-close-policy.test.ts` |
| 9 | parseGhJsonLines adds line number and command context to malformed JSONL errors | 회복 | `test/lina-check-close-policy.test.ts` |
| 10 | parseGhJsonWithRetry reloads malformed successful responses | 회복 | `test/lina-check-close-policy.test.ts` |
| 11 | commit review parses co-authored-by trailers | 회복 | `test/lina-check-close-policy.test.ts` |
| 12 | protected labels block close proposals even for otherwise valid decisions | 회복 | `test/lina-check-close-policy.test.ts` |
| 13 | PR close-exemption labels produce a distinct guarded-open action | 회복 | `test/lina-check-close-policy.test.ts` |
| 14 | verified fixed maintainer items can become close proposals | 회복 | `test/lina-check-close-policy.test.ts` |
| 15 | maintainer items stay protected for non-fixed close reasons | 회복 | `test/lina-check-close-policy.test.ts` |
| 16 | review actions only propose valid closes and never apply directly | 회복 | `test/lina-check-close-policy.test.ts` |
| 17 | review actions render deterministic close comments when model close comment is empty | 회복 | `test/lina-check-close-policy.test.ts` |
| 18 | close comments reference high-confidence merged fixing PRs | 회복 | `test/lina-check-close-policy.test.ts` |
| 19 | implemented-on-main closure fails closed without a GitHub-verified fixing PR | 회복 | `test/lina-check-close-policy.test.ts` |
| 20 | PR implementation provenance accepts only explicit same-repository closing issues | 회복 | `test/lina-check-close-policy.test.ts` |
| 21 | PR implementation provenance caps linked issue references | 회복 | `test/lina-check-close-policy.test.ts` |
| 22 | PR implementation provenance accepts only the current GitHub issue-closing PR | 회복 | `test/lina-check-close-policy.test.ts` |
| 23 | commit PR lookup selects the newest merged pull request | 회복 | `test/lina-check-close-policy.test.ts` |
| 24 | commit PR lookup rejects unrelated closing references at the claimed fixed SHA | 회복 | `test/lina-check-close-policy.test.ts` |
| 25 | commit PR lookup accepts an exact closing reference in the fixed commit message | 회복 | `test/lina-check-close-policy.test.ts` |
| 26 | commit PR lookup rejects closing references on a non-default branch | 회복 | `test/lina-check-close-policy.test.ts` |
| 27 | report-rendered close comments keep merged fixing PR provenance | 회복 | `test/lina-check-close-policy.test.ts` |
| 28 | close comments suppress duplicate best solution text | 회복 | `test/lina-check-close-policy.test.ts` |
| 29 | review details show applied AGENTS.md policy status | 회복 | `test/lina-check-close-policy.test.ts` |
| 30 | review details show missing AGENTS.md policy status | 회복 | `test/lina-check-close-policy.test.ts` |
| 31 | skill-only OpenClaw PRs can close through ClawHub with upload guidance | 회복 | `test/lina-check-close-policy.test.ts` |
| 32 | ClawHub policy requires verified fixing provenance before main-implemented PR closure | 회복 | `test/lina-check-close-policy.test.ts` |
| 33 | ClawSweeper policy requires verified fixing provenance before self PR closure | 회복 | `test/lina-check-close-policy.test.ts` |

### `test/run-node-tests.test.ts`

| # | 케이스 | 처분 | 대응 검사 / 사유 |
| --: | -- | -- | -- |
| 1 | test runner caps adaptive concurrency at sixteen | 회복 | `test/lina-check-node-test-runner.test.ts` |
| 2 | test runner environment override is validated and CLI choice takes precedence | 회복 | `test/lina-check-node-test-runner.test.ts` |
| 3 | test runner expands named targets with sorted de-duplicated files | 회복 | `test/lina-check-node-test-runner.test.ts` |
| 4 | test runner parses CLI concurrency overrides and forwarded Node options | 회복 | `test/lina-check-node-test-runner.test.ts` |
| 5 | composed no-build scripts preserve standalone build contracts | 부분 | `test/lina-check-node-test-runner.test.ts` (일부) Cannot hold as written: this fork replaced every composed test command with the scaffold guard. Replaced by the guards-not-builds case, which asserts the changed contract instead. |
| 6 | test runner fails clearly when a target has no files | 회복 | `test/lina-check-node-test-runner.test.ts` |
| 7 | test runner preserves child arguments, exit codes, and terminating signals | 회복 | `test/lina-check-node-test-runner.test.ts` |

### `test/scheduled-review-noop.test.ts`

| # | 케이스 | 처분 | 대응 검사 / 사유 |
| --: | -- | -- | -- |
| 1 | claim-time classifier accepts trusted owned activity through timestamp settling | 회복 | `test/lina-check-scheduled-review.test.ts` |
| 2 | claim-time semantic identity matches the review runtime | 회복 | `test/lina-check-scheduled-review.test.ts` |
| 3 | claim-time classifier preserves human and mixed source changes | 회복 | `test/lina-check-scheduled-review.test.ts` |
| 4 | claim-time classifier preserves protected and human-owned label changes | 회복 | `test/lina-check-scheduled-review.test.ts` |
| 5 | claim-time classifier is conservative for source drift and missing receipts | 회복 | `test/lina-check-scheduled-review.test.ts` |
| 6 | claim-time classifier requires an exact durable pull request head | 회복 | `test/lina-check-scheduled-review.test.ts` |
| 7 | live admission skips inapplicable no-op reads while preserving hot and terminal paths | 영구 손실 | runReadScopeProof() runs a real shell against the parked workflow. Out of bounds for a derived test. |

## 이 표가 주장하지 않는 것

회복은 같은 이름의 케이스가 파생 테스트에서 실제로 실행되고 통과한다는 뜻이다. 원본과 한 글자까지 같은 단언을 한다는 뜻은 아니다. 설치 프로필이 필요한 자리에는 프로필을 만들어 넣었고, 파킹된 워크플로를 읽는 자리에는 `.yml.disabled` 을 읽게 했다. 바꾼 자리는 각 파생 파일 머리말에 적혀 있다.

부분은 원래 케이스가 검사하던 판단의 알맹이는 다른 회복 케이스가 덮지만, 그 케이스가 함께 검사하던 전송·순서·중복 수렴 같은 성질은 덮지 못한다는 뜻이다. 덮은 쪽과 못 덮은 쪽을 행마다 적었다.

영구 손실은 이 경계 안에서 되살릴 방법이 없다는 뜻이다. 열세 건 중 일곱은 파킹된 워크플로를 요구하는 명령 진입점이고, 나머지는 자식 프로세스나 실제 셸을 띄우는 자리다. 워크플로를 되살리거나 파생 테스트가 프로세스를 띄우게 허용하면 열리지만, 둘 다 이 작업의 범위 밖이다.
