---
search:
  boost: 5
---
# Update Keywords

Look for an SQL keyword of an `UPDATE` to find the method that writes it. What each database offers is in [availability in each database](../queries/update.md#availability-in-each-database).

| SQL Keyword | ts-sql-query Equivalent | Notes | Link |
|:---|:---|:---|:---|
| DEFAULT | connection `.default()` as a value in `.set(...)` | The default value of the column (not on SQLite). | [Connection API](../api/connection.md) |
| DELETED, OLD, OLD_VALUE() | table `.oldValues()` | The value before the update, used in `.returning(...)`. | [Update returning old values](../queries/update.md#update-returning-old-values), [Update API](../api/update.md) |
| FROM, UPDATE a, b | query `.from(...)` | Updates with the data of another table. Written as `update a, b` on MySQL and MariaDB. | [Update using other tables or views](../queries/update.md#update-using-other-tables-or-views), [Update API](../api/update.md) |
| INNER JOIN | query `.innerJoin(...)` | Inner join, after `.from(...)`, or on MySQL and MariaDB right after `update`. | [Using joins](../queries/update.md#using-joins), [Update API](../api/update.md) |
| INSERTED | `.returning(...)` writes it | The value after the update on [SQL Server](../configuration/supported-databases/sqlserver.md). | [Update returning](../queries/update.md#update-returning), [Update API](../api/update.md) |
| JOIN | query `.join(...)` | Inner join, after `.from(...)`, or on MySQL and MariaDB right after `update`. | [Using joins](../queries/update.md#using-joins), [Update API](../api/update.md) |
| LEFT JOIN | query `.leftJoin(...)` | Left outer join, after `.from(...)`, or on MySQL and MariaDB right after `update`. | [Using joins](../queries/update.md#using-joins), [Update API](../api/update.md) |
| LEFT OUTER JOIN | query `.leftOuterJoin(...)` | Left outer join, after `.from(...)`, or on MySQL and MariaDB right after `update`. | [Using joins](../queries/update.md#using-joins), [Update API](../api/update.md) |
| LIMIT | No method. Use a custom SQL fragment. | Restricts the number of rows that are updated. | [Customizing an update](../queries/sql-fragments.md#customizing-an-update) |
| ON | query `.join(...).on(...)`, followed by `.and(...)`, `.or(...)` | The condition of a join. | [Using joins](../queries/update.md#using-joins), [Update API](../api/update.md) |
| OUTPUT | query `.returning(...)`, `.returningOneColumn(...)` | Returns updated values on [SQL Server](../configuration/supported-databases/sqlserver.md). | [Update returning](../queries/update.md#update-returning), [Update API](../api/update.md) |
| RETURNING | query `.returning(...)`, `.returningOneColumn(...)` | Returns updated values. | [Update returning](../queries/update.md#update-returning), [Update API](../api/update.md) |
| RETURNING INTO | query `.returning(...)`, `.returningOneColumn(...)` | Returns updated values into variables; [Oracle](../configuration/supported-databases/oracle.md)-specific. | [Update returning](../queries/update.md#update-returning), [Update API](../api/update.md) |
| SET | query `.set({...})`, `.setIfValue({...})`, `.dynamicSet()` | The values to set. | [Manipulating values to update](../queries/update.md#manipulating-values-to-update), [Update API](../api/update.md) |
| TOP | No method. Use a custom SQL fragment. | Restricts the number of rows that are updated. | [Customizing an update](../queries/sql-fragments.md#customizing-an-update) |
| UPDATE | connection `.update(table)`, or `.updateAllowingNoWhere(table)` to update without a `where` | Updates rows. | [Update](../queries/update.md#updating-rows), [Update without a where](../queries/update.md#update-without-a-where), [Update API](../api/update.md) |
| WHERE | query `.where(...)`, followed by `.and(...)`, `.or(...)` | Which rows to update. | [Update](../queries/update.md#updating-rows), [Update API](../api/update.md) |
| WITH | query `.forUseInQueryAs(...)`, used in the `.from(...)` or in a condition | A common table expression (CTE). | [A select used as a view](../queries/cte-subqueries.md#a-select-used-as-a-view-the-with-clause) |
