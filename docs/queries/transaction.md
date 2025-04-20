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
    const companyId = await connection.insertInto ...
    const customerId = await connection.insertInto ...

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

## Transaction isolation

`ts-sql-query` allows you to indicate the transaction level when you start a new transaction.

Avaliable isolation levels:

| **Database**                                                                                                     | `read uncommitted` | `read committed` | `repeatable read` | `snapshot` | `serializable` |
| ---------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------- | ----------------- | ---------- | -------------- |
| [MariaDB](https://mariadb.com/kb/en/set-transaction/#isolation-levels)                                           | **YES**            | **YES**\*        | **YES**           | _no_       | **YES**        |
| [MySql](https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html)                        | **YES**            | **YES**\*        | **YES**           | _no_       | **YES**        |
| [Oracle](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqlrf/SET-TRANSACTION.html)               | _no_               | **YES**\*        | _no_              | _no_       | **YES**        |
| [PostgreSql](https://www.postgresql.org/docs/16/transaction-iso.html)                                            | **YES**            | **YES**\*        | **YES**           | _no_       | **YES**        |
| [Sqlite](https://www.sqlite.org/isolation.html)                                                                  | _no_               | _no_             | _no_              | _no_       | _no_\*         |
| [SqlServer](https://learn.microsoft.com/en-us/sql/t-sql/statements/set-transaction-isolation-level-transact-sql) | **YES**            | **YES**\*        | **YES**           | **YES**    | **YES**        |

\* _Default_

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

You can set the transaction's isolation level by providing an additional argument to the `transaction` or `beginTransaction` method with a value created calling the `connection.isolationLevel` method. This function receives the isolation level as the first argument and the access mode as an optional second argument. You can also provide the access mode as the only argument. 

!!! warning

    The [Oracle](../configuration/supported-databases/oracle.md) database doesn't support specifying the isolation level and the access mode simultaneously.

```ts
const transactionResult = connection.transaction(async () => {
    ...
}, connection.isolationLevel('serializable', 'read only'));
```

```ts
await connection.beginTransaction(connection.isolationLevel('serializable', 'read only'));
```

## Deferring logic during a transaction

`ts-sql-query` allows you to register functions that will be executed **at specific points during the current transaction**. These hooks let you defer logic until:

- **just before** the transaction is committed (`executeBeforeNextCommit`)
- **immediately after** a successful commit (`executeAfterNextCommit`)
- **immediately after** a rollback (`executeAfterNextRollback`)

This feature is useful for tasks such as cleaning up temporary resources, logging, updating caches, notifying external systems, or triggering other side effects — while ensuring they only run if the transaction reaches a specific outcome (commit or rollback). This guarantees consistency between your database state and any external systems that rely on the success or failure of the transaction.

Each of these methods accepts either a synchronous function (`() => void`) or an asynchronous one (`() => Promise<void>`).

```ts
connection.executeBeforeNextCommit(async () => {
    // Logic to run just before the commit
    console.log('Before next commit');
});

connection.executeAfterNextCommit(() => {
    // Logic to run after the transaction is successfully committed
    console.log('After next commit');
});

connection.executeAfterNextRollback(() => {
    // Logic to run if the transaction is rolled back
    console.log('After next rollback');
});
```

!!! note

    - These functions are registered only for the **next** transaction event, and are cleared after use.  
    - They have no effect if called when there is no active transaction.

## Transaction metadata

You can attach and retrieve metadata specific to the current transaction using `getTransactionMetadata`, which returns a `Map<unknown, unknown>` available throughout the transaction's duration.

```ts
// Setting a value
connection.getTransactionMetadata().set('my key', 'my value')
```

```ts
// Getting a value
const myKeyValue: unknown = connection.getTransactionMetadata().get('my key')
```
