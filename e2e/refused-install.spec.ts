import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import AdmZip from 'adm-zip'
import { packagedBinary, appEnv, rendererWindow } from './app-launch'
import { startStubDaemon } from './stub-daemon'
import type { StubDaemon } from './stub-daemon'
import { EXPECTED_DAEMON_VERSION } from '../src/main/daemon-client/version'
import { buildLocalIndex } from '../src/main/registry/local/build-index'
import type { StoredManifest } from '../src/main/registry/local/b3-manifest'

// Proves the app actually refuses a package end to end: real packaged app, real verify-package.ts in
// the loop, a sideloaded .b3 carrying a signature openpgp cannot even parse. No daemon is involved -
// verifiedPackageTrust() runs strictly before any daemon call, so the refusal happens before anything
// would be installed on a printer. Off the default check.sh gate; runs via ./scripts/check.sh e2e.

// The exact malformed-signature literal verify-package.test.ts uses: fails to parse against every
// anchor in TRUSTED_PACKAGE_ANCHORS deterministically, without needing a real openpgp.generateKey().
const MALFORMED_SIGNATURE = '-----BEGIN PGP SIGNATURE-----\n\nnot actually a signature\n-----END PGP SIGNATURE-----\n'

const REFUSED_PLUGIN: StoredManifest = {
  name: 'refusal-fixture',
  version: '1.0.0',
  title: 'Refusal Fixture Plugin',
  description: 'E2E fixture: a package whose signature fails verification',
  category: 'other',
  install: {},
}

// The app re-grades every saved printer from `checking` at boot through a live daemon probe
// (hooks/printers.ts); with nothing answering, the record grades offline and the Install button never
// enables. The stub daemon (127.0.0.1:4269) is what printer-dropdown.spec.ts uses for the same reason.
function seedManagedPrinter(userData: string, daemon: StubDaemon): void {
  const printersDir = join(userData, 'printers')
  mkdirSync(printersDir, { recursive: true })
  const record = {
    id: 'demo-u1', nick: 'Workshop U1', model: 'Snapmaker U1', adapter: 'snapmaker-u1',
    host: 'demo-u1.local', ip: '127.0.0.1', status: 'managed', installedIds: [],
    daemonVersion: EXPECTED_DAEMON_VERSION, daemonCert: daemon.cert, daemonToken: daemon.token,
  }
  writeFileSync(join(printersDir, 'demo-u1.json'), JSON.stringify(record, null, 2), 'utf-8')
}

function buildRefusedArchive(manifest: StoredManifest): Buffer {
  const zip = new AdmZip()
  zip.addFile('manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'))
  zip.addFile('manifest.json.sig', Buffer.from(MALFORMED_SIGNATURE, 'utf8'))

  return zip.toBuffer()
}

function seedSideloadedRefusal(userData: string): void {
  const localDir = join(userData, 'local-plugins')
  mkdirSync(localDir, { recursive: true })
  const index = buildLocalIndex([REFUSED_PLUGIN])
  writeFileSync(join(localDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf-8')
  writeFileSync(join(localDir, `${REFUSED_PLUGIN.name}-${REFUSED_PLUGIN.version}.b3`), buildRefusedArchive(REFUSED_PLUGIN))
}

test.describe('refused install: a package whose signature fails verification', () => {
  var app: ElectronApplication
  var page: Page
  var daemon: StubDaemon

  test.beforeAll(async () => {
    test.setTimeout(60_000)
    const userData = mkdtempSync(join(tmpdir(), 'b3-refused-'))
    daemon = await startStubDaemon(EXPECTED_DAEMON_VERSION)
    seedManagedPrinter(userData, daemon)
    seedSideloadedRefusal(userData)
    app = await electron.launch({ executablePath: packagedBinary(), args: [`--user-data-dir=${userData}`], env: appEnv() })
    page = await rendererWindow(app)
    await page.waitForTimeout(400)
    await page.locator('.card-title').first().waitFor({ timeout: 30_000 })
  })

  test.afterAll(async () => {
    await app?.close()
    await daemon?.stop()
  })

  test('clicking Install on a signature-refused package shows the refusal modal, not a generic error', async () => {
    await page.getByPlaceholder('Search plugins…').fill('Refusal Fixture')
    await page.waitForTimeout(300)
    await page.locator('.card-title', { hasText: 'Refusal Fixture Plugin' }).first().click()
    await page.locator('.plugin-modal').waitFor({ timeout: 10_000 })

    await page.locator('.panel-foot button', { hasText: 'Install' }).click()

    const modal = page.locator('.report-modal')
    await modal.waitFor({ timeout: 15_000 })
    await expect(modal.locator('.modal-head h2')).toContainText('was not installed')
    await expect(modal.locator('.modal-head p')).toHaveText(
      'This package failed a security check. Your printer was not changed.',
    )
    await expect(modal.locator('.report-tech-toggle')).toHaveCount(0)
  })
})
