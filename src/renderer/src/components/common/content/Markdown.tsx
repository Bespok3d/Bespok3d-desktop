// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createContext, useContext } from 'react'
import type { AnchorHTMLAttributes, ImgHTMLAttributes, ReactNode } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { isB3dUrl, parseEntityRef, type B3dEntityRef } from '../../../data/b3d-ref'
import { B3dRefContext } from './b3d-ref-context'
import './markdown.css'

export { B3dRefProvider } from './b3d-ref-provider'

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov']

const DocAssetsContext = createContext<Record<string, string>>({})

function isVideo(src: string): boolean {
  return VIDEO_EXTENSIONS.some((extension) => src.toLowerCase().endsWith(extension))
}

function resolveSrc(src: string | undefined, assets: Record<string, string>): string {
  if (!src) return ''
  const key = src.replace(/^\.\//, '')

  return assets[key] ?? src
}

function DocAnchor({ node, href, children, ...anchorProps }: AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown }) {
  void node
  const onB3dRef = useContext(B3dRefContext)
  if (href && isB3dUrl(href)) return <B3dAnchor href={href} onB3dRef={onB3dRef}>{children}</B3dAnchor>

  return <a {...anchorProps} href={href} target="_blank" rel="noreferrer">{children}</a>
}

function B3dAnchor({ href, onB3dRef, children }: { href: string; onB3dRef: ((ref: B3dEntityRef) => void) | null; children?: ReactNode }) {
  const ref = parseEntityRef(href)
  if (!ref || !onB3dRef) return <span className="b3d-ref-dead">{children}</span>

  return <a className="b3d-ref" href={href} onClick={(clickEvent) => { clickEvent.preventDefault(); onB3dRef(ref) }}>{children}</a>
}

function DocImage({ node, src, alt }: ImgHTMLAttributes<HTMLImageElement> & { node?: unknown }) {
  void node
  const assets = useContext(DocAssetsContext)
  const resolved = resolveSrc(typeof src === 'string' ? src : '', assets)
  if (isVideo(resolved)) {
    return <video className="markdown-media" src={resolved} controls preload="metadata" />
  }

  return <img className="markdown-media" src={resolved} alt={alt ?? ''} loading="lazy" />
}

const MARKDOWN_COMPONENTS: Components = { 'a': DocAnchor, 'img': DocImage }

// Our docs are written in GitHub-flavoured markdown: without this the attribution tables render as a
// run of pipe characters and every plugin's credits become unreadable.
const MARKDOWN_PLUGINS = [remarkGfm]

// react-markdown's default sanitizer strips any non http/https/mailto/tel href, which would drop our
// in-app b3d:// entity links. Allow b3d:// through and keep the default sanitization for everything
// else (so javascript: etc. is still neutralized).
function transformUrl(url: string): string {
  return url.startsWith('b3d://') ? url : defaultUrlTransform(url)
}

export function Markdown({ source, assets, onB3dRef }: { source: string; assets?: Record<string, string>; onB3dRef?: (ref: B3dEntityRef) => void }) {
  const body = (
    <DocAssetsContext.Provider value={assets ?? {}}>
      <div className="markdown">
        <ReactMarkdown components={MARKDOWN_COMPONENTS} remarkPlugins={MARKDOWN_PLUGINS} urlTransform={transformUrl}>{source}</ReactMarkdown>
      </div>
    </DocAssetsContext.Provider>
  )
  // Absent prop -> inherit any ancestor B3dRefProvider; explicit prop -> override for this subtree.
  if (onB3dRef === undefined) return body

  return <B3dRefContext.Provider value={onB3dRef}>{body}</B3dRefContext.Provider>
}
