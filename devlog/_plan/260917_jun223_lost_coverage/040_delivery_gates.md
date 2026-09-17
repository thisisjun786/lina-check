# 040 · 인도 게이트와 증거

## 게이트

패킷에 적힌 여덟 개를 적힌 형태 그대로 돌렸다. 축약형은 쓰지 않았다.

| 게이트 | 결과 |
| -- | -- |
| `corepack pnpm install --frozen-lockfile --ignore-scripts` | exit 0 |
| `corepack pnpm run build:all` | exit 0 |
| `corepack pnpm run check:scaffold` | exit 0 |
| `corepack pnpm run lint` | exit 0 |
| `corepack pnpm run lina:contract-selftest` | exit 0 |
| `corepack pnpm run lina:test-safe` | exit 0 |
| `corepack pnpm run lina:test-safe:preview` | exit 0 |
| `corepack pnpm run lina:boundary-probe` | exit 0 |

수치는 이 문서를 커밋하기 직전 작업 트리에서 잰 것이다. 그 뒤로 바뀐 것은 이 문서와 그 등록
두 줄뿐이고, 등록까지 포함한 재실행 결과는 PR 본문에 적는다.

### 한 번 빨간불이 났고, 그게 계약이 도는 증거다

중간 실행에서 `check:scaffold` 가 exit 1 로 멈췄다.

```
AssertionError [ERR_ASSERTION]: Unexpected source addition:
  devlog/_plan/260917_jun223_lost_coverage/evidence/failure_controls.json
```

실패 대조 영수증을 만들어 놓고 `derived.files` 에 등록하지 않아서다. 계획 단위를 새로 만들면
`PLAN_UNITS` 추가와 파일 등록을 둘 다 해야 한다는 규칙이 실제로 작동한다는 뜻이고, 등록을 더한
뒤 다시 exit 0 이 됐다.

## 레인

선언된 파일 206개에 파생 테스트 11개를 더해 217개를 돌렸다. 테스트 2709건 통과, 실패 0,
건너뜀 0. 실행 시간은 134초다. 같은 트리에서 두 번 쟀고 135초와 136초가 나왔다.

비교 기준으로 받은 137.28초·207파일은 동시 부하가 있던 역사적 참고값이다. 파일이 열 개 늘고
시간이 1초 줄었다는 것을 "테스트를 늘려도 공짜" 라는 결론으로 쓰면 안 된다. 두 측정의 부하
조건이 다르고, 늘어난 파생 테스트는 대부분 순수 함수 호출이라 원래 싸다. 여기서 말할 수 있는
것은 레인 시간이 눈에 띄게 늘지 않았다는 것뿐이다.

## 가드 유발 확인

`src/clawsweeper-text.ts` 에 한 줄을 넣고 `check:scaffold` 를 돌린 뒤 복원했다. 복원은
`trap restore EXIT INT TERM` 으로 걸어 중간에 죽어도 변조가 남지 않게 했다.

| 값 | |
| -- | -- |
| 변조 전 sha256 | `fa23270af2e1c53b2ffac74f63476ec3974dd26e4258b10427990d0841782a0c` |
| 변조 후 sha256 | `76b1142449a872ee38b77715ab18a3c4e28ae227556bcef7deae3a13749a87c1` |
| 변조 상태 `check:scaffold` | exit 1, `Upstream bytes changed: src/clawsweeper-text.ts` |
| 복원 후 sha256 | `fa23270af2e1c53b2ffac74f63476ec3974dd26e4258b10427990d0841782a0c` (변조 전과 동일) |
| 복원 후 `check:scaffold` | exit 0 |

## 탐지기

`lina:contract-selftest` 한 줄 요약에 그대로 찍힌다.

```
derivedTestContract=26 derivedCases=140 derivedLaunches=0 launchControl=1 coverageMap=verified
```

