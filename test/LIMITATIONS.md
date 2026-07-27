# `test/` — known library limitations that affect tests

Extends [`docs/about/limitations.md`](../docs/about/limitations.md)
with limitations that **only the project author can declare as such**.
These are deliberate gaps in `src/` — or cases this test harness cannot
drive — that an agent writing tests needs to know about so it doesn't
waste cycles assuming the library will enforce or expose something it
won't.

Treat anything listed here as a **constraint**, not a TODO list to work
down. Every entry is closeable *in this repository*, which is exactly what
distinguishes it from [`ENGINE_SUPPORT.md`](./ENGINE_SUPPORT.md) — but
closing one is a decision, not a chore. If you think one of these should
change, ask first.

**This file is deliberately small.** It used to carry every reason a test
was disabled, including the ones nothing in this repo could ever fix — an
old engine version, a missing SQL function, a driver without an API — which
made it read as a mountain of debt nobody could pay down. Those moved to
[`ENGINE_SUPPORT.md`](./ENGINE_SUPPORT.md) under their own marker. Keep them
out: an entry that lands here should be one someone on this project could
sit down and close.

## The decision rule

*Is there a change in **this repo** that re-enables the test in **this
cell**?*

- **Yes, and the library is wrong** → `// TODO[BUG]:`, tracked in
  [`BUGS.md`](./BUGS.md).
- **Yes, but it is a deliberate choice not to** → `// TODO[LIMITATION]:`,
  **this file**.
- **No — only an external upgrade would** (a newer engine release, an ICU
  build, a driver growing an API) → `// NOT-SUPPORTED:`, tracked in
  [`ENGINE_SUPPORT.md`](./ENGINE_SUPPORT.md).
- **The type surface itself forbids the call here** → `// NOT-APPLICABLE:`,
  tracked by symmetry + the dialect's `types.negative/`.

An in-repo close path counts **only when it covers every connector of the
dialect**. `cot()` is here because `1 / tan(x)` closes it on all five SQLite
runners (Oracle already emits exactly that); `reverse()` is **not**, because
its only close path is a UDF that `bun:sqlite` and `sqlite3` cannot
register.

|  | Limitation | Bug | Not supported | Dialect boundary |
|---|---|---|---|---|
| Marker | `// TODO[LIMITATION]: <reason>` | `// TODO[BUG]: <reason>` | `// NOT-SUPPORTED: <reason>` | `// NOT-APPLICABLE: <reason>` |
| Cause | A deliberate gap in `src/`, or something this harness can't drive | A defect in `src/`: the library *should* do it and currently doesn't | The engine / this engine version / its build / the driver can't run it | The type surface doesn't expose the call here at all |
| Who closes it | us, if the decision changes | us, it's a defect | **somebody else's release** | **nobody — correct by design** |
| Lives in | This file, plus the marker on the affected tests | [`BUGS.md`](./BUGS.md) plus the marker | [`ENGINE_SUPPORT.md`](./ENGINE_SUPPORT.md) plus the marker | Symmetry only, plus (often) a paired assertion in the dialect's `types.negative/` |
| Reactivates in **this** cell | If the lib covers it, yes | When the bug is fixed, yes | Only if the external system changes | **Never** |
| Test action | Comment out (full canonical body) with the marker, or work around per the entry's recipe | Mark the assertion / block-comment the canonical body per [`WRITING_TESTS.md`](./WRITING_TESTS.md#when-a-test-surfaces-a-bug-in-src) | Block-comment the canonical body with the marker; it runs live where the engine supports it | Block-comment the canonical body; the same test runs live in the cells whose dialect supports it |

`NOT-APPLICABLE` and `NOT-SUPPORTED` are **first-class categories, not
sub-tags of TODO** (no `// TODO[NOT-APPLICABLE]` — "TODO" implies pending
work, which is wrong for a permanent boundary). For `NOT-APPLICABLE` the
reason should name the boundary (which dialect / feature) and, where it
exists, point to the paired `types.negative/` assertion that locks the
compile-time rejection.

To find affected tests:

```bash
npm run tests:where-is -- --search <api> --limitation full
```

