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

거부 코드는 여덟이다. 앞의 넷이 적재와 표면, 뒤의 넷이 관측과 경계다.

| 코드 | 언제 |
| -- | -- |
| `derived-test-spawns` | closure 안의 어떤 파일이든 금지 표면을 갖고 있을 때. 메시지가 그 파일을 지목한다 |
| `derived-test-unreadable` | 선언된 테스트가 읽을 수 없는 파일을 가리킬 때. 덜 훑는 대신 멈춘다 |
| `derived-test-unresolvable-require` | 따라갈 수 없는 로더 형태를 썼을 때 |
| `derived-test-unresolvable-import` | 동적 import 의 지정자가 리터럴이 아닐 때 |
| `derived-test-observation-signal` | 관측 신호 이름이 소스에 있을 때 |
| `derived-test-computed-observation` | process 객체에 이 스캔이 읽을 수 없는 형태로 닿을 때 |
| `derived-test-undeclared-import` | 테스트 트리 밖 적재가 선언된 천장에 없을 때 |
| `derived-test-unlisted-module` | 맨 지정자가 허용 목록에 없을 때 |

## 관측 신호 — 이름을 읽을 수 없으면 거부

관측 실행과 레인 실행은 어딘가에서 반드시 다르다. 그래서 구별 불가능을 쫓는 대신 파생 테스트가
구별에 쓸 수 있는 것을 읽지 못하게 했다. `argv`·`execArgv`·`NODE_OPTIONS`·
`LINA_CHECK_LAUNCH_LOG`·`FORCE_COLOR`·`NO_COLOR`·`NODE_TEST_CONTEXT` 는 식별자
경계로 금지된다. `process.execPath` 는 허용이다. 그건 호출 방식이 아니라 인터프리터 경로이고,
회복한 러너 케이스가 필요로 한다.

이름을 보는 검사는 이름이 소스에 적혀 있는 동안에만 결정 가능하다. `process["arg" + "v"]` 는
같은 속성에 닿으면서 두 조각 어느 쪽도 그 이름이 아니다. 키를 평가하는 것은 텍스트 스캔이 할 수
있는 일이 아니므로, 이 파일이 다른 자리에서 쓰는 규칙을 그대로 적용했다. **읽을 수 없는 형태를
거부해서, 토큰 검사가 읽을 수 있는 철자만 남긴다.**

| 형태 | 처분 |
| -- | -- |
| `process.env.<name>` | 허용. 토큰 검사가 `<name>` 을 읽는다 |
| `process.env["<name>"]` | 허용. 리터럴이 스캔되는 소스에 그대로 있다 |
| `process.env[key] = v`, `delete process.env[key]` | 허용. 쓰기와 삭제는 테스트에게 아무것도 돌려주지 않는다 |
| `process.execPath` | 허용. 호출 방식이 아니라 인터프리터 경로다 |
| 그 밖의 `process.<name>` | 거부. 허용 속성은 `env` 와 `execPath` 둘뿐이다 |
| `process[...]`, 맨 `process`, `const { ... } = process` | 거부 |
| `globalThis[...]`, `global[...]` | 거부 |
| `import ... from "node:process"` | 거부 |

`import.meta` 도 같은 모양으로 묶는다. 허용 속성은 `url` 하나다. `import.meta.main` 은
레인이 `node --test` 로 파일을 띄우면 참이고 관측이 직접 import 하면 거짓이라, 금지 신호를 하나도
적지 않고 어느 실행인지 알려 준다. closure 에서 실제로 쓰이는 것은 `url` 11회뿐이다.

구성된 코드를 실행하는 전역 `eval`·`Function`·`AsyncFunction`·`GeneratorFunction` 은 호출
모양이 아니라 이름으로 막는다. 호출 앞에는 공백이 올 수 있고, `Function` 은 `new` 없이도 불리며,
둘 다 바인딩에 먼저 담을 수 있다. 호출 철자에 묶인 검사는 공백 하나로 전부 놓친다. closure 에는
두 이름이 한 번도 나오지 않는다.

`node:vm` 의 평가 표면도 이름으로 막는다. `runInThisContext`·`runInNewContext`·
`runInContext`·`compileFunction`·`createScript`·`SourceTextModule`·`SyntheticModule` 이고,
`Script` 와 `createContext` 는 여기 없다. 빠진 것이 핵심이다. 업스트림 핀이 걸린
`test/dashboard-worker-harness.ts` 가 그 둘을 node:vm 에서 들여와 재수출만 하고 아무것도 평가하지
않는다. 컴파일된 스크립트를 실제로 돌리려면 위 이름 중 하나를 써야 하고, 그 일곱은 closure 어디에도
없다. 핀 덕분에 그 파일의 바이트가 바뀌지 않았다는 것은 `check:scaffold` 가 증명한다. 두 이름까지
막으면 회복 스위트 하나를 아무 대가 없이 잃는다.

