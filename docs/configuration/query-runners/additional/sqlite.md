---
search:
  boost: 0.573
---
# sqlite

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

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
