# 070 · 인도 게이트와 리뷰 영수증 (wp6)

## 측정 대상과 방법

| 항목 | 값 |
| -- | -- |
| 측정 SHA | `25c29266d62c7444a1885010908c7f8999336f19` (리뷰 지적 반영 후) |
| 브랜치 | `codex/jun-135-fork-baseline` |
| base | `main` (`c80ecac8`) |
| 런타임 | Node 24.20.0, pnpm 12.4.1 (Corepack) |
| 종료 코드 읽기 | `명령 > 파일 2>&1` 직후 `$?`. 파이프라인 뒤에서 읽지 않았다 |
| 작업물 | 측정 시 `git status --porcelain` 0줄 |

이 문서를 커밋하면 head 가 한 번 더 움직인다. 그 diff 는 이 markdown 파일뿐이고, 아래 표의
수치는 `25c29266` 에서 나온 것이다. 그 사실을 감추지 않고 여기 적는다.

## 필수 게이트 8항목

| # | 명령 | exit | 결과 요약 |
| -- | -- | -- | -- |
| 1 | `corepack pnpm install --frozen-lockfile --ignore-scripts` | 0 | lockfile 고정 설치 |
| 2 | `corepack pnpm run check:scaffold` | 0 | `upstream 1ed7bd4e...; 1646 original entries checked; 35 workflows parked; 104 commands blocked` + `Derived declarations validated: 13 files; 4 scripts; 13 restored upstream tests; 8 boundary-probe targets; preview observed non-executing under LINA_CHECK_SPAWN_TRIPWIRE.` |
| 3 | `corepack pnpm run build:all` | 0 | `tsc` 3개 프로젝트 무오류 |
| 4 | `corepack pnpm run lint` | 0 | lint 스크립트 4개, oxlint 호출 5회 |
| 5 | `corepack pnpm run lina:test-safe` | 0 | `tests 333 / pass 333 / fail 0` |
| 6 | `corepack pnpm run lina:test-safe:preview` | 0 | 13개 나열, 테스트 자식 프로세스 미기동 |
| 7 | 원본/파생 결과 구분 기록 | — | `060_results_original_vs_derived.md`. 게이트가 관측하지 않는 사람 검토 항목 |
| 8 | `corepack pnpm run lina:boundary-probe` | 0 | 입구 8개 exit 1 + `is disabled`, 워크플로 5개 활성 YAML 부재, stray 0, 가드 digest 확인, 트리 변동 없음 |

추가 게이트.

| 명령 | exit | 결과 |
| -- | -- | -- |
| `corepack pnpm run lina:contract-selftest` | 0 | `rejected=28 helpers=11 tripwireControls=2 assertionCalls=23->26` |

tripwire 대조 2건.

- 음성 대조: `LINA_CHECK_SPAWN_TRIPWIRE=1` + `preview --json` → exit 0
- 양성 대조: `LINA_CHECK_SPAWN_TRIPWIRE=1` + `run` → 실패, 진단
  `[lina-check-safe-tests] LINA_CHECK_SPAWN_TRIPWIRE tripped: launchTests() was reached, so this was not a preview`

보존 확인: `git diff --name-only f611316d HEAD -- src dashboard test config/target-repositories.json pnpm-lock.yaml .github` 0줄.

## hosted check 상황

이 저장소에는 hosted required check 가 없다. 2026-09-17 기준 Actions 가 저장소 수준에서 꺼져 있고,
활성 워크플로 0개, `main` 보호 없음, ruleset 없음이다. 독립 리뷰어도 읽기 전용 API 로 같은 상태를
확인했다(`enabled:false`, `protected:false`, `rulesets []`).

따라서 PR 의 checks 는 0건으로 예상된다. **빈 checks 를 통과로 읽지 않는다.** 인도 게이트는 위
로컬 증거다.

호스티드 코드 리뷰 제공자는 이 단계에서 이용 불가다. Devin·Codex 는 의도된 연동이고 구현돼 있지
않으며, 이 과제는 외부 리뷰 앱 설치나 새 외부 리뷰 요청을 금지한다. 그래서 리뷰는 이 태스크 안의
독립 리뷰어 subagent 로 수행했다. 이용 불가를 통과로 기록하지 않는다.

## push 와 PR

`git push -u origin codex/jun-135-fork-baseline` 이 원격에서 거부됐다.

