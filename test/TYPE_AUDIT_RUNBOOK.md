# `test/` — type-driven missing-tests detection: agent runbook

> **What this document is.** A self-contained operating manual for an agent
> (orchestrating sub-agents) running a session of "find the tests the TYPE
> DEFINITIONS imply but the suite lacks". The user invokes it with a one-line
> prompt of the form **"read `test/TYPE_AUDIT_RUNBOOK.md` and run the next
> missing-tests audit"**. Each session emits a working report,
> `test/MISSING_TESTS_AUDIT_<N>.md` — a working report. **The agent never
> deletes it, or any prior report; removing them is the user's call alone.**
> Treat it as **not** an input to the next round
> (older reports may still be on disk — inherit no verdict from them).
> **This runbook is the durable memory.** Everything a
> future round needs — the standard, the degeneracy bar, the surface
> decomposition, the recurring themes, the bugs the method has caught — lives
> here or behind a link spelled out here, never in a prior report.
>
> **What this document is NOT.** A re-statement of how a test is written —
> that lives in [`DESIGN.md`](./DESIGN.md) (normative) and
> [`WRITING_TESTS.md`](./WRITING_TESTS.md) (how-to). This runbook is the
> *discovery* half; it ends at a written report. The *generation* half (turn
> a finding into a baked, propagated, real-validated test) is the back half of
> [`COVERAGE_RUNBOOK.md`](./COVERAGE_RUNBOOK.md) (§5 onward) and is reused
> verbatim once findings exist.
>
> **Why this exists — and how it differs from the coverage runbook.**
> [`COVERAGE_RUNBOOK.md`](./COVERAGE_RUNBOOK.md) starts from the istanbul
> coverage report and asks *"which lines never executed?"*. This runbook
> starts from the **TypeScript type surface** and asks *"which capability the
> types advertise is never asserted?"*. The two are complementary and **find
> different bugs**. Coverage is blind to a path that *did* execute but whose
> emitted SQL / result type / value is wrong — a type-vs-impl divergence on a
> reachable-but-untested overload. That is exactly the class of bug this audit
> has caught (e.g. `ShapedInsertOnConflictSetsExpression` → a real
> MariaDB/MySQL `ON DUPLICATE KEY UPDATE` fix), which **no
> coverage report would have surfaced**. Use this runbook to drive the suite
> toward *total coverage of the typed surface*; use the coverage runbook to
> mop up genuinely-unexecuted lines.
>
> **The standard we hold — and why.** The target is **total coverage of every
> reachable typed path *and every variant*** — including variants that look like
> the same implementation. The library's whole promise is compile-time-validated
> SQL across six dialects; combined with dynamic queries and TypeScript's
> generics that is an explosion of "apparently insignificant" details, and **the
> insignificant-looking ones are exactly where the bugs live**. There is no path
> "too small to test": a distinct reachable overload / interface / per-receiver
> method / arity / kind / classification gets a test even when its output
> coincides with a covered one. This is not completeness theatre — it is a
> **proven bug-finding method** — the recurring fingerprints it has surfaced are
> distilled in §9, and each maximalist pass has tended to surface **more real
> `src/` bugs as its findings were implemented**. Every time the bar was
> *lowered* ("this is borderline / degenerate / low-value, skip it") it skipped
> over a real defect.
> Hold the bar high; **prefer erring by excess**. The cost of an extra test is
> minutes; the cost of an unasserted typed capability is a latent bug no coverage
> report can see.

