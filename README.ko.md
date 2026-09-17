# Redrob Design (레드롭 디자인)

[English](./README.md) · **한국어**

프롬프트로 움직이는 디자인 편집기입니다. `.fig`와 `.pen` 파일을 열고, Redrob Code 엔진을
통해 프롬프트로 디자인하며, 직접 편집기를 만들 수 있는 헤드리스 Vue SDK를 포함한 프로그래밍
가능한 도구 모음으로 출하됩니다.

> **상태:** 활발히 개발 중입니다. 지금도 사용할 수 있지만 기능이 정리되는 과정의 거친 부분이
> 남아 있습니다.

> 레드롭 디자인은 [OpenPencil](https://github.com/open-pencil/open-pencil)(MIT)에서
> 파생됐습니다. [라이선스](#라이선스)와 [UPSTREAM.md](./UPSTREAM.md)를 참고하세요.

![Redrob Design](packages/docs/public/screenshot.png)

## 설치

릴리즈 페이지에서 내려받거나, 소스에서 데스크톱 앱을 빌드합니다([기여하기](#기여하기) 참고).

## Redrob 연결

레드롭 디자인은 자체 워크스페이스 키를 보관하지 않습니다. ACP를 통해 **Redrob Code** 엔진으로
Redrob에 접속하며, 워크스페이스에 로그인하는 주체는 Code입니다.
`redrob providers login --provider redrob`을 실행해 **Connect Redrob**을 선택하고, 표시된
짧은 코드를 [Redrob Console](https://console.redrob.ai)에서 승인합니다. 그러면 디자인은 엔진을
통해 그 연결을 사용합니다.

콘솔의 원클릭 장치 연결 흐름은 이 앱에 직접 배선돼 있지 않습니다. 엔진을 경유하고 싶지 않다면
**설정 → AI & agents**에서 OpenRouter, Anthropic, OpenAI, Google AI, Z.ai, MiniMax 또는 호환
엔드포인트의 키를 직접 입력할 수 있습니다.

## Redrob Code로 프롬프트 디자인

레드롭 디자인은 자연어 디자인 요청을 기본 ACP(Agent Client Protocol) Design 에이전트로 배선된
**Redrob Code** 엔진으로 보냅니다. 채팅에 원하는 것을 적으면 엔진이 편집기의 90여 개 디자인
도구를 써서 scene graph를 만들고 수정합니다.

Redrob Code 엔진이 설치돼 있지 않으면 앱이 설치 과정을 안내하고(`REDROB_CODE_BIN` 설정 또는
`redrob` CLI 설치), 이후 Design 에이전트를 자동으로 다시 연결합니다.

## 기능

- **`.fig`·`.pen` 파일 열기**: 네이티브 Figma 파일 읽기·쓰기, 앱이나 OS 파일 탐색기에서 레드롭
  디자인 문서 열기, 앱 사이 노드 복사·붙여넣기
- **AI가 디자인을 만듦**: 채팅으로 원하는 것을 설명하면 90여 개 도구가 노드를 만들고 수정합니다.
  Redrob Code 엔진으로 보내거나 OpenRouter, Anthropic, OpenAI, Google AI, Z.ai, MiniMax, 호환
  엔드포인트를 연결합니다
- **완전한 프로그래밍 가능성**: 헤드리스 CLI, XPath 질의, `eval`을 통한 Figma Plugin API, AI
  에이전트용 MCP 서버, Redrob Code와 다른 ACP 에이전트를 위한 데스크톱 연동
- **린트·변환·토큰 추출**: 문서 점검, 이름·레이아웃·접근성 린트, 지원 포맷 간 변환,
  색·타이포그래피·간격·클러스터 분석, 디자인 토큰 추출
- **디자인 토큰과 테마 라이브러리**: 디자인 토큰 가져오기(DTCG, CSS 변수, Tailwind)와 내장 Redrob
  브랜드 테마·덱 라이브러리
- **컴포넌트와 변형**: 재사용 컴포넌트 생성, 변형을 컴포넌트 세트로 묶기, 로컬 자산을 인스턴스로
  삽입, 인스펙터에서 변형 전환
- **이미지 벡터화**: Recraft 또는 fal.ai로 이미지 레이어를 편집 가능한 벡터 레이어로 변환
- **디자인을 코드로 내보내기**: 선택 영역을 JSX/Tailwind로 내보내기, 토큰 산출물 생성, 디자인을
  컴포넌트 중심 코드 작업으로 옮기기
- **커스텀 편집기용 Vue SDK**: 레드롭 디자인을 다른 앱에 넣거나 업무에 맞춘 편집 화면을 만드는
  헤드리스 컴포넌트와 컴포저블
- **실시간 협업**: WebRTC P2P, 서버 없음, 계정 없음. 커서·프레즌스·따라가기 모드
- **오토 레이아웃과 CSS Grid**: Yoga WASM 기반 flex·grid 레이아웃, gap·padding·정렬·트랙 크기
- **가벼운 데스크톱 앱**: macOS, Windows, Linux용 Tauri v2. 브라우저에서 PWA로도 동작

## CLI

```sh
npm install -g @redrob-design/cli
# or: bun add -g @redrob-design/cli
```

### 디자인 파일 살펴보기

편집기를 열지 않고 노드 트리를 훑고, 이름·타입으로 찾고, 속성을 파고듭니다.

```sh
redrob-design tree design.fig
redrob-design find design.pen --type TEXT
redrob-design node design.fig --id 1:23
redrob-design info design.fig
```

### XPath 질의

XPath 선택자로 타입·속성·구조를 기준으로 노드를 찾습니다.

```sh
redrob-design query design.fig "//FRAME"                              # All frames
redrob-design query design.fig "//FRAME[@width < 300]"                # Frames under 300px
redrob-design query design.fig "//TEXT[contains(@name, 'Button')]"     # Text with 'Button' in name
redrob-design query design.fig "//*[@cornerRadius > 0]"               # Rounded corners
redrob-design query design.fig "//SECTION//TEXT"                       # Text inside sections
```

### 내보내기

PNG, JPG, WEBP, SVG, `.fig`, JSX로 렌더하거나, 선택 영역·페이지를 `.fig`로 내보내고 문서 전체를
지원 포맷 사이에서 변환합니다.

```sh
redrob-design export design.fig                           # PNG
redrob-design export design.fig -f jpg -s 2 -q 90         # JPG at 2x, quality 90
redrob-design export design.fig -f fig --page "Page 1"    # Export a page as .fig
redrob-design export design.fig -f jsx --style tailwind   # Tailwind JSX
redrob-design export design.fig -f html --css tailwind    # Tailwind HTML fragment
redrob-design convert design.pen output.fig               # Convert between document formats
redrob-design import page.html --css styles.css -o page.fig # HTML/CSS to editable .fig
```

DOM/CSS 입력은 `@redrob-design/dom-css`를 지나므로 HTML, 직접 작성한 CSS, Tailwind 유틸리티 CSS가
편집 가능한 디자인 레이어가 됩니다.

### 디자인 파일 린트

이름·레이아웃·구조·접근성 문제를 터미널에서 잡습니다.

```sh
redrob-design lint design.fig
redrob-design lint design.pen --preset strict
redrob-design lint design.fig --rule color-contrast
redrob-design lint design.fig --list-rules
```

### 분석과 디자인 토큰 추출

디자인 시스템 전체를 터미널에서 감사합니다. 불일치를 찾고, 실제 사용된 팔레트를 뽑고, 컴포넌트로
추출할 만한 반복을 찾아냅니다.

```sh
redrob-design analyze colors design.fig
redrob-design analyze typography design.fig
redrob-design analyze spacing design.fig
redrob-design analyze clusters design.fig
redrob-design analyze overlaps design.fig
redrob-design variables design.fig
```

### Figma Plugin API로 스크립트 작성

`eval`은 Figma Plugin API 전체를 제공합니다. 파일을 수정하고 다시 저장할 수 있습니다.

```sh
redrob-design eval design.fig -c "figma.currentPage.children.length"
redrob-design eval design.fig -c "figma.currentPage.selection.forEach(n => n.opacity = 0.5)" -w
```

### 실행 중인 앱 제어

데스크톱 앱이 실행 중이면 파일 인자를 생략합니다. CLI가 RPC로 연결해 살아 있는 캔버스를
다룹니다. 자동화 스크립트, CI 파이프라인, 편집기와 상호작용해야 하는 AI 에이전트에 유용합니다.

```sh
redrob-design tree                               # Inspect the live document
redrob-design export -f png                      # Screenshot the current canvas
redrob-design eval -c "figma.currentPage.name"   # Query the editor
```

모든 명령은 기계가 읽을 출력을 위해 `--json`을 지원합니다.

## AI와 MCP

### 내장 채팅

<kbd>⌘</kbd><kbd>J</kbd>로 AI 어시스턴트를 엽니다. 도형 생성, 채움·선 설정, 오토 레이아웃 관리,
컴포넌트·변수 작업, 불리언 연산, 디자인 토큰 분석, 자산 내보내기를 하는 100여 개 도구가 있습니다.
디자인 요청은 기본적으로 Redrob Code 엔진을 지나가며, 원한다면 OpenRouter, Anthropic, OpenAI,
Google AI, Z.ai, MiniMax, 호환 엔드포인트의 키를 직접 쓸 수 있습니다. 백엔드도 계정도 없습니다.

### 코딩 에이전트 (데스크톱)

Redrob Code나 다른 ACP 호환 코딩 에이전트를 채팅 패널에서 바로 씁니다. 에이전트는 편집기의 MCP
서버에 연결해 100여 개 디자인 도구를 모두 사용합니다. 데스크톱 앱과 로컬에 설치된 에이전트 CLI가
필요합니다.

Pi는 선택적 AI SDK Harness 제공자로도 쓸 수 있습니다. `npm install -g @redrob-design/harness`로
동반 CLI를 설치한 뒤 **설정 → AI & agents**에서 **Pi** 모델 프로필을 추가합니다. Harness 제공자를
쓰지 않는 사용자에게 JavaScript 런타임을 함께 출하하지 않으려고 동반 CLI를 분리해 두었습니다.

### MCP 서버

Claude Code, Cursor, Windsurf 등 MCP 클라이언트를 연결해 디자인 문서를 헤드리스로 점검·수정·
내보냅니다. 도구 100여 개입니다.

**Stdio** (Claude Code, Cursor, Windsurf):

```sh
npm install -g @redrob-design/mcp
claude mcp add --scope user redrob-design -- redrob-design-mcp
```

**HTTP** (스크립트, CI):

```sh
redrob-design-mcp-http   # Unix socket on macOS/Linux + http://127.0.0.1:7600/mcp
```

로컬 클라이언트는 비공개 Unix 소켓을 자동으로 찾고, 없으면 localhost TCP로 넘어갑니다.
macOS·Linux에서 TCP를 끄려면 `PORT=0`을 지정합니다.

**파일 접근:** `REDROB_DESIGN_MCP_ROOT`로 파일 작업(`open_file`, `new_document`, export의 `path`
인자)의 범위를 특정 디렉터리로 제한합니다. 기본값은 현재 작업 디렉터리입니다.

## 협업

링크를 공유해 실시간으로 함께 편집합니다. 서버도 계정도 없고, 참여자는 WebRTC로 직접 연결됩니다.

1. 오른쪽 위 패널의 공유 버튼을 누릅니다
2. 생성된 링크(`app.redrob.design/share/<room-id>`)를 공유합니다
3. 참여자에게 커서·선택·편집이 실시간으로 보입니다
4. 참여자 아바타를 누르면 그 사람의 뷰포트를 따라갑니다

## 기여하기

### 설정

```sh
bun install
bun run dev:portless  # Web editor at https://redrob-design.localhost
bun run dev           # Direct Vite server at http://localhost:1420
bun run tauri dev     # Desktop app (requires Rust)
```

Portless 첫 실행 때 로컬 HTTPS 인증서를 만들고 신뢰 등록합니다. 연결된 Git 워크트리는
`https://fix-ui.redrob-design.localhost`처럼 브랜치 접두사가 붙은 URL을 자동으로 받으므로 개발
서버들이 1420 포트를 두고 다투지 않습니다. 로컬 라우팅이나 인증서 신뢰가 실패하면
`bunx portless doctor`를 실행하세요.

### 품질 게이트

| 명령 | 설명 |
| ------------------- | --------------------- |
| `bun run check` | 린트 + 타입 검사 |
| `bun run test` | E2E 시각 회귀 |
| `bun run test:unit` | 단위 테스트 |
| `bun run format` | 코드 포매팅 |
| `bun run check:upstream-boundary` | 포크 경계와 저작권 표기 |

자세한 브랜치·커밋·리뷰 규칙은 [CONTRIBUTING.ko.md](./CONTRIBUTING.ko.md)에 있습니다.

### 저장소 구조

```
packages/
  scene-graph/    @redrob-design/scene-graph: nodes, primitives, hit testing, copy/snap/undo
  pen/            @redrob-design/pen: Pencil document format helpers
  kiwi/           @redrob-design/kiwi: Kiwi runtime and low-level .fig container parsing
  fig/            @redrob-design/fig: .fig archives, SceneGraph conversion, instances, metadata
  core/           @redrob-design/core: editor engine, renderer, layout, tools, RPC, document I/O
  dom-css/        @redrob-design/dom-css: HTML/CSS/Tailwind to editable design documents
  vue/            @redrob-design/vue: headless Vue SDK
  cli/            @redrob-design/cli: headless CLI
  mcp/            @redrob-design/mcp: MCP server (stdio + HTTP)
  brand/          @redrob-design/brand: design tokens + brand theme library
  docs/           Documentation site
src/              Vue app (editor shell, AI, collaboration, document I/O)
desktop/          Tauri v2 desktop app (Rust + config)
tests/            E2E, visual, engine, and integration tests
```

### 기술 스택

| 계층 | 기술 |
| ------------- | --------------------------------------------------------------------------------- |
| 렌더링 | Skia (CanvasKit WASM) |
| 레이아웃 | Yoga WASM (flex + grid) |
| UI | Vue 3, Reka UI, Tailwind CSS 4 |
| 파일 포맷 | Kiwi binary + Zstd + ZIP |
| 협업 | Trystero (WebRTC P2P) + Yjs (CRDT) |
| 데스크톱 | Tauri v2 |
| AI·MCP | Redrob Code 엔진(ACP), 다중 제공자(Anthropic, OpenAI, Google AI, OpenRouter), MCP SDK, Hono |

### 데스크톱 빌드

[Rust](https://rustup.rs/)와 플랫폼별 사전 요건([Tauri v2 안내](https://v2.tauri.app/start/prerequisites/))이
필요합니다.

```sh
bun run tauri build
```

## 상류 프로젝트

레드롭 디자인은 git 포크가 아니라 이식본입니다. OpenPencil과 커밋 이력을 공유하지 않으므로 상류
변경은 병합이 아니라 파일 단위로 가져옵니다. 이 트리가 어느 상류 커밋을 기준으로 측정됐는지,
측정 방법, 동기화 절차는 [UPSTREAM.md](./UPSTREAM.md)에 있고 기계가 읽는 기록은
[upstream-base.json](./upstream-base.json)입니다.

```sh
bun run upstream:report          # 측정 기준 이후 상류가 한 일
bun run check:upstream-boundary  # 라이선스가 요구하는 저작권 표기 검사
```

## 감사의 말

레드롭 디자인은 Danila Poyarkov와 OpenPencil 기여자들이 만든 오픈소스 디자인 편집기
[OpenPencil](https://github.com/open-pencil/open-pencil)에서 파생됐습니다. 이 프로젝트의 토대가
된 그들의 작업에 감사합니다.

## 라이선스

레드롭 디자인은 [MIT 라이선스](./LICENSE)로 배포됩니다.

저작권 표기 줄은 법적 식별자이므로 번역하지 않고 원문 그대로 씁니다:

```
Copyright (c) 2026 Danila Poyarkov and OpenPencil contributors
Copyright (c) 2026-present Janghoon Lee (Redrob) and contributors
```

상류 OpenPencil의 저작권 표기는 MIT 라이선스가 요구하는 대로 [LICENSE](./LICENSE)와
[NOTICE](./NOTICE)에 그대로 남겨 두었습니다. `bun run check:upstream-boundary`는 두 표기 중 하나라도
사라지면 빌드를 실패시킵니다.

라이선스는 소프트웨어를 다루고 브랜드는 다루지 않습니다. Redrob 이름과 로고는 이 라이선스로
허여되지 않습니다.
