---
search:
  boost: 0.575
---
# MockQueryRunner

A query runner that takes the place of the database in a test: your function receives each statement, can check its SQL and its parameters, and decides its result. If the results don't matter, [`NoopQueryRunner`](NoopQueryRunner.md) needs no function.

!!! success "Supported databases"

    - [MariaDB](../../supported-databases/mariadb.md)
    - [MySQL](../../supported-databases/mysql.md)
    - [Oracle](../../supported-databases/oracle.md)
    - [PostgreSQL](../../supported-databases/postgresql.md)
    - [SQLite](../../supported-databases/sqlite.md)
    - [SQL Server](../../supported-databases/sqlserver.md)

!!! tip

    `MockQueryRunner` supports synchronous query execution. See the [Synchronous query runners](../../../advanced/synchronous-query-runners.md) for more information.

## Creating it

```ts
import { MockQueryRunner } from "ts-sql-query/queryRunners/MockQueryRunner";

async function main() {
    const connection = new DBConnection(new MockQueryRunner(
        (type, query, params, index) => {
            // MockQueryRunner: verify your queries here
        }
    ));

    // Do your queries here
    connection // ...
}
```

The function receives these arguments, and what it returns is the result of the statement:

- **`type: QueryType`**: type of the query to be executed. The `QueryType` is defined as:

<!-- doc-code-snippet-template: simplifiedDefinition -->
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

- **`query: string`**: the SQL to be executed.
- **`params: any[]`**: the parameters of the query.
- **`index: number`**: how many statements the query runner received before this one: `0` for the first, `1` for the second, and so on.

The statements of a transaction reach your function too, and count in `index`: `beginTransaction`, `commit` and `rollback`, with the SQL `begin transaction`, `commit` and `rollback`. So a query inside `connection.transaction(...)` has index `1` when it's the first one, and `executeSelectPage` calls it twice, for the rows and for the count.

A test with two statements:

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

## What your function returns

Return what the database would give for that type of query:

| Query type | Return | If you return `undefined` or `null` |
|---|---|---|
| `selectOneRow`, `insertReturningOneRow`, `updateReturningOneRow`, `deleteReturningOneRow` | A plain object, with a property for each alias of the SQL (`{ id: 12, name: 'ACME' }` for `select id as id, name as name`) | No row |
| `selectManyRows`, `insertReturningManyRows`, `updateReturningManyRows`, `deleteReturningManyRows` | An array of those objects | An empty array |
| `selectOneColumnOneRow`, `insertReturningOneColumnOneRow`, `updateReturningOneColumnOneRow`, `deleteReturningOneColumnOneRow`, `insertReturningLastInsertedId`, `executeFunction` | The value | No value |
| `selectOneColumnManyRows`, `insertReturningOneColumnManyRows`, `updateReturningOneColumnManyRows`, `deleteReturningOneColumnManyRows`, `insertReturningMultipleLastInsertedId` | An array of values | An empty array |
| `insert` | The number of rows inserted | `1` |
| `update`, `delete` | The number of rows affected | `0` |
| `executeProcedure`, `beginTransaction`, `commit`, `rollback`, `executeDatabaseSchemaModification`, `executeConnectionConfiguration` | Nothing | |

A value of another shape makes the query reject with reason `INVALID_MOCKED_VALUE`, which says the `queryType` and the `index`, so you can find the branch of your function that returned it.

After that check, the value goes through the same steps as the response of a real driver: type adapters convert each field, mandatory columns are checked, and aggregated-array JSON is parsed. So you get the errors a database response like that would give:

- A row that omits a column the `select({...})` projects as required gives `MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE`.
- A value whose runtime type doesn't match the type of the column gives `INVALID_VALUE_RECEIVED_FROM_DATABASE`.
- A non-array or unparseable JSON string for a JSON-aggregated column gives `INVALID_JSON_RECEIVED_FROM_DATABASE`.

Include every projected column in the row you return. When a test only checks the SQL, return `undefined`: `executeSelectMany` gives an empty list and `executeSelectNoneOrOne` gives `null`, while `executeSelectOne` rejects with `NO_RESULT`, as with a database that finds no row.

## When your function throws

An error your function throws, a failed `expect` included, makes the `execute` method reject with a `TsSqlQueryExecutionError`, with the error you threw as its `cause`: the same as an error of a real driver. Its reason is `UNKNOWN`, unless what you throw is an error of `ts-sql-query`, which keeps its own.

## Transactions

`MockQueryRunner` follows the transactions like a real query runner: `beginTransaction` opens one, `commit` and `rollback` close it, and `isTransactionActive()` answers from that. Outside a transaction:

- `commit()` and `rollback()` reject with `NOT_IN_TRANSACTION`.
- `executeBeforeNextCommit`, `executeAfterNextCommit`, `executeAfterNextRollback` and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

