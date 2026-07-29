// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReactNode } from 'react'

const JSON_TOKEN = /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*")|(-?\d+\.?\d*)|(true|false|null)|([{}[\],])|(\s+)|([^\s]+)/g

function jsonSpan(match: RegExpMatchArray, key: number): ReactNode {
  if (match[1]) return <span key={key} className="jk">{match[1]}</span>
  if (match[2]) return <span key={key} className="js">{match[2]}</span>
  if (match[3] || match[4]) return <span key={key} className="jn">{match[3] ?? match[4]}</span>

  return <span key={key}>{match[0]}</span>
}

function jsonSpans(line: string): ReactNode[] {
  return [...line.matchAll(JSON_TOKEN)].map((match, key) => jsonSpan(match, key))
}

export function JsonCode({ code }: { code: string }) {
  return <pre className="json-pre">{code.split('\n').map((line, index) => <div key={index}>{line === '' ? '​' : jsonSpans(line)}</div>)}</pre>
}
