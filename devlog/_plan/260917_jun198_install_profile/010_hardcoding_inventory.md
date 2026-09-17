# 010 · 개인 계정 하드코딩 전수 조사 (wp3 입력)

## 방법

`rg -n -i "steipete" src/ dashboard/ config/ schema/ scripts/ prompts/ instructions/ .github/` 로
코드·설정·프롬프트·파킹된 워크플로 전체를 훑었다. `docs/` 와 `test/` 는 별도로 셌다.
`pnpm-lock.yaml` 과 `docs/upstream/` 는 제외했다.

원본 운영 지시자도 같은 방식으로 셌다. Cloudflare 계정 ID, App client ID, 운영 도메인 두 개,
레지스트리 URL 이다.

## 결과 · 개인 소유자 계정 이름

코드·설정·프롬프트·파킹 워크플로에서 15개 파일 26줄이다.

| 분류 | 위치 | 성격 | 처리 |
| -- | -- | -- | -- |
| A 허용 판정 | `src/hosted-target-admission.ts:5` | `HOSTED_TARGET_FALLBACK_OWNERS` 리터럴이 레지스트리가 선언할 수 있는 소유자를 한정한다 | 설정 기반으로 이전 |
| A 허용 판정 | `dashboard/worker.ts:4907` | 웹훅 저장소 적격 판정의 소유자 비교 | 설정 기반으로 이전 |
| A 허용 판정 | `config/target-repositories.json:155,187` | 일반 폴백 소유자와 인벤토리 소유자 | 권한을 설치 설정으로 옮겨 무권한화 |
| B 대상 목록 | `config/target-repositories.json:113` | 원본 운영 대상 한 건 | 새 진입점으로 복사하지 않는다 |
| C 파킹 워크플로 | `.github/workflows/hosted-target-admission.yml.disabled:120` | src 리터럴을 그대로 옮겨 적은 판정 | 바이트 보존. 실행 대상 아님 |
| C 파킹 워크플로 | `.github/workflows/sweep.yml.disabled` 8건 | 소유자별 인벤토리 토큰 단계 | 바이트 보존. 실행 대상 아님 |
| D 프롬프트 정책 | `src/repository-profiles.ts:119`, `src/repair/fix-prompt-builder.ts:262`, `src/repair/comment-router-core.ts:377`, `src/repair/execute-fix-artifact.ts:3163`, `prompts/repair/autonomous.md:70` | 변경 이력 크레딧 금지 문구. 원본 관리자 이름을 "이렇게 적지 마라" 로 든다 | 범위 밖 |
| E 표본·주석 | `src/repair/event-record-store.ts:52`, `src/repair/*.test.ts` 3건, `scripts/proof-pr-admission-repo-case.mjs` 2건, `scripts/hosted-review-scan-smoke.mjs:556` | 예시 문자열과 주석 | 범위 밖 |

### 판단

A 만 허용 판정이다. 소유자 이름이 나온다고 전부 권한은 아니다. D 는 "그 이름으로 크레딧을
적지 마라" 는 리뷰 프롬프트 문구이고, 고치면 원본 리뷰 동작이 바뀌는데 얻는 안전은 없다.
E 는 픽스처와 주석이라 아무 것도 허가하지 않는다. C 는 파킹된 YAML 이고, 손대면 보존 계약과
비활성 경계를 동시에 흔든다. 셋 다 범위 밖으로 두되 조사 결과에는 남긴다.

B 는 미묘하다. 그 파일은 원본의 대상 목록이고 upstream 보존 대상이다. 지우는 대신 권한을
빼앗는다. 다만 권한을 빼앗는 지점이 한 곳이 아니다. 아래 감사 반영을 함께 읽어야 한다.

## A 감사 1회전 반영 · 허용 경로가 더 있다

감사가 이 문서의 분류를 반박했고, 확인해보니 맞다. 소유자 리터럴 한 줄만 설정으로 옮기면
허용 판정은 그대로 남는다. 경로가 셋 더 있다.

### 경로 1 · 명시 저장소가 소유자 검사보다 먼저다

`src/hosted-target-admission.ts:39` 가 `policy.configuredRepositories` 를 먼저 훑고,
맞으면 `:43` 의 소유자 검사에 닿기 전에 `true` 를 돌려준다. 레지스트리가 원본 저장소를
나열하고 있으므로, 폴백 소유자 목록을 비워도 원본 대상은 그대로 통과한다.

따라서 규칙을 바꾼다. 레지스트리는 프로필을 공급할 뿐 권한을 주지 않는다. 권한은 설치 설정이
준다. 판정은 이렇게 된다.

```
eligible(repo) =
  installation.configured
  AND ( installation.repositories 에 repo 가 있음
        OR ( owner(repo) 가 installation.fallbackOwners 에 있음
             AND 레지스트리의 해당 소유자 폴백이 repo 를 허용함 ) )
```

설치가 비어 있으면 어느 쪽도 성립하지 않는다.

### 경로 2 · 프로필 조회 성공을 적격으로 읽는다

`src/repair/comment-webhook.ts:477` 의 `isEligibleRepositoryPayload` 는
`repositoryProfileFor(targetRepo)` 가 던지지 않으면 `true` 를 돌려준다.
원본 설정에 프로필이 있는 저장소는 전부 여기를 통과한다.

