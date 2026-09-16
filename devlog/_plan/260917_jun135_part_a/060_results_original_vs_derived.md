# 060 · 원본 기준 결과와 파생 변경 후 결과

같은 항목을 상태별로 관측해 나란히 둔다. 상태는 둘이 아니라 셋이다. 하나로 뭉치면 거짓이 된다.

| 상태 | 무엇 |
| -- | -- |
| 원본 기준 | 깨끗한 `f611316d`. 이 과제의 파생 변경 전 |
| 중간 | 선언되지 않은 `devlog/` 파일이 있고 아직 선언 기능이 없던 상태 |
| 파생 변경 후 | `44524653`. wp3 시점에 측정한 SHA |

`44524653` 은 "최종 head" 가 아니다. 최종 head 게이트 증거는 wp6 이 따로 수집한다.

## 측정 방법과 그 한계

종료 코드를 두 방법으로 읽었고 신뢰도가 다르다. 항목마다 어느 쪽인지 적는다.

| 방법 | 신뢰도 |
| -- | -- |
| A: `명령 > 파일 2>&1; echo $?` | 명령의 종료 코드다. 신뢰할 수 있다 |
| B: `명령 | tail; echo $?` | `tail` 의 종료 코드다. 명령의 실패를 가린다 |

원본 기준 측정 일부가 방법 B 였다. 그 항목은 종료 코드를 증거로 쓰지 않고, 출력 내용으로 성공을
판단했다. `check:scaffold` 의 `PASS:` 줄과 `lint` 의 네 개 `Done` 줄은 모든 단계를 지난 뒤에만
나오므로 성공의 증거가 된다. 그래도 종료 코드 자체는 방법 B 에서 확인되지 않았다고 적는다.

파생 상태에서 다시 돌린 결과가 원본 기준의 종료 코드를 증명하지는 않는다. 두 상태는 다른 트리다.

## 원본 기준 (`f611316d`, 변경 전)

| 항목 | 결과 | 방법 |
| -- | -- | -- |
| `install --frozen-lockfile --ignore-scripts` | 성공. 23개 패키지 해결, `Done in 22ms` | B |
| `check:scaffold` | 성공. `PASS: upstream 1ed7bd4e...; 1646 original entries checked; 35 workflows parked; 104 commands blocked` | B |
| `build:all` | 성공. `tsc` 3개 프로젝트 무오류 | B |
| `lint` | 성공. `lint:src`·`lint:repair`·`lint:scripts`·`lint:dashboard` 모두 `Done` | B |
| 후보 테스트 15개 | 13개 exit 0, 2개 exit 1 | A, 파일별 개별 실행 |
| 안전 부분집합 러너 | 존재하지 않았다 |  |
| 비실행 미리보기 | 존재하지 않았다. 013 이 적은 대로 `check:scaffold` 의 보존 검사가 유일한 비실행 확인이었다 |  |
| 차단 프로브 | `check:scaffold` 내부의 raw node 가드 프로브 104건만. 운영자가 쓰는 package 경로 프로브는 없었다 |  |

실패 2건의 서명을 적는다. 둘 다 안전성 문제가 아니다.

- `test/run-node-tests.test.ts` — `AssertionError`. 기대 `/^pnpm run build:all && pnpm run test:no-build$/`,
  실제 `node scripts/scaffold-disabled.mjs test`. 이 포크가 그 자리를 가드로 바꿨기 때문이다.
- `test/hosted-target-admission.test.ts` — `ENOENT`, `path: '.github/workflows/hosted-target-admission.yml'`.
  워크플로가 `.yml.disabled` 로 parked 라서 나는 실패다.

두 항목은 잃은 커버리지로 남는다. 더 넓은 제외 목록과 이유는 `000_plan.md` 부록 A2 에 있다.

## 중간 상태

선언 기능을 만들기 전에 `devlog/` 문서를 놓아 본 상태다. 이때 `check:scaffold` 는 exit 1 이고
`Unexpected source addition: devlog/_plan/260917_jun135_part_a/000_plan.md` 를 냈다.

이 관측의 내 측정은 방법 B 였고 종료 코드를 잘못 읽었다. 같은 실행을 독립 리뷰어가 따로 돌려
exit 1 을 확인했다(dispatch `jun135-audit-wp1-r2`, `jun135-audit-records-2`).

이 줄이 이 과제의 성격을 말한다. 검증 기준을 느슨하게 만든 것이 아니라, 거부하던 것을 선언으로
추적하게 만든 것이다.

## 파생 변경 후 (`44524653`)

전부 방법 A 로 측정했다.

| 명령 | exit | 결과 |
| -- | -- | -- |
| `corepack pnpm run check:scaffold` | 0 | 기존 `PASS:` 두 줄에 한 줄 추가. `Derived declarations validated: 11 files; 4 scripts; 13 restored upstream tests; 8 boundary-probe targets; preview observed non-executing under LINA_CHECK_SPAWN_TRIPWIRE.` |
| `corepack pnpm run build:all` | 0 | `tsc` 3개 무오류 |
| `corepack pnpm run lint` | 0 | 4개 모두 `Done`. `lint:scripts` 가 신규 `.mjs` 4개를 읽는다 |
| `corepack pnpm run lina:test-safe` | 0 | `tests 333 / pass 333 / fail 0 / cancelled 0 / skipped 0 / todo 0`, `duration_ms 131118` |
| `corepack pnpm run lina:test-safe:preview` | 0 | 선언된 13개를 나열하고 테스트를 띄우지 않았다 |
| `corepack pnpm run lina:contract-selftest` | 0 | `rejected=25 helpers=3 tripwireControls=2 assertionCalls=23->26` |
| `corepack pnpm run lina:boundary-probe` | 0 | 8개 입구 전부 exit 1, 워크플로 5개 parked, 작업물 변동 없음 |

`lina:*` 네 명령은 원본 기준에 존재하지 않았으므로 두 상태를 같은 표로 비교할 수 없다.
그래서 위를 따로 적었다.

부수 확인. `git diff --quiet f611316d HEAD -- src dashboard test pnpm-lock.yaml` exit 0.
`rg -c '^\s*assert(\.|\()' scripts/check-scaffold.mjs` 는 26, 삭제된 단정 줄은 0,
`git diff --name-only f611316d -- src dashboard test pnpm-lock.yaml .github` 는 0줄이다.

## 이 표가 주장하지 않는 것

- 복원은 upstream 테스트 바이트를 바꾼 것이 아니라 **바뀌지 않은 바이트를 새로 호출한 것**이다.
- 미리보기의 "아무것도 실행하지 않는다"는 **테스트를 띄우지 않는다**는 뜻이다. 미리보기 자체는
  코드를 실행한다. 그래서 tripwire 양성 대조와 함께 읽어야 한다. `run` 은 tripwire 아래에서
  `LINA_CHECK_SPAWN_TRIPWIRE` 를 이름으로 들며 실패한다.
- `assertionCalls=23->26` 은 단정의 개수와 줄의 보존을 측정한다. 모든 단정의 **동작** 보존을
  측정하지 않는다. 넓어진 두 단정은 의도적이고 그 내용은 `010` 에 있다.
- upstream 전체 테스트가 통과했다는 뜻이 아니다. 돌리지 않았고 이 단계에서 돌려서는 안 된다.
- 라이브 연동이 검증됐다는 뜻이 아니다. `check:scaffold` 출력 자체가 그렇게 밝힌다.
- 복원한 테스트가 임시 파일을 전혀 쓰지 않는다는 뜻도 아니다. 임시 디렉터리에는 쓴다.

