# Generate a GPG key

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** Bespok3d user, **I want** to generate a GPG keypair inside the app, **so that** I can sign packages, authenticate to printers, and publish my identity without needing to run GPG on the command line.

## Acceptance criteria

- [x] Settings → Keys → "Generate new" opens an inline form
- [x] User enters a label (free text; used for display only)
- [x] Clicking "Generate" creates a GPG keypair locally; the private key never leaves the device
- [x] The new key appears in the key list immediately with its label, type (GPG · Ed25519), and creation date
- [x] If this is the first key, it is automatically set as the default
- [x] Generation takes a few seconds; a loading state is shown; the UI does not freeze

## Flags

> ❓ **UNCLEAR** - The key type is currently fixed (gpg-ed25519 shown in the UI, but earlier design notes show p521 and p256 variants too). Is the user ever given a choice of algorithm, or is it always Ed25519 going forward?

> ❓ **UNCLEAR** - There is no passphrase on the generated key. The private key is stored in the OS keychain / encrypted app data directory. Is this acceptable for the manufacturer and org-tier use cases where the key has higher stakes?
