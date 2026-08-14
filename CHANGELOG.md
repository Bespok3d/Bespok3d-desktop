# Bespok3d Changelog

---

## 0.7.4-beta - 2026-08-13

### Your printer updates from the store, without waiting for a new Bespok3d

A fix to the daemon, or to the adapter that makes your printer work, only reached your printer when a
whole new version of the app came out. They are now published on their own: open or refresh the
store, and if a newer one is out, Bespok3d offers it and puts it on the printer. It never takes your
printer back to an older version, and with no connection you get the copy that came with the app,
exactly as before.

### A plugin whose files another plugin changed stays switched on

Some plugins edit another plugin's files while they run, OctoEverywhere edits the printer's web pages
for example. Recovery used to switch off the plugin whose files had changed, and reinstalling it
lasted only until the next recovery. Recovery now leaves it running, says which files changed and
offers to reinstall it.

---

## 0.7.3-beta - 2026-08-11

### You can set up a printer with no internet connection

Everything Bespok3d needs to put on the printer now comes with the app, so setting one up works on a
laptop that has no internet, or that can see nothing but the printer.

### Large plugins install

A plugin bigger than a few megabytes gave up part way through downloading unless your connection was
very fast, and the error did not say why. They download properly now, however long it takes.

### Windows and Linux show your printer by name

Printers came up as "Network device" instead of their own name, and Bespok3d did not work out which
model they were. They now read the same as on a Mac.

### A plugin that needs a newer daemon than your printer runs is stopped before it installs

You were warned when you installed from the plugin's page, but not when the plugin arrived any other
way, so it could land on the printer and simply not work. You are now told every time, and the
message says which version you need.

### Your printer says what printer it is, instead of "Unknown"

Where the printer card should have said what kind of printer it is, some printers just said
"Unknown", even though everything about them worked. It now says what Bespok3d set the printer up
as, so it reads the same on every computer.

### The bar moves while you wait

Setting up a printer and updating its daemon showed a bar that sat completely still, right next to a
count of files climbing past a hundred, which made it look like the app had died. The bar now fills
up as those files go over, and it only pauses near the end, for the one part that gives nothing to
count.

### The wait while your printer restarts has a bar again

After Bespok3d puts your plugins back and restarts the printer, the wait showed a percentage next to
a bar that was not there at all: it had collapsed to nothing. There is now a bar across the width of
the window and no percentage. It empties while you wait, over the time your own printer takes to come
back, and clears itself when that time is up.

### Your plugin lists arrive when GitHub drops the connection

github.com drops the connection on some of the asks for the store's plugin lists. One dropped
connection used to lose that whole list, and the app never asked again, so plugins were missing from
the store with nothing said about it. A list is now asked for up to five times when the connection is
dropped. A host that is only slow is still asked once, so a slow connection never makes you wait five
times over.

---

## 0.7.2-beta - 2026-08-05

### Every plugin now tells you its licence and who it builds on

The Licence and attributions tab used to be empty for all but ten plugins. Every plugin now carries
what it is licensed under and whose work it is built on, so the tab is filled in for all of them, and
the licence link opens the licence file in that plugin's own repository.

### Windows updates itself again

The Windows installer in 0.7.0 and 0.7.1 was signed with the Mac certificate. Windows never trusts that one, and worse, the installer wrote the certificate's owner into the file the app reads when it looks for an update, so every update after it was refused before it could start.

The Windows and Linux builds are now made without the Mac key, and the release script fails if it ever picks it up again.

If you are on Windows and already have 0.7.0 or 0.7.1, this one update has to be downloaded and installed by hand. From this version on, Bespok3d updates itself again.

### Stopping and restarting your plugins now restarts the printer, and waits for it

Turning the plugins off, turning them back on, and removing Bespok3d all leave the printer running something other than what is now on its disk, and only a restart settles that. All three now restart the printer themselves instead of leaving it to you.

For stopping and restarting the plugins, Bespok3d stays on screen until the printer is back up, so Done means the printer is running and running what it now has. Removing Bespok3d has nothing left to wait for, so it tells you the printer is rebooting and lets you go.

A printer in the middle of a print is never restarted.

### The printer can ask for a restart

When the printer finds something only a power cycle clears, it now says so and offers the restart, instead of quietly behaving oddly until you work it out yourself.

### When the printer stops listening to Bespok3d, it says so in words

A printer that no longer includes Bespok3d in its own config, or that has part of the Bespok3d tree missing, used to show nothing at all if it had no plugins left. It now says the printer is not set up the way Bespok3d left it, and offers to put it back.

The message for plugins the printer is ignoring says what is actually wrong, in place of the word "drifted".

### A failure shows you a sentence, not a stack trace

When something goes wrong across a batch of printers, the headline is now a sentence. The printer's own words are one click away for whoever needs to quote them, rather than filling the screen and reading like Bespok3d itself is broken.

A printer carrying a mismatched pair of Bespok3d parts now says so and offers to fix it, which installs a matched pair and puts your plugins back.

### Your own SSH login, before you commit

The screen that asks you to go ahead now lets you hand over your own SSH login first, without backing out of what you were doing.

---

## 0.7.1-beta - 2026-08-04

### The plugin search clears in one click

Searching the store and then wanting the whole list back meant selecting the text and deleting it. A clear button now sits at the end of the search field whenever there is something to clear, and Escape clears the field while you are still typing in it.

Contributed by LixNix.

Two things that trapped people in the first public beta are gone.

### Taking a port from Mainsail or Fluidd moves it, instead of stopping you

With both web interfaces installed, giving one of them the port the other holds ended in "port already in use" and nowhere to go: the only way out was to work out which one had it and change that one first.

Now the port you type is yours. The other interface moves to a free port, and a line under the field names it and the port it moves to before you commit to anything. The move is made on the printer first and your own install or change goes out after it. If the printer refuses to move the other one, your install still goes out and the refusal is written to the log, instead of the button doing nothing.

**Make primary** fills the field in with 80, and a new **Make secondary** hands 80 back to the other interface and takes its port instead. Both only change what the field shows, with the line underneath naming which interface moves and where. Nothing reaches the printer until you press Update config, like every other change on that form. Before, the click moved both interfaces on the printer straight away while the field on screen still showed the old port.

Installing several web interfaces in one go gives each of them a free port of its own, so a batch can no longer hand two of them the same one.

A port under 80 and a port the printer itself needs are still refused, and now they say why in your language instead of in English.

### A server address is taken exactly as you write it, and tried straight away

Spoolman's server field took a host and a port and assumed plain http, so a Spoolman published under a name and a certificate could not be given to it at all: `https://spoolman.example.org/` was kept as `spoolman.example.org:443`, and the printer was sent to `http://spoolman.example.org:443`.

The whole address is now kept exactly as you write it, protocol and all. A name, an address, a port, a path, http or https: what you type is what the printer gets, and nothing is rewritten. A protocol picker sits beside the field for the one part a bare host and port leaves out, and setting it moves nothing else about what you typed.

The address is tried from this computer as soon as you stop typing rather than when you leave the field, so choosing a protocol checks it there and then. The line under the field says the service is reachable, or, when the server is there but will not serve that address, gives you the code it answered with. Nothing answering is a warning and never a block, because your computer and your printer are not always on the same network. An address that cannot be read at all does block, and says so.

Changing the configuration of a plugin you already have works the same way, and choosing a protocol frees Switch version instead of leaving it greyed out.

Fields that ask for a host or an address rather than a whole address still tidy what you paste out of a browser when you leave the field, so `http://192.168.1.50:8000/spoolman/` becomes the address the plugin wants.

### Thanks

wlodeka could not open the remote screen, and chasing that produced the Mainsail plugin fixes in 0.1.7 and 0.1.8 as well as the port work here. maxappel99 was fighting to get his Spoolman configured, and all of the address work came out of that. LixNix sent the search clear button, the first change in this app to come from outside.

---

## 0.1.0-alpha.36 - 2026-08-02

Bespok3d can tell us what gets used and what breaks, if you say it may.

### The app asks once, and no is the easy answer

On its first start Bespok3d asks whether it may send anonymous usage data. Until you answer, it sends nothing. Closing the question, pressing escape or clicking away all count as no, so the question is never left hanging over you and never comes back on its own. Settings, General holds the answer and a switch to change it whenever you like.

The question says what is sent and what is never sent on the screen you are looking at, not behind a link, and Settings shows you the same list.

### What is sent

That the app started, and a handful of things done with it: a printer enrolled, a plugin installed, the app updated. When something breaks, the kind of break and which part of the app it happened in. Your app version, the kind of app, the operating system it runs on and the language it is set to ride along with all of it.

That is the whole list. There is no screen counting, no click recording and no session replay, because there is no analytics library in the app to do any of it: Bespok3d writes each message itself, in one file, and sends nothing else.

### What is never sent

Nothing you type. Nothing about your printers: no serial numbers, no network addresses, no file names. Nothing about where you are: no country, no town, and the internet address your connection arrives on is never looked up and is never kept with what you send. No error text, only the kind of error.

There is no installation id. Every copy of Bespok3d reports under the same name, so the numbers can say how often something happens and can never say it was you. That is also why saying yes creates nothing and saying no has nothing to destroy.

It goes to a server Bespok3d runs, not to anybody else's.

### Turning it off stops it there

Turning the switch off stops anything further being sent, at once. It cannot take back what was already sent, and the app says so rather than implying otherwise.

---

## 0.1.0-alpha.35 - 2026-08-02

Updating Bespok3d needs no GitHub account.

### Check for updates works signed out

Signed out, the Update panel answered with an error and did nothing else: no version list, no check for a newer version, no rollback. All of it works with no account now. The app reads the same public release page anyone can open in a browser, and downloads the installer from the link that page offers.

A GitHub account is asked for to publish a plugin, and for nothing else.

### Opening the Update panel costs you nothing

The version list and the release notes used to be read through GitHub's API, which hands a computer with no account a small number of requests an hour, shared with everything else the app reads. They now come from the published release feed and from the files of the release itself, and neither of those is rationed. Checking, updating and rolling back spend none of that allowance, signed in or signed out.

### Rolling back reaches the ten most recent versions

