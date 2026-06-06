# `tests:where-is` — the case studies that discovered the requirements

These six worked cases, from the **test-writing agent's chair**, are how the searcher's shape was
discovered. Each takes a real coverage gap or failing test, lists the concrete problems the agent
hits, and shows the command + the report that solves it. They drove the model in
[`MODEL.md`](./MODEL.md); this doc keeps the discovery narrative.

> The commands are the **as-built** flags. The report blocks are illustrative of the *shape* of the
> output (some counts/line numbers are sketched), not byte-exact. Where a case asked for something
> that ended up **not built**, it's flagged — that gap is itself part of the discovery.

The cases, deliberately different in shape. **A–F drove the original build; Case G and §A.4 drove the
latest addition** — **coord-scoped caveat surfacing** (`--cell-caveats`) plus the `propagation`
preset — reasoned through *as cases first*, then built. **Cases H and I** turn to the **negative** tests
(proving the *type-safety* promise, not just runtime): their shared searcher need — `--neg-types full`
showing the actual rules — is **built**; the broader *"what type-safety is missing"* analysis is a
future **type-coverage** tool, out of the searcher's scope. The one idea rejected for noise (a combined
`--tests` detail+gaps shape, P2a) is flagged inline:

| | Seed | Shape | What it surfaced |
|---|---|---|---|
| **A** | `SqlBuilder` line (orderBy insensitive) | coverage gap, reached by *data-flow* | per-section levels, `--chain full`, tests detail/gaps, **combine to cut rounds** |
| **B** | `ValueSourceImpl` method (aggregate modifier) | coverage gap, reached by *chaining off a producer* | **`--producers`** (the receiver question), examples load-bearing for setup |
| **C** | a failing test line (real-vs-mock) | debugging from a *test* | **test-line inverse**, **`--emitted-sql`**, dialect divergence |
| **D** | a failing test (syntax bug) | debugging where the **stack is useless** | **`--emits-keyword`**, **non-overriders** (absence as finding), `--chain none` |
| **E** | a new DB version (PG18) | matrix-shaped work | **`--version-gates`** (+ what stayed with `tests:audit`) |
| **F** | a merged fix (stale SQL) | post-fix sync | `--emits-keyword` as a stale-sync finder; the *limits* of indexed SQL |
| **G** | a declared caveat (MariaDB RETURNING limitation; `virtualColumnFromFragment` bug) | pre-write caveat scan | **`--cell-caveats`** (coord-scoped) — caveats in the cells you're about to touch, vs the name-scoped `--bugs`/`--limitation` |
| **H** | a documented type-safety hole (aggregate-in-WHERE not flagged) | proactive negative coverage | **`--neg-types full`** now shows the *rules* (built); the *"what's missing"* analysis is a future type-coverage tool, **out of searcher scope** |
| **I** | a just-fixed "TS accepts what runtime rejects" bug (`onConflictDoUpdateSet`) | the two-step fix's negative lock | `--for emission-bug` already carried `--neg-types` (summary); the only gap was the detail → **built**; preset E not needed |

---

# Case A — `AbstractSqlBuilder` (orderBy insensitive)

## The setup (the real repo)

I'm the agent. The human ran `bun run coverage:for-discover-tests`; I have no memory beyond the
repo. The discovery report hands me one red line — `src/sqlBuilders/AbstractSqlBuilder.ts:1119`,
the `else` branch of `_appendOrderByColumnAliasInsensitive`:

```ts
} else {
    return 'lower(' + this._appendOrderByColumnAlias(entry, query, params) + ')'   // ← 1119
}
```

Problems, all public-API-only: **(1)** what is this internal method, and what public input makes
*this branch* fire? **(2)** the route is deep — I want the whole call stack. **(3)** I don't
understand "insensitive ordering" — I need the docs. **(4)** the real types are generic noise — I
need the legible signature. **(5)** new test file or extend an existing one? **(6)** find an
existing test I half-remember. **(7)** which other dbs still miss it?

## A.1 — orient (the one command that folds problems 1–4)

The biggest lesson up front: **combine sections**. One call answers what/route/feature/signature:

```bash
bun run tests:where-is --search-location src/sqlBuilders/AbstractSqlBuilder.ts:1119 \
    --classification full --chain full --docs full --signature public-interface --simplified full \
    --implemented-by summary --tests summary
```

