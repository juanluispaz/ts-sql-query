---
search:
  boost: 2
---
# Transaction

A **transaction** is a sequence of one or more operations that are executed as a single logical unit of work. In databases, transactions provide **atomicity**, **consistency**, **isolation**, and **durability** (ACID properties), ensuring that changes either complete fully or not at all. This is essential for maintaining data integrity in concurrent and failure-prone environments.

This page explains how to work with transactions in `ts-sql-query`, covering both high-level helpers for common workflows and low-level methods for fine-grained control. It also covers transaction isolation levels, read/write modes, deferring logic based on the transaction outcome, and storing temporary metadata during a transaction.

## High-level transaction management

For simple transaction management, you can use the `transaction` method in the connection object. This method:

- begins the transaction before calling the function received by argument
- commits the transaction if the resulting promise returns a result
- rollbacks the transaction if the resulting promise returns an error

```ts
const transactionResult = connection.transaction(async () => {
    const companyId = await connection.insertInto(tCompany).set({
            name: 'Top Company'
        })
        .returningLastInsertedId()
        .executeInsert();

    const customerId = await connection.insertInto(tCustomer).set({
            firstName: 'John',
            lastName: 'Smith',
            companyId: companyId
        })
        .returningLastInsertedId()
        .executeInsert();

    return {companyId, customerId};
});
```

## Low-level transaction management

Sometimes a fine-grained control over the transaction is required, In such situations, `ts-sql-query` offers you the possibility to manually:

- begin the transaction

```ts
await connection.beginTransaction();
```

- commit the transaction

```ts
await connection.commit();
```

- rollback the transaction

```ts
await connection.rollback();
```

When you use these methods, you must ensure the transaction has begun before calling `commit` or `rollback`.

