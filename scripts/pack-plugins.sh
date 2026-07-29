#!/bin/sh
# SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Build .b3 plugin packages from plugins/<name>/ source directories.
#
# Usage:
#   ./scripts/pack-plugins.sh                     # build all plugins
#   ./scripts/pack-plugins.sh rfid-ntag           # build one plugin (compat only, see note below)
#   ./scripts/pack-plugins.sh camera-hw-accel remote-screen  # build several (compat only)
#
# Thin delegator (relay packet 2, re-pointed packet 4, bake gate retired packet 6): this script resolves
# the bundle list, prechecks bundled doc-video weight, then hands the actual packing (the .b3 archive +
# the bundled index) to scripts/app-bundle.mjs, the app's own offline-bundle build glue, which calls the
# b3-builder core as a library (skip-if-unchanged on) for each plugin dir. The class-aware refuse-to-pack
# bake gate (R2) is no longer here: app-bundle.mjs now bakes any not-yet-baked payload and runs
# b3-builder's assertBaked per plugin dir, so the "was it baked?" invariant lives in the one build core
# for every consumer, not in this shell. app-bundle.mjs always packs the FULL bundled + variant set in one
# pass, so a specific-name invocation is accepted for compatibility but no longer skips the others
# (previously a perf shortcut, never exercised by an automated caller: predev/prebuild and e2e.sh always
# call this with no args).
#
# Requires: jq, node, npm (to build the sibling b3-builder repo before invoking app-bundle.mjs).
#
# SIGNING: app-bundle.mjs signs every packed .b3 and the index when REGISTRY_SIGNING_KEY holds an
# armored private key, and stamps that key's fingerprint as the publisher of every packed manifest and
# every catalog entry. Without the variable the build is UNSIGNED (packages install at trust tier
# 'unknown') and says so on the last line it prints. The key is never a flag and never read from a file
# here: it arrives through the environment of whoever runs the build.
#
#   export REGISTRY_SIGNING_KEY="$(gpg --export-secret-keys --armor <key-id>)"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$REPO_DIR/dist/plugins"
BUNDLE_CONFIG="$SCRIPT_DIR/bundle.json"
MAX_DOC_VIDEO_BYTES=15728640  # 15 MiB cap on bundled doc videos
B3_BUILDER_DIR="$(cd "$REPO_DIR/../b3-builder" && pwd)"

# Plugin sources live in the sibling plugins/ tree (the repo split); the monorepo packs them into the
# bundled dev index. Each plugin owns its version in its own repo. Identity is the manifest .name, so
# the directory layout (a solo repo's plugin/ vs a co-repo's <id>/) does not matter.
SIBLING_PLUGINS_DIR="$(cd "$REPO_DIR/.." && pwd)/plugins"
PLUGIN_MAP=""

# All plugin source dirs (each holds a manifest.json). The files/ and doc/ exclusions keep a plugin
# payload's own manifest.json (e.g. remote-screen's PWA web-app manifest under files/html/) from
# being mistaken for a plugin manifest.
discover_plugin_dirs() {
  find "$SIBLING_PLUGINS_DIR" -name manifest.json -type f \
    ! -path '*/files/*' ! -path '*/doc/*' \
    ! -path '*/dist/*' ! -path '*/node_modules/*' ! -path '*/.git/*' 2>/dev/null \
    | while read -r manifest; do dirname "$manifest"; done
}

# Variant dirs are read regardless of release mode here: a variant's manifest deliberately shares
# its id with the online atom, so its dir must NEVER be discovered as the id's source dir (the
# name-keyed map would otherwise resolve the id to whichever dir find(1) happened to list first).
# Variants pack only by explicit path, via pack_variants.
all_variant_dirs() {
  [ -f "$BUNDLE_DEV_CONFIG" ] || return 0
  jq -r '.variantDirs[]?' "$BUNDLE_DEV_CONFIG" 2>/dev/null
}

