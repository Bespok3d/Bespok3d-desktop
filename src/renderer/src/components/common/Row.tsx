import cx from '../../utils/cx'
import './row.css'

interface RowProps {
  icon: React.ReactNode
  children: React.ReactNode
  controls?: React.ReactNode
  className?: string
}

export function Row({ icon, children, controls, className }: RowProps) {
  return (
    <div className={cx('set-row', className)}>
      {icon}
      <div className="set-row-text">{children}</div>
      {controls && <div className="set-row-control">{controls}</div>}
    </div>
  )
}
