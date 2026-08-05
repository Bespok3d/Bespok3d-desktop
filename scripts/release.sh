#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT"
PKG="$APP_DIR/package.json"
# electron-builder writes installers to the central dist/ (build.directories.output = ./dist/release).
OUTPUT_DIR="$REPO_ROOT/dist/release"
# Matches package.json build.publish (github Bespok3d/Bespok3d-desktop). Uploading goes through gh
# here, not through electron-builder, so the kind of release is decided by 'pre' and not by that file.
PUBLISH_REPO="Bespok3d/Bespok3d-desktop"
DRY_RUN=false
IS_PRERELEASE=false

usage() {
  cat >&2 <<EOF
Usage: $0 [bump [minor|major]] [publish [pre]] [web] [--dry-run]

  (no args)     Build the current version locally (no upload).
  bump          Raise the patch number, then build. 'bump minor' and 'bump major' raise
                those instead. The maturity label ('beta') is carried over untouched.
  publish       Upload the existing build in dist/release to GitHub as a real release.
                Does NOT rebuild; run a build first ('$0' or '$0 bump'). (needs the
                publish token)
  pre           Publish as a GitHub prerelease instead, and leave the landing page alone
                even when 'web' is also given. Only means something alongside 'publish'.
  bump publish  Raise the version, build, then upload. (order does not matter)
  web           Point the landing page's download buttons at this version. Edits the page
                in the bespok3d-server repo; it goes live when that page is deployed.
  --dry-run     Print every build and publish command instead of running it.
                Changes nothing on disk or on GitHub. (alias: -n)

Notes:
  Publishing uploads the dist/release artifacts (installers + the latest*.yml metadata
  electron-updater reads) to the GitHub repo set in package.json build.publish. It
  reuses what the build produced, so 'publish' never rebuilds. Set
  BESPOK3D_DESKTOP_APP_PUBLISH_GH_TOKEN (a fine-grained PAT with Contents:write on
  Bespok3d/Bespok3d-desktop) before publishing.
  On macOS a build covers mac + windows + linux (the NSIS .exe and the AppImage build on macOS
  without wine). Only the macOS .dmg cannot be cross-built, so a Linux host builds linux +
  windows (the .exe needs wine there). Run on a Mac to cover all three.
  The Linux Flatpak is built by flatpak-builder, which runs only on Linux: a Linux host uses it
  directly, and every other host runs it in a Linux container, so a cut anywhere produces it.

  'pre' decides what GitHub calls the release: a prerelease is kept off the repo's Latest
  pointer and off the download page people land on. The app's own updater does not read
  that flag, it reads the version's maturity label ('-beta'), so a release published
  without 'pre' is still offered as a prerelease inside the app.

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
  current=$(current_version)
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
pkg.version = '$next';
fs.writeFileSync('$PKG', JSON.stringify(pkg, null, 2) + '\n');
"
  fi

  echo "$next"
}

# macOS builds all three (mac + windows + linux) directly; only the macOS .dmg cannot be cross-built,
# so guard JUST that to a Darwin host. Always builds without uploading (--publish never); uploading is
# a separate, build-free step (publish_artifacts), so 'publish' never rebuilds.
build_all() {
  local version="$1"

  if [ "$(uname -s)" = "Darwin" ]; then
    echo ""
    echo "Building macOS..."
    run npm --prefix "$APP_DIR" run package:mac -- --publish never
  fi

  # CSC_LINK/CSC_KEY_PASSWORD hold the Apple Developer ID key for the macOS build. electron-builder
  # reads the same two variables for Windows and Linux, so leaving them set signs the .exe with the
  # Apple certificate, which Windows never trusts, and bakes the certificate's owner name into
  # app-update.yml as publisherName - after which every auto-update refuses to install.
  echo ""
  echo "Building Windows..."
  run env -u CSC_LINK -u CSC_KEY_PASSWORD -u WIN_CSC_LINK -u WIN_CSC_KEY_PASSWORD \
    npm --prefix "$APP_DIR" run package:win -- --publish never

  echo ""
  echo "Building Linux..."
  run env -u CSC_LINK -u CSC_KEY_PASSWORD \
    npm --prefix "$APP_DIR" run package:linux -- --publish never

  # flatpak-builder runs only on Linux. On a Linux host it is used directly; anywhere else the same
  # tool runs in a Linux container against this build, so every cut produces the Flatpak on whatever
  # machine it is cut from.
  echo ""
  echo "Building Linux Flatpak..."
  if command -v flatpak-builder > /dev/null; then
    run npm --prefix "$APP_DIR" run package:flatpak -- --publish never
  else
    run "$APP_DIR/scripts/flatpak-build.sh"
  fi

  echo ""
  [ "$DRY_RUN" = true ] && echo "DRY-RUN would build $version into $OUTPUT_DIR/" || echo "Built $version into $OUTPUT_DIR/"
}

