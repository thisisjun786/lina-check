# 020 · 픽스처 레인과 실행 경계

## 픽스처가 하는 일과 하지 않는 일

하는 일. `scripts/lina-check-safe-tests.mjs` 의 `makeUpstreamFixture` 가 선언된 파일을
`git show <pin>:<path>` 로 읽어 시스템 임시 디렉터리에 만들고, 그 디렉터리를 cwd 로 삼아
`node --test <저장소의 절대 경로>` 를 띄운다. 테스트의 import 는 자기 파일 위치를 기준으로
풀리므로 저장소의 `dist/`·`src/` 를 그대로 쓰고, cwd 기준의 읽기만 pin 을 본다.

하지 않는 일. 원본 테스트 바이트를 고치지 않는다. `import.meta.url` 이나 모듈 위치에서
저장소 root 를 계산하는 읽기에는 닿지 않는다. 그런 파일 셋은 `010` 에서 제외로 남겼다.

픽스처 실행 결과가 증명하는 것은 upstream 입력에 대한 upstream 로직의 동작이다. 이 포크의
설정이 무엇을 가리키는지는 증명하지 않는다. 그쪽은 `check:scaffold` 가 실제 파일을 상대로
따로 단정한다.

## `.github` 는 전량을 준다

`.github` 아래를 하나라도 읽는 픽스처 테스트에는 pin 의 `.github` 전량 56개를 선언한다.
이 결정의 이유는 순회다. `test/repair/workflow-sparse-checkout.test.ts` 는
`.github/workflows/*.yml` 을 cwd 상대 glob 으로 훑고, `test/state-writer-workflow.test.ts` 도
워크플로 목록 전체를 대상으로 센다. 필요한 만큼만 주면 순회 대상이 줄어든 채로 통과하고,
검사하지 않은 워크플로를 검사한 것으로 보고하게 된다. 최소 집합 탐색에서 나온 결과와
전량을 준 뒤의 결과가 갈리는지 22개 전부 다시 돌려 확인했고, 전부 통과했다.

## 러너에 붙인 두 가지

### 바이트 캐시

픽스처 테스트가 22개가 되면서 `git show` 호출이 1200회를 넘었다. 같은 pin 의 같은 경로는
같은 바이트이므로 한 번 읽어 재사용한다. 캐시는 한 번의 실행 안에서만 산다.

### 레인 전체 시간 제한

후보 중 하나가 60초 제한까지 끝나지 않았다. 그 파일은 제외했지만, 러너 쪽에도 상한을 둔다.
`LANE_TIMEOUT_MS` 를 `spawnSync` 에 넘기고, 결과 판정을 `describeLaunchOutcome` 이라는
순수 함수로 분리해 자기시험이 네 갈래(정상·실패·시그널·기동 실패)를 전부 음성으로 확인한다.
상한을 넘기면 시그널 종료로 관측되고 레인은 매달리지 않는다.

## 실행 경계 목록

금지선은 "프로세스를 안 띄운다" 가 아니라 외부 서비스 통신과 실자격증명 사용 금지다.

### 읽지 않고 관측했다

처음에는 테스트 본문과 헬퍼의 import 를 훑어 토큰으로 분류했다. 독립 감사가 그 분류에서
거짓을 하나 찾아냈다. `test/repair/replacement-branch-head.test.ts` 를 "프로세스를 띄우지
않는다" 로 적었는데, 이 테스트는 `docs/proof/replacement-branch-head/run-proof.mjs` 를
import 해서 실제로 `git` 을 돌린다. 스캔 범위가 `test/` 안쪽에 머물러 있었던 탓이다.

읽어서 판정하는 방식을 버리고 관측으로 바꿨다.

| 질문 | 관측 방법 |
| -- | -- |
| 자식 프로세스를 띄우는가 | 파일마다 `node --permission --allow-fs-read=* --allow-fs-write=*` 로 직접 실행한다. 프로세스를 띄우면 `ERR_ACCESS_DENIED` 가 난다 |
| 소켓을 여는가 | `net.Server.prototype.listen` 을 감싼 모듈을 `--import` 로 얹고 레인 전량을 다시 돌린다 |
| 밖으로 나가는 요청이 있는가 | 같은 모듈이 `globalThis.fetch` 를 감싸 목적지를 기록한다 |

