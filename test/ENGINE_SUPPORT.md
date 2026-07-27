# `test/` — what the engine, its version, its build or the driver cannot run

Catalogue of the **external runtime boundaries** the test matrix meets: a
feature the deployed database has no version of, a feature a *particular*
engine version predates, a function this build of the engine was not
compiled with, or a driver that has no API for it.

These are **not** library bugs and **not** deliberate gaps in `src/`.
The API is callable — nothing in the type surface stops the call — and
`ts-sql-query` emits correct, standard SQL for it. The engine or the
driver is what refuses, lacks, or mis-evaluates it.

Everything here carries the `// NOT-SUPPORTED: <reason>` marker on the
affected tests. **Nothing here is a TODO**: no change in this repository
re-enables these tests. Only upgrading, rebuilding or replacing the
external system would — which is somebody else's release, not our
backlog. Do not "work down" this file.

## Which catalogue an entry belongs to

| File | What it catalogues | Marker | Pending? |
|---|---|---|---|
| [`BUGS.md`](./BUGS.md) | defects in `src/` — the library should do it and fails | `// TODO[BUG]:` | yes, fix it |
| [`LIMITATIONS.md`](./LIMITATIONS.md) | deliberate gaps in `src/`, or a case this harness can't drive | `// TODO[LIMITATION]:` | maybe, if the decision changes |
| **This file** | the engine / this engine version / its build / the driver can't run it | `// NOT-SUPPORTED:` | **no — not ours to close** |
| symmetry + `types.negative/` | a **dialect** boundary the type surface itself draws | `// NOT-APPLICABLE:` | **no — permanent by design** |

**The decision rule** — *is there a change in **this repo** that re-enables
the test in **this cell**?*

- **Yes** → `TODO[LIMITATION]` (or `TODO[BUG]` if the library is simply
  wrong). It is actionable debt and belongs in `LIMITATIONS.md`.
- **No — only an external upgrade would** → `NOT-SUPPORTED`, here.

An in-repo close path counts **only when it covers every connector of the
dialect**. A workaround that would rescue three SQLite runners and leave
two behind does not make the gap actionable debt: `cot()` is a
`TODO[LIMITATION]` because `1 / tan(x)` works on all five SQLite runners
(Oracle already emits exactly that), while `reverse()` is `NOT-SUPPORTED`
because the only close path is registering a UDF, and `bun:sqlite` and
`sqlite3` expose no UDF API.

**`NOT-SUPPORTED` vs `NOT-APPLICABLE`** — both are permanent; they differ
in **who draws the boundary**, and only `NOT-APPLICABLE` keeps a live test:

- `NOT-APPLICABLE` — the **type surface** draws it. The method is not typed
  on this connection, or the overload resolves to `never`, so the call
  cannot even be written here; it usually has a `types.negative/`
  counterpart. The SQL is still worth asserting through the mock, so the
  test may stay **live but mock-only**.
- `NOT-SUPPORTED` — the **runtime** draws it. The call compiles, the
  library emits SQL, and the engine rejects it, lacks the function, or
  evaluates it differently. There is nothing left to assert: a mock run
  would only replay the suite's own seeded values through a query no
  engine of this cell can execute. The test stays **commented out**, full
  canonical body preserved, exactly like a `NOT-APPLICABLE` placeholder.

## Library policy on engine feature support

The library does **not** detect whether the target engine supports a
feature and does **not** throw a pre-emptive error when emitting SQL the
deployed server will reject. Compatibility-version branches (e.g.
`compatibilityVersion >= 13_000_001`) only switch between **valid forms of
the same emitted SQL** — they do not act as version-gate exceptions. When a
feature only exists on a newer server release and the user's deployed
engine is older, the database raises its own SQL error and that error
surfaces verbatim to the caller. This applies even when an older release
line is still in service and the lib's default `compatibilityVersion`
(`Number.POSITIVE_INFINITY`) is ahead of what is GA: it is the user's
responsibility to pin `compatibilityVersion` to match their server, and the
engine's error is the source of truth for what it accepts.

Therefore "the lib emits SQL my old server rejects" is **never** a library
bug — it is an entry in this file, or a user configuration mistake.

