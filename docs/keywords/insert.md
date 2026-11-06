---
search:
  boost: 5
---
# Insert Keywords

Look for an SQL keyword of an `INSERT` to find the method that writes it. The syntax of conflicts varies, so see [what each database offers](../queries/insert-on-conflict.md#what-each-database-offers).

| SQL Keyword | ts-sql-query Equivalent | Notes | Link |
|:---|:---|:---|:---|
| DEFAULT | connection `.default()` as a value in `.set(...)` | The default value of the column (not on SQLite). | [Connection API](../api/connection.md) |
| EXCLUDED | table `.valuesForInsert()` | The values an upsert tried to insert. The keyword of PostgreSQL and SQLite. | [The existing row and the new values](../queries/insert-on-conflict.md#the-existing-row-and-the-new-values), [Insert API](../api/insert.md) |
| INSERT INTO | connection `.insertInto(...)` | Inserts rows. | [Insert](../queries/insert.md), [Insert API](../api/insert.md) |
| INSERT INTO ... VALUES (...), one row | query `.set(...)` | Inserts one row. | [Insert one row](../queries/insert.md#insert-one-row), [Insert API](../api/insert.md) |
| INSERT INTO ... VALUES (...), several rows | query `.values([...])` | Inserts several rows in one statement. | [Insert multiple values](../queries/insert.md#insert-multiple-values), [Insert API](../api/insert.md) |
| INSERT INTO ... SELECT | query `.from(...)` | Inserts the rows of a select. | [Insert from select](../queries/insert.md#insert-from-select), [Insert API](../api/insert.md) |
| INSERT INTO ... DEFAULT VALUES, () VALUES () | query `.defaultValues()` | Inserts a row with the default value of every column. | [Insert default values](../queries/insert.md#insert-default-values), [Insert API](../api/insert.md) |
| INSERT IGNORE | query `.onConflictDoNothing()` | The way of MySQL and MariaDB to do nothing on a conflict. | [Do nothing on conflict](../queries/insert-on-conflict.md#do-nothing), [Insert API](../api/insert.md) |
| INSERTED | table `.valuesForInsert()` | The values an upsert tried to insert. See also `OUTPUT`. | [The existing row and the new values](../queries/insert-on-conflict.md#the-existing-row-and-the-new-values), [Insert API](../api/insert.md) |
| ON CONFLICT | query `.onConflictOn(...columns)` | The columns of the conflict; continue with `.doNothing()` or `.doUpdateSet({...})`. | [Choosing the conflict](../queries/insert-on-conflict.md#choosing-the-conflict), [Insert API](../api/insert.md) |
| ON CONFLICT DO NOTHING | query `.onConflictDoNothing()`, `.onConflictOn(...).doNothing()` | Skips the row on a conflict. | [Do nothing on conflict](../queries/insert-on-conflict.md#do-nothing), [Insert API](../api/insert.md) |
| ON CONFLICT DO UPDATE SET | query `.onConflictOn(...).doUpdateSet({...})`, `.doUpdateSetIfValue({...})`, `.doUpdateDynamicSet()` | Updates the existing row on a conflict. | [Update the existing row ("upsert")](../queries/insert-on-conflict.md#update-the-existing-row-upsert), [Insert API](../api/insert.md) |
| ON CONFLICT ON CONSTRAINT | query `` .onConflictOnConstraint(connection.rawFragment`constraint_name`) `` | A constraint by its name instead of its columns. | [A conflict on a named constraint](../queries/insert-on-conflict.md#a-conflict-on-a-named-constraint), [Insert API](../api/insert.md) |
| ON DUPLICATE KEY UPDATE | query `.onConflictDoUpdateSet({...})`, `.onConflictDoUpdateSetIfValue({...})`, `.onConflictDoUpdateDynamicSet()` | The upsert of MySQL and MariaDB. | [Update the existing row ("upsert")](../queries/insert-on-conflict.md#update-the-existing-row-upsert), [Insert API](../api/insert.md) |
| OUTPUT | query `.returning(...)`, `.returningOneColumn(...)`, `.returningLastInsertedId()` | Returns inserted values on [SQL Server](../configuration/supported-databases/sqlserver.md). | [Insert returning](../queries/insert.md#insert-returning), [Insert API](../api/insert.md) |
| RETURNING | query `.returning(...)`, `.returningOneColumn(...)`, `.returningLastInsertedId()` | Returns inserted values. | [Insert returning](../queries/insert.md#insert-returning), [Insert API](../api/insert.md) |
| RETURNING INTO | query `.returning(...)`, `.returningOneColumn(...)`, `.returningLastInsertedId()` | Returns inserted values into variables; [Oracle](../configuration/supported-databases/oracle.md)-specific. | [Insert returning](../queries/insert.md#insert-returning), [Insert API](../api/insert.md) |
| VALUES(column) (in an upsert) | table `.valuesForInsert()` | The values an upsert tried to insert, on MySQL and MariaDB. | [The existing row and the new values](../queries/insert-on-conflict.md#the-existing-row-and-the-new-values), [Insert API](../api/insert.md) |
| WHERE (on conflict) | query `.onConflictOn(...).where(...)` | The condition of a partial unique index. | [A conflict on a partial unique index](../queries/insert-on-conflict.md#a-conflict-on-a-partial-unique-index), [Insert API](../api/insert.md) |
| WHERE (do update set) | query `.doUpdateSet({...}).where(...)` | Which conflicting rows to update. | [Updating only some of the conflicting rows](../queries/insert-on-conflict.md#updating-only-some-of-the-conflicting-rows), [Insert API](../api/insert.md) |
| WITH | query `.forUseInQueryAs(...)`, used in the `.from(...)` | A common table expression (CTE) in an insert from select. | [A select used as a view](../queries/cte-subqueries.md#a-select-used-as-a-view-the-with-clause) |
| WITH RECURSIVE | query `.recursiveUnion(...)`, `.recursiveUnionAll(...)`, used in the `.from(...)` | A recursive common table expression (CTE). | [Recursive select](../queries/recursive-select.md) |
