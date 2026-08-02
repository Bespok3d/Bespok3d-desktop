// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Values baked into the main bundle when the build is made, the same way the renderer takes
// __APP_VERSION__. The analytics project key is a build-time value on purpose rather than something
// read from the environment at runtime: a checkout with no key in the shell still builds and still
// gates green, and the key it lacks is simply an empty string that can never send anything.
declare const __ANALYTICS_PROJECT_TOKEN__: string
