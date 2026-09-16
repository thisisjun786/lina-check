# 000 · JUN-135 Part A 실행 계획 (CXC Loop)

## 결론

이 유닛은 ClawSweeper 기반 LINA Check 포크를 "검증기와 관련 원본 테스트를 실제로 돌릴 수 있는 상태"로 만든다.
수단은 검증 기준을 느슨하게 만드는 것이 아니라, 허용된 파생 변경을 `config/lina-check-scaffold.json` 에
선언으로 등록하고 `scripts/check-scaffold.mjs` 가 그 선언과 실물을 대조하게 하는 것이다. 선언되지 않은
추가는 지금처럼 거부되고, 선언만 남고 실물이 없는 경우도 거부된다. upstream 출처 검사와 비활성 입구
검사는 그대로 유지한다.

운영 활성화는 이 유닛의 목표가 아니다. 워크플로 35개는 계속 parked 이고 차단 명령 104개는 계속 막힌다.

## 기준점

| 항목 | 값 |
| -- | -- |
| worktree | `/home/jun/code-worktrees/lina-check/jun-135-fork-baseline` |
| 브랜치 | `codex/jun-135-fork-baseline` |
| baseline commit | `f611316dab341b978a1ef073ee4f68aa63c02059` |
| upstream pin | `1ed7bd4e13fb03334798e4d027ba3383ac9e5f01` (tree `1e3d7197`) |
| origin/main | `c80ecac866cc12608442a0be0b1de4e24f7b1e13` |
| Node / pnpm | 24.20.0 / 12.4.1 (Corepack) |

`f611316d` 는 작업 checkout 의 HEAD 이고 `c80ecac8` 의 자손이다. 베이스를 다시 만들지 않는다.

## 루프 사양 (HOTL)

| 항목 | 값 |
| -- | -- |
| 도구·자격 범위 | 로컬 셸, git(로컬 커밋 + origin push), GitHub PR 개설/리뷰 API, subagent 디스패치. 모델 유료 호출·Oracle·외부 리뷰 앱·GitHub App·배포 자격은 범위 밖 |
| 쓰기 범위 | `config/lina-check-scaffold.json`, `package.json`(파생 스크립트 3줄), `scripts/check-scaffold.mjs`, 신규 `scripts/lina-check-*.mjs` 2개, 신규 `devlog/_plan/260917_jun135_part_a/**`. upstream `src/` `dashboard/` `test/` `config/`(스캐폴드 JSON 제외) `.github/` `pnpm-lock.yaml` 은 읽기 전용 |
| 예산 | 이 태스크에 명시된 토큰 한도 없음. 벽시계는 게이트 8항목 + PR 리뷰 1회전 기준 |
| 종료 조건 | 최종 head 에서 게이트 8항목 증거 확보 + 차단 지적 해소. 머지·릴리스·배포는 하지 않음 |

## 작업 단계 지도

의존 순서는 빌드 순서다. 일정이나 난이도로 쪼개지 않았다.

| 단계 | 산출물 | 선행 |
| -- | -- | -- |
| wp1 | 이 계획 단위 문서(코드 변경 없음) | — |
| wp2 | 파생 선언 스키마 + 검증기 조정 | wp1 |
| wp3 | 안전 부분집합 러너 + 비실행 미리보기 + 실행 기록 | wp2 |
| wp4 | 자동 수정·종료·머지·라벨 차단 프로브 | wp3 |
| wp5 | 착수 단계 소스 조사 2건 + JUN-63 연결점 문서 | wp2 |
| wp6 | 게이트 8항목, 커밋·push, non-draft PR, 독립 리뷰 | wp3·wp4·wp5 |

## 파일 변경 지도 (diff 수준)