release_kind() {
  [ "$IS_PRERELEASE" = true ] && echo prerelease || echo release
}

# gh takes the same flag on create and on edit, so one answer serves both and a release that already
# exists is corrected to the kind this run asked for rather than left as whatever it was first cut as.
prerelease_flag() {
  [ "$IS_PRERELEASE" = true ] && echo '--prerelease=true' || echo '--prerelease=false'
}

# Upload the already-built artifacts for $version to the GitHub release, reusing the build (no
# rebuild). Uploads the version's installers/blockmaps plus the non-versioned latest*.yml updater
# feed electron-builder wrote during the build. electron-builder names a GitHub asset with spaces
# replaced by dashes (e.g. "Bespok3d Setup X.exe" -> "Bespok3d-Setup-X.exe") and writes the feed to
# match, so we upload those files under the dashed name; otherwise GitHub's own space->dot rename
# would not match the feed and Windows updates would 404.
publish_artifacts() {
  local version="$1" tag="v$1" feed artifact base staging
  # A dry run uploads nothing, so it has nothing to need gh for.
  [ "$DRY_RUN" = true ] || command -v gh > /dev/null || { echo "Error: the gh CLI is required to publish." >&2; exit 1; }

  local sources=()
  while IFS= read -r artifact; do sources+=("$artifact"); done < <(
    find "$OUTPUT_DIR" -maxdepth 1 -type f -name "*${version}*" | sort
  )
  for feed in latest-mac.yml latest.yml latest-linux.yml latest-linux-arm64.yml; do
    [ -f "$OUTPUT_DIR/$feed" ] && sources+=("$OUTPUT_DIR/$feed")
  done

  if [ "${#sources[@]}" -eq 0 ]; then
    [ "$DRY_RUN" = true ] && { echo "DRY-RUN would upload the dist/release artifacts for $version as a $(release_kind)."; return 0; }
    echo "Error: no built artifacts for $version in $OUTPUT_DIR; build first ('$0' or '$0 bump')." >&2
    exit 1
  fi

  echo ""
  echo "Publishing ${#sources[@]} artifact(s) for $version to $PUBLISH_REPO as a $(release_kind) (no rebuild)..."

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
    gh release edit "$tag" --repo "$PUBLISH_REPO" "$(prerelease_flag)"
  else
    gh release create "$tag" --repo "$PUBLISH_REPO" --title "$version" "$(prerelease_flag)" --notes "" "${uploads[@]}"
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
for arg in "$@"; do
  case "$arg" in
    bump)            do_bump=true ;;
    minor | major)   BUMP_LEVEL="$arg" ;;
    publish)         do_publish=true ;;
    pre)             IS_PRERELEASE=true ;;
    web)             do_web=true ;;
    --dry-run | -n)  DRY_RUN=true ;;
    *)               usage ;;
  esac
done

if [ "$BUMP_LEVEL" != patch ] && [ "$do_bump" = false ]; then
  echo "Error: '$BUMP_LEVEL' says how far to bump, so it only means anything alongside 'bump'." >&2
  usage
fi

if [ "$IS_PRERELEASE" = true ] && [ "$do_publish" = false ]; then
  echo "Error: 'pre' says what kind of release to publish, so it only means anything alongside 'publish'." >&2
  usage
fi

# A prerelease is not what anyone lands on, so it never becomes the download the page offers. Asking
# for both is taken as a slip and the page is left alone, rather than pointing everybody at a build
# that was published as one to try.
if [ "$IS_PRERELEASE" = true ] && [ "$do_web" = true ]; then
  echo "Note: 'pre' never touches the landing page, so 'web' is ignored." >&2
  do_web=false
fi

# electron-builder reads GH_TOKEN; accept the descriptive name and map it across.
PUBLISH_TOKEN="${BESPOK3D_DESKTOP_APP_PUBLISH_GH_TOKEN:-${GH_TOKEN:-}}"

if [ "$do_publish" = true ] && [ "$DRY_RUN" = false ] && [ -z "$PUBLISH_TOKEN" ]; then
  echo "Error: set BESPOK3D_DESKTOP_APP_PUBLISH_GH_TOKEN (fine-grained PAT, Contents:write on Bespok3d/Bespok3d-desktop) before publishing." >&2
  exit 1
fi

if [ "$do_bump" = true ]; then
  VERSION=$(bump_version)
else
  VERSION=$(current_version)
fi

# Build when bumping, or when nothing else was asked for; 'publish' and 'web' on their own reuse the
# existing build.
if [ "$do_bump" = true ] || { [ "$do_publish" = false ] && [ "$do_web" = false ]; }; then
  build_all "$VERSION"
fi

if [ "$do_publish" = true ]; then
  export GH_TOKEN="$PUBLISH_TOKEN"
  publish_artifacts "$VERSION"
  set_release_notes "$VERSION"
fi

if [ "$do_web" = true ]; then
  update_web "$VERSION"
fi
