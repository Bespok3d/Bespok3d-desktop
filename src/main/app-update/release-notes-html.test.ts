// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { releaseNotesFromHtml } from './release-notes-html'

describe('releaseNotesFromHtml', () => {
  it('reads the feed\'s escaped html, not raw markup', () => {
    expect(releaseNotesFromHtml('&lt;p&gt;Fixes the update pane&lt;/p&gt;')).toBe('Fixes the update pane')
  })

  it('keeps a bullet list as a bullet list', () => {
    const feedBody = '&lt;ul&gt;&lt;li&gt;anonymous updates&lt;/li&gt;&lt;li&gt;rollback&lt;/li&gt;&lt;/ul&gt;'

    expect(releaseNotesFromHtml(feedBody)).toBe('- anonymous updates\n- rollback')
  })

  it('keeps headings, links, emphasis and inline code', () => {
    const feedBody = '&lt;h2&gt;Fixed&lt;/h2&gt;&lt;p&gt;&lt;a href="https://b3d.test/x"&gt;the &lt;strong&gt;pane&lt;/strong&gt;&lt;/a&gt; and &lt;code&gt;rollback&lt;/code&gt;&lt;/p&gt;'

    expect(releaseNotesFromHtml(feedBody)).toBe('## Fixed\n\n[the **pane**](https://b3d.test/x) and `rollback`')
  })

  it('fences a code block', () => {
    const feedBody = '&lt;pre&gt;&lt;code&gt;npm run build&lt;/code&gt;&lt;/pre&gt;'

    expect(releaseNotesFromHtml(feedBody)).toBe('```\nnpm run build\n```')
  })

  // A written-out entity is text the author typed, not markup: decoding the ampersand first would
  // manufacture a tag and then strip it, silently eating the words around it.
  it('keeps a written-out tag as text', () => {
    expect(releaseNotesFromHtml('&lt;p&gt;use &amp;lt;b&amp;gt; here&lt;/p&gt;')).toBe('use <b> here')
  })

  it('drops a tag it does not know and keeps the words', () => {
    expect(releaseNotesFromHtml('&lt;details&gt;&lt;summary&gt;more&lt;/summary&gt;detail&lt;/details&gt;')).toBe('moredetail')
  })
})
