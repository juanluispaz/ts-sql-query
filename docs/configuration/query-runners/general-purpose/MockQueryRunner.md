---
search:
  boost: 0.575
---
# MockQueryRunner

This general-purpose query runner enables controlled mocking of query execution in a fully predictable environment. It is primarily used in tests and simulations, where you can inspect the queries being issued and manually specify the expected return values.

!!! success "Supported databases"

    - [MariaDB](../../supported-databases/mariadb.md)
    - [MySQL](../../supported-databases/mysql.md)
    - [Oracle](../../supported-databases/oracle.md)
    - [PostgreSQL](../../supported-databases/postgresql.md)
    - [SQLite](../../supported-databases/sqlite.md)
    - [SQL Server](../../supported-databases/sqlserver.md)

!!! tip

    `MockQueryRunner` supports synchronous query execution. See the [Synchronous query runners](../../../advanced/synchronous-query-runners.md) for more information.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Usage Example

```ts
import { MockQueryRunner } from "ts-sql-query/queryRunners/MockQueryRunner";

async function main() {
    const connection = new DBConnection(new MockQueryRunner(
        (type, query, params, index) => {
            // verify your queries here
        }
    ));

    // Do your queries here
}
```

## API Overview

The `MockQueryRunner` receives a function as argument to the constructor, this function returns the result of the query execution and receives the following arguments:

- **`type: QueryType | 'isTransactionActive'`**: type of the query to be executed. The `QueryType` is defined as:

```ts
// Types of queries that can be intercepted and mocked
type QueryType = 'selectOneRow' | 'selectManyRows' | 'selectOneColumnOneRow' | 'selectOneColumnManyRows' |
    'insert' | 'insertReturningLastInsertedId' | 'insertReturningMultipleLastInsertedId' |
    'insertReturningOneRow' | 'insertReturningManyRows' | 'insertReturningOneColumnOneRow' | 'insertReturningOneColumnManyRows' |
    'update' | 'updateReturningOneRow' | 'updateReturningManyRows' | 'updateReturningOneColumnOneRow' | 'updateReturningOneColumnManyRows' |
    'delete' | 'deleteReturningOneRow' | 'deleteReturningManyRows' | 'deleteReturningOneColumnOneRow' | 'deleteReturningOneColumnManyRows' |
    'executeProcedure' | 'executeFunction' | 'beginTransaction' | 'commit' | 'rollback' | 
    'executeDatabaseSchemaModification' | 'executeConnectionConfiguration'
```

- **`query: string`**: query required to be executed
- **`params: any[]`**: parameters received by the query
- **`index: number`**: this is a counter of queries executed by the connection; that means, when the first query is executed the value is 0, when the second query is executed the value is 1, etc.

**Example of usage**

```ts
test('my test', async () => {
    const connection = new DBConnection(new MockQueryRunner((type, query, params, index) => {
        switch (index) {
        case 0:
            expect(type).toEqual('insertReturningLastInsertedId');
            expect(query).toEqual('insert into company (name) values ($1) returning id');
            expect(params).toEqual([ 'ACME' ]);

            // Return the result of the query execution, in this case the inserted id
            return 12;
        case 1:
            expect(type).toEqual('selectOneRow');
            expect(query).toEqual('select id as id, name as name from company where id = $1');
            expect(params).toEqual([ 12 ]);

            // Return the result of the query execution, in this case the requested row
            return { id: 12, name: 'ACME' };
        }
        throw new Error('Unexpected query in the test case');
    }));

    const testCompanyId = await connection
        .insertInto(tCompany)
        .values({ name: 'ACME' })
        .returningLastInsertedId()
        .executeInsert();

    expect(testCompanyId).toEqual(12);

    let testCompany = await connection
        .selectFrom(tCompany)
        .where(tCompany.id.equals(testCompanyId))
        .select({
            id: tCompany.id,
            name: tCompany.name
        })
        .executeSelectOne();

    expect(testCompany).toEqual({ id: 12, name: 'ACME' });
});
```

## Configuration options

The second constructor argument accepts either a `DatabaseType` string (shown above) or a configuration object with the following fields:

```ts
interface MockQueryRunnerConfig {
    database?: DatabaseType
    promise?: PromiseProvider
    isSqlError?: (error: unknown) => boolean
}
```

- **`database`**: dialect name used to format placeholders (`$1`, `?`, `:0`, …). Defaults to `'noopDB'`. Must match the connection class you wrap the runner with.
- **`promise`**: alternative `Promise` provider, used by [synchronous query runners](../../../advanced/synchronous-query-runners.md) (e.g. `synchronous-promise`). Defaults to the native `Promise`.
- **`isSqlError`**: customizes how the connection classifies a thrown value as a SQL error. The default classifies everything as a SQL error, which causes the connection's transaction handling to wrap your thrown value inside a `TsSqlQueryExecutionError`. Returning `false` for a thrown value makes the connection propagate it as-is instead — useful when test code uses a sentinel error to roll back a transaction and wants the sentinel to bubble up to the surrounding `try`/`catch` unchanged.

```ts
class Rollback extends Error {}

const runner = new MockQueryRunner(executor, {
    database: 'postgreSql',
    isSqlError: (e) => !(e instanceof Rollback),
})

// inside a test:
try {
    await connection.transaction(async () => {
        // ...do the thing under test...
        throw new Rollback() // propagates as Rollback, not as TsSqlQueryExecutionError
    })
} catch (e) {
    if (!(e instanceof Rollback)) throw e
}
```

## Resetting between test cases

`MockQueryRunner` keeps an internal counter that increments on every executor call and is what gets passed as the `index` argument (`0` for the first query of the runner's lifetime, then `1`, `2`, …). When you reuse a single `MockQueryRunner` instance across many test cases — each priming its own sequence of responses keyed by `index` — call `runner.reset()` between cases to bring the counter back to `0`:

```ts
const runner = new MockQueryRunner(executor, 'postgreSql')
const connection = new DBConnection(runner)

beforeEach(() => {
    runner.reset()
})
```

If you create a fresh `MockQueryRunner` per test case (and therefore a fresh connection too), `reset()` is unnecessary — the counter is per-instance.
