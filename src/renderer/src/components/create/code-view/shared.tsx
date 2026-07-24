import type { ReactNode } from 'react'

// A light, read-only Klipper/Jinja highlighter for the macro preview (the prototype's full editable
// tokenizer is not needed here). Colors interpolation, strings, comments, section headers, config keys.

const SEGMENT = /(\{[^}]*\}|#.*$|"[^"]*")/

function segClass(segment: string): string {
  if (segment.startsWith('#')) return 'tok-comment'
  if (segment.startsWith('{')) return 'tok-interp'
  if (segment.startsWith('"')) return 'tok-str'

  return ''
}

export function highlightCode(code: string): ReactNode[] {
  return code.split(SEGMENT).filter((segment) => segment !== '').map((segment, index) => {
    const cls = segClass(segment)

    return cls ? <span key={index} className={cls}>{segment}</span> : <span key={index}>{segment}</span>
  })
}
