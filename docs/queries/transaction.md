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
    - Calling them when there is no active transaction throws a `TsSqlProcessingError` with reason `'NOT_IN_TRANSACTION'`. The mock query runner skips that check and silently accepts the registration (the hook is never fired).

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
