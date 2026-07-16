# Test-suite-discovered bugs

Bugs the new `test/` suite has surfaced while running. Each entry is a
single, reproducible issue; once fixed in `src/`, remove the TODO[BUG]
comment in the corresponding test and delete the entry here.

Per project policy ([`CLAUDE.md`](../CLAUDE.md)), the agent does NOT
touch `src/` when finding bugs — only documents them and marks the
test so the suite stays green. Division of labor (test author vs
fixing agent) is detailed in
[`WRITING_TESTS.md` § When a test surfaces a bug in `src/`](./WRITING_TESTS.md#when-a-test-surfaces-a-bug-in-src).

## Read this file in full — this section is the one to internalise

Whether you're **documenting** a new bug or **picking up an entry to
fix**, read every section of this file (every open entry below, the
"How to write an entry" recipe, the bug-shape presets at the bottom).
None is optional. This section in particular is the one prior sessions
skipped — internalise it before any `grep` or `Read` over `src/`:

1. **Read [`CODE_SEARCH.md`](./CODE_SEARCH.md) in full** once at session
   start (the doors, the sections, the presets, the cross-cutting reading
   conventions — all of it is operational). Pay special attention to
   [§ "This tool vs. textual search"](./CODE_SEARCH.md#this-tool-vs-textual-search):
   it defines when `tests:where-is` answers the question (symbol
   declarations, overload sites, type-arg blast radius, call-chain,
   neg-types, cell caveats) and when `grep` / the compiler still win
   (literal prose, byte-anchored edits, assignability decisions).
2. **Refresh the index**: `npm run tests:index` (~2 min, ~12 GB peak, gitignored).
3. **Treat the entry's `Where:` / `Reproduction:` lines as starting
   points, not ground truth.** The test author wrote them from what
   they saw; the searcher gives you every declaration site, every
   implementing class, every test that exercises the API, every
   first-class reason marker that names the symbol (`// TODO[BUG]`,
   `// TODO[LIMITATION]`, `// NOT-APPLICABLE`), and the wrap shape
   across cells — in one report.

   Recent miss: an entry on `virtualColumnFromFragment` named
   `View.ts` and `Values.ts`; the symbol also lives in `Table.ts`.
   A fix that grepped only the two listed files would have left
   `Table.ts` regressed. `--declared full` lists all three.

The presets for the two main bug shapes live in
[§ "Common bug shapes"](#common-bug-shapes-for-the-fixing-agent) below
(read them, even if your bug is "obvious"); the searcher-first triage
flow for test authors lives in
[`WRITING_TESTS.md` § When a test surfaces a bug in `src/`](./WRITING_TESTS.md#when-a-test-surfaces-a-bug-in-src).

## How to write an entry (test author)

Keep it short — enough to reproduce, no deeper. The fixing agent
takes it from there. Recommended structure:

```markdown
## <One-line title naming the symptom>

**Where**: file + line, or class/method, or docs page reference.
**Reproduction**: the test that surfaces it, the SQL the lib emits
(if applicable), the runtime/type error observed.
**Current workaround in the suite**: which tests are wrapped /
marked, and with what reason line.
```

That's the contract. Do **not** spend time diagnosing the root cause,
choosing a category, or proposing a fix — the fixing agent owns all
of that. Two minutes of triage and one paragraph is the bar.

## Open Bugs

Most entries below are a **silently wrong value** rather than a rejection, and
most are invisible to the matrix as it stands — each entry says why under
*Current workaround in the suite*. A `none` there is not "nothing to do": it
means no test would notice a regression either.

### The microsecond coverage gap (not a bug — a gap the next round should close)

The date-part truncation defects fixed in this round are only **half covered**.
`const-localdatetime-subsecond-getters-truncate`
(`select.value-source.const-temporal-getters.test.ts`, all 17 cells) locks the
sub-second contract with `:59.999` and `:01.001` — plain millisecond instants,
which a JavaScript `Date` expresses exactly — and it does catch the two worst:
PostgreSQL reporting a 60th second, and SQLite losing the millisecond of
`:01.001`.

But **a JS `Date` has millisecond precision, so no test written through the
public API can reach the sub-millisecond cases**: PostgreSQL's
`getMilliseconds()` rounding `.9996` up to `0`, and MySQL / MariaDB's returning
`1000` for `999600 µs`. Both are fixed, neither is locked. Those instants can
only enter through a **column** holding microseconds — which is exactly how they
arise in the wild, since `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP` stores
microseconds on PostgreSQL and Oracle.

Closing it needs a fixture change, not a test-only one: `TIMESTAMP` /
`DATETIME(6)` columns seeded with sub-millisecond values. Note the column types
differ — MySQL / MariaDB `DATETIME` holds **whole seconds** and SQL Server
`DATETIME` ~3.33 ms, so the schemas would need `DATETIME(6)` / `DATETIME2(7)`
before any such fixture can hold the value.

## Five query runners lose `bigint` precision beyond 2^53

**Where**: the query runners — `MySql2QueryRunner`, `OracleDBQueryRunner`,
`BetterSqlite3QueryRunner`, `Sqlite3QueryRunner`, `NodeSqliteQueryRunner`.

**Reproduction**: `tIssue.priority.asDouble().asBigint().add(9007199254740993n)`
now emits SQL that computes `9007199254740995` **exactly** on every engine (the
cast added in this round is what makes the arithmetic exact), but five runners
marshal that result through a JavaScript number on the way back:

| connector | returns | |
|---|---|---|
| `mysql2` | `9007199254740996n` | clean, wrong |
| `oracledb` | `9007199254740996n` | clean, wrong |
| `better-sqlite3` | `9007199254740996n` | clean, wrong |
| `sqlite3` | `9007199254740994n` | clean, wrong |
| `node_sqlite` | throws `SQL_INVALID_VALUE` | loud |
| **pg, postgres, pglite, mssql, mariadb, bun_sql_*, sqlite-wasm-OO1, …** | **`9007199254740995n`** | **correct** |

The value is integral, so `transformValueFromDB`'s `bigint` arm coerces it with
`BigInt(...)` and hands the caller a **clean, wrong `bigint`** — no error, no
warning. Only `node_sqlite` refuses (`RangeError: Value is too large to be
represented as a JavaScript number`), which is why it is the loud one.

Twelve of the seventeen cells return the exact value, so this is a runner
configuration gap rather than an engine limit: each driver has a knob for it
(`better-sqlite3` `safeIntegers`, `mysql2` `supportBigNumbers` /
`bigNumberStrings`, `oracledb` fetch type handlers). The library declares the
column `bigint`; the runner should be configured to preserve it.

**Current workaround in the suite**:
`{mysql/newest/mysql2, oracle/newest/oracledb, sqlite/newest/better-sqlite3,
sqlite/newest/sqlite3, sqlite/newest/node_sqlite}/select.value-source.casts.test.ts`,
test `asBigint-on-double-keeps-bigint-arithmetic-exact` — commented out with a
`// TODO[BUG]` in those five cells; it runs and validates in the other twelve.

## Oracle: an inline scalar subquery keeps a bare `ORDER BY`, which Oracle rejects

**Where**: `OracleSqlBuilder._buildSelectLimitOffset` (~line 617, injection at
~620) — its gate, not the `forUseAsInlineQueryValue()` path itself.

**Reproduction**: a one-column select carrying `orderBy` consumed via
`.forUseAsInlineQueryValue()` renders as
`(select ... from t window w1 as (...) order by "result")` in the SELECT list.
Oracle rejects it with **ORA-00907: missing right parenthesis**.

**The rule is narrower than "Oracle forbids ORDER BY in a scalar subquery"** —
that premise was falsified by probing `gvenzl/oracle-free:23-slim-faststart`:

```
(SELECT dummy FROM dual ORDER BY dummy)                             → ORA-00907
(SELECT dummy FROM dual ORDER BY dummy OFFSET 0 ROWS)               → OK
(SELECT dummy FROM dual WINDOW w1 AS (...) ORDER BY dummy
                                          OFFSET 0 ROWS)            → OK
```

Oracle rejects a **bare** `ORDER BY` in a scalar subquery but accepts one
carrying a row-limiting clause. A live, green test proves it:
`oracle/newest/oracledb/cte.recursive-union-variants.test.ts:1141`
(`recursive-result-order-by-limit-inline-scalar-value`) emits
`(select result ... order by result fetch next :1 rows only)` and runs against
real Oracle.

So the derived-table wrap is a red herring: what makes the aggregated-array
sibling work is the `offset 0 rows` **inside** the wrap, not the wrap — Oracle
silently *ignores* an `ORDER BY` in a derived table with no row-limiting clause
(`OracleSqlBuilder.ts:621` says so itself).

**SQL Server has the identical workaround and gates it on a different, working
predicate** — `SqlServerSqlBuilder._buildSelectLimitOffset` (~344, injection at
~360) fires on `!this._isCurrentRootQuery(query, params)`, which covers every
non-root select; Oracle gates on `this._isAggregateArrayWrapped(params)`, which
is true only inside the aggregate wrapper. **That divergence is the bug.**
Converging Oracle onto SQL Server's predicate fixes this *and* the adjacent
defect below, but needs one probe first: that the injection cannot reach a
recursive CTE member, where `offset` is illegal.

**Adjacent, not filed separately**: the same gate means an Oracle CTE body or
derived table carrying `ORDER BY` outside the aggregate wrapper gets no
`offset 0 rows`, and Oracle **silently ignores that ordering** (e.g.
`cte.recursive-union-variants.test.ts:1279`, `:1040`,
`customize-query.select.test.ts:249`). Semantic, not syntactic, and masked
wherever the natural row order happens to match.

**Current workaround in the suite**:
`oracle/newest/oracledb/customize-query.select.test.ts`, test
`customize-recursive-one-column-custom-window-and-ordering-in-inline-scalar-value`
— commented out with a `// TODO[BUG]` (line comments, because the body embeds
`/* hint */` fragments).

## MariaDB: `uuidStrategy` is documented but does nothing

**Where**: `MariaDBConnection.ts:19` declares `uuidStrategy: 'string' | 'uuid'`,
and `docs/configuration/supported-databases/mariadb.md:103-109` instructs users
to override it.

**Reproduction**: `MariaDBSqlBuilder` and `AbstractMySqlMariaBDSqlBuilder`
contain **zero** references to `uuidStrategy`, `_getUuidStrategy`, `_asString`
or `_isUuid` — MySQL, SQLite and Oracle each declare their own
`_getUuidStrategy()`, and there is no base implementation to inherit. Both
MariaDB strategies happen to need no SQL conversion, so no value is wrong
today; the option is simply inert while the docs promise it works.

Either wire it up or remove it from the connection and the docs page. Note the
uuid→string concept is hand-spelled in five places with no shared seam — the
same drift generator as the date-part extractors above.

**Current workaround in the suite**: none.

## Common bug shapes (for the fixing agent)

Reference for the agent picking up entries above. The test author
does NOT need to classify entries against these shapes when writing
them — pattern-matching the symptom to a shape is the fixing agent's
first move, not the detector's.

**First, locate every declaration site of the symbol** —
`npm run tests:where-is -- --search <symbol> --declared full` lists ALL
declaration sites. Trust the index over the entry: the files named in
the open entry are the ones known when it was filed, and they can be
**incomplete**. (Past miss: an entry on `virtualColumnFromFragment`
named `View.ts` and `Values.ts`; the symbol also lives in `Table.ts`
and a fix that grepped only the two listed files would have left
`Table.ts` regressed.)

Then gather the context appropriate to the bug's shape:

- **SQL-emission bug** (the lib emits SQL the engine rejects, or the
  emitted SQL is wrong) — `npm run tests:where-is -- --search <symbol> --for emission-bug`
  bundles `emitted-sql full · implemented-by full (non-overriders) ·
  version-gates · bugs full · limitation · not-applicable · chain
  none`: the SQL the symbol emits across tests and docs, every
  implementing class, the compatibility-version branches that gate
  the method, sibling `// TODO[BUG]` markers and any declared
  `// TODO[LIMITATION]` / `// NOT-APPLICABLE` that names the symbol.
  `chain` is off on purpose — emission happens after the call-chain,
  so the chain never reaches the emission site; use
  `--emits-keyword <sql-fragment>` to walk back from the SQL token
  to the builder code instead.
- **Type-system bug** (overload selection, variance, assignability —
  the symbol's typing rejects or accepts something it shouldn't) —
  `npm run tests:where-is -- --search <symbol> --for type-bug` bundles
  `declared full · signature full · ref-type-arg full · neg-types
  full · bugs summary · limitation summary · not-applicable summary ·
  chain none`: every declaration + signature, every place the type is
  **used as a type argument** (the blast radius of an alias), the
  existing `@ts-expect-error` locks and sibling markers. The route
  for a type
  bug is the signature, not the call-chain — `chain` is off for the
  same reason as `emission-bug`. Before inventing a new helper or
  type alias, run `--search-pattern-summary '<shared-token>'` to
  check whether the shape already exists under a different name
  (past near-miss: nearly re-introduced `AllowsNoTableOrViewRequired`
  by hand).

Each entry above usually falls into one of these:

- **TS accepts something runtime rejects** — a method typed on a
  connection class whose dialect refuses the SQL it emits. Mock
  cells silently pass (the SQL is never executed); only the real-DB
  cell surfaces the rejection. Treat as a typing gap: the type
  should narrow. The fix is two-step: tighten the connection's typed
  surface in `src/connections/<DB>Connection.ts` (or wherever the
  method is exposed), then add a `@ts-expect-error` rule under
  `test/db/<db>/types.negative/` that locks the new narrower
  contract. Example shipped: commit `9b5ab1c` on
  `PostgreSqlConnection.onConflictDoUpdateSet`.
- **TS rejects something the docs page describes** — the docs show a
  call that doesn't typecheck on the connection that snippet is
  supposed to demonstrate. Either the docs page is stale or the lib
  types are too tight. The fix is either to widen the type or to
  update the docs page; check both before assuming one.
- **Two equivalent forms documented but only one is typed** — the
  docs describe two interchangeable forms per dialect (e.g.
  "MariaDB/MySQL use bare `.onConflictDoUpdateSet({...})`;
  PostgreSQL/SQLite use `.onConflictOn(col).doUpdateSet({...})`")
  and the lib types let you use the wrong form on a given dialect.
  The fix narrows the typed surface for the dialect that should not
  accept that form.
- **A snippet references a public symbol that no longer exists** in
  the current `exports` map of [`package.json`](../package.json) —
  the page is stale or the symbol was removed. The fix is to update
  the docs page or restore the export.

When the fix lands:

1. Patch `src/` and add the negative-type test (where applicable).
2. Remove the corresponding entry from the open list above.
3. **Walk every place that reflected the old behaviour**:
   `npm run tests:where-is -- --search <symbol> --for post-fix-sync` bundles
   `emitted-sql full · docs full · examples full · tests detail · bugs
   · chain none` — every asserted SQL across tests and docs, the doc
   pages that explain it, the legacy `src/examples/` occurrences,
   per-test references, and any remaining `// TODO[BUG]` markers that
   still mention the symbol (typically the entry you're closing here).
   Anything still naming the old behaviour needs refreshing.
4. Walk `grep -rn "TODO\[BUG\]" test/db/` and either uncomment the
   wrapped tests (if the fix re-enables the snippet) or **switch the
   marker to its final category**. If the fix establishes that the
   feature simply doesn't exist on this dialect, the right marker is
   `// NOT-APPLICABLE: <reason>; see test/db/<db>/types.negative/<file>.ts
   for the compile-time negative` — a permanent dialect boundary, not
   pending work. If the bug exposed an unsolved library gap, use
   `// TODO[LIMITATION]: see LIMITATIONS.md — <one-line>` instead.
5. Push the changelog entry under
   [`docs/CHANGELOG.md`](../docs/CHANGELOG.md) describing the
   user-visible change.
