# `test/` — work deferred on purpose

Work the maintainer decided to do later, written down so it isn't lost.
It is a working list: an entry leaves when the work is done or dropped.
Bugs found and left for later go in [`BUGS.md`](./BUGS.md), not here.

Each entry says what it is, why it waits, and what is already known.

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

## A data type given as a union

- **What:** reject a call whose data type is a union of built-in data types
  (`this.column('a', t)` with `t: 'int' | 'string'`) in the methods that take a
  data type (`column`, `const`, `arg`, `fragmentWithType`, `executeFunction`, …).
- **Why deferred:** since those methods have one generic overload for the
  built-in data types (`TYPE extends BuiltInDataType`), such a call compiles and
  gives a union of value sources; with one overload per data type no overload
  accepted it. Nothing goes wrong at run time, and for now the library assumes
  no union reaches it.
- **Known:** a guard on the parameter, measured in a probe, rejects a union of
  some data types and keeps the error of a `string` or a misspelt name (the
  list of the data types). It doesn't reject a variable of the whole union
  (`BuiltInDataType`), which TypeScript can't tell from a `string`. Its cost in
  compile time is not measured:

  ```ts
  type UnionOfOne<T> = (T extends any ? (x: T) => void : never) extends (x: infer I) => void ? I : never
  type OneDataType<TYPE> = [TYPE] extends [UnionOfOne<TYPE>] ? TYPE : [BuiltInDataType] extends [TYPE] ? BuiltInDataType : never
  // type: OneDataType<TYPE> instead of type: TYPE
  ```

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

## Temporal values for the date and time types

- **What:** accepting and returning the values of JavaScript's `Temporal` for
  the date and time types: `Temporal.PlainDate` for `localDate`,
  `Temporal.PlainTime` for `localTime`, `Temporal.PlainDateTime` for
  `localDateTime`, and probably `Temporal.Instant` for the instant columns
  (`timestamptz`, `datetimeoffset`, Oracle `TIMESTAMP WITH TIME ZONE`).
- **Why deferred:** the work on dates in any time zone keeps `Date`, and makes
  it right first. Temporal comes after, with its own design.
- **Known (2026-11-08):**
  - `Temporal` is a global in Node 26.1 and Bun 1.4.4 (run), and TypeScript 7
    ships `lib.esnext.temporal.d.ts`. Not checked: Node 22 and 24, and which
    `lib` the library's consumers compile with.
  - A plain value has no zone, which is what these types mean: with it, the
    process zone stops mattering, and a wall clock that doesn't exist locally
    (the spring-forward hour) no longer moves.
  - The text the connections send for dates in any time zone (`'2024-01-14'`,
    `'09:15:30.000'`, a date-time with the process offset on PostgreSQL and SQL
    Server, without it on MySQL and MariaDB) is close to what Temporal's
    `toString()` gives; a Temporal value would send its own text, with no
    offset for a plain value.
  - Temporal holds nanoseconds and `Date` milliseconds: PostgreSQL keeps
    microseconds and SQL Server `datetime2` 100 ns. Keeping them on reading
    needs the driver's text, not its `Date`: the per-query parsers of PGlite,
    or the driver options that hand text. Rebuilding a `Date` from its UTC
    components, which the reading side of the time-zone work does on some
    drivers, is for `Date` only.
  - Places that check `instanceof Date` today: `transformValueToDB` /
    `transformValueFromDB` in the connections (`AbstractConnection`,
    `SqlServerConnection`, `OracleConnection`), the `inferType` of
    `MssqlPoolQueryRunner`, and the decode of `aggregateAsArray` JSON.
  - To decide then: whether the choice is per connection or per column type,
    how the TypeScript types of the three value sources change, and what
    `Temporal.ZonedDateTime` maps to (only Oracle `TIMESTAMP WITH TIME ZONE`
    keeps a region name).

## Other conventions of a `localTime` on Oracle

- **What:** Oracle has no type of a time alone, and the library keeps a
  `localTime` in a `TIMESTAMP` (or a `DATE`) on the fixed day 1970-01-01, and
  compares it with that day (`currentTime()` too), keeping the index of the
  column. Two things were left for later: a convention of the connection other
  than the fixed day, `INTERVAL DAY(0) TO SECOND(n)` (and a fixed day other
  than 1970-01-01, like 1900-01-01); and type adapters that give one column
  another convention than its connection.
- **Why deferred:** the fixed day is what almost every library does (jOOQ, JDBC
  and Hibernate with 1970-01-01; Django and Doctrine with 1900-01-01; AWS DMS
  maps a `TIME` to a `TIMESTAMP(0)`), and none compares only the time of the
  day. `INTERVAL DAY TO SECOND` as a time of the day is real but niche: schemas
  made from .NET (DataObjects.NET `TimeOnly`, Dapper.NodaTime.Oracle
  `LocalTime`, linq2db and Devart `TimeSpan`) and a well-known Stack Overflow
  answer; no library outside .NET does it. Its cost is high: node-oracledb
  gives it as an `IntervalDS` (a bare one as a bind fails with NJS-044, `{ val }`
  works; fetched as text, NJS-119; its typings lack the constructor), the
  date functions need `extract`, the JSON of an aggregate `to_char`, and mixing
  it with a `TIMESTAMP` needs a conversion. A convention per column only serves a
  mixed database, and each one adds comparisons between conventions the SQL
  builder would have to reconcile.
- **Known:** `DAY(0)` accepts negative values (a `CHECK` is needed) and
  `SECOND(0)` rounds the fraction (23:59:59.9 fails with ORA-01873); measured on
  Oracle 23 with node-oracledb 26, which decodes it without any time zone.

## `aggregateAsArrayDistinct` on MySQL

- **What:** offering `aggregateAsArrayDistinct` / `aggregateAsArrayOfOneColumnDistinct` on
  MySQL, which rejects `json_arrayagg(distinct …)` (1064 on 5.7, 8.0, 8.4, 26.10).
- **Why deferred:** on 8.0.14+ it works only in the subquery form, through a correlated
  derived table with the distinct inside (`(select json_arrayagg(a_1_.x) from (select distinct
  t.x … where t.fk = p.id) a_1_)`: same rows as `select distinct` for 7 data types, no extra
  cost). The grouped form (the aggregate in a query with `group by`) has no emission: JSON_TABLE
  over the group's `json_arrayagg` fails with 1210 and a correlated derived table with 1054. A
  method that works in one form and fails in the other; in principle not done.
- **Known:** measured 2026-11-10 on 5.7.44 (impossible: 1054), 8.0.46, 8.4.13 and 26.10.0.

## External dates to watch

- **PostgreSQL 19:** general availability planned for 2026-11-19. The `newest`
  image in [`lib/dockerImages.ts`](./lib/dockerImages.ts) is `postgres:18-alpine`.
- **Prisma 8 final:**
  [`docs/configuration/query-runners/combining-with-another-library.md`](../docs/configuration/query-runners/combining-with-another-library.md)
  cites `@prisma/orm-postgres` `8.0.0-rc.22`; re-check it on the final release.
- **mkdocs-material:** it announces its end of life on 2027-05-05.
- **mkdocs-redirects 1.2.3:** it warns about `properdocs` when it runs from the
  `mkdocs` executable.
