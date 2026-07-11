# `test/` — known library limitations that affect tests

Extends [`docs/about/limitations.md`](../docs/about/limitations.md)
with limitations that **only the project author can declare as such**.
These are deliberate gaps in the library — not bugs to fix, not docs to
update — that an agent writing tests needs to know about so it doesn't
waste cycles assuming the library will enforce or expose something it
won't.

Treat anything listed here as a **constraint**, not a TODO. If you
think one of these should change, ask first.

**Library policy on engine feature support.** The library does
**not** detect whether the target engine supports a feature and does
**not** throw a pre-emptive error when emitting SQL the deployed
server will reject. Compatibility-version branches (e.g.
`compatibilityVersion >= 13_000_001`) only switch between **valid
forms of the same emitted SQL** — they do not act as version-gate
exceptions. When a feature only exists on a newer server release and
the user's deployed engine is older, the database raises its own SQL
error and that error surfaces verbatim to the caller. This applies
even when an older release line is still in service and the lib's
default `compatibilityVersion` (`Number.POSITIVE_INFINITY`) is ahead
of what is GA: it is the user's responsibility to pin
`compatibilityVersion` to match their server, and the engine's error
is the source of truth for what it accepts. Therefore "the lib emits
SQL my old server rejects" is **never a library bug** — it is either
a deployment limitation (this file) or a user configuration mistake.

How a limitation differs from a bug **and from a dialect boundary**:

|  | Limitation | Bug | Dialect boundary |
|---|---|---|---|
| Marker | `// TODO[LIMITATION]: <reason>` | `// TODO[BUG]: <reason>` | `// NOT-APPLICABLE: <reason>` |
| Cause | The library hasn't covered it yet (intentionally, for now) or the environment doesn't allow it | A defect in `src/`: the library *should* do it and currently doesn't | A deliberate dialect frontier — this cell will never run the test |
| Lives in | This file, plus the marker on the affected tests | [`BUGS.md`](./BUGS.md) plus the marker on the affected tests | Symmetry only, plus (often) a paired compile-time assertion in the dialect's `types.negative/` |
| Fix expected | Maybe, if the decision or environment changes | Yes, once an agent picks it up | **No — nothing pending** |
| Reactivates in **this** cell | If the lib covers it, yes | When the bug is fixed, yes | **Never** — the test only runs in the cells where the dialect supports the feature |
| Test action | Comment out (full canonical body) with the marker, or work around per the entry's recipe | Mark the assertion / block-comment the canonical body per [`WRITING_TESTS.md`](./WRITING_TESTS.md#when-a-test-surfaces-a-bug-in-src) | Block-comment the canonical body with `// NOT-APPLICABLE: <reason>`; the same test runs live in the cells whose dialect supports it |

`NOT-APPLICABLE` is a **first-class category, not a sub-tag of TODO**
(no `// TODO[NOT-APPLICABLE]` — "TODO" implies pending work, but a dialect
boundary is permanent and correct by design). The reason should name the
boundary (which dialect / feature) and, where it exists, point to the
paired `types.negative/` assertion that locks the compile-time rejection.

To find affected tests:

```bash
npm run tests:where-is -- --search <api> --limitation full
```

returns each `// TODO[LIMITATION]` that **names the API** across the
matrix, with cell + file:line. To see the per-cell **map** of caveats
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

## Aggregate functions are not flagged as aggregates in the type system

The library exposes `count(...)`, `sum(...)`, `avg(...)`, etc., but
the TypeScript surface treats them as ordinary value expressions —
there is no separate "AggregateValueSource" type. Two consequences:

1. **An aggregate can land where it isn't legal.** The type system
   does NOT prevent you from putting `connection.count(tFoo.id)` in a
   `where(...)` clause; the engine will reject it at runtime ("aggregate
   functions are not allowed in WHERE", or the dialect's equivalent).
   The library has no way of knowing.
2. **The library cannot derive a `HAVING` requirement from the
   query shape.** You must place aggregate predicates in `.having(...)`
   yourself; `.where(...)` won't be rewritten for you.

**What this means for tests** — never put an aggregate in `where`,
even when the snippet you are porting from the docs page seems to. If
you need a predicate on an aggregate, use `.having(...)`. If the
runtime cell rejects something a mock cell accepted (because the mock
doesn't execute the SQL), it is almost always this case. Treat as
"test author error", not as a bug.

## MariaDB UPDATE ... RETURNING requires MariaDB 13.0.1+ — `mariadb:latest` still ships 12.x

[MariaDB added `UPDATE ... RETURNING` (and the matching `OLD_VALUE(col)` helper) in MariaDB 13.0.1](https://jira.mariadb.org/browse/MDEV-5092). The
library tracks that via the `>= 13_000_001` `compatibilityVersion`
breakpoint documented in
[`docs/configuration/supported-databases/mariadb.md`](../docs/configuration/supported-databases/mariadb.md);
at `newest` (the default `Number.POSITIVE_INFINITY`) the
`MariaDBSqlBuilder` emits the new syntax, including
`returning old_value(col)` for `tTable.oldValues()` references.

The Docker image used by the test matrix (`mariadb`, no tag → `mariadb:latest`) currently resolves to **MariaDB 12.3.2** (13.x is not yet GA). Real MariaDB 12.x rejects every `UPDATE ... RETURNING` with `ER_PARSE_ERROR (1064, SQLSTATE 42000)`:

```text
You have an error in your SQL syntax; check the manual that corresponds
to your MariaDB server version for the right syntax to use near
'returning id as id, name as name, slug as slug' at line 1
```

**What this means for tests** — the wrap is **per
`compatibilityVersion` cell**, not per connector. At `newest`, every
`docs:update/update-returning*` and `docs-extra:update/returning-one-column`
test against MariaDB is commented out with `TODO[LIMITATION]: see
LIMITATIONS.md`. The SQL builder is correct; the limitation is purely
the unreleased server version. When `mariadb:latest` catches up to
13.0.1+, walk:

```bash
grep -rn "TODO\[LIMITATION\]" test/db/mariadb/
```

and uncomment each match — **except** the cases in the next section,
which the 13.0.1+ upgrade does **not** fix. If older `MariaDB`
`compatibilityVersion` cells (`13_000_001`, `10_005_000`, `oldest`, …)
are ever added, the `< 13_000_001` cells emit a legacy form that real
MariaDB 12.x accepts and do **not** need the wrap.

## MariaDB rejects RETURNING on multi-table DML (verified against 12.3.2)

Separate from the version gate above, the `mariadb` SqlBuilder emits a
DML shape that MariaDB rejects at parse time independent of the
RETURNING version gate. Verified by running the emitted SQL against a
real `mariadb:latest` (12.3.2) container:

- **RETURNING on a multi-table UPDATE / DELETE** — `UPDATE a, b SET ...
  RETURNING ...` and `DELETE ... USING a, b ... RETURNING ...` are
  rejected with `ER_PARSE_ERROR` at `returning`, even though
  single-table `DELETE ... RETURNING` works on 12.x (it has shipped
  since MariaDB 10.0.5) and single-table `UPDATE ... RETURNING` works
  from 13.0.1+. The multi-table RETURNING form is not accepted on any
  current MariaDB. Affects `update.from.variants` and
  `delete.using.variants`.

This stays `TODO[LIMITATION]` rather than `NOT-APPLICABLE` because the
library emits the SQL (no type-level narrowing) and a future MariaDB
release could accept this shape. Re-probe against the real engine before
reactivating.

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

## SQLite's `%` operator truncates floating-point operands to integers

SQLite's modulo operator converts **both** operands to integers before the
operation (verified against a real engine: `select 2 % 1.5` → `0`, and
`select 2.0 % 1.5` → `0`, because `1.5` is first truncated to `1` and
`2 % 1 = 0`). SQLite ships no built-in floating-point modulo function, so a
`modulo` that involves a fractional value cannot produce a fractional
remainder there. The library emits the plain `<a> % <b>` form on SQLite (the
`AbstractSqlBuilder` default) — valid SQL that the engine accepts, it just
silently loses the fraction.

This is distinct from PostgreSQL / SQL Server, whose `%` operator *rejects*
floating-point operands outright; for those the library emits a numeric-cast
form (`mod((…)::numeric, (…)::numeric)` / `cast(… as numeric(38,16)) % …`).
SQLite has no equivalent target, so the operation is left as-is.

**What this means for tests** — a `modulo` test whose correctness depends on
the fraction surviving (e.g. `int.modulo(double)` asserting `2 mod 1.5 = 0.5`)
cannot run on SQLite. The `int-receiver-modulo-double-column-promotes-result-to-double`
test in `sqlite/newest/*/select.numeric-overloaded-promotion.test.ts` is
therefore gated with `TODO[LIMITATION]` (full canonical body preserved). Tests
that modulo a floating-point value source whose value happens to be a whole
number (e.g. `billedAmount.modulo(3)` with `billed_amount = 200`) are safe
because the truncation changes nothing. This stays `TODO[LIMITATION]` rather
than `NOT-APPLICABLE` because the API is callable on SQLite and the library
could close the gap (e.g. by registering a custom float-modulo function where
the connector supports user-defined functions).

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
| SQLite | `(priority + ?) % ?` | **wrong value** — `%` truncates both operands to integers, so `(2 + 2.5) % 2` collapses to `0`, not `0.5` (see the SQLite `%` entry above) |
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

Per this file's policy, "the lib emits SQL the server rejects" is a limitation,
not a bug; this one is a deliberate, documented rough edge rather than a defect.

## Query introspection (`__isAllowed`) has no public API yet — tests reach internals via a single helper

ts-sql-query carries a parallel `__isAllowed` web threaded through
every query builder, value source, table/view, CTE, fragment and
column. It is a non-destructive walker that mirrors `__toSql` and
can answer "is every `allowWhen` / `disallowWhen` gate in this query
open?" without rendering SQL. It is the scaffolding for an
unfinished **query introspection API** — the planned public surface
(something like `query.isAllowed()` alongside a future
`query.resultSchema()` for OpenAPI emission) is not yet exposed. No
`execute*` / `query()` / `_build*` call invokes the walker today.

Because the public surface does not yet exist, the only way to
exercise the walker from tests — and verify that the scaffolding
stays correct (in sync with `__toSql` as new value-source /
table-or-view / query-builder shapes are added) — is to read the
underscore-prefixed method directly. That **breaks
[`test/DESIGN.md` § Public surface only](./DESIGN.md#public-surface-only)**.

**What this means for tests** — the exception is centralised in a
single seam, [`test/lib/isAllowed.ts`](./lib/isAllowed.ts), which is
the one and only place in the suite allowed to read `__isAllowed`
(and the connection's `__sqlBuilder`). All `allowWhen` /
`disallowWhen` tests must invoke `isQueryAllowed(query, connection)`
from that helper; **no test body may reach into `__isAllowed`
directly** and no test may copy the casts the helper performs.

Crucially, the existence of this helper does NOT widen the licence:
it does not justify reaching into any other underscore-prefixed
internal from a test (`__sets`, `__columns`, `__where`,
`__sqlBuilder` outside the helper, etc.). When the public
introspection surface lands, this helper either becomes a thin
wrapper around it or is removed — test bodies that use it should
not need to change. If a future test needs a new introspection
capability that the public API still does not expose, extend
`test/lib/isAllowed.ts` (one stable seam, one documented exception);
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