## Finding the affected tests

```bash
npm run tests:where-is -- --search <api> --not-supported full
```

lists every `// NOT-SUPPORTED` that **names the API** across the matrix,
with cell + file:line (`summary` groups by reason and reports how many
cells carry each — the matrix is symmetric, so one engine fact repeats
across every cell of the dialect). For the per-cell **map** of every
caveat declared on a target area, use `tests:where-is --search <any-api>
--cell-caveats summary --coord '<cells>'` (or `full` for the markers).
Plain `grep -rn "NOT-SUPPORTED" test/db/` still works when the index isn't
built.

Which engine image a version folder runs under `--docker-version closest`
is pinned in `ENGINE_IMAGES`
([`test/lib/dockerImages.ts`](./lib/dockerImages.ts)) — that map, not the
folder name, is what decides whether an entry below applies to a cell.

---

# 1. Engine gaps that hold at every version

The dialect has no version of this feature. Not tied to a tier: the test is
commented out on **every** cell of that database and runs live on the
dialects that do support it.

## SQLite has no DDL for stored procedures or user-defined SQL functions

SQLite has no `CREATE PROCEDURE` and no `CREATE FUNCTION`: a user-defined
function can only be registered **through the driver, at runtime**, and a
stored procedure has no equivalent at all. The shared domain declares its
procedures/functions in each dialect's `schema.sql` (`cm_int()`,
`cm_bigint()`, … plus `refresh_stats` / `archive_project` /
`count_open_issues` / `project_name`), and the SQLite seed schema simply
cannot ship those bodies — which in turn means the SQLite domain has no
`callCmInt()` / `callRefreshStats()` wrapper to call.

So this is a boundary of the **engine**, not of `executeProcedure` /
`executeFunction` (both are perfectly callable on `SqliteConnection`; the
library emits `call …` / `select …()` for them). It is also, by a wide
margin, the largest single family in this catalogue: `exec.procedure-*`,
`exec.function-*` and the whole `exec.function-value-kinds` fan-out —
every return kind × {required, optional} × {no-adapter, trailing-adapter} —
are commented out on all five SQLite version tiers and run live on the
other five dialects.

Registering a UDF through the driver would **not** close it: it rescues
neither `sqlite3` nor `bun:sqlite` (no UDF API — see § 3), it cannot
express a stored procedure at all, and a function invented by the test
harness would no longer be the domain's declared surface. Nothing about
this is pending.

### SQLite's build has no `reverse()` function

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
Oracle / SQL Server all ship `reverse` / `reverse`-equivalent), so the boundary is the
SQLite **build**, not the type surface (there is no `types.negative` counterpart — the
call compiles fine). The `reverse()` tests on the SQLite cells are commented out with
`// NOT-SUPPORTED:` (full canonical body preserved) and run live everywhere else.

**Why this is not actionable debt.** The only close path is registering a `reverse`
user-defined function, and it reaches just three of the five SQLite runners
(better-sqlite3, node:sqlite and sqlite-wasm expose a UDF API; `bun:sqlite` and
`sqlite3` do not — § 3). Per the decision rule at the top of this file, a close path
that leaves connectors of the dialect behind does not make the gap a
`TODO[LIMITATION]`. Contrast `cot()`, which stays in
[`LIMITATIONS.md`](./LIMITATIONS.md) because `1 / tan(x)` closes it on all five.



### SQLite's `%` operator truncates floating-point operands to integers

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
therefore gated with `NOT-SUPPORTED` (full canonical body preserved). Tests
that modulo a floating-point value source whose value happens to be a whole
number (e.g. `billedAmount.modulo(3)` with `billed_amount = 200`) are safe
because the truncation changes nothing.

`NOT-SUPPORTED` and not `NOT-APPLICABLE` because the API is callable on SQLite —
the boundary is the operator's runtime semantics, not the type surface. And not a
`TODO[LIMITATION]` either: the only close path is a custom float-modulo UDF, which
`bun:sqlite` and `sqlite3` cannot register (§ 3).



### SQLite RETURNING can only reference the table being modified, not a FROM/JOIN-ed column

