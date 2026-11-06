---
search:
  boost: 5
---
# Delete Keywords

Look for an SQL keyword of a `DELETE` to find the method that writes it. What each database offers is in [availability in each database](../queries/delete.md#availability-in-each-database).

| SQL Keyword | ts-sql-query Equivalent | Notes | Link |
|:---|:---|:---|:---|
| DELETE FROM | connection `.deleteFrom(...)`, or `.deleteAllowingNoWhereFrom(...)` to delete without a `where` | Deletes rows. | [Delete](../queries/delete.md), [Delete without a where](../queries/delete.md#delete-without-a-where), [Delete API](../api/delete.md) |
| FROM (a second one) | query `.using(...)` | Deletes with the data of another table. Written as a second `from` on [SQL Server](../configuration/supported-databases/sqlserver.md). | [Delete using other tables or views](../queries/delete.md#delete-using-other-tables-or-views), [Delete API](../api/delete.md) |
| INNER JOIN | query `.innerJoin(...)` | Inner join, after `.using(...)`, or on MySQL and MariaDB right after `deleteFrom`. | [Using joins](../queries/delete.md#using-joins), [Delete API](../api/delete.md) |
| JOIN | query `.join(...)` | Inner join, after `.using(...)`, or on MySQL and MariaDB right after `deleteFrom`. | [Using joins](../queries/delete.md#using-joins), [Delete API](../api/delete.md) |
| LEFT JOIN | query `.leftJoin(...)` | Left outer join, after `.using(...)`, or on MySQL and MariaDB right after `deleteFrom`. | [Using joins](../queries/delete.md#using-joins), [Delete API](../api/delete.md) |
| LEFT OUTER JOIN | query `.leftOuterJoin(...)` | Left outer join, after `.using(...)`, or on MySQL and MariaDB right after `deleteFrom`. | [Using joins](../queries/delete.md#using-joins), [Delete API](../api/delete.md) |
| LIMIT | No method. Use a custom SQL fragment. | Restricts the number of rows that are deleted. | [Customizing a delete](../queries/sql-fragments.md#customizing-a-delete) |
| ON | query `.join(...).on(...)`, followed by `.and(...)`, `.or(...)` | The condition of a join. | [Using joins](../queries/delete.md#using-joins), [Delete API](../api/delete.md) |
| OUTPUT | query `.returning(...)`, `.returningOneColumn(...)` | Returns deleted values on [SQL Server](../configuration/supported-databases/sqlserver.md). | [Delete returning](../queries/delete.md#delete-returning), [Delete API](../api/delete.md) |
| RETURNING | query `.returning(...)`, `.returningOneColumn(...)` | Returns deleted values. | [Delete returning](../queries/delete.md#delete-returning), [Delete API](../api/delete.md) |
| RETURNING INTO | query `.returning(...)`, `.returningOneColumn(...)` | Returns deleted values into variables; [Oracle](../configuration/supported-databases/oracle.md)-specific. | [Delete returning](../queries/delete.md#delete-returning), [Delete API](../api/delete.md) |
| TOP | No method. Use a custom SQL fragment. | Restricts the number of rows that are deleted. | [Customizing a delete](../queries/sql-fragments.md#customizing-a-delete) |
| USING | query `.using(...)` | Deletes with the data of another table. | [Delete using other tables or views](../queries/delete.md#delete-using-other-tables-or-views), [Delete API](../api/delete.md) |
| WHERE | query `.where(...)`, followed by `.and(...)`, `.or(...)` | Which rows to delete. | [Delete](../queries/delete.md), [Delete API](../api/delete.md) |
| WITH | query `.forUseInQueryAs(...)`, used in the `.using(...)` or in a condition | A common table expression (CTE) before the delete. | [A select used as a view](../queries/cte-subqueries.md#a-select-used-as-a-view-the-with-clause) |
| WITH RECURSIVE | query `.recursiveUnion(...)`, `.recursiveUnionAll(...)`, used in the `.using(...)` or in a condition | A recursive common table expression (CTE) before the delete. | [Recursive select](../queries/recursive-select.md) |
