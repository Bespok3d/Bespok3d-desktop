# tools/ - the standing code-health gate

This directory is the project's **engineering-health ratchet**: a set of zero-dependency Node detectors plus
an orchestrator that fail the build the moment a structural smell regresses. It exists because this codebase
once drifted to ~340 issues while every file looked locally clean, and clawing that back cost about half the
project's commits. The rule the gate encodes: **a rule left as prose bleeds; a rule encoded as a check
holds.**

It is wired into `scripts/check.sh` as part of the always-on floor, so it runs on every `check.sh`
invocation and is never skipped.

> Heading toward a drop-in package: this is being shaped so the whole gate (detectors + baseline + the
> conventions behind it) can be dropped into a fresh repo and give it this quality bar from the start. For
> now it lives here and guards this repo.

## Layout

```
tools/
  README.md                  this file
  ratchet.mjs                the orchestrator: runs every detector, enforces the baseline + anti-tamper rules
  reference_baseline.json    the tool's memory: the accepted level of each metric + the god-file allowlist + tamper manifest
  detectors/
    gate-allow.mjs                  shared reader for the `gate-allow <metric>: <reason>` escape hatch (not a metric itself)
    cleanup-audit-css-detector.mjs  css_cross_file_dup, css_same_file_dup, css_collision_sites, css_important, css_dead_class
    cleanup-audit-metrics.mjs       i18n_components_zero_t, i18n_hardcoded_labels, inline_style
    file-size-scan.mjs              inline_button, multi_exported_component_tsx, and the god-file over-ceiling list
    catalog-fidelity-detector.mjs   stories_fake_component, prod_standin_component
    story-coverage-detector.mjs     components_without_story (ratchet-down)
    identifier-meaning-detector.mjs weak_identifiers (ratchet-down)
    effect-guard-detector.mjs       unguarded_fetch_effects (ratchet-down)
    *.test.ts                       vitest unit tests, co-located with the detector each one pins
```

`jscpd_clones` has no detector file: the ratchet runs `jscpd` (pinned in `reference_baseline.json`) directly.

## Running it

```sh
# the whole gate (this is what check.sh runs)
node tools/ratchet.mjs

# a single detector, two ways:
node tools/detectors/identifier-meaning-detector.mjs          # human-readable list of every hit
node tools/detectors/identifier-meaning-detector.mjs --json   # { "weak_identifiers": N } for the ratchet

# the detector unit tests (run by check.sh's vitest block via the tools/**/*.test.ts glob)
./node_modules/.bin/vitest run tools/detectors/
```

Every detector follows the same shape: pure functions are `export`ed for unit testing, and the filesystem
walk runs only when the file is invoked directly (guarded by
`if (process.argv[1] && process.argv[1].endsWith('<name>.mjs'))`), so importing a detector in a test never
triggers a scan.

## The three anti-tamper rules (enforced by `ratchet.mjs`)

1. **Equal-or-tighten.** Each metric's current count must equal its baseline. `current > baseline` FAILs as
   a regression. `current < baseline` FAILs too, asking you to *lower the baseline* - an improvement is only
   banked once it is an explicit, reviewed edit to `reference_baseline.json` (the "ratchet click").
2. **No raise vs HEAD.** No working-tree baseline value may exceed `git HEAD`'s copy of the file. A session
   that bumps a number to swallow a regression passes rule 1 but fails rule 2, and it cannot reach HEAD
   without a commit. Code review is the root of trust.
3. **Tool pinning + tamper manifest.** The installed `jscpd` must match the pinned version, every detector
   listed in `requiredChecks.detectors` must exist, and `check.sh` must still invoke the ratchet. Deleting a
   detector or unwiring the gate becomes a loud failure rather than a silent one.

## Metrics

Thirteen metrics are held at **0 or a small list of individually justified exceptions**; three are
**ratchet-down** numbers that start high and burn down over time:

| Metric | Held at | Meaning |
| --- | --- | --- |
| `jscpd_clones` | 0 | structural copy-paste clones (production only; tests/stories excluded) |
| `css_cross_file_dup` / `css_same_file_dup` | 0 | duplicated CSS rule blocks |
| `css_collision_sites` | 0 | the same selector defined in conflicting places |
| `css_important` | 0 | `!important` declarations |
| `css_dead_class` | 0 | CSS classes no component references (dynamic classes are resolved, not flagged) |
| `i18n_components_zero_t` | 0 | prose-rendering components that never call `t()` (text-free primitives are registered, not counted) |
| `i18n_hardcoded_labels` | 0 | user-facing string literals that bypass i18n |
| `inline_style` | 0 | static inline `style={{...}}` literals (computed styles are legitimate, not counted) |
| `inline_button` | 0 | raw `<button class="...btn...">` instead of the Button primitive |
| `multi_exported_component_tsx` | 0 | more than one exported React component per `.tsx` |
| `stories_fake_component` | 0 | a hand-rolled stand-in defined inside a `*.stories.tsx` (the catalog must render real components) |
| `prod_standin_component` | 0 | a `Dummy*`/`Fake*` definition in shipped source |
| `components_without_story` | ratchet-down (173) | exported renderer components with no component-catalog story |
| `weak_identifiers` | ratchet-down (19) | params + local declarations that carry no domain meaning (`lineA`, `ev`, `obj`, `arg1`) |
| `unguarded_fetch_effects` | ratchet-down (3) | raw `useEffect` that fetches and sets state with no unmount guard (route through `useAsyncResource`) |

The **god-file ceiling** (`.ts` > 300, `.tsx` > 350 lines) is enforced separately via
`godFiles.allowlist`: a new file over the ceiling, or growth of an allowlisted one, FAILs.

## The escape hatch: `gate-allow`

These checks trigger a **decision zone**, not an absolute ban. When a flagged construct is genuinely correct
and there is no better form, exempt it *in place*:

```ts
const el = scrollRef.current.querySelector(sel) // gate-allow weak_identifiers: DOM element handle, scoped 3-line read
```

on the smell's own line or the nearest preceding non-blank line. **The reason is mandatory** - a bare
`gate-allow <metric>` does not exempt. The detectors count only un-annotated smells, so every exception is
reviewed in the diff where it lives and must survive the question "why is THIS one ok?".

**A false positive is a detector fix, never a gate-allow.** If a detector flags something that is not
actually a smell (a runtime-built class name, a computed style, an axis suffix like `deltaY`, a tech token
like `IPv4`), teach the detector the truth - add the exclusion to the detector. Muting a real smell to drop
a number, or papering over a detector bug with `gate-allow`, is forbidden.

## Adding a metric (the template)

1. Write `tools/detectors/<name>-detector.mjs`, mirroring an existing one: `--json` prints `{ <metric>: N }`,
   bare prints a human list, pure functions are exported, the IO walk is behind the `process.argv[1]` guard,
   and it imports `isExempt` from `./gate-allow.mjs`.
2. Add a co-located `tools/detectors/<name>.test.ts` pinning the flag/exempt behaviour (`import` the detector
   with `./<name>-detector.mjs`).
3. Wire it into `ratchet.mjs`: one `runDetectorJson('tools/detectors/<name>-detector.mjs')` line, spread its
   result into `observed`.
4. In `reference_baseline.json`: add `metrics.<metric>` = the MEASURED current count, add the detector path
   to `requiredChecks.detectors`, and add a one-line `exclusions` note.
5. Prove it is load-bearing: introduce one deliberate violation, confirm `node tools/ratchet.mjs` goes RED,
   then revert.

Keep heuristics conservative. A check that cries wolf trains people to disable it without reading, which
defeats the decision zone it is meant to create.