An `UPDATE … FROM …` / `UPDATE … JOIN …` whose `returning(...)` /
`returningOneColumn(...)` projects a **column of the joined relation** type-checks on
`SqliteConnection` (full `assertType`, **no** `@ts-expect-error`) and the library
emits e.g. `returning organization.name`. SQLite's RETURNING clause can only
reference the row of the table being modified, so the engine rejects it:

```text
Parse error: no such column: organization.name
```

PostgreSQL's `UPDATE … FROM … RETURNING` accepts FROM-relation columns, so the same
call runs live there. The restriction is SQLite's own: closing it needs either SQLite
widening RETURNING or the library rewriting the projection into a follow-up SELECT —
a redesign of the RETURNING path, not a deferred decision. The
affected tests (`update.from` / `update.join` / `update.from.variants`) are commented
with `NOT-SUPPORTED` (full canonical body preserved) on the SQLite cells and run
live where the dialect accepts a FROM-relation RETURNING column. Distinct from the
`.innerJoin` / `.leftJoin`-on-UPDATE **typed-`never`** frontier (a real
`NOT-APPLICABLE` with a `types.negative` counterpart) and from the from-join
`returning()`-form-not-available narrowing, both of which stay `NOT-APPLICABLE`.



### SQLite's `lower()` / `upper()` fold ASCII only, and `NOCASE` does not rescue them

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



### `stringConcat` truncates at `group_concat_max_len` on MySQL / MariaDB

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



# 2. Engine version gates

The dialect **does** support the feature — from a given release on. The
cells below that release cannot run it and never will: a version folder is
pinned to its image in `ENGINE_IMAGES`, so `mariadb/10_004_000` is
MariaDB 10.4 forever. The same test runs live on the tiers whose engine is
at or above the gate, which is where the emitted SQL gets validated.

**Keyed to the engine version, never to the `newest` label.** When a newer
tier is added and `newest` moves, every cell at or above the gate keeps
running these tests live and only the cells below stay commented.

| Engine | Gate | Feature |
|---|---|---|
| MariaDB | 10.5 | `json_arrayagg` (aggregate-as-array), `INSERT … RETURNING`, `EXCEPT ALL` / `INTERSECT ALL` |
| MariaDB | 12.3 | a `WITH` clause prefixing `UPDATE` / `DELETE` (CTE-on-DML) |
| MariaDB | 13.0.1 | `UPDATE … RETURNING` + `OLD_VALUE(col)` — **not GA yet**, see § 4 |
| MariaDB | — | `RETURNING` on multi-table DML — no release accepts it yet, see § 4 |
| MySQL | 8.0.1 / 8.0.19 | recursive `WITH` / the `VALUES` row constructor |
| MySQL | 8.0.2 | window functions and the named `WINDOW` clause |
| MySQL | 8.0.4 | `regexp_replace` (case-insensitive replace) |
| MySQL | 8.0.14 | `json_arrayagg` over a correlated derived table (`aggregateAsArray`) |
| MySQL | 8.0.31 | `EXCEPT` / `INTERSECT` (base and `ALL`) |
| MySQL | 9 | `col IN (<const>, <subquery>)` evaluated correctly for a `TIME` column |
| Oracle | 23ai | multi-table `UPDATE … FROM` / `DELETE … USING` |
| SQL Server | 2022 | the named `WINDOW` clause, the `<<` / `>>` bit-shift operators |

### MariaDB `json_arrayagg` (aggregate-as-array / JSON array projection) requires MariaDB 10.5+

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
inline-aggregated-array test is commented out with `// NOT-SUPPORTED: see
ENGINE_SUPPORT.md` on the MariaDB cells below 10.5 (`10_004_000` / `10_003_003` /
`oldest`) and runs live on MariaDB 10.5+ (`10_005_000` and `newest`) and the
other dialects — keyed to the engine version, not the `newest` label. Stays
`NOT-SUPPORTED` rather than `NOT-APPLICABLE` because the API is callable on
`MariaDBConnection` and MariaDB 10.5+ accepts the SQL.