| 경로 | 변경 | 내용 |
| -- | -- | -- |
| `config/lina-check-scaffold.json` | 수정 | `derived` 절 추가: `files`, `scripts`, `safeTests`, `excludedTests`, `boundaryProbes`, `replacedUpstreamDocs` |
| `scripts/check-scaffold.mjs` | 수정 | 하드코딩 `additions` 를 core + 선언으로 확장하고, 선언 자체에 대한 검사 7건 추가 |
| `package.json` | 수정 | 파생 스크립트 3개 추가(`lina:test-safe`, `lina:test-safe:preview`, `lina:boundary-probe`) |
| `scripts/lina-check-safe-tests.mjs` | 신규 | 선언된 안전 테스트만 실행하는 러너 + 비실행 미리보기 |
| `scripts/lina-check-boundary-probe.mjs` | 신규 | 자동 수정·종료·머지·라벨 경계의 실제 차단 프로브 |
| `devlog/_plan/260917_jun135_part_a/*.md` | 신규 | 계획·계약·조사·결과 기록 7건 |
| `devlog/_plan/260917_jun135_part_a/evidence/boundary-probe.json` | 신규 | 프로브 실행 결과 고정 |

문서 위치를 `docs/` 가 아니라 `devlog/_plan/` 으로 고른 이유가 있다. `docs/` 아래 페이지는 upstream 의
`config/documentation-site.json` 분류 대상이고(`scripts/build-docs-site.mjs:127` 이 미분류 페이지를 예외로
만든다), 그 매니페스트는 보존해야 하는 upstream 바이트다. 새 페이지를 `docs/` 에 넣으면 분류 계약을
건드리게 된다. `devlog/_plan/YYMMDD_slug/` 는 이 프로젝트의 기존 계획 단위 규약과도 같다.

## 범위

**들어가는 것.** 인계 확인, 검증 기준 조정, 안전 판정 후 테스트 복원·실행, 비실행 미리보기, 원본/파생
결과 구분 기록, 차단 프로브, 착수 단계 소스 조사 2건, JUN-63 역할 경계 연결점 문서.

**나가는 것.** 대상 저장소 목록 실제 값, GitHub App 권한 범위 확정, 상태·큐 위치 구성 선택. 이 셋은
제품 소유자 결정이며 값을 지어내지 않는다. 파서·프롬프트·schema 패치 설계는 JUN-64 소유이므로
연결점만 남기고 구현하지 않는다. 워크플로 재활성화, 운영 명령 실행, 머지·릴리스·배포도 나간다.

## 수용 기준과 검증 명령

각 명령은 계획에 적기 전에 실제로 돌렸다(PLAN-VERIFIER-REAL-01). 아래 exit code 는 baseline
`f611316d` 에서 관측한 값이다.

| # | 수용 기준 | 검증 명령 | baseline exit | 변경 대상을 읽는가 |
| -- | -- | -- | -- | -- |
| 1 | 의존성 설치가 lockfile 고정으로 재현된다 | `corepack pnpm install --frozen-lockfile --ignore-scripts` | 0 | `pnpm-lock.yaml` 직접 인자 |
| 2 | 출처·보존·비활성·선언이 모두 통과한다 | `corepack pnpm run check:scaffold` | 0 | `config/lina-check-scaffold.json`, `package.json`, 신규 파일 전부를 직접 읽는다 |
| 3 | 타입 빌드 3개가 통과한다 | `corepack pnpm run build:all` | 0 | `src/`·`dashboard/`. 신규 `.mjs` 는 읽지 않는다 |
| 4 | 린트 4개가 통과한다 | `corepack pnpm run lint` | 0 | `lint:scripts` 가 `scripts` `test` 를 직접 인자로 받으므로 신규 `.mjs` 2개를 읽는다 |
| 5 | 선언된 안전 테스트가 실패 0 으로 돌아간다 | `corepack pnpm run lina:test-safe` | 해당 없음(신규) | 선언된 `test/*.test.ts` 13개를 직접 인자로 받는다 |
| 6 | 비실행 미리보기가 아무것도 실행하지 않는다 | `corepack pnpm run lina:test-safe:preview` | 해당 없음(신규) | 같은 선언을 읽고 `executed:false` 를 출력한다 |
| 7 | 원본/파생 결과가 구분되어 기록된다 | `060_results_original_vs_derived.md` 대조 | 해당 없음 | 사람 검토 |
| 8 | 자동 수정·종료·머지·라벨이 실제로 막힌다 | `corepack pnpm run lina:boundary-probe` | 해당 없음(신규) | 차단 스크립트 8개를 실제 호출한다 |

