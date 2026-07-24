#!/usr/bin/env python3
"""RULE ZERO guard: fail the build if any authored source file contains an em-dash or en-dash.

The em-dash (U+2014) and en-dash (U+2013) are banned everywhere in the project. No linter enforces
this, so this guard scans this repo's authored trees (the app source, the scripts and tooling, the
tests, the doc prose) and exits non-zero on any offender. Each repo carries its own copy and scans
only itself. Build output, dependencies, git internals, and vendored web-UI bundles (under assets/)
are skipped, and only authored text formats are scanned by suffix. The dash codepoints are written
as escapes here so this guard never trips on itself.
"""
import sys
from pathlib import Path

EM_DASH = chr(0x2014)
EN_DASH = chr(0x2013)
REPO_ROOTS = ("src", "scripts", "tools", "tests", "e2e", "doc", ".ladle")
EXTRA_FILES = ("CLAUDE.md", "AGENTS.md", "README.md")
SCANNED_SUFFIXES = (".ts", ".tsx", ".py", ".json", ".md", ".css", ".sh")
EXCLUDED_DIRS = ("dist", "out", "node_modules", ".venv", ".git", "assets", "wheels", "site-packages", "app")


def is_scanned(path: Path) -> bool:
    matches_suffix = path.suffix in SCANNED_SUFFIXES
    outside_excluded = not any(part in EXCLUDED_DIRS for part in path.parts)
    return path.is_file() and matches_suffix and outside_excluded


def scanned_roots(repo_root: Path) -> list[Path]:
    return [repo_root / name for name in REPO_ROOTS if (repo_root / name).is_dir()]


def candidate_files(repo_root: Path) -> list[Path]:
    from_trees = [path for root in scanned_roots(repo_root) for path in root.rglob("*") if is_scanned(path)]
    extras = [repo_root / name for name in EXTRA_FILES]
    return from_trees + [path for path in extras if is_scanned(path)]


def has_banned_dash(path: Path) -> bool:
    text = path.read_text(encoding="utf-8", errors="ignore")
    return EM_DASH in text or EN_DASH in text


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    offenders = [path for path in candidate_files(repo_root) if has_banned_dash(path)]
    for path in offenders:
        print(f"RULE ZERO violation (em-dash/en-dash): {path.relative_to(repo_root)}")
    return 1 if offenders else 0


if __name__ == "__main__":
    sys.exit(main())
