# Lead Funnel Service - Technical Test

Welcome to the **Lead Funnel Service** technical test.

> **How to start**: create a copy in your own GitHub account with **"Use this template"** and work there. When you finish, make sure your copy is **public** and send its link back to your recruiter — no pull request needed.

At Leadsales, a workspace organizes its leads in a **funnel**: a board of ordered stages (e.g. `New`, `Contacted`, `Qualified`, `Closed`). Leads enter the funnel and move between stages as the sales conversation progresses.

This is a **take-home test**. You have **up to 2 hours** and it has **two parts**:

- **Part 1 — Implementation**: implement the core domain logic.
- **Part 2 — Systems Analysis** (written in `ANALYSIS.md`, discussed in the review session): reason about how this design behaves in the real world.

We are as interested in **how you think** as in the code you write. Before writing any code, read everything and form a mental model. The business rules are intentionally incomplete: **document every assumption you make** in `ANALYSIS.md` (there is a section for it), or send your questions to your interviewer before starting.

## AI Usage — required reading

Using an AI coding agent (Claude Code, Cursor, Antigravity, Copilot, etc.) is **allowed and expected** — we work that way at Leadsales. Two conditions:

1. **You must share your complete session** with the agent as part of your submission (see Deliverables). How you direct the agent — what you ask, what you question, what you reject, what you verify — is a core part of the evaluation.
2. **You own every line.** In the review session we will ask you to explain and modify any part of the code without the agent. Submitting code you don't understand is the fastest way to fail this test.

## Deliverables

1. The **link to your public repository** (created from this template), with your implementation and completed `ANALYSIS.md`.
2. Your **full AI session**: export the complete transcript(s) of your agent session(s) into an `ai-session/` folder in the repo (markdown, JSON, or your tool's export format — whatever preserves the full conversation). If you worked without an agent, say so explicitly in `ANALYSIS.md`.

## Project Structure

```bash
src/
├── domain/
│   ├── entities/              # Domain models (Lead, Funnel)
│   ├── repositories/          # Abstract interfaces
│   └── errors/                # Domain exceptions
├── application/
│   └── use-cases/             # Business logic (use cases)
├── infrastructure/
│   └── persistence/           # In-memory persistence adapter
└── index.ts                   # Entry point for simulation
```

## Business Rules

1. A lead is identified by its **phone number**. The same phone number cannot exist twice in a funnel.
2. A lead can only be moved to a stage that **exists** in the funnel.
3. Each stage may define a **capacity limit** (maximum number of leads it can hold). Moving or adding a lead into a full stage must be rejected.
4. Moving a lead to the stage it is already in is not a valid transition.

> The rules above do not cover every situation. Deciding what is underspecified — and documenting your assumptions about it — is part of the test.

## Part 1 — Implementation

1. Implement the `AddLeadToFunnel` use case:
   - Validate that no lead with the same phone number already exists in the funnel.
   - Use `DuplicateLeadError` if a duplicate is found.
   - New leads always enter the funnel's **first stage** (capacity rules apply).
   - Save valid leads to the repository.

2. Implement the `MoveLeadToStage` use case:
   - Validate the target stage exists (`StageNotFoundError`).
   - Validate the target stage has capacity (`StageCapacityExceededError`).
   - Validate the transition is valid (`InvalidStageTransitionError`).

3. Complete the `Lead` and `Funnel` entities with appropriate validations.

4. Implement the `InMemoryLeadRepository`:
   - Save leads.
   - Find leads by phone number and by stage.

5. Simulate the funnel flow in `index.ts` with at least: one lead added, one valid move, one duplicate rejected, and one invalid move rejected.

### Guidelines

- Follow **Hexagonal Architecture**: keep domain logic isolated.
- Respect **SOLID principles** and **Clean Code** practices.
- Use **TypeScript** types and interfaces correctly.
- Keep your code readable, modular, and well-named.

### Bonus

- Add a function to simulate HTTP request handling (input/output as JSON).
- Add simple unit tests for the funnel business rules.

## Part 2 — Systems Analysis

Answer in `ANALYSIS.md`. Short, concrete answers beat long generic ones — bullet points are fine. There is no single right answer; we want to see the **failure modes you anticipate** and the **trade-offs you weigh**.

1. **Concurrency.** Two sales agents move the *same lead* to *different stages* at the same time, and a third agent moves *another lead* into a stage with one slot left. What can go wrong with your current design? Where would you enforce correctness if the repository were a real database?

2. **Integration.** When a lead changes stage, other Leadsales-like services need to react (e.g. analytics, notifications). How would you communicate the change without coupling this service to its consumers? What new failure modes does your choice introduce?

3. **Scale.** A funnel grows to 500,000 leads and the board UI needs "the first 50 leads of each stage, most recent first". What breaks first in your current design, and what would you change?

4. **Evolution.** Product now wants **per-workspace configurable rules** (e.g. one customer forbids backward moves, another requires an approval to enter `Closed`). How does your design absorb this without a rewrite? What would you refuse to build, and why?

## Time Limit

You have **up to 2 hours total**. Suggested split: ~80 minutes for Part 1, ~30 minutes for Part 2, and the rest for cleaning up your submission. It is better to deliver Part 1 solid plus thoughtful partial answers than everything rushed. Please be honest about the time you actually spent — note it in `ANALYSIS.md`.

Good luck, and happy coding!
