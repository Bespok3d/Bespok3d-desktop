// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
export type Repo = { owner: string; repo: string }
export type Account = GitHostAccount
export type Settings = GitHostSettings
export type ConnRequest = GitHostConnectionRequest
export type PaneState = 'loading' | 'disconnected' | 'connecting' | 'connected'
