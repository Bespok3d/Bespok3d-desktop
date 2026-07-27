import type { Plugin } from '../../data/types'
import type { TFunction } from '../../i18n'
import { installedConflicts } from '../../data/deps'
import { httpPortError, uiPorts } from '../../data/ports'
import { installBlockReason } from './panel/install-gate'
import type { InstallBlock } from './panel/install-gate'
import { pluginInstallVars } from './update-all'

// A collection install and "Update all" are automations of installs the user could have run one at a
// time, so the printer must end up where it would have ended up doing them by hand. That means every
// check the plugin panel runs before a single install runs here too. This module is the one place
// that decides it: it assembles the same input the panel assembles and hands it to the same
// installBlockReason, so a check added there is inherited here instead of being forgotten.
// Config readiness is the single input held neutral: the batch collects the missing values on
// BatchConfigModal before it runs, which is the batch's form of the panel's "configure" action.

// What the batch is running against: the printer, and whether it is busy printing.
export interface BatchGateState {
  printerId?: string
  printActive: boolean
  blockedActions: string[]
}

// The above plus what a per-member check needs to read: the catalogue, what is already on the printer,
// and the user's saved config values.
export interface BatchMemberContext extends BatchGateState {
  catalogPlugins: Plugin[]
  installedIds: string[]
  savedVars: Record<string, string>
}

export interface BlockedMember {
  plugin: Plugin
  block: InstallBlock
}

export interface BatchSplit {
  eligible: Plugin[]
  blocked: BlockedMember[]
}

// Why the whole batch cannot run (a print is under way, or no printer is managed), or null.
export function batchBlockReason(t: TFunction, state: BatchGateState): InstallBlock | null {
  return installBlockReason(t, {
    printerId: state.printerId,
    printActive: state.printActive,
    blockedActions: state.blockedActions,
    conflicts: [],
    portError: null,
    configReady: true,
    missingFields: [],
  })
}

// The ports the OTHER installed web UIs hold, which is what a candidate's own port is judged against.
function portsHeldByOtherUis(plugin: Plugin, context: BatchMemberContext): number[] {
  return Object.entries(uiPorts(context.catalogPlugins, context.installedIds, context.savedVars))
    .filter(([holderId]) => holderId !== plugin.id)
    .map(([, port]) => port)
}

// Why this one member cannot join the batch (it clashes with something already installed, or its web
// UI wants a port that is taken), or null. The batch-wide reasons answer first, exactly as they do
// for a single install.
export function memberBlockReason(t: TFunction, plugin: Plugin, context: BatchMemberContext): InstallBlock | null {
  return installBlockReason(t, {
    printerId: context.printerId,
    printActive: context.printActive,
    blockedActions: context.blockedActions,
    conflicts: installedConflicts(context.catalogPlugins, plugin.id, context.installedIds),
    portError: httpPortError(plugin.config ?? [], pluginInstallVars(plugin, context.savedVars), portsHeldByOtherUis(plugin, context)),
    configReady: true,
    missingFields: [],
  })
}

// The members that may be installed and the ones that may not, each carrying the reason to show. A
// blocked member is left out and the rest install, the same way a member missing from the catalogue is.
export function splitByBatchGate(t: TFunction, members: Plugin[], context: BatchMemberContext): BatchSplit {
  const judged = members.map((member) => ({ plugin: member, block: memberBlockReason(t, member, context) }))

  return {
    eligible: judged.filter((row) => row.block === null).map((row) => row.plugin),
    blocked: judged.filter((row): row is BlockedMember => row.block !== null),
  }
}
