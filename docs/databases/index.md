---
search:
  boost: 0.59
---
<!-- doc-code-template: postgresql -->
# Databases

ts-sql-query works with MariaDB, MySQL, Oracle, PostgreSQL, SQLite and SQL Server. The code of a query is the same on all of them: the library writes the SQL of each one, and a feature a database doesn't have doesn't compile on its connection. The pages of this part have what is particular to each database: how to declare its connection, what it offers and what it doesn't, the functions of the library to create in it, the drivers it runs with, and the errors it gives. What a query does is in [Queries](../queries/basic-query-structure.md), and how to map your tables and types in [Configuration](../configuration/connection.md).

## The connection of each database

The connection of your database is a class of yours that extends the one of the database, imported from its path; it runs the queries with the query runner of the driver you use:

| Database | Its connection | Imported from | Query runners |
|---|---|---|---|
| [MariaDB](mariadb/index.md) | `MariaDBConnection` | `ts-sql-query/mariadb` | [mariadb](mariadb/query-runners/mariadb.md), [mysql2](mysql/query-runners/mysql2.md), [Bun SQL for MySQL](mysql/query-runners/bun_sql_mysql.md) |
| [MySQL](mysql/index.md) | `MySqlConnection` | `ts-sql-query/mysql` | [mysql2](mysql/query-runners/mysql2.md), [mariadb](mariadb/query-runners/mariadb.md), [Bun SQL for MySQL](mysql/query-runners/bun_sql_mysql.md) |
| [Oracle](oracle/index.md) | `OracleConnection` | `ts-sql-query/oracle` | [oracledb](oracle/query-runners/oracledb.md) |
| [PostgreSQL](postgresql/index.md) | `PostgreSqlConnection` | `ts-sql-query/postgresql` | [pg](postgresql/query-runners/pg.md), [postgres](postgresql/query-runners/postgres.md), [pglite](postgresql/query-runners/pglite.md), [Bun SQL for PostgreSQL](postgresql/query-runners/bun_sql_postgres.md) |
| [SQLite](sqlite/index.md) | `SqliteConnection` | `ts-sql-query/sqlite` | [better-sqlite3](sqlite/query-runners/better-sqlite3.md), [node:sqlite](sqlite/query-runners/node_sqlite.md), [sqlite-wasm OO1](sqlite/query-runners/sqlite-wasm-OO1.md), [Bun Sqlite](sqlite/query-runners/bun_sqlite.md), [Bun SQL for SQLite](sqlite/query-runners/bun_sql_sqlite.md) |
| [SQL Server](sqlserver/index.md) | `SqlServerConnection` | `ts-sql-query/sqlserver` | [mssql](sqlserver/query-runners/mssql.md) |

```ts
import { PostgreSqlConnection } from "ts-sql-query/postgresql";

class DBConnection extends PostgreSqlConnection<'DBConnection'> { }
```

How the connection is created for each request, and how it receives the query runner, is in [Connection](../configuration/connection.md).

## The pages of each database

Each database has the same pages:

| Page | What it has |
|---|---|
| Configuration | How to declare the connection; a table of what it offers and what it doesn't, with a link to the page of each feature; its compatibility version, to write the SQL of an older version; and what behaves in its own way on that database, like its collations, its uuids, its rounding, its dates and its time zones |
| Functions | The functions of the library to create in the database for the operations it doesn't have, and the optional ones that make some queries shorter (`libraryFunctions`); on SQLite, the ones registered in the connection of the driver, and its extensions |
| Query runners | One page per driver: how to create its query runner, and what is particular to that driver |
| Errors | How each error of the database maps to the reason the library gives it, to look up the code or the message of an error |

## What changes from one database to another

The pages of [Queries](../queries/basic-query-structure.md) and [Configuration](../configuration/connection.md) say, where a feature varies, what each database offers, side by side. The table *What it offers and what it doesn't* of each database has the same features from the point of view of that database, and its version: on a version older than the one a feature needs, the database rejects the query. Declaring that version in the compatibility version of the connection makes the library write, where it can, the SQL that version has.
