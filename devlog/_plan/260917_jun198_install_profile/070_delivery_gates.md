# 070 · 인도 게이트와 리뷰 영수증 (wp5)

## 측정 방법

`명령 > 파일 2>&1` 직후 `$?` 를 읽는다. 파이프라인 뒤에서 읽지 않는다.
측정 시 `git status --porcelain` 이 0줄이어야 한다. 리뷰가 새 커밋을 만들면 표를 다시 측정한다.
새 head 는 이전 증거를 무효화한다.

| 항목 | 값 |
| -- | -- |
| 측정 SHA | `d501d364116015acafdb2cb832a3e66d2910ce1c` |
| 브랜치 | `codex/jun-198-install-profile` |
| base | `main` (`54ee404d`) |
| 런타임 | Node 24.20.0, pnpm 12.4.1 (Corepack) |
| 작업물 | 측정 시 `git status --porcelain` 0줄 |

이 문서를 커밋하면 head 가 한 번 더 움직인다. 그 diff 는 이 markdown 뿐이고 아래 수치는
`d501d364` 에서 나온 것이다. 감추지 않고 여기 적는다.

## 필수 게이트 8항목

| # | 명령 | exit | 결과 요약 |
| -- | -- | -- | -- |
| 1 | `corepack pnpm install --frozen-lockfile --ignore-scripts` | 0 | lockfile 고정 설치 |
| 2 | `corepack pnpm run build:all` | 0 | tsc 3개 프로젝트 무오류 |
| 3 | `corepack pnpm run check:scaffold` | 0 | upstream 1646 항목, 파생 26, 수정 선언 7(전부 pin 과 다름 확인), Worker 변수 12개 비움·upstream 소유 키 3개 부재, 워크플로 35 parked, 차단 104 |
| 4 | `corepack pnpm run lint` | 0 | lint 스크립트 4개, oxlint 5회 |
| 5 | `corepack pnpm run lina:contract-selftest` | 0 | `rejected=30 helpers=18 installation=31 modifiedUpstream=16 tripwireControls=3 routing=verified assertionCalls=23->29` |
| 6 | `corepack pnpm run lina:test-safe` | 0 | 통과 333건. 13개 중 1개는 pin `1ed7bd4e` 픽스처 작업 디렉터리에서 실행 |
| 7 | `corepack pnpm run lina:test-safe:preview` | 0 | `13 declared tests, nothing executed`. 자식 프로세스 미기동, 픽스처 미생성 |
| 8 | `corepack pnpm run lina:boundary-probe` | 0 | 입구 8개 exit 1 + `is disabled`, 워크플로 5개 활성 YAML 부재, 가드 digest 일치, 트리 변동 없음 |

게이트 6 을 "13개 통과" 로만 읽지 않는다. 13번째는 pin 된 upstream 바이트를 읽었고, 그것이
증명하는 것은 원본 해석기가 원본 입력에서 여전히 맞다는 것뿐이다. 우리 설정에 대한 단정은
게이트 3 이 실제 파일에 대해 따로 한다. 두 사실을 한 줄로 합치지 않는다.

## 이 인도가 주장하지 않는 것

- 미설정 Worker 의 실제 바깥 요청이 0건이다. Worker 런타임이 이 게이트에 없다
- `040` 의 Node 전송 7개와 `010` 의 독립 진입점 2개가 설치 게이트 뒤에 있다. 유예했다
- 원본 전체 `test`/`check` 가 통과한다. parked 이고 돌리지 않았다

원본 전체 `test`/`check` 는 parked 다. 돌리지 않았고 통과했다고 보고하지 않는다.

## 비활성 경계

| 관측 | 기대 |
| -- | -- |
| 워크플로 | 35개 parked, 활성 YAML 0개 |
| 차단 명령 | 104개 |
| 프로브 입구 | 8개 전부 exit 1 + `is disabled` |
| 프로브 워크플로 | 5개 활성 YAML 부재 |
| 트리 변동 | 프로브 전후 동일 |

## 커밋 신원

이 저장소의 게시 커밋은 `259586770+thisisjun786@users.noreply.github.com` 을 쓴다.
개인 주소로 커밋하면 원격이 `GH007` 로 거부한다. 문서·커밋 메시지·PR 본문 어디에도
개인 이메일 주소를 적지 않는다.

## 리뷰 영수증

Devin Review 와 Codex 코드리뷰가 PR 개설로 자동으로 돈다. 브랜치 보호와 Actions 가 없으므로
필수 게이트는 아니지만 실제로 결함을 잡는다. 지적마다 세 가지를 남긴다.

