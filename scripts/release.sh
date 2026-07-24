#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT"
PKG="$APP_DIR/package.json"
# electron-builder writes installers to the central dist/ (build.directories.output = ./dist/release).
OUTPUT_DIR="$REPO_ROOT/dist/release"
# Matches package.json build.publish (github Bespok3d/Bespok3d-desktop, releaseType prerelease).
PUBLISH_REPO="Bespok3d/Bespok3d-desktop"
DRY_RUN=false

usage() {
  cat >&2 <<EOF
Usage: $0 [bump] [publish] [--dry-run]

  (no args)     Build the current version locally (no upload).
  bump          Raise the version number, then build.
  publish       Upload the existing build in dist/release to GitHub. Does NOT rebuild;
                run a build first ('$0' or '$0 bump'). (needs the publish token)
  bump publish  Raise the version, build, then upload. (order does not matter)
  --dry-run     Print every build and publish command instead of running it.
                Changes nothing on disk or on GitHub. (alias: -n)

Notes:
  Publishing uploads the dist/release artifacts (installers + the latest*.yml metadata
  electron-updater reads) to the GitHub repo set in package.json build.publish, as a
  prerelease. It reuses what the build produced, so 'publish' never rebuilds. Set
  BESPOK3D_DESKTOP_APP_PUBLISH_GH_TOKEN (a fine-grained PAT with Contents:write on
  Bespok3d/Bespok3d-desktop) before publishing.
  On macOS a build covers mac + windows + linux (the NSIS .exe and the AppImage build on macOS
  without wine). Only the macOS .dmg cannot be cross-built, so a Linux host builds linux +
  windows (the .exe needs wine there). Run on a Mac to cover all three.
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

bump_version() {
  local current base next n
  current=$(current_version)
  base="${current%%-*}"

  if echo "$current" | grep -q '\-alpha\.'; then
    n="${current##*-alpha.}"
    next="${base}-alpha.$((n + 1))"
  else
    next="${base}-alpha.1"
  fi

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

  echo ""
  echo "Building Windows..."
  run npm --prefix "$APP_DIR" run package:win -- --publish never

  echo ""
  echo "Building Linux..."
  run npm --prefix "$APP_DIR" run package:linux -- --publish never

  echo ""
  [ "$DRY_RUN" = true ] && echo "DRY-RUN would build $version into $OUTPUT_DIR/" || echo "Built $version into $OUTPUT_DIR/"
}

# Upload the already-built artifacts for $version to the GitHub release, reusing the build (no
# rebuild). Uploads the version's installers/blockmaps plus the non-versioned latest*.yml updater
# feed electron-builder wrote during the build. electron-builder names a GitHub asset with spaces
# replaced by dashes (e.g. "Bespok3d Setup X.exe" -> "Bespok3d-Setup-X.exe") and writes the feed to
# match, so we upload those files under the dashed name; otherwise GitHub's own space->dot rename
# would not match the feed and Windows updates would 404.
publish_artifacts() {
  local version="$1" tag="v$1" feed artifact base staging
  command -v gh > /dev/null || { echo "Error: the gh CLI is required to publish." >&2; exit 1; }

  local sources=()
  while IFS= read -r artifact; do sources+=("$artifact"); done < <(
    find "$OUTPUT_DIR" -maxdepth 1 -type f -name "*${version}*" | sort
  )
  for feed in latest-mac.yml latest.yml latest-linux.yml latest-linux-arm64.yml; do
    [ -f "$OUTPUT_DIR/$feed" ] && sources+=("$OUTPUT_DIR/$feed")
  done

  if [ "${#sources[@]}" -eq 0 ]; then
    [ "$DRY_RUN" = true ] && { echo "DRY-RUN would upload the dist/release artifacts for $version."; return 0; }
    echo "Error: no built artifacts for $version in $OUTPUT_DIR; build first ('$0' or '$0 bump')." >&2
    exit 1
  fi

  echo ""
  echo "Publishing ${#sources[@]} artifact(s) for $version to $PUBLISH_REPO as a prerelease (no rebuild)..."

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
  else
    gh release create "$tag" --repo "$PUBLISH_REPO" --title "$version" --prerelease --notes "" "${uploads[@]}"
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

do_bump=false
do_publish=false
for arg in "$@"; do
  case "$arg" in
    bump)            do_bump=true ;;
    publish)         do_publish=true ;;
    --dry-run | -n)  DRY_RUN=true ;;
    *)               usage ;;
  esac
done

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

# Build when bumping or when no publish was asked for; 'publish' on its own reuses the existing build.
if [ "$do_bump" = true ] || [ "$do_publish" = false ]; then
  build_all "$VERSION"
fi

if [ "$do_publish" = true ]; then
  export GH_TOKEN="$PUBLISH_TOKEN"
  publish_artifacts "$VERSION"
  set_release_notes "$VERSION"
fi