```
remote: error: GH007: Your push would publish a private email address.
 ! [remote rejected] codex/jun-135-fork-baseline (push declined due to email privacy restrictions)
```

원인은 커밋 신원이다. 이 브랜치의 로컬 커밋 전부와 인계 baseline `f611316d` 의
author·committer 가 `작성자의 비공개 주소` 이고, 이미 원격에 있는 `c80ecac8` 은
`259586770+thisisjun786@users.noreply.github.com` 이다. 계정의 이메일 비공개 보호가 앞의 주소를
막는다.

이것은 코드 문제가 아니라 계정 설정 또는 이력 재작성 선택이다. 둘 중 하나가 필요하다.

1. 계정에서 이메일 비공개 보호를 끄거나 해당 주소를 공개로 바꾼다. 이력은 손대지 않는다.
2. 로컬 커밋들의 author·committer 이메일을 noreply 형태로 재작성한다. 이 경우 `f611316d` 의
   tree 는 같아도 SHA 가 바뀌므로, 이 문서군의 baseline 표기와
   `scripts/lina-check-contract-selftest.mjs` 의 `BASELINE_COMMIT` 상수를 함께 고쳐야 한다.

2번은 인계 기준 SHA 를 바꾸는 일이고 코디네이터 기록에도 영향이 있으므로 임의로 하지 않았다.
사용자 판단을 기다리는 상태로 남긴다. PR 은 아직 열리지 않았다.

## 리뷰 영수증

리뷰는 두 번 돌았다. 1차에서 5건을 받고 전부 처리했으며, 2차는 각 건을 실제 우회 시도로 재확인했다.

| 지적 | 등급 | 내용 | 처리 커밋 | 재확인 |
| -- | -- | -- | -- | -- |
| F1 | major | 스크립트 **이름**만 고정했고 **명령**은 고정하지 않았다. config 와 `package.json` 을 함께 고치면 `lina:test-safe:preview` 를 `run` 으로 돌릴 수 있고 검증기가 통과시켰다 | `25c29266` | 2차에서 (a) 양쪽 동시 치환, (b) 다른 선언 파일 지목을 실제로 시도해 둘 다 `script-command` 로 거부됨 확인 |
| F2 | major | 프로브가 가드의 **명령 문자열**만 확인했다. 먼저 동작하고 익숙한 진단을 나중에 출력하도록 고친 `scaffold-disabled.mjs` 는 호출되고 "닫힘"으로 보고됐을 것이다 | `25c29266` | 2차에서 (c) 가드 변경 → `guard-tampered`, (d) pre/post 훅 추가 → `probe-lifecycle-hook`. 모두 자식 프로세스 기동 전에 중단됨 확인 |
| F3 | major | `.yaml` 확장자가 보이지 않았다. `sweep.yaml` 을 두면 `workflowsParked:true` 로 보고됐다 | `25c29266` | 2차에서 (e) `sweep.yaml` 모사 → exit 1, `workflow-active` 확인 |
| F4 | minor | 프로브 선언이 상위집합을 허용해, 실행되지 않는 항목으로 보고 수치만 키울 수 있었다. 워크플로 선언은 검사도 사용도 되지 않았다 | `25c29266` | 2차에서 (f) 9번째 항목 추가 → `probe-mismatch`, 워크플로 변경 → `probe-workflow-mismatch` 확인 |
| F5 | minor | 설명 3건이 사실과 달랐다. `derived` 주석의 config 역할 축소, `repository-profiles.test.ts` 가 파일을 읽지 않는다는 서술(실제로는 `:155`, `:166`), `070` 의 미수행 재확인 주장 | `25c29266` | 2차에서 세 곳 모두 수정 확인, 테스트의 파일 읽기 대조 |

2차 판정은 `PASS` 이고 신규 결함 없음이다. 리뷰어는 모든 변경을 메모리 또는 저장소 밖에서
시도했고 작업물은 `25c29266` 에서 깨끗하게 남았다. 미해결 지적은 없다.

음성 검증 범위가 리뷰로 늘었다. 거부 경로 25건 → 28건, 순수 보조 함수 3건 → 11건.

## 남은 것

- push 와 PR 개설. 위 이메일 선택을 기다린다.
- 머지는 코디네이터가 한다. 이 태스크는 머지하지 않는다.
- JUN-135 는 Done 으로 올리지 않는다. 이 브랜치는 Part A 만 인도한다.

