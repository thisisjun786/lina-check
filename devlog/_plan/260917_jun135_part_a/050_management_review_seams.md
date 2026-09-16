# 050 · 관리 판단과 코드 리뷰의 연결점 (wp5)

JUN-63 이 확정한 역할 경계를 어디에 끼우는지만 남긴다. 파서·프롬프트·schema 패치 설계는 JUN-64
소유이므로 여기서 구현하지 않는다.

## 전제

021 문서의 결론은 프롬프트 하나, 실행기 하나, 결과 schema 하나를 공유한다는 것이다.
이 checkout 에서 앵커를 다시 확인했다.

| 공유 지점 | 앵커 |
| -- | -- |
| 항목 리뷰 프롬프트 경로 상수 | `src/clawsweeper-runtime.ts:197` |
| 프롬프트 무조건 캐시 | `src/clawsweeper-review-runtime.ts:465` |
| 결정 schema 경로 상수 | `src/clawsweeper-runtime.ts:198` |
| 생성 시 `--output-schema` 주입 | `src/clawsweeper-review-runtime.ts:1138` |
| 파서가 강제하는 키 집합 | `src/clawsweeper-policy.ts:729` `DECISION_SCHEMA_KEYS` |
| 미등록 키 거부 | `src/clawsweeper-decision-parser.ts:1003` |
| schema required 목록 시작 | `schema/clawsweeper-decision.schema.json:5` |

## 결론

wp5 에서 확정한다.
