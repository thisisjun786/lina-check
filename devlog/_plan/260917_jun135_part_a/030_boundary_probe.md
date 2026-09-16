# 030 · 초기 비활성 경계 프로브 (wp4)

## 목적

원본 코드를 지우는 것이 아니라 실행 경계가 닫혀 있음을 보이는 것이다. 코드 자동 수정, 자동 종료,
자동 머지, 자동 라벨 변경 네 가지가 초기 프로필에서 실행되지 않는지 실제 호출로 확인한다.

## 안전 규칙

프로브는 실사격이 아니다. 각 대상을 부르기 전에 `package.json` 의 해당 스크립트가 정확히
`node scripts/scaffold-disabled.mjs <name>` 인지 확인하고, 아니면 부르지 않고 실패한다
(`scripts/lina-check-derived-contract.mjs` 의 `assertProbeTargetGuarded`). 가드가 사라진
체크아웃에서 프로브가 실제 수정을 실행하는 사고를 막는다.

프로브는 저장소 트리에 아무 파일도 쓰지 않는다. 실행 전후 `git status --porcelain` 문자열을
비교한다. 이것을 "바이트 동일"로 읽지 않는다. porcelain 문자열 비교는 모든 내용 변경, 무시된
파일 쓰기, 저장소 밖 부작용을 잡지 못한다. 잡는 것은 추적 대상 파일의 상태 변화뿐이다.

## 관측 결과

`corepack pnpm run lina:boundary-probe` exit 0. 대상 8개 전부 exit 1 이고 각각
`... is disabled. See README.md before configuring or enabling automation.` 진단을 냈다.

| 자동 동작 | 스크립트 | package.json | exit | 가드 진단 |
| -- | -- | -- | -- | -- |
| 코드 자동 수정 | `repair:execute-fix` | `:47` | 1 | 있음 |
| 코드 자동 수정 | `repair:apply-result` | `:46` | 1 | 있음 |
| 자동 종료 | `apply-decisions` | `:22` | 1 | 있음 |
| 자동 종료 | `repair:finalize-open-prs` | `:49` | 1 | 있음 |
| 자동 머지 | `e2e:automerge` | `:18` | 1 | 있음 |
| 자동 머지 | `repair:publish-main` | `:56` | 1 | 있음 |
| 자동 라벨 | `repair:cleanup-replacement-labels` | `:50` | 1 | 있음 |
| 자동 라벨 | `repair:tag-clawsweeper` | `:76` | 1 | 있음 |

워크플로 5개는 실행 대상 `.yml` 이 없고 `.yml.disabled` 만 있다.

| 워크플로 | `.yml` | `.yml.disabled` |
| -- | -- | -- |
| `automerge-e2e` | 없음 | 있음 |
| `clawsweeper-dispatch` | 없음 | 있음 |
| `repair-comment-router` | 없음 | 있음 |
| `repair-publish-results` | 없음 | 있음 |
| `sweep` | 없음 | 있음 |

작업물 비교는 전후 동일했다.

## 증거 파일의 성격

`evidence/boundary-probe.json` 은 관측된 한 번의 실행 출력이다. **기대 출력 oracle 이 아니다.**
어떤 검사도 이 파일과 새 실행을 대조하지 않는다. 표준 출력은 체크아웃 밖(`/var/tmp`)에서 받아
파일로 옮겼고, 프로브 출력에는 시각처럼 실행마다 달라지는 값을 넣지 않았다. 그래서 같은 상태에서
다시 돌리면 같은 내용이 나온다.

출처는 본문에 적는다. 명령 `corepack pnpm run lina:boundary-probe`, 관측 SHA `4f61e88b`,
관측일 2026-09-17, Node 24.20.0, pnpm 12.4.1.

이 파일을 `derived.files` 에 선언했다. 그래서 선언 파일 수가 11에서 12로 바뀐다. `060` 과
`010` 의 11 은 이 선언 전의 측정값이므로 그대로 둔다.

## 증명하지 못하는 것

- `node dist/...` 또는 `node src/...` 직접 실행은 package 가드를 지나지 않는다. `POLICY.md:9` 가
  같은 말을 한다. 이 프로브는 운영자가 쓰는 package 경로만 본다.
- 원격 저장소의 Actions 설정, GitHub App 설치 상태, ruleset 은 로컬 프로브의 관측 대상이 아니다.
- `src/` 에 해당 기능이 없다는 뜻이 아니다. 기능은 그대로 있고 빌드된다.
- 샌드박스가 아니다. 실수 방지 장치다.
- "모든 실행 입구"를 다 봤다는 뜻이 아니다. 선언된 8개와 워크플로 5개만 봤다.

