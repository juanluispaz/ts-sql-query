# Transaction

## Hight-level transaction management

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

Sometimes a fine-grain control over the transaction is required, in that situations ts-sql-query offer you the possibility to manually:

- begin the transaction

```ts
await connection.beginTransaction();
```

- commit the transaction

```ts
await connnection.commit();
```

- rollback the transaction

```ts
await connection.rollback();
```

When you use these methods, you must ensure the transaction begin before call commit or rollback.

## Transaction isolation

ts-sql-query allows you to indicate the transaction level when you start a new transaction.

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

**Note**: The Oracle database doesn't support specifying the isolation level and the access mode simultaneously.

```ts
const transactionResult = connection.transaction(async () => {
    ...
}, connection.isolationLevel('serializable', 'read only'));
```

```ts
await connection.beginTransaction(connection.isolationLevel('serializable', 'read only'));
```

## Defering execution till transaction ends

You can defer the execution of a logic till the end of the transaction. This defered logic can be set calling the `executeAfterNextCommit` or `executeAfterNextRollback` of the ts-sql-query connection in any momment of the application execution; the only condition is there must be an active transaction. ts-sql-query offer as well defer the execution of a logic till just before the commit calling `executeBeforeNextCommit`.

```ts
connection.executeAfterNextCommit(async () => {
    // Logic defered till the commit is executed
    console.log('After next commit')
})

connection.executeAfterNextRollback(async () => {
    // Logic defered till the rollback is executed
    console.log('After next rollback')
})

connection.executeBeforeNextCommit(async () => {
    // Logic defered till just before the commit is executed
    console.log('Before next commit')
})
```

**Note**: The provided function can be a sync function that returns void or an async function that returns a promise of void.