```markdown
# where-is: `_appendOrderByColumnAliasInsensitive`
> resolved …:1119 → method `AbstractSqlBuilder._appendOrderByColumnAliasInsensitive` (1108–1121)

## Classification
internal method on `AbstractSqlBuilder` — reachable only through the public fluent API.
(The line-1119 branch is the `lower(<col>)` fallback: insensitive mode, a string column, and
`insensitiveCollation` undefined. The index gives the verdict; you read the precondition off the
docs / branch — there is no auto "fires when …".)

## Search: chain-full (call-chain)
full internal stack, by depth: `_appendOrderByColumnAliasInsensitive` ← `_buildSelectOrderBy`
← `_buildSelectQuery` … ▲ public boundary `__executeSelect*`. NB the hop from `orderBy()` to here
is **data-flow, not a call** — `orderBy` stores the `'insensitive'` mode; the builder reads it at
build time. The chain connects the builder side; the user side is the `OrderByMode` literal.

## Implemented by
`AbstractSqlBuilder` (base) + overridden in PostgreSqlSqlBuilder / the MySQL-Maria / Oracle /
SqlServer / Sqlite builders — the per-dialect emission differs (`--implemented-by full` to list).

## Explained in docs (full)
docs/api/select.md ("Order by", the `OrderByMode` modes) · docs/queries/select.md · dynamic-queries
· extreme-dynamic-queries · **docs/configuration/connection.md "insensitiveCollation"** ← the
keystone: `lower(...)` is the *default* (collation undefined), so cover it with a connection that
has no `insensitiveCollation`.

## Signature — public interface (simplified first)
`OrderableSelect.orderBy(column, mode?: OrderByMode)`; `type OrderByMode = 'asc'|'desc'|…|
'asc insensitive'|…` (the 14 legal literals). The simplified def drops the 4-overload generics.

## Coverage (summary)
matrix tests for orderBy across 6 dbs; the existing insensitive tests live in
`select.order-by.insensitive.test.ts` — but **none** runs with collation undefined → that branch
is the gap.
```

One read, and I know *what* it is, *what input* triggers it (the `'… insensitive'` mode + collation
undefined), the *route*, the *feature* (and that `lower()` is the default), the *legal argument*,
and *that the gap is the collation-undefined branch*. **Searches saved:** grepping four worlds,
reading `select.ts` for the mode enum, opening 6 test files.

The single-section variants are all valid for re-focusing — `--chain full` alone for just the
stack, `--docs full` alone for just the feature — but the opening move is the combined orient.

## A.2 — locate (fold problems 5 + 6): this cell's order-by files, by name

```bash
bun run tests:where-is --search orderBy \
    --tests detail --coord postgres/newest/pg --file-name-pattern order --test-name-pattern insensitive \
    --classification none --chain none --signature none --implemented-by none --docs none --simplified none --examples none --neg-types none
```

→ one list: `select.order-by.insensitive.test.ts` exists, its insensitive cases and (with
`--emitted-sql full`) their asserted SQL — so **extend it** (add a no-collation connection),
don't create a file. **Searches saved:** `ls … | grep order` + opening each file.

## A.3 — gaps to propagate (problem 7)

```bash
bun run tests:where-is --search orderBy --tests gaps --test-name-pattern insensitive
```

```markdown
## Coverage — gaps per db (newest cells)
- postgres: pg ✓  postgres ✓  bun_sql_postgres ✗  pglite ✗   → add to 2
- sqlite:   better-sqlite3 ✗  bun_sqlite ✗  …                → MISSING entirely
- oracle:   oracledb ✗                                       → MISSING
- mysql/mariadb/sqlserver: ✓
```

The realistic loop is **orient → locate → write → gaps**: ~2 search rounds, not 7.

## A.4 — propagation wrap-up (P2)

A.3 told me *which* cells miss the insensitive test. Propagating the canonical to them
([`COVERAGE_RUNBOOK`](../../COVERAGE_RUNBOOK.md) § *Propagation*) wants more in **one** view: per target cell —
does it **already** have the test (skip vs overwrite), what **shape** to match, and is there a
**declared caveat** in that cell I'd be writing into. That's the `--for propagation` preset (**built**):

```bash
bun run tests:where-is --search orderBy --coord '*/newest' --for propagation
```

```markdown
# where-is: `orderBy` — propagation view
## Classification (summary)               [public] orderBy / orderByFromString
## Coverage — gaps per db (newest cells)  → which sibling cells miss the insensitive test
## Cell caveats — TODO markers in the focused cells (coord-scoped)
- (none naming orderBy here — but a target cell's caveat, e.g. MariaDB's RETURNING limitation for
   RETURNING work, surfaces here before I write — see Case G)
```

**What A.4 surfaced → what shipped:** the `--for propagation` preset (classification · tests gaps ·
examples · `--cell-caveats` · chain none) — and its caveat half is exactly Case G's `--cell-caveats`,
which is why the two were decided together. **P2a (a combined detail+gaps `--tests` shape) was
considered and rejected — not deferred.** It's cheap to build, but it *floods*: to propagate you
already have your **canonical** (the shape to copy) and `gaps` (the worklist); every other cell's test
names are noise you don't consume at once. `detail` is the right tool as a **single-cell on-demand
zoom** (`--tests detail --coord <cell>`), `gaps` the right tool as the compact worklist — keeping them
separate is the tighter design. Merging them would trade tightness for noise.

## Now built: location targeting the *callees on the line*

A asked a "to design" question — sometimes the line *is* a call and you want the callee, not the
enclosing function. Line 1119 calls `_appendOrderByColumnAlias` (the shared *sensitive* emitter, a
different symbol). **This shipped** as `--location-target callees`:

```bash
bun run tests:where-is --search-location src/sqlBuilders/AbstractSqlBuilder.ts:1119 --location-target callees
```

→ resolves to `_appendOrderByColumnAlias`; ≥1 callee on a line → a report per callee. It confirms
the alias emitter is exercised everywhere, so the uncovered part is specifically the insensitive
`lower()` wrapper.

### What A taught → what shipped
- **Per-section levels + combine-by-default** → every section is a levelled flag; the `--for`
  presets bundle the orient set.
