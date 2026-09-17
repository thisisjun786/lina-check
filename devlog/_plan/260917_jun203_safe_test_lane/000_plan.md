# 000 · JUN-203 계획 기록

## 이슈

JUN-203. 안전 테스트 레인을 원본 테스트 쪽으로 넓히고, 넓히지 못한 파일마다 처분을 남긴다.
워크플로 활성화·배포·App 설치는 하지 않는다.

| 항목 | 값 |
| -- | -- |
| worktree | `/home/jun/code-worktrees/lina-check/lina-safe-test-lane` |
| 브랜치 | `codex/lina-safe-test-lane` |
| base | `main` (`67119afa`, PR #2 머지 커밋) |
| 선행 | JUN-135 Part A, JUN-198. `devlog/_plan/260917_jun135_part_a/`, `devlog/_plan/260917_jun198_install_profile/` |
| 런타임 | Node 24.20.0, pnpm 12.4.1 (Corepack) |

## 왜 지금 이 일인가

`test/**/*.test.ts` 기준으로 upstream pin 의 원본 테스트는 352개인데, 이 포크가 실행하도록
선언한 것은 13개였다. JUN-64·JUN-70·JUN-75·JUN-77 의 검증 항목이 전부 "원본 테스트를
재사용한다" 를 전제하는데 재사용 가능한 표면이 그 13개뿐이었다. 그 격차는 다른 프로젝트의
선행과 무관하게 이 저장소 안에서 좁힐 수 있다.

## 복원은 글롭이 아니라 선언이다

서로를 검사하는 곳이 넷이다.

- `config/lina-check-scaffold.json` 의 `derived.safeTests` / `excludedTests` /
  `upstreamFixtureTests` / `derivedTests` / `modifiedUpstreamFiles`
- `scripts/lina-check-derived-contract.mjs` 의 대응 리터럴. 어느 집합에 무엇이 들어가는지는
  이 코드가 정하고, 설정은 사유만 기록한다
- `scripts/lina-check-safe-tests.mjs`. 선언된 목록만 실행하고, spawn tripwire 로 비실행을
  관측 가능하게 한다
- `scripts/check-scaffold.mjs`. 선언과 리터럴이 어긋나거나 upstream 바이트가 바뀌면 exit 1

`SAFE_TESTS` 에는 길이 불변식이 있어서 목록만 늘리면 모듈 import 단계에서 거부된다.
이번에 그 불변식을 `assertSafeTestListShape` 라는 순수 함수로 꺼내고, 자기시험에 음성
케이스를 붙였다. 개수가 마법 상수로 남아 있으면 다음 확장 때 같은 자리에서 또 막힌다.

## 결정 세 가지

### 1. 편입 근거는 레인 실행이지 개별 실행이 아니다

선행 조사가 남긴 후보 201개의 개별 실행 영수증은 선별 근거일 뿐이다. 최종 근거는
`lina:test-safe` 한 번의 실행에서 credential 필터와 병렬도를 건 채로 통과하는지다.
개별 실행 결과와 레인 실행 결과가 갈리면 레인 쪽을 따른다.

### 2. 고정 pin 픽스처는 작업 디렉터리만 바꾼다

러너가 `git show` 로 pin 의 파일을 임시 디렉터리에 만들고 그 디렉터리를 cwd 로 삼아
테스트를 띄운다. 원본 테스트 바이트는 손대지 않는다. 그래서 cwd 기준으로 파일을 읽는
테스트에만 통하고, `import.meta.url` 로 저장소 root 를 계산하는 테스트에는 통하지 않는다.

### 3. 디렉터리를 순회하는 테스트에는 `.github` 전량을 준다

워크플로 디렉터리를 훑는 테스트에 일부만 복원하면 순회 범위가 조용히 줄고, 검사하지 않은
워크플로를 검사한 것으로 보고하게 된다. 그래서 `.github` 아래 파일을 하나라도 읽는 픽스처
테스트에는 pin 의 `.github` 전량 56개를 준다. 필요한 최소 집합보다 넓지만, 조용히 줄어드는
쪽보다 낫다. 픽스처 전량 재실행으로 넓힌 뒤에도 22개가 모두 통과함을 확인했다.

## 손대지 않는 선

- 워크플로는 파킹 상태 유지. `.yml.disabled` 를 되돌리지 않고, 제품 코드가 `.yml` 을
  `.yml.disabled` 로 해석하게 만들지 않는다
- 테스트를 통과시키려고 제품 코드·인증 거부·credential 필터·차단 가드를 완화하지 않는다.
  미설정 설치가 GitHub 요청을 거부하는 것은 JUN-198 의 결과이지 결함이 아니다
- `allowedScripts` 를 넓히지 않고, `blockedScripts` 프로브는 계속 막힌다
- 외부 서비스 통신과 실자격증명 사용 금지

## 문서 구성

| 문서 | 내용 |
| -- | -- |
| `010_candidate_disposition.md` | 후보 201개의 파일별 처분. 실패 30개 전량 포함 |
| `020_fixture_lane.md` | 픽스처 기계장치, 실행 경계 목록, 러너 변경 |
| `030_delivery_gates.md` | 게이트 결과와 리뷰 영수증 |
| `evidence/lane_run.json` | 레인 실행의 파일별 결과 관측 기록 |