# Build a name<TAB>dir map once, excluding the variant dirs. The sibling-first ordering above means
# the first line for a name is its sibling-tree source, so plugin_src_dir (awk, first match)
# resolves sibling-wins.
build_plugin_map() {
  PLUGIN_MAP=$(mktemp)
  variant_exclusions=$(mktemp)
  all_variant_dirs | while read -r rel; do
    printf '%s\n' "$SIBLING_PLUGINS_DIR/$rel"
  done > "$variant_exclusions"
  discover_plugin_dirs | grep -vxF -f "$variant_exclusions" | while read -r dir; do
    name=$(jq -r '.name' "$dir/manifest.json" 2>/dev/null)
    [ -n "$name" ] && printf '%s\t%s\n' "$name" "$dir"
  done > "$PLUGIN_MAP"
  rm -f "$variant_exclusions"
}

plugin_src_dir() {
  awk -F'\t' -v wanted="$1" '$1 == wanted { print $2; exit }' "$PLUGIN_MAP"
}

# scripts/bundle.json `bundle` is the RELEASE opt-in list of plugin ids to pack into the bundled
# index; everything else is served online (the default, fully online). bundle.dev.json adds ids that
# are bundled ONLY for dev builds (local testing), never shipped in a release. Release builds run via
# `prebuild`; everything else (predev, manual, check.sh) is treated as dev and also bundles the dev
# list. Set B3D_RELEASE=1 to force the release set. Empty merged list = bundle nothing.
BUNDLE_DEV_CONFIG="$SCRIPT_DIR/bundle.dev.json"

release_mode() {
  [ "${npm_lifecycle_event:-}" = "prebuild" ] || [ -n "${B3D_RELEASE:-}" ]
}

bundle_plugins() {
  {
    [ -f "$BUNDLE_CONFIG" ] && jq -r '.bundle[]?' "$BUNDLE_CONFIG" 2>/dev/null
    if ! release_mode && [ -f "$BUNDLE_DEV_CONFIG" ]; then
      jq -r '.bundle[]?' "$BUNDLE_DEV_CONFIG" 2>/dev/null
    fi
  } | LC_ALL=C sort -u
}

all_plugin_names() {
  bundle=$(bundle_plugins)
  [ -z "$bundle" ] && return 0
  cut -f1 "$PLUGIN_MAP" | LC_ALL=C sort -u | while read -r name; do
    printf '%s\n' "$bundle" | grep -qxF "$name" && printf '%s\n' "$name"
  done
}

check_deps() {
  for cmd in jq node npm; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      echo "ERROR: '$cmd' is required but not found. Install it first." >&2
      exit 1
    fi
  done
}

# Keep exactly one .b3 per plugin: drop any same-name package whose version is not the one just
# packed. Matches on the EXACT name (stem = filename minus the trailing -version), so a plugin whose
# name is a prefix of another (force-bed-mesh vs force-bed-mesh-adaptive) is never pruned by mistake.
# One id can pack SEVERAL atoms in one run (the stable .b3 plus a dev channel-variant .b3 with its own
# version), so every packed name+version is recorded in PACKED_VERSIONS and never pruned: without it,
# whichever atom packs last deletes its sibling.
prune_old_versions() {
  name="$1"
  for candidate in "$DIST_DIR/$name"-*.b3; do
    [ -f "$candidate" ] || continue
    base=$(basename "$candidate")
    ver="${base#"$name"-}"; ver="${ver%.b3}"
    case "$ver" in [!0-9]*) continue ;; esac
    grep -qxF "$(printf '%s\t%s' "$name" "$ver")" "$PACKED_VERSIONS" 2>/dev/null && continue
    rm -f "$candidate"
  done
}

# Reject bundled doc videos larger than the cap (keeps packages light; docs are not code).
check_doc_video_size() {
  plugin_dir="$1"
  [ -d "$plugin_dir/doc" ] || return 0
  oversized=$(find "$plugin_dir/doc" -type f \( -iname '*.mp4' -o -iname '*.webm' -o -iname '*.mov' \) 2>/dev/null \
    | while read -r video; do
        size=$(stat -f%z "$video" 2>/dev/null || stat -c%s "$video" 2>/dev/null)
        [ "$size" -gt "$MAX_DOC_VIDEO_BYTES" ] && echo "$video (${size} bytes)"
      done)
  if [ -n "$oversized" ]; then
    echo "ERROR: doc video exceeds the 15 MB limit:" >&2
    echo "$oversized" >&2
    return 1
  fi
  return 0
}

