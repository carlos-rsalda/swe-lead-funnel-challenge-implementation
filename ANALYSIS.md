# Part 2 — Systems Analysis

## 0. Assumptions & time spent

The four business rules leave gaps. Every gap below was decided deliberately; the reasoning behind
each decision is in [MAP.md](MAP.md).

**The seven rules the README does not settle**

1. **Transitions are open.** Any existing stage other than the current one — forward, backward, or
   skipping. Rule 4 names exactly one invalid transition and rule 2 only requires the target to
   exist, so there is nothing else to forbid.
2. **Capacity:** absent = no limit · `0` = a closed stage, not an unlimited one · negative or
   non-integer = an invalid funnel, rejected at construction.
3. **Moving a lead that does not exist** raises its own error, `LeadNotFoundError`. No existing error
   is recycled to mean a second thing.
4. **Identity is a `PhoneNumber` value object:** a `+` followed by 8–15 digits, separators ignored.
   Separators are presentation; digits are data.
5. **A funnel is validated once, at construction:** at least one stage, non-empty and unique stage
   ids, integer capacity ≥ 0. A funnel that exists is well formed.
6. **One use-case instance is one funnel.** The skeleton injects the funnel in the constructor, so
   there is no `funnelId` anywhere in the model.
7. **`save` is an upsert by identity.** No history, no timestamps, no delete.

**Precedence.** With `execute(): Promise<void>`, the error *is* the output contract, so the order of
the checks is part of the design: *from what depends only on the request to what depends on the state
of the world — the errors that survive a retry come first.* Two consequences the tests pin down: a
lead moved to the stage it is already in raises `InvalidStageTransitionError` without the occupancy
ever being queried, and a duplicate raises `DuplicateLeadError` even when the first stage is full,
because a duplicate is permanent and a lack of room is transient.

**Invariants split across two layers, by necessity.** `PhoneNumber` holds a well-formed number,
`Funnel` holds "the stage exists", `Lead.moveTo()` holds "target ≠ current". **Capacity cannot be a
domain invariant here**: the funnel knows the limit and the repository knows the occupancy, and only
the use case sees both. That is why the port needs `findByStage` at all, and why the capacity check
lives in the use case rather than in an entity.

**Uniqueness is global to the repository, not scoped to a funnel.** The README says a phone cannot
exist twice *"in a funnel"*, but `Lead` has no `funnelId` and `findByPhone` takes no scope. With one
funnel per use-case instance the two readings coincide; with a shared repository they would not.

**Normalization stops at presentation.** `+5215512345678` and `+525512345678` are kept as different
leads. Unifying them would require knowing that the `1` is a Mexican mobile prefix — a region-specific
inference, and no region reaches this service: neither `AddLeadToFunnelData` nor `Funnel` carries one.
Presentation is normalized; meaning is never inferred. This is the cost of the decision, stated rather
than hidden: leads written without a country code are rejected, and the caller resolves the ambiguity.

**Time spent:** ~1h55, from the first prompt to the last line of code — 09:17 to 11:10 in the
timestamps of `ai-session/`. Roughly 50 minutes reading the brief and deciding the assumptions, 35 on
the test suite and the repository port, 15 implementing the use cases, the in-memory adapter and the
simulation, and the rest on this document and the HTTP handler. Exporting the transcripts and
committing took a few minutes on top of that. The split is the part worth stating: the application
layer went green in about fifteen minutes because the decisions above and the tests were already
fixed before a line of it was written.

**AI usage.** Two agents were used, deliberately kept apart:

- one for the design and the implementation;
- one that wrote the test suite from `README.md`, `MAP.md` and the source, with no access to the first
  agent's conversation.

The separation is uneven, and the uneven part is the honest part:

- **Application layer — independent.** `AddLeadToFunnel` and `MoveLeadToStage` were still
  `throw new Error('Not implemented')` when their tests were written. Those tests cannot mirror an
  implementation that did not exist; they were derived from the precedence pipelines in `MAP.md` §4.
- **Domain layer — partial.** `PhoneNumber`, `Lead` and `Funnel` were already implemented and the
  second agent read them, because it needed their method names in order to call them. Those tests were
  written against existing code.

The point of the split is that whoever writes the code does not also write the ruler it is measured
with — which holds fully for the use cases and only partly for the entities. Both transcripts are in
`ai-session/`, so this is checkable rather than asserted.

---

## 1. Concurrency

**What goes wrong today.** Every check is a read followed by a write, with nothing in between:

- **Two agents moving the same lead.** Both read the lead, both pass every check, both call
  `save`. `save` is an upsert with no version, so the second write silently wins — a lost update
  with no way to detect it. `MoveLeadToStageData` carries no `expectedVersion`, so the signature
  itself cannot express the conflict.
- **The last free slot.** `MoveLeadToStage.ts:63-64` reads the occupancy and
  `MoveLeadToStage.ts:69` writes; `AddLeadToFunnel.ts:45-46` and `:50` do the same. Two requests
  interleaved between those lines both see room and both save, and the stage ends over its limit.
  Capacity is a precondition that was true when it was read, not an invariant.
- **Aliasing.** The repository hands out live references. Two handlers holding the same `Lead`
  share one mutable object, and `lead.moveTo()` changes what the other one is about to inspect.
  Mutating only after every check has passed is an ordering discipline, not a guarantee.

**Where correctness would be enforced against a real database** — in the database, not in the use case:

