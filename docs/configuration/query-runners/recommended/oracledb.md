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

    Without it the driver reads every `NUMBER` as a JavaScript `number`, so an out-of-range value comes back rounded; ts-sql-query rejects that rounded number with `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE` rather than hand back a silently-wrong value. With it, the driver hands those columns over as strings and ts-sql-query converts them to the type the column declares (`bigint` stays exact, `int` raises `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE` if the exact value doesn't fit — read it as `bigint`). Narrow columns keep coming back as `number`, so nothing else changes.

    The handler can also be passed per query, or scoped by `metaData.name` if you prefer to name the columns explicitly.

## Running a statement on each new connection

Some settings are properties of the **database session**, not of the query — the [session time zone](../../time-zones.md#per-database) and the [session collation](../../collations.md#on-the-connection-the-session-collation). To pin them without touching your schema, run the statement **once per connection**, when the pool opens it. oracledb pools take a `sessionCallback` for exactly this — it fires on each brand-new connection (and can be told to re-run when a connection is returned tagged for a different value):

```typescriptreact
import oracledb from 'oracledb';

const poolPromise = oracledb.createPool({
    user: 'user',
    password: 'pwd',
    connectString: 'localhost/XEPDB1',
    sessionCallback: (connection, _requestedTag, callback) => {
        // Runs once per newly created pooled connection.
        connection.execute(`
            BEGIN
                -- Session time zone (see the Time zones page)
                EXECUTE IMMEDIATE q'[ALTER SESSION SET TIME_ZONE = 'UTC']';
                -- Session collation: make comparisons case-insensitive session-wide
                -- (see the Collations page). Omit if you don't need it.
                EXECUTE IMMEDIATE 'ALTER SESSION SET NLS_COMP = LINGUISTIC';
                EXECUTE IMMEDIATE 'ALTER SESSION SET NLS_SORT = BINARY_CI';
            END;
        `, [], (err) => callback(err));
    }
});
```

The time-zone statement is what the [Time zones page](../../time-zones.md#the-databases-zone) recommends aligning on connect; the `NLS_COMP` / `NLS_SORT` pair is the [session collation](../../collations.md#on-the-connection-the-session-collation) — on Oracle it reaches every comparison (`equals` / `like` / `distinct` / `order`), so it is the one engine where a pool-level collation is fully effective. Prefer a server / database already configured the way you want, and use this hook when you cannot change it.
