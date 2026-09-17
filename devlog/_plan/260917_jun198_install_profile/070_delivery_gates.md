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

## 리뷰 2회전 영수증

측정 SHA `4a4ca4b6`. 미해결 스레드 14건 전부 회신했고 뿌리는 하나였다.

| # | 지적 | 처리 | 재확인 |
| -- | -- | -- | -- |
| 1 | Node admission 이 설치 레지스트리를 무시한다 | 뿌리는 더 앞이었다. `isHostedTargetEligible` 이 명시 허가에 레지스트리 항목을 함께 요구했다. 그 조건 제거. `4a4ca4b6` | 빈 `registry_url` 로도 명시 허가가 통과함을 admission 테스트가 관측 |
| 2 | 주입된 predicate 가 권한을 건너뛴다 | 남김. `typeof` 검사 추가. `4a4ca4b6` | 함수 아닌 값 6종이 전부 `terminal` 임을 관측 |
| 3 | 자격증명이 미설정 transport 를 연다 | 남김. `githubTransportPermitted` 로 개명하고 admission 게이트가 아님을 첫 줄에 명시. `4a4ca4b6` | 자격증명 보유 env 가 transport 는 통과하고 admission 은 거부함을 관측 |
| 4 | 런타임과 스키마가 다른 문서를 받는다 | 미선언 필드 거부, 대소문자 접지 제거. `4a4ca4b6` | selftest `installation=34→40` |
| 5 | admission 스위트가 제외돼 있다 | `test/lina-check-admission.test.ts` 신규 10건, 게이트 6 안에서 실행. `4a4ca4b6` | `lina:test-safe` 333→343 |
| 6 | 설정됐지만 동작 불가능한 프로필이 통과한다 | `installation-inoperable` 로 파싱 시점 거부. `4a4ca4b6` | 거부 픽스처 관측 |
| 7 | 미선언 필드가 있어도 `ok:true` (Codex P2) | 루트와 각 절에서 키 검증. `4a4ca4b6` | `targets.deny_repositories` 픽스처로 관측 |
| 8 | 설정한 `EXACT_REVIEW_STATE_REPO` 를 못 읽는다 | 읽기 3곳·ref 2곳·캐시 키를 선언된 이름으로. `4a4ca4b6` | `rg CLAWSWEEPER_STATE_RE dashboard/worker.ts` 결과 없음 |
| 9 | 설정한 `user_agent` 가 프로브에서 무시된다 | 프로브 옵션에 installation 추가, 호출부 4곳 전달. `4a4ca4b6` | `rg 'brandedUserAgent\(null'` 결과 없음 |
| 10 | 잘못된 프로필이 admission 을 켠다 | `f7dcd2da` + `4a4ca4b6` | Devin 이 `Resolved` 확인 |
| 11 | 프로필 캐시가 재시작을 요구한다 | `f7dcd2da` 문서화 | Devin 이 `Resolved` 확인 |
| 12·13 | 아티팩트 저장소와 proof 토큰 정렬 | `2ac9ac34` | Devin 후속 코멘트가 정렬 확인 |
| 14 | 정보성: proof 저장소 핀 일관 | 코드 변경 없음 | 확인 후 종료 |

틀린 지적은 없었다. 2번과 3번은 지적이 정확하고, 남기는 편이 맞다는 근거를 코드가 아니라
실행되는 테스트로 냈다.

## 바이트 보존 검사 자체 검증

이번 라운드에서 upstream 소스를 실제로 고쳤으므로 가장 큰 위험은 보존 검사가 조용히 느슨해지는
것이다. 문장으로 확인하지 않고 깨뜨려 봤다.

| 관측 | 결과 |
| -- | -- |
| 미선언 upstream 파일에 한 줄 추가 | `check:scaffold` exit 1, `Upstream bytes changed: src/repository-profiles.ts` |
| 되돌린 뒤 | exit 0, 해당 파일 `git status` 에 없음 |
| 원래 단정 문장 | `scripts/check-scaffold.mjs:154` 에 바이트 그대로 존재 |
| 선언된 7개 | `continue` 로 앞에서 빠지고 "달라야 한다" 단정을 따로 받는다 |
| 단정 삭제 감지 | `lina:contract-selftest` 하한 29, 매 실행 확인 |

