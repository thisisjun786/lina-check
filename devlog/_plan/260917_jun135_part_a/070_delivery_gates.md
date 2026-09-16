# 070 · 인도 게이트와 리뷰 영수증 (wp6)

## 측정 대상과 방법

| 항목 | 값 |
| -- | -- |
| 측정 SHA | `9af419172c835112740abcd873ee67f9fe6bbd14` (호스티드 리뷰 3회전 반영 후) |
| 브랜치 | `codex/jun-135-fork-baseline` |
| base | `main` (`c80ecac8`) |
| 런타임 | Node 24.20.0, pnpm 12.4.1 (Corepack) |
| 종료 코드 읽기 | `명령 > 파일 2>&1` 직후 `$?`. 파이프라인 뒤에서 읽지 않았다 |
| 작업물 | 측정 시 `git status --porcelain` 0줄 |

이 문서를 커밋하면 head 가 한 번 더 움직인다. 그 diff 는 이 markdown 파일뿐이고, 아래 표의
수치는 `9af41917` 에서 나온 것이다. 그 사실을 감추지 않고 여기 적는다. 리뷰가 새 커밋을 만들
때마다 이 표를 다시 측정했다. 새 head 는 이전 증거를 무효화하기 때문이다.

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

tripwire 대조 3건. 방법은 H21·H23 을 거쳐 바뀌었고 아래가 현재 방법이다.

- 음성 대조: `LINA_CHECK_SPAWN_TRIPWIRE=1` + `preview --json` → exit 0. 실행 경계에 닿지 않았다
- 양성 대조: tripwire 를 켠 채 `launchTests()` 를 **직접 호출** → 예외, 메시지가 tripwire 를 이름으로
  든다. 산출물이 필요 없으므로 빈 체크아웃에서도 항상 돈다
- 라우팅 대조: tripwire 를 켠 채 `main(["run"], { distState: ... })` 를 직접 호출 → 예외, 메시지가
  tripwire 를 이름으로 든다. `main` 이 여전히 그 지점을 지난다는 것을 확인한다. 산출물 판정을
  주입하므로 전제가 없고 건너뛰지 않는다

양성 대조와 라우팅 대조를 나눈 이유가 있다. 직접 `launchTests` 호출만 두면 tripwire 가 살아 있다는
것은 알지만 `main` 이 그 지점을 지나는지는 모른다. 반대로 CLI 만 두면 산출물이 없을 때 대조가
사라진다. 그래서 `main` 을 호출하고 산출물 판정만 주입했다. 주입 지점은 기본값 매개변수이므로
운영 호출부는 실제 판정을 그대로 쓴다. selftest 출력은 `tripwireControls=3 routing=verified` 다.

보존 확인: `git diff --name-only 1f36c10e HEAD -- src dashboard test config/target-repositories.json pnpm-lock.yaml .github` 0줄.

## hosted check 상황

이 저장소에는 hosted required check 가 없다. 2026-09-17 기준 Actions 가 저장소 수준에서 꺼져 있고,
활성 워크플로 0개, `main` 보호 없음, ruleset 없음이다. 독립 리뷰어도 읽기 전용 API 로 같은 상태를
확인했다(`enabled:false`, `protected:false`, `rulesets []`).

따라서 PR 의 checks 는 0건으로 예상된다. **빈 checks 를 통과로 읽지 않는다.** 인도 게이트는 위
로컬 증거다.

### 정정: 호스티드 리뷰어가 있다

계획 단계의 전제가 틀렸다. "호스티드 리뷰어 없음" 이라고 적었고 근거는 Actions 비활성·브랜치
보호 없음·ruleset 없음이었다. 그 세 사실 자체는 여전히 맞지만 **GitHub App 리뷰는 그 셋 중
어디에도 해당하지 않는다.** 이 저장소에는 Devin Review 와 Codex 코드리뷰가 둘 다 설치되어 있고
PR #1 에서 실제로 돌았다.

| 관측 | 값 |
| -- | -- |
| Actions 워크플로 check-runs | `total_count: 0`. Actions 가 꺼져 있고 활성 워크플로가 없으므로 예상대로다 |
| commit status | `state: success`, 1건. `Devin Review` / `success` / `Completed analysis in 4m 1s` |
| 제출된 리뷰 | `chatgpt-codex-connector[bot]` COMMENTED, `devin-ai-integration[bot]` COMMENTED |
| 인라인 리뷰 코멘트 | 5건. Codex 2건(P1·P2), Devin 3건(bug 1 · analysis 2) |

