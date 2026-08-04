# Two traps from the first public beta are gone

Both of these came from people using the beta and telling us what happened. Keep doing that.

## Taking a port from Mainsail or Fluidd moves it, instead of stopping you

With both installed, giving one of them the port the other holds ended in "port already in use" and
nowhere to go. You had to work out which one had the port and go and change that one first.

Now the port you type is yours. The other interface moves to a free port, and a line under the field
tells you which one moves and where, before you commit to anything. The move happens on the printer
first and your own install goes out after it. Installing several web interfaces at once gives each
one a free port of its own.

**Make primary** fills the field in with 80, and a new **Make secondary** hands 80 back to the other
interface and takes its port instead. Both only change what the field shows, and nothing reaches the
printer until you press Update config, like every other change on that form.

A port under 80, or one the printer itself needs, is still refused, and now says why in your language
rather than in English.

wlodeka could not open the remote screen. Chasing that produced the Mainsail plugin fixes in 0.1.7
and 0.1.8 as well as the port work here.

## A server address is taken exactly as you write it, and tried straight away

Spoolman's server field took a host and a port and assumed plain http, so a Spoolman published under
a name and a certificate could not be given to it at all: `https://spoolman.example.org/` was kept as
`spoolman.example.org:443` and the printer was sent to `http://spoolman.example.org:443`.

The whole address is now kept exactly as you write it, protocol and all. What you type is what the
printer gets, and nothing is rewritten. A protocol picker sits beside the field for the one part a
bare host and port leaves out, and setting it moves nothing else about what you typed.

The address is tried from this computer as soon as you stop typing, rather than when you leave the
field, so choosing a protocol checks it there and then. The line under the field says the service is
reachable, or, when the server is there but will not serve that address, gives you the code it
answered with. Nothing answering is a warning, never a block, because your computer and your printer
are not always on the same network. An address nobody can read does block, and says so.

Changing the configuration of a plugin you already have works the same way, and choosing a protocol
frees Switch version instead of leaving it greyed out.

Fields that ask for a host or an address rather than a whole address still tidy a browser paste when
you leave them, so `http://192.168.1.50:8000/spoolman/` becomes the address the plugin wants.

maxappel99 was fighting to get his Spoolman configured, and all of the address work came out of that.

## The plugin search clears in one click

Searching the store and then wanting the whole list back meant selecting the text and deleting it. A
clear button now sits at the end of the search field whenever there is something to clear, and
Escape clears the field while you are still typing in it.

LixNix sent this one, the first change in the app to come from outside.
