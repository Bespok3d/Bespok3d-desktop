// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// What to do when the user adds or re-opens a printer whose daemon state we have just probed. Split to
// mirror the two async probes (checkDaemon then, only if needed, checkSshOpen), each a pure decision so
// every branch is unit-testable. This is the "missing daemon, new vs known printer" routing.

// After the daemon probe: a managed daemon that is NOT ours (we never enrolled it and hold no access
// grant) means another computer owns it, so we ask for access instead of enrolling (which would clobber
// its ACL). Anything else falls through to the SSH-based enroll path.
export function daemonAccessDecision(
  args: { isManaged: boolean; enrolled: boolean; hasAccessIdentity: boolean },
): 'access' | 'enroll-path' {
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
