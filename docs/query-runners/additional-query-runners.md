# Additional query runners

**Important**: A ts-sql-query connection object and the queries runners objects received as constructor's arguments represent a dedicated connection; consequently, don't share connections between requests when you are handling HTTP requests; create one connection object per request with its own query runners. Even when the ts-sql-query connection object uses a query runner that receives a connection pool, the ts-sql-query connection sill represents a dedicated connection to the database extracted automatically from the pool and must not be shared.

## any-db

### any-db (with connection pool)

**DEPRECATED**: [any-db](https://www.npmjs.com/package/any-db) is not maintained any more.

It allows to execute the queries using an [any-db](https://www.npmjs.com/package/any-db) connection pool. To use this query runner you need to install as well [any-db-transaction](https://www.npmjs.com/package/any-db-transaction).

**Supported databases**: mariaDB, mySql, postgreSql, sqlite, sqlServer

It internally uses:

- [tedious](https://www.npmjs.com/package/tedious) for connections to SqlServer
- [mysql](https://www.npmjs.com/package/mysql) for connections to MariaDB and MySql. It is not working properly due the bug [https://github.com/Hypermediaisobar-admin/node-any-db-mssql/issues/1](https://github.com/Hypermediaisobar-admin/node-any-db-mssql/issues/1)
- [pg](https://www.npmjs.com/package/pg) for connections to PostgreSql
- [sqlite3](https://www.npmjs.com/package/sqlite3) for connections to SqlLite. It is not working properly due the bug [https://github.com/grncdr/node-any-db/issues/83](https://github.com/grncdr/node-any-db/issues/83)

**Note**: All of these implementations have a direct implementation here as alternative.

```ts
import { createPool } from 'any-db'
import { AnyDBPoolQueryRunner } from "ts-sql-query/queryRunners/AnyDBPoolQueryRunner";

const pool = createPool('postgres://user:pass@localhost/dbname', {
  min: 5,
  max: 15
});

async function main() {
    const connection = new DBConnection(new AnyDBPoolQueryRunner(pool));
    // Do your queries here
}
```

### any-db (with connection)

**DEPRECATED**: [any-db](https://www.npmjs.com/package/any-db) is not maintained any more.

It allows to execute the queries using an [any-db](https://www.npmjs.com/package/any-db) connection. To use this query runner you need to install as well [any-db-transaction](https://www.npmjs.com/package/any-db-transaction).

**Supported databases**: mariaDB, mySql, postgreSql, sqlite, sqlServer

It internally uses:

- [tedious](https://www.npmjs.com/package/tedious) for connections to SqlServer
- [mysql](https://www.npmjs.com/package/mysql) for connections to MariaDB and MySql. It is not working properly due the bug [https://github.com/Hypermediaisobar-admin/node-any-db-mssql/issues/1](https://github.com/Hypermediaisobar-admin/node-any-db-mssql/issues/1)
- [pg](https://www.npmjs.com/package/pg) for connections to PostgreSql
- [sqlite3](https://www.npmjs.com/package/sqlite3) for connections to SqlLite. It is not working properly due the bug [https://github.com/grncdr/node-any-db/issues/83](https://github.com/grncdr/node-any-db/issues/83)

**Note**: All of these implementations have a direct implementation here as alternative.

```ts
import { createPool } from 'any-db'
import { AnyDBQueryRunner } from "ts-sql-query/queryRunners/AnyDBQueryRunner";

const pool = createPool('postgres://user:pass@localhost/dbname', {
  min: 5,
  max: 15
});

function main() {
    pool.acquire((error, anyDBConnection) => {
        if (error) {
            throw error;
        }
        try {
            const connection = new DBConnection(new AnyDBQueryRunner(anyDBConnection));
            doYourLogic(connection).finally(() => {
                pool.release(anyDBConnection);
            });
        } catch(e) {
            pool.release(anyDBConnection);
            throw e;
        }
    });
}

async function doYourLogic(connection: DBConnection) {
     // Do your queries here
}
```

## LoopBack DataSource

**DEPRECATED**: [LoopBack](https://loopback.io/) looks mostly dead, and databases connectors are very out-of-date and they doesn't offer full support to the required functionality.

It allows to execute the queries using a [LoopBack](https://loopback.io/) data source.

**Supported databases**: mariaDB, mySql, postgreSql, sqlite, sqlServer, oracle

It internally uses:

- [mysql](https://www.npmjs.com/package/mysql) for connections to MariaDB and MySql.
- [pg](https://www.npmjs.com/package/pg) for connections to PostgreSql.
- [sqlite3](https://www.npmjs.com/package/sqlite3) for connections to SqlLite.
- [tedious](https://www.npmjs.com/package/tedious) for connections to SqlServer.
- [oracledb](https://www.npmjs.com/package/oracledb) for connections to Oracle.

**Note**: All of these implementations have a direct implementation here as alternative.

**Only the following connectors are supported**:

- **mysql**, using `loopback-connector-mysql` package
- **postgresql**, using `loopback-connector-postgresql` package
- **sqlite3**, using `loopback-connector-sqlite3` package
- **mssql**, using `loopback-connector-mssql` package
- **oracle**, using `loopback-connector-oracle` package

```ts
import {juggler} from '@loopback/repository';
import { createLoopBackQueryRunner } from "ts-sql-query/queryRunners/LoopBackQueryRunner";

const db = new juggler.DataSource({
    name: 'db',
    connector: "postgresql",
    host: 'localhost',
    port: 5432,
    database: 'dbname',
    user: 'user',
    password: 'pass'
});

async function main() {
    const connection = new DBConnection(createLoopBackQueryRunner(db));
    // Do your queries here
}
```

## msnodesqlv8

**EXPERIMENTAL**: If you are going to use [msnodesqlv8](https://www.npmjs.com/package/msnodesqlv8), please, let me know. There is no way to test it easily.

It allows to execute the queries using an [msnodesqlv8](https://www.npmjs.com/package/msnodesqlv8) connection.

**Supported databases**: sqlServer (only on Windows)

```ts
const sql = require("msnodesqlv8");
import { MsNodeSqlV8QueryRunner } from "ts-sql-query/queryRunners/MsNodeSqlV8QueryRunner";

const connectionString = "server=.;Database=Master;Trusted_Connection=Yes;Driver={SQL Server Native Client 11.0}";

// Note: this code doesn't create a pool, maybe you want one

function main() {
    sql.open(connectionString, function (error, sqlServerConnection) {
        if (error) {
            throw error;
        }
        try {
            const connection = new DBConnection(new MsNodeSqlV8QueryRunner(sqlServerConnection));
            yourLogic(connection).finally(() => {
                sqlServerConnection.close((closeError) => {
                    throw closeError;
                });
            });
        } catch(e) {
            sqlServerConnection.close((closeError) => {
                throw closeError;
            });
            throw e;
        }
    });
}

async function doYourLogic(connection: DBConnection) {
     // Do your queries here
}
```

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

It allows to execute the queries using a [Prisma](https://www.prisma.io) client. It supports Prisma 2, Prisma 3 and Prisma 4.

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

Prisma distinguishes between short and long-running transactions. You must understand this concept in order to use Prisma's transactions properly. The [blog page](https://www.prisma.io/blog/how-prisma-supports-transactions-x45s1d5l0ww1) explaining it, the [transactions guide](https://www.prisma.io/docs/guides/performance-and-optimization/prisma-client-transactions-guide/) and the [transaction page](https://www.prisma.io/docs/concepts/components/prisma-client/transactions) details the differences.

In a few words:

- A **short-running transaction** allows you to execute multiple queries in a single call to the Prisma server; this allows Prisma to optimize the execution of all the queries in a single database call (if the database support it) or reduce the transaction's duration to the minimum possible. The limitation is you cannot depend on the result of one query as input for the next one.
- A **long-running transaction** (also called interactive transactions in the documentation) allows you to obtain a dedicated connection to the database that will allow you to execute all the queries within a transaction. This dedicated connection allows you to query the database while the transaction is open, and the queries can be performed at different times. This model corresponds to the transaction model supported by the other libraries used in ts-sql-query to connect with the database.

The consequence of this design is you cannot call the low-level transaction methods:

- `beginTransaction`
- `commit`
- `rollback`

But, you can use `connection.transaction` method to perform a transaction in Prisma (under the hood, it calls `prismaClient.$transaction`). When you use `connection.transaction` method, you can combine ts-sql-query and Prisma operations.

### Short-running transactions

To execute a short running transaction, you must call the transaction method in the connection object. The provided function must return an array with the promises returned directly by ts-sql-query or Prisma of the requested queries.

```ts
const [prismaCompany, otherCompanyID] = await connection.transaction(() => [
    prisma.company.create({
        data: {
            name: 'Prisma Company'
        }
    }),
    connection
        .insertInto(tCompany)
        .values({ name: 'Other Company' })
        .returningLastInsertedId()
        .executeInsert()
])
```

**Note**: `connection.transaction` have the same limitations that `prismaClient.$transaction`. Ensure the transaction method directly receives the promises returned by Prisma or ts-sql-query; don't use async/await in the function received by `connection.transaction` as an argument.

If you want to use `prismaClient.$transaction` directly, you must create the `PrismaQueryRunner` indicating as the second argument, in the config object, the property `forUseInTransaction`as `true`.

```ts
const connection = new DBConnection(new PrismaQueryRunner(prisma, {forUseInTransaction: true}));

const [prismaCompany, otherCompanyID] = await prisma.$transaction([
    prisma.company.create({
        data: {
            name: 'Prisma Company'
        }
    }),
    connection
        .insertInto(tCompany)
        .values({ name: 'Other Company' })
        .returningLastInsertedId()
        .executeInsert()
])
```

**Limitation**: When you enable the `forUseInTransaction` mode, the query must be executed in a transaction; otherwise the query will never be executed.

**Known issues**: Some are sent with wrong type in PostgreSQL when you use Prisma 4, see [PostgreSQL typecasting fixes](https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access#postgresql-typecasting-fixes) and the note in [$queryRawUnsafe](https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access#queryrawunsafe)

### Long-running transactions

It is called, as well, interactive transactions in Prisma's documentation.

To use the interactive transactions, you must enable it in your Prisma Schema (see the [documentation](https://www.prisma.io/docs/guides/performance-and-optimization/prisma-client-transactions-guide#interactive-transactions-in-preview) to find how to do it). Additionally, you must pass as the second argument of the `PrismaQueryRunner` constructor a configuration object enabling it. The configuration object support the following properties:

- `interactiveTransactions` (boolean, optional, default `false`): Enable the interactive transactions when is set to true.
- `interactiveTransactionsOptions`(object, optional, default `undefined`): Object with the second parament of the `$transaction` method in the Prisma client object. It supports the following properties: 
  - `maxWait` (number, optional, default `2000`): The maximum amount of time (milliseconds) the Prisma Client will wait to acquire a transaction from the database. The default is 2 seconds.
  - `timeout` (number, optional, default `5000`): The maximum amount of time (milliseconds) the interactive transaction can run before being cancelled and rolled back. The default value is 5 seconds.
  - `isolationLevel` (Prisma.TransactionIsolationLevel, optional): Sets the [transaction isolation level](https://www.prisma.io/docs/concepts/components/prisma-client/transactions#transaction-isolation-level). By default this is set to the value currently configured in your database.

```ts
const connection = new DBConnection(new PrismaQueryRunner(prisma, {interactiveTransactions: true}));

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

## tedious

### tedious (with a connection poll)

**DEPRECATED**: [tedious-connection-pool](https://www.npmjs.com/package/tedious-connection-pool) is not maintained any more.

It allows to execute the queries using a [tedious](https://www.npmjs.com/package/tedious) connection and a [tedious-connection-pool](https://www.npmjs.com/package/tedious-connection-pool) pool.

**Note**: This is not working due the bug [https://github.com/tediousjs/tedious-connection-pool/issues/60](https://github.com/tediousjs/tedious-connection-pool/issues/60)

**Supported databases**: sqlServer

```ts
const ConnectionPool = require('tedious-connection-pool');
import { TediousPoolQueryRunner } from "ts-sql-query/queryRunners/TediousPoolQueryRunner";

var poolConfig = {
    min: 2,
    max: 4,
    log: true
};

var connectionConfig = {
    userName: 'login',
    password: 'password',
    server: 'localhost'
};

var pool = new ConnectionPool(poolConfig, connectionConfig);

async function main() {
    const connection = new DBConnection(new TediousPoolQueryRunner(pool));
    // Do your queries here
}
```

### tedious (with a connection)

**NOTE**: If you are going to use this connector, let me know how to manage a proper connection pool.

It allows to execute the queries using a [tedious](https://www.npmjs.com/package/tedious) connection.

**Supported databases**: sqlServer

```ts
import { Connection } from 'tedious';
import { TediousQueryRunner } from "ts-sql-query/queryRunners/TediousQueryRunner";

var connectionConfig = {
    userName: 'login',
    password: 'password',
    server: 'localhost'
};

async function main() {
    const connection = new DBConnection(new TediousQueryRunner(new Connection(connectionConfig)));
    // Do your queries here
}
```