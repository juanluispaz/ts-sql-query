# `test/` — canonical-cell quality gate

The validation sub-agent that reviews the canonical cell of a
coverage-driven wave **before** propagation to the rest of the matrix.
Catching DESIGN-violating tests on **one** file is much cheaper than
catching them after they've been propagated to every cell.

This doc is the protocol: when to invoke, how to invoke, and what to do
with the verdict. The literal prompt the sub-agent receives lives next to
it as a separate, versionable asset:
[`test/lib/canonical-cell-review-prompt.md`](./lib/canonical-cell-review-prompt.md).
The runbook that drives the round invokes the gate as one of its steps —
see [`COVERAGE_RUNBOOK.md` § The validation gate](./COVERAGE_RUNBOOK.md#the-validation-gate).

- [When to invoke](#when-to-invoke)
- [How to invoke](#how-to-invoke)
- [What the writing agent does with the verdict](#what-the-writing-agent-does-with-the-verdict)
- [What this catches and what it doesn't](#what-this-catches-and-what-it-doesnt)
- [Future: automating individual checks](#future-automating-individual-checks)

## When to invoke

After the canonical cell of a wave bakes green (snapshot bake + at least
one real-DB pass per [`WRITING_TESTS.md` § Real-DB validation of one cell](./WRITING_TESTS.md#real-db-validation-of-one-cell))
**and before** any propagation script runs.

- One sub-agent invocation per canonical file.
- If a single wave touches multiple canonical files (e.g. one
  `select.*.test.ts` and one `errors.*.test.ts`), invoke the sub-agent
  once per file.
- If the wave proposes changes to an EXISTING canonical (strengthening an
  assertion, adding tests to a file that already exists in every cell),
  invoke the gate on the modified file before propagation — the cost is
  the same.

## How to invoke

Read [`test/lib/canonical-cell-review-prompt.md`](./lib/canonical-cell-review-prompt.md).
Pass the literal prompt text (the fenced block inside that file) to an
`Explore` sub-agent, with the two placeholders filled:

- `<canonical-path>` — the test file the wave produced.
- `<intent>` — one sentence describing which uncov branches in `src/` the
  wave targets.

```js
Agent({
  description: "Validate canonical wave against DESIGN",
  subagent_type: "Explore",
  prompt: <text-from-canonical-cell-review-prompt.md, with placeholders filled>,
})
```

The prompt deliberately asks the sub-agent to read
DESIGN/WRITING_TESTS/BUGS/LIMITATIONS/EXTERNAL_CAVEATS/ANTIPATTERNS
itself, rather than trust a summary. That gives the gate independence
from whatever assumptions the writing agent made.

## What the writing agent does with the verdict

The sub-agent reports a single verdict — **GREEN**, **YELLOW**, or **RED**
— with a structured list of issues:

- **GREEN** — no critical issues. Propagate per
  [`COVERAGE_RUNBOOK.md` § Propagation](./COVERAGE_RUNBOOK.md#propagation).
- **YELLOW** — minor issues only. Writing agent fixes them at its
  discretion; the user can override either way at end-of-session
  inspection.
- **RED** — critical issues. **Fix every critical issue**, re-bake the
  canonical, re-invoke the validation sub-agent on the fixed file. **Do
  not propagate** until the verdict is GREEN or YELLOW with intent to
  accept.

The sub-agent also produces an **EXTERNAL_CAVEATS sweep** — a list of
`(test_name, target_cells)` pairs that need post-propagation re-wrapping
(Bun#29010, sqlite3 BigInt, sqlite uuid_str, etc.). The propagation step
applies these mechanically — see
[`COVERAGE_RUNBOOK.md` § Propagation](./COVERAGE_RUNBOOK.md#propagation).
Cross-check the cell list the sub-agent returns against
`bun run tests <wave-coord-glob> --list-cells` to confirm the wraps land
on exactly the cells the propagation will touch — no manual `find` over
`test/db/`.

**If the sub-agent flags an issue the writing agent disagrees with**:
explain *to the user* in the wrap-up — not to the sub-agent — why the
original choice stands. The sub-agent is independent by design; arguing
with it inside the loop defeats the point.

## What this catches and what it doesn't

**Catches well** (the failure modes the gate was built for):

- Mirror-image smell (`if (!ctx.realDbEnabled){exact}else{weak}`) — see
  [`ANTIPATTERNS.md` § Mirror-image smell](./ANTIPATTERNS.md#1-mirror-image-smell).
- Stubs in commented blocks instead of full canonical bodies — see
  [`ANTIPATTERNS.md` § Stub as commented test](./ANTIPATTERNS.md#2-stub-as-commented-test).
- `as any` outside the sanctioned runtime-guard form — see
  [`ANTIPATTERNS.md` § As any to bypass typer rejection](./ANTIPATTERNS.md#4-as-any-to-bypass-typer-rejection).
- Assertions that assume the lib will pre-emptively enforce something it
  decided not to (cross-checked against
  [`LIMITATIONS.md`](./LIMITATIONS.md)).
- Tests that should be wrapped per an existing
  [`BUGS.md`](./BUGS.md) entry but aren't.
- Tests that would need a post-propagation wrap per
  [`EXTERNAL_CAVEATS.md`](./EXTERNAL_CAVEATS.md) but the wave didn't
  surface it.

**Doesn't catch**:

- Hallucinated APIs — by the time the canonical is baking green, the
  tests have compiled and run; if the API didn't exist, the bake would
  have failed earlier. The defence against hallucinated APIs is the
  pre-flight grep in [`COVERAGE_RUNBOOK.md` § Pre-proposal pre-flight](./COVERAGE_RUNBOOK.md#pre-proposal-pre-flight),
  not this gate.
- Tests that are mock-validated only because the agent didn't run the
  cell against real-DB. The gate operates on snapshots; it can't tell
  whether the snapshot was confirmed by an engine. The defence is the
  agent reporting `mock-validated` vs `real-validated` honestly at the
  close of the round — see
  [`COVERAGE_RUNBOOK.md` § Closing the round](./COVERAGE_RUNBOOK.md#closing-the-round).
- Post-propagation regressions — the gate runs on the canonical, not on
  the 17 propagated copies. A propagation script that strips a workaround
  wrap silently, a re-bake that fails to apply Bun#29010 wraps — those
  surface only at the final user inspection.

## Future: automating individual checks

Several of the sub-agent's checks could become mechanical gates:

- **Mirror-image smell heuristic** — grep for `if (!ctx.realDbEnabled)`
  whose only `expect(...).toEqual(...)` is inside the guard.
- **Stub-as-commented-test** — audit extension that flags commented blocks
  with suspiciously short bodies.
- **`as any` allowlist** — declarative `test/.as-any-allowlist` mapping
  `file:line → reason`, checked by `tests:audit`.
- **Bun#29010 sweep** — grep gate that fails if `bun_sql_postgres` cells
  contain live `new Date(` calls inside test bodies.

These are tracked under the corresponding entries in
[`ANTIPATTERNS.md`](./ANTIPATTERNS.md) as "Gate pending". As each lands,
the sub-agent prompt can drop the matching check; the file under
`test/lib/canonical-cell-review-prompt.md` is the single point of
update.
