import { useI18n } from '../../../i18n/context'
import { IconShield } from '../../../design-system/icons'
import { DEST_CLASSES } from '../create-data'
import { SecHead } from './sec-head'

const PERMISSION_CLASS_IDS = ['klipper-extra', 'moonraker-component', 'bin', 'klipper-config', 'web-asset', 'udev-rule']

function PermissionRow({ destClassId }: { destClassId: string }) {
  const destClass = DEST_CLASSES.find((entry) => entry.id === destClassId)
  if (!destClass) return null

  return (
    <div className="wb-perm-row">
      <span className="wb-class-dot" data-c={destClassId} />
      <div className="wb-perm-text">
        <div className="wb-perm-label">{destClass.label}</div>
        <div className="wb-perm-blurb">{destClass.blurb}</div>
      </div>
      <div className="wb-perm-verbs">{destClass.verbs.map((verb) => <span className="wb-verb" key={verb}>{verb}</span>)}</div>
    </div>
  )
}

export function PermissionsSection() {
  const { t } = useI18n()

  return (
    <div className="wb-sec">
      <SecHead icon="IconShield" title={t('create.sec.perms_title')} tier="tinkerer"
        blurb={t('create.sec.perms_blurb')} />
      <div className="wb-perm-list">{PERMISSION_CLASS_IDS.map((id) => <PermissionRow key={id} destClassId={id} />)}</div>
      <div className="wb-genwarn">
        <IconShield size={14} />
        <span>{t('create.sec.perms_warn')}</span>
      </div>
    </div>
  )
}
