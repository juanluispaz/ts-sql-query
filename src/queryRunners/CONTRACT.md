# The contract between the query runners and the connection (v2)

Internal documentation for a contributor who adds or changes a query runner. Not published.

Two directions, always kept apart:

- **Sending** (library → database): the connection converts the value (`transformValueToDB`), the query runner adds
  it to the params (`addParam`, through its binding) and, at execution, gives its driver what it needs.
- **Reading** (database → library): the query runner makes its driver deliver each value in a form the library reads,
  and the connection converts it (`transformValueFromDB`).

Conventions: `file:line` is relative to `src/` unless it starts with `test/` or `docs/`. A statement about what a
driver or an engine does that isn't backed by this repository's code or tests is marked **[inferred]**.

## 0. The rule

Three places own the work. What decides where a thing goes is **whether it conditions the SQL the library writes**.

| Place | Owns |
|---|---|
| **The connection** (`connections/AbstractConnection.ts` and each per-database subclass), with the **SQL builder** (`sqlBuilders/*`) | The semantics: which values a data type accepts and promises (`transformValueToDB` / `transformValueFromDB`), the SQL around the values, the SQL of the result columns (the conversion of the library is the `transformProjection` of the connection, the `next` of a type adapter's), and **the form of a value that the SQL it writes depends on**. It hands that form to the runner and reads it back |
| **The runner's binding** (`addParam`, one binding per runner in `utils/queryRunnerParams.ts`, with one module per database in `utils/<db>ParamTypes.ts`) | How the database interprets each parameter as the type it is: the placeholder, the cast in it, and the checks of the final value (a `customDecimal` too wide for the database) |
| **The runner at execution** (`queryRunners/*`) | What is specific to its driver: how the driver must receive a value the database already handles (the UTC text of a `Date`, `1`/`0` for a boolean the driver can't bind, a driver type, an OID, a bind type), the per-query options that make the driver deliver without loss, and the shape of the rows |

- The connection hands the form the SQL depends on. Oracle has no BOOLEAN before 23ai, and the SQL the library writes
  treats a boolean as a number (`(x = 1)`, `case when C then 1 else 0 end`, `case :0 when 1`): `OracleConnection`
  hands `1` / `0`. With `booleanStorage: 'boolean'` (Oracle 23ai's `BOOLEAN`) the builder writes the booleans as the
  base builder does and the connection hands `true` / `false` (`connections/OracleConnection.ts`,
  `OracleSqlBuilder._nativeBoolean`). SQLite has no date or time types, and the SQL
  the library writes for dates depends on how they are stored (`strftime`, `julianday`, epoch arithmetic):
  `SqliteConnection` hands the text or number of its date strategy (§2.1).
- The binding's checks are there because they must see the value after a type adapter (which may replace the
  connection's conversion) and cover a parameter of SQL the user writes. The library tells the binding the type of
  each parameter and when the position gives the database no type (`forceTypeCast`).
- **The params keep the value the connection handed.** The adjustments of execution are made on what is passed to the
  driver, never in the params (§2.3).
- **The SQL is what the user sees.** The SQL text, with every adaptation (the placeholders and casts of the binding,
  the SQL the builder writes for that database), is what the logs, the interceptors, the mocks and the errors show, and
  it is what the database runs: **a runner never post-processes the generated SQL**. At execution it only adjusts what
  it passes to the driver for the params.
- A runner never changes the meaning of a value. A runner that can't do its part does nothing, and the library works
  as before.
- **The values in the database are in UTC**: a value without zone has the digits of the UTC getters of its `Date`,
  sending and reading, in any zone of the process. SQLite is the exception, inside its own strategies (below).
- **The golden rule**: a runner sends only the query it was given. It never adds a probe query, not even to check its
  configuration: a prerequisite that can't be read from the driver object is documented, not checked (§5). Known
  exception: `Sqlite3WasmOO1QueryRunner` runs `select last_insert_rowid()` for an insert without `returning`
  (`queryRunners/Sqlite3WasmOO1QueryRunner.ts:83`).

**SQLite keeps its own date strategies**: `SqliteConnection` formats and parses dates itself with its
`SqliteDateTimeFormat` (`connections/SqliteConfiguration.ts:1-7`; `connections/SqliteConnection.ts:143-535`). The
default format is `'localdate milliseconds as text'` (`connections/SqliteConnection.ts:136-137`), in the zone of the
process, so outside UTC it doesn't follow the UTC rule of the other databases. Inside the strategies: a `localDate` is
sent with the local getters of the `Date` for every format, the `UTC …` ones included
(`connections/SqliteConnection.ts:421-448`), and a `localDate` received as a `Date` is read with its local getters
(`:158-159`), where a `localTime` or `localDateTime` received as a `Date` keeps it (`:246-247`, `:346-347`). The same
`Date` can give another day on SQLite than on the other databases in a process outside UTC. Everything below about
temporal values and UTC applies to the other databases.

## 1. The pipeline

### Sending

1. `AbstractSqlBuilder._transformParamToDB` (`sqlBuilders/AbstractSqlBuilder.ts:653-667`) calls the type adapter of
   the value, if any, with the connection as `next`; otherwise the connection's `transformValueToDB`. An
   `INVALID_VALUE_TO_SEND_TO_DATABASE` gets the index of the parameter (`paramIndex`).
2. `AbstractSqlBuilder._appendParam` (`sqlBuilders/AbstractSqlBuilder.ts:668-687`):
   - asks the adapter / connection `forceTypeCast(type, category, valueSentToDB, forceTypeCast)`
     (`connections/AbstractConnection.ts:1476-1478`: unchanged by default). `forceTypeCast` is true where the position
     of the parameter gives the database no type;
   - marks the parameter as the value of a column (`setParamValueForColumnAt`) inside the values of an insert or the
     set of an update;
   - calls `queryRunner.addParam(params, value, typeName, typeCategory, forceTypeCast)`;
   - passes the placeholder through `transformPlaceholder` (`connections/AbstractConnection.ts:1467-1469`: identity).
3. `addParam` of every runner that talks to a database delegates to one binding of `utils/queryRunnerParams.ts:67-88`
   (the same function `MockQueryRunner` calls to imitate it, `queryRunners/MockQueryRunner.ts:90-112,530-532`). The
   binding records the type name, category and forceTypeCast of the param (`setParamTypeAt`,
   `utils/queryParamsMetadata.ts:103-122`), pushes the value and returns the placeholder.
4. At execution the runner reads that metadata (§4) and builds what its driver receives (a copy of the params with
   some values written as the driver needs them, a typed bind, an OID, a type of the driver). The params array itself
   is not changed.

### Reading

0. The SQL builder writes each column of the result of the outermost select, of the returning of an outermost insert,
   update or delete (a returning inside another query isn't converted) (the `output` of SQL Server, the `returning … into` of Oracle), and the value of `executeFunction`, with
   the `transformProjection` of its type adapter, which receives the connection as `next`, or the connection's
   (`_appendResultColumnProjection`, `sqlBuilders/AbstractSqlBuilder.ts`). By default it is the conversion of the
   library (the `transformProjection` of the connection): the identity, and on SQL Server `convert(nvarchar(41), …)` of a decimal (`SqlServerConnection.transformProjection`). The
   group by, the having and the subqueries keep the SQL of the value. Where the query compares or orders the column,
   the `projectionComparison` of the same adapter (or of the connection, which answers `'value'`, and `'columnEquality'` for a
   SQL Server decimal) decides (`_projectionComparison`): with `'value'` the converted SQL stays in place; when it isn't
   `'value'` the order by of the column writes the value (`_isOrderByAliasNeedingTheValue`, `_appendOrderByColumnAlias`),
   and a distinct or a compound select ordered by it is wrapped in a select that converts the columns
   (`_needsSelectOrderByWrap`, `_needsResultConversionWrap`); with `'columnEquality'` (equal only among the values of
   one column) a compound select is always wrapped (`_needsResultConversionWrap`), and with `'none'` a distinct select
   too (`_needsDistinctConversionWrap`).
   On Oracle, the OUT bind of a converted returning column is a text (`addOutParam` with the `string` type and
   category), whatever the type of the column. The id the library reads by itself in an insert without a returning of
   the query (`returning id`, `output inserted.id`, Oracle's `returning id into`) keeps its SQL.
   Each value inside the JSON of an aggregated array is written the same way with `'aggregatedArrayValue'`
   (`_appendAggregatedArrayValueProjection`): a converted value is the SQL of a text, which the JSON function of the
   database writes as a string (SQL Server's JSON written by the library: `'"' + string_escape(convert(nvarchar(max),
   …), 'json') + '"'`); by default it is the identity, and the value keeps the encoding the library gives it in the JSON
   (§3.2). The leaf is written outside the select whose distinct, order by and limit use the value (over the wrapped
   select `a_N_`, or in an aggregate without them); on SQL Server a select of objects is written with `for json path`,
   its leaves converted in place (`_isSelectOfAggregatedArrayValues`), unless a leaf is `'none'` or another converted leaf
   is named by the order by (`_isForJsonPathAggregatedArray`). The distinct of `aggregateAsArrayDistinct` /
   `aggregateAsArrayOfOneColumnDistinct` is inside the aggregate and compares what goes in the JSON, except for a
   `'none'` value when the aggregate is the only column of a select without group by, having or order by: the select
   is written as the aggregate over a select of the distinct values (`_getDistinctAggregatedArrayToWrap`); MariaDB
   never does it, because it doesn't see a column of the outer query in a derived table (error 1054).
1. The runner executes with its per-query options (§3.1) and returns rows as plain objects keyed by the column alias.
   The one-column / one-value methods take the only own property of the row and throw `ONLY_ONE_COLUMN_EXPECTED` if
   there are more (`queryRunners/AbstractQueryRunner.ts:25-240`).
2. The query builder reads `row[alias]` (or `row[_resultColumnKey(alias)]`) per column
   (`queryBuilders/AbstractQueryBuilder.ts:131-156`). So rows as arrays or renamed keys give `null` silently: the
   runner must prevent them (§3.1, §5).
3. An aggregated array arriving as text is parsed with `parseJsonPreservingNumbers`, which turns every JSON number into
   its source text (`queryBuilders/AbstractQueryBuilder.ts:158-215,592`); a value that is already an array (a driver
   that decoded the JSON) is used as it is. Each leaf then goes through `transformValueFromDB` of its type (of its type
   adapter, which receives the text of a converted leaf).
4. `__transformValueFromDB` (`queryBuilders/AbstractQueryBuilder.ts:74-95`) calls the adapter (with the connection as
   `next`) or the connection's `transformValueFromDB`; an error that isn't of the library becomes
   `INVALID_VALUE_RECEIVED_FROM_DATABASE`.

`__conversionType` (`utils/typeCategory.ts:39-44`) decides which arm of the transforms converts a value: the type name
when it is a built-in one (`boolean`, `int`, …, `aggregatedArray`), otherwise the type of its category
(`customInt` → `int`, `customBigint` → `bigint`, `customDouble` → `double`, `customDecimal` → `customDecimal`,
`customUuid` → `uuid`, `customLocalDate/Time/DateTime` → `localDate/Time/DateTime`, `utils/typeCategory.ts:22-31`).
`enum`, `custom`, `customComparable` and a value without category keep their name and pass unconverted.

## 2. Sending

### 2.1 What the connection hands to the runner (`transformValueToDB`)

Common to every type (`connections/AbstractConnection.ts:1386-1395`): `undefined` and `null` → `null`; `''` → `null`
unless `allowEmptyString` (default `false`, `connections/AbstractConnection.ts:40`). Every rejection is
`INVALID_VALUE_TO_SEND_TO_DATABASE`.

| Conversion type | Accepts | Rejects | Hands to the runner | Source |
|---|---|---|---|---|
| `boolean` | `boolean` | anything else | the boolean. Oracle: `1` / `0`; with `booleanStorage: 'boolean'` the boolean | `AbstractConnection.ts:1397-1401`; `OracleConnection.ts:148-155` |
| `int` | an integer `number` (not checked for the safe range) | non-integer number, non-number | the number | `AbstractConnection.ts:1402-1409` |
| `bigint` | `bigint` | anything else (a `number` too) | the bigint | `AbstractConnection.ts:1410-1414` |
| `double` | any `number` (`NaN`, `Infinity` included) | non-number | the number | `AbstractConnection.ts:1415-1419` |
| `stringDecimal`, `customDecimal` | a string matching `^-?(\d+(\.\d+)?\|\.\d+)$` (point separator, no exponent) | other strings, non-strings | the text | `AbstractConnection.ts:1420-1430` |
| `string` | `string` | non-string | the string | `AbstractConnection.ts:1431-1435` |
| `uuid` | `string` (format not checked) | non-string | the string | `AbstractConnection.ts:1436-1440` |
| `localDate` | a valid `Date` | invalid `Date`, non-Date | the `Date` as given (its UTC day is the value) | `AbstractConnection.ts:1441-1445` |
| `localTime` | a valid `Date` | invalid `Date`, non-Date | a new `Date` on 1970-01-01 UTC with the UTC time of the given one (`Date.UTC(1970, 0, 1, h, m, s, ms)` from the UTC getters), for every database | `AbstractConnection.ts:1446-1453` |
| `localDateTime` | a valid `Date` | invalid `Date`, non-Date | the `Date` as given (its UTC getters are the digits; the instant for a zoned column) | `AbstractConnection.ts:1454-1458` |
| `aggregatedArray` | — | always | — | `AbstractConnection.ts:1459-1461` |
| `enum`, `custom`, `customComparable`, no category | anything | — | the value as given | `AbstractConnection.ts:1462-1463` |
| SQLite temporal | a valid `Date` | non-Date | text or number per `SqliteDateTimeFormat` | `SqliteConnection.ts:415-535` |

An unsafe integer or `NaN` passes `int` / `double` and reaches the driver; only sqlite-wasm guards the integers
beyond 64 bits (§2.2).

Tests: `test/db/<db>/<version>/<connector>/marshalling.transform-validation.test.ts` (`to-db-validation/*`).

**The runner must not assume this table holds.** A type adapter's `transformValueToDB` replaces the connection's
(it only calls it through `next` if it wants, `sqlBuilders/AbstractSqlBuilder.ts:655-656`), and its result is not
validated again. So a runner receives the forms above for the built-in types without adapter, and anything for a value
with an adapter or of `enum`/`custom`/`customComparable`. The modules of each database are written for that: at
execution they convert only a valid `Date` with type metadata (`utils/postgreSqlParamTypes.ts:94-97,118-132`,
`utils/mySqlParamTypes.ts:40-43,61-75`, `utils/oracleParamTypes.ts:28-31`), and the binding checks a decimal only
when it is plain decimal text (`utils/customDecimalParams.ts:8-17`); anything else is sent as it is.

### 2.2 The bindings: placeholder, cast, checks

`utils/queryRunnerParams.ts:67-88` gives one binding per runner; `databaseParamBinding` (`:119-137`) gives the one a
mock or `NoopQueryRunner` without a named runner uses (`queryRunners/NoopQueryRunner.ts:140-143`). A binding pushes
the value the connection handed; the only exception is sqlite-wasm's integer beyond 64 bits, whose text goes with a
cast in the placeholder.

| Binding | Runners | Placeholder and cast | Checks | Source |
|---|---|---|---|---|
| `sqlite` | BetterSqlite3, BunSqlite, NodeSqlite, BunSqlSqlite; mock/noop on `sqlite` | `?N` (1-based) | — | `queryRunnerParams.ts:29-31`, `:130-131` |
| `sqliteWasm` | Sqlite3WasmOO1 | `?N`; an integer `number` ≥ 2^63 or < −2^63 as `cast(?N as real)`, the param holding `String(value)` (the driver would wrap it) | — | `:36-41`; `test/runners/sqlite/Sqlite3WasmOO1Numbers.test.ts` |
| `postgreSqlCast` | Pg, PgPool, BunSqlPostgres; mock/noop on `postgreSql` | `$N`, plus `::<cast>` when forceTypeCast and a type is known (`typesByName[typeName]` first, then `postgreSqlParamType`) | — | `:43-46`; `postgreSqlParamTypes.ts:73-84` |
| `postgreSqlTyped` | Postgres (postgres.js), PgLite | `$N`, no cast (the type goes with the param, §2.4) | — | `:48-50` |
| `mySql` | MySql2, MySql2Pool, MariaDB, MariaDBPool, BunSqlMySql; mock/noop on `mySql`/`mariaDB` | `?`, or `cast(? as decimal(p, s))` for a decimal outside the value of a column | a decimal with precision > 65 or scale > 30 | `:51-55`; `mySqlParamTypes.ts:15-30` |
| `sqlServer` | MssqlPool, MssqlPoolPromise; mock/noop on `sqlServer` | `@N` (0-based), or `cast(@N as decimal(p, s))` for a decimal outside the value of a column | a decimal with precision > 38 | `:56-60`; `sqlServerParamTypes.ts:13-28` |
| `oracle` | OracleDB, OracleDBPool, OracleDBPoolPromise; mock/noop on `oracle` | `:N` (0-based) | a decimal with > 38 significant digits | `:61-64`; `oracleParamTypes.ts:10-18` |
| noop | mock/noop on `noopDB` | `$N` (0-based) | — | `:124-125` |

A rejected decimal is `INVALID_VALUE_TO_SEND_TO_DATABASE` with its `paramIndex`. The digits of a decimal
(`utils/customDecimalParams.ts:8-17`): `-0012.50` is `decimal(4, 2)`, `0.0120` has 2 significant digits. The type of
a PostgreSQL param by conversion type (`utils/postgreSqlParamTypes.ts:27-39`): `bool`/16, `int4`/23, `int8`/20,
`float8`/701, `numeric`/1700 (stringDecimal, customDecimal), `text`/25, `uuid`/2950, `date`/1082, `time`/1083,
`timestamp`/1114; for `enum`/`custom`/`customComparable`/no category it comes from the JS value: a bigint `int8`, an
integer number `int4` or `int8` by range, another number `float8`, anything else none (`:47-67`). Tests:
`test/runners/postgres/PostgreSqlParamTypes.test.ts`, `test/runners/mysql/MySqlCustomDecimalParams.test.ts`,
`test/runners/mariadb/MariaDBCustomDecimalParams.test.ts`, `test/runners/sqlserver/MssqlParamTypes.test.ts`,
`test/runners/oracle/OracleDBParamTypes.test.ts`.

### 2.3 What the params hold

The params array is what every wrapper and observer receives: `ConsoleLogQueryRunner`, `LoggingQueryRunner`,
`InterceptorQueryRunner`, `ConsoleLogNoopQueryRunner`, the executor of a `MockQueryRunner`, and the params of an error.
It holds what the connection handed (§2.1), plus only what a binding puts in the SQL text (the placeholders and
casts). A `Date` reads well: its `toISOString()` shows the UTC digits (`2024-01-14T10:00:00.000Z` for a `localDate`).

| Data type | PostgreSQL, MySQL, MariaDB, SQL Server | Oracle | SQLite |
|---|---|---|---|
| boolean | `true` / `false` | `1` / `0`; `true` / `false` with `booleanStorage: 'boolean'` | `true` / `false` |
| int, bigint, double | the number / bigint | same | same (sqlite-wasm: an integer beyond 64 bits as its text) |
| stringDecimal, customDecimal, string, uuid | the text | the text | the text |
| localDate, localDateTime | the `Date` | the `Date` | the text or number of the date strategy |
| localTime | a `Date` on 1970-01-01 UTC | same | per the date strategy |
| enum, custom, customComparable, a value with a type adapter | what the adapter or the user gives | same | same |

- What the driver receives differs from the params only by the runner's work at execution (§2.4). That work is tested
  against the real engine (the zone tests and the driver tests of each runner in `test/runners/<db>/`), not through a
  mock.
- A `MockQueryRunner` with `queryRunner: '<name>'` receives the SQL and params that runner builds (same binding);
  without a name, those of the database's binding. It doesn't execute, so it never sees the adjustments of execution.
- The params also carry the hidden metadata (§4) as non-enumerable properties (`utils/queryParamsMetadata.ts:12-19`):
  `JSON.stringify` and a spread don't include them.

### 2.4 At execution: what each runner gives its driver

The modules of each database give the params as the drivers of that database receive them, as a copy when a value
changes:

- **PostgreSQL** `postgreSqlDriverParams` (`utils/postgreSqlParamTypes.ts:94-132`): a valid `Date` with type metadata,
  of conversion type `localDate` → `YYYY-MM-DD`, `localTime` → `HH:MM:SS.mmm`, `localDateTime` →
  `YYYY-MM-DD HH:MM:SS.mmm+00`, from the UTC getters; a year < 1 is written `0044-03-15 BC`. Used by pg, PgLite,
  postgres.js (inside its own `driverParams`) and Bun SQL PostgreSQL (through the `driverParams` hook of
  `AbstractBunSqlQueryRunner`).
- **MySQL / MariaDB** `mySqlDriverParams` (`utils/mySqlParamTypes.ts:40-75`): the same for a `Date` of a temporal
  conversion type, `YYYY-MM-DD`, `HH:MM:SS.mmm`, `YYYY-MM-DD HH:MM:SS.mmm`, with a space and no offset. Used by
  mysql2, mariadb and Bun SQL MySQL.
- **SQLite** `sqliteDriverParams` (`utils/sqliteParamTypes.ts:6-19`): a boolean as `1` / `0`, the value SQLite stores
  for it. Used by better-sqlite3, node:sqlite and sqlite-wasm, which reject a JavaScript boolean; bun:sqlite and Bun SQL
  SQLite take the params as they are and bind a boolean as `1` / `0` themselves.
- **Oracle** `oracleTemporalBind` (`utils/oracleParamTypes.ts:37-60`; `OracleDBQueryRunner.ts:192`): a valid `Date`
  of a temporal conversion type is bound as `DB_TYPE_DATE` (a `localDate`, at 00:00 UTC of its UTC day) or
  `DB_TYPE_TIMESTAMP` (a `localTime`, a `localDateTime`) with its UTC digits, so a `DATE` or `TIMESTAMP` column compares
  with it as it is and its index is used (a `TIMESTAMP WITH TIME ZONE` bind made Oracle convert the column,
  `SYS_EXTRACT_UTC(INTERNAL_FUNCTION(column))`, and read the whole table; measured on 23). oracledb writes a `DATE` or
  `TIMESTAMP` bind with the local getters of the `Date` it receives, without copying it (Thin: `writeOracleDate`,
  `lib/impl/datahandlers/buffer.js`; `lib/transformer.js` passes the `Date` as it is), with the zone the process has
  when it binds: read at each execution, in a process in UTC the `Date` goes as it is, otherwise a copy, `OracleUtcDigitsDate` (`:26-35`), whose local getters give the UTC ones, also for a
  time the zone of the process skips. This relies on how oracledb reads the `Date`: the `send …` cases of
  `test/runners/oracle/LocalTemporalValuesInAnyZone.test.ts`, with the process in Madrid and New York, check the stored
  text and fail if it changes (621 fail with a plain `Date`). Thick isn't covered by the tests.

| Runner | What the driver receives | `typesByName` | Source |
|---|---|---|---|
| `PgQueryRunner`, `PgPoolQueryRunner` | `client.query({ text, values: postgreSqlDriverParams(params), types })`; the type is the cast in the SQL | cast text per type name | `PgQueryRunner.ts:59-64,77-80`; `PgPoolQueryRunner.ts:43-46` |
| `PostgresQueryRunner` | `sql.unsafe(query, driverParams)`: the values of `postgreSqlDriverParams`; a param of a `typesByName` name → `sql.typed(value, oid)` or the user's function; a forced param with a PostgreSQL type → `sql.typed(value, oid)`; others untyped. A throwing `typesByName` function rejects before sending | OID or function | `PostgresQueryRunner.ts:68-117,214-217` |
| `PgLiteQueryRunner` | `db.query(query, postgreSqlDriverParams(params), { parsers, paramTypes })`; `paramTypes[i]` = `typesByName` OID, else the forced param's OID, else 0 | OID | `PgLiteQueryRunner.ts:57-86,99-102` |
| `BunSqlPostgresQueryRunner` | `sql.unsafe(query, postgreSqlDriverParams(params))` | cast text | `BunSqlPostgresQueryRunner.ts:32-38`; `AbstractBunSqlQueryRunner.ts:59-74` |
| `MySql2QueryRunner`, `MySql2PoolQueryRunner` | `connection.query({ ...queryOptions, sql }, mySqlDriverParams(params), cb)` | — | `MySql2QueryRunner.ts:55-93,136-139` |
| `MariaDBQueryRunner`, `MariaDBPoolQueryRunner` | `connection.query({ ...mariaDBQueryOptions, sql }, mySqlDriverParams(params))` | — | `MariaDBQueryRunner.ts:83-97,116-119` |
| `BunSqlMySqlQueryRunner` | `sql.unsafe(query, mySqlDriverParams(params))` | — | `BunSqlMySqlQueryRunner.ts:33-58` |
| `MssqlPoolQueryRunner`, `MssqlPoolPromiseQueryRunner` | `request.input('<i>', type, params[i])` for each param, then `request.query(query)`. Type: `typesByName` (a factory or a type with arguments) → by category (`predefinedTypes`) → by type name → a custom type infers from the value (`inferCustomType`: a string is `NVarChar`) → a param without metadata infers from the value (`inferType`). tedious writes a `Date` with the UTC getters (`useUTC`, true by default) | `ISqlTypeFactory` / `ISqlType` | `MssqlPoolQueryRunner.ts:82-110,264-267,294-416` |
| `OracleDBQueryRunner`, `OracleDBPoolQueryRunner`, `OracleDBPoolPromiseQueryRunner` | `connection.execute(query, binds, options)`, binds by name `{ '0': …, '1': … }`: `typesByName` → `{ val, type }`; in `executeProcedure`, or in any query with `booleanStorage: 'boolean'` (read from the connection configuration of the params), a param of the `boolean` category (`1`/`0`/null, or a boolean) → `{ val: true/false/null, type: DB_TYPE_BOOLEAN }` (PL/SQL has BOOLEAN on every version), and a boolean OUT bind gets `DB_TYPE_BOOLEAN`; a temporal `Date` → `{ val, type: DB_TYPE_TIMESTAMP_TZ }`; a null of a number/temporal category → `{ val: null, type }`; else the value. `executeFunction` binds as any other query. RETURNING OUT binds (`addOutParam`, `{ dir: BIND_OUT, as }`): a declared type gets it with a `maxSize`; a temporal one `DB_TYPE_TIMESTAMP_TZ`; any other (a text, a number) no type and a `maxSize`, so it comes back as text. `maxSize` is the one declared in `typesByName` (`{ type, maxSize }`), else the config's `returningMaxSize`, else 32767. A `Lob` OUT value (a CLOB declared in `typesByName`) is read with `getData()` | `DbType` or `{ type, maxSize }`, also for OUT binds | `OracleDBQueryRunner.ts:15-38,132-209,272-281,358-384`; `test/runners/oracle/OracleDBOutBinds.test.ts`, `test/runners/oracle/OracleDBReturningAndProcedures.test.ts` |
| `BetterSqlite3QueryRunner` | `prepare(query).all/run({ 1: p0, 2: p1, … })` from `sqliteDriverParams(params)` | — | `BetterSqlite3QueryRunner.ts:50-88,102-117` |
| `BunSqliteQueryRunner` | `prepare(query).all/run(...params)` | — | `BunSqliteQueryRunner.ts:51-89,103-106` |
| `NodeSqliteQueryRunner` | `prepare(query).all/run(...sqliteDriverParams(params))` | — | `NodeSqliteQueryRunner.ts:50-93,107` |
| `BunSqlSqliteQueryRunner` | `sql.unsafe(query, params)` | — | `AbstractBunSqlQueryRunner.ts:59-74`; `BunSqlSqliteQueryRunner.ts:38-52` |
| `Sqlite3WasmOO1QueryRunner` | `selectObjects(query, sqliteDriverParams(params))` / `exec({ sql, bind: sqliteDriverParams(params) })` | — | `Sqlite3WasmOO1QueryRunner.ts:50-90` |
| `MockQueryRunner` | nothing to a driver: the user's executor gets the SQL and params the real runner's binding builds | cast text (`typesByName`, pg/Bun SQL only) | `MockQueryRunner.ts:10-31,90-112,530-532` |

Wrappers (`ChainedQueryRunner` and its subclasses) delegate `addParam` to the wrapped runner
(`ChainedQueryRunner.ts:121-123`).

### 2.5 Per data type: what reaches the driver

After `transformValueToDB` without adapter, the binding and the work of execution. "forced" = `forceTypeCast` true.

| Data type | PostgreSQL | MySQL / MariaDB | SQL Server (mssql type) | Oracle (bind) | SQLite |
|---|---|---|---|---|---|
| boolean | boolean; forced: `bool` | boolean [inferred: the driver writes it as 1/0 or true/false] | `Bit` | number `1`/`0`; null → `DB_TYPE_NUMBER`; in a procedure, or with `booleanStorage: 'boolean'`, `DB_TYPE_BOOLEAN` (a null too) | `1`/`0` (bun:sqlite and Bun SQL: the boolean, bound as `1`/`0` by the driver) |
| int, customInt | number; forced: `int4` | number | `Int` | number; null → `DB_TYPE_NUMBER` | number (wasm: beyond 64 bits as `cast(text as real)`) |
| bigint, customBigint | bigint; forced: `int8` | bigint | `BigInt` | bigint; null → `DB_TYPE_NUMBER` | bigint |
| double, customDouble | number; forced: `float8` | number | `Float` | number; null → `DB_TYPE_NUMBER` | number |
| stringDecimal, customDecimal | text; forced: `numeric` | text, `cast(? as decimal(p,s))` outside a column value | `NVarChar`, `cast(@N as decimal(p,s))` outside a column value | text; null → `DB_TYPE_NUMBER` | text (the SQL around it per `decimalStrategy`) |
| string | text; forced: `text` | text | `NVarChar` | text | text |
| uuid, customUuid | text; forced: `uuid` | text | `UniqueIdentifier` | text | text |
| localDate | `YYYY-MM-DD` (UTC day); forced: `date` | `YYYY-MM-DD` (UTC day) | the Date, `Date` | `DATE` of the UTC day | per `SqliteDateTimeFormat` |
| localTime | `HH:MM:SS.mmm` (UTC); forced: `time` | `HH:MM:SS.mmm` (UTC) | the Date on 1970-01-01 UTC, `Time` | `TIMESTAMP` on 1970-01-01, the UTC digits | per format |
| localDateTime | `YYYY-MM-DD HH:MM:SS.mmm+00`; forced: `timestamp` | `YYYY-MM-DD HH:MM:SS.mmm` (UTC) | the Date, `DateTime2` | `TIMESTAMP`, the UTC digits | per format |
| enum, custom, customComparable | as given; forced: type of the JS value or none | as given | a string `NVarChar`, otherwise inferred from the value | as given | as given (a boolean `1`/`0`, except bun:sqlite and Bun SQL) |
| null of a known category | forced: the category's cast/OID | null | the category's type | typed by category (number, timestamp), otherwise untyped | null |

## 3. Reading

### 3.1 Per runner: what it sets per query, and what it delivers

Per query or per statement, overriding what the user configured on the driver; the user's settings keep applying to
their own queries.

| Runner | Per query / statement | Delivers | Source / test |
|---|---|---|---|
| `PgQueryRunner`, `PgPoolQueryRunner` | `types: { getTypeParser }` built once per client: OID 1082 (`date`) and 1114 (`timestamp`) in text format → `parseUtcDateTimeTextOrKeepIt` (a Date whose UTC getters are the digits; `infinity` stays text); every other OID → `client.getTypeParser(oid, format)` (the user's parsers apply) | `date`/`timestamp` as UTC Date; the rest as the client parses it (pg defaults [inferred]: `int8`, `numeric`, `time` as text; `timestamptz` an instant Date; `int4`, `float8` numbers; `bool` boolean) | `PgQueryRunner.ts:29-36,59-64,104-117`; `test/runners/postgres/DriverConfiguration.test.ts` (`a-date-and-a-timestamp-are-read-as-utc-and-the-other-parsers-of-the-client-apply`, `the-types-of-the-pool-apply-to-the-other-types`) |
| `PostgresQueryRunner` | nothing for reading | postgres.js defaults; `date`/`timestamp` with UTC digits in any zone of the process, unless `infer` (§5) | `PostgresQueryRunner.ts:101-117`; `test/runners/postgres/LocalTemporalValuesInAnyZone.test.ts` |
| `PgLiteQueryRunner` | `parsers` merged over the database's: 1082 and 1114 → `parseUtcDateTimeTextOrKeepIt`, 1083 → its text | those three as above; any other OID with PGlite's or the user's parser | `PgLiteQueryRunner.ts:57-86,127-137`; `test/runners/postgres/DriverConfiguration.test.ts` (`a-date-a-time-and-a-timestamp-are-read-as-the-library-reads-them-and-the-other-parsers-apply`) |
| `BunSqlPostgresQueryRunner`, `BunSqlMySqlQueryRunner`, `BunSqlSqliteQueryRunner` | nothing | Bun SQL defaults: UTC Dates (MySQL: Bun sets the session at `+00:00`, measured), text for times | `AbstractBunSqlQueryRunner.ts:63-74`; the `LocalTemporalValuesInAnyZone` tests of PostgreSQL and MySQL |
| `MySql2QueryRunner`, `MySql2PoolQueryRunner` | `dateStrings: true`, `supportBigNumbers: true`, `bigNumberStrings: true`, `rowsAsArray: false`; and its own `typeCast` (DECIMAL/NEWDECIMAL → `field.string('ascii')`, else `next()`) when the connection has a `typeCast` function, `typeCast: false` or `decimalNumbers: true`, since a typeCast given with the query replaces the connection's | DATE/DATETIME/TIMESTAMP/TIME as text; BIGINT and DECIMAL as exact text; objects | `MySql2QueryRunner.ts:29,159-193`; `test/runners/mysql/DriverConfiguration.test.ts` (`a-connection-with-type-cast-false-doesnt-change-the-queries-of-the-runner`) |
| `MariaDBQueryRunner`, `MariaDBPoolQueryRunner` | `dateStrings: true`, `supportBigNumbers: false`, `bigIntAsNumber: false`, `decimalAsNumber: false`, `insertIdAsNumber: false`, `rowsAsArray: false`, `metaAsArray: false`, `nestTables: false`, `typeCast: undefined` (each replaces the connection's) | dates as text; BIGINT and insert id as `bigint`; DECIMAL as text; objects | `MariaDBQueryRunner.ts:11-34,83-97`; `test/runners/mariadb/DriverConfiguration.test.ts` |
| `MssqlPoolQueryRunner`, `MssqlPoolPromiseQueryRunner` | `request.arrayRowMode = false` | tedious defaults [inferred]: BIGINT as text, DECIMAL as a number (the connection converts decimal result columns to `nvarchar(41)`, `SqlServerConnection.transformProjection`); dates with the UTC getters (`useUTC`), instant for `datetimeoffset` | `MssqlPoolQueryRunner.ts:286-292`; `test/runners/sqlserver/DriverConfiguration.test.ts` (`the-rows-are-objects-with-array-row-mode-on-the-pool`) |
| `OracleDB*QueryRunner` | `outFormat: OUT_FORMAT_OBJECT`, `maxRows: 0`, `fetchTypeHandler` answering every column: a result column of category stringDecimal/customDecimal/bigint/customBigint (by name, or the only column of an unnamed one-value result) → `DB_TYPE_VARCHAR`; `DATE`/`TIMESTAMP` → converter rebuilding the Date with its local getters as UTC (`utcDateOfLocalGetters`); CLOB/NCLOB → string; BLOB → Buffer; else its own type | decimals/bigints as text; DATE/TIMESTAMP as UTC Date (exact except a wall clock skipped by DST in the process zone, and years < 100 built as 19xx); NUMBER as number; RETURNING OUT binds as in §2.4 | `OracleDBQueryRunner.ts:71-118,406-431` |
| `BetterSqlite3QueryRunner`, `BunSqliteQueryRunner` | nothing (`safeIntegers` not forced) | numbers, or `bigint` with the driver's big-integer mode; text; dates as stored per format | the lines of §2.4 |
| `NodeSqliteQueryRunner` | `statement.setReturnArrays?.(false)` per statement (the method exists since Node 22.16 and 24); `readBigInts` not forced | objects even on a database opened with `returnArrays: true`; numbers, or `bigint` with `readBigInts` | `NodeSqliteQueryRunner.ts:50-64`; `test/runners/sqlite/NodeSqliteQueryRunner.test.ts` (`the-rows-are-objects-with-return-arrays-on-the-database`) |
| `Sqlite3WasmOO1QueryRunner` | `selectObjects` | objects; numbers, `bigint` when unsafe and `bigIntEnabled` [inferred] | `Sqlite3WasmOO1QueryRunner.ts:50-57` |
| `MockQueryRunner` | — | whatever the user's executor returns; the reading tolerance of §3.3 applies to it | `MockQueryRunner.ts` |

The id of an inserted row (no `returning`): mysql2 `insertId`, mariadb `insertId` (a bigint), Bun SQL
`lastInsertRowid`, better-sqlite3/bun:sqlite/node:sqlite `lastInsertRowid`; `null` when no row was inserted
(`MySql2QueryRunner.ts:77-93`, `MariaDBQueryRunner.ts:89-97`, `BunSqlMySqlQueryRunner.ts:39-48`,
`BunSqlSqliteQueryRunner.ts:38-48`, `BetterSqlite3QueryRunner.ts:73-88`, `NodeSqliteQueryRunner.ts:78-93`). It goes
through `transformValueFromDB` of the id column like any value.

### 3.2 Per data type: what may arrive

What the runners of each database deliver for a value of the data type, all accepted by §3.3. Driver defaults not set
by our code are [inferred].

| Data type | PostgreSQL | MySQL / MariaDB | SQL Server | Oracle | SQLite |
|---|---|---|---|---|---|
| boolean | boolean; text `t`/`f` from a driver or a mock that gives the text | number 0/1 [inferred] | boolean [inferred] | number; text `"1"` from an OUT bind of a `NUMBER(1)`; `TRUE`/`FALSE` from an OUT bind of a native BOOLEAN column (23) | number 0/1, bigint |
| int | number; text (int8, count) | number; text (mysql2 BIGINT); bigint (mariadb BIGINT) | number; text (BIGINT) [inferred] | number; text from an OUT bind | number, bigint |
| bigint | text (int8) | text (mysql2); bigint (mariadb) | text [inferred] | text (fetched as VARCHAR) | number, bigint |
| double | number; text (numeric) | number; text (DECIMAL) | number | number | number |
| stringDecimal, customDecimal | text | text | text (`convert(nvarchar(41))`) | text, possibly `.5` / `-.5` | text per `decimalStrategy` |
| string, uuid | text | text | text | text | text |
| localDate | Date (UTC parse of `date`) | text `YYYY-MM-DD` (mysql2/mariadb); Date (Bun SQL) | Date | Date (UTC converter) | per format |
| localTime | text `HH:MM:SS[.ffffff]` | text `HH:MM:SS[.ffffff]` | Date | Date | per format |
| localDateTime | Date (`timestamp` UTC, `timestamptz` instant) | text `YYYY-MM-DD HH:MM:SS[.ffffff]` (mysql2/mariadb); Date (Bun SQL) | Date | Date; TSTZ instant | per format |
| aggregatedArray | text (`::text`) | text | text | text | text |

Inside an aggregated array every leaf is a JSON string or the source text of a JSON number (§1); temporal leaves are
text like `2024-01-15T00:00:00` (Oracle DATE, `connections/AbstractConnection.ts:1327`) or
`2024-01-14T09:15:30.1230000` (`utils/utcDateTimeText.ts:22-24`).

### 3.3 What the connection accepts (`transformValueFromDB`)

The same tolerance for every runner, `MockQueryRunner` included. Precision is always ensured: a loss is detected
(`PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE`) or the value rejected (`INVALID_VALUE_RECEIVED_FROM_DATABASE`), never
silent.

Common (`connections/AbstractConnection.ts:1157-1166`): `undefined` and `null` → `null`; `''` → `null` unless
`allowEmptyString`. Tests: `marshalling.transform-validation.test.ts` (`from-db-validation/*`),
`select.string-decimal.test.ts`, `select.custom-decimal.test.ts` in each cell.

| Conversion type | Accepts → result | `PRECISION_LOST` | Rejects | Source |
|---|---|---|---|---|
| `boolean` | boolean; number → `!!v`; bigint → `!!v`; text `^-?\d+$` → `!!(+v)`; text `true`/`false`/`t`/`f` in any case | — | other text, other types | `AbstractConnection.ts:1168-1197` |
| `int` | safe integer number; text `^-?\d+(\.0+)?$` → number; bigint → number | integer number not safe; text or bigint beyond the safe range | non-integer number, other text, other types | `:1198-1232` |
| `bigint` | safe integer number → bigint; text → `BigInt(text without a trailing .0+)` (`BigInt()` also takes `0x1f` and blanks, which no database delivers); bigint | integer number not safe | non-integer number, text `BigInt` refuses, other types | `:1233-1266` |
| `double` | number; text `^(-?(\d+(\.\d+)?\|\.\d+)([eE][-+]?\d+)?\|NaN\|-?Infinity)$` → `+v`; bigint → `Number(v)` (a `double` is approximate by definition: rounding a bigint is not a loss to report) | — | other text, other types | `:1267-1288` |
| `stringDecimal`, `customDecimal` | text `^-?(\d+(\.\d+)?\|\.\d+)$` (`.5` → `0.5`, `-.5` → `-0.5`); bigint → its text | any number | other text (an exponent too), other types | `:1289-1313` |
| `string`, `uuid` | text, unchanged | — | non-text | `:1314-1323` |
| `localDate` | valid Date, read with its UTC getters, or text parsed by `parseUtcDateTimeText` → a new Date at 10:00 UTC of the UTC day of the received one | — | anything else, invalid Date, unparsable text, text outside the calendar | `:1324-1342,1376-1384` |
| `localTime` | same inputs → a Date on 1970-01-01 with the UTC time of the received one | — | same | `:1343-1354` |
| `localDateTime` | same inputs → the received Date (the parsed one for text) | — | same | `:1355-1364` |
| `aggregatedArray` | — (handled by the query builder) | — | always | `:1365-1367` |
| other | as it is | — | — | `:1368-1369` |
| SQLite temporal | Date, text, number or bigint per `SqliteDateTimeFormat` and the `treatUnexpected*` options | — | other types, invalid result, text outside the calendar (`isDateTimeTextOutOfCalendar`, before the strategies) | `SqliteConnection.ts:143-413` |

The returned temporal Dates carry `___type___` (`'localDate'`, `'localTime'`, `'localDateTime'`), which
`MssqlPoolQueryRunner.inferType` reads when such a Date is sent back without metadata
(`queryRunners/MssqlPoolQueryRunner.ts:377-386`).

### 3.4 Temporal text: `parseUtcDateTimeText`

`utils/utcDateTimeText.ts:25,35-78`. The text is trimmed and matched, case-insensitively, against:

```
[date][time][offset][ BC]      at least the date or the time
date   = [+-]?YYYY-MM-DD       year of 4 to 6 digits
time   = HH:MM[:SS[(.|,)fraction]]      after the date, preceded by one 'T' or ' '
offset = optional blanks, then Z | ±HH | ±HH[:]MM | ±HH[:]MM[:]SS
```

- Without an offset the digits are the UTC getters of the result; with one, the result is the instant it gives.
- A date alone is at 00:00; a time alone is on 1970-01-01.
- The fraction is truncated to milliseconds; every year is read as written (`0099` is 99, via `setUTCFullYear`); `BC`
  gives `1 - year` (`0044 BC` → −43).
- `undefined` (→ rejected) when the text doesn't match, or its digits are outside the calendar: month ∉ 1..12, a day
  the month doesn't have (`2024-02-30`, kept by MySQL/MariaDB with `ALLOW_INVALID_DATES`; a zero date `0000-00-00`),
  hours > 23 (the end of the day `24:00:00`, accepted by PostgreSQL `time` and MySQL/MariaDB `TIME`), minutes or
  seconds > 59; or when the Date is invalid.

Forms the runners deliver: `2024-01-14` (mysql2/mariadb `dateStrings`, PGlite/pg `date`), `09:15:30.123456` (PG and
MySQL `time`), `2024-01-14 09:15:30.123456` (MySQL DATETIME, PG `timestamp`), `2024-01-14 09:15:30+09`, `…+05:30`,
`…+00:14:44` (PostgreSQL offsets), `0044-03-15 BC` (PostgreSQL), `2024-01-14T09:15:30.1230000` and `…Z` (JSON
aggregates) — the examples listed at `utils/utcDateTimeText.ts:22-24`.

`parseUtcDateTimeTextOrKeepIt` (`:85-87`) is the variant a driver parser uses: an unparsable text (`infinity`) is
returned as text, and then rejected by `transformValueFromDB`. `isDateTimeTextOutOfCalendar` (`:94-112`) is the same
calendar check, used by `SqliteConnection` before its strategies.

## 4. The hidden params metadata

Non-enumerable properties on the params array (`utils/queryParamsMetadata.ts`): they travel with the params and are
never sent. What belongs to each parameter is one object per parameter, at its index, in a single array hidden under a
symbol (`paramsInfoKey`, `queryParamsMetadata.ts:98-127`); its keys are symbols too, so what the library keeps and what
anyone else adds can't collide. A runner reads them through the public functions of `queryRunners/QueryRunner.ts`; all are optional extra
information, so a runner must still work with params built by hand (no metadata: `undefined`).

| Property | Written by | Public reader | What it is for |
|---|---|---|---|
| the type name, type category and forceTypeCast of each parameter | the binding, through `setParamTypeAt` (`queryParamsMetadata.ts:131-136`); `setQueryParamType` (`QueryRunner.ts:121-123`) for a runner of its own, also for OUT params | `getQueryParamType`, `getQueryParamTypeCategory`, `getQueryParamForceTypeCast` (`QueryRunner.ts:125-141`) | the type of each param at execution: the UTC text of a `Date` (PostgreSQL, MySQL/MariaDB), OIDs (postgres.js, PGlite), mssql types, Oracle bind types, `typesByName` lookups. A param added without them leaves a hole, and is sent as it is |
| whether a parameter is the value of a column | the SQL builder before `addParam`, inside an insert's values or an update's set (`AbstractSqlBuilder.ts:703-705`; `queryParamsMetadata.ts:155-161`) | `isQueryParamValueForColumn` (`QueryRunner.ts:147-150`) | the column gives the type: no decimal cast on MySQL/MariaDB and SQL Server (`mySqlParamTypes.ts:26-28`, `sqlServerParamTypes.ts:24-26`) |
| `$resultColumns` | `__setQueryMetadata` (`queryBuilders/AbstractQueryBuilder.ts:560`), from `__resultColumnsOf` / `__unnamedResultColumn` (`:533-558`) | `getQueryResultColumns`, `getQueryResultColumn` (`QueryRunner.ts:226-234`) | the expected type of each result column (`name` = key in the row, `path`, `type`, `typeCategory`; `''` for an aggregated array): Oracle fetches decimals and bigints as text (`OracleDBQueryRunner.ts:94-118`). `[]` when the query returns no columns, `undefined` for a query the library didn't build |
| `$connectionConfiguration` | `__setQueryMetadata` | `getQueryConnectionConfiguration` (`QueryRunner.ts:239-242`) | the connection's settings (`ConnectionConfiguration`, `QueryRunner.ts:156-204`: `allowEmptyString`, `compatibilityVersion`, `uuidStrategy`, `decimalStrategy`, SQLite date formats, …), read live from the connection |
| `$source`, `$metadata` | `__setQueryMetadata` | `getQueryExecutionSource`, `getQueryExecutionStack`, `getFunctionExecutingQuery`, `getQueryExecutionName`, `getQueryExecutionMetadata` (`QueryRunner.ts:243-302`) | logging and errors |
| `$isSelectPageCountQuery` | `executeSelectPage` | `isSelectPageCountQuery` (`QueryRunner.ts:303-306`) | tells the count query apart |
| `_containsInsertReturningClause`, `_containsMutationReturningClause`, `_forcedAffectedRowCount` | SQL builder | internal (`AbstractQueryRunner.containsInsertReturningClause`, `executeMutationReturning`, `getForcedAffectedRowCount`) | whether to read rows or the insert id; Oracle's multi-row insert count |

## 5. The driver object: what the runner checks, isolates, and leaves to the user

### 5.1 The criterion

The runner receives a driver object the user configured (a client, a pool, a connection, a database, an `sql`
instance). For what that configuration could change in the library's queries:

1. **Isolate per query or per statement** wherever the driver takes the option there, as long as it is an option and
   not a rewrite of the driver: pg `types`, PGlite `parsers`, mysql2 options (with its own `typeCast` when the
   connection has a `typeCast` function, `typeCast: false` or `decimalNumbers`), mariadb options, oracledb
   `fetchTypeHandler`, `maxRows` and `outFormat`, mssql `arrayRowMode`, node:sqlite `setReturnArrays(false)` per
   statement (§3.1). The user's settings keep applying to their own queries.
2. **Validate when the runner is created** (`INVALID_CONFIGURATION`, read from the object it holds or the environment)
   what can't be set per query and would lose data or change it silently (§5.2).
3. **Document** what can't be read without a query (a session setting, a module-global parser), as a requirement of
   the connection on the runner's page (`docs/configuration/query-runners/recommended/<runner>.md`, "Connection
   requirements") (§5.3).
4. **A loss that is detected anyway** (an unsafe number for an integer, a number for a decimal: `PRECISION_LOST`) needs
   nothing: choose what is cheapest to run.
5. **Never a query** to check any of it.

### 5.2 Checks when the runner is created (`INVALID_CONFIGURATION`)

Read only from the driver object the runner holds or the environment; thrown in the constructor. "Process in UTC" is
`isProcessInUtc()`: `process.env.TZ` when set, else `Intl.DateTimeFormat().resolvedOptions().timeZone`, matched against
a fixed list of UTC names (`UTC`, `UTC0`, `Etc/UTC`, `UCT`, `GMT`, `GMT0`, `GMT±0`, `Etc/GMT…`, `Universal`, `Zulu`,
`Greenwich`, …, case-insensitive, a leading `:` ignored); never the current offset; computed again only when the
value of `process.env.TZ` changes, since Node and Bun change the zone of the process when it is assigned
(`utils/processTimeZone.ts:7-40`; `test/runners/general/ProcessTimeZone.test.ts`).

| Runner | `name` | Rejected when | Source / test |
|---|---|---|---|
| `PgQueryRunner`, `PgPoolQueryRunner` | `binary` | `client.binary === true` or `pool.options.binary === true`. A pool client in binary mode (`pg.defaults.binary`) is rejected when the pool gives it, and released | `utils/pgConfiguration.ts:8-13`; `PgQueryRunner.ts:34`; `PgPoolQueryRunner.ts:26,48-58`; `test/runners/postgres/DriverConfiguration.test.ts` (`pg-in-binary-mode-is-rejected`) |
| `PgQueryRunner`, `PgPoolQueryRunner` | `options` | the session is put in a zone that isn't UTC (§7.3, "The checks"): a `TimeZone` in `client.connectionParameters.options` (the configuration, the `options` of the connection string, `PGOPTIONS`, `pg.defaults.options`) or in `pool.options.options`, read as the server reads its command-line options (`-c TimeZone=…`, `--timezone=…`, the last wins) and accepted as a UTC name or a zero offset (`+00:00`, `00:00`, `+00`; measured on PostgreSQL 17). What a pool adds from its connection string or `PGOPTIONS` is seen in the client it gives, rejected and released as for `binary` | `utils/pgConfiguration.ts:21-25`; `utils/processTimeZone.ts:46-115`; `PgQueryRunner.ts:35`; `PgPoolQueryRunner.ts:27`; same test file (`a-session-in-another-zone-than-the-database-is-rejected`, `a-pool-whose-connection-string-puts-the-session-in-another-zone-is-rejected-at-its-first-query`) |
| `PostgresQueryRunner` | `transform` | `sql.options.transform.column.from`, `.value.from` or `.row.from` is set | `PostgresQueryRunner.ts:297-302`; same test file (`a-postgres-js-transform-of-the-results-is-rejected`) |
| `PostgresQueryRunner` | `connection` | the session is put in a zone that isn't UTC: an entry `timezone` (in any case) of `sql.options.connection`, which also holds the parameters of the URL that aren't options of postgres.js, or a `TimeZone` in its `options` entry, read as pg's | `PostgresQueryRunner.ts:303-313`; same test file (`a-session-in-another-zone-than-the-database-is-rejected`) |
| `PostgresQueryRunner` | `infer` | `sql.options.infer === true` and the process isn't in UTC | `PostgresQueryRunner.ts:314-316` |
| `BunSql*QueryRunner` | `transform` | `sql.options.transform.column` is a function, or its `from` is set (`SQL.camel`, `SQL.toCamel`, …) | `AbstractBunSqlQueryRunner.ts:20-28`; `test/runners/general/BunSqlConfiguration.test.ts` (`a-transform-that-renames-the-columns-of-the-results-is-refused`, `a-transform-whose-column-is-a-function-is-refused-as-given`) |
| `BunSqlPostgresQueryRunner` | `adapter` | adapter neither unset nor `'postgres'` | `BunSqlPostgresQueryRunner.ts:27-30` |
| `BunSqlMySqlQueryRunner` | `adapter`, `foundRows` | adapter not `'mysql'`/`'mariadb'`; `foundRows !== true` | `BunSqlMySqlQueryRunner.ts:16-25` |
| `BunSqlSqliteQueryRunner` | `adapter` | adapter not `'sqlite'` | `BunSqlSqliteQueryRunner.ts:13-16` |
| `MssqlPoolQueryRunner` (and the per-pool runner `MssqlPoolPromiseQueryRunner` creates, so it rejects its first query) | `useUTC` | `pool.config.options.useUTC === false` and the process isn't in UTC (a `Transaction` gives its pool's config) | `MssqlPoolQueryRunner.ts:42-46`; `MssqlPoolPromiseQueryRunner.ts:49` |
| `MssqlPoolQueryRunner` | `textsize` | `pool.config.options.textsize` is a number below `2147483647`, the default of tedious (a longer text of a `max` type would be cut without an error) | `MssqlPoolQueryRunner.ts:47-51`; `test/runners/sqlserver/DriverConfiguration.test.ts` (`a-pool-with-a-textsize-below-the-default-is-rejected`) |
| `MssqlPoolQueryRunner` | `camelCaseColumns`, `columnNameReplacer` | `camelCaseColumns === true` or a `columnNameReplacer` in `pool.config.options` | `MssqlPoolQueryRunner.ts:52-56`; same test file (`a-pool-that-renames-the-columns-is-rejected`) |
| `OracleDB*QueryRunner` | `ORA_SDTZ` | the session isn't in UTC: `process.env.ORA_SDTZ` set and neither a UTC name nor a zero offset (`LOCAL` and `DBTIMEZONE` included, whose zone isn't known without a query), or unset with the process outside UTC | `utils/processTimeZone.ts:123-133`; `OracleDBQueryRunner.ts:47`; `OracleDBPoolQueryRunner.ts:27`; `OracleDBPoolPromiseQueryRunner.ts:27`; `test/runners/oracle/LocalTemporalValuesInAnyZone.test.ts` |
| mysql2, mariadb, PGlite, better-sqlite3, bun:sqlite, node:sqlite, sqlite-wasm | — | nothing (what they could change is isolated per query) | — |

Other `INVALID_CONFIGURATION`: `registerSqliteFunctions` on a Node without `function`/`aggregate`
(`NodeSqliteQueryRunner.ts:152`); an unknown `SqliteDateTimeFormat` (`SqliteConnection.ts`, `default:` arms).

### 5.3 What is the user's (documented, not readable without a query)

Sending:

- The `Date` the user passes for a `localDate`/`localTime`/`localDateTime` has the intended digits in its UTC fields.
- `typesByName`: the declared type fits the values.
- SQLite: every stored value in the configured `SqliteDateTimeFormat`.

Reading:

- The data is stored as UTC digits.
- The zone of the database is UTC (a database outside UTC isn't supported yet, §7.3), and the session is in that zone:
  a `SET TIME ZONE` / `SET time_zone` / `ALTER SESSION` of the user, mariadb's `timezone`, Bun SQL PostgreSQL's
  `connection`, and the zone of the database itself, can't be read without a query (§7.3, "The checks"); what can be
  read (`ORA_SDTZ`, pg `options`, postgres.js `connection`) is checked (§5.2).
- MySQL/MariaDB: `TIMESTAMP` columns follow the session `time_zone` (the rule above). A date outside the calendar
  (`ALLOW_INVALID_DATES`), a zero date (without `NO_ZERO_DATE`) and a `24:00:00` value are rejected when read
  (`docs/configuration/time-zones.md#known-limits`); who stores them reads them with a custom type.
- PostgreSQL `time` values of `24:00:00` are rejected the same way.
- Oracle: a session zone changed with `ALTER SESSION`, or a connection opened before `ORA_SDTZ` is set, isn't seen.
- PGlite: created (or opened once) with `postgresqlconf: ["timezone = 'UTC'"]`, or its database takes the zone of the process that creates it
  (a database outside UTC, §7.3); the option goes into PGlite's own configuration and isn't readable from the object
  without a query.
- pg/PGlite: no parser registered that changes a type the library reads (`numeric`, `int8`, `text`…): PGlite overrides
  only 1082/1083/1114 per query (`PgLiteQueryRunner.ts:132-136`), and pg only 1082/1114.
- SQLite: the driver's big-integer mode if an integer may pass 2^53 (else `PRECISION_LOST` or a driver error).
- Oracle: the boolean columns are in the form `booleanStorage` says (`NUMBER(1)` by default, `BOOLEAN` with `'boolean'`, Oracle 23.4 or later); a column of the other form is declared with a `CustomBooleanTypeAdapter`.

Sources: `docs/configuration/query-runners/recommended/{pg,pglite,mysql2,mariadb,oracledb,mssql}.md`, "Connection
requirements"; `docs/configuration/time-zones.md#known-limits`.

## 6. Adding or changing a query runner — checklist

1. `addParam` delegates to a binding in `utils/queryRunnerParams.ts`; add the runner to `QueryRunnerName`,
   `queryRunnerParamBindings` and `queryRunnerDatabases` so `MockQueryRunner` imitates it. A rule shared by the
   database goes into its `utils/<db>ParamTypes.ts`, not into the runner. The binding writes the placeholder and the
   cast and checks the value; it pushes the value the connection handed.
2. What the driver needs and the database doesn't (the UTC text of a `Date`, `1`/`0` for a boolean, a driver type)
   is made at execution, on a copy given to the driver: the params keep the value the connection handed. Never rewrite
   the SQL text.
3. Accept the forms of §2.1, and anything for adapted/custom values: convert only what you recognise (a valid Date
   with type metadata, a plain decimal text), send the rest as it is.
4. Type the parameter from the metadata (§4), never from the SQL text; fall back to inferring from the value only
   when there is no metadata.
5. Per query, set every driver option that makes it deliver rows as objects keyed by alias, temporal values with UTC
   digits (or as text), big integers and decimals exactly; override what the user may have configured on the
   connection, where the driver allows it per query.
6. What can't be set per query and can be read from the object you hold: validate it in the constructor with
   `INVALID_CONFIGURATION` (`name` = the option). What can't be read: document it in the runner's page under
   "Connection requirements". Never run a query to check.
7. A lossy delivery that is detected (an unsafe number for an integer, a number for a decimal) is acceptable:
   `transformValueFromDB` rejects it. An undetectable one (a Date built in the process zone, a cut text, a renamed
   key, a lost row) is not.
8. Tests in `test/runners/<db>/` against the real engine, including `LocalTemporalValuesInAnyZone` (§7.3: spawned
   processes in UTC, Madrid, New York, Tokyo, `test/runners/lib/localTemporalValues.ts:11`) and `DriverConfiguration`.

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
that the user means as unanchored (a wall clock of their own, one day a Temporal value) takes the user declaring that
intent, never a choice of the library.

The pieces in between face the same missing information: a driver that gets a value without zone and has to
deliver a `Date` completes it somehow (with the zone of the process, of the session, or as UTC), and a database
completes it with the zone of its session (a column of kind 2, in the table below; an expression that mixes a value without zone with
one with zone). For every piece, know how it completes what is missing; in what is supported (§7.3) the runners keep
each one from completing it with anything but the zone of the database (§3.1, §2.4).

The kinds of column (`docs/configuration/time-zones.md`):

| Kind | The engine | What the program gets | Examples |
|---|---|---|---|
| 1 | stores and returns the wall clock as it is | a wall clock | PostgreSQL `date`, `time`, `timestamp`; MySQL/MariaDB `DATE`, `TIME`, `DATETIME`; Oracle `DATE`, `TIMESTAMP`; SQL Server `date`, `time`, `datetime`, `smalldatetime`, `datetime2` |
| 2 | converts in and out with the session zone | a wall clock | MySQL/MariaDB `TIMESTAMP`, Oracle `TIMESTAMP WITH LOCAL TIME ZONE` |
| 3 | stores one normalized instant | an instant | PostgreSQL `timestamptz` |
| 4 | keeps the zone of each value | the value and its zone | Oracle `TIMESTAMP WITH TIME ZONE`, SQL Server `datetimeoffset`, PostgreSQL `timetz` |

The date functions of a query (`getFullYear` … `getMilliseconds`) give the parts in UTC, as the `getUTC…` methods of
the `Date` read, and `getTime` its `getTime()`, the instant, also for a value stored with another offset (Oracle `OracleSqlBuilder._getTime`) (`docs/configuration/time-zones.md`, "The date functions of a query
give the parts in UTC"). One exception: `getHours` of a PostgreSQL `timetz` stored with an offset other than `+00:00` gives the
hour of its own offset, because no expression without a zone gives it in UTC (`docs/configuration/time-zones.md#known-limits`).
SQLite has its own strategies (§0) and `sqliteRunsInApplicationTimeZone`.

### 7.2 Kind 4 through the drivers

| Database | Driver | What it delivers | Source |
|---|---|---|---|
| Oracle | oracledb (Thin) | a `Date`: the instant, to the millisecond; the zone is discarded when the value is decoded. Fetched as text it is that `Date`'s `toString()`; RAW and TIMESTAMP fail with NJS-119 | `node_modules/oracledb/lib/impl/datahandlers/buffer.js` (`parseOracleDate`), `lib/impl/resultset.js` |
| SQL Server | mssql (tedious) | a `Date`: the instant; `readDateTimeOffset` reads the offset and discards it, and keeps the time below the millisecond in a hidden `nanosecondsDelta`. No option changes it (`useUTC` isn't passed to it) | `node_modules/mssql/node_modules/tedious/lib/value-parser.js` (`readDateTimeOffset`) |
| PostgreSQL | pg, postgres.js, Bun SQL, PGlite | `timetz` as text with its offset (`19:30:15.123+09`); `timestamptz` (kind 3) as a `Date` | measured, no test here |

So oracledb and mssql deliver a kind-4 column as kind 3; PostgreSQL's `timetz` arrives as text with its offset. A runner can't recover the zone: in Oracle and SQL Server a value
with its zone exists only if the SQL formats it (`to_char(x, '…TZH:TZM')` / `TZR`, `convert(nvarchar(40), x, 126)`),
which is the user's SQL (a fragment, or the `transformProjection` of a type adapter or of the connection) and never the runner's (§0). A `Date` the library writes into such a column is stored with `+00:00`.
A type adapter on the column keeps the zone for every query: its `transformProjection` gives the column as that text in
`'resultColumn'` (the select, the `returning` / `output`) and `'aggregatedArrayValue'`, its `transformPlaceholder` converts
the text sent (`to_timestamp_tz(:0, 'YYYY-MM-DD"T"HH24:MI:SS.FF TZR')`, `cast(@0 as datetimeoffset)`), and the value is the
text. A `customComparable` (or a `custom`) text is sent as text; a `customLocalDateTime` is bound by its category, on SQL
Server as a `datetime2`, which tedious makes from a `Date`: the offset and the digits below the millisecond are lost
(measured on SQL Server 2019). Outside those outputs (the where, the order by) the column keeps its SQL, so they
compare instants; its `projectionComparison` is `'none'`, so a union and a distinct compare
instants too (Oracle and SQL Server compare these values by instant). `test/db/oracle/*/*/column.oracle-zoned-date-time-as-text.test.ts`,
`test/db/sqlserver/*/mssql/column.sqlserver-zoned-date-time-as-text.test.ts` (real on Oracle 21 and 23, SQL Server 2019,
2022 and 2025).

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
session zone, only the zone of the database. The configuration that sets it (measured): `ORA_SDTZ`, pg
`options: '-c TimeZone=…'` (also in the URL or `PGOPTIONS`), postgres.js and Bun SQL PostgreSQL
`connection: { TimeZone: … }`, mariadb `timezone`; mysql2 has none (only a `SET time_zone` of the user). What a runner
can read when it is created: `ORA_SDTZ` (the environment), pg `client.connectionParameters.options` and
`pool.options.options`, postgres.js `sql.options.connection`. What it can't: a `SET` of the user, mariadb's options
(kept in private fields), Bun SQL PostgreSQL's (only in an internal encoding).

**Which zone matters for which values.** The zone of the database matters only for the values of kind 1 (§7.1), which
the database doesn't normalize. Kind 2 depends on the session: the value is normalized when stored, and the session
decides the digits it is read and written with. Kinds 3 and 4 depend on neither: a value of kind 3 is normalized, the
database knows the exact moment it refers to, and a value of kind 4 keeps its own zone.

**What is supported.** The session must be in the zone of the database. A session in any other zone, UTC included over
a database outside UTC, is harmful: what the database produces in it (`current_date`, `now()`, a
default, a trigger) comes in the zone of the session, not in the zone of the data, and mixes the database.

| Database | Session | Goal | Today |
|---|---|---|---|
| UTC | UTC (the zone of the database) | supported, whatever the zone of the process (a connector that puts the zone of the process in the session is the third row) | supported; the test matrix runs here |
| not UTC | the zone of the database (whether it comes from the process or is set) | to be supported, with the zone of the database declared by the user (below) | not supported and not detected: the library takes the database as UTC |
| any | not the zone of the database: the zone of the process used by the connector for the session, another zone set on purpose, or UTC over a database outside UTC (set by the user or by the connector, like Bun SQL MySQL/MariaDB) | refused when the runner is created where it can read the session; documented where it can't | refused, the database taken as UTC, where the configuration sets a session outside UTC: oracledb (`ORA_SDTZ` in another zone, or unset with the process outside UTC), pg (`options`), postgres.js (`connection`); not detected otherwise (a `SET` of the user, the connectors whose configuration isn't readable; a connector that sets UTC over a database outside UTC passes, since the database is taken as UTC) |

**The checks.** The configuration of the connector is also how the user puts the session in the zone of the database,
so the goal is to compare the session a runner can read with the zone of the database, never with UTC as such.

- Today the zone of the database is UTC (the only one supported), and the runners that can read the session refuse,
  when they are created, one their configuration puts outside UTC (§5.2): oracledb (`ORA_SDTZ`, or the offset of the
  process when it is unset: `requireOracleSessionInDatabaseZone`), pg (`options`) and postgres.js (`connection`), all
  through `requireSessionInDatabaseZone`, which accepts an unset session (it has the zone of the database), a UTC name
  or a zero offset. The message doesn't tell a user with a database outside UTC to move the session to UTC (that
  mixes the database): it says that a database outside UTC isn't supported yet. `ORA_SDTZ` stays the way to put an
  Oracle session in the zone of a database outside UTC once it is declared: the same comparison, with the declared
  zone instead of UTC.
- To do, once a zone can be declared: compare the same sessions with it instead of UTC (for oracledb, `ORA_SDTZ`
  equal to the declared zone; unset, the session is a fixed offset, which is a zone with summer time only by chance);
  refuse a connector that always sets UTC (Bun SQL MySQL/MariaDB) over a database outside UTC; decide whether
  `ORA_SDTZ=DBTIMEZONE` is trusted with the declared zone (with NJS-201 of oracledb when `DBTIMEZONE` is a region).
- Today, and also then: a driver option that would complete a missing zone with the zone of the process is refused
  when the process isn't in UTC (§5.2): postgres.js `infer: true`, mssql `useUTC: false`. This is about the process,
  not the session.

**A database outside UTC is to be supported**: many databases hold years of data in the zone they were installed in. The library can't read that zone without a query of its own, so the user will have to
declare it, and the library will trust it: it is never checked against the database, not even once per pool (that
would be a query of its own, §0); that the database really is in the declared zone stays documented. The design is
pending, and supporting it must not make the SQL of a database in UTC worse. Until then a database outside UTC isn't
supported: the values without zone are in its zone and the library takes them as UTC.

**Out of scope, on purpose** (written here so the question doesn't come back): **a mixed database**, whose values
without zone aren't all in the zone of the database, however they got there (other programs, other sessions, including
a session a connector put in another zone, values computed elsewhere, a database whose zone was changed over stored
values). The library doesn't produce it when the session is in the zone of the database, and it can't know it nor tell
it from a database that isn't mixed. Keeping the values without zone in the zone of the database is the user's
responsibility: the library takes one zone for the whole database, and converting values in another zone (for example
with type adapters) is the user's own work, not a support of the library.

**The process** isn't a dimension of what is supported: the library reads and writes a `Date` with its UTC methods
only, and each runner keeps its driver from completing a missing zone with the zone of the process (oracledb: but for the
known limit in the table below), or refuses the driver option that would (§5.2; proved with the columns of kinds 1 and 2, of kind 3, of kind 4 on Oracle and SQL
Server, the date functions of a query and every way of sending and reading a value, with the limits the tests
declare). Otherwise it only matters as the origin of the session a connector initializes by default (oracledb). The user is still
advised to run the backend in UTC: their own code can be surprised by the zone of the process (a `Date` built from
local parts, the local methods of a `Date`, other libraries), even when the library isn't. What each runner does with
it:

| Runner | Reading a value without zone | Sending | Session zone by default |
|---|---|---|---|
| pg, PGlite | text (`date`, `timestamp`, and `time` on PGlite) parsed as UTC (§3.1) | text, `…+00` for a `localDateTime` (§2.4) | pg: none, the database's. PGlite: none; the zone of its database is the one of the process that created it, unless it was created (or opened once) with `postgresqlconf: ["timezone = 'UTC'"]` |
| postgres.js | the UTC digits in any zone of the process (§3.1) | text (§2.4) | the database's |
| Bun SQL PostgreSQL | UTC `Date`s (tested in any zone of the process) | text (§2.4) | the database's |
| mysql2, mariadb | text (`dateStrings`) | text without offset (§2.4) | the database's |
| Bun SQL MySQL/MariaDB | UTC `Date`s | text (§2.4) | `+00:00`, set by Bun (measured) |
| mssql | `Date`s with the UTC digits (`useUTC`) | `Date`s with `useUTC` | none: SQL Server has no session zone |
| oracledb | a `Date` that oracledb builds taking the digits in the process zone; the runner takes the same digits back as UTC; a wall clock the process zone skips in its change to summer time is moved an hour by oracledb (known limit) | `TIMESTAMP WITH TIME ZONE` in UTC | `ORA_SDTZ`, else the process offset; the runner requires a session in UTC (`requireOracleSessionInDatabaseZone`) |
| SQLite runners | per `SqliteDateTimeFormat` (§0) | per format | — (one party: SQLite runs in the process, outside this section) |

**Tests.** The zone of the process is a dimension of the tests, because it is where a driver's defects show: each case
supported (or to be supported) is tested with the process in three positions: in the zone of the database (the usual
deployment, where a driver that uses the zone of the process goes unnoticed, because both agree), in UTC, and in a zone
that agrees with neither (where such a driver shows). With the
database in UTC the first two are the same; with a database outside UTC (for example Europe/Madrid, when supported)
they are Europe/Madrid, UTC and another (Asia/Tokyo). Today: `test/runners/<db>/LocalTemporalValuesInAnyZone.test.ts`
(spawned processes in UTC, Madrid, New York and Tokyo, the database in UTC; 0 failures on PostgreSQL, MySQL, MariaDB,
SQL Server and Oracle, with the limits each test declares: Oracle's Julian calendar before 1582-10-15, a wall clock in
the summer-time gap of the process zone on oracledb), and the oracledb checks in the same Oracle test; the checks of pg and postgres.js in
`test/runners/postgres/DriverConfiguration.test.ts`. A runner that
changes how it reads or sends a temporal value states here what it supports, with the test that proves it.
