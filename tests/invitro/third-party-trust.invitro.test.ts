// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, afterEach, vi } from 'vitest'
import * as openpgp from 'openpgp'
import AdmZip from 'adm-zip'
import { resolveCatalog } from '../../src/main/registry/resolve'
import { fetchGitHostRegistry } from '../../src/main/registry/resolve/fetch'
import { DEFAULT_LIMITS } from '../../src/main/registry/model'
import type { MergedEntry, RegistryRef } from '../../src/main/registry/model'
import { verifiedPackageTrust, PackageRefusedError } from '../../src/main/store/verify-package'

vi.mock('../../src/main/git-host/keychain', () => ({
  load: () => null,
  save: () => {},
  clear: () => {},
  encryptionAvailable: () => false,
}))

// A disposable third-party publisher, a signed external list and a signed package run through the
// REAL resolver and the REAL install verifier: the transport ladder, the served-bytes verification,
// the publisher-key discovery and the merge are all production code. Only the host is simulated (a
// fetch stub over raw.githubusercontent.com), which is the line between this and a live check.
//
// The point under test is the boundary between the two trust layers: catalog visibility never dies
// over a signature (a list with an unproven signature still loads and shows why), while package
// installation is where a present but unproven signature still refuses.
const ACCOUNT = 'fixture-publisher'
const LIST_REPO = 'fixture-list'
const PLUGIN_REPO = 'fixture-plugin'
const PLUGIN_NAME = 'fixture-third-party'

interface DisposablePublisher {
  signingKey: openpgp.PrivateKey
  armoredPublicKey: string
  fingerprint: string
}

const generatedPublishers = new Map<string, Promise<DisposablePublisher>>()

function disposablePublisher(publisherName: string): Promise<DisposablePublisher> {
  const alreadyGenerating = generatedPublishers.get(publisherName)
  if (alreadyGenerating) return alreadyGenerating
  const generating = openpgp
    .generateKey({ userIDs: [{ name: publisherName, email: 'publisher@example.invalid' }], format: 'object' })
    .then((generated) => ({
      signingKey: generated.privateKey,
      armoredPublicKey: generated.publicKey.armor(),
      fingerprint: generated.publicKey.getFingerprint().toUpperCase(),
    }))
  generatedPublishers.set(publisherName, generating)

  return generating
}

function listBytes(index: Record<string, unknown>): string {
  return `${JSON.stringify(index, null, 2)}\n`
}

async function detachedOver(bytesToSign: string | Buffer, signingKey: openpgp.PrivateKey): Promise<string> {
  const message = await openpgp.createMessage({ binary: new TextEncoder().encode(bytesToSign.toString()) })
  const armored = await openpgp.sign({ message, signingKeys: signingKey, detached: true })

  return armored as string
}

function atomEntry(declaredFingerprint: string): Record<string, unknown> {
  return {
    name: PLUGIN_NAME,
    title: 'Fixture Third Party Plugin',
    version: '1.0.0',
    description: 'Invitro fixture: an atom signed by a disposable third-party publisher.',
    category: 'system',
    channel: 'stable',
    publisher: declaredFingerprint.toLowerCase(),
    printer_specific: false,
    download_url: `https://api.github.com/repos/${ACCOUNT}/${PLUGIN_REPO}/releases/assets/4242`,
    deps: [],
    conflicts: [],
    provides: [],
  }
}

function thirdPartyIndex(declaredFingerprint: string): Record<string, unknown> {
  return {
    schema_version: 1,
    name: 'Fixture Third Party',
    publisher: declaredFingerprint.toLowerCase(),
    updated: '2026-09-24',
    plugins: [atomEntry(declaredFingerprint)],
    collections: [],
    lists: [],
  }
}

