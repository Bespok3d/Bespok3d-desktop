// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useEffect } from 'react'
import { useI18n } from '../../i18n/context'
import { IconBell, IconCheck, IconClose } from '../../design-system/icons'
import { useCatalog } from '../../data/catalog'
import { buildNotices, LIVE_CONDITION_NOTICE_IDS } from './notices'
import type { Notice, NoticeAction } from './notices'
import { visibleNotices, unreadCount, relativeTime } from './notice-state'
import { useNoticeState } from './useNoticeState'
import type { Section } from '../settings'
import { useChannelPrefs } from '../common/hooks/useChannelPrefs'
import cx from '../../utils/cx'
import { Button } from '../common/Button'

interface NoticeItemProps {
  notice: Notice
  isRead: boolean
  seenAt: number
  now: number
  onAct: (notice: Notice) => void
  onMarkRead: () => void
  onDismiss: () => void
}

function NoticeItem({ notice, isRead, seenAt, now, onAct, onMarkRead, onDismiss }: NoticeItemProps) {
  const { t } = useI18n()
  const action = notice.action

  return (
    <div className={cx('notif-item', notice.severity, isRead && 'read')}>
      <span className={cx('notif-dot', isRead && 'read')} aria-hidden="true" />
      <div className="notif-item-text">
        <div className="notif-item-title">{t(notice.titleKey, notice.params)}</div>
        <div className="notif-item-body">{t(notice.bodyKey, notice.params)}</div>
        <div className="notif-item-time">{relativeTime(seenAt, now)}</div>
        {action && (
          <Button variant="primary" size="sm" onClick={() => onAct(notice)}>{t(action.labelKey)}</Button>
        )}
      </div>
      <div className="notif-item-controls">
        {!isRead && (
          <Button variant="ghost" size="sm" icon title={t('notif.mark_read')} aria-label={t('notif.mark_read')} onClick={onMarkRead}>
            <IconCheck size={13} />
          </Button>
        )}
        <Button variant="ghost" size="sm" icon title={t('notif.dismiss')} aria-label={t('notif.dismiss')} onClick={onDismiss}>
          <IconClose size={13} />
        </Button>
      </div>
    </div>
  )
}

export interface NotificationCenterProps {
  onOpenSettings: (pane: Section) => void
  onOpenPlugin: (pluginId: string) => void
  installedVersions: Record<string, string>
}

export function NotificationCenter({ onOpenSettings, onOpenPlugin, installedVersions }: NotificationCenterProps) {
  const { t } = useI18n()
  const { plugins, sources } = useCatalog()
  const { ceilingFor, disabledChannels } = useChannelPrefs()
  const { state, markRead, dismiss, markAllRead, dismissAll, markSeen, rearm } = useNoticeState()
  const [open, setOpen] = useState(false)

  const notices = buildNotices({ sources, plugins, installedVersions, ceilingFor, disabledChannels })
  const visible = visibleNotices(notices, state.dismissed)
  const unread = unreadCount(notices, state)
  const visibleIds = visible.map((notice) => notice.id)
  const now = Date.now()

  // Re-arm live-condition notices once per session, so a state still broken since a previous session
  // (e.g. sources still need GitHub sign-in) shows again rather than staying silently read.
  useEffect(() => { LIVE_CONDITION_NOTICE_IDS.forEach((id) => rearm(id)) }, [])
  // Stamp the first-seen time for the currently-shown notices (drives the relative-time label).
  useEffect(() => { markSeen(visibleIds) }, [visibleIds.join('|')])

  function runAction(action: NoticeAction): void {
    setOpen(false)
    if (action.kind === 'open-settings') onOpenSettings(action.pane)
    else onOpenPlugin(action.pluginId)
  }

  function act(notice: Notice): void {
    markRead(notice.id)
    if (notice.action) runAction(notice.action)
  }

  return (
    <div className="notif">
      <Button
        variant="ghost"
        icon
        className="notif-bell"
        aria-label={t('notif.bell')}
        title={t('notif.bell')}
        onClick={() => setOpen((prev) => !prev)}
      >
        <IconBell size={16} />
        {unread > 0 && <span className="notif-badge" aria-hidden="true">{unread}</span>}
      </Button>
      {open && (
        <>
          <button className="notif-scrim" aria-hidden="true" tabIndex={-1} onClick={() => setOpen(false)} />
          <div className="notif-panel" role="dialog" aria-label={t('notif.title')}>
            <div className="notif-head">
              <span>{t('notif.title')}</span>
              {visible.length > 0 && (
                <span className="notif-head-actions">
                  <Button variant="ghost" size="sm" onClick={() => markAllRead(visibleIds)}>{t('notif.mark_all_read')}</Button>
                  <Button variant="ghost" size="sm" onClick={() => dismissAll(visibleIds)}>{t('notif.dismiss_all')}</Button>
                </span>
              )}
            </div>
            {visible.length === 0 ? (
              <div className="notif-empty">{t('notif.empty')}</div>
            ) : (
              visible.map((notice) => (
                <NoticeItem
                  key={notice.id}
                  notice={notice}
                  isRead={state.read.includes(notice.id)}
                  seenAt={state.seen[notice.id] ?? now}
                  now={now}
                  onAct={act}
                  onMarkRead={() => markRead(notice.id)}
                  onDismiss={() => dismiss(notice.id)}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
