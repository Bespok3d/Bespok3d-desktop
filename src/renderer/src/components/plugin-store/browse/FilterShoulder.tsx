// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../../i18n/context'
import cx from '../../../utils/cx'
import type { TrustTier, ReleaseChannel } from '../../../data/types'
import { BUNDLED_CATEGORIES, CHANNELS } from '../../../data/catalog/bundled'
import { CAT_CLASS } from './PluginCard'
import { selectFacet, toggleFacet } from './filters'
import type { StatusFacet } from './filters'

const CHANNEL_IDS: ReleaseChannel[] = CHANNELS.map((channel) => channel.id)
const CATEGORY_IDS: string[] = BUNDLED_CATEGORIES.map((category) => category.id)
const TRUST_TIERS: TrustTier[] = ['any', 'community', 'project', 'manufacturer']
const STATUS_FACETS: StatusFacet[] = ['installed', 'not-installed', 'needs-updating']
const STATUS_LABEL: Record<StatusFacet, string> = {
  installed: 'filter.installed',
  'not-installed': 'filter.not_installed',
  'needs-updating': 'filter.needs_updating',
}

export interface FacetState {
  channels: ReleaseChannel[]; categories: string[]; trusts: TrustTier[]; statuses: StatusFacet[]; printerOnly: boolean
  setChannels: (next: ReleaseChannel[]) => void; setCategories: (next: string[]) => void
  setTrusts: (next: TrustTier[]) => void; setStatuses: (next: StatusFacet[]) => void; setPrinterOnly: (next: boolean) => void
}

// One chip group in the filter shoulder; the caller's onToggle decides multi- vs single-select (status
// is single, the rest multi). An empty selection means "no constraint", so there is no "All" chip. dot
// returns an optional swatch class (trust/category colour cue).
function FacetGroup<Selectable extends string>({ title, options, selected, label, dot, onToggle }: {
  title: string; options: Selectable[]; selected: Selectable[]
  label: (option: Selectable) => string; dot?: (option: Selectable) => string
  onToggle: (option: Selectable) => void
}) {
  return (
    <div className="shoulder-group">
      <div className="shoulder-group-title">{title}</div>
      <div className="filter-group">
        {options.map((option) => {
          const dotClass = dot?.(option)

          return (
            <button key={option} className={cx('filter-chip', selected.includes(option) && 'active')} onClick={() => onToggle(option)}>
              {dotClass && <span className={dotClass} />}
              {label(option)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// The left filter shoulder, opened by the funnel. Channels here is the explicit override that surfaces
// plugins above the user's stability ceiling (which are otherwise hidden from the default grid).
export function FilterShoulder({ open, channels, categories, trusts, statuses, printerOnly, setChannels, setCategories, setTrusts, setStatuses, setPrinterOnly }: FacetState & { open: boolean }) {
  const { t } = useI18n()

  return (
    <div className={cx('filter-shoulder', open && 'open')} aria-hidden={!open}>
      <div className="filter-shoulder-inner">
        <FacetGroup title={t('filter.group_channels')} options={CHANNEL_IDS} selected={channels} label={(id) => t(`chan.${id}`)} onToggle={(id) => setChannels(toggleFacet(channels, id))} />
        <FacetGroup title={t('filter.group_status')} options={STATUS_FACETS} selected={statuses} label={(status) => t(STATUS_LABEL[status])} onToggle={(status) => setStatuses(selectFacet(statuses, status))} />
        <FacetGroup title={t('filter.group_trust')} options={TRUST_TIERS} selected={trusts} label={(tier) => t(`trust.${tier}`)} dot={(tier) => cx('trust-dot', tier)} onToggle={(tier) => setTrusts(toggleFacet(trusts, tier))} />
        <FacetGroup title={t('filter.group_categories')} options={CATEGORY_IDS} selected={categories} label={(id) => t(`cat.${id}`)} dot={(id) => cx('cat-dot', CAT_CLASS[id] ?? 'mac')} onToggle={(id) => setCategories(toggleFacet(categories, id))} />
        <div className="shoulder-group">
          <div className="shoulder-group-title">{t('filter.group_printer')}</div>
          <div className="filter-group">
            <button className={cx('filter-chip', printerOnly && 'active')} onClick={() => setPrinterOnly(!printerOnly)}>{t('filter.printer_specific')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
