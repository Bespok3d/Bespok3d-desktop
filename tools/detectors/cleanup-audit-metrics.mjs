// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Headless audit metrics for the Bespok3d renderer (no deps; node doc/cleanup-audit-metrics.mjs).
// Seeds the gate-able lints proposed in doc/cleanup-audit.md sec 13. Heuristic where noted.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { isExempt, fileExempt, lineOf } from './gate-allow.mjs'

const APP = new URL('../..', import.meta.url).pathname
const SRC = join(APP, 'src/renderer/src')

// Text-free PRIMITIVES render only props/children/data and have NO user-facing prose to localize,
// so a missing t() is correct, not a smell. Counting them as unlocalized is a measurement bug, so
// the detector excludes them by registry (each entry = "renders only props/data, no prose"). A
// component NOT listed here that renders JSX with zero t() is a real unlocalized component and is
// counted. Keep this list honest: only add a component that genuinely emits no prose of its own.
const TEXT_FREE_COMPONENTS = new Set([
  'src/renderer/src/App.tsx', // app shell composition root; renders only child components, no prose of its own
  'src/renderer/src/components/add-printer/AdapterSelect.tsx', // renders adapter records (data), no prose
  'src/renderer/src/components/common/Button.tsx', // renders children + variant props
  'src/renderer/src/components/common/Group.tsx', // wraps children under a caller-supplied title
  'src/renderer/src/components/common/Row.tsx', // layout wrapper for children
  'src/renderer/src/components/common/Segmented.tsx', // renders caller-supplied option labels
  'src/renderer/src/components/common/SettingRow.tsx', // renders caller-supplied label/children
  'src/renderer/src/components/common/Toggle.tsx', // on/off control, no prose
  'src/renderer/src/components/settings/panes/printers/PopoverMenu.tsx', // renders a label/children render-prop + chevron, no prose
  'src/renderer/src/components/common/content/Markdown.tsx', // renders a markdown string prop
  'src/renderer/src/components/common/content/b3d-ref-provider.tsx', // context Provider wrapping children, no prose
  'src/renderer/src/components/create/code-view/highlighted-code.tsx', // renders syntax-highlighted code tokens (data)
  'src/renderer/src/components/create/code-view/json-code.tsx', // renders JSON spans (data), no prose
  'src/renderer/src/components/create/sections/op-chip.tsx', // renders the op string prop as a chip
  'src/renderer/src/components/create/sections/sec-head.tsx', // renders title/blurb/tier props (parent localizes)
  'src/renderer/src/components/plugin-store/config/config-form.tsx', // PanelConfigArea composes PluginConfigSection, no prose
  'src/renderer/src/components/plugin-store/config/field-input.tsx', // renders an input from field props (label/placeholder are props)
  'src/renderer/src/components/plugin-store/safety/SafetyNoticeOverlay.tsx', // resolves a plugin then renders SafetyRecoveryModal, no prose
  'src/renderer/src/components/install-gate/index.tsx', // picks which install-gate dialog the step wants; the prose lives in the dialogs
  'src/renderer/src/components/update-confirm/UpdateConfirmGate.tsx', // resolves the printer + channel prefs then renders UpdateConfirmDialog, no prose of its own
  'src/renderer/src/components/plugin-store/detail/StoreDetailPanel.tsx', // wraps PluginPanel with resolved channel/install props, no prose of its own
  'src/renderer/src/components/common/editable-icon/HueRing.tsx', // SVG hue picker, no prose
  'src/renderer/src/components/common/editable-icon/IconBody.tsx', // renders icon glyph data
  'src/renderer/src/components/common/editable-icon/IconPicker.tsx', // grid of icon glyphs, no prose
  'src/renderer/src/components/common/editable-icon/index.tsx', // composes the editable-icon pieces
  'src/renderer/src/components/common/feedback/PanelSpinner.tsx', // spinner glyph, no prose
  'src/renderer/src/components/common/overlay/Flyout.tsx', // positioned children wrapper
  'src/renderer/src/components/common/overlay/Modal.tsx', // scrim + children wrapper
  'src/renderer/src/components/create/starter-card.tsx', // renders a starter record (data), no prose
  'src/renderer/src/components/header/PrinterAvatar.tsx', // avatar glyph + computed title prop
  'src/renderer/src/data/catalog/index.tsx', // catalog context provider, renders children
  'src/renderer/src/design-system/BrandMark.tsx', // brand SVG, no prose
  'src/renderer/src/design-system/icons/base.tsx', // SVG icon wrapper, no prose
  'src/renderer/src/design-system/icons/hardware.tsx', // SVG icon set, no prose
  'src/renderer/src/design-system/icons/status.tsx', // SVG icon set, no prose
  'src/renderer/src/design-system/icons/actions.tsx', // SVG icon set, no prose
  'src/renderer/src/design-system/icons/navigation.tsx', // SVG icon set, no prose
  'src/renderer/src/design-system/icons/connectivity.tsx', // SVG icon set, no prose
  'src/renderer/src/i18n/context.tsx', // the localizer itself - cannot localize the localizer
])

