# Recommended query runners

## better-sqlite3

It allows to execute the queries using a [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) connection.

**Supported databases**: sqlite

```ts
import { BetterSqlite3QueryRunner } from "ts-sql-query/queryRunners/BetterSqlite3QueryRunner";
import * as betterSqlite3 from "better-sqlite3";

const db = betterSqlite3('foobar.db', options);

async function main() {
    const connection = new DBConection(new BetterSqlite3QueryRunner(db));
    // Do your queries here
}
```

**Note**: better-sqlite3 supports synchronous query execution. See [Synchronous query runners](../../advanced-usage/#synchronous-query-runners) for more information.

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
    const connection = new DBConection(new MariaDBPoolQueryRunner(pool));
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
        const connection = new DBConection(new MariaDBQueryRunner(mariaDBConnection));
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

It internally uses:

- [tedious](https://www.npmjs.com/package/tedious) for connections to SqlServer on any OS
- [msnodesqlv8](https://www.npmjs.com/package/msnodesqlv8) for connections to SqlServer only on Windows

**Note**: All of these implementations have a direct implementation here as alternative.

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
    const connection = new DBConection(new MssqlPoolPromiseQueryRunner(poolPromise));
    // Do your queries here
}
```

### mssql (with a connection pool)

It allows to execute the queries using a [mssql](https://www.npmjs.com/package/mssql) connection pool.

**Supported databases**: sqlServer

It internally uses:

- [tedious](https://www.npmjs.com/package/tedious) for connections to SqlServer on any OS
- [msnodesqlv8](https://www.npmjs.com/package/msnodesqlv8) for connections to SqlServer only on Windows

**Note**: All of these implementations have a direct implementation here as alternative.

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
    const connection = new DBConection(new MssqlPoolQueryRunner(mssqlPool));
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
    const connection = new DBConection(new MySql2PoolQueryRunner(pool));
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
            const connection = new DBConection(new MySql2QueryRunner(mysql2Connection));
            doYourLogic(connection).finnaly(() => {
                mysql2Connection.release();
            });
        } catch(e) {
            mysql2Connection.release();
            throw e;
        }
    });
}

async doYourLogic(connection: DBConection) {
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
    const connection = new DBConection(new OracleDBPoolPromiseQueryRunner(poolPromise));
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
    const connection = new DBConection(new OracleDBPoolQueryRunner(pool));
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
        const connection = new DBConection(new OracleDBQueryRunner(oracleConnection));
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
    const connection = new DBConection(new PgPoolQueryRunner(pool));
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
        const connection = new DBConection(new PgQueryRunner(pgConnection));
        // Do your queries here
    } finally {
        pgConnection.release();
    }
}
```

## sqlite3

It allows to execute the queries using an [sqlite3](https://www.npmjs.com/package/sqlite3) connection.

**Supported databases**: sqlite

```ts
import { Database } from 'sqlite3';
import { Sqlite3QueryRunner } from "ts-sql-query/queryRunners/Sqlite3QueryRunner";

const db = new Database('./database.sqlite');

async function main() {
    const connection = new DBConection(new Sqlite3QueryRunner(db));
    // Do your queries here
}
```
