# 040 · 착수 단계 소스 조사 2건 (wp5)

031 문서의 미확인 표에서 단계가 "착수"이고 확인 주체가 "JUN-135 구현 담당"인 항목 둘이다.
P 단계에서 앵커를 수집했고 wp5 에서 결론을 확정한다.

## 조사 1 · QA·Reports 변수 세 개의 실제 소비 경로

대상은 `OPENCLAW_QA_CONVEX_SITE_URL`, `OPENCLAW_REPORTS_ACCESS_CLIENT_ID`,
`OPENCLAW_REPORTS_ACCESS_CLIENT_SECRET` 이다. 최소 증거는 소비 코드 1건 또는 부재 확인이다.

수집한 앵커:

- `src/repair/notify-maintainer-report.ts:270` `resolveReportsAccessHeaders`, `:273` client id,
  `:278` client secret. 4단 fallback 의 두 번째 자리다.
- `.github/workflows/repair-cluster-worker.yml.disabled:685`, `:686` QA Convex 두 개를 단계 `env` 로
  주입하며 `target_slug == 'openclaw-openclaw'` 조건이 붙어 있다.
- `src/repair/process-env.ts:18` `codexSubprocessEnv` 가 `process.env` 전체를 자식에게 넘기고
  토큰류만 삭제 목록으로 지운다.
- `config/operator-documentation.json:45`, `:46` 와 `docs/operator-configuration.md:39` 는 문서 기재다.

## 조사 2 · 나머지 `config/` 파일의 운영 필수 값

최소 증거는 각 파일의 소비 지점 확인이다. `config/target-repositories.json` 은 013 이 이미 다뤘고,
`config/lina-check-scaffold.json` 은 이 포크의 것이다. 나머지 일곱 개를 본다.

| 파일 | 소비 지점 |
| -- | -- |
| `automation-limits.json` | `src/limits.ts:75`, `scripts/check-limits.ts:59` |
| `documentation-site.json` | `scripts/build-docs-site.mjs:13`, `scripts/check-docs.mjs:520` |
| `documentation-sync.json` | `scripts/check-docs.mjs:935` |
| `operator-documentation.json` | `scripts/check-docs.mjs:158` |
| `stuck-queued-run-zombies.json` | `scripts/stuck-queued-run-remediation.mjs:21` |
| `openclaw-knip-6.8.0.pnpm-lock.yaml` | `src/repair/pinned-openclaw-validation-helper.ts:51` |
| `openclaw-knip-6.32.2.pnpm-lock.yaml` | 같은 지점. 버전 문자열로 경로를 만든다 |

## 결론

wp5 에서 확정한다.
