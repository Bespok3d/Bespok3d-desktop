// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SshSession } from '../ssh'

// The adapter-client SDK: the finite, stable surface the app gives an adapter's client half.
// An adapter client imports everything it needs from here (the ssh transport + the enrollment
// contract + registerAdapter), so it never reaches into app internals and can live in its own repo.
export { connect, shellQuote } from '../ssh'
export type { SshSession } from '../ssh'
export { devSourcePath, devSourcesRoot } from '../registry/dev-sources'
// An adapter installs the daemon and its own jinni out of the packages this build ships with, and it
// checks them with the app's ONE verifier. There is no second verifier on the adapter side:
// a package an adapter puts on a printer passes exactly the check a package from the store passes.
export { verifiedPackageTrust } from '../store/verify-package'
export { PackageRefusedError } from '../store/package-refused'
export { openBundledPackage, unverifiedBundledPayload } from '../store/bundled-package'
export type { BundledPackage } from '../store/bundled-package'
// The printer's own machinery (the daemon, the adapter's jinni) comes through its own door: those are
// the packages the app offers from the published lists and not only from the copy it ships with.
export { openSystemPackage } from '../store/system-package'

export interface SshCredentials {
  user: string
  password: string
  port: number
}

export interface AdapterDefaults {
  sshUser: string
  sshPort: number
  sshPasswordHint: string
  runtimeUser: string
}

export interface AdapterEnvVar {
  name: string
  value: string
  description: string
}

// One enrollment step as it travels to the renderer: the run() closure is dropped, leaving the
// display fields. See serializeAdapter.
export interface AdapterStepInfo {
  id: string
  label: string
  detail: string
}

// The serialized, renderer-facing view of an AdapterDefinition (the enroll/op closures stripped).
// This is the wire shape serializeAdapter produces and the printers.adapterGet/adaptersList IPC
// returns, so the renderer reads it through one type instead of a hand-mirrored copy.
export interface AdapterInfo {
  id: string
  title: string
  vendor: string
  version: string
  // The device-side (jinni) version this build would install for the adapter, resolved from the
  // catalogue the build packs. Absent when the build ships no jinni package for it, which is the
  // honest answer: there is then no version to offer.
  jinniVersion?: string
  // How long this printer takes to come back after a restart. The screens that make the user wait
  // read it from here, so no number about a printer lives in the app.
  restartSeconds: number
  description: string
  icon?: string
  defaults: AdapterDefaults
  envVars: AdapterEnvVar[]
  enrollSteps: AdapterStepInfo[]
}

export interface EnrollContext {
  printerId: string
  ip: string
  credentials: SshCredentials
  runtimeUser: string
  daemonToken?: string
  daemonCert?: string
  clientPublicKey?: string
  clientFingerprint?: string
  clientId?: string
  clientLabel?: string
  // What the step is doing right now, and - when the phase running knows its own size - how far
  // through the step that puts it, as a 0..1 fraction. The fraction is what makes the bar advance
  // inside one long step; a phase that cannot measure itself sends the hint alone.
  onProgress?: (hint: string, stepFraction?: number) => void
  overlayWasActive?: boolean
}

export interface EnrollStep {
  id: string
  label: string
  detail: string
  run: (ssh: SshSession, ctx: EnrollContext) => Promise<void>
}

export interface AdapterDefinition {
  id: string
  title: string
  vendor: string
  version: string
  // The adapter's device-side (jinni) version, single-sourced in the adapter (jinni/version.json).
  // Required, so registering an adapter without it fails tsc, gate-enforcing the single source.
  jinniVersion: string
  // The package name the jinni ships as, so the app can look up the version it would actually
  // install rather than the one a working copy happens to declare.
  jinniPackage: string
  // How long this printer takes to come back after a restart, in seconds. Required: how long a wait
  // lasts is the printer's fact, and the app carries no default for it.
  restartSeconds: number
  description: string
  // Optional data-URL avatar (PNG/SVG/etc.) shown for every printer on this adapter, unless the user
  // sets their own picture. Travels to the renderer through serializeAdapter; must be a data: URL to
  // satisfy the renderer CSP (img-src 'self' data:).
  icon?: string
  defaults: AdapterDefaults
  envVars: AdapterEnvVar[]
  enrollSteps: EnrollStep[]
  // Maintenance steps reachable by ops (repair, jinni update) but not part of the enroll sequence.
  opSteps?: EnrollStep[]
  // True only when the printer is set up AND that setup will persist: the device's write layer is
  // intact and our workspace is present. Goes false after a firmware OTA wipes the overlay, which is
  // exactly when a daemon repair would not survive a reboot and the printer needs full recovery.
  verifyEnrolled: (ssh: SshSession) => Promise<boolean>
}

const ADAPTERS = new Map<string, AdapterDefinition>()

/** @public - the adapter SDK entry point; called by external adapter repos via @adapter-sdk, which
 * live outside this workspace, so the orphan detector cannot see the call site. */
export function registerAdapter(def: AdapterDefinition): void {
  ADAPTERS.set(def.id, def)
}

export function getAdapter(id: string): AdapterDefinition | undefined {
  return ADAPTERS.get(id)
}

export function listAdapters(): AdapterDefinition[] {
  return Array.from(ADAPTERS.values())
}
