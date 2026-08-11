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
