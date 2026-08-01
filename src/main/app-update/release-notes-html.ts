// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The public release feed carries a release body as RENDERED HTML, while the What's New group and the
// update modal render markdown. This turns the one into the other for the tags a release body actually
// uses; anything else loses its tag and keeps its text, which reads as a plain paragraph rather than
// as markup a reader was never meant to see.
//
// Kept to a hand-written subset on purpose: pulling an HTML-to-markdown library into the main process
// for output nobody edits and everybody only reads costs more than the subset it would replace.

const XML_ENTITIES: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&nbsp;': ' ',
}

// Ampersand last: decoding it first would turn a written-out `&amp;lt;` into a tag the author never
// wrote and this would then strip.
function decodeEntities(text: string): string {
  const named = Object.keys(XML_ENTITIES).reduce((carried, entity) => carried.split(entity).join(XML_ENTITIES[entity]), text)
  const numbered = named.replace(/&#(\d+);/g, (_whole, code: string) => String.fromCharCode(Number(code)))

  return numbered.split('&amp;').join('&')
}

function headingsToMarkdown(html: string): string {
  return html.replace(
    /<h([1-6])[^>]*>([\s\S]*?)<\/h[1-6]>/gi,
    (_whole, level: string, text: string) => `\n\n${'#'.repeat(Number(level))} ${text.trim()}\n\n`,
  )
}

// Order matters: a fenced block is taken before inline code so a code sample keeps its own newlines,
// and every tag that carries structure is spent before the sweep that drops whatever is left.
const HTML_TO_MARKDOWN: Array<[RegExp, string]> = [
  [/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, '\n```\n$1\n```\n'],
  [/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1'],
  [/<\/(ul|ol)>/gi, '\n'],
  [/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)'],
  [/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`'],
  [/<(strong|b)>([\s\S]*?)<\/(strong|b)>/gi, '**$2**'],
  [/<(em|i)>([\s\S]*?)<\/(em|i)>/gi, '_$2_'],
  [/<br\s*\/?>/gi, '\n'],
  [/<\/p>/gi, '\n\n'],
  [/<hr\s*\/?>/gi, '\n---\n'],
  [/<[^>]+>/g, ''],
]

function applyRules(html: string): string {
  return HTML_TO_MARKDOWN.reduce((carried, [pattern, replacement]) => carried.replace(pattern, replacement), html)
}

export function releaseNotesFromHtml(html: string): string {
  const markdown = applyRules(headingsToMarkdown(decodeEntities(html)))

  return decodeEntities(markdown).replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim()
}
