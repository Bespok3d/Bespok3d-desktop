// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Story-coverage detector for the cleanup ratchet (no deps).
//   node doc/codebase-fix/story-coverage-detector.mjs           human summary
//   node doc/codebase-fix/story-coverage-detector.mjs --json     flat fact for scripts/ratchet.mjs
//
// The catalog-driven UI review (doc/catalog-ui-review-program.md) only delivers if components actually
// reach the catalog. This check holds that line. An EXPORTED renderer component is "story-covered" when
// either its name is referenced in any *.stories.tsx (the story imports/renders it) OR a *.stories.tsx
// sits in its own directory (the surface has a story, so the component renders inside it).
//
//   components_without_story : exported renderer components with neither kind of coverage.
//
// This is a RATCHET-DOWN number, not a 0-metric: only the printer surfaces have stories today, so the
// review program lowers it surface by surface. A NEW uncovered component pushes the count UP and FAILs
// the gate, so it must ship with a story or a justified `gate-allow components_without_story: <reason>`
// (e.g. an internal piece always shown via its parent's story, or a component with no catalog value).
//
// gate-allow: a reviewed exception is exempted in place on the export's line or the nearest preceding
// non-blank line (doc/codebase-fix/gate-allow.mjs). A false-positive is a detector-correctness fix.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { topLevelDefs } from './catalog-fidelity-detector.mjs'
import { isExempt } from './gate-allow.mjs'

const RENDERER_SRC = fileURLToPath(new URL('../../src/renderer/src', import.meta.url))
const isComponentName = (name) => /^[A-Z]/.test(name) && /[a-z]/.test(name)
const returnsJsx = (body) => /<[A-Za-z]/.test(body) || /<>/.test(body)
const isStory = (path) => path.endsWith('.stories.tsx')
const isProdComponentFile = (path) => path.endsWith('.tsx') && !path.includes('.test.') && !isStory(path)

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'out', 'dist', 'coverage', 'test'].includes(name)) continue
    const full = `${dir}/${name}`
    if (statSync(full).isDirectory()) walk(full, acc)
    else acc.push(full)
  }
  return acc
}

// The coverage surface drawn from every story: the identifiers a story references (import or render)
// plus the directories that own a story (a surface with a story renders its own components).
export function storyCoverage(stories) {
  const names = new Set()
  const dirs = new Set()
  for (const { rel, text } of stories) {
    dirs.add(dirname(rel))
    for (const token of text.matchAll(/[A-Za-z_$][\w$]*/g)) names.add(token[0])
  }
  return { names, dirs }
}

// The exported components in one production file that no story covers (after gate-allow).
export function uncoveredInText(text, rel, coverage) {
  const lines = text.split('\n')
  const dirCovered = coverage.dirs.has(dirname(rel))
  const uncovered = []
  for (const def of topLevelDefs(text)) {
    if (!def.exported || !isComponentName(def.name) || !returnsJsx(def.body)) continue
    if (dirCovered || coverage.names.has(def.name)) continue
    if (isExempt(lines, def.startLine, 'components_without_story')) continue
    uncovered.push({ name: def.name, line: def.startLine })
  }
  return uncovered
}

function scan() {
  const files = walk(RENDERER_SRC)
  const rel = (path) => relative(RENDERER_SRC, path)
  const stories = files.filter(isStory).map((path) => ({ rel: rel(path), text: readFileSync(path, 'utf8') }))
  const coverage = storyCoverage(stories)
  return files.filter(isProdComponentFile).flatMap((path) =>
    uncoveredInText(readFileSync(path, 'utf8'), rel(path), coverage).map((hit) => ({ file: rel(path), ...hit })))
}

if (process.argv[1] && process.argv[1].endsWith('story-coverage-detector.mjs')) {
  const uncovered = scan()
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify({ components_without_story: uncovered.length }, null, 2) + '\n')
  } else {
    console.log(`components_without_story (exported renderer components with no *.stories.tsx coverage): ${uncovered.length}`)
    for (const hit of uncovered) console.log(`  ${hit.file}:${hit.line}  ${hit.name}`)
  }
}
