# 070 · 인도 게이트와 리뷰 영수증 (wp6)

## 측정 대상과 방법

| 항목 | 값 |
| -- | -- |
| 측정 SHA | `aa1bb97a2d8266f447c9744306e5f841d3365f8a` |
| 브랜치 | `codex/jun-135-fork-baseline` |
| base | `main` (`c80ecac8`) |
| 런타임 | Node 24.20.0, pnpm 12.4.1 (Corepack) |
| 종료 코드 읽기 | `명령 > 파일 2>&1` 직후 `$?`. 파이프라인 뒤에서 읽지 않았다 |

이 문서를 커밋하면 head 가 한 번 더 움직인다. 그 diff 는 이 markdown 파일과 그 선언뿐이고,
아래 표의 수치는 `aa1bb97a` 에서 나온 것이다. 그 사실을 감추지 않고 여기 적는다.
문서 커밋 이후 빠른 게이트(테스트 스위트 제외)를 다시 돌려 아래 "문서 커밋 이후" 절에 적었다.

## 필수 게이트 8항목

| # | 명령 | exit | 결과 요약 |
| -- | -- | -- | -- |
| 1 | `corepack pnpm install --frozen-lockfile --ignore-scripts` | 0 | lockfile 고정 설치 |
| 2 | `corepack pnpm run check:scaffold` | 0 | `upstream 1ed7bd4e...; 1646 original entries checked; 35 workflows parked; 104 commands blocked` + `Derived declarations validated: 12 files; 4 scripts; 13 restored upstream tests; 8 boundary-probe targets; preview observed non-executing under LINA_CHECK_SPAWN_TRIPWIRE.` |
| 3 | `corepack pnpm run build:all` | 0 | `tsc` 3개 프로젝트 무오류 |
| 4 | `corepack pnpm run lint` | 0 | lint 스크립트 4개, oxlint 호출 5회 |
| 5 | `corepack pnpm run lina:test-safe` | 0 | `tests 333 / pass 333 / fail 0` |
| 6 | `corepack pnpm run lina:test-safe:preview` | 0 | 13개 나열, 테스트 자식 프로세스 미기동 |
| 7 | 원본/파생 결과 구분 기록 | — | `060_results_original_vs_derived.md`. 게이트가 관측하지 않는 사람 검토 항목 |
| 8 | `corepack pnpm run lina:boundary-probe` | 0 | 입구 8개 exit 1 + `is disabled`, 워크플로 5개 `.yml` 부재, 트리 변동 없음 |

추가로 계약 음성 검증을 함께 돌렸다.

| 명령 | exit | 결과 |
| -- | -- | -- |
| `corepack pnpm run lina:contract-selftest` | 0 | `rejected=25 helpers=3 tripwireControls=2 assertionCalls=23->26` |

tripwire 대조 2건도 직접 관측했다.

- 음성 대조: `LINA_CHECK_SPAWN_TRIPWIRE=1` + `preview --json` → exit 0
- 양성 대조: `LINA_CHECK_SPAWN_TRIPWIRE=1` + `run` → 실패, 진단
  `[lina-check-safe-tests] LINA_CHECK_SPAWN_TRIPWIRE tripped: launchTests() was reached, so this was not a preview`

보존 확인: `git diff --name-only f611316d HEAD -- src dashboard test config/target-repositories.json pnpm-lock.yaml .github` 는 0줄이다.

## hosted check 상황

이 저장소에는 hosted required check 가 없다. 2026-09-17 기준 Actions 가 저장소 수준에서 꺼져 있고,
활성 워크플로 0개, `main` 보호 없음, ruleset 없음이다. 독립 리뷰어도 읽기 전용 API 로 같은 상태를
확인했다(`enabled:false`, `protected:false`, `rulesets []`).

따라서 PR 의 checks 는 0건으로 예상된다. 실제 값은 PR 개설 후 아래에 적는다.
**빈 checks 를 통과로 읽지 않는다.** 인도 게이트는 위 로컬 증거다.

호스티드 코드 리뷰 제공자는 이 단계에서 이용 불가다. Devin·Codex 는 의도된 연동이고 구현돼 있지
않으며, 이 과제는 외부 리뷰 앱 설치나 새 외부 리뷰 요청을 금지한다. 그래서 리뷰는 이 태스크 안의
독립 리뷰어 subagent 로 수행했다.

## 문서 커밋 이후

(이 절은 이 문서를 커밋한 뒤 채운다.)

## PR

(이 절은 PR 개설 후 채운다.)

## 리뷰 영수증

(이 절은 리뷰 후 채운다. 지적마다 지적 본문 · 처리 커밋 · 재확인 세 가지를 적는다.)