`launchControl=1` 이 양성 대조다. sentinel 기동 한 건을 같은 훅이 이름까지 기록했고, 그
다음에 `derivedLaunches=0` 을 받았다. `derivedCases=140` 은 관측 실행에서 실제로 통과한
파생 케이스 수다. 0건과 "아무것도 안 돌았다" 를 구분하려고 함께 단언한다.

`coverageMap=verified` 는 대응표가 두 테스트 집합과 아직 일치한다는 뜻이다. 정적 쪽 양성 대조는 `derivedTestContract=26` 안에 들어 있다. 선언된 파일의 본문을
`test/helpers/command-intake-fixture.mjs` 를 import 하는 한 줄로 바꿔 먹이면 계약이
`derived-test-spawns` 로 거부하고, 거부 메시지가 그 helper 경로를 지목한다. 본문만 보는 스캔은
이 대조를 통과하지 못한다.

## 실패 대조

회복한 기대값을 일부러 틀린 값으로 바꿔 검사가 그것을 잡는지 봤다. 일곱 건 전부 잡혔고, 일곱 건
모두 원래 바이트로 복원됐다. 영수증은 `evidence/failure_controls.json` 에 있다.

처음 만든 대조 중 하나는 버렸다. 거부 목록에서 입력 하나를 빼는 변조였는데, 그건 틀린 결과가
아니라 검사 대상이 줄어드는 변조라서 원래 실패할 수 없다. 그 자리를 `assert.throws` 를
`assert.doesNotThrow` 로 뒤집는 변조로 바꿨다.

## 고치지 않고 보고하는 것

`dashboard/github-api.ts` 의 `githubAppJson` 은 `githubApiUrl` 이 던진 거부를 자기
`try` 블록에서 받아 `GitHubRequestError("... network failure")` 로 다시 던진다. 요청은
실제로 나가지 않지만, 메시지만 보면 미설정 거부와 나갔다가 실패한 요청을 구분할 수 없다.
제품 동작을 바꾸지 않기로 했으므로 손대지 않았고, 대신 회복 테스트가 메시지 대신 "요청이 한 번도
시도되지 않았다" 를 단언한다. 진단 가능성을 개선할 자리로 보이지만 그 판단은 이 PR 밖이다.

## 확인하지 못한 것

upstream 전체 테스트와 `check` 는 파킹된 워크플로 경로를 전제하므로 여기서 돌리지 않았고
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


### 2라운드 (head 1e3b8c0e)

Devin 이 앞의 세 건을 Resolved 로 닫았고 네 건이 새로 붙었다. Devin Review 체크는 SUCCESS.

#### 4. 변수에 담은 createRequire 는 여전히 안 보인다 (Codex P2 + Devin 분석, 같은 건)

맞다. 1라운드 수정은 즉시 호출 형태만 따라갔고 `const load = createRequire(...); load("./x")` 는
빠져나갔다. 바인딩을 먼저 모으고 그 이름으로 하는 호출을 읽도록 고쳤다.

여기서 한 발 더 갔다. 정적 스캔이 따라갈 수 없는 형태, 이를테면 로더를 인자로 넘기거나 재대입하는
경우를 "못 찾았다" 로 읽지 않고 `derived-test-unresolvable-require` 로 거부한다. 따라갈 수
있거나 거부되거나 둘 중 하나다. 이 저장소가 실제로 쓰는 형태, 즉 import 로 들여와 즉시 호출하는
쪽은 그대로 통과해야 하므로 그 음성 대조도 같이 넣었다.

#### 5. 줄 단위 스캔이 두 방향으로 틀린다 (Codex P2)

맞다. `test(` 다음 줄에 이름이 오면 못 세고, 블록 주석 안의 `test("...")` 는 세어
버렸다. 둘 다 표는 그대로인데 실제 레코드 집합은 바뀐 상태를 만든다.

