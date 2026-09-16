# 020 · 원본 테스트 복원과 안전 판정 (wp3)

## 순서

판정을 먼저 하고 실행을 나중에 한다. 이 순서를 뒤집지 않는다. 판정 없이 돌려 본 다음
"돌아가니까 안전하다"고 말하는 것은 판정이 아니다.

판정 기준 셋이다. 외부 네트워크 호출, 설치 훅, 게시 부작용.

## 판정 결과

13개를 복원하고 2개를 복원하지 않는다. 전량 표와 근거 `path:line` 은 `000_plan.md` 부록 A·A2 에 있다.

공통 근거 네 건을 여기 다시 적는다. 이것이 "안전"의 실제 내용이다.

| 기법 | 앵커 | 효과 |
| -- | -- | -- |
| `gh` 대체 | `test/helpers.ts:1174` | `GH_BIN`/`GH_BIN_ARGS` 를 임시 디렉터리의 node 스크립트로 바꾼다. 실제 `gh` 가 돌지 않는다 |
| `curl` 대체 | `test/manual-publication-authority.test.ts:21` | 임시 `bin` 에 가짜 `curl` 을 쓰고 `PATH` 앞에 붙인다 |
| `fetch` 주입 | `test/automerge-metrics.test.ts:292` | 로컬 `fetcher` 를 넘긴다. 등록되지 않은 URL 은 예외로 떨어진다 |
| `fetch` 전역 교체 | `test/dashboard-worker-harness.ts:842`, 복원 `:965` | Worker 하네스가 `globalThis.fetch` 를 스텁으로 바꾸고 끝나면 되돌린다 |

설치 훅은 없다. `test/repository-profiles.test.ts` 에 `pnpm install` 문자열이 있지만 프로필 픽스처
데이터이고 실행되지 않는다. 그 파일에는 `spawnSync`·`execFile`·`fetch` 호출 자체가 없다.

게시 부작용은 없다. 위 네 기법 밖으로 나가는 쓰기 경로가 후보 13개에 없다.

## 복원하지 않는 2개

안전하지 않아서가 아니라 비활성 프로필과 구조적으로 맞지 않아서다. 자세한 것은 부록 A2 에 있다.
이것은 잃은 커버리지로 남기고 감추지 않는다.

## 러너 계약

대상 목록을 glob 이 아니라 선언에서 읽는다. 상세는 `000_plan.md` C1~C9.
비실행 미리보기는 `executed:false` 를 주장하는 대신 tripwire 로 실행 경계에서 관측한다(C8).

## 수용

`corepack pnpm run lina:test-safe` 실패 0, `corepack pnpm run lina:test-safe:preview` exit 0,
tripwire 관측 2건.

## 결과

wp3 의 C 단계에서 채운다. 원본 기준 결과는 `060` 에 있다.