7번은 게이트가 관측하지 않는다. 사람 검토 항목으로 분류한다.

## 우회 경로 명명 (PLAN-BYPASS-NAMED-01)

| 항목 | 값 |
| -- | -- |
| 계층 등급 | E2. 저장소 스크립트가 실행하는 로컬 검사 |
| 실행 주체 | `corepack pnpm run check:scaffold` 를 사람이나 태스크가 직접 실행할 때만 돈다. hosted required check 는 이 저장소에 없다 |
| 알려진 우회 | (a) `node dist/...` 또는 `node src/...` 직접 실행은 package 가드를 지나지 않는다, (b) `config/lina-check-scaffold.json` 을 고치면 선언이 바뀐다, (c) `check-scaffold.mjs` 자체를 고치면 검사가 사라진다, (d) 검사를 아무도 돌리지 않으면 아무 일도 일어나지 않는다 |
| 잔여 위험 | 이 계층은 실수 방지 장치이지 샌드박스가 아니다. `POLICY.md:9` 가 이미 같은 말을 한다 |
| 문구 격하 | 예. "enforcement" 대신 "조기 경고"로 적는다. 최종 강제 계층은 없다 |

## 필드 체인 (PLAN-FIELD-CHAIN-01)

`derived` 는 새 설정 필드 집합이므로 생성→직렬화→역직렬화→소비자 전체를 적는다.

| 단계 | `derived.files` | `derived.scripts` | `derived.safeTests` | `derived.boundaryProbes` | `derived.replacedUpstreamDocs` | `derived.excludedTests` |
| -- | -- | -- | -- | -- | -- | -- |
| 생성 | 사람이 JSON 에 적는다 | 같음 | 같음 | 같음 | 같음 | 같음 |
| 직렬화 | `config/lina-check-scaffold.json` 한 곳 | 같음 | 같음 | 같음 | 같음 | 같음 |
| 역직렬화 | `check-scaffold.mjs` 의 `config` 로드 | 같음 | 러너도 같은 파일을 읽는다 | 프로브도 같은 파일을 읽는다 | `check-scaffold.mjs` 만 | `check-scaffold.mjs` 만 |
| 소비자 | `additions` 집합, 존재 검사, 경로 제약 검사 | `expectedPackage.scripts` 병합 + 명령 형태 검사 | 러너/미리보기 대상 목록, 검증기의 미리보기 대조 | 프로브 대상 목록 + 워크플로 부재 검사 | `docs` 배열과 동일성 검사 | 제외 이유 존재 검사 |

`excludedTests` 는 실행에 쓰이지 않는 기록 전용 필드다. 실행에 쓰이지 않는다는 사실을 명시해 둔다.

## 아키텍트 협의 기록

read-only architect 를 CXC 디스패치로 불렀다. handle `01a0ab08-cc3f-7881-9a8b-b4e5385e23d0`
(dispatchId `jun135-architect-p1`, attempt `57da3ef0-0303-4999-8956-f78909005db9`,
후보 `anthropic/claude-fable-5-1` effort high).

