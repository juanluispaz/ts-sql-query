---
search:
  boost: 0.577
---
# better-sqlite3

This runner provides integration with the [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) driver, allowing `ts-sql-query` to execute queries on SQLite databases. It wraps an instance of a connected SQLite database and must be used in combination with a `ts-sql-query` connection.

!!! success "Supported databases"

    - [SQLite](../../supported-databases/sqlite.md)

!!! tip

    better-sqlite3 supports synchronous query execution. See the [Synchronous query runners](../../../advanced/synchronous-query-runners.md) for more information.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Using a single connection

Enables executing queries through a dedicated [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) connection.

```ts
import { BetterSqlite3QueryRunner } from "ts-sql-query/queryRunners/BetterSqlite3QueryRunner";
import * as betterSqlite3 from "better-sqlite3";

const db = betterSqlite3('foobar.db', options);

async function main() {
    const connection = new DBConnection(new BetterSqlite3QueryRunner(db));
    // Do your queries here
}
```

## better-sqlite3 and UUIDs

To work with [UUIDs in SQLite](../../supported-databases/sqlite.md#uuid-strategies) the default strategy is `uuid-extension` that requires the [uuid extension](https://sqlite.org/src/file?name=ext/misc/uuid.c); you can provide a compatible implementation as indicated here:

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

!!! warning

    The binary representation used in this implementation is not intended to be compatible with SQLite’s optional UUID extension.
