<!--
SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
SPDX-License-Identifier: AGPL-3.0-or-later
-->
# Running the in-vitro suite against a real printer

The in-vitro suite drives the app's real code over the wire at a device. The device is chosen by one
environment variable, and everything else about the run is identical: the same tests, the same
daemon-client, the same cert-pinned HTTPS.

| Where it runs | Command |
| --- | --- |
| Docker fake device (the default) | `./scripts/invitro.sh` |
| A real printer on the LAN | `B3D_DEVICE_TARGET=real-u1 B3D_HIL_HOST=<printer ip> ./scripts/invitro.sh` |

Against a real printer no fake device is built, so Docker is not needed at all.

## What the printer needs first

The printer must already be enrolled: the run reads the daemon certificate and token off it rather
than enrolling one for you, and it fails with "is the bot enrolled?" if they are not there. It must
also be idle. These tests deactivate, recover and remove, and none of that belongs anywhere near a
running print.

Every test restores what it changed, on failure as well as on success, and the suite hands the
printer back switched on with its own probe plugins gone. Plugins that were installed before the run
stay installed.

## Running one file

```sh
B3D_DEVICE_TARGET=real-u1 B3D_HIL_HOST=<printer ip> \
  npx vitest run --config vitest.invitro.config.ts tests/invitro/convergence.invitro.test.ts
```

`convergence.invitro.test.ts` is the lifecycle-convergence set: repair, deactivate, reactivate and
remove each run twice and on a half-broken printer, and the last test rebuilds the exact state that
used to report itself healthy (config includes gone, one plugin left half removed) and proves the
printer reports it and repairs it.
