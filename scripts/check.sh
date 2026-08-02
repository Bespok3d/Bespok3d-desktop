#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
set -euo pipefail

# This gate covers THIS repo only. The daemon, the plugins, the adapters and the workspace-wide
# checks each gate themselves in their own repo, so a desktop checkout needs no sibling clone.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT"

# The detectors that enforce a workspace-wide rule live in one place and are invoked by every repo's
# gate. See lib_bespok3d/tooling/README.md. This is the only line that knows where they are.
B3D_TOOLING="${B3D_TOOLING:-$REPO_ROOT/../lib_bespok3d/tooling}"

PASS=0
FAIL=0
FAILURES=""

# ── Mode / arguments ─────────────────────────────────────────────────────────
# Default (no args) is the SMART gate: the cheap floor (cleanup ratchet + em-dash guard) ALWAYS runs,
# plus only the blocks whose sources changed vs HEAD, so the local edit/check loop stays fast.
#   ./scripts/check.sh        smart: floor + blocks that changed vs HEAD (fast inner loop)
#   ./scripts/check.sh full   the complete gate (every block); use before committing and in CI
#   ./scripts/check.sh e2e    also run the packaged-app Playwright suite (heavy; builds + needs Docker)
# 'full' and 'e2e' may be combined. Smart mode falls back to full when git or a HEAD ref is missing.
MODE="smart"
RUN_E2E=0
for arg in "$@"; do
    case "$arg" in
        full) MODE="full" ;;
        e2e) RUN_E2E=1 ;;
        *) echo "Unknown argument: $arg (supported: full, e2e)" >&2; exit 2 ;;
    esac
done

run_check() {
    local label="$1"
    shift
    printf "  %-42s" "$label"
    if "$@" > /tmp/b3_check_out 2>&1; then
        echo "ok"
        PASS=$((PASS + 1))
    else
        echo "FAIL"
        FAIL=$((FAIL + 1))
        FAILURES="$FAILURES\n--- $label ---\n$(cat /tmp/b3_check_out)\n"
    fi
}

# eslint reads its flat config from the working directory, so run the changed-file pass from APP_DIR.
# shellcheck disable=SC2329  # run_check invokes this by name, which shellcheck cannot follow.
eslint_files() {
    ( cd "$APP_DIR" && ./node_modules/.bin/eslint "$@" )
}

# ── Smart-scope detection (which blocks changed vs HEAD) ──────────────────────
# Block gating is the headline speedup: a scripts-only edit skips the whole app block (and vice versa).
# Within a block we additionally scope the file-scopable checks (vitest --changed, eslint on changed
# files). tsc/knip and the ratchet are NEVER file-scoped: they are whole-program/cascade checks, so
# 'fast' for them means incremental caches + block gating, not skipping files. 'full' mode is
# byte-for-byte today's gate (every block, whole-tree), so it stays the authoritative commit/CI gate.
RUN_TS=1
RUN_SHELL=1
CHANGED=""

if [ "$MODE" = "smart" ]; then
    if git -C "$REPO_ROOT" rev-parse HEAD > /dev/null 2>&1; then
        CHANGED="$( { git -C "$REPO_ROOT" diff --name-only HEAD --; \
                      git -C "$REPO_ROOT" ls-files --others --exclude-standard --; } 2>/dev/null )"
        RUN_TS=0
        RUN_SHELL=0
        if printf '%s\n' "$CHANGED" | grep -Eq '^(src|tests|e2e)/|\.(json|mjs)$'; then RUN_TS=1; fi
        if printf '%s\n' "$CHANGED" | grep -Eq '^scripts/'; then RUN_SHELL=1; fi
    else
        echo "  smart gate: git/base-ref unavailable, running the full gate"
        MODE="full"
    fi
fi

plan() { if [ "$1" -eq 1 ]; then echo "run"; else echo "skip"; fi; }

echo ""
if [ "$MODE" = "full" ]; then
    echo "Gate: full (every block)"
else
    echo "Gate: smart (changed vs HEAD); floor always runs, 'check.sh full' runs everything"
    echo "  TypeScript app .... $(plan "$RUN_TS")"
    echo "  Shell scripts ..... $(plan "$RUN_SHELL")"
fi

# ── App dependencies (needed by the floor's jscpd as well as the TypeScript block) ────────────
if [ ! -d "$APP_DIR/node_modules" ]; then
    echo ""
    echo "  Installing npm dependencies..."
    npm --prefix "$APP_DIR" install --silent
fi

# ── TypeScript app ───────────────────────────────────────────────────────────

