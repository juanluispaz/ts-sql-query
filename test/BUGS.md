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

Every entry below is a **silently wrong value** confirmed against a real
engine, and every one is invisible to the matrix today — see
"Why the suite can't see any of this" at the end of the date-part section.

## PostgreSQL: `getSeconds()` returns 60 and `getMilliseconds()` returns 0

**Where**: `PostgreSqlSqlBuilder._getSeconds` (~line 459) and
`_getMilliseconds` (~462).

**Reproduction**: the emission is `extract(second from x)::integer`.
`extract(second …)` returns a **numeric including the fraction** (`45.9996`),
and PostgreSQL's `numeric::integer` cast **rounds** (away from zero) instead of
truncating. Both methods mirror JavaScript's `Date` accessors, so `getSeconds()`
is declared `int` (0–59) and `getMilliseconds()` `int` (0–999) — the values
below cannot exist in the declared type. Probed against `postgres:18-alpine`:

```
                             lib_seconds  correct   lib_ms  correct
 12:30:45.9996                    46         45        0      999
 12:30:59.9996                    60 (!)     59        0      999
 12:30:59.5                       60 (!)     59      500      500
```

**Oracle spells the same concept `trunc(extract(second from x))`
(`OracleSqlBuilder.ts:1055`)** — truncation is the library's own intended
semantics, and PostgreSQL drifted from it. MySQL (`second()`), SQL Server
(`datepart`) and SQLite (`strftime('%S')`) all truncate correctly.

Fix verified on the same server: `trunc(extract(second from …))::integer` →
45 / 59 / 59, and `trunc(extract(millisecond from …))::integer % 1000` →
999 / 999 / 500.

**Current workaround in the suite**: none — no test covers it (see below).

## MySQL / MariaDB: `getMilliseconds()` returns 1000

**Where**: `AbstractMySqlMariaBDSqlBuilder._getMilliseconds` (~line 560).

**Reproduction**: the emission is `round(microsecond(x) / 1000)`.
`microsecond()` is an int 0–999999, so `int / 1000` is an **exact** (DECIMAL)
division, and MySQL rounds an exact operand **away from zero**. Probed against
`mysql:9` and `mariadb:latest`:

```
 microsecond('12:30:45.999600') = 999600 → round(999600/1000) = 1000 (!)   floor → 999
 microsecond('12:30:45.123500') = 123500 → round(123500/1000) =  124       floor → 123
```

`1000` is not a value `Date.getMilliseconds()` can return. Same family as the
`_divide` / `_cbrt` defects fixed in this round: the operand is exact, so the
engine applies its exact-arithmetic rules. Fix: `floor(microsecond(x) / 1000)`.

**Current workaround in the suite**: none — no test covers it (see below).

## SQLite: `getMilliseconds()` is off by one for 372 of 60 000 timestamps

**Where**: `SqliteSqlBuilder._getMilliseconds` (~line 375, the default branch at
~381).

**Reproduction**: the emission is `strftime('%f', x) * 1000 % 1000`.
`strftime('%f')` yields the **string** `"01.001"`, which coerces to a REAL
(approximate) → `× 1000` = `1000.9999999999999` → SQLite's `%` casts its
operands to integer, **truncating** → `1000 % 1000` = 0. So `12:30:01.001`
returns `0` instead of `1`.

The affected-seconds histogram is an IEEE binade fingerprint — only powers of
two, doubling each step:

| seconds field | 1 | 2 | 4 | 8 | 16 | 32 | total |
|---|---|---|---|---|---|---|---|
| wrong ms values | 12 | 12 | 24 | 47 | 92 | 185 | **372** |

Affects every SQLite connector (it is an emission defect, not a driver one).
The sibling branch at ~379 (`x % 1000`) is exact and correct — **the two
branches of the same method disagree**, which is the tell. Fix:
`cast(round(strftime('%f', x) * 1000) as integer) % 1000` → 0 of 60 000 wrong.