- **Rule 1 (uniqueness):** a `UNIQUE` index on the canonical phone. Keep the read for the friendly
  error, but treat the constraint violation as the authority and map it to `DuplicateLeadError`.
- **Lost updates:** a `version` column and a conditional write —
  `UPDATE leads SET stage_id = ?, version = version + 1 WHERE phone = ? AND version = ?`. Zero rows
  affected means someone else moved first. This requires adding `expectedVersion` to the use-case
  input; today there is nowhere to put it.
- **Rule 3 (capacity):** stop deriving the count at read time. A `stage_occupancy` row per stage with
  `CHECK (occupancy <= capacity)`, incremented in the same transaction as the move, turns capacity
  into an invariant the database enforces. The alternative — `SELECT ... FOR UPDATE` on the stage row
  to serialize entries into it — is simpler but converts a popular stage into a lock queue.

The precedence order stays as designed for the errors that are still decidable from the request; what
changes is that the capacity error may now arrive from a constraint rather than from a comparison.

---

## 2. Integration

- **Publish a fact, not an interpretation.** After a successful move, emit
  `LeadMovedStage { funnelId, phone, from, to, occurredAt }`. The use case already holds both ends of
  the pair at `MoveLeadToStage.ts:68`, just before the mutation.
- **This service does not editorialize.** Leaving `Closed` and advancing from `New` are different
  business facts, but naming one "a reopening" and the other "a correction" is the consumer's call.
  Shipping `from` and `to` lets analytics and notifications each decide; shipping a verb would force
  our reading on both.
- **Decoupling:** write the event to an outbox table inside the same transaction as the move, and let
  a relay publish it. The use case depends on an `EventPublisher` port in the domain; brokers stay in
  infrastructure. There is no such port today, nor a clock — `occurredAt` needs one.
- **New failure modes:** at-least-once delivery means duplicates, so consumers must be idempotent on
  an event id; no global ordering, so two moves of the same lead can arrive reversed and consumers
  need the `version` from Q1 to discard stale ones; analytics is now eventually consistent and will
  disagree with the funnel for a while; and the outbox and its relay become a second thing to operate,
  with a backlog to watch.

---

## 3. Scale

**What breaks first: the capacity check.** `AddLeadToFunnel.ts:45` and `MoveLeadToStage.ts:63` call
`findByStage(...)` and use only `.length`. `InMemoryLeadRepository.ts:29` scans every lead and
materializes an array, so counting the leads in a 500,000-row stage loads 500,000 leads to produce
one number. The port has no `count`.

**What breaks next: the board query cannot be expressed.**

- `findByStage(stageId)` returns everything, with no `limit` and no `offset`
  (`LeadRepository.ts:17`), and by decision it guarantees **no ordering**.
- **There are no timestamps.** `Lead` holds a phone, a name and a stage id (`Lead.ts:19-28`). "Most
  recent first" is not answerable — and it is also ambiguous: most recently *entered the funnel*, or
  most recently *entered this stage*? For a board column it is the second one.

**What I would change**

- Add `stageEnteredAt` to `Lead`, set on every `moveTo`, and `createdAt` for funnel entry. This is the
  one place where assumption 7 (no history, no timestamps) has to be paid for.
- Replace the count with `countByStage(stageId)`, or better, with the maintained counter Q1 already
  wants — one row read instead of a scan.
- Give the port a keyset page: `findByStage(stageId, { limit, after })` ordered by
  `(stage_entered_at DESC, phone DESC)`, with an index on the same tuple. Keyset rather than `OFFSET`,
  because offsets degrade exactly where the funnel is biggest.
- The board then costs one indexed query of 50 rows per stage, and the ordering contract exists in the
  port instead of being an accident of insertion order.

---

## 4. Evolution

**The permissive core is what makes this absorbable.** Because the only forbidden transition is
"target = current", per-workspace rules are *added* restrictions on top, not relaxations of a stricter
core. A design that had guessed "forward only" would have to be undone first.

**How it lands.** A `TransitionPolicy` port in the domain, injected into `MoveLeadToStage` alongside
the funnel and evaluated after the built-in checks, raising `InvalidStageTransitionError`. The wiring
already exists: one use-case instance is already one funnel, so it is also one workspace — the policy
is another constructor argument, not new plumbing. "Forbid backward moves" is a policy over
`(currentStageId, targetStageId)` and the funnel's stage order.

**What I would not build**

- **A rule DSL or a generic rule engine.** Two customers is not a language. Named policies in code,
  selected by configuration, until enough customers reveal what actually varies.
- **"Approval to enter `Closed`" as a transition policy.** It is not one. A policy answers yes or no
  about a move; an approval is a pending state with an actor, a second write and a lifetime of its
  own. Forcing it into a boolean predicate would either lie about the domain or smuggle a state
  machine into a function that is supposed to answer a question.
- **Configurable relaxations of the four rules.** A workspace that allows duplicate phones or ignores
  capacity is not configuration, it is a second product: every consumer of every event downstream
  would have to handle both worlds.
- **Per-workspace phone normalization, until a region actually reaches this service.** The correct
  fix is to add the region to workspace configuration and pass it in, not to guess a default and call
  it a setting.
- **A "force move" escape hatch.** The moment there is a way to bypass the checks, the precedence
  order and the capacity invariant stop being true, and the events downstream stop being trustworthy.
