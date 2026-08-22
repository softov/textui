# Hot reload

Built. `pnpm dev:watch` in [packages/textide](../../packages/textide) rebuilds
on save and swaps the result into the running editor; f5 does the same on
demand. This is what it turned out to take, and what is still open.

## What it does

```
save → rebuild every bundle
     → build failed?  yes → say so on stderr, send no signal, keep running
     → no → SIGUSR2 the child
          → import ./screen.mjs?v=N   (a URL nothing has imported; ESM has no
                                       other way to invalidate one)
          → import failed?  yes → "reload failed" in the status bar, nothing
                                  disposed, keep running
          → no → close every layer
               → dispose the bag the last registration returned
               → call the new module's registerTextide(app)
               → restore focus by id, best effort
```

The store is never touched. What a person had typed, which files they had
open, where they had scrolled to are all in there, and none of it goes through
the reload.

## What the work actually was

The esbuild watch was twenty lines. Everything after it was the problem.

**Ownership.** A rebuild produces new module instances and the registries hold
the old ones. Dispose nothing and you get two `file.save` commands, two
`ctrl+s` bindings and two viewers claiming `file.markdown`; dispose everything
and the host application loses its own registrations. The rule is that a
reload disposes the bag it made last time and nothing else, which meant
`registerTextide` had to put *everything* in that bag - including its four
surface mounts, which it used to open and forget. A registration that leaves
its mounts behind cannot be undone: disposing it unregisters the components and
leaves four surfaces naming things nothing answers to.

**Seeding is not setting.** `seedWorkspace` wrote `$/ui/sidebar/collapsed`
every time it ran, which meant every reload folded up a sidebar somebody had
opened. It now writes it only when nothing has filled it in - the rule
`useStore` already follows.

**One runtime, not two.** This is the part that decided the build. A
`defineComponent` from a second copy of `@textui/core` builds components whose
hooks read a `currentInstance` that the first copy's renderer never sets, so
every one of them throws on its first render. So [`scripts/dev.mjs`](../../packages/textide/scripts/dev.mjs)
bundles the runtime to its own files and has both the host and the reloadable
screen import them by URL, which is what makes them the same module object
rather than two identical ones.

**A failed build must change nothing.** The reload builds first, succeeds, and
only then disposes - and reports on the status bar rather than in a toast,
because a toast lands on the frame the reload exists to preserve.

## The open questions, answered

- **What does a reload do to a dirty buffer?** Nothing. The buffer is in the
  store and the reload does not touch the store. Asserted in
  [`test/reload.test.ts`](../../packages/textide/test/reload.test.ts), because
  "nothing" is easy to break.
- **Does the host application reload too, or only the library?** Neither: the
  *screen* reloads. `register.ts` is the reloadable module, `main.tsx` is the
  host, and the runtime is shared by both.
- **How is a reload reported?** The status bar, through
  `$/ui/status/segments` - the same extension point anything else contributes
  to, so the segment merges rather than replacing the list.
- **Is the screen stack preserved or reset?** textide has no screen stack; it
  is all surface mounts, and those are re-opened by the new registration. The
  question comes back if screens are ever used here.

## What is still not reloaded

A change under `packages/core`, `packages/terminal` or `packages/documents`
needs the process restarted - the running process is holding those files, and
rebuilding one writes a file nothing re-imports, which looks like a reload that
silently did nothing. The watch deliberately covers `packages/textide/src` only
for that reason.

Reloading the runtime as well would mean re-creating the application, not
re-registering into it: a new `createApp` seeded from a snapshot of the old
store, with the terminal handed over rather than re-acquired. That is a
different job, and it is worth doing only if the runtime turns out to be what
people are actually editing.