**Current workaround in the suite**: none — no test covers it (see below).

## SQLite: pre-1970 unix-ms timestamps truncate toward zero instead of down

**Where**: `SqliteSqlBuilder.ts` ~309, 331, 339, 347, 355, 363, 371 and ~379 —
the `'Unix time milliseconds as integer'` date format.

**Reproduction**: the emission divides two integers (`x / 1000`), which SQLite
truncates **toward zero** rather than flooring. Correct for positive timestamps,
wrong for negative ones: with `x = -1500` (`1969-12-31 23:59:58.500`),
`getSeconds()` returns `59` (correct: 58) and `x % 1000` returns `-500` — a
negative millisecond. Narrow reach (pre-1970 dates in the ms-integer format
only) but the same family. Fix: `cast(floor(x / 1000.0) as integer)`, and
`((x % 1000) + 1000) % 1000` for the ms component.

**Current workaround in the suite**: none — no test covers it.

### Why the suite can't see any of the four above

**No seeded fixture has sub-millisecond precision.** Every date-part bug above
needs a timestamp with microseconds (`.9996`, `.999600`, `.001`) to surface;
the baked snapshots only use `.123`-style values, where `round ≡ trunc` and the
defect vanishes. The single highest-leverage change here is to add
sub-millisecond fixtures — the emission bugs then surface on their own.

The class was found by asking *"which dialects hand-spell one concept, and do
they agree?"*: `getSeconds()` / `getMilliseconds()` are spelled independently in
all five builders, three of them are wrong, and each is wrong in a different
way. Oracle's `trunc(...)` is what revealed the intended semantics.

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

## Unreachable base-dialect methods that emit invalid or wrong SQL

**Where**: `AbstractSqlBuilder` — `_stringConcat` (~3454) / `_stringConcatDistinct`
(~3463), `_getTime` (~3102), `_getMilliseconds` (~3123), `_getSeconds` (~3120).

**Reproduction**: all five are overridden by **every** dialect, so no connection
reaches them today — they are dormant, not live defects. Each is nonetheless
wrong, and would bite the first dialect that inherits one:

- `_stringConcat` emits `string_concat(…)`, **a function no supported engine
  has** (the real names are `string_agg` / `group_concat` / `listagg`).
- `_getTime` emits `extract(epoch from x)` → **seconds**, while every override
  returns **milliseconds** — a 1000× divergence.
- `_getMilliseconds` emits `extract(millisecond from x)` → `45123`
  (sec × 1000 + ms), not the 0–999 component; the `% 1000` is missing.
- `_getSeconds` emits `extract(second from x)` → a fractional `45.123` for a
  declared `int`.

This is the same shape as the `_divide` base, which emitted
`cast(… as double presition)` — a typo, i.e. invalid SQL — from the **initial
release** until it was fixed in this round, unnoticed for the library's entire
life because all six dialects overrode it. A designated base dialect that no
dialect reaches is not dead code; it is untested code.

**Current workaround in the suite**: none — unreachable code is uncovered by
construction. Either fix them or make them `abstract`.

## SQL Server: `getDay()` depends on the session's `SET DATEFIRST`

**Where**: `SqlServerSqlBuilder._getDay` (~line 1069).

**Reproduction**: the emission is `datepart(weekday, x) - 1`. T-SQL's
`DATEPART(weekday, …)` is affected by **`SET DATEFIRST` / the session
language**, so the result is only correct under the `us_english` default
(DATEFIRST 7). Every other dialect emits a session-independent expression, and
`getDay()` mirrors JavaScript's `Date.getDay()` (0 = Sunday), which has no
session concept. A deterministic emission would be
`(datepart(weekday, x) + @@DATEFIRST - 1) % 7`.

**NOT probed** — filed from reading the code plus the T-SQL docs; confirm
against a session with a non-default `DATEFIRST` before fixing.

**Current workaround in the suite**: none — the matrix only ever connects with
the default session settings, so the defect cannot surface there.

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
