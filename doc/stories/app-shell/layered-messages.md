# Layered messages - plain language with optional technical detail

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** Bespok3d user, **I want** warnings and explanations to be written in plain language by default, with a way to see the full technical details if I want them, **so that** I understand what's happening without needing to be an engineer, but can get the full picture when I need it.

## Acceptance criteria

- [x] Every warning, destructive-action confirmation, and feature explanation shows a brief plain-language message
- [x] A small ⓘ icon button appears inline after the message
- [x] Clicking ⓘ reveals an indented detail block with the full technical explanation
- [x] Clicking ⓘ again collapses the detail
- [x] The brief message focuses on consequences ("you'll lose access") not mechanisms ("the ACL will be invalidated")
- [x] The detail message names the actual systems, files, and protocols involved
- [x] The pattern is consistent - same ⓘ icon, same expand/collapse behavior, everywhere in the app

## Implementation rule

The shared pattern is the Explainer: a brief plain-language message, with an information affordance next to it that opens the technical detail. Every screen uses the same one.

Use `<Explainer brief="…" detail="…" />` from `components/common/Explainer.tsx`.
