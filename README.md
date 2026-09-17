# LINA Check

**이슈와 PR, 다음에 무엇을 해야 할지.**

LINA Check는 기여자와 코딩 에이전트가 이슈·PR을 진행할 때, 부족한 검증과 다음 할 일을 파악하도록 돕는 오픈소스 저장소 관리 도구를 목표로 한다. 코드 리뷰는 Devin과 Codex에 맡기고, 그 결과와 CI 상태를 모아 머지까지 남은 작업을 안내하는 방향으로 개발한다.

현재는 초기 개발 단계다. **로컬 빌드와 린트만 가능하고, 자동 실행과 배포는 꺼져 있다.** Devin·Codex 결과 연동과 Oracle 호출은 아직 구현되지 않았다. Oracle은 설치 운영자가 지정한 허용 사용자만 수동 호출하도록 연결할 예정이다.

## 로컬에서 확인하기

Node.js 24 이상과 Corepack이 필요하다. 저장소에 지정된 pnpm 12.4.1을 사용한다. 출처 검증에 원본 commit이 필요하므로 `--depth` 없이 전체 clone한다.

```sh
corepack pnpm install --frozen-lockfile --ignore-scripts
corepack pnpm run check:scaffold
corepack pnpm run build:all
corepack pnpm run lint
```

`check:scaffold`는 원본 출처, 보존 파일, 비활성 워크플로와 차단 명령을 확인한다. 원본의 전체 테스트와 `check`는 활성 워크플로 경로를 전제로 하므로 이 단계에서는 차단돼 있다. 위 검증이 실제 서비스 연동이나 운영 준비 완료를 뜻하지 않는다.

원본 테스트 중 외부 호출·설치 훅·게시 부작용이 없다고 판정한 13개는 복원해 돌릴 수 있다. 다음 네 명령이 그 표면이다.

```sh
corepack pnpm run lina:test-safe           # 복원한 원본 테스트 13개 실행
corepack pnpm run lina:test-safe:preview   # 대상만 출력하고 테스트를 띄우지 않는다
corepack pnpm run lina:boundary-probe      # 자동 수정·종료·머지·라벨 입구가 닫혀 있는지 실제 호출로 확인
corepack pnpm run lina:contract-selftest   # 위 선언 검사의 거부 경로가 실제로 거부하는지 확인
```

대상 목록은 `config/lina-check-scaffold.json`의 `derived`에 선언하고, 허용 집합은 `scripts/lina-check-derived-contract.mjs`의 리터럴이 고정한다. 설정만 고쳐서 목록을 넓힐 수 없다.

`lina:test-safe`는 `dist/`의 각 산출물이 대응하는 원본 파일보다 최신인지 쌍 단위로 확인하고, 하나라도 낡았으면 실행하지 않고 끝낸다. 낡은 산출물을 검증하고 통과 보고가 나가는 일을 막으려는 것이다. 그 경우 `build:all`을 먼저 돌린다.

이 네 명령이 열려 있다는 것이 운영 준비를 뜻하지 않는다. 워크플로 35개는 그대로 parked이고 차단 명령 104개는 그대로 차단이다.

## 현재 실행 범위

