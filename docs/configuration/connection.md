---
search:
  boost: 0.54
---
# Connection

A connection object is what you run your queries with. You define one class for your database, and create an instance of it with a query runner, which connects it to your driver. This page has how to do both, and the options that apply to every database. What is particular to one database is on [its own page](supported-databases/postgresql.md).

## Defining the connection object

You define a class that extends the connection class of your database. It receives one generic argument: a name for the database in your system, which the types use to tie your tables and your queries to this connection.

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConnection extends PostgreSqlConnection<'DBConnection'> { }
```

| Database | Class to extend | Imported from |
|---|---|---|
| [MariaDB](supported-databases/mariadb.md) | `MariaDBConnection` | `ts-sql-query/connections/MariaDBConnection` |
| [MySQL](supported-databases/mysql.md) | `MySqlConnection` | `ts-sql-query/connections/MySqlConnection` |
| [Oracle](supported-databases/oracle.md) | `OracleConnection` | `ts-sql-query/connections/OracleConnection` |
| [PostgreSQL](supported-databases/postgresql.md) | `PostgreSqlConnection` | `ts-sql-query/connections/PostgreSqlConnection` |
| [SQLite](supported-databases/sqlite.md) | `SqliteConnection` | `ts-sql-query/connections/SqliteConnection` |
| [SQL Server](supported-databases/sqlserver.md) | `SqlServerConnection` | `ts-sql-query/connections/SqlServerConnection` |

The class is also the place for what your whole application shares:

- The options on this page, and the ones of each database, like its `compatibilityVersion`: see the page of your database.
- The [stored procedures and functions](mapping.md#calling-a-stored-procedure) you call, and the [sequences](mapping.md#using-a-sequence) you read.
- The conversion of your [custom types](column-types.md#custom-types).
- Your own [SQL fragments](../queries/sql-fragments.md).

## Instantiating the connection with the database connection

The connection receives a [query runner](query-runners/index.md), which connects it to your database driver. [Which one for your database](query-runners/index.md#which-one-for-your-database) lists them all.

```ts
import { Pool } from 'pg';
import { PgPoolQueryRunner } from "ts-sql-query/queryRunners/PgPoolQueryRunner";

const pool = new Pool();

async function main() {
    const connection = new DBConnection(new PgPoolQueryRunner(pool));
    // Do your queries here
    connection // ...
    
    /*
     * Maybe you want to perform the queries in a transaction:
     * await connection.transaction(async () => {
     *     // Do your queries here
     * })
     * 
     * You also can manage the transaction at low level:
     * await connection.beginTransaction();
     * await connection.commit();
     * await connection.rollback();
     */
}
```

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Instantiating the connection with a mock database connection

A mock takes the place of the database in a unit test: your function receives each query, checks it and decides its result, and nothing reaches a database. [MockQueryRunner](query-runners/general-purpose/MockQueryRunner.md) has the details.

```ts
import { MockQueryRunner } from "ts-sql-query/queryRunners/MockQueryRunner";

test('my db test', () => {
    const connection = new DBConnection(new MockQueryRunner(
        (type, query, params, index) => {
            switch (index) {
            case 0:
                expect(type).toBe('delete');
                expect(query).toBe('delete from customer where id = $1');
                expect(params).toEqual([10]);
                return 1; // Returns the result of the query execution
            default:
                throw new Error('Unexpected query');
            }
        }
    ));

    // Do your queries here, example:
    const deleteCustomer = connection.deleteFrom(tCustomer)
        .where(tCustomer.id.equals(10))
        .executeDelete();

    return deleteCustomer.then((result) => {
        expect(result).toBe(1);
    });
});
```

## Allowing empty string

By default, the empty string is treated as having no value, on every database:

- A `''` you send is sent as `null`. Setting a required column to `''` is then rejected by the database, because the column doesn't admit `null`.
- A `''` that comes from the database is read as having no value.
- For the methods whose name ends in `IfValue`, `''` [has no value](../queries/dynamic-queries.md), so they leave out the condition or the column.

To send and receive empty strings, set the `allowEmptyString` property of the connection to `true`. Oracle is different whatever the property says: it doesn't keep `''` in a text column, it stores `null`.

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConnection extends PostgreSqlConnection<'DBConnection'> { 
    protected override allowEmptyString = true
}
```

Decide this at the beginning of the project: changing it later changes the SQL of every query that uses the `IfValue` methods with an empty string.

## Insensitive strategies

An insensitive operation, like `startsWithInsensitive`, compares text without distinguishing upper and lower case. By default it's written calling the function `lower` on both sides, except the operations that use `like` on PostgreSQL, which are written with `ilike`. Setting **`insensitiveCollation`** on the connection adds a `… collate <name>` clause instead, which can also ignore accents or follow the rules of a language, by naming a collation of your database. Choose one for the language your users write in.

```typescriptreact
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConnection extends PostgreSqlConnection<'DBConnection'> { 
    override insensitiveCollation = 'insensitive'
}
```

Set it to the **empty string** (`''`) to write the operation with no `lower()` and no collate, when your column or database is already case-insensitive.

!!! tip "The full guide is the Collations page"

    [Collations & case sensitivity](collations.md) has what a collation is and how to set one on a column or database, the [names to use on each database](collations.md#per-database), [`.collate('<name>')`](collations.md#collate-force-a-collation-per-value) for one value, [`replaceAllInsensitive`](collations.md#replaceallinsensitive-the-insensitive-twin), and [`replaceCollation`](collations.md#replacecollation-sql-server-and-oracle) for `replaceAll` on SQL Server and Oracle.

## Quoting identifiers

The names of the tables, views and columns are written as they are, and quoted only when they need it: when the name is a reserved keyword of the database, or it has a space or another character an unquoted identifier can't have. The connection decides it with three protected methods you can override:

- `isReservedKeyword(word)`: whether the word is a reserved keyword (quoted when used as an identifier); override it to add the words of your database version, or of an extension.
- `forceAsIdentifier(identifier)`: the identifier quoted the way the database does it (`"name"`, `` `name` ``, `[name]`).
- `escape(identifier, strict)`: the identifier as it is written in the query; by default it calls `forceAsIdentifier` only when the identifier needs it.

To quote every identifier, override `escape`:

```typescriptreact
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConnection extends PostgreSqlConnection<'DBConnection'> { 
    protected override escape(identifier: string, _strict: boolean): string {
        return this.forceAsIdentifier(identifier)
    }
}
```

A select of the id and the first name of a customer is then written `select "id" as "id", "first_name" as "firstName" from "customer" where "id" = $1` instead of `select id as id, first_name as "firstName" from customer where id = $1`.

!!! warning "Oracle"

    Oracle stores an unquoted name in upper case, so a quoted lower-case one doesn't find it (`ORA-00942`, `ORA-00904`). If your schema was created with unquoted names, upper-case the identifier in the override: `this.forceAsIdentifier(identifier.toUpperCase())`.
