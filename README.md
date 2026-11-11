# ts-sql-query <!-- omit in toc -->

[![npm](https://img.shields.io/npm/v/ts-sql-query.svg)](https://npm.im/ts-sql-query)
[![sponsor](https://img.shields.io/badge/sponsor-GitHub-ff69b4?logo=githubsponsors)](https://github.com/sponsors/juanluispaz)

`ts-sql-query` is a type-safe SQL query builder for TypeScript. You write the query in TypeScript, the compiler checks it, and the library sends that query to the database.

The compiler checks each query against the tables and views you map in your code: a column that doesn't exist, a comparison between different data types or a function your database doesn't have is a compilation error. When you change the mapping of a table, it points to every query that no longer fits.

`ts-sql-query` is **not** an ORM: there are no entities or a model layer between your code and the SQL.

It supports MariaDB, MySQL, Oracle, PostgreSQL, SQLite and SQL Server, on [Node.js](https://nodejs.org/) and [Bun](https://bun.com).

![](https://raw.githubusercontent.com/juanluispaz/ts-sql-query/master/docs/demo.gif)

**Documentation: <https://ts-sql-query.readthedocs.io/>**

# Contents <!-- omit in toc -->

- [Why use it?](#why-use-it)
- [A query](#a-query)
- [Dynamic queries](#dynamic-queries)
- [Supported databases and drivers](#supported-databases-and-drivers)
- [How it's tested](#how-its-tested)
- [Install](#install)
- [Documentation](#documentation)
- [Working on ts-sql-query](#working-on-ts-sql-query)
- [Related projects](#related-projects)
- [License](#license)

## Why use it?

- **You see the SQL you get.** The code follows the structure of the query, and each query you execute is one query in the database. The only method that sends two is [`executeSelectPage`](https://ts-sql-query.readthedocs.io/en/latest/queries/select-page/): the rows and the total.
- **The result has a type without writing it.** The type of each row comes from the select, and a column that can be null is optional.
- **Queries that vary stay one query.** See [Dynamic queries](#dynamic-queries).
- **No SQL text is assembled from your values.** Values go to the database as parameters.
- **Tested on the real databases.** The queries are checked on PostgreSQL, MySQL, MariaDB, Oracle, SQL Server and SQLite, in several versions and with each driver: the SQL, the parameters, the type of the result and the rows that come back. See [How it's tested](#how-its-tested).

For the principles behind the library, see [Philosophy and design goals](https://ts-sql-query.readthedocs.io/en/latest/about/philosophy/).

## A query

```ts
const customerId = 10;

const customerWithId = await connection.selectFrom(tCustomer)
    .where(tCustomer.id.equals(customerId))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday
    })
    .executeSelectOne();
```

The executed query, on PostgreSQL, is:

```sql
select id as id, first_name as "firstName", last_name as "lastName", birthday as birthday
from customer
where id = $1
```

The parameters are: `[ 10 ]`

The result type is:

```ts
const customerWithId: {
    id: number;
    firstName: string;
    lastName: string;
    birthday?: Date;
}
```

`executeSelectOne` expects exactly one row: when there is none, the promise rejects. `executeSelectNoneOrOne` returns `null` instead, and `executeSelectMany` returns all the rows. See [Basic query structure](https://ts-sql-query.readthedocs.io/en/latest/queries/basic-query-structure/).

## Dynamic queries

A search form, a table with filters, an API that other systems query: what these queries have to do is only known when they run. They are usually assembled with `if`s and pieces of SQL, so the code stops looking like the query it builds, and the types can't follow the result.

In `ts-sql-query` you write one query with every part that can vary, and the library writes the SQL with only what applies:

- A condition without a value disappears from the query: `tCustomer.firstName.containsIfValue(firstName)`.
- A whole filter can arrive as an object, as in the body of a request, limited to the columns you list: `connection.dynamicConditionFor`.
- The order can arrive as text, and it can only name properties of the select: `orderByFromString`. The page can be missing: `limitIfValue`, `offsetIfValue`.
- The caller can choose the columns (`dynamicPick`), and a join that no chosen column needs is left out of the query (`optionalJoin`).
- A function of yours can return exactly the type of what the caller asked for.
- Inserts and updates set only what has a value (`setIfValue`), and an update that ends up without a `where` isn't sent.

```ts
const firstNameContains = 'ohn';
const lastNameContains = null;
const searchOrderBy = 'name insensitive, birthday asc nulls last';

const searchedCustomers = await connection.selectFrom(tCustomer)
    .where(
        tCustomer.firstName.containsIfValue(firstNameContains)
            .or(tCustomer.lastName.containsIfValue(lastNameContains))
    )
    .select({
        id: tCustomer.id,
        name: tCustomer.firstName.concat(' ').concat(tCustomer.lastName),
        birthday: tCustomer.birthday
    })
    .orderByFromString(searchOrderBy)
    .executeSelectMany();
```

The executed query, on PostgreSQL, is:

```sql
select id as id, first_name || $1 || last_name as name, birthday as birthday
from customer
where first_name like ('%' || $2 || '%')
order by lower(first_name || $1 || last_name), birthday asc nulls last
```

The parameters are: `[ ' ', 'ohn' ]`

The result type is:

```ts
const searchedCustomers: {
    id: number;
    name: string;
    birthday?: Date;
}[]
```

The condition on the last name had no value, so it's not in the query. No extra query is sent to find anything out, and a value from a request never becomes SQL text. See [What a dynamic query can do](https://ts-sql-query.readthedocs.io/en/latest/dynamic/building-blocks/), which shows one query growing through all of this and lists everything on offer.

## Supported databases and drivers

| Database | Drivers |
|---|---|
| [MariaDB](https://ts-sql-query.readthedocs.io/en/latest/configuration/supported-databases/mariadb/) | `mariadb`, Bun SQL |
| [MySQL](https://ts-sql-query.readthedocs.io/en/latest/configuration/supported-databases/mysql/) | `mysql2`, Bun SQL |
| [Oracle](https://ts-sql-query.readthedocs.io/en/latest/configuration/supported-databases/oracle/) | `oracledb` |
| [PostgreSQL](https://ts-sql-query.readthedocs.io/en/latest/configuration/supported-databases/postgresql/) | `pg`, `postgres`, Bun SQL, PGlite |
| [SQLite](https://ts-sql-query.readthedocs.io/en/latest/configuration/supported-databases/sqlite/) | `better-sqlite3`, `node:sqlite`, `bun:sqlite`, Bun SQL, sqlite-wasm |
| [SQL Server](https://ts-sql-query.readthedocs.io/en/latest/configuration/supported-databases/sqlserver/) | `mssql` |

`ts-sql-query` uses one dialect, inspired by SQLite and PostgreSQL with names adapted to JavaScript, and writes the SQL of the database you connect to. Each database page says what it offers and what it doesn't, and [Query runners](https://ts-sql-query.readthedocs.io/en/latest/configuration/query-runners/) tells how to connect with each driver.

## How it's tested

The tests run on 76 combinations of a database, a version and a driver, which share 5,401 tests: more than 394,000 tests in all. Each one checks the SQL, the parameters, the exact type of the result and the rows that come back, and the same test runs against the real database and against a mock. Besides the queries, 4,347 forms of using the library are checked to be compilation errors, each query runner is tested on its own against its database, and every example of the documentation compiles.

| Database | Versions |
|---|---|
| PostgreSQL | 17 and 18, and PGlite |
| MySQL | 5.7, 8.0 and 26.10 |
| MariaDB | 10.3, 10.4, 10.5 and 13.0 |
| Oracle | 21 XE and 23 Free |
| SQL Server | 2019, 2022 and 2025 |
| SQLite | The SQL for 3.29, 3.30, 3.35, 3.38 and the newest version |

See [How it's tested](https://ts-sql-query.readthedocs.io/en/latest/about/testing/) for what each test looks at, and some of the behaviours of the databases and of JavaScript that the library handles.

## Install

Install with [npm](https://www.npmjs.com/) in [Node.js](https://nodejs.org/):

```sh
$ npm install --save ts-sql-query
```

Install in [Bun](https://bun.com):

```sh
$ bun install ts-sql-query
```

ts-sql-query is an ESM-only package and requires Node.js 22 or newer. You import from the paths of its `exports` map, organized by what they offer; any other path fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`. Each name is exported by one path.

```ts
// What works the same on every database
import { Table, Values, CustomBooleanTypeAdapter, dynamicPick, MockQueryRunner,
         extractColumnsFrom, type Connection, type SelectedRow } from 'ts-sql-query'

// What is specific to a database
import { PostgreSqlConnection } from 'ts-sql-query/postgresql'

// The query runners of a driver for that database
import { PgPoolQueryRunner } from 'ts-sql-query/postgresql/pg'
```

| Path | What it has |
|---|---|
| `ts-sql-query` | Tables, views, values, the connection types, the type adapters, the errors, the dynamic queries, the helper types, and the query runners that need no driver (`MockQueryRunner`, `NoopQueryRunner`, `ConsoleLogQueryRunner`, `ConsoleLogNoopQueryRunner`, `InterceptorQueryRunner`, `LoggingQueryRunner`) with the `QueryRunner` interface |
| `ts-sql-query/mariadb` | `MariaDBConnection` |
| `ts-sql-query/mariadb/mariadb`, `ts-sql-query/mariadb/mysql2`, `ts-sql-query/mariadb/bun-sql` | The query runners of `mariadb`, `mysql2` and Bun SQL, for MariaDB |
| `ts-sql-query/mysql` | `MySqlConnection` |
| `ts-sql-query/mysql/mysql2`, `ts-sql-query/mysql/bun-sql` | The query runners of `mysql2` and Bun SQL, for MySQL |
| `ts-sql-query/oracle` | `OracleConnection`, `OracleDateAsTimestampTypeAdapter` |
| `ts-sql-query/oracle/oracledb` | The query runners of `oracledb` |
| `ts-sql-query/postgresql` | `PostgreSqlConnection` |
| `ts-sql-query/postgresql/pg`, `ts-sql-query/postgresql/postgres`, `ts-sql-query/postgresql/pglite`, `ts-sql-query/postgresql/bun-sql` | The query runners of `pg`, postgres.js, PGlite and Bun SQL |
| `ts-sql-query/sqlite` | `SqliteConnection` and the types of its configuration (`SqliteDateTimeFormat`, …) |
| `ts-sql-query/sqlite/better-sqlite3`, `ts-sql-query/sqlite/node-sqlite`, `ts-sql-query/sqlite/bun-sqlite`, `ts-sql-query/sqlite/bun-sql`, `ts-sql-query/sqlite/sqlite-wasm` | The query runners of `better-sqlite3`, `node:sqlite`, `bun:sqlite`, Bun SQL and the official SQLite WASM build |
| `ts-sql-query/sqlserver` | `SqlServerConnection` |
| `ts-sql-query/sqlserver/mssql` | The query runners of `mssql` |
| `ts-sql-query/IDEncrypter` | `IDEncrypter` and `isValidEncryptedID` |

The paths of version 1 (`ts-sql-query/connections/PostgreSqlConnection`, `ts-sql-query/queryRunners/PgPoolQueryRunner`, `ts-sql-query/extras/types`, …) still work, so code written for it keeps compiling: each name they export is marked deprecated, with the path to import it from now. See [Migrating from v1](https://ts-sql-query.readthedocs.io/en/latest/about/changelog/migrating-from-v1/).

TypeScript consumers must use `moduleResolution: "node16"`, `"nodenext"` or `"bundler"` for these paths to resolve.

### Escape hatch for advanced use cases

If you need to reach into anything that isn't on the public list — abstract base classes (`AbstractSqlBuilder`, `AbstractQueryRunner`, `ManagedTransactionQueryRunner`, …), the per-database error mappers under `queryRunners/databaseErrorMappers/`, the expression/builder internals, etc. — every file in the package remains importable under the `ts-sql-query/__UNSUPPORTED__/<original/path>` prefix:

```ts
// Public, stable
import { Table } from 'ts-sql-query'

// Unsupported, no stability guarantees
import { AbstractSqlBuilder } from 'ts-sql-query/__UNSUPPORTED__/sqlBuilders/AbstractSqlBuilder'
import { ManagedTransactionQueryRunner } from 'ts-sql-query/__UNSUPPORTED__/queryRunners/ManagedTransactionQueryRunner'
import { PostgresErrorMapper } from 'ts-sql-query/__UNSUPPORTED__/queryRunners/databaseErrorMappers/PostgresErrorMapper'
```

Anything imported through `__UNSUPPORTED__/` may change, break or disappear in any release, including patch releases. The `__UNSUPPORTED__/` prefix is mandatory — the natural paths (e.g. `ts-sql-query/sqlBuilders/...`) remain blocked.

## Documentation

The documentation is at <https://ts-sql-query.readthedocs.io/>. To start, see [Basic query structure](https://ts-sql-query.readthedocs.io/en/latest/queries/basic-query-structure/) and [Defining the connection](https://ts-sql-query.readthedocs.io/en/latest/configuration/connection/); to upgrade, [Migrating from v1](https://ts-sql-query.readthedocs.io/en/latest/about/changelog/migrating-from-v1/) and the [change log](https://ts-sql-query.readthedocs.io/en/latest/about/changelog/v2/).

For AI agents, the package includes the documentation of its version (`AGENTS.md`, `llms/` and `docs/`), and the website offers [`llms.txt`](https://ts-sql-query.readthedocs.io/llms.txt), with one file per area and per database. See [For AI agents](https://ts-sql-query.readthedocs.io/en/latest/about/ai-agents/).

## Working on ts-sql-query

The project runs on Node.js 22 or newer and on Bun. After cloning:

```sh
$ bun install && bun run codegen
```

- `bun run validate` type-checks the library, and `bun run validate:tests` the tests.
- `bun run tests` runs the whole matrix of tests against the mock, in seconds. `bun run tests --docker --wasm` runs it against the real databases, which needs Docker.
- `bun run docs` serves the documentation and `bun run docs:check` builds it in strict mode; both need `mkdocs`, with the packages of `docs/requirements.txt`.

The same scripts work with `npm run`. See [`test/README.md`](https://github.com/juanluispaz/ts-sql-query/blob/master/test/README.md) for how the tests are organized and run, and [`CLAUDE.md`](https://github.com/juanluispaz/ts-sql-query/blob/master/CLAUDE.md) for the conventions of the project.

## Related projects

- [ts-sql-codegen](https://github.com/lorefnon/ts-sql-codegen): Utility that generates table mapper classes for ts-sql-query by inspecting a database through [tbls](https://github.com/k1LoW/tbls).

## License

[MIT](https://github.com/juanluispaz/ts-sql-query/blob/master/LICENSE.md)
