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
- **postgres.js 4:** the project depends on `postgres` `^3.4.9`.
- **mkdocs-material:** it announces its end of life on 2027-05-05.
- **mkdocs-redirects 1.2.3:** it warns about `properdocs` when it runs from the
  `mkdocs` executable.
