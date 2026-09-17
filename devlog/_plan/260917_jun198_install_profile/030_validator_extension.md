# 030 · 검증기 확장 (wp2)

## 지금 검증기가 막는 것

`scripts/check-scaffold.mjs` 의 바이트 루프는 upstream 항목 1646건 중 `package.json` 과
`.gitignore` 만 빼고 1644건의 blob 해시를 대조한다(`:114` 제외, `:125` 해시, `:127` 모드).
이 과제가 옮겨야 할 판정은 전부 그 안에 있다. 그대로 고치면 `Upstream bytes changed` 로 거부된다.

## 확장 방식

JUN-135 가 신규 파일에 쓴 구조를 그대로 한 층 넓힌다. 새 기제를 만들지 않는다.

| 소유 | 무엇 |
| -- | -- |
| 코드 리터럴 (`lina-check-derived-contract.mjs`) | 수정이 허용되는 upstream 파일의 집합 |
| config 선언 | 항목별 근거 문자열 |
| 코드 검사 | 실재, 정규 파일, 실제 변경 여부, 모드, 금지 리터럴 |

설정만 고쳐서 예외를 넓힐 수 없다는 성질이 그대로 유지된다.

```
MODIFIED_UPSTREAM_FILES = [
  "dashboard/exact-review-queue.ts",
  "dashboard/github-api.ts",
  "dashboard/worker.ts",
  "dashboard/wrangler.toml",
  "src/hosted-target-admission.ts",
  "src/repair/comment-webhook.ts",
  "src/repair/target-fanout.ts",
]
```

3개로 시작해 감사 두 회전을 거쳐 7개가 됐다. 늘어난 이유는 전부 같다.
한 곳만 고치면 다른 곳이 그대로 허가하거나 그대로 나간다.

| 파일 | 왜 들어왔나 | 회전 |
| -- | -- | -- |
| `src/hosted-target-admission.ts` | 소유자 리터럴과 원본 레지스트리 URL | 최초 |
| `dashboard/worker.ts` | 웹훅 소유자 판정, 미설정 시 원본으로 떨어지는 기본값 | 최초 |
| `dashboard/wrangler.toml` | 계정·도메인·대상·상태 저장소 값 | 최초 |
| `src/repair/comment-webhook.ts` | 프로필 조회 성공을 적격으로 읽는다 | 1회전 |
| `dashboard/exact-review-queue.ts` | 설치 설정 없이 독립으로 적격을 판정한다 | 1회전 |
| `dashboard/github-api.ts` | 모든 GitHub 요청 URL 을 만드는 유일한 지점 | 2회전 |
| `src/repair/target-fanout.ts` | 레지스트리에서 만든 정책만 넘긴다 | 2회전 |

이 7개가 덮는 범위는 호스티드 대상 적격 판정과 웹훅 저장소 적격 판정, 그리고 대시보드 쪽
GitHub 전송이다. 그 바깥의 Node 전송과 독립 진입점은 유예했고 `040` 와 `010` 에 목록이 있다.
"모든 경로" 라고 적지 않는다. `000` 의 주장 범위 표가 기준이다.

복원 테스트 픽스처 실행도 같은 방식으로 코드가 집합을 갖는다.

```
UPSTREAM_FIXTURE_TESTS = {
  "test/repository-profiles.test.ts": [
    "config/target-repositories.json",
    "dashboard/wrangler.toml",
  ],
}
```

## 바이트 루프 변경

```
선언 안 됨 → 기존대로 바이트 일치를 단정한다
선언됨     → 바이트가 upstream 과 달라야 한다. 같으면 거부한다
둘 다      → 모드는 항상 일치해야 한다
```

"달라야 한다" 를 넣는 이유가 있다. 선언만 남고 실제 수정이 사라지면 그 파일은 영구 예외가 된다.
나중에 누군가 되돌려도 아무 것도 울지 않는다. 선언이 실제 변경을 동반하도록 묶어둔다.

