---
title: The vocabulary
nav_order: 3
---

# The vocabulary

Everything else assumes these words. They are worth five minutes.

**Node.** A plain object with a `component` name and props: `{ component: 'Row', gap: 1 }`. JSX produces exactly this, so `<Row gap={1}/>` and the object are the same value.

**Graph.** A screen *is* its root node. Children nest inside it. Nothing in a graph is a module reference, which is why it can be persisted, sent, generated or edited.

**Registry.** A name to a thing, resolved at mount time. Components, commands, keybindings, themes, layouts, shells, resource kinds, viewers, editors and actions each have their own typed registry - not one plugin bag.

**Store.** One reactive tree addressed by JSON-Pointer-shaped paths. `$/scope/a/b` is absolute; `/a/b` is relative to the surrounding data context. The first segment is a **scope**, and scopes are lifetimes: `local` dies with the mount, `screen` with the screen, `app` outlives both, `modus` holds the environment.

**Event path.** `@/dialog/confirm`. The same shape as a store path, a different lifetime: delivered and forgotten, with no value to read back.

**Binding.** `{ path: '$/x' }` as a prop value. The runtime resolves it and subscribes to exactly that path, so nothing else re-renders the node.

**Command.** A registered action with an id, a title and a `when` clause. Buttons, keybindings, menus and the palette all run commands - which is why they cannot drift from each other.

**Surface.** A named region: `header`, `rail`, `sidebar`, `aside`, `main`, `panel`, `status`, `overlay`, `notify`. Nine names, fixed, because they are the vocabulary a layout, a keybinding scope and a shell share.

**Mount.** One component in one surface, under a key, with display metadata and a policy.

**Layout.** How a surface arranges the several mounts it holds: `tabs`, `stack`, `split`, `bar`, `rail`, `single`, `inline`, `floating`, `toast`. Which one a surface uses is store state, so it is switchable at runtime.

**Shell.** The frame around the surfaces. Where they go is the whole of what a shell decides.

**Layer.** A plane: `base`, `floating`, `modal`, `notification`, `debug`. Dialogs, menus, tooltips, palettes and toasts are entries on one, so focus trapping and dismissal are decided once.

**Capability.** Something the terminal can do: colour depth, Unicode level, mouse, paste, hyperlinks, alternate screen, synchronised output. Components degrade against these; they never feature-detect on their own.

**Resource.** Anything addressable that a viewer, editor or action can be registered for. Kinds form a hierarchy by dotted name, so `file.markdown` specialises `file.text`.

**Adapter.** Everything one resource type needs, as one value: kinds, a provider, viewers, a highlighter, actions, commands. Registering returns a disposable that removes exactly what it added. (The other kind of adapter is a *terminal* adapter, in `docs/adapters.md`; the two never meet.)

**Document.** An open buffer for a resource, at `$/session/documents/<uri>`. What a viewer shows and what an action transforms - so formatting a file from a read-only provider does something visible without writing anything.

**Scope (syntax).** What a highlighter names instead of a colour: `key`, `string`, `number`, `comment`, `invalid`. The theme resolves it, so the same highlighter is right on every theme and disappears on a colourless terminal.

**Measurement.** The rect a component was laid out into, via `useMeasure`. A component with `flex` or a `height` renders what fits and scrolls; one without renders its content and sizes its box. This is what keeps a long document from resizing the panes around it.
