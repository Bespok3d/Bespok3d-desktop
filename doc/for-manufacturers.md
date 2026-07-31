# For printer manufacturers

Bespok3d exists for a number of reasons that converge on the same system. One of the largest is that
Klipper/Moonraker/Fluidd/Mainsail/etc carry no plugin support, and no direct or easy way for the
owner of a printer to install an extension into any of them.

The most prominent reason in this particular field is the friction between two reasonable positions.
A manufacturer is reluctant to hand over complete access to a machine it remains liable for. The
person who bought the machine has every right to make their own property do what they want. Both of
those are correct, and the friction between them helps nobody.

So manufacturers were part of the idea from the start. The architecture was shaped around that
relationship, not opened up to it by accident. Everything on this page that lets a manufacturer do
something is a feature that was designed in on purpose, because a better model of collaboration
between a manufacturer and the people who buy from it is the point of the project, not a side
effect of it.

A manufacturer bundling the daemon into its own firmware is one of the good outcomes this makes
possible. It gives the owner real agency over their property, and it lets the manufacturer offer a
more curated extension experience to the people who want guidance rather than a shell prompt. The
manufacturer trust tier and the manufacturer lists are in the architecture for exactly that reason.

What follows is six things a manufacturer can do with this system, and the architecture that carries
each one. Some of them work today. Some arrive as the project matures, or when the right
manufacturer asks for them. None of them is an afterthought, and none of them can be invalidated by
where the project goes next, because each one is a consequence of how the system is put together
rather than a feature bolted onto it.

## Adding support for your printer without touching our core

Every fact that is specific to one printer lives in that printer's adapter, and nowhere else. The
adapter for the first supported printer has a client side entry file of thirty seven lines. Adding a
printer is writing an adapter, not editing the application.

The reason it is built that way is that a system which needs its own core edited for every new
machine ends up with one gatekeeper deciding which machines exist. Keeping printer knowledge inside
an adapter is what removes that gatekeeper.

## A manufacturer trust tier in the app

The tier is real from end to end, and it is derived from which key signed a package, never from a
name a publisher typed into a manifest. The app ranks the manufacturer tier above the project's own
and above the community. An entry that claims the tier without a signature that verifies is dropped
to unknown, and a user can filter the store by tier.

Trust that comes from a name in a text field is not trust, it is a label anybody can copy. Deriving
the tier from the signing key is what makes the badge mean something, and it is also what lets a
manufacturer be trusted by the app without the project acting as a registry of who is allowed to be
trusted.

The roster of manufacturer keys the app ships with is where this grows. Standing that roster up,
along with the ability to withdraw a key that turns out to be bad, is work the project takes on with
the first manufacturer that wants to be in it.

## Curating a blessed list of plugins for your printers, with no involvement from us

Any static host can serve a signed package list, a list is allowed to point at other lists, and the
app verifies the signature against the served bytes as it reads them. There is no central server
anywhere in that path and therefore no place where this project could approve or refuse your list.
You publish it, you sign it, your users add it.

This is the curation half of the bargain. You get to say what you consider safe on your machine.
The owner still gets to decide whether to follow your list. That balance is the whole design: a
manufacturer with a real voice, and an owner who is never overruled by it.

## Bundling the daemon into your firmware

The on-printer daemon is an ordinary managed service with a documented layout on disk, so where it
came from is not something the rest of the system has an opinion about. A daemon that arrived in
your firmware image and a daemon the app installed are the same daemon to everything above it.

Enrolment today goes over a shell session, because that is what an unmodified printer offers. A
printer that shipped with the daemon already installed needs a different way to say hello, and that
is a path to build rather than a change to the design. It is a road the project wants to go down, so
if you want this, say so.

## Your own packages carrying a manufacturer badge

This is the previous two ideas meeting: the tier machinery decides the badge from the signature, and
your list is where your packages live. A package signed by a manufacturer key in the app's roster
carries the manufacturer badge wherever it appears in the store, on any list, including somebody
else's.

The badge is a property of the signature and travels with the package. Nothing about it depends on a
relationship with this project beyond your key being known.

## Shipping your adapter independently of our app

The device half of an adapter is already separate and ships on its own. The client half is compiled
into the application build today, so a new adapter reaches users when the app does.

Making the client half a package of its own is part of the SDK the project is building out. When it
lands, a manufacturer publishes an adapter the way anyone publishes a plugin, on their own schedule.
The intent has been in the architecture from the start, which is why the printer specific knowledge
was kept in one place rather than spread through the app.

## Adapters, and what it takes to support a printer

There are two paths to getting a printer supported. A manufacturer builds the adapter, or the
project builds it, either by us or by a contributor. Either way the adapter is tested and vetted
against the real hardware before it is listed. That step does not change based on who wrote the
code.

Adapters are printer specific. Testing and vetting one without the real hardware is not reliable, so
covering a printer means a unit has to be available to develop and test against, whoever authors the
adapter, and to those who test and vet the adapter itself.

Sending a printer doesn't buy priority or a spot on the roadmap. It's the baseline the work needs
in order to happen at all. Buying every printer on the market ourselves is a cost the project cannot
absorb for now, and one it may well be able to absorb later. Contributing a test target is not a payment
to us. It is what keeps that printer's support solid, and it shows the manufacturer's good will and its
intent to collaborate.

Support beyond hardware is also welcome: sponsorship, documentation, engineering time, test access.
None of it is transactional. Supporting the project helps it thrive as a whole, and a manufacturer
whose printer is well supported benefits from that as a side effect of a working, collaborative
relationship, never as something purchased. That is the alternative to the friction this project
exists to remove.

## The licence

The app is under the GNU Affero General Public License, version 3 or later. If you distribute a
modified version, or run one as a network service your users reach, that licence requires you to
offer them the corresponding source of your modifications under the same terms. Writing an adapter
or a plugin against the published interfaces is a different question from modifying the app itself,
and where the line falls in your particular product is not something this page can answer for you.
Take it to your own counsel before you build a plan around it.

## What is most useful to us

Nothing you have to sign. The most useful thing a manufacturer can do is publish what the machine
actually does: the endpoints, the file layout, the tag formats, the authentication. Every hour this
project has spent guessing at an undocumented interface is an hour that produced a worse result for
the people who bought your printer than a page of documentation would have.

If you want to talk about any of the above, open an issue.
