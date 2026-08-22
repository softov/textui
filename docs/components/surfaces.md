---
title: Surfaces, shells and resources
parent: Components
nav_order: 5
---

# Surfaces, shells and resources

Two small catalogues whose behaviour is documented elsewhere: these are the
component names, and the links say where the model behind them lives.

## Surfaces and shells

`SurfaceArea` `MountView`, the layouts (`TabsLayout`, `StackLayout`,
`SplitLayout`, `BarLayout`, `RailLayout`, `SingleLayout`, `InlineLayout`), and
the shells (`PlainShell`, `ConsoleShell`, `PaperShell`, `WorkbenchShell`).

What a surface is, and what a shell decides, is in
[Platform](../platform/).

## Resources

`ResourceExplorer` `ResourceView` `MarkdownViewer` `TextViewer` `FallbackViewer`
`ResourceActions` `ResourceOpenWith` `ResourceBreadcrumb`

`JsonViewer` and `JsonTreeViewer` ship with the JSON adapter rather than the
catalog, and are registered only when an application asks for it with
`app.registerAdapter(jsonAdapter())`.

`ResourceView` takes an optional `viewerId`, which is what a screen passes when
the reader has chosen among the viewers `viewersFor(kind)` offers -
`ResourceOpenWith` renders exactly that list.

See [Documents](../documents/) and
[Syntax highlighting](../themes/syntax.md).