### 맨 지정자도 목록이다

테스트 트리 밖 상대 경로는 선언으로 묶었지만, 맨 지정자(`node:*` 와 패키지)는 그냥 통과하고
있었다. 그게 이 스캔에 마지막으로 남아 있던 조용한 통과다. `node:vm` 은 문자열을 컴파일하고
`node:repl`·`node:inspector` 는 그것을 실행한다. 하나씩 막으면 이 파일이 이미 세 번 돈 순서를
또 돈다. 그래서 허용 목록으로 뒤집었다. closure 가 실제로 쓰는 열세 개다.

`node:assert/strict`, `node:crypto`, `node:events`, `node:fs`, `node:module`, `node:os`,
`node:path`, `node:sqlite`, `node:test`, `node:timers/promises`, `node:util`, `node:vm`,
`node:zlib`.

목록에 없는 빌트인, 패키지, 절대 경로는 `derived-test-unlisted-module` 로 거부된다. 이 검사는
토큰 검사 뒤에 돈다. 금지 표면을 들여오는 지정자는 목록 밖이라는 이유보다 그 표면 때문에 거부되는
편이 더 강한 진술이고, selftest 의 기존 대조들도 그 순서를 전제한다.

### 이스케이프된 식별자

JavaScript 는 식별자 안의 `\u` 이스케이프를 해석한다. `pro\u0063ess.arg\u0076` 는 인자
벡터인데 금지 단어는 어느 쪽도 텍스트에 없다. 이 파일의 모든 규칙이 텍스트를 읽으므로 이 문제는
규칙들보다 앞에서 끝내야 한다.

해석하지 않고 거부한다. `codeOnly` 가 문자열·주석·정규식을 이미 비웠으므로 그 사본에 남은
backslash-u 는 이스케이프된 식별자일 수밖에 없고, closure 에는 하나도 없다. 해석하는 쪽을 고르면
이 함수가 계산하는 모든 오프셋이 밀리는데 얻는 것이 없다.

### node:module 바인딩의 속성

네임스페이스 import 와 default import 는 `바인딩.createRequire` 라는 철자로만 추적됐다.
`바인딩["create" + "Require"]` 는 같은 팩토리에 닿으면서 그 철자를 쓰지 않는다. 답은 이 파일의
다른 자리와 같다. 읽을 수 있는 것을 적고 나머지는 거부한다. 허용 속성은 `createRequire` 와
`syncBuiltinESMExports` 이고, 계산된 접근·목록 밖 속성·바인딩 자체를 값으로 넘기는 것은 전부
`derived-test-unresolvable-require` 다. closure 에는 네임스페이스 import 가 없다.

같은 목록을 named import 에도 적용한다. 그 전에는 `createRequire` 만 읽고 나머지 export 는
암묵 허용이었다. `register` 는 모듈 커스터마이제이션 훅을 설치하고, 그 훅은 이 isolate 밖에서
돌아서 관측의 계측이 닿지 않는다. 목록에 없는 named import 는 거부한다.

### 계산된 이름으로 하는 메서드 호출

`new Script("...")["run" + "InThisContext"]()` 는 허용된 객체를 금지된 동사로 되돌린다. 이름
어느 쪽도 텍스트에 없다. 계산된 멤버 접근을 전부 막는 것은 아니다. `rows[i]` 나
`scripts[name]` 같은 인덱스 읽기는 closure 곳곳에 있고 평범하다. 막는 것은 계산된 이름으로
**호출**하는 형태다. 그 형태는 closure 에 하나도 없고, 허용된 객체를 다시 위험하게 만드는 것도
그 형태다. 리터럴 키로 하는 호출은 그대로 통과한다.

메서드를 먼저 꺼내는 형태도 같이 막는다. `const { ["run" + "InThisContext"]: go } = script` 는
대괄호 뒤에 괄호가 없어서 위 규칙에 걸리지 않는다. 구조 분해 패턴과 객체 리터럴은 뒤따르는 대입으로
구분한다. 리터럴은 값을 만들고 패턴은 값을 읽으며, 하네스가 `{ [item.key]: item }` 을 만든다.

호출 스택도 관측 신호다. `new Error().stack` 에는 관측이 만든 러너 경로가, 레인에는 그쪽 진입
프레임이 들어간다. 인자 벡터와 같은 답을 준다. `.stack`·`captureStackTrace`·
`prepareStackTrace` 를 막는다.

