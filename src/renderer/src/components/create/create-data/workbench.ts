// Workbench authoring data. The authoring backend is not wired yet, so the workbench shows example
// drafts (flagged) to give the layout realistic content for the A/B test. Curated starter values are real.
import type {
  WorkbenchDraft, DestClass, VarType, DraftFile, DraftVariable,
  ProvidedService, RequiredService, ManagedServiceSpec, CoachCheck, WorkbenchSection,
} from './types'

export const WORKBENCH_DRAFTS: WorkbenchDraft[] = [
  { id: 'spool-color-detect', name: 'spool-color-detect', title: 'Spool Color Detect', tagline: 'Reads the color of the loaded filament from the toolhead camera.', stage: 2, category: 'filament', version: '0.3.0', build: 'dirty', fileCount: 18, sizeKB: 412, example: true },
  { id: 'chamber-light', name: 'chamber-light', title: 'Chamber Light', tagline: 'Macro pack plus a tiny web toggle for the chamber LED.', stage: 1, category: 'macros', version: '1.1.0', build: 'installed', fileCount: 4, sizeKB: 36, example: true },
  { id: 'klipper-backup', name: 'klipper-backup', title: 'Config Backup', tagline: 'Snapshots printer.cfg to a git repo on a schedule.', stage: 2, category: 'macros', version: '0.6.2', build: 'out-of-date', fileCount: 9, sizeKB: 88, example: true },
]

export const DEST_CLASSES: DestClass[] = [
  { id: 'klipper-config', label: 'Klipper config', blurb: 'A .cfg include for Klipper. Macros, sections, overrides.', verbs: ['place', 'render'] },
  { id: 'moonraker-config', label: 'Moonraker config', blurb: 'A config block for Moonraker.', verbs: ['place'] },
  { id: 'klipper-extra', label: 'Klipper extra', blurb: 'A Python module dropped into klippy/extras.', verbs: ['place'] },
  { id: 'moonraker-component', label: 'Moonraker component', blurb: 'A Python component for Moonraker.', verbs: ['place'] },
  { id: 'web-asset', label: 'Web asset', blurb: 'Static files served to the browser. JS, CSS, images.', verbs: ['place'] },
  { id: 'web-location', label: 'Web location', blurb: 'A URL path the plugin answers on.', verbs: ['place'] },
  { id: 'bin', label: 'Binary', blurb: 'A compiled executable. Runs on the printer.', verbs: ['place'] },
  { id: 'udev-rule', label: 'udev rule', blurb: 'A device rule, e.g. naming a USB camera.', verbs: ['place'] },
  { id: 'managed-service', label: 'Managed service', blurb: 'A long-running process Bespok3d supervises.', verbs: ['service'] },
  { id: 'klipper-source', label: 'Klipper patch', blurb: 'A diff against a stock Klipper file. Uses snap-to-place.', verbs: ['instrument'], nerd: true },
]

export const VAR_TYPES: VarType[] = [
  { id: 'text', label: 'Text' },
  { id: 'number', label: 'Number' },
  { id: 'select', label: 'Choice' },
  { id: 'toggle', label: 'On / off' },
  { id: 'port', label: 'Port' },
]

export const DRAFT_FILES: DraftFile[] = [
  { name: 'color_detect.py', cls: 'klipper-extra', conf: 0.98 },
  { name: 'color_api.py', cls: 'moonraker-component', conf: 0.95 },
  { name: 'color-detect', cls: 'bin', conf: 0.9 },
  { name: 'color.cfg', cls: 'klipper-config', conf: 0.99 },
  { name: 'web/panel.js', cls: 'web-asset', conf: 0.97 },
  { name: 'web/panel.css', cls: 'web-asset', conf: 0.97 },
  { name: '99-color-cam.rules', cls: 'udev-rule', conf: 0.72 },
  { name: 'README.md', cls: 'doc', conf: 1.0, doc: true },
]

