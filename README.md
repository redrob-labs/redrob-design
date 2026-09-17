# Redrob Design

**English** · [한국어](./README.ko.md)

Redrob Design is a prompt-driven design editor that opens .fig and .pen files and designs by prompt. It reads and writes native `.fig` and `.pen` documents, routes design through the Redrob Code engine, and ships as a programmable toolkit with a headless Vue SDK for building custom editors.

> **Status:** Active development. Usable today, with some rough edges as features evolve.

> Redrob Design is derived from [OpenPencil](https://github.com/open-pencil/open-pencil) (MIT). See [License](#license) and [UPSTREAM.md](./UPSTREAM.md).

![Redrob Design](packages/docs/public/screenshot.png)

## Installation

Download from the releases page, or build the desktop app from source (see [Contributing](#contributing)).

## Connect Redrob

Redrob Design does not hold a workspace key of its own. It reaches Redrob through
the **Redrob Code** engine over ACP, and Code is what signs in to a workspace: run
`redrob providers login --provider redrob`, choose **Connect Redrob**, and approve
the short code it shows in [Redrob Console](https://console.redrob.ai). Design then
uses that connection through the engine.

Console's one-click device flow is not wired into this app directly. If you would
rather not route through the engine at all, **Settings → AI & agents** also takes
your own key for OpenRouter, Anthropic, OpenAI, Google AI, Z.ai, MiniMax or a
compatible endpoint.

## Design by prompt with Redrob Code

Redrob Design routes natural-language design turns through the **Redrob Code** engine, wired as the default Agent Client Protocol (ACP) Design agent. Describe what you want in chat and the engine drives the editor's 90+ design tools to create and modify the scene graph.

If the Redrob Code engine is not installed, the app guides you through installing it (set `REDROB_CODE_BIN` or install the `redrob` CLI), then reconnects the Design agent automatically.

## What it does

- **Opens `.fig` and `.pen` files**: read and write native Figma files, open Redrob Design documents from the app or OS file browser, copy & paste nodes between apps
- **AI builds designs**: describe what you want in chat, 90+ tools create and modify nodes. Route design through the Redrob Code engine, or connect OpenRouter, Anthropic, OpenAI, Google AI, Z.ai, MiniMax, or compatible endpoints
- **Fully programmable**: headless CLI, XPath queries, Figma Plugin API via `eval`, MCP server for AI agents, and desktop agent integrations for Redrob Code and other ACP agents
- **Lint, convert, and extract tokens**: inspect documents, lint naming/layout/accessibility, convert between supported formats, analyze colors/typography/spacing/clusters, and extract design tokens
- **Design tokens & theme library**: import design tokens (DTCG, CSS variables, Tailwind), and the built-in Redrob brand theme/deck library
- **Components and variants**: create reusable components, group variants into component sets, insert local assets as instances, and switch variants from the inspector
- **Image vectorization**: convert image layers into editable vector layers with Recraft or fal.ai
- **Design-to-code export**: export selections as JSX/Tailwind, generate token outputs, and map designs into component-oriented code workflows
- **Vue SDK for custom editors**: headless components and composables for embedding Redrob Design into other apps or building workflow-specific editing surfaces
- **Real-time collaboration**: P2P via WebRTC, no server, no account. Cursors, presence, follow mode
- **Auto layout & CSS Grid**: flex and grid layout via Yoga WASM, with gap, padding, alignment, track sizing
- **Compact desktop app**: Tauri v2 for macOS, Windows, Linux. Also runs in the browser as a PWA

## CLI

```sh
npm install -g @redrob-design/cli
# or: bun add -g @redrob-design/cli
```

### Inspect design files

Browse node trees, search by name or type, dig into properties, all without opening the editor:

```sh
redrob-design tree design.fig
redrob-design find design.pen --type TEXT
redrob-design node design.fig --id 1:23
redrob-design info design.fig
```

```
[0] [page] "Getting started" (0:46566)
  [0] [section] "" (0:46567)
    [0] [frame] "Body" (0:46568)
      [0] [frame] "Introduction" (0:46569)
        [0] [frame] "Introduction Card" (0:46570)
          [0] [frame] "Guidance" (0:46571)
```

### Query with XPath

Use XPath selectors to find nodes by type, attributes, and structure:

```sh
redrob-design query design.fig "//FRAME"                              # All frames
redrob-design query design.fig "//FRAME[@width < 300]"                # Frames under 300px
redrob-design query design.fig "//TEXT[contains(@name, 'Button')]"     # Text with 'Button' in name
redrob-design query design.fig "//*[@cornerRadius > 0]"               # Rounded corners
redrob-design query design.fig "//SECTION//TEXT"                       # Text inside sections
```

### Export

Render to PNG, JPG, WEBP, SVG, `.fig`, or JSX, or export selections/pages as `.fig` and convert whole documents between supported formats:

```sh
redrob-design export design.fig                           # PNG
redrob-design export design.fig -f jpg -s 2 -q 90         # JPG at 2x, quality 90
redrob-design export design.fig -f fig --page "Page 1"    # Export a page as .fig
redrob-design export design.fig -f jsx --style tailwind   # Tailwind JSX
redrob-design export design.fig -f html --css tailwind    # Tailwind HTML fragment
redrob-design export design.fig -f html --html standalone --assets external # HTML + assets
redrob-design convert design.pen output.fig               # Convert between document formats
redrob-design import page.html --css styles.css -o page.fig # HTML/CSS → editable .fig
```

DOM/CSS input flows through `@redrob-design/dom-css`, so HTML, authored CSS, and Tailwind utility CSS can become editable design layers:

```sh
redrob-design import card.html --css card.css -o card.fig
redrob-design import card.html --tailwind "flex flex-col gap-3 w-80 p-6 rounded-xl bg-white" -o card.fig
```

```html
<div className="flex flex-col gap-4 p-6 bg-white rounded-xl">
  <p className="text-2xl font-bold text-[#1D1B20]">Card Title</p>
  <p className="text-sm text-[#49454F]">Description text</p>
</div>
```

### Lint design files

Catch naming, layout, structure, and accessibility issues from the terminal:

```sh
redrob-design lint design.fig
redrob-design lint design.pen --preset strict
redrob-design lint design.fig --rule color-contrast
redrob-design lint design.fig --list-rules
```

### Analyze and extract design tokens

Audit an entire design system from the terminal: find inconsistencies, extract the real palette, and spot components waiting to be extracted:

```sh
redrob-design analyze colors design.fig
redrob-design analyze typography design.fig
redrob-design analyze spacing design.fig
redrob-design analyze clusters design.fig
redrob-design analyze overlaps design.fig
redrob-design variables design.fig
```

```
#1d1b20  ██████████████████████████████ 17155×
#49454f  ██████████████████████████████ 9814×
#ffffff  ██████████████████████████████ 8620×
#6750a4  ██████████████████████████████ 3967×

3771× frame "container" (100% match)
     size: 40×40, structure: Frame > [Frame]

2982× instance "Checkboxes" (100% match)
     size: 48×48, structure: Instance > [Frame]
```

### Script with Figma Plugin API

`eval` gives you the full Figma Plugin API. Modify the file, write it back:

```sh
redrob-design eval design.fig -c "figma.currentPage.children.length"
redrob-design eval design.fig -c "figma.currentPage.selection.forEach(n => n.opacity = 0.5)" -w
```

### Control the running app

When the desktop app is running, omit the file argument: the CLI connects via RPC and operates on the live canvas. Useful for automation scripts, CI pipelines, or AI agents that need to interact with the editor:

```sh
redrob-design tree                               # Inspect the live document
redrob-design export -f png                      # Screenshot the current canvas
redrob-design eval -c "figma.currentPage.name"   # Query the editor
```

All commands support `--json` for machine-readable output.

## AI & MCP

### Built-in chat

Press <kbd>⌘</kbd><kbd>J</kbd> to open the AI assistant. It has 100+ tools that can create shapes, set fills and strokes, manage auto-layout, work with components and variables, run boolean operations, analyze design tokens, and export assets. Design turns route through the Redrob Code engine by default, or bring your own API key for OpenRouter, Anthropic, OpenAI, Google AI, Z.ai, MiniMax, or compatible endpoints. No backend, no account.

### Coding agents (desktop)

Use Redrob Code or other ACP-compatible coding agents directly in the chat panel. The agent connects to the editor's MCP server and uses all 100+ design tools. Requires the desktop app and the agent CLI installed locally.

Pi is also available as an optional AI SDK Harness provider. Install its companion CLI with `npm install -g @redrob-design/harness`, then add a **Pi** model profile in **Settings → AI & agents**. The companion is installed separately so Redrob Design does not bundle a JavaScript runtime for users who do not enable Harness providers.

### MCP server

Connect Claude Code, Cursor, Windsurf, or any MCP client to inspect, modify, and export design documents headlessly. 100+ tools.

**Stdio** (Claude Code, Cursor, Windsurf):

```sh
npm install -g @redrob-design/mcp
claude mcp add --scope user redrob-design -- redrob-design-mcp
```

For other MCP clients:

```json
{
  "mcpServers": {
    "redrob-design": {
      "command": "redrob-design-mcp"
    }
  }
}
```

**HTTP** (scripts, CI):

```sh
redrob-design-mcp-http   # Unix socket on macOS/Linux + http://127.0.0.1:7600/mcp
```

Local clients discover the private Unix socket automatically and fall back to localhost TCP. Set `PORT=0` to disable TCP on macOS/Linux.

**File access:** Set `REDROB_DESIGN_MCP_ROOT` to scope file operations (`open_file`, `new_document`, export `path` param) to a directory. Defaults to the current working directory. (This environment variable name is retained for compatibility with the underlying MCP server.)

## Collaboration

Share a link to co-edit in real time. No server, no account: peers connect directly via WebRTC.

1. Click the share button in the top-right panel
2. Share the generated link (`app.redrob.design/share/<room-id>`)
3. Collaborators see your cursor, selection, and edits in real time
4. Click a peer's avatar to follow their viewport

## Contributing

### Setup

```sh
bun install
bun run dev:portless  # Web editor at https://redrob-design.localhost
bun run dev           # Direct Vite server at http://localhost:1420
bun run tauri dev     # Desktop app (requires Rust)
```

The first Portless run creates and trusts a local HTTPS certificate. Linked Git worktrees automatically receive branch-prefixed URLs such as `https://fix-ui.redrob-design.localhost`, so concurrent development servers do not compete for port 1420. Their development MCP bridges are exposed through matching sibling URLs such as `https://fix-ui.mcp.redrob-design.localhost`, with isolated TCP ports and runtime socket files. Run `bunx portless doctor` if local routing or certificate trust fails.

### Quality gates

| Command             | Description           |
| ------------------- | --------------------- |
| `bun run check`     | Lint + typecheck      |
| `bun run test`      | E2E visual regression |
| `bun run test:unit` | Unit tests            |
| `bun run format`    | Code formatting       |

### Project structure

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

### Tech stack

| Layer         | Tech                                                                              |
| ------------- | --------------------------------------------------------------------------------- |
| Rendering     | Skia (CanvasKit WASM)                                                             |
| Layout        | Yoga WASM (flex + grid via [fork](https://github.com/open-pencil/yoga/tree/grid)) |
| UI            | Vue 3, Reka UI, Tailwind CSS 4                                                    |
| File format   | Kiwi binary + Zstd + ZIP                                                          |
| Collaboration | Trystero (WebRTC P2P) + Yjs (CRDT)                                                |
| Desktop       | Tauri v2                                                                          |
| AI/MCP        | Redrob Code engine (ACP), multi-provider (Anthropic, OpenAI, Google AI, OpenRouter), MCP SDK, Hono |

### Desktop builds

Requires [Rust](https://rustup.rs/) and platform-specific prerequisites ([Tauri v2 guide](https://v2.tauri.app/start/prerequisites/)).

```sh
bun run tauri build
```

## Upstream

Redrob Design is a port, not a git fork: it shares no commit ancestry with
OpenPencil, so upstream work is taken file by file rather than merged. The commit
this tree was measured against, how it was measured, and the sync procedure are in
[UPSTREAM.md](./UPSTREAM.md); the machine-readable record is
[upstream-base.json](./upstream-base.json).

```sh
bun run upstream:report          # what upstream did since our measured base
bun run check:upstream-boundary  # the attribution the licence requires
```

## Acknowledgments

Redrob Design is derived from [OpenPencil](https://github.com/open-pencil/open-pencil), an open-source design editor created by Danila Poyarkov and the OpenPencil contributors. We are grateful for their work, which forms the foundation of this project.

## License

Redrob Design is licensed under the [MIT License](./LICENSE).

Copyright (c) 2026-present Janghoon Lee (Redrob) and contributors.

Redrob Design is derived from OpenPencil, which is also MIT licensed:

Copyright (c) 2026 Danila Poyarkov and OpenPencil contributors.

The original OpenPencil copyright notice is retained in the [LICENSE](./LICENSE) and [NOTICE](./NOTICE) files as required by the MIT License. `bun run check:upstream-boundary` fails the build if either notice is ever removed.

The licence covers the software, not the brand: the Redrob name and logos are not licensed under it.