### MariaDB `INSERT … RETURNING` requires MariaDB 10.5+

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
NOT-SUPPORTED: see ENGINE_SUPPORT.md` on the MariaDB cells below 10.5
(`10_004_000` / `10_003_003` / `oldest`) and run live on MariaDB 10.5+
(`10_005_000` and `newest`) — keyed to the engine version, not the `newest`
label. Callable on `MariaDBConnection`, accepted by 10.5+, so `NOT-SUPPORTED`
not `NOT-APPLICABLE`.



### MariaDB `EXCEPT ALL` / `INTERSECT ALL` compound variants require MariaDB 10.5+

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
cases in `select.compound*` are commented out with `// NOT-SUPPORTED: see
ENGINE_SUPPORT.md` on the MariaDB cells below 10.5 (`10_004_000` / `10_003_003` /
`oldest`) and run live on MariaDB 10.5+ (`10_005_000` and `newest`) — keyed to
the engine version, not the `newest` label. Callable + accepted by 10.5+ →
`NOT-SUPPORTED`, not `NOT-APPLICABLE`.



### MariaDB CTE-on-DML (a `WITH` clause prefixing `UPDATE` / `DELETE`) requires MariaDB 12.3+

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

**What this means for tests** — at every MariaDB cell below 12.3
(`compatibilityVersion` `10_005_000` / `10_004_000` / `10_003_003` /
`oldest`, run against `mariadb:10.5` / `10.4` / `10.3` under
`--docker-version closest`) the CTE-on-DML tests are commented out with
`// NOT-SUPPORTED: see ENGINE_SUPPORT.md`. The emitted SQL is
**byte-identical** to `newest` (verified in mock at each
`compatibilityVersion`), so the SQL builder is validated by the live
MariaDB 12.3+ cell (today only `newest`); the below-12.3 cells simply cannot
execute it — keyed to the engine version, so a future ≥12.3 tier added below
`newest` runs it live too. Affects
`delete.returning.execute-shapes`, `delete.using.variants`,
`update.from.variants`, `with-values` and
`with-values.builder-position-hoists` (7 tests).

This stays `NOT-SUPPORTED` rather than `NOT-APPLICABLE` because the
methods are callable on `MariaDBConnection` (no type-level narrowing) and
MariaDB 12.3+ accepts the SQL — only the older engines reject it.



### MariaDB UPDATE ... RETURNING requires MariaDB 13.0.1+ — `mariadb:latest` still ships 12.x

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
test against MariaDB is commented out with `// NOT-SUPPORTED: see
ENGINE_SUPPORT.md`. The SQL builder is correct; what is missing is purely
the unreleased server version. When `mariadb:latest` catches up to
13.0.1+, walk:

```bash
grep -rn "NOT-SUPPORTED" test/db/mariadb/
```

and uncomment each match — **except** the cases in the next section,
which the 13.0.1+ upgrade does **not** fix. If older `MariaDB`
`compatibilityVersion` cells (`13_000_001`, `10_005_000`, `oldest`, …)
are ever added, the `< 13_000_001` cells emit a legacy form that real
MariaDB 12.x accepts and do **not** need the wrap.



### MariaDB rejects RETURNING on multi-table DML (verified against 12.3.2)

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
  current MariaDB. Affects `update.from.variants`,
  `update.allow-when.from-and-joins`, `delete.using.variants` and
  `delete.allow-when.using-and-joins`.

This stays `NOT-SUPPORTED` rather than `NOT-APPLICABLE` because the
library emits the SQL (no type-level narrowing) and a future MariaDB
release could accept this shape. Re-probe against the real engine before
reactivating.



### MySQL 5.7: recursive CTEs and the `VALUES` row constructor are refused (`compatibilityVersion < 8_000_000`)

At `compatibilityVersion < 8_000_000` (targeting MySQL 5.x) the builder enters "MySql
compatibility mode": a `WITH` clause is inlined into the `FROM` rather than emitted, and
two constructs it cannot express on that version are refused outright with a
`TsSqlProcessingError { reason: 'UNSUPPORTED_QUERY' }` at query-build time:

- **Recursive queries** (recursive `WITH`) — added in MySQL **8.0.1**; MySQL 5.7 has no
  recursive CTE and no equivalent, so the builder throws rather than emit invalid SQL.