function walk(dir, pred, acc = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'out', 'dist', 'coverage', 'test'].includes(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, pred, acc)
    else if (pred(p)) acc.push(p)
  }
  return acc
}
const rel = (p) => relative(APP, p)
const comp = (p) => p.endsWith('.tsx') && !p.includes('.test.') && !p.includes('.stories.')
const code = (p) => (p.endsWith('.ts') || p.endsWith('.tsx')) && !p.includes('.test.') && !p.includes('.stories.')
const tsxFiles = walk(SRC, comp)
const codeFiles = walk(SRC, code)
const cssFiles = walk(SRC, (p) => p.endsWith('.css'))
const count = (txt, re) => (txt.match(re) || []).length
const JSON_MODE = process.argv.includes('--json')
const sink = console
const out = (...args) => { if (!JSON_MODE) sink.log(...args) }

// ---------- 1. i18n coverage ----------
out('\n===== 1. i18n COVERAGE =====')
const rendersJsx = (txt) => /return\s*\(?\s*</.test(txt) || /=>\s*\(?\s*</.test(txt)
const noT = []
let tCalls = 0
let textFreeSkipped = 0
for (const f of tsxFiles) {
  const txt = readFileSync(f, 'utf8')
  tCalls += count(txt, /\bt\(/g)
  if (!(rendersJsx(txt) && count(txt, /\bt\(/g) === 0)) continue
  if (TEXT_FREE_COMPONENTS.has(rel(f)) || fileExempt(txt, 'i18n_components_zero_t')) { textFreeSkipped++; continue }
  noT.push(rel(f))
}
out(`t() calls total: ${tCalls}`)
out(`text-free / exempt components skipped: ${textFreeSkipped}`)
out(`JSX-rendering components with ZERO t() (real unlocalized prose): ${noT.length}`)
noT.sort().forEach((f) => out('  ' + f))
// hardcoded label/aria/title/placeholder string literals (not t())
let hardLabels = 0
const hardLabelFiles = new Set()
const labelRe = /(?:aria-label|title|placeholder|label)\s*=\s*(?:"|'|\{")[^"'}]+/g
for (const f of codeFiles) {
  const txt = readFileSync(f, 'utf8')
  const lines = txt.split('\n')
  let hit = 0
  for (const m of txt.matchAll(labelRe)) {
    if (/\{t\(|\{`|\{[a-zA-Z]/.test(m[0])) continue // crude: drop {t(...)} and {expr}
    if (isExempt(lines, lineOf(txt, m.index), 'i18n_hardcoded_labels')) continue
    hit++
  }
  if (hit) { hardLabels += hit; hardLabelFiles.add(rel(f)) }
}
out(`hardcoded aria-label/title/placeholder/label string literals (heuristic): ${hardLabels} in ${hardLabelFiles.size} files`)

// ---------- 2. accessibility inventory ----------
out('\n===== 2. ACCESSIBILITY =====')
const sum = (re) => codeFiles.reduce((n, f) => n + count(readFileSync(f, 'utf8'), re), 0)
const filesWith = (re) => codeFiles.filter((f) => re.test(readFileSync(f, 'utf8'))).map(rel)
out(`onKeyDown/onKeyUp/onKeyPress handlers: ${sum(/on(KeyDown|KeyUp|KeyPress)=/g)} in files: ${filesWith(/on(KeyDown|KeyUp|KeyPress)=/).join(', ') || 'none'}`)
out(`Escape-key handling sites: ${sum(/['"]Escape['"]|key\s*===\s*['"]Esc/g)}`)
const ariaByAttr = {}
for (const f of codeFiles) for (const a of readFileSync(f, 'utf8').match(/aria-[a-z]+/g) || []) ariaByAttr[a] = (ariaByAttr[a] || 0) + 1
out(`aria-* attributes:`, ariaByAttr)
out(`role= attributes: ${sum(/\brole=/g)}; tabIndex: ${sum(/\btabIndex/g)}`)
out(`focus management (.focus()/autoFocus/focus-trap): ${sum(/\.focus\(\)|autoFocus|focusTrap|trapFocus/g)}`)
// onClick on non-button elements (keyboard-inaccessible candidates)
let clickableNonButton = 0
const cnbFiles = new Set()
for (const f of tsxFiles) {
  const txt = readFileSync(f, 'utf8')
  const m = txt.match(/<(div|span|li|tr|td|a|p|h\d)\b[^>]*\bonClick=/g) || []
  if (m.length) { clickableNonButton += m.length; cnbFiles.add(rel(f)) }
}
out(`onClick on non-button elements (div/span/li/a/...): ${clickableNonButton} in ${cnbFiles.size} files`)

// ---------- 3. async-effect race exposure ----------
out('\n===== 3. ASYNC-EFFECT GUARDS =====')
out(`useEffect total: ${sum(/useEffect\(/g)}`)
out(`cleanup returns (return () =>): ${sum(/return\s*\(\)\s*=>/g)}`)
out(`AbortController / isMounted / cancelled / ignore guards: ${sum(/AbortController|isMounted|cancelled|\bignore\b/g)}`)
out(`.then(setX) / await...setX in effects (race candidates):`)
let raceCand = 0
for (const f of codeFiles) {
  const txt = readFileSync(f, 'utf8')
  const n = count(txt, /\.then\(\s*set[A-Z]|\.then\(\(\w*\)\s*=>\s*set[A-Z]/g)
  if (n) { raceCand += n; out(`  ${rel(f)}: ${n}`) }
}
out(`  total .then(setX) sites: ${raceCand}`)
out(`ErrorBoundary present: ${filesWith(/ErrorBoundary|componentDidCatch|getDerivedStateFromError/).join(', ') || 'NONE'}`)

// ---------- 4. CSS token bypass ----------
out('\n===== 4. CSS TOKEN BYPASS =====')
let hex = 0, rgbaHsl = 0, px = 0, varUse = 0
const hexFiles = {}
for (const f of cssFiles) {
  const txt = readFileSync(f, 'utf8')
  const isTokens = f.endsWith('tokens.css')
  const h = count(txt, /#[0-9a-fA-F]{3,8}\b/g)
  const c = count(txt, /\b(rgba?|hsla?|oklch)\(/g)
  px += count(txt, /\b\d+px\b/g)
  varUse += count(txt, /var\(--/g)
  if (!isTokens) { hex += h; rgbaHsl += c; if (h) hexFiles[rel(f)] = h }
}
out(`raw hex colors outside tokens.css: ${hex}`, hexFiles)
out(`rgba/hsl/oklch literals outside tokens.css: ${rgbaHsl}`)
out(`px literals (all css): ${px}; var(--token) uses: ${varUse}`)

// ---------- 5. inline styles + magic timers ----------
// Only STATIC inline styles (every value a literal) are the smell - they belong in a CSS class.
// A DYNAMIC style (any value references a variable/expression/ternary/template) is legitimate React
// (data-driven width, computed color) and is NOT counted. Splitting the two is a detector-correctness
// fix; counting the computed ones was a measurement bug.
const STATIC_STYLE_VALUE = /^(-?\d+(\.\d+)?|'[^'\\]*'|"[^"\\]*"|true|false|null)$/
function balancedObject(text, openIndex) {
  let depth = 0
  let quote = null
  for (let cursor = openIndex; cursor < text.length; cursor++) {
    const char = text[cursor]
    if (quote) { if (char === quote && text[cursor - 1] !== '\\') quote = null; continue }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue }
    if (char === '{') depth++
    else if (char === '}') { depth--; if (depth === 0) return text.slice(openIndex + 1, cursor) }
  }
  return null
}
function splitTopLevel(body) {
  const parts = []
  let depth = 0
  let quote = null
  let current = ''
  for (let cursor = 0; cursor < body.length; cursor++) {
    const char = body[cursor]
    if (quote) { current += char; if (char === quote && body[cursor - 1] !== '\\') quote = null; continue }
    if (char === '"' || char === "'" || char === '`') { quote = char; current += char; continue }
    if ('([{'.includes(char)) depth++
    else if (')]}'.includes(char)) depth--
    if (char === ',' && depth === 0) { parts.push(current.trim()); current = ''; continue }
    current += char
  }
  if (current.trim()) parts.push(current.trim())
  return parts.filter(Boolean)
}
function styleIsStatic(body) {
  const entries = splitTopLevel(body)
  if (entries.length === 0) return false
  return entries.every((entry) => {
    const colon = entry.indexOf(':')
    if (colon === -1) return false // spread {...x} or shorthand -> dynamic
    return STATIC_STYLE_VALUE.test(entry.slice(colon + 1).trim())
  })
}
out('\n===== 5. INLINE STYLES + TIMERS =====')
let inlineStyleStatic = 0
let inlineStyleDynamic = 0
const MARKER = 'style={{'
for (const f of codeFiles) {
  const txt = readFileSync(f, 'utf8')
  const lines = txt.split('\n')
  let at = txt.indexOf(MARKER)
  while (at !== -1) {
    const body = balancedObject(txt, at + MARKER.length - 1)
    if (body !== null && styleIsStatic(body)) {
      if (!isExempt(lines, lineOf(txt, at), 'inline_style')) inlineStyleStatic++
    } else if (body !== null) inlineStyleDynamic++
    at = txt.indexOf(MARKER, at + MARKER.length)
  }
}
const inlineStyle = inlineStyleStatic
out(`inline style={{ ... static (the smell): ${inlineStyleStatic}; dynamic/computed (legit, not counted): ${inlineStyleDynamic}`)
const timers = new Set()
for (const f of codeFiles) for (const m of readFileSync(f, 'utf8').match(/set(?:Timeout|Interval)\([^,]*,\s*(\d{2,})\)/g) || []) timers.add(m.match(/(\d{2,})\)/)[1])
out(`distinct inline setTimeout/Interval ms literals: ${[...timers].sort((a, b) => a - b).join(', ')}`)

out(`\n===== FILES: ${tsxFiles.length} components, ${codeFiles.length} ts(x), ${cssFiles.length} css =====`)

if (JSON_MODE) {
  process.stdout.write(JSON.stringify({
    i18n_components_zero_t: noT.length,
    i18n_hardcoded_labels: hardLabels,
    inline_style: inlineStyle,
  }, null, 2) + '\n')
}
