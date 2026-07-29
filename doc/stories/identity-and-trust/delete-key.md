# Delete a key

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** Bespok3d user, **I want** to permanently delete a GPG key from the app, **so that** I can clean up keys I no longer use and remove them from my identity repo.

## Acceptance criteria

- [x] Each key row has a trash icon button
- [x] Clicking it enters a confirmation state on the same row (button changes to "Delete permanently" + "Cancel")
- [x] A warning message is shown: "Deleting this key is permanent. All printers and packages signed under this identity will lose verification."
- [x] If the key has an identity repo, the warning names it: "The public key will also be removed from `owner/repo`."
- [x] Confirming deletion: removes the `.asc` file from the identity repo (best-effort, failure does not block local deletion), then removes the key from the local keystore
- [x] If the deleted key was the default and other keys remain, the first remaining key becomes the default
- [x] All purpose assignments for the deleted key are removed

## Flags

> ❓ **UNCLEAR** - When a key is deleted, packages already signed with it are still verifiable by anyone who has cached the public key. The UI warns that verification will be lost, but this is only true for users who have not yet cached the key. The warning is technically misleading for already-distributed packages. Consider distinguishing "no longer verifiable by new users" from "loses verification globally."

> 🔲 **UNKNOWN** - Key deletion does not update the printer daemon's ACL. If a deleted key was enrolled with a printer, the printer still trusts it. A separate "revoke from printer" flow is needed but not designed.

> 🔲 **UNKNOWN** - Key rotation (the key-lifecycle decision) is the correct alternative to deletion for publisher keys that are still in active use. No rotation UI exists. Users who should rotate will delete instead, breaking the trust chain.