| 항목 | 내용 |
| -- | -- |
| 지적 | 제공자, 위치, 요지 |
| 처리 | 커밋 SHA 또는 회신 근거 |
| 재확인 | 처리 후 다시 관측한 결과 |

틀린 지적은 근거를 붙여 회신하고 코드를 바꾸지 않는다. 그 경우에도 세 항목을 남긴다.

빈 checks 를 통과로 읽지 않는다. 이 저장소에 Actions 워크플로 검사는 0건이고 앞으로도 0건이다.

## 머지

머지하지 않는다. 코디네이터가 한다. PR 은 draft 가 아닌 상태로 연다.

## 인도 사실

| 항목 | 값 |
| -- | -- |
| PR | https://github.com/thisisjun786/lina-check/pull/2 |
| base / head | `main` / `2ac9ac34` 이후 문서 커밋 |
| isDraft | false |
| mergeable | MERGEABLE |
| 머지 | 하지 않았다 |

## 리뷰 영수증

Devin Review 는 commit status `success` 로 4분 6초 만에 끝났고 5건을 냈다.
Codex 는 코드 리뷰와 보안 리뷰가 각각 완료됐고 1건을 냈다. 합 7건이다.

| # | 제공자 | 지적 | 처리 | 재확인 |
| -- | -- | -- | -- | -- |
| 1 | Devin 🔴 | `target-fanout.ts`. Node 허용 경로가 `targets.registry_url` 을 읽지 않아 설치가 지명한 새 대상이 거부된다 | 설계한 동작이므로 코드는 그대로. 허가와 서술을 둘 다 요구한다는 규칙을 진입점 `note` 와 `040`, README 에 적었다. `f7dcd2da` | `check:scaffold` 0, `lina:contract-selftest` 0 |
| 2 | Devin 🔴→🟡 | `worker.ts:5229`. 토큰 설치만 설정 기반이 되어 `executeReviewProof` 의 고정 대상과 어긋난다 | 내가 만든 결함이다. 토큰 쪽을 되돌렸다. `f7dcd2da` | 게이트 8종 전부 0 |
| 3 | Devin 🟡 | `lina-check-installation-contract.ts`. 스키마가 거부하는 문서를 파서가 받는다 | 필수 문자열 필드를 요구하도록 고치고 `installation-field-shape` 사유와 픽스처 3개 추가. `f7dcd2da` | Devin 이 `✅ Resolved` 로 확인. selftest `installation=31→34` |
| 4 | Devin 🔍 | `hosted-target-admission.ts`. 허용 판정 전용 스위트가 여전히 제외돼 있다 | 코드 변경 없음. 그 스위트는 `.github/workflows/hosted-target-admission.yml` 을 읽는데 이 포크는 워크플로가 전부 parked 라 존재할 수 없다. 근거를 붙여 회신 | `check:scaffold` 가 활성 YAML 0개를 매번 단정 |
| 5 | Devin 🔍 | `lina-check-installation.ts`. 프로필이 무기한 캐시된다 | 재시작이 필요하다는 사실을 모듈 주석과 진입점 `note` 에 적었다. `f7dcd2da` | Devin 이 `✅ Resolved` 로 확인 |
| 6 | Codex P2 | `worker.ts:5298`. 산출물 저장소가 증명 토큰과 어긋난다 | 2번을 되돌리면서 반대쪽이 남았다. 산출물 경로도 되돌려 셋을 함께 고정. `2ac9ac34` | 게이트 8종 전부 0 |
| 7 | Devin 🔍 | `hosted-target-admission.ts`. 주입된 predicate 가 설치 권위를 우회한다 | 코드 변경 없음. Cloudflare 변수는 문자열이라 설정으로 함수를 줄 수 없고, predicate 는 호출자가 스스로 판정하는 자리다. 설치 게이트는 정책 기반 경로에 둔다. 근거를 붙여 회신 | 주장 범위를 정책 기반 경로로 한정해 `000` 에 기록 |

2번과 6번은 같은 결함의 양쪽이다. 한 쌍인 줄 알았는데 셋이었다. 토큰 설치, 산출물 저장소,
실행 대상 검사. 하나만 움직이면 어느 방향이든 어긋난다는 것을 두 번의 지적으로 배웠다.

틀린 지적은 없었다. 4번과 7번은 지적 자체가 정확했고, 다만 이 과제가 그것을 고칠 자리가
아니라는 근거를 붙여 회신했다. 코드를 바꾸지 않았다.
