---
title: Document buffers
parent: Documents
nav_order: 4
---

<!-- docs:setup
import { useDocument } from '@textui/documents'; declare const app: import('@textui/core').TextUIApp; declare const uri: string; declare const formatted: string; declare const next: string; -->

# Document buffers

An action that formats a file has to change something. Changing the provider means every transform is a write; changing nothing means the transform is a lie. A **document buffer** is the third option.

```ts
import { openDocument, setDocumentContent, saveDocument, isDocumentDirty } from '@textui/documents';

const doc = await openDocument(app, uri);      // reads through the provider, once
setDocumentContent(app.store, uri, formatted); // every viewer of that URI updates
isDocumentDirty(app.store, uri);               // content !== what was read
await saveDocument(app, uri);                  // writes back, or throws if read-only
```

In a component:

```tsx
const doc = useDocument(uri);
doc.content; doc.dirty; doc.readonly;
doc.set(next); doc.revert(); doc.reload(); await doc.save();
```

Buffers live at `$/session/documents/<uri>`, so they die with the process. The viewers shipped here read them, which is why running "Format" on a file from a read-only provider shows you the formatted document and changes nothing on disk.
