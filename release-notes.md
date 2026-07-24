# What's new in alpha 31

Alpha 31 is about proof. Everything you install now has to show where it came from, and the app checks that proof before your printer is touched.

## A package proves who built it, or it does not get installed

Until now the store told you who published a package and you had to take its word for it. Every package is now signed with its publisher's key, and the app verifies that signature against the package file itself before installing, every single time, including a package it already had in its cache. A file that verified yesterday says nothing about the file on disk today.

A package that fails the check is refused before anything reaches the printer, and the app says so plainly: `"<plugin name> was not installed. This package failed a security check. Your printer was not changed."` Four things get a package refused, and none of them can be waved through:

- its signature does not match its contents, so something changed after it was signed;
- it is signed but does not list all of its own files, which would leave part of the package covered by nothing;
- its contents belong to a different plugin than the one you asked for;
- its version is older than the one the store offers. An old package with a genuine signature is still a genuine signature, which is exactly what makes a downgrade worth attempting.

A package with **no** signature at all is a different case and is not blocked: missing proof is not failed proof. It installs and is shown as **Unsigned**, so you can see the difference instead of assuming.

Who a package says it comes from is no longer a name typed into a file either. The publisher is taken from the key that signed the release, and the package and its store entry get the same one, so the two can never claim different origins.

## The plugin list itself is signed

The store's list of what is available is signed the same way, and the app carries the key it checks against rather than trusting one that arrives alongside the list. The check is over the exact bytes the app received, so a list that was edited in transit fails even if the edit is invisible. A list that is unsigned or fails to verify still loads and is marked as unverified: a mistake by whoever publishes a list costs a badge, not your access to the store.

## Also in this release

- **A printer survives a firmware update that changes its kernel.** A plugin that carries a driver built for the printer's exact kernel no longer wedges anything when an update moves that kernel: the printer recognises the mismatch, switches the plugin off with a clear reason instead of a generic "install failed", and skips whatever depended on it.
- **One build system for every plugin.** Plugins are now built and signed by shared tooling instead of a hand-copied script per repo, which is what makes "every package is signed" true across the board rather than only where somebody remembered. Publishing identity and signing keys are inputs to it, so anyone can publish their own plugins with their own key using the same tool the project uses.
- **A tighter daemon.** The on-printer daemon gained a missing path guard while unpacking a package, so a crafted package cannot write outside the Bespok3d file system, and it now refuses a package whose required dependencies are missing instead of installing a half-working one.
- **Out of memory is reported, not guessed at.** A printer with a small amount of memory now detects and reports running out of it, instead of leaving you to work out why something died.
