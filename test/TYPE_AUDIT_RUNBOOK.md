# `test/` — type-driven missing-tests detection: agent runbook

> **What this document is.** A self-contained operating manual for an agent
> (orchestrating sub-agents) running a session of "find the tests the TYPE
> DEFINITIONS imply but the suite lacks". The user invokes it with a one-line
> prompt of the form **"read `test/TYPE_AUDIT_RUNBOOK.md` and run the next
> missing-tests audit"**. Each session emits a working report,
> `test/MISSING_TESTS_AUDIT_<N>.md` — a **transient artifact** the user
> consumes and then deletes; treat it as **not** an input to the next round
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
> MariaDB/MySQL `ON DUPLICATE KEY UPDATE` fix, commit `1149a866`), which **no
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
> **proven bug-finding method** — the confirmed defects it has surfaced are
> catalogued in §9, and each maximalist pass has tended to surface **more real
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
   reports are transient — the user consumes and deletes them — so never depend
   on one being present; but **older ones are often still on disk**, so do not
   assume their absence either. Two consequences: **(a) derive the round number**
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
   Refresh the index once at session start: `bun run tests:index`.
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

1. `bun run tests:audit` — the authoritative per-database cell/test counts for
   today's matrix. Reference cell is still `postgres/newest/pg/` unless this
   prints otherwise.
2. `bun run tests:index` (~30 s) — the semantic index, for coverage-checking
   and reachability later. (Discovery itself is raw reading; the index is not
   needed for it.)
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
   untested everywhere.)