- GitHub 워크플로 35개는 `.github/workflows/*.yml.disabled`에 원문 그대로 보관했다. GitHub Actions가 실행 대상으로 읽는 YAML은 없다.
- 기존 package 명령 중 build·lint 계열만 열어뒀고, 그 위에 LINA Check가 추가한 `lina:*` 네 개가 있다. 리뷰, 자동 수정, 닫기, 머지, 댓글 게시, 상태 변경, Worker 실행과 배포 명령은 즉시 실패한다.
- 이 차단은 실수 방지 장치다. 원본 코드를 직접 `node`나 `npx`로 실행하거나 파일을 고치면 우회할 수 있다. 차단되어 있다는 것이 허가 모형은 아니다.
- 관리 대상 저장소는 [설치 설정](config/lina-check-installation.json)이 정한다. 저장소에 들어 있는 값은 비어 있고, 빈 설정은 아무나 허용이 아니라 아무도 허용하지 않음이다. 설치 운영자가 채우기 전에는 어떤 저장소도 통과하지 못한다.
- Worker 설정에서 계정·도메인·대상·상태 저장소 값을 비웠다. 구조는 원본 그대로 두었고 프로비저닝하지 않았다.
- 소스 저장소는 [thisisjun786/lina-check](https://github.com/thisisjun786/lina-check)다. 개발 체크아웃의 `origin`은 이 저장소를, `upstream`은 ClawSweeper 원본을 가리킨다. 소스 공개와 별개로 배포, GitHub App, 상태 저장소, 인증 정보는 연결하지 않았다.

## 설치 설정

관리 대상과 브랜딩, 상태 저장소, GitHub App 값이 들어갈 자리는 [config/lina-check-installation.json](config/lina-check-installation.json)이다. 형식은 [스키마](schema/lina-check-installation.schema.json)에 있다.

규칙은 한 문장이다. **레지스트리는 대상을 서술하고 설치 설정이 허가한다.** 설정이 비어 있으면 원본 프로필에 적혀 있는 저장소도 통과하지 못한다. 대상 하나가 실제로 동작하려면 설치 설정의 허가와 그것을 서술하는 프로필이 둘 다 있어야 한다.

`check:scaffold`는 이 파일이 비어 있는 채로 유지되는지 확인한다. 값이 채워진 설정이 저장소에 들어오면 통과하지 않는다. 거부 경로가 실제로 거부하는지는 `lina:contract-selftest`이 확인한다. 설정은 프로세스당 한 번 읽으므로 바꾸면 재시작이 필요하다.

GitHub App이 실제로 필요한 권한 범위는 [권한 문서](docs/lina-check/github-app-permissions.md)에 있다. 소스가 실제로 부르는 엔드포인트에서 도출했고 단계별로 나눴다. 휴면 상태에서 필요한 권한은 없다.

## 다음 개발 작업

ClawSweeper의 기존 분류·관리 흐름에 LINA Check 정책과 Devin·Codex 결과를 연결한다. 원본 워크플로를 켜기 전에는 대상·권한·모델 호출·쓰기 동작과 포크 PR 경계를 검증해야 한다. Oracle 호출은 설치 운영자가 지정한 허용 사용자 전용 경로로 구현한다. 외부 기여자가 PR이나 댓글을 작성했다는 이유만으로 호출 권한을 얻지는 않는다. 파일 이름만 되돌려 운영을 시작하지 않는다.

## 크레딧과 라이선스

LINA Check는 [ClawSweeper](https://github.com/openclaw/clawsweeper/tree/1ed7bd4e13fb03334798e4d027ba3383ac9e5f01)를 기반으로 개발한다. 저장소 관리의 토대를 만든 원작자와 기여자들에게 감사한다. 현재 원본의 소스·대시보드·테스트·설정은 그대로 보존하고 있다.

기준 커밋은 `1ed7bd4e13fb03334798e4d027ba3383ac9e5f01`이며, 이 기준까지의 공개 upstream 이력과 그 위의 LINA Check 변경을 보존한다. [LICENSE](LICENSE)는 원본 MIT 문구를 유지한다. 정확한 보관 목록은 [스캐폴드 설정](config/lina-check-scaffold.json)을 읽는다.

원본 [README](docs/upstream/README.md), [AGENTS](docs/upstream/AGENTS.md), [기여 안내](docs/upstream/CONTRIBUTING.md), [VISION](docs/upstream/VISION.md)은 참고 자료다. 그 안의 활성 운영 절차와 상대 링크는 원본 저장소 기준이며, 이 체크아웃의 실행 지침은 [AGENTS.md](AGENTS.md)와 [POLICY.md](POLICY.md)다. 기존 비공개 구현과 운영 자료는 이 소스 트리에 포함하지 않았다.
