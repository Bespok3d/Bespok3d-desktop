#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT"
PKG="${B3D_RELEASE_PACKAGE_JSON:-$APP_DIR/package.json}"
LOCK="${B3D_RELEASE_PACKAGE_LOCK_JSON:-$APP_DIR/package-lock.json}"
# electron-builder writes installers to the central dist/ (build.directories.output = ./dist/release).
OUTPUT_DIR="${B3D_RELEASE_OUTPUT_DIR:-$REPO_ROOT/dist/release}"
# The selected channel's release host comes from scripts/channel-table.json. Uploading goes through gh
# here, so the selected channel alone decides which artifacts repository receives the release.
PUBLISH_REPO=""
TARGET=live
DRY_RUN=false
IMPORT_SIGNING_CERT=false

if [ "${1:-}" = golive ]; then
  shift
  exec node "$REPO_ROOT/scripts/golive.mjs" "$@"
fi

usage() {
  cat >&2 <<EOF
Usage: $0 [live|staging] [bump [minor|major]] [publish] [web] [--import-signing-cert] [--dry-run]
       $0 golive --staged-manifest <execution/5/staged-app.json> [--dry-run|--preflight]

  (no target)   Build Live locally (no upload).
  staging       Build Staging as the Live version plus -staging.
  bump          Raise the patch number, then build. 'bump minor' and 'bump major' raise
                 those instead. The Live maturity label ('beta') is carried over untouched.
                 With 'staging publish', requires a clean dev checkout, commits the
                 package and lock versions, and pushes dev after the verified build.
  publish       Upload the selected target's existing verified build. Does NOT rebuild.
                Live is a normal release; Staging is always a prerelease.
  web           Point the Live landing-page download buttons at this version.
  --import-signing-cert  Explicitly import CSC_LINK into a temporary macOS keychain.
                By default, macOS uses the installed Developer ID and ignores CSC_LINK.
  --dry-run     Print every build and publish command instead of running it.
                Changes nothing on disk or on GitHub. (alias: -n)

Notes:
  Publishing uploads the dist/release artifacts (installers + the latest*.yml metadata
  electron-updater reads) to the GitHub repo set in the generated electron-builder config. It
  reuses what the build produced, so 'publish' never rebuilds. Set
  BESPOK3D_DESKTOP_APP_PUBLISH_GH_TOKEN (a fine-grained PAT with Contents:write on
  Bespok3d/Bespok3d-desktop) before publishing.
  On macOS a build covers mac + windows + linux (the NSIS .exe and the AppImage build on macOS
  without wine). Only the macOS .dmg cannot be cross-built, so a Linux host builds linux +
  windows (the .exe needs wine there). Run on a Mac to cover all three.
  The Linux Flatpak is built by flatpak-builder, which runs only on Linux: a Linux host uses it
  directly, and every other host runs it in a Linux container, so a cut anywhere produces it.

  Every build is checked against the list of what a cut is made of (macOS Apple Silicon + Intel,
  Windows, Linux AppImage x86_64 + arm64, Linux Flatpak, and the updater files each one needs), and
  publishing checks the same list again against the release GitHub ended up with. A missing or
  half-uploaded platform stops the run and is named.

  Live's version is the version stored in package.json. Staging appends '-staging' for its
  build without changing that source version. A Live build preserves '-beta' in its version.

  'web' rewrites only the generated download block and the version in the landing page at
  \$BESPOK3D_WEB_INDEX (default: the sibling bespok3d-server checkout). It never deploys:
  publishing the page stays a wrangler run in that repo.
EOF
  exit 1
}

run() {
  if [ "$DRY_RUN" = true ]; then
    printf 'DRY-RUN would run:'
    printf ' %q' "$@"
    printf '\n'
    return 0
  fi
  "$@"
}

current_version() {
  node -pe "require('$PKG').version"
}

live_version() {
  node --input-type=module -e '
    import { pathToFileURL } from "node:url"
    const [appVersion, channelsPath] = process.argv.slice(1)
    const { liveVersion } = await import(pathToFileURL(channelsPath))
    process.stdout.write(liveVersion(appVersion))
  ' "$(current_version)" "$REPO_ROOT/scripts/channels.mjs"
}

