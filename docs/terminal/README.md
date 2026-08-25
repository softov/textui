---
title: Terminal
nav_order: 9
has_children: true
permalink: /terminal/
---

# Terminal

Everything between the runtime and a real tty: what the session can do, who owns it while the application runs, and how bytes become input events.

An adapter is anything that can deliver bytes and accept bytes - a Node process, a test harness, an ssh session, a browser canvas. Components never talk to one; they state a role and the theme and the writer resolve it against what the adapter reported.

> This is a *terminal* adapter. A **resource** adapter, in
> [Documents](../documents/), is an unrelated thing that happens to
> share the word.
