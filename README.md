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

## 현재 실행 범위

- GitHub 워크플로 35개는 `.github/workflows/*.yml.disabled`에 원문 그대로 보관했다. GitHub Actions가 실행 대상으로 읽는 YAML은 없다.
- 기존 package 명령 중 build·lint 계열만 열어뒀다. 리뷰, 자동 수정, 닫기, 머지, 댓글 게시, 상태 변경, Worker 실행과 배포 명령은 즉시 실패한다.
- 이 차단은 실수 방지 장치다. 원본 코드를 직접 `node`나 `npx`로 실행하거나 파일을 고치면 우회할 수 있다. 원본 설정에는 OpenClaw 운영 대상이 남아 있으므로 아직 운영 명령을 직접 실행하지 않는다.
- 소스 저장소는 [thisisjun786/lina-check](https://github.com/thisisjun786/lina-check)다. 개발 체크아웃의 `origin`은 이 저장소를, `upstream`은 ClawSweeper 원본을 가리킨다. 소스 공개와 별개로 배포, GitHub App, 상태 저장소, 인증 정보는 연결하지 않았다.

## 다음 개발 작업

먼저 관리할 저장소와 GitHub App 권한, 상태 저장소를 정한다. 그다음 ClawSweeper의 기존 분류·관리 흐름에 LINA Check 정책과 Devin·Codex 결과를 연결한다. 원본 워크플로를 켜기 전에는 대상·권한·모델 호출·쓰기 동작과 포크 PR 경계를 검증해야 한다. Oracle 호출은 설치 운영자가 지정한 허용 사용자 전용 경로로 구현한다. 외부 기여자가 PR이나 댓글을 작성했다는 이유만으로 호출 권한을 얻지는 않는다. 파일 이름만 되돌려 운영을 시작하지 않는다.

## 크레딧과 라이선스

LINA Check는 [ClawSweeper](https://github.com/openclaw/clawsweeper/tree/1ed7bd4e13fb03334798e4d027ba3383ac9e5f01)를 기반으로 개발한다. 저장소 관리의 토대를 만든 원작자와 기여자들에게 감사한다. 현재 원본의 소스·대시보드·테스트·설정은 그대로 보존하고 있다.

기준 커밋은 `1ed7bd4e13fb03334798e4d027ba3383ac9e5f01`이며, 이 기준까지의 공개 upstream 이력과 그 위의 LINA Check 변경을 보존한다. [LICENSE](LICENSE)는 원본 MIT 문구를 유지한다. 정확한 보관 목록은 [스캐폴드 설정](config/lina-check-scaffold.json)을 읽는다.

원본 [README](docs/upstream/README.md), [AGENTS](docs/upstream/AGENTS.md), [기여 안내](docs/upstream/CONTRIBUTING.md), [VISION](docs/upstream/VISION.md)은 참고 자료다. 그 안의 활성 운영 절차와 상대 링크는 원본 저장소 기준이며, 이 체크아웃의 실행 지침은 [AGENTS.md](AGENTS.md)와 [POLICY.md](POLICY.md)다. 기존 비공개 구현과 운영 자료는 이 소스 트리에 포함하지 않았다.