The published feed carries the ten newest releases, so those are the versions the rollback list offers. Anything older is still on the release page in a browser.

### The store stops asking whether to look for a newer plugin version

Before an install, the app offered to look for a newer version of the plugin lists even when it had just read them. It now offers only when what it knows is more than an hour old. Opening the app and clicking the refresh wheel both count as reading them, so the question stops repeating. If the lists could not be read at all, the offer still comes.

### A plugin file on your machine installs without that question

A `.b3` you drop on the app, or a package you built yourself, is the version being installed. There is nothing online to look for, so the app no longer asks.

Updating everything at once follows the same rule. If every version in the set is held on your machine, the question does not come up. If even one of them comes from a published list, it does.

### A plugin on your machine shows the settings it carries

The settings offered in the plugin panel came from the published list, so an experimental build carrying extra settings gave you no way to set them. A package held on your machine now shows the settings its own manifest declares.

### An update comes from the place the plugin was installed from

The app used to look at every place a plugin is published, take the newest version anywhere, and install that. A plugin you run from your own bundle was therefore replaced by the published build. The update now comes from the same place the installed copy came from, on every route: the plugin's own button, "Update all" and "Install selected". If that place no longer lists the plugin, the app still offers the best it can find and the line says the update comes from somewhere else, instead of switching quietly.

It takes effect the moment you install. Installing a plugin from a build packed on your machine used to leave the store still offering the published build, and "Update all" would push that build onto the printer, until you closed the app and opened it again. The app now re-reads where each installed copy came from every time it re-syncs with the printer.

### The confirmation before an update lists the other versions

Each plugin in the confirmation carries a folded "Other versions" line. Opening it lists every place that plugin is published, with the version each one offers, and you can send one of those instead.

### An install the printer accepted is no longer reported as failed

The app asked the printer what plugins it already had before sending anything. A printer whose jinni was restarting answered that with an error, and the app showed the install as failed before a byte had been sent. That answer may now go missing without stopping the install, and a plugin that needs nothing else installed first is not asked at all.

### The app opens in the machine's language

A fresh install used to start in English whatever language the machine is set to. It now follows the machine, and Settings still lets you pick a language and stay on it.

### The unfinished parts are not in the released app

The Create tab, and the Keys and Labs panes in Settings, are work in progress and were on screen in the released app. They are now in a development build only. Starting the released app with `B3D_DEV_FEATURES=1` in the environment brings them back.

---

## 0.1.0-alpha.34 - 2026-07-31

The store works, and installs, without a GitHub account, and connecting to GitHub no longer asks you to copy a code by eye.

### The store needs no GitHub account

Install the app, never sign in, and the store fills: every plugin from every list. Nothing at start-up asks you to log into GitHub, and nothing in the store is held back until you do.

The app no longer asks GitHub's API where a list is. It downloads the published file straight from the release, and reads the file off the repository if there is no release. Neither of those is rationed, so the store cannot run out of requests. Even when you are signed in, loading a public list does not spend your own hourly ration.

Signing in is now only ever the fallback, for a list or a plugin that is genuinely private.

### Installing needs no GitHub account either

The store filled, and then Install failed with "Not connected to GitHub". A published plugin is a public file, so it now downloads with no account, the same way anyone downloads it from the release page. Signing in is tried only for a plugin whose repository is genuinely private.

When a download really cannot be done, the message says what you can do about it: the connection is down, the release was removed, GitHub is rationing this computer for now, or the plugin is not published publicly. None of them tell you your missing account was the problem.

### The app can check for its own updates without an account

Checking for a new version of Bespok3d, listing what versions exist, and rolling back to an earlier one all went through the same signed-in read, so signed out they did nothing. All three work with no account now.

### A plugin's page reads its release notes without an account

Opening a plugin used to need an account for two things that are public: the release notes and changelog published with the release, and how many times the download has been taken. Signed out, both were refused, the page quietly fell back to the copy shipped inside the app, and the download count was missing.

Both are read without an account now. The page shows the notes published with the version it is offering you, and the count, whether you are signed in or not.

### An empty store says which thing went wrong

An empty store used to look the same whatever caused it. It now says which one it is, and offers the sign-in button only for the two that signing in actually fixes:

- GitHub is rationing anonymous reads from your network: sign in and the ration goes up;
- the list or the plugin is private, or it is gone: sign in and you may be able to see it;
- GitHub could not be reached at all: nothing to sign into, check the connection;
- the list arrived and had nothing in it: nothing is wrong on your machine, it is the publisher's end, try again in a few minutes.

That last one used to be reported as being offline, which sent you off to fix a connection that was fine.

### The GitHub sign-in code is already on your clipboard

Connecting to GitHub shows a short code that GitHub wants you to type into a page in your browser. The app used to print it on screen and leave the rest to you, with nothing saying where that page was or what happened next.

Now the code is on your clipboard the moment it appears, so the browser tab is one paste away. If you lose it off the clipboard, click the code itself, or the copy button next to it, and it goes back on. A **Copied** balloon rises and fades each time, so you know it took.

The screen also says what is about to happen, in three steps: open github.com/login/device in your browser, paste the code, approve the access. The last step says the window finishes on its own, because it does, and there is nothing to click when it is over.

---

## 0.1.0-alpha.33 - 2026-07-30

The store stops installing yesterday's version: before it touches the printer, the app offers to check the plugin list is still current, and tells you what moved.

### The app asks the list is current before it installs

The plugin list the store shows you is a published file. It is correct the moment it is assembled and it goes stale the moment a plugin releases something newer. Until now the app installed whatever that list said, however old it was.

Now every install goes through the same check first, whether you are installing one plugin, updating one, ticking several, or installing a collection:

- if the list was refreshed less than an hour ago, nothing is asked and the install starts;
- otherwise the app asks **Update the list now, or proceed with the proposed list?**, and tells you how long it has been since the last refresh;
- if you say yes, it asks each plugin repository what it last released, then shows you what moved: `Spoolman: 0.1.29 becomes 0.1.30`. The install goes ahead with the newer version;
- if nothing moved, you see nothing and the install just starts.

The answer holds for an hour either way. A second install in the same hour goes straight through, and quitting and reopening the app does not buy you a second question. The what-moved list carries a **Don't show again** box, because it is information and not a warning.

Nothing here happens on its own. The app never polls, never refreshes in the background, and never asks while you are not installing. If the refresh cannot run, or a repository will not answer, you do not lose the install: the list stays as fresh as it already was and the install goes ahead.

### A plugin's page shows what its own repository last released

Open a plugin's page in the store and the app asks that one repository what its newest release is. If it is newer than the list said, the page shows that version and installing from the page installs that release, not the listed one. If there is nothing newer, the page says nothing about it and you never see a spinner or an error for the check.

This is asked when you open the page, and never at start-up. An address gets sixty questions an hour from GitHub, and opening the app already spends twenty two of them; asking every plugin's repository on every launch would take that to thirty two, and a second launch inside the hour would run the whole app out of questions and leave the store blank.

### A signature that did not match is not the same as no signature

A package or a source with no signature and one whose signature failed to check out were both shown as simply not proven. They are now two different things:

- no signature at all still reads **Unsigned**, and hovering it says **Signature not verified**;
- a signature that did not match its contents now reads **Signature failed**, and hovering it says **Signature did not match**. It wears a warning mark instead of the shield.

Both still install. The label is there to tell you which one you are looking at, not to stop you. A malformed signature file counts as failed rather than missing, and neither one stops a list loading.

The tier a source shows in **Settings > Repositories** is now the one the app worked out for itself, not the one written in your settings. A source you configured as **Project** whose signature did not check out reads **Signature failed**, not **Project**.

### The verify-signatures switch is gone

**Settings > Repositories** carried a **Verify package signatures** switch. It changed nothing: every package's signature has been checked on every install since alpha 31, whatever the switch said. It has been removed rather than left there implying a choice you did not have.

### A printer's plugin settings survive a reflash

The settings you fill in for a plugin were filed under the identifier the printer's daemon hands out. Reflashing the printer, or reinstalling the daemon, mints a new one, and every setting you had entered for that printer looked like it belonged to nobody. They are now filed under the app's own record of the printer, and your existing settings are carried across the first time you run this version.

### The collections shelf folds away, and the plugin list says what it is

The store opened on the collections, and the plugins started underneath them with nothing saying where one list ended and the other began.

- **Collections** now carries an arrow next to its name. Click it and the whole shelf folds away, leaving the plugins at the top of the store. The app remembers it: fold it once and it stays folded next time you open the app.
- The plugin list now carries a **Plugins** heading of its own, with the number showing in it, so the two lists read as two lists.

### Smaller things

- The About pane now carries the licence in full: Bespok3d is free software under the GNU Affero General Public License, version 3 or later, with no warranty, and the source is available.
- The five links in the About pane did nothing when clicked. **Release notes**, **Documentation**, **GitHub**, **Report an issue** and **Buy me a coffee** now open where they say they do.
- When the app cannot reach the printer's message broker, it used to say to restart it. On a U1 there is nothing to restart by hand, so it now says to power cycle the printer and try again.

---

## 0.1.0-alpha.32 - 2026-07-28

Collections arrive: one card installs a whole set of plugins at once, and it has to pass the same checks a single install passes.

### The collections are in the store

Six new collections. Each one is a single card that installs its whole set in one go, with one restart of the printer's services at the end instead of one restart per plugin:

| Collection             | What it installs                                              |
| ---------------------- | ------------------------------------------------------------- |
| Single Camera          | Camera HW Accel and the built-in camera                       |
| Double Camera          | the same, plus the USB camera                                 |
| Watch and Control      | Remote Screen, Camera HW Accel and the built-in camera        |
| Watch and Control Plus | the same, plus the USB camera and Timelapse                   |
| Materials Tracker Plus | the whole tag stack, plus AFC Lite and G-code preview colours |
| Performance Pack       | TMC Auto-Tuned, TMC Low Current and Purge Line at Back        |

Printer Screen as Camera is gone as a separate plugin. Remote Screen 0.1.21 registers the screen as a camera by itself, so what used to be two installs is one.