- **A full internal call stack**, distinct from the public-only chain → `--chain full`.
- **Cell-level test views** → `--tests detail|gaps`, focused by `--coord` + `--test-name-pattern`.
- **Callee-at-line** → `--location-target callees`.
- *Not shipped:* an auto "branch fires when …" sentence (needs branch reasoning; the agent infers
  it from docs/chain).

---

# Case B — `ValueSourceImpl` (an aggregate-array modifier)

Same exercise, different shape: B's seed is a **fluent method reached by chaining off a producer**,
which surfaces the *receiver* question A never hit.

## The setup

Red line `src/internal/ValueSourceImpl.ts:157`, inside `asOptionalNonEmptyArray()`:

```ts
if (this.__uuidString) { result.__uuidString = this.__uuidString }   // ← 157
```

Problems: **(1)** what is `asOptionalNonEmptyArray`, and what makes the `__uuidString` branch fire?
**(2 — new)** I need a *receiver* — what public call returns the object I call it on? **(3 — new)**
the precondition is the receiver's value *type* (uuid), and uuid needs per-connector setup.

## B.1 — orient (with `--producers`)

```bash
bun run tests:where-is --search-location src/internal/ValueSourceImpl.ts:157 \
    --classification full --producers full --chain full --docs full \
    --signature public-interface --simplified full --tests summary
```

```markdown
# where-is: `asOptionalNonEmptyArray`
## Classification
public-surface member on interface `AggregatedArrayValueSource` (src/expressions/values.ts:975),
implemented on `ValueSourceImpl`. (Line-157 branch fires when the receiver is a **uuid** column.)

## How to obtain a receiver (producers)
- `AbstractConnection.aggregateAsArray…` → returns `AggregatedArrayValueSource` — so the test shape
  is `connection.aggregateAsArray({ id: tUuidTable.id, … }).asOptionalNonEmptyArray()`, where the
  column is **uuid** → sets `__uuidString` → covers line 157.

## Explained in docs (full)
aggregate-as-object-array.md (the feature) · value-expressions.md (the signature) · **uuid setup:**
column-types.md + supported-databases/<db>.md (and SQLite registers uuid functions on the connector).

## Coverage (summary)
covered in 6 dbs (e.g. `select.aggregate-as-array.modifiers.test.ts` → test
`aggregate-as-array-as-optional-non-empty-array`) — but **0** over a uuid column → the gap.
```

`--producers` is the headline: it answers "how do I get a receiver to call this on" (the inverse of
the chain), without which I can't even construct a failing test.

## B.2 — locate + per-connector uuid setup (examples earn their keep)

```bash
bun run tests:where-is --search asOptionalNonEmptyArray \
    --tests detail --examples full --coord postgres/newest/pg --file-name-pattern aggregate \
    --classification none --chain none --docs none --simplified none --signature none --producers none --neg-types none
```

`select.aggregate-as-array.modifiers.test.ts` is the file to extend; the **Legacy examples** section
points at the per-connector uuid-registration recipe (e.g. the SQLite examples register uuid
functions on the connector) — the standing rule: for connector-specific behaviour (esp. SQLite
UUIDs) follow the runner docs + `src/examples`, don't invent handling. Marginal in A, load-bearing here.

### What B taught → what shipped
- **The receiver question ≠ the reach question** → `--producers` (members whose return type resolves
  to the owner interface). Built.
- **`examples` is load-bearing for setup-heavy features** → `--examples full`, and examples are now
  `--coord`-addressable by cell (db/version/connector from the filename).
- *Not shipped:* the "branch precondition" as a named Classification field (same reason as A).

---

# Case C — a real-vs-mock divergence, starting from a test line

A and B were coverage gaps (a red `src/` line). C is a **failing test**: green on the mock, the real
DB rejects the SQL. The agent starts from a **test** line and asks "what SQL did this generate, why
does the real engine reject it, where is it emitted — library bug or an illegal ask?"

## The setup (hypothetical failure)

`test/db/sqlserver/newest/mssql/docs.select.test.ts:482` passes on mock, fails on real SQL Server
("incorrect syntax near 'organizationId' in ORDER BY"). The test does `… .groupBy(organizationId)
.having(…) .select({ organizationId, projectCount }) .orderBy('organizationId')` → emits
`… group by organization_id having … order by organizationId` (order by the **alias**).

## C.1 — the test-line inverse (the entry), then search the suspect

A **test** `--search-location` is the inverse door — it reports the `test_block` and the public API
it exercises (banner-only; it does **not** take section flags):

```bash
bun run tests:where-is --search-location test/db/sqlserver/newest/mssql/docs.select.test.ts:482
```

```markdown
# inverse search: test `…clauses-where-after-orderby`
> resolved …:482 → test (lines 470–497), cell sqlserver/newest/mssql
## Public API this test exercises
- `selectFrom` · `groupBy` · `having` · `count` · `select` · `where` · `orderBy` · `executeSelectMany`
```

The suspect is `orderBy`. Now search **that**, with the debug sections — the emitted SQL + the
dialect emission, focused on the failing db:

```bash
bun run tests:where-is --search orderBy --coord sqlserver/newest/mssql \
    --emitted-sql full --implemented-by full --bugs full \
    --classification summary --chain none --docs none --simplified none --tests detail --examples none --neg-types none
```

