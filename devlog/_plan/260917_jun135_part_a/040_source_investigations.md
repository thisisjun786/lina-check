# 040 · 착수 단계 소스 조사 2건 (wp5)

031 문서의 미확인 표에서 단계가 "착수"이고 확인 주체가 "JUN-135 구현 담당"인 항목 둘이다.
이 유닛의 결론은 조사 결과이고 결정이 아니다. 두 항목 모두 사람이 정할 것이 남아 있지 않다.

## 조사 1 · QA·Reports 변수 세 개의 실제 소비 경로

최소 증거는 "소비 코드 1건 또는 부재 확인"이었다. 세 변수의 답이 같지 않다.

### Reports 두 개는 소비 코드가 있다

`OPENCLAW_REPORTS_ACCESS_CLIENT_ID` 와 `OPENCLAW_REPORTS_ACCESS_CLIENT_SECRET` 은
`src/repair/notify-maintainer-report.ts:270` 의 `resolveReportsAccessHeaders` 가 읽는다.
id 는 `:273`, secret 은 `:278` 이다.

읽는 방식이 중요하다. 각각 4단 fallback 의 **두 번째** 자리다. id 는
`REPORTS_ACCESS_CLIENT_ID` → `OPENCLAW_REPORTS_ACCESS_CLIENT_ID` → `CF_ACCESS_CLIENT_ID` →
`CLOUDFLARE_ACCESS_CLIENT_ID` 순이고 secret 도 같은 모양이다. 둘 중 하나라도 해결되지 않으면
`:281` 이 `undefined` 를 돌려주고 Access 헤더를 붙이지 않는다. 즉 이 두 이름은 필수가 아니라
Cloudflare Access 자격을 주는 네 경로 중 하나이며, 두 값이 함께 있어야 의미가 있다.

### QA Convex 두 개는 이 저장소에서 읽는 코드를 찾지 못했다

`OPENCLAW_QA_CONVEX_SITE_URL` 과 `OPENCLAW_QA_CONVEX_SECRET_CI` 를 단정적으로 "소비자 없음"
이라고 쓰지 않는다. 관측한 것만 적는다.

- 검색한 애플리케이션 소스(`src/`, `dashboard/`, `scripts/`)에서 이 두 이름을 읽는 코드를 찾지 못했다.
- parked 워크플로가 조건부로 둘을 단계 `env` 에 주입한다.
  `.github/workflows/repair-cluster-worker.yml.disabled:685`, `:686`. 조건은
  `steps.target.outputs.target_slug == 'openclaw-openclaw'` 이고, 아니면 빈 문자열이 들어간다.
- 자식 환경이 부모 환경을 그대로 물려받는다. `src/repair/process-env.ts:20` 의
  `codexSubprocessEnv` 가 `...process.env` 를 펼치고 토큰류 삭제 목록만 지운다. 이 두 이름은
  그 삭제 목록에 없다.
- 수정 실행기가 그 환경으로 에이전트를 띄운다. `src/repair/execute-fix-artifact.ts:395`.
- 그 다음 소비는 확인하지 않았다. 대상 저장소 쪽 도구가 읽는지, 무엇을 하는지는 이 체크아웃에서
  볼 수 없다.

이 저장소가 쓰는 곳은 테스트와 문서다. 워크플로가 조건부로 주입한다는 사실을 테스트가 고정하고
(`test/repair/cluster-workflow-security.test.ts:325`, `:329`, 비대상일 때 `undefined` 는 `:335`),
환경 통과를 별 테스트가 고정한다(`test/repair/process-env.test.ts:36`, `:62`).
문서 기재는 `config/operator-documentation.json:45`, `:46` 과 `docs/operator-configuration.md:39` 다.

### 설치 운영자에게 뜻하는 것

Reports 두 개는 유지관리자 보고를 Cloudflare Access 뒤에서 가져올 때만 필요하고, 다른 세 이름
가운데 하나로 대신할 수 있다. QA Convex 두 개는 이 저장소의 기능이 아니라 대상 저장소의 QA 도구에
주는 통과 값으로 보인다. 원본 대상이 아니면 워크플로가 빈 문자열을 넣으므로, LINA Check 설치에서는
설정하지 않아도 이 저장소의 동작이 달라지지 않는다. 대상 쪽 소비는 미검증으로 남긴다.

## 조사 2 · 나머지 `config/` 파일의 운영 필수 값

최소 증거는 "각 파일의 소비 지점 확인"이었다. `config/target-repositories.json` 은 013 이 이미
다뤘고 `config/lina-check-scaffold.json` 은 이 포크의 것이다. 나머지 일곱 개를 본다.

소비 지점이 있다는 것을 "운영 필수 값이다"로 바꾸지 않는다. 성격이 네 가지로 다르다.

| 파일 | 소비 지점 | 성격 |
| -- | -- | -- |
| `automation-limits.json` | `src/limits.ts:75`, `scripts/check-limits.ts:59` | 런타임 한도. 실행 중 읽히고 값이 동작을 바꾼다 |
| `documentation-site.json` | `scripts/build-docs-site.mjs:13`, `scripts/check-docs.mjs:520` | 문서 매니페스트. 문서 사이트 생성과 분류 검사용 |
| `documentation-sync.json` | `scripts/check-docs.mjs:935` | 문서 매니페스트 |
| `operator-documentation.json` | `scripts/check-docs.mjs:158` | 문서 매니페스트. 운영자 설정 문서와 변수 목록의 대조용 |
| `stuck-queued-run-zombies.json` | `scripts/stuck-queued-run-remediation.mjs:21` | 조치 시드 데이터. 기본 입력이고 인자로 바꿀 수 있다 |
| `openclaw-knip-6.8.0.pnpm-lock.yaml` | `src/repair/pinned-openclaw-validation-helper.ts:51` | 조건부 검증 자원 |
| `openclaw-knip-6.32.2.pnpm-lock.yaml` | 같은 지점. 버전 문자열로 경로를 만든다 | 조건부 검증 자원 |

Knip 락파일 둘은 조건이 셋이다. 대상이 `openclaw/openclaw` 여야 하고
(`src/repair/pinned-openclaw-validation-helper.ts:34` 가 아니면 즉시 반환한다),
대상 체크아웃에 `scripts/deadcode-knip-runner.mts` 또는 `.mjs` 가 있어야 하고(`:37`),
그 러너가 선언한 버전이 지원 목록에 있어야 한다(`:10`, `:41`). 세 조건 중 하나라도 어긋나면
이 파일들은 쓰이지 않는다. 다른 대상 저장소를 관리하는 설치에서는 운영 필수 값이 아니다.

문서 매니페스트 셋은 `check:docs` 와 문서 사이트 생성에만 쓰이고 둘 다 지금 차단돼 있다.
운영 동작에 값이 필요한 것은 `automation-limits.json` 뿐이고, 그 안의 개별 값이 안전한 범위인지는
031 표에서 단계가 "활성화"인 별 항목이므로 여기서 닫지 않는다.

