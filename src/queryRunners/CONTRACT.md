# The contract between the query runners and the connection (v2)

Internal documentation for a contributor who adds or changes a query runner. Not published.

This document states behaviour: what the connection hands over and accepts, what each query runner sends to its driver
and may deliver, per data type, and what is checked. It names the public API (the query runners, the options of the
connection and of a type adapter, the fields of the context of the query, the reasons of the errors), the options of
the drivers, the tests that prove it and the pages of the documentation. It never names where or how the library does
it (files, lines, internal functions or marks): a refactor that keeps the behaviour leaves this document as it is, and a
change of behaviour updates it. A statement about a driver or an engine that no test of this repository backs is
marked **[inferred]**; **measured** means checked by hand on the engine, without a test that keeps it.

Two directions, always kept apart:

- **Sending** (library → database): the connection converts the value (`transformValueToDB`), the query runner adds
  it to the params (`addParam`) and, at execution, gives its driver what it needs.
- **Reading** (database → library): the query runner makes its driver deliver each value in a form the library reads,
  and the connection converts it (`transformValueFromDB`).

## 0. The rule

Three places own the work. What decides where a thing goes is **whether it conditions the SQL the library writes**.

| Place | Owns |
|---|---|
| **The connection**, with its **SQL builder** | The semantics: which values a data type accepts and promises (`transformValueToDB` / `transformValueFromDB`), the SQL around the values, the SQL of the result columns (the `transformProjection` of the connection, the `next` of a type adapter's), and **the form of a value that the SQL it writes depends on**. It hands that form to the runner and reads it back |
| **The runner's `addParam`** | How the database interprets each parameter as the type it is: the placeholder, the cast in it, and the checks of the final value (an exact decimal too wide for the database). The rule is the same for every runner of a database, and `MockQueryRunner` with the name of a runner applies the same one |
| **The runner at execution** | What is specific to its driver: how the driver must receive a value the database already handles (the UTC text of a `Date`, `1`/`0` for a boolean the driver can't bind, a driver type, an OID, a bind type), the per-query options that make the driver deliver without loss, and the shape of the rows |

- The connection hands the form the SQL depends on. Oracle has no BOOLEAN before 23ai, and the SQL the library writes
  treats a boolean as a number (`(x = 1)`, `case when C then 1 else 0 end`, `case :0 when 1`): the Oracle connection
  hands `1` / `0`. With `booleanStorage: 'boolean'` (Oracle 23ai's `BOOLEAN`) the SQL writes the booleans as on the
  other databases and the connection hands `true` / `false`. SQLite has no date or time types, and the SQL the library
  writes for dates depends on how they are stored (`strftime`, `julianday`, epoch arithmetic): the SQLite connection
  hands the text or number of its date strategy (§2.1).
- The checks of `addParam` are there because they must see the value after a type adapter (which may replace the
  connection's conversion) and cover a parameter of SQL the user writes. The library tells `addParam` the type of each
  parameter and when the position gives the database no type (`forceTypeCast`). The user who writes the SQL gives
  `addParam` the type of the value (a class, or the name of a built-in or registered data type), or `undefined` when
  the runner works it out from the value: a parameter without a context gets one with that type, original and
  requested, so it is sent as the library would send a value of that type (`forceTypeCast` false; a cast the user
  needs is written in the SQL).
- **The params keep the value the connection handed.** The adjustments of execution are made on what is passed to the
  driver, never in the params (§2.3).
- **The SQL is what the user sees.** The SQL text, with every adaptation (the placeholders and casts of `addParam`, the
  SQL written for that database), is what the logs, the interceptors, the mocks and the errors show, and it is what the
  database runs: **a runner never post-processes the generated SQL**. At execution it only adjusts what it passes to the
  driver for the params. The one exception: Oracle executes a statement with binds with a comment of their types at
  its end (`/* binds: tn */`), so the statement cache of oracledb, which keeps the types of a statement by its text,
  keeps each combination of types apart.
- A runner never changes the meaning of a value. A runner that can't do its part does nothing, and the library works
  as before.
- **The values in the database are in UTC**: a value without zone has the digits of the UTC getters of its `Date`,
  sending and reading, in any zone of the process. A database outside UTC is supported only when its zone is declared
  (§7.3). SQLite is the exception, inside its own strategies (below).
- **The golden rule**: a runner sends only the query it was given. It never adds a probe query, not even to check its
  configuration: a prerequisite that can't be read from the driver object is documented, not checked (§5). Known
  exception: `Sqlite3WasmOO1QueryRunner` runs `select last_insert_rowid()` for an insert without `returning` (built only
  for a `compatibilityVersion` below SQLite 3.35): its driver gives no other way, and the engine runs in the same
  thread.

**SQLite keeps its own date strategies**: the SQLite connection formats and parses dates itself, with its
`SqliteDateTimeFormat`. The default format is `'localdate milliseconds as text'`, in the zone of the process, so
outside UTC it doesn't follow the UTC rule of the other databases. Inside the strategies: a `localDate` is sent with the
local getters of the `Date` for every format, the `UTC …` ones included, and a `localDate` received as a `Date` is read
with its local getters, where a `localDateTime` received as a `Date` keeps it, and a `localTime` gets its day set to
1970-01-01 in the zone of the process, keeping its time of the day in that zone. The same `Date` can give
another day on SQLite than on the other databases in a process outside UTC
(`test/environments/sqlite/ApplicationTimeZone.test.ts`). Everything below about temporal values and UTC applies to
the other databases.

## 1. The pipeline

### Sending

1. Each value is converted by its type adapter, if any, then by the class of its data type, then by the type adapter
   of a type requested with one, and then by the connection's `transformValueToDB`, each step calling the next one
   (`next`). They receive the context of the type adapters, pointed at the parameter being
   prepared, with the `forceTypeCast` of the position: true where the position gives the database no type. What a
   step writes there applies to that parameter: `forceTypeCast`, the requested type
   (`setRequestedType`) and its metadata (`setMetadata`), which the runner reads at execution (§4). The connection
   marks there what it knows of a parameter: a value of a database outside UTC (§7.3); `OracleDateAsTimestampTypeAdapter`
   marks a value of an Oracle `DATE` column (§2.4). A value converted only to look at it (to know whether a number is
   an integer, for example) gets a context pointed at no parameter, and what it writes is lost. An
   `INVALID_VALUE_TO_SEND_TO_DATABASE` carries the index of the parameter (`paramIndex`).
2. Before calling `addParam`, the library keeps in the context of the query, for that parameter: its original type
   (declared in the library), the type requested for it, its `forceTypeCast`, and whether it is the value of a column
   (`isValueForColumn`: inside the values of an insert or the set of an update). Then `addParam(params, value, type)`,
   with the requested type, pushes the value and returns the placeholder, which goes through the `transformPlaceholder` of the type adapter, still
   pointed at the parameter (`index`, `valueSentToDB`, `forceTypeCast` read-only).
3. At execution the runner reads that context (§4) and builds what its driver receives (a copy of the params with
   some values written as the driver needs them, a typed bind, an OID, a type of the driver). The params array itself
   is not changed.

### Reading

0. The SQL of each column of the result is written with the `transformProjection` of its type adapter, which receives
   the connection as `next`, or with the connection's: the columns of the outermost select, of the `returning` of an
   outermost insert, update or delete (the `output` of SQL Server, the `returning … into` of Oracle), and the value of
   `executeFunction`. By default it is the identity, and on SQL
   Server `convert(nvarchar(41), …)` of a decimal. The group by, the having and the subqueries keep the SQL of the value.
   - Where the query compares or orders the column, what that `transformProjection` says in its context,
     `comparison` (`'value'`, `'equality'`, `'columnEquality'` or `'none'`), decides: with `'value'` (the default) the
     converted SQL stays in place; with any other the order by of the column writes the value, and a distinct or a
     compound select ordered by it is wrapped in a select that converts the columns. With `'columnEquality'` (equal
     only among the values of one column; the connection says it for a SQL Server decimal) a compound select is always
     wrapped, and with `'none'` a compound and a distinct select. Tests:
     `test/db/<db>/<version>/<connector>/select.type-adapter.transform-projection.test.ts`.
   - On Oracle, the OUT bind of a returning column is of the type of the value its converted SQL gives: the one its
     `transformProjection` requests (`setRequestedType`, like `'string'` for the text of a date), otherwise the one of
     the column. Every column of the result carries that type in the context of the query (`requestedType`
     of each result column, the class of the type, beside its `originalType`), and the Oracle
     runners fetch with it (§3.1).
   - The id the library reads by itself in an insert without a returning of the query (`returning id`,
     `output inserted.id`, Oracle's `returning id into`) keeps its SQL.
   - Each value inside the JSON of an aggregated array is written the same way, with the context
     `'aggregatedArrayValue'`: a converted value is the SQL of a value of any type the JSON function of the database
     takes, and `transformValueFromDB` receives its text, a number too (measured on every database, 2026-11-13). SQL
     Server's JSON written by the library (before 2025) writes it as a string: `'"' + string_escape(convert(nvarchar(max),
     …), 'json') + '"'`. By default it is the identity (with a database outside UTC, PostgreSQL and Oracle write a
     `localDateTime` or a `localTime` with its zone, §7.3), and the value keeps the encoding the library gives it in
     the JSON (§3.2).
   - The leaf is written outside the select whose distinct, order by and limit use the value (over a wrapped select,
     or in an aggregate without them; MariaDB keeps the order by and the limit inside its `json_arrayagg`). On SQL
     Server a plain select of objects is written with `for json path`, its leaves converted in place, unless a leaf is
     `'none'` or the order by names a leaf whose comparison isn't `'value'`; a compound select of objects converts its
     leaves over the wrapped compound.
   - The distinct of `aggregateAsArrayDistinct` / `aggregateAsArrayOfOneColumnDistinct` (PostgreSQL, SQLite and
     MariaDB) is inside the aggregate and compares what goes in the JSON, except for a `'none'` value when the
     aggregate is the only column of a select (a correlated subquery too) without group by, having, order by or
     customizations: PostgreSQL and SQLite write the select as the aggregate over a select of the distinct values;
     MariaDB never does, because it doesn't see a column of the outer query in a derived table (error 1054). Tests:
     `test/db/<db>/<version>/<connector>/select.type-adapter.transform-projection-aggregated-array.test.ts`.
1. The runner executes with its per-query options (§3.1) and returns rows as plain objects keyed by the column alias.
   The one-column / one-value methods take the only own property of the row and throw `ONLY_ONE_COLUMN_EXPECTED` if
   there are more.
2. The library reads each column by its alias. So rows as arrays or renamed keys give `null` silently: the runner must
   prevent them (§3.1, §5).
3. An aggregated array arriving as text is parsed keeping every JSON number as its source text; a value that is
   already an array (a driver that decoded the JSON) is used as it is. Each leaf then goes through
   `transformValueFromDB` of its type (of its type adapter, which receives the text of a converted leaf).
4. Each value goes through the same chain, the other way round: the connection's `transformValueFromDB`, the type
   adapter of a requested type, the class of its data type and its type adapter; an error that isn't of the library becomes `INVALID_VALUE_RECEIVED_FROM_DATABASE`. Its
   context has the requested type of the value as it leaves the database (the one its `transformProjection`
   requests), which an adapter that converts the value to another type changes before calling `next`.

The connection converts a value by the class of its requested type: a data type of the user is converted as its family
says, whatever its type name (an `IntegersType` as an `int`, or as a `bigint` when the SQL data type of its class
doesn't fit in a number; a `RealsType` as a `double`; a `DecimalsType` as a `stringDecimal`; a `UuidsType` as a `uuid`;
a `LocalDatesType`, `LocalTimesType` or `LocalDateTimesType` as a `localDate`, `localTime` or `localDateTime`), and a
built-in one by its type. A data type of the user whose family converts nothing (`EnumType`, `EqualableType`,
`ComparableType`, `AdditiveType`, `MultipliableType`, `DivisibleType`) and a value without a built-in type pass
unconverted. The query runners decide the same way.

## 2. Sending

### 2.1 What the connection hands to the runner (`transformValueToDB`)

Common to every type: `undefined` and `null` → `null`; `''` → `null` unless `allowEmptyString` (default `false`).
Every rejection is `INVALID_VALUE_TO_SEND_TO_DATABASE`.

| Conversion type | Accepts | Rejects | Hands to the runner |
|---|---|---|---|
| `boolean` | `boolean` | anything else | the boolean. Oracle: `1` / `0`; with `booleanStorage: 'boolean'` the boolean |
| `int` | an integer `number` (not checked for the safe range) | non-integer number, non-number | the number |
| `bigint` | `bigint` | anything else (a `number` too) | the bigint. SQLite: the text of a bigint of a type whose SQL data type is wider than 64 bits (an exact number, computed with the decimal strategy) |
| `double` | any `number` (`NaN`, `Infinity` included) | non-number | the number |
| `stringDecimal`, `DecimalsType` | a string matching `^-?(\d+(\.\d+)?\|\.\d+)$` (point separator, no exponent) | other strings, non-strings | the text |
| `string` | `string` | non-string | the string |
| `uuid` | `string` (format not checked) | non-string | the string; in lower case with the uuid strategy `'string'` (MariaDB, MySQL, Oracle, SQLite) and on SQL Server unless `useUpperCaseUuid` |
| `localDate` | a valid `Date` | invalid `Date`, non-Date | the `Date` as given (its UTC day is the value) |
| `localTime` | a valid `Date` | invalid `Date`, non-Date | a new `Date` on 1970-01-01 UTC with the UTC time of the given one; with a database outside UTC, the instant of its own day (§7.3) |
| `localDateTime` | a valid `Date` | invalid `Date`, non-Date | the `Date` as given (its UTC getters are the digits; the instant for a zoned column) |
| `plainDate`, `plainTime`, `plainDateTime` | a `Temporal.PlainDate`, `Temporal.PlainTime`, `Temporal.PlainDateTime`, the one of its type | anything else (a `Date`, a text, a Temporal value of another type) | the Temporal value as given |
| `aggregatedArray` | — | always | — |
| a type of the user whose family converts nothing, no built-in type | anything | — | the value as given |
| SQLite temporal | a valid `Date` | invalid `Date`, non-Date | text or number per `SqliteDateTimeFormat` |
| SQLite `plainDate`, `plainTime`, `plainDateTime` | its Temporal value | as above | text or number per `SqliteDateTimeFormat`: its digits, with the seconds or the milliseconds of the format (the digits below dropped) |

An unsafe integer or `NaN` passes `int` / `double` and reaches the driver; only `Sqlite3WasmOO1QueryRunner` guards the
integers beyond 64 bits (§2.2).

Tests: `test/db/<db>/<version>/<connector>/marshalling.transform-validation.test.ts` (`to-db-validation/*`).

**The runner must not assume this table holds.** A type adapter's `transformValueToDB` replaces the connection's (it
only calls it through `next` if it wants), and its result is not validated again. So a runner receives the forms above
for the built-in types without adapter, and anything for a value with an adapter or of
a type of the user whose family converts nothing. Every runner is written for that: at execution it converts only a valid `Date` of a
temporal type or a Temporal value without zone, and `addParam` checks a decimal only when it is plain decimal text; anything else is
sent as it is.

Every conversion of a Temporal value reads `Temporal` from the global object when the value is converted (the runtime's,
or a polyfill's), never when a module is loaded; without it a value of `plainDate`, `plainTime` or `plainDateTime` is
rejected with `TEMPORAL_NOT_AVAILABLE`.

### 2.2 `addParam`: placeholder, cast, checks

`addParam` pushes the value the connection handed; the only exception is an integer beyond 64 bits on
`Sqlite3WasmOO1QueryRunner`, whose text goes with a cast in the placeholder. A `MockQueryRunner` or a
`NoopQueryRunner` without the name of a runner uses the rule of its database.

| Runners | Placeholder and cast | Checks |
|---|---|---|
| `BetterSqlite3QueryRunner`, `BunSqliteQueryRunner`, `NodeSqliteQueryRunner`, `BunSqlSqliteQueryRunner`; a mock on SQLite | `?N` (1-based) | — |
| `Sqlite3WasmOO1QueryRunner` | `?N`; an integer `number` ≥ 2^63 or < −2^63 as `cast(?N as real)`, the param holding `String(value)` (the driver would wrap it) | — |
| `PgQueryRunner`, `PgPoolQueryRunner`, `BunSqlPostgresQueryRunner`; a mock on PostgreSQL | `$N`, plus `::<cast>` when `forceTypeCast` and a type is known (the one of the SQL data type, then the one of the data type, below); with a database outside UTC, `::timestamptz` on a `localDateTime` and `::timestamptz::time` on a `localTime`, forced or not (§7.3) | — |
| `PostgresQueryRunner`, `PgLiteQueryRunner` | `$N`, no cast (the type goes with the param, §2.4); with a database outside UTC, `$N::time` on a `localTime` (§7.3) | — |
| `MySql2QueryRunner`, `MySql2PoolQueryRunner`, `MariaDBQueryRunner`, `MariaDBPoolQueryRunner`, `BunSqlMySqlQueryRunner`; a mock on MySQL or MariaDB | `?`, or `cast(? as decimal(p, s))` for a decimal outside the value of a column; `BunSqlMySqlQueryRunner` also for a bigint beyond 64 bits, which it sends as text | a decimal with precision > 65 or scale > 30 |
| `MssqlPoolQueryRunner`, `MssqlPoolPromiseQueryRunner`; a mock on SQL Server | `@N` (0-based), or `cast(@N as decimal(p, s))` for a decimal outside the value of a column | a decimal with precision > 38 |
| `OracleDBQueryRunner`, `OracleDBPoolQueryRunner`, `OracleDBPoolPromiseQueryRunner`; a mock on Oracle | `:N` (0-based); with a database outside UTC, the casts of §7.3; a Temporal value without zone, its conversion with a format of its own (`to_date(:N, …)`, `to_timestamp(:N, …)`, §2.5) | a decimal with > 38 significant digits |
| a mock on `noopDB` | `$N` (0-based) | — |

A rejected decimal is `INVALID_VALUE_TO_SEND_TO_DATABASE` with its `paramIndex`. The digits of a decimal: `-0012.50`
is `decimal(4, 2)`, `0.0120` has 2 significant digits.

The type of a PostgreSQL param by data type (the cast, and the OID of postgres.js and PGlite): `bool`/16, `int4`/23,
`int8`/20, `float8`/701, `numeric`/1700 (`stringDecimal`, `DecimalsType`), `text`/25, `uuid`/2950, `date`/1082,
`time`/1083, `timestamp`/1114; with a database outside UTC, `timestamptz`/1184 for a `localDateTime` and a `localTime`
(§7.3). For a type of the user whose family converts nothing or a value without a built-in type it comes from the JS value: a bigint
`int8`, an integer number `int4` or `int8` by range, another number `float8`, anything else none.

Tests: `test/runners/postgres/PostgreSqlParamTypes.test.ts`, `test/runners/mysql/MySqlExactDecimalParams.test.ts`,
`test/runners/mariadb/MariaDBExactDecimalParams.test.ts`, `test/runners/sqlserver/MssqlParamTypes.test.ts`,
`test/runners/oracle/OracleDBParamTypes.test.ts`, `test/runners/sqlite/Sqlite3WasmOO1Numbers.test.ts`.

### 2.3 What the params hold

The params array is what every wrapper and observer receives: `ConsoleLogQueryRunner`, `LoggingQueryRunner`,
`InterceptorQueryRunner`, the executor of a `MockQueryRunner` (and so `NoopQueryRunner`), and the params of an error.
It holds what the connection handed (§2.1), plus only what `addParam` puts in the SQL text (the placeholders and
casts). A `Date` reads well: its `toISOString()` shows the UTC digits (`2024-01-14T10:00:00.000Z` for a `localDate`).

| Data type | PostgreSQL, MySQL, MariaDB, SQL Server | Oracle | SQLite |
|---|---|---|---|
| boolean | `true` / `false` | `1` / `0`; `true` / `false` with `booleanStorage: 'boolean'` | `true` / `false` |
| int, bigint, double | the number / bigint | same | same (sqlite-wasm: an integer beyond 64 bits as its text) |
| stringDecimal, DecimalsType, string, uuid | the text | the text | the text |
| localDate, localDateTime | the `Date` | the `Date` | the text or number of the date strategy |
| localTime | a `Date` on 1970-01-01 UTC (outside UTC, of its own day) | same | per the date strategy |
| a type of the user whose family converts nothing, a value with a type adapter | what the adapter or the user gives | same | same |

- What the driver receives differs from the params only by the runner's work at execution (§2.4). That work is tested
  against the real engine (the environment tests, `test/ENVIRONMENT_TESTS.md`, and the driver tests of each runner in
  `test/runners/<db>/`), not through a mock.
- A `MockQueryRunner` with `queryRunner: '<name>'` receives the SQL and params that runner builds; without a name,
  those of its database. It doesn't execute, so it never sees the adjustments of execution.
- The params also carry the context of the query (§4) as a hidden property: a listing, a spread and `JSON.stringify`
  don't include it.

### 2.4 At execution: what each runner gives its driver

What the drivers of each database receive, as a copy of the params when a value changes:

- **PostgreSQL** (every runner): a valid `Date` of a temporal type is written as text from its UTC getters:
  `localDate` → `YYYY-MM-DD`, `localTime` → `HH:MM:SS.mmm`, `localDateTime` → `YYYY-MM-DD HH:MM:SS.mmm+00`; a year < 1
  is written `0044-03-15 BC`. With a database outside UTC, see §7.3.
- **MySQL / MariaDB** (every runner): the same for a `Date` of a temporal type, `YYYY-MM-DD`, `HH:MM:SS.mmm`,
  `YYYY-MM-DD HH:MM:SS.mmm`, with a space and no offset.
- **SQLite**: a boolean as `1` / `0`, the value SQLite stores for it, on better-sqlite3, node:sqlite and sqlite-wasm,
  which reject a JavaScript boolean; bun:sqlite and Bun SQL SQLite take the params as they are and bind a boolean as
  `1` / `0` themselves.
- **Oracle** (every runner): a valid `Date` of a temporal type is bound as `DB_TYPE_DATE` (a `localDate`, at 00:00 UTC
  of its UTC day; a `localTime` or `localDateTime` of whole seconds of a `DATE` column, marked by
  `OracleDateAsTimestampTypeAdapter`) or `DB_TYPE_TIMESTAMP` (a `localTime`, a `localDateTime`, also a marked one with
  a fraction, which a `DATE` would lose in a comparison) with its UTC digits; a `null` of a `DATE` column as a `DATE`.
  So a `DATE` or `TIMESTAMP` column compares with it as it is and its index is used (a `TIMESTAMP WITH TIME ZONE` bind
  made Oracle convert the column, `SYS_EXTRACT_UTC(INTERNAL_FUNCTION(column))`, and read the whole table; measured on
  23). oracledb (Thin) writes a `DATE` or `TIMESTAMP` bind with the local getters of the `Date` it receives, in the zone
  the process has when it binds: in a process in UTC the `Date` goes as it is, otherwise as a copy whose local getters
  give the UTC ones, also for a time the zone of the process skips. This relies on how oracledb reads the `Date`: the
  `send …` cases of `test/environments/oracle/LocalTemporalValuesInAnyZone.test.ts`, with the process in Madrid and
  New York, check the stored text and fail if it changes. Thick isn't covered by the tests. With a database outside
  UTC, see §7.3.

| Runner | What the driver receives | `driverTypeOf` |
|---|---|---|
| `PgQueryRunner`, `PgPoolQueryRunner` | `query({ text, values, types })` with the values above; the type is the cast in the SQL | — (the native name of the SQL data type gives the cast) |
| `PostgresQueryRunner` | `sql.unsafe(query, params)` with the values above; a param `driverTypeOf` gives an OID → `sql.typed(value, oid)`, or the `Parameter` it gives; a forced param with a PostgreSQL type → `sql.typed(value, oid)`; others untyped. A throwing `driverTypeOf` rejects before sending | OID or `Parameter` |
| `PgLiteQueryRunner` | `db.query(query, params, { parsers, paramTypes })` with the values above; each param type is the OID `driverTypeOf` gives, else the forced param's OID, else 0 | OID |
| `BunSqlPostgresQueryRunner` | `sql.unsafe(query, params)` with the values above | — (as pg) |
| `MySql2QueryRunner`, `MySql2PoolQueryRunner` | `query({ ...queryOptions, sql }, params)` with the values above | — |
| `MariaDBQueryRunner`, `MariaDBPoolQueryRunner` | `query({ ...queryOptions, sql }, params)` with the values above | — |
| `BunSqlMySqlQueryRunner` | `sql.unsafe(query, params)` with the values above, a bigint beyond 64 bits (signed or unsigned), which Bun SQL can't bind, as its text | — |
| `MssqlPoolQueryRunner`, `MssqlPoolPromiseQueryRunner` | `request.input('<i>', type, value)` for each param, then `request.query(query)`. Type: `driverTypeOf` (a factory or a type with arguments) → by its SQL data type → by its data type → a type of the user without a SQL data type infers it from the value (a string is `NVarChar`) → a param without type infers it from the value (a `Date` the library read keeps its data type for that). tedious writes a `Date` with the UTC getters (`useUTC`, true by default) | `ISqlTypeFactory` / `ISqlType` |
| `OracleDBQueryRunner`, `OracleDBPoolQueryRunner`, `OracleDBPoolPromiseQueryRunner` | `execute(query, binds, options)`, binds by name `{ '0': …, '1': … }`: the type `driverTypeOf` gives → `{ val, type }`; in `executeProcedure`, or in any query with `booleanStorage: 'boolean'`, a boolean param (`1`/`0`/null, or a boolean) → `{ val: true/false/null, type: DB_TYPE_BOOLEAN }` (PL/SQL has BOOLEAN on every version); a boolean RETURNING OUT bind gets `DB_TYPE_BOOLEAN` only with `booleanStorage: 'boolean'` (with `'number'` it has no type and comes back as text); a temporal `Date` as above; a Temporal value without zone as its text (§2.5); a null of a number or temporal type → `{ val: null, type }`; else the value. `executeFunction` binds as any other query. RETURNING OUT binds (`{ dir: BIND_OUT, type }`): a declared type gets it with a `maxSize`; a temporal one `DB_TYPE_TIMESTAMP_TZ`; any other (a text, a number) no type and a `maxSize`, so it comes back as text. `maxSize` is the one `driverTypeOf` gives (`{ type, maxSize }`), else the `returningMaxSize` of the runner, else 32767. A `Lob` OUT value (a CLOB `driverTypeOf` gives) is read whole | `DbType` or `{ type, maxSize }`, also for OUT binds |
| `BetterSqlite3QueryRunner` | `prepare(query).all/run({ 1: p0, 2: p1, … })` | — |
| `BunSqliteQueryRunner` | `prepare(query).all/run(...params)` | — |
| `NodeSqliteQueryRunner` | `prepare(query).all/run(...params)` | — |
| `BunSqlSqliteQueryRunner` | `sql.unsafe(query, params)` | — |
| `Sqlite3WasmOO1QueryRunner` | `selectObjects(query, params)` / `exec({ sql, bind })` | — |
| `MockQueryRunner` | nothing to a driver: the user's executor gets the SQL and params the named runner builds | — |

Tests: `test/runners/oracle/OracleDBOutBinds.test.ts`, `test/runners/oracle/OracleDBReturningAndProcedures.test.ts`, and
the tests of each runner in `test/runners/<db>/`. The wrappers (`ChainedQueryRunner` and its subclasses) delegate
`addParam` and `addOutParam`, with their type, to the runner they wrap.

### 2.5 Per data type: what reaches the driver

After `transformValueToDB` without adapter, `addParam` and the work of execution, with the database in UTC.
"forced" = `forceTypeCast` true.

| Data type | PostgreSQL | MySQL / MariaDB | SQL Server (mssql type) | Oracle (bind) | SQLite |
|---|---|---|---|---|---|
| boolean | boolean; forced: `bool` | boolean, stored as 1/0 | `Bit` | number `1`/`0`; null → `DB_TYPE_NUMBER`; in a procedure, or with `booleanStorage: 'boolean'`, `DB_TYPE_BOOLEAN` (a null too) | `1`/`0` (bun:sqlite and Bun SQL: the boolean, bound as `1`/`0` by the driver) |
| int, IntegersType that fits in a number | number; forced: `int4` | number | `Int` | number; null → `DB_TYPE_NUMBER` | number (wasm: beyond 64 bits as `cast(text as real)`) |
| bigint, IntegersType wider than a number | bigint; forced: `int8` | bigint | `BigInt` | bigint; null → `DB_TYPE_NUMBER` | bigint |
| double, RealsType | number; forced: `float8` | number | `Float` | number; null → `DB_TYPE_NUMBER` | number |
| stringDecimal, DecimalsType | text; forced: `numeric` | text, `cast(? as decimal(p,s))` outside a column value | `NVarChar`, `cast(@N as decimal(p,s))` outside a column value | text; null → `DB_TYPE_NUMBER` | text (the SQL around it per `decimalStrategy`) |
| string | text; forced: `text` | text | `NVarChar` | text | text |
| uuid, UuidsType | text; forced: `uuid` | text | `UniqueIdentifier` | text | text |
| localDate | `YYYY-MM-DD` (UTC day); forced: `date` | `YYYY-MM-DD` (UTC day) | the Date, `Date` | `DATE` of the UTC day | per `SqliteDateTimeFormat` |
| localTime | `HH:MM:SS.mmm` (UTC); forced: `time` | `HH:MM:SS.mmm` (UTC) | the Date on 1970-01-01 UTC, `Time` | `TIMESTAMP` on 1970-01-01, the UTC digits | per format |
| localDateTime | `YYYY-MM-DD HH:MM:SS.mmm+00`; forced: `timestamp` | `YYYY-MM-DD HH:MM:SS.mmm` (UTC) | the Date, `DateTime2` | `TIMESTAMP`, the UTC digits | per format |
| plainDate | `YYYY-MM-DD`, a year before 1 as `0044-03-15 BC`; forced: `date` | `YYYY-MM-DD` | a Date at 00:00 UTC of its day, `Date` | text `YYYY-MM-DD AD`, the placeholder `to_date(:N, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')` | per `SqliteDateTimeFormat` |
| plainTime | `HH:MM:SS[.fffffffff]`, every digit it has; forced: `time` | `HH:MM:SS[.fffffffff]` | a Date on 1970-01-01 UTC with its `nanosecondDelta`, `Time` | text `1970-01-01 HH:MM:SS.fffffffff AD`, the placeholder `to_timestamp(:N, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', …)` | per format |
| plainDateTime | `YYYY-MM-DD HH:MM:SS[.fffffffff]`, without an offset (a wall clock: the database completes no zone); forced: `timestamp` | `YYYY-MM-DD HH:MM:SS[.fffffffff]` | a Date with its UTC getters and its `nanosecondDelta`, `DateTime2`; of a `datetime` or `smalldatetime` column, that type | text `YYYY-MM-DD HH:MM:SS.fffffffff AD` with `to_timestamp`, or, as the value of a DATE column of whole seconds, `YYYY-MM-DD HH:MM:SS AD` with `to_date(:N, 'YYYY-MM-DD HH24:MI:SS BC', …)` | per format |
| a type of the user whose family converts nothing | as given; forced: type of the JS value or none | as given | a string `NVarChar`, otherwise inferred from the value | as given | as given (a boolean `1`/`0`, except bun:sqlite and Bun SQL) |
| null of a built-in type (or of a family that converts) | forced: the type's cast/OID | null | the type's type | typed by its type (number, timestamp), otherwise untyped | null |

### 2.6 The SQL data type of a parameter

A value has two SQL data types (a family, `'exact numeric'`, `'character string'`, `'datetime'`, …, with the
properties that refine it, precision, scale, length, `national`, fractional seconds, `bytes` of an integer, …, and,
optionally, the name of the type in each database, `native`), apart:

- **The one of its data type**, the static `sqlDataType` of its class, in `originalType` and `requestedType` of the
  context: what the value is (an integer of 4 bytes for an `int`, an exact number without precision for a decimal, a
  text, a uuid, a date, …); none for a type of the user whose family converts nothing, whose values only the user knows.
- **The one declared**, `originalSqlDataType` and `requestedSqlDataType` of each parameter and column of the result:
  the one a type adapter says (`withSqlDataType`), the one of the column, for the value of the column in an insert or
  an update, a value compared with the column (`equals`, `in`, `between`, …) and the OUT params of a `returning` of
  that column; the requested one is the original one unless an adapter requests another (`setRequestedSqlDataType`).
  `undefined` when none is declared.

**The runners decide by the SQL data type of the type requested**, never by knowing a data type: the type of the
driver a value is bound with and the cast of its placeholder (an integer of up to 4 bytes is an `int4`, an `Int`, a
`NUMBER`; one of 8 an `int8`, a `BigInt`; another exact number a `numeric`, a text, a `NUMBER`; a floating point
number a `float8`, a `Float`; a date, a time or a timestamp the type of the database of its fields), the form of a
date given to the driver, the check and the cast of an exact number sent as its text, and which columns of the result
are fetched as text (an exact number that isn't an integer of up to 4 bytes, on Oracle). A class of the user that
says its own SQL data type is sent and read by it. A value without a SQL data type (an `enum`, an `EqualableType` of the user, a value of
SQL written by hand) is bound by its JavaScript value. What only the declared one says, more precise than the one of
the type (the length of a text, a large object, a `datetime` of SQL Server, a JSON, the native name of a PostgreSQL
type, the precision of a number read as text), is used only when it describes the value: when it is of the family of
the one of the requested type (any number or a money for a number; any family but a number, a boolean, a date, a time
or a binary for a text; any for a type without one). One that doesn't is how a database that emulates the type keeps
it (the `char(36)` of a uuid, the `NUMBER(1)` of a boolean, the `TEXT` of a date on SQLite) or the one of a value
sent as another type (an adapter that sends a date as a text doesn't make the text a date): it says nothing of the
value, and the value is sent and read as without it.

The rule that keeps the meaning: **a SQL data type never narrows a value.** A cast or a bind type takes the type of
the column only when the value fits in it; otherwise the runner does what it does without it.

| Runner | What it does with it | Test |
|---|---|---|
| `MssqlPoolQueryRunner`, `MssqlPoolPromiseQueryRunner` | a text of a `character string` with `national: false` goes as `VarChar` of the length of the column (`VarChar(max)` when the text is longer), when it is ASCII, the same in every code page (tedious writes a `varchar` in the code page of the database: a character it lacks becomes `?`, also for a column of a UTF-8 collation, measured on 2025); otherwise `NVarChar`, as without it. As a `nvarchar`, SQL Server converts a `varchar` column, and with a SQL collation it scans its whole index (measured on 2025: Index Scan; as a `varchar`, Index Seek); a `datetime` or a `smalldatetime` (by its native name) goes as `DateTime` or `SmallDateTime` instead of `DateTime2`: compared with a `datetime2`, SQL Server converts the column with its exact fraction of 1/300 of a second, and an equality doesn't find a value with milliseconds (measured on 2025) | `test/runners/sqlserver/SqlDataTypeParams.test.ts` |
| `OracleDB*QueryRunner` | a RETURNING OUT bind of a `character string` that is a `largeObject` is a `DB_TYPE_CLOB` (`DB_TYPE_NCLOB` when `national`), received whole (without it, a text longer than 4000 bytes fails with ORA-22835 unless `driverTypeOf` gives the CLOB); of a known `length`, its `maxSize` is that length (4 bytes per character, or the octets); an object (not a `Date` nor a binary) of a `document` of format `json` is bound as `DB_TYPE_JSON` (without a type oracledb rejects an object, NJS-044) | `test/runners/oracle/SqlDataTypeOutBinds.test.ts` |
| `PgQueryRunner`, `PgPoolQueryRunner`, `BunSqlPostgresQueryRunner`, `PostgresQueryRunner`, `PgLiteQueryRunner` | where the library forces the type of a parameter (`forceTypeCast`), and `driverTypeOf` says none, the native type of the requested SQL data type without its arguments (a cast on pg and Bun SQL; the oid when the type has a fixed one on postgres.js and PGlite, but not a json or a jsonb for a text on postgres.js, which would serialize it as a JSON string); not for a `localTime` with a zoned time (it would get the zone of the session) | `test/runners/postgres/SqlDataTypeParams.test.ts` |
| the others (MariaDB, MySQL, SQLite) | nothing yet; the SQL data type reaches a runner of the user in the context | — |

`driverTypeOf` of a runner wins over the SQL data type. Not done, on purpose: an `NVARCHAR` bind on Oracle for
`national: true` (with the database in AL32UTF8 it gains nothing measurable, and on a `VARCHAR2` column it loses the
index), a `Decimal` bind on SQL Server (tedious converts the text to a JavaScript number, losing digits), the
precision in the decimal casts of MySQL and MariaDB (the column adds nothing where the value fits), and the precision
or the length in the casts of PostgreSQL (`$1::numeric(18,4)`, `$1::varchar(20)`, `$1::timestamp(3)`): measured on
PostgreSQL 17 and 18, a value that fits gets the same plan, rows and base type (only the typmod reported to the driver
changes, which nothing reads), and one that doesn't is rounded or cut without an error, so a `coalesce`, a `case` or a
`union` gives other rows, and an explicit `varchar(n)` hides the "value too long" of an insert.

**The conversion of the types of a database**, `sqlDataTypeFrom(nativeName)` and `nativeSqlDataTypeOf(sqlDataType)`,
are methods of each connection: they follow its `compatibilityVersion` (a type the version doesn't have gives
`undefined`, never another type) and where it stores what the database lacks (`uuidStrategy`, Oracle's
`booleanStorage` and its time of the day on 1970-01-01, the date formats of SQLite). A generator uses a connection with
`NoExecutionQueryRunner`, which rejects every query with `QUERY_NOT_ALLOWED`. `nativeSqlDataTypeOf` builds the name
once for each SQL data type and class of connection (the version and the strategies are the ones of the class) and keeps
it in the SQL data type, hidden; the class overrides `buildNativeSqlDataTypeOf` to change it. Tests:
`test/runners/<db>/SqlDataTypeCatalog.test.ts` (against the catalogue of each engine), `test/runners/general/SqlDataType.test.ts`.

## 3. Reading

### 3.1 Per runner: what it sets per query, and what it delivers

Per query or per statement, overriding what the user configured on the driver; the user's settings keep applying to
their own queries.

| Runner | Per query / statement | Delivers | Tests |
|---|---|---|---|
| `PgQueryRunner`, `PgPoolQueryRunner` | `types`, built once per client: `date` (1082) and `timestamp` (1114) in text format parsed as a `Date` whose UTC getters are the digits (`infinity` stays text); every other type with the client's parser (the user's parsers apply). In a query with a `plainDate`, `plainTime` or `plainDateTime` result column, `date`, `time`, `timestamp` and `timestamptz` as their text | `date`/`timestamp` as UTC Date; the rest as the client parses it (pg defaults: `int8`, `numeric`, `time`, `timetz` and a count as text; `timestamptz` an instant Date; `int4`, `float8` numbers; `bool` boolean) | `test/runners/postgres/DeliveredValues.test.ts`, `test/runners/postgres/DriverConfiguration.test.ts` (`a-date-and-a-timestamp-are-read-as-utc-and-the-other-parsers-of-the-client-apply`, `the-types-of-the-pool-apply-to-the-other-types`) |
| `PostgresQueryRunner` | nothing for reading, except a query with a `plain…` result column: read `raw`, each value as its text, and each column through the parser postgres.js has for its type, except the `plain…` ones, which stay text | postgres.js defaults; `date`/`timestamp` with UTC digits in any zone of the process, unless `infer` (§5) | `test/environments/postgres/LocalTemporalValuesInAnyZone.test.ts` |
| `PgLiteQueryRunner` | `parsers` merged over the database's: `date` and `timestamp` as pg's above, `time` (1083) as its text; in a query with a `plain…` result column, `date`, `time`, `timestamp` and `timestamptz` as their text | those three as above; any other type with PGlite's or the user's parser | `test/runners/postgres/DriverConfiguration.test.ts` (`a-date-a-time-and-a-timestamp-are-read-as-the-library-reads-them-and-the-other-parsers-apply`) |
| `BunSqlPostgresQueryRunner`, `BunSqlMySqlQueryRunner` | nothing | Bun SQL defaults: UTC Dates (MySQL: Bun sets the session at `+00:00`, measured), text for times; a `plain…` column of a `timestamp` or a `datetime` loses the digits below the millisecond (Bun SQL gives a Date, and its `raw` values are binary): a limit of the driver | the `LocalTemporalValuesInAnyZone` tests of PostgreSQL, MySQL and MariaDB |
| `BunSqlSqliteQueryRunner` | nothing | numbers, text; dates as stored per format (SQLite has no date types) | `test/runners/sqlite/BunSqlSqliteQueryRunner.test.ts` |
| `MySql2QueryRunner`, `MySql2PoolQueryRunner` | `dateStrings: true`, `supportBigNumbers: true`, `bigNumberStrings: true`, `rowsAsArray: false`; and its own `typeCast` (DECIMAL/NEWDECIMAL as their text, else `next()`) when the connection has a `typeCast` function, `typeCast: false` or `decimalNumbers: true`, since a typeCast given with the query replaces the connection's | DATE/DATETIME/TIMESTAMP/TIME as text; BIGINT and DECIMAL as exact text; objects | `test/runners/mysql/DriverConfiguration.test.ts` (`a-connection-with-type-cast-false-doesnt-change-the-queries-of-the-runner`), `test/runners/mysql/DeliveredValues.test.ts` |
| `MariaDBQueryRunner`, `MariaDBPoolQueryRunner` | `dateStrings: true`, `supportBigNumbers: false`, `bigIntAsNumber: false`, `decimalAsNumber: false`, `insertIdAsNumber: false`, `rowsAsArray: false`, `metaAsArray: false`, `nestTables: false`, `typeCast: undefined` (each replaces the connection's) | dates as text; BIGINT and insert id as `bigint`; DECIMAL as text; objects | `test/runners/mariadb/DriverConfiguration.test.ts`, `test/runners/mariadb/DeliveredValues.test.ts` |
| `MssqlPoolQueryRunner`, `MssqlPoolPromiseQueryRunner` | `request.arrayRowMode = false`; a `plain…` result column is given as the text of the Date tedious delivers with the digits below the millisecond it keeps apart (`nanosecondsDelta`): `YYYY-MM-DDTHH:MM:SS.fffffff` | tedious defaults: BIGINT as text, INT and DECIMAL as numbers (the connection converts decimal result columns to `nvarchar(41)`), BIT as a boolean; dates with the UTC getters (`useUTC`), the instant for `datetimeoffset` | `test/runners/sqlserver/DeliveredValues.test.ts`, `test/runners/sqlserver/DriverConfiguration.test.ts` (`the-rows-are-objects-with-array-row-mode-on-the-pool`) |
| `OracleDBQueryRunner`, `OracleDBPoolQueryRunner`, `OracleDBPoolPromiseQueryRunner` | `outFormat: OUT_FORMAT_OBJECT`, `maxRows: 0`, a `fetchTypeHandler` answering every column: a result column of an exact decimal or of an integer wider than a number (by name, or the only column of an unnamed one-value result) → `DB_TYPE_VARCHAR`; `DATE`/`TIMESTAMP` → the `Date` rebuilt with its local getters as UTC; CLOB/NCLOB → string; BLOB → Buffer; else its own type | decimals and bigints as text; DATE/TIMESTAMP as UTC Date (exact except a wall clock skipped by summer time in the zone of the process, and years < 100 built as 19xx by oracledb); NUMBER as number; RETURNING OUT binds as in §2.4 | `test/runners/oracle/OracleDBResultTypes.test.ts`, `test/environments/oracle/LocalTemporalValuesInAnyZone.test.ts` |
| `BetterSqlite3QueryRunner`, `BunSqliteQueryRunner` | nothing (`safeIntegers` not forced) | numbers, or `bigint` with the driver's big-integer mode; text; dates as stored per format | the tests of each runner in `test/runners/sqlite/` |
| `NodeSqliteQueryRunner` | `setReturnArrays(false)` per statement, where the method exists (Node 22.16 and 24); `readBigInts` not forced | objects even on a database opened with `returnArrays: true`; numbers, or `bigint` with `readBigInts` | `test/runners/sqlite/NodeSqliteQueryRunner.test.ts` (`the-rows-are-objects-with-return-arrays-on-the-database`) |
| `Sqlite3WasmOO1QueryRunner` | `selectObjects` | objects; numbers, and a `bigint` for an integer beyond the safe range | `test/runners/sqlite/Sqlite3WasmOO1Numbers.test.ts` |
| `MockQueryRunner` | — | what the user's executor returns, checked for the shape of the query: for each type of query, what isn't `null`, `undefined` or the shape it needs (a plain object, an array of plain objects, an array, a number) is rejected with `INVALID_MOCKED_VALUE`, also a `null` inside the rows; then the reading tolerance of §3.3 applies to the values | `test/runners/general/MockQueryRunner.test.ts` |

The id of an inserted row (no `returning`): mysql2 `insertId`, mariadb `insertId` (a bigint), Bun SQL
`lastInsertRowid`, better-sqlite3/bun:sqlite/node:sqlite `lastInsertRowid`; `null` when no row was inserted. It goes
through `transformValueFromDB` of the id column like any value.

### 3.2 Per data type: what may arrive

What the runners of each database deliver for a value of the data type, all accepted by §3.3. What the drivers deliver by
themselves is in the `DeliveredValues` tests of `test/runners/<db>/` and in the environment tests.

| Data type | PostgreSQL | MySQL / MariaDB | SQL Server | Oracle | SQLite |
|---|---|---|---|---|---|
| boolean | boolean; text `t`/`f` from a driver or a mock that gives the text | number 0/1 (a TINYINT(1)); text `'1'`/`'0'` of an expression like `true` on mysql2, a BIGINT for MySQL | boolean | number; text `"1"` from an OUT bind of a `NUMBER(1)`; `TRUE`/`FALSE` from an OUT bind of a native BOOLEAN column (23) | number 0/1, bigint |
| int | number; text (int8, count) | number; text (mysql2 BIGINT); bigint (mariadb BIGINT) | number; text (BIGINT) | number; text from an OUT bind | number, bigint |
| bigint | text (int8) | text (mysql2); bigint (mariadb) | text | text (fetched as VARCHAR) | number, bigint |
| double | number; text (numeric) | number; text (DECIMAL) | number | number | number |
| stringDecimal, DecimalsType | text | text | text (`convert(nvarchar(41))`) | text, possibly `.5` / `-.5` | text per `decimalStrategy` |
| string, uuid | text | text | text | text | text |
| localDate | Date (`date` parsed as UTC) | text `YYYY-MM-DD` (mysql2/mariadb); Date (Bun SQL) | Date | Date (rebuilt as UTC) | per format |
| localTime | text `HH:MM:SS[.ffffff]`; `timetz` text with its offset | text `HH:MM:SS[.ffffff]` | Date | Date | per format |
| localDateTime | Date (`timestamp` UTC, `timestamptz` instant) | text `YYYY-MM-DD HH:MM:SS[.ffffff]` (mysql2/mariadb); Date (Bun SQL) | Date | Date; TSTZ instant | per format |
| aggregatedArray | text (`::text`) | text | text | text | text |

Inside an aggregated array every leaf is a JSON string or the source text of a JSON number (§1); temporal leaves are
text like `2024-01-15T00:00:00` (Oracle DATE) or `2024-01-14T09:15:30.1230000` (SQL Server); with a database outside
UTC, with their zone (§7.3).

### 3.3 What the connection accepts (`transformValueFromDB`)

The same tolerance for every runner, `MockQueryRunner` included. Precision is always ensured: a loss is detected
(`PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE`) or the value rejected (`INVALID_VALUE_RECEIVED_FROM_DATABASE`), never
silent.

Common: `undefined` and `null` → `null`; `''` → `null` unless `allowEmptyString`. Tests:
`marshalling.transform-validation.test.ts` (`from-db-validation/*`), `select.string-decimal.test.ts`,
`select.own-decimal.test.ts` in each cell.

| Conversion type | Accepts → result | `PRECISION_LOST` | Rejects |
|---|---|---|---|
| `boolean` | boolean; number → `!!v`; bigint → `!!v`; text `^-?\d+$` → `!!(+v)`; text `true`/`false`/`t`/`f` in any case | — | other text, other types |
| `int` | safe integer number; text `^-?\d+(\.0+)?$` → number; bigint → number | integer number not safe; text or bigint beyond the safe range | non-integer number, other text, other types |
| `bigint` | safe integer number → bigint; text → `BigInt(text without a trailing .0+)` (`BigInt()` also takes `0x1f` and blanks, which no database delivers); bigint | integer number not safe | non-integer number, text `BigInt` refuses, other types |
| `double` | number; text `^(-?(\d+(\.\d+)?\|\.\d+)([eE][-+]?\d+)?\|NaN\|-?Infinity)$` → `+v`; bigint → `Number(v)` (a `double` is approximate by definition: rounding a bigint is not a loss to report) | — | other text, other types |
| `stringDecimal`, `DecimalsType` | text `^-?(\d+(\.\d+)?\|\.\d+)$` (`.5` → `0.5`, `-.5` → `-0.5`); bigint → its text | any number | other text (an exponent too), other types |
| `string`, `uuid` | text, unchanged; a `uuid` in lower case with the uuid strategy `'string'` and on SQL Server unless `useUpperCaseUuid`; on SQL Server also the text of a uuid (`asString()`) in a column of the result | — | non-text |
| `localDate` | valid Date, read with its UTC getters, or temporal text (§3.4) → a new Date at 10:00 UTC of the UTC day of the received one | — | anything else, invalid Date, unparsable text, text outside the calendar |
| `localTime` | same inputs → a Date on 1970-01-01 with the UTC time of the received one; with a database outside UTC, the instant read, on its own day (§7.3) | — | same |
| `localDateTime` | same inputs → the received Date (the parsed one for text) | — | same |
| `plainDate`, `plainTime`, `plainDateTime` | its Temporal value as it is; a `Temporal.PlainDateTime` → its day (`plainDate`) or its time (`plainTime`); a `Temporal.PlainDate` → at 00:00 (`plainDateTime`); temporal text (§3.4) with every digit of its fraction up to the nanosecond, and with an offset the instant it gives in the zone of the database (the wall clock of the session that wrote it); a valid Date, by its UTC getters | — | anything else (a number too), invalid Date, unparsable text, text outside the calendar |
| `aggregatedArray` | — (each leaf is converted by its own type, §1) | — | always |
| other | as it is | — | — |
| SQLite temporal | Date, text, number or bigint per `SqliteDateTimeFormat` and the `treatUnexpected*` options | — | other types, invalid result, text outside the calendar (§3.4) |
| SQLite `plainDate`, `plainTime`, `plainDateTime` | a number or a bigint (or its text) read as a local temporal type reads it (a Julian day, a Unix time) and taken by its UTC digits; anything else as above | — | as above |

A temporal `Date` the library returns keeps its data type, so `MssqlPoolQueryRunner` sends it back with its type when
it is given without one.

### 3.4 Temporal text

The temporal text a runner delivers is trimmed and matched, case-insensitively, against:

```
[date][time][offset][ BC]      at least the date or the time
date   = [+-]?YYYY-MM-DD       year of 4 to 6 digits
time   = HH:MM[:SS[(.|,)fraction]]      after the date, preceded by one 'T' or ' '
offset = optional blanks, then Z | ±HH | ±HH[:]MM | ±HH[:]MM[:]SS
```

- Without an offset the digits are the UTC getters of the result; with one, the result is the instant it gives.
- A date alone is at 00:00; a time alone is on 1970-01-01.
- The fraction is truncated to milliseconds; every year is read as written (`0099` is 99); `BC` gives `1 - year`
  (`0044 BC` → −43).
- For a `plainDate`, a `plainTime` or a `plainDateTime` the same grammar, with an era also as ` AD` (Oracle writes
  it always): the fraction keeps every digit up to the nanosecond (the ones beyond are dropped), and with an offset the
  result is the wall clock of the instant it gives in the zone of the database (`databaseTimeZone`), the wall clock of
  the session that wrote it.
- Rejected when the text doesn't match, or its digits are outside the calendar: month ∉ 1..12, a day the month doesn't
  have (`2024-02-30`, kept by MySQL/MariaDB with `ALLOW_INVALID_DATES`; a zero date `0000-00-00`), hours > 23 (the end
  of the day `24:00:00`, accepted by PostgreSQL `time` and MySQL/MariaDB `TIME`), minutes or seconds > 59. SQLite
  applies the same calendar check before its strategies.

Forms that reach the connection: `2024-01-14` (mysql2/mariadb `dateStrings`), `09:15:30.123456` (PostgreSQL and MySQL
`time`), `19:30:15.123+09` (PostgreSQL `timetz`), `2024-01-14 09:15:30.123456` (MySQL DATETIME), `2024-01-14
09:15:30+09`, `…+05:30`, `…+00:14:44` (PostgreSQL offsets, of a `timestamptz` read as text), `2024-01-14T09:15:30.1230000`
and `…Z` (JSON aggregates). pg and PGlite parse a `date` and a `timestamp` inside the runner with this same grammar
(`2024-01-14`, `2024-01-14 09:15:30.123456`, `0044-03-15 BC`) and deliver a `Date`; a value they can't parse
(`infinity`) is delivered as its text, and then rejected by `transformValueFromDB`.

## 4. The context of the query

The library hangs on the params of a query the context of the query (`QueryContext`): what the query runner may read
besides the SQL and the params. It travels with the params, as a hidden property (out of a listing, a spread and
`JSON.stringify`), and is never sent. Each execution gets a copy of the params with a context of its own: what the
construction wrote is the same, where it was executed is its own, so a query executed again before an execution ends
doesn't change what the first reads. A query runner reads it with `getQueryContext(query, params)`, the only way to
read it. The type is read-only, and all of it is optional information, so a runner must still work with params built
by hand (an empty context).

| Of | Field | Written by | What it is for |
|---|---|---|---|
| each parameter | `originalType`, `requestedType` (the class of each type, with its `type` and `sqlDataType`), `forceTypeCast` | the library before `addParam` / `addOutParam`; the requested type, by the type adapter (`setRequestedType`) | the type of each param at execution: the UTC text of a `Date` (PostgreSQL, MySQL/MariaDB), OIDs (postgres.js, PGlite), mssql types, Oracle bind types, what `driverTypeOf` receives. A param added without a type is sent as the driver infers it |
| each parameter | `originalSqlDataType`, `requestedSqlDataType` | the type adapter the parameter is converted with (`withSqlDataType`), the one of the column for a value compared with it; the requested one, by the adapter (`setRequestedSqlDataType`) (§2.6) | the type of the column in the database, for the bind type or the buffer of the driver |
| each parameter | `isValueForColumn` | the library before `addParam`, inside an insert's values or an update's set | the column gives the type: no decimal cast on MySQL/MariaDB and SQL Server; on Oracle with a database outside UTC, a bare placeholder (§7.3) |
| each parameter | `getMetadata(key)`: a key of a type adapter or of the library | `transformValueToDB` of the type adapter and of the connection (`setMetadata`), before `addParam`, also for a `null` | `OracleDateAsTimestampTypeAdapter` marks its `localDateTime`/`localTime` parameters, which the Oracle runners bind as a `DATE` when of whole seconds, and as a `DATE` when `null` (§2.4); the connection marks the temporal values of a database outside UTC (§7.3) |
| the query | `getMetadata(key)`: a key of a type adapter | `setQueryMetadata` in the context of `transformValueToDB`, `transformPlaceholder` and `transformProjection` of a type adapter or of the connection, while the query is built (a value only looked at, or a projection called only to learn what it says, writes nothing) | what an adapter knows of the whole query, for the query runner |
| the query | `resultColumns`, `getResultColumn(name)` | the library | the expected type of each result column (`name` = key in the row, `path`, the original and the requested type, the original and the requested SQL data type when its adapter says one; `aggregatedArray` for an aggregated array): Oracle fetches decimals and bigints as text. `[]` when the query returns no columns, `undefined` for a query the library didn't build |
| the query | `connectionConfiguration` | the library | the connection's settings (`ConnectionConfiguration`: `allowEmptyString`, `compatibilityVersion`, `uuidStrategy`, `decimalStrategy`, `databaseTimeZone`, `booleanStorage`, the SQLite date formats, …), read live from the connection |
| each execution | `executionSource`, `executionStack`, `functionExecutingQuery`, `executionName`, `executionMetadata` | the library | logging and errors |
| each execution | `isSelectPageCount` | `executeSelectPage` | tells the count query apart |

The library also keeps there, out of the public type, whether a query has a returning clause (to read rows or the id
of the inserted row) and the affected row count of an Oracle multi-row insert.

The readers of version 1 (`getQueryExecutionName`, `getQueryExecutionMetadata`, `getQueryExecutionStack`,
`getFunctionExecutingQuery`, `isSelectPageCountQuery`) read the same context, and are exported only by the path of
version 1.

## 5. The driver object: what the runner checks, isolates, and leaves to the user

### 5.1 The criterion

The runner receives a driver object the user configured (a client, a pool, a connection, a database, an `sql`
instance). For what that configuration could change in the library's queries:

1. **Isolate per query or per statement** wherever the driver takes the option there, as long as it is an option and
   not a rewrite of the driver: pg `types`, PGlite `parsers`, mysql2 options (with its own `typeCast` when the
   connection has a `typeCast` function, `typeCast: false` or `decimalNumbers`), mariadb options, oracledb
   `fetchTypeHandler`, `maxRows` and `outFormat`, mssql `arrayRowMode`, node:sqlite `setReturnArrays(false)` per
   statement (§3.1). The user's settings keep applying to their own queries.
2. **Validate** what can't be set per query and would lose data or change it silently (§5.2), with
   `INVALID_CONFIGURATION`, read from the object the runner holds or the environment: when the runner is created, or at
   each query when it depends on the configuration of the connection (the zone of the database), which the runner
   doesn't have when it is created.
3. **Document** what can't be read without a query (a session setting, a module-global parser), as a requirement of
   the connection on the runner's page (`docs/configuration/query-runners/recommended/<runner>.md`, "Connection
   requirements"; on better-sqlite3, bun:sqlite and sqlite-wasm, "Large integers") (§5.3).
4. **A loss that is detected anyway** (an unsafe number for an integer, a number for a decimal: `PRECISION_LOST`) needs
   nothing: choose what is cheapest to run.
5. **Never a query** to check any of it.

### 5.2 Checks (`INVALID_CONFIGURATION`)

Read only from the driver object the runner holds or the environment. "The process in UTC" is decided by the name of
its zone: `TZ` when set, else the zone the runtime resolves, matched against the names of UTC (`UTC`, `UTC0`,
`Etc/UTC`, `UCT`, `GMT`, `GMT0`, `GMT±0`, `Etc/GMT…`, `Universal`, `Zulu`, `Greenwich`, …, case-insensitive, a leading
`:` ignored), never by its current offset; it is decided again when `TZ` changes, since Node and Bun change the zone of
the process when it is assigned (`test/runners/general/ProcessTimeZone.test.ts`).

"The session in another zone" (checked at each query, before anything is sent) compares the zone the configuration
gives the session with the `databaseTimeZone` of the connection (UTC by default): an unset session has the zone of the
database (except on oracledb, below); with the database in UTC, a name of UTC or a zero offset (`+00:00`, `00:00`,
`+00`) is accepted; with another zone, the same name. The message tells a user with a database outside UTC to declare
its zone, not to move the session to UTC (that mixes the database, §7.3).

| Runner | `name` | Rejected | Tests |
|---|---|---|---|
| `PgQueryRunner`, `PgPoolQueryRunner` | `binary` | when created: `binary: true` on the client or the pool; a pool client in binary mode (`pg.defaults.binary`) is rejected when the pool gives it, and released | `test/runners/postgres/DriverConfiguration.test.ts` (`pg-in-binary-mode-is-rejected`, `a-client-in-binary-mode-a-pool-gives-is-rejected-and-given-back`) |
| `PgQueryRunner`, `PgPoolQueryRunner` | `options` | at each query: the session in another zone, by a `TimeZone` in the `options` of the client (the configuration, the `options` of the connection string, `PGOPTIONS`, `pg.defaults.options`; a client of a pool too), read as the server reads its command-line options (`-c TimeZone=…`, `--timezone=…`, the last wins). A pool is checked by the runner of each client it gives | same file (`a-session-in-another-zone-than-the-database-is-rejected`, `a-pool-whose-connection-string-puts-the-session-in-another-zone-is-rejected-at-its-first-query`); `test/environments/postgres/DatabaseOutsideUtc.test.ts` |
| `PostgresQueryRunner` | `transform` | when created: `transform.column.from`, `.value.from` or `.row.from` set | same file (`a-postgres-js-transform-of-the-results-is-rejected`) |
| `PostgresQueryRunner` | `connection` | at each query: the session in another zone, by an entry `timezone` (in any case) of `connection`, which also holds the parameters of the URL that aren't options of postgres.js, or a `TimeZone` in its `options` entry, read as pg's | same file (`a-session-in-another-zone-than-the-database-is-rejected`); `test/environments/postgres/DatabaseOutsideUtc.test.ts` |
| `PostgresQueryRunner` | `infer` | when created: `infer: true` with the process outside UTC | `test/environments/postgres/LocalTemporalValuesInAnyZone.test.ts` |
| `BunSqlPostgresQueryRunner`, `BunSqlMySqlQueryRunner`, `BunSqlSqliteQueryRunner` | `transform` | when created: `transform.column` is a function, or its `from` is set (`SQL.camel`, `SQL.toCamel`, …) | `test/runners/general/BunSqlConfiguration.test.ts` (`a-transform-that-renames-the-columns-of-the-results-is-refused`, `a-transform-whose-column-is-a-function-is-refused-as-given`) |
| `BunSqlPostgresQueryRunner` | `adapter` | when created: an adapter neither unset nor `'postgres'` | same file |
| `BunSqlMySqlQueryRunner` | `adapter`, `foundRows` | when created: an adapter not `'mysql'`/`'mariadb'`; `foundRows !== true` | same file |
| `BunSqlSqliteQueryRunner` | `adapter` | when created: an adapter not `'sqlite'` | same file |
| `MssqlPoolQueryRunner` (and the runner per pool `MssqlPoolPromiseQueryRunner` creates, so it rejects its first query) | `useUTC` | when created: `useUTC: false` with the process outside UTC (a `Transaction` gives its pool's configuration) | `test/environments/sqlserver/LocalTemporalValuesInAnyZone.test.ts` |
| `MssqlPoolQueryRunner` | `textsize` | when created: `textsize` a number below `2147483647`, the default of tedious (a longer text of a `max` type would be cut without an error) | `test/runners/sqlserver/DriverConfiguration.test.ts` (`a-pool-with-a-textsize-below-the-default-is-rejected`) |
| `MssqlPoolQueryRunner` | `camelCaseColumns`, `columnNameReplacer` | when created: `camelCaseColumns: true` or a `columnNameReplacer` | same file (`a-pool-that-renames-the-columns-is-rejected`) |
| `OracleDBQueryRunner`, `OracleDBPoolQueryRunner`, `OracleDBPoolPromiseQueryRunner` | `ORA_SDTZ` | at each query: the session in another zone. oracledb gives the session `ORA_SDTZ` when set, else the offset of the process when the connection opens: unset is accepted only with the database in UTC and the process in UTC. With a database outside UTC an offset is rejected (it doesn't follow summer time); `LOCAL` and `DBTIMEZONE` are always rejected, because their zone can't be known without a query (decided: also `DBTIMEZONE` with a database in UTC) | `test/environments/oracle/LocalTemporalValuesInAnyZone.test.ts`, `test/environments/oracle/DatabaseOutsideUtc.test.ts` |
| the others: mysql2, mariadb, PGlite, better-sqlite3, bun:sqlite, node:sqlite, sqlite-wasm | — | nothing (what they could change is isolated per query) | — |

Other `INVALID_CONFIGURATION`: `registerSqliteFunctions` on a Node without `function`/`aggregate`; an unknown
`SqliteDateTimeFormat`; a `databaseTimeZone` other than UTC on a database that doesn't support it, and a
`localTimeReferenceDate` that is neither a `YYYY-MM-DD` date nor `'today'` with a database outside UTC, both at the
first query (§7.3; `test/runners/general/DatabaseTimeZone.test.ts`); and the errors of postgres.js about
`target_session_attrs` and `channel_binding`, which its error mapper classifies so.

### 5.3 What is the user's (documented, not readable without a query)

Sending:

- The `Date` the user passes for a `localDate`/`localTime`/`localDateTime` has the intended digits in its UTC fields.
- `driverTypeOf`: the type given fits the values.
- SQLite: every stored value in the configured `SqliteDateTimeFormat`.

Reading:

- The data is stored as UTC digits, or in the declared `databaseTimeZone` (§7.3).
- The zone of the database is the declared `databaseTimeZone` (UTC by default; another zone only on PostgreSQL and
  Oracle, §7.3), and the session is in that zone: a `SET TIME ZONE` / `SET time_zone` / `ALTER SESSION` of the user,
  mariadb's `timezone`, Bun SQL PostgreSQL's `connection`, and the zone of the database itself can't be read without a
  query; what can be read (`ORA_SDTZ`, pg `options`, postgres.js `connection`) is checked (§5.2).
- Bun SQL MySQL/MariaDB: the server in UTC. Bun sets the session to `+00:00`, right only over a database in UTC; over a
  database outside UTC it can't be detected, and a declared zone is rejected on MySQL and MariaDB anyway (decided: the
  user's responsibility, documented in `docs/configuration/query-runners/recommended/bun_sql_mysql.md`).
- MySQL/MariaDB: `TIMESTAMP` columns follow the session `time_zone` (the rule above). A date outside the calendar
  (`ALLOW_INVALID_DATES`), a zero date (without `NO_ZERO_DATE`) and a `24:00:00` value are rejected when read
  (`docs/configuration/time-zones.md#known-limits`); who stores them reads them with a type of their own.
- PostgreSQL `time` values of `24:00:00` are rejected the same way.
- Oracle: a session zone changed with `ALTER SESSION`, or a connection opened before `ORA_SDTZ` is set, isn't seen.
- PGlite: created (or opened once) with `postgresqlconf: ["timezone = 'UTC'"]`, or its database takes the zone of the
  process that creates it (a database outside UTC, §7.3); the option goes into PGlite's own configuration and isn't
  readable from the object without a query.
- pg/PGlite: no parser registered that changes a type the library reads (`numeric`, `int8`, `text`…): pg's runners
  override per query only `date` and `timestamp`, and PGlite's also `time`.
- SQLite: the driver's big-integer mode if an integer may pass 2^53 (else `PRECISION_LOST` or a driver error);
  sqlite-wasm gives such an integer as a `BigInt` without it.
- Oracle: the boolean columns are in the form `booleanStorage` says (`NUMBER(1)` by default, `BOOLEAN` with
  `'boolean'`, Oracle 23.4 or later); a column of the other form is declared with a `CustomBooleanTypeAdapter`.

Sources: `docs/configuration/query-runners/recommended/<runner>.md`, "Connection requirements" ("Large integers" on
better-sqlite3, bun:sqlite and sqlite-wasm); `docs/configuration/time-zones.md#known-limits`.

## 6. Adding or changing a query runner — checklist

1. `addParam` follows the rule of its database (§2.2), the one `MockQueryRunner` applies with the name of the runner:
   add the runner to the names `MockQueryRunner` takes. Where a rule shared by a database goes is in `CLAUDE.md` ("The
   query runner and the connection"). `addParam` writes the placeholder and the cast and checks the value; it pushes
   the value the connection handed.
2. What the driver needs and the database doesn't (the UTC text of a `Date`, `1`/`0` for a boolean, a driver type)
   is made at execution, on a copy given to the driver: the params keep the value the connection handed. Never rewrite
   the SQL text (the comment of the binds of Oracle is the only exception, and the database alone sees it).
3. Accept the forms of §2.1, and anything for adapted values or values of the user: convert only what you recognise (a valid Date
   of a temporal type, a plain decimal text), send the rest as it is.
4. Type the parameter from the context of the query (§4), never from the SQL text; fall back to inferring from the
   value only when there is no type.
5. Per query, set every driver option that makes it deliver rows as objects keyed by alias, temporal values with UTC
   digits (or as text), big integers and decimals exactly; override what the user may have configured on the
   connection, where the driver allows it per query.
6. What can't be set per query and can be read from the object you hold: validate it with `INVALID_CONFIGURATION`
   (`name` = the option). What can't be read: document it in the runner's page under "Connection requirements". Never
   run a query to check.
7. A lossy delivery that is detected (an unsafe number for an integer, a number for a decimal) is acceptable:
   `transformValueFromDB` rejects it. An undetectable one (a Date built in the process zone, a cut text, a renamed
   key, a lost row) is not.
8. Tests in `test/runners/<db>/` against the real engine (`test/RUNNER_TESTS.md`), including `DriverConfiguration`,
   and in `test/environments/<db>/` (`test/ENVIRONMENT_TESTS.md`): `LocalTemporalValuesInAnyZone`, with the process in
   UTC, Madrid, New York and Tokyo, and `DatabaseOutsideUtc` where the database supports a zone other than UTC.

## 7. Dates and times

### 7.1 How to reason about a temporal value

**The rule.** A date or time either has a known zone or it doesn't. When it doesn't, its zone is **missing
information**, and nothing in the chain may invent it: never cast a value whose zone isn't known to a type with a
zone, nor take the zone of whoever happens to be at hand. Which zone the data without zone is in is a fact of the
user's setup, the zone of the database (§7.3), not something the library decides. Reason in these terms, never in terms
of the methods of a `Date` nor of what a value "becomes".

A JavaScript `Date` is UTC: milliseconds since the epoch, the same moment everywhere (`new Date('…+09:00')` keeps
only that moment). The methods that give the parts in the zone of the machine compute an offset on top of it; the
`Date` doesn't hold the zone of the process. The library works in UTC because UTC doesn't move anywhere: it reads and
writes a `Date` with its UTC methods only, so it does no zone arithmetic, and a value without zone travels without
zone from end to end: the `Date` holds its digits in its UTC fields, and nothing adds a zone to them.

The problem goes one way. A `Date` is anchored to a moment, so sending it is precise: the runner states that moment,
with its offset (the `…+00` text of PostgreSQL) or as its UTC digits (MySQL, MariaDB, SQL Server, and Oracle's `DATE`
or `TIMESTAMP` bind). Once stored in a column without zone, those digits mean that moment only when the database
is in UTC (§7.3). The missing information is on the way back: a value the database holds without zone isn't anchored
to a moment, and it has to fit in a `Date`, which is; what is missing is the zone it is completed with. Sending a value
that the user means as unanchored (a wall clock of their own) takes the user declaring that intent, never a choice of
the library: the `plainDate`, `plainTime` and `plainDateTime` types declare it. Their values are Temporal values without
zone (`Temporal.PlainDate`, `Temporal.PlainTime`, `Temporal.PlainDateTime`): they aren't anchored to a moment, so they
travel as their digits, as text without an offset (or the form a driver needs with the same digits, §2.5), the database
stores them as they are in a column without zone and completes them with the zone of its session where it needs one,
and they come back as the digits the database gives, with every digit of the fraction of a second it keeps. No zone of
the process nor UTC takes part, and `databaseTimeZone` only says which wall clock a text with an offset is read as
(§3.4).

The pieces in between face the same missing information: a driver that gets a value without zone and has to
deliver a `Date` completes it somehow (with the zone of the process, of the session, or as UTC), and a database
completes it with the zone of its session (a column of kind 2, in the table below; an expression that mixes a value
without zone with one with zone). For every piece, know how it completes what is missing; in what is supported (§7.3)
the runners keep each one from completing it with anything but the zone of the database (§3.1, §2.4).

The kinds of column (`docs/configuration/time-zones.md`):

| Kind | The engine | What the program gets | Examples |
|---|---|---|---|
| 1 | stores and returns the wall clock as it is | a wall clock | PostgreSQL `date`, `time`, `timestamp`; MySQL/MariaDB `DATE`, `TIME`, `DATETIME`; Oracle `DATE`, `TIMESTAMP`; SQL Server `date`, `time`, `datetime`, `smalldatetime`, `datetime2` |
| 2 | converts in and out with the session zone | a wall clock | MySQL/MariaDB `TIMESTAMP`, Oracle `TIMESTAMP WITH LOCAL TIME ZONE` |
| 3 | stores one normalized instant | an instant | PostgreSQL `timestamptz` |
| 4 | keeps the zone of each value | the value and its zone | Oracle `TIMESTAMP WITH TIME ZONE`, SQL Server `datetimeoffset`, PostgreSQL `timetz` |

The date functions of a query (`getFullYear` … `getMilliseconds`) give the parts in UTC, as the `getUTC…` methods of
the `Date` read, and `getTime` its `getTime()`, the instant, also for a value stored with another offset
(`docs/configuration/time-zones.md`, "The date functions of a query give the parts in UTC"). One exception: with the
database in UTC, `getHours` of a PostgreSQL `timetz` stored with an offset other than `+00:00` gives the hour of its own
offset, because no expression without a zone gives it in UTC; with a database outside UTC it gives the hour in UTC
(`docs/configuration/time-zones.md#known-limits`; `test/environments/postgres/DatabaseOutsideUtc.test.ts`). SQLite has
its own strategies (§0) and `sqliteRunsInApplicationTimeZone`.

### 7.2 Kind 4 through the drivers

| Database | Driver | What it delivers | Source |
|---|---|---|---|
| Oracle | oracledb (Thin) | a `Date`: the instant, to the millisecond; the zone is discarded when the value is decoded. Fetched as text it is that `Date`'s `toString()`; RAW and TIMESTAMP fail with NJS-119 | measured; `test/environments/oracle/DatabaseOutsideUtc.test.ts` (the instant) |
| SQL Server | mssql (tedious) | a `Date`: the instant; the offset is read and discarded, and the time below the millisecond kept apart, hidden. No option changes it (`useUTC` doesn't apply to it) | measured; `test/environments/sqlserver/LocalTemporalValuesInAnyZone.test.ts` (the instant) |
| PostgreSQL | pg, postgres.js, Bun SQL, PGlite | `timetz` as text with its offset (`19:30:15.123+09`), read as its instant on 1970-01-01; `timestamptz` (kind 3) as a `Date` | `test/environments/postgres/DatabaseOutsideUtc.test.ts` (`…-a-time-with-time-zone-with-the-database-in-utc`, and the database in Madrid) |

So oracledb and mssql deliver a kind-4 column as kind 3; PostgreSQL's `timetz` arrives as text with its offset. A
runner can't recover the zone: in Oracle and SQL Server a value with its zone exists only if the SQL formats it
(`to_char(x, '…TZH:TZM')` / `TZR`, `convert(nvarchar(40), x, 126)`), which is the user's SQL (a fragment, or the
`transformProjection` of a type adapter or of the connection) and never the runner's (§0). A `Date` the library writes
into such a column is stored with `+00:00`.

A type adapter on the column keeps the zone for every query: its `transformProjection` gives the column as that text in
`'resultColumn'` (the select, the `returning` / `output`) and `'aggregatedArrayValue'`, its `transformPlaceholder`
converts the text sent (`to_timestamp_tz(:0, 'YYYY-MM-DD"T"HH24:MI:SS.FF TZR')`, `cast(@0 as datetimeoffset)`), and the
value is the text. A text of a `ComparableType` (or an `EqualableType`) of the user is sent as text; a `LocalDateTimesType` of the user is bound as a
`localDateTime`, on SQL Server as a `datetime2`, which tedious makes from a `Date`: the offset and the digits below the
millisecond are lost (measured on SQL Server 2019). Outside those outputs (the where, the order by) the column keeps
its SQL, so they compare instants; its `transformProjection` says `comparison` `'none'`, so a union and a distinct
compare instants too (Oracle and SQL Server compare these values by instant).
`test/db/oracle/*/*/column.oracle-zoned-date-time-as-text.test.ts`,
`test/db/sqlserver/*/mssql/column.sqlserver-zoned-date-time-as-text.test.ts` (real on Oracle 21 and 23, SQL Server
2019, 2022 and 2025).

### 7.3 The zones of a setup, and what is supported

Three parties have a zone: the database, the session and the process of the backend. A setup is supported when every
value read and sent has the same meaning as with everything in UTC: the same wall clock (no zone) or the same instant
(with zone). Keeping the digits isn't enough: a value without zone means a wall clock of the zone of the database.

**The zone of the database** is the zone of its data: a value of kind 1 holds a wall clock of that zone. It is the zone
of the date and time the database gives as its current one when the connection sets nothing (the digits of
`localtimestamp` in PostgreSQL, of `now()` in MySQL and MariaDB, of `getdate()` in SQL Server; in Oracle, whose
connector always sets the session, the zone of `SYSTIMESTAMP`, which doesn't follow the session). It comes from the
server, and the database itself can override it:

- **The server**, which takes it from the machine or the process it runs on, or has it in its configuration:
  - PostgreSQL: `initdb` writes the zone of its environment into `postgresql.conf` (measured on 18).
  - PGlite: the same, when it creates its database inside the process; a database in a directory is created once, the
    first time, and an in-memory one (`memory://`) at every start (measured on 0.5.11).
  - MySQL and MariaDB: the zone of the machine through `time_zone = SYSTEM`, or the one configured in the server
    (measured on MySQL 26.10).
  - SQL Server: the zone of the operating system (measured on 2025).
  - Oracle: the zone of the operating system, which `SYSDATE` and `SYSTIMESTAMP` use whatever the session (measured on
    23.26).
  - A container is in UTC unless it is told otherwise.
- **The database itself**, where the engine lets the zone be set on it:
  - PostgreSQL: `ALTER DATABASE … SET timezone`. PGlite 0.5.11 stores this setting but ignores it. What sets its zone
    is `postgresqlconf: ["timezone = 'UTC'"]`: passed when the database is created, or when an existing one is opened,
    it is saved in the database and stays when the database is opened again without it.
  - Oracle: `TIME_AT_DBTIMEZONE = DATABASE`, set in the pluggable database, with which `SYSDATE` and `SYSTIMESTAMP` come
    in `DBTIMEZONE` instead of the zone of the operating system (measured on 23.26).

Changing the zone of a database that already holds values (another zone for the server, `ALTER DATABASE`, PGlite's
option) changes the zone of the database, not the values already stored: they stay in the zone they were written in,
and if that was the old zone the database is now mixed (out of scope, below). A database is outside UTC when the zone
it ends up with (the server's, or the one set on the database) isn't UTC. The usual ways: a database installed on a
machine outside UTC with nothing set; a SQL Server whose operating system isn't in UTC; an Oracle whose operating system
isn't in UTC, unless the pluggable database sets `TIME_AT_DBTIMEZONE = DATABASE` with `DBTIMEZONE` in UTC; a PGlite
created by a process outside UTC without the option.

With a database outside UTC taken as UTC, the digits travel unchanged but their meaning is off by the difference (an
hour in Madrid in winter): a `Date` read is that much off the moment the row means, a `Date` written is stored as a
wall clock of the database's zone that is that much off, and the current date and time the database gives (a default,
`now()`) is off the same. A write made so can't be repaired by changing a setting afterwards.

**The session** is the zone set on the connection (`SET TIME ZONE`, `SET time_zone`, `ALTER SESSION SET TIME_ZONE`),
by the user or by the connector, by default or through its configuration (for oracledb, the environment variable
`ORA_SDTZ`); when nothing sets one, the session has the zone of the database. By default (measured): pg, postgres.js,
Bun SQL PostgreSQL, mysql2 and mariadb set nothing; Bun SQL MySQL/MariaDB sets `+00:00`; oracledb always sets it, from
`ORA_SDTZ`, else the offset of the process when the connection opens. SQL Server has no such setting: there is no
session zone, only the zone of the database. The configuration that sets it: `ORA_SDTZ`, pg
`options: '-c TimeZone=…'` (also in the URL or `PGOPTIONS`), postgres.js and Bun SQL PostgreSQL
`connection: { TimeZone: … }`, mariadb `timezone`; mysql2 has none (only a `SET time_zone` of the user). What a runner
can read: `ORA_SDTZ` (the environment), the `options` of a pg client or pool, the `connection` of postgres.js. What it
can't: a `SET` of the user, mariadb's options (kept in private fields), Bun SQL PostgreSQL's (only in an internal
encoding).

**Which zone matters for which values.** The zone of the database matters only for the values of kind 1 (§7.1), which
the database doesn't normalize. Kind 2 depends on the session: the value is normalized when stored, and the session
decides the digits it is read and written with. Kinds 3 and 4 depend on neither: a value of kind 3 is normalized, the
database knows the exact moment it refers to, and a value of kind 4 keeps its own zone.

**What is supported.** The session must be in the zone of the database. A session in any other zone, UTC included over
a database outside UTC, is harmful: what the database produces in it (`current_date`, `now()`, a default, a trigger)
comes in the zone of the session, not in the zone of the data, and mixes the database.

| Database | Session | Supported |
|---|---|---|
| UTC | UTC (the zone of the database) | yes, whatever the zone of the process (a connector that puts the zone of the process in the session is the third row); the test matrix runs here |
| not UTC | the zone of the database (whether it comes from the process or is set) | with the zone of the database declared by the user (`databaseTimeZone`, below), on PostgreSQL and Oracle; rejected at the first query on MariaDB, MySQL, SQL Server and SQLite. Not detected when the zone isn't declared: the library takes the database as UTC |
| any | not the zone of the database: the zone of the process used by the connector for the session, another zone set on purpose, or UTC over a database outside UTC (set by the user or by the connector, like Bun SQL MySQL/MariaDB) | no. Rejected at the first query, compared with the declared zone (UTC by default), where the configuration of the connector sets the session: oracledb (`ORA_SDTZ` in another zone, or unset with the process outside UTC), pg (`options`), postgres.js (`connection`) (§5.2). Not detected otherwise (a `SET` of the user, the connectors whose configuration isn't readable, Bun SQL MySQL/MariaDB over a database outside UTC): documented as the user's (§5.3) |

**The checks.** The configuration of the connector is also how the user puts the session in the zone of the database,
so the session a runner can read is compared with the zone of the database, never with UTC as such (§5.2). A driver
option that would complete a missing zone with the zone of the process is refused when the process isn't in UTC
(postgres.js `infer: true`, mssql `useUTC: false`, §5.2): this is about the process, not the session.

**A database outside UTC** (`databaseTimeZone`, an IANA name, an option of the connection): many databases hold years
of data in the zone they were installed in. The library can't read that zone without a query of its own (no driver
gives it: pg doesn't keep what the server reports, postgres.js has it only after the first connection and it is the
session's, oracledb's offset of the database is `DBTIMEZONE`, not the zone of `SYSTIMESTAMP`), so the user declares
it, and the library trusts it: it is never checked against the database, not even once per pool (§0). The database
completes the zone of a value without zone with its session, which must be in that zone: the library writes no zone
arithmetic. With UTC the SQL doesn't change.

- **PostgreSQL** (supported): each `localDateTime` and `localTime` parameter is sent as a `timestamptz` of its instant,
  forced or not (`$1::timestamptz` on pg and Bun SQL, OID 1184 on postgres.js and PGlite; a `localTime` with its own
  day, and `::timestamptz::time` on pg and Bun SQL, `$1::time` on postgres.js and PGlite). A type `driverTypeOf`
  gives doesn't apply to them (postgres.js, PGlite): the declared type would store the `…+00` text as UTC digits
  instead of converting it to the zone of the database.
  A parameter read back as it is (a constant selected) needs no conversion: `$1::timestamptz`; a column is read as `<sql>::timestamptz` (a no-op on a `timestamptz`), and as its text in the JSON of an
  aggregated array; the date functions take `(<sql>::timestamptz at time zone 'UTC')`, so they keep giving the parts
  in UTC. A `localTime` is completed with the `localTimeReferenceDate` (`'1970-01-01'` by default, a date, or
  `'today'`, `current_date`), and the connection keeps that day in the `Date` it reads. A wall clock the zone skips is
  moved forward by PostgreSQL, one it repeats is taken in winter time. A `timetz` is read as its instant, and its
  `getHours` gives the hour in UTC. `test/environments/postgres/DatabaseOutsideUtc.test.ts`: pg, the pg pool,
  postgres.js and Bun SQL with the session in Madrid, on every version, and PGlite created in Madrid, each with the
  process in Madrid, UTC and Tokyo; and, on the newest version, the sessions rejected or not detected.
- **Oracle** (supported): each `localDateTime` and `localTime` parameter is sent as a `TIMESTAMP WITH LOCAL TIME ZONE`
  of its instant, which oracledb writes from the UTC of the `Date` and the offset of `DBTIMEZONE`, whatever the zone of
  the process. As the value of a column (an insert, the set of an update) the placeholder is the bare one, and Oracle
  converts it with its session into the wall clock it stores; anywhere else it is cast to the type of the column,
  `cast(:0 as timestamp)`, or `cast(:0 as date)` for a value of whole seconds of a `DATE` column
  (`OracleDateAsTimestampTypeAdapter`), so the column compares with it as it is and its index is used. A `localTime`
  is sent as the instant of its own day, and in every position, the value of a column too, its time of the day goes on
  1970-01-01, the day every `localTime` is kept on: `timestamp '1970-01-01 00:00:00' + (cast(:0 as timestamp) -
  trunc(cast(:0 as timestamp)))`, or for a value of whole seconds of a `DATE` column `date '1970-01-01' + (cast(:0 as
  date) - trunc(cast(:0 as date)))`, so a time after midnight in the zone of the database isn't kept on another day
  (measured: `INDEX RANGE SCAN`; a `TIMESTAMP WITH LOCAL TIME ZONE` compared as it is makes Oracle convert the column, a
  full scan). A column is read as `cast(<sql> as timestamp with time zone)`, also inside the JSON of an aggregated
  array, where Oracle writes it as a text with its zone (`+01:00` on 23, `Z` on 21; both are read as the instant); a
  `localTime` replaces the day it is stored with by the `localTimeReferenceDate`,
  `cast(timestamp 'D 00:00:00' + (<sql> - trunc(<sql>)) as timestamp with time zone)`, or
  `cast(trunc(localtimestamp) as timestamp)` for `'today'`. The date functions take `sys_extract_utc(<that>)`. A
  `returning` writes the same conversion into its `TIMESTAMP WITH TIME ZONE` OUT bind. The session must be `ORA_SDTZ`
  with the same name: unset, oracledb gives it the offset of the process, which doesn't follow summer time; an offset,
  `LOCAL` or `DBTIMEZONE` are rejected (§5.2). Limits, with an error, never a wrong value: `DBTIMEZONE` as a region
  (measured: oracledb NJS-201 for a `TIMESTAMP WITH LOCAL TIME ZONE` bind; it reads `DBTIMEZONE` itself when it connects), a
  stored wall clock the zone skips (ORA-01878 when it is read or given to a date function; one it repeats is taken in
  winter time). A `localTime` compares with the day it is kept on, 1970-01-01, in UTC too: one written by another
  program on another day doesn't match (keeping that day is the user's convention, as for every library that maps a
  time of the day on Oracle). `test/environments/oracle/DatabaseOutsideUtc.test.ts`: the three runners, `ORA_SDTZ` in
  Madrid, the process in Madrid, UTC and Tokyo, on every version; and, on the newest version, the sessions rejected.
- **Rejected** at the first query, as limits of the database (`test/runners/general/DatabaseTimeZone.test.ts`): MariaDB
  and MySQL (`convert_tz` leaves a value before 1970 unconverted, silently; measured on MySQL 26.10 and MariaDB 13), SQL
  Server (`AT TIME ZONE` takes only the 141 zones of Windows, groups without their history: `Romance Standard Time`
  gives `+02:00` on 1960-07-14, Madrid was at `+01:00`; measured on 2025) and SQLite (its own strategies).

**Out of scope, on purpose** (written here so the question doesn't come back): **a mixed database**, whose values
without zone aren't all in the zone of the database, however they got there (other programs, other sessions, including
a session a connector put in another zone, values computed elsewhere, a database whose zone was changed over stored
values). The library doesn't produce it when the session is in the zone of the database, and it can't know it nor tell
it from a database that isn't mixed. Keeping the values without zone in the zone of the database is the user's
responsibility: the library takes one zone for the whole database, and converting values in another zone (for example
with type adapters) is the user's own work, not a support of the library.

**The process** isn't a dimension of what is supported: the library reads and writes a `Date` with its UTC methods
only, and each runner keeps its driver from completing a missing zone with the zone of the process (oracledb: but for
the known limit in the table below), or refuses the driver option that would (§5.2; proved with the columns of kinds 1
and 2, of kind 3, of kind 4 on Oracle and SQL Server, the date functions of a query and every way of sending and
reading a value, with the limits the tests declare). Otherwise it only matters as the origin of the session a connector
initializes by default (oracledb). The user is still advised to run the backend in UTC: their own code can be surprised
by the zone of the process (a `Date` built from local parts, the local methods of a `Date`, other libraries), even when
the library isn't. What each runner does with it:

| Runner | Reading a value without zone | Sending | Session zone by default |
|---|---|---|---|
| pg, PGlite | text (`date`, `timestamp`, and `time` on PGlite) parsed as UTC (§3.1) | text, `…+00` for a `localDateTime` (§2.4) | pg: none, the database's. PGlite: none; the zone of its database is the one of the process that created it, unless it was created (or opened once) with `postgresqlconf: ["timezone = 'UTC'"]` |
| postgres.js | the UTC digits in any zone of the process (§3.1) | text (§2.4) | the database's |
| Bun SQL PostgreSQL | UTC `Date`s | text (§2.4) | the database's |
| mysql2, mariadb | text (`dateStrings`) | text without offset (§2.4) | the database's |
| Bun SQL MySQL/MariaDB | UTC `Date`s | text (§2.4) | `+00:00`, set by Bun (measured) |
| mssql | `Date`s with the UTC digits (`useUTC`) | `Date`s with `useUTC` | none: SQL Server has no session zone |
| oracledb | a `Date` that oracledb builds taking the digits in the process zone; the runner takes the same digits back as UTC; a wall clock the process zone skips in its change to summer time is moved an hour by oracledb (known limit) | a `localDate` as a `DATE`, a `localDateTime` or a `localTime` as a `TIMESTAMP`, with their UTC digits (outside UTC, a copy whose local getters are the UTC ones); with a database outside UTC, a `TIMESTAMP WITH LOCAL TIME ZONE` | `ORA_SDTZ`, else the process offset; the runner requires a session in the zone of the database (§5.2) |
| SQLite runners | per `SqliteDateTimeFormat` (§0) | per format | — (one party: SQLite runs in the process, outside this section) |

**Tests.** The zone of the process is a dimension of the tests, because it is where a driver's defects show: each case
supported is tested with the process in three positions: in the zone of the database (the usual deployment, where a
driver that uses the zone of the process goes unnoticed, because both agree), in UTC, and in a zone that agrees with
neither (where such a driver shows). With the database in UTC the first two are the same; with a database outside UTC
(Europe/Madrid) they are Europe/Madrid, UTC and Asia/Tokyo. They are the environment tests (`test/ENVIRONMENT_TESTS.md`),
run on every version of each engine mapped for the tests:

- `test/environments/<db>/LocalTemporalValuesInAnyZone.test.ts`: every runner of PostgreSQL, MySQL, MariaDB, SQL Server
  and Oracle, the database in UTC, the process in UTC, Madrid, New York and Tokyo; with the limits each test declares
  (Oracle's Julian calendar before 1582-10-15, a wall clock in the summer-time gap of the process zone on oracledb,
  MariaDB before 10.5 without `json_arrayagg`, MySQL 8.0 not finding a `TIME` in a prepared `in` list of several
  values, which Bun SQL sends), and the checks of oracledb, postgres.js and mssql that depend on the process.
- `test/environments/postgres/DatabaseOutsideUtc.test.ts` and `test/environments/oracle/DatabaseOutsideUtc.test.ts`:
  every runner, the database in Madrid, the process in Madrid, UTC and Tokyo; and the sessions rejected (PGlite and the
  sessions on the newest version only).
- The checks of the configuration of pg and postgres.js in `test/runners/postgres/DriverConfiguration.test.ts`.

A runner that changes how it reads or sends a temporal value states here what it supports, with the test that proves it.

## 8. What a query runner may depend on

Everything a runner may read besides the SQL and the params, in one place. All of it is optional information: a
runner still works with params built by hand.

| What | Where | What it is for | Section |
|---|---|---|---|
| The context of the query | `getQueryContext(query, params)` | everything below | §4 |
| The types of a parameter | `originalType`, `requestedType` (classes) | the type it is sent with | §4 |
| Whether the database must receive its type | `forceTypeCast` of the parameter | the cast or the typed bind | §2.2 |
| Whether it is the value of a column | `isValueForColumn` of the parameter | no cast where the column gives the type | §2.2 |
| The SQL data type of the column | `originalSqlDataType`, `requestedSqlDataType` of the parameter and of each result column (the runners use the requested one) | the bind type, the buffer | §2.6 |
| What a type adapter or the library marks | `getMetadata(key)` of the parameter and of the query | `OracleDateAsTimestampTypeAdapter`, a database outside UTC | §4, §7.3 |
| The columns of the result | `resultColumns`, `getResultColumn(name)` | the fetch types, the shape of the rows | §4 |
| The configuration of the connection | `connectionConfiguration` | `compatibilityVersion`, the strategies, `booleanStorage`, `databaseTimeZone`, the date formats of SQLite; `sqlDataTypeFrom` and `nativeSqlDataTypeOf` of the connection (the native name of a SQL data type, built once) | §4, §7.3 |
| Where and why the query runs | `executionSource`, `executionStack`, `functionExecutingQuery`, `executionName`, `executionMetadata`, `isSelectPageCount` | logs, errors | §4 |
| The types declared by the user | `driverTypeOf` of the runner (postgres.js, PGlite, mssql, Oracle), which wins over the SQL data type | a type of the driver for a parameter | §2.4 |
| The runner a mock imitates | the `queryRunner` option of `MockQueryRunner` (the name of a runner) | the same placeholders and params | §2.3 |
| The environment | `TZ` (the zone of the process), `ORA_SDTZ` | the checks of §5.2 | §5.2, §7.3 |
