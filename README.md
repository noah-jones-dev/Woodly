# Woodly

**Imagine it. Design it. Build it.**

Woodly is a cross-platform desktop app (Tauri 2 + React + TypeScript) that turns an idea — *"a floating shelf above my desk"* — into an IKEA-style build manual: dimensioned drawings, an interactive 3D model, a cut list with optimized cutting layouts, a shopping list, tool guidance, and step-by-step illustrated instructions. It also teaches you woodworking as you build.

## Running it

```bash
npm install
npm run dev          # browser-only dev mode at http://localhost:1420 (no keychain, no SQLite)
npm run tauri dev    # full desktop app
npm run tauri build  # installers for the current OS
npm test             # engine + AI pipeline tests (vitest)
cd src-tauri && cargo test   # Rust tests
```

The desktop build needs Rust and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

Woodly works **offline** with five built-in parametric templates. To design anything, connect an AI provider in **Settings → AI providers** (bring your own key: Anthropic, OpenAI or Google Gemini). Provider usage is billed by the provider.

## The core idea: the AI writes a spec, the engine builds everything else

```
idea ──▶ AI: clarifying questions ──▶ AI: Project Spec (JSON) ──▶ schema check (zod)
                                              ▲                        │
                                              └──── repair (≤ 2×) ◀────┤ engine validation
                                                                       ▼
          deterministic engine ──▶ geometry ──▶ cut list ──▶ cut optimizer ──▶ shopping list
                                       └──▶ SVG drawings · 3D model · step diagrams · PDF manual
```

The AI never draws pictures or does the arithmetic that matters. It writes a **parametric specification** (`src/engine/spec.ts`) in which every size and position is an **expression over named parameters**:

```json
{ "id": "D1", "name": "Shelf", "material": "board", "grain": "x",
  "size": { "x": "innerW", "y": "depth", "z": "t" },
  "positions": [{ "x": "t", "y": 0, "z": "kick + t + (i + 1)*gap - t/2" }],
  "repeat": { "count": "shelves" } }
```

Changing `width` from 48 to 60 re-evaluates every expression, so the drawings, 3D model, cut list, cutting layout and shopping list update together and stay consistent. That's why "make the desk 12 inches wider" is handled instantly and deterministically (see `parseQuickEdit`). Only edits that change the *structure* go back to the AI.

### Engine (`src/engine/`)
| File | What it does |
|---|---|
| `spec.ts` | The Project Spec schema (zod). Single source of truth for a project. |
| `expr.ts` | Safe arithmetic evaluator (recursive-descent parser, no `eval`), dependency-ordered derived values, cycle detection. |
| `resolve.ts` | Evaluates a spec into concrete boxes; derives each part's thickness / width / length from stock and grain. |
| `materials.ts` | Stock library with **actual** lumber sizes (a 2x4 is 1½" × 3½"), sheet goods, hardware and supplies, with rough prices. |
| `cutlist.ts` | Cut list + optimizer: first-fit-decreasing for boards (tries every sold length, picks the cheapest), guillotine shelf packing for sheets (downsizes to 2×4 / 4×4 ft panels when possible). Accounts for saw kerf. |
| `shopping.ts` | Shopping list from the cut plan: whole boards/sheets, hardware merged and rounded up to packs. |
| `validate.ts` | The validation layer (below). |

### Validation layer
AI output is treated as a proposal. Before a design is presented as buildable, Woodly checks: expressions evaluate; sizes are positive; every part matches real stock thickness, width and length; parts don't pass through each other (unless a dado/rabbet/mortise joint says so); every part is connected to the assembly; declared joints actually touch; every part is installed by exactly one step in a buildable order; referenced hardware and tools exist. It also runs tip-over and shelf-sag heuristics (labeled as unverified estimates) and flags electrical, plumbing, gas, structural and elevated work for a professional. Results: **ok / review / blocked**.

## AI integration (`src/ai/`)
- **Providers are modular.** `AIProvider` is a small interface; adding one to `PROVIDERS` makes it appear in Settings. Anthropic uses the official SDK; OpenAI and Gemini use their REST APIs.
- **Task routing.** Text, reasoning, blueprint and vision tasks can each use a different provider and model.
- **Keys never touch JavaScript in the desktop app.** Keys are stored in the OS credential manager (Keychain, Windows Credential Manager, Secret Service). All AI HTTP goes through the Rust `ai_fetch` command, which injects the key and **refuses any URL other than that provider's official HTTPS host**. The webview's CSP allows only IPC, so the UI cannot reach the network on its own.
- Browser dev mode (`npm run dev`) has no keychain; keys live in `sessionStorage` for that tab only. It's for development.

## Storage
Local-first. The desktop app uses SQLite (`tauri-plugin-sql`, migrations in `src-tauri/src/lib.rs`); the browser dev mode uses localStorage. Both sit behind one `Repo` interface (`src/data/repo.ts`). Every design change is saved as a new version you can restore.

## App structure
- **Home** — prompt box, continue building, beginner projects, learning progress.
- **Create** — describe an idea and/or attach up to 4 photos (a piece you like, a sketch, the space it goes in) → clarifying questions → generation (with live repair progress) or template. Photos are read by the **Vision** route into an editable written brief, which the blueprint model designs from — so the spec model never needs image support, and you can correct what the AI saw (e.g. estimated sizes) before generating. Large photos are downscaled in the browser before upload.
- **Project workspace** — left: navigation + steps; center: Overview, Blueprints (front/side/top, isometric, exploded, part diagrams), 3D Model (rotate, explode, hide parts), Cut List (+ cutting layouts), Materials (checklist, CSV export, material swap), Tools (owned/missing, substitutions), Instructions, Notes (+ photos); right: Design (parameter sliders and revisions), Checks, project-aware Assistant (with photo upload).
- **Build Mode** — full-screen, one step at a time, arrow keys.
- **Manual / PDF** — printable manual; *Print → Save as PDF*.
- **Learn**, **Tool Library** (your tool inventory), **Materials Library**, **AI Assistant**, **Settings**.

## Known limitations / next steps
- Parts are axis-aligned boxes. Angled parts, curves and real joinery geometry (dado depth, tenons) are described in notes but not modeled yet.
- Structural checks are rules of thumb, not engineering analysis.
- Prices are rough US estimates; the stock library uses US lumber sizes (metric is a display conversion).
- Concept "illustrations" are rendered from Woodly's own geometry. Image-generation providers could plug into the same provider interface.
- OpenAI/Gemini adapters are written against their public REST APIs but haven't been exercised against live keys in this repo's tests (the pipeline is tested with a fake provider).
