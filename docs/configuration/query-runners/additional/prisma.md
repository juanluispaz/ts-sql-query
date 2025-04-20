---
search:
  boost: 0.573
---
# prisma

This query runner allows executing SQL queries using a [Prisma](https://www.prisma.io) client. It is compatible with Prisma 5 and 6. Although it may also work with Prisma 3 and 4, this has not been tested. To use it, you must enable interactive transactions in your Prisma schema. See the [documentation](https://www.prisma.io/docs/guides/performance-and-optimization/prisma-client-transactions-guide#interactive-transactions-in-preview) for how to configure this.

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

Enables executing queries through a [Prisma](https://www.prisma.io) connection obtained from a pool.
    
```ts
import { PrismaClient } from '@prisma/client'
import { PrismaQueryRunner } from "ts-sql-query/queryRunners/PrismaQueryRunner";

const prisma = new PrismaClient()

async function main() {
    const connection = new DBConnection(new PrismaQueryRunner(prisma));
    // Do your queries here
}
```

## Transactions

Prisma distinguishes between short (sequential) and long-running (interactive) transactions. You must understand this concept in order to use Prisma's transactions properly. The [blog page](https://www.prisma.io/blog/how-prisma-supports-transactions-x45s1d5l0ww1) explaining it, the [transactions guide](https://www.prisma.io/docs/guides/performance-and-optimization/prisma-client-transactions-guide/) and the [transaction page](https://www.prisma.io/docs/concepts/components/prisma-client/transactions) details the differences.

In a few words:

- A **short-running transaction** (NOT SUPPORTED, also called sequential operations) allows you to execute multiple queries in a single call to the Prisma server; this allows Prisma to optimize the execution of all the queries in a single database call (if the database support it) or reduce the transaction's duration to the minimum possible. The limitation is you cannot depend on the result of one query as input for the next one.
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

You can pass as the second argument of the `PrismaQueryRunner` constructor a configuration for long-running transactions. The configuration object support the following properties:

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

## Accessing to the Prisma Client from the connection

If you want to access the underlying Prisma Client from your connection object, you can define an accessor method in your connection class like:

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