`repositoryProfileFor` 자체에 문을 달지 않는다. 그것은 프로필 해석기이지 허용 판정이 아니고,
거기에 달면 복원 테스트의 프로필 해석 단정까지 같이 깨진다. 문은 `isEligibleRepositoryPayload`
에 단다. 해석과 허가를 분리하는 것이 이 과제의 취지이기도 하다.

### 경로 3 · Worker 와 큐가 각자 판정한다

`dashboard/worker.ts:4122` 의 `workerHostedTargetEligibility` 와
`dashboard/exact-review-queue.ts:9495` 의 `hostedTargetEligibility` 가 각각
`resolveHostedTargetEligibility` 를 부르면서 설치 설정을 넘기지 않는다. 둘 다 기본 레지스트리
URL 로 떨어진다. 한쪽만 고치면 다른 쪽이 그대로 허가한다. 둘 다 수정 대상에 넣는다.

### 경로 4 · 팬아웃도 레지스트리 정책만 받는다

2회전 감사가 찾았다. `src/repair/target-fanout.ts` 의 `readInventoryConfig` 는
`hostedTargetPolicyFromRegistry` 로 정책을 만들고, `:389` 와 `:662` 가 그것만
`isHostedTargetEligible` 에 넘긴다. 설치 설정이 들어갈 자리가 없다.

### 수정 대상 갱신

`030` 의 `MODIFIED_UPSTREAM_FILES` 가 3개에서 7개로 늘었다. 목록과 편입 회전은 `030` 에 있다.

### 유예하는 독립 진입점

3회전 감사가 호스티드 적격 판정을 아예 지나지 않는 진입점 둘을 찾았다. 유예하고 여기 남긴다.

| 진입점 | 위치 | 무엇을 스스로 판정하나 |
| -- | -- | -- |
| 스팸 댓글 분류기 | `src/repair/spam-comment-intake.ts:203`, `:233`, 호출부 `:146` | 이벤트 페이로드의 저장소를 그대로 받아 `accepted: true` 를 낸다 |
| 명령 증명 소비자 | `src/repair/command-proof-consumer.ts:82` | 원본 저장소·관리자·생산자 검사를 자체로 갖는다 |

유예 근거는 차단이 아니라 범위다. 둘 다 이 과제가 여는 표면이 아니고, 설치 게이트를 그 안에
넣는 것은 각자의 판정 모형을 바꾸는 일이다. 차단 명령 뒤에 있다는 사실은 사고 방지 장치일 뿐
인가가 아니므로, 이것을 "덮었다" 고 적지 않는다. `000` 의 주장 a 는 이 둘을 포함하지 않는다.

### 문서 제외 범위 정정

이 문서는 `docs/` 를 산문으로 뭉뚱그렸다. 정확하지 않다. `docs/proof/` 아래에는
`run-proof.sh` 같은 실행 스크립트가 있다. 금지 리터럴 검사에서 `docs/` 를 빼는 근거는
"산문이라서" 가 아니라 "손대지 않은 upstream 파일이고 바이트 단정이 이미 고정한다" 이다.
우리가 `docs/` 아래에 새로 만드는 파일은 `docs/lina-check/` 의 문서뿐이다.

## 결과 · 원본 운영 지시자

`dashboard/wrangler.toml` 이 유일하게 값을 직접 갖는다.

| 줄 | 키 | 값의 성격 |
| -- | -- | -- |
| 3 | `account_id` | 원본 Cloudflare 계정 |
| 42 | `routes.pattern` | 원본 운영 도메인 |
| 46 | `CLAWSWEEPER_REPO` | 원본 저장소 |
| 48 | `CLAWSWEEPER_APP_CLIENT_ID` | 원본 App |
| 49 | `CLAWSWEEPER_CRABFLEET_URL` | 원본 부속 서비스 |
| 50~52 | `TARGET_REPOS`, `PUBLIC_BAY_REPOS`, `APPLY_TARGET_REPOS`, `APPLY_OPTIONAL_TARGET_REPOS` | 원본 운영 대상 |
| 85 | `EXACT_REVIEW_STATE_REPO` | 원본 상태 저장소 |

코드 쪽에는 설정이 비어 있을 때 원본으로 되돌아가는 기본값이 있다.
`dashboard/worker.ts` 의 `env.CLAWSWEEPER_REPO || "openclaw/clawsweeper"` 계열 6건과
`src/repair/cluster-intake-dispatch.ts` 3건이다. 설정을 비워도 이 기본값이 살아 있으면
미설정이 성립하지 않는다. Worker 쪽 6건을 함께 처리한다.

`src/repair/cluster-intake-dispatch.ts` 3건은 남긴다. `src/repair/` 는 별도 tsconfig 로
빌드되고 차단 명령 뒤에 있으며, 이 과제가 여는 표면이 아니다. `040` 의 잔여 목록에 적는다.

`clawsweeper.openclaw.ai` 는 코드 기본값으로도 7곳에 더 있다. 전부 차단 명령이나 파킹
워크플로 뒤에 있고, Worker 설정 문제와는 층이 다르다. `040` 에 남긴다.

## 이 조사를 다시 깨지지 않게 하는 방법

목록을 문서로만 두면 다음 변경에서 되살아난다. `030` 의 금지 리터럴 검사가
우리가 소유한 코드·설정 파일에 한해 이 이름들의 재등장을 `check:scaffold` 에서 막는다.
