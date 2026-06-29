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
> caught in round 13 (`ShapedInsertOnConflictSetsExpression` → a real
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
> **proven bug-finding method**. Round 13 surfaced the shaped-ON-CONFLICT bug
> above; round 14's maximalist pass surfaced **further real `src/` bugs as its
> findings were implemented**. Every time the bar was *lowered* ("this is
> borderline / degenerate / low-value, skip it") it skipped over a real defect.
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

**Maintenance contract.** If the **degeneracy bar** (§4), the **scope** (§5),
or the **surface decomposition** (§6) is refined by the user during a session,
update this runbook in the same session — those three are the load-bearing
rules and they have already shifted once (see §4's history note).

## The loop, end to end

One session runs this sequence once and stops at a written report. (Turning
findings into baked tests is a *separate* user-initiated step — the back half
of [`COVERAGE_RUNBOOK.md`](./COVERAGE_RUNBOOK.md).)

```
   §6  Wave 1      ~12–16 discovery agents in parallel, one per surface.
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
wrong. **It was deliberately narrowed mid-effort** (the early rounds were too
quick to dismiss; round 13 shipped a bug fix for a path a prior round had
called "borderline / not reachable"). Carry the narrowed bar:

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

Fan out ~12–16 general-purpose agents **in parallel**, one per surface. Each is
an exhaustive enumerator of its slice.

### Launch mechanics (how to actually fan out)

Spawn each surface as its own sub-agent with the harness's **Agent** tool
(`subagent_type: general-purpose`). **Emit all N Agent calls in a single
assistant message** so they run concurrently — one message, N tool-uses. Each
agent's **final message is returned to you as that tool's result**; the agents
*cannot* reliably write files (see the gotchas), so that inline final message
*is* the deliverable you aggregate in §7. You are notified as each completes —
collect them as they land; do not block. If an agent comes back confused, empty,
or mid-task, **continue it in place with the SendMessage tool** (correct it:
"report inline, no files, resolve exactly X") to recover its in-progress work
rather than starting over. `run_in_background` is optional; the default is fine.
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

### The surface decomposition (≈16 agents)

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
| F8-META | composition / seam critic — overload-sets with one arm tested, **feature×feature chains tested only alone** (the bug class), input-classification boundaries, `src/index.ts` barrel reachability |

Adjust the split to the surface as it evolves; keep F1-EQCMP and F5-CONN as
their own agents (they are the largest matrices) and always keep an F8-style
seam critic (it catches what per-surface agents miss at the boundaries). Split a
surface whenever its method × kind × optionality matrix is too big for one agent
to enumerate in a single pass (EQCMP and CONN already are).

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
   direct inspection — never average them. (Round 12: the projector agent
   flagged a rule-2 twin as missing; the SELECT agent said covered; a direct
   read settled it covered. Round 14: the equality agent claimed ~150 direct
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
   - **Delete the repro and confirm `git status --porcelain` is clean.** (Round
     13 proved `shapedAs().set().onConflictOn(c).doUpdateDynamicSet()` reachable
     on PG this way, overturning a prior "not reachable" verdict.)
3. **Absence at scale.** For any "this whole class is untested" claim, run the
   wide-grep yourself (`grep -rhoE "<col>\.(equals|notEquals|…)" test/db | sort
   | uniq -c`) rather than trusting the count.

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
   (shape-renamed keys) for INSERT and UPDATE set/on-conflict — historically
   tested on a single route. **This is the bug class** (the round-13 fix).
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

A surface that is *genuinely saturated* even under the narrow bar is a real and
reportable outcome — string value-source, boolean/if-value, dynamic-condition,
and extras/adapters/errors have historically come back 0/0. Say so plainly;
don't manufacture gaps to fill a quota. But **re-verify saturation every round**
against the current files — a "historically saturated" surface is a hint of
where to spend less time, never a licence to skip the enumeration.

### Verified bugs this method has caught

The durable proof the bar is worth holding (keep this list current — append each
confirmed `src/` defect a finding surfaces, with its fix pointer, so the track
record survives the transient reports):

- **Round 13 — shaped `INSERT … ON CONFLICT` key remapping.** The type
  advertised shape-renamed keys in the on-conflict update-set
  (`ShapedInsertOnConflictSetsExpression`); the impl didn't deliver it on
  MariaDB/MySQL `ON DUPLICATE KEY UPDATE`. Found by enumerating a *reachable
  overload a prior round had dismissed as "borderline / not reachable"*; fixed
  in commit `1149a866`. Invisible to coverage (the lines executed; the remapping
  was wrong).
- **Round 14 — maximalist pass — two more, both "valid SQL on the covered path,
  invalid on the untested sibling"** (filed in [`BUGS.md`](./BUGS.md); the live
  entries are the source of truth):
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

Pattern: **all three confirmed bugs lived on a path that "looked like the same
implementation" as a covered one** — int-modulo executed fine, so double-modulo's
bad `%` stayed hidden; `orderBy('col')` on a compound executed fine, so
`orderBy(valueSource)`'s missing wrap stayed hidden; the non-shaped on-conflict
executed fine, so the shaped one's broken remap stayed hidden. Coverage was green
through every one. That is the case *for* the narrow degeneracy bar (§4) and the
maximalist standard (header) — restated as evidence, not principle.

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