## 금지 리터럴 검사

수정 허용은 그 파일에 무엇이든 써도 된다는 뜻이 아니다. 이 과제가 제거한 것이 다시 들어오는
것을 막는 검사를 함께 둔다.

대상은 우리가 바이트를 소유한 파일, 즉 파생 파일과 수정 선언된 upstream 파일 중
`src/`, `dashboard/`, `config/`, `schema/`, `scripts/` 아래 항목이다.
금지 리터럴은 개인 소유자 계정 이름, 원본 Cloudflare 계정 ID, 원본 App client ID,
원본 운영 도메인 두 개, 원본 레지스트리 URL 이다.

제외 근거를 정확히 적는다. 손대지 않은 upstream 파일은 바이트 단정이 이미 고정하고 있고
원본 보존이 이 저장소의 계약이므로 대상이 아니다. `docs/` 를 "산문이라서" 빼는 것이 아니다.
`docs/proof/` 에는 실행 스크립트가 있고 그것도 upstream 이다. 우리가 `docs/` 아래 새로
만드는 것은 `docs/lina-check/` 문서뿐이며, `devlog/` 와 함께 검사에서 뺀다.
무엇을 제거했는지 적는 문서가 그 이름을 쓰지 못하면 기록이 성립하지 않기 때문이다.
이 경계를 검사 주석에 그대로 적는다.

## 파생 파일 위치 패턴 확장

`DERIVED_FILE_PATTERNS` 가 현재 `scripts/lina-check-*.mjs` 와 JUN-135 계획 단위만 허용한다.
이번 파생물을 받으려면 패턴을 넓혀야 한다. 넓히되 아무 경로나 받지 않는다.

| 패턴 | 받는 것 |
| -- | -- |
| `scripts/lina-check-*.mjs` | 기존 |
| `src/lina-check-*.ts` | 설치 설정 계약과 로더 |
| `config/lina-check-*.json` | 설치 진입점 |
| `schema/lina-check-*.schema.json` | 진입점 스키마 |
| `docs/lina-check/*.md` | 운영자 문서 |
| `devlog/_plan/260917_jun198_install_profile/**` | 이번 계획 단위 |

전부 `lina-check` 접두어나 전용 디렉터리를 요구한다. 원본 파일 이름을 파생으로 선언할 수
없다는 기존 `derived-upstream-collision` 검사는 그대로다.

## 새 거부 사유

| 사유 | 픽스처 |
| -- | -- |
| `modified-upstream-set` | 선언 집합이 리터럴과 다름 (누락 / 추가) |
| `modified-upstream-reason` | 근거 없음, 빈 문자열, 공백만 |
| `modified-upstream-unknown` | upstream 트리에 없는 경로를 수정 선언 |
| `modified-upstream-unchanged` | 선언했으나 바이트가 upstream 과 같음 |
| `installation-forbidden-literal` | 우리가 소유한 코드·설정에 금지 리터럴 재등장 |
| `installation-shipped-configured` | 출고 설정이 `configured: true` |
| `installation-shipped-nonempty` | 출고 설정의 목록이 비어 있지 않음 |
| `fixture-test-set` | 픽스처 실행 선언이 리터럴과 다름 |
| `fixture-test-path` | 픽스처 파일이 upstream 트리에 없음 |

로더 쪽 거부 사유는 `020` 의 표에 있다. 둘 다 selftest 가 사유별로 관측한다.

## 기존 단정 보존

단정을 삭제하지 않는다. 바이트 루프 단정 한 건이 선언된 파일에 대해 조건부가 되고,
그 자리를 "달라야 한다" 단정과 금지 리터럴 검사가 메운다. 넓힌 만큼 다시 좁힌다는 규칙을
JUN-135 와 같은 방식으로 지킨다. `lina:contract-selftest` 의 `assertionCalls` 경고는
baseline 을 `54ee404d` 로 옮겨 계속 동작시킨다.
