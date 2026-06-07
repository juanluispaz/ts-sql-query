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
`test/db/`. To verify the wrap **shape** (the reason-header convention
the new wraps must mirror), run
`bun run tests:where-is --search <api> --cell-caveats full --coord '<target-cells>'`
— it lists the existing markers in those cells, line by line.

**If the sub-agent flags an issue the writing agent disagrees with**:
explain *to the user* in the wrap-up — not to the sub-agent — why the
original choice stands. The sub-agent is independent by design; arguing
with it inside the loop defeats the point.

## What this catches and what it doesn't

This gate sits **next to** [`tests:audit`](./TESTS_AUDIT.md), not in
competition with it. The audit is the **mechanical anti-cheat layer**:
~24 syntactic rules (`mirror-image`, `one-sided-guard`, `mock-only`,
`as-any`, `commented-test-reason`, `tautology`, `weak-matcher` …) that
fire across the **whole matrix** at the close of the round and block
merge on `error` severity. The sub-agent is the **earlier feedback** on
the canonical cell, and it owns the calls the audit can't make
mechanically (judgement, cross-doc context, intent). When a check moves
from "subjective" to "syntactic", it lands in the audit and this gate's
load shrinks — see [`lib/audit/AUDIT.md`](./lib/audit/AUDIT.md) for the
boundary.

**Catches well** (the failure modes that need judgement or cross-doc
context the audit can't apply):

- Assertions that assume the lib will pre-emptively enforce something it
  decided not to (cross-checked against
  [`LIMITATIONS.md`](./LIMITATIONS.md)).
- Tests that should be wrapped per an existing
  [`BUGS.md`](./BUGS.md) entry but aren't.
- Tests that would need a post-propagation wrap per
  [`EXTERNAL_CAVEATS.md`](./EXTERNAL_CAVEATS.md) but the wave didn't
  surface it.
- The "is this assertion actually meaningful?" call when the syntax is
  legal but the value being asserted is weak in a way the audit's
  semantic anchors don't capture.
- Stub-disguised-as-commented when the reason header IS present and the
  body is short — see [`ANTIPATTERNS.md` § Stub as commented test](./ANTIPATTERNS.md#2-stub-as-commented-test)
  ("Gate today" for the partial mechanical coverage already in the audit).

**Also blocked mechanically by the audit** (defence in depth — the
sub-agent flags them on the canonical before propagation, the audit
blocks them across the matrix at round close):

- Mirror-image smell + one-sided guards — `mirror-image` /
  `one-sided-guard` rules.
- `as any` outside the sanctioned runtime-guard form — `as-any` rule
  (with `any-type`, `ts-ignore`, `ts-expect-error` for the sibling
  bypasses).
- Commented tests with no reason header — `commented-test-reason` rule.
- Mock-only tests + real-DB skips — `mock-only` / `skip-real-db` rules.

The sub-agent still reads these on the canonical because catching them
**before** propagation saves the cost of re-baking 17 sibling cells; the
audit catches them **after** propagation as the final blocker. Belt and
braces.

**Doesn't catch**:

- Hallucinated APIs — by the time the canonical is baking green, the
  tests have compiled and run; if the API didn't exist, the bake would
  have failed earlier. The defence is the pre-flight
  [`tests:where-is --search <api>`](./CODE_SEARCH.md) check in
  [`COVERAGE_RUNBOOK.md` § Pre-proposal pre-flight](./COVERAGE_RUNBOOK.md#pre-proposal-pre-flight),
  not this gate.
- Tests that are mock-validated only because the agent didn't run the
  cell against real-DB. The gate operates on snapshots; it can't tell
  whether the snapshot was confirmed by an engine. The defence is the
  agent reporting `mock-validated` vs `real-validated` honestly at the
  close of the round — see
  [`COVERAGE_RUNBOOK.md` § Closing the round](./COVERAGE_RUNBOOK.md#closing-the-round).
- Post-propagation regressions on the syntactic surface — those are now
  caught by [`tests:audit`](./TESTS_AUDIT.md) at the close of the round,
  not this gate. A propagation script that strips a workaround wrap
  silently, a re-bake that fails to apply a Bun#29010 wrap, a `commented-
  test-reason` violation introduced during the copy: the audit flags
  them. Anything subtler than syntax still surfaces only at final user
  inspection.

## Future: automating individual checks

Several of the sub-agent's checks have already moved to mechanical gates
in [`tests:audit`](./TESTS_AUDIT.md):

- **Mirror-image smell** — landed as the `mirror-image` rule (with
  `one-sided-guard` for the asymmetric variant).
- **`as any` outside the runtime-guard** — landed as the `as-any` rule,
  with the suppression syntax (eslint/oxlint style, reason mandatory)
  for the rare irreducible case. Siblings `any-type`, `ts-ignore`,
  `ts-expect-error` cover the other typer bypasses.
- **Commented test without one of the three first-class reason
  markers** (`// NOT-APPLICABLE`, `// TODO[LIMITATION]`, `// TODO[BUG]`)
  — landed as `commented-test-reason` (and `skipped-test-reason` for
  `test.skip` /
  `test.todo` siblings).
- **Mock-only / real-DB skip** — landed as `mock-only` and `skip-real-db`.

Still pending in `tests:audit`:

- **Stub-disguised-as-commented (the BODY, not the missing reason)** —
  a finer audit extension that flags commented blocks whose body is
  suspiciously short (< N lines) or only contains comments / TODOs
  **even when the reason header IS present**. The reason-missing path
  is already covered by `commented-test-reason`.

Explicitly **out of scope for `tests:audit`** (the audit's rules are
universal anti-cheat patterns, not per-database / per-connector
wrappers):

- **Bun#29010 sweep** and analogous DB/connector-specific re-wrap
  checks. Those defences live in [`EXTERNAL_CAVEATS.md`](./EXTERNAL_CAVEATS.md)
  (the catalogue), the sub-agent's `EXTERNAL_CAVEATS` sweep on the
  canonical (this gate), and the mechanical re-wrap step in
  [`COVERAGE_RUNBOOK.md` § Propagation](./COVERAGE_RUNBOOK.md#propagation)
  on every sibling cell. They will not move to `tests:audit`.

Pending items are tracked under the matching entries in
[`ANTIPATTERNS.md`](./ANTIPATTERNS.md) as "Gate pending". As each
lands, this section and the sub-agent prompt
([`lib/canonical-cell-review-prompt.md`](./lib/canonical-cell-review-prompt.md))
both drop the matching check.
