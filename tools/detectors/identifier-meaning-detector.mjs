// Identifier-meaning detector for the cleanup ratchet (no deps).
//   node doc/codebase-fix/identifier-meaning-detector.mjs           human summary
//   node doc/codebase-fix/identifier-meaning-detector.mjs --json     flat fact for scripts/ratchet.mjs
//
// Closes CLAUDE.md non-negotiable #1 (every identifier carries domain meaning) BEYOND the single-char
// names id-length already bans. A weak identifier tells the reader the type, the position, or nothing -
// never what the thing IS in the domain (lineA/keyB, ev/el/an, str/obj/val). This check is HEURISTIC BY
// DESIGN: a regex scan of declared names, not an AST, so it trades precision for zero deps and a crisp
// definition. The ratchet-down baseline plus a per-site `gate-allow weak_identifiers: <reason>` absorb the
// unavoidable noise; a clear false-positive CLASS is fixed here as an EXCLUSION, never a gate-allow
// (feedback_fix_or_mute_not_handwave / feedback_log_dont_mute). Two such classes are baked in:
//   - axis suffixes X/Y/Z (thumbX, deltaY) - an axis letter IS the domain meaning.
//   - trailing-digit tech tokens (IPv4, mp4, sha256) - the digit is part of a standard name.
//
//   weak_identifiers : declared function parameters + local const/let/var names that carry no domain
//                      meaning, after the two exclusion classes and gate-allow.
//
// SCOPE: .ts/.tsx under src/ (main + renderer + preload), excluding *.test.* / *.stories.*
// / *.d.ts. Inspects ONLY function parameters and single-identifier const/let/var declarations - never
// imports, object-literal keys, type/interface names, JSX props, destructuring patterns, or rest/this.
//
// RATCHET-DOWN, like components_without_story: a new weak identifier raises the count and FAILs the gate;
// a rename lowers it and you bank the drop by lowering the baseline number.
//
// gate-allow: a reviewed exception is exempted in place with `gate-allow weak_identifiers: <reason>` on
// the declaration's line or the nearest preceding non-blank line (doc/codebase-fix/gate-allow.mjs).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isExempt, lineOf } from './gate-allow.mjs'

const APP_SRC = fileURLToPath(new URL('../../src', import.meta.url))

const ROLE_FREE_ABBREV = new Set(['ev', 'el', 'pl', 'ep', 'pr', 'tf', 'lg', 'an', 'en', 'cb'])
const TYPE_ONLY = new Set(['str', 'arr', 'obj', 'num', 'bool', 'val'])
// Trailing-digit names that ARE meaningful tech tokens, excluded from the trailing-digit rule by design.
const TECH_TOKEN_ALLOWLIST = new Set([
  'ipv', 'ipv4', 'ipv6', 'mdns', 'mdns4', 'mdns6', 'mp4', 'md5', 'sha1', 'sha256', 'sha512',
  'utf8', 'utf16', 'base64', 'p256', 'x509', 'h264', 'h265', 'oauth2', 'v1', 'v2', 's3',
])
// Control-flow headers also read as `name(...) {`; their identifier is a keyword, never a parameter.
const KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'do', 'else',
  'await', 'typeof', 'in', 'of', 'case', 'new', 'void', 'yield', 'throw', 'super', 'with',
])

const POSITIONAL_SUFFIX = /^[a-z]{2,}[A-Z]$/
const AXIS_SUFFIX = /[XYZ]$/
const DOUBLED_LETTER = /^([a-z])\1$/
const TRAILING_DIGIT = /^[a-z]{2,}\d$/

// A name is weak when it carries the type, the position, or nothing - never the domain role.
export function isWeakIdentifier(name) {
  if (TECH_TOKEN_ALLOWLIST.has(name.toLowerCase())) return false
  if (POSITIONAL_SUFFIX.test(name) && !AXIS_SUFFIX.test(name)) return true
  if (DOUBLED_LETTER.test(name)) return true
  if (ROLE_FREE_ABBREV.has(name)) return true
  if (TYPE_ONLY.has(name)) return true
  if (TRAILING_DIGIT.test(name) && !TECH_TOKEN_ALLOWLIST.has(name.replace(/\d$/, ''))) return true
  return false
}

// The leading identifier of one comma-split parameter, after stripping its type annotation and default;
// null for a destructuring/rest param (the detector does not descend into patterns).
export function paramName(raw) {
  const trimmed = raw.trim()
  if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('...')) return null
  const match = /^([A-Za-z_$][\w$]*)/.exec(trimmed)
  return match ? match[1] : null
}

const FUNCTION_OR_METHOD = /\b([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*(?::[^={]+)?\{/g
const ARROW = /\(([^)]*)\)\s*(?::[^=>{]+)?=>/g
const DECLARATION = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g

const namesOf = (rawList) => rawList.split(',').map(paramName).filter(Boolean)

// Every declared name worth inspecting, paired with the source index where it appears: each function or
// method parameter (skipping control-flow headers), each arrow parameter, each simple variable name.
export function declaredNames(text) {
  const found = []
  for (const head of text.matchAll(FUNCTION_OR_METHOD)) {
    if (KEYWORDS.has(head[1])) continue
    for (const name of namesOf(head[2])) found.push({ name, index: head.index })
  }
  for (const arrow of text.matchAll(ARROW)) {
    for (const name of namesOf(arrow[1])) found.push({ name, index: arrow.index })
  }
  for (const declaration of text.matchAll(DECLARATION)) found.push({ name: declaration[1], index: declaration.index })
  return found
}

// The weak identifiers in one file, after the exclusion classes and any gate-allow annotation.
export function weakIdentifiersInText(text) {
  const lines = text.split('\n')
  const seen = new Set()
  const hits = []
  for (const { name, index } of declaredNames(text)) {
    if (!isWeakIdentifier(name)) continue
    const line = lineOf(text, index)
    const key = `${name}@${line}`
    if (seen.has(key)) continue
    seen.add(key)
    if (isExempt(lines, line, 'weak_identifiers')) continue
    hits.push({ name, line })
  }
  return hits
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'out', 'dist', 'coverage'].includes(name)) continue
    const full = `${dir}/${name}`
    if (statSync(full).isDirectory()) walk(full, acc)
    else acc.push(full)
  }
  return acc
}

const isInspected = (path) =>
  (path.endsWith('.ts') || path.endsWith('.tsx')) &&
  !path.includes('.test.') && !path.includes('.stories.') && !path.endsWith('.d.ts')

function scan() {
  const files = walk(APP_SRC).filter(isInspected)
  const rel = (path) => relative(APP_SRC, path)
  return files.flatMap((path) =>
    weakIdentifiersInText(readFileSync(path, 'utf8')).map((hit) => ({ file: rel(path), ...hit })))
}

if (process.argv[1] && process.argv[1].endsWith('identifier-meaning-detector.mjs')) {
  const weak = scan()
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify({ weak_identifiers: weak.length }, null, 2) + '\n')
  } else {
    console.log(`weak_identifiers (params + local declarations with no domain meaning): ${weak.length}`)
    for (const hit of weak) console.log(`  ${hit.file}:${hit.line}  ${hit.name}`)
  }
}
