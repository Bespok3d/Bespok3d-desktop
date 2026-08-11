// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makePlugin } from '../../../test/fixtures'
import { B3dRefProvider } from '../../common/content/Markdown'
import { PluginPanel } from '.'

const DESCRIPTION_POINTING_AT_ANOTHER_PLUGIN =
  'Also install [webcam-builtin](b3d://bespok3d/webcam-builtin) for the built-in camera.'

describe('PluginPanel description', () => {
  it('turns a b3d link in the description into one the reader can click', () => {
    const openReferencedPlugin = vi.fn()
    setup(
      <B3dRefProvider onRef={openReferencedPlugin}>
        <PluginPanel
          plugin={makePlugin({ id: 'u1-hw-camera', description: DESCRIPTION_POINTING_AT_ANOTHER_PLUGIN })}
          installed={false} hasUpdate={false} allInstalledIds={[]} onClose={vi.fn()} onOperationDone={vi.fn()}
        />
      </B3dRefProvider>,
      { withCatalog: true, catalog: [] },
    )

    fireEvent.click(screen.getByRole('link', { name: 'webcam-builtin' }))

    expect(openReferencedPlugin).toHaveBeenCalledWith(expect.objectContaining({ name: 'webcam-builtin' }))
  })
})
