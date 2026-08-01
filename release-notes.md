# What's new in alpha 35

Alpha 35 updates Bespok3d without a GitHub account.

## Check for updates works signed out

Signed out, the Update panel answered with an error and did nothing else: no version list, no check for a newer version, no rollback. All of it works with no account now. The app reads the same public release page anyone can open in a browser, and downloads the installer from the link that page offers.

A GitHub account is asked for to publish a plugin, and for nothing else.

## Opening the Update panel costs you nothing

The version list and the release notes used to be read through GitHub's API, which hands a computer with no account a small number of requests an hour, shared with everything else the app reads. They now come from the published release feed and from the files of the release itself, and neither of those is rationed. Checking, updating and rolling back spend none of that allowance, signed in or signed out.

## Rolling back reaches the ten most recent versions

The published feed carries the ten newest releases, so those are the versions the rollback list offers. Anything older is still on the release page in a browser.

## The store stops asking whether to look for a newer plugin version

Before an install, the app offered to look for a newer version of the plugin lists even when it had just read them. It now offers only when what it knows is more than an hour old. Opening the app and clicking the refresh wheel both count as reading them, so the question stops repeating. If the lists could not be read at all, the offer still comes.

## A plugin file on your machine installs without that question

A `.b3` you drop on the app, or a package you built yourself, is the version being installed. There is nothing online to look for, so the app no longer asks.

## A plugin on your machine shows the settings it carries

The settings offered in the plugin panel came from the published list, so an experimental build carrying extra settings gave you no way to set them. A package held on your machine now shows the settings its own manifest declares.