version_for_target() {
  node --input-type=module -e '
    import { pathToFileURL } from "node:url"
    const [releaseTarget, liveVersionValue, channelsPath] = process.argv.slice(1)
    const { versionForChannel } = await import(pathToFileURL(channelsPath))
    process.stdout.write(versionForChannel(releaseTarget, liveVersionValue))
  ' "$TARGET" "$1" "$REPO_ROOT/scripts/channels.mjs"
}

raise_triple() {
  local triple="$1" level="$2" major minor patch
  IFS=. read -r major minor patch <<<"$triple"

  case "$level" in
    major) echo "$((major + 1)).0.0" ;;
    minor) echo "${major}.$((minor + 1)).0" ;;
    *)     echo "${major}.${minor}.$((patch + 1))" ;;
  esac
}

# Raise the version and keep whatever maturity label it carries. The label ("beta") describes the
# whole line, not the individual release, so it is never counted: the semver triple is the only
# thing that moves, and two releases are ordered by the triple alone. Dropping the label is what
# 1.0 looks like, and that is a hand edit made once.
bump_version() {
  local current base label next
  current=$(live_version)
  base="${current%%-*}"
  label="${current#"$base"}"
  next="$(raise_triple "$base" "$BUMP_LEVEL")${label}"

  if [ "$DRY_RUN" = true ]; then
    echo "DRY-RUN would bump version: $current -> $next" >&2
  else
    echo "Bumping version: $current -> $next" >&2
    node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('$PKG', 'utf8'));
const lockPath = '$LOCK';
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
if (!lock.packages?.['']) throw new Error('package-lock.json has no root package');
pkg.version = '$next';
lock.version = '$next';
lock.packages[''].version = '$next';
fs.writeFileSync('$PKG', JSON.stringify(pkg, null, 2) + '\n');
fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
"
  fi

  echo "$next"
}

# The packer signs the bundled packages with REGISTRY_SIGNING_KEY, the name every repo's CI secret
# carries and the only name it reads. A workstation namespaces its keys the way the publish token
# above is namespaced, so take that one when the CI name is unset: a release build with no key in
# reach is refused mid-build, and remembering to copy one variable into the other before every
# release is exactly the step a person forgets. An already-set REGISTRY_SIGNING_KEY wins, so a CI
# runner is never overridden by whatever a shell profile happens to hold.
adopt_signing_key() {
  if [ -n "${REGISTRY_SIGNING_KEY:-}" ] || [ -z "${BESPOK3D_REGISTRY_SIGNING_KEY:-}" ]; then
    return 0
  fi

  export REGISTRY_SIGNING_KEY="$BESPOK3D_REGISTRY_SIGNING_KEY"
  echo "Signing with BESPOK3D_REGISTRY_SIGNING_KEY" >&2
}

# macOS builds all three (mac + windows + linux) directly; only the macOS .dmg cannot be cross-built,
# so guard JUST that to a Darwin host. Always builds without uploading (--publish never); uploading is
# a separate, build-free step (publish_artifacts), so 'publish' never rebuilds.
clear_target_outputs() {
  local version="$1" target="$2" artifact artifact_path

  while IFS= read -r artifact; do
    artifact_path="$OUTPUT_DIR/$artifact"
    [ -f "$artifact_path" ] || continue
    run rm -f "$artifact_path"
  done < <(node --input-type=module -e "import { releaseArtifacts } from 'file://$REPO_ROOT/scripts/release-manifest.mjs'; console.log(releaseArtifacts('$version', '$target').map(item => item.built).join('\\n'))")
}