A [nested transaction](../../../queries/transaction.md#nested-transactions) is allowed, unlike on the other query runners, so a test with a mock doesn't show its rejection.

```ts
const runner = new MockQueryRunner(executor, { database: 'postgreSql' })
const connection = new DBConnection(runner)

await connection.beginTransaction()
await connection.commit()

// The second commit is rejected, as it would be with a real driver:
// the transaction is already closed
await expect(connection.commit()).rejects.toThrow(/NOT_IN_TRANSACTION/)
```

## Code that registers functions for the end of the transaction

Code that registers [functions for the end of the transaction](../../../queries/transaction.md#deferring-logic-during-a-transaction) (`executeBeforeNextCommit`, `executeAfterNextCommit`, `executeAfterNextRollback`) or uses the [transaction metadata](../../../queries/transaction.md#transaction-metadata) raises two separate questions in a test: whether it runs inside a transaction, and what the registered functions do when the transaction ends.

### Running it inside a transaction

With `MockQueryRunner`, as with a database, registering those functions or reading the metadata needs a transaction, and throws `NOT_IN_TRANSACTION` without one. The code under test can get its transaction in two ways:

- **The test begins it**, the way the application does around that code (a request handler, a job). This is the closest to what runs in production:

    ```ts
    const customerId = await connection.transaction(() => {
        return registerCustomer('John', 'Smith', 10);
    });
    ```

- **The code begins one when its caller didn't**, joining the caller's transaction otherwise ([Code that may run with or without a transaction](../../../queries/transaction.md#code-that-may-run-with-or-without-a-transaction)). This changes what the code does in production, not only in the test: do it when the code may really be called without a transaction there too, not to make the test pass.

### Keeping the registered functions from having an effect

Inside a transaction, the registered functions run when it ends, with the mock as with a database: an `executeAfterNextCommit` function that sends an e-mail sends it from the test too. The mock only answers the queries; what a function does outside the database is the application's.

- **Replace the service the function calls** with a fake one in the test, as you do with any other external service. This is the recommended way: the code under test is the same as in production, the test can check what would have been done, and it works the same way whether the test uses `MockQueryRunner` or a real database:

    ```ts
    const sentWelcomeEmails: number[] = [];
    emailService.sendWelcomeEmail = async (customerId: number) => {
        sentWelcomeEmails.push(customerId);
    };

    const customerId = await connection.transaction(() => {
        return registerCustomer('John', 'Smith', 10);
    });
    // sentWelcomeEmails is [customerId]: the e-mail would have been sent after the commit
    ```

- **Ask the query runner whether it is a mock**: `connection.queryRunner.isMocked()` returns `true` with `MockQueryRunner`, so the function can skip its work. This puts knowledge of the tests in the production code, and it doesn't help a test against a real database; prefer a fake service.

## Resetting between test cases

When you reuse one `MockQueryRunner` across many test cases, each with its own sequence of responses by `index`, call `runner.reset()` between them. It brings `index` back to `0` and closes any transaction the previous case left open:

```ts
const runner = new MockQueryRunner(executor, 'postgreSql')
const connection = new DBConnection(runner)

beforeEach(() => {
    runner.reset()
})
```

If you create a new `MockQueryRunner` for each test case, with a new connection, you don't need `reset()`.

## Options

The second argument of the constructor is the name of a database, or an object with these options:

<!-- doc-code-snippet-template: simplifiedDefinition -->
```ts
interface MockQueryRunnerConfig {
    database?: DatabaseType
    promise?: PromiseProvider
    isSqlError?: (error: unknown) => boolean
}
```

- **`database`**: the database to write the placeholders for (`$1`, `?`, `:0`, …). A connection sets it to its own database when you create it, so you only need this to use the query runner without a connection.
- **`promise`**: another `Promise` provider, used by [synchronous query runners](../../../advanced/synchronous-query-runners.md) (e.g. `synchronous-promise`). Defaults to the native `Promise`.
- **`isSqlError`**: which errors count as errors of the database in `connection.transaction(...)`, `beginTransaction()`, `commit()` and `rollback()`. By default only the errors of `ts-sql-query` do, so an error your code throws in the transaction comes out as it is, as with a real query runner. An error it accepts comes out wrapped in a `TsSqlQueryExecutionError`, as the error of a real driver does. This is how to simulate one thrown in the transaction:

```ts
class DriverError extends Error {}

const runner = new MockQueryRunner(executor, {
    database: 'postgreSql',
    isSqlError: (e) => e instanceof DriverError,
})

// inside a test:
try {
    await connection.transaction(async () => {
        // ...do the thing under test...
        throw new DriverError('the connection was lost') // rolls back, and comes out as a TsSqlQueryExecutionError
    })
} catch (e) {
    // e.cause is the DriverError
}
```
