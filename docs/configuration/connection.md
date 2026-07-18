---
search:
  boost: 0.54
---
# Connection

## Defining the connection object

When you define the connection object, you extend your database connection class; that class receives one generic argument with a unique name for the database in your system.

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConnection extends PostgreSqlConnection<'DBConnection'> { }
```

## Allowing empty string

By default empty string as treated as null, if you want to allow sending and receiving empty strings to the database set the `allowEmptyString` property in the connection to true.

```typescriptreact
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConnection extends PostgreSqlConnection<'DBConnection'> { 
    override allowEmptyString = true
}
```

**Recommendation**: Set this flag at the beginning of the project or create a derivated connection if you require to do it. Changing this flag changes the way SQL queries are constructed when you use the methods that the name ends in 'IfValue'.

## Insensitive strategies

By default, when you perform an insensitive operation (like `startsWithInsensitive`) it is emitted by calling the function `lower` on the affected parts. Setting **`insensitiveCollation`** on the connection replaces that with a `… collate <name>` clause instead — which can do more than ASCII case folding (accent-insensitive, or language-specific rules) by naming a collation the engine ships. It is expected you use a collation specific to the language your users write in.

```typescriptreact
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConnection extends PostgreSqlConnection<'DBConnection'> { 
    override insensitiveCollation = 'insensitive'
}
```

Set it to the **empty string** (`''`) to emit the bare operation with no `lower()` and no collate — useful when the insensitive collate rules are already defined at the database level (your column / database is already case-insensitive).

!!! tip "The full guide is the Collations page"

    The dedicated [Collations & case sensitivity](collations.md) page is the complete story: what a collation is and how to set one on a column or database, the [per-database collation names](collations.md#per-database) to use here (and the PostgreSQL non-deterministic collation you must create first), the per-value [`.collate('<name>')`](collations.md#collate-force-a-collation-per-value) lever, the [`replaceAllInsensitive`](collations.md#replaceallinsensitive-the-insensitive-twin) method, and — for the `replaceAll` value corruption on SQL Server / Oracle — [`replaceCollation`](collations.md#replacecollation-sql-server-and-oracle).

## Instantiating the connection with the database connection

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

Have a mock database connection is useful when you want to make unit tests. Using a mock connection allows you to test your code against the generated query instead of running the query in the database.

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