# Precheck one bundled plugin before delegating the pack: it must resolve to a source dir with a
# manifest, a collection (kind:collection) is index-only orchestration metadata with no files/ and no
# .b3, and a bundled doc video must be within the size cap. The class-aware refuse-to-pack bake gate is
# no longer here: app-bundle.mjs bakes then runs b3-builder's assertBaked per plugin dir.
precheck_one() {
  name="$1"
  plugin_dir="$(plugin_src_dir "$name")"

  if [ ! -f "$plugin_dir/manifest.json" ]; then
    echo "ERROR: $plugin_dir/manifest.json not found" >&2
    PRECHECK_FAILED=$((PRECHECK_FAILED + 1))
    return
  fi
  if [ "$(jq -r '.kind // "plugin"' "$plugin_dir/manifest.json")" = "collection" ]; then
    echo "Skip precheck (collection, index-only): $name"
    COLLECTIONS=$((COLLECTIONS + 1))
    return
  fi
  if ! check_doc_video_size "$plugin_dir"; then
    PRECHECK_FAILED=$((PRECHECK_FAILED + 1))
    return
  fi
  PRECHECKED=$((PRECHECKED + 1))
}

# Dev-only channel variants (bundle.dev.json `variantDirs`) get the same doc-weight precheck: their
# payload is bundled just like an id source. The bake gate moved to app-bundle.mjs (assertBaked), which
# packs the variant dirs too.
precheck_variants() {
  release_mode && return 0
  vfile=$(mktemp)
  all_variant_dirs > "$vfile"
  while read -r rel; do
    dir="$SIBLING_PLUGINS_DIR/$rel"
    if [ ! -f "$dir/manifest.json" ]; then
      echo "Skip variant precheck (no manifest): $rel" >&2
      continue
    fi
    if [ ! -d "$dir/files" ]; then
      echo "Skip variant precheck (not built): $rel"
      continue
    fi
    check_doc_video_size "$dir" || PRECHECK_FAILED=$((PRECHECK_FAILED + 1))
  done < "$vfile"
  rm -f "$vfile"
}

# The manifest .name of each variant (its id), gated and built above. Feeds the final prune guard so
# a variant's .b3 is not mistaken for an online-only plugin and deleted.
variant_names() {
  release_mode && return 0
  all_variant_dirs | while read -r rel; do
    manifest="$SIBLING_PLUGINS_DIR/$rel/manifest.json"
    [ -f "$manifest" ] && [ -d "$SIBLING_PLUGINS_DIR/$rel/files" ] && jq -r '.name' "$manifest" 2>/dev/null
  done
}

# Build the sibling b3-builder repo (if needed), then run the app's own bundler (app-bundle.mjs),
# which packs the .b3 set (checksummed manifest, files/, doc/, root Python-dep declarations) via
# b3-builder-as-a-library and regenerates the bundled index from the (possibly re-baked) manifests, so
# index.json always matches the packed .b3 set.
build_core() {
  channel="$1"
  if [ ! -d "$B3_BUILDER_DIR/node_modules" ]; then
    echo "Installing b3-builder dependencies (npm install)..."
    ( cd "$B3_BUILDER_DIR" && npm install )
  fi
  ( cd "$B3_BUILDER_DIR" && npm run build --silent ) || { echo "ERROR: b3-builder build failed." >&2; exit 1; }
  # app-bundle.mjs now owns the refuse-to-pack bake gate (assertBaked); a non-zero exit means a bundled
  # plugin was unbaked (or a bake failed), so abort the build rather than ship an incomplete index.
  node "$SCRIPT_DIR/app-bundle.mjs" --source "$REPO_DIR" --out "$DIST_DIR" --channel "$channel" \
    || { echo "ERROR: app-bundle.mjs failed (a bundled plugin may be unbaked; see the refuse-to-pack error above)." >&2; exit 1; }
}

