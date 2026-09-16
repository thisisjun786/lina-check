# 010 · 검증 기준 조정 계약 (wp2)

## 소유 범위

`config/lina-check-scaffold.json` 의 `derived` 절, `scripts/lina-check-derived-contract.mjs`,
`scripts/check-scaffold.mjs`, `package.json` 의 파생 스크립트 4개, 그리고 검증기가 단정 대상으로
삼는 `scripts/lina-check-*.mjs` 3개다.

세 스크립트를 이 단계에서 함께 만드는 이유가 있다. 검증기의 새 단정이 러너의 미리보기 출력과
프로브의 대상 목록을 직접 확인하기 때문에(`000_plan.md` C6-1, C7, D-A5), 그것들이 없으면
`check:scaffold` 자체가 통과할 수 없다. 빌드 순서로 묶인 하나의 단위다. 실행과 기록은 wp3·wp4 가 맡는다.

## 계약

구속력 있는 조항은 `000_plan.md` 의 C1~C9 와 부록 A3 의 C6-1~C6-4 다. 여기서 다시 쓰지 않는다.
핵심은 층을 나누는 것이다. 정확히 적으면 이렇다.

- **코드가 집합을 고정하는 것.** 복원 테스트 13개(개수·구성원·순서), 제외 테스트 2개, 파생 스크립트
  이름 4개와 **각각의 정확한 명령**, 프로브 스크립트 8개, 프로브 워크플로 5개, 대체된 upstream
  문서 4개. `derived` 선언이 이것과 다르면 거부된다.
- **config 가 목록을 제시하고 코드가 제약하는 것.** `derived.files` 의 구성원뿐이다. 위치 패턴,
  traversal, 심링크, upstream 충돌, 실재 여부, 근거 존재를 코드가 검사한다.
- **config 가 근거만 갖는 것.** 위 모든 항목의 `reason` 문자열.

이름만 고정하면 부족하다는 지적을 리뷰에서 받았다. config 와 `package.json` 을 함께 고치면
`lina:test-safe:preview` 를 `run` 으로 돌릴 수 있었기 때문이다. 그래서 명령 문자열까지 리터럴로
고정했고, 선언·`package.json`·리터럴 셋이 모두 일치해야 통과한다.

프로브 목록도 상위집합 허용에서 정확한 일치로 바꿨다. 상위집합은 실행되지 않는 항목을 선언에
넣어 보고 수치만 키울 수 있었다.

## 하지 않는 것

기존 단정 23건 중 어느 것도 삭제하지 않는다. `allowed` 10개, `blocked` 104개, parked 35개,
upstream pin·tree·바이트·모드 검사, `.gitignore` 꼬리, 가드 프로브는 그대로 둔다.

## 수용

`corepack pnpm run check:scaffold` exit 0. 그리고 `git diff 1f36c10e -- scripts/check-scaffold.mjs`
에서 단정 호출 수가 23 보다 크고, 기존 23건의 동작이 남아 있다.

## 결과

구현을 마쳤다. 파일 7개를 건드렸고 upstream 바이트는 하나도 바꾸지 않았다.

| 파일 | 변경 |
| -- | -- |
| `scripts/lina-check-derived-contract.mjs` | 신규 212줄. 리터럴 소유와 선언 검증 |
| `scripts/lina-check-safe-tests.mjs` | 신규 131줄. 러너와 미리보기 |
| `scripts/lina-check-boundary-probe.mjs` | 신규 92줄. 경계 프로브 |
| `scripts/lina-check-contract-selftest.mjs` | 신규 212줄. 거부 경로 음성 검증 |
| `scripts/check-scaffold.mjs` | 단정 호출 23 → 26. 삭제 0 |
| `config/lina-check-scaffold.json` | `derived` 절 추가 |
| `package.json` | 파생 스크립트 4줄 추가 |

`check:scaffold` 출력에 한 줄이 늘었다.

```
Derived declarations validated: 11 files; 4 scripts; 13 restored upstream tests;
8 boundary-probe targets; preview observed non-executing under LINA_CHECK_SPAWN_TRIPWIRE.
```

음성 검증은 거부 경로 25건, 순수 보조 함수 3건, tripwire 대조 2건을 관측했다.
`[lina-check-contract-selftest] rejected=25 helpers=3 tripwireControls=2`

수용 기준 9 를 확인했다. baseline 단정 호출 23건은 그대로 있고 3건이 늘었다. 넓어진 두 단정은
`:134` 의 추가 파일 허용과 `:90` 의 파생 스크립트 허용이며, 넓힌 만큼은 `assertDerivedContract` 의
새 검사로 다시 좁혔다. 삭제한 단정은 없다.

수용 기준 9 는 문장으로만 두지 않고 기계 검사로 바꿨다. 검증기 파일을 직접 고치는 것은 이
저장소의 모든 검사를 지나가는 알려진 우회로이므로(우회 (c)), 그 우회에 조기 경고를 붙였다.
`lina:contract-selftest` 이 baseline 커밋의 검증기를 읽어 단정 호출 23건을 확인하고, 현재 파일이
그보다 적지 않은지, 그리고 diff 에서 단정 줄이 삭제되지 않았는지 본다.
출력은 `assertionCalls=23->26` 이다. 강제 계층이 아니라 경고라는 성격은 그대로다.

