# What's new in alpha 33

Alpha 33 stops the store installing yesterday's version: before it touches the printer, the app offers to check the plugin list is still current, and tells you what moved.

## The app asks the list is current before it installs

The plugin list the store shows you is a published file. It is correct the moment it is assembled and it goes stale the moment a plugin releases something newer. Until now the app installed whatever that list said, however old it was.

Now every install goes through the same check first, whether you are installing one plugin, updating one, ticking several, or installing a collection:

- if the list was refreshed less than an hour ago, nothing is asked and the install starts;
- otherwise the app asks **Update the list now, or proceed with the proposed list?**, and tells you how long it has been since the last refresh;
- if you say yes, it asks each plugin repository what it last released, then shows you what moved: `Spoolman: 0.1.29 becomes 0.1.30`. The install goes ahead with the newer version;
- if nothing moved, you see nothing and the install just starts.

The answer holds for an hour either way. A second install in the same hour goes straight through, and quitting and reopening the app does not buy you a second question. The what-moved list carries a **Don't show again** box, because it is information and not a warning.

Nothing here happens on its own. The app never polls, never refreshes in the background, and never asks while you are not installing. If the refresh cannot run, or a repository will not answer, you do not lose the install: the list stays as fresh as it already was and the install goes ahead.

## A plugin's page shows what its own repository last released

Open a plugin's page in the store and the app asks that one repository what its newest release is. If it is newer than the list said, the page shows that version and installing from the page installs that release, not the listed one. If there is nothing newer, the page says nothing about it and you never see a spinner or an error for the check.

This is asked when you open the page, and never at start-up. An address gets sixty questions an hour from GitHub, and opening the app already spends twenty two of them; asking every plugin's repository on every launch would take that to thirty two, and a second launch inside the hour would run the whole app out of questions and leave the store blank.

## A signature that did not match is not the same as no signature

A package or a source with no signature and one whose signature failed to check out were both shown as simply not proven. They are now two different things: no signature at all still reads **Unsigned**, and a signature that did not match its contents now reads **Signature failed**, with a warning mark instead of the shield.

Both still install. The label is there to tell you which one you are looking at, not to stop you.

The tier a source shows in **Settings > Repositories** is now the one the app worked out for itself, not the one written in your settings. A source you configured as **Project** whose signature did not check out reads **Signature failed**, not **Project**.

## Also in this release

- **The verify-signatures switch is gone.** It changed nothing: every package's signature has been checked on every install since alpha 31, whatever the switch said. It has been removed rather than left there implying a choice you did not have.
- **A printer's plugin settings survive a reflash.** They were filed under the identifier the printer's daemon hands out, and reflashing the printer or reinstalling the daemon mints a new one. They are now filed under the app's own record of the printer, and your existing settings are carried across the first time you run this version.
- **The About pane carries the licence in full.** Bespok3d is free software under the GNU Affero General Public License, version 3 or later, with no warranty, and the source is available. Its five links did nothing when clicked; **Release notes**, **Documentation**, **GitHub**, **Report an issue** and **Buy me a coffee** now open where they say they do.
- **A clearer word when the message broker is unreachable.** The app used to say to restart it. On a U1 there is nothing to restart by hand, so it now says to power cycle the printer and try again.
- **The collections shelf folds away.** There is an arrow next to **Collections** in the store. Click it and the shelf folds, leaving the plugins at the top. The app remembers it, so a folded shelf is still folded next time you open it.
- **The plugin list has a name.** It now carries a **Plugins** heading with the number showing in it, matching the collections above it, so the store reads as two lists instead of one running into the other.
