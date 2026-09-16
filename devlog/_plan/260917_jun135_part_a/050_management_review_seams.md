# 050 · 관리 판단과 코드 리뷰의 연결점 (wp5)

JUN-63 이 확정한 역할 경계를 **어디에 끼워야 하는지**만 남긴다. 어떻게 끼울지는 JUN-64 소유다.
그래서 이 문서는 새 필드 이름, 라우팅 규칙, 프롬프트 분할 방식, 파서 패치 처방을 적지 않는다.
구현하지 않아도 그것은 설계 처방이고, 이 유닛의 것이 아니다.

여기 적는 것은 기존 제약이 어디에 있고 무엇을 요구하는지다.

## 범위 한정

"프롬프트 하나, 실행기 하나, schema 하나를 공유한다"는 결론은 **항목 리뷰 경로**에 한정된다.
이 체크아웃에는 다른 경로도 있다. PR 종료 근거 증빙은 자기 프롬프트를 따로 읽고
(`src/clawsweeper-review-runtime.ts:470`) 커밋 리뷰도 별도다. 아래 표는 항목 리뷰 경로의 것이다.

## 연결점

| # | 연결점 | 앵커 | 그 자리가 요구하는 것 |
| -- | -- | -- | -- |
| 1 | 항목 리뷰 프롬프트 경로 | `src/clawsweeper-runtime.ts:197` | 모듈 상수다. 설정으로 고를 수 없다 |
| 2 | 프롬프트 캐시 | `src/clawsweeper-review-runtime.ts:465` | 조건 없이 한 번 읽고 캐시한다. 항목 종류로 갈리지 않는다 |
| 3 | 결정 schema 경로 | `src/clawsweeper-runtime.ts:198` | 모듈 상수다. 환경 변수로 바꾸는 코드가 없다 |
| 4 | 생성 시 schema 주입 | `src/clawsweeper-review-runtime.ts:1138` | `--output-schema` 로 강제한다. 출력만 지워도 생성은 그대로다 |
| 5 | 에이전트 실행 | `src/clawsweeper-review-runtime.ts:1127` | 항목마다 프로세스를 하나 띄운다. 관리와 리뷰가 같은 호출을 지난다 |
| 6 | 파서의 키 집합 | `src/clawsweeper-policy.ts:729` | `DECISION_SCHEMA_KEYS` 가 schema 파일과 따로 하드코딩돼 있다 |
| 7 | 미등록 키 거부 | `src/clawsweeper-decision-parser.ts:1003` | `rejectUnexpectedKeys` 를 지난다. 6번과 어긋나면 파싱이 깨진다 |
| 8 | schema required 목록 | `schema/clawsweeper-decision.schema.json:5` | 59개 필드가 required 다 |
| 9 | 종료 판단의 리뷰 필드 의존 | `src/clawsweeper-close-decision.ts:138` | 리뷰 결과를 조건으로 읽는다. 표시용이 아니다 |
| 10 | 라벨의 등급 파생 | `src/clawsweeper-label-selection.ts:103` | 리뷰 등급에서 라벨이 나온다 |

## 이 표의 뜻

역할 경계를 적용하려면 위 열 곳 중 어디를 건드리든 **6번과 8번이 함께 움직여야** 한다.
파서의 키 집합이 schema 파일과 별도로 존재하기 때문이다. 그리고 9번과 10번이 있는 한, 리뷰 산출물을
지우는 방식은 관리 판단 쪽 동작을 함께 바꾼다. 어느 쪽을 고를지는 JUN-64 에서 정한다.

설정으로 되는 것과 안 되는 것의 구분은 021 문서가 이미 확정했고 이 유닛이 다시 정하지 않는다.
여기서 확인한 것은 그 앵커들이 이 체크아웃의 현재 커밋에서도 같은 자리에 있다는 사실이다.

## 이 유닛이 하지 않은 것

프롬프트·schema·파서 패치 설계, 필드 재분류, 새 실행 경로 제안. JUN-64 소유다.

