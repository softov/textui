# todo

A small application with pages, rather than one long list.

```bash
pnpm example todo
pnpm example todo --static --width 100
pnpm example todo --data ~/todo.json     # where the file lives
```

## What it is here to show

Three ways a thing can be on screen, which are easy to conflate and expensive to get wrong:

| | what it is | when it changes |
|---|---|---|
| **surface** | a region of the frame - the navigation is mounted on `sidebar` | never, while the app runs |
| **screen** | what is in `main`, one at a time, with a stack behind it | every time you navigate |
| **layer** | over the top of both - the palette, a confirm | while it is open |

The navigation does not remount when the page changes, which is why navigating with it does not destroy it. That is the entire reason a surface and a screen are different things, and it is invisible until you build something with both.

## Five page types, not fifteen screens

```text
List        →  Inbox, Today, Upcoming, Completed, Archived, a project's tasks, a tag's tasks
Detail      →  a task, as a page
Collection  →  Projects, Tags - a list of things that each hold a list
Search      →  a query, kept
Settings    →  preferences, in the store like everything else
```

Adding "someday" is a filter. Adding notes to a project is a tab inside a page that already exists. Neither is a new kind of screen, which is what the five buy you.

## What to look at first

**[`src/app.tsx`](src/app.tsx)** - the registration. Components, surfaces, screens, commands and keys, in that order, all returning into one bag so a host can dispose the lot. Nothing is reachable one way only: every key runs a command, and the palette is the list of commands.

**[`src/components.tsx`](src/components.tsx)** - none of them take the data as a prop. They read the store and subscribe to the subtree they read, so completing a task on the detail page redraws the list behind it without either knowing the other exists. Passing the list down would work exactly until two screens showed it at once.

**[`src/screens.tsx`](src/screens.tsx)** - `ProjectPage` puts its current tab in `$/screen.project/tab`, which is the screen's own store scope: it is forgotten when the screen is popped, because which tab you were on was about that visit. `SearchPage` is `keepAlive`, because a query is worth keeping.

**[`test/smoke.test.tsx`](test/smoke.test.tsx)** - checks the three things a screenshot cannot tell you apart: that the sidebar survived navigating, that the screen scope died with its screen, and that one task is one task however many places show it. It also renders the whole thing at `--unicode ascii` and asserts nothing on screen is outside ASCII, which caught a `↑↓` written into this example's own key hints.

## The database is one JSON file

A [persistence adapter](src/storage.ts), not saving. Nothing in this application calls "save": the store owns which paths are written, when the writes coalesce, and when they are read back, so a command that toggles a task and one that adds a project are the same act - a write to the store.

```json
{ "version": 1, "tasks": { … }, "projects": { … }, "settings": { … } }
```

What is about *this run* is not in it. The selection and the search box would restore a highlight pointing at a task that has since gone. Seeding happens at boot and hydration after it, so the fixture data is a default and the file is the answer; a missing file is a first run, not an error. The write goes to a temporary file and renames over the target, so a process killed halfway leaves the previous file rather than half of a new one.

## The filter is three axes, not one menu

Status, project and tag are asked at the same time and they **combine**. "Today, in Scena, tagged design" is one view.

```text
╭ Today · Scena · #design ────────────╮
```

Making them one exclusive choice is what turns a filter into a menu: picking a project throws away the status, and nothing on screen says it did. Each axis has an "Any" row that clears that axis and leaves the other two alone, so there is nothing to reset.

The number beside each row is what the list would hold if you chose it, **with the other two axes as they are** - which is why `Advisor 0` while `Scena 2` under `Today · #design`. A total per project would be a number about the data rather than about what you are looking at.

## The sidebar is four blocks, not a tree

`INBOX`, `PROJECTS`, `TAGS`, `MORE`. A heading is a row nobody can select - `disabled` - so the keyboard steps over it and one flat list draws blocks with titles. Nothing nests: `PROJECTS` is a title, never somewhere to go.

**Enter chooses; moving does not.** With one axis, moving could choose - there was nothing to pass over. With three, walking from `INBOX` down to a project would set every status on the way and arrive with the list already wrong. A dot marks the chosen row in each block, so the cursor is free to be somewhere else.

The first three blocks filter. The fourth navigates - those are pages, not filters.

The application's name is in the title bar. It was the sidebar's heading, which made the sidebar look like one tree called "Todo" with everything underneath it.

## Nothing here writes a dialog

`task.new` declares that it needs a title and the palette collects it. `task.delete` calls `confirm`, which opens a `Dialog` on the modal layer and resolves `false` when it is dismissed - there is no third answer to handle, and no confirm component in this example.

```ts
{ id: 'task.new', args: [{ name: 'title', type: 'string', required: true }], … }
app.keybindings.register({ keys: 'n', commandId: 'app.palette', args: { at: 'task.new' } });
```

## Keys

```text
↑↓ move    enter choose/open    space done    n new    e edit
del delete    x archive    / search    tab pane    esc back
ctrl+p commands    q quit
```

Three panes, and tab reaches all three. The detail panel is a stop because it scrolls, and something that scrolls but cannot be focused only scrolls with a mouse.
