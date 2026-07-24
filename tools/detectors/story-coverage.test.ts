import { describe, it, expect } from 'vitest'
// @ts-expect-error - gate detector, plain JS with no type declarations
import { storyCoverage, uncoveredInText } from './story-coverage-detector.mjs'

function coverageFrom(stories: { rel: string; text: string }[]) {
  return storyCoverage(stories)
}
function uncoveredNames(text: string, rel: string, coverage: ReturnType<typeof coverageFrom>): string[] {
  return uncoveredInText(text, rel, coverage).map((hit: { name: string }) => hit.name)
}

const NO_STORIES = coverageFrom([])

describe('story-coverage detector: what counts as uncovered', () => {
  it('flags an exported renderer component with no story coverage', () => {
    const code = `export function PluginCard() { return <div className="card" /> }`
    expect(uncoveredNames(code, 'components/store/PluginCard.tsx', NO_STORIES)).toEqual(['PluginCard'])
  })

  it('does not flag a non-exported internal sub-component', () => {
    const code = `function CardAvatar() { return <img /> }
export function PluginCard() { return <CardAvatar /> }`
    expect(uncoveredNames(code, 'components/store/PluginCard.tsx', NO_STORIES)).toEqual(['PluginCard'])
  })

  it('does not flag an exported function that returns no JSX (not a component)', () => {
    const code = `export function formatCount(n: number) { return String(n) }`
    expect(uncoveredNames(code, 'data/format.tsx', NO_STORIES)).toEqual([])
  })
})

describe('story-coverage detector: what counts as covered', () => {
  it('credits a component referenced by name in a story (import or render)', () => {
    const coverage = coverageFrom([{ rel: 'components/store/x.stories.tsx', text: `import { PluginCard } from './PluginCard'` }])
    expect(uncoveredNames(`export function PluginCard() { return <div /> }`, 'components/store/PluginCard.tsx', coverage)).toEqual([])
  })

  it('credits every component in a directory that owns a story (the surface renders them)', () => {
    const coverage = coverageFrom([{ rel: 'components/store/index.stories.tsx', text: `export default { title: 'Store' }` }])
    const code = `export function PluginCard() { return <div /> }
export function PluginRow() { return <div /> }`
    expect(uncoveredNames(code, 'components/store/PluginCard.tsx', coverage)).toEqual([])
  })

  it('does not credit a component in a different directory from the story', () => {
    const coverage = coverageFrom([{ rel: 'components/store/index.stories.tsx', text: `export default { title: 'Store' }` }])
    expect(uncoveredNames(`export function Header() { return <div /> }`, 'components/header/Header.tsx', coverage)).toEqual(['Header'])
  })
})

describe('story-coverage detector: gate-allow', () => {
  it('honors a gate-allow on the export line', () => {
    const code = `export function ErrorBoundary() { return <div /> } // gate-allow components_without_story: render-only fallback, no catalog value`
    expect(uncoveredNames(code, 'components/ErrorBoundary.tsx', NO_STORIES)).toEqual([])
  })

  it('requires a reason: a bare gate-allow does not exempt', () => {
    const code = `// gate-allow components_without_story
export function ErrorBoundary() { return <div /> }`
    expect(uncoveredNames(code, 'components/ErrorBoundary.tsx', NO_STORIES)).toEqual(['ErrorBoundary'])
  })
})