- **`VALUES` row constructors** (a `Values` source used as a derived table) — the
  `VALUES ROW(...), ...` table constructor arrived in MySQL **8.0.19**; below it the
  builder throws.

The throw is by design and documented on the MySQL configuration page. It is
`NOT-SUPPORTED` all the same: the target version simply cannot run the query, which is
the same outcome as the server rejecting the SQL — the library merely reports it earlier
and more clearly. Not `NOT-APPLICABLE`, because the API is callable and every
MySQL 8.0.1+ / 8.0.19+ engine accepts the query the newer cells emit.

Verified against real `mysql:5.7`: the `cte.recursive-*`, `docs.recursive-select`,
`with-values*` and the recursive-projection cases in `customize-query.select` /
`select.aggregate-as-array-inline-wrapped` throw on `oldest`; all run live on `8_000_000`
/ `newest`.

**What this means for tests** — those cases are commented out with
`// NOT-SUPPORTED: see ENGINE_SUPPORT.md` on the MySQL `oldest` cell and run live on every
other MySQL cell (identical snapshot on 8.0+).



### MySQL window functions and the named `WINDOW` clause require MySQL 8.0.2+

Window functions (`OVER (...)`) and the named `WINDOW` clause (which
`customizeQuery.customWindow` emits as `window <name> as (…)`) arrived in MySQL **8.0.2**;
MySQL 5.7 rejects both with `ER_PARSE_ERROR (1064)`. The library emits them on every
`compatibilityVersion`.

Verified against real `mysql:5.7`: `select count(*) over (partition by 1) from (select 1)
t` → 1064; the `customize-query.select` / `customize-query.compound` /
`select.has-aggregation.customize-query` window cases run live on every cell whose engine
is MySQL 8.0.2+ (all tiers except `oldest`, which is 5.7).

**What this means for tests** — those cases are commented out with
`// NOT-SUPPORTED: see ENGINE_SUPPORT.md` on any cell whose engine is below MySQL 8.0.2
(today only the 5.7 `oldest` cell) and run live on the rest. Keyed to the real engine
version, not the `newest` label — when a newer tier is added and `newest` moves, every
cell at or above 8.0.2 keeps running them live.



### MySQL case-insensitive replace emits `regexp_replace`, which requires MySQL 8.0.4+

`replaceAllInsensitive` (and the collation-driven replace paths) emit `regexp_replace`,
added in MySQL **8.0.4**. MySQL 5.7 has no such function and rejects the call with
`ER_SP_DOES_NOT_EXIST (1305)` (`FUNCTION <db>.regexp_replace does not exist`). The library
emits it on every `compatibilityVersion`.

Verified against real `mysql:5.7`: the `select.collation` and `update.set-if`
regexp_replace cases fail with 1305; they run live on every MySQL 8.0.4+ engine.

**What this means for tests** — those cases are commented out with
`// NOT-SUPPORTED: see ENGINE_SUPPORT.md` on any cell whose engine is below MySQL
8.0.4 (today only the 5.7 `oldest` cell) and run live on the rest — keyed to the
real engine version, not the `newest` label.



### MySQL `aggregateAsArray` (JSON array projection) requires MySQL 8.0.14+

`aggregateAsArray` emits `json_arrayagg(...)` over a correlated derived table (e.g.
`(select json_arrayagg(a_1_.result) from (select … where fk = outer.id …) as a_1_)`).
Both pieces need MySQL **8.0.14**: `json_arrayagg` was added there, and a derived table
that references an outer column needs `LATERAL` (also 8.0.14). MySQL 5.7 rejects the query
— the correlated reference surfaces first as `ER_BAD_FIELD_ERROR (1054)` (`Unknown column
'…' in 'where clause'`). There is no `group_concat`-based form the builder falls back to.

Verified against real `mysql:5.7`: the inline aggregate-as-array queries fail with 1054;
they run live on every MySQL 8.0.14+ engine.

**What this means for tests** — the affected cases in
`select.aggregate-as-array-inline-wrapped`, `docs.aggregate-as-object-array`,
`select.compound` and `select.runtime-value-coverage` are commented out with
`// NOT-SUPPORTED: see ENGINE_SUPPORT.md` on any cell whose engine is below MySQL
8.0.14 (today only the 5.7 `oldest` cell) and run live on the rest — keyed to the
real engine version, not the `newest` label.