```markdown
## Emitted SQL (asserted snapshots)
- `… group by organization_id having … order by organizationId`  — sqlserver/newest/mssql (alias)
## Implemented by
`_buildSelectOrderBy`: base `AbstractSqlBuilder` + **SqlServerSqlBuilder override** (…:232), which
also WRAPS order-by selects in a subquery `select * from (…) _t_N_` (…:227) ⚠️ the alias may be out
of scope in that wrapper — this dialect diverges; the others don't.
## Known divergences (// TODO[BUG])
- (none yet) → if confirmed, record it in test/BUGS.md + a // TODO[BUG], don't fix src/ from a test.
```

The diagnosis: SQL Server is the only dialect that overrides order-by emission **and** wraps it in a
subquery, so an order-by-by-alias is the prime suspect — a real dialect constraint, not a library
bug. (To contrast, `--search orderBy --coord sqlserver/newest/mssql --emitted-sql full
--test-name-pattern 'order'` shows the passing sibling orders by the *column expression*, not the
alias — that contrast IS the diagnosis.)

### What C taught → what shipped
- **`--search-location` over a test → inverse search** (the `test_block` + API it exercises). Built
  — as the **entry**; the debug sections come from a follow-up search on the suspect symbol.
- **An `emitted-sql` section** — the asserted SQL per cell, contrastable. Built (tests + docs).
- **A `bugs` section** (`// TODO[BUG]` / `test/BUGS.md`). Built.
- **Dialect divergence foregrounded** — `--implemented-by` shows the overriders. Built.
- *Not shipped:* a `--real-capable` annotation (the index is static and can't know a *run's*
  outcome; the agent runs the failing test itself, so it already knows the cell is real-capable).

---

# Case D — a syntax bug where the stack is useless (the real handoff)

D is how the handoff **actually** happens, and it kills one of our assumptions. The human runs the
suite against the real DB and says only:

> "revisa que `test/db/sqlite/newest/sqlite3/update.with-old-values-in-returning.test.ts` está fallando."

The agent **re-runs that one test itself** and sees sqlite3 reject the SQL with a syntax error. Then
it's stuck on the one thing tools don't give: **where is the bad SQL emitted, and why only here.**

## Why the call stack — runtime AND static — is the wrong tool

- **Runtime stack: useless.** A syntax error surfaces at *execute* time (`executeQuery → driver.run`);
  the SQL was built earlier, thrown over the wall as a string. The frame that produced the bad token
  isn't on the stack.
- **Static call-chain (`--chain`): equally useless.** `.returning({…})` stores data; the builder
  reads it later — build→execute is **data-flow, not a call edge**.

So for an emission bug the route is **test → emitted SQL → the code that emits *that fragment* → the
dialect decision**, never the chain.

## The setup

The test asserts `update project set name = $1 where id = $2 returning old.name as "oldName" …` —
real sqlite3 rejects `old.` in RETURNING (trigger-only). `oldValues()` has two emission strategies,
chosen by `_useUpdateOldValueInFrom()`: false → `old.<col>` in RETURNING; true → a `_old_` FROM
subquery.

## D.1 — from the SQL fragment to the emission site (no chain)

```bash
bun run tests:where-is --emits-keyword 'returning old.'
```

```markdown
# emits-keyword: `returning old.` — N emission site(s)
## src/sqlBuilders/AbstractSqlBuilder.ts
- `_appendRawColumnName` / the old-column escape (…:288–290) emits `old.<col>` …
Methods to search next (the overriders are the usual suspects): `_appendRawColumnName`, …
```

Then the dialect decision — search the toggle, foreground who does **not** override it:

```bash
bun run tests:where-is --search _useUpdateOldValueInFrom --implemented-by full --version-gates full \
    --classification summary --chain none --signature summary --docs none --simplified none --tests none --examples none --neg-types none
```

```markdown
## Signature
- base `AbstractSqlBuilder._useUpdateOldValueInFrom()` (…:2143) + overrides in
  PostgreSqlSqlBuilder / SqlServerSqlBuilder / the MySQL-Maria builder
  ⚠️ **SqliteSqlBuilder does NOT override it** → inherits the `old.` strategy real sqlite3 rejects.
## Version gates
- PostgreSqlSqlBuilder: `compatibilityVersion < 18_000_000` (the PG18 strategy toggle)
```

**SQLite is the only major dialect that doesn't override `_useUpdateOldValueInFrom()`** → the fix
is a *missing* override, three layers from anything the test or the stack shows.

### What D taught → what shipped
- **`--chain` is the wrong tool for an emission bug** → the `--for emission-bug` preset sets
  `--chain none`. Built.
- **`--emits-keyword <fragment>`** — SQL token → the emitting code. Built (over `sql_emit`).
- **"Who does NOT override" is the finding** — `--implemented-by` lists base + overriders +
  **non-overriders** ("inherits it, does not override"). Built. No chain can express an absence.
- **The dialect decision predicates (`_use*…()`)** are a navigation target — surfaced via
  `--implemented-by` + `--version-gates`.

---

# Case E — a new DB version (PG18): add a feature + a new cell

