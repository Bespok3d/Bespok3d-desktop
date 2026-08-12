# Set up a printer with no internet, and install the big plugins on a normal connection

## You can set up a printer with no internet connection

Everything Bespok3d needs to put on the printer now comes with the app, so setting one up works on a
laptop that has no internet, or that can see nothing but the printer.

## Large plugins install

A plugin bigger than a few megabytes gave up part way through downloading unless your connection was
very fast, and the error did not say why. They download properly now, however long it takes.

## Windows and Linux show your printer by name

Printers came up as "Network device" instead of their own name, and Bespok3d did not work out which
model they were. They now read the same as on a Mac.

## A plugin that needs a newer daemon than your printer runs is stopped before it installs

You were warned when you installed from the plugin's page, but not when the plugin arrived any other
way, so it could land on the printer and simply not work. You are now told every time, and the
message says which version you need.

## Your printer says what printer it is, instead of "Unknown"

Where the printer card should have said what kind of printer it is, some printers just said
"Unknown", even though everything about them worked. It now says what Bespok3d set the printer up
as, so it reads the same on every computer.

## The bar moves while you wait

Setting up a printer and updating its daemon showed a bar that sat completely still, right next to a
count of files climbing past a hundred, which made it look like the app had died. The bar now fills
up as those files go over, and it only pauses near the end, for the one part that gives nothing to
count.

## The wait while your printer restarts has a bar again

After Bespok3d puts your plugins back and restarts the printer, the wait showed a percentage next to
a bar that was not there at all: it had collapsed to nothing. There is now a bar across the width of
the window and no percentage. It empties while you wait, over the time your own printer takes to come
back, and clears itself when that time is up.

## Your plugin lists arrive when GitHub drops the connection

github.com drops the connection on some of the asks for the store's plugin lists. One dropped
connection used to lose that whole list, and the app never asked again, so plugins were missing from
the store with nothing said about it. A list is now asked for up to five times when the connection is
dropped. A host that is only slow is still asked once, so a slow connection never makes you wait five
times over.

## A plugin list shown as unsigned had been signed after all

If the connection dropped while Bespok3d was reading the signature that travels with a plugin list,
the list was shown as unsigned, which told you a publisher had not signed a release they had signed.
The signature is now asked for again the same way the list is.