returns each `// TODO[LIMITATION]` that **names the API** across the
matrix, with cell + file:line (`--not-supported` is the same view for the
engine/driver boundaries). To see the per-cell **map** of caveats
declared on a target area (e.g. "what limitations live in mariadb/newest
cells, named or not"), use `tests:where-is --search <any-api>
--cell-caveats summary --coord '<cells>'` (or `full` for the markers
themselves). Plain `grep -rn "TODO\[LIMITATION\]" test/db/` still works
when the index isn't built.

---

## GROUP BY column requirements vary by dialect and the library doesn't enforce

**Engines split into two camps:**

- **Strict** — [SQL Server](../docs/configuration/supported-databases/sqlserver.md)
  and [Oracle](../docs/configuration/supported-databases/oracle.md)
  require **every** non-aggregated column that appears in the SELECT
  to also appear in the `GROUP BY`. Forgetting one is a runtime SQL
  error.
- **Permissive** — [PostgreSQL](../docs/configuration/supported-databases/postgresql.md)
  (since 9.1, when the PK is in the GROUP BY), [MySQL](../docs/configuration/supported-databases/mysql.md),
  [MariaDB](../docs/configuration/supported-databases/mariadb.md) and
  [SQLite](../docs/configuration/supported-databases/sqlite.md) accept
  forms where some non-aggregated columns are omitted from GROUP BY.

`ts-sql-query` **does not detect the difference**. A query that
compiles and runs fine on PostgreSQL may crash at execution time
against SQL Server or Oracle with a "column not in group by"
diagnostic. The type system has no way of telling.

**What this means for tests** — when you write a `docs:` /
`docs-extra:` test that uses `groupBy`, always include EVERY
non-aggregated column from the projection in the `groupBy` argument
list, even if your local sqlite/postgres canonical accepts the
shorter form. The conservative shape ports cleanly to every cell.

```ts
// Good — explicit, works on all six dialects:
.groupBy(tOrganization.id, tOrganization.name)
.select({
    organizationId:   tOrganization.id,
    organizationName: tOrganization.name,
    projectCount:     connection.count(tProject.id),
})

// Risky — SQL Server / Oracle will reject this at runtime:
.groupBy(tOrganization.id)
.select({
    organizationId:   tOrganization.id,
    organizationName: tOrganization.name, // <-- not in GROUP BY
    projectCount:     connection.count(tProject.id),
})
```

The existing `docs:select/aggregate-and-group-by` and
`docs:select/with-clause` tests follow the conservative shape; do the
same in any new aggregate test.


## The library does not auto-rewrite a misplaced aggregate predicate into HAVING

Aggregates now **are** flagged in the type system: `count(...)`, `sum(...)`,
`average(...)`, etc. carry an `NAggregate` source brand (`NSourceAllowingAggregate`),
and the brand **survives arithmetic and comparison** — so
`connection.sum(tFoo.priority).add(1).greaterThan(1)` (an aggregate-arithmetic
expression) is a **compile error** in `where(...)`, `groupBy(...)` and a join
`on(...)`, not just a bare `count()`. There is no brand-drop residual.

The remaining limitation is narrower:

- **The library cannot derive a `HAVING` requirement from the query
  shape.** You must place aggregate predicates in `.having(...)` yourself;
  a misplaced aggregate is rejected at compile time, but `.where(...)` is
  never *rewritten* into `.having(...)` for you.

**What this means for tests** — if you need a predicate on an aggregate,
use `.having(...)`. An aggregate in `where`/`groupBy`/`on` no longer reaches
the engine at all — the TypeScript surface rejects it — so it is a compile
error to fix, not a runtime "aggregate not allowed in WHERE" to characterize.


## MariaDB 10.3 / MySQL 5.7 reject a `WHERE` clause without a `FROM`

`selectFromNoTable().where(...)` emits `select <cols> where <cond>` with no
FROM clause. MySQL **8.0+** and MariaDB **10.4+** accept a bare `SELECT … WHERE`,
but MariaDB **10.3** and MySQL **5.7** require a FROM and reject it with
`ER_PARSE_ERROR (1064)`. Verified against real `mariadb:10.3` and real `mysql:5.7`:
`select 1 as x where 1 = 1` → 1064 on both, while `select 1 as x from dual where 1
= 1` → OK; the same no-FROM SQL runs live on the `10_004_000` / `10_005_000` MariaDB
cells (real 10.4 / 10.5) and the `8_000_000` / `newest` MySQL cells (identical
snapshot).

The library emits the no-FROM form on every `compatibilityVersion` — valid on
every other engine/version this matrix runs. It is closeable (the builder could
emit `from dual` on MariaDB/MySQL when a `selectFromNoTable` carries a WHERE) but
that is deliberately not gated: `from dual` is not portable to PostgreSQL /
SQLite, so it would be a MySQL/MariaDB-specific rewrite for a degenerate query
(a WHERE over a single constant row). Stays `TODO[LIMITATION]` rather than
`NOT-APPLICABLE` because the API is callable and MariaDB 10.4+ / MySQL 8.0+ accept it.

**What this means for tests** — the
`build-fragment-with-args-if-value-emits-when-value-present` and
`build-fragment-with-args-if-value-arity-1-emits-when-present` tests in
`fragments.with-args` are commented out with `// TODO[LIMITATION]: see
LIMITATIONS.md` on the `10_003_003` / `oldest` MariaDB cells (real `mariadb:10.3`)
and the `oldest` MySQL cell (real `mysql:5.7`), all under `--docker-version
closest`, and run live everywhere else.


## Oracle: bind parameters carry no declared type, so oracledb's statement cache can re-bind them with a stale one

`QueryRunner.addParam(params, value)` receives **only the value** — the
ts-sql-query type is not threaded through to the runner, so
`OracleDBQueryRunner.addParam` pushes the bare JS value and lets oracledb
infer the bind type. oracledb's statement cache (`stmtCacheSize`, default
30) keys on the **SQL text** and retains the bind-type metadata of the
first execution, so re-executing one text with a differently-typed bind at
the same position re-binds it with the cached type and Oracle rejects the
value (`ORA-01722` for a number-typed bind, `ORA-01858` for a date-typed
one).

Verified against a real `gvenzl/oracle-free:23-slim-faststart` container,
one pooled connection, `stmtCacheSize: 30`, the same text
`select :0 as "result" from dual`:

| second execution | result |
|---|---|
| bare `'coding'` (what `addParam` pushes today) | **ORA-01722** |
| `{ val: 'coding', type: oracledb.STRING }` | OK |

So an explicit bind type fixes it **with the cache left on** — this is not
an Oracle restriction, it is the consequence of binding untyped.

**Why this is a limitation and not a bug**: closing it properly means
threading the type into `addParam`, which is a **public-interface change**
— `QueryRunner` is the seam users override, ~29 runners in `src/` plus the
wrappers (`ConsoleLog` / `Interceptor` / `Mock` / `Chained`) and any
user-authored runner implement it. The type is already in scope at the
call site (`AbstractSqlBuilder._appendParam`, where `_columnType` sits
unused), and the params array already carries bind descriptors
(`addOutParam` pushes `{ dir: BIND_OUT, as }`), so the shape fits — but it
is a refactor of its own, out of scope for test work. Until then the
library deliberately does not declare bind types.

**Update — the public-interface blocker is now gone (future refactor).** The
Oracle `localDateTime`-via-`RETURNING` fix introduced a way to carry a column's
type to the runner **without** changing `addParam` / `addOutParam`:
`OracleSqlBuilder._registerOutBindColumnType` records the type as a
**non-enumerable** property on the `params` array keyed by the bind's placeholder
(`:<index>`), and `OracleDBQueryRunner.resolveOutBindTypes` reads it back and
declares the bind — the same mechanism `SqlServerSqlBuilder._appendParam` already
uses for **IN** params (`params['@'+N]` → `MssqlPoolQueryRunner.getType`). So the
reason this stayed a limitation no longer holds. A future refactor can close it
by registering each IN param's type in `OracleSqlBuilder._appendParam` (where
`columnType` is in scope; `_appendParam` is already overridden there for the
`uuid_to_raw` wrap) and, in the runner's three `connection.execute` paths,
wrapping each IN value as `{ val, type, dir: BIND_IN }` — with a `ValueType →
oracledb type` map mirroring `MssqlPoolQueryRunner.predefinedTypes` and its
`inferType` fallback. That lets `stmtCacheSize` be restored to the driver default
and closes this entry. Deferred by choice, not blocked.

**Exposure — very unlikely outside this suite.** Reaching it needs ALL of
the following at once:

1. Two queries whose emitted SQL is **byte-identical** — same columns, same
   table, same clauses. Anything that differs (a different column, a
   different predicate) produces different text and cannot collide.
2. A bind at the **same position** whose type differs between the two —
   e.g. a number in one and a string in the other.
3. Both executed on the **same pooled connection**, close enough together
   that the first one's statement is still cached.

An application does not normally satisfy (1) and (2) together: if the SQL
text is identical, the query is the same query, and the same query almost
always binds the same types. The realistic way to break that tie is
`const(...)` over `selectFromNoTable()`, where **every** value kind emits
the same `select :0 as "result" from dual` regardless of the type bound —
so the text stays fixed while the type varies. That is a construct a real
application rarely uses at all, and rarer still with mixed types.

This suite is the outlier by design: it deliberately fans **every** value
kind out over that one construct, in one file, on one connection — which
is precisely conditions (1) + (2) + (3). Treat this entry as an artifact of
exhaustive type-matrix testing, not as a hazard production code is likely
to meet.

**Workaround in the suite**: the oracle test pool sets `stmtCacheSize: 0`
(`test/db/oracle/runners.ts`, commented there), which makes each execution
re-parse with its own bind types. That un-blocked the 33 tests previously
disabled in `oracle/newest/oracledb/select.connection-trailing-adapter.test.ts`
under a `NOT-APPLICABLE` reason that misattributed the failure to Oracle
rejecting the bare bind for non-numeric kinds; the whole file (65 tests)
now runs and passes against the real engine. **Fingerprint if it resurfaces**:
the test passes in isolation and fails only in file order. In the unlikely
event a user meets all three conditions, the same `stmtCacheSize` setting on
their own pool is the escape hatch.

**Don't "restore the default" without reading this.** Leaving the cache at 30
is the *fragile* option, not the faithful one: exactly one test of the oracle
cell then fails, but **which** one depends on file order — the first string
bind after a numeric one absorbs the stale type and every later one passes, so
inserting a test into that fan-out migrates the failure to a different test and
any marker left behind starts lying. Disabling the cache removes the order
coupling rather than documenting it. The cost is ~1.7% and does not justify the
trade: the cell measured 80.2s / 82.2s at `0` against 79.9s / 79.8s at `30`
(two runs each, warm container), and it runs in parallel with the other cells
inside the matrix's ~7 min.


## SQL Server rejects a bare bind parameter as an ORDER BY term (error 1008)

`orderBy(<no-table value source>)` — the overload a compound query's
`orderBy(...)` accepts — renders the value source as a bare `@param`.
SQL Server reads a lone variable / literal in an ORDER BY position as an
**ordinal column position** and raises `Msg 1008 … The SELECT item
identified by the ORDER BY number N contains a variable as part of the
expression identifying a column position. Variables are only allowed
when ordering by an expression referencing a column name.` Verified
against a real `mcr.microsoft.com/mssql/server:2025-latest` container:
`select … order by col, @p` fails, while wrapping the term in any
expression — `order by col, @p + 0` — succeeds.

- This is **not specific to compounds**: a plain `select … order by
  col, @param` fails the same way. The separate compound-wrapping fix
  (wrap the compound in `select * from (<compound>)` so a value-source
  ORDER BY term is legal w.r.t. the compound restriction) is correct and
  runs live on every other engine — SQL Server simply can't order by a
  bare parameter in any select. Affects `select.compound` →
  `compound-order-by-value-source-secondary`.

This stays `TODO[LIMITATION]` rather than `NOT-APPLICABLE` because the
library could close the gap (render the no-table ORDER BY term as an
expression on SQL Server) and the API is callable — a deliberate gap,
not a permanent dialect frontier. Ordering a result set by a bare
constant is a no-op sort, so the payoff for closing it is low.


## A fractional numeric literal as the operand of an `int` value source emits an untyped `col + $param` that PostgreSQL rejects at bind time

When the receiver of an overloaded arithmetic op (`add` / `subtract` /
`multiply` / `modulo` / `maximumBetweenTwoValues` / …) is an **`int`** value
source and the operand is a **JavaScript `number` literal that happens to be
fractional** (e.g. `tIssue.priority.add(2.5)`), the library emits
`priority + $n` with the parameter carrying **no explicit type**. TypeScript
cannot tell `2.5` from `2` — both are `number` — so the library keeps the
operation int-shaped in the SQL; the fraction exists only in the bound runtime
value.

PostgreSQL resolves parameter types at **parse/prepare time, before it sees the
value**. Parsing `priority + $n` it picks the `int4 + int4` operator, so it
infers `$n :: int4`. At bind time the driver sends `2.5`, PostgreSQL tries to
read it as an integer and fails:

```
error: invalid input syntax for type integer: "2.5"   (SQLSTATE 22P02)
```

**Chaining into a numeric-casting op does not help on PostgreSQL.** Even the
`modulo` form, which emits `mod((priority + $1)::numeric, ($2)::numeric)`, is
rejected: the outer `::numeric` casts the *result* of the addition — too late to
re-type the inner `$1`, which was already pinned to `int4` when the `+` operator
was resolved.

**This is not driver-specific — it is structural.** Verified against a real
engine on all three PostgreSQL connectors (`pg` / `postgres.js` / `pglite`);
each rejects identically with `22P02`. `postgres.js` prints the parameter OIDs
it sends, which pinpoints the cause:

```
query:      select id as id, mod((priority + $1)::numeric, ($2)::numeric) as rest from issue where id = $3
parameters: [ '2.5', '2', '1' ]
types:      [ 23, 1700, 23 ]     -- $1 = int4(23), $2 = numeric(1700), $3 = int4(23)
```

`$2` is `numeric` (1700) because it sits **directly** inside `($2)::numeric`;
`$1` is `int4` (23) because it sits inside `priority + $1`, **before** the outer
cast, and inherits `priority`'s type. With `pg` (node-postgres) no OIDs are sent
and the *server* infers the same `int4`; `pglite` runs the PostgreSQL engine in
WASM and infers identically. No PostgreSQL connector avoids it.

**Per-engine behaviour:**

| Engine | Emitted (modulo form) | Result |
|---|---|---|
| PostgreSQL (`pg` / `postgres` / `pglite`) | `mod((priority + $1)::numeric, ($2)::numeric)` | **rejected** — `22P02` at bind |
| SQLite | `(priority + ?) % ?` | **wrong value** — `%` truncates both operands to integers, so `(2 + 2.5) % 2` collapses to `0`, not `0.5` (see [`ENGINE_SUPPORT.md`](./ENGINE_SUPPORT.md) § SQLite's `%` operator) |
| MySQL / MariaDB | `(priority + ?) % ?` | accepted, `0.5` (the engine coerces the operand to decimal) |
| Oracle | `mod(priority + :0, :1)` | accepted, `0.5` |
| SQL Server | `cast(priority + @0 as numeric(38, 16)) % cast(@1 as numeric(38, 16))` | accepted, `0.5` |

So the failure lands on the two primary/canonical cells (PostgreSQL rejects,
SQLite silently truncates) and only the other four dialects accept it.

**The portable form that works** — give the operand an explicit numeric type
instead of a bare literal: use a `double` / `numeric` **column** (or an
explicitly-typed value source) as the operand. Then the engine resolves
`int + double` from the declared type and no bad inference occurs. The
`int-receiver-*-double-column-promotes-result-to-double` tests in
`select.numeric-overloaded-promotion.test.ts` use a real `double` column
precisely for this reason (see that file's header comment).

**What this means for tests** — the
`int-receiver-chained-fractional-literal-add-then-modulo` test
(`tIssue.priority.add(2.5).modulo(2)` asserting `0.5`) in
`select.numeric-overloaded-promotion.test.ts` runs live on MySQL / MariaDB /
Oracle / SQL Server and is gated with `TODO[LIMITATION]` (full canonical body
preserved) on all 8 PostgreSQL cells (PG rejects the bind) and all 5 SQLite
cells (SQLite truncates), i.e. both canonicals. The int→double promotion it
exercises is otherwise pinned everywhere by the double-column
`int-receiver-*-double-column-promotes-result-to-double` tests in the same file,
which pass a typed operand and so avoid the bad `int4` inference.

**What could be done later (for whoever revisits this).** The library
intentionally types operands from the receiver, not by inspecting runtime
values, so the fix is a `src/` decision, not a test one. Options, roughly in
order of blast radius:

1. **Cast the parameter when the operand is a numeric literal** — emit
   `priority + $n::numeric` (or the dialect's numeric-cast form) so PostgreSQL
   stops inferring `int4`. Needs care that the many working `int + int` /
   `int + intColumn` cases are not disturbed and that the extra cast is harmless
   on the engines that already accept the bare form.
2. **Promote the whole operation to `double` when a fractional literal is
   detected at build time** — but that means inspecting the literal's runtime
   value during query building, which cuts against the current "type from the
   receiver, never from the value" design.
3. **Leave as-is and document** (current choice) — callers who need a fractional
   operand pass a typed value source (`double` column / explicit cast) instead
   of a bare literal.

"The lib emits SQL the server rejects" is never a bug (see
[`ENGINE_SUPPORT.md`](./ENGINE_SUPPORT.md) § Library policy on engine feature
support). This one stays HERE rather than there because the fix is ours to make —
the parameter's type comes from the library's own receiver-typing rule, and every
PostgreSQL version behaves the same — so it is a deliberate, documented rough edge,
not an engine boundary.


## Query introspection (`__isAllowed`, `__hasAggregation`) has no public API yet — tests reach internals via a single helper

ts-sql-query carries two parallel introspection webs threaded through
every query builder, value source, table/view, CTE, fragment and
column. Both are non-destructive walkers that mirror `__toSql` and
answer a question about the built query without rendering SQL:

- `__isAllowed` — "is every `allowWhen` / `disallowWhen` gate in this
  query open?"
- `__hasAggregation` — "does this query contain an aggregation?"

They are the scaffolding for an unfinished **query introspection
API** — the planned public surface (something like
`query.isAllowed()` alongside a future `query.resultSchema()` for
OpenAPI emission) is not yet exposed. No `execute*` / `query()` /
`_build*` call invokes either walker today: `__hasAggregation`'s only
non-recursive entry point, `hasAggregationQueryColumns()` in
`src/sqlBuilders/SqlBuilder.ts`, is called exclusively from inside
other `__hasAggregation` bodies, so the web is closed the same way
`__isAllowed`'s is.

Because the public surface does not yet exist, the only way to
exercise the walkers from tests — and verify that the scaffolding
stays correct (in sync with `__toSql` as new value-source /
table-or-view / query-builder shapes are added) — is to read the
underscore-prefixed methods directly. That **breaks
[`test/DESIGN.md` § Public surface only](./DESIGN.md#public-surface-only)**.

**What this means for tests** — the exception is centralised in a
single seam, [`test/lib/queryIntrospection.ts`](./lib/queryIntrospection.ts), which is
the one and only place in the suite allowed to read `__isAllowed` /
`__hasAggregation` (and the query builder's `__sqlBuilder`). All
`allowWhen` / `disallowWhen` tests must invoke `isQueryAllowed(query)`
and all aggregation-introspection tests `queryHasAggregation(query)`
from that helper; **no test body may reach into those methods
directly** and no test may copy the casts the helper performs.

Crucially, the existence of this helper does NOT widen the licence:
it does not justify reaching into any other underscore-prefixed
internal from a test (`__sets`, `__columns`, `__where`,
`__sqlBuilder` outside the helper, etc.). When the public
introspection surface lands, these helpers either become thin
wrappers around it or are removed — test bodies that use them should
not need to change. If a future test needs a new introspection
capability that the public API still does not expose, extend
`test/lib/queryIntrospection.ts` (one stable seam, one documented exception);
do not open a second escape route.


## Window functions are not supported through the fluent API

This is also documented in [`docs/about/limitations.md` § Does ts-sql-query
support window functions?](../docs/about/limitations.md#does-ts-sql-query-support-window-functions),
restated here because it affects test authoring:

- The library does not type `OVER (...)`, `PARTITION BY`, `ROW_NUMBER()`,
  `LAG()`, `LEAD()`, etc. as first-class operators.
- The only way to emit them is the `connection.fragmentWithType(...).sql\`…\``
  escape hatch (or `connection.rawFragment\`…\`` for the typeless
  variant) plus the `customWindow` extension point of `customizeQuery`
  for the `WINDOW` clause.

**What this means for tests** — there is no `docs:` test in the
suite today that exercises a window function (the docs pages don't
show any). If a future page introduces one, the test will look more
like a `docs.sql-fragments.test.ts` entry than a clean fluent-API
call. Keep it scoped to the SQL-fragments path and do not try to
build a wrapper that pretends window functions are part of the
typed surface.


## SQL Server SNAPSHOT isolation needs `ALLOW_SNAPSHOT_ISOLATION` on the test database

`isolationLevel('snapshot')` type-checks on `SqlServerConnection` and
SQL Server 2025 fully supports it — but only once the database has
`ALTER DATABASE … SET ALLOW_SNAPSHOT_ISOLATION ON` (verified: without
it the engine raises `Msg 3952`; with it a snapshot transaction reading
a table commits fine).

The matrix's SQL Server setup **deliberately** does not enable the
option. `ALLOW_SNAPSHOT_ISOLATION` is database-wide and makes **every**
data modification start generating row versions in `tempdb` (≈14 bytes
per modified row plus version-store writes), not just the snapshot
transactions — an overhead we avoid on the SQL Server container, which
runs x86 under ARM emulation and is already the slowest cell of the
matrix. The trade is poor: the test's mock half (that the library
forwards the `['snapshot']` transaction opts) is already covered by the
other isolation levels, so all the option would buy is confirming that a
real snapshot transaction commits — a single SQL-Server-only case (no
other cell validates SNAPSHOT, since `isolationLevel('snapshot')` only
type-checks here).

