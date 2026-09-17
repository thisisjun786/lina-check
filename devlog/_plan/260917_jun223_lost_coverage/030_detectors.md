# 030 · 탐지기와 양성 대조

파생 테스트는 자식 프로세스를 띄우지 않는다. 이 문장을 증거 없이 적지 않으려고 탐지기를 두 개 두고,
둘 다 자기 양성 대조를 먼저 통과한 뒤에야 0을 주장한다. 둘 다 `corepack pnpm run lina:contract-selftest`
안에서 돈다.

## 왜 선언만으로는 부족했나

`assertDerivedTestContract` 는 선언된 파생 테스트 파일의 본문에서 금지 토큰을 찾았다. 그런데
`test/helpers/command-intake-fixture.mjs` 는 helper 안에서 `fork()` 한다. 파생 테스트가 그 helper 를
들여오면 본문은 깨끗하고 실행은 프로세스를 띄운다. 계약이 한 칸 모자랐다.

게다가 이 계약은 `check:scaffold` 에서만 불렸고 selftest 는 한 번도 부르지 않았다. 거부 경로가 실제로
거부하는지 아무도 확인하지 않는 상태였다는 뜻이다. 둘을 같이 고쳤다.

## 정적 탐지기 — 따라가거나, 거부하거나

`derivedTestClosure` 가 선언된 파일에서 시작해 테스트 트리(`test/`) 안에 떨어지는 상대 경로 적재를
따라간다. 제품 모듈은 따라가지 않는다. 제품은 정당하게 프로세스 기동 표면을 갖고 있어서 그것까지
금지하면 파생 테스트가 제품을 부를 수 없다. 그쪽은 런타임 탐지기가 본다.

적재 형태는 PR 리뷰 세 라운드를 거치며 한 칸씩 넓어졌다. 지금 따라가는 것은 다음과 같다.

| 형태 | 예 |
| -- | -- |
| ESM import·동적 import·재수출 | `import x from "./h.mjs"`, `export * from "./h.mjs"` |
| CommonJS | `require("./h.cjs")` |
| createRequire 즉시 호출 | `createRequire(import.meta.url)("./h.mjs")` |
| 변수에 담은 로더 | `const load = createRequire(url); load("./h.mjs")` |
| 이름을 바꿔 들여온 createRequire | `import { createRequire as makeRequire }` 뒤의 위 두 형태 |

별칭까지 모으는 이유는 단순하다. 철자에 묶인 검사는 `as` 한 번으로 무력화된다. 그래서
`createRequireNames` 가 `node:module` 이 그 파일에서 실제로 바인딩하는 이름을 모으고,
`analyseRequireUse` 가 그 이름의 모든 사용을 위 세 갈래로만 인정한다.

여기서 중요한 것은 넓힌 범위가 아니라 남은 자리의 처리다. 로더를 다른 함수에 넘기거나 계산된 값으로
부르면 정적 스캔은 따라갈 수 없다. 그 경우를 "못 찾았다" 로 읽지 않고 거부한다. 따라가거나 거부하거나
둘 중 하나이고, 조용한 통과는 없다.

거부 코드는 셋이다.

| 코드 | 언제 |
| -- | -- |
| `derived-test-spawns` | closure 안의 어떤 파일이든 금지 표면을 갖고 있을 때. 메시지가 그 파일을 지목한다 |
| `derived-test-unreadable` | 선언된 테스트가 읽을 수 없는 파일을 가리킬 때. 덜 훑는 대신 멈춘다 |
| `derived-test-unresolvable-require` | 따라갈 수 없는 로더 형태를 썼을 때 |

### 양성 대조

대조는 전부 실제 바이트로 한다. 선언된 파일의 본문을 `command-intake-fixture.mjs` 를 적재하는 한 줄로
바꿔 계약에 먹인다. 그 한 줄에는 금지 토큰이 없다. 계약이 거부한다면 적재를 따라가 helper 안의
`fork(` 를 읽었다는 뜻이고, 거부 메시지가 helper 경로를 지목하는 것까지 단언한다. 본문에서 멈추는
스캔은 이 대조를 통과하지 못한다. 같은 대조를 다섯 적재 형태마다 따로 돌린다.

