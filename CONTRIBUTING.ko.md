# 기여 가이드

[English](./CONTRIBUTING.md) · **한국어**

## 설정

```bash
git clone https://github.com/redrob-labs/redrob-design.git
cd redrob-design
bun install
```

## 개발

```bash
bun run dev          # Vite dev server on localhost:1420
bun run tauri dev    # Tauri desktop app with hot reload
```

## 포크 규칙 두 가지

레드롭 디자인은 OpenPencil(MIT)의 이식본입니다. 다음 두 규칙은 스타일이 아니라 라이선스
문제입니다.

1. **자기 저작권 줄은 추가하되 상류의 것은 절대 지우지 않습니다.** MIT 라이선스는 상류 표기가
   모든 복제본에 남아 있을 것을 요구합니다. `LICENSE`와 `NOTICE`는 Danila Poyarkov와 OpenPencil
   기여자를 계속 명시해야 합니다.
2. **상류에서 가져온 것은 기록합니다.** `upstream-base.json`의 `lastSyncedUpstream`을 멈춘 커밋으로
   갱신합니다. 이 저장소는 상류와 이력을 공유하지 않으므로 그 파일만이 우리가 얼마나 뒤처졌는지
   압니다.

`bun run check:upstream-boundary`가 1번을 기계적으로 강제합니다. 2번은 리뷰에서 확인합니다.

## 브랜치 흐름

- `main`이 트렁크입니다. 모든 변경은 풀 리퀘스트로 들어옵니다.
- 작업 브랜치는 `<type>/<short-slug>` 형식입니다(`feat`, `fix`, `chore`, `docs`, `test`,
  `refactor`, `perf`).
- 상류 동기화는 `sync/upstream-<date>`입니다. 상류의 기본 브랜치는 `main`이 아니라 `master`입니다.

## 풀 리퀘스트

PR은 작성자의 의도를 추측하지 않고도 리뷰할 수 있어야 합니다.

### 제목

- 영어로 씁니다.
- 실제 변경을 구체적으로 적습니다. `fix`, `update`, `some fixes`, `changes`, `WIP` 같은 모호한
  제목은 쓰지 않습니다.
- 변경에 맞으면 Conventional Commits를 씁니다. 예: `fix: handle empty exports`.

### 본문

- 템플릿이 있으면 그대로 따릅니다.
- 무엇을 왜 바꿨는지 설명하고, 의미 있는 변경 목록을 담습니다.
- 검증 방법을 적습니다(`bun run check`, 대상 테스트, 문서만 검토, 또는 검증하지 않은 명시적 이유).
- AI 지원 항목을 채웁니다. LLM이 PR 작성·수정에 실질적으로 관여했다면 아는 모델 이름을 적고,
  아니면 `None`이라고 씁니다. 저작자 표시가 아니라 리뷰 맥락입니다.
- 본문은 주로 영어로 씁니다. 코드 식별자, 파일 경로, 로그, 오류 메시지, 짧은 인용 예시는 원래
  언어를 그대로 둡니다.

### 리뷰 가능성

자리표시자 PR은 올리지 않습니다. 템플릿 주석을 지우고, `Fixes #`처럼 대상 없는 참조나 `TODO`,
`TBD`, 빈 제목, 채우지 않은 항목을 남기지 않습니다.

## 품질 검사

PR 전에 모두 실행합니다.

```bash
bun run check                    # lint, type checks, architecture, package, duplication, tooling
bun run format                   # oxfmt with import sorting
bun run test:unit                # bun:test engine/unit suite
bun run test                     # Playwright browser E2E and visual regression
bun run check:upstream-boundary  # fork rules
```

## 저장소 구조

레드롭 디자인은 Bun 모노레포입니다. 소유 경계는 다음과 같습니다.

- `packages/scene-graph`, `pen`, `kiwi`, `fig` — 프레임워크 중립 문서 모델과 포맷 계층.
- `packages/core` — 렌더러, 레이아웃, 편집기 코어, Figma API, 도구, 앱용 문서 I/O.
- `packages/dom-css`, `vue` — DOM/CSS 투영과 헤드리스 Vue SDK.
- `packages/cli`, `mcp`, `harness` — 자동화와 에이전트용 진입점.
- `src/app` — 앱 서비스·상태·연동. `src/components`, `src/views` — 앱 UI와 화면.
- `packages/docs` — 공개 VitePress 사이트.

정본 패키지 소유권과 아키텍처 규칙은 [`AGENTS.md`](./AGENTS.md)에 있습니다.

## 코드베이스 적합성

헬퍼, 타입, 컴포넌트, 상태 기제, 파서, 테스트 유틸리티를 추가하기 전에 해당 도메인과 인접 구현,
기존 의존성, 테스트를 먼저 봅니다. 기존 기제를 재사용하거나 확장하고, 정말 공용인 로직만 추출합니다.
병렬 구현을 새로 만들지 않습니다.

패키지 경계와 공개 export를 유지합니다. PR은 좁게 유지하고 임시 스캐폴딩, 무관한 리팩터, diff가
뒷받침하지 않는 changelog 주장을 넣지 않습니다.

## 테스트

- `tests/e2e/**/*.spec.ts` — 브라우저 UI와 시각 동작.
- `tests/figma/**/*.spec.ts` — Figma 자동화.
- `tests/engine/**/*.test.ts` — 엔진과 단위 동작.
- `tests/helpers/**` — 공용 테스트 유틸리티.

구현 세부나 소스 텍스트가 아니라 동작과 안정된 계약을 시험합니다. Playwright 테스트는 사용자와
보조 기술이 하는 방식대로 대상을 찾습니다. 역할과 접근 가능한 이름, 라벨, 보이는 텍스트를
우선합니다.

`tests/fixtures/`의 `.fig` 픽스처는 Git LFS입니다. `.fig` 파일을 바꾸지 않았다면
`git push --no-verify`로 느린 LFS pre-push 훅을 건너뜁니다.

## 관례

전체 아키텍처 참고와 코드 관례는 [`AGENTS.md`](./AGENTS.md)에 있습니다. 핵심만 적으면:

- Node가 아니라 Bun 런타임.
- 스타일은 Tailwind 4. 인라인 CSS나 컴포넌트 `<style>` 블록을 쓰지 않습니다.
- `any`와 non-null 단정을 쓰지 않습니다. 가드와 정확한 타입을 씁니다.
- 패키지 경계를 넘을 때는 공개 export를 씁니다.
- `Math.random()`이 아니라 `crypto.getRandomValues()`를 씁니다.
- 직접 만들기 전에 기존 의존성과 Reka UI 컴포넌트를 씁니다.
- UI 라벨은 번역 가능하게 두고 단축키는 공용 command registry에 둡니다.

## 커밋

커밋 메시지 규약은 [`AGENTS.md`](./AGENTS.md)를 따릅니다. 사용자에게 보이는 변경은 `CHANGELOG.md`를
갱신합니다.

## 보안

취약점은 공개 이슈나 PR로 보고하지 마세요. 절차는 [SECURITY.md](./SECURITY.md)에 있습니다.

## 기여물의 라이선스

기여하시면 그 기여물이 저장소의 나머지와 같은 MIT 조건으로 배포되는 데 동의하는 것으로 봅니다.
자기 기여분의 저작권은 그대로 보유합니다.