검사가 약해진 것이 아니라 선언이 늘었다. 선언은 코드 리터럴이 고정하고 config 는 근거만 갖는다.

## 리뷰 3회전 영수증

측정 SHA `1cad661b`. 스레드 23건 전부 resolve 했다. 미해결 0.

| # | 지적 | 처리 | 재확인 |
| -- | -- | -- | -- |
| 1 | 공백 패딩이 스키마를 우회한다 | `readList` 가 trim 없이 원문 그대로 검사. `8b6a38dc` | 앞뒤 공백·탭 픽스처 4건 |
| 2 | 픽스처 생성 실패 시 임시 디렉터리 누수 | 실패 시 정리 후 원래 오류 재전파. `8b6a38dc` | 게이트 후 `/tmp/lina-check-upstream-*` 없음 |
| 3 | Worker 브랜딩 변수 5개가 설정 파일에 없다 | wrangler 에 빈 값으로 추가. `8b6a38dc` | 비움 검사 대상 12→17 |
| 4 | 미선언 필드 통과 (Codex, 2회 연속) | 이미 `4a4ca4b6` 에서 처리됨. 회신만 하고 resolve 를 안 했던 것 | 빌드 산출물로 직접 확인 후 resolve |
| 5 | 파일 프로필의 state·github_app 이 소비되지 않는다 | 코드 변경 없음. 범위 4·5 가 그 자리를 만드는 것이고, `installationFromEnv` 로 묶으면 대상 목록 오타가 상태 읽기를 같이 죽인다 | 잔여 목록에 기록 |
| 6 | 줄바꿈이 붙은 항목이 통과 후 영영 매칭되지 않는다 | `$` 가 끝 줄바꿈 앞에서 매칭된다. 런타임·스키마 둘 다 전체 문자열 앵커로. `1ff8caa1` | 줄바꿈·CRLF 픽스처 3건 |
| 7 | `note` 타입 미검증 (Codex P2) | present 일 때 문자열 요구. `1ff8caa1` | 거부 픽스처 |
| 8 | 잔여 표가 쪼개졌다 | 표를 다시 붙이고 절을 뒤로. `1ff8caa1` | 7행 연속 |
| 9 | 명시 허가가 레지스트리를 먼저 요구한다 (Codex P2) | `resolveHostedTargetEligibility` 가 레지스트리 요구 전에 명시 허가를 본다. `1cad661b` | 테스트를 운영 호출 형태로 교체 |
| 10 | Crabfleet 빈 값이 upstream 기본값으로 떨어진다 (Codex P2) | 기본값 제거, 미설정이면 링크 생략. `1cad661b` | 수정 선언 7→8, 금지 리터럴 검사 대상에 포함 |

9번과 10번은 P2 라벨이 붙었지만 품질 제안이 아니라 실제 결함이었다. 특히 9번은 이 PR 의
핵심 주장이 운영 경로에서 거짓이었다는 것이고, 내 admission 테스트가 `configuredRepositories`
라는 테스트 전용 분기를 써서 그것을 가리고 있었다. 테스트가 초록인 것과 운영 경로가 맞는 것은
다르다는 사례로 남긴다.

틀린 지적은 이번 라운드에도 없었다.

## 2회전 게이트

| # | 명령 | exit | 결과 |
| -- | -- | -- | -- |
| 1 | `install --frozen-lockfile --ignore-scripts` | 0 | |
| 2 | `build:all` | 0 | tsc 3개 무오류 |
| 3 | `check:scaffold` | 0 | 파생 27, 수정 선언 7, 파생 테스트 1 |
| 4 | `lint` | 0 | |
| 5 | `lina:contract-selftest` | 0 | `rejected=30 helpers=18 installation=40 modifiedUpstream=16 assertionCalls=23->29` |
| 6 | `lina:test-safe` | 0 | 343 통과. 복원 13 + 파생 1 |
| 7 | `lina:test-safe:preview` | 0 | 복원 13·파생 1 나열, 미실행 |
| 8 | `lina:boundary-probe` | 0 | 입구 8개 차단 유지 |