구분해서 읽어야 한다. **워크플로 검사는 0건이고 앞으로도 0건이다.** 그것과 별개로 App 리뷰는
붙는다. 그래서 "빈 checks 를 통과로 읽지 않는다" 는 여전히 유효하지만 "호스티드 리뷰가 없다" 는
틀렸다. 앞으로 이 저장소의 PR 에는 자동 리뷰가 붙는 것을 전제한다. 독립 리뷰어 subagent 는
대체물이 아니라 추가 층으로 남는다.

여전히 구현되지 않은 것은 다른 층이다. LINA Check 가 그 리뷰 결과를 **자기 관리 흐름으로 읽어
들이는 것** 은 없다. `POLICY.md:5` 가 말하는 미구현은 이쪽이고, App 이 PR 에 리뷰를 남기는 능력을
부정한 것이 아니다. 이 과제는 외부 리뷰 앱을 설치하지도, 새 외부 리뷰를 요청하지도 않았다.
설치는 이미 되어 있었고 리뷰는 PR 개설로 자동 발생했다.

### JUN-77 표본 확보에 주는 영향

`022_external_review_signal_contract.md` 가 요구한 네 표본(완료·미해결·낡은 revision·접근 불가)을
이제 이 저장소의 PR 로 모을 수 있다. 031 표의 "Devin·Codex 실제 신호와 완료 표시" 항목은 확인
주체가 설치 운영자이고 단계가 JUN-77 수용 시험인데, 관측 장소가 확보됐다는 사실을 함께 적는다.
이번 PR 이 이미 첫 표본을 냈다. 봇 로그인은 각각 `chatgpt-codex-connector[bot]` 과
`devin-ai-integration[bot]` 이고, Devin 은 commit status 로 Codex 는 PR 리뷰로 신호를 낸다.
두 제공자의 앱 숫자 ID 는 여기서 읽지 않았으므로 031 의 해당 항목은 열린 채로 둔다.

## push 와 PR

`git push -u origin codex/jun-135-fork-baseline` 이 원격에서 거부됐다.

```
remote: error: GH007: Your push would publish a private email address.
 ! [remote rejected] codex/jun-135-fork-baseline (push declined due to email privacy restrictions)
```

원인은 커밋 신원이다. 이 브랜치의 로컬 커밋 전부와 인계 baseline `1f36c10e` 의
author·committer 가 `작성자의 비공개 주소` 이고, 이미 원격에 있는 `c80ecac8` 은
`259586770+thisisjun786@users.noreply.github.com` 이다. 계정의 이메일 비공개 보호가 앞의 주소를
막는다.

이것은 코드 문제가 아니라 계정 설정 또는 이력 재작성 선택이다. 둘 중 하나가 필요하다.

1. 계정에서 이메일 비공개 보호를 끄거나 해당 주소를 공개로 바꾼다. 이력은 손대지 않는다.
2. 로컬 커밋들의 author·committer 이메일을 noreply 형태로 재작성한다. 이 경우 `1f36c10e` 의
   tree 는 같아도 SHA 가 바뀌므로, 이 문서군의 baseline 표기와
   `scripts/lina-check-contract-selftest.mjs` 의 `BASELINE_COMMIT` 상수를 함께 고쳐야 한다.

2번은 인계 기준 SHA 를 바꾸는 일이고 코디네이터 기록에도 영향이 있으므로 임의로 하지 않았다.

### 결과: 코디네이터가 2번을 택했다

1번은 `작성자의 비공개 주소` 을 공개 저장소 이력에 영구히 남기기 때문이다. 미푸시 커밋 10개의
author·committer 를 이미 게시된 `c80ecac8` 과 같은 noreply 주소로 맞췄다.

| | 재작성 전 | 재작성 후 |
| -- | -- | -- |
| baseline | `f611316d` | `1f36c10eeea8d3c36c477e7f91e0d405781556b3` |
| head | `cd4f975c` | `65a449aa411792784f021b98f8910433a1382baa` |

트리는 동일하다. 내용 차이는 baseline SHA 참조 6개 파일 20줄뿐이고 코디네이터가 repoint 했다.
재작성 전 이력은 로컬 태그 `jun135-pre-email-rewrite` 에 있다. `c80ecac8` 이하와 upstream pin
`1ed7bd4e` 는 건드리지 않았다.

