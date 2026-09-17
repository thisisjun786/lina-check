# 010 · 파일별 회복 방법

제외 열 파일을 하나씩 열어 원인을 확인하고, 회복 파일이 무엇을 어떻게 다시 부를지 정했다.
여기 적은 것이 `020_correspondence.md` 의 레코드별 판정을 만드는 근거다.

## 먼저 적어 둘 한 가지

이 저장소는 upstream 바이트를 pin 에 고정한다. `check:scaffold` 가 선언된 일곱 개를 뺀
모든 upstream 파일의 해시를 pin 과 비교한다. 그래서 회복한 검사가 잡을 수 있는 회귀는
두 종류뿐이다. 하나는 이 포크가 바꾼 일곱 파일과 그 빌드 산출물의 동작 변화, 다른 하나는
나중에 이 포크가 적응 작업으로 upstream 파일을 건드릴 때의 변화다. 고정된 바이트를 상대로
한 단언이 오늘 초록불인 것은 당연하고, 그 사실이 그 단언을 무의미하게 만들지는 않는다.
회복의 값어치는 "지금 무언가를 잡는다" 가 아니라 "다음 적응이 이 자리를 건드리면 잡힌다" 다.

## 파일별

### `test/actions-runtime.test.ts` (3)

원인은 절대경로가 아니다. 테스트가 `.github` 와 `docs` 를 재귀 순회하면서
`/\.(?:md|ya?ml)$/` 로 거른다. 이 포크의 워크플로는 `.yml.disabled` 라서 필터에 걸리지
않고, 순회 범위가 조용히 줄어든 채로 통과한다. 회복 파일은 같은 순회를 하되 `.disabled`
꼬리표를 붙인 파일까지 포함하고, 포함된 워크플로 수가 0이 아님을 먼저 단언한다. 범위가
줄어든 상태를 통과로 읽지 않기 위해서다. 기대값은 원본과 같은 고정 문자열
(액션 pin, `actions/cache@v6` 세 형태)이다.

### `test/dashboard-github-api.test.ts` (3)

원인은 `githubApiUrl` 이 `githubTransportPermitted(env)` 를 먼저 보고 미설정 설치를
거부하는 것이다. `githubApiBaseUrl` 자체는 거부하지 않는다. 회복 파일은 두 갈래를 나눈다.
자격증명이 든 env 를 넘겨 URL 생성과 loopback override 검증을 원본 그대로 되살리고,
빈 env 에서는 거부가 나는 것을 따로 단언한다. 거부만 검사하면 "전부 거부" 회귀를 못 잡고,
통과만 검사하면 JUN-198 이 세운 거부를 못 지킨다.

### `test/github-response-deadlines.test.ts` (8)

같은 거부가 원인이고, 증상이 더 나쁘다. 요청이 시작되기 전에 거부되므로 스위트가 기다리는
promise 가 풀리지 않는다. `githubAppJson` 과 `exactReviewTerminalRun` 은 둘 다 마지막
인자로 env 를 받으므로, 자격증명이 든 env 를 넘기면 mock 한 `fetch` 까지 도달한다.
회복 파일은 원본과 같은 여덟 조합(두 읽기 경로 x 200/503/429 + JSON 파싱 실패)을 돌리되,
요청 시작 전에 실패하는 경우도 유한 시간에 끝나도록 거부 경로를 `assert.rejects` 로 따로
받는다.

### `test/hosted-target-admission.test.ts` (7)

절대경로 문제가 아니다. 워크플로를 cwd 상대경로로 읽고, 설치 프로필 없이 허용을 기대한다.
정책 합성·레지스트리 마감·metadata 분류·재시도 힌트 네 갈래는 설정된 프로필을 만들어 주면
회복된다. heredoc 을 실제로 실행하는 케이스는 자식 프로세스라서 이 경계에서 회복 불가다.
워크플로 텍스트 계약 케이스는 파킹된 `.yml.disabled` 를 읽어 되살린다.

### `test/repair/comment-webhook.test.ts` (38)

38 중 27 이 admission 불일치이고 나머지 11 은 다른 이유다. 이 둘을 뭉뚱그리지 않는다.
분류기 세 갈래(`classifyIssueCommentWebhook`·`classifyItemWebhook`·`classifyWebhook`)는
설정된 설치 프로필을 실제 admission 경로에 태워 양방향으로 되살린다. 미설정에서 거부되고,
명시 허가에서 통과하고, 허가되지 않은 대상은 다시 거부되는 세 갈래를 한 자리에서 본다.
`handleGitHubWebhook` 을 쓰는 케이스는 HTTP 서버와 durable intake 를 함께 돌리므로 여기서
되살리지 않는다. `startIntakeFixture` 를 쓰는 마지막 케이스는 helper 가 `fork()` 하므로
영구 손실이다. 적응형 timeout·서명 검증·fast ack 렌더는 admission 과 무관한 순수 함수라
그대로 회복된다.

### `test/review-close-policy.test.ts` (33)

`import.meta.url` 로 저장소 root 를 잡아 `.github/workflows/sweep.yml` 을 여는 것이 원인이
맞다. 닫기 판단·보호 라벨·provenance·gh 파서 계열은 `dist/clawsweeper.js` 의 순수 함수라
fixture 만 직접 적으면 회복된다. `test/helpers.ts` 는 import 하지 않는다. 워크플로를 읽는
케이스는 `.yml.disabled` 를 열어 같은 단언을 되살린다.

### `test/scheduled-review-noop.test.ts` (7)

앞 여섯 분류기 케이스는 `scripts/classify-scheduled-review-noop.ts` 를 직접 불러 회복된다.
마지막 `runReadScopeProof()` 는 실제 bash 를 띄우므로 회복 불가다. 그 import 자체가 모듈
최상단에 있으므로 회복 파일은 그 모듈을 아예 들여오지 않는다.

### `test/clawsweeper-action-ledger.test.ts` (26)

`main(["check"])` 이 모듈 위치에서 저장소 root 를 계산해 `sweep.yml` 을 찾는 것이 원인이다.
`main` 을 부르는 일곱 케이스는 회복 불가다. 결과 분류기·멱등 신원·게시 경로 정렬은 순수
함수이므로 회복된다. `readText("src/...")` 로 소스 텍스트를 검사하는 케이스는 파일이 그대로
있으므로 되살아나지만, 그것이 검사하는 것은 동작이 아니라 고정된 소스 텍스트다.

### `test/exact-review-failure-telemetry.test.ts` (12)

달력 의존이 원인이다. `listSync` 를 `now` 없이 부르면 `Date.now()` 기준 보존 창이 적용돼
결과가 실행일에 따라 달라진다. 제품에 이미 `listSync({now})` 가 있으므로 제품 변경 없이
고정 시각을 넘겨 열두 케이스 전부 회복한다. harness 는 `test/dashboard-worker-harness.ts`
대신 회복 파일 안의 메모리 저장소로 대체한다.

### `test/run-node-tests.test.ts` (7)

runner 대체가 아니라 package 명령 대체가 원인이다. `scripts/run-node-tests.mjs` 는 pin 과
바이트가 같다. 러너 순수 함수 여섯 갈래는 그대로 회복하고, 조합 스크립트 계약을 검사하던
케이스는 이 포크가 그 명령들을 가드로 바꿨다는 사실을 단언하는 쪽으로 바꿔 되살린다.
원본이 검사하던 "빌드를 다시 시작하지 않는다" 라는 성질은 가드 아래에서 성립하지 않으므로
같은 단언을 유지하지 않고, 바뀐 계약을 명시적으로 적는다.