| 제안 | 처분 | 근거 |
| -- | -- | -- |
| D-A1 선언 스키마를 `config.derived` 로 둔다 | 채택 + 수정 | `excludedTests` 와 `boundaryProbes` 를 추가했다. 복원하지 않은 이유와 프로브 대상도 선언에 남아야 조용히 줄어들지 않는다 |
| D-A2 파생 경로는 upstream 경로를 덮어쓸 수 없다 | 채택 | upstream 디렉터리를 선언 불가로 만들어 기존보다 좁아진다 |
| D-A3 파생 스크립트 이름은 upstream 이름일 수 없다 | 채택 | `blockedScripts` 동일성과 가드 프로브 104건이 그대로 유지된다 |
| D-A4 안전 테스트 목록은 upstream 실물 경로만 허용 | 채택 | 새 테스트 파일이 끼어드는 경로를 막는다 |
| D-A5 검증기가 미리보기를 실행해 대조한다 | 채택 | 미리보기가 비실행임을 검증기가 직접 확인한다 |
| D-B1 `lina:` 접두사 신규 이름 | 채택 | upstream 이름 재사용은 구조적으로 불가능하다 |
| D-C1~C5 러너·미리보기 계약 | 채택 + 수정 | 종료 코드를 0/1/2/3 으로 고정하고, 토큰류 환경 변수를 자식 프로세스에서 제거한다 |
| D-D1 package 경로 프로브 8개 | 채택 | 운영자가 실제로 쓰는 경로로 검사한다 |
| D-D2 워크플로 이름별 부재 검사 | 채택 | 디렉터리 단위 검사보다 구체적이다 |
| D-D3 프로브가 증명하지 못하는 것 | 채택 | 결과 문서에 그대로 옮긴다 |
| `replacedUpstreamDocs` 명시 제안 | 채택 | 루트 `README.md` 등 4개가 포크 소유라는 사실이 지금은 암묵적이다 |
| "안전 테스트 선정은 JUN-135 정적 분류가 필요하다" | 확인됨 | 분류를 먼저 수행했고 결과는 `020` 에 있다 |

## 원본 기준 측정치

baseline `f611316d`, 변경 전 상태에서 관측했다.

- `check:scaffold` exit 0 — "upstream 1ed7bd4e...; 1646 original entries checked; 35 workflows parked; 104 commands blocked"
- `build:all` exit 0, `lint` exit 0, `install --frozen-lockfile --ignore-scripts` exit 0
- 후보 테스트 15개 중 13개 exit 0, 2개 exit 1. 실패 2건은 안전성 문제가 아니라 비활성 프로필과의
  구조적 불일치다. 자세한 내용은 `020` 에 있다.

## 다음 단계

wp1 은 문서만 만든다. 구현은 wp2 에서 시작한다.

---

# 계획 개정 v2 · 감사 반영

아키텍트 반영 검사는 `MISALIGNED`, 독립 리뷰어 감사는 `FAIL` 을 냈다. 두 결과의 지적을 모두 접었다.
아래가 구속력 있는 최종 계약이고, 위 v1 본문과 충돌하면 이 절이 이긴다.

## 감사 기록

| 출처 | handle | 판정 |
| -- | -- | -- |
| architect 반영 검사 | `01a0ab08-cc3f-7881-9a8b-b4e5385e23d0` (`jun135-architect-p1`) | MISALIGNED · 누락 4건, 신규 위험 3건 |
| 독립 리뷰어 감사 | `01a0ab11-9aa8-7d90-8b3e-a5796e9649ad` (`jun135-audit-wp1`, `gpt-6-astra` high) | FAIL · 차단 3건 |

리뷰어가 baseline 의 기존 assert 24건을 전수 표로 만들어 "계획이 어느 것도 없애지 않는다"를 확인했다.
그 표를 수용 기준으로 승격한다.

## 접은 지적과 처분

