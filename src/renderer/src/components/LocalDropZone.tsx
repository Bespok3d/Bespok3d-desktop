import { useCallback, useEffect, useRef, useState } from 'react'
import type { Printer, AddLocalResult, LocalPackageInfo } from '../data/types'
import { useCatalog } from '../data/catalog'
import { useI18n } from '../i18n/context'
import { ConfirmActionDialog } from './common/overlay/ConfirmActionDialog'

interface LocalDropZoneProps {
  selectedPrinter: Printer | null
  // Open the dropped plugin's detail panel so the user completes the install there (vars, version).
  // The drop zone never installs directly, so it stays decoupled from the install flow.
  onInstall: (pluginId: string) => void
}

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

function installable(result: AddLocalResult, printer: Printer | null): LocalPackageInfo[] {
  return printer?.status === 'managed' ? result.added : []
}

// Window-wide drag + drop of .b3 files plus the OS file-association feed (onAdded). Both end in the
// same ingest, so callers get one result callback and the visual drag state.
function useDropTarget(onResult: (result: AddLocalResult) => void): boolean {
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  useEffect(() => {
    function onEnter(event: DragEvent): void {
      if (!hasFiles(event)) return
      dragDepth.current += 1
      setDragging(true)
    }
    function onOver(event: DragEvent): void {
      if (hasFiles(event)) event.preventDefault()
    }
    function onLeave(): void {
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setDragging(false)
    }
    function onDrop(event: DragEvent): void {
      if (!hasFiles(event)) return
      event.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      const paths = Array.from(event.dataTransfer?.files ?? [])
        .map((file) => window.b3d.localStore.pathForFile(file))
        .filter((path) => path.endsWith('.b3'))
      if (paths.length > 0) window.b3d.localStore.add(paths).then(onResult)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    const unsubscribe = window.b3d.localStore.onAdded(onResult)

    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
      unsubscribe()
    }
  }, [onResult])

  return dragging
}

export function LocalDropZone({ selectedPrinter, onInstall }: LocalDropZoneProps) {
  const { t } = useI18n()
  const { refresh } = useCatalog()
  const [errors, setErrors] = useState<string[]>([])
  const [queue, setQueue] = useState<LocalPackageInfo[]>([])
  const applyResult = useCallback(
    (result: AddLocalResult): void => {
      refresh()
      setErrors(result.errors.map((entry) => entry.message))
      setQueue(installable(result, selectedPrinter))
    },
    [refresh, selectedPrinter?.id, selectedPrinter?.status],
  )
  const dragging = useDropTarget(applyResult)
  const current = queue[0]

  return (
    <>
      {dragging && (
        <div className="local-drop-overlay">
          <div className="local-drop-card">{t('store.drop.overlay')}</div>
        </div>
      )}
      {errors.length > 0 && (
        <ConfirmActionDialog
          title={t('store.drop.error_title')}
          summary={errors.length === 1 ? errors[0] : t('store.drop.error_count', { count: errors.length })}
          detail={errors.join('  ·  ')}
          confirmLabel={t('btn.ok')}
          onConfirm={() => setErrors([])}
          onCancel={() => setErrors([])}
        />
      )}
      {errors.length === 0 && current && (
        <ConfirmActionDialog
          title={t('store.drop.install_title', { plugin: current.title })}
          summary={t('store.drop.install_summary', { plugin: current.title, version: current.version, printer: selectedPrinter?.nick ?? '' })}
          detail={current.metadataComplete ? t('store.drop.added_detail') : t('store.drop.metadata_hint')}
          confirmLabel={t('store.drop.install_now')}
          onConfirm={() => {
            setQueue(queue.slice(1))
            onInstall(current.id)
          }}
          onCancel={() => setQueue(queue.slice(1))}
        />
      )}
    </>
  )
}
