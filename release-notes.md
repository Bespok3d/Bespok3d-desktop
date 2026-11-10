# Bespok3d 0.7.7 beta

### Installing several plugins asks for every required value on one screen

Installing several plugins at once, or a whole list, put every setting of every plugin into one
shared form, and two plugins using the same setting shared one value. The app now shows one section
for each plugin that needs required values, keeps each plugin's answers apart, and only installs
once every one is filled in and valid.

### Try the next Bespok3d release before it goes live

There was no separate app for trying an upcoming release. Bespok3d Staging is a prerelease build
you can install alongside regular Bespok3d to check it before it goes live. Staging gets its own
updates without replacing your regular app.

### Try upcoming plugins alongside the regular store

The regular store did not show development versions beside published ones. Bespok3d Dev and the
new Staging app now show both, with a choice of which version to install.

### Installing a plugin also installs the plugins it needs

A plugin that needs another plugin now brings it along. If one cannot be found, nothing is
installed and the app says which one is missing.

### Recovery after a firmware update keeps a newer Bespok3d on the printer

Recovery no longer puts an older Bespok3d service over a newer one. Recovery, repair and updates
send only the files that changed, and update and repair put back the script that starts Bespok3d at
boot.

### The recovery report tells the truth about every plugin

The report no longer says "Recovery complete" when a plugin was switched off, left off, or could not
be read. It names those plugins. The safety check also runs after a restart you do yourself.

### The install list follows what the printer is really doing

The list now shows the plugin the printer is really working on. Skipped plugins show as skipped, and
the count matches the rows.

### Plain messages when the app cannot reach or log in to the printer

Refused or stuck logins and an unreachable printer now show plain messages in all 10 languages.
Resetting access asks for your own SSH password instead of trying the factory one.

### The Spoolman address is checked from the printer

The Spoolman address in a plugin's settings is now tested from the printer, where the plugin uses it,
not from your computer.

### Security updates

Electron 43.8.1 and other security updates.

### About Snapmaker U1 Extended Firmware

Running Bespok3d on a U1 with Extended Firmware makes no sense. If you want a feature from Extended
Firmware, publish a plugin that provides it, or ask for it and someone may build one.

### Plugins and lists from other publishers can now be verified

A plugin or a list signed by anyone other than Bespok3d used to show Signature failed, and a signed
plugin like that would not install at all, even when the signature was perfectly good: the app only
knew Bespok3d's own key. The app now looks for the publisher's own key where the publisher keeps it,
checks it really is that publisher's key, and verifies the signature with it. The badge then reads
Community verified, and the plugin page names the publisher's account.

Everything else stays as it was: a plugin nobody signed still installs as Unknown publisher, and
bytes whose signature does not match still read Signature did not match, and a signed plugin like
that still does not install.

### You can create and publish a signing key from the app

Making a signing key and publishing its public half used to need a development build. Settings > Keys
is now part of the app: make a key, publish its public half to your bespok3d-publisher repository,
and download the private half for signing your releases. The Published mark now means the file in
that repository really is this key; if something else sits there instead, the app says so instead of
claiming publication.