!!! warning "A failed statement on PostgreSQL"

    On PostgreSQL, a statement that fails leaves the whole transaction failed, even if your code catches its error: see [a statement that fails inside a transaction](../configuration/supported-databases/postgresql.md#a-statement-that-fails-inside-a-transaction).

## Using the driver's connection in the transaction

Some libraries run their own SQL and accept a connection of your database driver: a job queue that keeps its jobs in the same database, for example. For their SQL to be part of your transaction, they must run it on the connection the transaction runs on, which the query runner gives you in two ways.

`connection.queryRunner.getCurrentNativeConnection()` returns the driver's connection the current transaction runs on (the pg `PoolClient` with `PgPoolQueryRunner`):

```ts
await connection.transaction(async () => {
    const customerId = await registerCustomer('John', 'Smith', 10);
    const client = connection.queryRunner.getCurrentNativeConnection();
    await jobQueue.send('send-welcome-email', { customerId }, { db: client });
});
```

A query runner over a pool takes the connection from the pool with the first statement of the transaction: before it, the transaction has no connection yet, and `getCurrentNativeConnection()` returns `undefined`, as it does outside a transaction. `connection.queryRunner.execute(fn)` always gives one: it calls `fn` with the connection of the transaction, taking it from the pool (and beginning the transaction on it) when the transaction had none yet; and outside a transaction, with a connection for `fn` alone, given back when the promise `fn` returns ends:

```ts
await connection.transaction(async () => {
    await connection.queryRunner.execute(async (client) => {
        await jobQueue.send('send-welcome-email', { customerId: 10 }, { db: client });
    });
});
```

What each query runner gives:

| Query runner | `getCurrentNativeConnection()` and `execute(fn)` in a transaction | `execute(fn)` outside a transaction | `getNativeRunner()` |
| --- | --- | --- | --- |
| `PgPoolQueryRunner`, `MySql2PoolQueryRunner`, `MariaDBPoolQueryRunner`, `OracleDBPoolQueryRunner`, `OracleDBPoolPromiseQueryRunner` | The connection taken from the pool for the transaction | A connection taken from the pool for `fn` | The pool |
| `PostgresQueryRunner`, `BunSqlPostgresQueryRunner`, `BunSqlMySqlQueryRunner` | The `sql` of the transaction (`connection.transaction(...)`), or the connection reserved for it (`connection.beginTransaction()`) | A connection reserved for `fn` | The `sql` |
| `PgQueryRunner`, `PgLiteQueryRunner`, `MySql2QueryRunner`, `MariaDBQueryRunner`, `OracleDBQueryRunner` and the SQLite query runners | The connection you gave the query runner | The connection you gave the query runner | The connection |
| `MssqlPoolQueryRunner`, `MssqlPoolPromiseQueryRunner` | The mssql `Transaction` | The pool: mssql only gives one of its connections for a transaction | The pool |
| `PrismaQueryRunner` | The client of the interactive transaction | The Prisma client | The Prisma client |

The connection belongs to the query runner: don't release it, and don't commit or roll back with it. A connection `execute(fn)` takes for `fn` alone is given back when `fn` ends, so don't keep it to use later.

## Transaction isolation

While your transaction runs, other transactions change the same data and commit. The **isolation level** is what you ask to be shown of their work, and what happens when you write on the strength of what you read.

Every database calls these levels by its own names, and the same name doesn't mean the same thing on every database: `REPEATABLE READ` is a different promise on SQL Server than on PostgreSQL, and Oracle's `SERIALIZABLE` is PostgreSQL's `REPEATABLE READ`. `ts-sql-query` names the levels with the **SQL standard's words**, and with `snapshot` (SQL Server's name) for the level the standard has no name for. Each level keeps the same promise on every database: `ts-sql-query` translates it to the words that database uses. A database that doesn't deliver a level doesn't offer it, and asking for it there is a TypeScript error.

### Isolation levels

The levels are ordered from the weakest to the strongest; each one keeps every promise of the levels above it in the table, and adds one more.

| **Level**          | **What your reads see**                                                                                                                         | **What happens when you write**                                                                                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `read uncommitted` | Changes other transactions have **not committed** yet, and may never commit.                                                                    | Your change is made on the current row. Nothing protects a value your application computed from an earlier read: it is written as it is.                                                                              |
| `read committed`   | Only **committed** data, but every statement looks again: a row read twice can change in between, and a new row can appear.                    | The same as `read uncommitted`: if another transaction changed the row after you read it, your write lands on top of that change. Two transactions that read, compute and write the same value lose one of the updates. |
| `repeatable read`  | A row you **have read** doesn't change for you until the end of the transaction, but a **new row** can still appear in a query asked twice.  | Nobody else can change a row you have read: their write **waits** until your transaction ends, so what you read is still true when you write. Two transactions waiting for each other end in a deadlock.                   |
| `snapshot`         | **Everything as of one moment** — the start of the transaction (on some databases, its first statement): nothing changes, nothing appears.      | You cannot write a row that another transaction changed after your moment: the write is **refused** with an error and the transaction has to be run again. Nobody waits for you.                                          |
| `serializable`     | As at `snapshot`, nothing you read changes and nothing appears.                                                                               | Whatever commits can be told as transactions run **one after another**. The database refuses one of the transactions (you retry it) or makes the others wait (you can get a deadlock), depending on the database.        |

!!! info "A level is a minimum, and it is not the whole story"

    A level says what must not happen to you, not how the database achieves it. Even at `snapshot`, two transactions can read the same rows, write **different** rows, and together break a rule neither broke alone (*write skew*): only `serializable` prevents it. And the two ways a database says no require different code from you: a database that **refuses** a transaction requires you to run it again; a database that makes others **wait** requires every program to take rows in the same order to avoid deadlocks.

### What each database offers

Each cell shows the isolation level `ts-sql-query` asks the database for; a dash means the level isn't available on that database.

| **Level**          | [MariaDB](https://mariadb.com/kb/en/set-transaction/#isolation-levels) | [MySql](https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html) | [Oracle](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/SET-TRANSACTION.html) | [PostgreSql](https://www.postgresql.org/docs/16/transaction-iso.html) | [Sqlite](https://www.sqlite.org/isolation.html) | [SqlServer](https://learn.microsoft.com/en-us/sql/t-sql/statements/set-transaction-isolation-level-transact-sql) |
| ------------------ | ------------------------------- | ------------------------------- | ------------------------- | ------------------------- | ------------------- | ------------------------- |
| `read uncommitted` | `READ UNCOMMITTED`              | `READ UNCOMMITTED`              | —                         | — <sup>1</sup>            | —                   | `READ UNCOMMITTED`        |
| `read committed`   | `READ COMMITTED`                | `READ COMMITTED`                | `READ COMMITTED` _default_ | `READ COMMITTED` _default_ | —                   | `READ COMMITTED` _default_ |
| `repeatable read`  | — <sup>2</sup>                  | — <sup>2</sup>                  | —                         | — <sup>2</sup>            | —                   | `REPEATABLE READ`         |
| `snapshot`         | `REPEATABLE READ` _default_ <sup>3</sup> | `REPEATABLE READ` _default_ <sup>4</sup> | `SERIALIZABLE` <sup>5</sup> | `REPEATABLE READ` | —                   | `SNAPSHOT` <sup>6</sup>   |
| `serializable`     | `SERIALIZABLE`                  | `SERIALIZABLE`                  | — <sup>5</sup>            | `SERIALIZABLE`            | — <sup>7</sup>      | `SERIALIZABLE`            |

1. **PostgreSQL has no `read uncommitted`.** It accepts the words `READ UNCOMMITTED`, but runs the transaction as `READ COMMITTED`, so `ts-sql-query` doesn't offer it.
2. **The `REPEATABLE READ` of PostgreSQL, MySQL and MariaDB is a snapshot**, more than the standard's `repeatable read` promises: use `snapshot` there.
3. **MariaDB**: until 11.6.2, or with the `innodb_snapshot_isolation` system variable turned off, a write is not refused when the row changed after your moment; see [the MySQL and MariaDB warning](#mysql-and-mariadb-snapshot-writes) below.
4. **MySQL**: a snapshot for plain reads only; a write is never refused. See [the MySQL and MariaDB warning](#mysql-and-mariadb-snapshot-writes) below.
5. **Oracle's `SERIALIZABLE` is a snapshot**: Oracle has nothing stronger, so `serializable` isn't available on Oracle.
6. **SQL Server** allows `SNAPSHOT` only when the `ALLOW_SNAPSHOT_ISOLATION` database option is on (`ALTER DATABASE … SET ALLOW_SNAPSHOT_ISOLATION ON`); otherwise the transaction fails.
7. **SQLite** doesn't let you choose: its transactions are always serializable.

The default level is the one the database uses when you don't ask for one; MySQL and MariaDB's default `REPEATABLE READ` is `ts-sql-query`'s `snapshot`.

### How each database refuses

At `snapshot`, when you write a row another transaction changed after your moment, and at `serializable`, when the transactions can't be told as one after another:

| **Database** | **`snapshot`: writing a row that changed after your moment**                                          | **`serializable`**                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| MariaDB      | The statement is refused (error 1020, _Record has changed since last read_) <sup>3</sup>                | Every row you read is locked: others **wait**; a conflict ends in a deadlock (error 1213) and one transaction is rolled back.   |
| MySql        | **Not refused** <sup>4</sup>                                                                            | Every row you read is locked: others **wait**; a conflict ends in a deadlock (error 1213) and one transaction is rolled back.   |
| Oracle       | The statement is refused (ORA-08177); the transaction can still continue                                 | —                                                                                                                                |
| PostgreSql   | The transaction is aborted (SQLSTATE 40001, _could not serialize access due to concurrent update_)       | One of the transactions is aborted (SQLSTATE 40001), possibly at `COMMIT`: you must **retry** it.                                |
| SqlServer    | The transaction is aborted (error 3960, _Snapshot isolation transaction aborted due to update conflict_) | The ranges you read are locked: others **wait**; a conflict ends in a deadlock (error 1205) and one transaction is rolled back. |

### MySQL and MariaDB: snapshot writes

!!! warning "MySQL's `snapshot` doesn't protect your writes"

    On MySQL, `snapshot` (MySQL's `REPEATABLE READ`) keeps its promise for plain reads only. An `UPDATE` or a `DELETE` works on the **latest committed** version of the row, not on your snapshot, and it is never refused. So the transaction can write on the strength of something that is no longer true, and another transaction's update is lost without any error:

    | **Transaction A** (`snapshot`)                                  | **Transaction B**                      |
    | --------------------------------------------------------------- | -------------------------------------- |
    | reads `n` → `10`                                                |                                        |
    |                                                                 | sets `n = n + 1` and commits (`11`)    |
    | reads `n` again → `10` (the snapshot holds for reads)           |                                        |
    | sets `n = 20` (computed by the application: `10 + 10`)          |                                        |
    | commits                                                         |                                        |
    | **`n` is `20`: B's update is lost, and nobody got an error**    |                                        |

    Every other database `ts-sql-query` supports refuses A's write at that point, and A runs again from a fresh look. This behaviour has been reported to MySQL since 2010 and every report was closed as the intended behaviour (the most recent, [MySQL bug #117797](https://bugs.mysql.com/bug.php?id=117797) (2025), says changing it wouldn't be backward compatible; see also [#57973](https://bugs.mysql.com/bug.php?id=57973) and [Jepsen's analysis of MySQL 8.0.34](https://jepsen.io/analyses/mysql-8.0.34)). It contradicts the definition of snapshot isolation and what every other supported database does, including MariaDB, which shares the same storage engine and fixed it. `ts-sql-query` treats it as a MySQL defect: `snapshot` on MySQL gives you consistent reads, but not protection for your writes.

    **MariaDB** fixed it with the `innodb_snapshot_isolation` system variable ([MDEV-35124](https://jira.mariadb.org/browse/MDEV-35124), see also [Jepsen's note on it](https://jepsen.io/blog/2024-11-07-mariadb-snapshot-isolation)): added in 10.6.18, 10.11.8 and 11.4.2 turned off, and turned on by default since 11.6.2. Before 11.6.2, or with the variable turned off, MariaDB behaves as MySQL does.

    Where the database doesn't refuse the write, keep the computation inside the statement, as an expression over the column (the database computes it on the current value), or carry a version column in the `where` and check how many rows were updated.

### Setting the isolation level

You can set the transaction's isolation level by providing an additional argument to the `transaction` or `beginTransaction` method with a value created calling the `connection.isolationLevel` method. This function receives the isolation level as the first argument and the access mode as an optional second argument. You can also provide the access mode as the only argument.

Available access modes:

| **Database**                                                                                                     | `read write` | `read only` |
| ---------------------------------------------------------------------------------------------------------------- | ------------ | ----------- |
| [MariaDB](https://mariadb.com/kb/en/start-transaction/#access-mode)                                              | **YES**\*    | **YES**     |
| [MySql](https://dev.mysql.com/doc/refman/8.0/en/set-transaction.html)                                            | **YES**\*    | **YES**     |
| [Oracle](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/SET-TRANSACTION.html)               | **YES**\*    | **YES**     |
| [PostgreSql](https://www.postgresql.org/docs/16/transaction-iso.html)                                            | **YES**\*    | **YES**     |
| [Sqlite](https://www.sqlite.org/lang_transaction.html)                                                           | _no_\*       | _no_        |
| [SqlServer](https://learn.microsoft.com/en-us/sql/t-sql/statements/set-transaction-isolation-level-transact-sql) | _no_\*       | _no_        |

\* _Default_

!!! warning

    The [Oracle](../configuration/supported-databases/oracle.md) database doesn't support specifying the isolation level and the access mode simultaneously.

```ts
const transactionResult = connection.transaction(async () => {
    // ...
}, connection.isolationLevel('snapshot', 'read only'));
```

```ts
await connection.beginTransaction(connection.isolationLevel('snapshot', 'read only'));
```

## Deferring logic during a transaction

Some work belongs to a transaction but can't be done at the point of the code that causes it. A function can register, at any point of a transaction, work to run when the transaction ends:

- `executeBeforeNextCommit(fn)`: **just before the commit**, still inside the transaction. For work that must be part of the transaction, done once every change is made.
- `executeAfterNextCommit(fn)`: **after a successful commit**. For what must only happen when the changes are saved, outside the database: sending an e-mail, moving a file, refreshing a cache.
- `executeAfterNextRollback(fn)`: **after a rollback**. For undoing what SQL can't undo: deleting a file uploaded during the transaction.

The code that registers the work doesn't need to know where the transaction begins or ends: a function deep in your services registers it, and it runs when the transaction that called it ends. Each one accepts a synchronous function (`() => void`) or an asynchronous one (`() => Promise<void>`).

### When each one runs

With `connection.transaction(fn)`:

1. `fn` runs. The functions you register while it runs are kept for the end of the transaction.
2. When `fn` finishes without an error, the `executeBeforeNextCommit` functions run, in the order they were registered, **inside the transaction**: they can execute queries, and their changes are committed with the rest.
3. The transaction is committed.
4. The `executeAfterNextCommit` functions run, in the order they were registered. **The transaction has ended**: a query there runs on its own, outside any transaction.
5. The promise returned by `transaction(fn)` resolves with the value `fn` returned, once every `executeAfterNextCommit` function has finished.

When `fn` throws an error, or an `executeBeforeNextCommit` function fails, the transaction is rolled back instead, the `executeAfterNextRollback` functions run, in the order they were registered, and the promise rejects with the error. With `commit()` and `rollback()` the same happens when you call them (see [Errors](#errors)).

The functions are registered for the transaction that is running when you register them, and they are discarded when it ends: the next transaction starts with none. Registering one when there is no transaction throws a `TsSqlProcessingError` with reason `NOT_IN_TRANSACTION`.

### Before the commit: work that belongs to the transaction

`executeBeforeNextCommit` is for work that must be committed with the changes, but needs every change of the transaction to be made first: checking a rule over the final state, recomputing a summary once instead of after every change, writing an audit record of the whole operation.

For example, a company must keep at least one customer. Moving customers from one company to another, one by one, goes through states where the company may have none for a moment; the rule only has to hold when the transaction commits:

```ts
async function moveCustomer(customerId: number, fromCompanyId: number, toCompanyId: number) {
    await connection.update(tCustomer)
        .set({ companyId: toCompanyId })
        .where(tCustomer.id.equals(customerId))
        .executeUpdate();

    connection.executeBeforeNextCommit(async () => {
        const remaining = await connection.selectFrom(tCustomer)
            .where(tCustomer.companyId.equals(fromCompanyId))
            .selectCountAll()
            .executeSelectOne();
        if (remaining === 0) {
            throw new Error('The company ' + fromCompanyId + ' must keep at least one customer');
        }
    });
}

await connection.transaction(async () => {
    await moveCustomer(1, 10, 20);
    await moveCustomer(2, 20, 10);
});
```

The check runs once all the moves are done, inside the transaction. If it throws, the transaction is rolled back, as if `fn` had thrown: none of the moves is saved. (Each call registers its own check; [Transaction metadata](#doing-something-once-per-transaction) shows how to register it once.)

### After the commit: telling the world outside the database

`executeAfterNextCommit` is for what must only happen when the changes are saved, and can't be part of the transaction because it isn't in the database: an e-mail, a file in a storage service, a cache in memory, a message to another system. Done inside the transaction, it would happen even when the transaction is rolled back afterwards; registered for after the commit, it happens only when the changes are really saved.

```ts
async function registerCustomer(firstName: string, lastName: string, companyId: number) {
    const customerId = await connection.insertInto(tCustomer)
        .set({ firstName, lastName, companyId })
        .returningLastInsertedId()
        .executeInsert();

    connection.executeAfterNextCommit(async () => {
        try {
            await emailService.sendWelcomeEmail(customerId);
        } catch (error) {
            logger.error('The welcome e-mail could not be sent to the customer ' + customerId, error);
        }
    });

    return customerId;
}
```

!!! warning "The changes are already committed when these functions run"

    - **An error doesn't undo anything.** When an `executeAfterNextCommit` function fails, the others still run, and the promise of `transaction(fn)` (or of `commit()`) rejects with a `TsSqlQueryExecutionError` with reason `ERROR_EXECUTING_DEFERRED_IN_TRANSACTION`, although the changes are saved. Catch the errors inside the function, as the example does, when the caller must not see the operation as failed.
    - **The caller waits for them.** The promise of `transaction(fn)` resolves when they have finished. Work that can take long (sending many e-mails, moving big files) can be started without waiting for it, catching its errors.
    - **They run outside any transaction.** A query there commits on its own. To make several changes together, begin a new transaction there with `connection.transaction(...)`; it can register its own functions to run when it ends.
    - **They can be lost.** If the process stops right after the commit, they never run, and nothing will run them later. That is fine for what can be lost or redone (a cache, a notification that can be repeated); a message that must not be lost needs a [transactional outbox](#example-a-transactional-outbox).

### After a rollback: undoing what SQL can't undo

A rollback undoes the changes in the database, but not what the transaction did outside it. `executeAfterNextRollback` is for undoing that. For example, a photo of the customer uploaded to a storage service during the transaction must be deleted when the transaction doesn't save the customer:

```ts
async function registerCustomerWithPhoto(firstName: string, lastName: string, companyId: number, photo: Uint8Array) {
    const customerId = await connection.insertInto(tCustomer)
        .set({ firstName, lastName, companyId })
        .returningLastInsertedId()
        .executeInsert();

    const photoPath = 'customers/' + customerId + '.jpg';
    await fileStorage.upload(photoPath, photo);
    connection.executeAfterNextRollback(async () => {
        await fileStorage.delete(photoPath);
    });

    return customerId;
}
```

If a later step of the transaction fails, the customer isn't saved and the photo is deleted. The function runs after the rollback, outside any transaction, and its error doesn't replace the error that caused the rollback: it is attached to it (see [Errors](#errors)).

### Errors

| | Runs | When it fails |
|---|---|---|
| `executeBeforeNextCommit` | Inside the transaction | The following `executeBeforeNextCommit` functions don't run, and the transaction isn't committed: `transaction(fn)` rolls it back (the `executeAfterNextRollback` functions run) and rejects with the error. `commit()` rejects with the error and leaves the transaction open: call `rollback()`. |
| `executeAfterNextCommit` | After the commit, outside any transaction | The changes stay committed. The following functions still run, and `transaction(fn)` / `commit()` rejects with the error. |
| `executeAfterNextRollback` | After the rollback, outside any transaction | The following functions still run. `transaction(fn)` rejects with the error that caused the rollback, with this one attached (`additionalErrors`); `rollback()` rejects with this one. |

The error of a function is wrapped in a `TsSqlQueryExecutionError` with reason `ERROR_EXECUTING_DEFERRED_IN_TRANSACTION`, whose cause is the error the function threw (see [Library raised errors](../api/error-management/library-raised-errors.md)).

### Registering from inside one of these functions

While the functions of one kind are running, no more of that kind can be registered for the same transaction:

- An `executeBeforeNextCommit` function can register `executeAfterNextCommit` and `executeAfterNextRollback` functions, but not another `executeBeforeNextCommit` one.
- An `executeAfterNextCommit` or `executeAfterNextRollback` function runs when its transaction has ended, so registering there throws `NOT_IN_TRANSACTION` (or, when that transaction was nested in another one that is still running, `NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED`). A transaction it begins with `connection.transaction(...)` is a new one, with its own functions.

Registering one of the kind that is running throws a `TsSqlProcessingError` with reason `NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED`.

### Code that may run with or without a transaction

These functions need a transaction. A function that registers them, and may be called with or without one, can join the transaction of its caller when there is one and begin its own otherwise, with `isTransactionActive()`:

```ts
function inTransaction<T>(fn: () => Promise<T>): Promise<T> {
    if (connection.isTransactionActive()) {
        return fn();
    }
    return connection.transaction(fn);
}

const customerId = await inTransaction(() => registerCustomer('John', 'Smith', 10));
```

!!! tip "In the tests"

    The registered functions run in the tests too, when the transaction ends. To keep one from sending an e-mail or moving a file there, replace the service it calls with a fake one; [Code that registers functions for the end of the transaction](../configuration/query-runners/general-purpose/MockQueryRunner.md#code-that-registers-functions-for-the-end-of-the-transaction) shows it, together with how to give the code its transaction.

## Transaction metadata

`getTransactionMetadata()` returns a `Map<unknown, unknown>` that belongs to the transaction that is running: it starts empty when the transaction begins and is discarded when it ends. It lets code that runs at different points of the same transaction share information without passing it around: a function deep in your services leaves a value there, and another one, called later in the same transaction (or one of its deferred functions), reads it.

```ts
// Setting a value
connection.getTransactionMetadata().set('my key', 'my value');
```

```ts
// Getting a value
const myKeyValue: unknown = connection.getTransactionMetadata().get('my key');
```

Calling it when there is no transaction throws a `TsSqlProcessingError` with reason `NOT_IN_TRANSACTION`. A transaction begun inside another one (when the query runner allows nested transactions, like [`PgPoolQueryRunner`](../configuration/query-runners/recommended/pg.md) created with `allowNestedTransactions: true`) has its own metadata, and the outer one gets its own back when the inner one ends.

!!! tip "Use keys nobody else can write"

    Any code that runs in the transaction can read and write the map, including libraries. A key that is a `Symbol` or an object of your module (`const pendingChecks = Symbol('pendingChecks')`) can't collide with anybody else's; a string can.

### Doing something once per transaction

The functions of [the previous section](#deferring-logic-during-a-transaction) are registered every time they are called: a function called ten times in a transaction registers ten. The metadata can remember that the function is already registered, and collect what it has to do.

For example, the customers a transaction changes must be refreshed in a cache once the changes are saved. `refreshCustomerInCacheAfterCommit` is called for every customer the transaction changes, and the cache is refreshed once, with all of them:

```ts
const changedCustomers = Symbol('changedCustomers');

function refreshCustomerInCacheAfterCommit(customerId: number) {
    const metadata = connection.getTransactionMetadata();
    // 1. Look for what this transaction has collected so far
    let customerIds = metadata.get(changedCustomers) as Set<number> | undefined;
    if (!customerIds) {
        // 2. The first time in this transaction: keep the collection in the metadata
        //    and register the function, which will use it
        const newCustomerIds = new Set<number>();
        metadata.set(changedCustomers, newCustomerIds);
        connection.executeAfterNextCommit(() => {
            customerCache.invalidate(newCustomerIds);
        });
        customerIds = newCustomerIds;
    }
    // 3. Every time: add this customer to the collection
    customerIds.add(customerId);
}
```

The function registered the first time reads the collection when the transaction ends, so it gets every customer added after it was registered. The next transaction starts with empty metadata, so it registers its own function.

The same three steps register the check of [Before the commit](#before-the-commit-work-that-belongs-to-the-transaction) once: collect the companies customers leave, and check them all with one query in a single `executeBeforeNextCommit` function. When nothing has to be collected, a flag is enough: `if (!metadata.get(key)) { metadata.set(key, true); connection.executeAfterNextCommit(...) }`, as the [outbox example](#example-a-transactional-outbox) below does.

### Example: a transactional outbox

An operation often has to tell another system what it did: a new customer has to reach the billing system, an order has to reach the warehouse. Writing to the database and sending a message to another system are two writes to two systems, and no transaction covers both: whichever is done first, if the process stops right after it, the other is never done. Send the message before the commit, and a rollback leaves the other system told about a customer that doesn't exist; send it after the commit (in an `executeAfterNextCommit` function), and a process that stops between the two leaves the customer saved and the message never sent. This is known as the *dual-write problem*, and no order of the two writes solves it.

A **transactional outbox** solves it by not writing to two systems at once: the message is a row of a table of the same database, the *outbox*, inserted **in the same transaction** as the change it announces. The database already guarantees that both are saved or neither is: if the transaction is committed, the message exists and will be sent; if it is rolled back, for whatever reason, the message was never written, and there is nothing to undo. A separate process, the *relay*, reads the messages not sent yet, sends them, and marks them as sent; if it stops, it resumes where it was.

```ts
const tOutboxMessage = new class TOutboxMessage extends Table<DBConnection, 'TOutboxMessage'> {
    id = this.autogeneratedPrimaryKey('id', 'int');
    topic = this.column('topic', 'string');
    payload = this.column('payload', 'string');
    sent = this.column('sent', 'boolean');
    constructor() {
        super('outbox_message'); // table name in the database
    }
}();
```

The message must be inserted with the connection of the transaction that makes the change: written on another connection, or in an `executeAfterNextCommit` function, it is the dual write again. What the outbox gives up is the moment of sending: the relay finds the message when it looks for new ones, so it usually looks every few seconds. Here the transaction metadata and `executeAfterNextCommit` help: after the commit, the relay is woken up to send the new messages straight away, once per transaction however many messages it wrote:

```ts
const relayWakeUpRegistered = Symbol('relayWakeUpRegistered');

async function addToOutbox(topic: string, payload: object) {
    await connection.insertInto(tOutboxMessage)
        .set({ topic, payload: JSON.stringify(payload), sent: false })
        .executeInsert();

    const metadata = connection.getTransactionMetadata();
    if (!metadata.get(relayWakeUpRegistered)) {
        metadata.set(relayWakeUpRegistered, true);
        connection.executeAfterNextCommit(() => {
            // Not awaited: the caller doesn't wait for the messages to be sent
            outboxRelay.wakeUp();
        });
    }
}

await connection.transaction(async () => {
    const customerId = await registerCustomer('John', 'Smith', 10);
    await addToOutbox('customer.registered', { customerId });
});
```

The wake-up is only a shortcut, and it can be lost (the process stops after the commit, or the relay is busy): the relay keeps looking for unsent messages from time to time, and finds them anyway. What the outbox guarantees is that a message is never lost, not that it is sent only once: a relay that stops after sending a message and before marking it as sent sends it again when it resumes. This is *at-least-once* delivery, and it is why every message carries an identifier and the system that receives it must handle a repeated one as a single one (it must be *idempotent*), for example by recording the identifiers it has already handled in a table with a unique constraint.
