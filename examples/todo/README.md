# todo

A small application with pages, rather than one long list.

```bash
pnpm example todo
pnpm example todo --static --width 100
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

## Keys

```text
↑↓ move    enter open    space done    n new    x archive    / search
tab pane   esc back      ctrl+p commands        q quit
```