| # | 지적 | 출처 | 처분 |
| -- | -- | -- | -- |
| F1 | 파생 선언의 제약이 "경로 제약·명령 형태" 수준으로 모호하다 | 리뷰어 B-1 | 접음. 아래 C1~C9 로 구체화 |
| F2 | `lina:*` 이름이 upstream 이름이 아니어도 `node dist/clawsweeper.js review` 를 별칭할 수 있다 | 리뷰어 B-1 + architect | 접음. C4·C5 |
| F3 | 안전 테스트 선정·프로브 대상이 계획에 없다(`020` 부재) | 리뷰어 B-2 | 접음. 부록 A·B 에 전량 기재 |
| F4 | 미리보기 `executed:false` 는 비실행의 증거가 아니다 | 리뷰어 B-3 | 접음. C8 실행 경계 tripwire |
| F5 | `devlog/` 가 검증기를 어떻게 통과하는지 계획에 없다 | architect | 접음. 전 파일을 `derived.files` 에 개별 선언. C1 |
| F6 | push·PR 권한 근거가 계획에 없다 | architect | 접음. 아래 권한 근거 절 |
| F7 | 프로브의 작업물 청결 비교가 빠졌고, 프로브가 자기 증거 파일을 트리에 쓴다 | architect | 접음. C7. 프로브는 트리에 쓰지 않는다 |
| F8 | `safeTests` 정렬·중복 검사가 명시되지 않았다 | architect | 접음. C6 |
| F9 | `boundaryProbes` 가 config 에서 조용히 줄어들 수 있다 | architect | 접음. C7 하드코딩 부분집합 검사 |
| F10 | 가드가 사라진 상태에서 프로브는 실사격이 된다 | architect | 접음. C7 사전 확인 |
| F11 | `check-scaffold.mjs` 의 assert 삭제를 감시할 기준이 없다 | architect | 접음. 수용 기준 9 |

## 파생 선언 계약 C1~C9

config 가 느슨하게 만들 수 없도록, 아래 값은 전부 `scripts/check-scaffold.mjs` 안의 리터럴이다.
config 는 리터럴이 허용한 형태 안에서만 선언할 수 있다.

- **C1 위치 제한.** `derived.files` 의 모든 경로는 `^scripts/lina-check-[a-z-]+\.mjs$` 또는
  `^devlog/_plan/260917_jun135_part_a/(evidence/)?[0-9a-z_-]+\.(md|json)$` 중 하나에 맞아야 한다.
  `..` 포함, 절대 경로, 심링크는 거부한다(`lstat` 으로 일반 파일 확인). upstream 트리에 이미 있는
  경로는 파생으로 선언할 수 없다.
- **C2 core 보존.** 기존 하드코딩 additions(POLICY.md, 스캐폴드 JSON, 가드·검증 스크립트,
  `docs/upstream/*` 4개, parked 워크플로 35개)는 리터럴로 남고 config 가 지울 수 없다.
- **C3 존재·비어있지 않음.** 선언된 파일은 전부 실재해야 하고(기존 :129 확장), 선언 목록은
  비어 있을 수 없고, 각 항목은 비어 있지 않은 `reason` 을 가져야 한다.
- **C4 스크립트 집합 고정.** `derived.scripts` 는 정확히 네 개여야 한다:
  `lina:test-safe`, `lina:test-safe:preview`, `lina:boundary-probe`, `lina:contract-selftest`.
  이름 집합을 리터럴로 비교한다. upstream 이름과의 교집합은 공집합이어야 한다.
- **C5 명령 형태와 내용.** 각 명령은 `node <derived.files 에 선언된 scripts/*.mjs> [a-z-]*` 형태만
  허용한다. 그리고 `blocked` 값에서 추출한 모든 `node <path>` 대상(예 `dist/repair/execute-fix-artifact.js`,
  `dist/clawsweeper.js`)을 파생 스크립트 소스 전문에서 찾아 하나라도 포함되면 거부한다. 이 목록은
  config 가 아니라 upstream pin 에서 나오므로 config 로 우회할 수 없다.
- **C6 안전 테스트 목록.** `derived.safeTests.files` 는 정렬·중복 없음·13개(리터럴 개수)여야 하고,
  각 경로는 `^test/[^/]+\.test\.ts$` 이며 upstream 트리 실물 경로여야 하고 각각 `reason` 을 가진다.
  개수가 리터럴이므로 config 만으로 조용히 줄거나 늘 수 없다.
- **C7 프로브 목록과 실사격 방지.** 여덟 개 대상 이름을 검증기 리터럴로 두고
  `derived.boundaryProbes` 가 그 상위집합인지 확인한다. 프로브는 각 대상을 실행하기 전에
  `package.json` 의 해당 스크립트가 정확히 `node scripts/scaffold-disabled.mjs <name>` 인지 먼저
  확인하고, 아니면 실행하지 않고 실패한다. 프로브는 저장소 트리에 아무 파일도 쓰지 않으며,
  실행 전후 `git status --porcelain` 이 동일한지 스스로 확인한다.