echo ""
echo "TypeScript app"

if [ "$RUN_TS" -eq 1 ]; then
    if [ "$MODE" = "smart" ]; then
        run_check "vitest (changed vs HEAD)" npm --prefix "$APP_DIR" run test -- --changed HEAD
    else
        run_check "vitest (unit tests)"      npm --prefix "$APP_DIR" run test
    fi

    # eslint: smart mode lints only the changed, still-existing app sources. Falls back to a full lint
    # when nothing lintable changed or the eslint config itself changed (then the whole tree re-lints).
    ESLINT_SCOPED=0
    APP_LINT_FILES=()
    if [ "$MODE" = "smart" ] && ! printf '%s\n' "$CHANGED" | grep -q '^eslint.config.mjs$'; then
        while IFS= read -r changedFile; do
            [ -n "$changedFile" ] || continue
            if [ -f "$APP_DIR/$changedFile" ]; then APP_LINT_FILES+=("$changedFile"); fi
        done < <(printf '%s\n' "$CHANGED" | grep -E '^src/.*\.(ts|tsx)$')
        if [ "${#APP_LINT_FILES[@]}" -gt 0 ]; then ESLINT_SCOPED=1; fi
    fi
    if [ "$ESLINT_SCOPED" -eq 1 ]; then
        run_check "eslint (changed files)" eslint_files "${APP_LINT_FILES[@]}"
    else
        run_check "eslint"                 npm --prefix "$APP_DIR" run lint
    fi

    # tsc and knip are whole-program: never file-scoped. tsc is fast via the incremental tsbuildinfo
    # cache (tsconfig.{node,web}.json); knip simply runs.
    run_check "tsc"                   npm --prefix "$APP_DIR" run typecheck
    run_check "dead-code (knip)"      npm --prefix "$APP_DIR" run knip
else
    echo "  skipped (no app-source changes; ./scripts/check.sh full runs it)"
fi

# ── RULE ZERO + cleanup ratchet (the always-on floor: never skipped) ──────────

echo ""
echo "Project conventions"

run_check "em-dash / en-dash ban" node "$B3D_TOOLING/em-dash-guard.mjs" \
    "$REPO_ROOT/src" "$REPO_ROOT/scripts" "$REPO_ROOT/tools" "$REPO_ROOT/tests" "$REPO_ROOT/e2e" \
    "$REPO_ROOT/doc" "$REPO_ROOT/.ladle" \
    "$REPO_ROOT/CLAUDE.md" "$REPO_ROOT/AGENTS.md" "$REPO_ROOT/README.md"
run_check "workflow pinning"      node "$B3D_TOOLING/workflow-pinning-detector.mjs" "$REPO_ROOT"
run_check "cleanup ratchet"       node "$REPO_ROOT/tools/ratchet.mjs"
run_check "component inventory fresh" node "$REPO_ROOT/scripts/component-inventory.mjs" --check

# Per-file REUSE compliance: every file is covered by a copyright and licence statement, its own
# header or the REUSE.toml block, and every licence a file names has its text in LICENSES/.
# Whole-project `reuse lint` is not used here, because it also reports a licence text as unused when
# nothing in the tree carries that tag. The file list is tracked plus not-yet-committed files, so a
# newly vendored file is checked before it is committed rather than after, and a not-yet-committed
# rename does not point the linter at a path that no longer exists. `reuse` is not a workspace
# dependency: an installed one is used when present, otherwise uv runs it from cache, and a machine
# with neither reports the check as skipped rather than as passed.
# shellcheck disable=SC2329  # run_check invokes this by name, which shellcheck cannot follow.
run_reuse_lint() {
    if command -v reuse > /dev/null 2>&1; then
        reuse "$@"
    else
        uvx --quiet --from 'reuse[charset-normalizer]' reuse "$@"
    fi
}

# shellcheck disable=SC2329  # run_check invokes this by name, which shellcheck cannot follow.
reuse_per_file_check() {
    local licensed_paths=()
    local candidate_path
    local licensed_count=0
    while IFS= read -r -d '' candidate_path; do
        if [ -f "$candidate_path" ]; then
            licensed_paths+=("$candidate_path")
            licensed_count=$((licensed_count + 1))
        fi
    done < <(git ls-files -z --cached --others --exclude-standard)
    if [ "$licensed_count" -eq 0 ]; then
        return 0
    fi
    run_reuse_lint lint-file "${licensed_paths[@]}"
}

if command -v reuse > /dev/null 2>&1 || command -v uvx > /dev/null 2>&1; then
    run_check "reuse (per-file licensing)" reuse_per_file_check
