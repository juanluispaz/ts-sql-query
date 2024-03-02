# Additional query runners

**Important**: A ts-sql-query connection object and the queries runners objects received as constructor's arguments represent a dedicated connection; consequently, don't share connections between requests when you are handling HTTP requests; create one connection object per request with its own query runners. Even when the ts-sql-query connection object uses a query runner that receives a connection pool, the ts-sql-query connection sill represents a dedicated connection to the database extracted automatically from the pool and must not be shared.

## mysql

### mysql (with a connection pool)

It allows to execute the queries using a [mysql](https://www.npmjs.com/package/mysql) connection pool.

**Supported databases**: mariaDB, mySql

```ts
import { createPool } from "mysql";
import { MySqlPoolQueryRunner } from "ts-sql-query/queryRunners/MySqlPoolQueryRunner";

const pool  = createPool({
  connectionLimit : 10,
  host            : 'example.org',
  user            : 'bob',
  password        : 'secret',
  database        : 'my_db'
});

async function main() {
    const connection = new DBConnection(new MySqlPoolQueryRunner(pool));
    // Do your queries here
}
```

### mysql (with a connection)

It allows to execute the queries using a [mysql](https://www.npmjs.com/package/mysql) connection.

**Supported databases**: mariaDB, mySql

```ts
import { createPool } from "mysql";
import { MySqlQueryRunner } from "ts-sql-query/queryRunners/MySqlQueryRunner";

const pool  = createPool({
  connectionLimit : 10,
  host            : 'example.org',
  user            : 'bob',
  password        : 'secret',
  database        : 'my_db'
});

function main() {
    pool.getConnection((error, mysqlConnection) => {
        if (error) {
            throw error;
        }
        try {
            const connection = new DBConnection(new MySqlQueryRunner(mysqlConnection));
            doYourLogic(connection).finnaly(() => {
                mysqlConnection.release();
            });
        } catch(e) {
            mysqlConnection.release();
            throw e;
        }
    });
}

async function doYourLogic(connection: DBConnection) {
    // Do your queries here
}
```

## prisma

**EXPERIMENTAL**: This implementation emulates the behaviour of the promise-not-so-like object returned by Prisma; but this can be challenging.

It allows to execute the queries using a [Prisma](https://www.prisma.io) client. It supports Prisma 5. It could work as well in Prima 3 and 4, but not tested, if you enable the interactive transactions it in your Prisma Schema (see the [documentation](https://www.prisma.io/docs/guides/performance-and-optimization/prisma-client-transactions-guide#interactive-transactions-in-preview) to find how to do it).

**Supported databases**: mariaDB, mySql, postgreSql, sqlite, sqlServer

```ts
import { PrismaClient } from '@prisma/client'
import { PrismaQueryRunner } from "ts-sql-query/queryRunners/PrismaQueryRunner";

const prisma = new PrismaClient()

async function main() {
    const connection = new DBConnection(new PrismaQueryRunner(prisma));
    // Do your queries here
}
```

### Transactions

Prisma distinguishes between short (sequential) and long-running (interactive) transactions. You must understand this concept in order to use Prisma's transactions properly. The [blog page](https://www.prisma.io/blog/how-prisma-supports-transactions-x45s1d5l0ww1) explaining it, the [transactions guide](https://www.prisma.io/docs/guides/performance-and-optimization/prisma-client-transactions-guide/) and the [transaction page](https://www.prisma.io/docs/concepts/components/prisma-client/transactions) details the differences.

In a few words:

- A **short-running transaction** (NOT SUPPORTED, also called sequential operations) allows you to execute multiple queries in a single call to the Prisma server; this allows Prisma to optimize the execution of all the queries in a single database call (if the database support it) or reduce the transaction's duration to the minimum possible. The limitation is you cannot depend on the result of one query as input for the next one.
- A **long-running transaction** (also called interactive transactions in the documentation) allows you to obtain a dedicated connection to the database that will allow you to execute all the queries within a transaction. This dedicated connection allows you to query the database while the transaction is open, and the queries can be performed at different times. This model corresponds to the transaction model supported by the other libraries used in ts-sql-query to connect with the database.

The consequence of this design is you cannot call the low-level transaction methods:

- `beginTransaction`
- `commit`
- `rollback`

But, you can use `connection.transaction` method to perform a transaction in Prisma (under the hood, it calls `prismaClient.$transaction`). When you use `connection.transaction` method, you can combine ts-sql-query and Prisma operations.

### Short-running transactions

**NOT SUPPORTED**: Prisma's short-running transactions are not supported in ts-sql-query. Make sure to distinguish Prisma's short-running transactions from standard SQL transactions.

### Long-running transactions

It is called, as well, interactive transactions in Prisma's documentation.

You can pass as the second argument of the `PrismaQueryRunner` constructor a configuration for long-running transactions. The configuration object support the following properties:

- `interactiveTransactionsOptions`(object, optional, default `undefined`): Object with the second parament of the `$transaction` method in the Prisma client object. It supports the following properties: 
  - `maxWait` (number, optional, default `2000`): The maximum amount of time (milliseconds) the Prisma Client will wait to acquire a transaction from the database. The default is 2 seconds.
  - `timeout` (number, optional, default `5000`): The maximum amount of time (milliseconds) the interactive transaction can run before being cancelled and rolled back. The default value is 5 seconds.
  - `isolationLevel` (Prisma.TransactionIsolationLevel, optional): Sets the [transaction isolation level](https://www.prisma.io/docs/concepts/components/prisma-client/transactions#transaction-isolation-level). By default this is set to the value currently configured in your database.

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

### Accessing to the Prisma Client from the connection

If you want to access the underlying Prisma Cient from your connection object you can define an accesor method in your connection class like:

```ts
class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    getPrismaClient(): PrismaClient {
        const prisma = this.queryRunner.getCurrentNativeTransaction() || this.queryRunner.getNativeRunner()
        if (prisma instanceof PrismaClient) {
            return prisma
        } else {
            throw new Error('Unable to find the Prisma Client')
        }
    }
}
```

## sqlite

It allows to execute the queries using an [sqlite](https://www.npmjs.com/package/sqlite) connection.

**Supported databases**: sqlite

```ts
import { Database } from 'sqlite3';
import { open } from 'sqlite';
import { SqliteQueryRunner } from "ts-sql-query/queryRunners/SqliteQueryRunner";

const dbPromise = open({ 
    filename: './database.sqlite',
    driver: sqlite3.Database
});

async function main() {
    const db = await dbPromise;
    const connection = new DBConnection(new SqliteQueryRunner(db));
    // Do your queries here
}
```