---

## wp2 P 재확인 · 구현 수준 계획

wp1 의 D 결론은 "집합은 코드가 소유하고 근거는 config 가 소유한다"였다. 방향을 바꾸지 않는다.
아래는 그 결론을 파일 수준으로 내린 것이다.

### 신규 `scripts/lina-check-derived-contract.mjs`

export 하나: `assertDerivedContract({ config, upstreamScripts, baselinePaths, root, existsSync, lstatSync, readFileSync })`.
순수 함수로 두어 selftest 가 메모리 상의 잘못된 선언을 먹여 거부를 관측할 수 있게 한다.
리터럴 소유물 네 개를 이 모듈에 둔다.

| 리터럴 | 값 |
| -- | -- |
| `DERIVED_SCRIPT_NAMES` | `lina:test-safe`, `lina:test-safe:preview`, `lina:boundary-probe`, `lina:contract-selftest` |
| `SAFE_TESTS` | 부록 A 의 13개 경로, 정렬된 순서 |
| `EXCLUDED_TESTS` | `test/run-node-tests.test.ts`, `test/hosted-target-admission.test.ts` |
| `BOUNDARY_PROBE_SCRIPTS` | 부록 B 의 8개 이름 |

거부 사유를 문자열 코드로 돌려준다. selftest 가 사유별로 대조한다.
`derived-location`, `derived-upstream-collision`, `derived-symlink`, `derived-missing`,
`derived-reason`, `script-set`, `script-command`, `script-blocked-target`,
`safe-tests-mismatch`, `safe-tests-excluded`, `safe-tests-reason`, `probe-subset`.

### `scripts/check-scaffold.mjs` 변경

기존 단정 23건은 손대지 않는다. 추가만 한다.

1. `additions` 를 `core ∪ Object.keys(config.derived.files)` 로 만든다. `core` 는 기존 리터럴 그대로다.
2. `assertDerivedContract` 를 호출한다. C1~C7 전부가 이 안에서 검사된다.
3. `expectedPackage.scripts` 에 `config.derived.scripts` 의 명령을 병합한다. 기존 `deepEqual` 이
   선언과 실물의 불일치를 양방향으로 잡는다.
4. `derived.replacedUpstreamDocs` 가 `docs` 배열과 같은지 확인한다.
5. 미리보기를 `LINA_CHECK_SPAWN_TRIPWIRE=1` 로 실행해 exit 0 과 `executed:false` 와 대상 목록 일치를
   확인한다(C8 + D-A5).

### `scripts/lina-check-safe-tests.mjs`

자식 프로세스 생성은 `launchTests()` 한 곳에만 둔다. `LINA_CHECK_SPAWN_TRIPWIRE` 가 설정돼 있으면
그 함수는 진입 즉시 `Error("LINA_CHECK_SPAWN_TRIPWIRE tripped: ...")` 로 실패한다. 이름을 메시지에
넣어 일반 실패와 구분한다.

종료 코드 `0` 통과, `1` 테스트 실패, `2` 사용법·선언 위반, `3` `dist` 부재.
자식 환경에서 `/TOKEN|SECRET|_KEY$|^GH_|^GITHUB_/` 에 맞는 변수를 지운다.

### `scripts/lina-check-boundary-probe.mjs`

대상마다 (1) `package.json` 이 아직 가드로 매핑하는지 확인, (2) `corepack pnpm run <name>` 실행,
(3) exit 1 과 `is disabled` 확인. 워크플로는 `.yml` 부재와 `.yml.disabled` 존재를 본다.
실행 전후 `git status --porcelain` 을 비교한다. 트리에 쓰지 않는다.

### `scripts/lina-check-contract-selftest.mjs`

정상 선언이 통과하는지, 그리고 위 12개 거부 사유가 각각 실제로 거부되는지 확인한다.
"같은 개수로 제외 대상으로 바꿔치기"를 반드시 포함한다(C6-4).

### 커밋 경계

wp1 의 문서 7건은 이 단계의 선언과 같은 커밋에 넣는다. 그래야 모든 커밋에서 `check:scaffold` 가
통과한다. 문서만 먼저 커밋하면 그 커밋은 자기 저장소의 게이트를 깨뜨린 상태로 남는다.

---

## wp2 A 감사 반영 (차단 3건)

### 정정 1 · 순수 함수의 입력을 넓힌다 (차단 2 해소)

감사가 맞다. config 만 받는 순수 함수에는 "미선언 파일", "가드가 아닌 매핑", "작업물 변경" 을
주입할 수 없다. 그러면 그 거부 경로는 음성 검증이 불가능하다. 인터페이스를 넓힌다.

