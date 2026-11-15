# `test/` — work deferred on purpose

Work the maintainer decided to do later, written down so it isn't lost.
It is a working list: an entry leaves when the work is done or dropped.
Bugs found and left for later go in [`BUGS.md`](./BUGS.md), not here.

Each entry says what it is, why it waits, and what is already known.

## Type system: the text of a uuid in an aggregate

- **What:** check on the real engines that `max`, `min` and `anyValue` of the
  text of a uuid (`max(t.id.asString())`) give the text as the other texts of a
  uuid: in lower case on SQL Server, and converted to text on MariaDB where it
  meets another text.
- **Why deferred:** found while the text of a uuid became a data type of its
  own, a change that keeps the behaviour; it needs the final round on the real
  engines of the type system.
- **Known:** the aggregate of the text of a uuid is still the uuid in SQL
  (`max(uniqueidentifier)` on SQL Server, the native uuid of MariaDB), but the
  library treats it as a plain text, as it did before: the reading doesn't lower
  it, and the SQL doesn't convert it where it meets another text. `valueWhenNull`
  converts it already.

## Type system: `asInt` of an int whose value has decimals

- **What:** decide whether `asInt()` (and `asBigint()`) of an `int` rounds too.
  The commitment of the library is that a number with decimals that goes through
  `asInt` is rounded.
- **Why deferred:** the maintainer will decide it with the rest of the type
  system.
- **Known:** `asInt()` of a `double` writes `cast(round(x) as integer)`; of an
  `int` it writes nothing, because the data type says it is already an integer.
  An `int` can still have decimals in SQL: a SQLite column of an `INTEGER`
  affinity that keeps `2.5`, or a fragment typed `int` whose SQL divides. Then
  the value read is rejected with `INVALID_VALUE_RECEIVED_FROM_DATABASE` (it is
  not taken silently), and `asInt()` doesn't help: rounding there would cost a
  cast in every `asInt()` of an `int`, which the rule of the cleanest SQL avoids
  when the type says it isn't needed.

## Type system: converting an exact decimal to another number

- **What:** decide whether the exact decimals (`stringDecimal`, `customDecimal`)
  get `asInt`, `asBigint` and `asDouble`.
- **Why deferred:** the maintainer will decide it with the rest of the type
  system and the decimal libraries that will extend `DecimalsType`.
- **Known:** today a decimal has none of them, so the only way to an int, a
  bigint or a double is a fragment. Its `ceil`, `floor` and `round` keep the
  decimal (exact), its floating point functions give a `double`, and `sign` an
  `int`. With the commitment of `asInt`, an `asInt` or an `asBigint` of a decimal
  would round (`cast(round(x) as integer)`, as for a `double`), and an
  `asDouble` would say in its name or its documentation that it loses digits.
  The integers that work only with themselves (`bigint`, `customInt`,
  `customBigint`) have no `asInt` or `asDouble` either.

## A data type name the library doesn't know, at run time

- **What:** decide what happens when a method that takes a data type gets, at run
  time, a name that is not a built-in data type (`column('x', 'integer')` from
  JavaScript, or a value cast to `any`): today the value source is created from
  the class of its data type, which `src/typeSystem/dataTypeClasses.ts` gives,
  and an unknown name throws an `INTERNAL` error there, without saying it is the
  user's name.
- **Why deferred:** the maintainer will decide it with the rest of the runtime of
  the type system; TypeScript already rejects the name.
- **Known:** before the classes, the name travelled as a string to the SQL and
  the type adapters.

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
