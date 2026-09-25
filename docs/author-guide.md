# Author guide

This guide grew into **[BOOK-AUTHORING.md](BOOK-AUTHORING.md)** in Storyframe
v2: the three lanes (Quick Book, Crafted, Prebuilt), the Quick Book directive
syntax and themes, the manifest field by field, the declarative `build`
block, saving progress well, accessibility obligations, size budgets, how IDs
and `stateSchemaVersion` affect existing readers, and a checklist before
publishing.

The two v1 integration patterns are still the reference implementations:

- `stories/neon-horizon` — a **native** story written against the SDK.
- `stories/the-tulip-and-the-jester` — a **legacy wrap** of an existing
  single-file story with a ~120-line glue file.

v2 adds a third: `stories/the-keeper-of-wend-light`, a **Quick Book** written
entirely in Markdown with every directive.
