// Create surface data shapes. These mirror the manifest WHAT fields (ADR-0026): a class, never a path.

export type BuildState =
  | 'dirty'
  | 'building'
  | 'build-failed'
  | 'built'
  | 'installing'
  | 'installed'
  | 'out-of-date'

export type CheckStatus = 'pass' | 'warn' | 'fail'

export interface WorkbenchDraft {
  id: string
  name: string
  title: string
  tagline: string
  stage: number
  category: string
  version: string
  build: BuildState
  fileCount: number
  sizeKB: number
  example: boolean
}

export interface DestClass {
  id: string
  label: string
  blurb: string
  verbs: string[]
  nerd?: boolean
}

export interface VarType {
  id: string
  label: string
}

export interface DraftVariable {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'toggle'
  options?: string[]
  default: string | number | boolean
  required: boolean
  hint: string
}

export interface ProvidedService {
  service: string
  exclusive: boolean
}

export interface RequiredService {
  service: string
  selector: string
  cardinality: string
  resolvedBy: string
  optional: boolean
}

export interface ManagedServiceSpec {
  command: string
  autostart: boolean
  port: number
  venv: string
}

export interface CoachCheck {
  id: string
  label: string
  section: string
  status: CheckStatus
  detail: string
}

export interface WorkbenchSection {
  id: string
  label: string
  icon: string
  tint: string
  tier: string
  blurb: string
}

export interface DraftFile {
  name: string
  cls: string
  conf: number
  doc?: boolean
}

export interface MacroTunable {
  key: string
  label: string
  type: 'number' | 'select'
  unit?: string
  default: number | string
  min?: number
  max?: number
  options?: string[]
  hint: string
}

export interface MacroStarter {
  id: string
  title: string
  blurb: string
  category: string
  icon: string
  accent: string
  installs: number
  body: string
  tunables: MacroTunable[]
}

export interface SavedMacro {
  id: string
  title: string
  blurb: string
  fromLibrary: string | null
  installedOn: string[]
  updatedAt: string
}
