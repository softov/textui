---
title: LogViewer
parent: Display and data
grand_parent: Components
---

# LogViewer
{: .no_toc }

Lines arriving continuously, with a tail that stops when you scroll.

```tsx
import { LogViewer } from '@textui/widgets';

<LogViewer
  lines={[
    { time: '09:02:11', level: 'info', message: 'listening on :8080' },
    { time: '09:02:14', level: 'error', source: 'db', message: 'connection refused' },
  ]}
  flex={1}
/>
```

## Props

<!-- props:start -->
| Prop | Type | Default | |
| --- | --- | --- | --- |
| `lines` | `LogLine[]` | **required** |  |
| `visibleRows` | `number` |  | Rows shown. Older lines scroll off the top. |
| `follow` | `boolean` |  | Stick to the newest line. Turned off when the reader scrolls up. |
| `showTime` | `boolean` | `true` |  |
| `showLevel` | `boolean` | `true` |  |
| `onFollowChange` | `(follow: boolean) => void` |  |  |

Plus everything on [`BoxProps`](../base-props.md).
<!-- props:end -->

Role: `log`.

It follows the tail until the reader scrolls, then stops. That single behaviour is the difference between a log you can read and one that yanks itself away the moment you find something.

`follow` and `onFollowChange` expose that state, so a status bar can say "following" and a key can turn it back on. Turn `showTime` or `showLevel` off when the lines already carry their own.

## See also

- [Feed](feed.md) - entries rather than lines, with a cursor
- [CodeViewer](code-viewer.md) - a fixed document rather than a stream
