<!-- SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors -->
<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Go live from an approved candidate

```sh
./scripts/release.sh golive --staged-manifest /path/to/execution/5/staged-app.json --dry-run
./scripts/release.sh golive --staged-manifest /path/to/execution/5/staged-app.json --preflight
./scripts/release.sh golive --staged-manifest /path/to/execution/5/staged-app.json
```

Dry-run only reads the two approval files and prints the entire ordered plan. Preflight performs local builds and read-only service checks, with no release/tag push or website deployment. The final command executes the concrete operations after the owner has authorized them. Repeating it inspects remote effects; equivalent effects are reused and unexpected content fails without overwrite. Staging remains `release.sh staging publish` and never enters this command's Live unit or website steps.

The manifest has exactly `version` and `sourceCommit`, for example `0.7.7-beta-staging` and the full desktop source SHA. Only the terminal `-staging` is removed for Live; each unit separately removes its terminal `-pre`.

`candidate-evidence.json` beside the manifest is the existing frozen Stage05 approval record. It is never rewritten by this command. Its schema is:

| Field | Meaning |
| --- | --- |
| schema, approved | `1`, `true`, recorded only after owner candidate acceptance |
| app.version, app.sourceCommit | Exactly the two manifest values |
| app.checkout | Clean desktop checkout at that exact source; package.json already has the Live base version |
| app.staging.repository, tag, hostCommit | Table-selected artifacts host, exact staged tag, separate full host SHA |
| app.staging.artifacts | Ordered `releaseArtifacts(stagedVersion, 'staging')` entries as `{name: assetName(built), sha256}` from approved fresh served bytes |
| tooling.builder / tooling.register | Each has `checkout`, `repository` and exact tested `commit`; refs must already be remotely reachable |
| publicKeyPath | Existing trusted registry public key file |
| publicKeys | Optional publisher-fingerprint to armored-key map for package verification |
| candidateIndex | Approved prerelease-only `url`, exact `sha256` and `signatureSha256`; never the merged Live-plus-tier catalog |
| liveIndex | Live `url` and frozen sorted `membership` (`name`, `version`, `download_url`) before promotion |
| units | Exactly the approved candidate entries, described below |
| website | Clean `checkout`, checkout-relative `directory`, expected `sourceCommit`, public `url`, existing Pages `project` and `accountId` |

Each unit records `name`, candidate `version`, `repository`, clean `checkout`, approved candidate `sourceCommit`, public `download_url`, approved package `sha256`, observed `packageSignature` (`verified` or `unsigned`), and `daemon: true` only for the daemon runtime version exception. `versionFields` is the exact Stage03 list of `{path, kind, candidateVersion}` where kind is `manifest` or `daemon-runtime`. `tagPrefix` is the consumer's actual prefix (`daemon`, `jinni-snapmaker-u1`, or `plugin-{unit}`). `guard` is the actual consumer guard executable and relative script arguments, without the tag; the command supplies the exact prospective tag. `buildRequest` preserves the consumer's builder inputs, including `unit` and list identity where present; restored source/output paths, repository, selected ID, kind and key are bound by the command.

`unit.live.sourceCommit` is the separately prepared, version-only Live commit. `unit.live.receipt` is the exact Stage03 prepared receipt (source/tag/selection/tooling plus run/attempt, artifact ID/digest, archive/evidence hashes). The receipt and its exact GitHub artifact must already exist. Source publication or Actions preparation is an earlier explicitly authorized git/preparation checkpoint. Missing refs or receipts stop preflight; this command never silently pushes a source branch or selects a replacement build. It invokes the existing normal tag workflow using the receipt annotation, never repacks units locally.

Credentials use the existing `BESPOK3D_DESKTOP_APP_PUBLISH_GH_TOKEN` (mapped to `GH_TOKEN`) or authenticated gh route for control-plane operations, registry signing key names, and `CLOUDFLARE_API_TOKEN` plus `CLOUDFLARE_ACCOUNT_ID`. Public verification uses fresh anonymous HTTPS requests and never the signed-in account or GitHub API. Repository/account access checks cannot guarantee that a service will accept a later write; a real external failure is reported and retained for effect-checked resume.

`execution-report.json` beside the manifest records the exact approval hash, verified retained Live app artifacts, preflight result and observed effects. It is evidence, not a release ledger: remote state is re-inspected on every invocation, and progress flags never authorize skipping verification. Changing the approved evidence refuses an old execution report. Do not delete it to accept changed content; obtain a new candidate approval and execution record.

The Live app build still runs the existing `release.sh live` target at the staged source. Preflight verifies complete artifacts, feed hashes, macOS signatures/notarization and app identity. A resume reuses those retained exact artifacts. Existing remote bytes are checked before uploading only missing artifacts, with the app release pinned to the source SHA and its notes file. Units push one annotated tag at a time, wait for their exact workflow, verify assets and signed index result, then continue. The website is prepared from only the approved tracked tree in a disposable snapshot, with symlinks rejected; only the final authorized operation writes that exact download block into its source and deploys the snapshot. A failed deployment retains the exact rewrite, which the next preflight accepts; unrelated or unexpected local changes fail.

## Anonymous read-only verification

```sh
node scripts/verify-live.mjs surface.json /path/to/tested/b3-builder /path/to/trusted-key.asc
```

The surface file supplies `builderCommit`, `indexUrl`, `app: {atomUrl, channel: 'live', version?}`, and `websiteUrl`. Optional `candidates` contains approved units for exact version-only comparison; without it, each unit explicitly reports that comparison as unavailable. All indexes, packages and app artifacts are fetched fresh. Index signature, package signature and payload correspondence are separate results. Missing package signatures remain unsigned; invalid signatures fail. No new global signing policy is introduced.

The normal desktop gate tests orchestration and served fixtures without consumer sibling dependencies. Explicit full integration is:

```sh
B3D_RELEASE_INTEGRATION_WORKSPACE=/path/to/workspace node --test scripts/test/golive-integration.test.mjs
```

This lane requires actual current consumer sources and the tested builder, checks source snapshots for drift, executes real guards/stagers and package comparison, and uses synthetic dependency payloads plus local service doubles. It is not GitHub runtime or hardware proof.