They were published before this release and you could not see them: the app asked the plugin sources for their lists without saying which copy it wanted, and got the one still being worked on rather than the one that was published. Every list, and the signature that proves it, now comes from the published copy.

### Installing a collection is checked like installing one plugin

A collection used to install its members straight through. Now the same gate a single install passes applies to every member before anything reaches the printer:

- it is refused while the printer is printing, like any other install;
- a member that clashes with something already installed, or that wants a port already in use, is left out and the rest still install;
- a member that is no longer published shows as **Not on your sources** and is skipped;
- the install button counts only what is actually going to install, so the number on the button is the number you get;
- the settings you are asked for before installing are the settings of the members that will install, not of the ones being skipped.

In the store, **Update all** is switched off while the printer prints, and hovering it says why.

### When the printer refuses a batch, it says so on screen

Updating everything, and repairing a printer after a firmware update, could stop with nothing but the spinner going away. Whatever refused it now appears in the app, as **Update was interrupted** or **Recovery was interrupted**, followed by the printer's own reason, in your language.

### The header says when a printer is printing

The printer menu in the header now says `printing…` under the selected printer's name while that printer prints. Nothing is locked by it. It is there so you see it before you aim **Update all** at a running print, rather than after. The printer is still the thing that refuses the batch, and since this release it also says why.

---

## 0.1.0-alpha.31 - 2026-07-26

Everything you install now has to prove where it came from, and the app checks that proof before your printer is touched.

### A package proves who built it, or it does not get installed

Until now the store told you who published a package and you had to take its word for it. Every package is now signed with its publisher's key, and the app verifies that signature against the package file itself before installing, every single time, including a package it already had in its cache. A file that verified yesterday says nothing about the file on disk today.

A package that fails the check is refused before anything reaches the printer, and the app says so plainly: `"<plugin name> was not installed. This package failed a security check. Your printer was not changed."` Four things get a package refused, and none of them can be waved through:

- its signature does not match its contents, so something changed after it was signed;
- it is signed but does not list all of its own files, which would leave part of the package covered by nothing;
- its contents belong to a different plugin than the one you asked for;
- its version is older than the one the store offers. An old package with a genuine signature is still a genuine signature, which is exactly what makes a downgrade worth attempting.

A package with **no** signature at all is a different case and is not blocked: missing proof is not failed proof. It installs and is shown as **Unsigned**, so you can see the difference instead of assuming.

Who a package says it comes from is no longer a name typed into a file either. The publisher is taken from the key that signed the release, and the package and its store entry get the same one, so the two can never claim different origins.

### The plugin list itself is signed

The store's list of what is available is signed the same way, and the app carries the key it checks against rather than trusting one that arrives alongside the list. The check is over the exact bytes the app received, so a list that was edited in transit fails even if the edit is invisible. A list that is unsigned or fails to verify still loads and is marked as unverified: a mistake by whoever publishes a list costs a badge, not your access to the store.

### A printer survives a firmware update that changes its kernel

A mesh-VPN plugin carries a driver (`tun.ko`) cross-built for the printer's exact kernel. When an OTA firmware update bumps that kernel the old driver no longer fits; the printer now recognises that precise mismatch, switches the plugin off with a clear reason instead of a generic "install failed", and skips whatever depended on it, so a stale driver never wedges the printer.

### The store shows the version of the app a plugin wraps, not just the plugin's own

A plugin that packages an existing project (Fluidd, Mainsail, OctoEverywhere, Tailscale, ZeroTier) now leads with that project's version, and shows its own packaging version in brackets: `Fluidd 1.37.2 (plugin v0.1.4)`. Before, the card showed only the plugin's `0.1.x`, which told you nothing about which Fluidd you were about to install. A plugin that wraps nothing is unaffected and shows one version as before.

### A card tells you who made a plugin, separately from the key that signed it

The store now shows an author name (who wrote the plugin) alongside the signing identity (the key that proves who shipped the release). The two were always the same field before, which conflated "who made this" with "who can prove they shipped it": they can be different parties, and only the signature is proof. The author is a plain display name; the publisher stays the key fingerprint the signature is checked against.

### The Intel Mac build is now offered but not supported

macOS on Apple Silicon (the `-arm64` build) is the supported one. The Intel (`-x64`) build is still there and still runs, but it is no longer tested or fixed: Apple is winding Rosetta down, so a problem that shows up only on the Intel build is not one the project chases. On an Apple Silicon Mac, take the `-arm64` build even if the Intel one would run.

#### Under the hood

- Plugins are now built and signed by one shared build system (b3-builder) instead of a hand-copied build script per repo, which is what makes "every package is signed" true across every plugin rather than only the ones somebody remembered. Publishing identity and signing keys are inputs to it, never baked in, so anyone can publish their own plugins with their own key on the same tooling the project uses.
- The on-printer daemon (0.12.19) gained a missing path guard while unpacking a package, so a crafted package cannot write outside the Bespok3d file system, and it now refuses a package whose required dependencies are absent instead of installing a half-working one.
- The daemon classifies a kernel-module load failure from the kernel's own boot log and deactivates the plugin through the same safety net that already peels off a plugin that breaks a service. To match a driver to a kernel it reports the running kernel's version magic as a device fact, which the adapter reads from ground truth (`modinfo` on a loaded module) rather than guessing from the version string.
- A printer with a small amount of memory now detects and reports running out of it (ADR-0040), instead of leaving you to work out why something died.
- How the app fetches and caches a plugin list was split by transport (GitHub, plain HTTP, local disk) with parsing and signature verification in one place, so what gets verified and what gets used can never drift apart, on a fresh fetch or a cached one.

## 0.1.0-alpha.30 - 2026-07-03

Install a whole setup in one click, read almost any filament spool, and give each printer its own settings.

### Collections: a curated set, installed together

The store has a new kind of entry: a **collection**. A collection is a hand-picked set of plugins that belong together, shown as a wider tile at the top of the store. Open it to see everything inside - each member links to its own page, so you can read up on any plugin before you commit - then **Install all** adds the ones you do not already have. They go on in a single batch with one restart, instead of one restart per plugin, and afterward each is just a normal installed plugin you can manage or remove on its own. A collection itself is never "installed" and has nothing to uninstall; it is only a shortcut for getting a set of plugins onto your printer at once.

### All the Tags: read almost any spool

The first collection, **All the Tags**, installs the complete RFID filament-tag reading stack in one go: the tag reader and hub, a decoder for every tag standard Bespok3d can read, and Spoolman tracking. Tap a spool and, if its tag is one we support, it is identified and tracked automatically.

That tag support grew a lot this cycle. Alongside the existing NTAG/OpenSpool reading, Bespok3d now decodes:

- **Open standards** - OpenTag3D, OpenPrintTag, TigerTag, and generic NDEF JSON tags, with no key needed.
- **Proprietary tags** - full payload from Bambu and Creality spools, using a key you paste into each plugin's config (the keys are community-known but not ours to ship; without one, the spool is still tracked by its tag's hardware id).
- **Anycubic** - the fields the community agrees on today (brand, material, temperatures), with the rest to follow once a real tag is shared.

Spoolman can now also recognize a spool by its tag's hardware id, not just its SKU, so a tag you have bound to a spool is matched on every tap.

#### Under the hood

- Collections flow through the same registry pipeline as plugins (a new `kind: collection` entry carrying a member list), are resolved into their own catalog layer so they are never mistaken for an installable package, and reuse the existing batch-install path end to end - no new on-printer machinery. "Install all" is exactly the batched, single-restart install used elsewhere, which is what keeps the screen safe from a restart storm.

### Plugin settings: shared across printers, or set per printer

Plugin settings used to be a single value shared with every printer. That broke multi-printer setups - Spoolman's "this printer's location" wrote the same name to every machine - and it could mislead you: an installed plugin's Config tab showed the value saved on this computer, not what was actually on the printer. Both are fixed.

- **Every setting is now either shared or per printer.** Shared is the default, so setting up your next printer still inherits everything you already configured. A setting that is naturally per-machine, like a printer's Spoolman location, is marked per printer by the plugin, and you can move any field between **All printers** and **This printer** right from its Config tab. A field that is per printer on any machine stays per printer for the whole fleet, so a shared value and a per-machine value can never be confused.
- **The Config tab tells the truth.** For an installed plugin it now reads the printer's actual current values off the device. If the printer cannot be reached it shows what this computer last sent and when, clearly marked as possibly out of date; and if even that is unknown, it says so plainly instead of showing a value it cannot vouch for.
- **Update all and batch installs resolve per printer**, so updating one printer never overwrites another printer's own values.
- **Settings > Plugin defaults was reworked** into an **All printers** view and a **Per printer** view (which follows the printer selected in the header), and it now scales to your fleet: an installed-only filter, grouping by plugin, and a search box, instead of one flat list of every field of every plugin in the store. Any row can be switched between shared and per printer in place.

#### Under the hood

- Each printer now carries a stable identity: a UUID the on-printer daemon mints once and keeps across firmware updates, so per-printer values follow the right machine even after an IP change or an OTA. The daemon stays unaware of scope - it still receives a flat set of values for its templates, and all shared-versus-per-printer resolution happens in the app.
- Daemon 0.12.12 adds a read-only config route the app uses to show the printer's real current values, and settings storage migrated to a scoped format that mirrors the shared values back to the old format, so a downgraded build keeps working.

### Steadier camera and screen mirroring

The camera and remote-screen plugins had a stream-resilience pass this cycle.

- **The camera survives a stalled stream.** A read timeout plus automatic reconnect keep the video going across a capture hiccup, and a "stream interrupted" placeholder replaces a frozen last frame until it recovers. WebRTC now stays up for as long as you watch instead of being recycled on a hidden timer. For tight-memory boards there are new options to turn WebRTC off and to pick 720p instead of 1080p. (camera-hw-accel 0.1.6.)
- **Screen mirroring is lighter and yields to printing.** A single shared capture feeds every viewer, so two or three watchers cost about the same as one, and it does no work when nobody is watching. Under load it eases the frame rate down (from 15fps toward 5fps) to leave processing power for the print. Sign-in and caching fixes let the mirror render inside embedded webviews (OrcaSlicer and similar) and behave correctly after Moonraker Login is turned on or off, including clearing stale tokens from a previous printer address. (remote-screen 0.1.20.)

