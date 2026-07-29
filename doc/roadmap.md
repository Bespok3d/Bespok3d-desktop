# Roadmap

Where Bespok3d is, what its thinking has already settled, and which evolutions it is built to grow
into. It is not a schedule, it is not a set of promises, and it is not a status board. Nothing here
carries a date.

The companion page to this one is `architecture-facts.md`, which lists the constraints the design
settled and the reason each one exists. This page is the other half: given those constraints, where
the project is heading and why the shape it already has carries it there.

## Where the project is

The app was built against the Snapmaker U1 first, and that is the 1st printer
supported end to end at publishing, on the firmware it shipped with. The machine it started on is a starting
point rather than the target: that support is an adapter rather than a special case wired through the
app. The app finds a printer on the network, enrols it, installs and updates packages on it, and puts
it back together after the manufacturer pushes a firmware update. After enrolment every operation
goes through the daemon on the printer, so the printer keeps working whether or not the app is
running.

What the project is aimed at is the open ecosystem at large. Klipper printers are what it reaches
today, more Klipper printers is the obvious next step, and other kinds of firmware besides Klipper
are further out but not shut out. Nothing in the design blocks any of that, and neither does any
position of this project's.

Publishing is open and already distributed. The org's own index is one signed file on a static host
that points at ten further lists, each one its own repository with its own releases. Any of those
lists could belong to somebody else, and the app would treat it the same way. Every build path signs
what it produces, and the app verifies a signature against the exact bytes it was served.

Testing goes all the way to real hardware. The same enrolment steps the app runs can be driven
headlessly against a printer on the bench, rather than against a reimplementation of them, and the
recovery and reset paths have harnesses of the same kind.

## What the thinking has already settled

These are decided, and the decisions are what the rest of the road is built on. Each one is written
up with its reasoning on the architecture page.

- **Stock firmware, always.** No flashing, no custom build, no bootloader unlock. A system that needs
  a firmware build to extend it can only be extended by people who can build firmware.
- **Printer knowledge lives in an adapter.** Nothing model specific goes anywhere else, which is what
  makes a second printer cheap and keeps any one party from deciding which printers exist.
- **Packages declare, the printer side carries it out.** A package says what it wants in domain terms
  and never ships a script. The daemon orchestrates and owns the filesystem and the protocol, the
  adapter's device half (jinni) actuates and owns what the machine itself needs, so what an install can cause
  is exactly what those two already expose.
- **No central server.** Nothing in the path from a publisher to a user requires this project to host
  or approve anything.
- **Identity, not permission.** A signing key says who published something. It never says whether
  they were allowed to, and it never says the thing is safe.
- **The owner is never overruled.** Curation is a voice, not a veto, and a signature that does not
  verify costs a badge rather than access.

## Where it goes from here

### More printers

The adapter model exists so that the second printer is somebody else's afternoon rather than this
project's quarter. Growing the set of supported machines is the main line of the roadmap, and the
gating resource is hardware rather than design: an adapter has to be developed and tested against a
real unit, and vetted against one too. The manufacturer page describes what that takes.

### Adapters that travel on their own

The device half of an adapter already ships by itself. The client half is compiled into the app
build, so today a new printer arrives with an app release. Making that half a package like any other
is part of the SDK the project is building out, and it is the change that turns adding a printer into
a publishing act rather than a release of ours.

### A shared SDK rather than shared habits

Three layers are settled: the contract shapes both sides of the app to daemon boundary agree on, the
base libraries an adapter builds against, and one package builder every publisher can use. Declaring
a cross boundary shape once and generating the other side from it is the point, because two
hand-written copies of the same shape drift and the drift lands in front of a user.

### The trust roster

The trust tier is derived from the signing key and works end to end today. What grows is the roster:
the set of keys the app knows, how a manufacturer key gets into it, and how a key that turns out to
be bad gets out of it again. That work starts with the first publisher who needs it.

### Printers that arrive with the daemon already on them

The daemon is an ordinary managed service with a documented layout, so a firmware image that includes
it is a supported idea rather than a fork. Enrolment today opens a shell session because that is what
an unmodified printer offers, and a printer that ships with the daemon needs a different way to
introduce itself. That path is a good outcome the project wants and is holding the door open for.

### Printers with less to spare

Not every printer has room to spare, and a machine with a smaller board is still a machine this
project wants to run on. Part of that is already in place: the daemon reports its own memory pressure
through an endpoint the app can read, so the constraint is measurable rather than a matter of
opinion, and keeping the on-printer footprint small is a standing design pressure on everything that
runs there. More optimisation is planned. It is an intent to try, not a promise that everything will
fit on every board.

### An alternative Klipper stack, without a flash

Running a different Klipper derivative on a stock printer is in active design, as a plugin, under the
same rule as everything else: no reflash, nothing that cannot be undone. It is the strongest test of
the claim that this system can change deep parts of a printer without touching its firmware.

### Opening the repositories

The project is a set of separate repositories, each of which checks out and tests on its own. Opening
them comes with a documentation set per repository written for a person who arrived from outside, and
a rules file for the coding assistant that person is likely to bring with them, so a contribution
starts closer to the project's conventions instead of finding them out in review.

## What is not on the road

Not gaps. Decisions, with the reason attached.

| Not doing | Why |
| --- | --- |
| Remote access, tunnels, a hosted relay | A large attack surface for a problem that already has good standalone answers. Bring your own VPN |
| Diagnosing the printer itself | Bespok3d repairs what Bespok3d put there. The machine's own hardware and the manufacturer's firmware are not ours to diagnose |
| Deciding who may publish | The gate is identity, not permission. There is no place in the architecture where this project could approve or refuse a package |
| Running a service anyone depends on | One printer and fifty printers run the same architecture. A hosted piece would make that untrue and would make us a single point of failure |
| Anything that needs a custom firmware build | The first non-negotiable. It is the whole reason the project exists |

An idea that is not on this page is not a secret and it is not refused. It is a thing nobody has
written down yet.
