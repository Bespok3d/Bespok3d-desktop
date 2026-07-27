# Bespok3d app (Electron + React + TypeScript): instructions for AI assistants

You are working in the Bespok3d desktop app: an Electron main/preload/renderer client (React + Vite)
that discovers Klipper printers over mDNS, enrolls them, and manages plugins through the on-printer
daemon. This file is the contract for any LLM or agent that touches app code. It is this repo's own
rulebook: it holds everything specific to the app, and it stands alone in a bare checkout.

If you are a non-Claude tool, an `AGENTS.md` alongside this file points you here.

> When this repo is checked out inside the Bespok3d workspace, the workspace-root `CLAUDE.md` (the
> universal rules) loads on top of it and both apply. Keep this file self-contained and
> repo-relative: it must still be complete for someone who cloned only this repo.

## Read these first

- `doc/component-inventory.md`: every exported component + hook. **Read it before authoring any UI**
  (rule 0 below). Generated - refresh with `npm run inventory`.
- `project_app_impl.md` (memory, workspace only): the IPC surface, status lifecycle, enrollment flow,
  renderer patterns. Read before touching app code.
- `project_mvp_state.md` (memory, workspace only): module map + adapter contract.
- The Ladle catalog (`npm run catalog`): every component in its states without a real printer. New
  components ship with a co-located `*.stories.tsx`.
- The app↔daemon contract points (IPC / TS↔Python shapes) and the drift test guarding each are mapped
  in `Bespok3d/doc/system-map.md` (workspace only) - read before changing any cross-boundary shape.

## Rule 0 - reuse before you create

Before authoring ANY component, hook, util, or CSS class, search for the one that already exists and
use it. The search is free: `doc/component-inventory.md` + the `common/` and `design-system/`
primitives. Building new requires a justification that the existing thing genuinely did not fit.
Reinvention is a hard-rule violation, not a style nit (`feedback_reuse_before_create`; it cost this
project ~11 days of rework). Backed by jscpd (structural clones) + the inventory-freshness check.

## The app enforcement specifics (eslint, in `eslint.config.mjs`)

The universal principles live in the root file; here is exactly how the app machine-enforces them. Each
is decision-zone: a genuine, assessed exception is an `// eslint-disable-next-line <rule> -- <reason>`,
never a silent skip.

- **`func-style: declaration`** - named functions are `function foo() {}`, never `const foo = () => {}`.
- **`no-restricted-syntax`** bans, each with a message telling you the sanctioned move:
  - **no `let`** (use `const`; `var` only when you truly need mutable, declared at function top).
  - **no `for` / `for-in` / `for-of` / `while` / `do-while`** - the imperative-loop ban is COMPLETE.
    Iterate with higher-order array methods, a stream/async-iterator for large data, or bounded
    recursion. "Recursion over loops" is shorthand: V8/Node/Electron have NO tail-call optimization, so
    do NOT rewrite an unbounded data loop as deep recursion - pick the tool by data shape.
  - **no silent catch** - an empty-body `.catch(() => {})` swallows the rejection. Surface it (route
    through `useAsyncResource`) or log it. The `.catch(() => fallback)` consumed-fallback form is fine.
  - **no async `forEach` / `reduce`** - orchestration disguised as a data combinator (`forEach` never
    awaits; async `reduce` is a callback pyramid). `Promise.all(items.map(async ...))` is the blessed
    concurrent-data idiom and is EXCLUDED on purpose.
  - **no discarded `map` / `filter` result** - a side-effect loop in disguise; use `forEach` for pure
    side effects, or a recursive helper for orchestration.
- **`vars-on-top`** (+ `no-var: off`) - `var` is allowed but must sit at the top of its function.
- **`id-length` min 2**, exceptions `_`, `t` (i18n), `x`, `y` (axes). Single-char names are banned; the
  `weak_identifiers` ratchet (below) closes non-negotiable #1 beyond single-char.
- **`no-nested-ternary`** + **`max-depth: 2`** - non-negotiable #2 (nesting beyond one level). Default
  move at depth ≥ 2: extract a named function, early-return, flatten, or a named lookup for a ternary.
- **`max-lines-per-function`** - **40** for `.ts`, **81** for `.tsx` (the +1 over 80 pays for the
  mandated blank-line-before-return; the logic budget is still ~80). `tests/**/*.ts` are exempt
  (describe/it bodies are grouping containers) but every other rule still holds there.
- **`padding-line-between-statements`** - a blank line before every `return` that follows a statement.
- **`react-hooks/rules-of-hooks: error`**; **`exhaustive-deps: off`** on purpose (the named-callback
  pattern makes deps correct by inspection; do not add a `// eslint-disable` for deps, just verify).

## Macro axis + resilience (the drift the ratchet guards)

- **Rule of three.** 3rd copy of a JSX shape / logic block / constant / className string = extract a
  shared component/hook/util. Before hand-rolling a button/row/modal/chip, use the `common/` or
  `design-system/` primitive (or create it).
- **File-size ceiling.** `.ts` > ~300 / `.tsx` > ~350 lines = more than one responsibility; split into
  sibling files by concern. Many small functions in ONE big file does NOT satisfy "short files".
- **Single source of truth across boundaries.** IPC / app-daemon / TS↔Python shapes are declared once
  and imported or generated, never hand-mirrored; a mirror needs a drift test that fails on divergence.
  See the contract map named under "Read these first".