`node:child_process` 는 ESM 이름 바인딩이라 같은 방식의 monkey patch 가 통하지 않는다.
그래서 프로세스 쪽만 권한 모델을 쓴다. 두 방법 다 테스트 바이트를 고치지 않고, 저장소에도
남기지 않는다.

### 관측 결과

- 자식 프로세스를 띄우는 파일 33개. 전부 로컬 `node`·`git`·mock `gh` 다
- loopback HTTP 서버를 여는 파일 4개. 전부 `server.listen(0, "127.0.0.1")` 로 임시 포트를 잡는다
- 레인 전량에서 관측된 `fetch` 목적지는 전부 `127.0.0.1` 이다. loopback 밖으로 나간 요청이 없다

각 파일의 선언 문장은 이 관측에서 나왔다. 토큰 분류가 아니다.

#### loopback 서버 4개

- `test/repair/action-session.test.ts`
- `test/repair/issue-implementation-status.test.ts` (픽스처 레인)
- `test/review-proof-client.test.ts`
- `test/worker-records-request.test.ts`

#### 자식 프로세스 33개

- `test/apply-author-pr-budget-policy.test.ts`
- `test/apply-close-retry-policy.test.ts`
- `test/apply-cursor-trace.test.ts`
- `test/apply-label-sync.test.ts`
- `test/apply-live-state.test.ts`
- `test/apply-managed-locale-pr.test.ts`
- `test/apply-obsolete-fix-pr-policy.test.ts`
- `test/apply-pr-coverage-proof-close.test.ts`
- `test/apply-pr-coverage-proof-recheck.test.ts`
- `test/apply-pr-duplicate-proof.test.ts`
- `test/apply-pr-duplicate-ref-proof.test.ts`
- `test/apply-pr-promotion.test.ts`
- `test/apply-pr-supersession-promotion.test.ts`
- `test/apply-pr-supersession-safety.test.ts`
- `test/apply-product-direction-policy.test.ts`
- `test/apply-same-author-pair-close.test.ts`
- `test/apply-stale-version-bug-policy.test.ts`
- `test/apply-stalled-pr-policies.test.ts`
- `test/apply-unsponsored-feature-policy.test.ts`
- `test/assist-artifact.test.ts`
- `test/automerge-metrics.test.ts`
- `test/check-docs.test.ts`
- `test/close-reasons.test.ts`
- `test/codex-app-server-output.test.ts`
- `test/label-mutation-batch.test.ts`
- `test/manual-publication-authority.test.ts`
- `test/pr-close-coverage-proof.test.ts`
- `test/repair/command-action-ledger.test.ts`
- `test/repair/comment-router-utils.test.ts`
- `test/repair/exact-review-command-queue.test.ts`
- `test/repair/replacement-branch-head.test.ts`
- `test/review-preparation.test.ts`
- `test/review-prompt-policy.test.ts`

### 임시 파일

토큰으로 센 "임시 디렉터리에 쓰는 파일 개수" 도 같은 이유로 믿을 수 없어서 적지 않는다.
확인 가능한 사실만 남긴다. 레인 실행 전후로 `git status --porcelain` 에 upstream 추적 파일
변경이 없다. 정리하지 않고 남기는 테스트는 `030` 에 실측으로 적는다.

### credential 필터

러너는 자식 환경에서 `TOKEN`·`SECRET`·`_KEY`·`GH_`·`GITHUB_` 이름을 지우고, 무엇을
지웠는지 실행 전에 출력한다. 이 필터는 `test/clawsweeper-action-ledger.test.ts` 가 기대하는
GitHub Actions 환경 변수도 지운다. 그 파일을 제외한 이유는 따로 있지만, 설령 root 경로
문제가 없었어도 이 필터 아래에서는 같은 자리에서 막혔을 것이다.

