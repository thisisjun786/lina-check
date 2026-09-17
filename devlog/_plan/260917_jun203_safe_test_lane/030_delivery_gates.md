# 030 · 인도 게이트와 리뷰 영수증

## 측정 방법

`명령 > 파일 2>&1` 직후 `$?` 를 읽는다. 파이프라인 뒤에서 읽지 않는다. 측정 대상 트리는 이
커밋의 트리와 같다. 이 문서를 커밋하면 head 가 한 번 더 움직이고 그 diff 는 이 markdown
뿐이지만, 감추지 않고 여기 적는다. 리뷰가 새 커밋을 만들면 표를 다시 측정한다.

| 항목 | 값 |
| -- | -- |
| 브랜치 | `codex/lina-safe-test-lane` |
| base | `main` (`67119afa`) |
| 런타임 | Node 24.20.0, pnpm 12.4.1 (Corepack) |
| 작업물 | 측정 시 upstream 추적 파일 변경 0건 |

## 필수 게이트 8항목

| # | 명령 | exit | 초 | 결과 요약 |
| -- | -- | -- | -- | -- |
| 1 | `corepack pnpm install --frozen-lockfile --ignore-scripts` | 0 | 0.07 | lockfile 고정 설치 |
| 2 | `corepack pnpm run build:all` | 0 | 0.97 | tsc 3개 프로젝트 무오류 |
| 3 | `corepack pnpm run check:scaffold` | 0 | 2.18 | upstream 1646 항목, 파생 32, 복원 테스트 206, 픽스처 23, 수정 선언 7, 워크플로 35 parked, 차단 104 |
| 4 | `corepack pnpm run lint` | 0 | 0.42 | oxlint 4개 스크립트 전부 Done |
| 5 | `corepack pnpm run lina:contract-selftest` | 0 | 0.25 | `rejected=30 helpers=18 laneShape=26 installation=48 modifiedUpstream=22 tripwireControls=3 routing=verified assertionCalls=23->29` |
| 6 | `corepack pnpm run lina:test-safe` | 0 | 134.97 | 통과 2579건, fail 0, skip 0 |
| 7 | `corepack pnpm run lina:test-safe:preview` | 0 | 0.10 | `206 declared tests, nothing executed`. 자식 프로세스 미기동, 픽스처 미생성 |
| 8 | `corepack pnpm run lina:boundary-probe` | 0 | 0.75 | `entrancesClosed`·`workflowsParked`·`guardVerified`·`worktreeUnchanged` 전부 true |

`build:all` 을 건너뛰지 않았다. 복원된 테스트가 `dist/` 를 import 하고, 러너는 소스와 출력을
짝 단위로 비교해 하나라도 오래되면 exit 3 으로 거부한다.

## 가드 무결성 유발 확인

선언되지 않은 upstream 파일 `test/stable-json.test.ts` 에 주석 한 줄을 넣고 `check:scaffold` 를
돌렸다.

| 단계 | exit | 관측 |
| -- | -- | -- |
| 한 줄 추가 후 | 1 | `Upstream bytes changed: test/stable-json.test.ts` |
| `git checkout --` 복원 후 | 0 | 작업물 0줄, 게이트 3 재통과 |

## 레인 실행 시간

| 구간 | 파일 | 병렬도 | 경과 |
| -- | -- | -- | -- |
| 저장소 root 배치 | 184 (복원 183 + 파생 1) | 8 | 131.7초 |
| pin 픽스처 배치 | 23 | 1 (파일당 별도 기동) | 4.0초 |
| 게이트 6 전체 | 207 | | 135.0초 |

구간별 수치는 `evidence/lane_run.json` 을 만든 관측 실행의 것이고, 게이트 6 은 그와 별개의
실행이다. 둘 다 같은 207개를 같은 구성으로 돌린다.

측정 중 이 호스트에서 다른 작업의 테스트 실행이 함께 돌고 있었다. 레인 시간은 그만큼 위쪽으로
편향돼 있다. 같은 구성의 후보 171개만 한가한 구간에서 돌렸을 때는 45.7초였다.

