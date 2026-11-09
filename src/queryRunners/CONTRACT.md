# The contract between the query runners and the connection

Internal documentation for a contributor who adds or changes a query runner. Not published.

Two directions, always kept apart:

- **Sending** (library → database): the connection converts the value (`transformValueToDB`), the query runner adds
  it to the params (`addParam`) and hands it to its driver.
- **Reading** (database → library): the query runner makes its driver deliver each value in a form the library reads,
  and the connection converts it (`transformValueFromDB`).

Conventions: `file:line` is relative to `src/` unless it starts with `test/`. A statement about what a driver or an
engine does that isn't backed by this repository's code or tests is marked **[inferred]**; one taken from the design
measurements is marked **[design]** (`ts-sql-query-v2-designs/driver-options-design.md`, outside the repo).

## 0. Who owns what

From the rule *The query runner and the connection* in `CLAUDE.md`:

| Owner | Owns |
|---|---|
| Connection (`connections/AbstractConnection.ts` and each per-database subclass) | Which JS values a data type accepts and promises (`transformValueToDB` / `transformValueFromDB`), the SQL around the values |
| SQL builder (`sqlBuilders/*`) | The SQL of the result columns (e.g. `convert(nvarchar(41), …)` of a decimal on SQL Server, `sqlBuilders/SqlServerSqlBuilder.ts:52-57`; `(…)::text` of an aggregated array on PostgreSQL, `sqlBuilders/PostgreSqlSqlBuilder.ts:277-283`; finalisation hook `sqlBuilders/AbstractSqlBuilder.ts:713-724`) |
| Query runner (`queryRunners/*`, with one binding module per database in `utils/`) | How a parameter reaches the database: placeholder, cast, driver type/OID/bind type, the value text; the checks of the sent value after the adapter; the per-query options that make the driver deliver without loss; the shape of what it returns |

A runner never changes the meaning of a value. A runner that can't do its part does nothing, and the library works
as before.

**The golden rule** (`CLAUDE.md`): a runner sends only the query it was given. It never adds a probe query, not
even to validate its configuration: a prerequisite that can't be read from the driver object is documented, not
checked. Known exception: `Sqlite3WasmOO1QueryRunner` runs `select last_insert_rowid()` for an insert without
`returning` (`queryRunners/Sqlite3WasmOO1QueryRunner.ts:82`).

**SQLite is outside the UTC contract of the temporal types**: `SqliteConnection` keeps its `SqliteDateTimeFormat`
strategies (`connections/SqliteConfiguration.ts:1-7`) and formats and parses dates itself
(`connections/SqliteConnection.ts:142-524`); the default format is `'localdate milliseconds as text'`, in the zone of
the process (`connections/SqliteConnection.ts:135-137`). Everything below about temporal values and UTC applies to the
other databases.

## 1. The pipeline

### Sending

1. `AbstractSqlBuilder._transformParamToDB` (`sqlBuilders/AbstractSqlBuilder.ts:653-666`) calls the type adapter of
   the value, if any, with the connection as `next`; otherwise the connection's `transformValueToDB`. An
   `INVALID_VALUE_TO_SEND_TO_DATABASE` gets the index of the parameter (`paramIndex`).
2. `AbstractSqlBuilder._appendParam` (`sqlBuilders/AbstractSqlBuilder.ts:668-688`):
   - asks the adapter / connection `forceTypeCast(type, category, valueSentToDB, forceTypeCast)`
     (`connections/AbstractConnection.ts:1493-1495`: unchanged by default). `forceTypeCast` is true where the position
     of the parameter gives the database no type;
   - marks the parameter as the value of a column (`setParamValueForColumnAt`) inside the values of an insert or the
     set of an update;
   - calls `queryRunner.addParam(params, value, typeName, typeCategory, forceTypeCast)`;
   - passes the placeholder through `transformPlaceholder` (`connections/AbstractConnection.ts:1484-1486`: identity).
3. `addParam` of every runner that talks to a database delegates to one binding of
   `utils/queryRunnerParams.ts:76-97` (the same function `MockQueryRunner` calls to imitate it,
   `queryRunners/MockQueryRunner.ts:90-111,530-532`). The binding pushes the value, records its type name, category and
   forceTypeCast (`setParamTypeAt`, `utils/queryParamsMetadata.ts:103-122`) and returns the placeholder.
4. At execution the runner reads that metadata (§4) and builds what its driver receives (a typed bind, an OID, a type
   of the driver). The params array itself is not changed (`PostgresQueryRunner.ts:69-99`, `PgLiteQueryRunner.ts:57-80`,
   `OracleDBQueryRunner.ts:122-174`).

### Reading

1. The runner executes with its per-query options (§3.1) and returns rows as plain objects keyed by the column alias.
   The one-column / one-value methods take the only own property of the row and throw `ONLY_ONE_COLUMN_EXPECTED` if
   there are more (`queryRunners/AbstractQueryRunner.ts:25-56,225-239`).
2. The query builder reads `row[alias]` (or `row[_resultColumnKey(alias)]`) per column
   (`queryBuilders/AbstractQueryBuilder.ts:131-156`). So rows as arrays or renamed keys give `null` silently: the
   runner must prevent them (§3.1).
3. An aggregated array arriving as text is parsed with `parseJsonPreservingNumbers`, which turns every JSON number into
   its source text (`queryBuilders/AbstractQueryBuilder.ts:158-215,592-599`); a value that is already an array (a driver
   that decoded the JSON) is used as it is. Each leaf then goes through `transformValueFromDB` of its type.
4. `__transformValueFromDB` (`queryBuilders/AbstractQueryBuilder.ts:74-95`) calls the adapter (with the connection as
   `next`) or the connection's `transformValueFromDB`; an error that isn't of the library becomes
   `INVALID_VALUE_RECEIVED_FROM_DATABASE`.

