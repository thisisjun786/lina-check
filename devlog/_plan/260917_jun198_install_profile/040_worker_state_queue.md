# 040 · 상태·큐·대시보드 연결과 잔여 목록 (wp3·wp4)

## 보존할 것

원본 방식을 따른다. 다시 쓰지 않는다. `dashboard/wrangler.toml` 에서 구조는 그대로 둔다.

| 구조 | 유지 |
| -- | -- |
| R2 버킷 바인딩 `STATE_SNAPSHOTS` | 유지 |
| Durable Object `STATUS_STORE`, `EXACT_REVIEW_QUEUE`, `GITHUB_ETAG_CACHE` | 유지 |
| 마이그레이션 `v1`~`v3` 와 `new_sqlite_classes` | 유지 |
| `triggers.crons`, `assets.directory` | 유지 |
| 큐 동시성·리스·배치 변수 전부 | 유지 |

`config/documentation-sync.json` 이 큐 변수 13개의 값을 문서와 대조한다. 그 값들은 건드리지
않는다.

## 비울 것

| 키 | 조치 |
| -- | -- |
| `account_id` | 줄 제거. 배포 시 환경에서 받는다 |
| `routes` | 절 제거. `workers_dev` 만 남긴다 |
| `name`, `bucket_name` | 중립 이름으로 교체. 프로비저닝하지 않는다 |
| `CLAWSWEEPER_REPO`, `TARGET_REPOS`, `PUBLIC_BAY_REPOS`, `APPLY_TARGET_REPOS`, `APPLY_OPTIONAL_TARGET_REPOS`, `EXACT_REVIEW_STATE_REPO` | 빈 문자열 |
| `CLAWSWEEPER_APP_CLIENT_ID`, `CLAWSWEEPER_CRABFLEET_URL` | 빈 문자열 |
| `LINA_CHECK_TARGET_OWNERS` | 신규. 빈 문자열 |

빈 문자열로 두는 것과 줄을 지우는 것을 구분한다. 키가 남아 있으면 설치 운영자가 채울 자리가
보인다. 계정 ID 와 도메인은 자리 자체가 원본 소유라 줄을 지운다.

## A 감사 1회전 반영 · 빈 문자열은 비활성이 아니다

감사가 맞다. 값을 비우는 것과 호출하지 않는 것은 다르다. `repo` 가 `""` 가 되어도
`dashboard/worker.ts:7622` 는 `/repos//actions/runs` 를 만들어 부르고,
`githubJsonResponse` 는 자격증명이 없어도 `fetch` 한다. 미설정 Worker 가 조용히
바깥으로 요청을 내보내는 상태가 된다. wrangler diff 로는 그것을 볼 수 없다.

### 출구를 한 곳으로 모은다

2회전 감사가 `githubJsonResponse` 를 출구로 삼은 것을 반박했고 맞다. 우회로가 많다.
`worker.ts:7475` 토큰 요청, `:11969` GraphQL, `:5294` 산출물 내려받기,
`:4151` 공개 대상 프로브, `exact-review-queue.ts:17776`, `github-api.ts:146` App 요청.
`githubJson` 은 그 문에 닿기도 전에 토큰부터 가져온다.

진짜 경계는 더 아래에 있다. 위 여섯 곳이 전부 `githubApiUrl(env, path)` 로 URL 을 만든다.
정의는 `dashboard/github-api.ts:82` 한 곳뿐이다. 문을 여기에 단다.

```
githubApiUrl(env, path)
  설치가 미설정이면 URL 을 만들지 않고 던진다
```

URL 을 만들지 못하면 요청도 못 만든다. 세 파일의 모든 현재 호출부와 앞으로 생길 호출부가
같은 문을 지난다. 호출부의 오류 계약도 보존된다. GitHub 호출 실패는 이미 이 코드들이
던지고 잡는 형태이고(`worker.ts:7477`), 미설정은 fail-closed 가 맞는 방향이다.

### 이 문이 덮지 않는 것

`dashboard/review-proof-producer-auth.ts:75` 의 JWKS 조회는 GitHub 호출이 아니다.
리뷰 증명 생산자 인증이라는 다른 신뢰 영역이고, 대상 저장소 허용 판정도 원본 저장소
지시자도 아니다. 이번에 손대지 않는다.

처음에 적은 유예 근거는 틀렸다. "생산자 비밀이 설정돼야 닿는다" 고 썼는데, 3회전 감사가
`dashboard/worker.ts:1065` 에서 `:5271` 의 생산자 인증에 먼저 닿고, 형식만 맞는 서명되지
않은 클레임이 서명 검증 전에 JWKS 조회까지 갈 수 있다는 것을 보였다. 확인했고 맞다.
정확한 유예 근거는 하나뿐이다. **배포된 Worker 가 있어야 닿는다. 이 저장소는 배포하지 않는다.**