그 뒤 내가 만든 커밋도 같은 문제로 한 번 거부됐다. 저장소의 `user.email` 이 여전히
`작성자의 비공개 주소` 이었기 때문이다. 저장소 로컬 설정을 noreply 로 바꾸고 해당 커밋을 amend 해서
해결했다. 지금은 `c80ecac8..HEAD` 의 모든 커밋이 같은 noreply 주소다.

PR: https://github.com/thisisjun786/lina-check/pull/1 — base `main`, non-draft, `state: OPEN`,
`mergeStateStatus: CLEAN`. 머지는 코디네이터가 한다.

## 리뷰 영수증

리뷰는 두 층으로 돌았다. 태스크 안의 독립 리뷰어 subagent 2회전과, PR 개설 후 호스티드 리뷰어
(Devin Review · Codex) 9회전이다. 총 32건을 받아 30건을 고치고 2건을 한계·의도로 명시했다.
반박한 1건은 4회전에 새 근거로 재제기되어 결국 수정했다. 미해결 스레드는 0건이다.

회전이 늘어난 이유를 적어 둔다. 내 수정이 새 결함을 만든 경우가 네 번 있었다. H5 의 pnpm 폴백이
H7·H10 에 반려됐고, H2 의 전체 트리 mtime 비교가 H6·H9 에 반려됐고, H17 의 floor 모드가 H18 에,
H6 의 산출물 최신성 게이트가 H19 에 반려됐다. 수정이 곧 개선이 아니라는 것을 기록으로 남긴다.

### 층 1 · 독립 리뷰어 subagent (2회전, 5건)

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

### 층 2 · 호스티드 리뷰어 (3회전, 16건)

PR 개설과 새 커밋마다 Devin Review 와 Codex 가 자동으로 돌았다. 등급 표기는 제공자의 것이다
(Codex `P1`/`P2`, Devin `bug`/`analysis`).

**1회전 · head `65a449aa` · 5건**

| # | 제공자 | 등급 | 위치 | 지적 | 처리 | 재확인 |
| -- | -- | -- | -- | -- | -- | -- |
| H1 | Codex | P1 | `lina-check-contract-selftest.mjs:47` | baseline `1f36c10e` 가 `708a4fc` 에서 도달 불가라 fresh clone 에서 `git show` 가 깨진다 | **반박.** 코드 변경 없음 | `--single-branch` 새 clone 에서 `OBJECT_PRESENT=yes`, `ANCESTOR_OF_HEAD=yes`, `git show` 150줄·assert 23건. PR merge ref 는 `708a4fc` 가 아니라 `a2ff36ac` 이고 그것의 조상이기도 하다 |
| H2 | Codex | P2 | `lina-check-safe-tests.mjs:85` | `dist/` 존재만 확인해 낡은 산출물로 통과 보고가 가능하다 | `eaf933aa` | `touch src/...` → exit 3, 미리보기 `stale`, `build:all` 후 `fresh`·333 통과 |
| H3 | Devin | bug | `lina-check-safe-tests.mjs:35` | 깨진 선언이 throw 로 나가 설정 오류가 테스트 실패(1)로 오분류된다 | `eaf933aa` | 임시 디렉터리에서 4경우(깨진 JSON·선언 부재·파일 부재·잘못된 사용법) 전부 exit 2 |
| H4 | Devin | analysis | `lina-check-safe-tests.mjs:43` | 자격증명 필터가 넓어 비자격증명 설정까지 지워 픽스처가 달라질 수 있다 | `eaf933aa` | 좁히지 않고 관측 가능하게. 실행 직전 `env filtered: ...` 출력. 이 호스트는 `none` |
| H5 | Devin | analysis | `lina-check-boundary-probe.mjs:56` | `corepack` 을 무조건 찾아 없는 환경에서 프로브가 못 돈다 | `eaf933aa` → `d5493450` 로 수정 | 1차엔 pnpm 폴백을 넣었으나 2회전 H7·H10 이 그것을 반려. 최종은 Corepack 요구 + 명확한 실패 |

**2회전 · head `eaf933aa` · 5건**