- [§0 Mandatory reading](#mandatory-reading)
- [§0.5 Staleness safeguard](#staleness-safeguard)
- [§1 The loop, end to end](#the-loop-end-to-end)
- [§2 The unit: the type-path](#the-unit-the-type-path)
- [§3 COVERED — the evidence bar](#covered--the-evidence-bar)
- [§4 The degeneracy bar (read this twice)](#the-degeneracy-bar)
- [§5 Scope — in, deferred, out](#scope)
- [§6 Wave 1 — discovery agents](#wave-1--discovery-agents)
- [§7 Aggregate + coordinator verification](#aggregate--coordinator-verification)
- [§8 The report](#the-report)
- [§9 Recurring themes — where the bugs hide](#recurring-themes)
- [§10 Operational rules](#operational-rules)
- [§11 Where this runbook ends](#where-this-runbook-ends)

## Mandatory reading

Hold these in working memory **in full** before launching any agent. The
audit is only as good as the rules the discovery agents carry.

1. **[`CLAUDE.md`](../CLAUDE.md)** at the repo root — repo conventions, the
   `tests` / `tests:audit` command vocabulary, the reserved `test*` names, the
   architecture layering (Connection → SqlBuilder → QueryBuilder →
   expressions/values → QueryRunner → complexProjections).
2. **[`DESIGN.md`](./DESIGN.md)** — the normative core. Principle #1 (a test
   asserts `ctx.conn` SQL + params + result type + value, real-DB-validatable)
   is the floor every finding must clear: a "finding" that cannot become such
   a test is not a finding (see §4, degenerate-by-non-validatability).
3. **No prior report is required reading.** The `MISSING_TESTS_AUDIT_<N>.md`
   reports are the user's to remove (the agent never deletes them) — so never
   depend on one being present; but **older ones are often still on disk**, so do
   not assume their absence either. Two consequences: **(a) derive the round number**
   `N` as one past the highest `MISSING_TESTS_AUDIT_*.md` index present (or `_1`
   if none) — that file is where you write this round's report; **(b)** the
   durable knowledge a report would carry is already folded into this runbook
   (themes §9, degeneracy bar §4, surface decomposition §6, verified bugs §9). If
   a prior report *is* on disk you may skim it to avoid re-typing prose, but
   **inherit no verdict** — "covered" / "saturated" / "floor" is re-derived from
   the **current** test files every round, never assumed. Fresh, independent eyes
   are the point (see §0.5).
4. **[`test/db/postgres/domain/connection.ts`](./db/postgres/domain/connection.ts)**
   — the shared fixtures (tables, views, sequences, fragment/aggregate
   helpers, branded types, custom-boolean adapters). The reference cell's
   coverage is bounded by what these fixtures expose; knowing them is what
   separates a §A finding (existing fixture) from a §B finding (needs a
   fixture column).
5. **[`CODE_SEARCH.md`](./CODE_SEARCH.md)** § "This tool vs. textual search" —
   so you know the dividing line: **discovery never uses the searcher** (see
   §6), but coordinator *coverage-checking* and *reachability* questions do.
   Refresh the index once at session start: `npm run tests:index` — the **full**
   index (see the pre-flight note below), NOT the lighter `tests:index:newest`.
6. **[`BUGS.md`](./BUGS.md)** + **[`LIMITATIONS.md`](./LIMITATIONS.md)** —
   every entry. A "missing test" that is actually a known bug or a declared
   library limitation is not a gap. A divergence this audit *finds* goes to
   `BUGS.md` (never fixed from the audit), per
   [`WRITING_TESTS.md` § When a test surfaces a bug in `src/`](./WRITING_TESTS.md#when-a-test-surfaces-a-bug-in-src).

If any of these changed since the last round, the change wins; this runbook is
a synthesis, not the source of truth.

## Staleness safeguard

The type surface and the matrix both drift: new value-source methods, new
column factories, new connectors / `compatibilityVersion` cells, new fixtures
in `domain/connection.ts`. Any concrete count, filename, line number, or
surface list in **this** file is a snapshot.

**Pre-flight at session start:**

1. `npm run tests:audit` — the authoritative per-database cell/test counts for
   today's matrix. Reference cell is still `postgres/newest/pg/` unless this
   prints otherwise.
2. `npm run tests:index` — the semantic index, for coverage-checking
   and reachability later. Use the **full** index, not `tests:index:newest`:
   coverage-checking spans every version cell, so a newest-only index would
   under-report older-tier coverage. (Discovery itself is raw reading; the index is not
   needed for it — so if the build fails, don't block the fan-out; grep +
   compile-repro are the authoritative §7 verifiers anyway. On a failed build,
   `scripts/tests-index.sh --help` documents the fallbacks.)
3. Re-read `domain/connection.ts` — fixtures change between rounds (this round
   may add the columns a prior round's §B asked for, which converts §B items to
   covered or to §A).
4. Derive the round number: `ls test/MISSING_TESTS_AUDIT_*.md` — write this
   round's report to one past the highest index present (`_1` if none).
5. **`git log --oneline -15` and look for a recently-changed src TYPE surface**
   (`src/expressions/*.ts`, `src/complexProjections/*`, `src/connections/*`,
   `src/Table.ts`/`View.ts`/`Values.ts`, `src/TypeAdapter.ts`). **A just-changed
   type surface is the single highest-value target of the round.** A change that
   adds/narrows an overload, a conditional type alias, or a new interface almost
   always ships the *negative* side locked in `types.negative/` but leaves the
   **positive / newly-reachable** type-path with **zero runtime coverage** — the
   accepted-but-untested arm. Read the commit's src diff, then seed the relevant
   discovery agents (parity, the matching per-surface agent, and the seam critic)
   to audit that new arm's positive side specifically. (This technique has
   repeatedly produced a clean §A cluster that several agents converge on
   independently — e.g. a fix that made a table-bound `orderBy` on a recursive
   result a compile error left the *no-table* value-source/raw-fragment arms
   untested everywhere.) **Also scan the round's freshly-implemented tests for a
   BAKED-IN bug** — when the prior round's backlog just landed, a characterization
   test can bake in the very bug it was meant to document: a test whose
   `expected`/`toEqual` value contradicts its own `assertType<Exact>` (omits a key
   the type marks required, uses `null` where the type says `undefined`, keeps a
   container the type drops) is asserting the bug as correct. The **type is ground
   truth**; diff each just-added `assertType`+`toEqual` pair's key-presence /
   null-ness, and probe the boundary row if they disagree.

**Maintenance contract.** If the **degeneracy bar** (§4), the **scope** (§5),
or the **surface decomposition** (§6) is refined by the user during a session,
update this runbook in the same session — those three are the load-bearing
rules and they have already shifted once (see §4's history note).

**Timelessness discipline — teach the method, do NOT narrate the history.** This
document is not a log of what each round found or a catalogue of what git already
records fixed; it teaches **how to do the work** the meticulous way that has proven
fruitful. The worked examples and illustrations here are **frozen** — an example
proves its technique exactly as well as a newer one would, so swapping it for the
latest instance, re-dating a round tag, or "fixing" a line number is pure churn that
adds no rule and risks importing an error. **Leave them.** Staleness of an
illustration is harmless: the §0.5 pre-flight re-derives every live count, filename
and line before each round, so nothing here is trusted as current anyway. Touch this
file in only three cases: **(a)** a round surfaces a **genuinely new failure mode /
oracle / technique** not already stated — add it as a *timeless rule* (state the rule;
keep any illustration to a clause; never delete the older illustration of the same
rule; no round tag, no commit hash); **(b)** a round confirms a **new `src/` defect**
that teaches a **new fingerprint** (§9) not already listed — add/refine that
fingerprint (a defect matching an existing fingerprint needs no edit — git records the
fix); **(c)** the user refines a load-bearing rule (above). Anything else — a fifth
restatement of a rule already stated four ways, a newer example for a pattern already
illustrated, a per-round or per-bug narrative — is churn to skip. When you *do* add,
write it so it never needs re-touching: a rule, not a story.

## The loop, end to end

One session runs this sequence once and stops at a written report. (Turning
findings into baked tests is a *separate* user-initiated step — the back half
of [`COVERAGE_RUNBOOK.md`](./COVERAGE_RUNBOOK.md).)

```
   §6  Wave 1      ~16 discovery agents (one per surface), ≤10 running at once.
                   Each RAW-READS its slice of src/ (TYPES only), builds an
                   exhaustive enumeration matrix, checks each cell against the
                   CURRENT test files, and reports INLINE: §A / §B / §C + counts.
   §7  Aggregate   dedupe across agents; then COORDINATOR-VERIFY every large,
                   borderline, or cross-agent-contradictory claim YOURSELF —
                   wide-grep for absence + tsgo compile-repro for reachability
                   and exact inferred type. Do not trust a flaky agent on a
                   load-bearing call.
   §8  Report      write test/MISSING_TESTS_AUDIT_<N>.md: §A (existing
                   fixtures) / §B (needs a fixture) / §C (degenerate, listed) /
                   refuted, grouped into THEMES and TIERED by risk, with a
                   recommended implementation order and an honest verdict.
       ─ stop ─    the user implements (or asks for the generation half).
```

There is no separate "Wave 2 adversarial verifier" tier as a hard requirement:
with ≤ a handful of surviving candidates, **the coordinator's own compile-repro
is the stronger verifier** and is mandatory (§7). Spin up dedicated refuter
agents only when the candidate set is large enough that fan-out pays.

## The unit: the type-path

The unit of analysis is the **type-path**: every *distinct reachable typed
entry point* the type system exposes. One source method can be many type-paths:

- **Overloads** — N overloads = N paths. (`const(v,t)` vs `const(v,t,adapter)`
  vs `const(v,t,typeName,adapter)` are three paths.)
- **Per-receiver-type methods** — a base method (`equals`, `getMonth`,
  `nullIfValue`) is *re-declared* on each value-source interface; each
  `(method × concrete leaf type)` is a path. `NumberValueSource.nullIfValue` ≠
  `BigintValueSource.nullIfValue`.
- **Operand kind** — `add(constLiteral)` and `add(valueSource)` are distinct
  overloads → distinct paths.
- **Receiver optionality** — a method on a `'required'` receiver and on an
  `'optional'` receiver thread a different `OPTIONAL_TYPE` → distinct
  return-branches.
- **Arity** — `buildFragmentWithArgs` at 0/1/2/3/4/5 args; the compound vs
  non-compound order-by overload set.
- **Kind** — each `'int' | 'bigint' | 'uuid' | 'customDouble' | …` a factory
  or `const`/`fragmentWithType`/`sequence` accepts.
- **Return-branch** — optionality/nullability propagation, brand keep vs erase
  (`sign()` on a customInt erases to Number), result-shape inference.
- **Input-classification** — which projection *rule* fires for a given leaf
  configuration (the rule-2↔rule-3 boundary is a path even though two
  configurations can produce the same output shape).

Rules of thumb the discovery agents apply: *union input → one path per member;
overloaded → each overload; return type with multiple branches → each branch;
declared on N interfaces → N paths.*

## COVERED — the evidence bar

A type-path is **COVERED** iff a test in the `test/` matrix asserts that exact
distinction by at least one of:

- **emitted SQL + params** (`ctx.lastSql` / `ctx.lastParams` inline snapshot), and/or
- **`assertType<Exact<…>>`** on the result/value-source type, and/or
- **the runtime VALUE** via `toEqual` / `toBe` — required whenever the type
  *promises* a value distinction: `| null`, `| undefined`, an **absent key**
  (which needs an explicit **`'k' in obj`** check — `toEqual` with the key
  omitted is blind to a present-`undefined`), or a **branded round-trip**
  (write a branded value, read it back branded **and** value-equal).

NOT covered: `void X`, `<any, any>`, a signature-only snapshot
(`simplifiedDefinition.generated`), or `Extends`-only where `Exact` is
possible. Pair every **dynamic** path with its **direct** non-dynamic
equivalent and require identical SQL + params. date/time tests run under
`TZ=UTC`.

For the concrete shape these assertions take — the `ctx` API (`ctx.conn`,
`ctx.mockNext(expected)`, `ctx.lastSql` / `ctx.lastParams`), the
`import { assertType, type Exact } from '…/lib/assertType.js'` seam, the
`describe(ctx.label, …)` skeleton — read [`WRITING_TESTS.md`](./WRITING_TESTS.md)
plus **one** real reference test (any `select.value-source.*.test.ts` in the
reference cell) before judging coverage. "Covered" means *that* assertion shape
pins the distinction — not merely that the symbol appears in a file. The
discovery agents are told to do the same (§6).

## The degeneracy bar

This is the rule the whole method turns on, and the one most easily gotten
wrong. **It was deliberately narrowed mid-effort** — early passes were too
quick to dismiss, and a path one pass had called "borderline / not reachable"
later shipped a real bug fix. Carry the narrowed bar:

> **A path is DEGENERATE only when ALL of:** it is the **same overload** reached
> through a **shared dispatcher**, the only difference is a **kind-string**, the
> impl is **provably generic** over that kind, **and** a representative of that
> exact dispatcher is **already tested**. Even then — **LIST it** in §C with the
> justification, do not silently drop it.

> **A path is a GAP to TEST** when it is a **distinct reachable overload /
> interface / per-receiver method / arity / input-classification — *even when
> its output coincides* with a covered case.** Output-coincidence is **NOT**
> coverage. It is precisely where a type-vs-impl bug hides: the type advertises
> a capability, the impl on that specific path may not deliver it, and nothing
> asserts the difference. **When in doubt → MISSING, not degenerate. Prefer
> erring by excess.**

Worked distinctions:

- The same getter impl (`SqlOperation0ValueSource('_getMonth', …)`) on a plain
  vs a custom temporal type emits **distinct SQL** (`extract(month…)-1`) → two
  paths, both tested. *Not* degenerate.
- `shapedAs().set().onConflictOn(c).doUpdateDynamicSet()` produces a *distinct
  typed interface* with shape-renamed keys vs the non-shaped on-conflict set →
  a path, even though the happy-path SQL resembles the non-shaped one. (This is
  the one that hid the bug.) *Not* degenerate.
- `const(v,'int',adapter)` returns the same *type* as `const(v,'int')` but
  threads the adapter through a *distinct runtime branch* with an observable
  value transform → a path (a **value-distinction**, not a type-branch, but in
  scope by the same standard under which the column/fragment/executeFunction
  adapter layers are tested). *Not* degenerate.
- `column('x','uuid')` vs `column('x','int')` routed through one generic
  `DBColumnImpl` dispatcher, leaf type already proven for several kinds, only
  the kind-string differs → **degenerate** (list in §C / §B-if-needs-fixture),
  but still worth a fixture under "every variant" — lowest priority.

The test that settles a borderline call: *would a regression that breaks only
this path leave every covered test green?* If yes, it is a distinct path worth
a test. If a regression cannot break it without also breaking the tested
representative (shared dispatcher, generic impl), it is degenerate.

**Four classes the discovery agents (and the coordinator) systematically MIS-FILE as
degenerate — they are DISTINCT type-paths; promote them to Tier-3 §A, don't drop them.**
A generic *impl* does not make a path degenerate when the
*declared type* or the *emitted SQL* differs — apply the settling test above before closing a
surface "saturated":
1. **Receiver-optionality variants.** A method on an `'optional'` receiver threads a different
   `OPTIONAL_TYPE` → a distinct return-branch (`T | undefined` vs `T`), explicitly a type-path in
   §2. `customLocalTime.asOptional().getHours()` is NOT covered by the required-receiver getter,
   even though the SQL coincides — a recurring deferral; promote it.
2. **Per-receiver-redeclared Nullable-family methods.** `valueWhenNull`/`nullIfValue`/`asOptional`/…
   are redeclared on each leaf to re-thread the leaf's return type; a generic *impl* + a tested
   *sibling method on the same leaf* does NOT cover `valueWhenNull × LocalDate` when only
   `nullIfValue × LocalDate` is tested — different declared return type + different value.
3. **Distinct emitted SQL with no type distinction.** The COVERED bar counts *emitted SQL + params*
   in its own right — a per-operand emission branch that no snapshot pins is uncovered even if the
   result *type* is identical. `intCol.modulo(2.5)` → `mod((col)::numeric,($1)::numeric)` vs
   `intCol.modulo(2)` → `col % $1`: this is the int-receiver sibling of the
   historical `double % x` emission bug. "Emission-only, no type distinction" is NOT a reason to
   file OUT — it is a reason to write an *emission-snapshot* test.
4. **Adapter column fed into a method it isn't yet tested with (Theme 9).** An adapter column tested
   only via `.equals`/one transform leaves its other value-source methods (each propagating the
   adapter to operand and/or result leaf) unrealized — `reviewerCode.toUpperCase()/trim()/reverse()/
   substring()/concat()` beyond the tested `.toLowerCase()`/`.startsWith()`.
The genuine OUT line stays firm: a distinction observable ONLY via `assertType` with byte-identical
SQL **and** value (branded-leaf locks on optionality modifiers; a phantom SOURCE union) is compile-only
→ negative-type territory, OUT. The discriminator is: *does the type, the emitted SQL, or a realized
value differ?* If any does → distinct path (Tier-3 §A at worst). Only "none differ, type-only" is OUT.

**Degenerate-by-non-validatability.** A type-path is also degenerate if it
cannot be turned into a [`DESIGN.md`](./DESIGN.md) Principle-#1 test — a real
`ctx.conn` query asserting SQL + params + result type + value, validatable
against a real DB. A "gap" reachable only through `as any`, an impossible
builder state, or a pure compile-time type with no runtime/value surface is not
a missing test; it is at most a negative-type test (OUT of scope, §5). Targeting
the *typed surface* does not license type-only assertions floating free of a
real query: if no real-validatable public-API test exists for the distinction,
close the item rather than manufacture a synthetic one. *Worked example:*
`const(v,'int',adapter)` is **IN** scope — a real
`selectOneColumn(conn.const(1,'int',bracketAdapter))` asserts the adapter's
observable value transform end to end. A "prove `add()` keeps the brand while
`sign()` erases it" lock with no runtime/value surface is **OUT** — it can only
be a compile-time `@ts-expect-error` (a negative-type test, §5), not a
Principle-#1 test.

## Scope

| Bucket | Rule |
|---|---|
| **§A — in scope, primary** | Closeable with an **existing matrix cell + existing fixtures** (`domain/connection.ts` already exposes the column/helper). |
| **§B — in scope, deferred** | Closeable on an existing cell but needs a **fixture addition** (a column / table / helper / sequence on the shared domain, or a new test file over existing columns). Enumerate exhaustively; say exactly what to add. The shared `domain/connection.ts` propagates to all cells. |
| **OUT** | A **new matrix cell** (db × version × connector); **negative type tests** (`@ts-expect-error`, `types.negative/`); **`src/queryRunners/`** (driver layer, exercised by docker/coverage not types); **error reasons reachable only via `as any` / impossible state**; pure runtime diffs with **no** type/value distinction. |

The `§B` boundary is a judgement the user sets per round. The firm line is
*no new matrix cells* (those are separate scheduled rounds — see
[`NEW_DATABASE.md`](./NEW_DATABASE.md)). Whether to act on `§B` fixture
additions is the user's call; the audit's job is to surface them, clearly
separated, never to silently drop them as "out of target".

Reference cell `postgres/newest/pg/` (PostgreSQL is the superset dialect). The
matrix is **symmetric**: a gap in the reference cell is a gap everywhere, so
the audit reasons about the reference cell and the generation step propagates.
A *cell* is `test/db/<db>/<version>/<connector>` (enumerate them with
`npm run tests -- --list-cells`); the symmetry rule (see [`DESIGN.md`](./DESIGN.md))
keeps the same file and test names in every cell, which is why reference-cell
reasoning carries to the whole matrix and why a §B fixture added to the shared
`domain/connection.ts` reaches every cell at once.

## Wave 1 — discovery agents

Fan out ~16 general-purpose agents (one per surface), **up to 10 running
concurrently** (see Launch mechanics). Each is an exhaustive enumerator of its
slice.

### Launch mechanics (how to actually fan out)

Spawn each surface as its own sub-agent with the harness's **Agent** tool
(`subagent_type: general-purpose`). Emit several Agent calls per assistant message
so they run concurrently — one message, multiple tool-uses. Each
agent's **final message is returned to you as that tool's result**; the agents
*cannot* reliably write files (see the gotchas), so that inline final message
*is* the deliverable you aggregate in §7. You are notified as each completes —
collect them as they land; do not block. If an agent comes back confused, empty,
or mid-task, **continue it in place with the SendMessage tool** (correct it:
"report inline, no files, resolve exactly X") to recover its in-progress work
rather than starting over. `run_in_background` is optional; the default is fine.

**Keep no more than 10 agents in flight at once — do NOT launch all ~16
simultaneously.** Launching the full fan-out at once has *repeatedly* tripped a
**server-side rate limit** (the "Server is temporarily limiting requests — not
your usage limit" error), which kills agents mid-run with no report (you'll see a
tiny tool_uses count and an API-error result instead of a §A/§B/§C report). Open
with a wave of up to ~10 (lead with the largest/most-bug-prone surfaces — the
parity sweep, EQCMP, CONN, INSERT), then top up as each drains so the in-flight
count stays **≤ 10**. **A surface killed by the rate limit produced no findings —
re-dispatch it** (a fresh Agent call with the same prompt is simplest; solo or in
a small batch). Track which surfaces have a *real* report vs. which were
rate-limited so none is silently dropped.
*(These are this harness's agent-orchestration primitives. On a different
harness, use its equivalent spawn / message / collect tools — the discipline is
identical: one parallel fan-out, inline results, in-place correction.)*

### Discovery is RAW READING of `src/` types — never coverage, never the searcher

The discovery signal is *what the type declares*, read directly from
`src/`. **Do not** use the coverage report, `tests:where-is`, or any semantic
index *to discover* paths — they describe what the tests already do, which is
the wrong direction and biases you toward what exists. You **may** grep the
`test/` tree to *check* whether an enumerated path is covered, and the
coordinator (§7) uses the searcher/compile-repro for reachability. Discovery =
read the types; coverage-check = grep the tests.

### The surface decomposition (≈16 surfaces)

Split fine enough that each agent's matrix is tractable. The value-source leaf
surface is the biggest fan-out and is split several ways:

| Agent | Surface (src) |
|---|---|
| F1-NUM | `NumberValueSource` + `BigintValueSource` (values.ts; ValueSourceImpl.ts) |
| F1-CUSTOMNUM | `CustomIntValueSource` + `CustomDoubleValueSource` (+ brand keep/erase) |
| F1-STR | `StringValueSource` |
| F1-BOOLIF | `Boolean` / `IfValueSource` / `AlwaysIfValueSource` + the `*IfValue` family |
| F1-TEMP | `Local{Date,Time,DateTime}` + custom-temporal getters + null-modifiers |
| F1-EQCMP | the shared `Equalable`/`Comparable`/`Nullable` base methods × **every** concrete leaf type (the cross-product) |
| F2-COL | column factories × kind × required/optional × adapter (`Table.ts`, `View.ts`) |
| F2-VALVIEW | `Values` (inline VALUES) + View-source per-kind dispatch |
| F3-SELECT | the SELECT builder fluent surface (overloads, execute-shapes, **compound interface's own overload set**, subquery/inline uses) |
| F3-PROJ | `complexProjections/` — **both** projectors, every rule × plain/element × leaf-configuration |
| F4-INSERT | `insert.ts` — set-variants, **the shaped surface**, the on-conflict matrix, returning, execute-shapes |
| F4-UPDDEL | `update.ts` + `delete.ts` — incl. **the shaped UPDATE set surface**, guards, `*When`, allowing-no-where |
| F5-CONN | Connection API — **declared in `connections/AbstractConnection.ts` + `AbstractAdvancedConnection.ts`** (`src/Connection.ts` is a thin re-export, not the impl): `const`/`optionalConst`/`fragmentWithType`/`aggregateFragmentWithType`/`buildFragmentWith*`/`arg`/`valueArg`/`sequence`/`executeFunction`/`executeProcedure`/transaction/`createTableOrViewCustomization`/aggregates, **each × kind × arity × {with adapter, without}** |
| F6-DYN | dynamic — every operator × type × {descriptor `FilterTypeOf`, VSM `MapValueSourceToFilter`} × {base, IfValue}; pick/orderBy/from-model/extension |
| F7-EXTRAS | `extras/*` utility types (+ each `*ShapedAs` / `*ProjectedAsNullable`), `TypeAdapter`, `TsSqlError` builder-reachable reasons, dialect config flags |
| F8-META | composition / seam critic — overload-sets with one arm tested, **feature×feature chains tested only alone** (the bug class), input-classification boundaries, `src/index.ts` barrel reachability. **Seed it to REASON ABOUT THE EMITTED SQL / runtime of each composition** (a cross-cutting feature — `customizeQuery`, `allowWhen`, `projectingOptionalValuesAsNullable`, `forUseAsInline*Value`, an adapter column — composed onto a SPECIAL builder — recursive / compound / shaped / on-conflict / with-values / CTE) and flag any composition whose fragment/clause is **dropped, misplaced, or throws** as a **CANDIDATE DEFECT** for the coordinator's runtime probe (§7.4). This is the highest-yield bug vein once the per-surface matrices saturate. |

Adjust the split to the surface as it evolves; keep F1-EQCMP and F5-CONN as
their own agents (they are the largest matrices) and always keep an F8-style
seam critic (it catches what per-surface agents miss at the boundaries) — split
it into a **mutation seam critic** and a **select/CTE/compound/recursive/projection
seam critic** once the per-surface matrices saturate, since the feature×builder grid
is too big for one agent. Split a surface whenever its method × kind × optionality
matrix is too big for one agent to enumerate in a single pass (EQCMP and CONN
already are).

**Two extra agents earn their slot in the mature phase**, beyond the standard ~16:
(a) an agent pointed at whatever **src type surface changed since the last round**
(§0.5 step 5) — seeded to audit the *positive* side of the new/narrowed overload; and
(b) a **type-level-result-relationships** agent (call it F9-TYPEVAR) that hunts
distinctions in the RESULT TYPE / VALUE of a real `ctx.conn` query that are unasserted
or only `Extends`-locked where `Exact` is possible — the optionality algebra
(`MergeOptional`: opt×opt, req×opt, left-join-through-operator), the brand keep/erase
algebra, and the scalar-result edges (`T | null` whose null inhabitant is never realized
in a value-present position). Enforce degeneracy-by-non-validatability hard on it: a pure
compile-time relationship with no runtime/value surface is a negative-type test (OUT), not
a finding.

**Pruning the fan-out as surfaces saturate — a per-surface enumerator may be dropped once it
returns 0 unique §A, gated on its owning `src` being unchanged.** As rounds mature, most
per-surface *leaf* enumerators (the Connection API, boolean/if-value, the equality/comparison
base grid, column factories + Values/View, the dynamic base, custom-numeric brand keep/erase,
the SELECT builder fluent surface) reach true saturation and keep returning 0. The user may
scope a round to **skip** these — do not re-run a saturated enumerator every round out of habit.
**But the drop is valid only against the `src` the surface was audited against.** Gate each
excluded surface on its owning `src` path in the `§0.5` pre-flight `git log`: a commit touching
that path (e.g. `src/connections/*` for the Connection API, `src/Table.ts`/`View.ts`/`Values.ts`
for column factories, `src/dynamic/*` for dynamic, the leaf interfaces in `values.ts` for a
value-source family) **re-arms** the surface as that round's highest-value target (the
just-changed-type-surface rule, §0.5 step 5). Record the exclude list + each surface's `src`
trigger in the round's report so the next round's pre-flight can honour it mechanically.
**Never drop the permanent agents**: the parity sweep, the two seam critics (mutation +
select/CTE), F9-TYPEVAR, and the recently-changed-src agent stay in *every* round even when
they return 0 defects — in the mature phase the marginal bug lives at the seams and the freshly
-changed src, so those are the top targets by design (they still corroborate the round's clusters
even with nothing of their own to file). Total coverage is reached when the KEEP list is
implemented and a round re-verifies it saturated with no new src — at which point the fan-out
collapses to just the permanent agents + whatever src changed.

**The table is the address, not the brief.** A one-line surface name *routes* an
agent; it does not make it thorough. Before launching, **the coordinator opens
each surface's named src** and seeds the agent with a specific instruction —
"enumerate THESE method families / against THESE fixture columns from
`domain/connection.ts` / and re-check THIS historical theme (§9)". That
per-surface depth is what separates a sharp round from a shallow one; a generic
"audit StringValueSource" prompt yields a generic result. Watch for **thin entry
files** that re-export their impl elsewhere (`src/Connection.ts` →
`connections/AbstractConnection.ts`, etc.) — point the agent at the impl, never
the re-export.

### The agent prompt template

Each agent gets the shared preamble below + its surface line. Tune the
maximalism (a routine round wants "report genuine gaps"; a "be exhaustive,
prefer excess" round wants every per-kind variant listed).

```
You are discovery agent <ID> in ROUND <N> — a missing-tests audit of
ts-sql-query (type-safe SQL query builder for TS). Repo: <root>.

GOAL: find tests the TYPE DEFINITIONS imply but the suite lacks. UNIT = the
"type-path" (each overload / per-receiver method / union member / arity / kind
/ return-branch / input-classification). COVERED ⇔ a test asserts that exact
path via emitted SQL+params and/or assertType<Exact> and/or (when a value is
promised: |null, |undefined, absent-key-with-'k' in obj, branded round-trip)
the VALUE via toEqual/toBe. NOT covered: void X / <any,any> / signature snapshot.

DEGENERACY BAR (narrow): degenerate ONLY if same overload through a shared
dispatcher, kind-string-only difference, provably-generic impl, representative
already tested — and even then LIST it, don't drop it. A distinct reachable
overload/interface/per-receiver-method/arity/input-classification is a path to
TEST even when its output coincides with a covered case (output-coincidence is
where type-vs-impl bugs hide). WHEN IN DOUBT → MISSING.

DISCOVERY = RAW READING of src/ types ONLY (no coverage, no semantic index for
discovery; you MAY grep test/ to CHECK coverage). Build an EXHAUSTIVE
ENUMERATION MATRIX of your surface and verify each cell against the CURRENT
test files. Before judging COVERED vs MISSING, read ONE real test in the
reference cell (e.g. a select.value-source.*.test.ts) to learn the
ctx/assertType assertion shape — "covered" means that shape pins the
distinction, not merely that the symbol appears.

SCOPE: §A = closeable with existing cells + existing fixtures
(test/db/postgres/domain/connection.ts). §B = closeable on existing cells but
needs a fixture addition (enumerate + say what to add). OUT = new matrix cell;
negatives/types.negative; src/queryRunners/; as-any/impossible-state reasons;
pure runtime diffs with no type/value distinction.

REFERENCE CELL test/db/postgres/newest/pg/ (matrix SYMMETRIC). Pair dynamic
paths with their direct equivalent. date/time under TZ=UTC.

AVOID FALSE "ABSENT": assertions live OUTSIDE the obvious file — wide-grep ALL
of test/db (`grep -rn <token> test/db`, incl. customize-query.*, docs.*,
execute-variants, documentation/doc-code.generated, and non-postgres cells)
before claiming a path uncovered. BUT a tested representative does NOT cover a
DISTINCT overload/interface/arity variant.

CONSTRAINTS: READ-ONLY. Do NOT write any file (scratchpad writes may be
blocked). Do NOT spawn sub-agents. Report EVERYTHING INLINE in your final
message, sectioned §A / §B / §C(degenerate-listed) + COUNTS + a one-line verdict.

YOUR SURFACE: <surface-specific instructions>
```

### Wave-1 operational gotchas (each has bitten a prior round)

- **Report INLINE; never depend on a written file.** Sub-agent scratchpad
  writes have been permission-blocked mid-session. Agents that wrote
  intermediate files stalled. The coordinator's own Write (to the report)
  works; the agents' do not — tell them so explicitly.
- **Background agents die if the process restarts**, but survive while the
  session stays open. If an agent returns confused / empty / mid-task, **relaunch
  it via SendMessage** with the correction ("report inline, no files, resolve
  exactly X") to recover its in-progress work rather than starting fresh.
- **Prohibit sub-delegation.** An agent that spawns its own sub-agents loops and
  never consolidates (this happened to the insert agent once). Each agent does
  its own reading and grepping.
- **WIDE-grep before declaring ABSENT.** The single most common false positive:
  a sub-agent greps the obvious file, misses the assertion living in
  `customize-query.*`, `docs.*`, `execute-variants`, `doc-code.generated`, or a
  non-postgres cell, and reports a covered path as missing. Conversely, **a
  tested representative does not cover a distinct overload/arity** — both
  directions are errors.

## Aggregate + coordinator verification

Collect the inline reports, dedupe across agents, then — **before anything goes
in the report** — verify the load-bearing claims **yourself**. Flaky agents
over-report (false ABSENT) and mis-classify (degenerate vs distinct, which rule
fires). The coordinator is the adjudicator.

**Always coordinator-verify:**

1. **Cross-agent contradictions.** When two agents disagree, settle it by
   direct inspection — never average them. (In one case a projector agent
   flagged a rule-2 twin as missing while the SELECT agent said covered; a direct
   read settled it covered. In another, an equality agent claimed ~150 direct
   gaps while the dynamic agent reported its surface saturated — a targeted
   grep showed *both* right, scoped: the **dynamic** path covers every
   operator×type, the **direct** fluent path is sparse on non-int/non-string
   leaves.)
2. **Reachability / exact-inferred-type questions** → **tsgo compile-repro**.
   The recipe:
   - Write a small type-only `*.ts` (not `*.test.ts`) into the reference cell,
     importing the domain `DBConnection` (`declare const conn: DBConnection`)
     and the fixtures.
   - Write the candidate chain and pin the hypothesised type with
     `assertType<Exact<typeof x, …>>()`; to disambiguate which of two rules /
     overloads fires, write *both* hypotheses as separate `assertType` lines and
     see which errors.
   - `npm run validate:tests:newest 2>&1 | grep <reprofile>` — no error means the
     chain typechecks and the asserted type holds; an error reveals the actual.
     (`validate:tests:newest` runs **tsgo** in a single program over just the newest cells —
     ~6 GB/fast, and your repro lives in a `newest` cell; the full `validate:tests` splits
     one tsgo program per connector because a single whole-matrix program OOMs, >17 GB. Full
     command/flag vocabulary — `tests <coord>`, the runner flags — is in [`CLI.md`](./CLI.md).)
   - **Delete the repro and confirm `git status --porcelain` is clean.** (This
     recipe once proved `shapedAs().set().onConflictOn(c).doUpdateDynamicSet()`
     reachable on PG, overturning a prior "not reachable" verdict.)
   - **A proven type DIVERGENCE is not a proven DEFECT.** A compile-repro that shows
     two chains have different types answers *"do they differ?"*, never *"is the
     difference wrong?"*. Before filing, establish the **correctness obligation** that
     the divergence violates — and be sure it is real, not assumed. The trap that
     produced a false positive: *"`xWhen(true) ≡ x` at runtime ⟹ their types must
     coincide"* is invalid, because a `*When` type must be sound across **both** branches
     (`when === false` too), so a conditional method may legitimately diverge from its
     unconditional sibling. Two guards: **(a)** if the alleged bug is "limited to two
     functions" while a whole family shares the pattern benignly, suspect a false
     positive; **(b)** test the *inverse* — apply the proposed fix in a scratch repro and
     check it doesn't make an **unsound** program compile (e.g. `executeInsert()` on an
     insert missing a required column). See §9 "False positives … the oracle that refutes
     them" for the worked case (`disallowIfNoValueWhen`).
3. **Absence at scale.** For any "this whole class is untested" claim, run the
   wide-grep yourself (`grep -rhoE "<col>\.(equals|notEquals|…)" test/db | sort
   | uniq -c`) rather than trusting the count — **and capture the OPERAND, not
   just the method** (`grep -rhoE "<col>\.<method>\([^)]*\)"`). Recurring
   over-report (round 25, EQCMP): a "value-source-operand twin (`col.method(otherCol)`)
   is missing for the custom leaves" claim collapsed once the operands were read —
   `costCents`/`version`/`signingKey` already feed the value-source-operand overload
   via **subquery** operands (`costCents.greaterThan(loSub)`, `version.in(verOfRelease1)`).
   `col.method(anotherColumn)` and `col.method(scalarSubquery)` are the **same**
   `method(IValueSource)` overload → col-vs-col is DEGENERATE where a subquery operand is
   already tested; it is not a distinct type-path. Only a leaf whose receiver-redeclaration
   is exercised by *neither* a const *nor any* value-source operand is a real gap.
4. **Runtime emission / throw probe** → for a candidate **DEFECT** that is *not* a
   type question — a composition that emits **wrong / dropped / misplaced SQL** or
   **throws at build** — compile-repro can't see it (the types *accept* it; the bug
   is in what the impl emits or does). Confirm it by *running* the composition on
   the mock:
   - Write a small `*.test.ts` into the reference cell mirroring a real test's
     skeleton (`import { ctx } from './setup.js'`, `describe(ctx.label, …)`,
     `beforeEach(() => ctx.reset())`); build the candidate chain on `ctx.conn`,
     `ctx.mockNext([...])`, `await …execute*()`, then `console.log(ctx.lastSql)`
     (emission diff) **or** wrap in `try/catch` and log `e.message` /
     `e.errorReason?.reason` (throw).
   - `npm run tests -- 'postgres/newest/pg/<probe>.test.ts' --no-color` and read the
     logged SQL / throw. **Always include the WORKING sibling as a control in the
     same probe** (the non-recursive / non-shaped / plain form): the bug is proven by
     the *diff* between the composed cell and its working twin, not by the composed
     cell alone.
   - **Delete the probe and confirm `git status --porcelain` is clean.**
   This tool confirmed the last two composition bugs — `customizeQuery` hooks
   silently dropped on a recursive-union SELECT (emission diff vs the working
   `forUseInQueryAs` CTE) and `selectOneColumn(...).recursiveUnion*(...).forUseAsInlineQueryValue()`
   throwing `INTERNAL` (throw vs the working non-recursive control). It is the
   **primary verifier for the composition/twin-seam bug class** (§9 themes 8/10):
   whenever the seam critic or parity sweep flags a CANDIDATE DEFECT whose symptom is
   emitted SQL or a runtime throw (not a type error), *probe it, don't reason about
   it* — a plausible-looking emission claim is often subtly wrong until the mock
   prints the actual string.
   - **A proven DROP / MISPLACEMENT is not a proven DEFECT** (the emission analogue of
     compile-repro's "divergence ≠ defect"). The probe answers *"does the emission
     differ?"*, never *"is the difference wrong?"*. A dropped fragment is a bug **only if
     the clause it customizes still exists in the composed output**; if the composition
     removes/replaces that clause (an outer projection replaced when a select becomes a CTE;
     a compound with no SELECT to host a projection hook), the drop is a **legitimate
     NOT-APPLICABLE boundary**, whose artifact is a *passing boundary test*, not a `BUGS.md`
     entry. Establish the render site survives before filing — see §9 "False positives &
     misclassified boundaries" for the worked case (`customizeQuery` non-bracketing hooks on
     `recursive × forUseInQueryAs`).
   - **Real-DB / `--docker` extension — for a claim about what the ENGINE does, not what the
     builder emits.** The mock probe proves the emitted SQL / the build-time throw but is BLIND to
     engine runtime behavior: whether the query MATCHES the right rows, whether a value ROUND-TRIPS,
     whether the engine REJECTS the SQL (an escape that never matches, a placeholder the engine
     rejects, a per-driver marshalling). A snapshot proves the emitted *token*, never that the
     query *behaves* correctly — those surface only on a real DB. Confirm with a `--docker` probe:
     - `npm run tests -- --docker <db>/<version>/<connector> --test-name-pattern <name>` —
       **`--docker` does NOT accept a 4th-level `<file>` coord**; give it the CELL coord plus a
       `--test-name-pattern` that selects your probe test.
     - Vitest **swallows `console.log`/`console.error`** under the runner, so a logged value never
       prints. Make the test **ASSERT a sentinel** — `expect({ sql: ctx.lastSql, matched:
       rows.map(r => r.x) }).toEqual('SENTINEL')` — so the ACTUAL SQL / params / result land in the
       failure diff. Under `--docker` the real DB runs (`mockNext` is ignored), so the diff is
       genuine engine behavior.
     - **Isolate the signal with a control that pins the setup** — insert the row, then a
       wildcard-free / trivially-true query that MUST match it, proving it persisted, before
       trusting a "matched nothing" result (a bare `matched: []` is ambiguous — a real bug, or the
       insert never landed — until the control proves persistence).
     - Delete the probe; `git status --porcelain` clean. The flaky/slow docker cells (mssql,
       oracle) are worth it for a filed defect, and any custom-type / per-kind emission claim (§9
       branded-twin) needs this real-DB pass — the mock hides what the engine rejects.

5. **Adversarially re-check the confident §C / "saturated" DROPS — not only the §A claims.**
   The agents' systematic error is not just false-ABSENT (over-reporting §A); it is **over-filing
   degenerate** — a distinct path labelled "degenerate / saturated" and dropped, which silently
   thins the round and is invisible in the report (a §C list *reads* as thoroughness). Verifying
   only the positive claims (items 1–4) rubber-stamps that error. So sample the confident
   degenerate/saturated verdicts and run the §4 settling test on each: *does the declared type, the
   emitted SQL, or a realized value differ from the tested representative?* If any does, it is a
   distinct path — promote it to Tier-3 §A. §4 names the four classes agents most often mis-drop
   (receiver-optionality; per-leaf-redeclared Nullable methods; distinct-emission-same-type;
   adapter-into-a-not-yet-tested method). The tell: a surface that returns "saturated" with a
   **long** §C list is where to spend a probe — a genuinely saturated surface has a *short* §C; a
   mis-filed one buries real Tier-3 tests in a long one. This is the discipline that keeps a mature
   round from closing thinner than the surface warrants.

**Resolve every self-hedged verdict to a firm one — a hedge is not report-ready.**
A candidate the discovery agent (or you) labels *"low confidence / may be §A on
closer look / possibly reachable / narrow — flag but don't prioritize"* is an
**unresolved** verdict, not a finding. Close it **this session** to a firm §A (with
the exact test to write) or §C/refuted (with the covering test named), by the same
tools every other borderline claim uses — a compile-repro for the type, a wide-grep
for absence. Do **not** ship the hedge to the report for the implementer to
re-investigate: that just relocates the unfinished work, and the "on closer look" is
*your* job. Two recurring traps when resolving one: **(a)** the path is already
exercised in a **`docs.advanced.*` / `docs.*` utility file** (pick/dynamic-from-model/
utility-type/order-by-from-model paths especially live there, not in the obvious
`select.*`/`dynamic-condition.*` file) — grep those explicitly before calling it a
gap; **(b)** the *premise* of the demotion/flip the hedge rests on may not actually
manifest — e.g. a transform that **uniformly** rewrites its input (a pick that makes
*every* leaf optional) has no "before" variant to change *from*, so the hypothesised
rule-change is not an observable path. Construct the compile-repro, compare its type
against the existing coverage, and if they coincide the item is §C — say so, don't
hedge.

A finding that survives verification is real. A finding refuted moves to the
report's "refuted" list with the evidence — never silently dropped (so the next
round doesn't re-chase it).

## The report

Write `test/MISSING_TESTS_AUDIT_<N>.md`. **The report is an EXHAUSTIVE,
ITEM-BY-ITEM IMPLEMENTATION BACKLOG — not a thematic summary.** The single failure
mode this section exists to prevent: **collapsing findings into semantic clusters**
("~8 sibling-operator cells", "the per-kind sequence fan-out", "the receiver-optionality
variants") so the report *reads* tidy while the individual tests — the actual work —
stay implicit. That is the wrong direction: it makes the audit harder than the
implementation, and it guarantees the next round re-discovers the un-enumerated tail
as "new" findings (the exact churn the effort is trying to end). So **enumerate every
single test as its own discrete line item** with a stable ID, its fixture, its exact
assertion, and the grep proving absence. The **tier is a risk/priority label on each
item, never a device that replaces enumerating the items under it** — "Tier 3: sibling
operators (8 cells)" is a *failure*; write the 8 items. Deliberate target: the
implementer's work-list is *longer* than the audit was, and implementing all of it
drives the surface to true saturation so future rounds surface only genuinely-new
`src/` changes, not residual completeness. A long report is the correct shape — prefer
excess by default; **never write "N variants" where you can name the N.**

Structure that has worked:

- **Header** — the mandate, the method, the headline counts.
- **Confirmed bugs + candidates** — each `src/` defect (→ `BUGS.md`), each candidate
  with BOTH readings.
- **The enumerated backlog** — every test as its own item `<SURFACE-PREFIX>-<n> · T<tier>`,
  grouped by **SURFACE** (so the implementer lands on the fixture file), NOT by theme.
  Each item spells out: what to write · the fixture · the exact assertion · the grep
  proving absence. Tiers are the risk/priority label carried by each item:
  - **T1** — distinct code-path / runtime-branch / the bug class (output-coincidence
    masks real risk: shaped builders, adapter-dispatch fan-out, projection-classification
    boundaries, compound-interface overloads, custom-temporal getters, brand-keep
    boundaries, masked-emission branches). Highest value, usually cheapest.
  - **T2** — distinct overloads / per-type emission / seam compositions; shared
    dispatcher but observably distinct.
  - **T3** — genuine per-variant completeness (often §B, needs a fixture).
  - **T4** — output-coincident completeness fan-out (same dispatcher, byte-identical
    emission but a distinct reachable overload/kind/arity/leaf). LOWEST priority but
    **ENUMERATED one line per variant** (`notInN` on bigint, on double, on customInt, …
    — *not* "notInN on 10 leaves"): this is precisely the tail a themed report hides
    and the next round re-finds, so name each one. A distinction reaches OUT (below)
    only when it has ZERO runtime/SQL/value surface (pure compile-only) — never a silent
    omission.
- **OUT list** — the genuinely-unwritable items EACH named with its reason (compile-only /
  `src/queryRunners/` / new matrix cell / non-existent API), so they are not re-chased.
- **Per-surface table** — §A/§B/enumerated-item count per agent + which surfaces are
  **saturated**. "Saturated" means no item with a runtime surface remains — a surface
  that still has a Tier-4 tail is NOT saturated, it has a *listed* tail.
- **Coordinator verification notes** — what you checked yourself and how it resolved.
- **§B fixture-addition plan** — concrete columns/helpers/files to add.
- **Recommended implementation order** — bugs → T1 → T2 → T3 → the T4 churn.
- **Verdict** — honest; if a source bug surfaced it goes here *and* to `BUGS.md`
  (never fixed here).

Findings should be self-contained and verifiable: each lists the type-path, why
it is distinct, the exact `src` location, where to test, and the wide-grep (or
compile-repro) proving absence/reachability. A **§C (degenerate)** entry names
the path + the shared dispatcher + the tested representative (e.g.
"`column('x','uuid')` — same `DBColumnImpl` dispatcher as the covered
`int`/`string`/`bigint` kinds, kind-string only"). A **refuted** entry names the
claim + the evidence that killed it (e.g. "bigint `equals` direct — REFUTED,
covered at `select.value-source.custom-numeric.test.ts:NN`"), so the next round
doesn't re-chase it.

## Recurring themes

**Where the bugs hide.** Across rounds, the genuine gaps cluster into a stable
set of patterns. Hunt
these first; they are where output-coincidence most often masks a real defect:

1. **Value-source-operand twin + optional-receiver branch.** Binary value-source
   methods tested with a `const` operand but never a value-source operand; and
   the whole method surface tested on a `'required'` receiver but never an
   `'optional'` one (a fixture column may exist but be fed into *zero* methods).
2. **Shaped builders.** `shapedAs(...)` reaches a parallel, re-typed interface
   (shape-renamed keys) for INSERT and UPDATE set/on-conflict — easy to leave
   tested on a single route. **This is the canonical bug class** (see the §9
   fingerprints).
3. **Trailing-`adapter?` fan-out.** The optional trailing `TypeAdapter` overload
   on `const`/`optionalConst`/`fragmentWithType`/`aggregateFragmentWithType`/
   `executeFunction`/`sequence`/`arg`/`valueArg` — tested for one kind, and some
   route through a distinct runtime branch (the `adapter2` slot).
4. **Direct vs dynamic per-type asymmetry.** The *dynamic*-condition surface is
   exhaustively per-type; the *direct* fluent equality/comparison surface
   (`equals`/`is`/`between`/`in(subquery)`/…) is often validated only on
   int + string.
5. **Projection input-classification boundaries.** Which projector rule fires
   for a mixed leaf-set (own-required + left-join-`originallyRequired`) — a path
   even when the output shape coincides with a covered rule.
6. **Compound-interface overload subsets.** A distinct interface
   (`CompoundedOrderByExecutableSelectExpression`) declares its own overload set;
   only one arm is exercised on the compound path.
7. **Custom-temporal / per-kind getters & casts** that emit distinct SQL per
   kind (so distinct, not degenerate).
8. **Feature×feature compositions tested only alone** (`shaped × customizeQuery`,
   `shaped × returning`, brand-keep through `forUseAsInlineQueryValue`). The
   seam, not the feature, is the gap.
9. **Adapter-bearing / custom-typed column fed into *any* non-`equals` method**
   (the "operand outside WHERE / non-`equals` method" theme). An
   adapter column (`scaledTenth` ×10, `bracket`, the custom-booleans) is almost always
   tested only via `.equals` / bare projection — never fed into the *other* methods of
   its value-source type, even though the adapter provably propagates to the bound
   operand (`_appendValue` threads the column `typeAdapter`) **and** to a transform's
   result leaf (which inherits `transformValueFromDB`). Two facets, both value-observable
   and mock-blind (`--docker` PG/mssql/oracle):
   - **other operand POSITIONS:** a JOIN `.on()` predicate, a correlated-subquery
     `WHERE`, a `.having()` (vs the covered top-level `WHERE`).
   - **other METHODS on the adapter column:** numeric ops (`score.add(5)` → operand
     ×10 *and* result ÷10), string transforms (`reviewerCode.toUpperCase()` → result
     re-brackets), `*IfValue` on a custom-boolean receiver (`published.equalsIfValue` —
     remap ∩ elision), and boolean combinators on a custom-boolean receiver
     (`published.negate()` → `not (published = 't')`). Also the factory side: the
     trailing-`TypeAdapter` overload on factories where only the no-adapter form is
     fixtured, and the **View per-column adapter read-path** (a separate code path from
     Table — View returns the bare `DBColumnImpl`). Same fingerprint as themes 1/2/3.
10. **Structural twin-interface parity** — the technique that has proved a shaped
    bug *bigger* than its first report. For every family of "twin" interfaces —
    shaped vs non-shaped, optional vs required, executable vs not-executable,
    allowing-no-where vs normal, multiple vs single, from-select vs normal, compound vs
    non-compound — diff the twin **method-by-method** against its sibling: a MISSING
    method family, a DUPLICATED block, a wrong generic arg (`SHAPE` vs `undefined`,
    required vs optional), a param-name typo, or a return type that silently drops a
    type parameter is either a **type-vs-impl bug** (one such defect:
    `ShapedInsertOnConflictSetsExpression` had a duplicated non-`When` block, a
    *missing* `*When` family, and an `olumns` typo — the wrong block pasted) or a
    missing-test path. Run this sweep on
    `insert.ts`/`update.ts`/`delete.ts`/`select.ts` first; it is cheap (reading
    types) and high-yield. Corollary coverage gap: once a twin is repaired, its newly-present
    family (e.g. the on-conflict `*When` octet) is typically still *unexercised at runtime* —
    exactly the copy-paste-prone surface where the next regression hides.

A surface that is *genuinely saturated* even under the narrow bar is a real and
reportable outcome — string value-source, boolean/if-value, dynamic-condition,
and extras/adapters/errors have historically come back 0/0. Say so plainly;
don't manufacture gaps to fill a quota. But **re-verify saturation every round**
against the current files — a "historically saturated" surface is a hint of
where to spend less time, never a licence to skip the enumeration.

**As the per-surface matrices saturate, the marginal bug moves to the SEAMS.** In
the mature phase (many single-surface agents returning 0/0), the round's headline
value is no longer per-kind fan-out — it is the **parity sweep (theme 10)** and the
**seam critic (theme 8)**, whose CANDIDATE DEFECTs, once **runtime-probed** (§7.4),
are the confirmed bugs. The evidence: the fingerprints below are increasingly
dominated by twin-asymmetry and cross-cutting-feature × special-builder defects that
no per-surface agent could see. So when most surfaces come back saturated, that is
**not** a signal to pad the round with degenerate per-kind gaps — it is the signal
to spend the round's depth on the two seam agents and to *probe* (not merely reason
about) every composition/twin they flag. A saturating round with two runtime-probed
seam bugs is a *better* round than one with fifty degenerate per-kind additions.

**The two top targets in the mature phase are the SEAMS and the recently-changed src
type surface (§0.5 pre-flight step 5).** Both are where the accepted-but-untested arm
hides; lead every mature round with the parity sweep, the two seam critics, and the
agents pointed at whatever src changed since the last round.

**A whole round can validly close with ZERO confirmed bugs — that is a success, not a
shortfall.** At high maturity the norm is: most surfaces come back 0/0, the seams surface
a handful of untested *compositions* (real §A tests), and — crucially — the seam critics
**clear their own suspected defects by tracing/probing rather than asserting**, so no false
bug reaches the coordinator. When that happens there is simply nothing to file to
`BUGS.md`, and the §A/§B tail (seam compositions + the freshly-changed surface's positive
arms) is the round's whole value. **Do NOT manufacture a bug to "produce" one, and do NOT
pad §A with degenerate per-kind gaps** — an honest "10 surfaces saturated, 0 bugs, N clean
§A composition tests" report is exactly what a mature round should look like. The method's
worth is proven by the fingerprints below across the effort's whole history, not by every single
round landing a defect. (See "False positives & misclassified boundaries" for the two ways
a forced bug goes wrong: a compile-divergence read as wrongness, and a probed drop read as a
defect when its clause was actually removed by the composition.)

### Fingerprints that have paid off — and the technique each rewards

This is not a catalogue of past commits (git holds those, and this document is not a
history of what was fixed); it is the set of **fingerprints** that keep yielding
defects and the **technique** that surfaces each — so a context-free agent applies
them instead of re-deriving them. The unifying observation: **every confirmed defect
lived on a path that *looked like the same implementation* as a covered one.** The
covered sibling executed fine, so the untested twin's wrong emission / dropped
fragment / mis-folded type / build-time throw stayed hidden — coverage was green
through every one. That is the case *for* the narrow bar (§4) and the maximalist
standard (header). The recurring fingerprints, each an instance of a theme, with the
technique that catches it:

- **Shaped continuation drops `SHAPE` from a param or return type** (theme 2). A
  `shapedAs(...)` builder re-types keys; a continuation — a `*When` set arm typing its
  `columns` param unshaped, an `extendShape` returning a node without the shaped opener,
  a chained `.set` after a static on-conflict node that returns the non-shaped type —
  is then unusable-as-typed (rejects the renamed key the runtime needs) or
  over-restrictive (rejects a chain the runtime accepts). *Technique:* diff
  shaped-vs-non-shaped param/return symmetry across the **whole** method family, not the
  happy-path `set`; compile-repro the renamed-key call against a positive control.
- **`*When` continuation re-derives a key-tracking type differently from its non-When
  sibling** (theme 2/10). A `keepOnlyWhen` that mis-folds `MISSING_KEYS` vs `keepOnly`
  makes an insert typed-executable while its required column is unset. *Technique:* diff
  the `When`/non-`When` return type arm by arm — but the deciding question is
  **soundness under `when === false`**, not delegation under `when === true` (the `*When`
  oracle below: a *monotonic* sibling must match, a *clearing* sibling must NOT).
- **Variadic overload SET with one arity's type-param wiring wrong** (theme 10). A
  5-arg `subSelect(Distinct)Using` that typed its 5th param as the 4th's type rejected
  five distinct correlated tables the variadic runtime accepts. *Technique:* treat a
  variadic overload set as a twin family — diff every arity's `tableN: TN`
  position-by-position; a value-level per-surface audit and arities 1–4 (correct) are
  blind to a single dropped/duplicated type parameter in one arm.
- **Overload-body optional-type COMPUTATION, not just param positions** (theme 10). A
  fragment-builder overload wrote its merged optional type inside a **non-distributive**
  helper, silently discarding an optional value-source arg's `'optional'` → a
  `'required'` (unsound) result. *Technique:* diff not only the `TN`/`AN` positions but
  the optional-type expression in each generated overload body; isolate each case in its
  own `@ts-expect-error` key-omission probe (multiple `assertType<Exact>` in one scope
  cascade and misattribute).
- **Per-type emission valid on the covered receiver, invalid on the sibling** (theme
  1/7). `modulo` on `double`/`customDouble` emits `float % x` (PostgreSQL rejects; `%` is
  integer/numeric only), where the suite exercised only int/bigint/customInt receivers.
  *Technique:* enumerate the emission per receiver-leaf, not per method, and dialect-check
  (SQLite/MySQL/MariaDB accept `float % x`, so a mock or a single dialect hides it).
- **A conditional emission branch EXECUTES on existing tests but its distinguishing output is
  masked because no test input carries the triggering feature** (the sharpest form of
  "output-coincidence"; theme 1). The method/receiver *is* covered, yet a branch inside its
  emission only fires its distinct string for a specific input the suite never supplies — an
  affix predicate's `_escapeLikeWildcard` string arm is a no-op unless the literal contains
  `%`/`_`/`\` (per-dialect `\%` vs `[%]`); a temporal getter's `isConstValue()` cast arm
  (`extract(part from $1::date)`) fires only on a **const** receiver, never a column; `_or`'s
  right-parenthesising arm (`A or (B and C)`) fires only when an `.or(...)` operand is itself an
  `.and(...)`. *Technique:* grep for the branch's **distinguishing output token** (the escaped
  `\%`/`[%]`, the `::date` inside `extract`, the `or (… and …)` shape), NOT the method name — a
  method-name grep reports it covered; then write the test that feeds the triggering input.
- **The BRANDED / custom-typeName twin DIVERGES from the plain twin at a typeName-keyed emission
  path — coverage-invisible, and usually a by-design LIMITATION, not a bug** (theme 1/7; the
  custom-type analogue of "valid on the covered receiver, invalid on the sibling"). When a
  `SqlBuilder`/connection path switches on a **type name** — a `transformPlaceholder` cast switch, a
  value-marshalling map, a per-type emission `case` — the plain names
  (`'localDate'`/`'localTime'`/`'localDateTime'`) are handled but the **custom twin** carries its
  **brand** typeName (`'ReleaseDay'`) that matches no case → it falls through to the default
  (e.g. `const(d,'customLocalDate','ReleaseDay').getMonth()` emits a **bare** `extract(month from
  $1)` where the plain leaf emits `$1::date` — PostgreSQL rejects the bare parameter). **Classify
  before filing:** in this codebase this landed on **by-design LIMITATION** — custom typeNames carry
  no built-in SQL type, so casting/marshalling a custom placeholder is the **USER's responsibility**
  (they write `transformPlaceholder` — and the value marshalling — in their own `DBConnection`). So
  do **not** file it as a `src/` bug; it is at most a **§B fixture gap** (a user-side
  `transformPlaceholder` the domain `DBConnection` doesn't model, unlike its `baseTypeForCustom`
  value marshalling). Only file a bug if the maintainer confirms the library is meant to derive it.
  *Technique:* whenever a path keys on a base type name, enumerate the **custom / branded kind of the
  same family** (customLocal* for temporal, `customInt`/`customDouble` for numeric, `custom`/`enum`
  for equality) and **`--docker`-probe the branded twin** — the plain twin passes on both mock and
  real DB while the branded twin passes on the mock but the engine rejects it (only the real-DB cell
  surfaces it). The same root cause recurs across paths that resolve a typeName (placeholder cast AND
  value marshalling) — check them together.
- **Compound-interface overload subset — one arm wraps, another doesn't** (theme 6).
  `orderBy(valueSource)` on a compound emitted an un-wrapped `UNION … ORDER BY <expr>`
  every engine rejects, while the string/ordinal/`rawFragment` arms wrap in
  `select * from (…)`. *Technique:* enumerate the compound interface's OWN overload set;
  after the first arm is fixed a sibling arm (e.g. the raw-fragment one) often still lingers.
- **Cross-cutting feature × special builder — the EMITTED SQL of the composition**
  (theme 8, the highest-yield mature-phase vein). `customizeQuery` hooks dropped /
  mislanded when composed onto a recursive-union select, while the direct-execute and the
  plain CTE honored them. *Technique:* when the type surface lets `customizeQuery` /
  `allowWhen` / `projectingOptional…` / `forUseAsInline*` compose onto a
  recursive/compound/shaped/on-conflict/with-values builder, **probe `ctx.lastSql`** of
  the composition against its working twin — a dropped/mis-placed fragment is invisible to
  types and to any test that never composes the two.
- **TS accepts what the impl THROWS or under-delivers** (theme 8). A one-column recursive
  select consumed as an inline query value threw `INTERNAL` (the recursive rebuild copied
  every projection flag onto the outer select but omitted `__oneColumn`); the non-recursive
  and the `executeSelectMany` twins worked. *Technique:* runtime-probe the type-permitted
  composition against its working control — the build-time throw / wrong shape shows only
  when you run it, never in a compile-repro.
- **Execute-shape twin missing a guard its covered sibling has** (theme 10). `values([])`
  short-circuited `executeInsert` but not the RETURNING execute-shapes
  (`executeInsert{Many,One,NoneOrOne}`), which built and dispatched the empty SQL string a
  real driver rejects. *Technique:* walk the whole `{statement} × {execute-shape} ×
  {column-arity} × {inhabitant}` grid and mock-probe `history.length` / the throw per cell;
  the covered branch hides the un-guarded twin.
- **Runtime-VALUE soundness invisible to a compile-repro.** A single-row
  `returningLastInsertedId` null-id guard was dead code (a method-vs-field typo), so a
  non-null-typed result silently resolved `null`. The type is internally consistent — no
  compile-repro can see it. *Technique:* when a defensive guard enforces a non-null /
  no-result contract, **mock the boundary value it defends against** (`mockNext(null)`) and
  read the resolved result; do not reason "the type says non-null, so it must throw" (the
  runtime analogue of the type-self-consistency ≠ runtime-soundness oracle below).
- **The impl diverges from a normative spec `src/` itself carries — and the tests pin the
  divergence, so the suite is green.** Some surfaces ship their own rules as prose next to the types
  that implement them (the projection-rule header; dialect config contracts). Where one exists, **the
  spec is the oracle, not the suite**: a test can only pin *observed* behaviour, so a test asserting the
  current type/emission is exactly what a baked-in divergence looks like — and "a prior round ratified
  this representation" is a statement about the pin, never about the spec. *Technique:* read the spec
  first and derive what each rule demands of the output; check the impl against **that**; then locate the
  sibling configuration where the impl *does* honour the rule — the contrast between the honouring and
  the diverging path localises the defect (typically one shared transform that a guard short-circuits on
  one path but not the other, so the same declared marker renders two different shapes). A surface whose
  spec says "all four rules mark such leaves optional" while three of the four rules emit a required key
  is a defect no per-surface enumeration will report, because every test agrees with the code.

### False positives & misclassified boundaries this method has produced — and the oracles that refute them

A maximalist bar surfaces real bugs; it also surfaces **plausible-but-wrong** candidates
(two shapes: a claim that's simply wrong, and a *real* finding whose bug-vs-boundary
*classification* is wrong). It can also **wrongly REFUTE a real bug** — the inverse error, the
most dangerous one, because the finding then never gets filed. Keeping all three prevents
re-chasing / re-dismissing them and sharpens the oracles:

- **A base-class method that every concrete subclass overrides is NOT automatically dead / OUT
  (an inverse-error: a real bug mislabeled unreachable).** When a defect sits in an abstract base
  and every subclass overrides that method, the reflex is to file it OUT ("no matrix cell reaches
  the base"). Check FIRST whether the base is a **designated base dialect / default** — a base meant
  to be a correct, usable implementation that subclasses extend *minimally*, not an unreachable
  scaffold. If it is, its divergence from a subclass is a **real bug** (the base emits wrong output),
  and the wall-to-wall overrides are often the **design-debt symptom**: a per-dialect bug-fix applied
  to each subclass instead of the base. The reproducing test is not absent, only **masked** — removing
  the redundant override lets the base's own dialect cell exercise it. *Technique:* before filing a
  base-class defect OUT, establish whether the base is a real dialect/default (subclass overrides carry
  genuinely distinct output, and one subclass is *meant* to reduce to the base) or a pure abstract;
  only the latter is OUT. The domain fact that settles it usually lives with the maintainer, not in the
  types — ask / surface it rather than assuming "overridden everywhere ⇒ dead".

- **A compile-repro that confirms a type matches its HYPOTHESIS does NOT establish the type
  matches the RUNTIME — the "type-self-consistency ≠ runtime-soundness" oracle (a FALSE-NEGATIVE
  the method produced).** A projection agent flagged a "sole-optional-inner container" as a
  possible rule-misfire. The coordinator compile-repro'd it: it printed `wrapper: {…}` (REQUIRED),
  which matched the hypothesis "the rule types it required," so the candidate was **refuted as a
  clean §A gap**. That was **wrong**: the type was required but the RUNTIME dropped/nulled the
  container when the inner was all-null — a genuine type-vs-runtime **soundness** bug (later
  confirmed and fixed; the container is now typed optional). The
  compile-repro only answered *"does the type equal what I guessed?"*, never *"does the type match
  what the impl actually produces at runtime?"*. **Oracle:** whenever a candidate is an
  **optionality / key-presence / nullability claim about a RESULT type** (a projection container,
  an optional leaf, a `| null` inhabitant), a compile-repro is **necessary but NOT sufficient** —
  you MUST also **runtime-probe the boundary row** (`ctx.mockNext` the collapse / all-null / no-row
  case, read the value, and check `'k' in obj` / `=== null` / present-vs-absent) and confirm the
  *runtime* key-presence matches what the *type* promises. If the type says a key is required but a
  reachable runtime input omits/nulls it (or vice-versa), the type is unsound and it IS a bug — even
  when the compile-repro "confirmed" the type. Do not close a result-optionality candidate on a
  type check alone; the type and the value must be probed **together**.
  - **Corollary — a result-shape TYPE is sound only for the runtime it was written against; a fix
    that reuses one shape across two builder paths must be probed on EACH path.** When a fix retypes
    a *shared* projection shape consumed by more than one builder (e.g. an object-projection element
    type used by both `aggregateAsArray` and its inline `forUseAsInline*Value` twin; a projection
    carried before vs after a `.union()`), enumerate every consuming path and runtime-probe each — a
    type correct for a *dropping* projector (one that removes a rule-1/rule-2 element on a null
    gate/miss) is unsound for a *non-dropping* twin (one that keeps the element present-`null`), and a
    runtime flag propagated to one builder-clone (the recursive builder copies its projection flag)
    can be silently absent on a sibling clone (the compound `union`/`intersect`/`except` builders do
    not). The fix's own regression test almost always lands on the path where the two shapes coincide
    (e.g. an own-table optional leaf, where dropping and non-dropping agree), hiding the divergent
    path — so audit the fix's *other* consumers, not the one it shipped a test for.

- **`disallowIfNoValueWhen` "drops the `MISSING_KEYS` narrowing" — FALSE POSITIVE
  (working as intended).** A round's parity sweep + INSERT agent both flagged, and a
  coordinator compile-repro *confirmed a type divergence* (`Exact<disallowIfNoValue(all),
  disallowIfNoValueWhen(true, all)>` → TS2344): `disallowIfNoValue<COLUMNS>` narrows via
  `Exclude<MISSING_KEYS, COLUMNS>` while `disallowIfNoValueWhen` returns `MISSING_KEYS`
  unchanged. The load-bearing premise — *"`xWhen(true, …) ≡ x` at runtime ⟹ their result
  types must coincide"* — is **wrong**, and the compile-repro proved the divergence but
  **not its wrongness**. **Why it's correct-by-design:** a `*When` takes a *runtime*
  boolean; under `when === false` it returns `this` unchanged, so a `*When` must **never
  clear a missing-key obligation** its unconditional sibling clears — otherwise
  `executeInsert()` would compile on an insert whose required column was never set when
  `when === false` (the exact unsoundness the historical `keepOnlyWhen` fix *removed*).
  `disallowIfNoValue` clears keys soundly *because* it is unconditional and throws eagerly;
  the whole `set*When` family likewise returns `MISSING_KEYS` unchanged by design. The tell
  was there — *"if it were a bug it wouldn't be limited to those two functions"* — but the
  audit read the `keepOnlyWhen` precedent backwards (that fix made the When form **keep**
  keys / stay non-executable, i.e. *add* not *clear*). **Empirical refutation:** with the
  proposed "fix" applied, `dynamicSet().disallowIfNoValueWhen(false, err, reqCol).set(rest)
  .executeInsert()` *compiles* (unsound); on the unchanged code it correctly does not
  (`TS2339`). The right test is the **inverted guard** — a `@ts-expect-error` on
  `.executeInsert()` after a `disallowIfNoValueWhen(false, …)` chain (+ a passing
  `disallowIfNoValue` control) — under `types.negative/`.

**Oracle for any `*When` / conditional narrowing-divergence (supersedes "use runtime
delegation as the oracle"):** runtime delegation on the `true` branch proves equality
*only on that branch*; the type must be **sound across both branches**. So the real
question is **soundness under `when === false`**, not delegation under `when === true`:
- If the unconditional sibling's transform only **adds/keeps** an obligation (monotonic —
  `keepOnly` re-unions `| MISSING_KEYS`, `ignoreIfSet`, `set*`), the `*When` **must match**
  it, and a divergence *is* the bug (historical `keepOnlyWhen`).
- If the unconditional sibling **clears** an obligation (`disallowIfNoValue`'s
  `Exclude<MISSING_KEYS, COLUMNS>` — the only such rule), the `*When` **must not match** it
  (keeps the wider/unchanged obligation), and the divergence is **correct-by-design, not a
  bug**. Before filing, ask: *would matching the sibling let an insert become executable
  when `when === false` left a required column unset?* If yes → the divergence is correct.

- **`customizeQuery` non-bracketing hooks "dropped" on `recursive-union + forUseInQueryAs` —
  MISCLASSIFIED BOUNDARY (real finding, wrong verdict).** The seam critic correctly found the
  composition untested, and a coordinator runtime probe correctly proved
  `afterSelectKeyword`/`beforeColumns`/`customWindow` are dropped when a recursive select is
  consumed as a CTE (they render on the direct-execute sibling). It was filed as a bug. The
  repo owner re-adjudicated it a **legitimate NOT-APPLICABLE boundary**: those three hooks
  customize the recursive query's **outer `select … from <cte>` projection**, and consumed as a
  CTE that outer projection is **replaced by the consuming query** — so the hooks have **no
  valid render site**, and they cannot be emitted on the `anchor ∪ recursive` compound (a
  compound has no top-level SELECT clause, and the recursive self-reference can't be nested in a
  subquery to give it one). "Not applicable here" is the correct semantics (repo-owner rule:
  **not every customization is applicable in every context**). Contrast the *real* bug it
  followed (`beforeQuery`/`afterQuery` dropped on the same composition): those **do** have a
  valid render site — the CTE parens — so dropping them WAS a defect. The distinction is the
  oracle below.

**Oracle for any "dropped / misplaced emitted fragment" candidate (the runtime-probe analogue
of the `*When` oracle):** a runtime probe proving a fragment is **dropped or moved** answers
*"does the emission differ?"*, never *"is the difference wrong?"*. A drop is a **defect only if
the clause the fragment customizes still exists in the composed output**. Before filing a
dropped-hook/fragment as a bug, ask: **in this composition, does the customized clause survive —
or does the composition remove/replace it?**
- Clause **survives** (statement wrapper still emitted; CTE parens present; the ORDER BY still
  renders) → dropping the fragment is a **bug** (e.g. `beforeQuery`/`afterQuery` on the CTE, the
  `orderBy(valueSource)` compound-wrap).
- Clause is **removed/replaced** by the composition (the outer projection is replaced when a
  select becomes a CTE; a compound has no SELECT clause to host a projection hook; a builder kind
  structurally lacks that slot) → the drop is a **legitimate NOT-APPLICABLE boundary**, and the
  right artifact is a **passing boundary test** (snapshot identical to the sibling that omits the
  hook), not a `BUGS.md` entry. When unsure, present the finding as a CANDIDATE with *both*
  readings and let the maintainer pick — do **not** assert "bug" from the drop alone.

- **A HYPOTHESIZED invalid / rejecting emission is not a real one — bake it before you assert it
  (the report-content analogue of "divergence ≠ defect").** Any claim about *what the SQL emits* —
  that it is invalid, that it rejects on engine X, that an adapter column binds its transformed value
  under the declared-type cast — is a **hypothesis until `ctx.lastSql` prints it**. It bites hardest on
  a §B whose whole payoff is *"this emission is latent-invalid / rejects on PG/mssql/oracle"*: that
  rationale asserts an emitted string the audit **never read**. The `SqlBuilder` routinely emits a
  **smarter valid form** than the naive "bind the transformed value under the base-type cast" — a
  `CASE`, a comparison, or a cast to the adapter's *underlying* type. An adapter that maps a boolean
  `true → 'Y'` does **not** imply a `'Y'::<booltype>` binding: the builder recognises the adapter and
  emits `case when ? then 'Y' else 'N' end` on write and `col = 'Y'` on read, valid on every dialect.
  So before writing "emits invalid X" (or docker-scheduling it as a rejecting payoff), **build the
  query on the mock, read `ctx.lastSql`, and confirm the emission actually is what you claim** — the
  "rejecting" premise frequently evaporates, turning a §B-with-a-scary-hypothesis into a plain §A
  round-trip test. (Same discipline as §7.4: probe the emission, don't reason about it — extended from
  *defect* candidates to the *rationale* of any missing-test whose value rests on an emitted-SQL claim.)

- **Corollary to drop ≠ defect — "outer projection replaced → no render site" is NOT the only
  resolution; wrapping is a third option.** The recursive-CTE-consumption family (a recursive
  select's whole-statement hooks, projection-only hooks, and fluent `orderBy`/`limit`/`offset`,
  all consumed via `forUseInQueryAs`) repeatedly looks like the boundary above: the outer
  `select … from <cte>` projection is replaced by the consuming query, so anything targeting it has
  no render site. But a dropped clause with a *meaningful* alternate site (ordering/paging over the
  recursive member) can also be fixed by **wrapping the recursive member in an inner select that
  carries it** — `<as> as (select … from <recursive-member> order by … limit … offset …)`. So when
  the drop is silent AND the clause has a natural inner-select home, present it as a CANDIDATE with
  *both* readings (boundary vs render-by-wrapping) rather than asserting either; the maintainer's
  semantic decision picks. (`beforeQuery`/`afterQuery`→inner-body vs ordering→wrapping-select is a
  real, valid dual re-home; `forUseAsInlineAggregatedArrayValue` relocates the `order by` into a
  `(select … order by …) as a_N_` derived table under `json_agg`, valid on the engine.)

- **A structurally-reasoned emission DROP that a runtime probe REFUTES — probe > trace, and probe
  the MINIMAL trigger.** A seam critic reported a nested-object RETURNING
  (`update(t).from(aux).returning({ o: { name: aux.col } })` + `oldValues()`) drops the FROM-table
  registration and emits invalid SQL, with a detailed call-graph root-cause (the emission's
  `_extractAdditionalRequired{Tables,Columns}ForUpdate` iterate only top-level `__columns`). The
  coordinator probed it on a cell where the from-subquery path is active: the arm emitted **correct
  SQL** — the table WAS registered and its column projected in the `_old_` subquery. **Lesson 1
  (probe > trace):** a plausible root-cause trace does not establish the emission; when a seam agent
  hands you a "drops X, emits invalid SQL" claim, the mock's printed string is the verdict, not the
  call-graph reasoning. **But the trace was right about the mechanism** — a genuinely narrower shape
  (a from-joined column referenced ONLY inside a nested RETURNING sub-object, not also in
  `.set`/`.where`/a flat key) IS dropped; the probe that "refuted" it happened to reference the table
  elsewhere too, so another discovery path masked the bug. **Lesson 2 (probe the MINIMAL trigger):**
  when you probe to refute a "drops X" claim, build the *minimal* shape the trace implies — not a
  convenient composition that also reaches the target through a covered path, or you refute a real
  bug by testing the wrong shape.
- **The execute-shape INHABITANT-PARITY grid is a recurring §A vein — check the whole grid, not one
  branch.** Each mutation/select execute-shape family (`executeInsert*`/`executeUpdate*`/
  `executeDelete*`/`executeSelect*`) dispatches on `__oneColumn` (→ `execute…ReturningOneColumnOneRow`)
  vs row-shape (→ `execute…ReturningOneRow`) — **distinct runner methods** — and each *shape* has
  distinct throw/`→null` **inhabitants** (`NO_RESULT` / `MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE` /
  `MORE_THAN_ONE_ROW` / `→ null`). The full grid is `{statement (INS/UPD/DEL/SELECT)} × {execute-shape
  (One/NoneOrOne/Many/…)} × {column-arity (one-column/row-shape)} × {inhabitant (throw/null/value)}`;
  implementing one statement's inhabitants leaves the sibling statements/arities as the classic
  "regression-lock at one form, twin untested" §A. Verify with a per-test grep on the *specific*
  `(shape × arity × reason)` pairing, NOT the bare method name — a coarse "the method appears" grep
  over-reports covered; a per-test multiline scan is the reliable check. `rowIndex` on a per-row
  MANDATORY error is realized ONLY via a multi-row `returningLastInsertedId()` + `mockNext([id, null])`
  — nowhere else in the suite.
  - **Oracle when an inhabitant shares a runner with a covered sibling:** when two execute-shapes at
    the same arity route through the *same* runner method whose throw is already covered (e.g.
    `executeSelectOne` and `executeSelectNoneOrOne` both hit `executeSelectOneRow`, which throws
    `MORE_THAN_ONE_ROW` before the shape-specific `.then`), the second is **runner-redundant** — a
    defensible §C. BUT if the maintainer has already added the *other-arity* twin of that shape-pair,
    completing the 2×2 matrix matches their revealed intent → a low-tier §A with both readings, not a
    hard gap or a silent drop.

## Operational rules

- **Use `npm run …` for everything** — `validate:tests` / `validate:tests:newest`, `tests:where-is`,
  `tests:index`, and the matrix itself. One consistent runtime avoids confusing
  the agent; for the compiler/searcher helpers the launcher is a no-op (same tsgo,
  same index), and for the matrix vitest (`isolate:false`) is faster incl. ~20× on
  `--docker` (see [`BENCHMARKS.md`](./BENCHMARKS.md)). Reach for `bun` only for the
  bun-native connector cells.
- **Agents are READ-ONLY.** The working tree must end the session clean — only
  the new `MISSING_TESTS_AUDIT_<N>.md` (plus any pre-existing untracked files)
  should appear in `git status`. Delete every compile-repro you wrote.
- **Never use coverage or the searcher *for discovery*.** Raw-read the types.
  (Coverage-checking and reachability use grep / searcher / compile-repro — a
  different phase.)
- **Never fix `src/` from an audit.** A divergence found is a `BUGS.md` entry +
  a `// TODO[BUG]` on the would-be assertion; the user / fixing agent takes it
  from there. The audit discovers; it does not repair.
- **Never invent an API.** If an enumerated method isn't in `src/`, it isn't a
  path (a sub-agent once "found" `position`/`pad*`/`trunc` that don't exist).
  Enumerate only what the source declares.
- **Inherit no prior verdict.** Each round re-derives coverage from the current
  files. "Covered last round" is checked again, not assumed. **This binds hardest on a prior
  round's DEFECT verdicts, not just its coverage claims** — an item a previous report closed as
  *cosmetic / dormant / OUT / not-a-bug*, or that a memory records as *ratified / already tested*, is a
  label, not evidence, and it is precisely where a real defect survives round after round (a
  base-dialect typo dismissed because "every dialect overrides it"; a projector representation
  dismissed because a prior round pinned it). Re-derive such an item against the **norms and the
  emission** before repeating its verdict; the cost is minutes, and the prior label is what made it
  invisible.
- **Maximalism is the standing target; prefer excess by default.** Total
  coverage of every reachable typed path *and variant* is the ambition (see
  "The standard we hold" in the header), and a long report is the expected
  shape of an honest round. The only dial the user sets is **how much to fan out
  in one session** (a quick pass may scope to a few surfaces) — never *whether*
  a distinct reachable path is worth a test. Do not label a distinct
  overload/interface/arity/classification "low value" and drop it; tier it
  (§8) and report it **as its own enumerated line item, never a themed count**
  — "8 sibling-operator cells" hides the work; the report must name the 8 (§8,
  the enumerated-backlog mandate). And never silently truncate — if you bound the
  round, say exactly what was left for next time.

## Where this runbook ends

This runbook covers *discovery* — finding the missing tests. It hands off to:

- *How a found test is written / baked / propagated / real-validated* →
  [`COVERAGE_RUNBOOK.md`](./COVERAGE_RUNBOOK.md) §5–§9 (the generation half is
  identical regardless of how the gap was discovered) +
  [`DESIGN.md`](./DESIGN.md) + [`WRITING_TESTS.md`](./WRITING_TESTS.md).
- *What the lib has wrong / cannot do today* → [`BUGS.md`](./BUGS.md) +
  [`LIMITATIONS.md`](./LIMITATIONS.md).
- *Per-connector caveats for the propagation sweep* →
  [`EXTERNAL_CAVEATS.md`](./EXTERNAL_CAVEATS.md).
- *Searcher doors / presets for the coverage-check phase* →
  [`CODE_SEARCH.md`](./CODE_SEARCH.md).
- *Commands & flags* → [`CLI.md`](./CLI.md); *navigation map* →
  [`README.md`](./README.md).

When this runbook contradicts any of those, **those are the source of truth and
this is the synthesis.**
