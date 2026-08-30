# Plugins no longer fight over the same Snapmaker file

### Plugins no longer fight over the same Snapmaker file

Some plugins have to change Snapmaker's own files to do their job, and two plugins wanting the same
file used to break each other. Those files now belong to one set of plugins, and every other plugin
asks them for what it needs. When you install a plugin that needs one of those files, Bespok3d puts
its owner on the printer first. You never have to go and find it yourself.

### A plugin that has become several plugins offers to move itself over

Smoother Motion and RFID Spool Reader are now sets of smaller plugins. If you have the old one, a
message above your plugin list says so, and the plugin's card in the store shows Update. Press Move
it over: the old plugin comes off, the new ones go on under their own names, your settings come
with them, and Klipper and Moonraker restart once at the end. If one of the new plugins needs an
answer from you, it asks before anything starts.

If your printer's daemon is too old for the move, the message says so and offers Update daemon
first.

The move will not start while the printer is printing. If it is interrupted, your printer still
works, and you start the move again from the same message.

### The update box says when an update is not a plain update

Every update used to look the same. The box now tells you when the plugin comes off and other
plugins take its place, when it keeps its name but does a different job on the printer, and how
many plugins arrive with it.
