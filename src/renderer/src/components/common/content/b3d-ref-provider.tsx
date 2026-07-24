import type { ReactNode } from 'react'
import type { B3dEntityRef } from '../../../data/b3d-ref'
import { B3dRefContext } from './b3d-ref-context'

// Wrap any subtree that renders Markdown so its b3d:// entity links resolve through `onRef`,
// without threading a prop through every Markdown call site.
export function B3dRefProvider({ onRef, children }: { onRef: (ref: B3dEntityRef) => void; children: ReactNode }) {
  return <B3dRefContext.Provider value={onRef}>{children}</B3dRefContext.Provider>
}
