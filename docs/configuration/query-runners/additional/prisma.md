---
search:
  boost: 0.573
---
# prisma

This query runner allows executing SQL queries using a [Prisma](https://www.prisma.io) client. It requires Prisma 7.

!!! success "Supported databases"

    - [MariaDB](../../supported-databases/mariadb.md)
    - [MySQL](../../supported-databases/mysql.md)
    - [PostgreSQL](../../supported-databases/postgresql.md)
    - [SQLite](../../supported-databases/sqlite.md)
    - [SQL Server](../../supported-databases/sqlserver.md)

!!! danger "Experimental"

    This query runner is experimental.

    This implementation emulates the behaviour of Prisma's unconventional promise-like object, which can be challenging.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Using a connection pool

Enables executing queries through a [Prisma](https://www.prisma.io) client.

Prisma 7 requires a driver adapter to connect to the database. Therefore, you must instantiate the Prisma client using the generated client and the adapter corresponding to your database.

The generated Prisma client and the adapter must correspond to the same database.

=== "MariaDB"
    ```ts
    import { PrismaMariaDb } from '@prisma/adapter-mariadb'
    import { PrismaClient } from './prisma/generated/mariadb/client.js'
    import { PrismaQueryRunner } from 'ts-sql-query/queryRunners/PrismaQueryRunner'

    const prisma = new PrismaClient({
        adapter: new PrismaMariaDb({
            host: 'localhost',
            user: 'root',
            password: 'my-secret-pw',
            database: 'test',
        })
    })

    async function main() {
        const connection = new DBConnection(new PrismaQueryRunner(prisma))
        // Do your queries here
    }
    ```
=== "MySQL"
    ```ts
    import { PrismaMariaDb } from '@prisma/adapter-mariadb'
    import { PrismaClient } from './prisma/generated/mysql/client.js'
    import { PrismaQueryRunner } from 'ts-sql-query/queryRunners/PrismaQueryRunner'

    const prisma = new PrismaClient({
        adapter: new PrismaMariaDb({
            host: 'localhost',
            user: 'root',
            password: 'my-secret-pw',
            database: 'sys',
        })
    })

    async function main() {
        const connection = new DBConnection(new PrismaQueryRunner(prisma))
        // Do your queries here
    }
    ```
===+ "PostgreSQL"
    ```ts
    import { PrismaPg } from '@prisma/adapter-pg'
    import { PrismaClient } from './prisma/generated/postgresql/client.js'
    import { PrismaQueryRunner } from 'ts-sql-query/queryRunners/PrismaQueryRunner'

    const prisma = new PrismaClient({
        adapter: new PrismaPg('postgresql://postgres:mysecretpassword@localhost:5432/postgres')
    })

    async function main() {
        const connection = new DBConnection(new PrismaQueryRunner(prisma))
        // Do your queries here
    }
    ```
=== "SQLite"
    ```ts
    import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
    import { PrismaClient } from './prisma/generated/sqlite/client.js'
    import { PrismaQueryRunner } from 'ts-sql-query/queryRunners/PrismaQueryRunner'

    const prisma = new PrismaClient({
        adapter: new PrismaBetterSqlite3({
            url: 'src/examples/prisma/generated/prismasqlitetest.db'
        })
    })

    async function main() {
        const connection = new DBConnection(new PrismaQueryRunner(prisma))
        // Do your queries here
    }
    ```
=== "SQL Server"
    ```ts
    import { PrismaMssql } from '@prisma/adapter-mssql'
    import { PrismaClient } from './prisma/generated/sqlserver/client.js'
    import { PrismaQueryRunner } from 'ts-sql-query/queryRunners/PrismaQueryRunner'

    const prisma = new PrismaClient({
        adapter: new PrismaMssql({
            server: 'localhost',
            port: 1433,
            user: 'sa',
            password: 'yourStrong(!)Password',
            options: {
                trustServerCertificate: true,
            },
        })
    })

    async function main() {
        const connection = new DBConnection(new PrismaQueryRunner(prisma))
        // Do your queries here
    }
    ```

## Transactions

Prisma distinguishes between short (sequential) and long-running (interactive) transactions. You must understand this concept in order to use Prisma's transactions properly. The [blog page](https://www.prisma.io/blog/how-prisma-supports-transactions-x45s1d5l0ww1) explaining it and the [transaction page](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) detail the differences.

In a few words:

- A **short-running transaction** (NOT SUPPORTED, also called sequential operations) allows you to execute multiple Prisma operations together; this allows Prisma to optimize the execution of all the queries and reduce the transaction's duration to the minimum possible. The limitation is you cannot depend on the result of one query as input for the next one.
- A **long-running transaction** (also called interactive transactions in the documentation) allows you to obtain a dedicated connection to the database that will allow you to execute all the queries within a transaction. This dedicated connection allows you to query the database while the transaction is open, and the queries can be performed at different times. This model corresponds to the transaction model supported by the other libraries used in `ts-sql-query` to connect with the database.

The consequence of this design is you cannot call the low-level transaction methods:

- `beginTransaction`
- `commit`
- `rollback`

But, you can use `connection.transaction` method to perform a transaction in Prisma (under the hood, it calls `prismaClient.$transaction`). When you use `connection.transaction` method, you can combine `ts-sql-query` and Prisma operations.

## Short-running transactions

!!! failure "Not supported"

    Prisma's short-running transactions are not supported in `ts-sql-query`. Make sure to distinguish Prisma's short-running transactions from standard SQL transactions.

## Long-running transactions

It is called, as well, interactive transactions in the Prisma documentation.

You can pass as the second argument of the `PrismaQueryRunner` constructor a configuration for long-running transactions. The configuration object supports the following properties:

- `interactiveTransactionsOptions`(object, optional, default `undefined`): Object with the second parameter of the `$transaction` method in the Prisma client object. It supports the following properties: 
  - `maxWait` (number, optional, default `2000`): The maximum amount of time (milliseconds) the Prisma Client will wait to acquire a transaction from the database. The default is 2 seconds.
  - `timeout` (number, optional, default `5000`): The maximum amount of time (milliseconds) the interactive transaction can run before being cancelled and rolled back. The default value is 5 seconds.

!!! warning

    Prisma doesn't allow to specify an access mode in the isolation level when you initiate a transaction.

```ts
const connection = new DBConnection(new PrismaQueryRunner(prisma));

const transactionResult = connection.transaction(async () => {
    const companyId = await connection.insertInto ...
    const customerId = await connection.insertInto ... // using the companyId

    return {companyId, customerId};
});
```

If you want to use `prismaClient.$transaction` directly, you must create the `PrismaQueryRunner` using the Prisma client provided by the `$transaction` function.

```ts
const transactionResult = prisma.$transaction(async (prismaTransaction) => {
    const connection = new DBConnection(new PrismaQueryRunner(prismaTransaction));

    const companyId = await connection.insertInto ...
    const customerId = await connection.insertInto ... // using the companyId

    return {companyId, customerId};
});
```

## Accessing the Prisma Client from the connection

If you want to access the underlying Prisma Client from your connection object, you can define an accessor method in your connection class like:

In the following example, `PrismaClient` refers to the generated Prisma client for your database.

```ts
class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    getPrismaClient(): PrismaClient {
        const prisma = this.queryRunner.getCurrentNativeTransaction() || this.queryRunner.getNativeRunner()
        /*
         * This code attempts to retrieve the current Prisma client being used in the transaction. 
         * If there is no active transaction, it falls back to the default Prisma client instance.
         */
        if (prisma instanceof PrismaClient) {
            return prisma
        } else {
            throw new Error('Unable to find the Prisma Client')
        }
    }
}
```
