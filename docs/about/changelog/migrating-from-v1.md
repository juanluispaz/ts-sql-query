---
search:
  boost: 0.13
---
# Migrating from v1

This page lists what to change in an application that runs on `ts-sql-query` v1. Work through it in this order:

1. Update to v1.69.0, the last version of v1, and fix its deprecation warnings. Much of what stops compiling in v2 is deprecated there, some of it for years: since v1.24.0 (21 Dec 2021) the comparisons with a value that can be `null` or `undefined`, since v1.60.0 (25 Feb 2024) the connections with the types of `ts-extended-types`, since v1.61.0 (2 Mar 2024) composing and splitting results. Each section below says since which version of v1 a thing is deprecated; what doesn't say it was never deprecated, and is new in v2.
2. [Update the packaging and the imports](#packaging-and-imports).
3. [Fix what stops compiling](#what-stops-compiling): the compiler points at each place.
4. [Review what changes silently at runtime](#what-changes-silently-at-runtime): this is the dangerous part, nothing warns you about it. Start by setting [the version of your database](#set-the-version-of-your-database).
5. [Update your snapshots and log searches](#what-only-changes-the-sql-text): the SQL text changes in many places.

## Packaging and imports

- **ESM only.** The CommonJS build is gone. Move your application to ESM, or load the library with a dynamic `import()`.
- **Node.js 22 or newer** (or [Bun](../../index.md)).
- **TypeScript**: `moduleResolution` must be `"node16"`, `"nodenext"` or `"bundler"`, because of the `exports` map.
- **The paths of v1 keep working, and say where each name is now.** The connections, the query runners, `Connection`, `Table`, `View`, `TypeAdapter`, `Values`, `dynamicCondition`, `extras/types`, `extras/utils` and `extras/IDEncrypter` are imported from the same paths as in v1, and so are the filter types of a dynamic condition, from `ts-sql-query/expressions/dynamicConditionUsingFilters`, and `PromiseProvider`, from `ts-sql-query/utils/PromiseProvider`. Each name they export is marked deprecated, and your editor shows the path to import it from in v2:

    | v1 path | v2 path |
    |---|---|
    | `ts-sql-query/Connection`, `Table`, `View`, `TypeAdapter`, `Values`, `dynamicCondition`, `extras/types`, `extras/utils`, `expressions/dynamicConditionUsingFilters`, `utils/PromiseProvider` | `ts-sql-query` |
    | `ts-sql-query/connections/PostgreSqlConnection`, `MySqlConnection`, ... | `ts-sql-query/postgresql`, `ts-sql-query/mysql`, ...: the path of the database |
    | `ts-sql-query/connections/SqliteConfiguration` | `ts-sql-query/sqlite` |
    | `ts-sql-query/queryRunners/PgPoolQueryRunner`, `MySql2QueryRunner`, ... | `ts-sql-query/postgresql/pg`, `ts-sql-query/mysql/mysql2` (or `ts-sql-query/mariadb/mysql2` for MariaDB), ...: the path of the database and the driver |
    | `ts-sql-query/queryRunners/MockQueryRunner`, `NoopQueryRunner`, `ConsoleLogQueryRunner`, `ConsoleLogNoopQueryRunner`, `InterceptorQueryRunner`, `LoggingQueryRunner`, `QueryRunner` | `ts-sql-query` |
    | `ts-sql-query/extras/IDEncrypter` | `ts-sql-query/IDEncrypter` |

    The paths of v1 will be removed in the next major version. See [the paths of v2](../../index.md#install) for the full list.

- **What v1 didn't publish can't be imported.** Anything outside the `exports` map fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`:

    | v1 import | v2 |
    |---|---|
    | `ts-sql-query/connections/AbstractConnection`, `AbstractAdvancedConnection`, `Abstract<database>Connection` (this one deprecated since v1.69.0) | Extend the connection of your database, like `PostgreSqlConnection` |
    | `ts-sql-query/connections/NoopDBConnection` | `ts-sql-query/__UNSUPPORTED__/connections/NoopDBConnection` |
    | `ts-sql-query/queryRunners/AbstractQueryRunner`, `AbstractPoolQueryRunner`, `ChainedQueryRunner`, `SqlTransactionQueryRunner`, `ManagedTransactionQueryRunner`, `ManagedTransactionPoolQueryRunner` | `ts-sql-query/__UNSUPPORTED__/queryRunners/...` |
    | `ts-sql-query/expressions/*` (but `expressions/dynamicConditionUsingFilters`), `utils/*` (but `utils/PromiseProvider`), `internal/*`, `queryBuilders/*`, `sqlBuilders/*` | `ts-sql-query/__UNSUPPORTED__/expressions/*`, ... |
    | `ts-sql-query/typeMarks/*`, `ts-sql-query/databases` | Removed |
    | `ts-sql-query/queryRunners/PromiseBasedQueryRunner`, `PromiseBasedWithSqlTransactionQueryRunner`, `PromiseBasedPoolQueryRunner`, `PromiseBasedAbstractQueryRunner`, `OracleUtils` (deprecated since v1.69.0) | Removed. Extend `ManagedTransactionQueryRunner`, `SqlTransactionQueryRunner`, `ManagedTransactionPoolQueryRunner` or `AbstractQueryRunner`, from `__UNSUPPORTED__`; see [your own query runner](#your-own-query-runner-and-the-connection-of-the-driver) |

    `__UNSUPPORTED__` reaches the internals of the library, with no stability guarantee.

- **Dependencies.** `chained-error` and `ts-extended-types` are gone: remove any import of them from your code. The page of each query runner ([pg](../../configuration/query-runners/recommended/pg.md), for example) says which driver versions it is tested on, so check yours before updating.

## What stops compiling

The compiler finds all of these. This section is what to write instead.

### Renamed

Most of these names were already deprecated in v1, which kept them working and showed the new name in your editor; the last column says since which version. `smaller`, `larger`, `smallAs` and `largeAs` have been deprecated since v1.15.0, released on 3 Oct 2021.

| v1 | v2 | Deprecated in v1 since |
|---|---|---|
| `.smaller(...)`, `.smallerIfValue(...)` | `.lessThan(...)`, `.lessThanIfValue(...)` | v1.15.0, 3 Oct 2021 |
| `.larger(...)`, `.largerIfValue(...)` | `.greaterThan(...)`, `.greaterThanIfValue(...)` | v1.15.0, 3 Oct 2021 |
| `.smallAs(...)`, `.smallAsIfValue(...)` | `.lessOrEqual(...)`, `.lessOrEqualIfValue(...)` | v1.15.0, 3 Oct 2021 |
| `.largeAs(...)`, `.largeAsIfValue(...)` | `.greaterOrEqual(...)`, `.greaterOrEqualIfValue(...)` | v1.15.0, 3 Oct 2021 |
| `.lessOrEquals(...)`, `.lessOrEqualsIfValue(...)` | `.lessOrEqual(...)`, `.lessOrEqualIfValue(...)` | v1.68.0, 14 Jun 2026, for a typo in the name |
| `.greaterOrEquals(...)`, `.greaterOrEqualsIfValue(...)` | `.greaterOrEqual(...)`, `.greaterOrEqualIfValue(...)` | v1.68.0, 14 Jun 2026, for a typo in the name |
| `.substract(...)` | `.subtract(...)` | v1.68.0, 14 Jun 2026, for a typo in the name |
| `.mod(...)` | `.modulo(...)` | v1.15.0, 3 Oct 2021 |
| `.lower()`, `.upper()` | `.toLowerCase()`, `.toUpperCase()` | v1.15.0, 3 Oct 2021 |
| `.ltrim()`, `.rtrim()` | `.trimLeft()`, `.trimRight()` | v1.15.0, 3 Oct 2021 |
| `.replace(...)`, `.replaceIfValue(...)` | `.replaceAll(...)`, `.replaceAllIfValue(...)` | v1.22.0, 24 Oct 2021 |
| `mergeType(...)` | `connection.dynamicBooleanExpressionUsing(...)` | v1.61.0, 2 Mar 2024 |
| `PickValuesPathWitAllProperties`, `PickValuesPathWitAllPropertiesProjectedAsNullable` | `PickValuesPathWithAllProperties`, `PickValuesPathWithAllPropertiesProjectedAsNullable` | v1.69.0, the last version of v1, for a typo in the name |
| `QueryExecutor` from `MockQueryRunner` | `MockQueryExecutor`, from `ts-sql-query` | v1.69.0, the last version of v1 |
| `queryRunner.getCurrentNativeTransaction()` | `queryRunner.getCurrentNativeConnection()`, which returns the connection of the transaction on every query runner. In v1 it returned the transaction only with `mssql` and postgres.js (and `PrismaQueryRunner`, `AnyDBQueryRunner`, `LoopBackQueryRunner`); with `pg`, `mysql2`, `mariadb`, `oracledb` and the SQLite drivers it returned `undefined` | Not deprecated |
| `QueryType` from `MockQueryRunner`, `InterceptorQueryRunner` or `LoggingQueryRunner` | `QueryType` from `ts-sql-query` | Not deprecated; v1.69.0 also exports it from `ts-sql-query/queryRunners/QueryRunner` |

The renamed types (`PickValuesPathWit...`, `QueryExecutor`, `QueryType` from a query runner) keep compiling when you import them from their path of v1, marked deprecated, until you rename them; so do `TyeSafeConnection`, `TyeUnsafeConnection` and `TypeSafeDynamicCondition`, below.

The rules of a [dynamic condition](../../dynamic/helper-types/conditions.md) were renamed in the same way: see [the rules of a dynamic condition](#the-rules-of-a-dynamic-condition).

### The rules of a dynamic condition

The rules of a [dynamic condition](../../dynamic/helper-types/conditions.md) were renamed in the same way. A filter written in your code with an old name doesn't compile: write the new one. A filter that comes from a request or another system, which has no type, keeps working: `withValues` applies an old name as its new one, so the systems that send them don't have to change at the same time as your application.

| v1 rule | v2 rule | Deprecated in v1 since |
|---|---|---|
| `smaller`, `smallerIfValue` | `lessThan`, `lessThanIfValue` | v1.15.0, 3 Oct 2021 |
| `larger`, `largerIfValue` | `greaterThan`, `greaterThanIfValue` | v1.15.0, 3 Oct 2021 |
| `smallAs`, `smallAsIfValue` | `lessOrEqual`, `lessOrEqualIfValue` | v1.15.0, 3 Oct 2021 |
| `largeAs`, `largeAsIfValue` | `greaterOrEqual`, `greaterOrEqualIfValue` | v1.15.0, 3 Oct 2021 |
| `lessOrEquals`, `lessOrEqualsIfValue` | `lessOrEqual`, `lessOrEqualIfValue` | v1.69.0, the last version of v1, for a typo in the name |
| `greaterOrEquals`, `greaterOrEqualsIfValue` | `greaterOrEqual`, `greaterOrEqualIfValue` | v1.69.0, the last version of v1, for a typo in the name |

`smaller`, `larger`, `smallAs` and `largeAs` have been deprecated since 2021. `lessOrEquals` and `greaterOrEquals` are different: until v1.68.0 they were the only names of these rules in a dynamic condition, since `lessOrEqual` and `greaterOrEqual` only arrive there in v1.69.0, so a filter written for v1 is likely to use them.

### Removed connections and query runners

| v1 | v2 | Deprecated in v1 since |
|---|---|---|
| `TypeSafePostgreSqlConnection`, `TypeSafeMySqlConnection`, ... | The connection without the prefix, like `PostgreSqlConnection`. Values are plain `number`, `string` and `Date`, not the `int`, `double`, `uuid`, `LocalDate`, ... of `ts-extended-types` | v1.60.0, 25 Feb 2024 |
| `TyeSafeConnection`, `TyeUnsafeConnection` from `ts-sql-query/Connection`; `TypeSafeDynamicCondition` from `ts-sql-query/dynamicCondition` | `Connection`, `DynamicCondition`, from `ts-sql-query` | v1.69.0 |
| `AnyDBQueryRunner`, `AnyDBPoolQueryRunner`, `LoopBackQueryRunner` (their projects are no longer maintained) | The query runner of your driver | v1.54.0, 26 Jun 2023 |
| `MsNodeSqlV8QueryRunner`, `TediousQueryRunner`, `TediousPoolQueryRunner` | [`MssqlPoolQueryRunner`](../../configuration/query-runners/recommended/mssql.md) | v1.60.0, 25 Feb 2024 (`TediousPoolQueryRunner`, of `tedious-connection-pool`, since v1.54.0, 26 Jun 2023) |
| `MySqlQueryRunner`, `MySqlPoolQueryRunner` (the `mysql` driver is no longer maintained) | [`MySql2QueryRunner`, `MySql2PoolQueryRunner`](../../configuration/query-runners/recommended/mysql2.md) | v1.66.0, 14 Jun 2025 |
| `SqliteQueryRunner` (the `sqlite` package is no longer maintained) | [`BetterSqlite3QueryRunner`](../../configuration/query-runners/recommended/better-sqlite3.md), [`NodeSqliteQueryRunner`](../../configuration/query-runners/recommended/node_sqlite.md) | v1.66.0, 14 Jun 2025 |
| `Sqlite3QueryRunner` (the `sqlite3` driver, deprecated by its maintainers) | [`BetterSqlite3QueryRunner`](../../configuration/query-runners/recommended/better-sqlite3.md), [`NodeSqliteQueryRunner`](../../configuration/query-runners/recommended/node_sqlite.md), on Bun [`BunSqliteQueryRunner`](../../configuration/query-runners/recommended/bun_sqlite.md), or [`Sqlite3WasmOO1QueryRunner`](../../configuration/query-runners/recommended/sqlite-wasm-OO1.md) | v1.69.0 |
| `PrismaQueryRunner` | On PostgreSQL, the `pg` query runners, which can [share the pool and the transaction with Prisma](../../configuration/query-runners/combining-with-another-library.md#example-prisma). On other databases there is no replacement that shares them | v1.69.0; its short-running transactions since v1.60.0, 25 Feb 2024 |

### Removed features

| v1 | v2 | Deprecated in v1 since |
|---|---|---|
| `compose`, `composeDeletingInternalProperty`, `composeDeletingExternalProperty`, `withOne`, `withMany`, ... `split`, `splitOptional`, `splitRequired`, `guidedSplitOptional`, `guidedSplitRequired`, and `mapForGuidedSplit`, `prefixCapitalized`, `prefixDotted`, `prefixMapFor...` | [Complex projections](../../queries/complex-projections.md) or [aggregate as an object array](../../queries/aggregate-as-object-array.md) | v1.61.0, 2 Mar 2024; announced as legacy, to be removed, since v1.54.0, 26 Jun 2023 |
| Columns `'stringInt'`, `'stringDouble'`, `.asStringInt()`, `.asStringDouble()` | `'bigint'`, or [`'customInt'`, `'customDouble'`](../../configuration/column-types.md); `.asInt()`, `.asBigint()`, `.asDouble()` | v1.60.0, 25 Feb 2024 |

### Types that now reject what compiled

Of this section, v1 deprecated the comparisons with a value that can be `null` or `undefined` (since v1.24.0, 21 Dec 2021), the name of a constraint as a string (since v1.68.0), and, in v1.69.0, the custom type with one generic argument, the on conflict without a target on PostgreSQL and the queries each database rejects; the rest is new in v2.

**A JavaScript value that can be `null` or `undefined`.** The overloads of the column operations that accepted one are gone, because a comparison with `null` silently matches nothing. They have been deprecated since v1.24.0 (21 Dec 2021). Use the `IfValue` variant, or see [how to compare against a null value](../limitations.md#how-to-compare-against-a-null-or-undefined-value).

```typescriptreact
// v1
.where(tCustomer.birthday.equals(birthdayThatCanBeUndefined))
```

```ts
// v2
const birthdayThatCanBeUndefined = undefined as Date | undefined

const customers = await connection.selectFrom(tCustomer)
    .where(tCustomer.birthday.equalsIfValue(birthdayThatCanBeUndefined))
    .select({ id: tCustomer.id })
    .executeSelectMany()
```

**A custom type with only one generic argument.** It was deprecated in v1.69.0. The type name is the second generic argument, the same text as the type name you pass to the method. This applies to columns, constants, fragments, arguments, function results and sequences:

```typescriptreact
// v1
this.column<RgbColor>('ColumnName', 'custom', 'RgbColor')
// v2
this.column<RgbColor, 'RgbColor'>('ColumnName', 'custom', 'RgbColor')
```

**Aggregates, where SQL doesn't allow them:**

- An aggregate function in `where`, `and`, `or`, `groupBy` or the `on` of a join. It stays allowed in `select`, `having` and `orderBy`. A custom fragment that is an aggregate has its [own builders](../../queries/sql-fragments.md#aggregate-fragments), to get the same check.
- A select with an aggregate and a column of a table, without a group by. Group by the column, or take any value of the group with [`anyValue`](../../queries/aggregate-and-group-by.md#any-value-of-the-group) if it is the same in the whole group:

    ```ts
    const customersPerCompany = await connection.selectFrom(tCustomer)
        .select({
            companyId: tCustomer.companyId,
            customerCount: connection.count(tCustomer.id)
        })
        .groupByNonAggregatedColumns()
        .executeSelectMany()
    ```

    See [grouping by every non-aggregated column](../../queries/aggregate-and-group-by.md#grouping-by-every-non-aggregated-column).
- An aggregate of an aggregate (`connection.max(connection.count(tCustomer.id))`), except on Oracle. Aggregate over a subquery that aggregates.
- `groupBy('name')` with a column of the select that is an aggregate.

**Insert and on conflict:**

- `.onConflictOnConstraint(...)` only takes a raw fragment ([docs](../../queries/insert-on-conflict.md#a-conflict-on-a-named-constraint)). The name as a string or an expression didn't work, and it has been deprecated since v1.68.0 (14 Jun 2026):

    ```ts
    const inserted = await connection.insertInto(tCustomer)
        .set({ firstName: 'John', lastName: 'Smith', companyId: 1 })
        .onConflictOnConstraint(connection.rawFragment`customer_name_key`)
        .doNothing()
        .executeInsert()
    ```

- PostgreSQL: `.onConflictDoUpdateSet(...)`, `.onConflictDoUpdateSetIfValue(...)` and `.onConflictDoUpdateDynamicSet()` without a target are gone (deprecated in v1.69.0; PostgreSQL requires a target for `do update`). Use [`.onConflictOn(column).doUpdateSet(...)`](../../queries/insert-on-conflict.md#update-the-existing-row-upsert).
- `executeInsertOne()` is not offered on a multi-row insert with `onConflictDoNothing()`, since the conflict can skip every row.
- `insertInto(table).from(select)` with a column the table doesn't have.

**Result types:**

- `connection.average(...)` and `connection.averageDistinct(...)` always return `number`. Drop an annotation that says `bigint` or a custom type.
- Nested projections go up to [5 levels](../../queries/complex-projections.md), counting the object passed to `select`.

**Queries the database rejects, per database.** v1 compiled them and the database rejected them when they ran; v1.69.0 deprecates them on those databases:

| Database | No longer available | Use |
|---|---|---|
| Oracle, SQL Server | `recursiveUnion`, `recursiveUnionOn` | `recursiveUnionAll`, `recursiveUnionAllOn` |
| MySQL, Oracle, SQL Server | `aggregateAsArrayDistinct`, `aggregateAsArrayOfOneColumnDistinct` | |
| SQL Server | `stringConcatDistinct` | |
| SQLite | `stringConcatDistinct(value, separator)`; `connection.default()` | `stringConcatDistinct(value)`; omit the column |
| Oracle | `.orderingSiblingsOnly()` after the `.orderBy(...)` of a compound query | |

### Type adapters and the transforms of the connection

`transformValueFromDB`, `transformValueToDB` and `transformPlaceholder` receive the category of the type, the first argument of the column like `'customInt'`, after the name of the type, and a context: in a type adapter before `next`, in the connection at the end. A type adapter written for v1 doesn't compile, and neither does an override of the connection that calls `super`: add the parameters and pass them on to `next` or `super`. When your rule changes the type, pass the category of the new one:

In v1:

```typescriptreact
protected override transformValueToDB(value: unknown, type: string): unknown {
    if (type === 'MyIntTypeName') {
        return super.transformValueToDB(value, 'int');
    }
    return super.transformValueToDB(value, type);
}
```

In v2:

```ts
import type { TypeCategory } from "ts-sql-query"
class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    protected override transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, context: TypeAdapterValueToDBContext): unknown {
        if (type === 'MyIntTypeName') {
            return super.transformValueToDB(value, 'int', 'int', context);
        }
        return super.transformValueToDB(value, type, typeCategory, context);
    }
}
```

`transformPlaceholder` no longer receives `forceTypeCast`: it is `transformPlaceholder(placeholder, type, typeCategory, valueSentToDB, context)` in the connection, with the context and `next` at the end in a type adapter, and it receives the placeholder as the query runner wrote it, with the cast when there is one. To decide whether the database must receive the type of a parameter, set `context.forceTypeCast` in `transformValueToDB`; an override that cast every parameter on PostgreSQL is no longer needed, the library gives the type where PostgreSQL needs it (see [The type of a parameter](../../configuration/supported-databases/postgresql.md#the-type-of-a-parameter)).

A rule like this one, that only sends a `customInt` to `int`, is no longer needed: a custom type is converted as the type of its category (see [Custom types are converted as their category](#custom-types-are-converted-as-their-category)). `TypeCategory` is exported from `ts-sql-query`.

### Your own query runner, and the connection of the driver

- `queryRunner.execute(fn)` calls `fn` with one argument, the connection to run statements on: a function with two parameters doesn't compile. With postgres.js and mssql, `fn` received the pool or the client, and the transaction in that second argument ([docs](../../queries/transaction.md#using-the-drivers-connection-in-the-transaction)). `getCurrentNativeConnection()` returns the connection of the transaction, and `undefined` outside one.
- A class implementing `QueryRunner` has to add `createRejectedPromise`, `nestedTransactionsSupported`, `executeInTransactionCallsBeginAndCommit`, `getErrorReason` and `isSqlError`, and its `createResolvedPromise` must adopt a promise it receives. A class extending `AbstractQueryRunner` inherits them, but has to import it from `__UNSUPPORTED__`.
- `executeInTransaction(fn, ...)` no longer accepts a function returning an array, and `executeBeginTransaction`, `executeCommit`, `executeRollback` and `executeInTransaction` receive an optional `opts` at the end.
- To log or intercept queries, prefer [`InterceptorQueryRunner`](../../configuration/query-runners/general-purpose/InterceptorQueryRunner.md), which is public and needs no changes beyond the import of `QueryType`.
- `MockQueryRunner` no longer calls your function with `'isTransactionActive'`. A branch for that value doesn't compile: remove it.
- `addParam(params, value, type, typeCategory, forceTypeCast)` and `addOutParam(params, name, type, typeCategory, forceTypeCast)` receive the name of the type, its category and whether the database must receive the type of the parameter, and return the placeholder as it is written in the SQL. A query runner that forwards them to another doesn't compile until it passes them on, and neither does code that calls them to build its own SQL. The library keeps them in the context of the query before it calls `addParam`, so a query runner that adds the value has nothing to keep (see [Get the type of each parameter](../../advanced/query-execution-metadata.md#get-the-type-of-each-parameter)).
- `getQueryExecutionName`, `getQueryExecutionMetadata`, `getQueryExecutionStack`, `getFunctionExecutingQuery` and `isSelectPageCountQuery` keep working from `ts-sql-query/queryRunners/QueryRunner`, marked deprecated. Read them from the context of the query instead, with `this.getQueryContext(query, params)` in a query runner, or `getQueryContext(query, params)` from `ts-sql-query`: `executionName`, `executionMetadata`, `executionStack`, `functionExecutingQuery` and `isSelectPageCount` (see [The context of a query](../../advanced/query-execution-metadata.md)).

## What changes silently at runtime

Everything in this section compiles. These are the changes that alter a result, most dangerous first; the rest of the section explains each one:

1. **`connection.transaction(() => [query1, query2])` commits after a failure**, and resolves. [Transactions](#transactions).
2. **On an older database server, queries fail**, unless you declare its version. [The version of your database](#set-the-version-of-your-database).
3. **What is committed changes.** Oracle commits statements outside a transaction. On PostgreSQL, Oracle and others, a transaction that went wrong or is nested now rejects. [Transactions](#transactions).
4. **Other rows are read or written.** Conditions, inserts and updates that v1 emitted wrong are now right, so a query can touch rows it didn't. A comparison with an invalid `int` no longer throws. [Queries that read or write other rows](#queries-that-read-or-write-other-rows).
5. **Your `catch` stops matching.** An error of your own crosses a transaction unwrapped, and the classes and messages are others. [Errors](#errors).
6. **`NULL` is handled differently**, in `minValue`, `maxValue` and, on Oracle, in `concat` and `contains`; `replaceAll` and `length` also change. [Values, with a way back](#values-with-a-way-back).
7. **Corrected functions give another value.** [Values, corrected](#values-corrected).
8. **An old property in your connection class is ignored.** [Properties](#properties-of-the-connection-that-no-longer-exist).
9. **A custom type without its conversion arrives converted.** [Custom types are converted as their category](#custom-types-are-converted-as-their-category).
10. **Outside UTC, the dates and times move.** With the process in another zone, a date and time without zone is read and written in UTC, and a query runner can reject the connection. [Dates and times in a process outside UTC](#dates-and-times-in-a-process-outside-utc).

### Set the version of your database

Every connection has one `compatibilityVersion`, and its default is the latest version of each database: the library emits the most modern SQL, whatever your server runs. **On an older server, queries that worked in v1 now fail**, until you declare the version. It is encoded as `major * 1_000_000 + minor * 1_000 + patch`:

<!-- doc-code-snippet-template: sqlserver -->
```ts
class DBConnection extends SqlServerConnection<'DBConnection'> {
    protected override compatibilityVersion = 16_000_000 // SQL Server 2022
}
```

| If your database is older than | Value for that version | What the default emits and it doesn't accept |
|---|---|---|
| [PostgreSQL](../../configuration/supported-databases/postgresql.md#compatibility-version) 18 | `17_000_000` | `oldValues()` as `returning old.column` |
| [MySQL](../../configuration/supported-databases/mysql.md#compatibility-version) 8.0.19 | `8_000_018` | `insert ... as _new_ on duplicate key update` |
| MySQL 8.0.17 | `8_000_016` | `cast(x as double)` in `.asDouble()`, `.divide(...)` and `average(...)` |
| MySQL 8.0 | `5_007_000` | `with`, which is then written inline in the `from` |
| [MariaDB](../../configuration/supported-databases/mariadb.md#compatibility-version) 10.5 | `10_004_000` | `insert ... returning` to read the last inserted id |
| MariaDB 10.4 | `10_003_000` | `cast(x as double)` in `.asDouble()`, `.divide(...)` and `average(...)` |
| MariaDB 10.3.3 | `10_003_002` | `value(column)` in `on duplicate key update` |
| [SQLite](../../configuration/supported-databases/sqlite.md#compatibility-version) 3.42 | `3_041_000` | `unixepoch(x, 'subsec')` |
| SQLite 3.38 | `3_037_000` | `unixepoch(x)` |
| SQLite 3.35 | `3_034_000` | `insert ... returning` to read the last inserted id |
| SQLite 3.30 | `3_029_000` | `nulls first`, `nulls last` |
| [SQL Server](../../configuration/supported-databases/sqlserver.md#compatibility-version) 2025 | `16_000_000` | `current_date`, `json_arrayagg`, `json_object`, `substring` without a length |
| SQL Server 2022 | `15_000_000` | `greatest`, `least` |
| [Oracle](../../configuration/supported-databases/oracle.md#compatibility-version) 23ai | `19_000_000` | `Values` written with the `values` table constructor |

This only chooses the syntax. The changes in values and transactions below apply whatever the version.

### Transactions

**A function returning an array of queries no longer waits for them.** It was deprecated in v1.69.0. It still compiles, because a transaction now takes a function returning any value. So the array is the result: the transaction commits without waiting, and it resolves to an array of promises, even if one of them fails. In v1, a failure rolled back and rejected. Await each query inside an async function. Search your code for this form: a linter's promise rules, like `no-floating-promises` of typescript-eslint, find a forgotten `await` inside the function, but not this array.

```typescriptreact
// v1
const [updated, deleted] = await connection.transaction(() => [
    connection.update(tCustomer)...executeUpdate(),
    connection.deleteFrom(tCustomer)...executeDelete()
])
```

```ts
// v2
const [updated, deleted] = await connection.transaction(async () => {
    const updated = await connection.update(tCustomer)
        .set({ lastName: 'Smith' })
        .where(tCustomer.id.equals(1))
        .executeUpdate()
    const deleted = await connection.deleteFrom(tCustomer)
        .where(tCustomer.id.equals(2))
        .executeDelete()
    return [updated, deleted] as const
})
```

**Oracle: statements outside a transaction are committed.** v2 runs them with `autoCommit: true`. v1 passed no such option and the driver doesn't commit by default, so nothing committed them. If your code commits by hand after those statements, remove that. If you run a transaction of your own over that connection, use [`forUseInTransaction`](../../configuration/query-runners/recommended/oracledb.md#inside-a-transaction-something-else-manages).

**PostgreSQL: catching the error of a statement doesn't save the transaction.** PostgreSQL answers the commit of a failed transaction with a rollback. v1 didn't look at that answer, so `connection.transaction(...)` resolved, and nothing was saved. v2 reads it and rejects with `TRANSACTION_ERROR`, `transactionErrorType: 'transaction rolled back'`, running the after-rollback functions ([docs](../../configuration/supported-databases/postgresql.md#a-statement-that-fails-inside-a-transaction)).

**MariaDB, MySQL, SQL Server, SQLite: a transaction the database rolled back by itself is over.** A deadlock, for example, can do this. v1 had no check for it and went on sending statements, which the database runs on their own, committed one by one. When the query runner can tell from the error, v2 rejects those statements with the same `TRANSACTION_ERROR`, without sending them. `Sqlite3WasmOO1QueryRunner` can't tell ([docs](../../queries/transaction.md#when-the-database-rolls-back-the-transaction)).

**PostgreSQL, Oracle: a nested transaction rejects** with `NESTED_TRANSACTION_NOT_SUPPORTED`. v1 sent a second begin on PostgreSQL, and on Oracle it only counted them; the inner commit committed everything. On PostgreSQL, you can keep them by creating the query runner with `allowNestedTransactions: true` ([docs](../../configuration/query-runners/recommended/pg.md)).

### Queries that read or write other rows

v1 emitted these wrong, or did what wasn't asked. Check any code that relied on the old result.

**Conditions:**

- **A comparison of an `int` with a value that isn't an integer no longer throws.** `.equals(1.5)`, `.in([1.5])`, `.greaterThan(NaN)` and the same in a dynamic condition threw `Invalid int value to send to the db` in v1. Now the value is sent, and `.equals(1.5)` finds no row, as the same SQL does, where your code used to get an error. Writing such a value (`set`, and `const`) still throws.
- `.on(a).or(b)` in the join of a multi-table update or delete emitted `and` (seen on MySQL, MariaDB, PostgreSQL and SQL Server). It now emits `or`, so **it affects more rows**.
- `.notEndsWith(...)` on MySQL and MariaDB was emitted as `like`, selecting the rows it should exclude.
- `contains`, `startsWith`, `endsWith` and their variants escaped special characters of the search text wrongly: `\` on MySQL and MariaDB, `_` on SQL Server, and `\`, `%`, `_` and `[` on Oracle.
- `subSelectDistinctUsing(...)` emitted no `distinct`.
- MySQL, MariaDB: a column of a table in `having` is written with the name of the table. These databases took it as the column of the select with the same name, and filtered by that value. **If that column isn't in the group by, the database rejects the query** ([docs](../../queries/aggregate-and-group-by.md#a-column-that-isnt-in-the-group-by-in-the-having)).
- MySQL, MariaDB: `groupBy('alias')` of an expression with parameters is written with its position, `group by 1`. Don't add columns through `afterSelectKeyword` or `beforeColumns` in [`customizeQuery`](../../queries/sql-fragments.md#customizing-a-select) in those queries.

**Writes:**

- `ignoreIfHasNoValueWhen(true, 'column')` did the opposite in v1: it wrote the column without a value (as `NULL`), and left out the one with a value.
- `.onConflictOn(column).doUpdateSet({})`, with nothing to set, was a plain insert that failed on the conflict. It is now `on conflict do nothing`; `insert ignore` on MySQL and MariaDB.
- `executeInsert(min, max)` counts the real rows. v1 counted any plain insert as one row, so `executeInsert(5)` failed after inserting 7, and `executeInsert(0, 2)` passed.
- `returningLastInsertedId()` after an `onConflictDoNothing()` that skips the row is `null`. It was `0` on MySQL and MariaDB, and an older id on `BetterSqlite3QueryRunner` when `compatibilityVersion` is below SQLite 3.35.
- Oracle: a multi-row insert was emitted as a malformed `insert allinto ...`. It is now a `begin ... end;` block.

**Ordering and limits:**

- `orderBy`, `limit` and `offset` of a recursive select applied to its first part, before the recursion. They now apply to the whole result.
- `orderBy('alias', mode)`, with a mode that wraps the column like `'insensitive'`, could order by another column: `lower("n")` means the column `n` of the table, if there is one, on PostgreSQL. It is now `lower(first_name)`, the expression of the select. On Oracle, it doesn't change.
- MySQL, MariaDB: `'asc nulls last insensitive'` and `'desc nulls first insensitive'` lost the case insensitivity.
- Oracle: an `orderBy` in a subquery gets `offset 0 rows`, which makes Oracle honour it.

### Errors

**Review every `catch` that handled an error of the library.** Error management is new in v2: other classes, other messages and a different `cause`, so a `catch` written for v1 keeps compiling and stops matching. Rewrite it around `error.errorReason.reason`, as the [error management](../../api/error-management/overview.md) page explains:

| | v1 | v2 |
|---|---|---|
| Class | `ChainedError` or `Error` | [`TsSqlQueryExecutionError`, `TsSqlProcessingError`](../../api/error-management/overview.md), which extend `TsSqlError` and `Error` |
| What failed | Read the message, or the error of the driver | `error.errorReason.reason`, the same on every database |
| `error.message` | The message of the driver or the library | Starts with the reason. Read `errorReason`, don't parse the message |
| `error.cause` | The error of the driver; in a transaction, a `ChainedError` around it | The error of the driver, once |
| An error your code throws inside `connection.transaction(...)` | Wrapped: a `ChainedError` with yours in `cause` | Yours, as you threw it |

The two to search for are comparisons with `error.message` and reads of `error.cause` around a transaction. If you only looked at the error of the driver, this is now one line for every database:

```ts
try {
    await connection.insertInto(tCustomer)
        .set({ firstName: 'John', lastName: 'Smith', companyId: 1 })
        .executeInsert()
} catch (error) {
    if (error instanceof TsSqlError
        && error.errorReason.reason === 'SQL_CONSTRAINT_VIOLATED'
        && error.errorReason.constraintType === 'unique') {
        // The customer already exists
    } else {
        throw error
    }
}
```

An error of your own crosses the transaction unchanged:

```typescriptreact
// v1
} catch (error) {
    if (error.cause instanceof OutOfStockError) { ... }
}
```

```ts
// v2
class OutOfStockError extends Error { }

try {
    await connection.transaction(async () => {
        throw new OutOfStockError()
    })
} catch (error) {
    if (error instanceof OutOfStockError) {
        // ...
    } else {
        throw error
    }
}
```

The errors the library raises itself have a reason instead of a message to compare with; [the list](../../api/error-management/library-raised-errors.md) has all of them:

| v1 message | Reason |
|---|---|
| `No result returned by the database` | `NO_RESULT` |
| `The update operation didn't update the minimum of ...`, and the same for insert and delete | `MINIMUM_ROWS_NOT_REACHED` |
| `The update operation updated more that the maximum of ...`, and the same for insert and delete | `MAXIMUM_ROWS_EXCEEDED` |
| `There is no open transaction` | `NOT_IN_TRANSACTION` |
| `Invalid int value received from the db: ...`, and the same for the other types | `INVALID_VALUE_RECEIVED_FROM_DATABASE` |

**A number too big now fails.** Reading an integer above `Number.MAX_SAFE_INTEGER` that the driver already rounded to a `number` rejects with `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE`. v1 returned the rounded value. Declare the column `'bigint'`. On SQLite, enable the big integers of your driver too; the query runners of `mysql2`, `mariadb` and `oracledb` already receive them exact.

### Values, with a way back

These give other results on purpose. A property of the connection brings back the old SQL.

| Database | What changes | To go back |
|---|---|---|
| PostgreSQL | `.minValue(...)` and `.maxValue(...)` are `NULL` when an operand is `NULL`; v1 ignored the `NULL` | [`ignoreNullInMinAndMaxValue = true`](../../configuration/supported-databases/postgresql.md#minvalue-maxvalue-and-null) |
| SQL Server | `.minValue(...)` and `.maxValue(...)` are `NULL` when an operand is `NULL`. v1's `iif(a > b, a, b)` gave `b` when `a` was `NULL`, and `NULL` when `b` was | [`ignoreNullInMinAndMaxValue = true`](../../configuration/supported-databases/sqlserver.md#minvalue-maxvalue-and-null). This isn't quite v1: it emits `greatest(a, b)`, which ignores a `NULL` on either side. v1's `iif` only comes back with a `compatibilityVersion` below 2022 |
| Oracle | `.concat(...)` is `NULL` when an operand is `NULL`. `startsWith`, `endsWith`, `contains` and their `Insensitive` variants with a `NULL` search term match no row; v1 matched them all | [`ignoreNullInConcat = true`](../../configuration/supported-databases/oracle.md#concatenation-and-null), or [`.concatIgnoringNull(...)`](../../configuration/supported-databases/oracle.md#concatenation-and-null) for one concatenation |
| SQL Server, Oracle | `.replaceAll(...)` is case-sensitive even in a case-insensitive database | [`replaceCollation = ''`](../../configuration/collations.md#replacecollation-sql-server-and-oracle) |
| SQL Server | `.length()` counts trailing blanks | [`excludeTrailingBlanksInLength = true`](../../configuration/supported-databases/sqlserver.md#length-and-trailing-blanks) |
| PostgreSQL, MySQL, MariaDB | `.round()` over a floating-point value breaks ties away from zero | `usePlatformDependentRound = true` ([PostgreSQL](../../configuration/supported-databases/postgresql.md#rounding-behavior), [MySQL](../../configuration/supported-databases/mysql.md#rounding-behavior), [MariaDB](../../configuration/supported-databases/mariadb.md#rounding-behavior)) |

<!-- doc-code-snippet-template: sqlserver -->
```ts
class DBConnection extends SqlServerConnection<'DBConnection'> {
    protected override ignoreNullInMinAndMaxValue = true
    protected override excludeTrailingBlanksInLength = true
    protected override replaceCollation = ''
}
```

### Values, corrected

These returned a wrong value in v1, or depended on something they shouldn't. If your code compensates for one, remove the compensation; there is no way back.

**Logarithms and roots:**

- `.logn(n)` on PostgreSQL, Oracle and SQLite had its arguments reversed: `log(value, n)`, now `log(n, value)`.
- `.log10()` on Oracle was the logarithm of 10 in base `x`. `.ln()` on SQLite was emitted as `log(x)`, base 10.
- `cbrt()` computes the cube root; except on PostgreSQL, it computed the cube.

**Numbers:**

- `average(...)` is computed in floating point. On SQL Server, the average of an `int` column was truncated to an integer; on MySQL and MariaDB, it was cut to 4 decimals.
- `asInt()` and `asBigint()` over a double produce an integer type in SQL, so what follows is integer arithmetic.
- MySQL, MariaDB: `.divide(...)` always divides in floating point, `1 / 3` was cut to 4 decimals, and `.asDouble()` really is a double.
- PostgreSQL: `const(7, 'int').lessThan(10)` was `false`, compared as text; the constant now has its type.
- SQL Server: `.power(...)` over an integer keeps the fraction: `intColumn.power(0.5)` was `1`. `double` values are sent as `float`, not the less precise `real`.
- SQLite: `connection.random()` returns a `double` in `[0, 1)`, not a 64-bit integer.

**Strings:**

- `substr`, `substring`, `substrToEnd` and `substringToEnd` follow JavaScript when the index is a number: a negative index counts from the end in `substr` and is 0 in `substring`, and `substring` swaps its arguments when `start > end`. An index that is a value source is not affected.
- MySQL, MariaDB: `.length()` counts characters, not bytes: `'café'` is 4, not 5.
- SQL Server: `.valueWhenNull(...)` doesn't cut the fallback to the type of the column.

**Dates:**

- `getTime()` on MySQL and MariaDB is right outside 1970 to 2038, where `unix_timestamp` doesn't work. Its SQL also changes on Oracle and SQLite.
- `getMilliseconds()` truncates on MySQL, MariaDB and PostgreSQL, where rounding could reach 1000 or wrap to 0. On SQLite, it rounds the fraction before taking the remainder.
- PostgreSQL: `getSeconds()` doesn't reach 60.
- SQL Server: `getDay()` doesn't depend on `SET DATEFIRST`: 0 is always Sunday.

**Other:**

- SQL Server, Oracle: a projected `between` whose upper bound is optional is `NULL` when that bound is `NULL`. It was `false`.
- [`dynamicPickPaths`](../../dynamic/helper-types/picks.md) with a path of 3 or more levels dropped it.

### Custom types are converted as their category

A `customInt`, `customDouble`, `customUuid`, `customLocalDate`, `customLocalTime` or `customLocalDateTime` whose conversion you didn't register was returned as the driver gave it, or as text from an array aggregate. It's now converted as an `int`, a `double`, a `uuid` or the type of its date or time, with the same checks: a number past `Number.MAX_SAFE_INTEGER` in a `customInt` is rejected, and an exact decimal kept as text in a `customDouble` becomes a `number` and loses the digits a `number` doesn't hold. On PostgreSQL, the parameter of these types gets the cast of its category where the library writes one, like `$1::float8` for a `customDouble`. On SQL Server, a `customInt` is bound as `int`, as an `int` is; it was bound as `bigint`, so a value above 2,147,483,647 is now rejected by the database: use `customBigint` for it. To keep a value as it comes, register its conversion: see [Custom types](../../configuration/column-types.md#custom-types). An `enum`, a `custom` and a `customComparable` are not converted, as before.

### Dates and times in a process outside UTC

v2 keeps every date and time of the database in UTC, whatever the zone of the process: the digits of a column without zone are the UTC getters of the `Date`, when it's read and when it's sent (see [Time zones](../../configuration/time-zones.md)). With the process in UTC the values don't change. With the process in another zone, on PostgreSQL, MySQL, MariaDB and Oracle:

- **What you read moves.** v1 gave a `localDateTime` of a column without zone and a `localTime` with the stored digits in their **local** getters with `pg`, `mysql2`, `mariadb` and `oracledb`; v2 gives them in their UTC getters. A `timestamp` holding `2024-01-14 12:30:00`, read in `Europe/Madrid`, was `2024-01-14T11:30:00.000Z`, and is `2024-01-14T12:30:00.000Z`. Replace `getHours()`, `getDate()` and the other local getters with `getUTCHours()`, `getUTCDate()`… where you read these values, and format them with `timeZone: 'UTC'`.
- **What you send moves.** Those drivers wrote a `Date` with its local getters; v2 writes its UTC getters. `new Date(2024, 0, 14, 9, 15)`, built in Madrid, was stored as `09:15` and is now stored as `08:15`. Build the values with `Date.UTC(...)`.
- **The rows already written are not converted.** A v1 application that ran outside UTC, with those drivers, wrote the wall clocks of its zone, and v2 reads them as UTC: each value comes out shifted by the offset of that zone, which with summer time is one amount in winter and another in summer. Convert the stored values to UTC once, before v2 writes new ones. On PostgreSQL, for a `timestamp` written from `Europe/Madrid`:

    ```sql
    update release set signed_off_at = (signed_off_at at time zone 'Europe/Madrid') at time zone 'UTC';
    ```

    `2024-01-14 10:30:00` becomes `2024-01-14 09:30:00`, and `2024-07-14 14:30:00` becomes `2024-07-14 12:30:00`. If you can't convert them, read and write that column through a [type adapter](../../configuration/column-types.md#type-adapters) on a `customLocalDateTime`.
- **A query runner can reject the connection**, when it's created: `oracledb` needs the environment variable `ORA_SDTZ` set to UTC (or not set, with the process in UTC), or to the `databaseTimeZone` you declare, `pg` and postgres.js a session `TimeZone` in the zone of the database (UTC, or the `databaseTimeZone` you declare) if their configuration sets one, and `mssql` a pool without `useUTC: false` (see [Query runners](#query-runners)).
- **MySQL and MariaDB `TIMESTAMP`** and Oracle `TIMESTAMP WITH LOCAL TIME ZONE` are converted with the zone of the database session, which must be in UTC.

A column with zone, like `timestamptz` or `datetimeoffset`, keeps its instant, as in v1. On SQLite nothing changes: the strategy of dates decides, as before.

Running the application in UTC (`TZ=UTC`) needs neither `ORA_SDTZ` nor `useUTC`, and is still the advice.

### SQLite: the precision of the dates and times as text

Each strategy of `getDateTimeFormat` as text now says its precision, and the old names don't compile: `'localdate as text'` becomes `'localdate seconds as text'` or `'localdate milliseconds as text'`, `'UTC as text using T separator'` becomes `'UTC seconds as text using T separator'` or `'UTC milliseconds as text using T separator'`, and so on. If you didn't override `getDateTimeFormat`, the default is now `'localdate milliseconds as text'`.

In v1, a time or a date time had three decimals only when its milliseconds weren't 0, and `currentTime()` and `currentTimestamp()` had none. Now a strategy writes every value with the same width:

| Strategy | v1 wrote | Now |
|---|---|---|
| `milliseconds` | `10:00:00` and `10:00:00.500` | `10:00:00.000` and `10:00:00.500` |
| `seconds` | `10:00:00` and `10:00:00.500` | `10:00:00` and `10:00:00`: the milliseconds are dropped |

Reading isn't affected: every text gives the same `Date` as before. But these values are compared as text, and the rows you already have keep their text until you change it. With `milliseconds`, `equals` with a value without milliseconds doesn't find a row stored as `10:00:00`, with no error. Normalize each column of a `localDateTime` or a `localTime` with the statement for the strategy you choose. They leave the rows with a null as they are, and running them again changes nothing.

Run them once for each column, with the name of your table instead of `my_table` and the name of the column instead of `my_column`.

To `milliseconds`, without losing anything:

```sql
-- A date time: 2024-01-14 10:00:00 becomes 2024-01-14 10:00:00.000
update my_table set my_column = my_column || '.000' where length(my_column) = 19;

-- A date time with Z: 2024-01-14 10:00:00Z becomes 2024-01-14 10:00:00.000Z
update my_table set my_column = substr(my_column, 1, 19) || '.000Z' where length(my_column) = 20;

-- A time: 10:00:00 becomes 10:00:00.000
update my_table set my_column = my_column || '.000' where length(my_column) = 8;

-- A time with Z: 10:00:00Z becomes 10:00:00.000Z
update my_table set my_column = substr(my_column, 1, 8) || '.000Z' where length(my_column) = 9;
```

To `seconds`, dropping the milliseconds:

```sql
-- A date time: 2024-01-14 10:00:00.500 becomes 2024-01-14 10:00:00
update my_table set my_column = substr(my_column, 1, 19) where length(my_column) > 19;

-- A date time with Z: 2024-01-14 10:00:00.500Z becomes 2024-01-14 10:00:00Z
update my_table set my_column = substr(my_column, 1, 19) || 'Z' where length(my_column) > 20;

-- A time: 10:00:00.500 becomes 10:00:00
update my_table set my_column = substr(my_column, 1, 8) where length(my_column) > 8;

-- A time with Z: 10:00:00.500Z becomes 10:00:00Z
update my_table set my_column = substr(my_column, 1, 8) || 'Z' where length(my_column) > 9;
```

The same statements work with the space and with the `T` separator. Columns with a `localDate` don't change, and neither do the numeric strategies. If the schema or a trigger writes the value, like a `default current_timestamp`, use the expression of your strategy: see [Values generated by the database](../../configuration/supported-databases/sqlite.md#values-generated-by-the-database).

Choose `seconds` if other code writes in those columns with SQLite's own functions, which have no decimals: `UTC seconds as text` is the text of `current_timestamp`.

### Properties of the connection that no longer exist

A property left in your connection class still compiles and does nothing, unless you wrote `override` on it. Search for these:

| v1 | v2 |
|---|---|
| `MySqlConnection.compatibilityMode = true` | `compatibilityVersion = 5_007_000` |
| `MariaDBConnection.alwaysUseReturningClauseWhenInsert` | Remove it: `returning` is the default. In a database older than 10.5, `compatibilityVersion = 10_004_000` |
| `SqliteConnection.compatibilityMode` | Remove it: the default was `true`, and now it is the modern SQL. In an old SQLite, `compatibilityVersion` from the table above |
| `insesitiveCollation` | `insensitiveCollation` (`insesitiveCollation` is deprecated since v1.68.0, 14 Jun 2026). Left as it is, the case-insensitive operations lose your collation |

### Query runners

- `ConsoleLogQueryRunner`: `logResults: true` logged no results and `false` logged them, the other way round. Now `true` logs them.
- **`BetterSqlite3QueryRunner` no longer forces `safeIntegers(true)`.** Integers come as `number`, and above the safe range [they fail](#errors). To read them as `bigint`, enable `safeIntegers` in the database ([docs](../../configuration/query-runners/recommended/better-sqlite3.md)).
- **Some configurations of the driver are rejected** when the query runner is created, with `INVALID_CONFIGURATION`: `pg` with `binary: true`; postgres.js with a `transform` of the results, or with `infer: true` outside UTC; `mssql` with `camelCaseColumns` or `columnNameReplacer`, with a `textsize` below the default of tedious, or with `useUTC: false` outside UTC; `oracledb` without `ORA_SDTZ` set to the zone of the database (UTC, or the `databaseTimeZone` you declare) when the process or the database isn't in UTC. See the *Connection requirements* of each query runner, like [oracledb](../../configuration/query-runners/recommended/oracledb.md#connection-requirements).
- **The settings of the driver that change a value no longer apply to the queries of the library**: the parsers of `date` and `timestamp` of `pg`; `dateStrings`, `supportBigNumbers`, `typeCast`, `rowsAsArray`, `decimalNumbers` and `timezone` of `mysql2`; `typeCast`, `rowsAsArray`, `metaAsArray`, `nestTables`, `dateStrings`, `decimalAsNumber`, `bigIntAsNumber` and `insertIdAsNumber` of `mariadb`; `arrayRowMode` of `mssql`; the global `fetchTypeHandler`, `fetchAsString`, `fetchAsBuffer` and `maxRows` of `oracledb`. They still apply to your own queries through the driver. If you used one to shape what the library returned, use a [custom type](../../configuration/column-types.md#custom-types) with its conversion instead. The `supportBigNumbers` of `mysql2` and the global `fetchTypeHandler` of `oracledb` that the docs recommended for large integers are no longer needed.
- **Oracle: a `boolean` parameter of a procedure is bound as a PL/SQL `BOOLEAN`.** A procedure with a `NUMBER` parameter that you called with a `boolean` value fails with `PLS-00306`: give it an `int` (`this.const(flag ? 1 : 0, 'int')`) ([docs](../../configuration/query-runners/recommended/oracledb.md#procedures-with-a-boolean-parameter)).
- **A date or a time outside the calendar is rejected when it's read**, like `2024-02-30` that MySQL keeps with `ALLOW_INVALID_DATES`, or `24:00:00`: before, it became another day ([docs](../../configuration/time-zones.md#known-limits)).
- **SQL given straight to a query runner** must use the placeholders of the library. Oracle binds by name, so a placeholder is named after the index of its value (`:0`, `:1`). `BetterSqlite3QueryRunner` numbers them (`?1`, `?2`), and doesn't bind a bare `?`.

### Tests with MockQueryRunner

`MockQueryRunner` now follows the transactions like a real driver: `commit`, `rollback`, `getTransactionMetadata()` and the deferred functions outside a transaction throw `NOT_IN_TRANSACTION`. Wrap those calls in a transaction ([docs](../../configuration/query-runners/general-purpose/MockQueryRunner.md#transactions)). A nested transaction still works there, so a mock doesn't show the rejection a real query runner gives.

## What only changes the SQL text

These affect logs, test snapshots, mocks and interceptors that read the SQL. They mean the same; where a change of SQL also changes the result, it is in the section above. The parameters can change too, in number and in order.

| Database | v1 | v2 |
|---|---|---|
| SQLite | `where id = ?` | `where id = ?1`, also with `MockQueryRunner` and `NoopQueryRunner` |
| SQLite | `insert into ...` | `insert into ... returning id`, to read the last inserted id |
| SQLite | `order by ln is null, ln asc` | `order by ln asc nulls last` |
| SQLite | `where id in ()` | `where 0` |
| MariaDB | `insert into ...` | `insert into ... returning id`, to read the last inserted id |
| MariaDB | `on duplicate key update x = values(x)` | `on duplicate key update x = value(x)` |
| MySQL | `values (?) on duplicate key update x = values(x)` | `values (?) as _new_ on duplicate key update customer.x = _new_.x` |
| MySQL, MariaDB | `order by ln is null, ln asc` | `order by last_name is null, ln asc`, with the column |
| MySQL, MariaDB | `json_arrayagg(...)` | `cast(json_arrayagg(...) as char)` |
| PostgreSQL | `json_agg(...)` | `(json_agg(...))::text` |
| PostgreSQL | `update customer as _new_ ... from (select _old_.* ...)` for `oldValues()` | `update customer ... returning old.x` |
| SQL Server | `getdate()` for `currentDate()` | `current_date`, or `cast(getdate() as date)` below 2025 |
| SQL Server | `isnull(x, @0)` | `coalesce(x, @0)` |
| SQL Server | `substring(x, @0, len(x) - @1)` for `substrToEnd` and `substringToEnd` | `substring(x, @0)` |
| SQL Server | `string_agg(...)` for the aggregated arrays | `json_arrayagg(...)` |
| SQL Server | `iif([ln] is null, 1, 0)` in `order by` | `iif(customer.last_name is null, 1, 0)`, with the column |
| All but SQLite | The parameter of a `localTime`, the string `'05:06:07'` | A `Date` on 1970-01-01 whose UTC getters are the time |
| All but MySQL and MariaDB | `group by first_name + @1`, with the parameter twice | `group by first_name + @0`, with the parameter once |
| All | `with w as (...)` not used in the query | Left out |
| All | A column in `beforeOrderByItems` and `afterOrderByItems`, bare | With the name of the table |
| All | `avg(x)` | `avg(cast(x as float))`, with the floating-point type of each database |