### Also in this release

- **Fluidd updated to v1.37.2 and Mainsail to v2.18.0** (fluidd 0.1.3, mainsail 0.1.4), each with the AFC toolchanger Eject fix re-applied to the refreshed bundle.
- **Spoolman is steadier** (spoolman 0.1.29): a hand-picked spool now persists across restarts and reboots and is replayed once Klipper is ready, and Spoolman can record which printer a spool is loaded on. A stray "cannot resolve extruder" error that flashed in the console on a manual tool change outside a print is also gone: the tool-to-extruder map is now read live from the firmware, with no stale cache to fall behind (device-verified on both printers). The helper was also refactored from one large module into small single-concern modules.
- **Reliability fixes:** a display race that could leave a printer looking bricked until a power cycle is fixed on the device side (jinni 0.1.7), and the app now tracks a printer more reliably when its network address changes (improved mDNS discovery and address resolution).

### Tidier dialogs and panels

The app's pop-up windows got a consistency pass so they always stay inside the app and layer the way you expect.

- Dialogs no longer run off the top of the window. A tall pop-up - a long plugin detail page, a full settings panel - is now kept within the space below the header, so its top edge and close button are always reachable instead of slipping behind the header bar.
- Windows stack in the order you open them. Opening Settings on top of a plugin's detail window now puts Settings in front, and a dialog opened from inside Settings still lands above Settings - whichever way you go, the most recently opened window is on top.
- The Settings window now opens to the same generous width as the plugin detail window instead of being capped narrower, giving its longer panes more room.

#### Under the hood

- Window stacking is now owned by the shared dialog scaffold, which gives each window an open-order layer beneath the header (so the printer dropdown and notifications stay clickable above any dialog); individual dialogs no longer hard-code their own stack order. A new `--modal-max-h` token caps every dialog to the area below the header, replacing several hand-tuned height values, and both backdrops clear the header by the same measured amount.

### A deep code-health pass

This release closes a large, multi-session engineering-health effort to pay down the codebase's accumulated complexity.

- Oversized files were split by responsibility, genuinely shared code (including the cross-language contract types) was collected into one place, and dead code, duplication, and unused styles were cleared out across the app and the on-printer daemon.
- A standing quality gate now runs with every check and fails the build on any new un-justified code smell, so the codebase holds at zero-or-justified and these clean-ups never have to be repeated.
- None of this changes what the app does; it is the groundwork that keeps future releases fast and safe to ship.

---

## 0.1.0-alpha.29 - 2026-06-17

### Release channels: choose how bleeding-edge you want to be

You can now tell Bespok3d how much risk you want from your plugins, and it respects that choice everywhere. Pick a default channel - from rock-solid **LTS** up through **Stable**, **RC**, **Testing**, and **Experiment** - and the store treats it as a ceiling: every plugin offers its newest build at your level or stabler, and never anything riskier. A plugin that only ships a stable build still shows up when you are on Experiment; an experiment-only plugin stays hidden until you ask for it. Only one version of a plugin is ever installed on the printer.

#### A channel per plugin, and a default for everything else

Set your default channel in Settings > Repositories. It is a stability ceiling, not an exact pick, so raising it only ever offers you more, never forces a riskier build of something you were happy with. You can opt a specific channel out entirely, and you can override the default for a single plugin from its **Versions** tab when you want, say, the experimental camera build but stable everything else. Your choices are remembered.

#### The store shows the channel, honestly

Each plugin card shows the version and channel that would actually install for you, badges the channel your installed copy came from, and only flags an update when there is a newer build on the channel you are on - so a newer experiment build never nags you to "update" when you are on stable.

Most plugins ship a single stable build today; plugins will begin publishing multiple channels over the coming releases, and the controls are ready for them now.

#### A reworked store filter you can actually combine

The store's filters moved out of a cramped toolbar row into a side panel that opens from the funnel (now sitting before the search box). The channel, category, and source-trust filters are multi-select and stack: pick several of each at once instead of one choice at a time. Install status (installed, not installed, or needs updating) is a single choice, since those states are mutually exclusive; picking one replaces the last, and clicking the active one clears it.

The panel slides open smoothly, and as your filters change the plugin cards animate to their new spots rather than snapping, so it is easy to follow what moved. Motion is disabled automatically if your system asks for reduced motion.

#### Under the hood

- The catalog resolver now keeps every channel of a plugin as a distinct variant instead of collapsing them to one, and a single ceiling rule decides what installs, what the card shows, and what counts as an update - one source of truth across the whole store.
- Installing a plugin records which channel it came from (alongside which source), so the app can badge it and reason about updates correctly; the record is pruned when the plugin is removed.
- Your default channel and per-channel opt-outs persist with your settings; per-plugin channel choices persist in the app. This release ships the in-app channel system; the publishing side (one plugin id offering several channels) follows.
- The **Versions** tab's channel chips now filter the list to one channel at a time, with an **All** chip to show every build again, so a plugin that publishes several channels is easy to browse.
- Fixed a display bug where a Versions row could pair one channel's label with another build's version number (for example, an experiment build showing the stable version already on the printer). Each row now always shows its own source's version, and what is actually installed is listed separately. The "installed" match now considers both the source and its channel, not the source alone.

### Printers that look right and read right

Alongside channels, this build cleans up how a printer presents itself: a real product icon, an address you can trust, a calmer connection state on launch, and a way to re-run any setup step on demand.

#### Printer icons, and a real Snapmaker U1

Adapters can now ship their own printer icon, so a printer shows its actual hardware instead of a generic glyph - the Snapmaker U1 now appears as a real U1 across the app, including the printer picker in the header, not just the settings list. Your own picture still wins when you set one, and "Revert to icon" now goes back to the adapter's icon. A picture with a transparent background also shows your chosen colour through it, instead of a blank backdrop. (Setting an icon from a photo was also silently blocked before; it works now.)

#### Your printer's address stays correct when DHCP moves it

A printer that picked up a new IP address from your router kept showing its old one, and two printers that swapped addresses showed each other's - confusing and, frankly, a bit alarming. The app now recognises a printer by its stable network name and adopts its live address as soon as it sees it, so the address on screen is always the real one.

#### A calmer launch: it waits before crying for help

On startup the app no longer shows a green "connected" light for a printer it has not actually reached yet. It shows a gentle "checking" pulse while it confirms the connection, and holds back the yellow Repair / Recover bar until it is sure the printer needs it - so an offline printer on a fresh launch no longer greets you with a green light and a fix-it banner at the same time.

#### Force: re-run any setup step on demand

Settings > Printers gains a **Force** button on every enrolled printer, with a small menu to re-run **Re-enroll**, **Full recovery**, **Fix daemon**, or **Reinstall plugins** whenever you want - the recovery flows that the app normally offers only when it detects a problem are now always within reach.

#### Under the hood

- The adapter contract carries an optional icon as a data URL, threaded to the renderer through the existing capability serialisation; the U1's render is downscaled and inlined so no extra asset ships.
- mDNS discovery now reconciles a saved printer to its live address by stable hostname rather than by IP, persisting the corrected address; an IP can only change on a hostname match, so two printers can never be crossed. Covered by regression tests for the lease-move and lease-swap cases.
- The connection dot starts every launch in a re-verifying "checking" state rather than trusting a stale "managed" status, and the Repair / Recover / root-access banners are gated on a confirmed status so they cannot appear mid-check.

### Installing a plugin, with the lights on

Installing a plugin used to be an opaque wait: a spinner, then either it worked or it didn't. Now the install shows you each step as it happens - unpacking, placing files, linking, patching, restarting services - streamed live from the printer while it works. The progress window stays open until you dismiss it, and when the install finishes it shows the full report right there.

- The step-by-step report is now kept with the printer, so you can reopen a plugin and review exactly what its last install did on the device, even after restarting the app.
- A plugin already on your printer now reads **Reinstall**, not "Switch version", when the copy you have selected is the one that is installed - even if its catalogue version drifted from what is on the device.
- Fixed a bug where uninstalling a plugin that replaced a built-in web UI (like Fluidd) could leave that UI missing until a reboot. The original is now safely set aside on install and restored on uninstall.
- The plugin detail window now scrolls its content properly instead of growing past the edge of the app on long pages, and its close button sits where it should.
- **You can see the upload now.** The "Sending to printer" stage shows a real progress bar with percent and transfer speed, so a large plugin no longer looks frozen while it copies across, and the step shown matches what is actually happening instead of reading as a later stage like "Permissions". The same bar covers single installs, batches, and the first daemon deploy at enrolment.
- Live progress rides a separate WebSocket so the install request keeps its simple, single request-and-response contract; the install runs off the daemon's event loop so each step can be reported the moment it completes.

### Set up several plugins at once

You no longer have to install or remove plugins one at a time. The store toolbar's **Select** button (on a managed printer) now opens a small menu to start a batch.

- **Select to install** lets you tick the plugins you do not have yet; **Install selected** sets them all up in one pass, asks up front for any configuration they need, and restarts Klipper and Moonraker once for the whole set instead of once per plugin.
- **Select to uninstall** lets you tick the plugins you do have; **Uninstall selected** removes them together, again with a single restart. If something you picked is still needed by another installed plugin, it tells you what else has to go and asks before removing the lot, exactly as a single uninstall does.
- While a batch runs you watch each plugin tick through its steps with a running count, instead of one opaque spinner. **Update all** uses the same live view.
- When the batch finishes, the store grid and the printer's endpoint menu refresh on their own, so what you see is up to date without a manual reload.

#### Under the hood

- The printer daemon (now 0.12.10) gained a batch-uninstall command that mirrors the batch update: it removes each plugin with its service restart deferred, then runs the deduped restarts once and waits for Klipper and Moonraker to come back healthy, so a multi-plugin removal bounces the services a single time. One plugin's failure is contained and never aborts the rest of the batch.
- The store re-reads the printer's installed set the moment a batch settles, the batch equivalent of how a single install already refreshed it, which is what keeps the grid and the endpoint menu from going stale until a reload.

### The Remote Screen works with the Moonraker Login plugin

