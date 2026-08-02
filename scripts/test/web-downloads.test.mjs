// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The landing page's download buttons are generated, and the only thing standing between a released
// version and four dead links is this generator. It used to live inside release.sh as a heredoc,
// where nothing could run it on its own. This runs it against a page shaped like the real one and
// proves it rewrites the block and the shown version, changes nothing on a second run, and stops
// rather than guessing when the page and the generator disagree about the markers.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GENERATOR = join(REPO_ROOT, 'scripts', 'update-web-downloads.mjs')
const PUBLISH_REPO = 'Bespok3d/Bespok3d-desktop'

const PAGE_SHAPE = `<html>
  <body>
    <p>Bespok3d <b id="rel-version">0.0.0-old</b></p>
    <div>
      <!-- downloads:start -->
      <ul class="dl-list" id="dl-list" aria-label="Download Bespok3d"></ul>
      <!-- downloads:end -->
    </div>
  </body>
</html>
`

function pageAt(html) {
  const path = join(mkdtempSync(join(tmpdir(), 'b3d-web-')), 'index.html')
  writeFileSync(path, html)

  return path
}

// The build directory is deliberately one that holds nothing: an unbuilt platform is a warning, never
// a refusal, because the page is pointed at a release and not at this host's dist/.
function generateInto(page, version) {
  const attempt = spawnSync('node', [GENERATOR, page, version, join(tmpdir(), 'no-such-build-dir'), PUBLISH_REPO], {
    encoding: 'utf8',
  })

  return { ...attempt, page: readFileSync(page, 'utf8') }
}

test('the buttons point at every installer of the version, and the page says that version', () => {
  const page = pageAt(PAGE_SHAPE)
  const generated = generateInto(page, '0.7.0-beta')

  assert.equal(generated.status, 0, generated.stderr)
  assert.match(generated.page, /<b id="rel-version">0\.7\.0-beta<\/b>/)
  const base = `https://github.com/${PUBLISH_REPO}/releases/download/v0.7.0-beta`
  assert.match(generated.page, new RegExp(`href="${base}/Bespok3d-0\\.7\\.0-beta-arm64\\.dmg"`))
  assert.match(generated.page, new RegExp(`href="${base}/Bespok3d-Setup-0\\.7\\.0-beta\\.exe"`))
  assert.match(generated.page, new RegExp(`href="${base}/Bespok3d-0\\.7\\.0-beta\\.AppImage"`))
  assert.match(generated.page, new RegExp(`href="${base}/Bespok3d-0\\.7\\.0-beta-arm64\\.AppImage"`))
})

test('running it again on a page it already wrote changes nothing', () => {
  const page = pageAt(PAGE_SHAPE)
  const once = generateInto(page, '0.7.0-beta')
  const twice = generateInto(page, '0.7.0-beta')

  assert.equal(twice.page, once.page)
  assert.match(twice.stdout, /Already pointing at 0\.7\.0-beta/)
})

test('a page without the markers is refused rather than half written', () => {
  const page = pageAt('<html><body>no markers here</body></html>\n')
  const generated = generateInto(page, '0.7.0-beta')

  assert.notEqual(generated.status, 0)
  assert.equal(generated.page, '<html><body>no markers here</body></html>\n')
})
