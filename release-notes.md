# What's new in alpha 32

Alpha 32 is about collections: one card installs a whole set of plugins at once, and it has to pass the same checks a single install passes.

## The collections are in the store

Six new collections. Each one is a single card that installs its whole set in one go, with one restart of the printer's services at the end instead of one restart per plugin:

| Collection | What it installs |
| --- | --- |
| Single Camera | Camera HW Accel and the built-in camera |
| Double Camera | the same, plus the USB camera |
| Watch and Control | Remote Screen, Camera HW Accel and the built-in camera |
| Watch and Control Plus | the same, plus the USB camera and Timelapse |
| Materials Tracker Plus | the whole tag stack, plus AFC Lite and G-code preview colours |
| Performance Pack | TMC Auto-Tuned, TMC Low Current and Purge Line at Back |

Printer Screen as Camera is gone as a separate plugin. Remote Screen 0.1.21 registers the screen as a camera by itself, so what used to be two installs is one.

They were published before this release and you could not see them: the app asked the plugin sources for their lists without saying which copy it wanted, and got the one still being worked on rather than the one that was published. Every list, and the signature that proves it, now comes from the published copy.

## Installing a collection is checked like installing one plugin

A collection used to install its members straight through. Now the same gate a single install passes applies to every member before anything reaches the printer:

- it is refused while the printer is printing, like any other install;
- a member that clashes with something already installed, or that wants a port already in use, is left out and the rest still install;
- a member that is no longer published shows as **Not on your sources** and is skipped;
- the install button counts only what is actually going to install, so the number on the button is the number you get;
- the settings you are asked for before installing are the settings of the members that will install, not of the ones being skipped.

In the store, **Update all** is switched off while the printer prints, and hovering it says why.

## Also in this release

- **When the printer refuses a batch, it says so on screen.** Updating everything, and repairing a printer after a firmware update, could stop with nothing but the spinner going away. Whatever refused it now appears in the app, as **Update was interrupted** or **Recovery was interrupted**, followed by the printer's own reason, in your language.
- **The header says when a printer is printing.** The printer menu in the header says `printing…` under the selected printer's name while that printer prints. Nothing is locked by it: it is there so you see it before you aim **Update all** at a running print, rather than after.
