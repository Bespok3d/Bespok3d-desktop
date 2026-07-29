// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import postcss from '../../node_modules/postcss/lib/postcss.mjs'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const JSON_MODE = process.argv.includes('--json')
const log = (...args) => { if (!JSON_MODE) console.log(...args) }
const APP = new URL('../..', import.meta.url).pathname
const SRC = join(APP, 'src/renderer/src')

function walk(dir, pred, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (name === 'node_modules' || name === 'out' || name === 'dist' || name === 'coverage') continue
    const st = statSync(p)
    if (st.isDirectory()) walk(p, pred, acc)
    else if (pred(p)) acc.push(p)
  }
  return acc
}

const cssFiles = walk(SRC, (p) => p.endsWith('.css'))
const tsxFiles = walk(SRC, (p) => (p.endsWith('.tsx') || p.endsWith('.ts')) && !p.includes('.test.') && !p.includes('.stories.'))

function specificity(sel) {
  let s = sel
  const pseudoEls = (s.match(/::[a-z-]+/gi) || []).length
  s = s.replace(/::[a-z-]+/gi, ' ')
  const pseudoClasses = (s.match(/:[a-z-]+(\([^)]*\))?/gi) || []).length
  s = s.replace(/:[a-z-]+(\([^)]*\))?/gi, ' ')
  const ids = (s.match(/#[\w-]+/g) || []).length
  const classes = (s.match(/\.[\w-]+/g) || []).length
  const attrs = (s.match(/\[[^\]]*\]/g) || []).length
  s = s.replace(/[#.][\w-]+/g, ' ').replace(/\[[^\]]*\]/g, ' ')
  const types = (s.match(/\b[a-z][\w-]*\b/gi) || []).length
  return [ids, classes + attrs + pseudoClasses, types + pseudoEls]
}
const specKey = (sp) => sp[0] * 10000 + sp[1] * 100 + sp[2]

function keyClasses(sel) {
  const parts = sel.trim().split(/[\s>+~]+/).filter(Boolean)
  const last = parts[parts.length - 1] || ''
  return new Set((last.match(/\.[\w-]+/g) || []).map((c) => c.slice(1)))
}
function allClassTokens(sel) {
  return new Set((sel.match(/\.[\w-]+/g) || []).map((c) => c.slice(1)))
}

const rules = []
for (const f of cssFiles) {
  const css = readFileSync(f, 'utf8')
  let root
  try { root = postcss.parse(css, { from: f }) } catch { continue }
  root.walkRules((rule) => {
    if (rule.parent && rule.parent.type === 'atrule' && /keyframes/i.test(rule.parent.name)) return
    const decls = []
    rule.walkDecls((d) => decls.push({ prop: d.prop.toLowerCase(), value: d.value, line: d.source.start.line }))
    const selList = rule.selectors || [rule.selector]
    const grouped = selList.length > 1
    const conditional = rule.parent && rule.parent.type === 'atrule' && /^(media|supports|container)$/i.test(rule.parent.name)
    for (const sel of selList) {
      const sp = specificity(sel)
      rules.push({
        file: relative(APP, f), line: rule.source.start.line,
        selector: sel.trim(), spec: sp, specK: specKey(sp),
        keyCls: keyClasses(sel), allCls: allClassTokens(sel), decls, grouped, conditional,
      })
    }
  })
}

const bySelector = new Map()
for (const r of rules) {
  const k = r.selector.replace(/\s+/g, ' ')
  if (!bySelector.has(k)) bySelector.set(k, [])
  bySelector.get(k).push(r)
}
log('\n========== 1. EXACT DUPLICATE SELECTORS (>=2 definitions) ==========')
// SAME-FILE: only count STANDALONE re-opens of a selector (two single-selector rule blocks for the
// identical selector that should be one). Idiomatic cascade authoring is NOT a duplicate: a selector
// that recurs once inside a shared comma-GROUP (base props for several siblings) plus a standalone
// rule (its own specifics) is the base+specific idiom; a selector re-declared inside a CONDITIONAL
// at-rule (@media/@supports/@container) is a responsive override. Both are legitimate, so an
// occurrence that is grouped or conditional does not count toward the standalone re-open tally.
const dupCross = [], dupSame = []
for (const [sel, rs] of bySelector) {
  const files = new Set(rs.map((r) => r.file))
  if (files.size > 1) { if (rs.length >= 2) dupCross.push([sel, rs]); continue }
  const standalone = rs.filter((r) => !r.grouped && !r.conditional)
  if (standalone.length >= 2) dupSame.push([sel, standalone])
}
log(`\n--- CROSS-FILE duplicate selectors (${dupCross.length}) [cascade decided by import order] ---`)
for (const [sel, rs] of dupCross.sort((a, b) => b[1].length - a[1].length)) {
  const props = rs.map((r) => new Set(r.decls.map((d) => d.prop)))
  const collide = new Set()
  for (let i = 0; i < props.length; i++) for (let j = i + 1; j < props.length; j++)
    for (const p of props[i]) if (props[j].has(p)) collide.add(p)
  log(`  "${sel}"  @ ${rs.map((r) => r.file + ':' + r.line).join('  |  ')}`)
  if (collide.size) log(`      both set: ${[...collide].join(', ')}`)
}
log(`\n--- SAME-FILE duplicate selectors (${dupSame.length}) ---`)
for (const [sel, rs] of dupSame.sort((a, b) => b[1].length - a[1].length).slice(0, 50)) {
  log(`  "${sel}"  @ ${rs.map((r) => r.file + ':' + r.line).join(', ')}`)
}

const elements = new Set()
const reCN = /class(?:Name)?\s*=\s*(?:"([^"]+)"|'([^']+)'|\{`([^`$]+)`\})/g
for (const f of tsxFiles) {
  const txt = readFileSync(f, 'utf8')
  let m
  while ((m = reCN.exec(txt))) {
    const cls = (m[1] || m[2] || m[3] || '').trim().split(/\s+/).filter(Boolean)
    if (cls.length) elements.add(cls.sort().join(' '))
  }
}
log(`\n========== 2. CROSS-FILE EQUAL-SPEC COLLISIONS ON A REAL ELEMENT ==========`)
// A collision is two classes on ONE element setting the same property at equal specificity. The
// synthesized "element" is a single node's className set (no DOM, so no ancestor context). A
// DESCENDANT rule (`.wb-drop-text .mono`) only styles a `.mono` node that lives INSIDE a
// `.wb-drop-text` ancestor - a DIFFERENT node the synthesized set cannot vouch for. Matching such a
// rule by its last compound alone (`keyCls`) wrongly treats every `.X .mono` as applying to every
// bare-`mono` element, so two mutually-exclusive contexts (`.wb-drop-text .mono` vs
// `.wb-file-name .mono`, distinct ancestors that never co-occur on one node) read as a clash. They
// never clash. Correctness fix: a rule applies to the element only when its ENTIRE selector's classes
// (`allCls`, ancestors included) are satisfiable by the element's own classes. A descendant rule whose
// ancestor is absent is excluded; a genuine same-element compound (`.ap-tag.ap-tag-added`) still
// matches both classes, so real collisions are preserved.
const collisions = []
for (const el of elements) {
  const have = new Set(el.split(' '))
  const matching = rules.filter((r) => r.keyCls.size > 0 && [...r.allCls].every((c) => have.has(c)))
  if (matching.length < 2) continue
  const byProp = new Map()
  for (const r of matching) for (const d of r.decls) {
    if (!byProp.has(d.prop)) byProp.set(d.prop, [])
    byProp.get(d.prop).push({ r, value: d.value })
  }
  for (const [prop, contribs] of byProp) {
    if (contribs.length < 2) continue
    const maxK = Math.max(...contribs.map((c) => c.r.specK))
    const top = contribs.filter((c) => c.r.specK === maxK)
    const topFiles = new Set(top.map((c) => c.r.file))
    const topVals = new Set(top.map((c) => c.value))
    if (top.length >= 2 && topFiles.size >= 2 && topVals.size >= 2) collisions.push({ el, prop, top })
  }
}
const seen = new Set()
for (const c of collisions) {
  const k = c.el + '|' + c.prop + '|' + c.top.map((t) => t.r.file + t.r.line).sort().join()
  if (seen.has(k)) continue
  seen.add(k)
  log(`\n  element class="${c.el}"`)
  log(`    property "${c.prop}" set at equal specificity by rules in ${new Set(c.top.map((t) => t.r.file)).size} files:`)
  for (const t of c.top) log(`      ${t.r.file}:${t.r.line}  "${t.r.selector}" -> ${c.prop}: ${t.value}  [spec ${t.r.spec.join(',')}]`)
}
if (!seen.size) log('  (none detected with the subset heuristic)')

log(`\n========== 3. !important USAGE ==========`)
let impCount = 0
for (const f of cssFiles) {
  const css = readFileSync(f, 'utf8')
  css.split('\n').forEach((ln, i) => { if (/!important/.test(ln)) { log(`  ${relative(APP, f)}:${i + 1}  ${ln.trim()}`); impCount++ } })
}
log(`  total !important: ${impCount}`)

const usedTokens = new Set()
const reAny = /[A-Za-z][\w-]*/g
for (const f of tsxFiles) {
  const txt = readFileSync(f, 'utf8')
  let mm; while ((mm = reAny.exec(txt))) usedTokens.add(mm[0])
}

// A class built at runtime (`tok-${kind}`, `'tint-' + tint`, `'wb-stage-badge s' + stage`) never
// appears as a whole token in source, so the literal-token scan above wrongly reads it as dead.
// Teach the detector the dynamic PREFIXES used to construct className strings (the correctness fix:
// these classes ARE used, just assembled). A dead candidate is reclassified as dynamic iff it starts
// with a discovered prefix AND that prefix ends with `-` (a kebab boundary, e.g. `tok-`/`state-`/`tint-`)
// OR the remainder is purely numeric (an index suffix, e.g. `s` + `1`). This precisely models how the
// class is assembled and will NOT mask a genuinely dead class like `.summary` (prefix `s`, remainder
// `ummary`). New genuinely-dead classes still surface.
const dynamicPrefixes = new Set()
for (const f of tsxFiles) {
  const txt = readFileSync(f, 'utf8')
  for (const m of txt.matchAll(/className=\{`([^`]*)`\}/g))
    for (const inner of m[1].matchAll(/([\w-]+)\$\{/g)) dynamicPrefixes.add(inner[1])
  for (const m of txt.matchAll(/className=\{?\s*['"`]([^'"`]*)['"`]\s*\+/g)) {
    const trailing = m[1].match(/[\w-]+$/)
    if (trailing) dynamicPrefixes.add(trailing[0])
  }
}
const isDynamicallyConstructed = (cls) => [...dynamicPrefixes].some(
  (prefix) => cls.startsWith(prefix) && (prefix.endsWith('-') || /^\d+$/.test(cls.slice(prefix.length))),
)
const cssTokens = new Map()
for (const r of rules) for (const t of r.allCls) {
  if (!cssTokens.has(t)) cssTokens.set(t, [])
  cssTokens.get(t).push(`${r.file}:${r.line}`)
}
const unusedTokens = [...cssTokens.keys()].filter((t) => !usedTokens.has(t)).sort()
const dynamicConstructed = unusedTokens.filter(isDynamicallyConstructed)
const dead = unusedTokens.filter((t) => !isDynamicallyConstructed(t))
log(`\n  dynamic-prefix registry (from className construction): ${[...dynamicPrefixes].sort().join(', ')}`)
log(`  reclassified as dynamically-constructed (not dead): ${dynamicConstructed.join(', ') || 'none'}`)
log(`\n========== 4. POTENTIALLY DEAD CLASS SELECTORS (${dead.length}) ==========`)
for (const t of dead) log(`  .${t}  @ ${[...new Set(cssTokens.get(t))].slice(0, 3).join(', ')}`)

log(`\n===== SUMMARY: ${cssFiles.length} css files, ${rules.length} rules, ${dupCross.length} cross-file dup, ${dupSame.length} same-file dup, ${seen.size} collision sites, ${impCount} !important, ${dead.length} dead-class candidates =====`)

if (JSON_MODE) {
  process.stdout.write(JSON.stringify({
    css_cross_file_dup: dupCross.length,
    css_same_file_dup: dupSame.length,
    css_collision_sites: seen.size,
    css_important: impCount,
    css_dead_class: dead.length,
  }, null, 2) + '\n')
}
