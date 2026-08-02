# Bespok3d is open

This is the first release anybody can use. Bespok3d is a desktop app and a small daemon that lives on
your printer. You browse a shelf of plugins, you click install, and the printer restarts with the
thing running. Your Snapmaker U1 keeps its stock Snapmaker firmware. There is nothing to flash, no
image to write, and no SSH session to keep open.

## Your printer is a Linux box you already own

Every Klipper printer is a small computer that happens to move a nozzle. The reason you rarely get to
use it that way is not that it is fragile, it is that changing anything usually means replacing the
whole firmware and then waiting for whoever made it to bless the next version. Bespok3d takes the
other route: it adds files next to what the manufacturer shipped, and it never replaces it. So new
things arrive when someone writes them, not when a release train comes through.

## What is on the shelf today

Forty three plugins and seven Collections, and a Collection is just a set of plugins installed
together so you do not have to pick them one by one.

Cameras, including the U1's built in one and USB ones. Multi tool and AFC panels. Filament tags:
Snapmaker, OpenSpool, Anycubic, TigerTag, OpenTag3D, OpenPrintTag and plain JSON on an NDEF tag, plus
Bambu and Creality if you bring your own keys. Spoolman. Klipper tuning, motion and TMC autotune.
Remote access over Tailscale or ZeroTier, OctoEverywhere, a mirror of the printer screen, and a
Prometheus exporter. And the small quality of life ones: idle timeout, human readable print times,
purge line placement, bed mesh, timelapse, LEDs.

Fluidd and Mainsail are both there, and both come with the multi tool panels rather than one of them
being the second class option.

## If a plugin breaks something, the printer puts itself back

A plugin that stops Klipper or Moonraker from coming up is disabled automatically and the printer
comes back on its own. Its files are left alone, so nothing you configured is thrown away, and you can
put it back in one click. This has been running against Snapmaker firmware from 1.3.0 through 1.5.2.

A firmware update wipes parts of the printer that Bespok3d needs. The app notices the daemon is gone,
offers to restore it, and then reapplies your plugins in the right order. Anything that cannot be
restored stays disabled with its files untouched, and the app tells you which one it was.

## The part that matters most

Anyone can publish. The plugin index is open and signed, the app tells you what it could check about a
package before you install it, and nothing is hidden from you to keep you safe. You do not need our
permission or our index either: an app that can install a `.b3` file straight from your disk is an app
you still control if we disappear.

If you have already built something for your printer, a macro set, a panel patch, a script you keep
copying back after every update, this is where it stops being yours alone. Package it, publish it,
and the next person clicks install instead of reading your forum post twice. Bring it. That is the
whole point of the thing.

## Not there yet

There is no switch to turn SSH on, and that is on purpose: the moment there is one, the answer to
every problem becomes "just SSH in", and the plugin format stops being the way things get done.

There is no web page served by the printer either. The desktop app already gives you all of your
printers in one place, and a page on each printer would be one more thing to keep in sync per machine.

This is a beta because we are still willing to change our minds, not because something is missing.
Tell us what breaks.
