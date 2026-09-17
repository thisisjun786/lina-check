# 040 · 인도 게이트와 증거

## 게이트

패킷에 적힌 여덟 개를 적힌 형태 그대로 돌렸다. 축약형은 쓰지 않았다.

| 게이트 | 결과 |
| -- | -- |
| \`corepack pnpm install --frozen-lockfile --ignore-scripts\` | exit 0 |
| \`corepack pnpm run build:all\` | exit 0 |
| \`corepack pnpm run check:scaffold\` | exit 0 |
| \`corepack pnpm run lint\` | exit 0 |
| \`corepack pnpm run lina:contract-selftest\` | exit 0 |
| \`corepack pnpm run lina:test-safe\` | exit 0 |
| \`corepack pnpm run lina:test-safe:preview\` | exit 0 |
| \`corepack pnpm run lina:boundary-probe\` | exit 0 |

수치는 이 문서를 커밋하기 직전 작업 트리에서 잰 것이다. 그 뒤로 바뀐 것은 이 문서와 그 등록
두 줄뿐이고, 등록까지 포함한 재실행 결과는 PR 본문에 적는다.

### 한 번 빨간불이 났고, 그게 계약이 도는 증거다

중간 실행에서 \`check:scaffold\` 가 exit 1 로 멈췄다.

\`\`\`
AssertionError [ERR_ASSERTION]: Unexpected source addition:
  devlog/_plan/260917_jun223_lost_coverage/evidence/failure_controls.json
\`\`\`

실패 대조 영수증을 만들어 놓고 \`derived.files\` 에 등록하지 않아서다. 계획 단위를 새로 만들면
\`PLAN_UNITS\` 추가와 파일 등록을 둘 다 해야 한다는 규칙이 실제로 작동한다는 뜻이고, 등록을 더한
뒤 다시 exit 0 이 됐다.

## 레인

선언된 파일 206개에 파생 테스트 11개를 더해 217개를 돌렸다. 테스트 2709건 통과, 실패 0,
건너뜀 0. 실행 시간은 134초다. 같은 트리에서 두 번 쟀고 135초와 136초가 나왔다.

비교 기준으로 받은 137.28초·207파일은 동시 부하가 있던 역사적 참고값이다. 파일이 열 개 늘고
시간이 1초 줄었다는 것을 "테스트를 늘려도 공짜" 라는 결론으로 쓰면 안 된다. 두 측정의 부하
조건이 다르고, 늘어난 파생 테스트는 대부분 순수 함수 호출이라 원래 싸다. 여기서 말할 수 있는
것은 레인 시간이 눈에 띄게 늘지 않았다는 것뿐이다.

## 가드 유발 확인

\`src/clawsweeper-text.ts\` 에 한 줄을 넣고 \`check:scaffold\` 를 돌린 뒤 복원했다. 복원은
\`trap restore EXIT INT TERM\` 으로 걸어 중간에 죽어도 변조가 남지 않게 했다.

| 값 | |
| -- | -- |
| 변조 전 sha256 | \`fa23270af2e1c53b2ffac74f63476ec3974dd26e4258b10427990d0841782a0c\` |
| 변조 후 sha256 | \`76b1142449a872ee38b77715ab18a3c4e28ae227556bcef7deae3a13749a87c1\` |
| 변조 상태 \`check:scaffold\` | exit 1, \`Upstream bytes changed: src/clawsweeper-text.ts\` |
| 복원 후 sha256 | \`fa23270af2e1c53b2ffac74f63476ec3974dd26e4258b10427990d0841782a0c\` (변조 전과 동일) |
| 복원 후 \`check:scaffold\` | exit 0 |

## 탐지기

\`lina:contract-selftest\` 한 줄 요약에 그대로 찍힌다.

\`\`\`
derivedTestContract=14 derivedCases=140 derivedLaunches=0 launchControl=1
\`\`\`

\`launchControl=1\` 이 양성 대조다. sentinel 기동 한 건을 같은 훅이 이름까지 기록했고, 그
다음에 \`derivedLaunches=0\` 을 받았다. \`derivedCases=140\` 은 관측 실행에서 실제로 통과한
파생 케이스 수다. 0건과 "아무것도 안 돌았다" 를 구분하려고 함께 단언한다.

정적 쪽 양성 대조는 \`derivedTestContract=14\` 안에 들어 있다. 선언된 파일의 본문을
\`test/helpers/command-intake-fixture.mjs\` 를 import 하는 한 줄로 바꿔 먹이면 계약이
\`derived-test-spawns\` 로 거부하고, 거부 메시지가 그 helper 경로를 지목한다. 본문만 보는 스캔은
이 대조를 통과하지 못한다.

## 실패 대조

회복한 기대값을 일부러 틀린 값으로 바꿔 검사가 그것을 잡는지 봤다. 일곱 건 전부 잡혔고, 일곱 건
모두 원래 바이트로 복원됐다. 영수증은 \`evidence/failure_controls.json\` 에 있다.

처음 만든 대조 중 하나는 버렸다. 거부 목록에서 입력 하나를 빼는 변조였는데, 그건 틀린 결과가
아니라 검사 대상이 줄어드는 변조라서 원래 실패할 수 없다. 그 자리를 \`assert.throws\` 를
\`assert.doesNotThrow\` 로 뒤집는 변조로 바꿨다.

## 고치지 않고 보고하는 것

\`dashboard/github-api.ts\` 의 \`githubAppJson\` 은 \`githubApiUrl\` 이 던진 거부를 자기
\`try\` 블록에서 받아 \`GitHubRequestError("... network failure")\` 로 다시 던진다. 요청은
실제로 나가지 않지만, 메시지만 보면 미설정 거부와 나갔다가 실패한 요청을 구분할 수 없다.
제품 동작을 바꾸지 않기로 했으므로 손대지 않았고, 대신 회복 테스트가 메시지 대신 "요청이 한 번도
시도되지 않았다" 를 단언한다. 진단 가능성을 개선할 자리로 보이지만 그 판단은 이 PR 밖이다.

## 확인하지 못한 것

upstream 전체 테스트와 \`check\` 는 파킹된 워크플로 경로를 전제하므로 여기서 돌리지 않았고
통과로 보고하지 않는다. 워크플로 활성화·배포·App 설치·실제 모델 호출은 범위 밖이라 손대지
않았다. 파생 테스트가 네트워크를 쓰지 않는다는 것은 요청 경계를 대역 처리한 자리에서만
단언했고, 프로세스 전체를 상대로 한 네트워크 계측은 하지 않았다.

## 리뷰 대응 (PR #5, head dd97f6fe)

Codex 와 Devin 이 각각 붙었다. Devin Review 체크는 SUCCESS 였고, 지적은 diff 댓글 네 건이다.
같은 문제를 두 리뷰어가 따로 지적한 것이 하나 있어 실질 세 건이다.

### 1. closure 가 CommonJS 적재를 놓친다 (Codex P2 + Devin 버그, 같은 건)

맞는 지적이다. 첫 구현의 매처는 `from` 과 `import(` 만 봤다. 재수출
(`export * from`, `export { x } from`)은 `from` 을 달고 있어서 원래
걸렸지만, `require("./x")` 와 `createRequire(import.meta.url)("./x")` 는
빠져나갔다. 뒤의 것은 이 저장소 안에서 실제로 쓰이는 형태다. 파생 webhook 테스트가 frozen 인
ESM 네임스페이스 대신 모듈 객체를 잡으려고 그 형태를 쓴다.

매처를 두 갈래로 나눠 CommonJS 와 `createRequire` 호출 형태를 각각 따라가게 했고,
양성 대조도 형태별로 하나씩 넣었다. 따라갈 대상은 실행 가능한 확장자로 제한하고, 선언된 테스트가
읽을 수 없는 파일을 가리키면 조용히 덜 훑는 대신 `derived-test-unreadable` 로 거부한다.
selftest 의 파생 계약 대조가 14건에서 21건으로 늘었다.

Devin 이 제안한 "파서로 파싱하라" 는 받지 않았다. 이 저장소는 파서 의존성을 새로 들이지 않고,
정적 스캔은 어차피 변수에 담아 호출하는 형태를 완전히는 못 잡는다. 그 한계는
`030_detectors.md` 에 적혀 있고, 런타임 관측이 그 자리를 받는다. 두 게이트 모두 필수라서
머지 전에 걸린다.

### 2. 관측 임시 디렉터리가 남는다 (Devin 버그)

맞다. `runDerivedTestObservation` 이 매 실행마다 디렉터리를 만들고 지우지 않았다.
성공 경로와 단언 실패 경로 모두에서 지우도록 `try/finally` 로 감쌌다.

### 3. 대응표에 검사되는 생성기가 없다 (Devin 분석)

맞는 지적이고, 이게 셋 중 제일 값어치가 있었다. 144행 표를 저장소 밖 스크립트로 만들어 커밋만
해 두면, 나중에 어느 쪽 테스트가 바뀌어도 표는 그대로 읽히면서 조용히 낡는다.

생성기를 `scripts/lina-check-coverage-map.mjs` 로 저장소에 넣고 `write` 와
`check` 두 모드를 뒀다. `lina:contract-selftest` 가 `check` 를 돌려
커밋된 표·영수증과 대조하고, 어긋나면 실패한다. 생성기 자체의 대조도 넣었다. 회복 파일 하나를
비운 트리를 먹이면 그 파일의 레코드가 사유 없는 미회복이 되므로 생성이 실패해야 하고, 그것을
단언한다.

