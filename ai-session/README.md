# AI sessions

Full transcripts of the agent sessions used for this test, as required by the README.

| Session | Raw | Readable |
|---|---|---|
| Design and implementation — reading the brief, deciding the assumptions, writing `MAP.md`, and implementing the domain, the use cases, the adapter and the simulation. | `01-implementation.jsonl` | `01-implementation.md` |
| The test suite — written with no access to the other session and no access to the use-case implementations, which did not exist yet: only `README.md`, `MAP.md` and the domain code. | `02-tests.jsonl` | `02-tests.md` |

**The `.jsonl` files are the complete record**, exactly as Claude Code stores them: one
JSON object per line, in order, including every tool call, every tool result and the
model's internal reasoning.

**The `.md` files are a script-generated rendering of the same data**, for reading. Nothing
is reordered or omitted: every prompt and every reply appears in full. Tool calls are
collapsed to one-line summaries, and their outputs and the reasoning blocks are left in
the raw file rather than duplicated here.

The two sessions were kept apart on purpose: whoever writes the code should not also write
the ruler it is measured with. `ANALYSIS.md` §0 explains where that independence is real
and where it is only partial.
