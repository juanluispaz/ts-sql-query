# `test/` — antipatterns catalogue

Living catalogue of failures we've shipped while writing or generating tests,
each tied to the rule it violated and the gate adopted to prevent recurrence.

**Purpose**: keep the lessons accumulated where they get re-read. Every
antipattern below either survived the first review or shipped to multiple
cells before being caught — that is the bar for adding an entry. Don't add
trivial mistakes; do add the ones that get repeated.

**Living document**: when a new failure mode surfaces, add an entry following
the template at the bottom. When the gate that prevents it becomes automatic
(lint check, audit extension), update the entry's "Gate" field to reflect it.

| # | Antipattern | First class of failure |
|---|---|---|
| [1](#1-mirror-image-smell) | mirror-image smell | weakens real-DB validation |
| [2](#2-stub-as-commented-test) | stub-as-commented-test | breaks full-canonical-body discipline |
| [3](#3-blind-copy-to-bun_sql_postgres) | blind copy from `pg` to `bun_sql_postgres` | reintroduces Bun#29010 workarounds |
| [4](#4-as-any-to-bypass-typer-rejection) | `as any` to bypass typer rejection | hides a real lib bug |
| [5](#5-hallucinated-api) | hallucinated API in proposed wave | invents calls that don't exist |

---

## 1. Mirror-image smell

**Symptom**

```ts
if (!ctx.realDbEnabled) {
    expect(rows).toEqual([{ /* exact */ }])     // strong
} else {
    expect(rows.length).toBeGreaterThan(0)      // weak
}
```

The mock branch asserts a precise value; the real-DB branch asserts only
that the shape is "something with a length". Almost any regression slips
through under `--docker` / `--wasm`, but the test reports as "passing both
modes".

**Rule violated**: [`DESIGN.md` § Mock-only is a smell — Mirror-image form](./DESIGN.md#mirror-image-form).

**Why it's tempting**: real-DB results are sometimes non-deterministic
(aggregate order, FP precision, seed defaults that trivialise the assertion).
Weakening the real-DB side "makes the test pass" without dropping the test.

**Why it's wrong**: a mock-validated `[{a, b}]` that no engine has ever
produced is the author's hypothesis; pairing it with a real-DB assertion
that would accept anything means the engine never actually validates the
hypothesis. The promotion mock-validated → real-validated never happens.

**Remedies** (in increasing cost; pick the cheapest that works):

1. `ORDER BY` on the projected key — when the test's premise allows it.
2. Sort in JS the unstable dimension, compare exactly:
   `expect(rows.map(r => ({...r, items: [...r.items].sort(cmp)}))).toEqual(...)`.
3. UPDATE inside `ctx.withRollback` to populate known values, then SELECT
   (must be the last statement so `ctx.lastSql` captures it). Recipe in
   [`DESIGN.md` § Mirror-image form](./DESIGN.md#mirror-image-form).
4. Pick a query the existing seed already produces a meaningful answer for.

Only after all four genuinely fail (the dialect returns a legitimately
different value — FP precision, time-zone) split the assertion with a
comment naming the cause. Length checks alone almost never qualify.

**Gate today**: mechanical via the `mirror-image` rule of
[`tests:audit`](./TESTS_AUDIT.md) (with `one-sided-guard` for the asymmetric
variant where only one branch asserts the value). The rule fires across the
whole matrix, not just the canonical, and it runs at the close of the round
as the blocking gate. The validation sub-agent
([`QUALITY_GATE.md`](./QUALITY_GATE.md)) still reads the canonical cell as
the earlier feedback gate before propagation. Irreducible carve-outs
(autogen ids the real engine assigns, FP precision) use a mandatory-reason
`// tests-audit-disable-next-line` — see
[`TESTS_AUDIT.md` § Suppress a finding](./TESTS_AUDIT.md).

**Gate pending**: none. The rule landed; the rare carve-outs go through the
suppression syntax (eslint/oxlint style, reason mandatory) instead of an
allowlist file.

---

## 2. Stub as commented test

**Symptom** — a test commented out for a cell where it doesn't apply, with
body replaced by a stub:

```ts
// NOT-APPLICABLE: Values is not typed on this dialect.
/*
test('select-from-values-untyped', async () => {
    // stub
})
*/
```

**Rule violated**: [`DESIGN.md` § Full-canonical-body discipline](./DESIGN.md#full-canonical-body).

**Why it's wrong**:

- The symmetry audit only checks test names exist; a stub passes the audit
  silently.
- A reader diffing across cells sees a gap where a parallel test body
  should be.
- Uncommenting the test when the dialect catches up has to re-derive the
  body from another cell — work that was already done once.

**Remedy**: copy the FULL canonical body verbatim from the cell that DOES
support the test, inside the `/* */` block. The line above the block names
the dialect / driver constraint that justifies the comment-out. Example in
[`DESIGN.md` § Full-canonical-body discipline](./DESIGN.md#full-canonical-body).

**Gate today**: partial mechanical coverage. The `commented-test-reason`
rule of [`tests:audit`](./TESTS_AUDIT.md) fails any commented test that
lacks one of the three first-class reason markers (`// NOT-APPLICABLE`,
`// TODO[LIMITATION]`, `// TODO[BUG]`), so the stub-without-reason path
is blocked across the whole matrix. Distinguishing "body is a stub"
from "body is a legitimate one-line test wrapped with a real reason
header" still requires reading neighbouring canonical bodies — that
judgement stays with the validation sub-agent
([`QUALITY_GATE.md`](./QUALITY_GATE.md)).

**Gate pending**: a finer audit extension that flags commented blocks whose
body is suspiciously short (< N lines) or contains only comments / TODOs
even when the reason header IS present. Tricky because legitimate one-line
bodies exist (rare).

---

## 3. Blind copy to `bun_sql_postgres`

**Symptom** — taking the canonical from `test/db/postgres/newest/pg/` and
copying it verbatim to `test/db/postgres/newest/bun_sql_postgres/` (and
`oldest/bun_sql_postgres/`), re-decommenting the Bun#29010 workaround wraps
that were in place.

**Rule violated**: [`EXTERNAL_CAVEATS.md` § `bun_sql_postgres` — Date parameter binding (Bun#29010)](./EXTERNAL_CAVEATS.md#bun_sql_postgres--date-parameter-binding-bun29010).

**Why it's wrong**: Bun.SQL's PostgreSQL adapter serialises JS `Date`
parameters via `Date#toString()` instead of an ISO/timestamp format.
PostgreSQL rejects the bound value with `invalid input syntax for type
date|timestamp` whenever a `Date` intended as `localDate` / `localDateTime`
reaches the driver. The wrap is per-test, per-`bun_sql_postgres`-cell —
mechanical copy from `pg` loses it.

**Remedy**: after `cp` to a `bun_sql_postgres` cell, sweep with

```bash
grep -nE 'new Date\(' test/db/postgres/*/bun_sql_postgres/<new-file>
```

and wrap every match in `/* */` with the `Bun#29010` reason header (verbatim
from existing tests). Applies to **every** `Date` parameter for `localDate`
or `localDateTime`, not just the three names currently commented out. To see
the existing Bun#29010 wraps already in place across `bun_sql_postgres` cells
(the shape your new wrap must match), run
`bun run tests:where-is --search <api> --cell-caveats full --coord 'postgres/*/bun_sql_postgres'`.

**Gate today**: caught by the validation sub-agent's `EXTERNAL_CAVEATS`
sweep (see [`QUALITY_GATE.md`](./QUALITY_GATE.md)) on the canonical
before propagation, and re-applied mechanically by
[`COVERAGE_RUNBOOK.md` § Propagation](./COVERAGE_RUNBOOK.md#propagation)
step 4 (the EXTERNAL_CAVEATS re-wrap pass) on every sibling cell.
Partial generic coverage from [`tests:audit`](./TESTS_AUDIT.md):
`non-deterministic-input` flags `new Date()` (no arg) used as a query
input everywhere (mock or real), and `commented-test-reason` requires
a `TODO[BUG]: Bun#29010 …` header on any commented wrap. Neither
catches the specific shape "a live `new Date('<literal>')` in a
`bun_sql_postgres` cell that should have been wrapped" — the date
literal is deterministic, so the generic rule sees nothing wrong.

**Gate pending**: none mechanical. A coord-aware "live `new Date(` in
`bun_sql_postgres`" check is **out of scope for `tests:audit`** — the
audit's rules are universal anti-cheat patterns, not per-database /
per-connector wrappers. DB/connector-specific defences live in
[`EXTERNAL_CAVEATS.md`](./EXTERNAL_CAVEATS.md) (the catalogue), the
sub-agent's sweep (canonical, pre-propagation) and the runbook's
re-wrap step (post-propagation). The user's final inspection is the
last line.

---

## 4. As any to bypass typer rejection

**Symptom**:

```ts
const view = ctx.conn.virtualColumnFromFragment(
    'string',
    (fragment: any) => (fragment as any).sql`'open'`,   // ← bypass
)
```

**Rule violated**: [`DESIGN.md` § The `as any` runtime-guard exception](./DESIGN.md#as-any-runtime-guard).

**Why it's wrong**: when TypeScript rejects an API the test wants to call,
the right answers are exactly three (none of them `as any` in test bodies),
each with its own first-class reason marker (see
[`LIMITATIONS.md`](./LIMITATIONS.md) for the comparison):

1. The dialect doesn't support the feature by design — block-comment with
   `// NOT-APPLICABLE: <reason>` per the
   [Symmetry rule](./DESIGN.md#symmetry-rule). The same test runs live in
   the cells whose dialect supports it.
2. The lib hasn't covered the path yet — block-comment with
   `// TODO[LIMITATION]: see LIMITATIONS.md — <one-line>`.
3. The lib has a bug — open an entry in [`BUGS.md`](./BUGS.md), block-comment
   the test with the canonical body and `// TODO[BUG]: see test/BUGS.md`.
4. The API doesn't exist — verify with `bun run tests:where-is --search <name>`
   (see [`CODE_SEARCH.md` § When the symbol is not found](./CODE_SEARCH.md#when-the-symbol-is-not-found))
   before proposing the test.

`as any` to "make TS shut up so the test compiles" silences the typer's
warning that one of the four is happening. The test then asserts something
the type system says shouldn't be reachable.

**Concrete example**: `BUGS.md` § `virtualColumnFromFragment` callback fails
TS overload resolution when the fragment template has no `${…}` interpolation.
The interpolation workaround makes TS accept the call but **hides the bug**;
the canonical form is `fragment.sql\`'open'\`` and the test should be
block-commented with `// TODO[BUG]: see test/BUGS.md`.

**Remedy**: never use `as any` in test bodies except for the sanctioned
runtime-guard pattern shown in
[`DESIGN.md` § As any runtime-guard](./DESIGN.md#as-any-runtime-guard) —
cast at the narrowest fluent step that escapes the type, with a comment
naming the runtime guard being reached.

**Gate today**: mechanical via the `as-any` rule of
[`tests:audit`](./TESTS_AUDIT.md) (complemented by `any-type` for `any`
type annotations, and `ts-ignore` / `ts-expect-error` outside
`types.negative/` for the other typer bypasses). The runtime-guard pattern
in exception tests is tolerated by the rule's semantic carve-out; truly
irreducible cases use `// tests-audit-disable-next-line as-any -- <reason>`
with a mandatory justification visible in the diff. The validation
sub-agent ([`QUALITY_GATE.md`](./QUALITY_GATE.md)) still reads the
canonical cell as the earlier feedback gate.

**Gate pending**: none. The suppression syntax (eslint/oxlint style,
reason mandatory) that `tests:audit` enforces handles irreducible cases
uniformly across the matrix.

---

## 5. Hallucinated API

**Symptom** — a coverage-driven wave proposes tests for a public method
that does not exist in `src/`. Example from a past round: tests proposed for
`aggregateAsObject(...)`; the only API in the neighbourhood was
`aggregateAsArray(...)`.

**Rule violated**: pre-flight discipline in
[`COVERAGE_RUNBOOK.md` § Verify the API actually exists](./COVERAGE_RUNBOOK.md#verify-the-api-actually-exists).

**Why it's wrong**: an entire wave gets proposed and discussed before
anyone notices the API doesn't exist. Worse, the agent may invent a
plausible-sounding signature and write tests against it that "almost
compile" with an `as any` cast (see antipattern #4).

**Remedy**: before proposing any wave, run

```bash
bun run tests:where-is --search <api-symbol>
```

The `Classification` block answers existence directly — `public` /
`public impl` / `internal` / **not found**. **Not found** means the API
is a hallucination; don't propose a test, open a follow-up to discuss
whether the documented behaviour lives under a different name or whether
the docs are stale. See
[`CODE_SEARCH.md` § When the symbol is not found](./CODE_SEARCH.md#when-the-symbol-is-not-found).

**Gate today**: mechanical via [`tests:where-is`](./CODE_SEARCH.md) — the
searcher reports `not found` against the indexed `src/` surface and the
agent pastes the `Classification` block into the wave plan as a
verifiable artifact. COVERAGE_RUNBOOK §4.1 prescribes the call.

**Gate pending**: none. The check is mechanical and produces a copyable
artifact; the wave-level discipline gap is closed.

---

## Template for new entries

```markdown
## N. <short name in kebab-case>

**Symptom**

<code or one-paragraph description showing the antipattern>

**Rule violated**: [link to DESIGN.md anchor or other normative source]

**Why it's tempting**: <one paragraph; what makes this look like a reasonable choice>

**Why it's wrong**: <one paragraph; the harm done>

**Remedy**: <step-by-step or link to the recipe in DESIGN/WRITING_TESTS>

**Gate today**: <how this is caught NOW — manual review, sub-agent, etc.>

**Gate pending**: <what mechanical gate would catch it; "none feasible" is fine>
```

Keep entries terse (~30-40 lines including the example). The file is a
catalogue, not a treatise.