```
assertDerivedContract({
  config,            // 선언
  upstreamScripts,   // upstream package.json 의 scripts
  baselinePaths,     // upstream 트리 경로 집합
  presentPaths,      // 실제 존재하는 추적/비무시 경로 집합
  packageScripts,    // 현재 package.json 의 scripts
  coreAdditions,     // 기존 하드코딩 additions
  readFileSync, lstatSync,
})
```

`check-scaffold.mjs` 는 실제 값을 넣고, selftest 는 픽스처를 넣는다. 같은 코드 경로다.
프로브의 가드 확인과 작업물 비교도 순수 보조 함수로 뽑는다.
`assertProbeTargetGuarded(packageScripts, name)` 와 `assertWorktreeUnchanged(before, after)`.

### 정정 2 · 리터럴 불변식과 선언 거부를 구분한다 (차단 3 해소)

`SAFE_TESTS` 와 `EXCLUDED_TESTS` 의 서로소 관계는 코드 리터럴 둘의 관계이므로 config 로 건드릴 수
없다. 그것을 "거부 사유" 목록에 넣은 것이 틀렸다. 모듈 적재 시점 불변식으로 분리한다.

**모듈 불변식(거부 사유가 아니다).** I1 `SAFE_TESTS` ∩ `EXCLUDED_TESTS` = ∅.
I2 `SAFE_TESTS` 는 정렬·중복 없음·길이 13. I3 `BOUNDARY_PROBE_SCRIPTS` 길이 8.
이 셋이 깨지면 모듈 적재 자체가 실패한다.

C6-4 의 "같은 개수로 제외 대상 바꿔치기" 픽스처는 `safe-tests-mismatch` 로 거부된다.
`safe-tests-excluded` 라는 사유는 없애고, 대신 I1 이 그 불변식을 지킨다.

### 정정 3 · C8 의 양성 대조를 둔다 (차단 1 해소)

미리보기가 tripwire 아래에서 exit 0 인 것만 보면, tripwire 가 고장 났을 때도 통과한다.
대조군을 함께 관측한다.

| 관측 | 기대 |
| -- | -- |
| 음성 대조 · tripwire 켜고 `preview` | exit 0. 실행 경계에 닿지 않았다 |
| 양성 대조 · tripwire 켜고 `run` | exit 0 이 아니고, 진단에 `LINA_CHECK_SPAWN_TRIPWIRE` 문자열이 있다 |

양성 대조가 실패하면 tripwire 가 죽은 것이고, 그때 음성 대조의 exit 0 은 아무 의미가 없다.
두 관측을 `lina:contract-selftest` 이 함께 수행한다. `check:scaffold` 는 미리보기 대조만 한다.

### 거부 사유 전량 (음성 검증 대상)

사유 하나에 픽스처 하나가 아니라, 구분되는 위반마다 픽스처를 둔다.

| 사유 | 픽스처 |
| -- | -- |
| `derived-location` | 허용 경로 밖(`src/x.mjs`) |
| `derived-traversal` | `..` 포함, 절대 경로 |
| `derived-symlink` | 일반 파일이 아님 |
| `derived-upstream-collision` | upstream 경로를 파생으로 선언 |
| `derived-missing` | 선언했으나 `presentPaths` 에 없음 |
| `derived-undeclared` | `presentPaths` 에 있으나 core·선언 어디에도 없음 |
| `derived-reason` | `reason` 없음, 빈 문자열, 공백만 |
| `derived-empty` | `files` 가 빈 객체 |
| `script-set` | 이름 집합 불일치(누락 / 추가) |
| `script-upstream-name` | upstream 이름 재사용 |
| `script-command` | 형태 위반, 미선언 파일 지목 |
| `script-blocked-target` | 소스에 `dist/clawsweeper.js` 등 차단 대상 문자열 포함 |
| `script-package-mismatch` | `package.json` 매핑이 선언과 다름 |
| `safe-tests-mismatch` | 바꿔치기(같은 개수), 순서 변경, 중복, 개수 증감 각각 |
| `safe-tests-unknown-path` | upstream 트리에 없는 경로 |
| `safe-tests-reason` | 근거 없음 |
| `probe-subset` | 8개 중 하나 제거 |
| `probe-unguarded` | 대상 매핑이 가드가 아님 |
| `replaced-docs-mismatch` | `docs` 배열과 불일치 |
| `worktree-changed` | 전후 `git status` 문자열 상이 |

### 정정 4 · 표현 정정

"기존 단정 23건의 동작이 그대로"라고 쓰면 부정확하다. 감사 Q2 가 맞다. 단정 두 개는 의도적으로
넓어진다. `check-scaffold.mjs:134` 는 선언된 추가를 받아들이고, `:90` 은 파생 스크립트 4개를
받아들인다. 정확한 표현은 이렇다. **단정을 삭제하지 않는다. 두 건은 선언에 근거해 의도적으로
넓히고, 넓힌 만큼을 새 단정으로 다시 좁힌다.**

리터럴의 소유자도 정정한다. 리터럴은 `scripts/lina-check-derived-contract.mjs` 가 소유하고
`check-scaffold.mjs` 가 import 한다. 소유가 코드에 있다는 계약은 그대로다.
