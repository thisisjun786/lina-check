# 060 · 복원 테스트 한 건의 upstream 호환 실행 (wp3)

> 이 문서는 A 감사 1회전에서 결론이 뒤집혔다. 처음에는 제외를 택했고, 감사가 제외하지 않는
> 방법을 제시해 그쪽으로 바꿨다. 아래는 바뀐 결론이다.

## 충돌

JUN-135 가 복원한 13개 중 `test/repository-profiles.test.ts` 가 이 과제와 정면으로 부딪힌다.
그 파일의 `dashboard targets stay an explicit public-output scope` 가
`dashboard/wrangler.toml` 을 직접 읽고 이렇게 단정한다.

```
TARGET_REPOS     == openclaw/openclaw, openclaw/clawhub, openclaw/clawsweeper, openclaw/fs-safe
PUBLIC_BAY_REPOS == TARGET_REPOS
```

JUN-198 의 범위 6 은 Worker 설정이 원본 저장소를 가리키는 문제를 해소하는 것이다.
저 두 변수는 그 문제의 가장 분명한 사례다. 비우면 정규식이 빈 문자열을 잡지 못해
`undefined` 와 4개 배열을 비교하게 되고 테스트가 깨진다.

둘 다 만족할 방법은 없다. 테스트가 upstream 운영 대상값 자체를 단정하기 때문이다.

## 감사가 짚은 것

제외는 피할 수 있다. 깨지는 단정 두 줄이 읽는 방식이 나머지와 다르기 때문이다.

| 읽기 | 기준 | 결과 |
| -- | -- | -- |
| `readFileSync("dashboard/wrangler.toml")` (:155) | 현재 작업 디렉터리 | 작업 디렉터리를 바꾸면 다른 바이트를 읽는다 |
| `readFileSync("config/target-repositories.json")` (:166) | 현재 작업 디렉터리 | 같다 |
| `import "../dist/repository-profiles.js"` (:9) | 테스트 파일 위치 | 작업 디렉터리와 무관하다 |
| `repoRoot()` (`src/repository-profiles.ts:545`) | 모듈 위치 | 작업 디렉터리와 무관하다 |

즉 이 한 파일만 pin 된 upstream 바이트를 담은 임시 디렉터리에서 돌리면, 두 단정은 upstream
바이트를 읽고 나머지 단정은 실제 `dist/` 와 실제 프로필 설정을 그대로 읽는다.

## 결정

복원 집합을 13으로 유지한다. `test/repository-profiles.test.ts` 하나만 upstream 호환 모드로
돌린다. 나머지 12개는 지금처럼 저장소 루트에서 돌린다.

임시 디렉터리에는 `git show <pin>:dashboard/wrangler.toml` 과
`git show <pin>:config/target-repositories.json` 두 파일만 넣는다. 손으로 적은 사본이 아니라
pin 에서 뽑는다. 사본이 upstream 과 어긋날 수 없다.

## 이 실행이 증명하는 것과 증명하지 않는 것

정확히 적는다. 이 실행은 **원본 프로필 해석기가 원본 설정에 대해 여전히 맞다** 는 것을 증명한다.
**우리 설치 설정이 무엇인지에 대해서는 아무 것도 증명하지 않는다.** 두 번째를 같은 테스트로
증명하려 들면 그것이야말로 테스트를 약하게 만드는 일이다.

그래서 우리 쪽 사실은 별도로 단정한다.

| 단정 | 어디서 |
| -- | -- |
| 실제 `dashboard/wrangler.toml` 의 대상 변수가 비어 있다 | `check:scaffold` |
| 실제 `config/lina-check-installation.json` 이 미설정이고 목록이 비어 있다 | `check:scaffold` |
| 미설정 프로필이 원본 소유자 폴백을 거부한다 | `lina:contract-selftest` |
| 미설정 프로필이 명시적으로 나열된 원본 저장소도 거부한다 | `lina:contract-selftest` |