`__conversionType` (`utils/typeCategory.ts:39-44`) decides which arm of the transforms converts a value: the type name
when it is a built-in one (`boolean`, `int`, …, `aggregatedArray`), otherwise the type of its category
(`customInt` → `int`, `customBigint` → `bigint`, `customDouble` → `double`, `customDecimal` → `customDecimal`,
`customUuid` → `uuid`, `customLocalDate/Time/DateTime` → `localDate/Time/DateTime`, `utils/typeCategory.ts:22-31`).
`enum`, `custom`, `customComparable` and a value without category keep their name and pass unconverted.

## 2. Sending

### 2.1 What `transformValueToDB` accepts and hands to the runner

Common to every type (`connections/AbstractConnection.ts:1378-1386`): `undefined` and `null` → `null`; `''` → `null`
unless `allowEmptyString` (default `false`, `connections/AbstractConnection.ts:40`). Every rejection is
`INVALID_VALUE_TO_SEND_TO_DATABASE`.

| Conversion type | Accepts | Rejects | Hands to the runner | Source |
|---|---|---|---|---|
| `boolean` | `boolean` | anything else | the boolean. Oracle: `1` / `0` | `AbstractConnection.ts:1388-1392`; `OracleConnection.ts:150-153` |
| `int` | an integer `number` (not checked for the safe range) | non-integer number, non-number | the number | `AbstractConnection.ts:1393-1400` |
| `bigint` | `bigint` | anything else (a `number` too) | the bigint | `AbstractConnection.ts:1401-1405` |
| `double` | any `number` (`NaN`, `Infinity` included) | non-number | the number | `AbstractConnection.ts:1406-1410` |
| `stringDecimal`, `customDecimal` | a string matching `^-?(\d+(\.\d+)?\|\.\d+)$` (point separator, no exponent) | other strings, non-strings | the text | `AbstractConnection.ts:1411-1421` |
| `string` | `string` | non-string | the string | `AbstractConnection.ts:1422-1426` |
| `uuid` | `string` (format not checked) | non-string | the string | `AbstractConnection.ts:1427-1431` |
| `localDate` | a valid `Date` | invalid `Date`, non-Date | the `Date` as given (not normalised) | `AbstractConnection.ts:1432-1436` |
| `localTime` | a valid `Date` | invalid `Date`, non-Date | text `HH:MM:SS` from the UTC getters, `.mmm` only when the milliseconds aren't 0. Oracle: a `Date` on 1970-01-01 UTC with the UTC time. SQL Server: the `Date` as given | `AbstractConnection.ts:1437-1470`; `OracleConnection.ts:154-163`; `SqlServerConnection.ts:126-136` |
| `localDateTime` | a valid `Date` | invalid `Date`, non-Date | the `Date` as given | `AbstractConnection.ts:1471-1475` |
| `aggregatedArray` | — | always | — | `AbstractConnection.ts:1476-1478` |
| `enum`, `custom`, `customComparable`, no category | anything | — | the value as given | `AbstractConnection.ts:1479-1480` |
| SQLite temporal | a valid `Date` | non-Date | text or number per `SqliteDateTimeFormat` | `SqliteConnection.ts:405-524` |

Tests: `test/db/<db>/<version>/<connector>/marshalling.transform-validation.test.ts` (`to-db-validation/*`).

**The runner must not assume this table holds.** A type adapter's `transformValueToDB` replaces the connection's
(it only calls it through `next` if it wants, `sqlBuilders/AbstractSqlBuilder.ts:655-658`), and its result is not
validated again. So a runner receives the forms above for the built-in types without adapter, and anything for a value
with an adapter or of `enum`/`custom`/`customComparable`. The binding modules are written for that: they convert only a
valid `Date` (`utils/postgreSqlParamTypes.ts:94-96`, `utils/mySqlParamTypes.ts:41-43`,
`utils/oracleParamTypes.ts:29-31`) and check a decimal only when it is plain decimal text
(`utils/customDecimalParams.ts:8-17`); anything else is sent as it is.

### 2.2 The bindings

`utils/queryRunnerParams.ts:76-97` gives one binding per runner; `databaseParamBinding` (`:128-146`) gives the one a
mock or `NoopQueryRunner` without a named runner uses (`queryRunners/NoopQueryRunner.ts:140-143`).

| Binding | Runners | Placeholder | Value | Source |
|---|---|---|---|---|
| `sqliteNumbered` | BetterSqlite3, BunSqlite, NodeSqlite | `?N` (1-based) | a boolean as `1`/`0`, the rest as it is | `queryRunnerParams.ts:29-31` |
| `bunSqlSqlite` | BunSqlSqlite; mock/noop on `sqlite` | `?N` | as it is | `:33-35`, `:139-140` |
| `sqliteWasm` | Sqlite3WasmOO1 | `?N`; an integer `number` ≥ 2^63 or < −2^63 as `cast(?N as real)` with its text | boolean as `1`/`0`; that integer as `String(value)` | `:40-48`; `test/runners/sqlite/Sqlite3WasmOO1Numbers.test.ts` |
| `postgreSqlCast` | Pg, PgPool, BunSqlPostgres; mock/noop on `postgreSql` | `$N`, plus `::<cast>` when forceTypeCast and a type is known (`typesByName[typeName]` first) | `postgreSqlParamValue` | `:50-54`; `postgreSqlParamTypes.ts:72-83` |
| `postgreSqlTyped` | Postgres (postgres.js), PgLite | `$N`, no cast (the type goes with the param, §2.4) | `postgreSqlParamValue` | `:56-58` |
| `mySql` | MySql2, MySql2Pool, MariaDB, MariaDBPool, BunSqlMySql; mock on `mySql`/`mariaDB` | `?`, or `cast(? as decimal(p, s))` for a decimal | `mySqlParamValue` | `:59-64`; `mySqlParamTypes.ts:15-30,40-54` |
| `sqlServer` | MssqlPool, MssqlPoolPromise; mock on `sqlServer` | `@N` (0-based), or `cast(@N as decimal(p, s))` for a decimal | as it is | `:65-69`; `sqlServerParamTypes.ts:13-28` |
| `oracle` | OracleDB, OracleDBPool, OracleDBPoolPromise; mock on `oracle` | `:N` (0-based) | as it is (the bind type is chosen at execution, §2.4) | `:70-73`; `oracleParamTypes.ts:10-18` |
| noop | mock/noop on `noopDB` | `$N` (0-based) | as it is | `:133-134` |