픽스처 23개가 4초 안에 끝나는 이유는 바이트 캐시다. 캐시가 없으면 같은 pin 의 같은 경로를
1200회 넘게 `git show` 로 읽는다.

## 실행 경계 관측

- 편입한 206개의 실행 경계는 읽어서가 아니라 관측해서 정했다. 평상 패스에서 207개가 전부
  exit 0 이므로 계측이 결과를 바꾸지 않았고, 그래서 이 기록은 평소 실행의 기록이다. 결과는
  자식 프로세스 35개, loopback 서버 5개(하나는 fork 한 자식이 연다), URL 목적지는 전부
  `127.0.0.1`(예외 2건은 기존 13개 안의 가짜 `curl`·로컬 mock). 방법과 이 관측이 보지 못하는
  자리는 `020_fixture_lane.md`
- 레인 실행 전후로 `git status --porcelain` 에 upstream 추적 파일 변경이 없다. 픽스처
  디렉터리는 시스템 임시 경로에 만들고 실행 후 지운다. 남은 `lina-check-upstream-*` 0건
- credential 필터가 이 호스트에서 지운 이름 4개: `EXA_API_KEY`, `GEMINI_API_KEY`,
  `GH_PAGER`, `STARSHIP_SESSION_KEY`. 실행 전에 출력된다
- 정리하지 않는 upstream 테스트가 하나 있다. `test/repair/gitcrawl-cluster-history.test.ts` 는
  실행마다 `/tmp` 항목 2개를 남긴다(실행 전후 `ls /tmp | wc -l` 84651 → 84653). 저장소 밖이고
  레인이 아니라 그 테스트가 만든 것이므로 지우지 않고 사실만 적는다
- `blockedScripts` 104개는 `check:scaffold` 가 매번 전수 호출해 exit 1 과 `is disabled` 를
  확인한다. 경계 프로브는 그중 8개 진입점을 따로 두드린다. `allowedScripts` 는 넓히지 않았다

## 무엇을 증명하지 않는가

- 픽스처 레인의 초록색은 upstream 입력에 대한 upstream 로직의 동작이다. 이 포크의 운영
  동작이 아니다
- upstream 전체 check/test 는 여전히 돌리지 않았다. 원본의 활성 워크플로 경로를 전제하기
  때문이고, 통과로 보고하지 않는다
- 제외한 8개의 범위는 복구되지 않았다. 잃은 범위로 남아 있다

## 리뷰 영수증

PR 을 올리기 전에 독립 리뷰어(다른 모델, 읽기 전용)에게 감사를 한 번 받았다. 판정은 FAIL 이었고
차단 2건을 냈다. 둘 다 사실이었다.

| # | 출처 | 지적 | 처리 | 확인 |
| -- | -- | -- | -- | -- |
| 1 | 사전 독립 감사 (blocker) | 선언의 실행 경계가 거짓. `test/repair/replacement-branch-head.test.ts` 를 "프로세스를 안 띄운다" 로 적었는데 `docs/proof/.../run-proof.mjs` 를 통해 `git` 을 돌린다 | 토큰 분류를 버리고 권한 모델·프로브 관측으로 바꿔 206개 문장을 전부 다시 생성 | 이 파일의 선언이 "Starts a local child process" 로 바뀌었고, 자식 프로세스 33개·loopback 4개가 관측으로 확정 |
| 2 | 사전 독립 감사 (blocker) | timeout 분류가 실제 모양을 못 맞춘다. `spawnSync` 의 timeout 은 `error.code=ETIMEDOUT` 과 `SIGTERM` 을 동시에 내는데 `describeLaunchOutcome` 이 error 를 먼저 읽어 "기동 실패" 로 보고한다 | timeout 분기를 error·signal 앞으로 옮기고 `kind: "timeout"` 을 추가. 자기시험 케이스를 실제 모양으로 바꾸고, `spawnSync` 로 진짜 timeout 을 재현해 분류를 확인하는 케이스를 추가 | `laneShape` 12 → 14 |
| 3 | 사전 독립 감사 (should-fix) | `test/github-response-deadlines.test.ts` 제외 사유가 부정확. 단순한 미종료가 아니라 미설정 거부 때문에 promise 가 안 풀리는 것 | 사유를 실측(3초 제한 강제 시 exit 1, 실패 2·취소 6)으로 다시 썼다 | `config/lina-check-scaffold.json` 의 해당 항목 |
| 4 | 사전 독립 감사 (should-fix) | `test/actions-runtime.test.ts` 제외 사유의 665개는 과장. 확장자 필터에 걸리는 것은 244개 | 665개 중 244개가 필터에 걸린다고 고쳤다 | 같은 파일, `010` 표 |
| 5 | 사전 독립 감사 (should-fix) | `assertFixtureTestContract` 가 `files` 누락·`null` 을 빈 배열로 받아준다 | `Array.isArray` 를 요구하고, 추가 읽기가 없는 항목에 대해 누락·`null` 두 경우를 음성 케이스로 넣었다 | `modifiedUpstream` 20 → 22 |