A–D were point edits; E is **matrix-shaped**: a release changes behavior, so the agent must
version-gate the emission and grow the matrix. Different axis: "how is behavior gated by
compatibility version, and what must the matrix grow."

## The setup (real mechanism)

PostgreSQL 18 adds native `OLD`/`NEW` in `RETURNING`. Today Postgres emulates pre-update values
with a `_old_` FROM subquery; PG18 can emit `old.col` natively. Task: gate the new emission behind
PG≥18, keep the emulation for <18, add a new `newest` cell (today's → a `<18` breakpoint).

## E.1 — the version mechanism + the feature's blast radius

```bash
bun run tests:where-is --search compatibilityVersion --version-gates full --classification summary \
    --docs full --chain none --signature none --implemented-by none --tests none --examples none --neg-types none
```

```markdown
## Version gates
breakpoint 18_000_000:
- PostgreSqlSqlBuilder `_useUpdateOldValueInFrom()` → `compatibilityVersion < 18_000_000` (toggle)
- PostgreSqlSqlBuilder `_appendRawColumnName()` → `>= 18_000_000` emits `old.col`
(plus the MariaDB/etc. gates) → the encoding is major*1_000_000+minor*1_000+patch (PG18 = 18_000_000).
```

For the **blast radius** across statement kinds (the release note covers INSERT/UPDATE/DELETE/MERGE),
the searcher gives the emission sites by fragment, not a single "feature" door:

```bash
bun run tests:where-is --emits-keyword 'returning'        # every RETURNING emission site, per builder
bun run tests:where-is --emits-keyword 'old.'             # the old-qualification sites
```

→ the agent reads off `_buildUpdateReturning` / `_buildInsertReturning` / `_buildDeleteReturning`
and checks each honours the gate (MERGE: the lib has no merge builder → out of scope).

## E.2 — the new cell's file set (stayed with the test CLI)

Creating a new `newest` is governed by `tests:audit` (every cell holds the same files). That's the
**test CLI's** job, not the searcher's:

```bash
bun run tests postgres --list-files        # the files a new postgres version cell must mirror
bun run tests:audit                        # the symmetry gate
```

### What E taught → what shipped
- **A `version-gates` view** — every `compatibilityVersion` comparison + its breakpoint + the gated
  method. Built (over `version_gate`), with the breakpoint encoding visible.
- **Blast radius across statement kinds** → covered by `--emits-keyword 'returning'` (the emission
  sites), not a dedicated door.
- *Not shipped:* `--feature` / `--matrix` doors and a matrix-symmetry section — the scaffolding stayed
  with `tests --list-files` / `tests:audit` (the main CLI already owns it), and a tests "version-split"
  view (`--tests gaps` + `--coord '*/<version>'` cover the need).

---

# Case F — post-fix sync: a fixed bug left SQL stale, and the limits of indexed SQL

F **doesn't need the searcher** — but it's a useful safety net, and it taught where the index's reach
ends. After a fix changes the emitted SQL, every place that *shows* it is stale, and they refresh
differently:

- **test snapshots** — refresh with `bun run tests <coord> --update-snapshots`; they fail loudly.
- **docs** — the `.md` is the source the doc-code extractor turns into generated, then indexed,
  tests; a stale doc SQL silently propagates. User-owned (`test/templates/doc-code/`).
- **legacy examples** — hand-written, **assert at runtime, not via inline snapshots** — so their SQL
  is **not** in the index.

## F.1 — find the stale SQL the searcher *can* see (tests + docs)

```bash
bun run tests:where-is --search <feature> --emitted-sql full --docs full \
    --classification summary --chain none --tests detail --examples summary
```

`--emitted-sql` lists the asserted snapshot occurrences across **tests + docs**, labelled by refresh
kind (tests auto via `--update-snapshots`; docs user-owned, regen via `codegen:doc-code`). And
`--emits-keyword '<old fragment>'` is the **inverse of D's debug use**: D went *fragment → emitting
code*; F goes *fragment → where it's rendered* — to find what a fix left stale.

## The honest limit (the discovery)

The legacy examples' SQL is **not indexed** (runtime assertions, not inline snapshots), so the
searcher can't list a stale *example SQL string*. It can still point at the example **occurrences**
of the symbol (`--examples`) and at the ownership boundary, but for examples the agent must open
them. So `emitted-sql` covers **two** SQL-bearing dimensions (tests + docs), not three.

### What F taught → what shipped
- **`emitted-sql` aggregates the SQL it can index — tests + docs** — labelled by refresh kind. Built.
- **`--emits-keyword` doubles as a stale-sync finder** (fragment → rendered occurrences). Built.
- **`bugs` is light** — `test/BUGS.md` (and `test/LIMITATIONS.md`) are read directly by the agent;
  only the `// TODO[BUG]` / `// TODO[LIMITATION]` markers are indexed (`--bugs` / `--limitation`).
- **Ownership travels with the finding** — the doc source is labelled user-owned (locate, don't edit).
- *The limit:* legacy-example SQL isn't inline, so it isn't in `emitted_sql`; the example dimension is
  coord-addressable by cell, but its SQL text stays out of the index.

---

## Closing — the through-line

Across A–F the same engine served coverage gaps *and* debugging *and* version work, because the
recurring truth is the one A and B first hit and D made fatal: **what triggers a line is usually
*data* — an argument literal, a receiver type, a compatibility version — and the SQL is built before
it runs.** So reachability comes from the chain / producers / version-gates, and emission bugs are
found through the SQL (`--emitted-sql` / `--emits-keyword`), never the stack. The distilled model is
in [`MODEL.md`](./MODEL.md); the flags in [`../../CODE_SEARCH.md`](../../CODE_SEARCH.md).

---

# Case G — a declared caveat blocks the work

> **Built (shipped as `--cell-caveats`).** A–F drove the original searcher; G drove this addition —
> surfacing the `// TODO[BUG]` / `// TODO[LIMITATION]` caveats that apply to the **cells you're about
> to write into**, *before* you write. Anchored to two real caveat families in the repo. Reasoned as a
> case first, *then* built: the result is the coord-scoped `--cell-caveats` section + its place in the
> `coverage-gap` / `propagation` presets, and the name-scoped `--bugs`/`--limitation` added to the
> feature-centric presets (P1a).

## The setup (the real repo)

Two real caveat families, indexed as `todo_marker`, with **opposite scoping**:

- **A BUG that names its symbol.** [`BUGS.md`](../../BUGS.md) § `virtualColumnFromFragment` — a
  `// TODO[BUG]` at `with-values.advanced.test.ts:238` in **every newest cell** (×10); the marker
  text *contains* `virtualColumnFromFragment`.
- **A LIMITATION scoped to a dialect+version.** [`LIMITATIONS.md`](../../LIMITATIONS.md) § "MariaDB
  UPDATE … RETURNING requires 13.0.1+" — `// TODO[LIMITATION]` across the 7 `mariadb/newest/mariadb/`
  update files (plus the cross-dialect `update.with-old-values-and-from.test.ts`); the marker text
  names the **feature / dialect / version** ("UPDATE … RETURNING … MariaDB 13.0.1+"), **not** a
  public method name.

A–F's blocker was always a **reachability** question (how do I reach / obtain / emit this?). G's is
different: **the library deliberately doesn't do X here, or there's a known bug** — and a test that
ignores it is invalid. The searcher should hand me that *before* I write, not the quality gate after.

## G.1 — the BUG variant: name-scoped, already works, just not in a preset

I'm fixing around `virtualColumnFromFragment` (an emission-bug / post-fix round) and want to know if
there's an open bug on it:

```bash
bun run tests:where-is --search virtualColumnFromFragment --bugs summary
```

```markdown
## Known divergences (// TODO[BUG])
- with-values.advanced.test.ts:238 (×10 newest cells) — "virtualColumnFromFragment + bare-literal
  `fragment.sql`… fails TS overload resolution" → see BUGS.md
```

This **works today** — the marker text names the symbol, so the name-scoped `--bugs` filter hits.
The only gap: it shows only if I *flag* `--bugs`; of the feature-centric presets only `emission-bug`
carries it, so on `version-work` / `post-fix-sync` I miss the open bug unless I remember. **Cheap
win:** add `--bugs summary` / `--limitation summary` to the feature-centric presets (call it **P1a**).

## G.2 — the LIMITATION variant: coord-scoped, the real gap

I'm in a coverage-driven round. Gaps point me to add UPDATE … RETURNING / `oldValues()` coverage,
and I see cells missing it in `mariadb/newest/mariadb`. I propose a wave — "add the UPDATE … RETURNING
test on MariaDB" — and run:

```bash
bun run tests:where-is --search oldValues --for coverage-gap
```

A `--limitation` in the preset (P1a) would catch the markers whose text says `oldValues()` — but
**misses** the "UPDATE … RETURNING … MariaDB 13.0.1+" markers (no `oldValues` in their text), and
would catch **nothing** if my wave symbol weren't `oldValues` at all. The blocker — *MariaDB ships
12.x, the feature needs 13.0.1+, the cells already have the bodies commented out with
`TODO[LIMITATION]`* — is about the **cell**, not my symbol. So coverage-gap is blind to it, I propose
the wave, and the quality gate rejects it: I just re-added a test that can't pass on the current image.

What I need — caveats in the **cells my `--coord` / gaps touch**, not by symbol name. **This is what
shipped** as `--cell-caveats` (and it rides the `coverage-gap` preset, so the `--for coverage-gap`
above already includes it once a `--coord` is given):

```bash
bun run tests:where-is --search oldValues --coord mariadb/newest --for coverage-gap
```

```markdown
## Cell caveats — TODO markers in the focused cells (coord-scoped)
- **mariadb/newest/mariadb**
  - [LIMITATION] update.returning.test.ts:18 — UPDATE … RETURNING only on MariaDB 13.0.1+ (MDEV-5092)…
  - [LIMITATION] docs.update.test.ts:68 — UPDATE … RETURNING only on MariaDB 13.0.1+ …
  - …(the 7 mariadb update files)
  → do NOT propose a RETURNING wave here; it can't pass on the current image.
```

It lists **all** the cell's caveats, including the "UPDATE … RETURNING" markers that never name
`oldValues` — the exact ones the name-scoped `--limitation` misses.

## G.3 — same markers, version-work angle

When `mariadb:latest` finally ships 13.0.1+, the worklist is the inverse: *uncomment the bodies
guarded by those `TODO[LIMITATION]`s*. The **same `--cell-caveats`** answers it —
`--coord mariadb/newest --cell-caveats full` lists the exact files to revisit. One mechanism, two uses:
"don't write into a limited cell" and "now un-limit these cells."

## What case G surfaced → what shipped

- **The blocker can be a *declared caveat*, not a reachability question** — an axis A–F never hit.
- **Two scopings, two answers — both built:**
  - **name-scoped (P1a):** caveats whose text names the symbol (`virtualColumnFromFragment`) →
    `--bugs`/`--limitation` summary added to the feature-centric presets (`emission-bug`,
    `version-work`, `post-fix-sync`).
  - **coord-scoped (P1b):** dialect/version/cell-scoped caveats (MariaDB RETURNING) are invisible to a
    name filter → the new `--cell-caveats` section: `caveatMarkers` (all BUG+LIMITATION) filtered by
    `cellFromPath(marker) ∈ --coord`. In `coverage-gap` / `propagation`.
- **The mechanism decision we made:** `--cell-caveats` shows **all** caveats in a touched cell, *not*
  coord ∩ name (the whole point of G.2 is a caveat that doesn't name the symbol). It's a normal
  levelled section (no magic auto-fire); it needs a `--coord` and prints a hint without one. §A.4
  (propagation) shares the identical mechanism — deciding it once settled both.

## A follow-up considered and rejected: auto-scoping caveats to the gap cells

After shipping `--cell-caveats`, we considered auto-firing it at the **no-`--coord` coverage-gap
orient** (scoped to the symbol's gap cells), so the very first orient would flag a blocked wave.
Building this mini-case and verifying against the index settled it — and killed it:

- The motivating data *holds*: the limited MariaDB tests are **commented out** → no `test_block` →
  `--search oldValues --tests gaps` reports `mariadb ✗ MISSING entirely`. So the limited cells **are**
  genuine gaps, and an auto-scoped `--cell-caveats` *would* catch the RETURNING limitation.
- But it fails the **noise test** and the **timing test**:
  - `--cell-caveats` lists **all** caveats in a cell (by design — G.2), so auto-firing across every
    gap cell surfaces caveats unrelated to the wave: an `orderBy` wave whose gaps include mariadb would
    show the RETURNING limitation. Noise.
  - `--cell-caveats` **already rides** the `coverage-gap`/`propagation` presets, so it fires the moment
    the agent adds a `--coord` — exactly when it picks the cells it will write into. The guardrail is
    already at the precise moment; the no-coord orient is a pure overview.

So the explicit, focused `--cell-caveats --coord <target>` (already in the preset) is the right tool;
the auto-scope trades precision for an earlier, noisier signal. **Not built** — and this is the record
of *why*, so the idea doesn't get re-proposed.

---

# Case H — proving the type-safety promise: a documented hole with no lock

> **Partly built.** A–G are about positive coverage and the bug-fixing loop. H turns to the other half
> of the suite's job: the **negative** tests that prove ts-sql-query's actual promise — *"if it
> compiles, it works"*. They assert an **invalid** construction **does not compile**, so a query the
> dialect can't run never reaches the database. The negative surface is thin (**219** `@ts-expect-error`
> assertions vs ~14k positive tests) and **reactive** — it grew only where a bug forced a lock (Case I).
> H is the *proactive* author closing that debt. Anchored to a real, documented hole. **Outcome:** H's
> searcher need — `--neg-types full` showing the rules — **shipped**; the *"what's missing"* analysis it
> also wanted is a future **type-coverage** tool, **out of scope** (see the closing).

## The setup (the real repo)

[`LIMITATIONS.md` § "Aggregate functions are not flagged as aggregates in the type system"](../../LIMITATIONS.md)
says it plainly: the type system does **not** stop you from putting `connection.count(tFoo.id)` in
`.where(...)`; the engine rejects it at runtime ("aggregate functions are not allowed in WHERE"). It
even instructs the test author: *"never put an aggregate in where … treat as test author error, not a
bug."* That is a **type-safety hole the library documents** — exactly what a negative test should lock:
`selectFrom(t).where(connection.count(t.id).greaterThan(0))` should **fail to compile**, and today it
doesn't.

## The situation (the negative author's chair)

I'm closing the negative-test debt and want to lock the aggregate-in-WHERE hole. But I can't just write
the `@ts-expect-error` — it would *fail* (the line compiles today, so the directive reports "unused").
The lock can only exist once the **type** narrows. So my real questions: is anything already locked
here, what's the convention, and is this a *narrow-and-lock* or an *accept-the-hole* decision?

## H.1 — "show me the negatives that already exist" (built)

To write a *consistent* new assertion I need the **rules**, not a number — the `@ts-expect-error`
wording, the rejected snippet, the file:line. The count was all `--neg-types` used to give; now
`--neg-types full` lists the assertions (the index already stored them in `neg_type.description` /
`snippet` / `marker_line`):

```bash
bun run tests:where-is --search onConflictDoUpdateSet --neg-types full
```

```markdown
## Negative-type assertions
- 5 (postgres 3, mysql 1, mariadb 1)
  · postgres/types.negative/insert.test.ts:67 — bare onConflictDoUpdateSet on PG via .set(...) — needs onConflictOn(col)
      void connection.insertInto(tOrganization).set({ name: 'x', plan: 'pro' }).onConflictDoUpdateSet({…
  · postgres/types.negative/insert.test.ts:69 — bare onConflictDoUpdateSet on PG via .values([...]) — needs onConflictOn(col)
  · mariadb/types.negative/insert.test.ts:70 — .where after .onConflictDoUpdateSet is not typed on MariaDBConnection
```

Now I can match the wording convention and the per-form shape when I add a fourth lock. (`summary`
keeps the compact count — the overview; `full` is the opt-in detail.)

## H.2 — "what's declared but not locked?" — out of scope (a type-coverage tool)

The aggregate hole is **documented** but has **no** `@ts-expect-error` — verified: no `neg_type` row
locks an aggregate in `where`. The tempting next step is a *negative-coverage-gap lens*: cross-reference
declared restrictions (LIMITATIONS, the dialect narrowing) against existing `neg_type`, and list what's
unlocked. **This is deliberately NOT the searcher's job.** Knowing *what type-safety is missing* is the
type-level equivalent of **runtime code coverage** — it belongs to a future **type-coverage** tool, not
a static index query. The wall is the same one that stopped `--real-capable`: the searcher can show
*"no lock here, here's the documented hole, the type allows it today"*, but deciding what *should* be
invalid is dialect/type semantics it can't compute.

## What case H surfaces (built + the boundary it drew)

- **Built:** `--neg-types full` now shows the actual assertions (rule + snippet + file:line) — the index
  already stored them; only `negCoverage` (count) was exposed. Shared with Case I.
- **Out of scope (boundary drawn):** the *negative-coverage gap* — *"which declared restrictions lack a
  lock"* — is a **type-coverage** tool, the type-level twin of runtime code coverage, not the searcher.
  The searcher *informs* the narrow-or-accept decision (shows the hole + that nothing locks it); it
  doesn't compute what ought to be invalid.

---

# Case I — the two-step fix's negative lock: a premise verified false

> **Built (and it corrected a wrong assumption).** I is Case H's reactive twin, on the bug-fixing loop
> (cases C/D/F). The panorama's biggest bug class was *"TS accepts something the runtime rejects"* — a
> type too loose. The recorded fix is **two-step**: narrow the connection's typed surface, **then** add
> a `@ts-expect-error` lock under `types.negative/`; the panorama recorded the redirection where agents
> did the **one-step** fix and forgot the lock. I was meant to surface that `--for emission-bug` lacks
> the negative surface — but **verifying it killed that premise**: emission-bug *already* shows
> `--neg-types`. The only real gap was the detail, now built.

## The setup (a real shipped fix)

Bug `9b5ab1c` (real): `PostgreSqlConnection` accepted the bare `onConflictDoUpdateSet({...})`, but
PostgreSQL requires a conflict target — runtime rejection, green on the mock. The fix narrowed
`PostgreSqlConnection` so the bare form no longer types. Step 2 was to lock it, so a regression that
re-loosens the type fails at compile time. The locks shipped — `--search onConflictDoUpdateSet
--neg-types` reports **5** (postgres 3, mysql 1, mariadb 1), which read as the dialect-specific rules:
*"bare onConflictDoUpdateSet on PG via .set(...) — needs onConflictOn(col)"* (×3 forms) + *".where
after onConflictDoUpdateSet is not typed on MySql/MariaDBConnection"*.

## The situation (the fixing agent's chair, step 2)

I found and fixed the bug with `--for emission-bug`. Now I must write the lock. I need the **existing**
negative assertions for this symbol (to copy the wording convention and the per-form shape) and which
cells take it. Two frictions:

## I.1 — the premise: "`--for emission-bug` doesn't carry the negative surface" — FALSE

```bash
bun run tests:where-is --search onConflictDoUpdateSet --for emission-bug | grep -i negative
# → ## Negative-type assertions      ← it IS there.
```

Presets apply *over* the defaults (`{...DEFAULT_SECTIONS, ...preset}`), and `--neg-types` defaults to
`summary`; `emission-bug` never suppresses it. So the fix flow **already** sees the negative section.
The assumption (echoed from an earlier review) was wrong — and verifying it before building is what
caught it. The detection/diagnosis and the lock-writing are *already* in one report.

## I.2 — the real (and only) gap: it was a count, not the rules

The negative section showed `- 5 (postgres 3, mysql 1, mariadb 1)` — enough to know locks exist, not
enough to model a fourth. `--neg-types full` now lists the three PG bare-form rules + their snippets
(Case H.1), so I can write a consistent new `@ts-expect-error`. That detail is the whole fix.

## What case I settled

- **Built:** `--neg-types full` shows the rules (shared with H) — the only real gap.
- **Preset E rejected, not deferred.** E (`--for negative-types`) was meant to carry the negative surface
  into the fix flow — but `emission-bug` already does. A separate preset would *re-split* the two-step
  fix into two reports for no gain. The reactivation trigger turned out to dissolve on contact with the
  facts. (Recorded in [`MODEL.md` §6](./MODEL.md).)
- **The lesson repeats G's:** building the case and **verifying against the tool** before changing it is
  what turned a plausible feature (a new preset) into a one-line detail fix.