Durable Object 내부 `fetch` 는 바깥으로 나가지 않는다. 대상이 아니다.

`src/hosted-target-admission.ts:80` 의 레지스트리 조회는 `raw.githubusercontent.com` 이라
`githubApiUrl` 을 지나지 않는다. 이쪽은 다른 방식으로 막힌다. `registry_url` 이 비어 있으면
네트워크 호출 자체를 하지 않고 `terminal` 을 돌려준다(`020` 의 거부 규칙).

### Node 쪽 전송은 유예한다

3회전 감사가 `githubApiUrl` 을 지나지 않는 Node 전송을 더 찾았다. 전부 유예한다.

| 전송 | 위치 |
| -- | -- |
| `gh repo list` 팬아웃 인벤토리 | `src/repair/target-fanout.ts:583` → `:886` |
| live-proof 명령 | `src/live-proof/commands.ts:155` |
| 상태 저장소 크기 조회 | `src/repair/state-repo-size.ts:53` |
| 명령 증명 HTTP | `src/repair/command-proof-http.ts:55` |
| 닫힌 게시 회수 | `src/repair/closed-publication-retirement.ts:154` |
| 스팸 댓글 수집 | `src/repair/spam-comment-intake.ts:263` |
| CLI GitHub 런타임 | `src/clawsweeper-github-runtime.ts:380` |

유예 근거는 하나다. 전부 차단 명령과 파킹 워크플로 뒤에 있다.

여기서 `lina:boundary-probe` 가 이 일곱을 확인해준다고 적지 않는다. 프로브의 대상은
`scripts/lina-check-derived-contract.mjs:116` 의 고정 목록 8개이고, 자동 수정·종료·머지·라벨
입구만 실제로 호출한다. `target-fanout` 과 `repair:spam-comment-intake` 는 그 목록에 없다.
이 일곱에 대해 우리가 아는 것은 `check:scaffold` 가 매번 대조하는 정적 사실뿐이다.
차단 명령 104개의 매핑이 가드 그대로이고 활성 워크플로가 0개라는 것.

정적으로 닫혀 있다는 것과 설치 게이트 뒤에 있다는 것은 다르다. 차단은 사고 방지 장치이지
인가 모형이 아니다. 그래서 이 과제의 주장을 대시보드 전송으로 좁힌다.
`000` 의 주장 범위 표를 보라.

판정 자체는 `src/lina-check-installation-contract.ts` 의 순수 함수에 둔다. Worker 안의
분기는 검증할 수단이 게이트에 없지만, 순수 함수는 `lina:contract-selftest` 이 직접 부를 수 있다.
실행된 증거와 소스 증거를 이렇게 나눈다.

| 사실 | 증거 종류 |
| -- | -- |
| 미설정 판정 함수가 미설정을 거부한다 | 실행. selftest |
| Worker 의 출구가 그 함수를 지난다 | 소스. diff 와 호출 지점 |
| 미설정 Worker 가 실제로 요청 0건이다 | 없음. Worker 런타임이 게이트에 없다 |
| JWKS 등 GitHub 이 아닌 출구 | 덮지 않음. 위에 적었다 |

세 번째 줄을 검증했다고 적지 않는다. Worker 를 돌리는 것은 활성화 단계이고 이 과제가 아니다.

### 상태 저장소 기본값

`env.CLAWSWEEPER_STATE_REPO || CLAWSWEEPER_STATE_REPO` 형태가
`dashboard/worker.ts:10949` 와 `:11169` 등에 남아 있다. 환경을 비워도 모듈 상수가
원본 상태 저장소를 다시 가리킨다. 이 폴백을 없앤다. 상태 저장소가 비어 있으면 읽지 않는다.

## 코드 기본값

설정을 비워도 `env.X || "openclaw/..."` 가 살아 있으면 미설정이 성립하지 않는다.
`dashboard/worker.ts` 의 6건을 함께 처리한다.

| 줄 | 표현 |
| -- | -- |
| 3465 | `env.CLAWSWEEPER_REPO || "openclaw/clawsweeper"` |
| 3467 | `env.TARGET_REPOS || "openclaw/openclaw"` |
| 6884 | `env.APPLY_TARGET_REPOS || "openclaw/openclaw"` |
| 7574 | `env.CLAWSWEEPER_REPO || "openclaw/clawsweeper"` |
| 7575 | `env.TARGET_REPOS || "openclaw/openclaw"` |
| 8621 | `env.TARGET_REPOS || "openclaw/openclaw"` |
| 5295 | 산출물 경로에 박힌 `/repos/openclaw/openclaw/actions/artifacts/` |

빈 값이면 빈 목록이나 빈 문자열이 되도록 바꾼다. 미설정 Worker 는 대상이 없는 상태로 돌고,
없는 저장소를 조회하지 않는다.

## 잔여 목록

