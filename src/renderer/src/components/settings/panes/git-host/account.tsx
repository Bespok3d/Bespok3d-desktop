import { useI18n } from '../../../../i18n/context'
import { Group } from '../../../common/Group'
import { Row } from '../../../common/Row'
import { Button } from '../../../common/Button'
import { IconKey, IconRefresh } from '../../../../design-system/icons'
import type { Account } from './types'
import './git-host.css'

function avatarTint(login: string): string {
  const hue = login.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360

  return `oklch(60% 0.16 ${hue})`
}

function avatarInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

interface AccountRowProps {
  account: Account
  hostLabel: string
  onDisconnect: () => void
}

function AccountRow({ account, hostLabel, onDisconnect }: AccountRowProps) {
  const { t } = useI18n()
  const tint = avatarTint(account.login)
  const initials = avatarInitials(account.name || account.login)

  return (
    <Row
      icon={
        <div
          className="gh-avatar"
          style={{ width: 32, height: 32, fontSize: 12, background: tint }}
        >
          {initials}
        </div>
      }
      controls={
        <Button variant="danger-outline" size="sm" onClick={onDisconnect}>
          {t('githost.account.disconnect')}
        </Button>
      }
      className="gh-account-row"
    >
      <strong>@{account.login}</strong>
      <div className="key-meta">{account.name} · {hostLabel}</div>
    </Row>
  )
}

// A GitHub token minted before the repo-scope bump (or any token lacking `repo`) cannot read the
// private tester repos; private fetches would 404 and look like "not found". Surface a reconnect.
export function gitHubMissingRepoScope(tokenInfo: TokenInfo | null, isGitHub: boolean): boolean {
  if (!isGitHub || !tokenInfo) return false

  return !tokenInfo.scopes.includes('repo')
}

interface TokenRowProps {
  tokenInfo: TokenInfo | null
  isGitHub: boolean
  onReauth: () => void
}

function TokenRow({ tokenInfo, isGitHub, onReauth }: TokenRowProps) {
  const { t } = useI18n()
  const typeLabel = isGitHub ? t('githost.token.device_flow') : t('githost.token.pat')
  const reauthLabel = isGitHub ? t('githost.token.reauthorize') : t('githost.token.replace')
  const reauthTitle = isGitHub ? t('githost.token.reauthorize') : t('githost.token.replace_title')

  return (
    <Row
      icon={<IconKey size={18} />}
      controls={
        <Button variant="outline" size="sm" onClick={onReauth} title={reauthTitle}>
          <IconRefresh size={13} /> {reauthLabel}
        </Button>
      }
    >
      <strong>{typeLabel}</strong>
      {tokenInfo && tokenInfo.scopes.length > 0 && (
        <div className="gh-scopes-chips u-mt-1">
          {tokenInfo.scopes.map((scope) => (
            <span key={scope} className="gh-scope-chip">{scope}</span>
          ))}
        </div>
      )}
      {tokenInfo?.expiresAt && (
        <div className="key-meta">{t('githost.token.expires', { date: tokenInfo.expiresAt.toLocaleDateString() })}</div>
      )}
      {gitHubMissingRepoScope(tokenInfo, isGitHub) && (
        <div className="key-meta gh-token-warning">
          {t('githost.token.missing_scope')}
        </div>
      )}
    </Row>
  )
}

// The OS keyring was unreachable, so the token was saved as plaintext in the app's data dir rather
// than blocking the connection. On macOS this almost always means the app is running translocated
// from the DMG or a quarantined copy; moving it into a real folder and relaunching restores the
// keychain. The fix is the user's to make, so we tell them how rather than silently degrading.
function UnencryptedStorageNotice() {
  const { t } = useI18n()

  return (
    <Group title={t('githost.storage.title')}>
      <Row icon={<IconKey size={18} />}>
        <strong>{t('githost.storage.unencrypted')}</strong>
        <div className="key-meta gh-storage-warning">
          {t('githost.storage.unencrypted_detail')}
        </div>
      </Row>
    </Group>
  )
}

interface AccountSectionProps {
  account: Account
  hostLabel: string
  tokenInfo: TokenInfo | null
  isGitHub: boolean
  storageEncrypted: boolean
  onDisconnect: () => void
  onReauth: () => void
}

export function AccountSection(props: AccountSectionProps) {
  const { t } = useI18n()

  return (
    <>
      <Group title={t('githost.account.title')}>
        <AccountRow account={props.account} hostLabel={props.hostLabel} onDisconnect={props.onDisconnect} />
      </Group>
      <Group title={t('githost.token.title')}>
        <TokenRow tokenInfo={props.tokenInfo} isGitHub={props.isGitHub} onReauth={props.onReauth} />
      </Group>
      {!props.storageEncrypted && <UnencryptedStorageNotice />}
    </>
  )
}
