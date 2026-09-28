// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// What to do when the user adds or re-opens a printer whose daemon state we have just probed. Split to
// mirror the two async probes (checkDaemon then, only if needed, checkSshOpen), each a pure decision so
// every branch is unit-testable. This is the "missing daemon, new vs known printer" routing.

import type { DaemonAccessState } from '../../../main/daemon-client/status'

export type AccessPromptState = Extract<DaemonAccessState, 'present-awaiting-access' | 'credentials-rejected' | 'certificate-missing' | 'identity-changed'>

// After the daemon probe: a managed daemon that is NOT ours (we never enrolled it and hold no access
// grant) means another computer owns it, so we ask for access instead of enrolling (which would clobber
// its ACL). Anything else falls through to the SSH-based enroll path.
export function daemonAccessDecision(
  args: { accessState?: DaemonAccessState; isManaged: boolean; enrolled: boolean; hasAccessIdentity: boolean },
): 'access' | 'identity-warning' | 'blocked' | 'enroll-path' {
  if (args.accessState === 'present-awaiting-access' || args.accessState === 'credentials-rejected') return 'access'
  if (args.accessState === 'identity-changed' || args.accessState === 'certificate-missing') return 'identity-warning'
  if (args.accessState === 'offline' || args.accessState === 'unrecognized') return 'blocked'
  if (args.accessState) return 'enroll-path'
  if (args.isManaged && !args.enrolled && !args.hasAccessIdentity) return 'access'

  return 'enroll-path'
}

// On the enroll path: enrollment is all SSH, so a closed port 22 means root access is off (show the
// gate). When it is open, a just-added printer proposes enrollment first; an explicit Enroll starts it.
export function enrollPathDecision(
  args: { sshOpen: boolean; fromAdd: boolean },
): 'root-gate' | 'enroll-proposal' | 'enroll' {
  if (!args.sshOpen) return 'root-gate'

  return args.fromAdd ? 'enroll-proposal' : 'enroll'
}
