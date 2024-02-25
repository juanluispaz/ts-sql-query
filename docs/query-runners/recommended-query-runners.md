# Recommended query runners

**Important**: A ts-sql-query connection object and the queries runners objects received as constructor's arguments represent a dedicated connection; consequently, don't share connections between requests when you are handling HTTP requests; create one connection object per request with its own query runners. Even when the ts-sql-query connection object uses a query runner that receives a connection pool, the ts-sql-query connection sill represents a dedicated connection to the database extracted automatically from the pool and must not be shared.

## better-sqlite3

It allows to execute the queries using a [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) connection.

**Supported databases**: sqlite

```ts
import { BetterSqlite3QueryRunner } from "ts-sql-query/queryRunners/BetterSqlite3QueryRunner";
import * as betterSqlite3 from "better-sqlite3";

const db = betterSqlite3('foobar.db', options);

async function main() {
    const connection = new DBConnection(new BetterSqlite3QueryRunner(db));
    // Do your queries here
}
```

**Note**: better-sqlite3 supports synchronous query execution. See [Synchronous query runners](../advanced-usage.md#synchronous-query-runners) for more information.

### better-sqlite3 and UUIDs

To work with [UUIDs in Sqlite](supported-databases.md#uuid-strategies-in-sqlite) the default strategy is `uuid-extension` that requires the [uuid extension](https://sqlite.org/src/file?name=ext/misc/uuid.c); you can provide a compatible implementation as indicated here:

```ts
import * as betterSqlite3 from "better-sqlite3";
import { fromBinaryUUID, toBinaryUUID } from "binary-uuid";
import { v4 as uuidv4 } from "uuid";

const db = betterSqlite3(/* ... */);

// Implement uuid extension functions

db.function('uuid', uuidv4)
db.function('uuid_str', fromBinaryUUID)
db.function('uuid_blob', toBinaryUUID)

// ...
```

**Note**: The binary representation of this implementation is not aimed to be compatible with the uuid extension.

## mariadb

### mariadb (with a connection pool)

It allows to execute the queries using a [mariadb](https://www.npmjs.com/package/mariadb) connection pool.

**Supported databases**: mariaDB, mySql

```ts
import { createPool } from "mariadb";
import { MariaDBPoolQueryRunner } from "ts-sql-query/queryRunners/MariaDBPoolQueryRunner";

const pool = createPool({
    host: 'mydb.com', 
    user: 'myUser', 
    password: 'myPwd',
    database: 'myDB',
    connectionLimit: 5
});

async function main() {
    const connection = new DBConnection(new MariaDBPoolQueryRunner(pool));
    // Do your queries here
}
```

### mariadb (with a connection)

It allows to execute the queries using a [mariadb](https://www.npmjs.com/package/mariadb) connection.

**Supported databases**: mariaDB, mySql

```ts
import { createPool } from "mariadb";
import { MariaDBQueryRunner } from "ts-sql-query/queryRunners/MariaDBQueryRunner";

const pool = createPool({
    host: 'mydb.com', 
    user: 'myUser', 
    password: 'myPwd',
    database: 'myDB',
    connectionLimit: 5
});

async function main() {
    const mariaDBConnection = await pool.getConnection();
    try {
        const connection = new DBConnection(new MariaDBQueryRunner(mariaDBConnection));
        // Do your queries here
    } finally {
        mariaDBConnection.release();
    }
}
```

## mssql

### mssql (with a connection pool promise)

It allows to execute the queries using a [mssql](https://www.npmjs.com/package/mssql) connection pool promise.

**Supported databases**: sqlServer

```ts
import { ConnectionPool } from 'mssql'
import { MssqlPoolPromiseQueryRunner } from "./queryRunners/MssqlPoolPromiseQueryRunner";

const poolPromise = new ConnectionPool({
    user: '...',
    password: '...',
    server: 'localhost',
    database: '...'
}).connect();

async function main() {
    const connection = new DBConnection(new MssqlPoolPromiseQueryRunner(poolPromise));
    // Do your queries here
}
```

### mssql (with a connection pool)

It allows to execute the queries using a [mssql](https://www.npmjs.com/package/mssql) connection pool.

**Supported databases**: sqlServer

```ts
import { ConnectionPool } from 'mssql'
import { MssqlPoolQueryRunner } from "./queryRunners/MssqlPoolQueryRunner";

const poolPromise = new ConnectionPool({
    user: '...',
    password: '...',
    server: 'localhost',
    database: '...'
}).connect();

async function main() {
    const mssqlPool = await poolPromise;
    const connection = new DBConnection(new MssqlPoolQueryRunner(mssqlPool));
    // Do your queries here
}
```

## mysql2

### mysql2 (with a connection pool)

It allows to execute the queries using a [mysql2](https://www.npmjs.com/package/mysql2) connection pool.

**Supported databases**: mariaDB, mySql

```ts
import { createPool } from "mysql2";
import { MySql2PoolQueryRunner } from "ts-sql-query/queryRunners/MySql2PoolQueryRunner";

const pool = createPool({
  host: 'localhost',
  user: 'user',
  password: 'secret',
  database: 'test',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function main() {
    const connection = new DBConnection(new MySql2PoolQueryRunner(pool));
    // Do your queries here
}
```

### mysql2 (with a connection)

It allows to execute the queries using a [mysql2](https://www.npmjs.com/package/mysql2) connection.

**Supported databases**: mariaDB, mySql

```ts
import { createPool } from "mysql2";
import { MySql2QueryRunner } from "ts-sql-query/queryRunners/MySql2QueryRunner";

const pool = createPool({
  host: 'localhost',
  user: 'user',
  password: 'secret',
  database: 'test',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

function main() {
    pool.getConnection((error, mysql2Connection) => {
        if (error) {
            throw error;
        }
        try {
            const connection = new DBConnection(new MySql2QueryRunner(mysql2Connection));
            doYourLogic(connection).finnaly(() => {
                mysql2Connection.release();
            });
        } catch(e) {
            mysql2Connection.release();
            throw e;
        }
    });
}

async doYourLogic(connection: DBConnection) {
    // Do your queries here
}
```

## oracledb

### oracledb (with a connection pool promise)

It allows to execute the queries using an [oracledb](https://www.npmjs.com/package/oracledb) connection pool promise.

**Supported databases**: oracle

```ts
import { createPool } from 'oracledb';
import { OracleDBPoolPromiseQueryRunner } from "ts-sql-query/queryRunners/OracleDBPoolPromiseQueryRunner";

const poolPromise = createPool({
    user: 'user',
    password: 'pwd',
    connectString: 'localhost/XEPDB1'
});

async function closePoolAndExit() {
    try {
        const pool = await poolPromise;
        await pool.close(10);
        process.exit(0);
    } catch(err) {
        process.exit(1);
    }
}

process
  .once('SIGTERM', closePoolAndExit)
  .once('SIGINT',  closePoolAndExit)
  .once('beforeExit',  closePoolAndExit);

async function main() {
    const connection = new DBConnection(new OracleDBPoolPromiseQueryRunner(poolPromise));
    // Do your queries here
}
```

### oracledb (with a connection pool)

It allows to execute the queries using an [oracledb](https://www.npmjs.com/package/oracledb) connection pool.

**Supported databases**: oracle

```ts
import { createPool } from 'oracledb';
import { OracleDBPoolQueryRunner } from "ts-sql-query/queryRunners/OracleDBPoolQueryRunner";

const poolPromise = createPool({
    user: 'user',
    password: 'pwd',
    connectString: 'localhost/XEPDB1'
});

async function closePoolAndExit() {
    try {
        const pool = await poolPromise;
        await pool.close(10);
        process.exit(0);
    } catch(err) {
        process.exit(1);
    }
}

process
  .once('SIGTERM', closePoolAndExit)
  .once('SIGINT',  closePoolAndExit)
  .once('beforeExit',  closePoolAndExit);

async function main() {
    const pool = await poolPromise;
    const connection = new DBConnection(new OracleDBPoolQueryRunner(pool));
    // Do your queries here
}
```

### oracledb (with a connection)

It allows to execute the queries using an [oracledb](https://www.npmjs.com/package/oracledb) connection.

**Supported databases**: oracle

```ts
import { createPool } from 'oracledb';
import { OracleDBQueryRunner } from "ts-sql-query/queryRunners/OracleDBQueryRunner";

async function init() {
    try {
        await createPool({
            user: 'user',
            password: 'pwd',
            connectString: 'localhost/XEPDB1'
        });
        await main();
    } finally {
        await closePoolAndExit();
    }
}

async function closePoolAndExit() {
    try {
        await oracledb.getPool().close(10);
        process.exit(0);
    } catch(err) {
        process.exit(1);
    }
}

process
  .once('SIGTERM', closePoolAndExit)
  .once('SIGINT',  closePoolAndExit)
  .once('beforeExit',  closePoolAndExit);

init();

async function main() {
    const oracleConnection = await oracledb.getConnection();
    try {
        const connection = new DBConnection(new OracleDBQueryRunner(oracleConnection));
        // Do your queries here
    } finally {
        await oracleConnection.close();
    }
}
```

## pg

### pg (with a connection pool)

It allows to execute the queries using a [pg](https://www.npmjs.com/package/pg) connection pool.

**Supported databases**: postgreSql

```ts
import { Pool, PoolClient } from 'pg';
import { PgPoolQueryRunner } from "ts-sql-query/queryRunners/PgPoolQueryRunner";

const pool = new Pool({
    user: 'dbuser',
    host: 'database.server.com',
    database: 'mydb',
    password: 'secretpassword',
    port: 3211,
});

async function main() {
    const connection = new DBConnection(new PgPoolQueryRunner(pool));
    // Do your queries here
}
```

### pg (with a connection)

It allows to execute the queries using a [pg](https://www.npmjs.com/package/pg) connection.

**Supported databases**: postgreSql

```ts
import { Pool, PoolClient } from 'pg';
import { PgQueryRunner } from "ts-sql-query/queryRunners/PgQueryRunner";

const pool = new Pool({
    user: 'dbuser',
    host: 'database.server.com',
    database: 'mydb',
    password: 'secretpassword',
    port: 3211,
});

async function main() {
    const pgConnection = await pool.connect();
    try {
        const connection = new DBConnection(new PgQueryRunner(pgConnection));
        // Do your queries here
    } finally {
        pgConnection.release();
    }
}
```

## postgres

It allows to execute the queries using a [postgres](https://github.com/porsager/postgres) (aka Postgres.js) connection.

**Supported databases**: postgreSql

```ts
import * as postgres from 'postgres';
import { PostgresQueryRunner } from '../queryRunners/PostgresQueryRunner';

const sql = postgres({
    user: 'dbuser',
    host: 'database.server.com',
    database: 'mydb',
    password: 'secretpassword',
    port: 3211,
});

async function main() {
    const connection = new DBConnection(new PostgresQueryRunner(sql));
    // Do your queries here
}
```

**Limitation**: Low-level transaction management functions (`connection.beginTransaction`, `connection.commit`, `connection.rollback`) are not supported; you must use `connection.transaction` instead.

**Note**: Be aware postgres.js is pooled automatically; you don't need additional steps to use a connection pool.

## sqlite3

It allows to execute the queries using an [sqlite3](https://www.npmjs.com/package/sqlite3) connection.

**Supported databases**: sqlite

```ts
import { Database } from 'sqlite3';
import { Sqlite3QueryRunner } from "ts-sql-query/queryRunners/Sqlite3QueryRunner";

const db = new Database('./database.sqlite');

async function main() {
    const connection = new DBConnection(new Sqlite3QueryRunner(db));
    // Do your queries here
}
```

## sqlite-wasm OO1

It allows to execute the queries using an [@sqlite.org/sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm) [Object Oriented API 1](https://sqlite.org/wasm/doc/trunk/api-oo1.md) in Web Assembly.

**Supported databases**: sqlite

```ts
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { Sqlite3WasmOO1QueryRunner } from "ts-sql-query/queryRunners/Sqlite3WasmOO1QueryRunner";

async function main() {
    const sqlite3 = await sqlite3InitModule();
    const db: Database = new sqlite3.oo1.DB();
    const connection = new DBConnection(new Sqlite3WasmOO1QueryRunner(db));
    // Do your queries here
}
```

**Note**: better-sqlite3 supports synchronous query execution. See [Synchronous query runners](../advanced-usage.md#synchronous-query-runners) for more information.