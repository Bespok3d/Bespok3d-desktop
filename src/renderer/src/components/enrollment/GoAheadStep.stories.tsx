// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { GoAheadStep } from './GoAheadStep'

export default { title: 'Enrollment / GoAheadStep' }

// Stopping the plugins: the printer is left printing on its own firmware, so the user says go first.
export function Deactivate() {
  return <GoAheadStep actionLabel="Deactivate" onConfirm={() => {}} onOwnCredentials={() => {}} onCancel={() => {}} />
}

// Removal is the one nobody should be able to trigger by opening a window.
export function RemoveBespok3d() {
  return <GoAheadStep actionLabel="Remove Bespok3d" onConfirm={() => {}} onOwnCredentials={() => {}} onCancel={() => {}} />
}
