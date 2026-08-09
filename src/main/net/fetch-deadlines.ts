// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// How long a read off the network may take, in one place, because a package is downloaded by two
// different routes: the public one and the one signed in with an account. The two carried different
// deadlines (the account route carried none at all), so which one a person happened to take decided
// whether their install could finish, stall forever, or be cut off part-way.

// A plugin list is a few KB of JSON, and a host that has not answered in eight seconds is not going to.
export const LIST_FETCH_TIMEOUT_MS = 8000

// A package is tens of megabytes, and this deadline covers the download of the body, not just the wait
// for an answer. The list's eight seconds gave the 34MB Tailscale package a floor of 4.3 MB/s to beat
// or the install was aborted part-way through, so a slower connection could never install it at all.
// A package download instead gets the same allowance the upload of that package to the printer gets:
// slow is allowed, stalled is not.
export const PACKAGE_FETCH_TIMEOUT_MS = 300000
