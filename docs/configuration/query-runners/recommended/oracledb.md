---
search:
  boost: 0.577
---
<!-- doc-code-template: oracle -->
# oracledb

This page explains how to use `ts-sql-query` with the [oracledb](https://www.npmjs.com/package/oracledb) driver. It covers three approaches: using a connection pool promise, using a connection pool or using a single connection directly.

!!! success "Supported databases"

    - [Oracle](../../supported-databases/oracle.md)

!!! info "Tested with"

    [oracledb](https://www.npmjs.com/package/oracledb) `^6.10.0`

    This information reflects the driver version pinned in this project's `devDependencies` and exercised by the CI suite. Other compatible versions may work but are not actively tested.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Using a connection pool promise

Executes queries through a [oracledb](https://www.npmjs.com/package/oracledb) connection obtained from a pool promise.

```ts
import oracledb from 'oracledb';
import { OracleDBPoolPromiseQueryRunner } from "ts-sql-query/queryRunners/OracleDBPoolPromiseQueryRunner";

const poolPromise = oracledb.createPool({
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
    connection // ...
}
```

## Using a connection pool

Executes queries through a [oracledb](https://www.npmjs.com/package/oracledb) connection obtained from a pool.

```ts
import oracledb from 'oracledb';
import { OracleDBPoolQueryRunner } from "ts-sql-query/queryRunners/OracleDBPoolQueryRunner";

const poolPromise = oracledb.createPool({
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
    connection // ...
}
```

## Using a single connection

Executes queries through a dedicated [oracledb](https://www.npmjs.com/package/oracledb) connection.

```ts
import oracledb from 'oracledb';
import { OracleDBQueryRunner } from "ts-sql-query/queryRunners/OracleDBQueryRunner";

async function init() {
    try {
        await oracledb.createPool({
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
        connection // ...
    } finally {
        await oracleConnection.close();
    }
}
```

!!! note "Safe Integers"

    If your queries may return numbers larger than JavaScript's safe integer range — a `bigint` column, or arithmetic that grows past `Number.MAX_SAFE_INTEGER` (`9_007_199_254_740_991`) — install a `fetchTypeHandler` that reads the wide `NUMBER` columns as strings:

    ```ts
    import oracledb from 'oracledb';

    oracledb.fetchTypeHandler = function(metaData) {
        // A NUMBER wider than 15 digits (or of unknown precision) can't round-trip
        // through a JavaScript number; fetch it as a string instead.
        if (metaData.dbType === oracledb.DB_TYPE_NUMBER && (!metaData.precision || metaData.precision > 15)) {
            return { type: oracledb.STRING };
        }
        return undefined;
    };
    ```

    Without it the driver reads every `NUMBER` as a JavaScript `number`, so an out-of-range value comes back rounded — silently, since the rounded value is still an integer. With it, the driver hands those columns over as strings and ts-sql-query converts them to the type the column declares (`bigint` stays exact, `int` raises `INVALID_VALUE_RECEIVED_FROM_DATABASE` if it truly doesn't fit). Narrow columns keep coming back as `number`, so nothing else changes.

    The handler can also be passed per query, or scoped by `metaData.name` if you prefer to name the columns explicitly.
