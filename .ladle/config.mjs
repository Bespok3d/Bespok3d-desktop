// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Ladle drives the live component catalog (`npm run catalog`). Stories live next to the components
// they document as `*.stories.tsx`; the catalog gives contributors every component in every state
// without standing up a real printer. The renderer's path aliases come from the sibling vite config.
/** @type {import('@ladle/react').UserConfig} */
export default {
  stories: 'src/**/*.stories.tsx',
  viteConfig: './.ladle/vite.config.ts',
  outDir: '.ladle/build',
  defaultStory: 'header--printer-dropdown--full-dropdown',
}