**Maintenance contract.** If the **degeneracy bar** (§4), the **scope** (§5),
or the **surface decomposition** (§6) is refined by the user during a session,
update this runbook in the same session — those three are the load-bearing
rules and they have already shifted once (see §4's history note).

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
later shipped a real bug fix (commit `1149a866`). Carry the narrowed bar:

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
`bun run tests --list-cells`); the symmetry rule (see [`DESIGN.md`](./DESIGN.md))
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
   - `bun run validate:tests 2>&1 | grep <reprofile>` — no error means the
     chain typechecks and the asserted type holds; an error reveals the actual.
     (`validate:tests` runs **tsgo** over `test/tsconfig.json`; under `npm` it
     needs the separator: `npm run validate:tests --`. Full command/flag
     vocabulary — `tests <coord>`, the runner flags — is in [`CLI.md`](./CLI.md).)
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
   | uniq -c`) rather than trusting the count.
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
   - `bun run tests 'postgres/newest/pg/<probe>.test.ts' --no-color` and read the
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

A finding that survives verification is real. A finding refuted moves to the
report's "refuted" list with the evidence — never silently dropped (so the next
round doesn't re-chase it).

## The report

Write `test/MISSING_TESTS_AUDIT_<N>.md`. Structure that has worked:

- **Header** — the mandate this round (and the degeneracy bar in force), the
  method, and the headline counts.
- **Themes** — group findings into the recurring cross-cutting patterns (§9),
  ranked by **risk tier**, not raw count:
  - **Tier 1** — distinct code-path / runtime-branch / the bug class; output-
    coincidence masks real risk. (Shaped builders, adapter-dispatch fan-out,
    projection-classification boundaries, compound-interface overloads,
    custom-temporal getters, brand-keep boundaries.) Highest value, usually
    cheapest (existing fixtures).
  - **Tier 2** — distinct overloads / per-type emission; shared dispatcher but
    observably distinct. (Value-source-operand twins, optional-receiver
    branches, direct-fluent-per-type, connection per-kind fan-outs.)
  - **Tier 3** — mechanical per-kind completeness fan-out (usually §B, needs
    fixtures). In scope under "every variant", lowest priority.
- **Per-surface counts** — a table of §A / §B per agent + which surfaces are
  **saturated** (genuinely 0/0 — name them; that is a real, valuable result).
- **Coordinator verification notes** — what you checked yourself and how the
  contradictions resolved.
- **§B fixture-addition plan** — concrete columns/helpers/files to add.
- **Recommended implementation order** — Tier-1-on-existing-fixtures first.
- **Verdict** — honest: "saturated" if it is; otherwise the tiered gap list. If
  a source bug surfaced, it goes here *and* to `BUGS.md` (never fixed here).

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
   ledger).
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
    *missing* `*When` family, and an `olumns` typo — the wrong block pasted; commit
    `122458db`) or a missing-test path. Run this sweep on
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
are the confirmed bugs. The evidence: the confirmed-bug ledger below is increasingly
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
worth is proven by the ledger below across the effort's whole history, not by every single
round landing a defect. (See "False positives & misclassified boundaries" for the two ways
a forced bug goes wrong: a compile-divergence read as wrongness, and a probed drop read as a
defect when its clause was actually removed by the composition.)

### Verified bugs this method has caught

The durable proof the bar is worth holding (keep this list current — append each
confirmed `src/` defect a finding surfaces, with its fix pointer, so the track
record survives the transient reports):

- **Shaped `INSERT … ON CONFLICT` key remapping.** The type advertised
  shape-renamed keys in the on-conflict update-set
  (`ShapedInsertOnConflictSetsExpression`); the impl didn't deliver it on
  MariaDB/MySQL `ON DUPLICATE KEY UPDATE`. Found by enumerating a *reachable
  overload an earlier pass had dismissed as "borderline / not reachable"*; fixed
  in commit `1149a866`. Invisible to coverage (the lines executed; the remapping
  was wrong). This is the canonical shaped-builder bug class (theme 2).
- **Per-type numeric & compound-overload emission — two "valid SQL on the covered
  path, invalid on the untested sibling" defects** (filed in [`BUGS.md`](./BUGS.md)
  when found; the live entries are the source of truth):
  - **`modulo(...)` on a `double` / `customDouble`** emits `float % x`, which
    PostgreSQL rejects (`%` exists for `integer`/`numeric`, not `double
    precision`). The suite only ever exercised `modulo` on `int`/`bigint`/
    `customInt` receivers — found by the **value-source / per-type numeric**
    enumeration (theme 1). Dialect-dependent (SQLite/MySQL/MariaDB accept it).
  - **`orderBy(valueSource)` on a compound** emits an un-wrapped
    `UNION … ORDER BY <expr>` that every engine rejects — the string / ordinal /
    `rawFragment` order-by forms wrap the compound in `select * from (…)`, but
    the value-source overload doesn't. Found by the **compound-interface
    overload-subset** enumeration (theme 6 / the compound-order-by gap).
- **Shaped UPDATE `*When` set family unusable as typed** (the shaped-key-remap
  class above, resurfaced in a new arm). All 10 conditional set arms
  (`setWhen`, `setIfValueWhen`, …) on `ShapedExecutableUpdateExpression` type their
  `columns` param `UpdateSets<…, undefined>` (**unshaped**) while the non-When
  siblings use `…SHAPE`. So the `*When` arms **reject** the renamed shape key the
  runtime needs and **accept** only the real column keys the runtime then silently
  drops (`__shape` is keyed by the renamed names) — the feature can't be used as
  typed. Found by the **shaped-builder** enumeration (theme 2); **compile-verified**
  by the coordinator (`setWhen(true,{projectName})` → TS2353; positive controls pass)
  and confirmed against `UpdateQueryBuilder`. Filed in [`BUGS.md`](./BUGS.md) with a
  source-confirmed milder INSERT sibling (static `onConflictDoUpdateSet` returns the
  *non-shaped* node, so a chained shaped `.set` is type-rejected though the impl would
  remap it). The lesson: **a shaped continuation that drops `SHAPE` from a param or a
  return type is the highest-yield place to compile-repro** — always check the
  shaped-vs-non-shaped param/return symmetry across the *whole* method family, not
  just the happy-path `set`.
- **Single-row insert `keepOnlyWhen` return type mis-folds `MISSING_KEYS`**
  (the keep-tracking-parameter bug class — a further resurfacing of the
  shaped / `*When` family of defects). On
  `MissingKeysInsertExpression` (insert.ts:293) and its shaped twin
  `ShapedMissingKeysInsertExpression` (:352), `keepOnlyWhen` returns
  `Exclude<RequiredColumnsForSetOf<TABLE> | MISSING_KEYS, COLUMNS>` whereas the
  runtime-identical `keepOnly` (:265) returns
  `Exclude<RequiredColumnsForSetOf<TABLE>, COLUMNS> | MISSING_KEYS`. Since
  `InsertQueryBuilder.keepOnlyWhen(true, ...c)` calls *exactly* `this.keepOnly(...c)`
  (:1437-1442), the `when:true` result type must equal `keepOnly`'s — it doesn't:
  `keepOnlyWhen` over-removes named columns from `MISSING_KEYS`, so naming all
  required columns collapses `MISSING_KEYS` to `never` (typed executable) while
  `keepOnly` keeps them missing (non-executable). Found by the **theme-10 parity
  sweep**; **compile-verified** by the coordinator on both twins
  (`assertType<Exact<keepOnly(all), keepOnlyWhen(true,all)>>` → TS2344 on both).
  Filed in [`BUGS.md`](./BUGS.md). The multi-row twins and all executable insert
  twins fold `MISSING_KEYS` correctly — only the single-row `MissingKeys` pair is
  wrong. The lesson reinforces the shaped-`*When` entry above: **a `*When`
  continuation that re-derives a key-tracking type parameter differently from its
  non-`When` sibling is the highest-yield compile-repro** — diff the
  `When`/non-`When` return types arm by arm. **But a divergence alone is NOT a bug:**
  keepOnlyWhen was a bug because `keepOnly` is *monotonic* (it re-unions `| MISSING_KEYS`
  and never clears an obligation), so the When form must match it. When the unconditional
  sibling *clears* an obligation (`disallowIfNoValue`), the When form correctly does NOT
  match — see "False positives … the oracle that refutes them" below. **The oracle is
  soundness under `when === false`, not runtime delegation under `when === true`.**
- **`customizeQuery` hooks silently dropped / mislanded on a recursive-union
  SELECT.** `customizeQuery({beforeWithQuery, afterWithQuery, beforeQuery,
  afterQuery})` is typed & callable on a `.recursiveUnion*(...)` select (both
  before and after the union call), but the recursive-CTE emission path drops
  `beforeWithQuery`/`afterWithQuery` entirely and renders `beforeQuery`/`afterQuery`
  *inside* the CTE body around the anchor member (violating `beforeQuery`'s "before
  any other SQL") — whereas the non-recursive `forUseInQueryAs` CTE path honors all
  four (wraps the CTE parens). Found by the **seam critic** (composition ×
  recursive-CTE); **verified by a coordinator runtime SQL probe** (build the
  composition on the mock, capture `ctx.lastSql`, diff against the working
  `forUseInQueryAs` snapshot). A "TS accepts what the impl doesn't deliver"
  divergence; filed in [`BUGS.md`](./BUGS.md). The lesson: **when the type surface
  lets a cross-cutting feature (customizeQuery, allowWhen, projectingOptional…)
  compose onto a special builder (recursive/compound/shaped), probe the *emitted
  SQL* of the composition — a silently-dropped or mis-placed fragment is invisible
  to types and to any test that never composes the two.**
- **Shaped-update `extendShape` drops the `dynamicSet` opener** (twin asymmetry;
  TS *rejects* something that should work). `ShapedUpdateSetExpression.extendShape`
  (update.ts:295) returns `ShapedNotExecutableUpdateExpression`, which has no
  `dynamicSet` — while its AllowingNoWhere twin's `extendShape` (:319) returns its
  own opener family (keeps `dynamicSet`) and the INSERT `ShapedInsertExpression.extendShape`
  keeps its own family too. Runtime `extendShape` returns `this`, so `dynamicSet`
  is callable; the type is over-restrictive. So `update(t).shapedAs(...).extendShape(...).dynamicSet()`
  type-errors while the identical AllowingNoWhere chain compiles. Found by the
  **parity sweep**; **compile-repro'd** by the coordinator (TS2339 on the normal
  path, compiles on the AllowingNoWhere path, compiles on the normal opener without
  `extendShape`). Filed in [`BUGS.md`](./BUGS.md).
- **One-column recursive select as an inline query value throws `INTERNAL: Unexpected
  inline select`** (TS accepts, impl throws). `selectOneColumn(...).recursiveUnion*(...).forUseAsInlineQueryValue()`
  is type-permitted, but `__buildRecursive` (SelectQueryBuilder.ts ~586-593) copies
  `__columns`/`__subSelectUsing`/`__projectOptionalValuesAsNullable` onto the outer
  `recursiveSelect` and **omits `__oneColumn`**, so the inline scalar init throws.
  The non-recursive one-column inline works, and the recursive one-column via
  `forUseInQueryAs`/`executeSelectMany` works — only the recursive×one-column×inline
  cell is broken. Found by the **seam critic**; **root-caused by source read + a
  coordinator runtime throw-probe** (recursive path throws `INTERNAL`; non-recursive
  control emits `select (select id … ) as "n" from project`). Filed in [`BUGS.md`](./BUGS.md).
- **`customizeQuery` `beforeQuery`/`afterQuery` silently dropped on a recursive-union
  select consumed via `forUseInQueryAs`** (the recursive-CTE customizeQuery-drop class,
  resurfaced on a *composition the earlier fix didn't cover*). **CONFIRMED + FIXED.**
  `.recursiveUnion*(…).customizeQuery({beforeQuery, afterQuery, …}).forUseInQueryAs(name)`
  is typed & callable, but the recursive branch of `forUseInQueryAs`
  (SelectQueryBuilder.ts ~:539-547) returned only `recursiveView` and discarded
  `this.__recursiveSelect` (where the whole-statement hooks were parked by
  `__applyRecursiveCustomization` ~:612-648), so `beforeQuery`/`afterQuery` vanished.
  Found by the **seam critic**; **verified by a coordinator runtime SQL probe** with
  two working-sibling controls — the SAME builder via `executeSelectMany` renders all four
  hooks, and the non-recursive `forUseInQueryAs` renders them (`beforeQuery`/`afterQuery`
  inside the CTE body); only `recursive × forUseInQueryAs` dropped them. Fixed by re-homing
  the outer hooks onto the CTE body (mirroring the non-recursive path); live test added to
  `customize-query.select.test.ts` in all 17 cells. A "TS accepts what the impl doesn't
  deliver" divergence. Distinct from the earlier recursive-CTE customizeQuery bug (that fix
  covered the direct/execute path). **Class fully closed later:** a follow-on round found the
  *non-bracketing* hooks (`afterSelectKeyword`/`beforeColumns`/`customWindow`) were still
  dropped on the same composition, but the repo owner re-adjudicated **that** as a legitimate
  NOT-APPLICABLE boundary (those hooks target the outer projection, which is *replaced* by the
  consuming query when the select becomes a CTE — no valid render site) rather than a bug. The
  recursive branch of `forUseInQueryAs` was rewritten to re-home the outer customization via an
  **explicit allow-list** (`beforeQuery`/`afterQuery` + order-by only), so the whack-a-mole
  class cannot recur. See "boundaries" below for why the follow-on was NOT a bug.

Pattern: **all nine confirmed bugs lived on a path that "looked like the same
implementation" as a covered one** — int-modulo executed fine, so double-modulo's
bad `%` stayed hidden; `orderBy('col')` on a compound executed fine, so
`orderBy(valueSource)`'s missing wrap stayed hidden; the non-shaped on-conflict
executed fine, so the shaped one's broken remap stayed hidden; the shaped `set`
typed correctly, so the shaped `setWhen`'s dropped `SHAPE` stayed hidden;
`keepOnly` typed correctly, so the runtime-identical `keepOnlyWhen`'s mis-folded
`MISSING_KEYS` stayed hidden; `customizeQuery` on a plain CTE honored its hooks, so
the recursive-CTE path's silently-dropped hooks stayed hidden; the shaped-update
opener and the AllowingNoWhere `extendShape` kept `dynamicSet`, so the normal
`extendShape`'s dropped opener stayed hidden; the non-recursive one-column
inline worked, so the recursive one-column inline's `INTERNAL` throw stayed hidden;
and both the direct-execute recursive path and the non-recursive CTE honored
`customizeQuery`, so the `recursive × forUseInQueryAs` composition's silently-dropped
`beforeQuery`/`afterQuery` stayed hidden (these DID have a valid render site — the CTE parens —
so dropping them was a real bug). Coverage was green through every one (several weren't even
reachable / executable as typed; several emitted valid-but-wrong or hook-dropped SQL; one threw
at build). That is the case *for* the narrow degeneracy bar (§4) and the maximalist standard
(header) — and, increasingly, for the **composition/twin seams** (§9 themes 8/10): eight of the
nine lived where a cross-cutting feature or a twin interface met a special builder. Restated as
evidence, not principle.

### False positives & misclassified boundaries this method has produced — and the oracles that refute them

A maximalist bar surfaces real bugs; it also surfaces **plausible-but-wrong** candidates
(two shapes: a claim that's simply wrong, and a *real* finding whose bug-vs-boundary
*classification* is wrong). Keeping these prevents re-chasing them and sharpens the oracles:

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
  oracle below. Closed by rewriting the `forUseInQueryAs` re-home as an explicit allow-list +
  a **passing** boundary test (no `// TODO[BUG]`); `BUGS.md` re-emptied.

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

