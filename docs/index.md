---
search:
  boost: 0.15
---
<div style="display: flex; flex-direction: column; align-items: center; margin-top: 1.5em; margin-bottom: 2em; gap: 1em; text-align: center;">

  <img src="logo.svg" width="100" alt="logo" />

  <h1 style="margin: 0; font-size: 2.5em;">ts-sql-query</h1>

  <p style="font-size: 1.1em; font-weight: 500; color: var(--md-primary-fg-color);">
    Type-safe SQL query builder for TypeScript
  </p>

  <div style="display: flex; gap: 0.75em; flex-wrap: wrap; justify-content: center;">
    <a href="https://www.npmjs.com/package/ts-sql-query" target="_blank">
      <img src="https://img.shields.io/npm/v/ts-sql-query?label=npm&style=for-the-badge" alt="npm badge" />
    </a>
    <a href="https://github.com/sponsors/juanluispaz" target="_blank">
      <img src="https://img.shields.io/badge/sponsor-GitHub-ff69b4?logo=githubsponsors&style=for-the-badge" alt="sponsor badge" />
    </a>
  </div>

</div>

## What is ts-sql-query?

`ts-sql-query` is a type-safe SQL query builder for TypeScript. It allows you to write dynamic queries with full type safety — meaning that the TypeScript compiler can validate your queries at compile time.

Type-safe SQL means that mistakes in your queries are caught at compile time. With `ts-sql-query`, you can safely refactor your database schema: any issues will be surfaced immediately by the compiler.

!!! note ""

    `ts-sql-query` is _not_ an **ORM** — it focuses on full SQL control with type safety.

![](demo.gif)

## Why?

There are many libraries available in JavaScript/TypeScript that allows querying a SQL database, but they are typically:

- ORMs often limit direct control over SQL and can obscure database capabilities.
- Many query builders rely on fragile string concatenation.
- Some libraries lack proper type-safety integration.
- Most tools make it hard to write truly dynamic SQL in a safe and expressive way.

`ts-sql-query` addresses these issues by providing a type-safe, SQL-centric API, with rich support for building dynamic queries in a declarative style.

For more details on the principles behind the library, see [Philosophy and Design Goals](./about/philosophy.md).

## Supported Databases

- [MariaDB](./configuration/supported-databases/mariadb.md)
- [MySQL](./configuration/supported-databases/mysql.md)
- [Oracle](./configuration/supported-databases/oracle.md)
- [PostgreSQL](./configuration/supported-databases/postgresql.md)
- [SQLite](./configuration/supported-databases/sqlite.md)
- [SQL Server](./configuration/supported-databases/sqlserver.md)

`ts-sql-query` uses a unified dialect inspired by [SQLite](./configuration/supported-databases/sqlite.md) and [PostgreSQL](./configuration/supported-databases/postgresql.md), with naming conventions adapted to JavaScript. It automatically generates the correct SQL for your target database.

## Install

Install with [npm](https://www.npmjs.com/):

```sh
$ npm install --save ts-sql-query
```

`ts-sql-query` does not expose a global export. Instead, you should import specific modules as described in the documentation, depending on the features you need. Only the modules listed below are considered part of the public API — avoid importing from any other internal paths, as they may change without prior notice:

- `ts-sql-query/Connection`
- `ts-sql-query/Table`
- `ts-sql-query/TypeAdapter`
- `ts-sql-query/View`
- `ts-sql-query/connections/*`
- `ts-sql-query/extras/*`
- `ts-sql-query/queryRunners/*`
- `ts-sql-query/dynamicCondition`

Any reference to a file outside of the previous list can change at any moment.

## Related projects

- [ts-sql-codegen](https://github.com/lorefnon/ts-sql-codegen): Utility that generates table mapper classes for `ts-sql-query` by inspecting a database through [tbls](https://github.com/k1LoW/tbls).

## License

[MIT](https://opensource.org/licenses/MIT)
