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

### 읽어서 판정하지 않고 관측했다

처음에는 테스트와 헬퍼의 import 를 훑어 토큰으로 분류했다. 독립 감사가 그 분류에서 거짓을
찾아냈다. `test/repair/replacement-branch-head.test.ts` 를 "프로세스를 띄우지 않는다" 로
적었는데, 이 테스트는 `docs/proof/replacement-branch-head/run-proof.mjs` 를 거쳐 `git` 을
돌린다. 스캔 범위가 `test/` 안쪽에 머물러 있었던 탓이다.

두 번째 시도는 Node 권한 모델이었다. 자식 프로세스를 막고 돌려서 `ERR_ACCESS_DENIED` 가
나면 프로세스를 띄우는 것으로 봤다. 2라운드 감사가 이것도 깨뜨렸다.
`src/repair/project-repo.ts` 가 `git config --get remote.origin.url` 의 실패를 삼키기 때문에,
거부당하고도 통과하는 파일이 있다. 거부가 안 났다는 것은 시도가 없었다는 뜻이 아니다.

지금 쓰는 방법은 거부가 아니라 시도를 센다.

| 질문 | 관측 방법 |
| -- | -- |
| 어떤 프로세스를 띄우는가 | `node:child_process` 의 7개 진입점을 감싸 호출 시점에 argv 를 기록하고 `syncBuiltinESMExports()` 로 ESM 이름 바인딩까지 바꾼다. 예외를 삼켜도 시도는 남는다 |
| 소켓을 여는가 | `net.Server.prototype.listen` 을 감싼다 |
| 밖으로 나가는 요청이 있는가 | `globalThis.fetch` 와 `net.Socket.prototype.connect` 를 감싸고, 프로세스 argv 에 들어간 URL 도 같이 본다 |
| 자식 안에서 벌어지는 일은 | 감싼 진입점이 자식의 `env` 와 `execArgv` 에 계측을 다시 심는다. `fork` 가 `execArgv: []` 로 preload 를 떨어뜨리는 경우까지 따라간다 |

`test/helpers/command-intake-fixture.mjs` 가 그 마지막 칸의 이유다. 이 헬퍼는
`execArgv: []` 와 교체된 환경으로 `fork` 하고, 서버는 그 자식이 연다. 부모만 보면 소켓이
없는 것처럼 보인다.

테스트 바이트는 고치지 않는다. 계측은 실행할 때만 얹고 저장소에 남기지 않는다.

### 관측 결과

- 자식 프로세스를 띄우는 파일 35개
- loopback HTTP 서버를 여는 파일 5개. 그중 하나는 fork 한 자식이 연다
- 관측된 명령은 `node`, `git`, `curl`, 그리고 테스트가 임시 디렉터리에 직접 써 넣는
  `trufflehog`·`codex` 스텁이다. 실제 `trufflehog` 는 이 호스트에 설치돼 있지도 않다
- URL 이 오간 파일에서 목적지는 전부 `127.0.0.1` 이다. 예외가 하나 있다.
  `test/manual-publication-authority.test.ts` 는 `https://authority` 를 `curl` 에 넘기는데,
  그 `curl` 은 테스트가 임시 디렉터리에 만들어 `PATH` 앞에 붙인 가짜다. JUN-135 때의 선언이
  이미 그렇게 적고 있다

각 파일의 선언 문장은 이 관측에서 나왔다. 토큰 분류가 아니다.

#### loopback 서버 5개

| 테스트 | 어디서 여는가 |
| -- | -- |
| `test/repair/action-session.test.ts` | 테스트 프로세스에서 |
| `test/repair/exact-review-command-queue.test.ts` | fork 한 자식에서 |
| `test/repair/issue-implementation-status.test.ts` | 테스트 프로세스에서 |
| `test/review-proof-client.test.ts` | 테스트 프로세스에서 |
| `test/worker-records-request.test.ts` | 테스트 프로세스에서 |

#### 자식 프로세스 35개

