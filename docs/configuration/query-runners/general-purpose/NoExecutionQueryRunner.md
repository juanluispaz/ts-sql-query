---
search:
  boost: 0.01
---
# NoExecutionQueryRunner

A query runner that executes nothing: every query, and every statement of a transaction, is rejected with a `TsSqlProcessingError` of reason `QUERY_NOT_ALLOWED`, without reaching a database. It's for a connection made only to use its methods, like converting the types of its database to [SQL data types](../../../advanced/sql-data-types.md#the-types-of-a-database) in a program that reads the catalogue. It writes the SQL of its database, as [`NoopQueryRunner`](NoopQueryRunner.md) does, which instead pretends to execute and returns empty results.

!!! success "Supported databases"

    - [MariaDB](../../supported-databases/mariadb.md)
    - [MySQL](../../supported-databases/mysql.md)
    - [Oracle](../../supported-databases/oracle.md)
    - [PostgreSQL](../../supported-databases/postgresql.md)
    - [SQLite](../../supported-databases/sqlite.md)
    - [SQL Server](../../supported-databases/sqlserver.md)

## Creating it

It needs nothing: the connection tells it its database, and it writes the SQL of that database.

```ts
import { NoExecutionQueryRunner } from "ts-sql-query";

const connection = new DBConnection(new NoExecutionQueryRunner());
const sqlDataType = connection.sqlDataTypeFrom('numeric(18,4)');
// { family: 'exact numeric', precision: 18, scale: 4, native: { postgreSql: 'numeric(18,4)' } }
```

An `execute…` method of a query, or a transaction, on that connection is rejected:

```ts
import { NoExecutionQueryRunner } from "ts-sql-query";

async function main() {
    const connection = new DBConnection(new NoExecutionQueryRunner());
    // Rejected with QUERY_NOT_ALLOWED
    await connection.selectFrom(tCompany).select({ id: tCompany.id }).executeSelectMany();
}
```
