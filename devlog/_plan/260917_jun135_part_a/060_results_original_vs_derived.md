# 060 · 원본 기준 결과와 파생 변경 후 결과

같은 항목을 두 상태에서 관측해 나란히 둔다. 원본 기준은 baseline `f611316d` 의 변경 전 상태이고,
파생 변경 후는 이 PR 의 최종 head 다.

## 측정 방법

`명령 > 파일 2>&1; echo $?` 로 종료 코드를 읽는다. `명령 | tail; echo $?` 는 `tail` 의 종료
코드를 주므로 쓰지 않는다. 초기 측정에서 이 실수가 있었고 정정했다.

## 원본 기준 (baseline f611316d, 변경 전)

| 항목 | 결과 |
| -- | -- |
| `install --frozen-lockfile --ignore-scripts` | exit 0 |
| `check:scaffold` | exit 0. "upstream 1ed7bd4e...; 1646 original entries checked; 35 workflows parked; 104 commands blocked" |
| `build:all` | exit 0 |
| `lint` | exit 0 |
| 후보 테스트 15개 | 13개 exit 0, 2개 exit 1 (프로필 불일치) |
| 안전 부분집합 러너 | 없음 |
| 비실행 미리보기 | 없음. 013 이 적은 대로 `check:scaffold` 의 보존 검사가 유일한 비실행 확인이었다 |
| 차단 프로브 | `check:scaffold` 내부의 raw node 가드 프로브 104건만 |
| 파생 문서를 추가한 직후 `check:scaffold` | exit 1. `Unexpected source addition: devlog/...` — 선언 없이는 거부된다 |

마지막 줄이 중요하다. 이 과제의 변경은 통과하던 검사를 느슨하게 만든 것이 아니라, 거부하던 것을
선언으로 추적하게 만든 것이다.

## 파생 변경 후 (최종 head)

wp3·wp4 의 C 단계에서 채운다.