export const DRAFT_VARIABLES: DraftVariable[] = [
  { key: 'CAMERA_DEVICE', label: 'Camera', type: 'select', options: ['toolhead', 'chamber', 'usb0'], default: 'toolhead', required: true, hint: 'Which camera to sample color from.' },
  { key: 'SAMPLE_REGION', label: 'Sample size', type: 'number', default: 48, required: false, hint: 'Square of pixels to average, in the frame center.' },
  { key: 'SYNC_SPOOLMAN', label: 'Update Spoolman', type: 'toggle', default: true, required: false, hint: 'Write the detected color back to the active spool.' },
]

export const DRAFT_PROVIDES: ProvidedService[] = [{ service: 'filament-color', exclusive: false }]

export const DRAFT_REQUIRES: RequiredService[] = [
  { service: 'camera', selector: 'any', cardinality: '1', resolvedBy: 'Camera HW-Accel', optional: false },
  { service: 'spoolman', selector: 'any', cardinality: '0..1', resolvedBy: 'Spoolman Bridge', optional: true },
]

export const DRAFT_MANAGED: ManagedServiceSpec = {
  command: 'color-detect --camera {CAMERA_DEVICE}',
  autostart: true,
  port: 7140,
  venv: 'shared-py311',
}

export const COACH_CHECKS: CoachCheck[] = [
  { id: 'meta', label: 'Required metadata present', section: 'metadata', status: 'pass', detail: 'name, title, tagline, category, icon.' },
  { id: 'files', label: 'Every file classified', section: 'files', status: 'pass', detail: '18 of 18 files placed in a class.' },
  { id: 'noproto', label: 'No path typing', section: 'files', status: 'pass', detail: 'All destinations are logical classes, not real paths.' },
  { id: 'perms', label: 'Permissions match classes', section: 'permissions', status: 'pass', detail: 'Declared verbs cover every placement.' },
  { id: 'vars', label: 'Variables have defaults', section: 'variables', status: 'warn', detail: 'SAMPLE_REGION is required but has no description.' },
  { id: 'services', label: 'Services resolvable', section: 'services', status: 'fail', detail: 'requires camera: no camera plugin is installed on this printer.' },
  { id: 'idempotent', label: 'Reconfigure is idempotent', section: 'managed', status: 'pass', detail: 'Service restart on reconfigure, no duplicate state.' },
]

export const WORKBENCH_SECTIONS: WorkbenchSection[] = [
  { id: 'files', label: 'Files & classes', icon: 'IconFolder', tint: 'blue', tier: 'tinkerer', blurb: 'Sort each file into what it is, not where it goes.' },
  { id: 'variables', label: 'Variables', icon: 'IconSliders', tint: 'violet', tier: 'tinkerer', blurb: 'The form your installer will fill in.' },
  { id: 'services', label: 'Services', icon: 'IconLink', tint: 'green', tier: 'tinkerer', blurb: 'What this provides, and what it needs.' },
  { id: 'managed', label: 'Managed services', icon: 'IconServer', tint: 'teal', tier: 'nerd', blurb: 'A process Bespok3d keeps running.' },
  { id: 'instrument', label: 'Instrumentation', icon: 'IconGitBranch', tint: 'rose', tier: 'nerd', blurb: 'Patch a stock Klipper file with snap-to-place.' },
  { id: 'metadata', label: 'Store listing', icon: 'IconLayers', tint: 'amber', tier: 'tinkerer', blurb: 'What the store shows. Preview it live.' },
  { id: 'permissions', label: 'Permissions', icon: 'IconShield', tint: 'magenta', tier: 'tinkerer', blurb: "What this will touch, in the consumer's words." },
]

// Each user action maps to one named op so the UI and a future MCP server are two faces of one core.
export const AUTHORING_OPS = {
  createMacro: 'create-macro-plugin',
  importFiles: 'import-files',
  classify: 'classify-file',
  setField: 'set-manifest-field',
  declareService: 'declare-service',
  declareVariable: 'declare-variable',
  declareManaged: 'declare-managed-service',
  authorDiff: 'author-diff',
  validate: 'validate',
  build: 'build',
  install: 'install-to-printer',
  sign: 'sign',
  publish: 'publish',
}