### codeOnly 의 보간 처리

`codeOnly` 가 ``${...}`` 의 깊이를 원시 중괄호로 셌다. 보간 안의 문자열이나 주석에 들어 있는
`}` 가 깊이를 먼저 0으로 만들고, 그 뒤의 코드는 템플릿 텍스트로 비워졌다. 즉 스캐너가 읽어야 할
코드를 스스로 지웠다. 이제 구조별 프레임을 쌓는다. 보간은 코드 프레임을 밀고, 문자열·템플릿·주석·
정규식은 각자의 프레임에서 처리되므로 그 안의 중괄호는 보간을 끝내지 못한다. 중첩 템플릿도 같이
처리된다. 대조는 ``${"}" + process.report.getReport()}`` 를 먹여서 거부되는지 본다. 옛 계산법에서는
통과한다.

속성을 허용 목록으로 둔 것은 금지 목록이 틀린 모양이기 때문이다.
`process.report.getReport().header.commandLine` 은 `argv` 라는 철자 없이 호출 방식을 말해 준다.
그런 속성을 하나씩 막으면 목록이 끝나지 않는다. 뒤집으면 끝난다. 파생 테스트에 필요한 것은 대역
처리하는 환경과 회복한 러너 케이스가 비교하는 인터프리터 경로뿐이고, 이 객체에서 그 밖에 쓰는 것은
없다. closure 전체에서 실제로 쓰이는 속성은 `env` 34회, `execPath` 1회다.

맨 `process` 를 거부하는 이유는 바인딩 하나가 위의 모든 질문을 한 이름 뒤로 옮기기 때문이다.
`globalThis` 의 대괄호 접근을 거부하는 이유도 같다. 이름을 적지 않고 process 객체를 가리킬 수
있는 유일한 형태다.

허용 목록은 process 객체에서 처음 읽는 속성만 묶는다. 그 값이 무엇을 할 수 있는지는 묶지 않는다.
JavaScript 의 모든 값은 프로토타입 체인을 타고 Function 생성자에 닿으므로
`process.execPath.constructor.constructor` 로 코드를 만들어 process 객체를 이 스캔이 보지 못하는
이름으로 되돌려 받을 수 있다. 이 경로는 process 가 없어도 된다. `[].constructor.constructor` 가
같은 것이다. 그래서 process 규칙이 아니라 따로 막는다. 이름이 적히는 형태는 전부 거부한다.
`.constructor`, `["constructor"]`, `__proto__`, `Reflect.` 다. 클래스 본문의
`constructor(` 는 선언이지 접근이 아니라서 통과하고(하네스가 여럿 갖고 있다),
`Object.getPrototypeOf` 도 통과한다. 위의 constructor 접근이 막힌 뒤의 프로토타입은 아무것도
하지 못한다.

여기까지가 텍스트 스캔이 결정할 수 있는 범위다. 남는 것은 임의 객체에 대한 계산된 키 접근이다.
`new Map(Object.entries(x)).get("proc" + "ess")` 같은 형태는 문법만으로는 이름 있는 접근과
구분되지 않고, 인덱스 접근을 전부 금지하면 평범한 테스트 코드가 못 돌아간다. 그 자리는 스캔이
아니라 리뷰가 받는다. 계약과 파생 테스트는 같은 커밋에 있고 같이 리뷰된다. 파생 테스트에 그런
조립 코드를 넣을 수 있는 사람은 계약 자체를 지울 수도 있다. 이 탐지기들이 잡는 것은 사고와 표류,
그리고 리뷰에서 눈에 띄지 않는 형태이지, 커밋 권한을 가진 적대적 작성자가 아니다.

