# 070 · 인도 게이트와 리뷰 영수증 (wp5)

## 측정 방법

`명령 > 파일 2>&1` 직후 `$?` 를 읽는다. 파이프라인 뒤에서 읽지 않는다.
측정 시 `git status --porcelain` 이 0줄이어야 한다. 리뷰가 새 커밋을 만들면 표를 다시 측정한다.
새 head 는 이전 증거를 무효화한다.

| 항목 | 값 |
| -- | -- |
| 측정 SHA | wp5 에서 채운다 |
| 브랜치 | `codex/jun-198-install-profile` |
| base | `main` |
| 런타임 | Node 24.20.0, pnpm 12.4.1 (Corepack) |

## 필수 게이트 8항목

| # | 명령 | exit | 결과 요약 |
| -- | -- | -- | -- |
| 1 | `corepack pnpm install --frozen-lockfile --ignore-scripts` | | |
| 2 | `corepack pnpm run build:all` | | |
| 3 | `corepack pnpm run check:scaffold` | | |
| 4 | `corepack pnpm run lint` | | |
| 5 | `corepack pnpm run lina:contract-selftest` | | |
| 6 | `corepack pnpm run lina:test-safe` | | |
| 7 | `corepack pnpm run lina:test-safe:preview` | | |
| 8 | `corepack pnpm run lina:boundary-probe` | | |

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