- **C8 미리보기 실행 경계.** 미리보기가 테스트를 띄우지 않았다는 것을 `executed:false` 문자열로
  주장하지 않는다. 러너의 자식 프로세스 생성은 한 함수에만 있고, 환경 변수
  `LINA_CHECK_SPAWN_TRIPWIRE=1` 이 설정되면 그 함수는 호출되는 즉시 예외로 실패한다. 검증은
  tripwire 를 켠 상태에서 미리보기가 exit 0 으로 끝나는 것을 관측한다. 같은 tripwire 에서 `run` 은
  실패해야 한다. 두 관측을 함께 남긴다.
- **C9 거부 경로의 음성 검증.** C1~C8 의 거부가 실제로 동작하는지 확인하는
  `lina:contract-selftest` 을 둔다. 계약 검사를 `scripts/lina-check-derived-contract.mjs` 로 분리하고,
  selftest 가 고의로 어긴 선언(위치 위반, 미선언 파일, 정렬 위반, 중복, 개수 불일치, upstream 이름 재사용,
  금지 대상 문자열 포함, 프로브 목록 축소)을 메모리에서 만들어 각각 거부되는지 확인한다.
  통과만 검증하고 거부를 검증하지 않으면 검사가 살아 있다는 증거가 없다.

## 권한 근거 (F6)

push 와 PR 개설은 이 태스크 지시가 명시적으로 위임했다. 원문: "PR 소유는 네 몫이다. 구현하고,
검사를 돌리고, 브랜치에 커밋하고, push 하고, PR 을 draft 가 아닌 상태로 연다."
`AGENTS.md` 의 "로컬 스캐폴드 편집의 일부로 push 하지 말라"는 기본값이고, 사용자의 명시적 지시가
우선한다. 위임 범위 밖으로 넘어가지 않는 것은 다음이다. 머지, 릴리스, 배포, remote 변경,
upstream push, GitHub App, Actions 활성화, 브랜치 보호 변경.

## 측정 방법 정정

v1 의 baseline 측정은 `명령 | tail; echo $?` 형태였고 그것은 `tail` 의 종료 코드를 읽는다.
실제 종료 코드는 `명령 > 파일 2>&1; echo $?` 로 다시 측정한다. v1 표의 exit 0 네 건은
출력 내용으로도 성공이 확인되지만, 최종 게이트 증거는 정정된 방법으로 다시 수집한다.

## 수용 기준 (v1 표 대체)

1~8 은 v1 과 같다. 아래를 추가한다.

9. `git diff f611316d -- scripts/check-scaffold.mjs` 가 `additions` 리터럴 교체를 제외한 어떤
   `assert` 줄도 삭제하지 않는다. baseline assert 수는 24 이고 변경 후에는 그보다 많아야 한다.
10. `corepack pnpm run lina:contract-selftest` 가 C1~C8 거부 경로 전부에서 거부를 관측하고 exit 0.
11. tripwire 관측 2건: `LINA_CHECK_SPAWN_TRIPWIRE=1` 에서 미리보기 exit 0, `run` 은 0 이 아님.
12. 프로브 실행 전후 `git status --porcelain` 이 동일하다.

## 부록 A · 복원 대상 13개와 판정 근거

정적 판정을 먼저 했고(외부 호출·설치 훅·게시 부작용), 그 다음에 실행했다. 공통 근거 4건은
`test/helpers.ts:1174` 의 `withMockGh`(`GH_BIN`/`GH_BIN_ARGS` 로 로컬 node 스크립트로 우회),
`test/manual-publication-authority.test.ts:21` 의 임시 PATH 가짜 `curl`,
`test/automerge-metrics.test.ts:292` 의 주입 `fetcher`(미등록 URL 은 예외),
`test/dashboard-worker-harness.ts:842` 의 `globalThis.fetch` 교체와 `:965` 복원이다.

