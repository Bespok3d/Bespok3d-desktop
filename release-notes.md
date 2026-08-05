# Windows updates itself again, and your printer restarts itself when it has to

## Windows: this one update has to be installed by hand

The Windows installer in 0.7.0 and 0.7.1 was signed with the Mac certificate. Windows never trusts
that one, and the installer also wrote the certificate's owner into the file the app reads when it
looks for an update, so every update after it was refused before it could start.

The Windows and Linux builds are now made without the Mac key, and the release script fails if it
ever picks it up again.

So if you are on Windows with 0.7.0 or 0.7.1, download this one and install it yourself. From here
on Bespok3d updates itself again. Mac and Linux are not affected.

## Stopping and restarting your plugins now restarts the printer, and waits for it

Turning the plugins off, turning them back on, and removing Bespok3d all leave the printer running
something other than what is now on its disk, and only a restart settles that. All three now restart
the printer themselves instead of leaving it to you.

For stopping and restarting the plugins, Bespok3d stays on screen until the printer is back up, so
Done means the printer is running, and running what it now has. Removing Bespok3d has nothing left
to wait for, so it tells you the printer is rebooting and lets you go.

A printer in the middle of a print is never restarted.

## The printer can ask for a restart

When the printer finds something only a power cycle clears, it says so and offers the restart,
instead of quietly behaving oddly until you work it out yourself.

## When the printer stops listening to Bespok3d, it says so in words

A printer that no longer includes Bespok3d in its own config, or that has part of the Bespok3d tree
missing, used to show nothing at all if it had no plugins left. It now says the printer is not set up
the way Bespok3d left it, and offers to put it back.

The message about plugins the printer is ignoring says what is actually wrong, in place of the word
"drifted".

## A failure shows you a sentence, not a stack trace

When something goes wrong across a batch of printers, the headline is now a sentence. The printer's
own words are one click away for whoever needs to quote them, rather than filling the screen and
reading like Bespok3d itself is broken.

A printer carrying a mismatched pair of Bespok3d parts now says so and offers to fix it, which
installs a matched pair and puts your plugins back.

## Your own SSH login, before you commit

The screen that asks you to go ahead now lets you hand over your own SSH login first, without backing
out of what you were doing.

## Every plugin tells you its licence and who it builds on

The Licence and attributions tab used to be empty for all but ten plugins. Every plugin now carries
what it is licensed under and whose work it is built on, so the tab is filled in for all of them, and
the licence link opens the licence file in that plugin's own repository.
