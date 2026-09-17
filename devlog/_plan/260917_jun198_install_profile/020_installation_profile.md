# 020 · 설치 프로필과 진입점 (wp2)

## 진입점을 둘로 나누는 이유

이 시스템은 실행 표면이 둘이다. Node CLI 는 파일을 읽을 수 있고, Cloudflare Worker 는 못 읽는다.
Worker 는 `env` 로만 설정을 받는다. 하나로 합치려면 둘 중 하나를 억지로 바꿔야 하므로
원본 방식을 그대로 따라 둘로 둔다.

| 표면 | 진입점 | 읽는 쪽 |
| -- | -- | -- |
| Node | `config/lina-check-installation.json` | `src/lina-check-installation.ts` |
| Worker | `dashboard/wrangler.toml` 의 `LINA_CHECK_*` 변수 | `src/lina-check-installation-contract.ts` |

판정 규칙은 한 곳에만 둔다. `src/lina-check-installation-contract.ts` 는 순수 모듈이고
`node:fs` 를 쓰지 않는다. Worker 번들에 들어가도 안전하다. 파일을 읽는 쪽만
`src/lina-check-installation.ts` 로 분리한다.

새 파일을 `dashboard/` 아래 두지 않는다. 이유는 Node 와 Worker 가 같은 판정 코드를 공유해야
하고, `dashboard/` 는 Worker 전용 자리이기 때문이다. Worker 는 이미 `../src/` 를 임포트하므로
`src/` 에 두면 양쪽이 같은 모듈을 쓴다.

처음에는 `tsconfig.dashboard-strict.json` 의 단조 증가 기준선을 이유로 들었는데 그것은 틀렸다.
감사가 확인한 대로 복원 테스트 `test/check-dashboard-strict.test.ts` 는 넘겨받은 배열만
검사하고 tsconfig 를 읽지 않는다. 파일을 추가한다고 그 테스트가 깨지지 않는다. 이유를 정정한다.

## 스키마

`config/lina-check-installation.json` 은 출고 시 이 상태다.

```json
{
  "schema_version": 1,
  "configured": false,
  "branding": { "product_name": "", "short_name": "", "user_agent": "", "dashboard_host": "" },
  "targets": { "fallback_owners": [], "repositories": [], "registry_url": "" },
  "state": { "state_repo": "", "state_ref": "" },
  "github_app": { "client_id": "", "bot_login": "" }
}
```

`targets.fallback_owners` 와 `targets.repositories` 가 이 과제의 핵심이다. 원본이 코드
리터럴과 원격 레지스트리에 나눠 갖고 있던 권한을 설치 설정 한 곳으로 올린다.

권한의 방향을 분명히 한다. **레지스트리는 프로필을 공급하고 설치 설정이 허가한다.**
원본은 반대였다. 레지스트리가 나열한 저장소가 소유자 검사보다 먼저 통과했다. 그대로 두면
소유자 목록을 비워도 원본 대상이 통과한다.

`targets.registry_url` 도 마찬가지다. 원본은 자기 저장소의 raw URL 을 기본값으로 박아뒀다.
비워두면 네트워크 호출 자체가 일어나지 않고 판정은 `terminal` 이다.

## 거부 규칙

빈 목록은 통과가 아니라 거부다. 구체적으로 이렇다.

| 입력 | 결과 | 사유 코드 |
| -- | -- | -- |
| `configured: false` | 거부 | `installation-unconfigured` |
| `fallback_owners: []` 인데 폴백 판정 요청 | 거부 | `installation-no-owners` |
| `registry_url: ""` 인데 레지스트리 조회 요청 | 거부. 네트워크 호출 없음 | `installation-no-registry` |
| `schema_version` 불일치 | 거부 | `installation-schema` |
| 소유자 형식 위반 | 거부 | `installation-owner-shape` |
| 목록에 중복·공백 | 거부 | `installation-owner-duplicate` |
| `configured: true` 인데 목록이 전부 빔 | 거부 | `installation-empty` |

거부가 예외로 새어 나가면 호출부가 통과로 읽을 수 있으므로, 판정 함수는 값으로 거부를 돌려준다.
검사 함수는 사유 코드를 갖는 오류를 던진다. selftest 가 사유별 픽스처로 실제 거부를 관측한다.

## 브랜딩

`branding` 은 자리를 만드는 것이 목적이다. 12306줄짜리 Worker 의 모든 문자열을 이번에 바꾸지
않는다. 이번에 연결하는 곳은 이 과제가 이미 손대는 파일의 문자열이다.
`src/hosted-target-admission.ts` 의 User-Agent 두 개가 그것이다.
`resolveBranding(profile)` 이 값을 주고, 비어 있으면 중립 기본값을 쓴다.

남은 브랜딩 문자열의 위치와 개수는 `040` 에 목록으로 남긴다. 다음 이슈가 이어받을 수 있게
"어디에 몇 개" 까지 적고, 이번에 바꾼 척하지 않는다.

## 확인 층

| 층 | 무엇을 본다 | 언제 |
| -- | -- | -- |
| `check:scaffold` | 출고 설정이 비어 있고 `configured: false` 인지 (정적 JSON 검사) | 게이트 3 |
| `lina:contract-selftest` | 로더의 거부 경로가 실제로 거부하는지 (`dist/` 적재) | 게이트 5 |

정적 검사는 산출물이 필요 없고, 거부 경로 검증은 필요하다. 게이트 순서상 `build:all` 이
앞이므로 성립한다. 산출물이 없거나 낡으면 `lina:test-safe` 와 같은 규칙으로 exit 3 이다.
