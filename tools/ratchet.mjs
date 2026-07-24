// Cleanup ratchet - the gate that makes structural debt a failing, tamper-evident check.
// Wired into scripts/check.sh. Reads tools/reference_baseline.json (the tool's memory) and enforces:
//   1. Equal-or-tighten: each metric current==baseline. current>baseline FAILs (regression);
//      current<baseline FAILs asking you to lower the baseline (the ratchet click - an improvement
//      is only banked once it is an explicit, reviewed edit to the baseline).
//   2. No raise vs HEAD: no working-tree baseline value may exceed git HEAD's copy. A session that
//      bumps a number to swallow a regression passes (1) but fails (2), and it cannot reach HEAD
//      without a commit it cannot make - code review is the root of trust.
//   3. Tool pinning + tamper manifest: the installed jscpd matches the pinned version; the detector
//      files exist; check.sh still invokes this ratchet.
// Exit 0 only when fully equal, no raise, version pinned, manifest intact. Otherwise exit 1.
import { readFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const BASELINE_REL = 'tools/reference_baseline.json'
const baseline = JSON.parse(readFileSync(join(REPO_ROOT, BASELINE_REL), 'utf8'))

const failures = []
const tighten = []
const notes = []
const fail = (message) => failures.push(message)

const lineCount = (text) => (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n').length
const fileLines = (rel) => lineCount(readFileSync(join(REPO_ROOT, rel), 'utf8'))

function runDetectorJson(scriptRel) {
  const stdout = execFileSync(process.execPath, [scriptRel, '--json'], {
    cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
  })
  return JSON.parse(stdout)
}

function measureJscpdClones() {
  const bin = join(REPO_ROOT, 'node_modules/.bin/jscpd')
  if (!existsSync(bin)) {
    fail(`jscpd not installed at ${bin} - run npm install at the repo root`)
    return null
  }
  const installed = execFileSync(bin, ['--version'], { encoding: 'utf8' }).match(/(\d+\.\d+\.\d+)/)
  const pinned = baseline.tools.jscpd
  if (!installed || installed[1] !== pinned) {
    fail(`jscpd version ${installed ? installed[1] : 'unknown'} != pinned ${pinned} (baseline.tools.jscpd)`)
    return null
  }
  const outDir = mkdtempSync(join(tmpdir(), 'b3d-jscpd-'))
  try {
    const { path, format, minTokens, ignore } = baseline.jscpd
    const ignoreArgs = ignore ? ['--ignore', ignore] : []
    try {
      execFileSync(bin, [
        join(REPO_ROOT, path), '--format', format, '--min-tokens', String(minTokens),
        ...ignoreArgs, '--reporters', 'json', '--output', outDir, '--silent',
      ], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 })
    } catch {
      // jscpd exits non-zero when duplication exceeds its internal threshold; the JSON report is
      // still written, which is all we read.
    }
    const reportPath = join(outDir, 'jscpd-report.json')
    if (!existsSync(reportPath)) {
      fail('jscpd produced no JSON report')
      return null
    }
    return JSON.parse(readFileSync(reportPath, 'utf8')).statistics.total.clones
  } finally {
    rmSync(outDir, { recursive: true, force: true })
  }
}

// ---------- gather observed values ----------
const css = runDetectorJson('tools/detectors/cleanup-audit-css-detector.mjs')
const metrics = runDetectorJson('tools/detectors/cleanup-audit-metrics.mjs')
const fileSize = runDetectorJson('tools/detectors/file-size-scan.mjs')
const fidelity = runDetectorJson('tools/detectors/catalog-fidelity-detector.mjs')
const storyCov = runDetectorJson('tools/detectors/story-coverage-detector.mjs')
const idMeaning = runDetectorJson('tools/detectors/identifier-meaning-detector.mjs')
const effectGuard = runDetectorJson('tools/detectors/effect-guard-detector.mjs')
const jscpdClones = measureJscpdClones()

const observed = {
  ...css,
  ...metrics,
  ...fidelity,
  ...storyCov,
  ...idMeaning,
  ...effectGuard,
  inline_button: fileSize.inline_button,
  multi_exported_component_tsx: fileSize.multi_exported_component_tsx,
  ...(jscpdClones === null ? {} : { jscpd_clones: jscpdClones }),
}

// ---------- rule 1: equal-or-tighten on each tracked metric ----------
for (const [metric, base] of Object.entries(baseline.metrics)) {
  const current = observed[metric]
  if (current === undefined) {
    fail(`metric "${metric}" was not produced by any detector (detector removed or renamed?)`)
    continue
  }
  if (current > base) fail(`REGRESSION ${metric}: ${current} > baseline ${base}`)
  else if (current < base) tighten.push(`${metric}: lower baseline ${base} -> ${current}`)
}

// ---------- god files: no new over-ceiling, no growth of listed files ----------
const allowlist = baseline.godFiles.allowlist
for (const [file, lines] of Object.entries(fileSize.over_ceiling)) {
  if (!(file in allowlist)) {
    fail(`NEW god file over ceiling: ${file} (${lines} lines) - split it, or (last resort) add to baseline.godFiles.allowlist with maintainer sign-off`)
  }
}
for (const [file, base] of Object.entries(allowlist)) {
  let current
  if (file in fileSize.over_ceiling) current = fileSize.over_ceiling[file]
  else if (existsSync(join(REPO_ROOT, file))) current = fileLines(file)
  if (current === undefined) {
    fail(`allowlisted god file missing: ${file} (deleted? update baseline.godFiles.allowlist)`)
    continue
  }
  if (current > base) fail(`GROWTH ${file}: ${current} > baseline ${base} lines`)
  else if (current < base) {
    const ceiling = file.endsWith('.tsx') ? baseline.godFiles.tsxCeiling : baseline.godFiles.tsCeiling
    const underNote = !file.endsWith('.py') && current <= ceiling ? ' (now under ceiling - delete the key)' : ''
    tighten.push(`god ${file}: lower baseline ${base} -> ${current}${underNote}`)
  }
}

// ---------- rule 2: no working-tree value higher than git HEAD ----------
let headBaseline = null
try {
  headBaseline = JSON.parse(execFileSync('git', ['show', `HEAD:${BASELINE_REL}`], {
    cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  }))
} catch {
  notes.push('baseline not yet committed to HEAD - no-raise-vs-HEAD check skipped this run (engages once the baseline is committed)')
}
if (headBaseline) {
  const compareNoRaise = (workMap, headMap, label) => {
    for (const [key, headVal] of Object.entries(headMap || {})) {
      const workVal = workMap?.[key]
      if (typeof workVal === 'number' && typeof headVal === 'number' && workVal > headVal) {
        fail(`BASELINE RAISED vs HEAD (${label}) ${key}: ${workVal} > HEAD ${headVal} - cannot raise a baseline to absorb a regression`)
      }
    }
  }
  compareNoRaise(baseline.metrics, headBaseline.metrics, 'metrics')
  compareNoRaise(baseline.godFiles?.allowlist, headBaseline.godFiles?.allowlist, 'godFiles')
}

// ---------- rule 3: tamper manifest ----------
for (const detector of baseline.requiredChecks.detectors) {
  if (!existsSync(join(REPO_ROOT, detector))) fail(`required detector missing: ${detector}`)
}
const checkSh = readFileSync(join(REPO_ROOT, 'scripts/check.sh'), 'utf8')
if (!checkSh.includes(baseline.requiredChecks.checkShReferences)) {
  fail(`check.sh no longer invokes ${baseline.requiredChecks.checkShReferences} - the gate was unwired`)
}

// ---------- report ----------
for (const note of notes) console.log(`  note: ${note}`)
if (failures.length === 0 && tighten.length === 0) {
  console.log(`ratchet ok - ${Object.keys(baseline.metrics).length} metrics + ${Object.keys(allowlist).length} god files at baseline`)
  process.exit(0)
}
if (tighten.length) {
  console.error(`\nRatchet: ${tighten.length} improvement(s) not yet banked - lower these in ${BASELINE_REL} (the ratchet click):`)
  for (const message of tighten) console.error(`  - ${message}`)
}
if (failures.length) {
  console.error(`\nRatchet: ${failures.length} failure(s):`)
  for (const message of failures) console.error(`  - ${message}`)
}
process.exit(1)
