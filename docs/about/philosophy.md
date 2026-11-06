---
search:
  boost: 0.13
---
# Philosophy and Design Goals

`ts-sql-query` brings SQL into TypeScript, with its types checked by the compiler. It doesn't hide SQL behind objects and conventions: it keeps the **declarative nature of SQL**, and adds **compile-time validation** and the possibility of building a query from reusable parts.

## Declarative first

As in SQL itself, a query is described, not programmed. A query that varies is written once with helpers such as `equalsIfValue`, `onlyWhen` and `dynamicConditionFor`, in the place where each part goes, so you can still read the query in the code. See [What a dynamic query can do](../dynamic/building-blocks.md).

Your own `if`s are for the cases that need them, when what to add depends on logic that those helpers can't express: see [Building a condition step by step](../dynamic/going-further/building-conditions.md).

## Type-safe by design

Every expression, projection, condition and join is checked by TypeScript. A reference to a column that doesn't exist, a comparison between different data types or a column that isn't available in that query shows up in the editor or the build, not at run time.

The same goes for optional conditions, parts of a query reused in another one, joins, aggregations and the type of the result.

## SQL-first, not ORM

`ts-sql-query` doesn't map your database into a hierarchy of classes or hide SQL behind a "model layer". You write SQL, with types.

## Transparent and explicit

Every condition, join, subquery and projection is visible in your code, so you can tell from it what SQL will be generated.

The library sends to the database only the query you asked for. The exceptions are [`executeSelectPage`](../queries/select-page.md), which sends two queries, the rows and the count, and the statements of a [transaction](../queries/transaction.md): begin, commit and rollback.

## Unified SQL dialect and database-specific features

`ts-sql-query` uses a **single SQL dialect**, inspired primarily by [PostgreSQL](../configuration/supported-databases/postgresql.md) and [SQLite](../configuration/supported-databases/sqlite.md), with naming conventions adapted to the JavaScript and TypeScript ecosystem.

The methods are named after what they do in the query, not after the keywords of one database, like `equals`, `startsWith`, `containsIfValue` and `orderByFromString`. The library writes them as the SQL of the database you use.

### Cross-database compatibility

A query that uses what the databases have in common is written in the same way for [MariaDB](../configuration/supported-databases/mariadb.md), [MySQL](../configuration/supported-databases/mysql.md), [Oracle](../configuration/supported-databases/oracle.md), [PostgreSQL](../configuration/supported-databases/postgresql.md), [SQLite](../configuration/supported-databases/sqlite.md) and [SQL Server](../configuration/supported-databases/sqlserver.md).

You choose the database by extending its connection class. From that point on, the SQL is written for that database, and the compiler offers only what it has.

### Database-specific extensions

Besides what is common, `ts-sql-query` offers features of a specific database, available only when you use its connection class. If you use a feature that your database doesn't have, TypeScript rejects it at compile time.

## Why it exists

Writing SQL as text leads to duplication, failures at run time and unsafe string manipulation. `ts-sql-query` was born out of the need to write real SQL, safely, in TypeScript, staying close to the language that actually runs in the database.

## When to use it

Use `ts-sql-query` if:

- You want the precision of SQL with the checks of TypeScript.
- You need queries that vary, without losing control over the SQL they generate.
- You want your queries to reflect the shape of your database directly.