If you turned on the Moonraker Login plugin, the Remote Screen mirror went dark: the page opened but the live view never started. It now works like Fluidd. With login off it just connects. With login on it reuses the web-UI session you are already signed into, so it streams without asking again; and if you open the screen somewhere you have not signed in, it shows a login on the screen itself instead of failing or sending you elsewhere. It keeps your session fresh on its own, so the view does not drop out after an hour.

#### Under the hood

- The mirror's video had been authenticating with a one-shot token in the stream URL, but Moonraker's login gate (an nginx auth check) does not forward a URL token to Moonraker, so the request was rejected while logins were forced on. The browser now reads the stream over fetch with the Authorization header, the credential the gate does pass, and the on-screen login uses Moonraker's own login and token refresh. The screen stays behind Moonraker's auth, as it should for a surface that can drive the printer.
- Ships as Remote Screen 0.1.12, published to the plugin registry; enrolled printers pick it up as a plugin update.

### Under the hood: the on-printer daemon, cleanly split

The on-printer service was refactored to separate generic orchestration - deciding what to do - from the device-specific work of actually touching the printer, which now lives in its own adapter, the jinni. Nothing changes for you day to day: it makes the daemon sturdier (a failed step never leaves the printer broken) and makes supporting new printers much easier going forward. It ships transparently; enrolled printers pick it up on their next daemon update.

---

## 0.1.0-alpha.28 - 2026-06-12

### Connection sensing you can trust, and a store that tells you why

This build is about not leaving you guessing. Your printer no longer flips to "offline" because of a single missed check or because the app was in the background, and when the app does lose contact it tells you which rung of the connection it lost and what to do about it. The plugin store explains every greyed-out Install button instead of just dimming it, modals stop closing by accident, and the Moonraker Login plugin no longer disables itself.

#### Your printer stops going falsely offline

The app used to mark a printer offline on a single failed check, and Windows and macOS both throttle a backgrounded app's timers, so minimizing the window or a brief network blip could turn a healthy printer red. Now a printer only goes offline after two checks in a row fail, the app keeps checking at full rate in the background, and connection sensing walks a ladder instead of one ping: it confirms the on-printer daemon, then Moonraker and the web UI, then SSH, then a plain ping. That lets the app tell apart "the daemon is down but I can still reach the printer over SSH" (it offers to **Repair** it), "the printer is alive but root access is off" (it tells you to turn root access on, since without it the app can neither enroll nor recover a printer), and "actually unreachable". Hover the status dot and it now says, in plain words, what the app thinks is going on.

#### The store explains every blocked Install

A greyed-out **Install** button now says why, right under the button, with the deeper detail one click away: pick a printer first, fill in the configuration it needs (with a one-click jump to the Configure tab), remove a conflicting plugin, or wait for the current print to finish. No more dark buttons with no reason - this is what made **Spoolman** look broken when it was only waiting for its server address.

#### Modals stop closing by accident

Selecting text in a field and releasing the mouse outside it, or clicking back into the app after switching to another window, no longer dismisses the dialog, the plugin page, or Settings. A backdrop only closes when you actually click the backdrop.

#### Moonraker Login no longer disables itself

Installing the **Moonraker Login** plugin turns on forced logins in Moonraker, which also shut the door on the printer daemon's own health checks, so the daemon decided Moonraker was down and the safety net deactivated the very plugin you just installed, even though the login page worked fine. Fixed at the root: the daemon now talks to Klipper and Moonraker over their local sockets, which never require a login, so the print-safety guard, the health checks, and the "which plugin broke" detection all keep working with logins forced on. A printer must update its daemon (the app prompts you) to get this.

#### A firmware update now recovers the printer, instead of a repair that does nothing

Updating the printer's firmware resets its overlay write layer. A daemon **Repair** only redeploys the daemon, so on a freshly-updated printer it would write files that vanish on the next reboot, and report success anyway, leaving your plugins quietly not working. The app now checks the write layer once when a printer comes back daemon-down-but-reachable and shows the right action up front: a freshly-updated printer offers **Recover** (a full re-enroll that rebuilds the daemon and boot hooks so it persists), not a hollow **Repair**, and says in plain words that a firmware update reset the printer. Recovery also actually runs now - escalating from a failed repair used to leave the dialog stuck without starting anything. If you updated firmware, recovered, and your plugins still did not work, this is the cause and the fix.

#### Under the hood

- Printer daemon 0.11.5: the health and print-state checks moved onto Klipper's and Moonraker's local Unix sockets (auth-free local IPC), so forced logins can no longer blind them. A Moonraker that answers "please log in" is now correctly read as "up", not "down", and a Moonraker component that failed to load is still visible to the safety net even behind a login wall.
- The "keep connected, and recover" paths are now pinned by a layered regression net: the full connection-status matrix and the missing-daemon / Repair-vs-Recover routing run as fast app-level tests on every build, and the real recovery procedures (daemon down then back, the post-firmware-update write-layer reset, recover-over-the-wire) run against a real daemon in a container. That suite is written against a device-target seam so it will run unchanged on a dedicated hardware test printer when one is in hand.
- The build gate gained two static guards that catch orphaned code (a handler or whole screen that exists but is no longer wired): dead-export/file detection on the app and reachability analysis on the daemon. Their first run already found and removed a dead settings pane and a superseded catalog loader.

---

## 0.1.0-alpha.27 - 2026-06-11

### A reliability release: a bad plugin can no longer take your printer down

The headline is self-healing. If installing a plugin, or a firmware update, leaves Klipper or Moonraker unhealthy, the printer daemon now works out which plugin caused it, deactivates just that one, and brings the printer back. When that happens the app shows a recovery summary of what was turned off and why, with a one-click bug report. You can also view a plugin's logs and captures right in the app, instead of SSHing into the printer.

The AFC (multi-material) panel finally behaves on the U1 toolchanger: the new **AFC Lite** plugin shows each lane's filament name via Spoolman, and the lane buttons do the obvious thing - **Load** loads filament, **Unload** unloads it, and **Eject** docks the tool, enabled only for the tool actually mounted on the carrier (Fluidd and Mainsail both). A spool you pick by hand in Spoolman (no RFID) now shows on the panel too, and its **color and material** follow through to both the AFC panel and the printer's own touchscreen, so every view agrees without touching the screen. RFID-tagged lanes still take their data from the tag, and a pick made mid-print is applied when the print ends.

The plugins introduced in alpha 25 are no longer untested betas: Print Notifications, Prometheus Exporter, System Utilities, Status Feed, and Human-readable Print Time are now verified on a real Snapmaker U1 and promoted from experiment to stable (alongside AFC Lite). WLED and Print Lifecycle Hooks stay on experiment while they get more testing; **OctoEverywhere now connects end to end on a real U1** (see below) and stays on experiment for wider testing.

#### Connect remote-access plugins with one click, no SSH

OctoEverywhere and tools like it print a **one-time setup link** to their log on first start; until now you had to SSH into the printer to dig it out. The new **Captured output** tab on a plugin's page surfaces those links automatically, each with **Copy** and **Open in browser** buttons. Captures are remembered per printer, so the link is waiting for you whenever you come back, even if you miss it the first time (the setup link itself is one-time and usually stops working once you have connected). A plugin's documentation can now link you straight to the tab. There is also an **Install log** tab that shows, step by step, exactly what happened on the printer during install, so a failed step is obvious instead of silent.

This is how OctoEverywhere setup now works: install it, open Captured output, click **Open in browser** on the `getstarted` link, sign in to a free account, done.

#### Under the hood