function manifestBytes(manifest: Record<string, unknown>): Buffer {
  return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

function packedManifestFields(declaredFingerprint: string): Record<string, unknown> {
  return {
    name: PLUGIN_NAME,
    version: '1.0.0',
    publisher: declaredFingerprint.toLowerCase(),
    install: { config: { 'main.cfg': 'config/main.cfg' } },
    files: [{ path: 'config/main.cfg', sha256: 'f'.repeat(64) }],
  }
}

async function signedPackage(signingKey: openpgp.PrivateKey, declaredFingerprint: string): Promise<Buffer> {
  const manifest = manifestBytes(packedManifestFields(declaredFingerprint))
  const signature = Buffer.from(await detachedOver(manifest, signingKey), 'utf8')
  const archive = new AdmZip()
  archive.addFile('manifest.json', manifest)
  archive.addFile('manifest.json.sig', signature)
  archive.addFile('config/main.cfg', Buffer.from('# obviously fake payload\n', 'utf8'))

  return archive.toBuffer()
}

function listedEntry(fields: Partial<MergedEntry> = {}): MergedEntry {
  return {
    name: PLUGIN_NAME,
    version: '1.0.0',
    trust: 'community',
    signer: null,
    registry_url: `github:${ACCOUNT}/${LIST_REPO}/index.json`,
    download_url: `https://api.github.com/repos/${ACCOUNT}/${PLUGIN_REPO}/releases/assets/4242`,
    ...fields,
  }
}

interface ServedFile {
  body: string | null
  status?: number
}

function stubHost(served: Record<string, ServedFile>): void {
  vi.stubGlobal('fetch', vi.fn((input: string | URL | Request) => {
    const found = served[String(input)]
    if (!found) return Promise.resolve(new Response('{}', { status: 404 }))

    return Promise.resolve(new Response(found.body ?? '', { status: found.status ?? 200 }))
  }))
}

function primaryKeyUrl(fingerprint: string): string {
  return `https://raw.githubusercontent.com/${ACCOUNT}/bespok3d-publisher/HEAD/keys/${fingerprint.toLowerCase()}/key.asc`
}

function bucketKeyUrl(account: string): string {
  return `https://raw.githubusercontent.com/Bespok3d/main-index/HEAD/keys/${account.toLowerCase()}-publisher.pub.asc`
}

function listUrls(listName: string): { ref: RegistryRef, servedUrl: string, signatureUrl: string } {
  const servedUrl = `https://raw.githubusercontent.com/${ACCOUNT}/${listName}/main/index.json`

  return {
    ref: { url: `github:${ACCOUNT}/${listName}/index.json`, trust: 'community', locked: false },
    servedUrl,
    signatureUrl: `${servedUrl}.sig`,
  }
}

function noop(): void {}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('a third-party signed list through the real resolver', () => {
  it('loads the list at community trust with the proved signer, and names no other signer', async () => {
    const publisher = await disposablePublisher('Resolver Community')
    const { ref, servedUrl, signatureUrl } = listUrls('resolver-community')
    const served = listBytes(thirdPartyIndex(publisher.fingerprint))
    stubHost({
      [servedUrl]: { body: served },
      [signatureUrl]: { body: await detachedOver(served, publisher.signingKey) },
      [primaryKeyUrl(publisher.fingerprint)]: { body: publisher.armoredPublicKey },
    })
    const catalog = await resolveCatalog([ref], fetchGitHostRegistry, DEFAULT_LIMITS, noop)
    expect(catalog.plugins).toHaveLength(1)
    expect(catalog.plugins[0]).toMatchObject({ name: PLUGIN_NAME, trust: 'community', signer: ACCOUNT })
  })

  it('finds the key in the main-index bucket when the publisher repository holds nothing', async () => {
    const publisher = await disposablePublisher('Resolver Bucket')
    const { ref, servedUrl, signatureUrl } = listUrls('resolver-bucket')
    const served = listBytes(thirdPartyIndex(publisher.fingerprint))
    stubHost({
      [servedUrl]: { body: served },
      [signatureUrl]: { body: await detachedOver(served, publisher.signingKey) },
      [bucketKeyUrl(ACCOUNT)]: { body: publisher.armoredPublicKey },
    })
    const catalog = await resolveCatalog([ref], fetchGitHostRegistry, DEFAULT_LIMITS, noop)
    expect(catalog.plugins[0]).toMatchObject({ trust: 'community', signer: ACCOUNT })
  })

  it('still loads a list whose signature proves nothing, at the failed badge rather than gone', async () => {
    const publisher = await disposablePublisher('Resolver Failed')
    const stranger = await disposablePublisher('Resolver Stranger')
    const { ref, servedUrl, signatureUrl } = listUrls('resolver-failed')
    const served = listBytes(thirdPartyIndex(publisher.fingerprint))
    stubHost({
      [servedUrl]: { body: served },
      [signatureUrl]: { body: await detachedOver(served, stranger.signingKey) },
      [primaryKeyUrl(publisher.fingerprint)]: { body: publisher.armoredPublicKey },
    })
    const catalog = await resolveCatalog([ref], fetchGitHostRegistry, DEFAULT_LIMITS, noop)
    expect(catalog.plugins).toHaveLength(1)
    expect(catalog.plugins[0]).toMatchObject({ trust: 'failed', signer: null })
  })
})

describe('a third-party signed package through the real install verifier', () => {
  it('installs at community when the discovered key of the provenance account signed it', async () => {
    const publisher = await disposablePublisher('Package Community')
    const archive = await signedPackage(publisher.signingKey, publisher.fingerprint)
    stubHost({ [primaryKeyUrl(publisher.fingerprint)]: { body: publisher.armoredPublicKey } })
    expect(await verifiedPackageTrust(archive, listedEntry())).toBe('community')
  })

  // Catalog visibility and package installation are different boundaries: a signed package whose key
  // nobody can find is refused at install, and that is not the same fact as a list that failed its
  // signature (which still loaded, above).
  it('refuses a signed package whose key the host serves to nobody', async () => {
    const publisher = await disposablePublisher('Package Keyless')
    const archive = await signedPackage(publisher.signingKey, publisher.fingerprint)
    stubHost({})
    await expect(verifiedPackageTrust(archive, listedEntry())).rejects.toThrow(PackageRefusedError)
  })
})
