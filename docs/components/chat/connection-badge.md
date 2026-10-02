---
title: ConnectionBadge
parent: Chat
grand_parent: Components
---

# ConnectionBadge
{: .no_toc }

Which host, and whether it is answering.

```tsx
import { ConnectionBadge } from '@textui/chat';

<ConnectionBadge url="ahp://127.0.0.1:7000" state="connected" sessions={3} />
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `url` | `string` | **required** |  |
| `state` | `'connecting' \| 'connected' \| 'offline'` | **required** |  |
| `sessions` | `number` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

`state` picks a tone and a glyph together - a filled bullet for connected, a half one for connecting, a cross for offline - because a colour on its own is lost in a piped log and a 16-colour session.

The url is truncated from the start rather than the end, because the end of a hostname is what tells two of them apart.
`sessions` is drawn as a badge and pluralised through i18n when the host has said how many there are.

## See also

- [Badge](../display/badge.md) - the count
- [StatusDot](../display/status-dot.md) - the shared status vocabulary
- [Adapters](../../terminal/adapters.md) - what the url is a url of