The snapshot test in
`sqlserver/newest/mssql/transaction.isolation-level.test.ts` therefore
stays commented with `TODO[LIMITATION]`. Re-evaluate if the cost stops
mattering (e.g. a native, non-emulated SQL Server runner): enabling the
option in the cell setup — and reading a real table inside the
transaction to exercise the version store — would let it run.


## `attachRollbackError` cannot be exercised through this matrix's runners

`attachRollbackError` (in [`src/TsSqlError.ts`](../src/TsSqlError.ts))
is wired by `ManagedTransactionQueryRunner.executeInTransaction` when
the body's error AND the subsequent rollback both throw. The mock
runner has its own `executeInTransaction` that swallows the rollback
error without chaining (so it never reaches the attach helper), and the
real driver runners expose no hook to force a rollback failure without
corrupting the connection — so the branch is unreachable across
**every** cell of this matrix (a harness gap, not a per-dialect
boundary).

The branch is **dialect-agnostic** — it lives in the shared
`ManagedTransactionQueryRunner`, not in any per-dialect `SqlBuilder` — so
a per-cell test (one per connector) is both infeasible (a real driver's
rollback can't be forced to fail cleanly) and redundant (every cell
would exercise the same shared code). The only feasible in-matrix shape
is a **single dialect-agnostic unit test** driving
`ManagedTransactionQueryRunner.executeInTransaction` with an in-memory
stub runner whose `executeRollback` rejects and a body that throws a
`TsSqlQueryExecutionError`; the per-cell matrix has no clean home for a
library-only unit test, which is why this was parked per-cell instead.
Meanwhile the helper is covered by real-driver integration tests outside
this matrix.