build_all() {
  local live_version_value="$1" app_version="$2"
  local mac_signing_arguments=(--mac --publish never)

  adopt_signing_key
  clear_target_outputs "$app_version" "$TARGET"
  [ "$DRY_RUN" = true ] || record_build_provenance "$app_version" "$TARGET"
  if [ "$IMPORT_SIGNING_CERT" = true ]; then
    mac_signing_arguments+=(--import-signing-cert)
  fi

  if [ "$(uname -s)" = "Darwin" ]; then
    echo ""
    echo "Building macOS..."
    run env B3D_CHANNEL="$TARGET" B3D_LIVE_VERSION="$live_version_value" B3D_VERSION="$app_version" B3D_PUBLISHED_CUT=true \
      npm --prefix "$APP_DIR" run "package:$TARGET" -- "${mac_signing_arguments[@]}"
  fi

  # CSC_LINK/CSC_KEY_PASSWORD hold the Apple Developer ID key for the macOS build. electron-builder
  # reads the same two variables for Windows and Linux, so leaving them set signs the .exe with the
  # Apple certificate, which Windows never trusts, and bakes the certificate's owner name into
  # app-update.yml as publisherName - after which every auto-update refuses to install.
  echo ""
  echo "Building Windows..."
  run env -u CSC_LINK -u CSC_KEY_PASSWORD -u WIN_CSC_LINK -u WIN_CSC_KEY_PASSWORD \
    -u CSC_NAME -u CSC_IDENTITY_AUTO_DISCOVERY B3D_CHANNEL="$TARGET" B3D_LIVE_VERSION="$live_version_value" \
    B3D_VERSION="$app_version" B3D_PUBLISHED_CUT=true \
    npm --prefix "$APP_DIR" run "package:$TARGET" -- --win --x64 --publish never

  echo ""
  echo "Building Linux..."
  run env -u CSC_LINK -u CSC_KEY_PASSWORD -u WIN_CSC_LINK -u WIN_CSC_KEY_PASSWORD \
    -u CSC_NAME -u CSC_IDENTITY_AUTO_DISCOVERY B3D_CHANNEL="$TARGET" B3D_LIVE_VERSION="$live_version_value" \
    B3D_VERSION="$app_version" B3D_PUBLISHED_CUT=true \
    npm --prefix "$APP_DIR" run "package:$TARGET" -- --linux --publish never

  # flatpak-builder runs only on Linux. On a Linux host it is used directly; anywhere else the same
  # tool runs in a Linux container against this build, so every cut produces the Flatpak on whatever
  # machine it is cut from.
  echo ""
  echo "Building Linux Flatpak..."
  if command -v flatpak-builder > /dev/null; then
    run env B3D_CHANNEL="$TARGET" B3D_LIVE_VERSION="$live_version_value" B3D_VERSION="$app_version" \
      B3D_PUBLISHED_CUT=true npm --prefix "$APP_DIR" run "package:$TARGET" -- --linux flatpak --publish never
  else
    run env B3D_CHANNEL="$TARGET" B3D_LIVE_VERSION="$live_version_value" B3D_VERSION="$app_version" \
      B3D_PUBLISHED_CUT=true "$APP_DIR/scripts/flatpak-build.sh"
  fi

  echo ""
  [ "$DRY_RUN" = true ] && echo "DRY-RUN would build $TARGET $app_version into $OUTPUT_DIR/" || echo "Built $TARGET $app_version into $OUTPUT_DIR/"

  verify_built "$app_version" "$TARGET"
}

# A cut is only finished when every platform is in it. The list of what "every platform" means lives
# in scripts/release-manifest.mjs, which the landing page reads too, and scripts/verify-release.mjs is
# what holds the build to it: a missing installer, an empty file, or an updater feed left over from an
# earlier cut stops the run here instead of going out as a release with a hole in it.
verify_built() {
  local version="$1" target="${2:-$TARGET}"

  echo ""
  echo "Checking the build in $OUTPUT_DIR has every platform..."
  run node "$REPO_ROOT/scripts/verify-release.mjs" built "$version" "$OUTPUT_DIR" "$target"
}

# And the same list again against what GitHub actually holds, because an upload that dies halfway
# leaves a release that looks complete in the browser and serves a truncated file.
verify_published() {
  local version="$1" target="${2:-$TARGET}" tag="v$1"

  if [ "$DRY_RUN" = true ]; then
    echo "DRY-RUN would check the $tag release carries every platform."
    return 0
  fi

  echo ""
  echo "Checking the $tag release carries every platform..."
  gh release view "$tag" --repo "$PUBLISH_REPO" --json assets -q '.assets' \
    | node "$REPO_ROOT/scripts/verify-release.mjs" published "$version" "$OUTPUT_DIR" "$target"
}

record_build_provenance() {
  local version="$1" target="$2" source_commit
  local evidence_path="$OUTPUT_DIR/.release-provenance-v$version.json"
  source_commit=$(git -C "$APP_DIR" rev-parse HEAD)
  mkdir -p "$OUTPUT_DIR"

  node -e '
    const fs = require("node:fs")
    const [path, tag, appVersion, releaseTarget, repository, sourceSha] = process.argv.slice(1)
    fs.writeFileSync(path, JSON.stringify({
      tag,
      appVersion,
      releaseTarget,
      releaseRepository: repository,
      sourceCommit: sourceSha,
      hostCommit: null,
    }, null, 2) + "\n")
  ' "$evidence_path" "v$version" "$version" "$target" "$PUBLISH_REPO" "$source_commit"
}

