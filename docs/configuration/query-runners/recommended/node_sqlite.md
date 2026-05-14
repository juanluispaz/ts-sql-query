---
search:
  boost: 0.577
---
# node:sqlite

This runner provides integration with Node.js' built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html) `DatabaseSync` API, allowing `ts-sql-query` to execute queries on SQLite databases without installing an additional SQLite driver. It wraps an instance of a connected SQLite database and must be used in combination with a `ts-sql-query` connection.

!!! success "Supported databases"

    - [SQLite](../../supported-databases/sqlite.md)

!!! tip

    node:sqlite `DatabaseSync` supports synchronous query execution. See the [Synchronous query runners](../../../advanced/synchronous-query-runners.md) for more information.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Using a single connection

Enables executing queries through a dedicated [`node:sqlite`](https://nodejs.org/api/sqlite.html) `DatabaseSync` connection.

```ts
import { DatabaseSync } from "node:sqlite";
import { NodeSqliteQueryRunner } from "ts-sql-query/queryRunners/NodeSqliteQueryRunner";

const db = new DatabaseSync('foobar.db', options);

async function main() {
    const connection = new DBConnection(new NodeSqliteQueryRunner(db));
    // Do your queries here
}
```

!!! note "Safe Integers"

    By default, node:sqlite reads SQLite integers as JavaScript numbers and throws when a returned integer is outside JavaScript's safe integer range. If your queries may return larger integers, consider enabling `readBigInts` in the database configuration when your Node.js version supports it.

## node:sqlite and UUIDs

To work with [UUIDs in SQLite](../../supported-databases/sqlite.md#uuid-strategies) the default strategy is `uuid-extension`. Node.js does not bundle SQLite's optional [uuid extension](https://sqlite.org/src/file?name=ext/misc/uuid.c), but you can provide compatible SQL functions with `DatabaseSync.function`.

```ts
import { Buffer } from "node:buffer";
import { DatabaseSync, type SQLInputValue, type SQLOutputValue } from "node:sqlite";
import { fromBinaryUUID, toBinaryUUID } from "binary-uuid";
import { v4 as uuidv4 } from "uuid";

type NodeSqliteFunction = (...args: SQLOutputValue[]) => SQLInputValue;

const uuid: NodeSqliteFunction = () => uuidv4();
const uuidStr: NodeSqliteFunction = (value) => {
    if (!(value instanceof Uint8Array)) {
        throw new TypeError("uuid_str expects a SQLite BLOB");
    }
    return fromBinaryUUID(Buffer.from(value));
};
const uuidBlob: NodeSqliteFunction = (value) => {
    if (typeof value !== "string") {
        throw new TypeError("uuid_blob expects a UUID string");
    }
    return toBinaryUUID(value);
};

const db = new DatabaseSync(/* ... */);

// Implement uuid extension functions

db.function("uuid", uuid);
db.function("uuid_str", uuidStr);
db.function("uuid_blob", uuidBlob);

// ...
```

!!! warning

    The binary representation used in this implementation is not intended to be compatible with SQLite’s optional UUID extension.