문자열과 템플릿 리터럴을 구분하는 주석 제거기를 넣고, 그 위에서 줄바꿈을 건너뛰는 선언 매칭을
한다. `https://` 의 슬래시 두 개를 주석으로 지우면 안 되기 때문에 단순 치환은 쓰지 않았다.
대조 네 개를 selftest 에 넣었다. 여러 줄 선언은 세고, 블록 주석과 줄 주석 안은 세지 않고, 문자열
안의 주석 표시는 살린다. 바꾼 뒤 집계는 144/122/9/13 으로 그 시점과 같았다.

#### 6. 대응표가 skip 된 레코드를 회복으로 인증한다 (Devin 버그)

맞는 지적이고 실제로 구멍이었다. 이름만 읽으면 `{ skip: true }` 가 붙은 선언과 도는 선언을
구분할 수 없다.

두 군데를 고쳤다. 생성기는 선언의 옵션 인자를 읽어 skip 과 todo 를 실행되지 않는 것으로 보고
회복에서 뺀다. 그리고 관측 실행과 대응표를 묶었다. 표가 회복이라고 부른 레코드는 관측
실행의 통과 목록에 이름이 실제로 있어야 한다. 합계 하한만으로는 한 건이 skip 되고 다른 한 건이
추가되는 교환을 못 잡는다는 지적이 맞아서, 하한은 남기고 이름 대조를 더했다.

대조가 실제로 도는지도 확인했다. 회복 케이스 하나에 `{ skip: true }` 를 붙이고 selftest 를
돌리면 exit 1 로 멈춘다.

```
[lina-check-contract-selftest] observed 139 derived cases, below the floor of 140
```

파일은 원래 바이트로 복원했고 sha256 이 일치하는 것까지 확인했다.

#### 7. 040 의 탐지기 수치가 낡았다 (Devin 분석)

맞다. 1라운드 수정으로 대조가 14건에서 늘었는데 문서는 14 그대로였다. 현재 head 의 값으로
고쳤다. 같은 정리에서 이 문서와 `030_detectors.md` 에 남아 있던 이스케이프된 백틱도 걷어냈다.

### 3라운드 (head 46e30a74)

Devin 이 4·6·7번을 Resolved 로 닫았다. 네 건이 새로 붙었고 Devin Review 체크는 SUCCESS.

#### 8. 이름을 바꿔 들여온 createRequire 와 넘겨진 로더 (Codex P2 + Devin 버그, 같은 건)

맞다. 2라운드 수정은 `createRequire` 라는 철자에 묶여 있었다.
`import { createRequire as makeRequire }` 로 들여오면 그 철자가 사라지고, 바인딩을 잡아도
그 뒤에 로더를 다른 함수에 넘겨 버리면 다시 안 보인다.

철자 대신 이름 집합으로 바꿨다. `node:module` 에서 들여온 이름을 별칭까지 모으고, 그 이름의
모든 사용을 세 갈래로만 인정한다. 즉시 호출, 리터럴로 부르는 로더 바인딩, 그리고 그 둘의 별칭 형태다.
나머지는 전부 `derived-test-unresolvable-require` 로 거부한다. 로더를 넘기는 것도,
계산된 값으로 부르는 것도 거부다.

이 저장소가 실제로 쓰는 형태는 통과해야 하므로 음성 대조를 정확한 모양으로 고쳤다. 파생 webhook
테스트의 `createRequire(import.meta.url)("node:fs") as { ... }` 와 그 뒤의 속성 대입까지
포함한 형태다. 대조가 14건에서 34건이 됐다.

#### 9. 회복 인증은 여전히 이름 기반이다 (Devin 분석)

맞다. 그리고 이건 고치지 않고 경계로 적는다.

표가 주장하는 것은 그 이름의 케이스가 파생 스위트에 있고 관측 실행에서 실제로 통과했다는 것까지다.
그 케이스 안의 단언이 원본과 같은 강도인지는 이름으로 알 수 없고, 어떤 정적 대조로도 알 수 없다.
그 자리를 받는 것은 실패 대조다. 회복한 기대값을 틀린 값으로 바꿨을 때 잡히는지를 일곱 건 재서
`evidence/failure_controls.json` 에 남겼다. 그것도 전수가 아니라 표본이다. 표가 주장하지 않는
것은 `020_correspondence.md` 마지막 절에 그대로 적혀 있다.