It stays `TODO[LIMITATION]` in
`oracle/newest/oracledb/errors.transaction-attachments.test.ts` (and as
the symmetric placeholder in every other cell). Reactivate by adding the
dialect-agnostic unit test described above if a home for lib-only unit
tests is introduced.


## A negative `substr` / `substring` index is only resolved when it is a literal

The four slicing methods mirror JS, where a negative index means "from the end"
for `substr` and "clamp to 0" for `substring`. Both are resolved **at build
time** (see `AbstractSqlBuilder._substrToEnd` and its per-dialect overrides), so
they need the sign of the index to be known while the SQL is built — which is
true for a number literal and false for a value source:

```ts
tIssue.title.substrToEnd(-2)              // resolved: emits the dialect's from-the-end idiom
tIssue.title.substrToEnd(tIssue.priority) // NOT resolved: assumed non-negative
```

With a **value-source index** the library keeps the `<index> + 1` conversion,
which is correct for a non-negative index and wrong for a negative one. Closing
this would mean emitting `case when <index> < 0 then … else <index> + 1 end`
around every slicing call — taxing the majority of queries, which never pass a
negative index, to cover an exotic one. The author ruled against paying that
cost on the common path.

**What this means for tests**: the negative-index coverage in
`select.string-ops.test.ts` (`negative-index-follows-javascript`) uses literals.
A value-source index carrying a negative value at runtime is outside the
contract.


