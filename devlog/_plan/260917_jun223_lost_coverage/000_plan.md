# 000 · 계획 — 제외로 기록된 잃은 범위를 파생 테스트로 회복

JUN-223. base `f3f5bd7a`, 브랜치 `codex/lina-lost-coverage`.
실행 패킷은 코디네이터가 준 `070_lost_coverage_packet.md` 이고, 이 문서는 그 패킷을
이 저장소 안에서 실제로 무엇을 건드릴지로 옮긴 것이다.

## 무엇을 하려는가

JUN-203 이 제외한 열 개 파일에는 사유만 있고 그 자리를 대신하는 검사가 없다. 열 파일의
테스트 레코드 144개(최상위 141 + `comment-webhook` 의 중첩 subtest 3)가 지금은 아무도
실행하지 않는다. 이 변경은 그중 이 포크의 경계 안에서 되살릴 수 있는 것을 파생 테스트로
되살리고, 되살릴 수 없는 것은 왜 못 되살리는지를 레코드 단위로 남긴다.

되살린다는 말의 뜻을 좁혀 둔다. 가드가 막는지 확인하거나 워크플로가 파킹돼 있는지 확인하는
것은 원래 동작의 회복이 아니다. 원래 케이스가 검사하던 판단을 같은 입력 모양으로 다시
부르고, 기대값을 제품 바깥의 고정 값으로 적었을 때만 회복으로 센다.

## 계획 단위를 새로 만드는 쪽을 골랐다

등록된 기존 단위에 덧붙이는 쪽도 허용되지만 새 디렉터리를 만든다. 앞의 세 단위는 각각
JUN-135·JUN-198·JUN-203 의 인도 기록이고 그 안의 문장은 그때의 결론으로 고정돼 있다.
이번 대응표는 그 세 단위의 결론을 가로질러 다시 판정하는 문서라서, 남의 인도 기록 안에
끼워 넣으면 어느 판단이 언제 것인지가 흐려진다.

대가는 선언 두 곳이다. `PLAN_UNITS` 에 `devlog/_plan/260917_jun223_lost_coverage` 를
더하고, 이 단위의 모든 파일을 `derived.files` 에 사유와 함께 등록한다. 둘 중 하나만 하면
`derived-undeclared` 로 막힌다.

## 파생 테스트 열 개

제외 파일 하나에 회복 파일 하나를 대응시킨다. 이름은 계약이 요구하는
`test/lina-check-[a-z-]+.test.ts` 를 따른다.

| 원본 제외 파일 | 회복 파일 | 회복하려는 것 |
| -- | -- | -- |
| `actions-runtime` | `test/lina-check-actions-runtime.test.ts` | 파킹된 `.yml.disabled` 까지 포함한 전량 순회 위에서의 액션 pin·소유자 입력·캐시 세대 |
| `dashboard-github-api` | `test/lina-check-github-api.test.ts` | URL 생성과 override 검증, 그리고 transport 허가의 양방향 |
| `github-response-deadlines` | `test/lina-check-response-deadlines.test.ts` | 자격증명이 있는 env 에서 본문 지연이 요청 마감으로 끝나는 동작 |
| `hosted-target-admission` | `test/lina-check-hosted-admission.test.ts` | 정책 합성, 레지스트리 마감, metadata 분류와 재시도 힌트 |
| `repair/comment-webhook` | `test/lina-check-webhook-admission.test.ts` | 분류기 세 갈래의 양방향, 적응형 timeout, 서명, fast ack 렌더 |
| `review-close-policy` | `test/lina-check-close-policy.test.ts` | 닫기 판단·보호 라벨·provenance·gh 파서, 워크플로 정적 검사는 `.disabled` 를 읽어서 |
| `scheduled-review-noop` | `test/lina-check-scheduled-review.test.ts` | claim 시점 분류기 여섯 갈래 |
| `clawsweeper-action-ledger` | `test/lina-check-action-ledger.test.ts` | 결과 분류기, 멱등 신원, 게시 경로 정렬 |
| `exact-review-failure-telemetry` | `test/lina-check-failure-telemetry.test.ts` | `listSync({now})` 로 달력에서 떼어낸 보존·중복 제거·건강 창 |
| `run-node-tests` | `test/lina-check-node-test-runner.test.ts` | 러너 순수 함수 여섯 갈래와 이 포크가 바꾼 package 가드 계약 |

세 가지는 지키고 들어간다. `test/helpers.ts` 를 import 하지 않는다. 그 파일은 맨 위에서
`node:child_process` 를 들여오고 `execFileSync` 를 부른다. 필요한 fixture 는 회복 파일
안에 직접 적는다. 기대값은 제품을 불러 만들지 않고 고정 값으로 적는다. 제품 코드는 한 줄도
바꾸지 않는다.

## 탐지기는 런타임으로, 정적 검사는 테스트 트리로

파생 테스트가 자식 프로세스를 띄우지 않는다는 주장에 두 가지 증거를 붙인다.

런타임 쪽이 주력이다. 파생 테스트를 `node:child_process` 일곱 진입점을 감싼 preload 아래에서
돌리고 기동 0건을 관측한다. 양성 대조를 먼저 통과시킨다. 무해한 sentinel 기동을 같은 훅이
가로채는지 보이고, 그 다음에야 0건을 받아들인다.

정적 쪽은 보조다. `assertDerivedTestContract` 가 지금은 파생 테스트 본문의 토큰만 본다.
이것을 테스트 트리 안쪽 import 를 따라가도록 넓힌다. `test/helpers/command-intake-fixture.mjs`
처럼 helper 안에 숨은 `fork()` 가 이 확장이 잡으려는 것이다. 양성 대조는 그 helper 를
import 하는 fixture 를 계약에 먹여 거부되는지 보는 것으로 한다.

둘 다 `lina:contract-selftest` 안에서 돈다. 지금 selftest 는 `assertDerivedTestContract` 를
한 번도 부르지 않아서, 파생 테스트의 실행 경계가 선언만으로 지켜지고 있다. 그 구멍을 닫는 것이
이 변경의 일부다.

## 하지 않는 것

제품 코드 수정, 워크플로 되살리기, 안전 레인 구성(206/23/10) 변경, 머지와 배포. 고쳐야
정당해 보이는 자리를 발견하면 고치지 않고 근거와 함께 보고한다.

## 인도

게이트는 패킷에 적힌 여덟 개를 corepack 형태 그대로 돌린다. 가드 유발 확인은 해시·거부·복원
세 값을 남기고 `trap` 으로 복원을 건다. PR 은 base `main`, non-draft 로 올리고 리뷰 지적은
수정 커밋과 답글로 처리한다. 머지는 부모가 한다.
