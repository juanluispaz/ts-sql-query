# `test/` — work deferred on purpose

Work the maintainer decided to do later, written down so it isn't lost.
It is a working list: an entry leaves when the work is done or dropped.
Bugs found and left for later go in [`BUGS.md`](./BUGS.md), not here.

Each entry says what it is, why it waits, and what is already known.

## `multiply` and `divide` on `BigintValueSource`

- **What:** the overloads of `multiply` and `divide` for `BigintValueSource`.
- **Why deferred:** they are commented out in `src/expressions/values.ts`, so the
  value source offers only `add`, `subtract` and `modulo` with a bigint.
- **Known:** [`docs/api/value-expressions.md`](../docs/api/value-expressions.md)
  is consistent with that: it lists no `multiply` or `divide` for a bigint.

## Explicit divisions on exact numbers

- **What:** two divisions whose name says what happens when the query is
  written: an integer division for the integer types (`int`, `bigint`,
  `customInt`, `customBigint`), and for `customDecimal` a division that says it
  loses precision and returns a `double` (a name like `divideAsDouble`, to be
  chosen then).
- **Why deferred:** the plain `divide` of a bigint doesn't give a bigint, and
  the division of two decimals isn't exact, so neither `bigint` nor
  `customDecimal` offers `divide`: a plain `divide` on an exact type is never
  silently lossy. The explicit operations need their own design.
- **Known:** `customDecimal` has no `divide`; its rejection is in the
  `types.negative` cells (`expressions.test.ts`).

## Native `BOOLEAN` columns on Oracle 23ai

- **What:** let a boolean column be a native `BOOLEAN` on Oracle from 23ai,
  sending its values as `DB_TYPE_BOOLEAN`.
- **Why deferred:** the library keeps booleans as numbers on Oracle (`NUMBER(1)`
  columns, `1`/`0`), which works the same on 21 and 23ai: `OracleConnection`
  turns `true`/`false` into `1`/`0`, and `OracleDBQueryRunner` binds a null
  boolean as `NUMBER`.
- **Known:** `oracledb` binds a JavaScript `boolean` as `DB_TYPE_BOOLEAN`
  (`dump(:0)` gives `Typ=252` on 23ai and on 21). Choosing it by version needs
  the `compatibilityVersion` in the query runner: it can't come through
  `useDatabase`, which the connection calls in its constructor, before the field
  of a subclass that sets the version is initialized; it would go hidden in the
  params of each query, with a public reader like `getQueryExecutionName`.

## Splitting an insert by the parameter limit of each engine

- **What:** split a multi-row insert into several statements when it would pass
  the parameter limit of the engine or the driver.
- **Why deferred:** it needs a decision per engine, and it adds statements the
  user didn't write.
- **Known** (from the error mappers and their tests):
  - PostgreSQL: 65535 parameters per statement; postgres.js refuses 65534 or
    more, so 65533.
  - SQLite (default build): 32766 parameters.
  - SQL Server: 2100 parameters per request, and at most 1000 rows in one
    `values`.
  - Oracle: at most 1000 values in an `in` list (ORA-01795); a multi-row insert
    with too many binds fails with PLS-00183.
  - mysql2 and mariadb interpolate the values in the client (`query`), so the
    server sees no parameters.

## `in` lists sent as one parameter

- **What:** send the values of an `in` list as a single parameter
  (`= any($1)` on PostgreSQL, `json_each` on SQLite, `openjson` on SQL Server,
  and so on) instead of one parameter per value.
- **Why deferred:** the inventory per engine is done; the proposal is pending.

## Measuring and raising type coverage

- **What:** a measure of how much of the type surface the tests pin, and a round
  to raise it.
- **Why deferred:** not started.

## A cleanup proposal for dead code in `src/`

- **What:** a list of code in `src/` that no test reaches and that looks
  removable, for the maintainer to review.
- **Why deferred:** a guard without a typed input is often defence against
  values from JavaScript, JSON or `any` (see
  [`COVERAGE_RUNBOOK.md`](./COVERAGE_RUNBOOK.md)). Nothing is deleted without
  that review.

## External dates to watch

- **PostgreSQL 19:** general availability planned for 2026-11-19. The `newest`
  image in [`lib/dockerImages.ts`](./lib/dockerImages.ts) is `postgres:18-alpine`.
- **Prisma 8 final:**
  [`docs/configuration/query-runners/combining-with-another-library.md`](../docs/configuration/query-runners/combining-with-another-library.md)
  cites `@prisma/orm-postgres` `8.0.0-rc.22`; re-check it on the final release.
- **mkdocs-material:** it announces its end of life on 2027-05-05.
- **mkdocs-redirects 1.2.3:** it warns about `properdocs` when it runs from the
  `mkdocs` executable.
