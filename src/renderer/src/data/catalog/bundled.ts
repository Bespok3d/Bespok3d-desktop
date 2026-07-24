import type { Category, Channel, PrinterAdapter } from '../types'

// Static UI config that is NOT registry-published plugin data: release channels, the catalog
// category list, and the local printer adapters. The plugin catalog itself now loads from the
// generated index.json via data/catalog-context.tsx (useCatalog); the doc-asset glob and the
// snake -> camel mapping live in data/catalog.ts.

export const CHANNELS: Channel[] = [
  { id: 'lts',        label: 'LTS',        short: 'LTS',    description: 'Long-term support. Thoroughly tested, quarterly cadence.',   cadence: 'Quarterly', tone: 'lts',        defaultOn: true  },
  { id: 'stable',     label: 'Stable',     short: 'Stable', description: 'Production-ready releases. Bi-weekly cadence.',              cadence: 'Bi-weekly', tone: 'stable',     defaultOn: true  },
  { id: 'rc',         label: 'RC',         short: 'RC',     description: 'Release candidates. Mostly stable; some rough edges.',       cadence: 'Weekly',    tone: 'rc',         defaultOn: true  },
  { id: 'testing',    label: 'Testing',    short: 'Test',   description: 'Early access builds. May have known issues.',                 cadence: 'Daily',     tone: 'testing',    defaultOn: true  },
  { id: 'experiment', label: 'Experiment', short: 'Exp',    description: 'Proof-of-concept. Expect breakage; do not use on printers you need.', cadence: 'Ad-hoc', tone: 'experiment', defaultOn: true  },
]

export const BUNDLED_CATEGORIES: Category[] = [
  { id: 'camera',  title: 'Camera',  sub: 'Streaming, controls, timelapse', icon: '📷' },
  { id: 'filament', title: 'Filament', sub: 'Spool tracking and runout',    icon: '🧵' },
  { id: 'screen',  title: 'Screen',  sub: 'On-device and remote UI',        icon: '🖥' },
  { id: 'ui',      title: 'Web UI',  sub: 'Alternative web frontends',      icon: '🌐' },
  { id: 'tuning',  title: 'Tuning',  sub: 'Motion and stepper tuning',      icon: '🎚' },
  { id: 'sensors', title: 'Sensors', sub: 'Temperatures and monitoring',    icon: '🌡' },
  { id: 'system',  title: 'System',  sub: 'Access and server settings',     icon: '⚙️' },
  { id: 'printing', title: 'Printing', sub: 'Print-start and slicing behavior', icon: '🧱' },
]

export const BUNDLED_ADAPTERS: PrinterAdapter[] = [
  {
    id: 'snapmaker-u1',
    title: 'Snapmaker U1',
    vendor: 'Snapmaker',
    version: '1.2.0',
    channel: 'stable',
    trust: 'manufacturer',
    description: 'Klipper + Snapmaker firmware bridge.',
  },
  {
    id: 'voron-24',
    title: 'Voron 2.4',
    vendor: 'Voron Design',
    version: '0.8.4',
    channel: 'stable',
    trust: 'community',
    description: 'Generic Klipper bridge for stock Voron 2.4 builds.',
  },
  {
    id: 'klipper-generic',
    title: 'Klipper: generic',
    vendor: 'Bespok3d',
    version: '0.4.0',
    channel: 'lts',
    trust: 'project',
    description: 'Bare Klipper bridge with no vendor-specific bits.',
  },
]
