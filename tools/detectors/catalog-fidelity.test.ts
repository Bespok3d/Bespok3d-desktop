import { describe, it, expect } from 'vitest'
// @ts-expect-error - gate detector, plain JS with no type declarations
import { storyFakesInText, prodStandInsInText, topLevelDefs } from './catalog-fidelity-detector.mjs'

function fakeNames(text: string): string[] {
  return storyFakesInText(text).map((fake: { name: string }) => fake.name)
}

describe('catalog-fidelity detector: faithful stories pass', () => {
  it('passes a thin wrapper that renders an imported component', () => {
    const story = `import { Button } from './Button'
export default { title: 'x' }
function Wrapper() { return <Button>Go</Button> }
export function Ok() { return <Wrapper /> }`
    expect(storyFakesInText(story)).toEqual([])
  })

  it('passes a layout frame that forwards children', () => {
    const story = `export default { title: 'x' }
function Frame({ children }: { children: unknown }) { return <div className="frame">{children}</div> }
export function Ok() { return <Frame>hi</Frame> }`
    expect(storyFakesInText(story)).toEqual([])
  })

  it('passes an exported story rendering only intrinsics (a story is not a stand-in component)', () => {
    const story = `export default { title: 'x' }
export function EmptyState() { return <div className="empty"><p>Nothing here</p></div> }`
    expect(storyFakesInText(story)).toEqual([])
  })

  it('does not flag fixture DATA consts, only JSX-returning components', () => {
    const story = `export default { title: 'x' }
const FakePrinter = { id: '1', nick: 'unU1' }
export function Ok() { return <div>{FakePrinter.nick}</div> }`
    expect(storyFakesInText(story)).toEqual([])
  })
})

describe('catalog-fidelity detector: stand-ins are flagged', () => {
  it('flags a Dummy-named component (the DummyLogModal that triggered the gate)', () => {
    const story = `export default { title: 'x' }
function DummyLogModal() { return <div className="modal"><button>Close</button></div> }
export function Shown() { return <DummyLogModal /> }`
    expect(fakeNames(story)).toEqual(['DummyLogModal'])
  })

  it('flags an intrinsic-only helper with no tell-tale name', () => {
    const story = `export default { title: 'x' }
function LogModalView() { return <div className="log"><span>fabricated</span></div> }
export function Shown() { return <LogModalView /> }`
    expect(fakeNames(story)).toEqual(['LogModalView'])
  })

  it('honors a gate-allow on the preceding line', () => {
    const story = `export default { title: 'x' }
// gate-allow stories_fake_component: empty-state showcase, renders no real component by design
function EmptyShowcase() { return <div className="empty">no printers</div> }
export function Shown() { return <EmptyShowcase /> }`
    expect(storyFakesInText(story)).toEqual([])
  })
})

describe('catalog-fidelity detector: production', () => {
  it('flags a Fake* definition in shipped source', () => {
    const code = `export function FakeSensor() { return 1 }`
    expect(prodStandInsInText(code).map((fake: { name: string }) => fake.name)).toEqual(['FakeSensor'])
  })

  it('leaves normal production symbols alone', () => {
    const code = `export function StatusPill() { return null }
export const TIMEOUT_MS = 500`
    expect(prodStandInsInText(code)).toEqual([])
  })
})

describe('topLevelDefs', () => {
  it('reads each top-level definition with its export flag', () => {
    const text = `function helper() {}
export function Widget() { return <div /> }`
    const defs = topLevelDefs(text)
    expect(defs.map((def: { name: string; exported: boolean }) => [def.name, def.exported])).toEqual([
      ['helper', false],
      ['Widget', true],
    ])
  })
})