마지막 두 줄이 감사 지적 2에 대한 직접 응답이다. 소유자 목록만 비우는 것으로는 부족하다는
지적이므로, 두 경로를 각각 거부 픽스처로 관측한다.

## 러너에 생기는 변경

`scripts/lina-check-safe-tests.mjs` 에 "이 테스트는 upstream 픽스처 작업 디렉터리에서 돈다" 는
개념이 하나 생긴다. 넓은 기능이 아니라 한 항목짜리 예외다.

| 소유 | 무엇 |
| -- | -- |
| 코드 리터럴 `UPSTREAM_FIXTURE_TESTS` | 어떤 테스트가 이 모드로 도는지, 어떤 파일을 픽스처에 넣는지 |
| config 선언 | 항목별 근거 |

집합을 config 로 넓힐 수 없다는 규칙은 그대로다. 기존 러너 성질도 그대로 둔다.
산출물 신선도 판정, 자격증명 형태 변수 제거, tripwire, 실패 전파, 미리보기 비실행.
미리보기는 픽스처를 만들지 않는다. 미리보기가 파일을 쓰면 비실행 관측이 무의미해진다.

임시 디렉터리는 `mkdtemp` 로 만들고 실행 후 지운다. 저장소 트리에 쓰지 않는다.
프로브와 같은 규칙으로 실행 전후 `git status --porcelain` 을 대조한다.

## 남는 한계

## wp2 진입 조건 · 복원 테스트 하나가 더 걸린다

wp2 구현 계획 감사가 찾았다. `test/parked-command-finalization.test.ts` 도 복원 13개 중
하나인데, `test/dashboard-worker-harness.ts:929` 가 실제 큐를 이렇게 만든다.

| harness 가 주는 것 | 값 |
| -- | -- |
| App 자격증명 | 합성값 |
| `hostedTargetPredicate` | 항상 참 |
| 설치 프로필 | 없음 |
| mock fetch 가 기다리는 URL | `/repos/openclaw/clawsweeper/...` |

마지막 줄이 핵심이다. 그 URL 은 env 가 아니라 `dashboard/worker.ts` 의
`CLAWSWEEPER_REVIEW_REPO` 모듈 상수에서 나온다. 그래서 두 가지가 동시에 걸린다.
허용 게이트가 intake 를 막고, URL 게이트가 mock GitHub 호출을 막는다.

### 지켜야 할 선

테스트 파일을 고치지 않는다. harness 도 upstream 이고 수정 집합에 없다.
주입된 predicate 를 설치 인가로 취급해 테스트를 구하지 않는다. 그렇게 하면 게이트가 약해진다.

### wp2 가 답해야 할 것

미설정 판정의 기준을 무엇으로 잡을지다. 전송 게이트의 기준을 설치 프로필로 잡으면 이 테스트가
깨지고, App 자격증명 유무로 잡으면 기존 동작과 같아져 새 게이트가 아니다. 이 문제를 풀지 못하면
복원 13개를 유지한다는 약속과 전송 게이트 중 하나를 포기해야 하고, 어느 쪽을 포기했는지
`070` 에 그대로 적는다. 조용히 둘 다 통과한 척하지 않는다.

## wp2 진입 조건 · 실제 wrangler 단정이 필요하다

같은 감사의 지적이다. 위의 픽스처 실행은 pin 된 바이트를 읽으므로, 실제
`dashboard/wrangler.toml` 의 `TARGET_REPOS` 와 `PUBLIC_BAY_REPOS` 가 비었는지는 아무도
보지 않게 된다. 금지 리터럴 검사도 평범한 저장소 이름은 잡지 못한다.
`check:scaffold` 에 실제 파일에 대한 명시 단정을 넣는다. 픽스처 실행으로 옮기기 전에 넣는다.

이 방식은 두 단정이 우리 설정이 아니라 pin 된 원본을 검사한다는 사실을 감추지 않는다.
선언의 근거 문자열과 이 문서에 그대로 적는다. "13개 전부 통과" 라고만 보고하면
그 13번째가 무엇을 읽었는지가 사라지므로, 게이트 표에도 한 줄로 적는다.
