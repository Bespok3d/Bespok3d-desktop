<!-- SPDX-FileCopyrightText: Copyright (C) 2026 Luciano Colosio -->
<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->

Exact `src/main/app-update/{index,view,public-releases,feed}.ts` source and the `electron-updater` lock entry from desktop tag `v0.7.6-beta`. The three provider modules are the corresponding published `electron-updater@6.8.3` package files (MIT); they are replayed by `legacy-reader-path.test.mjs` with a local fake executor and no network access.