check_deps
build_plugin_map

if [ $# -gt 0 ] && [ "$1" != "all" ]; then
  echo "Note: the app bundler (app-bundle.mjs) always packs the full bundled set;" >&2
  echo "      the requested name(s) ($*) do not limit this run to just them." >&2
fi

# An empty bundle.json `bundle` list means fully online (pack nothing); that is not an error.
BUNDLE_EMPTY=$([ -z "$(bundle_plugins)" ] && echo 1 || true)

mkdir -p "$DIST_DIR"

PRECHECKED=0
COLLECTIONS=0
PRECHECK_FAILED=0

names_file=$(mktemp)
all_plugin_names > "$names_file"
while read -r name; do
  precheck_one "$name"
done < "$names_file"
rm -f "$names_file"

precheck_variants

# Nothing prechecked and no collection either, while the bundle is configured non-empty: every bundled
# id silently failed to resolve to a source dir (a typo, a renamed/removed plugin). That is a
# misconfiguration, not a valid "fully online" state (BUNDLE_EMPTY covers that one), so fail loudly
# instead of shipping an index quietly missing the plugin(s) that should have been there.
if [ "$PRECHECKED" -eq 0 ] && [ "$COLLECTIONS" -eq 0 ] && [ -z "$BUNDLE_EMPTY" ]; then
  echo "ERROR: bundle.json/bundle.dev.json name plugin(s) but none resolved to a source dir." >&2
  rm -f "$PLUGIN_MAP"
  exit 1
fi

if [ "$PRECHECK_FAILED" -gt 0 ]; then
  echo "ERROR: $PRECHECK_FAILED bundled plugin(s) failed the doc-weight precheck; not building." >&2
  rm -f "$PLUGIN_MAP"
  exit 1
fi

if release_mode; then
  build_core release
else
  build_core dev
fi

# name<TAB>version of every plugin/variant just (re)built; prune_old_versions keeps these (see its
# comment) and drops any other version of the same name still sitting in DIST_DIR. A variant shares
# its name with the online atom but carries its OWN version (fluidd stable + fluidd-bleeding-edge), so
# each is recorded from its OWN manifest, never resolved through the name-keyed PLUGIN_MAP.
PACKED_VERSIONS=$(mktemp)
all_plugin_names | while read -r name; do
  dir=$(plugin_src_dir "$name")
  version=$(jq -r '.version' "$dir/manifest.json" 2>/dev/null)
  [ -n "$version" ] && printf '%s\t%s\n' "$name" "$version" >> "$PACKED_VERSIONS"
done
if ! release_mode; then
  all_variant_dirs | while read -r rel; do
    dir="$SIBLING_PLUGINS_DIR/$rel"
    [ -f "$dir/manifest.json" ] && [ -d "$dir/files" ] || continue
    name=$(jq -r '.name' "$dir/manifest.json" 2>/dev/null)
    version=$(jq -r '.version' "$dir/manifest.json" 2>/dev/null)
    [ -n "$name" ] && [ -n "$version" ] && printf '%s\t%s\n' "$name" "$version" >> "$PACKED_VERSIONS"
  done
fi

cut -f1 "$PACKED_VERSIONS" | LC_ALL=C sort -u | while read -r name; do
  prune_old_versions "$name"
done

# Drop .b3 for every discovered plugin NOT bundled; they are served online. The keep set is the bundle
# id-list plus the dev-only variant ids (whose .b3 would otherwise look online-only and be deleted).
keep_file=$(mktemp)
{ bundle_plugins; variant_names; } | LC_ALL=C sort -u > "$keep_file"
cut -f1 "$PLUGIN_MAP" | LC_ALL=C sort -u | while read -r name; do
  grep -qxF "$name" "$keep_file" || prune_old_versions "$name"
done
rm -f "$keep_file" "$PACKED_VERSIONS" "$PLUGIN_MAP"

echo ""
echo "Prechecked: $PRECHECKED  Collections: $COLLECTIONS  Bundle empty: ${BUNDLE_EMPTY:-0}"