- **`recursiveUnion*(...).orderBy/limit/offset.forUseInQueryAs(...)` "drops the ordering/paging"
  — same recursive-CTE shape, leans BOUNDARY (maintainer decision pending).** Found by the
  select/CTE seam critic and runtime-probed by the coordinator (fluent `.orderBy/.limit/.offset`
  vanish when the recursive result is consumed as a CTE; the direct-execute path renders them on
  the outer `select … from <cte>` per commit `c3f64158`). Apply the oracle: c3f64158 defines
  fluent `.orderBy()` on a recursive select as "order the **final result**" (the outer select),
  which is **replaced by the consuming query** when the select becomes a CTE → the clause's
  target is removed → the **same "outer projection replaced" shape** as the projection-only-hooks
  boundary above. Presented as a CANDIDATE (not asserted as a bug); the one wrinkle is that the
  drop is *silent* and `limit`/`offset` have a meaningful CTE-body site, so the maintainer may
  prefer render / type-forbid over a documented boundary. **Do not re-file as a confirmed bug
  without the maintainer's semantic decision.** This is the 4th recursive-CTE-consumption hook in
  this lineage (beforeWithQuery/afterWithQuery, then beforeQuery/afterQuery [the one real bug],
  then the projection-only hooks, now ordering/paging) — the stable pattern is that **consuming a
  recursive select as a CTE replaces its outer projection, so anything targeting that projection
  has no render site.**

