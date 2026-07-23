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

## MariaDB CTE-on-DML (a `WITH` clause prefixing `UPDATE` / `DELETE`) requires MariaDB 12.3+

MariaDB accepts a `WITH … AS (…)` common-table-expression clause **in
front of an `UPDATE` or `DELETE`** only from **MariaDB 12.3** onward.
Every earlier release rejects the leading `WITH` at the parser with
`ER_PARSE_ERROR (1064, SQLSTATE 42000)`, pointing at the `update …` /
`delete …` keyword immediately after the CTE definition.

Verified by running the exact SQL the library emits (`with p(id, name) as
(values (1, 'renamed')) update project, p set project.name = p.name where
project.id = p.id`) against real containers:

| MariaDB | leading-`WITH` UPDATE / DELETE |
|---|---|
| 10.5 · 10.6 · 11.4 · 11.8 · 12.0 · 12.1 · 12.2 | **rejected** (`ER_PARSE_ERROR`) |
| **12.3.2** (the matrix's `newest` image) | **accepted** |

The `mariadb` SqlBuilder hoists every collected `WITH` — from a `Values`
source, from a `.forUseInQueryAs(...)` CTE consumed by
`update(t).from(cte)` / `deleteFrom(t).using(cte)`, or from a CTE that
bubbles up out of a `where(… in (subquery))` — to the **top of the
statement**, so it emits `with … update …` / `with … delete from …
using …` on **every** `compatibilityVersion`. This is deliberately **not**
a `compatibilityVersion` breakpoint: exactly as with the Oracle
multi-table `UPDATE … FROM` case below, the library emits one modern form
and does **not** emulate an older rewrite (e.g. inlining the CTE as a
derived-table join, which pre-12.3 MariaDB does accept for a multi-table
UPDATE / DELETE) — there is no alternative valid form it switches to.

**What this means for tests** — at every sub-`newest` MariaDB cell
(`compatibilityVersion` `10_005_000` / `10_004_000` / `10_003_003` /
`oldest`, run against `mariadb:10.5` / `10.4` / `10.3` under
`--docker-version closest`) the CTE-on-DML tests are commented out with
`// TODO[LIMITATION]: see LIMITATIONS.md`. The emitted SQL is
**byte-identical** to `newest` (verified in mock at each
`compatibilityVersion`), so the SQL builder is validated by the live
`newest` (12.3) cell; the older cells simply cannot execute it. Affects
`delete.returning.execute-shapes`, `delete.using.variants`,
`update.from.variants`, `with-values` and
`with-values.builder-position-hoists` (7 tests).

This stays `TODO[LIMITATION]` rather than `NOT-APPLICABLE` because the
methods are callable on `MariaDBConnection` (no type-level narrowing) and
MariaDB 12.3+ accepts the SQL — only the older engines reject it.

## MariaDB `json_arrayagg` (aggregate-as-array / JSON array projection) requires MariaDB 10.5+

The `aggregateAsArray` projections and every JSON-array value source compile
to `json_arrayagg(...)` (usually `cast((select json_arrayagg(...) …) as char)`),
which MariaDB only ships from **10.5**. Earlier releases have no such function,
so the query fails at runtime — `ER_SP_DOES_NOT_EXIST (1305) FUNCTION
<db>.json_arrayagg does not exist` for a bare call, or `ER_PARSE_ERROR (1064)`
when a `DISTINCT` / `ORDER BY` sits inside the (unknown) function and the parser
rejects it first.

Verified: green on the `10_005_000` cell (real `mariadb:10.5`), rejected on
`10_004_000` / `oldest` (real `mariadb:10.4` / `10.3`). The library emits the
same `json_arrayagg` SQL on every `compatibilityVersion` — there is no
older-MariaDB equivalent it could switch to (`GROUP_CONCAT` builds a delimited
string, not a JSON array), so this is deliberately **not** a
`compatibilityVersion` breakpoint.

**What this means for tests** — the `aggregate-as-array*`,
`aggregate-nested-object`, `docs:aggregate-as-object-array` and every
inline-aggregated-array test is commented out with `// TODO[LIMITATION]: see
LIMITATIONS.md` on the sub-`newest` MariaDB cells and runs live on `newest`
(12.3) and the other dialects. Stays `TODO[LIMITATION]` rather than
`NOT-APPLICABLE` because the API is callable on `MariaDBConnection` and MariaDB
10.5+ accepts the SQL.

## MariaDB `INSERT … RETURNING` requires MariaDB 10.5+

[MariaDB added `RETURNING` on `INSERT` in 10.5.0](https://mariadb.com/kb/en/insert/);
earlier releases reject the clause with `ER_PARSE_ERROR (1064)`. The library
emits an explicit `.returning(...)` on an INSERT as `insert … returning …` on
**every** `compatibilityVersion` (the `10_005_000` breakpoint only switches the
*implicit* last-inserted-id read between `returning id` and a `last_insert_id()`
follow-up — the user-requested explicit RETURNING is always emitted, per this
file's engine-support policy). Verified: green on `10_005_000` (real
`mariadb:10.5`), rejected on `10_004_000` / `oldest` (real `mariadb:10.4` /
`10.3`).

**Sequence-assigned primary keys are a special case.** At `compatibilityVersion
< 10_005_000` the library reads an auto-generated INSERT key back through
`last_insert_id()` instead of `RETURNING`. `last_insert_id()` only tracks
`AUTO_INCREMENT`, not a `nextval(<seq>)`-assigned value, so a **sequence**
primary key comes back wrong (0 / stale) on pre-10.5 MariaDB — reading it back
correctly needs `INSERT … RETURNING` (10.5+). This surfaces as a wrong-value
assertion, not a SQL error.

**What this means for tests** — the `insert.returning`,
`insert.execute-variants` (including the `throws-when-*` guards, which never
reach the library check because the RETURNING SQL is rejected first),
`insert.on-conflict.dynamic-set`, `insert.from-select.variants`,
`insert.multi-row`, `docs:insert` RETURNING tests and the two
`insert.autogenerated-by-sequence` sequence-PK tests are commented out with `//
TODO[LIMITATION]: see LIMITATIONS.md` on the sub-`newest` MariaDB cells and run
live on `newest` (12.3). Callable on `MariaDBConnection`, accepted by 10.5+, so
`TODO[LIMITATION]` not `NOT-APPLICABLE`.

## MariaDB `EXCEPT ALL` / `INTERSECT ALL` compound variants require MariaDB 10.5+

MariaDB added the base `EXCEPT` / `INTERSECT` set operators in 10.3 but the
**`ALL`** variants (`EXCEPT ALL`, `INTERSECT ALL`) only in **10.5**; earlier
releases reject them with `ER_PARSE_ERROR (1064)`. (`minusAll` routes through the
`EXCEPT ALL` alias, so it is the same gap.) The library emits the `ALL` form on
every `compatibilityVersion` — there is no older-compatible rewrite it switches
to.

Verified: green on `10_005_000` (real `mariadb:10.5`), rejected on `10_004_000`
/ `oldest` (real `mariadb:10.4` / `10.3`). Plain `UNION [ALL]`, `EXCEPT`,
`INTERSECT` and `MINUS` all run live on 10.4.

**What this means for tests** — the `exceptAll` / `intersectAll` / `minusAll`
cases in `select.compound*` are commented out with `// TODO[LIMITATION]: see
LIMITATIONS.md` on the sub-`newest` MariaDB cells and run live on `newest`
(12.3). Callable + accepted by 10.5+ → `TODO[LIMITATION]`, not `NOT-APPLICABLE`.

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

## MySQL 5.7: recursive CTEs and the `VALUES` row constructor are refused (`compatibilityVersion < 8_000_000`)

At `compatibilityVersion < 8_000_000` (targeting MySQL 5.x) the builder enters "MySql
compatibility mode": a `WITH` clause is inlined into the `FROM` rather than emitted, and
two constructs it cannot express on that version are refused outright with a
`TsSqlProcessingError { reason: 'UNSUPPORTED_QUERY' }` at query-build time:

- **Recursive queries** (recursive `WITH`) — added in MySQL **8.0.1**; MySQL 5.7 has no
  recursive CTE and no equivalent, so the builder throws rather than emit invalid SQL.
- **`VALUES` row constructors** (a `Values` source used as a derived table) — the
  `VALUES ROW(...), ...` table constructor arrived in MySQL **8.0.19**; below it the
  builder throws.

The throw is by design and documented on the MySQL configuration page. We treat it as a
deployment limitation (the target version simply cannot run the query — the same outcome
as the server rejecting the SQL), not `NOT-APPLICABLE`: the API is callable and every
MySQL 8.0.1+ / 8.0.19+ engine accepts the query the newer cells emit.

Verified against real `mysql:5.7`: the `cte.recursive-*`, `docs.recursive-select`,
`with-values*` and the recursive-projection cases in `customize-query.select` /
`select.aggregate-as-array-inline-wrapped` throw on `oldest`; all run live on `8_000_000`
/ `newest`.

**What this means for tests** — those cases are commented out with
`// TODO[LIMITATION]: see LIMITATIONS.md` on the MySQL `oldest` cell and run live on every
other MySQL cell (identical snapshot on 8.0+).

## MySQL `EXCEPT` / `INTERSECT` compound operators require MySQL 8.0.31+

MySQL added `EXCEPT` and `INTERSECT` (base and the `ALL` variants) in **8.0.31**; MySQL
5.7 rejects every form with `ER_PARSE_ERROR (1064)`. (`minus` / `minusAll` route through
the `EXCEPT` aliases, so they are the same gap.) The library emits the operator on every
`compatibilityVersion` — there is no older-compatible rewrite (a `NOT IN` / `NOT EXISTS`
emulation) it switches to. Plain `UNION [ALL]` is unaffected (5.7 supports it).

Verified: `(select 1) except (select 2)` and `(select 1) intersect (select 2)` → 1064 on
real `mysql:5.7`; the same SQL runs live on `newest`.

**What this means for tests** — the `except*` / `intersect*` / `minus*` cases in
`select.compound*` and `customize-query.compound` are commented out with
`// TODO[LIMITATION]: see LIMITATIONS.md` on the MySQL `oldest` cell and run live on
`newest`.

## MySQL `aggregateAsArray` (JSON array projection) requires MySQL 8.0.14+

`aggregateAsArray` emits `json_arrayagg(...)` over a correlated derived table (e.g.
`(select json_arrayagg(a_1_.result) from (select … where fk = outer.id …) as a_1_)`).
Both pieces need MySQL **8.0.14**: `json_arrayagg` was added there, and a derived table
that references an outer column needs `LATERAL` (also 8.0.14). MySQL 5.7 rejects the query
— the correlated reference surfaces first as `ER_BAD_FIELD_ERROR (1054)` (`Unknown column
'…' in 'where clause'`). There is no `group_concat`-based form the builder falls back to.

Verified against real `mysql:5.7`: the inline aggregate-as-array queries fail with 1054;
they run live on `newest`.

**What this means for tests** — the affected cases in
`select.aggregate-as-array-inline-wrapped`, `docs.aggregate-as-object-array`,
`select.compound` and `select.runtime-value-coverage` are commented out with
`// TODO[LIMITATION]: see LIMITATIONS.md` on the MySQL `oldest` cell and run live on
`newest`.

## MySQL case-insensitive replace emits `regexp_replace`, which requires MySQL 8.0.4+

`replaceAllInsensitive` (and the collation-driven replace paths) emit `regexp_replace`,
added in MySQL **8.0.4**. MySQL 5.7 has no such function and rejects the call with
`ER_SP_DOES_NOT_EXIST (1305)` (`FUNCTION <db>.regexp_replace does not exist`). The library
emits it on every `compatibilityVersion`.

Verified against real `mysql:5.7`: the `select.collation` and `update.set-if`
regexp_replace cases fail with 1305; they run live on `newest`.

**What this means for tests** — those cases are commented out with
`// TODO[LIMITATION]: see LIMITATIONS.md` on the MySQL `oldest` cell and run live on
`newest`.

## MySQL window functions and the named `WINDOW` clause require MySQL 8.0.2+

Window functions (`OVER (...)`) and the named `WINDOW` clause (which
`customizeQuery.customWindow` emits as `window <name> as (…)`) arrived in MySQL **8.0.2**;
MySQL 5.7 rejects both with `ER_PARSE_ERROR (1064)`. The library emits them on every
`compatibilityVersion`.

Verified against real `mysql:5.7`: `select count(*) over (partition by 1) from (select 1)
t` → 1064; the `customize-query.select` / `customize-query.compound` window cases run live
on `newest`.

**What this means for tests** — those cases are commented out with
`// TODO[LIMITATION]: see LIMITATIONS.md` on the MySQL `oldest` cell and run live on
`newest`.

## Oracle multi-table `UPDATE … FROM` / `DELETE … USING` requires Oracle Database 23ai

Oracle added the ANSI `UPDATE … FROM` and `DELETE … USING` forms in
[Oracle Database 23ai](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/UPDATE.html);
earlier releases reject the `FROM` / `USING` keyword at the parser with
`ORA-00933: SQL command not properly ended`. The methods
`connection.update(t).from(...)` and `connection.deleteFrom(t).using(...)`
(including a `.innerJoin` / `.leftJoin` chained *after* `from` / `using`)
are exposed on `OracleConnection` for **all** versions and documented as
requiring 23ai on the [update](../docs/queries/update.md) /
[delete](../docs/queries/delete.md) pages.

Per the **Library policy on engine feature support** at the top of this
file, the `OracleSqlBuilder` emits **one form on every
`compatibilityVersion`** — the same standard `update t set … from …` /
`delete from t using …` the other dialects produce — and does **not**
emulate an older-Oracle rewrite (a correlated subquery / `MERGE`). The
docs point users who target pre-23ai at writing a `MERGE` or a correlated
subquery themselves. This is deliberately **not** a `compatibilityVersion`
breakpoint: unlike the `Values` feature (native `VALUES` vs `SELECT … FROM
dual UNION ALL` — two valid forms of the same result), there is no
alternative valid form to switch to, so there is nothing to gate.

**What this means for tests** — at the `oracle/oldest` cell
(`compatibilityVersion 21_000_000`, run against `gvenzl/oracle-xe:21`
under `--docker-version closest`) every multi-table `update.from(...)` /
`deleteFrom.using(...)` test is commented out with `// TODO[LIMITATION]:
see LIMITATIONS.md`. The emitted SQL is **byte-identical** to the
`oracle/newest` cell (verified in mock at `compatibilityVersion
21_000_000`), so the SQL builder is validated by the live `newest`
(23ai) cell; the `oldest` cell simply cannot execute it on a real 21c
engine.

This stays `TODO[LIMITATION]` rather than `NOT-APPLICABLE` because the
methods are callable on `OracleConnection` (no type-level narrowing) and
23ai accepts the SQL — only the older engine rejects it. That is distinct
from the direct `UPDATE … JOIN` / `DELETE … JOIN` grammar Oracle lacks in
**every** version, which IS typed `never` on the Oracle update/delete
surface and is marked `NOT-APPLICABLE` with a paired `types.negative/`
assertion.

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

## SQL Server named `WINDOW` clause requires SQL Server 2022+

The `customizeQuery` `customWindow` extension emits a named window definition —
`… window <name> as (<spec>) …` referenced by `over <name>`. Named windows are
standard SQL (PostgreSQL, MySQL 8+, MariaDB 10.2+); SQL Server added them in
**2022**. SQL Server 2019 has no `WINDOW` clause and rejects the keyword with
`Incorrect syntax near 'window'` — or, when the clause precedes an
`ORDER BY … OFFSET … FETCH`, a cascading `Incorrect syntax near '<window name>'`
/ `Invalid usage of the option next in the FETCH statement`. Verified against
real `mcr.microsoft.com/mssql/server:2019-latest`.

The library emits the named-window form on every `compatibilityVersion` (valid on
SQL Server 2022+ and every other dialect with named windows). Stays
`TODO[LIMITATION]` rather than `NOT-APPLICABLE` because `customWindow` is callable
and SQL Server 2022+ accepts it. Affects the `customWindow` / projection-hook
cases in `customize-query.select`, `customize-query.compound` and
`cte.recursive-union-variants` — commented out with `// TODO[LIMITATION]: see
LIMITATIONS.md` on the `sqlserver/oldest` cell (real 2019) and live everywhere else.

## SQL Server `<<` / `>>` bit-shift operators require SQL Server 2022+

SQL Server added the `<<` (left) and `>>` (right) bit-shift operators in **2022**;
2019 has neither and rejects `a << b` with `Incorrect syntax near '<'` (verified
against real 2019: `select 5 << 2` → syntax error). The `intLeftShift` domain
fragment (a `buildFragmentWithArgs` template in
`test/db/sqlserver/domain/connection.ts`) emits `<<`, so the two
`fragments.with-args` tests that exercise it are commented out with `//
TODO[LIMITATION]: see LIMITATIONS.md` on the `sqlserver/oldest` cell (real 2019)
and run live on 2022 / 2025. The operator is version-specific, not a library
defect; a portable pre-2022 form (`x * power(2, n)`) exists, but the fragment
deliberately demonstrates the native operator.

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

## Reading an integer beyond 2^53: exact when the driver is configured for it, a loud error otherwise

`bigint` columns and any arithmetic that grows past `Number.MAX_SAFE_INTEGER`
(`9_007_199_254_740_991`) arrive **rounded** on several connectors, because their
driver reads every integer as a JavaScript `number` by default. The library
cannot recover a value the driver already rounded, but it no longer accepts it
silently: `transformValueFromDB`'s integer arms (`int`, `bigint`, `stringInt`)
reject a `number` outside the safe-integer range with
`PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE` rather than return a clean, **wrong**
value. So every connector either returns the exact integer or throws — no path
returns a silently-corrupted one.

**Making it exact is the application's driver configuration, not the library's.**
v2 explicitly *removed* the forced `safeIntegers(true)` from
`BetterSqlite3QueryRunner` so every SQLite runner behaves the same way, and left
the choice to the application — see the
*Safe Integers* note on each driver's page under
[`docs/configuration/query-runners/`](../docs/configuration/query-runners/).
The library does not touch the connection object the application hands it.

| connector | how the application makes it exact |
|---|---|
| `mysql2` | `supportBigNumbers: true` on the connection — only out-of-range values change (they arrive as strings), so nothing else is affected |
| `oracledb` | an `oracledb.fetchTypeHandler` fetching wide `NUMBER` columns as strings |
| `better-sqlite3` | `safeIntegers` on the database |
| `node_sqlite` | `setReadBigInts` on the statement |
| `bun_sqlite`, `bun_sql_sqlite` | `safeIntegers` in the configuration |
| **`sqlite3`** | **no option exists** — the driver has no exact-integer API at all, and it is deprecated (its own page already warns that it loses precision past `MAX_SAFE_INTEGER`) |

**How the suite validates it.** The test
`asBigint-on-double-keeps-bigint-arithmetic-exact`
(`select.value-source.casts.test.ts`) computes `2 + 9007199254740993`
(= 9007199254740995, the first sum past 2^53). It reaches one of two outcomes by
connector, and asserts whichever applies:

- **Default reader already exact** — PostgreSQL, SQL Server, MariaDB and
  sqlite-wasm read wide integers exactly out of the box (e.g.
  `postgres/newest/pg`, where node-postgres returns the `bigint` column as a
  string that `BigInt(...)` reconstructs), so the test asserts the exact `bigint`
  straight through the shared `ctx.conn` under `--docker` / `--wasm`.
- **Native SQLite behind an opt-in exact reader** — `bun:sqlite` and
  `better-sqlite3` round `9007199254740995` to `9007199254740996` and
  `node:sqlite` throws a `RangeError` past 2^53 by default, so the test reads the
  value through a **second, opt-in connection** returned by
  `ctx.withSafeIntegers()` (see [`runners.ts`](db/sqlite/runners.ts)), which
  turns the driver's exact-integer mode (`safeIntegers` / `setReadBigInts`) on
  **per statement** and asserts the exact `bigint`. That per-statement scope
  matters: the mode is otherwise all-or-nothing — it makes the driver hand back
  **every** integer column as `bigint` (so `id` would arrive as `1n`) — and the
  in-memory db is a singleton shared across every test file, so a db-wide flip
  would corrupt every other test's `number` reads.
- **Reader rounds and stays that way** — on `mysql2` (no `supportBigNumbers`),
  `oracledb` (no `fetchTypeHandler`) and the deprecated `sqlite3` (no
  exact-integer API), the sum arrives as a rounded `number`, so the same test
  asserts the marshaller **throws** `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE`
  instead of returning a clean-but-wrong `bigint`. The mock is seeded with the
  rounded number the real driver returns, so mock and real agree. Wiring
  `supportBigNumbers` / `fetchTypeHandler` on the two configurable ones would flip
  them into the exact branch, at the cost of those cells no longer reflecting a
  default setup; that is a suite-design call, not a library one.

The two config layers are kept distinct on purpose: the `config.*` tests pin
*ts-sql-query connection-level* config (`insensitiveCollation`, `uuidStrategy`,
the datetime format) through the sanctioned `withXxx` factories over the shared
driver connection, whereas `withSafeIntegers()` reaches the *driver-level* reader
and so returns a separate connection.

**The default reader is also validated on a plain column read** — not just the
arithmetic form above. `marshalling/bigint-column-scalar-read-past-2p53`
(`select.value-marshalling.test.ts`) writes `9007199254740993` into the `bigint`
`view_count` column and reads it back **directly as a scalar column** (outside any
JSON aggregate) through the shared `ctx.conn`, i.e. the driver's default reader.
Every connector asserts its default-reader outcome: the exact-by-default readers
return the value intact, and every rounding reader (`mysql2`, `oracledb`,
`sqlite3`, `better-sqlite3`, `bun:sqlite`) raises
`PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE`. `node:sqlite` is special — its
driver *refuses* to return the value (a `RangeError`) rather than rounding it; the
library **normalizes that driver error to the same
`PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE`** (see `NodeSqliteErrorMapper`), so
the reason is uniform across every connector. The `sqlite3` cell is best-effort:
that deprecated driver has no exact-integer mode and rounds the value on write and
on read, so the column can never round-trip — the read simply throws, which is the
honest outcome (never a silently-wrong value).

## SQLite's `lower()` / `upper()` fold ASCII only, and `NOCASE` does not rescue them

SQLite's built-in `lower()` / `upper()` only fold the 26 ASCII letters; every
other code point passes through untouched. Verified against a real engine:
`lower('CAFÉ')` → `cafÉ`, `upper('café')` → `CAFé`, and therefore
`'CAFÉ' LIKE 'café'` → `0`. Every SQLite driver in this matrix is a non-ICU
build, which is also what a user gets from the stock npm packages.

This **cascades into the whole `*Insensitive` family**. With
`insensitiveCollation` unset (the default), `equalsInsensitive` /
`containsInsensitive` / `startsWithInsensitive` / … all fall through to
`lower(a) like lower(b)`, so on SQLite `.containsInsensitive('é')` does not
match `'É'` — a fully typed call silently returning fewer rows.

**Setting `insensitiveCollation: 'NOCASE'` does not help**: SQLite's `NOCASE`
collation is *also* ASCII-only. Without an ICU build there is no escape through
`lower()` **or** through a collation, so this is not something the user can
configure their way out of — it is a property of the deployed SQLite. The
library emits the same SQL every other dialect gets; the engine folds less.

**What this means for tests**: the matrix asserts case folding with ASCII data
(`'Ada Lovelace'` → `'ADA LOVELACE'`), where SQLite agrees with everyone else.
A non-ASCII insensitive assertion would have to be gated on SQLite, so the
non-ASCII coverage in `select.string-ops.test.ts` stays on `.length()`, which
*is* character-correct on SQLite.

## `stringConcat` truncates at `group_concat_max_len` on MySQL / MariaDB

`GROUP_CONCAT()` silently truncates its result at the session's
`group_concat_max_len`, which defaults to **1024 bytes**. Verified against a
real engine:

```
mysql  @@group_concat_max_len = 1024
       LENGTH(GROUP_CONCAT(6 x 200 chars)) = 1024      (expected 1205)
       SHOW WARNINGS -> Warning 1260 "Row 6 was cut by GROUP_CONCAT()"
```

It is a **warning, never an error**: the declared type is `StringValueSource`
→ `string`, and the caller gets a cleanly truncated string with no signal.
Oracle (`ORA-01489`) and SQL Server error loudly instead; PostgreSQL and SQLite
are unlimited. MySQL has no `STRING_AGG`, so `GROUP_CONCAT` is the only vehicle
and the limit is inherent to it — **there is no library-side fix**.

This is the same shape as the `bigint` case below: session configuration the
application owns, not something the library should reach into the connection to
change.

```js
pool.on('connection', c => c.query('SET SESSION group_concat_max_len = 1000000'))
```

**Why the suite can't see it**: the aggregate tests concatenate three names
(~40 bytes), far under the limit.

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

## SQLite's build has no `reverse()` function

`StringValueSource.reverse()` is a public method, callable on `SqliteConnection`
with **no** `types.negative` counterpart — the type surface accepts it and the
library emits `reverse(<x>)`. The SQLite builds this matrix uses (and the stock npm
packages) do **not** compile in a `reverse()` SQL function, so the engine rejects
the emitted SQL at runtime:

```text
sqlite> select reverse('abc');
Parse error: no such function: reverse
```

The same call runs live on the other five dialects (PostgreSQL / MySQL / MariaDB /
Oracle / SQL Server all ship `reverse` / `reverse`-equivalent). This is therefore a
**limitation** (callable API + missing runtime function), not a permanent dialect
frontier: it is **closeable** by registering a `reverse` user-defined function on the
connectors that expose a UDF-registration API (better-sqlite3, node:sqlite,
sqlite-wasm all do). Until then the `reverse()` tests on the SQLite cells are
commented out with `TODO[LIMITATION]` (full canonical body preserved) and run live
everywhere else.

## SQLite's build has no `cot()` function

`NumberValueSource.cot()` is a public method, callable on `SqliteConnection` (its
negative-type tests reject only a wrong *column* type, not SQLite itself), and the
base `AbstractSqlBuilder` emits `cot(<x>)`. The SQLite builds here expose the rest of
the trig family (`acos`/`asin`/`atan`/`cos`/`sin`/`tan`) but **not** `cot`:

```text
sqlite> select cot(1.0);
Parse error: no such function: cot
```

So this is a **limitation**, not a frontier — the trig siblings run live on SQLite,
so the boundary is one missing function, not a dialect gap. Two independent close
paths exist:

1. **Emulate `cot(x)` as `1 / tan(x)`** — exactly what `OracleSqlBuilder._cot`
   already does (Oracle also lacks a native `COT`). SQLite exposes `tan`, so a
   `SqliteSqlBuilder._cot` override emitting `1 / tan(<x>)` (plus
   `_operationsThatNeedParenthesis._cot = true`, mirroring Oracle) would make `cot`
   work on SQLite and turn every `cot` test there live. This is the cheapest close
   and the recommended one when someone picks this up.
2. Register a `cot` UDF on the connectors that expose a UDF API (as for `reverse`).

The emulation was **deliberately deferred** here to keep the taxonomy correction
free of a `src/` behaviour change; the `cot` tests on the SQLite cells stay commented
with `TODO[LIMITATION]` (full canonical body preserved) and run live on the other
five dialects.

## SQLite RETURNING can only reference the table being modified, not a FROM/JOIN-ed column

An `UPDATE … FROM …` / `UPDATE … JOIN …` whose `returning(...)` /
`returningOneColumn(...)` projects a **column of the joined relation** type-checks on
`SqliteConnection` (full `assertType`, **no** `@ts-expect-error`) and the library
emits e.g. `returning organization.name`. SQLite's RETURNING clause can only
reference the row of the table being modified, so the engine rejects it:

```text
Parse error: no such column: organization.name
```

PostgreSQL's `UPDATE … FROM … RETURNING` accepts FROM-relation columns, so the same
call runs live there. This is a **limitation** (callable API, the library emits SQL
the engine rejects), not a permanent frontier — **closeable** if SQLite widens
RETURNING or the library rewrites the projection (e.g. a follow-up SELECT). The
affected tests (`update.from` / `update.join` / `update.from.variants`) are commented
with `TODO[LIMITATION]` (full canonical body preserved) on the SQLite cells and run
live where the dialect accepts a FROM-relation RETURNING column. Distinct from the
`.innerJoin` / `.leftJoin`-on-UPDATE **typed-`never`** frontier (a real
`NOT-APPLICABLE` with a `types.negative` counterpart) and from the from-join
`returning()`-form-not-available narrowing, both of which stay `NOT-APPLICABLE`.

## `replaceAllInsensitiveFunction`'s UDF cannot be registered on `bun:sqlite` / `sqlite3`

`replaceAllInsensitiveFunction` lets a SQLite connection route
`replaceAllInsensitive` through a case-folding user-defined function (`ci_replace`).
Registering that UDF needs a driver-level user-defined-function API. **better-sqlite3**,
**node:sqlite** and **sqlite-wasm** expose one and run the test live; **bun:sqlite**
and the deprecated **sqlite3** do not, so the library cannot register `ci_replace`
there. This is **within-dialect divergence** across SQLite runners, so it is a
per-runner **limitation**, not a dialect frontier — **closeable** if those drivers add
a UDF-registration API. The `replaceAllInsensitiveFunction` test is commented with
`TODO[LIMITATION]` (full canonical body preserved) on `bun:sqlite` and `sqlite3` and
runs live on the other three SQLite runners.

*(Judgement note for a future maintainer: the prior `uuid_str`/`uuid_blob`
platform-dependent case was left `NOT-APPLICABLE`; the difference here is that the
UDF is the **library's own** and three sibling SQLite runners register it, so it
reads as a per-runner limitation. Worth a second look if the taxonomy line moves.)*

## MySQL 8.0 drops the constant operand in `col IN (<const>, <subquery>)` for a TIME column

Verified against a real `mysql:8.0` (8.0.46) container: a `TIME` column compared
with `col IN (<time-const>, (<subquery returning TIME>))` **excludes** the row that
matches the constant when the list also contains a subquery — the constant operand
is effectively dropped:

```
started_at = '09:15:00'                                     -> matches worklog 1
started_at IN ('09:15:00','10:30:00')                       -> 1,3
started_at IN ('09:15:00', (SELECT ... WHERE id=3))         -> 3        (1 lost!)
started_at IN (CAST('09:15:00' AS TIME), (SELECT ...))      -> 3        (not a coercion issue)
started_at = '09:15:00' OR started_at = (SELECT ...)        -> 1,3      (OR form is fine)
```

Only the `TIME` type is affected (the `int` / `string` / `localDate` /
`localDateTime` / `custom*` variants of the same `inN(const, subquery)` test all
pass); it is a server-side type-aggregation quirk in MySQL 8.0's evaluation of
`IN(...)` when the list mixes a constant with a subquery. **MySQL 9 evaluates it
correctly** (the `newest` cell, on `mysql:9`, returns both rows). The library emits
correct, standard SQL identical to `newest` — this is purely the older server.

**What this means for tests** — per this file's engine-support policy, "the lib
emits SQL the older server evaluates differently" is a deployment limitation, not a
library bug. The `localTime-in-n-mixed-const-and-value-source` and
`customLocalTime-in-n-mixed-const-and-value-source` tests in
`select.value-source.equality-comparison-by-type.test.ts` are commented with
`TODO[LIMITATION]` (full canonical body preserved) on the sub-`newest` MySQL cells
(`8_000_017`, `8_000_000`, `oldest`), whose `--docker-version closest` image is
MySQL 8.0 / 5.7. They run live on `newest` (MySQL 9). The SQL these tests assert is
version-independent and fully covered by the `newest` cell.

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