이번에 손대지 않는다. 다음 이슈가 이어받을 수 있게 위치와 개수를 남긴다.

| 항목 | 위치 | 왜 남기나 |
| -- | -- | -- |
| 조직 단위 상수 | `dashboard/worker.ts` `CLAWSWEEPER_REVIEW_REPO`, `CLAWSWEEPER_STATE_REPO`, `CLAWSWEEPER_WEBHOOK_DENY_REPOS` | 게시 경로 깊숙이 쓰인다. 허용 판정이 아니다 |
| 테스트 전용 시드 | `dashboard/worker.ts:2834,3128` `*ForTest` | 상위 테스트가 parked 다 |
| 저장소 기본값 | `src/repair/cluster-intake-dispatch.ts` 3건 | `src/repair/` 는 별도 빌드이고 차단 명령 뒤다 |
| 운영 도메인 기본값 | `src/review-proof-client.ts`, `src/action-ledger-runtime.ts`, `scripts/` 5건 | 전부 차단 명령·파킹 워크플로 뒤다 |
| 브랜딩 문자열 | Worker·대시보드 페이지 전반 | 진입점만 만드는 것이 이번 범위다 |
| JWKS 생산자 인증 출구 | `dashboard/review-proof-producer-auth.ts:75` | GitHub 경로가 아니다. 유예 근거는 배포뿐이다. 위 "이 문이 덮지 않는 것" 참조 |
| 리뷰 증명 실행 경로 | `dashboard/review-proof-execution.ts:89` 와 `worker.ts:5231` | 아래 리뷰 반영 참조 |
| Node 프로필 출처 | `src/repository-profiles.ts`, `src/repair/target-fanout.ts` | 아래 리뷰 반영 참조 |

## PR 리뷰 반영

### 리뷰 증명 경로는 한 쌍으로 묶여 있다

Devin 이 짚었고 맞다. `worker.ts:5231` 의 토큰 설치 선택만 설정 기반으로 바꿨는데,
`review-proof-execution.ts:89` 의 `repos/openclaw/openclaw` 접두사와 `:96` 의
`target.repository !== "openclaw/openclaw"` 검사는 그대로였다. 한쪽만 움직이면 토큰과 대상이
어긋나 모든 증명이 `proof_execution_unavailable` 로 끝난다.

토큰 쪽을 원래대로 되돌렸다. 이 인라인 증명 기능은 대상 검사 자체가 upstream 저장소로 고정돼
있는 upstream 전용 기능이고, 양쪽을 설정 기반으로 바꾸는 것은 이 이슈가 아니라 적응 단계의
일이다. 한 쌍으로 같이 움직이거나 같이 남는다. 지금은 같이 남는다.

되돌리고 나서 Codex 가 같은 문제의 반대쪽을 짚었다. 산출물 내려받기 경로
`worker.ts:5298` 은 아직 `env.CLAWSWEEPER_REPO` 를 쓰고 있어서, 이번에는 토큰과 산출물
저장소가 어긋났다. 이것도 되돌렸다.

이 쌍은 셋이다. 토큰 설치, 산출물 저장소, 실행 대상 검사. 하나만 움직이면 어느 방향이든
어긋난다. 셋 다 upstream 저장소에 고정된 채로 남기고, 적응할 때 셋을 함께 옮긴다.

### Node 프로필 출처는 여전히 로컬 인벤토리다

같은 리뷰의 지적이다. `targets.registry_url` 은 호스티드 적격 판정 경로가 읽고, Node 쪽
`readInventoryConfig` 와 `repositoryProfileFor` 는 계속 `config/target-repositories.json` 을
읽는다. 그래서 설치가 새 대상을 지명해도 원본 인벤토리가 그것을 서술하지 않으면 통과하지 못한다.

이것은 설계한 동작이다. 허가와 서술을 둘 다 요구하고, 어느 하나가 없으면 거부한다.
다만 운영자 입장에서는 거부 사유가 "설치가 지명하지 않아서" 가 아니라 "프로필이 없어서" 라
헷갈린다. Node 경로가 원격 레지스트리를 읽게 만드는 것은 활성화 단계의 동작이므로 이번에
하지 않고, 두 출처를 요구한다는 사실을 진입점과 문서에 적는 쪽을 택했다.
| 프롬프트 크레딧 문구 | `010` 의 D 분류 5건 | 허용 판정이 아니고 리뷰 동작을 바꾼다 |

## 명시적으로 하지 않은 것

Worker 를 배포하지 않았고 R2 버킷과 Durable Object 를 만들지 않았다. 계정을 연결하지 않았다.
`dashboard:deploy` 와 `dashboard:dev` 는 계속 차단 명령이고 `lina:boundary-probe` 대상도 아니다.
구조가 보존됐다는 것은 파일이 그 형태라는 뜻이지 동작이 검증됐다는 뜻이 아니다.
