// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// File-size + inline-control scan for the cleanup ratchet (no deps).
//   node scripts/file-size-scan.mjs          human summary
//   node scripts/file-size-scan.mjs --json    flat facts for scripts/ratchet.mjs
//
// Emits, rooted at the Bespok3d repo so keys line up with the Python god-file allowlist:
//   over_ceiling : { "<relpath>": lines }  every NON-TEST .ts/.tsx over its ceiling
//                  (.ts > TS_CEILING, .tsx > TSX_CEILING). The ratchet diffs this against
//                  baseline.godFiles.allowlist: a key here but not in the allowlist = a NEW
//                  god file (FAIL); growth of an allowlisted file = FAIL; shrink = tighten.
//   inline_button: count of `<button ... className="...btn...">` opening tags (the 115-and-
//                  climbing inline-control debt), excluding tests + the shared Button primitive.
// The Python god files (packages.py/test_packages.py/routes.py) are line-counted by the ratchet
// directly from the allowlist, since this scan is TS/TSX-only by design.
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isExempt, fileExempt, lineOf } from './gate-allow.mjs'

const REPO_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const APP_SRC = join(REPO_ROOT, 'src')
const TS_CEILING = 300
const TSX_CEILING = 350
const BUTTON_PRIMITIVE = /\/(?:common|design-system)\/Button\.tsx$/

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'out', 'dist', 'coverage'].includes(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, acc)
    else acc.push(full)
  }
  return acc
}

const isCode = (path) => (path.endsWith('.ts') || path.endsWith('.tsx')) && !path.includes('.test.') && !path.includes('.stories.')
const codeFiles = walk(APP_SRC).filter(isCode)
const key = (path) => relative(REPO_ROOT, path)
const lineCount = (text) => (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n').length

// Extract each opening tag fully, honoring brace depth + quotes so `=>` and `>` inside
// `{...}` attribute expressions never end the tag early (the lazy-`>` approach miscounts).
function openingTags(text, tagName) {
  const tags = []
  const opener = new RegExp(`<${tagName}\\b`, 'g')
  let match
  while ((match = opener.exec(text))) {
    let depth = 0
    let quote = null
    let cursor = match.index + match[0].length
    for (; cursor < text.length; cursor++) {
      const char = text[cursor]
      if (quote) {
        if (char === quote) quote = null
        continue
      }
      if (char === '"' || char === "'" || char === '`') quote = char
      else if (char === '{') depth++
      else if (char === '}') depth--
      else if (char === '>' && depth === 0) break
    }
    tags.push({ tag: text.slice(match.index, cursor + 1), index: match.index })
  }
  return tags
}

// The debt is a raw `<button>` carrying the design-system `.btn` CLASS instead of using <Button>.
// `.btn` is a standalone class token, so match `btn` delimited by class boundaries (start/space/quote),
// NOT `\bbtn\b` - a `\b` treats a hyphen as a boundary and wrongly flags unrelated component classes
// (`ei-btn`, `link-btn`, `ps-btn`, `locale-action-btn`) that are not the primitive and cannot become
// <Button> without changing their look. Hyphen/underscore-adjacent `btn` is excluded.
const hasBtnClass = (tag) =>
  /class(?:Name)?\s*=\s*(?:"[^"]*(?<![\w-])btn(?![\w-])[^"]*"|'[^']*(?<![\w-])btn(?![\w-])[^']*'|\{`[^`]*(?<![\w-])btn(?![\w-])[^`]*`\})/.test(tag)

// React's base pattern is one component per file. A PascalCase `export function` in a .tsx is an
// EXPORTED component (hooks are camelCase `useX`, helpers/types are not `export function [A-Z]`); a
// file with more than one EXPORTED component is a kitchen-sink component file, the SoC smell that
// reads as a context-switch (you start on one component and trip over an unrelated one). The metric
// is named multi_exported_component_tsx so it says exactly that: INTERNAL (non-exported) components
// are intentionally not counted, because cohesive private-component co-location is good code and a
// true kitchen-sink file is already caught by the size ceiling. A new file exporting >1 component
// fails the gate unless the baseline is consciously raised.
const exportedComponents = (text) => (text.match(/\bexport\s+(?:default\s+)?function\s+[A-Z]/g) ?? []).length

const overCeiling = {}
const multiComponentFiles = {}
let inlineButton = 0
for (const path of codeFiles) {
  const text = readFileSync(path, 'utf8')
  const lines = lineCount(text)
  const ceiling = path.endsWith('.tsx') ? TSX_CEILING : TS_CEILING
  if (lines > ceiling) overCeiling[key(path)] = lines
  if (path.endsWith('.tsx')) {
    const components = exportedComponents(text)
    if (components > 1 && !fileExempt(text, 'multi_exported_component_tsx')) multiComponentFiles[key(path)] = components
  }
  if (!BUTTON_PRIMITIVE.test(path)) {
    const lines = text.split('\n')
    for (const { tag, index } of openingTags(text, 'button'))
      if (hasBtnClass(tag) && !isExempt(lines, lineOf(text, index), 'inline_button')) inlineButton++
  }
}

const facts = {
  inline_button: inlineButton,
  multi_exported_component_tsx: Object.keys(multiComponentFiles).length,
  over_ceiling: overCeiling,
}

if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify(facts, null, 2) + '\n')
} else {
  const entries = Object.entries(overCeiling).sort((a, b) => b[1] - a[1])
  console.log(`inline <button className="...btn...">: ${inlineButton}`)
  const multi = Object.entries(multiComponentFiles).sort((a, b) => b[1] - a[1])
  console.log(`\n.tsx files exporting >1 component (kitchen-sink smell): ${multi.length}`)
  for (const [path, count] of multi) console.log(`  ${String(count).padStart(3)}  ${path}`)
  console.log(`\nover-ceiling .ts/.tsx (ts>${TS_CEILING}, tsx>${TSX_CEILING}): ${entries.length}`)
  for (const [path, lines] of entries) console.log(`  ${String(lines).padStart(5)}  ${path}`)
}
