import { readFileSync } from 'fs'
import { join } from 'path'

// The device-agnostic in-vitro test contract. An adapter publishes `testkit/fixture.json` declaring the
// fake device the runner stands up; placeholders ($BESPOK3D, $KLIPPER_EXTRAS, ...) resolve against the
// adapter's `jinni/paths.json`, so paths are declared once. This loader is the only place that reads it,
// and it never knows any specific device.

export interface FixtureSsh {
  user: string
  password: string
  port: number
}

export interface SkeletonFile {
  path: string
  content: string
}

export interface ResolvedFixture {
  ssh: FixtureSsh
  baseImage: string
  daemonVenvDir?: string
  seedDir?: string
  skeleton: { dirs: string[]; files: SkeletonFile[] }
  services: Record<string, unknown>
  postEnroll: { dirs: string[]; files: string[] }
}

// Mirror the daemon's _expand: substitute longest keys first so $BESPOK3D_KLIPPER wins over $BESPOK3D.
function expand(value: string, paths: Record<string, string>): string {
  const byLengthDesc = Object.keys(paths).sort((left, right) => right.length - left.length)

  return byLengthDesc.reduce((current, key) => current.split(`$${key}`).join(paths[key]), value)
}

export function loadFixture(adapterDir: string): ResolvedFixture {
  const paths = JSON.parse(readFileSync(join(adapterDir, 'jinni', 'paths.json'), 'utf8')) as Record<string, string>
  const raw = JSON.parse(readFileSync(join(adapterDir, 'testkit', 'fixture.json'), 'utf8'))

  return {
    ssh: raw.ssh,
    baseImage: raw.baseImage,
    daemonVenvDir: raw.daemonVenvDir ? expand(raw.daemonVenvDir, paths) : undefined,
    seedDir: raw.skeleton.seed ? join(adapterDir, 'testkit', raw.skeleton.seed) : undefined,
    skeleton: {
      dirs: raw.skeleton.dirs.map((dir: string) => expand(dir, paths)),
      files: raw.skeleton.files.map((file: SkeletonFile) => ({ path: expand(file.path, paths), content: file.content })),
    },
    services: raw.services,
    postEnroll: {
      dirs: raw.postEnroll.dirs.map((dir: string) => expand(dir, paths)),
      files: raw.postEnroll.files.map((file: string) => expand(file, paths)),
    },
  }
}