- Printer daemon 0.11.4: package install/uninstall reworked, intent-based install, and declarative plugin Python dependencies (baked into the package and installed offline, so nothing pip-installs on the printer). A plugin's baked Python deps now install deterministically (the daemon installs the prebuilt wheels directly, with no dependency resolver, so the offline install can no longer stall or fail on version ranges).
- Plugins that vendor third-party app source (like OctoEverywhere's companion) are now baked complete whether they are published or bundled locally for testing, so the on-printer files are never missing.
- The catalog stays fully online; plugin updates are published, not bundled. Dev builds can opt into a local bundle set via `bundle.dev.json`, which is never shipped in a release.

Note: Fluidd is a browser app, so after installing or updating it you may need a hard refresh or to clear site data before the new version shows.

---

## 0.1.0-alpha.26 - 2026-06-09

### Daemon updates, fixed

Keeping your printer's on-board daemon up to date works properly again. When the app ships a newer daemon than the one on your printer, it tells you, and **Update daemon** reliably brings the printer up to date and confirms the new daemon is actually running before it calls the update done, so a printer can no longer look up to date when it isn't.

A reliability build on top of alpha 25; everything from alpha 25 (below) is included.

---

## 0.1.0-alpha.25 - 2026-06-09

### The catalog goes online, and a batch of new plugins brings feature parity with the extended firmware

The plugin catalog now streams from the online Bespok3d registry, and a wave of new plugins ports the remaining worthwhile extended-firmware features. The store also starts telling the truth about trust, channels, and updates. Everything new here is on the **experiment** channel and **not yet verified on a physical printer** - treat it as a beta.

#### The catalog is now online

- The app no longer ships a bundled copy of the plugin catalog; it loads from the online Bespok3d registry. The local source mechanism stays (for sideloaded `.b3` files and future opt-in bundling), but nothing is baked into the app by default.
- **During the private alpha you must connect GitHub** (Settings, Git Host) to load the catalog, since the registry repositories are private. Without a connection the store shows the "Sign in to GitHub" notice in the notification bell and the Repositories pane.
- Sideloading your own `.b3` (drag and drop or double-click) still works offline.

#### New plugins (all experiment)

- **WLED Status Lights** - drive a network WLED strip from Moonraker.
- **Print Notifications** - a push to your phone or chat (Telegram, Discord, ntfy, Pushover, email, and more, via Apprise) when a print finishes, fails, or errors.
- **Print Lifecycle Hooks** - run your own macros at print start/end/cancel by naming them `_PRINT_START_*` etc.; they run in numbered order (read the ordering warning).
- **Prometheus Exporter** - Klipper/Moonraker metrics at `:9101/metrics` for Grafana and friends.
- **System Utilities** - static `curl` and `rsync` on the printer (stock firmware ships neither).
- **Panda Breath** - run a BIQU Panda Breath chamber heater as a standard Klipper heater (own repo).
- **OctoEverywhere** - free remote access and AI failure detection via the OctoEverywhere cloud (own repo).

#### A store that tells the truth

- **All release channels are on by default** (Settings, Repositories), so the new experiment plugins are visible. Turn channels off to hide them.
- **Trust badges are honest:** plugins published by the Bespok3d org read **Project**; a third-party list accepted into the official list reads **Community**. (This is curation-based for now; signing-based trust comes with PGP.)
- **Every plugin ships a changelog** (the View changelog tab), and update notices no longer mistake an older catalog version for an update.
- The Name / Published / Updated **sort moved next to the filter button** (now a funnel icon), out of the collapsible filter row.

#### Under the hood

- **`b3d://` deep links:** the app opens a plugin straight from a `b3d://` link, and `b3d://` references inside a plugin's description are now clickable. (Groundwork for one-click GitHub sign-in is in place; the current device-flow sign-in is unchanged for now.)
- **Daemon 0.10.34-dev:** a new `system-bin` capability (used by System Utilities). Enrollment's "is it mid-print?" check now calls Moonraker's HTTP API directly instead of running a shell helper on the printer.

#### What to focus on this build

1. **Connect and browse.** Connect GitHub, confirm the full catalog loads online, and that the new experiment plugins (channels are all on by default) appear and install.
2. **Try a couple end to end** - WLED or Print Notifications are the easiest to verify.
3. **Unconnected state + trust.** Before connecting, confirm a clear "Sign in to GitHub" prompt (not a blank store); after, confirm org plugins read Project and each plugin shows its changelog.

---

## 0.1.0-alpha.24 - 2026-06-08

### A notification center, and a friendlier plugin catalog

A single place for the things Bespok3d needs to tell you, a plugin store that no longer demands a GitHub sign-in just to open, and two new plugins.

#### One place for notifications

- A new **bell in the top bar** collects cross-cutting notices: a **plugin update is available**, or a **plugin source needs you to sign in**. Mark notices read or dismiss them, with Mark all read and Dismiss all; the badge counts unread. Clicking a plugin's update notice opens it on its changelog.

#### Friendlier plugin sources

- The plugin store no longer needs a GitHub connection just to open, and a **private** source you cannot read yet offers a one-click **Sign in to GitHub** that reloads the catalog automatically once connected.
- A source that cannot load now reports why (sign-in needed, not found, or a network problem).

#### Two new plugins

- **AFC Lite (Automated Filament Changer):** four-lane filament tracking for the U1's toolheads, with tool-change macros.
- **Faulty Toolhead Bypass (1 to 4):** a temporary recovery override so a U1 with a damaged toolhead thermistor can still boot on its healthy toolheads.

---

## 0.1.0-alpha.23 - 2026-06-07

### Faster, steadier setup, and Repair instead of re-Enroll

A reliability build. Setting up a printer is quicker and no longer stalls on the upload, and a printer whose daemon has gone quiet now offers a gentle Repair instead of a full re-enrollment.

#### Enrollment and plugin uploads no longer stall

- Setting up a printer (and deploying its on-printer daemon) is **noticeably faster** and no longer **fails partway at "Deploying the daemon."** Bespok3d was opening a brand-new file-transfer channel for every single file it sent and never closing them, which added a slow round-trip per file over Wi-Fi and could exhaust the printer's connection limit mid-deploy. It now reuses one channel for the whole session.
- The same fix speeds up installing and updating plugins, which send many files the same way.

#### Repair a printer instead of re-enrolling it

- In **Settings, Printers**, a printer you have already enrolled but whose daemon is currently unreachable (powered off, restarting, or just after a firmware update) now offers **Repair daemon** instead of **Enroll**.
- This matters: the old **Enroll** would have run the whole 14-step setup again and **rotated the printer's security credentials**. **Repair** redeploys a fresh daemon and keeps them. It mirrors the repair prompt already shown in the main window.

#### Under the hood

- New end-to-end test harness that drives the real app through enrollment against a faithful, stand-in Snapmaker U1 (seeded from real, sanitized firmware files), so regressions in setup are caught before they reach a printer. Both fixes above were found and verified this way.

### Things to focus on this build

1. **Set up a printer again.** Re-enroll (or redeploy the daemon to) a printer and confirm it runs through faster and reaches **managed** without stalling at "Deploying the daemon."
2. **Repair, not Enroll.** Take an enrolled printer's daemon offline (power the printer off, or right after a daemon update) and open **Settings, Printers**. Confirm it offers **Repair daemon**, not Enroll, and that Repair brings it back without asking you to re-enroll.
3. **Installs still work.** Install or update a couple of plugins and confirm the faster upload still lands everything correctly.

---

## 0.1.0-alpha.22 - 2026-06-06

### The in-app updater, made reliable

A reliability pass on the auto-updater after a tester's Windows update froze at 100%. The download path and the version-history actions are both fixed; no new features (it carries alpha 21's sideloading).

#### Updates that actually finish (Windows and Linux)

- Fixed app updates **freezing at 100%** on Windows and Linux. The updater used a piecewise "download only the changed pieces" method that stalled silently against our private release storage. It now downloads the full installer in one go, which completes. macOS was never affected (it already downloaded the whole file).
- If a download fails or takes too long, the update window now **shows what happened** and offers an **Open download page** button, so it can no longer get stuck with nothing to click.

#### Version history fixes

- Fixed the version-history button **failing with a download error** (it was fetching the installer the wrong way for a private release). Picking a version now downloads correctly.
- The button is labelled by what it does: **Update** for a newer version, **Install** for an older one, instead of always saying "Reinstall" (wrong for a version you never ran).

### Things to focus on this build

1. **Update from an older build.** On Windows or Linux, let it auto-update (or check manually) and confirm the download runs to completion and installs, rather than sitting at 100%.
2. **Version history.** Open Settings, Update, Version history. Confirm newer entries read **Update** and older ones read **Install**, and that picking one downloads without the previous error.
3. **macOS unchanged.** Confirm the macOS update still applies as before.

---

## 0.1.0-alpha.21 - 2026-06-06

### Sideload your own plugins

You no longer have to wait for a plugin to be published to try it. You can add a `.b3` package straight from your computer, and it sits alongside the bundled and online plugins as just another source you can install from.

#### Drag, drop, or double-click

- **Drag a `.b3` file onto the Bespok3d window**, or **double-click a `.b3`** in Finder or Explorer, and it is validated and added to your own local library. If a printer is selected, Bespok3d then asks whether to install it right away.
- The check is deliberately relaxed: a package only needs to be installable and have a clear identity (name and version). A file that is not a real plugin gives a plain-language error explaining what was wrong, and one bad file never blocks the others in the same drop.
- Your dropped plugin is badged **local** so you can tell it apart from a bundled or online copy of the same plugin, and dropping a newer build replaces your previous local copy (there is only ever one local copy per plugin).

#### Choosing which version to install

- When a plugin exists in more than one place (your local copy, the bundled copy, an online list), the detail view gains a **Versions** tab listing each one with its source and version.
- Pressing **Install** opens that tab first so you choose the exact version, then installs it. You can switch an already-installed plugin to a different version the same way.

#### Removing a sideloaded plugin, with the full picture

- Remove a local plugin from the **Versions** tab using the trash button on your local copy.
- If it is installed on a printer, Bespok3d explains your choices before doing anything: remove it from Bespok3d and from the printer, or keep it on the printer. If you keep it, you are told what that means: switch it to a bundled or online version if one exists, otherwise it can only be uninstalled later.
- A plugin that stays on a printer after its only source is gone still shows in the store as **"installed, no source"**, so you can always uninstall it from there.

### Things to focus on this build

1. **Drop a plugin.** Drag a `.b3` onto the window with a managed printer selected, and confirm it is added and offered for install. Then try double-clicking a `.b3` in your file manager and confirm the app picks it up.
2. **Coexistence and version pick.** Drop a build of a plugin that also ships bundled, open it, and confirm the **Versions** tab shows both (yours badged "local"). Press Install and confirm it asks which version first.
3. **Re-drop replaces.** Drop a newer build of the same plugin and confirm your old local copy is replaced rather than duplicated.
4. **Removal choices.** Install a sideloaded plugin on a printer, then remove it from the Versions tab. Confirm the explanation names the affected printer and that "keep on printer" versus "remove from both" do what they say.
5. **Bad files.** Drop something that is not a real `.b3` and confirm you get a clear error with a hint, and that other files in the same drop still go through.

---

## 0.1.0-alpha.20 - 2026-06-05

### Adding and enrolling a printer

- Adding a printer now reliably offers to set it up, and **asks first** instead of jumping straight into enrollment.
- If the printer's **root access (SSH) is off**, Bespok3d now tells you to turn it on before it tries, instead of failing with a cryptic error. Press Retry once it is on.

### Installing plugins

- The Doc, Config, and Changelog tabs no longer disappear while a plugin installs.
- The install status is always visible with a progress bar, and you can **click it to see the live steps** as they happen.
- Installed plugins gain an **Install log** tab showing exactly what ran on the printer, step by step.

### Reliability

- If Moonraker does not come back after a plugin restarts it, the printer now **heals itself**: it removes stale leftover config links and restarts Moonraker once more, so a broken include from an old uninstall no longer leaves the printer stuck.
- Uninstalling the built-in camera now reloads Moonraker so nothing stale is left behind.

### Fixes

- Removed a console warning that could appear during enrollment.

---

## 0.1.0-alpha.19 - 2026-06-04

Everything that changed since alpha 13, the build most testers were still running.

### Updates

- **macOS auto-update** is live. Signed and notarized builds now update themselves in place. No more "open the download page."
- **Changelogs you can read.** See what an update contains before you install it, find the notes for the version you are on under Settings, Update, and browse the full history (every version, expandable) under Settings, Update, Version history.
- Choose how updates behave: check frequency, auto-download, and whether to apply on restart or on quit. Roll back to an earlier version if one misbehaves.

### Printer discovery