2라운드도 FAIL 이었다. 1라운드의 수정 다섯 개는 전부 유지된다고 확인했지만, 관측 방법 자체에
구멍 두 개를 더 찾았다.

| # | 출처 | 지적 | 처리 | 확인 |
| -- | -- | -- | -- | -- |
| 6 | 2라운드 (blocker) | 권한 모델은 시도가 아니라 거부를 센다. `src/repair/project-repo.ts` 가 `git config` 실패를 삼켜서, `git` 을 돌리고도 "프로세스를 안 띄운다" 로 통과한 파일이 3개 있었다 | 거부가 아니라 시도를 세도록 바꿨다. `node:child_process` 7개 진입점을 감싸고 `syncBuiltinESMExports()` 로 ESM 바인딩까지 교체해 argv 를 호출 시점에 기록한다 | 자식 프로세스 파일이 33개 → 35개. `comment-router-config`, `issue-worker-recovery`, `live-worker-capacity` 가 `git` 으로 정정됐다 |
| 7 | 2라운드 (blocker) | 프로브가 자식 안을 못 본다. `test/helpers/command-intake-fixture.mjs` 는 `execArgv: []` 와 교체된 환경으로 `fork` 해서 preload 를 떨어뜨리고, 서버는 그 자식이 연다. `curl` 같은 non-Node 자식은 `globalThis.fetch` 바깥이다 | 감싼 진입점이 자식의 `env` 와 `execArgv` 에 계측을 다시 심는다. non-Node 자식은 argv 의 URL 로 본다는 한계를 `020` 에 명시했다 | loopback 서버 4개 → 5개. `exact-review-command-queue` 가 fork 한 자식에서 서버를 열고 `curl` 로 `127.0.0.1` 에 붙는 것이 기록됐다 |
| 8 | 2라운드 (nit) | `020_fixture_lane.md` 끝에 빈 줄이 남아 `git diff --check` 가 2를 냈다 | 계획 단위 문서 전부에서 끝 빈 줄을 정리했다 | `git diff --check 67119afa` exit 0 |

3라운드도 FAIL 이었다. 2라운드에서 고친 두 가지는 유지되지만, 계측이 자식 환경에 심어지는
바람에 관측 자체가 일부 테스트를 망가뜨리고 있었다.

| # | 출처 | 지적 | 처리 | 확인 |
| -- | -- | -- | -- | -- |
| 9 | 3라운드 (blocker) | 계측을 자식 환경에 심으면 스캐너 환경 검사가 깨져서 테스트가 중간에 죽고, 그 뒤의 기동이 기록되지 않는다. `test/assist-artifact.test.ts` 의 `node` 기동이 빠져 있었다 | 관측을 두 패스로 나눴다. 평상 패스는 계측을 `process.env` 에서 지워 자식에게 상속되지 않게 하고, 선언 문장은 거기서만 뽑는다. 자식 패스는 소켓만 보탠다 | 평상 패스 207개 전부 exit 0. `assist-artifact` 선언이 스텁 `trufflehog` 와 `node` 를 둘 다 적는다 |
| 10 | 3라운드 (should-fix) | 계측의 사각지대를 명시하라. 콜백형 `execFile` 의 옵션 주입 누락, `worker_threads`·`dgram` 미포함, 계측 전에 붙잡힌 참조, `fetch` 아닌 HTTP 의 목적지 유실 | 옵션 위치를 인자 끝이 아니라 실제 옵션 객체 자리에서 찾도록 고쳤고, `Socket.connect` 의 호스트·포트를 기록하게 했다. 나머지 사각지대는 `020` 에 "이 관측이 보지 못하는 것" 으로 적었다. `worker_threads`·`dgram` 은 `test/`·`src/`·`dashboard/` 어디에도 없음을 확인했다(`rg -l` 0건) | `020_fixture_lane.md` |