| # | 제공자 | 등급 | 위치 | 지적 | 처리 | 재확인 |
| -- | -- | -- | -- | -- | -- | -- |
| H6 | Devin | bug | `lina-check-safe-tests.mjs:99` | 부분 빌드가 무관한 산출물을 새로 만들면 전체 최대 mtime 비교가 낡은 모듈을 통과시킨다 | `d5493450` | 전체 트리 비교가 건강해 보이는 상태(최신 dist 1789583670 > 최신 src 1789583575)에서 `dist/stable-json.js` 만 2020년으로 낮춤 → exit 3, `stable-json.ts` 지목 |
| H7 | Devin | bug | `lina-check-boundary-probe.mjs:56` | Corepack 없을 때 임의의 PATH pnpm 으로 프로브가 인증된다 | `d5493450` | 폴백 제거. Corepack 요구 + `packageManager` 핀 대조. `launcher=corepack pnpm=12.4.1` |
| H8 | Devin | analysis | `README.md:10` | README 가 build·lint 만 있다고 말하고 `lina:*` 4개를 빠뜨렸다 | `d5493450` | 네 명령과 선언 위치·쌍 단위 최신성·운영 준비 아님을 함께 기재 |
| H9 | Codex | P2 | `lina-check-derived-contract.mjs:56` | H6 과 같은 부분 빌드 문제 | `d5493450` | H6 과 동일 증거 |
| H10 | Codex | P2 | `lina-check-boundary-probe.mjs:55` | H7 과 같은 미고정 pnpm 문제 | `d5493450` | H7 과 동일 증거 |

**3회전 · head `d5493450` · 6건**

| # | 제공자 | 등급 | 위치 | 지적 | 처리 | 재확인 |
| -- | -- | -- | -- | -- | -- | -- |
| H11 | Devin | bug | `lina-check-safe-tests.mjs:106` | 원본이 삭제되면 남은 산출물을 아무도 보지 않아, 삭제된 코드로 테스트가 통과한다 | `9af41917` | `dist/__orphan_proof.js` 생성 → exit 3, `orphaned`, 파일 이름 지목. 제거 후 `fresh` 384쌍 |
| H12 | Devin | bug | `lina-check-derived-contract.mjs:260` | `safeTests.files` 에 `null` 이 있으면 `DerivedContractError` 대신 `TypeError` 가 난다 | `9af41917` | 실제로 `name=TypeError` 를 재현한 뒤 수정. 이제 `safe-tests-mismatch`, selftest 픽스처 추가(29건) |
| H13 | Codex | P2 | `lina-check-safe-tests.mjs:92` | H11 과 같은 orphan 문제 | `9af41917` | H11 과 동일 증거 |
| H14 | Devin | analysis | `lina-check-safe-tests.mjs:102` | mtime 은 빌드 출처가 아니다. 아티팩트 복원이 순서를 뒤집을 수 있다 | **한계로 명시.** 코드 변경 없음 | 내용 해시는 이 스캐폴드가 만들지 않는 빌드 메타데이터를 요구한다. 헤더 주석에 한계와 대처(복원 후 `build:all`)를 적었다 |
| H15 | Devin | analysis | `lina-check-derived-contract.mjs:39` | `GUARD_SHA256` 이 가드 바이트를 중복해 수동 동기화가 필요하다 | **의도로 명시.** 코드 변경 없음 | 그 결합이 보안 속성이다. 검사 대상 파일에서 기대값을 유도하면 검사가 공허해진다. 주석에 적었다 |
| H16 | Devin | analysis | `070_delivery_gates.md:108` | 기록이 PR 미개설·이메일 판단 대기 상태로 남아 있다 | 이 커밋 | 위 "결과" 절로 교체 |

**4회전 · head `90baf416` · 1건**

| # | 제공자 | 등급 | 위치 | 지적 | 처리 | 재확인 |
| -- | -- | -- | -- | -- | -- | -- |
| H17 | Codex | P2 | `lina-check-contract-selftest.mjs` | H1 의 재제기. 이번 근거는 다르다. squash 하면 baseline 이 조상이 아니라 형제가 되므로 그 뒤의 clone 에는 객체가 없고 `git show` 에서 죽는다 | `f91e4e15` | 새 clone 에서 `ancestor_of_branch=yes`·`ancestor_of_merge_ref=yes` 로 H1 반박은 그대로 유효함을 재확인하고, squash 시뮬레이션에서 `ancestor_after_squash=no` 를 관측해 지적을 수용. 리터럴 하한을 먼저 단정하고 객체가 있으면 `mode=diff`, 없으면 `mode=floor` 로 내려가게 고쳤다. 실제 두 분기 관측: `23->26 (diff)`, `23->26 (floor)` exit 0 |