- The discovery list now hides things that are not printers (TVs, speakers, phones, smart-home gadgets) by reading their name, advertised service, and network-card vendor.
- Known devices are labelled with their maker (Apple, Sonos, Sony, ...) instead of a generic "Network device" when we can tell.
- Fixed duplicate rows piling up when you expand and collapse the list.
- Long hostnames and IPv6 addresses no longer overflow the row, and the list scrolls cleanly.
- A printer that has both an IPv4 and an IPv6 address shows once, on its usable IPv4 address.

### Sign-in and keychain

- Far fewer macOS keychain prompts on launch: your GitHub sign-in is read once per session.
- The development build keeps its own profile and keychain entry, so it no longer fights the released app.

### Plugins

- The full plugin catalogue still ships inside the app, so you keep every plugin and it works even offline while we finish moving plugins to their own repositories.

---

## 0.1.0-alpha.13 - 2026-05-31

### Plugins grew up: docs, real settings, and a redesigned detail view

This build is the first pass at bringing the bundled plugins in line with the full plugin system. The plugin detail view has been reorganized into tabs, plugins can now ship their own documentation, and any setting a plugin exposes is editable from a proper form, both before and after you install it. Most of this is visible the moment you open a plugin in the store.

#### A redesigned plugin detail, now with tabs

- The detail view is now a centered window that uses about four fifths of the app width, instead of the narrow side panel.
- It splits into up to four tabs: **Overview**, **Doc**, **Config**, and **Changelog**. A tab only appears when the plugin actually has that content, so simpler plugins stay simple.

#### Plugins now ship their own documentation

- The **Doc** tab renders the plugin's own README, complete with images, gifs, and short videos, plus a button to open the project homepage.
- For safety, plugin documentation cannot run any JavaScript. A plugin can show you how it works; it cannot turn your printer into someone's mining bot.
- Documentation is stripped off the printer after install, so all those images never take up space on the device.

#### Real, editable settings

- Plugins now declare their settings as proper fields: free text, numbers, dropdowns, or on/off switches. The plugin author decides which ones you are allowed to change.
- You fill them in as a form before installing. Once installed, your saved values show up in the **Config** tab and become click-to-edit: change one and press "Update config on printer", or Cancel to back out.
- Updating only re-renders the configuration and restarts the affected service. There is no full reinstall and no files are re-uploaded, so it is quick.
- **Spoolman Bridge** is the worked example: its server address plus **Mode** (auto/manual) and **Logging** level are now real fields you can set and change.

#### Macros are listed

- If a plugin adds g-code macros you can call, the **Overview** tab now lists them with a short description and their parameters.

#### Sort and count the catalog

- Sort the store by **Name**, **Published**, or **Updated** (ascending or descending) from the filters row.
- A live plugin count now sits next to the search box and follows whatever filter you have set, so you can see how many plugins match at a glance.

### Safer installs

- Installing a plugin that needs to restart Klipper or Moonraker is now refused while a print is running, so an install can no longer bounce services in the middle of a job. Idle printers install as normal.

### Fixes

- The printer's endpoints flyout no longer lists the same service twice (Fluidd was showing up twice).

### Under the hood

- On-printer daemon bumped to **v0.10.11-dev**. After installing this build, the printer dropdown shows a daemon-update badge; click "Update daemon" to roll each printer forward. The daemon gained a reconfigure route that powers the in-place settings updates above.
- New on-printer layout-version marker (`etc/version`, currently `0.0.1`) that survives firmware updates. It does nothing visible yet; it is the groundwork for future automatic migrations when bigger changes land.
- Plugin packaging is now stable: rebuilding the store no longer churns version numbers on plugins that did not actually change, so daemon and plugin update badges mean something again.

### Things to focus on this build

1. **The Documentation tab.** Open a few plugins (Spoolman Bridge is a good one) and confirm the Doc tab renders its text and images cleanly, and that the homepage button works.
2. **Editable settings end to end.** Install **Spoolman Bridge**, setting the server address plus Mode and Logging. After it installs, open **Config**, change the Logging level, press "Update config on printer", and confirm it applies without a full reinstall and the printer returns to the green "managed" dot.
3. **Toggles and dropdowns.** Confirm the on/off switch (Moonraker Login) and the dropdowns (Spoolman Mode/Logging) behave both before install and after, in the Config tab.
4. **Sorting and the count.** Try the Name / Published / Updated sorts, and confirm the count next to the search box matches what is shown as you filter and search.
5. **Install-during-print guard.** Start a print, then try to install a plugin that restarts Klipper or Moonraker (for example a TMC or motion plugin). Confirm it is refused with a clear message. With the printer idle, the same install should go through.
6. **Endpoints flyout.** Hover a printer's endpoints in the dropdown and confirm there are no duplicates.

---

## 0.1.0-alpha.11 - 2026-05-31

### A bunch of toys

A big batch of small plugins, mostly pulled straight from the Extended Firmware project, plus the plumbing to support them. Most are one-line config tweaks; a few actually patch Klipper itself.

**Please give them a spin, but with a little caution.** Several of these have not yet been run on a physical U1, only built and checked. The ones that patch Klipper's own program files (Smoother Motion, the Force options, Print Preferences Core) are the riskier ones: install them on a printer you are happy to recover if needed. Uninstalling puts the originals back, and everything re-applies itself after a firmware update, but treat this build as "try it on the test printer first".

New in the store:

- **CPU Temperature** (Sensors). Shows the Rockchip CPU temperature in Fluidd and Mainsail alongside the hotend and bed. Read-only. Snapmaker U1 only.
- **Timelapse** (Camera). Brings back the Timelapse menu in Fluidd and Mainsail. Ships its own small Moonraker component, so it works on stock firmware where Moonraker has none.
- **Object Processing** (Printing). Turns on Moonraker object processing for adaptive mesh. Enabling "Exclude Object" in your slicer is still the better option; this can slow down very large gcode files.
- **Moonraker Login** (System). A simple on/off toggle for whether the web UI requires a login. Off lets local clients connect without logging in. This is the first plugin to use the new toggle control described below.
- **TMC Low Current** and **TMC Auto-Tuned** (Tuning). Two takes on the X/Y stepper drivers: lower current for cooler, quieter motion, or Argolein's optimized TMC2240 driver tune. Watch motor temperatures and print quality after enabling.
- **Purge Line at Back** (Tuning). Moves the print-start purge line from the front of the bed to the back, out of the way of your part.
- **Smoother Motion** (Tuning). Backports the latest upstream Klipper motion and resonance-testing improvements (a gentler "sweeping vibrations" input-shaper test, better cornering math, a snappier motion planner). Cleaner surfaces and quieter moves, with nothing to configure. This one patches Klipper.
- **Force Bed Mesh** / **Force Adaptive Bed Mesh** (Printing). Always run a bed mesh before each print, either a full mesh or an adaptive one that probes only the area your model covers. Install only one of the two.
- **Force Timelapse** (Printing). Capture a timelapse on every print regardless of the Snapmaker app's setting (your slicer must call the timelapse macros).
- **Print Preferences Core** (Printing). The shared engine the Force options build on. You normally will not install this directly: it comes along automatically with the first Force plugin you install, and sticks around as long as one of them is present.

### Smarter dependencies between plugins

- **Plugins now pull in what they need.** When a plugin depends on another (for example a Force option needs Print Preferences Core), installing it now installs the dependency first, automatically, instead of making you hunt it down. The detail page tells you up front what else will be installed.
- **You cannot accidentally rip out something still in use.** If a plugin is required by another one you have installed, its Uninstall button is disabled with a note explaining what still needs it.

### Other additions

- **A real on/off toggle for plugin settings.** Plugins whose setting is a yes/no choice (like Moonraker Login) now show a proper switch instead of a text box, both at install time and under Settings > General > Plugin defaults.
- **SSH credentials are now optional per printer.** Most people never change their printer's factory login, so the SSH credentials screen is skipped by default. If yours are custom, tick "My SSH credentials are not the default ones" when adding the printer, or flip it later under Settings > Printers. When off, every SSH operation just uses the factory login.
- **Four new store categories** to file all this under: Tuning, Sensors, System, and Printing.

### Things to focus on this build

Caution first: prefer a test printer for the Klipper-patching plugins.

1. **The simple config plugins.** Install **CPU Temperature**, **Object Processing**, or **Moonraker Login** on a managed printer. Confirm the printer comes back to the green "managed" dot and the effect shows up (CPU temp tile in Fluidd; the login prompt toggling on/off; etc.). These are low-risk.
2. **The toggle control.** Open **Moonraker Login** and confirm you get a real on/off switch, that installing with it on then off actually changes whether the web UI asks you to log in.
3. **Auto-installed dependency.** Install **Force Bed Mesh** (or **Force Timelapse**) on a printer that does not have Print Preferences Core yet. Confirm the progress shows it installing the dependency first, and that both end up installed.
4. **Uninstall protection.** With a Force plugin installed, open **Print Preferences Core** and confirm its Uninstall button is disabled with a "still needed by ..." note. Remove the Force plugin, then confirm Core can be removed.
5. **The Klipper-patching plugins (carefully).** On a test printer, install **Smoother Motion** and one **Force** option. Confirm Klipper restarts cleanly and a print still runs. If a patch does not apply (firmware drift), the install log will show rejected-hunk output rather than silently breaking. Uninstall and confirm the originals are restored.
6. **Force vs Adaptive bed mesh.** Install only one of the two bed-mesh plugins; they conflict by design (both override the same macro). The store does not yet stop you from installing both, so pick one.

---

## 0.1.0-alpha.10 - 2026-05-30

### Resilience: the recovery story got smarter

This build is a focused pass on making the daemon-repair flow forgiving when things go sideways.

