# Release Checklist

Steps to complete before the first public release of Bespok3d.
Work through this top to bottom — later items depend on earlier ones.

---

## Codebase

- [ ] Add AGPL-3.0 header to every source file that doesn't have one
  - `src/**/*.ts` / `*.tsx`
  - the daemon lives in the sibling `daemon/` repo and is released from there: its `**/*.py` and shell scripts are covered by that repo's own release checklist, not this one
- [ ] Confirm no secrets, tokens, or personal data in git history
- [ ] Remove or stub any hardcoded test IP addresses or printer-specific values
- [ ] Confirm `check.sh` passes 6/6 on a clean clone (no pre-existing venv or node_modules)

## Repository

- [ ] Create the public org/repo on GitHub (and/or Gitea)
- [ ] Add `CONTRIBUTING.md` with: how to report bugs, how to submit a PR, coding standards pointer, adapter-writing guide pointer
- [ ] Add `SECURITY.md` with responsible disclosure contact
- [ ] Tag the commit that becomes v0.1.0
- [ ] Add `.github/ISSUE_TEMPLATE/` — bug report and feature request templates
- [ ] Add `.github/PULL_REQUEST_TEMPLATE.md`

## CI/CD

- [ ] GitHub Actions workflow: on every push → run `check.sh`
- [ ] GitHub Actions workflow: on tag `v*` → build Electron app for macOS, Windows, Linux
- [ ] Set up code signing for macOS (Apple Developer certificate + notarization)
- [ ] Set up code signing for Windows (EV certificate or self-signed with warning)
- [ ] Set up auto-update endpoint (Electron's `autoUpdater` needs a server — GitHub Releases works via `electron-updater`)

## App release

- [ ] Build and smoke-test the packaged app on:
  - [ ] macOS (Apple Silicon)
  - [ ] macOS (Intel)
  - [ ] Windows 11
  - [ ] Ubuntu LTS
- [ ] Create GitHub Release for v0.1.0 with built binaries attached
- [ ] Update download link in `wiki/Quick-Start.md`

## Plugin registry

- [ ] Create `bespok3d-registry` repo with initial `index.json` (official plugin list)
- [ ] Sign the registry index with the project GPG key
- [ ] Bundle the registry URL into the app as the default registry
- [ ] Publish the Snapmaker U1 adapter as a community package (or bundle it in core for v0.1.0)

## Daemon

- [ ] Close remaining daemon gaps before calling enrollment production-ready:
  - [x] `snapmaker_u1.py` adapter — implemented; hardware=["camera-mipi","rfid-spi","npu-rknn"]
  - [x] TLS enforcement in uvicorn — cert generated at enrollment; uvicorn uses it when cert files exist
  - [ ] GPG signature verification in package install — pgpy wired in; requires pre-built wheel (`pip wheel --no-deps pgpy`)
  - [ ] App-side daemon HTTP client — no IPC handler yet to call `/capabilities` or `/install`
  - [ ] Package install HTTP route — `packages.install()` exists; no endpoint exposes it yet
- [ ] Smoke-test daemon endpoints on real U1 hardware with a freshly enrolled printer

## Documentation

- [ ] Publish wiki to GitHub Wiki (or Gitea wiki)
- [ ] Update `README.md` with real download link and "get started" path
- [ ] Add a `doc/adapters.md` guide: how to write a new printer adapter end-to-end
- [ ] Review all `doc/decisions/` ADRs — mark superseded ones, update status fields

## Announce

- [ ] Snapmaker community forum / Discord
- [ ] Klipper community (GitHub Discussions or Discord)
- [ ] Reddit r/3Dprinting / r/klippers