- **A structurally-reasoned emission DROP that a runtime probe REFUTES — FALSE POSITIVE (the
  probe is the authority, not the trace).** A mutation seam critic reported that a nested-object
  RETURNING (`update(t).from(aux).returning({ o: { name: aux.col } })` + `oldValues()`) silently
  drops the FROM-table registration and emits invalid SQL, with a detailed root-cause (the
  emission path's `_extractAdditionalRequired{Tables,Columns}ForUpdate` iterate only top-level
  `__columns` with *non-recursive* register fns). The coordinator ran the probe on
  `postgres/oldest/pg` (compat 17M, where the from-subquery path is active): **both the flat and
  nested arms emit correct SQL** — `organization` IS registered, `organization__name` IS
  projected in the `_old_` subquery, and RETURNING references `_old_.organization__name`. The
  recursive registration path (`__registerTableOrViewOfColumns`) fires during query building; the
  agent's structural trace missed it. Reinforces §7.4: **a plausible root-cause trace does not
  establish the emission — probe it. When a seam agent hands you a "drops X, emits invalid SQL"
  claim, the mock's printed string is the verdict, not the agent's call-graph reasoning.**

## Operational rules

- **Bun first.** `bun run …` always; `npm run …` only on user request.
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
  files. "Covered last round" is checked again, not assumed.
- **Maximalism is the standing target; prefer excess by default.** Total
  coverage of every reachable typed path *and variant* is the ambition (see
  "The standard we hold" in the header), and a long report is the expected
  shape of an honest round. The only dial the user sets is **how much to fan out
  in one session** (a quick pass may scope to a few surfaces) — never *whether*
  a distinct reachable path is worth a test. Do not label a distinct
  overload/interface/arity/classification "low value" and drop it; tier it
  (§8) and report it. And never silently truncate — if you bound the round, say
  exactly what was left for next time.

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