- **Plugin drift detection.** The on-printer daemon now self-checks every active plugin on each app ping: it reads each plugin's manifest and verifies the symlinks it should have installed are actually present and pointing at the right files. If anything has drifted (a symlink missing, replaced with a regular file, or pointing somewhere unexpected), a yellow banner appears at the top of the main view with a one-click "Run recovery" action. This catches the kind of breakage that happens after a Snapmaker firmware update, an overlay reset, or someone SSH'ing in and tidying up "by hand".
- **Repair banner no longer flickers during expected restarts.** When you click "Update daemon", "Repair daemon", or "Reactivate", the daemon is intentionally bounced. The yellow banner used to pop up mid-operation and look like a real failure. It now stays suppressed for the duration of the operation plus a brief grace period, and only reappears if the daemon is actually still down afterwards.
- **Daemon startup failures show what went wrong.** If the daemon fails to come up during repair or reactivate, the failure modal now includes the last 200 lines of `daemon.log` straight from the printer, so you can see the actual reason (import error, port collision, cert problem) rather than just "did not start within the expected time". The autostart script also rotates the log to `daemon.log.prev` on every start, so each attempt's output is its own clean file.

### New in the plugin store

- **Installed-plugin detail shows the configured value.** When you open the details of an installed plugin that has a user-set parameter (e.g. Spoolman Bridge's server address), the panel now has a "Configuration" row showing the value you saved. The same value is still editable from Settings > General > Plugin defaults. Plugins that don't take any configuration are unchanged.

### Under the hood

- On-printer daemon bumped to v0.10.7-dev. After installing this build, the printer dropdown will show a daemon-update badge; click "Update daemon" to roll the printer forward.
- `GET /selfcheck` is a new daemon route used by the drift detection above.

### Things to focus on this build

1. **Update the daemon** on each enrolled printer (printer dropdown -> Update daemon). Confirm the printer goes back to the green "managed" dot afterwards.
2. **Drift recovery.** SSH into a printer and `rm` one of the symlinks under `/home/lava/klipper/klippy/extras/` (or `/userdata/cfg/bespok3d/...`) belonging to one of your plugins. Within ~15 seconds the app should show a "Plugin state drifted" banner. Click "Run recovery" and confirm the plugin is re-applied and the banner clears.
3. **Repair banner under load.** Click "Update daemon" or "Repair daemon" on an enrolled printer. Confirm the yellow banner stays hidden while the operation runs and for a short grace window afterwards, instead of flickering mid-op.
4. **Daemon log on failure.** If you ever see a daemon-start failure, confirm the failure modal includes a chunk of log lines underneath the "did not start" message, not just the bare message.
5. **Plugin configuration row.** Open the details of **Spoolman Bridge** (or any installed plugin that needed a value at install time). Confirm a "Configuration" section appears listing the value you entered. Plugins without any required configuration should look unchanged.

---

## 0.1.0-alpha.8 - 2026-05-29

### Fixes

- **Closing and reopening the window no longer crashes the app (macOS).** If you closed the main window with Cmd+W and then clicked the dock icon to bring it back, the app crashed. The window now reopens cleanly every time.
- **Network discovery no longer errors after the window is closed.** A side effect of the same problem: the network scanner kept running against the gone window and threw repeating errors in the background. It now stops cleanly when the window closes.

### Improvements

- **A hint when no printer shows up.** If a network scan finds nothing, the discovery screen now explains a common cause: once you connect a printer to the manufacturer's cloud, it can switch off its local network advertising (mDNS), which is how Bespok3d finds it. The hint points you to adding the printer by IP address instead. It appears on both the first-run screen and the "Add a printer" scan tab.
- **The "Add a printer" screen is now fully localized**, so it translates along with the rest of the app.

### Things to focus on this build

1. On macOS, close the main window with Cmd+W, then click the Bespok3d dock icon. Confirm the window comes back and the app does not crash.
2. Open "Add a printer" and let it scan. If your printer does not appear, confirm the cloud / mDNS hint shows up, and that adding the printer by IP from the Manual tab still works.

---

## 0.1.0-alpha.5 - 2026-05-28

### Remote Screen: major reliability pass

The Remote Screen plugin got a deep reliability overhaul this build (plugin v0.1.8):

- **Touch no longer freezes the screen.** Interrupted gestures (switching tabs, locking your phone, a dropped Wi-Fi packet, a flung drag) used to leave a "stuck finger" that latched the printer's UI. Touch handling is now serialized with automatic release safeties, so this class of freeze is gone.
- **Self-healing freezes.** The printer's stock UI can still lock itself up on its own, a firmware quirk that also affects other custom firmwares for this printer, most often when opening a very large job or file list. Remote Screen now detects this and restarts the UI automatically within 1 to 2 seconds. No reboot, no SSH; you will just see a brief blink.
- **Auto-updating PWA.** After a plugin update the page reloads itself, so no more cache-clearing or hard refresh.
- **Smoother live view** and a lighter, more responsive touch path.

Full post-mortem: `doc/incidents/0001-remote-screen-gui-freeze.md`.

### Improvements

- **Daemon and plugin updates are shown separately.** The printer dropdown now has distinct, labelled indicators: a daemon-update badge and a "N plugin updates" badge, each with its own hint. No more guessing what a single update arrow meant.
- **Live update counts.** The plugin-update count comes from the regular printer check, not only after opening the store, so the badge is accurate as soon as the app sees the printer.
- **Store refreshes after every operation.** Installing, updating, or uninstalling a plugin refreshes the installed-version state immediately, so the store reflects reality without reopening it.

### Things to focus on this build

1. Update **Remote Screen** to v0.1.8 (look for a plugin-update badge on the printer). After updating, do one last hard refresh of the screen page; from then on it updates itself.
2. Open the printer's job or file list a few times via Remote Screen. If the screen ever locks up, confirm it recovers on its own within a couple of seconds.
3. Drag or scroll on the remote screen, then switch away mid-drag (lock the phone or switch the tab) and confirm the printer screen does not stay stuck.
4. Check that the printer dropdown clearly distinguishes a daemon update from plugin updates.

---

## 0.1.0-alpha.4 - 2026-05-28

### New plugins

Four new plugins are available in the store this build:

| Plugin             | What it does                                                                            | Status             |
| ------------------ | --------------------------------------------------------------------------------------- | ------------------ |
| **Fluidd**         | Replaces the SM-bundled Fluidd with upstream v1.37.0                                    | ✅ confirmed on U1 |
| **Mainsail**       | Adds Mainsail v2.17.0 on a separate port alongside Fluidd                               | 🧪 needs testing   |
| **webcam-usb**     | Registers an external USB camera as a Moonraker webcam entry                            | 🧪 needs testing   |
| **webcam-builtin** | Registers the built-in MIPI camera as a webcam entry (requires Camera HW Accel)         | 🧪 needs testing   |
| **webcam-screen**  | Registers the on-device touchscreen mirror as an iframe webcam (requires Remote Screen) | 🧪 needs testing   |

After installing a webcam plugin the camera should appear in Fluidd/Mainsail's **Webcams** panel automatically. The required Moonraker restart is handled by the install flow.

### Improvements

- **Daemon version gate** - if an installed plugin requires a newer daemon version than what's running on your printer, the app now shows a clear dialog and blocks the install rather than failing mid-way.
- **Spoolman + webcam install reliability** - these plugins restart Moonraker during install; the app now waits for Moonraker to come back up before reporting success, so the installed state is accurate.

### Things to focus on this build

1. Install **Fluidd** - check Fluidd loads and the app marks it as installed.
2. Install **Mainsail** - you'll be asked for a port (default 81). After install, both Fluidd and Mainsail should appear in the printer's endpoint list and be reachable.
3. If you have an external USB camera: install **Camera HW Accel** first, then **webcam-usb** with a display name. Check the camera appears in Fluidd's Webcams panel.
4. Uninstall any of the above and verify the entries disappear from Moonraker.

---

## 0.1.0-alpha.3 - 2026-05-28 gt acidentlally bumped to 4 for a double run of the relase script

---

## 0.1.0-alpha.2 - 2026-05-27

Emergency hotfix: daemon binary was missing from the alpha.1 installer. No feature changes.

---

## 0.1.0-alpha.1 - Private Alpha (2026-05-27)

First release. Distributed to invited testers only.

### What this is

Bespok3d is a plugin manager for Klipper 3D printers. It runs on stock firmware: no custom firmware flashing, no voided warranty. You pick what you want your printer to do, press install, and it works.

This alpha targets the **Snapmaker U1** exclusively. The architecture is printer-agnostic (other printers just need an adapter), but U1 is the only one with a tested adapter right now.

### What's in this release

**Printer setup**

- mDNS discovery: the app finds your U1 on the local network automatically
- Manual add by IP address
- One-click enrollment: installs the Bespok3d base layer and daemon on your printer in about 10 minutes
- Idempotent enrollment: safe to retry from any step if something goes wrong

**Plugin catalog**

- Browse, search, filter by category and trust tier
- Grid and list view, adjustable density
- One-click install and uninstall
- Live progress during install
- Dependency enforcement: the install button is blocked (with a reason) if required plugins are missing

**Available plugins** (all confirmed working on Snapmaker U1)

| Plugin            | What it does                                                            |
| ----------------- | ----------------------------------------------------------------------- |
| Camera HW Accel   | Hardware-accelerated MIPI + USB camera streaming; no CPU encoding       |
| Remote Screen     | Streams the U1 touchscreen to a browser tab                             |
| RFID Spool Reader | Reads OpenSpool NTAG215 cards from the U1's built-in SPI reader         |
| Spoolman Bridge   | Syncs filament data to a Spoolman server; reads RFID data automatically |

**Printer lifecycle**

- Deactivate / Reactivate: soft-disable Bespok3d without touching your plugin files; reactivate in seconds
- Full uninstall: removes everything from the printer cleanly and deletes the printer record from the app
- OTA recovery: after a Snapmaker firmware update the app detects the lost daemon and offers one-click recovery; all plugins are re-applied automatically in dependency order

**App**

- macOS (arm64 + x64) and Windows (x64) installers
- Light / Dark / System theme
- Saved plugin defaults: define values like your Spoolman server address once; they pre-fill on every install

### Known limitations

- **USB airgap install**: `.b3p` bundle support is designed but not yet in the app.
- **Other printers**: only the Snapmaker U1 has a working adapter. Any other Klipper printer with SSH access can be added but will need a new adapter before enrollment works.
- **Printer ACL management**: the app writes your key to a printer's access list at enrollment time, but there's no in-app way to add or remove keys from an already-enrolled printer yet.