## `.length()` on SQL Server under-reports a string that is exactly at its column's maximum length

`.length()` mirrors JS `String.length`, which counts trailing blanks; T-SQL's
`LEN()` excludes them (`len('Draft  ')` is 5, not 7). The library bridges the gap
in `SqlServerSqlBuilder._length` by appending a sentinel character and subtracting
it back: `len(<x> + '.') - 1`. This is correct for every normal string.

It fails at **one exact extreme**: a value whose length already equals its
column's declared maximum. T-SQL string `+` on two **non-`max`** character types
caps the result at the type's declared maximum and silently truncates the
overflow, so for a value at the cap the appended `.` is dropped, `len` returns the
maximum, and `- 1` yields **maximum − 1**:

```
declare @x8000 varchar(8000) = REPLICATE('a', 8000);
  LEN(@x8000 + '.') - 1 = 7999     LEN(@x8000) = 8000     -- true length 8000
declare @x4000 nvarchar(4000) = REPLICATE(N'a', 4000);
  LEN(@x4000 + N'.') - 1 = 3999    LEN(@x4000) = 4000
```

(Under `tedious`, a bound `const` string of exactly 4000 characters is sent as
`nvarchar(4000)`, so it reaches this without even a column at the cap.)

**Why the default is a limitation and not a bug to fix.** The value has to be
*exactly* at the bounded type's maximum for the defect to appear — one precise
extreme, not a range. A fully-correct form exists —
`len(cast(<x> as varchar(max)) + '.') - 1`, verified to give 8000 / 7 / 4 for the
cases above — but the author ruled against carrying the extra cast on every
`.length()` call to cover only the max-length case: documenting the edge is
preferred over complicating the common query. The trailing-blank handling that the
sentinel provides is correct for every string shorter than the column's maximum.