| # | 경로 | 이 PR 과의 관련 | 판정 근거 |
| -- | -- | -- | -- |
| 1 | `test/check-docs.test.ts` | `config/` 매니페스트 소비(조사 7b) | `git init`/`add` 를 `mkdtemp` 루트에서만 실행(`:335`), 저장소 루트를 읽지 않음 |
| 2 | `test/check-dashboard-strict.test.ts` | 검사기 계약 | 순수 in-process 단정만 |
| 3 | `test/stable-json.test.ts` | 결정적 직렬화 | 순수. `dist` import |
| 4 | `test/apply-close-policy-guards.test.ts` | 자동 종료 경계 | `dist` import, 외부 IO 없음 |
| 5 | `test/close-reasons.test.ts` | 자동 종료 사유 | `withMockGh` |
| 6 | `test/pr-label-policy.test.ts` | 자동 라벨 | `dist` import만 |
| 7 | `test/apply-label-sync.test.ts` | 자동 라벨 동기화 | `withMockGh` |
| 8 | `test/label-mutation-batch.test.ts` | 라벨 변경 배치 | 로컬 증빙 스크립트 하나만 spawn(`:491`), 그 스크립트에 네트워크 호출 없음 |
| 9 | `test/automerge-metrics.test.ts` | 자동 머지 | 주입 `fetcher`, 로컬 `--help` spawn |
| 10 | `test/parked-command-finalization.test.ts` | parked 명령 종결 | in-process DO 하네스, `fetch` 스텁 |
| 11 | `test/manual-publication-policy.test.ts` | 수동 게시 정책 | 순수 |
| 12 | `test/manual-publication-authority.test.ts` | 허용 호출자 판정 | 가짜 `curl` |
| 13 | `test/repository-profiles.test.ts` | 대상 프로필(Part B 경계) | `spawnSync`/`execFile`/`fetch` 호출 자체가 없음. `pnpm install` 문자열은 픽스처 데이터 |

## 부록 A2 · 복원하지 않는 것과 이유

| 대상 | 분류 | 이유 |
| -- | -- | -- |
| `test/run-node-tests.test.ts` | 안전하지만 프로필 불일치 | `:114` 가 `package.json` 의 `test` 가 `pnpm run build:all && pnpm run test:no-build` 라고 단정한다. 이 포크는 그 자리를 가드로 바꿨다. 나머지 단정은 통과한다 |
| `test/hosted-target-admission.test.ts` | 안전하지만 프로필 불일치 | `.github/workflows/hosted-target-admission.yml` 를 읽어 ENOENT. 워크플로가 parked 라서 나는 실패다 |
| `test/repair/**` 144개 | 범위 밖 | repair 워커·컨테이너·git 픽스처와 parked 워크플로 경로 전제 |
| `test/dashboard-worker-*` 다수 | Part B 미결정 의존 | Worker·큐·R2 구성 선택이 아직 없다 |
| `codex-*`, `agent-runner`, `review-runtime` 계열 | 모델 실행 표면 | 에이전트 프로세스 기동 경로. 유료 호출 경계에 닿는다 |
| `live-proof*`, `github-egress-*`, `github-api*`, `e2e/*`, `crabbox*` | 외부 전송 표면 | S3 업로드·GitHub 전송·외부 러너 전제 |

두 프로필 불일치 항목은 잃은 커버리지로 남는다. 감춘 실패가 아니라 드러낸 실패다.

## 부록 A3 · 감사 3회전 정정 (round 2 차단 반영)

2회전 감사는 `FAIL` 을 냈고 차단 2건을 지적했다. 둘 다 접는다.

**정정 1 · C6 은 개수만 고정했고 구성원은 고정하지 않았다.** 개수 13 을 유지한 채 승인된 테스트 하나를
제외 대상(`test/hosted-target-admission.test.ts`)으로 바꿔치기해도 C6 의 모든 조건을 만족한다는 것을
감사가 실제로 확인했다. C6 을 아래로 대체한다.