H1 과 H17 의 관계를 분명히 적어 둔다. H1 의 근거(`708a4fc` 에서 도달 불가)는 사실이 아니었고 그
반박은 지금도 유효하다. H17 은 다른 상태(squash 이후)를 근거로 삼았고 그 상태에서는 지적이 맞다.
같은 결론을 서로 다른 근거로 두 번 받은 것이 아니라, 두 번째에 새 사실이 들어온 경우다.
`c80ecac` 로 핀을 옮기라는 제안은 두 번 모두 택하지 않았다. 그 커밋을 기준으로 삼으면 인계 커밋
자체의 변경까지 이 PR 의 것으로 셈하게 되어 검사의 의미가 달라진다.

**5회전 · head `851d23e7` · 1건**

| # | 제공자 | 등급 | 위치 | 지적 | 처리 | 재확인 |
| -- | -- | -- | -- | -- | -- | -- |
| H18 | Devin | bug | `lina-check-contract-selftest.mjs` | H17 의 floor 모드가 하한을 과거 baseline 23 으로 두어, 현재 26개 검증기가 단정 3개를 잃어도 통과한다 | `dd9d168f` | 하한을 이 변경이 확립한 26 으로 올렸다. 세 경로 관측: 객체 있음 `23->26 (diff)`, 객체 없음 `26->26 (floor)`, 검증기에서 단정 4개 제거해 22개로 만들면 exit 1 과 `the validator has 22 assertion calls, below the recorded floor of 26` |
| H19 | Codex | P2 | `lina-check-contract-selftest.mjs` | H6 이 넣은 산출물 최신성 게이트 때문에, tripwire 양성 대조가 `launchTests()` 에 닿기 전에 exit 3 으로 끝난다. `dist/` 없는 새 체크아웃에서 계약이 건강한데도 selftest 가 실패한다 | 이 커밋 | 재현 확인: `dist` 를 옮기면 exit 1 과 `positive control: the failure must name LINA_CHECK_SPAWN_TRIPWIRE`. 수정 후 네 상태 관측: fresh → `tripwireControls=2`, absent → `tripwireControls=1 (skipped: ... dist is absent)` exit 0, stale → 같은 형태로 skip, 재빌드 → 다시 `2` |

H19 의 첫 처리는 전제를 명시하고 건너뛰는 것이었다. H21 이 그 구멍을 지적해 결국 **양성 대조를
preflight 에서 분리**했다. 지금은 건너뛰지 않는다.

**6회전 · head `bedfecff` · 1건**

| # | 제공자 | 등급 | 위치 | 지적 | 처리 | 재확인 |
| -- | -- | -- | -- | -- | -- | -- |
| H20 | Devin | bug | `lina-check-contract-selftest.mjs` | H19 의 skip 분기가 `fresh` 가 아닌 **모든** 값에 걸리므로, 잘못된 `distDisposition` 이 오면 거부가 아니라 양성 대조 생략으로 조용히 통과한다 | 이 커밋 | 유효한 상태 집합을 계약 모듈의 `BUILD_DISPOSITIONS` 로 내보내고, 분기 전에 검증한다. 러너가 `"bogus"` 를 보고하도록 고쳐 재현: exit 1, `invalid distDisposition bogus`. 정상 상태에서는 그대로 `tripwireControls=2` |

H19 → H20 도 같은 종류의 연쇄다. 관용 분기를 추가하면 그 분기의 진입 조건 자체가 새 검증 대상이
된다. 이번에는 진입 조건을 리터럴 집합으로 고정해 닫았다.

**7회전 · head `bedfecff`·`3abb9dab` · 1건**

| # | 제공자 | 등급 | 위치 | 지적 | 처리 | 재확인 |
| -- | -- | -- | -- | -- | -- | -- |
| H21 | Codex | P2 | `lina-check-contract-selftest.mjs` | H19 의 skip 때문에 `dist/` 없는 새 체크아웃에서는 음성 대조만 돌고 성공한다. 즉 tripwire 가 고장 나 있어도 selftest 가 exit 0 이 된다 | 이 커밋 | 양성 대조를 CLI 경유에서 **직접 호출**로 바꿨다. 러너가 `launchTests` 를 export 하고 실행부를 entrypoint 가드 안으로 넣었다. 세 상태 관측: dist fresh → `tripwireControls=2`, dist **absent** → 여전히 `2`, dist absent + tripwire 고장 → exit 1 `positive control: launchTests must refuse while the tripwire is set` |