양성 대조는 거부 서른일곱 개와 허용 열두 개다. 거부 쪽은 `process["arg" + "v"]`, process 를 담은
바인딩, `process.env` 를 담은 바인딩, 계산된 키로 하는 `process.env` 읽기, `globalThis` 의
계산된 접근, `node:process` import, `process` 구조 분해, `process.report` 를 통한 명령줄 읽기,
`process.stdout.write`, 리플렉션 경로 다섯, 동적 코드 전역 셋(`new` 없는 `Function`, 공백을 낀
호출, 바인딩에 담은 `Function`), `import.meta` 둘, `node:vm` 평가 둘, 목록 밖 지정자 셋(빌트인·
패키지·절대 경로), 이스케이프된 식별자 하나, node:module 네임스페이스 셋, 목록 밖 named import 둘,
계산된 이름으로 하는 메서드 호출 둘, 계산된 키 구조 분해 하나, 호출 스택 둘, 보간 안에 숨긴 접근
하나다.
`process.stdout` 을 막는 것은 덤이
아니다. 관측이 리포터 출력을 읽어 통과 케이스 이름을 뽑으므로, 테스트가 통과 줄을 위조할 수 있으면
대응표 인증이 흔들린다. 허용 쪽은 이 저장소가 실제로 쓰는 아홉 형태다. 계산된 키로 하는 환경 변수
복원(쓰기와 삭제), 리터럴 키 읽기, `t.mock.method(globalThis, "fetch", ...)`,
`process.execPath`, 클래스 본문의 `constructor(`, `Object.getPrototypeOf`,
`import.meta.url`, `node:vm` 의 `Script`·`createContext`, 목록에 있는 `node:assert/strict`,
네임스페이스로 부르는 `syncBuiltinESMExports`, 리터럴 키로 하는 메서드 호출, 계산된 키로 만드는
객체 리터럴.
허용 대조가 없으면 위 규칙은 process 금지와 구분되지 않는다.

## 테스트 트리 밖 적재 — 선언하거나 거부

closure 는 `test/` 안에서만 따라간다. 밖에서는 따라갈 수 없다. 제품 모듈은 정당하게 프로세스
기동 표면을 갖고 있고, 파생 러너 테스트는 `../scripts/run-node-tests.mjs` 를 일부러 import
한다. 그 모듈의 동작이 회복 대상이기 때문이다.

문제는 그 간선을 조용히 버리고 있었다는 점이다. 파생 테스트가 어떤 제품 모듈에 닿아도 아무 데도
기록되지 않았다. 이제 따라가는 대신 선언한다. `DERIVED_TEST_EXTERNAL_IMPORTS` 가 파생 테스트별로
허용된 외부 모듈을 고정 리터럴로 들고 있고, 거기 없는 외부 적재는
`derived-test-undeclared-import` 로 거부된다. 선언은 천장이다. 새 외부 import 는 여기에 적히기
전까지 실패하고, 적히는 자리가 리뷰되는 자리다.

천장은 경로가 아니라 sha256 다이제스트를 담는다. 여기 오는 모듈 중 여럿이 파킹된 upstream
진입점이고, 파생 스크립트는 그 경로를 소스에 적을 수 없다(`script-blocked-target`). 그 규칙을
우회한 것이 아니다. 다이제스트는 로더에 넘길 수 없어서 이 파일은 여전히 그 진입점에 닿지 못한다.
거부 메시지는 읽은 경로를 그대로 찍고, 사람이 읽을 목록은 아래에 있다. 이 문서는 마크다운이라
같은 스캔 대상이 아니다.

| 파생 테스트 | 테스트 트리 밖 적재 |
| -- | -- |
| `lina-check-action-ledger` | `dist/action-ledger.js`, `dist/clawsweeper-apply-lease-guards.js`, `dist/clawsweeper.js`, `dist/github-retry.js` |
| `lina-check-actions-runtime` | 없음 |
| `lina-check-admission` | `dist/hosted-target-admission.js`, `dist/lina-check-installation-contract.js`, `dist/lina-check-installation.js`, `dist/repair/comment-webhook.js`, `dist/repair/target-fanout.js` |
| `lina-check-close-policy` | `dist/clawsweeper.js`, `dist/commit-sweeper.js`, `dist/review-activity-cursor.js` |
| `lina-check-failure-telemetry` | `dashboard/exact-review-direct-publication.ts`, `dashboard/exact-review-failure-telemetry.ts`, `dashboard/exact-review-lifecycle-telemetry.ts`, `dashboard/exact-review-lifecycle.ts`, `dashboard/exact-review-publication-batches.ts`, `dashboard/exact-review-queue.ts`, `dashboard/live-activity.ts`, `dashboard/worker.ts`, `dist/repair/canonical-record-baseline.js`, `dist/repair/publish-main.js` |
| `lina-check-github-api` | `dashboard/github-api.ts` |
| `lina-check-hosted-admission` | `src/hosted-target-admission.ts`, `src/lina-check-installation-contract.ts` |
| `lina-check-node-test-runner` | `scripts/run-node-tests.mjs` |
| `lina-check-response-deadlines` | `dashboard/exact-review-queue.ts`, `dashboard/github-api.ts` |
| `lina-check-scheduled-review` | `dist/clawsweeper.js`, `scripts/classify-scheduled-review-noop.ts` |
| `lina-check-webhook-admission` | `dist/lina-check-installation.js`, `dist/repair/comment-webhook.js`, `dist/repository-profiles.js` |

