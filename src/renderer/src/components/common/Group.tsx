import './group.css'

interface GroupProps {
  title?: string
  action?: React.ReactNode
  children: React.ReactNode
}

export function Group({ title, action, children }: GroupProps) {
  return (
    <div className="set-group">
      {(title || action) && (
        <div className="set-group-head">
          <h3 className="u-flex-1">{title}</h3>
          {action}
        </div>
      )}
      <div className="set-group-body">{children}</div>
    </div>
  )
}
