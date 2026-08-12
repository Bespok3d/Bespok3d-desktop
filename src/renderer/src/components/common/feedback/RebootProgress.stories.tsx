// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { RebootProgress } from './RebootProgress'

export default { title: 'Common / RebootProgress' }

// It fills the width it is given and empties over the restart time the adapter declares.
export function Restarting() {
  return <RebootProgress restartSeconds={42} />
}
