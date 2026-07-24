// Catalog-fidelity + no-fakes detector for the cleanup ratchet (no deps).
//   node doc/codebase-fix/catalog-fidelity-detector.mjs           human summary
//   node doc/codebase-fix/catalog-fidelity-detector.mjs --json     flat facts for scripts/ratchet.mjs
//
// Encodes the two prose rules that kept leaking (feedback_no_fakes_in_dev_tools + the handoff
// doc/codebase-fix/reuse-and-fakes-gate.md). A development/showcase tool (the Ladle component
// catalog) earns its value from FIDELITY: it must render the REAL components, never a hand-rolled
// stand-in. A fake in the catalog is "misinformation with a UI", worse than no tool. The rule left
// as prose is the one that bled (a DummyLogModal), so it becomes a check. Two facts, both held at 0:
//
//   stories_fake_component : a component DEFINED inside a *.stories.tsx that stands in for a real one.
//       Two ways to be a stand-in: (1) its NAME carries a stand-in word (Dummy/Fake/Mock/Stub/
//       Placeholder); (2) a non-exported PascalCase helper that returns JSX yet renders ONLY intrinsic
//       markup - it neither forwards {children} (a layout frame) nor renders any PascalCase component
//       (a thin composition of real, imported components). That shape IS a from-scratch fake of a real
//       view. Exported functions ARE the Ladle stories, so they answer only to the name ban; a story
//       legitimately renders local layout wrappers and imported components.
//   prod_standin_component : a Dummy*/Fake* function/const/class DEFINED in non-test, non-stories src.
//       Dummy/Fake never name a real production symbol; this locks "no fakes in shipped code" at 0.
//
// gate-allow: a genuine, reviewed exception is exempted in place with `gate-allow <metric>: <reason>`
// on the def's line or the nearest preceding non-blank line (doc/codebase-fix/gate-allow.mjs). A
// false-positive is a detector-correctness fix, never a gate-allow (feedback_fix_or_mute_not_handwave).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isExempt } from './gate-allow.mjs'

const APP_SRC = fileURLToPath(new URL('../../src', import.meta.url))
const STAND_IN_WORD = /Dummy|Fake|Mock|Stub|Placeholder/
const PROD_STAND_IN_WORD = /Dummy|Fake/
const DEF_HEADER = /^(export\s+)?(?:default\s+)?(?:async\s+)?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/

const isComponentName = (name) => /^[A-Z]/.test(name) && /[a-z]/.test(name)
const returnsJsx = (body) => /<[A-Za-z]/.test(body) || /<>/.test(body)
const rendersChildren = (body) => /\bchildren\b/.test(body)
const rendersComponentTag = (body) => /<\/?[A-Z][A-Za-z0-9]*/.test(body)

// Every top-level (column-0) function/const/class in a file, paired with the source between its header
// and the next top-level header. Helper components and Ladle story exports are all top-level here, so
// this segmentation reads each definition's body without an AST.
export function topLevelDefs(text) {
  const lines = text.split('\n')
  const heads = []
  lines.forEach((line, index) => {
    const match = DEF_HEADER.exec(line)
    if (match) heads.push({ name: match[2], exported: Boolean(match[1]), startLine: index + 1 })
  })
  return heads.map((head, position) => {
    const endLine = position + 1 < heads.length ? heads[position + 1].startLine - 1 : lines.length
    return { ...head, body: lines.slice(head.startLine - 1, endLine).join('\n') }
  })
}

// The stand-in verdict for one definition: null when it is a faithful story/wrapper, else the reason.
function standInReason(def) {
  if (!isComponentName(def.name) || !returnsJsx(def.body)) return null
  if (STAND_IN_WORD.test(def.name)) return 'stand-in name (Dummy/Fake/Mock/Stub/Placeholder)'
  const intrinsicOnly = !def.exported && !rendersChildren(def.body) && !rendersComponentTag(def.body)
  if (intrinsicOnly) return 'renders only intrinsic markup (no children, no real component)'
  return null
}

export function storyFakesInText(text) {
  const lines = text.split('\n')
  const fakes = []
  for (const def of topLevelDefs(text)) {
    const reason = standInReason(def)
    if (reason && !isExempt(lines, def.startLine, 'stories_fake_component')) {
      fakes.push({ name: def.name, line: def.startLine, reason })
    }
  }
  return fakes
}

export function prodStandInsInText(text) {
  const lines = text.split('\n')
  const fakes = []
  for (const def of topLevelDefs(text)) {
    if (PROD_STAND_IN_WORD.test(def.name) && !isExempt(lines, def.startLine, 'prod_standin_component')) {
      fakes.push({ name: def.name, line: def.startLine })
    }
  }
  return fakes
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

const isStory = (path) => path.endsWith('.stories.tsx')
const isProdCode = (path) =>
  (path.endsWith('.ts') || path.endsWith('.tsx')) && !path.includes('.test.') && !isStory(path)

function scan() {
  const files = walk(APP_SRC)
  const rel = (path) => relative(APP_SRC, path)
  const findIn = (paths, finder) =>
    paths.flatMap((path) => finder(readFileSync(path, 'utf8')).map((fake) => ({ file: rel(path), ...fake })))
  return {
    storyFakes: findIn(files.filter(isStory), storyFakesInText),
    prodFakes: findIn(files.filter(isProdCode), prodStandInsInText),
  }
}

if (process.argv[1] && process.argv[1].endsWith('catalog-fidelity-detector.mjs')) {
  const { storyFakes, prodFakes } = scan()
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify({
      stories_fake_component: storyFakes.length,
      prod_standin_component: prodFakes.length,
    }, null, 2) + '\n')
  } else {
    console.log(`stories_fake_component (stand-ins defined in *.stories.tsx): ${storyFakes.length}`)
    for (const fake of storyFakes) console.log(`  ${fake.file}:${fake.line}  ${fake.name} - ${fake.reason}`)
    console.log(`\nprod_standin_component (Dummy*/Fake* defs in shipped src): ${prodFakes.length}`)
    for (const fake of prodFakes) console.log(`  ${fake.file}:${fake.line}  ${fake.name}`)
  }
}
