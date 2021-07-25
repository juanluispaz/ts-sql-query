# Additional query runners

**Important**: A ts-sql-query connection object and the queries runners objects received as constructor's arguments represent a dedicated connection; consequently, don't share connections between requests when you are handling HTTP requests; create one connection object per request with its own query runners. Even when the ts-sql-query connection object uses a query runner that receives a connection pool, the ts-sql-query connection sill represents a dedicated connection to the database extracted automatically from the pool and must not be shared.

## any-db

### any-db (with connection pool)

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
    const connection = new DBConection(new AnyDBPoolQueryRunner(pool));
    // Do your queries here
}
```

### any-db (with connection)

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
            const connection = new DBConection(new AnyDBQueryRunner(anyDBConnection));
            doYourLogic(connection).finally(() => {
                pool.release(anyDBConnection);
            });
        } catch(e) {
            pool.release(anyDBConnection);
            throw e;
        }
    });
}

async function doYourLogic(connection: DBConection) {
     // Do your queries here
}
```

## LoopBack DataSource

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
    const connection = new DBConection(createLoopBackQueryRunner(db));
    // Do your queries here
}
```

## msnodesqlv8

It allows to execute the queries using an [msnodesqlv8](https://www.npmjs.com/package/msnodesqlv8) connection.

**Supported databases**: sqlServer (only on Windows)

**Note**: If you are going to use msnodesqlv8, please, let me know.

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
            const connection = new DBConection(new MsNodeSqlV8QueryRunner(sqlServerConnection));
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

async function doYourLogic(connection: DBConection) {
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
    const connection = new DBConection(new MySqlPoolQueryRunner(pool));
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
            const connection = new DBConection(new MySqlQueryRunner(mysqlConnection));
            doYourLogic(connection).finnaly(() => {
                mysqlConnection.release();
            });
        } catch(e) {
            mysqlConnection.release();
            throw e;
        }
    });
}

async function doYourLogic(connection: DBConection) {
    // Do your queries here
}
```

## prisma

It allows to execute the queries using a [Prisma](https://www.prisma.io) client.

**Supported databases**: mariaDB, mySql, postgreSql, sqlite, sqlServer

```ts
import { PrismaClient } from '@prisma/client'
import { PrismaQueryRunner } from "ts-sql-query/queryRunners/PrismaQueryRunner";

const prisma = new PrismaClient()

async function main() {
    const connection = new DBConection(new PrismaQueryRunner(prisma));
    // Do your queries here
}
```

**Limitation**:

Long running transactions are not supported by Prisma and they are not likely to be supported in a future. For more information see the [limitations](https://www.prisma.io/docs/about/limitations#long-running-transactions), the [blog page](https://www.prisma.io/blog/how-prisma-supports-transactions-x45s1d5l0ww1) expaining it more, the [transactions guide](https://www.prisma.io/docs/guides/performance-and-optimization/prisma-client-transactions-guide/) and the [bug report](https://github.com/prisma/prisma/issues/1844).

The consequence of this limitation is you cannot call the low level transaction methods:

- `beginTransaction`
- `commit`
- `rollback`

But, you can use `connection.transaction` method to perform a transaction in Prisma (under the hood it calls `prismaClient.$transaction`). When you use `connection.transaction` method you can combine ts-sql-query and Prisma operations.

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

**Note**: `connection.transaction` have the same limitations that `prismaClient.$transaction`. Ensure the transaction method receives directly the promises returned by Prisma or ts-sql-query; and don't use async/await in the function received by `connection.transaction` as argument.

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
    const connection = new DBConection(new SqliteQueryRunner(db));
    // Do your queries here
}
```

## tedious

### tedious (with a connection poll)

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
    const connection = new DBConection(new TediousPoolQueryRunner(pool));
    // Do your queries here
}
```

### tedious (with a connection)

It allows to execute the queries using a [tedious](https://www.npmjs.com/package/tedious) connection and a [tedious-connection-pool](https://www.npmjs.com/package/tedious-connection-pool) pool.

**Supported databases**: sqlServer

```ts
const ConnectionPool = require('tedious-connection-pool');
import { TediousQueryRunner } from "ts-sql-query/queryRunners/TediousQueryRunner";

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

function main() {
    pool.acquire((error, sqlServerConnection) => {
        if (error) {
            throw error;
        }
        try {
            const connection = new DBConection(new TediousQueryRunner(sqlServerConnection));
            doYourLogic(connection).finnaly(() => {
                sqlServerConnection.release();
            });
        } catch(e) {
            sqlServerConnection.release();
            throw e;
        }
    });
}

async doYourLogic(connection: DBConection) {
    // Do your queries here
}
```