#### 10. PR 본문의 탐지기 수치가 낡았다 (Devin 분석)

맞다. 문서만 고치고 PR 본문을 안 고쳤다. 현재 head 값으로 다시 썼다.

#### 11. 끝줄 빈 줄 (Devin 분석)

`git diff --check` 가 이 문서와 파생 webhook 테스트의 EOF 빈 줄을 잡았다. 둘 다 지웠고
지금은 `git diff --check` 가 조용하다.

### 4라운드 — 리뷰에서 제안한 표본 확대

9번(회복 인증이 이름 기반이라는 지적)에 답하면서, 실패 대조 표본을 넓히겠다고 했다. 그걸 했다.

대조를 저장소 안 `scripts/lina-check-failure-controls.mjs` 로 옮기고 회복 스위트마다 하나씩,
열 스위트에 대조 11개를 둔다. 전부 잡혔고 전부 원래 바이트로 복원됐다.

게이트로는 넣지 않았다. 이 도구는 도는 동안 테스트 파일을 고친다. 트리를 건드리는 게이트는 그것이
만드는 증거보다 위험이 크다고 봤다. `lina:contract-selftest` 는 읽기만 하는 상태로 둔다.

여전히 표본이다. 각 스위트가 틀린 결과 하나에는 반응한다는 것을 보일 뿐, 그 안의 모든 단언이
살아 있다는 증명은 아니다. 그 경계는 `020_correspondence.md` 와 이 문서에 적어 둔다.

### 5라운드 — 넘겨짚은 제외를 되돌림

wp3 를 다시 열면서 대응표의 부분 9건을 들여다봤다. 그중 8건이 `handleGitHubWebhook` 을 쓴다는
이유 하나로 묶여 있었는데, 그 필터는 그 핸들러가 정말 서버를 필요로 하는지 확인한 적이 없었다.
확인해 보니 loopback 서버를 여는 것은 한 건뿐이었다.

나머지 7건을 파생 스위트로 올렸고 전부 통과한다. 설치 프로필 대역은 그대로고 요청 경계만 막으면
같은 프로세스에서 끝까지 돈다. 집계가 144 = 회복 129 / 부분 2 / 영구 손실 13 으로 바뀌었다.
관측 케이스 수는 140에서 147로 늘었고 하한도 같이 올렸다.

남은 부분 2건은 성격이 다르다. 하나는 loopback 서버가 있어야 하는 webhook 마감 케이스,
다른 하나는 이 포크가 가드로 바꾼 package 명령 계약이다. 영구 손실 13건은 그대로다.

처음 제외를 넓게 잡은 것은 내 실수다. 이름으로 묶어 판단했고, 그 판단이 대응표에 부분 8건으로
그대로 굳을 뻔했다.

## 이 인도에서 내가 틀린 곳

고친 뒤 지우지 않고 남긴다. 게이트가 잡아 준 것과 리뷰가 잡아 준 것을 구분하는 데 필요한 기록이다.

**게이트 결과를 읽지 않고 push 한 게 두 번.** `682559c7` 와 `01e2727c` 다. 둘 다 스윕에서
lint 가 exit 1 이었는데 마지막 줄만 보고 커밋했다. 앞의 것은 `prefer-set-size`, 뒤의 것은 생성기를
다시 돌리면서 되살아난 미사용 import 였다. 각각 `3673678f` 와 `212c52a0` 에서 고쳤고
지금은 여덟 게이트가 전부 exit 0 이다. 게이트가 초록불이라는 말은 그 스윕의 EXIT 값을 전부 봤다는
뜻이어야 하는데, 두 번은 그러지 않았다.

