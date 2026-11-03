---
title: The focus stays in a trapped modal
created: 2026-11-03
refs:
  - git://a9be401 - the commit of this repository the facts were checked at
  - "[code://packages/core/src/runtime/hooks.ts#L602-L611](../../packages/core/src/runtime/hooks.ts#L602-L611) - `autoFocus` declines only when the focus is in the control's own scope"
  - "[code://packages/core/src/core/focus.ts#L181-L192](../../packages/core/src/core/focus.ts#L181-L192) - `focus` moves the focus to any node, inside a trap or not"
  - "[code://packages/core/src/core/focus.ts#L206-L211](../../packages/core/src/core/focus.ts#L206-L211) - `chain` lists every scope on the stack, past a trap"
  - "[code://packages/core/src/core/focus.ts#L341-L348](../../packages/core/src/core/focus.ts#L341-L348) - `dispatch` gives a key to nothing outside the trap"
  - "file:///github/ahpc/.project/plans/screen/20261103-1529-the-commit-prompt-keeps-its-keys/plan.md - the ahpc plan that met this, and its fix in ahpc"
---

# The focus stays in a trapped modal

While a modal that traps the focus is open, nothing behind it takes the focus or the keys.
On 2026-11-03, the commit prompt in ahpc lost its text box to the list behind it, and each typed key ran the screen's actions.

## What textui has today

- An `autoFocus` control that mounts behind an open modal takes the focus from the modal. `useFocusable` declines only when the focus is in the control's own scope ([`code://packages/core/src/runtime/hooks.ts`](../../packages/core/src/runtime/hooks.ts)).
- `FocusManager.focus` moves the focus to any registered node, and does not check the trap ([`code://packages/core/src/core/focus.ts`](../../packages/core/src/core/focus.ts)).
- `dispatch` gives a key to no node outside the trap. With the focus outside the trap, the modal's own field gets no key either.
- `chain` lists the focused node and every scope on the stack, past the trap. The keybindings read it as `activeScopes`, so a binding of the screen behind the modal still runs.
- In ahpc, the list remounted when a row above it changed. Its `autoFocus` then took the focus. ahpc now keeps the list mounted, which hides the case there.

## The change

- `autoFocus` does not take the focus from a node in an active trap, unless the control is in that trap too.
- `focus` refuses a node outside the active trap.
- `chain` stops at the active trap, so only the bindings of the modal and the scopes inside it run.

## Open points

- Softov said a click on the text box did not focus it. That is not checked yet: the click may have gone to the list's scope too.
- The change to `chain` changes which bindings run under every modal. Check the apps that bind a key in a screen scope and expect it under a modal.
