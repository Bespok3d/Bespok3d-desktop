// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { SOURCE_REPOSITORY_URL } from '../../../utils/source-repository'

export const ABOUT_LINK_URLS = {
  release_notes: `${SOURCE_REPOSITORY_URL}/releases`,
  docs: `${SOURCE_REPOSITORY_URL}/wiki`,
  github: SOURCE_REPOSITORY_URL,
  report_issue: `${SOURCE_REPOSITORY_URL}/issues`,
  buy_coffee: 'https://buymeacoffee.com/unlucio',
} as const

export type AboutLinkName = keyof typeof ABOUT_LINK_URLS

export const ABOUT_LINK_ROW_ORDER: AboutLinkName[] = ['release_notes', 'docs', 'github', 'report_issue']
