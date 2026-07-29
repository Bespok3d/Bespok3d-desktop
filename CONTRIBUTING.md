# Contributing

This repository is the Bespok3d desktop app: the Electron, React and TypeScript client that finds a
printer on the network, enrols it, and installs plugins through the on-printer daemon.

## Before you write code

Read [CLAUDE.md](CLAUDE.md) in this repository. It is the contract for anyone changing this code,
human or agent, and it carries the renderer patterns, the function and file size limits, and the
engineering gate's rules. [doc/architecture-facts.md](doc/architecture-facts.md) lists the
constraints the design has already settled and the reason each one exists, so your change does not
spend its first review round being told it cannot work that way.
[doc/roadmap.md](doc/roadmap.md) says where the project is heading, so you can tell a change that
fits that direction from one that fights it. [doc/component-inventory.md](doc/component-inventory.md)
lists every component and hook that already exists. Search it before you write a new one; reusing
what is there is a rule, not a preference.

[doc/stories/README.md](doc/stories/README.md) is where the work is. Every story carries acceptance
criteria and the index counts how many each one has ticked off, so the points still open are what to
pick from. Read it before you propose something new: the idea you have may already be a story with a
shape, and finishing an open point helps more than adding another. A ticked criterion is a claim the
story makes about the code, not a test result, so check the row against the code.

Open an issue describing what you want to change before you start on anything large. A pull request
that arrives without one may be asking for something the project has already decided against.

## Develop

```sh
npm ci
npm run dev
```

## Run the gate until it is green

```sh
bash scripts/check.sh
```

The gate must pass before a change is ready. If a check fails, fix the cause. Never mute a check to
make it pass, and never lower a baseline number to accommodate a new problem.

## Constraints

- No em-dash or en-dash anywhere, in code, comments, documentation or commit messages.
- Every identifier says what the thing is in the domain, never its type or its position.
- Add a regression test in the same change: it fails on the old behaviour and passes on the fix.
- Never hand-edit the version in `package.json`. The release script owns it.

## Signing off your work

Every commit must carry a `Signed-off-by` line. It is your statement that you wrote the change, or
that you otherwise have the right to contribute it, under the terms of the Developer Certificate of
Origin (<https://developercertificate.org/>). Git writes the line for you:

```sh
git commit -s -m "your message"
```

A pull request whose commits are not signed off cannot be merged.

## Licence

This repository is under the GNU Affero General Public License, version 3 or any later version. The
full text is in [LICENSE](LICENSE).

By contributing you agree that your contribution is licensed under those same terms. You keep the
copyright in what you write. There is no copyright assignment and no contributor licence agreement to
sign.
