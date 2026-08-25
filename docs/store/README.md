---
title: Store
nav_order: 5
has_children: true
permalink: /store/
---

# Store

One reactive tree, addressed by JSON-Pointer-shaped paths, and the only place state lives. Everything a screen knows is a path in here: the rows of a table, which pane has focus, what the terminal can do. A component that copies store state into `useState` has created a second answer to one question.

Events share the path syntax and nothing else. They are delivered and forgotten, with no value to read back - which is the whole of the distinction.