- **Resilience.** An `ErrorBoundary` wraps `<App>` so a render throw never white-screens (a regression
  test source-asserts `main.tsx` keeps that nesting). Every fetching effect is unmount-guarded - new
  fetching code belongs on **`useAsyncResource`** (the unmount-safe helper), NOT a raw `useEffect(` that
  fetches + sets state (the `unguarded_fetch_effects` ratchet flags that). No silent `.catch`.

## The engineering-health gate (`tools/`)

`tools/ratchet.mjs` (run by `./scripts/check.sh`) holds every health metric vs
`tools/reference_baseline.json` and FAILS the build on any new un-justified smell. Every other repo
self-gates the same way in its own tree. The LAW: every metric sits at 0 or at a list of
individually-justified exceptions; a `gate-allow` carries a MANDATORY reason; a detector
false-positive is fixed IN THE DETECTOR; you may only LOWER a baseline number, and raising one is a
stop-and-ask-the-maintainer event. The app specifics:

- **Held at 0-or-exception (13):** `css_dead_class`, `inline_style` (static literals only), selector
  collisions, `jscpd_clones` (production only; `*.test.*`/`*.stories.*` excluded),
  `i18n_components_zero_t` (text-free primitives registered in `TEXT_FREE_COMPONENTS`), multi-component
  files, over-ceiling god files, `stories_fake_component` + `prod_standin_component` (no
  Dummy/Fake/Mock/Stub stand-ins - `catalog-fidelity-detector.mjs`), and more.
- **Ratchet-DOWN (3), not held at 0:** `components_without_story` (exported renderer components lacking
  a catalog story - a new one ships with a `*.stories.tsx` or a justified gate-allow),
  `weak_identifiers` (identifier-meaning beyond single-char; excludes axis suffixes `X/Y/Z` and
  trailing-digit tech tokens like `mp4`/`sha256`), `unguarded_fetch_effects`. A NEW one RAISES the count
  and FAILs; bank a drop by lowering the baseline number.
- **gate-allow** is `// gate-allow <metric>: <reason>` on the smell's line or the nearest preceding
  non-blank line. Reason mandatory. A detector false-positive (a runtime-built `` `tok-${k}` `` class, a
  computed `style={{ width: pct }}`, a text-free primitive) is fixed IN THE DETECTOR, never gate-allowed.

## Renderer / data / IPC patterns

- **i18n:** all user-facing prose goes through `t()`; the `i18n_components_zero_t` gate catches
  un-localized text-bearing components. `t` is an allowed 1-char identifier.
- **Catalog boundary:** `data/catalog.ts` is the single snake→camel boundary (`indexToPlugins` /
  `payloadToRegistry`) and owns the doc/README/CHANGELOG `?raw` + asset globs. Don't parse index shapes
  elsewhere.
- **Store doc prose is baked at APP build time.** Those globs read `plugins/**/doc/*.md` from the
  sibling tree, so an edited README or CHANGELOG reaches users on the next APP release, never on a
  plugin release. Publishing a plugin does NOT refresh what its store page says.
- **No fakes in dev tools:** the catalog renders REAL components; dummy DATA only at the `window.b3d`
  stub; never hand-roll a stand-in. Fixtures use OBVIOUSLY-fake values (`.example` domains, patterned
  ids) - never Lucio's real LAN addresses/uuids/tokens (`feedback_no_real_values_in_fixtures`).
- Deeper renderer/IPC/enrollment detail: `project_app_impl.md`, `project_mvp_state.md`.

## CSS patterns

- **Modal scroll:** one scrollable child in a flex column - parent `display:flex; flex-direction:column;
  overflow:hidden` + bounded height; scroll target `flex:1; min-height:0; overflow-y:auto`; fixed
  siblings `flex-shrink:0`. Modal max-height = `var(--modal-max-h)` (in `tokens.css`), never `100%`.
- **Modal stacking** is owned by the shared `Modal` scaffold (`common/overlay/modal-stack.ts`): scrims
  get an open-order z-index in `[100,119]` - do NOT hardcode `z-index`. Header (z 120) stays above.
  Guarded by `design-system/z-order.test.ts` + `overlay/modal-stack.test.ts`.

## How to work an app change

1. **Understand first** - read the module + `project_app_impl.md`. Don't invent architecture; if intent
   is unclear, ask one specific question and stop.
2. **Reuse before create** (rule 0) - inventory first.
3. **Scope to a user story**; implement only what it needs (no speculative features).
4. **Write to the rules** above.
5. **Self-review**, then run the gate green: `./scripts/check.sh` (em-dash guard, vitest, eslint,
   tsc, knip, ratchet). It covers this repo only; the daemon and the plugins gate in their own.
6. **Add a regression test** at the layer that would catch the regression, in the same change. A new
   behavior gets a `*.test.ts`; a new component gets a `*.stories.tsx` (keeps the story-coverage
   ratchet from rising).
7. **Keep docs current** - update the relevant memory + `MEMORY.md` pointer if state changed.

## Hard constraints

- **Never run git.** The maintainer commits.
- **Never hand-bump `package.json`** - `release.sh` owns the app version at cut time
  (`feedback_release_sh_owns_version`).
- **Never SSH-mutate a live printer** without explicit per-action authorization (junior/u1jr is the
  free-to-mutate bench - see `feedback_junior_test_bench`). Read-only diagnosis is fine; propose device
  steps and wait.
- **Gate must be green** before a change is done.
- **When unsure, ask one specific question and stop.** The architecture is Lucio's; implement it to the
  rules.
