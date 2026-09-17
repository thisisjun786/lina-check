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

### 세 번 틀리고 나서 정한 방법

독립 감사 세 라운드가 이 절의 판정 방법을 세 번 깨뜨렸다. 순서대로 적는다.

1. import 를 훑어 토큰으로 분류했다. 스캔이 `test/` 안쪽에 머물러서,
   `docs/proof/replacement-branch-head/run-proof.mjs` 를 거쳐 `git` 을 돌리는 테스트를
   "프로세스를 안 띄운다" 로 적었다.
2. Node 권한 모델로 바꿔 자식 프로세스를 막고 돌렸다. 이건 시도가 아니라 거부를 센다.
   `src/repair/project-repo.ts` 가 `git config --get remote.origin.url` 의 실패를 삼켜서,
   `git` 을 돌리고도 통과한 파일이 세 개 있었다.
3. `node:child_process` 를 감싸 시도를 셌다. 그런데 계측을 자식 환경에 심는 바람에
   스캐너가 환경을 검사하는 테스트가 중간에 죽었고, 죽은 뒤의 기동은 기록되지 않았다.
   `test/assist-artifact.test.ts` 의 `node` 기동이 그렇게 빠져 있었다.

지금은 두 번 돌린다.

| 패스 | 무엇을 보나 | 어떻게 |
| -- | -- | -- |
| 평상 패스 | 테스트 프로세스가 띄우는 모든 프로세스와 여는 소켓 | `node:child_process` 7개 진입점·`net.Server.prototype.listen`·`fetch`·`Socket.connect` 를 감싸고 `syncBuiltinESMExports()` 로 ESM 바인딩까지 바꾼다. 계측은 자기 자신을 `process.env` 에서 지워서 자식에게 상속되지 않는다 |
| 자식 패스 | 자식 안에서 여는 소켓 | 같은 계측을 자식의 `env`·`execArgv` 에 다시 심는다. `fork` 가 `execArgv: []` 로 preload 를 떨어뜨리는 경우까지 따라간다 |

선언 문장은 평상 패스에서 나온다. 그 패스에서 207개가 전부 exit 0 이다. 계측이 결과를
바꾸지 않았다는 뜻이고, 그래서 이 관측은 "계측된 다른 실행" 이 아니라 평소 실행의 기록이다.
자식 패스는 소켓만 보탠다. 자식 패스에서는 6개가 exit 1 인데, 그것이 3번 실패의 흔적이고
그래서 선언 문장을 거기서 뽑지 않는다.

시도 시점에 기록하므로 예외를 삼켜도 남는다. 테스트 바이트는 고치지 않고, 계측은 저장소에
남기지 않는다.

### 관측 결과

- 자식 프로세스를 띄우는 파일 35개
- loopback HTTP 서버를 여는 파일 5개. 그중 하나는 fork 한 자식이 연다
- 관측된 명령은 `node`, `git`, `curl`, `command-intake-fixture.mjs`, 그리고 테스트가 임시
  디렉터리에 직접 써 넣는 `trufflehog` 스텁이다. 실제 `trufflehog` 는 이 호스트에 설치돼
  있지도 않다
- 목적지로 나온 URL 은 전부 `127.0.0.1` 이다. 예외 두 개는 둘 다 JUN-135 때부터 있던 13개
  안에 있다. `test/manual-publication-authority.test.ts` 는 `https://authority` 를 테스트가
  임시 `PATH` 에 만든 가짜 `curl` 에 넘기고, `test/automerge-metrics.test.ts` 는 GitHub URL 을
  로컬 `node` mock 의 인자로 넘긴다. 자식 패스에서 그 mock 은 아무 네트워크 호출도 하지 않았다

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
| `test/apply-pr-coverage-proof-close.test.ts` | node |
| `test/apply-pr-coverage-proof-recheck.test.ts` | node |
| `test/apply-pr-duplicate-proof.test.ts` | node |
| `test/apply-pr-duplicate-ref-proof.test.ts` | node |
| `test/apply-pr-promotion.test.ts` | node |
| `test/apply-pr-supersession-promotion.test.ts` | node |
| `test/apply-pr-supersession-safety.test.ts` | node |
| `test/apply-product-direction-policy.test.ts` | node |
| `test/apply-same-author-pair-close.test.ts` | node |
| `test/apply-stale-version-bug-policy.test.ts` | node |
| `test/apply-stalled-pr-policies.test.ts` | node |
| `test/apply-unsponsored-feature-policy.test.ts` | node |
| `test/assist-artifact.test.ts` | a stub trufflehog the test writes to a temporary directory, node |
| `test/automerge-metrics.test.ts` | node |
| `test/check-docs.test.ts` | git |
| `test/close-reasons.test.ts` | node |
| `test/codex-app-server-output.test.ts` | node |
| `test/label-mutation-batch.test.ts` | node |
| `test/manual-publication-authority.test.ts` | node |
| `test/pr-close-coverage-proof.test.ts` | a stub trufflehog the test writes to a temporary directory, node |
| `test/repair/comment-router-config.test.ts` | git |
| `test/repair/comment-router-utils.test.ts` | git |
| `test/repair/exact-review-command-queue.test.ts` | command-intake-fixture.mjs, curl |
| `test/repair/issue-worker-recovery.test.ts` | git |
| `test/repair/live-worker-capacity.test.ts` | git |
| `test/repair/replacement-branch-head.test.ts` | git |
| `test/review-preparation.test.ts` | node |
| `test/review-prompt-policy.test.ts` | node |

### 이 관측이 보지 못하는 것

계측은 Node 안쪽에서 건다. 아래는 원리상 빠지는 자리이고, 선언 문장은 그만큼만 주장한다.

- 자식이 Node 가 아니면(`curl`, 스텁 바이너리) 그 안에서 무엇을 하는지는 argv 로만 본다.
  `curl` 에 넘어간 URL 이 전부 `127.0.0.1` 이라는 사실이 그래서 중요하다
- `worker_threads` 와 `dgram` 은 감싸지 않았다. 복원한 테스트에도, `src/` 와 `dashboard/` 에도
  두 모듈을 쓰는 곳이 없다(`rg -l 'node:worker_threads|node:dgram'` 가 0건)
- 계측이 얹히기 전에 함수 참조를 붙잡아 둔 코드, 그리고 감싼 함수를 다시 덮어쓰는 코드는
  빠져나간다. 이건 적대적 코드에 대한 방어가 아니라 고정된 upstream pin 의 관측이다
- `fetch` 를 쓰지 않는 HTTP 는 `Socket.connect` 로만 보이고, 경로가 아니라 호스트·포트만 남는다

### 임시 파일

레인 실행 전후로 `git status --porcelain` 에 upstream 추적 파일 변경이 없다. 정리하지 않고
남기는 테스트는 `030` 에 실측으로 적는다.

### credential 필터

러너는 자식 환경에서 `TOKEN`·`SECRET`·`_KEY`·`GH_`·`GITHUB_` 이름을 지우고, 무엇을
지웠는지 실행 전에 출력한다. 이 필터는 `test/clawsweeper-action-ledger.test.ts` 가 기대하는
GitHub Actions 환경 변수도 지운다. 그 파일을 제외한 이유는 따로 있지만, 설령 root 경로
문제가 없었어도 이 필터 아래에서는 같은 자리에서 막혔을 것이다.