source_commit_for_release() {
  local version="$1" target="$2"
  local evidence_path="$OUTPUT_DIR/.release-provenance-v$version.json"

  node -e '
    const fs = require("node:fs")
    const [path, tag, appVersion, releaseTarget, repository] = process.argv.slice(1)
    const evidence = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, "utf8")) : null
    if (!evidence || evidence.tag !== tag || evidence.appVersion !== appVersion || evidence.releaseTarget !== releaseTarget || evidence.releaseRepository !== repository || !evidence.sourceCommit) {
      console.error("No matching build provenance for " + tag + "; build this target before publishing.")
      process.exit(1)
    }
    process.stdout.write(evidence.sourceCommit)
  ' "$evidence_path" "v$version" "$version" "$target" "$PUBLISH_REPO"
}

record_release_provenance() {
  local version="$1" host_commit="$2"
  local evidence_path="$OUTPUT_DIR/.release-provenance-v$version.json"

  node -e '
    const fs = require("node:fs")
    const [path, hostSha] = process.argv.slice(1)
    const evidence = JSON.parse(fs.readFileSync(path, "utf8"))
    evidence.hostCommit = hostSha
    fs.writeFileSync(path, JSON.stringify(evidence, null, 2) + "\n")
  ' "$evidence_path" "$host_commit"
}

release_kind() {
  node --input-type=module -e "import { channelFor } from 'file://$REPO_ROOT/scripts/channels.mjs'; console.log(channelFor('${1:-$TARGET}').releaseType)"
}

# gh takes the same flag on create and on edit, so one answer serves both and a release that already
# exists is corrected to the kind this run asked for rather than left as whatever it was first cut as.
prerelease_flag() {
  [ "$(release_kind "${1:-$TARGET}")" = prerelease ] && echo '--prerelease=true' || echo '--prerelease=false'
}