음성 대조도 같이 있다. 이 저장소가 실제로 쓰는 형태, 즉 파생 webhook 테스트의
`createRequire(import.meta.url)("node:fs")` 와 그 뒤의 속성 대입까지 포함한 모양은 통과해야 한다.
그게 없으면 위 규칙은 `createRequire` 금지와 구분되지 않는다.

대조가 기대는 전제도 지킨다. helper 가 언젠가 정리돼 `fork(` 를 잃으면 대조는 조용히 아무것도
증명하지 않게 되므로, helper 가 그 표면을 아직 갖고 있는지를 따로 단언한다.

## 런타임 탐지기 — 기동 0건 관측

선언된 파생 테스트 열한 개를 한 프로세스에서 import 해 실행하고, 그 프로세스에
`node:child_process` 의 일곱 진입점(`spawn`·`spawnSync`·`exec`·`execFile`·
`execFileSync`·`execSync`·`fork`)을 감싼 preload 를 얹는다. 기록은 시도 시점에 남기므로 예외를
삼켜도 남고, `syncBuiltinESMExports()` 로 ESM 바인딩까지 바꾸므로 named import 로 붙잡아 둔 참조도
따라온다.

양성 대조가 먼저다. 같은 preload 아래에서 무해한 sentinel(`node -e ""`)을 띄우고 훅이 그것을 이름까지
기록하는지 확인한다. 그 다음에야 0건을 증거로 받아들인다. selftest 요약의 `launchControl=1` 이 그것이고,
`derivedLaunches=0` 이 관측 결과다.

실행됐는지도 같이 본다. 관측 실행이 exit 0 이고, 통과 케이스 수가 기록된 하한(140) 이상이며, 실패가
0이어야 한다. 그러지 않으면 "아무것도 안 띄웠다" 가 "아무것도 안 돌았다" 와 구분되지 않는다.

## 대응표를 실행에 묶는다

이름만 읽는 대응표는 `{ skip: true }` 가 붙은 선언을 회복으로 인증한다. 합계 하한만으로는 한 건이
skip 되고 다른 한 건이 추가되는 교환도 못 잡는다. 그래서 두 가지를 건다.

`scripts/lina-check-coverage-map.mjs` 가 선언의 옵션 인자를 읽어 skip·todo 를 실행되지 않는 것으로 보고
회복에서 뺀다. 그리고 관측 실행의 통과 목록과 대응표를 대조해, 표가 회복이라 부른 레코드 129개의 이름이
실제로 통과 목록에 있는지 단언한다. selftest 요약의 `coverageMap=verified` 는 커밋된 표와 영수증이
지금 트리에서 다시 생성한 것과 같다는 뜻이다.

## 회복이 실제로 무언가를 잡는지

위의 어느 것도 회복한 케이스 안의 단언이 살아 있는지는 말하지 않는다. 그 자리는
`scripts/lina-check-failure-controls.mjs` 가 받는다. 회복 스위트마다 하나씩, 열 스위트에 대조 11개를
두고 회복한 기대값을 틀린 결과로 바꿔 스위트가 실패하는지 본다. 파일은 digest 비교까지 해서 원래
바이트로 되돌린다. 게이트에는 넣지 않았다. 도는 동안 테스트 파일을 고치는 도구이고, 트리를 건드리는
게이트는 그것이 만드는 증거보다 손해라고 봤다.

## 이 탐지기들이 보지 못하는 것

계측은 Node 안쪽에 건다. 계측이 얹히기 전에 함수 참조를 붙잡아 둔 코드, 감싼 함수를 다시 덮어쓰는
코드, 그리고 `worker_threads`·`dgram` 은 빠진다. 이건 적대적 코드에 대한 방어가 아니라 우리가 쓴
파생 테스트와 고정된 pin 에 대한 관측이다.

런타임 관측은 `lina:contract-selftest` 안에서만 돈다. `lina:test-safe` 는 파생 테스트를 계측 없이
돌린다. 둘 다 필수 게이트라 위반은 머지 전에 걸리지만, 레인 자체가 계측되는 것은 아니다.

네트워크는 여기서 세지 않는다. 파생 테스트가 실제 요청을 하지 않는다는 것은 요청 경계를 대역 처리하고
시도 횟수를 0으로 단언하는 쪽(`lina-check-response-deadlines`)에서 따로 본다.

실패 대조는 표본이다. 각 스위트가 틀린 결과 하나에는 반응한다는 것을 보일 뿐, 그 안의 모든 단언이
살아 있다는 증명이 아니다.
