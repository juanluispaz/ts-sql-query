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
bun run tests:where-is --search <api> --limitation full
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

## pglite may bundle an older PostgreSQL than the dialect's newest syntax targets

[`pglite`](https://pglite.dev/) is a WASM build of PostgreSQL that
the suite uses for in-process real-DB coverage of postgres-dialect
cells. As of `@electric-sql/pglite` **0.5.1** it ships PostgreSQL
**18.3** (earlier releases shipped PostgreSQL 17). The `postgres`
SqlBuilder at its newest `compatibilityVersion` emits syntax such as
`RETURNING old.<col>` / `RETURNING new.<col>` (the `update returning
old values` feature) that requires **PostgreSQL 18+** — pglite 0.5.1
(PG 18.3) accepts it, verified against the embedded engine, so
`docs:update/update-returning-old-values` now runs live in
`test/db/postgres/newest/pglite/docs.update.test.ts` (no wrap).

**There is no current pglite-version wrap.** The guidance below
applies only if a *future* feature the `postgres` SqlBuilder emits at
`newest` ever requires a PostgreSQL newer than the version pglite
bundles at the time:

- The wrap would be **per `compatibilityVersion` cell**, not
  per pglite-cell. At `newest` (default,
  `Number.POSITIVE_INFINITY`) the SqlBuilder emits the newest syntax
  the dialect supports; if that outpaces pglite's bundled PG, wrap
  only the `postgres/newest/pglite/` test with `TODO[LIMITATION]: see
  LIMITATIONS.md`. At `oldest` the SqlBuilder emits the legacy
  emulation that older servers accept, so do **not** wrap it there.
- When pglite catches up, walk
  `grep -rn "TODO\[LIMITATION\]" test/db/postgres/*/pglite/` and
  uncomment each match.

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
