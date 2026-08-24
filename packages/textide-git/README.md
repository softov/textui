# @textui/textide-git

Git for [textide](https://github.com/softov/textui/tree/main/packages/textide): the branch you are on, what has changed, diffs
you can open as tabs, staging, commits and branch switching.

It is a **loadable extension**, not part of the editor. Nothing in textide
knows it exists.

```json
{
  "extensions": ["@textui/textide-git"]
}
```

That is a `.textide.json` in the workspace root, so which extensions a project
uses is a property of the project rather than of the machine.

## What loading it does

| | |
|---|---|
| Status bar | Branch, drift from upstream, and how many paths have changed |
| Aside | `Source Control` - the changed paths, with git's own two-letter code |
| Tabs | `git:diff/<path>` opens through the resource registry, like any file |
| Commands | Refresh, Open Diff, Stage, Unstage, Stage All, Commit, Switch Branch |
| Keys | `ctrl+g` refreshes |

## The shape of it

`registerGit(app, { root })` returns **one `Disposable`**, and disposing it
takes out exactly what it put in: the components, the adapter, the commands,
the keybinding, the mount, the status segment - and it puts the aside back the
way it found it. There is a test that loads and unloads three times and counts
the registries each way round, because that is the property the whole extension
point rests on. An unload that leaves a viewer behind is a boundary in the
wrong place.

`activate(app, context)` is the same thing under the name textide's loader
looks for.

## Notes from the plumbing

**`git status --porcelain=v1 -b -z`.** NUL-separated, because a path with a
newline in it is legal and the line-separated form quotes it into a second
encoding that only the untested paths exercise. The two columns are kept apart
rather than folded into one status: "staged" and "changed since you staged it"
are the difference between a commit that is what you meant and one that is not.

**`git diff` exits 1 to mean "there are differences".** That is the answer, not
a failure - a wrapper that only reads stdout on exit zero turns every diff into
an empty one. `git.lenient` is the half that takes stdout either way.

**Never a shell.** Every call is `execFile` with an argument array, so a branch
called `; rm -rf /` is a branch name.

**A diff is not highlighted code.** The syntax scopes are `keyword`, `string`,
`comment`; there is no honest one for "this line was added", and borrowing
`string` because it happens to be green is how a theme with orange strings ends
up with orange additions. So `GitDiff` is its own component, and the meaning is
in the `+`, `-` and `@@` before it is in the colour.

**The status is in the store.** The panel draws it, the commands refresh it,
and staging from the palette lights the same row as staging from the panel. A
panel that ran `git status` itself would be a second answer to one question.

<!-- family -->

---

Part of **[TextUI](https://github.com/softov/textui)** - [documentation](https://softov.github.io/textui/) - [getting started](https://softov.github.io/textui/getting-started.html)

[`@textui/kit`](https://www.npmjs.com/package/@textui/kit) one install · [`@textui/core`](https://www.npmjs.com/package/@textui/core) the runtime · [`@textui/widgets`](https://www.npmjs.com/package/@textui/widgets) the catalog · [`@textui/terminal`](https://www.npmjs.com/package/@textui/terminal) adapters and input · [`@textui/testing`](https://www.npmjs.com/package/@textui/testing) the harness · [`@textui/cli`](https://www.npmjs.com/package/@textui/cli) the CLI