else
    skip_check "reuse (per-file licensing)" "install reuse, or install uv so it can be run from cache"
fi

# ── Shell scripts ───────────────────────────────────────────────────────────

echo ""
echo "Shell scripts"

if [ "$RUN_SHELL" -eq 1 ]; then
    if command -v shellcheck > /dev/null 2>&1; then
        while IFS= read -r -d '' script; do
            run_check "shellcheck $(basename "$script")"   shellcheck "$script"
        done < <(find "$REPO_ROOT/scripts" -name "*.sh" -print0 2>/dev/null)
    else
        echo "  shellcheck not found; skipping (brew install shellcheck)"
    fi

    # app-bundle.mjs's relocation rail (relay stage 4): proves buildBundle() still reproduces the
    # pre-consolidation monorepo bundle against the golden relocated from b3-builder.
    run_check "app-bundle relocation rail" node --test "$REPO_ROOT/scripts/test/app-bundle.test.mjs"

    # The signing rail: builds the bundle under a throwaway key and reads the signatures back out of the
    # artifacts, so a bundled build that silently packs unsigned (the app can only rate those 'unknown')
    # is caught here rather than at install time on a printer.
    run_check "bundled-build signing rail" node --test "$REPO_ROOT/scripts/test/signed-bundle.test.mjs"

    # The dev menu-bar rail: proves node_modules' Electron.app is still renamed (and re-signed) so a
    # dev run reads "Bespok3d Dev" in the macOS menu bar instead of "Electron".
    run_check "dev menu-bar name rail" node --test "$REPO_ROOT/scripts/test/dev-bundle-name.test.mjs"

    # The version rail: proves a bump moves the semver triple and carries the maturity label ("beta")
    # across untouched, so the beta line never starts counting its label the way the alphas did.
    run_check "release version rail" node --test "$REPO_ROOT/scripts/test/release-bump.test.mjs"

    # 'publish' cuts a real release and 'pre' cuts a prerelease, so the difference between the two is
    # one word that a slip can get wrong, and 'pre' must keep the landing page out of it.
    run_check "release kind rail" node --test "$REPO_ROOT/scripts/test/release-publish-kind.test.mjs"

    # The landing page's download buttons are generated: if this breaks, the page offers four dead links.
    run_check "web downloads rail" node --test "$REPO_ROOT/scripts/test/web-downloads.test.mjs"
else
    echo "  skipped (no scripts/ changes; ./scripts/check.sh full runs it)"
fi

# ── Signing chain (build system signs, app verifies) ────────────────────────

echo ""
echo "Signing chain"

# The one rail that crosses the repo boundary: it signs with the build system and verifies with the
# APP's own install-time code, so a drift between the two openpgp implementations fails here instead of
# on a printer. It has two upstreams, the scripts and the app's verify code, so it runs when EITHER
# changed rather than living inside the shell block with the rails that only watch scripts/.
if [ "$RUN_SHELL" -eq 1 ] || [ "$RUN_TS" -eq 1 ]; then
    run_check "signing chain rail" node --test "$REPO_ROOT/scripts/test/signing-chain.test.mjs"
else
    echo "  skipped (no scripts/ or app changes; ./scripts/check.sh full runs it)"
fi

# ── E2E (opt-in: ./scripts/check.sh e2e) ────────────────────────────────────

echo ""
echo "E2E (packaged app)"
if [ "$RUN_E2E" -eq 1 ]; then
    run_check "e2e (playwright)"   bash "$REPO_ROOT/scripts/e2e.sh"
else
    echo "  skipped; run ./scripts/check.sh e2e to include (builds + packages, needs Docker)"
fi

# ── Summary ─────────────────────────────────────────────────────────────────

echo ""
if [ "$FAIL" -eq 0 ]; then
    echo "All checks passed ($PASS/$((PASS + FAIL)))"
    if [ "$MODE" = "smart" ]; then
        SKIPPED=""
        [ "$RUN_TS" -eq 1 ]    || SKIPPED="$SKIPPED TypeScript"
        [ "$RUN_SHELL" -eq 1 ] || SKIPPED="$SKIPPED Shell"
        if [ -n "$SKIPPED" ]; then
            echo "smart gate skipped:$SKIPPED (run ./scripts/check.sh full before committing / in CI)"
        fi
    fi
    echo ""
    exit 0
else
    echo "Failures: $FAIL / $((PASS + FAIL))"
    printf "%b\n" "$FAILURES"
    exit 1
fi