### MySQL `EXCEPT` / `INTERSECT` compound operators require MySQL 8.0.31+

MySQL added `EXCEPT` and `INTERSECT` (base and the `ALL` variants) in **8.0.31**; MySQL
5.7 rejects every form with `ER_PARSE_ERROR (1064)`. (`minus` / `minusAll` route through
the `EXCEPT` aliases, so they are the same gap.) The library emits the operator on every
`compatibilityVersion` — there is no older-compatible rewrite (a `NOT IN` / `NOT EXISTS`
emulation) it switches to. Plain `UNION [ALL]` is unaffected (5.7 supports it).

Verified: `(select 1) except (select 2)` and `(select 1) intersect (select 2)` → 1064 on
real `mysql:5.7`; the same SQL runs live on every MySQL 8.0.31+ engine.

**What this means for tests** — the `except*` / `intersect*` / `minus*` cases in
`select.compound*` and `customize-query.compound` are commented out with
`// NOT-SUPPORTED: see ENGINE_SUPPORT.md` on any cell whose engine is below MySQL
8.0.31 (today only the 5.7 `oldest` cell) and run live on the rest — keyed to the
real engine version, not the `newest` label.



### MySQL 8.0 drops the constant operand in `col IN (<const>, <subquery>)` for a TIME column

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

**What this means for tests** — per the engine-support policy at the top of this
file, "the lib emits SQL the older server evaluates differently" belongs here, not in
`BUGS.md`. The `localTime-in-n-mixed-const-and-value-source` and
`customLocalTime-in-n-mixed-const-and-value-source` tests in
`select.value-source.equality-comparison-by-type.test.ts` are commented with
`NOT-SUPPORTED` (full canonical body preserved) on the MySQL cells whose engine
is below MySQL 9 (today `8_000_017`, `8_000_000`, `oldest` — `mysql:8.0` / `5.7`
under `--docker-version closest`) and run live on MySQL 9+ (today only `newest`),
keyed to the engine version rather than the `newest` label. The SQL these tests
assert is version-independent and fully covered by any live cell.


### Oracle multi-table `UPDATE … FROM` / `DELETE … USING` requires Oracle Database 23ai

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
`deleteFrom.using(...)` test is commented out with `// NOT-SUPPORTED:
see ENGINE_SUPPORT.md`. The emitted SQL is **byte-identical** to the
`oracle/newest` cell (verified in mock at `compatibilityVersion
21_000_000`), so the SQL builder is validated by the live `newest`
(23ai) cell; the `oldest` cell simply cannot execute it on a real 21c
engine.

This stays `NOT-SUPPORTED` rather than `NOT-APPLICABLE` because the
methods are callable on `OracleConnection` (no type-level narrowing) and
23ai accepts the SQL — only the older engine rejects it. That is distinct
from the direct `UPDATE … JOIN` / `DELETE … JOIN` grammar Oracle lacks in
**every** version, which IS typed `never` on the Oracle update/delete
surface and is marked `NOT-APPLICABLE` with a paired `types.negative/`
assertion.



### SQL Server named `WINDOW` clause requires SQL Server 2022+

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
`NOT-SUPPORTED` rather than `NOT-APPLICABLE` because `customWindow` is callable
and SQL Server 2022+ accepts it. Affects the `customWindow` / projection-hook
cases in `customize-query.select`, `customize-query.compound`,
`cte.recursive-union-variants` and `select.has-aggregation.customize-query` —
commented out with `// NOT-SUPPORTED: see ENGINE_SUPPORT.md` on any cell whose
engine is below SQL Server 2022 (today only the real-2019 `oldest` cell) and live
everywhere else. Keyed to the real engine version, not the `oldest`/`newest` label.



### SQL Server `<<` / `>>` bit-shift operators require SQL Server 2022+

