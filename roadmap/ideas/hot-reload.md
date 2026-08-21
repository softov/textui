# Hot reload

Not built. This is what it would take and what it would have to preserve.

## Where it stands

`pnpm dev` bundles textide from the workspace *sources* every run ([scripts/dev.mjs](../../packages/textide/scripts/dev.mjs)), so a change to the runtime is live on the next launch with no build step in between. A running editor picks up nothing.

The shape is already decided in [decisions](../../docs/decisions.md): **a reliable full remount that preserves the store beats a clever partial one that sometimes does not.** Nothing about that has changed. What follows is the part that is actually work.

## Why it is a job and not a slice

The esbuild watch is twenty lines. Everything after it is the problem.

**A rebuild produces new module instances, and the registries hold the old ones.** Components, commands, keybindings, themes, shells, layouts, screens, resource kinds, providers, viewers, editors, actions, highlighters, adapters - every one is a late-binding registry, and every one is populated by a `register*` call that returns a `Disposable`. A reload that does not dispose the previous registrations gets duplicates: two `file.save` commands, two `ctrl+s` bindings, two viewers claiming `file.markdown`. A reload that disposes too much takes the host application's registrations with it.

So the first real question is **ownership**: which registrations belong to the reloadable module and which belong to whatever is hosting it. `registerTextide` already returns one bag for exactly this reason. The rule probably is: a reload disposes the bag it made last time and nothing else, which means the entry point has to hand the bag to the reloader rather than dropping it.

**The store must survive, and parts of it point at things that will not.** `$/session/documents` is the easy case - text is text. `$/screen.*` scopes name screens that are about to be re-registered from new module instances. Surface mounts hold `ComponentNode`s that name components by string, which is fine, and inline function nodes, which is not: a mount whose target closes over the old module keeps the old module alive and draws it.

**Focus, layers and overlays are live references.** Focus ids are strings, so they survive a remount if the same components register the same ids - and quietly do not if a component generated one. An open palette is a layer entry holding a node; after a reload it is a node from the previous build sitting on top of the new one. Simplest honest answer: **close every layer on reload.** An overlay that survives a reload is an overlay nobody can reason about.

**A failed rebuild must leave the running application alone.** esbuild throwing mid-reload cannot be allowed to dispose the registries and then fail to repopulate them - that is a black screen with no way back. The reload has to build first, succeed, and only then swap.

## What it would need to look like

```
watch → build to a temp module
      → import it (a cache-busting URL; ESM has no invalidation)
      → build succeeded?  no  → report on the status bar, keep running
      → yes → close every layer
            → dispose the previous registration bag
            → call the new module's register(app)
            → remount the current screen / root
            → restore focus by id, best effort
```

The store is never touched. That is the whole point: what a person had typed, which file they had open, where they had scrolled to are all in the store, and none of it goes through the reload.

## Open questions

- **What does a reload do to a dirty buffer?** Nothing, if the buffer is in the store and the reload does not touch it. Worth asserting in a test, because "nothing" is easy to break.
- **Does the host application reload too, or only the library?** Only the library is easier and less useful. Only the application is more useful and needs the library's registries left alone.
- **How is a reload reported?** A toast is wrong - it lands on the frame somebody is looking at. The status bar is probably right.
- **Is the screen stack preserved or reset?** Preserved is what a person expects. It also means the stack holds ids registered by a module that no longer exists, so the ids have to be re-registered before the stack is replayed.

## Why it is worth doing

textide is where the library gets used in anger, and the loop today is quit, run, navigate back to what you were looking at. Most of what that loop costs is the navigating, which is exactly what preserving the store removes.
