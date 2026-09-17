# 010 · 후보 처분 기록

## 후보를 어떻게 골랐나

선행 조사가 머지된 main `67119afa` 에서 `test/**/*.test.ts` 전량을 훑어, spawn·네트워크
토큰이 본문에 없고 아직 선언되지 않은 파일 201개를 후보로 잡고 각각 `node --test` 로
한 번씩 돌렸다. 영수증은 저장소 밖에 있다.

`/home/jun/code-archives/lina-check/20260917-crw-project-run/receipts/260917_1656_safe_test_candidate_inventory.json`

그 결과는 exit 0 이 171개, exit 1 이 29개, 60초 안에 끝나지 않은 것이 1개였다.
본문 토큰 검사는 실행 경계를 증명하지 않는다. 헬퍼를 거쳐 로컬 프로세스를 띄우는 테스트도
있고 loopback 서버를 여는 테스트도 있다. 편입한 파일의 실행 경계는 토큰이 아니라 관측으로
정했다. 방법과 목록은 `020_fixture_lane.md` 에 있다.

## 처분 요약

| 처분 | 개수 | 근거 |
| -- | -- | -- |
| 저장소 root 에서 그대로 편입 | 171 | 레인 한 번의 실행에서 전량 통과 |
| pin 픽스처 작업 디렉터리에서 편입 | 22 | 파킹된 워크플로를 cwd 기준으로 읽던 파일 |
| 사유를 적어 제외 | 8 | 아래 표 |
| 합계 | 201 | |

선언된 안전 테스트는 13개에서 206개가 되고, 제외 선언은 2개에서 10개가 된다.

## root 편입 171개

개별 실행 통과가 아니라 레인 실행이 근거다. 171개를 한 번의
`node --test --test-concurrency=8` 에 넣어 1915건이 통과하고 fail·skip 이 0이었다.
파일별 관측 기록은 `evidence/lane_run.json` 에 있다.

## pin 픽스처 편입 22개

러너가 `git show` 로 pin 의 파일을 임시 디렉터리에 만들고 cwd 만 그리로 옮긴다. 원본
테스트 바이트는 그대로다. `.github` 아래를 하나라도 읽으면 pin 의 `.github` 전량 56개를
준다. 순회 범위가 조용히 줄어드는 쪽을 막기 위해서다.

| 테스트 | 픽스처 파일 수 | 통과 건수 |
| -- | -- | -- |
| `test/actions-checkout-v7.test.ts` | 56 | 3 |
| `test/assist-artifact.test.ts` | 57 | 7 |
| `test/canonical-state-readers.test.ts` | 57 | 5 |
| `test/pages-workflow.test.ts` | 56 | 1 |
| `test/repair/automerge-e2e-workflow.test.ts` | 56 | 4 |
| `test/repair/automerge-telemetry-workflow.test.ts` | 56 | 1 |
| `test/repair/command-ops-action-ledger.test.ts` | 58 | 3 |
| `test/repair/comment-router-core.test.ts` | 59 | 133 |
| `test/repair/fanout-hydration-routing.test.ts` | 56 | 1 |
| `test/repair/focused-state-hydration.test.ts` | 56 | 14 |
| `test/repair/gitcrawl-store.test.ts` | 64 | 7 |
| `test/repair/issue-implementation-status.test.ts` | 56 | 8 |
| `test/repair/repair-containment-smoke-workflow.test.ts` | 56 | 3 |
| `test/repair/resolve-result-targets.test.ts` | 56 | 11 |
| `test/repair/tag-clawsweeper-targets.test.ts` | 57 | 2 |
| `test/repair/workflow-sparse-checkout.test.ts` | 59 | 14 |
| `test/report-metadata-audit.test.ts` | 56 | 5 |
| `test/review-comment-rendering.test.ts` | 65 | 55 |
| `test/review-prompt-context.test.ts` | 58 | 31 |
| `test/review-reliability-workflow.test.ts` | 56 | 3 |
| `test/state-writer-workflow.test.ts` | 58 | 8 |
| `test/workflow-runner-labels.test.ts` | 56 | 2 |

