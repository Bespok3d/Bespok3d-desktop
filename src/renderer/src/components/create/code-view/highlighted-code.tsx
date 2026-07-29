// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { highlightCode } from './shared'

function CodeLine({ line }: { line: string }) {
  const trimmed = line.trimStart()
  const keyMatch = /^(\s*)([a-z_][a-z0-9_]*)(:)(.*)$/.exec(line)
  if (trimmed.startsWith('[')) return <div className="ce-line"><span className="tok-sectype">{line}</span></div>
  if (keyMatch) {
    return (
      <div className="ce-line">{keyMatch[1]}<span className="tok-cfgkey">{keyMatch[2]}</span><span className="tok-colon">:</span>{highlightCode(keyMatch[4])}</div>
    )
  }

  return <div className="ce-line">{line === '' ? '​' : highlightCode(line)}</div>
}

export function HighlightedCode({ code }: { code: string }) {
  return <pre className="ce-pre">{code.split('\n').map((line, index) => <CodeLine key={index} line={line} />)}</pre>
}
