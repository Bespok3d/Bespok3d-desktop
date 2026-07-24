// Shared test fixture: a complete cpu-temp plugin manifest, used by the build-index drift test and
// the store ingest test. One copy so the two suites cannot drift apart.
export const CPU_TEMP_MANIFEST = {
  name: 'cpu-temp',
  title: 'CPU Temperature',
  version: '0.1.2',
  description: 'desc',
  tagline: 'tag',
  category: 'sensors',
  channel: 'stable',
  printer_specific: true,
  published_at: '2026-02-25',
  updated_at: '2026-02-25',
  publisher: 'PLACEHOLDER',
  provides: [{ service: 'cpu-temp-sensor' }],
  require: [],
  conflicts: [],
  requires: { capabilities: ['klipper-generic'] },
  install: { place: [{ class: 'klipper-config', src: 'files/cfg/klipper/cpu-temp.cfg' }], restart: ['klipper'] },
}