합계 321건. 이 결과는 upstream 입력에 대한 검증이다. 이 포크의 운영 동작 검증이 아니다.
포크의 실제 설정은 `check:scaffold` 가 실제 파일을 상대로 따로 단정한다.

## 제외 8개

| 테스트 | 사유 |
| -- | -- |
| `test/actions-runtime.test.ts` | `.github` 와 `docs` 두 디렉터리를 재귀 순회해 그 안의 `.md`·`.yml` 을 읽는다. 두 트리의 pin 항목 665개 중 244개가 그 필터에 걸린다. 복원하려면 픽스처에 두 번째 트리를 통째로 선언해야 하고, 덜 주면 순회 범위가 조용히 줄어 검사하지 않은 파일을 검사한 것으로 보고하게 된다 |
| `test/clawsweeper-action-ledger.test.ts` | `dist/clawsweeper-runtime.js` 의 `checkCommand` 가 자기 모듈 위치에서 계산한 저장소 root 에서 `.github/workflows/sweep.yml` 을 찾고 없으면 `Missing workflow` 로 끝난다. cwd 픽스처가 닿지 않는 자리다 |
| `test/dashboard-github-api.test.ts` | 미설정 설치가 GitHub 요청을 거부하는 JUN-198 의 동작을 그대로 맞는다. 3건 중 2건이 `refusing a GitHub request` 로 실패한다. 통과시키려면 그 거부를 완화해야 하므로 제외한다 |
| `test/exact-review-failure-telemetry.test.ts` | 관측 시각을 2026-09-02 로 고정해 넣고 `listSync` 를 `now` 없이 부른다. 그 경로는 `Date.now()` 기준 14일 보존 창 밖을 지우므로, 결과가 실행한 날짜에 따라 달라진다. 레인 결과를 달력에 묶지 않는다 |
| `test/github-response-deadlines.test.ts` | 끝나지 않는 이유가 레인 바깥에 있다. 미설정 설치가 mock 에 닿기 전에 GitHub 요청을 거부해서 이 스위트가 기다리는 promise 가 영영 안 풀린다. 테스트당 3초 제한을 강제로 걸면 exit 1 에 실패 2건·취소 6건이고, 러너 기본값(테스트당 제한 없음)에서는 반환하지 않는다. 거부와 종료 조건을 둘 다 풀어야 편입할 수 있다 |
| `test/repair/comment-webhook.test.ts` | 38건 중 27건이 JUN-198 의 admission 변경을 맞는다. 미설정 설치가 대상 저장소를 하나도 받지 않으므로 upstream 의 허용 동작을 전제한 단언이 성립하지 않는다. 잃은 범위로 기록한다 |
| `test/review-close-policy.test.ts` | `import.meta.url` 로 저장소 root 를 계산해 `.github/workflows/sweep.yml` 을 절대 경로로 연다. cwd 픽스처가 통하지 않는다 |
| `test/scheduled-review-noop.test.ts` | `scripts/e2e/exact-review-noop-read-scope.mjs` 가 저장소 root 를 절대 경로로 잡고 파킹된 `sweep.yml` 을 읽는다. 같은 이유로 cwd 픽스처가 통하지 않는다 |

앞의 두 종류(절대 경로 root, 전량 순회)는 원본 테스트 바이트를 고치면 복원할 수 있다.
그러려면 `modifiedUpstreamFiles` 양쪽 선언이 필요하고, 이 PR 의 편입 규모를 더 키운다.
이번에는 하지 않고 사유로 남긴다.

## 기존 제외 2개

`test/hosted-target-admission.test.ts` 와 `test/run-node-tests.test.ts` 는 JUN-135 때의
선언을 그대로 보존한다. 앞의 것은 픽스처로 복원할 수도 있었지만, 그 자리는 이미
`test/lina-check-admission.test.ts` 가 이 포크의 실제 동작으로 덮고 있다.