# Upload the already-built artifacts for $version to the GitHub release, reusing the build (no
# rebuild). Uploads the version's installers/blockmaps plus the non-versioned latest*.yml updater
# feed electron-builder wrote during the build. electron-builder names a GitHub asset with spaces
# replaced by dashes (e.g. "Bespok3d Setup X.exe" -> "Bespok3d-Setup-X.exe") and writes the feed to
# match, so we upload those files under the dashed name; otherwise GitHub's own space->dot rename
# would not match the feed and Windows updates would 404.
publish_artifacts() {
  local version="$1" target="${2:-$TARGET}" tag="v$1" artifact base staging source_commit source_label host_commit remote_branch_status
  # A dry run uploads nothing, so it has nothing to need gh for.
  [ "$DRY_RUN" = true ] || command -v gh > /dev/null || { echo "Error: the gh CLI is required to publish." >&2; exit 1; }

  local sources=()
  while IFS= read -r artifact; do
    if [ "$DRY_RUN" = true ] || [ -f "$OUTPUT_DIR/$artifact" ]; then
      sources+=("$OUTPUT_DIR/$artifact")
    fi
  done < <(node --input-type=module -e "import { releaseArtifacts } from 'file://$REPO_ROOT/scripts/release-manifest.mjs'; console.log(releaseArtifacts('$version', '$target').map(item => item.built).join('\\n'))")

  if [ "${#sources[@]}" -eq 0 ]; then
    [ "$DRY_RUN" = true ] && { echo "DRY-RUN would upload the dist/release artifacts for $target $version as a $(release_kind "$target")."; return 0; }
    echo "Error: no built artifacts for $version in $OUTPUT_DIR; build first ('$0' or '$0 bump')." >&2
    exit 1
  fi

  echo ""
  echo "Publishing ${#sources[@]} artifact(s) for $target $version to $PUBLISH_REPO as a $(release_kind "$target") (no rebuild)..."

  if [ "$DRY_RUN" = true ]; then
    if [ -f "$OUTPUT_DIR/.release-provenance-v$version.json" ]; then
      if source_commit=$(source_commit_for_release "$version" "$target" 2>/dev/null); then
        source_label='Source commit'
      else
        source_commit=$(git -C "$APP_DIR" rev-parse HEAD)
        source_label='Source checkout commit (no matching build provenance found)'
      fi
    else
      source_commit=$(git -C "$APP_DIR" rev-parse HEAD)
      source_label='Source checkout commit (no build provenance found)'
    fi
  else
    source_commit=$(source_commit_for_release "$version" "$target") || exit 1
    source_label='Source commit'
  fi
  host_commit="$source_commit"
  if [ "$target" = staging ] && [ "$DRY_RUN" = false ]; then
    remote_branch_status=$(gh api "repos/$PUBLISH_REPO/compare/$source_commit...dev" --jq '.status')
    if [ "$remote_branch_status" != identical ] && [ "$remote_branch_status" != ahead ]; then
      echo "Error: the built Staging source commit is not on the desktop dev branch." >&2
      exit 1
    fi
  fi
  echo "$source_label: $source_commit"
  echo "Release host commit: $host_commit"
  [ "$DRY_RUN" = true ] || record_release_provenance "$version" "$host_commit"

  if [ "$DRY_RUN" = true ]; then
    for artifact in "${sources[@]}"; do
      base=$(basename "$artifact")
      printf 'DRY-RUN would upload: %s\n' "${base// /-}"
    done
    return 0
  fi

  # Stage only the files whose name has a space under their dashed asset name (via symlink, no copy);
  # the rest upload straight from dist/release.
  staging="$(mktemp -d)"
  trap 'rm -rf "$staging"' RETURN
  local uploads=()
  for artifact in "${sources[@]}"; do
    base=$(basename "$artifact")
    if [[ "$base" == *" "* ]]; then
      ln -s "$artifact" "$staging/${base// /-}"
      uploads+=("$staging/${base// /-}")
    else
      uploads+=("$artifact")
    fi
  done

  if gh release view "$tag" --repo "$PUBLISH_REPO" > /dev/null 2>&1; then
    gh release upload "$tag" "${uploads[@]}" --repo "$PUBLISH_REPO" --clobber
    gh release edit "$tag" --repo "$PUBLISH_REPO" "$(prerelease_flag "$target")"
  else
    gh release create "$tag" --repo "$PUBLISH_REPO" --title "$version" "$(prerelease_flag "$target")" --target "$host_commit" --notes "" "${uploads[@]}"
  fi
}

# Set the GitHub release body from release-notes.md (electron-builder does not do this reliably).
# gh reads the same GH_TOKEN. Best-effort: a missing gh or notes file is not fatal.
set_release_notes() {
  local version="$1" notes="$APP_DIR/release-notes.md"
  command -v gh > /dev/null || { echo "gh not found; set the release notes on GitHub manually." >&2; return 0; }
  [ -f "$notes" ] || { echo "no release-notes.md; release body left empty." >&2; return 0; }
  echo ""
  echo "Setting release notes for v${version} from release-notes.md..."
  run gh release edit "v${version}" --repo "$PUBLISH_REPO" --notes-file "$notes"
}

# Point the landing page at $version. The rewriting itself lives in scripts/update-web-downloads.mjs,
# which is also where the asset names the page links to are kept.
update_web() {
  local version="$1" dry_run_flag=()
  local index="${BESPOK3D_WEB_INDEX:-$REPO_ROOT/../support assets/bespok3d-server/stacks/websites/coming-soon/index.html}"

  [ -f "$index" ] || { echo "Error: landing page not found at $index; set BESPOK3D_WEB_INDEX to it." >&2; exit 1; }
  [ "$DRY_RUN" = true ] && dry_run_flag=(--dry-run)

  echo ""
  echo "Pointing the landing page at $version ($index)..."

  node "$REPO_ROOT/scripts/update-web-downloads.mjs" "$index" "$version" "$OUTPUT_DIR" "$PUBLISH_REPO" "${dry_run_flag[@]}"
}

