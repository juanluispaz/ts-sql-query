---
search:
  boost: 5
---
# Transaction Keywords

Look for an SQL keyword of a transaction to find the method that writes it. SQLite has no `isolationLevel` method. The levels of each database are in [what each database offers](../queries/transaction.md#what-each-database-offers).

| SQL Keyword | ts-sql-query Equivalent | Notes | Link |
|:---|:---|:---|:---|
| BEGIN, BEGIN TRANSACTION, START, START TRANSACTION | connection `.beginTransaction()`, connection `.transaction(...)` | Begins a transaction. | [Transaction](../queries/transaction.md), [Connection API](../api/connection.md) |
| COMMIT, COMMIT TRANSACTION | connection `.commit()`, or the end of the function given to `.transaction(...)` | Commits the transaction. | [Transaction](../queries/transaction.md), [Connection API](../api/connection.md) |
| ROLLBACK, ROLLBACK TRANSACTION | connection `.rollback()`, or an error that leaves the function given to `.transaction(...)` | Rolls back the transaction. | [Transaction](../queries/transaction.md), [Connection API](../api/connection.md) |
| SAVEPOINT name | Not available. | Creates a savepoint in the transaction. | [Nested transactions](../queries/transaction.md#nested-transactions) |
| ROLLBACK TO name, ROLLBACK TO SAVEPOINT name, ROLLBACK TRANSACTION TO name, ROLLBACK TRANSACTION TO SAVEPOINT name | Not available. | Rolls back to a savepoint. | [Nested transactions](../queries/transaction.md#nested-transactions) |
| RELEASE name, RELEASE SAVEPOINT name | Not available. | Removes a savepoint. | [Nested transactions](../queries/transaction.md#nested-transactions) |
| SET TRANSACTION | connection `.isolationLevel(...)`, given to `.beginTransaction(...)` or `.transaction(...)` | Sets the isolation level or the access mode. | [Isolation levels](../queries/transaction.md#isolation-levels), [Connection API](../api/connection.md) |
| ISOLATION LEVEL READ UNCOMMITTED | `connection.beginTransaction(connection.isolationLevel('read uncommitted'))`, or as the last argument of `connection.transaction(...)` | Isolation level. | [Isolation levels](../queries/transaction.md#isolation-levels), [Connection API](../api/connection.md) |
| ISOLATION LEVEL READ COMMITTED | `connection.beginTransaction(connection.isolationLevel('read committed'))`, or as the last argument of `connection.transaction(...)` | Isolation level. | [Isolation levels](../queries/transaction.md#isolation-levels), [Connection API](../api/connection.md) |
| ISOLATION LEVEL REPEATABLE READ | `connection.beginTransaction(connection.isolationLevel('repeatable read'))`, or as the last argument of `connection.transaction(...)` | Isolation level. On PostgreSQL, MySQL and MariaDB, `REPEATABLE READ` is `.isolationLevel('snapshot')`. | [Isolation levels](../queries/transaction.md#isolation-levels), [Connection API](../api/connection.md) |
| ISOLATION LEVEL SNAPSHOT | `connection.beginTransaction(connection.isolationLevel('snapshot'))`, or as the last argument of `connection.transaction(...)` | Isolation level. | [Isolation levels](../queries/transaction.md#isolation-levels), [Connection API](../api/connection.md) |
| ISOLATION LEVEL SERIALIZABLE | `connection.beginTransaction(connection.isolationLevel('serializable'))`, or as the last argument of `connection.transaction(...)` | Isolation level. On Oracle, `SERIALIZABLE` is `.isolationLevel('snapshot')`. | [Isolation levels](../queries/transaction.md#isolation-levels), [Connection API](../api/connection.md) |
| READ ONLY | `connection.beginTransaction(connection.isolationLevel('read only'))`, or as the last argument of `connection.transaction(...)` | Access mode. It can follow a level: `.isolationLevel('snapshot', 'read only')`. | [Access modes](../queries/transaction.md#access-modes), [Connection API](../api/connection.md) |
| READ WRITE | `connection.beginTransaction(connection.isolationLevel('read write'))`, or as the last argument of `connection.transaction(...)` | Access mode. It can follow a level: `.isolationLevel('snapshot', 'read write')`. | [Access modes](../queries/transaction.md#access-modes), [Connection API](../api/connection.md) |