- **C6-1** `scripts/check-scaffold.mjs` 안에 순서가 있는 리터럴 배열 `LINA_SAFE_TESTS` 를 둔다.
  값은 부록 A 의 13개 경로 그대로다. `derived.safeTests.files` 는 이 배열과 `deepEqual` 이어야 한다.
  개수·구성원·순서 전부가 코드 쪽에 있으므로 config 만으로 바꿔치기·추가·삭제·재정렬이 불가능하다.
- **C6-2** 리터럴 `LINA_EXCLUDED_TESTS` 에 프로필 불일치 2개(`test/run-node-tests.test.ts`,
  `test/hosted-target-admission.test.ts`)를 두고, `LINA_SAFE_TESTS` 와의 교집합이 공집합임을 확인한다.
- **C6-3** config 쪽은 여전히 각 경로에 비어 있지 않은 `reason` 을 가져야 하고, 각 경로는 upstream
  트리 실물 경로여야 한다. 즉 코드가 집합을, config 가 근거를 소유한다.
- **C6-4** 음성 검증에 "같은 개수로 바꿔치기" 사례를 추가한다. `lina:contract-selftest` 이
  13개 중 하나를 제외 대상으로 치환한 선언을 만들어 거부되는지 확인한다.

**정정 2 · assert 기준 수가 틀렸다.** `grep -c assert` 는 `import` 줄까지 세어 24 를 준다. 실제 단정
호출은 23 이다. `git show f611316d:scripts/check-scaffold.mjs | rg -c '^\s*assert(\.|\()'` 가 23 이고
`rg -c 'assert'` 가 24 다. 수용 기준 9 를 아래로 대체한다.

- **수용 기준 9(정정)** baseline `f611316d` 의 단정 호출 수는 `^\s*assert(\.|\()` 기준 23 이다.
  변경 후 그 수는 23 보다 커야 한다. 그리고 개수만으로는 부족하므로,
  `git diff f611316d -- scripts/check-scaffold.mjs` 를 읽어 기존 단정 23건 각각의 **동작**이
  남아 있는지 확인한다. 문자열이 남아 있는 것과 동작이 남아 있는 것은 다르다. 리뷰어가 2회전에서
  만든 23건 전수 표를 이 확인의 체크리스트로 쓴다.

**비차단 요구 반영.** tripwire 에서 `run` 이 실패할 때 그 실패 메시지는 tripwire 를 이름으로
지목해야 한다(`LINA_CHECK_SPAWN_TRIPWIRE`). 일반 실패와 구분되지 않으면 관측이 아니다.

## 부록 B · 프로브 대상 8개

| 자동 동작 | 스크립트 | package.json |
| -- | -- | -- |
| 코드 자동 수정 | `repair:execute-fix` | `:47` |
| 코드 자동 수정 | `repair:apply-result` | `:46` |
| 자동 종료 | `apply-decisions` | `:22` |
| 자동 종료 | `repair:finalize-open-prs` | `:49` |
| 자동 머지 | `e2e:automerge` | `:18` |
| 자동 머지 | `repair:publish-main` | `:56` |
| 자동 라벨 | `repair:cleanup-replacement-labels` | `:50` |
| 자동 라벨 | `repair:tag-clawsweeper` | `:76` |

워크플로 쪽은 이름별 부재를 확인한다. `clawsweeper-dispatch`, `repair-comment-router`,
`repair-publish-results`, `automerge-e2e`, `sweep` 다섯의 `.yml` 이 없고 `.yml.disabled` 만 있음을 본다.

## 부록 C · 프로브가 증명하지 못하는 것

`node dist/...` 직접 실행은 가드를 지나지 않는다. 원격 저장소의 Actions 설정, App 설치 상태,
ruleset 은 로컬 프로브의 관측 대상이 아니다. `src/` 에 해당 기능이 없다는 뜻도 아니다. 빌드된다.
그리고 복원한 테스트가 로컬 부작용을 전혀 내지 않는다는 뜻도 아니다. 임시 디렉터리에는 쓴다.