do_bump=false
do_publish=false
do_web=false
BUMP_LEVEL='patch'
TARGET_SELECTED=false
for arg in "$@"; do
  case "$arg" in
    live | staging)
      if [ "$TARGET_SELECTED" = true ] && [ "$TARGET" != "$arg" ]; then
        echo "Error: choose exactly one release target." >&2
        usage
      fi
      TARGET="$arg"
      TARGET_SELECTED=true
      ;;
    bump)            do_bump=true ;;
    minor | major)   BUMP_LEVEL="$arg" ;;
    publish)         do_publish=true ;;
    pre)
      echo "Error: 'pre' was replaced by the explicit 'staging' target. Use '$0 staging publish'." >&2
      exit 1
      ;;
    web)             do_web=true ;;
    --import-signing-cert) IMPORT_SIGNING_CERT=true ;;
    --dry-run | -n)  DRY_RUN=true ;;
    *)               usage ;;
  esac
done

if [ "$BUMP_LEVEL" != patch ] && [ "$do_bump" = false ]; then
  echo "Error: '$BUMP_LEVEL' says how far to bump, so it only means anything alongside 'bump'." >&2
  usage
fi

if [ "$TARGET" = staging ] && [ "$do_web" = true ]; then
  echo "Error: Staging cannot update the website. Remove 'web'; no release side effect was started." >&2
  exit 1
fi

if [ "$IMPORT_SIGNING_CERT" = true ] && [ "$(uname -s)" != "Darwin" ]; then
  echo "Error: --import-signing-cert is available only on macOS." >&2
  exit 1
fi

PUBLISH_REPO=$(node --input-type=module -e "import { channelFor } from 'file://$REPO_ROOT/scripts/channels.mjs'; const repository = channelFor('$TARGET').releaseRepository; if (!repository) { console.error('Selected channel has no release repository'); process.exit(1) }; console.log(repository)")

# electron-builder reads GH_TOKEN; accept the descriptive name and map it across.
PUBLISH_TOKEN="${BESPOK3D_DESKTOP_APP_PUBLISH_GH_TOKEN:-${GH_TOKEN:-}}"

if [ "$do_publish" = true ] && [ "$DRY_RUN" = false ] && [ -z "$PUBLISH_TOKEN" ]; then
  echo "Error: set BESPOK3D_DESKTOP_APP_PUBLISH_GH_TOKEN (fine-grained PAT, Contents:write on the selected channel's release repository) before publishing." >&2
  exit 1
fi

if [ "$do_bump" = true ]; then
  if [ "$TARGET" = staging ] && [ "$do_publish" = true ] && [ "$DRY_RUN" = false ]; then
    [ "$(git -C "$APP_DIR" branch --show-current)" = dev ] || {
      echo "Error: Staging release must be built from desktop/dev." >&2; exit 1;
    }
    [ -z "$(git -C "$APP_DIR" status --porcelain)" ] || {
      echo "Error: commit the desktop changes before bumping and publishing Staging." >&2; exit 1;
    }
  fi
  LIVE_VERSION=$(bump_version)
  if [ "$TARGET" = staging ] && [ "$do_publish" = true ] && [ "$DRY_RUN" = false ]; then
    git -C "$APP_DIR" add -- package.json package-lock.json
    git -C "$APP_DIR" commit -m "release: prepare Staging $LIVE_VERSION"
  fi
else
  LIVE_VERSION=$(live_version)
fi
VERSION=$(version_for_target "$LIVE_VERSION")

# Build when bumping, or when nothing else was asked for; 'publish' and 'web' on their own reuse the
# existing build.
if [ "$do_bump" = true ] || { [ "$do_publish" = false ] && [ "$do_web" = false ]; }; then
  build_all "$LIVE_VERSION" "$VERSION"
fi

if [ "$do_publish" = true ]; then
  if [ "$TARGET" = staging ] && [ "$do_bump" = true ] && [ "$DRY_RUN" = false ]; then
    git -C "$APP_DIR" push origin dev
  fi
  export GH_TOKEN="$PUBLISH_TOKEN"
  # 'publish' on its own reuses whatever is in dist/release, so what is there is checked before any of
  # it is uploaded: half a build must never become a release.
  [ "$do_bump" = true ] || verify_built "$VERSION" "$TARGET"
  publish_artifacts "$VERSION" "$TARGET"
  set_release_notes "$VERSION"
  verify_published "$VERSION" "$TARGET"
fi

if [ "$do_web" = true ]; then
  [ "$TARGET" = live ] || { echo "Error: only Live may update the website." >&2; exit 1; }
  update_web "$VERSION"
fi