SQL Server added the `<<` (left) and `>>` (right) bit-shift operators in **2022**;
2019 has neither and rejects `a << b` with `Incorrect syntax near '<'` (verified
against real 2019: `select 5 << 2` → syntax error). The `intLeftShift` domain
fragment (a `buildFragmentWithArgs` template in
`test/db/sqlserver/domain/connection.ts`) emits `<<`, so the two
`fragments.with-args` tests that exercise it are commented out with `//
NOT-SUPPORTED: see ENGINE_SUPPORT.md` on the `sqlserver/oldest` cell (real 2019)
and run live on 2022 / 2025. The operator is version-specific, not a library
defect; a portable pre-2022 form (`x * power(2, n)`) exists, but the fragment
deliberately demonstrates the native operator.



# 3. Driver and build boundaries

The engine supports it; the **connector** in this cell does not. This is
within-dialect divergence, so the same test typically runs live on a
sibling connector of the same database — which is exactly what makes it a
driver boundary and not a dialect one.

## `tedious` rejects a bare `NULL` bound as a custom-typed parameter

The `mssql` driver (tedious) resolves a parameter's TDS type from the bound
**value**. For an explicit `null` on an enum / custom / customComparable
column there is no value to read the type from, so the bind fails with
`EPARAM` (*"Validation failed for parameter … not implemented"*) before the
statement reaches SQL Server. Omitting the column instead (so the engine
stores its `NULL`) works, and that outcome is what
`insert-optional-custom-columns-omitted` validates; only the
**explicit-null bind** is unsupported. `insert-optional-custom-columns-set-to-null`
in `sqlserver/*/mssql/insert.optional-custom-columns.test.ts` is therefore
commented out with `// NOT-SUPPORTED:` (full canonical body preserved).

### `replaceAllInsensitiveFunction`'s UDF cannot be registered on `bun:sqlite` / `sqlite3`

`replaceAllInsensitiveFunction` lets a SQLite connection route
`replaceAllInsensitive` through a case-folding user-defined function (`ci_replace`).
Registering that UDF needs a driver-level user-defined-function API. **better-sqlite3**,
**node:sqlite** and **sqlite-wasm** expose one and run the test live; **bun:sqlite**
and the deprecated **sqlite3** do not, so the library cannot register `ci_replace`
there. This is **within-dialect divergence** across SQLite runners, so it is a
per-runner boundary, not a dialect frontier — and only those drivers growing a
UDF-registration API would close it. The `replaceAllInsensitiveFunction` test is
commented with `// NOT-SUPPORTED:` (full canonical body preserved) on `bun:sqlite` and
`sqlite3` and runs live on the other three SQLite runners.

*(Judgement note for a future maintainer: the `uuid_str`/`uuid_blob`
platform-dependent case is `NOT-APPLICABLE`; the difference here is that the
UDF is the **library's own** and three sibling SQLite runners register it, so the
boundary is the driver rather than the dialect. Worth a second look if the taxonomy
line moves.)*



### Reading an integer beyond 2^53: exact when the driver is configured for it, a loud error otherwise

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



# 4. Watchlist — entries a newer image would close

Everything else in this file is settled: the cell's engine is pinned and
the gap is permanent there. These two are the exception — they sit on a
**moving** tier (`newest`, whose image is bumped as releases ship), so a
future image genuinely re-enables them. They are still `NOT-SUPPORTED` and
not a TODO: nothing in this repo closes them, and the work when the day
comes is "bump the image, uncomment", not "implement something".

- **MariaDB `UPDATE … RETURNING` / `OLD_VALUE(col)` (13.0.1+)** — the
  builder already emits the 13.0.1 syntax at `newest`; MariaDB 13 is simply
  not GA, so `ENGINE_IMAGES.mariadb.newest` still pins 12.3. When
  `mariadb:latest` reaches 13.0.1+, bump the pin and walk
  `grep -rn "NOT-SUPPORTED" test/db/mariadb/` — uncommenting every match
  **except** the multi-table RETURNING cases below, which the upgrade does
  **not** fix.
- **MariaDB `RETURNING` on multi-table DML** — no MariaDB release accepts
  it today (verified against 12.3.2). Re-probe against the real engine
  before reactivating; do not assume the 13.x upgrade brings it.

The rest of § 2 is **not** a watchlist: those tiers exist precisely to pin
an old engine's behaviour, so their gaps are permanent by construction.