| 테스트 | 관측된 명령 |
| -- | -- |
| `test/apply-author-pr-budget-policy.test.ts` | node |
| `test/apply-close-retry-policy.test.ts` | node |
| `test/apply-cursor-trace.test.ts` | node |
| `test/apply-label-sync.test.ts` | node |
| `test/apply-live-state.test.ts` | node |
| `test/apply-managed-locale-pr.test.ts` | node |
| `test/apply-obsolete-fix-pr-policy.test.ts` | node |
| `test/apply-pr-coverage-proof-close.test.ts` | a stub trufflehog the test writes to a temporary directory, node |
| `test/apply-pr-coverage-proof-recheck.test.ts` | a stub trufflehog the test writes to a temporary directory, node |
| `test/apply-pr-duplicate-proof.test.ts` | a stub trufflehog the test writes to a temporary directory, node |
| `test/apply-pr-duplicate-ref-proof.test.ts` | a stub trufflehog the test writes to a temporary directory, node |
| `test/apply-pr-promotion.test.ts` | node |
| `test/apply-pr-supersession-promotion.test.ts` | node |
| `test/apply-pr-supersession-safety.test.ts` | node |
| `test/apply-product-direction-policy.test.ts` | node |
| `test/apply-same-author-pair-close.test.ts` | a stub trufflehog the test writes to a temporary directory, node |
| `test/apply-stale-version-bug-policy.test.ts` | node |
| `test/apply-stalled-pr-policies.test.ts` | node |
| `test/apply-unsponsored-feature-policy.test.ts` | node |
| `test/assist-artifact.test.ts` | a stub trufflehog the test writes to a temporary directory |
| `test/automerge-metrics.test.ts` | node |
| `test/check-docs.test.ts` | git |
| `test/close-reasons.test.ts` | node |
| `test/codex-app-server-output.test.ts` | a stub codex the test writes to a temporary directory, node |
| `test/label-mutation-batch.test.ts` | node |
| `test/manual-publication-authority.test.ts` | curl, node |
| `test/pr-close-coverage-proof.test.ts` | a stub trufflehog the test writes to a temporary directory |
| `test/repair/comment-router-config.test.ts` | git |
| `test/repair/comment-router-utils.test.ts` | git |
| `test/repair/exact-review-command-queue.test.ts` | command-intake-fixture.mjs, curl |
| `test/repair/issue-worker-recovery.test.ts` | git |
| `test/repair/live-worker-capacity.test.ts` | git |
| `test/repair/replacement-branch-head.test.ts` | git |
| `test/review-preparation.test.ts` | node |
| `test/review-prompt-policy.test.ts` | node |

### 이 관측이 증명하지 않는 것

계측은 Node 안쪽에서 건다. 자식이 Node 가 아니면(`curl`, 스텁 바이너리) 그 안에서 무엇을
하는지는 argv 로만 본다. `curl` 에 넘어간 URL 이 전부 `127.0.0.1` 이라는 사실이 그래서
중요하다. 그리고 계측을 얹으면 자식 환경이 달라지므로, 스텁 바이너리를 쓰는 6개 파일은
관측 실행에서 exit 1 을 냈다. 게이트 기록은 계측 없는 `lina:test-safe` 실행이다.

### 임시 파일

토큰으로 센 "임시 디렉터리에 쓰는 파일 개수" 는 믿을 수 없어서 적지 않는다. 확인 가능한
사실만 남긴다. 레인 실행 전후로 `git status --porcelain` 에 upstream 추적 파일 변경이 없다.
정리하지 않고 남기는 테스트는 `030` 에 실측으로 적는다.

### credential 필터

러너는 자식 환경에서 `TOKEN`·`SECRET`·`_KEY`·`GH_`·`GITHUB_` 이름을 지우고, 무엇을
지웠는지 실행 전에 출력한다. 이 필터는 `test/clawsweeper-action-ledger.test.ts` 가 기대하는
GitHub Actions 환경 변수도 지운다. 그 파일을 제외한 이유는 따로 있지만, 설령 root 경로
문제가 없었어도 이 필터 아래에서는 같은 자리에서 막혔을 것이다.