PR 에 붙은 Devin Review 와 Codex 코드리뷰의 지적이다. 둘 다 `95dde5b9` 를 봤다.

| # | 출처 | 지적 | 처리 | 확인 |
| -- | -- | -- | -- | -- |
| 11 | Devin(bug)·Codex(P2), 같은 건 | 시간 초과가 러너만 죽인다. `spawnSync` 의 timeout 신호는 자기가 띄운 프로세스에만 가고, 이 레인에는 node·git·curl·로컬 서버를 띄우는 테스트가 있으므로 자손이 포트를 쥔 채 남을 수 있다 | 실행을 자기 프로세스 그룹으로 띄우고(`detached: true`), 시간 초과로 판정되면 `reapLaunchGroup` 이 그룹 전체에 SIGKILL 을 보낸다. kill 을 주입받는 순수 함수라 자기시험이 모든 갈래를 확인한다. 대가는 적어 뒀다: 대화형 Ctrl-C 가 더 이상 테스트에 닿지 않는다 | `laneShape` 14 → 22 |
| 12 | Devin(analysis) | README 가 아직 13개 레인이라고 안내한다 | 206개로 고치고, 그중 23개가 고정 pin 바이트 위에서 도는 사실을 함께 적었다 | `README.md` |
| 13 | Devin(analysis) | 복원한 테스트가 임시 디렉터리를 정리하지 않고 남긴다 | 이미 이 문서의 실행 경계 관측에 적혀 있던 사실이다. 보이는 자리에서도 보이도록 해당 테스트의 선언 사유에 옮겨 적었다 | `config/lina-check-scaffold.json` 의 `test/repair/gitcrawl-cluster-history.test.ts` |

4라운드 감사가 그 수정의 순서 결함을 잡았다.

| # | 출처 | 지적 | 처리 | 확인 |
| -- | -- | -- | -- | -- |
| 14 | 4라운드 (blocker) | 러너가 모든 실행을 마친 뒤에 판정하고 첫 실패에서 반환한다. 그래서 앞에서 실패가 나면 뒤에서 시간 초과로 멈춘 실행은 수확되지 않고 자손이 레인보다 오래 산다. 픽스처 정리가 예외를 내도 같은 자리를 건너뛴다 | 판정을 실행 직후로 옮겼다. 시간 초과면 그 자리에서 그룹을 수확하고, 다음 실행과 정리보다 먼저 한다. 첫 실패가 종료 코드를 정하는 동작은 그대로다 | `laneShape` 22 → 26. 자기시험이 실제 순서를 주입 실행으로 몰아 본다. 앞선 실패 뒤의 시간 초과가 수확되고, 남은 실행이 계속되고, 픽스처 디렉터리가 전부 지워지는지 확인한다 |

감사가 통과로 확인한 것도 적는다. 가드 완화 없음(`allowedScripts` 동일, 제품 코드·워크플로·가드
바이트 불변), 기존 거부 경로 약화 없음, 실패하는 레인이 exit 0 으로 새는 경로 없음, 변경한 네
파일에 개인 이메일·자격증명·새 upstream 계정 리터럴 없음.

Devin Review 와 Codex 코드리뷰는 PR 에 붙는다. 그 지적은 수정 커밋으로 처리하고 게이트를 다시
측정한 뒤 이 표에 이어 적는다.
