// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useAsyncResource } from '../../common/hooks/useAsyncResource'

// A store page shows the words of the version it is offering. A plugin release publishes its README and
// its release notes beside the package, so the page reads them when it opens instead of showing the copy
// compiled into the app, which only ever changes on an app release. The bundled copy is what shows while
// that read is in flight, when the publisher released no docs, and when the machine cannot reach them.
export function useReleasedDoc(assetUrl: string | undefined, bundled: string | undefined): string | undefined {
  const released = useAsyncResource(() => readReleasedDoc(assetUrl), [assetUrl])

  return released.value ?? bundled
}

// A read that did not arrive is not an error the page can act on: the words it already shows are the
// ones the app was built with, so the answer is to keep showing them.
function readReleasedDoc(assetUrl: string | undefined): Promise<string | null> {
  return assetUrl === undefined
    ? Promise.resolve(null)
    : window.b3d.registry.releaseDoc(assetUrl).then((released) => released.text)
}
