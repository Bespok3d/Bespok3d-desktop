// Barrel for the daemon HTTP client, partitioned by endpoint concern: shared transport (the pinned
// agent + bounded request), the read-only status endpoints, the package lifecycle, and the access
// (multi-client pairing) endpoints. Importers keep using `./daemon-client/client` unchanged.
export { EXPECTED_DAEMON_VERSION } from './version'

export { makeAgent, DaemonHttpError, DEFAULT_DAEMON_TIMEOUT_MS, LONG_OP_TIMEOUT_MS, setAddressResolver } from './transport'
export type { UploadProgressFn } from './transport'

export { fetchDaemonStatus, fetchCapabilities, fetchSelfCheck, fetchPluginConfig } from './status-endpoints'
export type { SymlinkIssue, PluginDrift, SelfCheckResult } from './status-endpoints'

export {
  installPlugin,
  uninstallPlugin,
  reconfigurePlugin,
  deactivateAll,
  teardownDaemon,
  recoverPackages,
  uninstallBatch,
  updateBatchPackages,
  installBatchPackages,
} from './packages-client'
export type { BatchUpdatePackage } from './packages-client'

export { requestAccess, fetchAccessClients, grantAccess, revokeAccess, isAccessGranted } from './access-client'
export type { AccessClient, PendingClient, AccessClients, AccessRequestInput } from './access-client'
