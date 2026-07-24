import { IconChip } from '../../../design-system/icons'
import { CREATE_ICONS } from '../icon-registry'

export function SecHead({ icon, title, tier, blurb }: { icon: string; title: string; tier: string; blurb: string }) {
  const Glyph = CREATE_ICONS[icon] ?? IconChip

  return (
    <div className="wb-sec-head">
      <div className="wb-sec-title">
        <span className="wb-sec-ic"><Glyph size={16} /></span>
        <h2>{title}</h2>
        <span className={'wb-tier-tag ' + tier}>{tier}+</span>
      </div>
      <p className="wb-sec-blurb">{blurb}</p>
    </div>
  )
}