H19→H20→H21 은 한 줄기다. 관용 분기를 넣고(H19), 그 진입 조건을 닫고(H20), 결국 관용 분기 자체를
없앴다(H21). 마지막이 옳았다. 전제를 문서로 옮기는 것보다 전제를 없애는 쪽이 낫다.

**8회전 · head `eb88705f` · 5건**

| # | 제공자 | 등급 | 위치 | 지적 | 처리 | 재확인 |
| -- | -- | -- | -- | -- | -- | -- |
| H22 | Devin | analysis | `070_delivery_gates.md` | 영수증이 양성 대조를 여전히 tripwire `run` 으로 적고 있다. H21 이후 방법이 바뀌었다 | 이 커밋 | 위 대조 3건 절로 교체 |
| H23 | Devin | bug | `lina-check-contract-selftest.mjs` | 직접 호출만으로는 `main` 이 `launchTests` 를 지나는지 확인하지 못한다. run 경로가 우회해도 두 대조가 통과한다 | 이 커밋 | 라우팅 대조 추가. 출력 `tripwireControls=2 routing=verified` |
| H24 | Codex | P2 | `lina-check-contract-selftest.mjs` | H23 과 같은 지적 | 이 커밋 | H23 과 동일 |
| H25 | Devin | bug | `lina-check-safe-tests.mjs` | 심링크로 실행하면 entrypoint 가드가 `main` 을 건너뛰고 조용히 exit 0 이 된다 | 이 커밋 | `realpathSync` 로 양쪽을 해소해 비교. 재확인: `ln -sf ... linked.mjs && node linked.mjs preview` 가 13개 목록과 `built output: fresh` 출력 |
| H26 | Codex | P2 | `lina-check-contract-selftest.mjs` | `probe-not-blocked` 거부 경로를 아무 픽스처도 밟지 않는다. 그 가드를 지워도 selftest 가 통과한다 | 이 커밋 | 프로브 목록은 리터럴과 일치시킨 채 `blockedScripts` 에서 대상 하나를 제거하는 픽스처 추가. 거부 경로 29 → 30 |

## 남은 것

- push 와 PR 개설. 위 이메일 선택을 기다린다.
- 머지는 코디네이터가 한다. 이 태스크는 머지하지 않는다.
- JUN-135 는 Done 으로 올리지 않는다. 이 브랜치는 Part A 만 인도한다.
| H26 | Codex | P2 | `lina-check-contract-selftest.mjs` | `probe-not-blocked` 거부 경로를 아무 픽스처도 밟지 않는다. 그 가드를 지워도 selftest 가 통과한다 | 이 커밋 | 프로브 목록은 리터럴과 일치시킨 채 `blockedScripts` 에서 대상 하나를 제거하는 픽스처 추가. 거부 경로 29 → 30 |

**9회전 · head `31a6815c` · 1건**

| # | 제공자 | 등급 | 위치 | 지적 | 처리 | 재확인 |
| -- | -- | -- | -- | -- | -- | -- |
| H27 | Codex | P2 | `lina-check-contract-selftest.mjs` | H23 이 넣은 라우팅 대조가 여전히 조건부다. `dist/` 없는 새 체크아웃에서는 건너뛰므로 `main` 이 `launchTests` 를 우회해도 통과한다 | 이 커밋 | 조건을 없앴다. `main` 을 export 하고 산출물 판정을 주입 가능한 기본값 매개변수로 만들어, 대조가 빌드 없이 `main` 자체를 실행한다. 세 상태 관측: fresh → `tripwireControls=3 routing=verified`, **absent → 동일**, absent + `main` 이 `launchTests` 우회 → exit 1 `routing control: run mode must reach the launch boundary` |

H19→H21→H23→H27 이 한 줄기다. 조건부 대조를 넣고, 전제를 문서로 옮기고, 대조를 하나 더 넣고,
결국 조건 자체를 주입으로 없앴다. 조건부 검증은 그 조건이 성립하지 않는 곳에서 정확히 무용하다.