Per-database rules shared by every runner of the database:

- **PostgreSQL** (`utils/postgreSqlParamTypes.ts`). A valid `Date` of conversion type `localDate` → `YYYY-MM-DD`,
  `localTime` → `HH:MM:SS.mmm`, `localDateTime` → `YYYY-MM-DD HH:MM:SS.mmm+00`, from the UTC getters; a year < 1 is
  written `0044-03-15 BC` (`:93-111`). The type of a param by conversion type (`:26-38`): `bool`/16, `int4`/23,
  `int8`/20, `float8`/701, `numeric`/1700 (stringDecimal, customDecimal), `text`/25, `uuid`/2950, `date`/1082,
  `time`/1083, `timestamp`/1114; for `enum`/`custom`/`customComparable`/no category it comes from the JS value: a
  bigint `int8`, an integer number `int4` or `int8` by range, another number `float8`, anything else none
  (`:46-66`). Tests: `test/runners/postgres/PostgreSqlParamTypes.test.ts`.
- **MySQL / MariaDB** (`utils/mySqlParamTypes.ts`). A valid `Date`: `YYYY-MM-DD`, `HH:MM:SS.mmm`,
  `YYYY-MM-DD HH:MM:SS.mmm`, from the UTC getters, with a space and no offset (`:40-54`). A decimal text gets
  `cast(? as decimal(p, s))` with its own digits, except as the value of a column; precision > 65 or scale > 30 is
  rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE` (`:15-30`). Tests:
  `test/runners/mysql/MySqlCustomDecimalParams.test.ts`, `test/runners/mariadb/MariaDBCustomDecimalParams.test.ts`.
- **SQL Server** (`utils/sqlServerParamTypes.ts:13-28`). A decimal text gets `cast(@N as decimal(p, s))`, except as
  the value of a column; precision > 38 rejected. Tests: `test/runners/sqlserver/MssqlParamTypes.test.ts`.
- **Oracle** (`utils/oracleParamTypes.ts`). A decimal text with > 38 significant digits rejected (`:10-18`). A valid
  `Date` of a temporal conversion type is bound as `DB_TYPE_TIMESTAMP_TZ`, a `localDate` at 00:00 UTC of its UTC day
  (`:28-41`). Tests: `test/runners/oracle/OracleDBParamTypes.test.ts`.

The digits of a decimal (`utils/customDecimalParams.ts:8-17`): `-0012.50` is `decimal(4, 2)`, `0.0120` has 2
significant digits.

### 2.3 Per data type: what reaches the driver

After `transformValueToDB` without adapter, and the binding. "forced" = `forceTypeCast` true.

| Data type | PostgreSQL | MySQL / MariaDB | SQL Server (mssql type) | Oracle (bind) | SQLite |
|---|---|---|---|---|---|
| boolean | boolean; forced: `bool` | boolean [inferred: driver writes it as 1/0 or true/false] | `Bit` | number `1`/`0`; null → `DB_TYPE_NUMBER` | `1`/`0` (Bun SQL: boolean) |
| int, customInt | number; forced: `int4` | number | `Int` | number; null → `DB_TYPE_NUMBER` | number (wasm: ≥2^63 as `cast(text as real)`) |
| bigint, customBigint | bigint; forced: `int8` | bigint | `BigInt` | bigint; null → `DB_TYPE_NUMBER` | bigint |
| double, customDouble | number; forced: `float8` | number | `Float` | number; null → `DB_TYPE_NUMBER` | number |
| stringDecimal, customDecimal | text; forced: `numeric` | text, `cast(? as decimal(p,s))` outside a column value | `NVarChar`, `cast(@N as decimal(p,s))` outside a column value | text; null → `DB_TYPE_NUMBER` | text (the SQL around it per `decimalStrategy`) |
| string | text; forced: `text` | text | `NVarChar` | text | text |
| uuid, customUuid | text; forced: `uuid` | text | `UniqueIdentifier` | text | text |
| localDate | `YYYY-MM-DD` (UTC day); forced: `date` | `YYYY-MM-DD` (UTC day) | the Date, `Date` | TSTZ at 00:00 UTC of the UTC day | per `SqliteDateTimeFormat` |
| localTime | `HH:MM:SS[.mmm]` (UTC); forced: `time` | `HH:MM:SS[.mmm]` (UTC) | the Date, `Time` | TSTZ on 1970-01-01 UTC | per format |
| localDateTime | `YYYY-MM-DD HH:MM:SS.mmm+00`; forced: `timestamp` | `YYYY-MM-DD HH:MM:SS.mmm` (UTC) | the Date, `DateTime2` | TSTZ, the instant | per format |
| enum, custom, customComparable | as given; forced: type of the JS value or none | as given | a string `NVarChar`, otherwise inferred from the value | as given | as given |
| null of a known category | forced: the category's cast/OID | null | the category's type | typed by category (number, timestamp), otherwise untyped | null |

Sources: §2.1, §2.2; `queryRunners/MssqlPoolQueryRunner.ts:290-347`; `queryRunners/OracleDBQueryRunner.ts:151-201`.
SQL Server binds a `Date` with tedious's `useUTC` (true by default), which is why `useUTC: false` is rejected outside
UTC (§2.5).

### 2.4 Per runner: sending

| Runner | Binding | What the driver receives | `typesByName` | Source |
|---|---|---|---|---|
| `PgQueryRunner`, `PgPoolQueryRunner` | `postgreSqlCast` | `client.query({ text, values: params, types })`; the type is the cast in the SQL | cast text per type name (`PgQueryRunnerConfig`) | `PgQueryRunner.ts:58-63,76-79`; `PgPoolQueryRunner.ts:43-46` |
| `PostgresQueryRunner` | `postgreSqlTyped` | `sql.unsafe(query, driverParams)`; a param of a `typesByName` name → `sql.typed(value, oid)` or the user's function; a forced param with a PostgreSQL type → `sql.typed(value, oid)`; others untyped. A throwing `typesByName` function rejects before sending | OID or function | `PostgresQueryRunner.ts:73-115,212-215` |
| `PgLiteQueryRunner` | `postgreSqlTyped` | `db.query(query, params, { parsers, paramTypes })`; `paramTypes[i]` = `typesByName` OID, else the forced param's OID, else 0 | OID | `PgLiteQueryRunner.ts:63-86,99-102` |
| `BunSqlPostgresQueryRunner` | `postgreSqlCast` | `sql.unsafe(query, params)` | cast text | `BunSqlPostgresQueryRunner.ts:31-34`; `AbstractBunSqlQueryRunner.ts:57-68` |
| `MySql2QueryRunner`, `MySql2PoolQueryRunner` | `mySql` | `connection.query({ ...queryOptions, sql }, params, cb)` | — | `MySql2QueryRunner.ts:54-92,135-138` |
| `MariaDBQueryRunner`, `MariaDBPoolQueryRunner` | `mySql` | `connection.query({ ...mariaDBQueryOptions, sql }, params)` | — | `MariaDBQueryRunner.ts:82-96,115-118` |
| `BunSqlMySqlQueryRunner` | `mySql` | `sql.unsafe(query, params)` | — | `BunSqlMySqlQueryRunner.ts:32-54` |
| `MssqlPoolQueryRunner`, `MssqlPoolPromiseQueryRunner` | `sqlServer` | `request.input('<i>', type, params[i])` for each param, then `request.query(query)`. Type: `typesByName` (a factory or a type with arguments) → by category (`predefinedTypes`) → by type name → a custom type infers from the value (`inferCustomType`: a string is `NVarChar`) → a param without metadata infers from the value (`inferType`) | `ISqlTypeFactory` / `ISqlType` | `MssqlPoolQueryRunner.ts:78-106,260-263,290-413` |
| `OracleDBQueryRunner`, `OracleDBPoolQueryRunner`, `OracleDBPoolPromiseQueryRunner` | `oracle` | `connection.execute(query, binds, options)`, binds by name `{ '0': …, '1': … }`: `typesByName` → `{ val, type }`; a temporal `Date` → `{ val, type: DB_TYPE_TIMESTAMP_TZ }`; a null of a number/temporal category → `{ val: null, type }`; else the value. RETURNING OUT binds (`addOutParam`, `{ dir: BIND_OUT, as }`) get `DB_TYPE_TIMESTAMP_TZ` when temporal, the declared type, or none (a number comes back as text) | `DbType`, also for OUT binds | `OracleDBQueryRunner.ts:105-174,240-249`; `test/runners/oracle/OracleDBOutBinds.test.ts` |
| `BetterSqlite3QueryRunner` | `sqliteNumbered` | `prepare(query).all/run({ 1: p0, 2: p1, … })` | — | `BetterSqlite3QueryRunner.ts:55,67,82,109-115` |
| `BunSqliteQueryRunner` | `sqliteNumbered` | `prepare(query).all/run(...params)` | — | `BunSqliteQueryRunner.ts:57,69,84` |
| `NodeSqliteQueryRunner` | `sqliteNumbered` | `prepare(query).all/run(...params)` | — | `NodeSqliteQueryRunner.ts:55,67,83` |
| `BunSqlSqliteQueryRunner` | `bunSqlSqlite` | `sql.unsafe(query, params)` | — | `BunSqlSqliteQueryRunner.ts:49-52` |
| `Sqlite3WasmOO1QueryRunner` | `sqliteWasm` | `selectObjects(query, params)` / `exec({ sql, bind: params })` | — | `Sqlite3WasmOO1QueryRunner.ts:49-89` |
| `MockQueryRunner` | the named runner's, or the database's | the user's executor gets the SQL and params the real runner would build | cast text (`typesByName`, pg/Bun SQL only) | `MockQueryRunner.ts:16-31,90-111,530-532` |

Wrappers (`ChainedQueryRunner` and its subclasses) delegate `addParam` to the wrapped runner
(`ChainedQueryRunner.ts:121-123`).

### 2.5 Checks when the runner is created (`INVALID_CONFIGURATION`)

Read only from the driver object the runner holds or the environment; thrown in the constructor. "Process in UTC" is
`isProcessInUtc()`: `process.env.TZ` when set, else `Intl.DateTimeFormat().resolvedOptions().timeZone`, matched against
a fixed list of UTC names (`UTC`, `UTC0`, `Etc/UTC`, `UCT`, `GMT`, `GMT0`, `GMT±0`, `Etc/GMT…`, `Universal`, `Zulu`,
`Greenwich`, …, case-insensitive, a leading `:` ignored); never the current offset (`utils/processTimeZone.ts:7-30`).

| Runner | `name` | Rejected when | Source / test |
|---|---|---|---|
| `PgQueryRunner`, `PgPoolQueryRunner` | `binary` | `client.binary === true` or `pool.options.binary === true`. A pool client in binary mode (`pg.defaults.binary`) is rejected per query and released | `utils/pgConfiguration.ts:7-12`; `PgQueryRunner.ts:33`; `PgPoolQueryRunner.ts:26,47-57`; `test/runners/postgres/DriverConfiguration.test.ts` (`pg-in-binary-mode-is-rejected`) |
| `PostgresQueryRunner` | `transform` | `sql.options.transform.column.from`, `.value.from` or `.row.from` is set | `PostgresQueryRunner.ts:291-299`; same test file (`a-postgres-js-transform-of-the-results-is-rejected`) |
| `PostgresQueryRunner` | `infer` | `sql.options.infer === true` and the process isn't in UTC | `PostgresQueryRunner.ts:300-302` |
| `BunSql*QueryRunner` | `transform` | `sql.options.transform.column.from` is set (`SQL.camel`, `SQL.toCamel`, …) | `AbstractBunSqlQueryRunner.ts:23-26`; `test/runners/general/BunSqlConfiguration.test.ts` |
| `BunSqlPostgresQueryRunner` | `adapter` | adapter neither unset nor `'postgres'` | `BunSqlPostgresQueryRunner.ts:26-29` |
| `BunSqlMySqlQueryRunner` | `adapter`, `foundRows` | adapter not `'mysql'`/`'mariadb'`; `foundRows !== true` | `BunSqlMySqlQueryRunner.ts:15-24` |
| `BunSqlSqliteQueryRunner` | `adapter` | adapter not `'sqlite'` | `BunSqlSqliteQueryRunner.ts:13-16` |
| `MssqlPoolQueryRunner` (and the per-pool runner `MssqlPoolPromiseQueryRunner` creates, so it rejects its first query) | `useUTC` | `pool.config.options.useUTC === false` and the process isn't in UTC (a `Transaction` gives its pool's config) | `MssqlPoolQueryRunner.ts:42-46`; `MssqlPoolPromiseQueryRunner.ts:49` |
| `MssqlPoolQueryRunner` | `camelCaseColumns`, `columnNameReplacer` | `camelCaseColumns === true` or a `columnNameReplacer` in `pool.config.options` | `MssqlPoolQueryRunner.ts:47-52`; `test/runners/sqlserver/DriverConfiguration.test.ts` (`a-pool-that-renames-the-columns-is-rejected`) |
| `OracleDB*QueryRunner` | `ORA_SDTZ` | the process isn't in UTC and `process.env.ORA_SDTZ` is neither a UTC name nor `±00:00`/`0:00` | `utils/processTimeZone.ts:38-48`; `OracleDBQueryRunner.ts:32`; `OracleDBPoolQueryRunner.ts:25`; `OracleDBPoolPromiseQueryRunner.ts:25`; `test/runners/oracle/LocalTemporalValuesInAnyZone.test.ts` |
| mysql2, mariadb, PGlite, better-sqlite3, bun:sqlite, node:sqlite, sqlite-wasm | — | nothing | — |

Other `INVALID_CONFIGURATION`: `registerSqliteFunctions` on a Node without `function`/`aggregate`
(`NodeSqliteQueryRunner.ts:147`); an unknown `SqliteDateTimeFormat` (`SqliteConnection.ts`, `default:` arms).

## 3. Reading

### 3.1 Per runner: what it sets per query, and what it delivers

| Runner | Per query / statement | Delivers | Source / test |
|---|---|---|---|
| `PgQueryRunner`, `PgPoolQueryRunner` | `types: { getTypeParser }` built once per client: OID 1082 (`date`) and 1114 (`timestamp`) in text format → `parseUtcDateTimeTextOrKeepIt` (a Date whose UTC getters are the digits; `infinity` stays text); every other OID → `client.getTypeParser(oid, format)` (the user's parsers apply) | `date`/`timestamp` as UTC Date; the rest as the client parses it (pg defaults [inferred]: `int8`, `numeric`, `time` as text; `timestamptz` an instant Date; `int4`, `float8` numbers; `bool` boolean) | `PgQueryRunner.ts:28-35,58-63,108-116`; `test/runners/postgres/DriverConfiguration.test.ts` (`a-date-and-a-timestamp-are-read-as-utc-and-the-other-parsers-of-the-client-apply`, `the-types-of-the-pool-apply-to-the-other-types`) |
| `PostgresQueryRunner` | nothing for reading | postgres.js defaults; `date`/`timestamp` read with UTC components [design] | `PostgresQueryRunner.ts:100-121` |
| `PgLiteQueryRunner` | `parsers` merged over the database's: 1082 and 1114 → `parseUtcDateTimeTextOrKeepIt`, 1083 → its text | those three as above; any other OID with PGlite's or the user's parser | `PgLiteQueryRunner.ts:63-86,132-137`; `test/runners/postgres/DriverConfiguration.test.ts` (`a-date-a-time-and-a-timestamp-are-read-as-the-library-reads-them-and-the-other-parsers-apply`) |
| `BunSqlPostgresQueryRunner`, `BunSqlMySqlQueryRunner`, `BunSqlSqliteQueryRunner` | nothing | Bun SQL defaults; dates UTC [design] | `AbstractBunSqlQueryRunner.ts:57-68` |
| `MySql2QueryRunner`, `MySql2PoolQueryRunner` | `dateStrings: true`, `supportBigNumbers: true`, `bigNumberStrings: true`, `rowsAsArray: false`; and `typeCast` (DECIMAL/NEWDECIMAL → `field.string('ascii')`, else `next()`) only when the connection has a `typeCast` function or `decimalNumbers: true` | DATE/DATETIME/TIMESTAMP/TIME as text; BIGINT and DECIMAL as exact text; objects | `MySql2QueryRunner.ts:158-191`; `test/runners/mysql/DriverConfiguration.test.ts` |
| `MariaDBQueryRunner`, `MariaDBPoolQueryRunner` | `dateStrings: true`, `supportBigNumbers: false`, `bigIntAsNumber: false`, `decimalAsNumber: false`, `insertIdAsNumber: false`, `rowsAsArray: false`, `metaAsArray: false`, `nestTables: false`, `typeCast: undefined` (each replaces the connection's) | dates as text; BIGINT and insert id as `bigint`; DECIMAL as text; objects | `MariaDBQueryRunner.ts:10-34,82-96`; `test/runners/mariadb/DriverConfiguration.test.ts` |
| `MssqlPoolQueryRunner`, `MssqlPoolPromiseQueryRunner` | `request.arrayRowMode = false` | tedious defaults [inferred]: BIGINT as text, DECIMAL as a number (the SQL builder converts decimal result columns to `nvarchar(41)`, `SqlServerSqlBuilder.ts:52-57`), dates per `useUTC` | `MssqlPoolQueryRunner.ts:282-288`; `test/runners/sqlserver/DriverConfiguration.test.ts` (`the-rows-are-objects-with-array-row-mode-on-the-pool`) |
| `OracleDB*QueryRunner` | `outFormat: OUT_FORMAT_OBJECT`, `maxRows: 0`, `fetchTypeHandler` answering every column: a result column of category stringDecimal/customDecimal/bigint/customBigint (by name, or the only column of an unnamed one-value result) → `DB_TYPE_VARCHAR`; `DATE`/`TIMESTAMP` → converter rebuilding the Date with its local getters as UTC (`utcDateOfLocalGetters`); CLOB/NCLOB → string; BLOB → Buffer; else its own type | decimals/bigints as text; DATE/TIMESTAMP as UTC Date (exact except a wall clock skipped by DST in the process zone, and years < 100 built as 19xx); NUMBER as number; RETURNING OUT binds as in §2.4 | `OracleDBQueryRunner.ts:56-104,332-363` |
| `BetterSqlite3QueryRunner`, `BunSqliteQueryRunner`, `NodeSqliteQueryRunner` | nothing (`safeIntegers` / `readBigInts` not forced) | numbers, or `bigint` with the driver's big-integer mode; text; dates as stored per format | `…QueryRunner.ts` lines of §2.4 |
| `Sqlite3WasmOO1QueryRunner` | `selectObjects` | objects; numbers, `bigint` when unsafe and `bigIntEnabled` [design] | `Sqlite3WasmOO1QueryRunner.ts:49-56` |
| `MockQueryRunner` | — | whatever the user's executor returns; the reading tolerance of §3.3 applies to it | `MockQueryRunner.ts` |

The id of an inserted row (no `returning`): mysql2 `insertId`, mariadb `insertId` (a bigint), Bun SQL
`lastInsertRowid`, better-sqlite3/bun:sqlite/node:sqlite `lastInsertRowid`; `null` when no row was inserted
(`MySql2QueryRunner.ts:76-92`, `MariaDBQueryRunner.ts:88-96`, `BunSqlMySqlQueryRunner.ts:38-47`,
`BunSqlSqliteQueryRunner.ts:38-48`, `BetterSqlite3QueryRunner.ts:82-86`, `NodeSqliteQueryRunner.ts:83-87`). It goes
through `transformValueFromDB` of the id column like any value.

### 3.2 Per data type: what may arrive

What the runners of each database deliver for a value of the data type, all accepted by §3.3. Driver defaults not set
by our code are [inferred].

| Data type | PostgreSQL | MySQL / MariaDB | SQL Server | Oracle | SQLite |
|---|---|---|---|---|---|
| boolean | boolean | number 0/1 [inferred] | boolean [inferred] | number; text `"1"` from an OUT bind | number 0/1, bigint |
| int | number; text (int8, count) | number; text (mysql2 BIGINT); bigint (mariadb BIGINT) | number; text (BIGINT) [inferred] | number; text from an OUT bind | number, bigint |
| bigint | text (int8) | text (mysql2); bigint (mariadb) | text [inferred] | text (fetched as VARCHAR) | number, bigint |
| double | number; text (numeric) | number; text (DECIMAL) | number | number | number |
| stringDecimal, customDecimal | text | text | text (`convert(nvarchar(41))`) | text, possibly `.5` / `-.5` | text per `decimalStrategy` |
| string, uuid | text | text | text | text | text |
| localDate | Date (UTC parse of `date`) | text `YYYY-MM-DD` | Date | Date (UTC converter) | per format |
| localTime | text `HH:MM:SS[.ffffff]` | text `HH:MM:SS[.ffffff]` | Date | Date | per format |
| localDateTime | Date (`timestamp` UTC, `timestamptz` instant) | text `YYYY-MM-DD HH:MM:SS[.ffffff]` | Date | Date; TSTZ instant | per format |
| aggregatedArray | text (`::text`) | text | text | text | text |

Inside an aggregated array every leaf is a JSON string or the source text of a JSON number (§1); temporal leaves are
text like `2024-01-15T00:00:00` (Oracle DATE, `AbstractConnection.ts:1318`) or `2024-01-14T09:15:30.1230000`
(`utils/utcDateTimeText.ts:23`).

### 3.3 What `transformValueFromDB` accepts

Common (`connections/AbstractConnection.ts:1158-1166`): `undefined` and `null` → `null`; `''` → `null` unless
`allowEmptyString`. Rejections are `INVALID_VALUE_RECEIVED_FROM_DATABASE`; a value that already lost digits is
`PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE`. Tests: `marshalling.transform-validation.test.ts`
(`from-db-validation/*`), `select.string-decimal.test.ts`, `select.custom-decimal.test.ts` in each cell.

| Conversion type | Accepts → result | `PRECISION_LOST` | Rejects | Source |
|---|---|---|---|---|
| `boolean` | boolean; number → `!!v`; bigint → `!!v`; text `^-?\d+$` → `!!(+v)` | — | other text, other types | `AbstractConnection.ts:1168-1188` |
| `int` | safe integer number; text `^-?\d+(\.0+)?$` → number; bigint → number | integer number not safe; text or bigint beyond the safe range | non-integer number, other text, other types | `:1189-1223` |
| `bigint` | safe integer number → bigint; text → `BigInt(text without a trailing .0+)`; bigint | integer number not safe | non-integer number, text `BigInt` refuses, other types | `:1224-1257` |
| `double` | number; text `^(-?(\d+(\.\d+)?\|\.\d+)([eE][-+]?\d+)?\|NaN\|-?Infinity)$` → `+v`; bigint → `Number(v)` | — | other text, other types | `:1258-1279` |
| `stringDecimal`, `customDecimal` | text `^-?(\d+(\.\d+)?\|\.\d+)$` (`.5` → `0.5`, `-.5` → `-0.5`); bigint → its text | any number | other text, other types | `:1280-1304` |
| `string`, `uuid` | text, unchanged | — | non-text | `:1305-1314` |
| `localDate` | valid Date or text parsed by `parseUtcDateTimeText` → a new Date at 10:00 UTC of the UTC day of the received one | — | anything else, invalid Date, unparsable text | `:1315-1333,1367-1375` |
| `localTime` | same inputs → a Date on 1970-01-01 with the UTC time of the received one | — | same | `:1334-1345` |
| `localDateTime` | same inputs → the received Date (the parsed one for text) | — | same | `:1346-1355` |
| `aggregatedArray` | — (handled by the query builder) | — | always | `:1356-1358` |
| other | as it is | — | — | `:1359-1360` |
| SQLite temporal | Date, text, number or bigint per `SqliteDateTimeFormat` and the `treatUnexpected*` options | — | other types, invalid result | `SqliteConnection.ts:142-403` |

The returned temporal Dates carry `___type___` (`'localDate'`, `'localTime'`, `'localDateTime'`), which
`MssqlPoolQueryRunner.inferType` reads when such a Date is sent back without metadata
(`MssqlPoolQueryRunner.ts:373-383`).

### 3.4 Temporal text: `parseUtcDateTimeText`

`utils/utcDateTimeText.ts:25,34-72`. The text is trimmed and matched, case-insensitively, against:

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
- `undefined` (→ rejected) when the text doesn't match, or month ∉ 1..12, day ∉ 1..31, hours > 24, minutes > 59,
  seconds > 60, or the Date is invalid.

Forms the runners deliver: `2024-01-14` (mysql2/mariadb `dateStrings`, PGlite/pg `date`), `09:15:30.123456` (PG and
MySQL `time`), `2024-01-14 09:15:30.123456` (MySQL DATETIME, PG `timestamp`), `2024-01-14 09:15:30+09`, `…+05:30`,
`…+00:14:44` (PostgreSQL offsets), `0044-03-15 BC` (PostgreSQL), `2024-01-14T09:15:30.1230000` and `…Z` (JSON
aggregates) — the examples listed at `utils/utcDateTimeText.ts:22-24`.

`parseUtcDateTimeTextOrKeepIt` (`:79-81`) is the variant a driver parser uses: an unparsable text (`infinity`) is
returned as text, and then rejected by `transformValueFromDB`.

## 4. The hidden params metadata

Non-enumerable properties on the params array (`utils/queryParamsMetadata.ts`): they travel with the params and are
never sent or serialised. A runner reads them through the public functions of `queryRunners/QueryRunner.ts`; all are
optional extra information, so a runner must still work with params built by hand (no metadata: `undefined`).

| Property | Written by | Public reader | What it is for |
|---|---|---|---|
| `$paramTypes`, `$paramTypeCategories`, `$paramForceTypeCasts` | the binding, through `setParamTypeAt` (`queryParamsMetadata.ts:103-122`); `setQueryParamType` (`QueryRunner.ts:121-123`) for a runner of its own, also for OUT params | `getQueryParamType`, `getQueryParamTypeCategory`, `getQueryParamForceTypeCast` (`QueryRunner.ts:125-141`) | the type of each param at execution: OIDs (postgres.js, PGlite), mssql types, Oracle bind types, `typesByName` lookups. A param added without them leaves a hole |
| `$paramValuesForColumn` | the SQL builder before `addParam`, inside an insert's values or an update's set (`AbstractSqlBuilder.ts:677-679`; `queryParamsMetadata.ts:141-148`) | `isQueryParamValueForColumn` (`QueryRunner.ts:147-150`) | the column gives the type: no decimal cast on MySQL/MariaDB and SQL Server (`mySqlParamTypes.ts:26-28`, `sqlServerParamTypes.ts:24-26`) |
| `$resultColumns` | `__setQueryMetadata` (`queryBuilders/AbstractQueryBuilder.ts:559-566`), from `__resultColumnsOf` / `__unnamedResultColumn` (`:533-554`) | `getQueryResultColumns`, `getQueryResultColumn` (`QueryRunner.ts:226-234`) | the expected type of each result column (`name` = key in the row, `path`, `type`, `typeCategory`; `''` for an aggregated array): Oracle fetches decimals and bigints as text (`OracleDBQueryRunner.ts:79-104`). `[]` when the query returns no columns, `undefined` for a query the library didn't build |
| `$connectionConfiguration` | `__setQueryMetadata` | `getQueryConnectionConfiguration` (`QueryRunner.ts:239-242`) | the connection's settings (`ConnectionConfiguration`, `QueryRunner.ts:156-208`: `allowEmptyString`, `compatibilityVersion`, `uuidStrategy`, `decimalStrategy`, SQLite date formats, …), read live from the connection |
| `$source`, `$metadata` | `__setQueryMetadata` | `getQueryExecutionSource`, `getQueryExecutionStack`, `getFunctionExecutingQuery`, `getQueryExecutionName`, `getQueryExecutionMetadata` (`QueryRunner.ts:243-301`) | logging and errors |
| `$isSelectPageCountQuery` | `executeSelectPage` | `isSelectPageCountQuery` (`QueryRunner.ts:303-305`) | tells the count query apart |
| `_containsInsertReturningClause`, `_containsMutationReturningClause`, `_forcedAffectedRowCount` | SQL builder | internal (`AbstractQueryRunner.containsInsertReturningClause`, `executeMutationReturning`, `getForcedAffectedRowCount`) | whether to read rows or the insert id; Oracle's multi-row insert count |

## 5. User's responsibility vs the runner's

| Concern | Runner (enforced) | User (documented, not readable without a query) |
|---|---|---|
| Rows as objects keyed by alias | mysql2/mariadb `rowsAsArray: false` (+ mariadb `metaAsArray`, `nestTables`), mssql `arrayRowMode = false`, Oracle `OUT_FORMAT_OBJECT`; rejects renaming transforms (postgres.js, Bun SQL, tedious) | — |
| Date/time digits in UTC, any process zone | pg/PGlite parsers, mysql2/mariadb `dateStrings`, Oracle converter + TSTZ binds, text from UTC getters; rejects `useUTC: false`, `infer: true`, `ORA_SDTZ` outside UTC when the process isn't in UTC | the data is stored as UTC digits; a MySQL/MariaDB `TIMESTAMP` needs the session `time_zone` in UTC; on Oracle, a session zone changed with `ALTER SESSION` or a connection opened before `ORA_SDTZ` is set isn't seen (`docs/configuration/query-runners/recommended/{mysql2,mariadb,oracledb}.md`, "Connection requirements") |
| The Date the user passes | sends its UTC getters | builds a `localDate`/`localTime`/`localDateTime` whose UTC getters are the intended digits |
| Exact big integers and decimals | mysql2/mariadb per-query options, Oracle fetch as text, SQL Server `convert`, PG `::text` for JSON, lossless JSON parse | not registering pg/PGlite parsers that change a type the library reads (`numeric`, `int8`, `text`…; `docs/configuration/query-runners/recommended/pg.md`); for SQLite, the driver's big-integer mode if an integer may pass 2^53 (else `PRECISION_LOST` or a driver error) |
| Whole result | Oracle `maxRows: 0` | mssql `textsize` not below the default [design; not checked] |
| SQLite dates | — | every stored value in the configured `SqliteDateTimeFormat` |
| `typesByName` | applies it | that the declared type fits the values |

## 6. Adding or changing a query runner — checklist

1. `addParam` delegates to a binding in `utils/queryRunnerParams.ts`; add the runner to `QueryRunnerName`,
   `queryRunnerParamBindings` and `queryRunnerDatabases` so `MockQueryRunner` imitates it. A rule shared by the
   database goes into its `utils/<db>ParamTypes.ts`, not into the runner.
2. Accept the forms of §2.1, and anything for adapted/custom values: convert only what you recognise (a valid Date, a
   plain decimal text), send the rest as it is.
3. Type the parameter from the metadata (§4), never from the SQL text; fall back to inferring from the value only
   when there is no metadata.
4. Per query, set every driver option that makes it deliver rows as objects keyed by alias, temporal values with UTC
   digits (or as text), big integers and decimals exactly; override what the user may have configured on the
   connection, where the driver allows it per query.
5. What can't be set per query and can be read from the object you hold: validate it in the constructor with
   `INVALID_CONFIGURATION` (`name` = the option). What can't be read: document it in the runner's page under
   "Connection requirements". Never run a query to check.
6. A lossy delivery that is detected (an unsafe number for an integer, a number for a decimal) is acceptable:
   `transformValueFromDB` rejects it. An undetectable one (a Date built in the process zone, a cut text, a renamed
   key, a lost row) is not.
7. Tests in `test/runners/<db>/` against the real engine, including `LocalTemporalValuesInAnyZone` (spawned processes
   in UTC, Madrid, New York, Tokyo: `test/runners/lib/localTemporalValues.ts:10`) and `DriverConfiguration`.

## 7. Open points (code that doesn't fully match this contract)

1. `bigint` from text uses `BigInt()` (`AbstractConnection.ts:1248-1252`), which also accepts `0x1f`, `0b1`, `0o7`,
   surrounding blanks, and `''` (→ `0n` when `allowEmptyString`); the `int` arm uses a strict regex (`:1207`).
2. `double` from a bigint is `Number(value)` with no precision check (`AbstractConnection.ts:1276-1278`): a bigint
   past 2^53 is rounded silently, where `int` rejects it (`:1216-1221`).
3. `parseUtcDateTimeText` checks day ≤ 31, hours ≤ 24, seconds ≤ 60 but not the real calendar
   (`utils/utcDateTimeText.ts:59-65`): `2024-02-30` rolls over to March 1 and `24:00` to the next day instead of
   being rejected, although its comment says out-of-range digits give `undefined`.
4. `NodeSqliteQueryRunner` doesn't call `setReturnArrays(false)` (`NodeSqliteQueryRunner.ts:55`): a `DatabaseSync`
   opened with `returnArrays: true` (Node ≥ 24.4) would give arrays, and the library reads `row[alias]` [inferred].
5. mysql2: a connection with `typeCast: false` is not neutralised — the per-query `typeCast` is set only for a
   function or `decimalNumbers` (`MySql2QueryRunner.ts:178-183`) [inferred: mysql2 then returns raw values].
6. Bun SQL checks `transform.column.from` only (`AbstractBunSqlQueryRunner.ts:23`); the test covers `SQL.camel`,
   `SQL.toCamel` and `{ column: { from } }`, not `{ column: fn }`, which Bun's types describe as "a function means
   `from`" (`node_modules/bun-types/sql.d.ts:334`) [inferred: whether Bun normalises it into `options`].
7. SQLite, inside its own strategies: a `localDate` received as a `Date` is read with the local getters
   (`SqliteConnection.ts:157-158`), where `localTime`/`localDateTime` keep the Date (`:242-243`, `:339-340`) and the
   base reads the UTC getters; a `localDate` is sent with the local getters for every format, the `UTC …` ones
   included (`SqliteConnection.ts:426-433`). The same `Date` gives another day on SQLite than on the other databases
   in a process outside UTC.
8. PGlite overrides only 1082/1083/1114 (`PgLiteQueryRunner.ts:132-136`); a user parser on `numeric`, `int8` or `text`
   applies to the library's queries (documented in `pglite.md`; the design wanted the defaults restored per query).
9. `localTime` is sent as `HH:MM:SS` without `.000` by the connection (`AbstractConnection.ts:1458`) but as
   `HH:MM:SS.mmm` by the binding modules for a Date (`utcDateTimeText.ts:18-20`) — the latter is reached only from an
   adapter that returns a Date. Harmless [inferred].
10. SQL Server sends a `localTime` Date unchanged (`SqlServerConnection.ts:128-134`), Oracle normalises it to
    1970-01-01 (`OracleConnection.ts:154-163`). Harmless for `TIME` [inferred].
11. Oracle RETURNING OUT binds of a text column get no type or `maxSize` (`OracleDBQueryRunner.ts:142-146`)
    [inferred: oracledb's default OUT size may fail for a long text].
12. `int` and `double` send any integer / any number (`AbstractConnection.ts:1393-1410`): an unsafe integer or `NaN`
    reaches the driver; only sqlite-wasm guards the integers beyond 64 bits (`queryRunnerParams.ts:44-46`).
13. Without a named runner, `MockQueryRunner` on `sqlite` uses `bunSqlSqlite` (booleans as booleans,
    `queryRunnerParams.ts:139-140`), unlike four of the five SQLite runners.