간선 33개, 서로 다른 모듈 30개다. `test/dashboard-worker-harness.ts` 를 거쳐 닿는 것도 포함한
전이 폐포다.

검사는 한 방향이다. 선언에 있는데 지금 소스에 없는 것은 실패로 보지 않는다. selftest 의 양성 대조가
선언된 테스트의 본문을 두 줄로 갈아 끼우기 때문이고, 양방향이면 그 대조들이 전부 엉뚱한 이유로
실패한다.

천장이 묶는 것은 경로이지 내용이 아니다. 어느 모듈에 닿을 수 있는지가 이 검사의 질문이고, 그
모듈들이 무엇을 담고 있는지는 `build:all` 과 `check:scaffold` 가 따로 본다. 둘 다 필수 게이트다.
내용까지 묶으면 제품 코드를 고칠 때마다 이 목록을 다시 만들어야 하고, 그러면 리뷰어가 읽지 않고
갱신하는 목록이 된다. 지킬 값어치가 있는 성질은 **새** 외부 간선이 누군가 적기 전까지 실패한다는
것이다.

양성 대조는 셋이고 전부 `dashboard/github-api.ts` 를 쓴다. 파킹된 진입점이 아니라서 selftest 가
그 경로를 적을 수 있는 유일한 외부 모듈이다. 그 import 를 ledger 테스트에 심으면 거부되고, 그
천장에 실제로 들어 있는 github-api 테스트에 심으면 통과한다. 수집기가 빈 배열만 돌려줘도 앞의 두
대조는 만족되므로, 실제 파일에서 github-api 테스트의 외부 간선을 한 번 읽어 천장이 그 다이제스트를
갖고 있는지 단언한다.

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

선언된 파생 테스트 열한 개를 파일마다 프로세스 하나씩 띄워 실행하고(레인이 `node --test` 로 하는
것과 같은 모양이다), 그 프로세스에
`node:child_process` 의 일곱 진입점(`spawn`·`spawnSync`·`exec`·`execFile`·
`execFileSync`·`execSync`·`fork`)을 감싼 preload 를 얹는다. 기록은 시도 시점에 남기므로 예외를
삼켜도 남고, `syncBuiltinESMExports()` 로 ESM 바인딩까지 바꾸므로 named import 로 붙잡아 둔 참조도
따라온다.

양성 대조가 먼저다. 같은 preload 아래에서 무해한 sentinel(`node -e ""`)을 띄우고 훅이 그것을 이름까지
기록하는지 확인한다. 그 다음에야 0건을 증거로 받아들인다. selftest 요약의 `launchControl=1` 이 그것이고,
`derivedLaunches=0` 이 관측 결과다.

실행됐는지도 같이 본다. 관측 실행이 exit 0 이고, 통과 케이스 수가 기록된 하한(147) 이상이며, 실패가
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
코드, 그리고 `dgram` 은 빠진다(`worker_threads` 는 18라운드에서 금지 표면에 들어갔다). 이건
적대적 코드에 대한 방어가 아니라 우리가 쓴 파생 테스트와 고정된 pin 에 대한 관측이다.

런타임 관측은 `lina:contract-selftest` 안에서만 돈다. `lina:test-safe` 는 파생 테스트를 계측 없이
돌린다. 둘 다 필수 게이트라 위반은 머지 전에 걸리지만, 레인 자체가 계측되는 것은 아니다.

네트워크는 여기서 세지 않는다. 파생 테스트가 실제 요청을 하지 않는다는 것은 요청 경계를 대역 처리하고
시도 횟수를 0으로 단언하는 쪽(`lina-check-response-deadlines`)에서 따로 본다.

실패 대조는 표본이다. 각 스위트가 틀린 결과 하나에는 반응한다는 것을 보일 뿐, 그 안의 모든 단언이
살아 있다는 증명이 아니다.

대조가 자기가 말한 자리를 고친다는 것도 따로 건다. `String.replace` 는 첫 일치만 바꾸므로 앵커가
파일에 두 번 나오면 대조가 지목하지 않은 자리를 변조한다. 그 자리에서 난 실패도 탐지로 세어지고,
영수증은 돌지도 않은 단언에 대해 민감도를 주장하게 된다. 그래서 앵커는 정확히 한 번 일치해야 하고,
아니면 대조는 시작하지 않는다. close-policy 대조의 앵커가 실제로 두 번 나왔고, 그 앵커에 속한
테스트 이름을 붙여 유일하게 만들었다. selftest 도 같은 것을 대조 열한 개 전부에 대해 단언한다.
