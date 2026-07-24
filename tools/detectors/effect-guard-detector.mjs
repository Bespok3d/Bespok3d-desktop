// Effect-guard detector for the cleanup ratchet (no deps).
//   node tools/detectors/effect-guard-detector.mjs           human summary
//   node tools/detectors/effect-guard-detector.mjs --json     flat fact for tools/ratchet.mjs
//
// Closes the CLAUDE.md Resilience rule "unmount-guard every fetching effect". A raw useEffect that
// kicks off an async fetch and writes the result into component state, with NO guard, sets state on a
// component that may already be unmounted when the fetch resolves late (the React "update on unmounted
// component" leak, and stale-response races when deps change faster than the fetch returns). The
// project already ships the cure: useAsyncResource (built on the unmount-safe useAsyncEffect), which
// carries the active-closure guard for you. This check steers new fetching effects onto it.
//
//   unguarded_fetch_effects : raw useEffect callbacks that fetch-and-set with no unmount guard.
//
// HEURISTIC BY DESIGN (regex + a balanced-brace body scan, no AST). An effect is flagged when its
// callback body (a) fetches - window.b3d. / fetch( / .then( / await - AND (b) calls a state setter
// (set[A-Z]...) AND (c) shows no guard: no `return () =>` / `return function` cleanup, no
// AbortController, no active/stale/mounted flag, no returned cleanup variable. Effects already routed
// through useAsyncEffect / useAsyncResource are NOT `useEffect(` calls, so they are naturally excluded.
// Two false-positive CLASSES are fixed here as detector truth, never gate-allowed:
//   - referenced callbacks (`useEffect(fn, deps)`): the inline-body scan is bounded to the useEffect
//     call's own parens, so a downstream arrow is never mistaken for the (absent) inline body.
//   - returned-variable cleanups (`const unsub = ...; return unsub`): a useEffect returns a cleanup
//     function, never data, so returning a body-declared variable is a guard the inline regex misses.
//
// RATCHET-DOWN, like components_without_story and weak_identifiers: a new unguarded fetch effect raises
// the count and FAILs the gate; route it through useAsyncResource (or add a guard) to lower it, and
// bank the drop by lowering the baseline number. The unavoidable noise of a regex heuristic is absorbed
// by the baseline plus a per-site `gate-allow unguarded_fetch_effects: <reason>`; a clear false-positive
// CLASS is fixed here as an exclusion, never gate-allowed (feedback_fix_or_mute_not_handwave).
//
// SCOPE: .ts/.tsx under src/, excluding *.test.* / *.stories.* / *.d.ts.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isExempt, lineOf } from './gate-allow.mjs'

const APP_SRC = fileURLToPath(new URL('../../src', import.meta.url))

// An async data read in the callback body.
const FETCH = /window\.b3d\.|fetch\(|\.then\(|\bawait\b/
// A React state setter call (setFoo(...)).
const STATE_SETTER = /\bset[A-Z]\w*\(/
// The recognised inline unmount guards: a returned cleanup function literal, an AbortController, or a
// liveness flag the body reads before setting state. A returned cleanup VARIABLE is handled separately
// (returnsBodyCleanup) because a regex cannot tell `return unsub` from a bare conditional `return`.
const GUARD = /return\s*\(\s*\)\s*=>|return\s+function|AbortController|\b(?:active|stale|mounted)\b/
// A `return <name>` where <name> is declared in the body: an effect returns a cleanup function, never
// data, so this is the returned-cleanup guard form the inline GUARD regex above does not see.
const RETURN_VARIABLE = /\breturn\s+([A-Za-z_$][\w$]*)\s*(?:;|$)/gm
const USE_EFFECT = /\buseEffect\s*\(/g

// The index of the `)` that closes the call whose `(` sits at openParen, by paren balance.
function callCloseParen(text, openParen) {
  let depth = 0
  for (let cursor = openParen; cursor < text.length; cursor++) {
    if (text[cursor] === '(') depth++
    else if (text[cursor] === ')' && --depth === 0) return cursor
  }
  return -1
}

// The source of an effect callback's block body, given the index just after `useEffect(`. The inline
// callback is `() => {` or `async () => {`; the body is the brace block after the arrow, captured by a
// balanced scan. Returns '' for an expression-bodied callback OR a referenced one (`useEffect(fn, deps)`):
// the callback's arrow must fall inside the useEffect call's own parens, so a downstream arrow belonging
// to unrelated code is never mistaken for the body.
export function extractCallbackBody(text, indexAfterUseEffect) {
  const callEnd = callCloseParen(text, indexAfterUseEffect - 1)
  const arrow = text.indexOf('=>', indexAfterUseEffect)
  if (arrow === -1 || (callEnd !== -1 && arrow > callEnd)) return ''
  let open = arrow + 2
  while (open < text.length && /\s/.test(text[open])) open++
  if (text[open] !== '{') return ''
  let depth = 0
  for (let cursor = open; cursor < text.length; cursor++) {
    if (text[cursor] === '{') depth++
    else if (text[cursor] === '}' && --depth === 0) return text.slice(open + 1, cursor)
  }
  return text.slice(open + 1)
}

// True when the effect returns a variable it declared - a returned cleanup function, which tears down
// the subscription on unmount, so state is never set on an unmounted component.
function returnsBodyCleanup(body) {
  for (const ret of body.matchAll(RETURN_VARIABLE)) {
    if (new RegExp(`\\b(?:const|let|var)\\s+${ret[1]}\\b`).test(body)) return true
  }
  return false
}

// True when an effect callback body fetches, writes state, and carries no unmount guard.
export function isUnguardedFetchEffect(body) {
  if (!body) return false
  if (!FETCH.test(body) || !STATE_SETTER.test(body)) return false
  return !GUARD.test(body) && !returnsBodyCleanup(body)
}

// The unguarded fetch-and-set effects in one file, after any gate-allow annotation.
export function unguardedEffectsInText(text) {
  const lines = text.split('\n')
  const hits = []
  for (const call of text.matchAll(USE_EFFECT)) {
    const body = extractCallbackBody(text, call.index + call[0].length)
    if (!isUnguardedFetchEffect(body)) continue
    const line = lineOf(text, call.index)
    if (isExempt(lines, line, 'unguarded_fetch_effects')) continue
    hits.push({ line })
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
    unguardedEffectsInText(readFileSync(path, 'utf8')).map((hit) => ({ file: rel(path), ...hit })))
}

if (process.argv[1] && process.argv[1].endsWith('effect-guard-detector.mjs')) {
  const unguarded = scan()
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify({ unguarded_fetch_effects: unguarded.length }, null, 2) + '\n')
  } else {
    console.log(`unguarded_fetch_effects (raw useEffect fetch-and-set with no unmount guard): ${unguarded.length}`)
    for (const hit of unguarded) console.log(`  ${hit.file}:${hit.line}`)
  }
}
