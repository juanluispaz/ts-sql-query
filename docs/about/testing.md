# How it's tested

A query builder promises that the query you write in TypeScript does on your database what its documentation says. This page tells how far that is checked: what each test looks at, on which databases, versions and drivers it runs, and what else is tested besides the queries. It also lists some behaviours of the databases and of JavaScript that the library handles, so that you don't meet them.

## What each test checks

Each test runs a query and checks four things:

1. The SQL that the library writes.
2. The values it sends as parameters.
3. The exact TypeScript type of the result: neither wider nor narrower than the one written in the test.
4. The value that comes back.

The same test runs against the real database and against a mock that returns the data of the real one. Against the real database it proves what the query does; against the mock, it runs in seconds on every change.

Behaviour is checked with data that shows the difference: mixed case for an `Insensitive` comparison, a wildcard in the text of a `contains`, a time zone other than UTC.

## Databases, versions and drivers

The tests run on each combination of a database, a version and a driver: 81 combinations, which share 5,384 tests, more than 419,000 tests in all, with those particular to a database and those of the query runners. A combination that lacks one of the shared tests fails the build, and so does a test that checks less than the rules ask, like comparing only part of a result.

| Database | Versions | Drivers |
|---|---|---|
| PostgreSQL | 17 and 18, and PGlite | `pg`, `postgres`, Bun SQL, PGlite |
| MySQL | 5.7, 8.0 and 26.10 | `mysql2`, Bun SQL |
| MariaDB | 10.3, 10.4, 10.5 and 13.0 | `mariadb`, Bun SQL |
| Oracle | 21 XE and 23 Free | `oracledb` |
| SQL Server | 2019, 2022 and 2025 | `mssql` |
| SQLite | The SQL for 3.29, 3.30, 3.35, 3.38 and the newest version | `better-sqlite3`, `sqlite3`, `node:sqlite`, `bun:sqlite`, Bun SQL, sqlite-wasm |

On older versions the tests run with the [`compatibilityVersion`](../configuration/supported-databases/postgresql.md#compatibility-version) of that version, so they check the SQL that the library writes for it. The SQLite drivers that can run [without promises](../advanced/synchronous-query-runners.md) are tested that way too.

The library is tested on Node.js 22, 24 and 26, and on Bun.

## Besides the queries

- **What must not compile.** 4,347 forms of using the library are checked to be compilation errors, like comparing different data types, doing arithmetic on a text, or using a function your database doesn't have.
- **The query runners.** Each one is called on its own against its database: the shapes of a result, inserts and updates with and without `returning`, procedures, transactions, a runner created inside a transaction that something else manages, and a deadlock that MySQL and MariaDB answer by rolling back the whole transaction.
- **The errors.** The errors of each database are provoked on the real engine, to check the [reason](../api/error-management/overview.md) each one is translated to.
- **The documentation.** Every TypeScript example of these pages compiles, and the SQL shown for each database is the one the library writes.
- **Time zones.** What depends on the zone runs in processes started in several of them, because the zone of a process can't be changed reliably once it runs.

## Behaviours of the databases that the library handles

These are some of the behaviours that the tests check on the real engines. The pages linked explain what you see:

- PostgreSQL keeps the first 63 bytes of a name and drops the rest without an error, so the value of a property with a long path wasn't found in the row. The library writes a long name as its beginning and a hash of the whole name.
- Oracle reads a null as the empty string when it concatenates: `'x' || null` is `'x'`. The library keeps the null, as the type says, unless you ask for Oracle's behaviour. See [Concatenation and NULL](../configuration/supported-databases/oracle.md#concatenation-and-null).
- The databases don't read a chain of `union`, `intersect` and `except` in the same way. The library groups them, so the result is the same on all of them. See [Compound select](../queries/compound-select.md#combining-more-than-two-selects).
- SQL Server doesn't accept a page without an `order by`, and MariaDB, MySQL and SQLite don't accept an `offset` without a `limit`. The library completes the query. See [Select page](../queries/select-page.md#limit-and-offset).
- A deadlock in MariaDB and MySQL rolls back the whole transaction, and the next statement would run outside it. The library rejects it instead. See [When the database rolls back the transaction](../queries/transaction.md#when-the-database-rolls-back-the-transaction).
- SQLite compares dates stored as text character by character, so they only sort well when all of them have the same width. See [Date and time strategies](../configuration/supported-databases/sqlite.md#date-and-time-strategies).
- SQLite takes the time zone from the operating system when the process starts, and under Bun changing `process.env.TZ` afterwards doesn't reach it. See [The date functions and the time zone](../configuration/supported-databases/sqlite.md#the-date-functions-and-the-time-zone).

## Behaviours of JavaScript that the library handles

- A number in a JSON can lose digits when JavaScript parses it, so the numbers of an aggregate arrive as text and the type of the column converts them. See [Aggregate as an array of objects](../queries/aggregate-as-object-array.md).
- A date as a Julian day is a double, and converting it to a `Date` could land a millisecond early. The library rounds it.
- Before 1970, the remainder and the integer division of SQLite keep the sign, so the milliseconds of a date would come out negative and the second would be one off. The library computes them as `Date` does.

## What isn't supported

What a database or a version can't do is not hidden: the page of each database, like [PostgreSQL](../configuration/supported-databases/postgresql.md), and [Limitations](limitations.md) say it. What a database doesn't offer doesn't compile on its connection; on a version older than the one that offers it, the database rejects the query. In the tests, each of those cases is marked with its reason.