**The opt-out — `excludeTrailingBlanksInLength`.** A connection flag (default
`false`) lets a user trade the JS-faithful default for SQL Server's **native
`len(x)`**. With it set, the builder emits a bare `len(<x>)`:

- the max-length edge disappears (`len(REPLICATE('a', 8000))` = 8000, correct), and
  the query is lighter (no sentinel);
- but trailing blanks are **excluded** again (`len('Draft  ')` = 5, T-SQL's native
  semantics, diverging from JS `String.length`).

So it is a genuine trade, not a strict improvement: it is the right choice for an
application whose SQL Server columns hold max-length values and whose data does not
depend on trailing blanks. An application needing both trailing-blank fidelity *and*
correctness at the exact maximum has no single form that serves it (the
`varchar(max)` cast would, at a cost the default declined) — a vanishingly rare
combination (a value exactly at the cap that also ends in significant spaces).

**What this means for tests**: no fixture holds a max-length string, so the matrix
cannot express the default's edge. Do not add one to "fix" the default — it is a
documented edge with an opt-out, not a regression. The opt-out's `len(x)` emission
is snapshot-lockable on any string.


## SQLite's build has no `cot()` function

`NumberValueSource.cot()` is a public method, callable on `SqliteConnection` (its
negative-type tests reject only a wrong *column* type, not SQLite itself), and the
base `AbstractSqlBuilder` emits `cot(<x>)`. The SQLite builds here expose the rest of
the trig family (`acos`/`asin`/`atan`/`cos`/`sin`/`tan`) but **not** `cot`:

```text
sqlite> select cot(1.0);
Parse error: no such function: cot
```

So the boundary is one missing function, not a dialect gap — the trig siblings all run
live on SQLite. It stays a **`TODO[LIMITATION]`** rather than a
[`NOT-SUPPORTED`](./ENGINE_SUPPORT.md) precisely because a close path exists that
covers **every** SQLite runner, UDF API or not:

1. **Emulate `cot(x)` as `1 / tan(x)`** — exactly what `OracleSqlBuilder._cot`
   already does (Oracle also lacks a native `COT`). SQLite exposes `tan`, so a
   `SqliteSqlBuilder._cot` override emitting `1 / tan(<x>)` (plus
   `_operationsThatNeedParenthesis._cot = true`, mirroring Oracle) would make `cot`
   work on SQLite and turn every `cot` test there live. This is the cheapest close
   and the recommended one when someone picks this up.
2. Register a `cot` UDF on the connectors that expose a UDF API. Note this is a
   *partial* path — `bun:sqlite` and `sqlite3` have no UDF API — which is why
   `reverse()`, whose only close path is this one, is `NOT-SUPPORTED` instead.

The emulation is **deliberately deferred**, to keep taxonomy work free of a `src/`
behaviour change; the `cot` tests on the SQLite cells stay commented
with `TODO[LIMITATION]` (full canonical body preserved) and run live on the other
five dialects.


## `replaceAllInsensitive` does not honour `insensitiveCollation` on PostgreSQL / SQLite

Both `replaceAllInsensitive` and the `insensitiveCollation` connection config are
callable/typed on `PostgreSqlConnection` and `SqliteConnection`, so this is a
**behavioural gap**, not a typed narrowing. PostgreSQL implements case-insensitive
replace as a fixed `regexp_replace(…, 'gi')`; the `'gi'` flag folds case but takes no
collation, so a configured `insensitiveCollation` cannot influence it. SQLite's
UDF/`replace` fallback likewise does not read `insensitiveCollation`. The result is a
documented limitation (the config is silently ignored on these engines), reworded away
from `NOT-APPLICABLE` because the API is callable — closing it would mean the library
threading the collation into a different emitted form on those engines. The affected
`select.collation` assertions are commented with `TODO[LIMITATION]` (full canonical
body preserved) on the PostgreSQL and SQLite cells; the collation-honouring path runs
live on Oracle and SQL Server, whose `REPLACE` reads the forced collation. (Distinct
from `replaceCollation`, which is a config declared only on Oracle/SQL Server and stays
a genuine `NOT-APPLICABLE` elsewhere.)