**생성기를 import 하면 그 파일이 다시 쓰인다.** webhook 생성기가 ledger 생성기를 import 해서 함수를
가져오는데, import 자체가 ledger 생성을 다시 돌린다. 그래서 손으로 고친 두 가지(미사용 import,
파킹된 워크플로 경로)가 두 번 되돌아갔다. 생성기는 이제 다 돌았으니 더 재발하지 않지만, 저장소에
남는 것은 생성기가 아니라 생성 결과라는 점은 적어 둔다.

**제외를 이름으로 묶었다.** `handleGitHubWebhook` 을 쓰는 케이스 여덟 개를 "HTTP 와 durable intake" 로
한꺼번에 부분 처리했는데, 실제로 서버가 필요한 건 한 건이었다. 5라운드에서 일곱 건을 되살렸다.
리뷰어가 짚어 준 게 아니라 내가 다시 열어 보고 찾은 것이고, 그래서 더 적어 둘 필요가 있다.
표에 "부분" 으로 굳었으면 아무도 다시 안 열어 봤을 자리다.

## 최종 head 기준 재측정

인도 시점 head `212c52a0` 에서 여덟 게이트 전부 exit 0, 레인 134초다. selftest 요약은
다음과 같다.

```
[lina-check-contract-selftest] derivedTestContract=34 derivedCases=147 derivedLaunches=0 launchControl=1 coverageMap=verified
[lina-check-coverage-map] current: 144 records, 129 recovered, 2 partial, 13 lost
[lina-check-failure-controls] suites=10 controls=11 detected=11 undetected=0
```

가드 유발도 이 head 에서 다시 쟀다. 값은 처음 측정과 같다.

| 값 | |
| -- | -- |
| 변조 전 sha256 | `fa23270af2e1c53b2ffac74f63476ec3974dd26e4258b10427990d0841782a0c` |
| 변조 후 sha256 | `76b1142449a872ee38b77715ab18a3c4e28ae227556bcef7deae3a13749a87c1` |
| 변조 상태 `check:scaffold` | exit 1, `Upstream bytes changed: src/clawsweeper-text.ts` |
| 복원 후 sha256 | 변조 전과 동일 |
| 복원 후 `check:scaffold` | exit 0 |

## 리뷰 최종 상태

리뷰어 라운드는 다섯 번 돌았다. 앞의 세 번이 지적을 냈고(합계 11건), 네 번째와 다섯 번째는
지적 없이 지나갔다. Devin 은 자기 지적 여섯 건을 이름을 붙여 Resolved 로 닫았다.

| 라운드 | head | 결과 |
| -- | -- | -- |
| 1 | `dd97f6fe` | Codex 1건, Devin 3건. closure 의 CommonJS 누락, 임시 디렉터리 누수, 검사되지 않는 생성기 |
| 2 | `1e3b8c0e` | Codex 2건, Devin 2건. 변수에 담은 로더, 줄 단위 스캔, skip 레코드, 낡은 수치 |
| 3 | `46e30a74` | Codex 1건, Devin 3건. 별칭 import, 이름 기반 인증(반박), PR 본문 수치, 끝줄 공백 |
| 4 | `fab3835d` · `3673678f` | Devin SUCCESS, 신규 지적 없음 |
| 5 | `9fdc12c9` | Devin SUCCESS, 신규 지적 없음 |

11건 중 10건은 수정 커밋으로 처리했고 1건은 반박했다. 반박한 것은 회복 인증이 이름 기반이라는
지적인데, 케이스 안의 단언 강도는 어떤 정적 검사로도 알 수 없어서 실패 대조를 표본 증거로 두고
경계를 문서에 적는 쪽을 골랐다. 그 답을 하면서 표본을 다섯 스위트에서 열 스위트로 넓혔다.

인도 시점의 PR 상태는 OPEN·non-draft·MERGEABLE 이고 `Devin Review=SUCCESS` 다. 머지는
부모가 한다. 이 저장소의 정책상 upstream 전체 `test`·`check` 는 파킹된 워크플로 경로를
전제하므로 여기서 돌리지 않았고 통과로 보고하지 않는다.
