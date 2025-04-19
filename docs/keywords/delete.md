---
search:
  boost: 5
---
# Delete Keywords

This page lists the SQL keywords and clauses used in `DELETE` statements, along with their corresponding methods in `ts-sql-query`. It includes support for joins, conditional filters, returning deleted rows, and database-specific features like `USING` or `RETURNING INTO`.

| SQL Keyword       | ts-sql-query Equivalent           | Notes                                                                | Link                                                          |
|:------------------|:----------------------------------|:---------------------------------------------------------------------|:--------------------------------------------------------------|
| DELETE FROM       | connection `.deleteFrom(...)`     | Starts a delete statement for a given table.                         | [Delete](../queries/delete.md), [Delete API](../api/delete.md) |
| FROM              | query `.from(...)`                | Used to perform deletes with joins (SQL Server, PostgreSQL, MySQL).  | [Delete using other tables or views](../queries/delete.md#delete-using-other-tables-or-views), [Delete API](../api/delete.md) |
| INNER JOIN        | query `.innerJoin(...)`           | Inner join between tables.                                           | [Delete using other tables or views](../queries/delete.md#delete-using-other-tables-or-views), [Delete API](../api/delete.md) |
| JOIN              | query `.join(...)`                | Inner join between tables.                                           | [Delete using other tables or views](../queries/delete.md#delete-using-other-tables-or-views), [Delete API](../api/delete.md) |
| LIMIT             | Not supported yet. Use a custom SQL fragment. | Restricts the number of rows that are deleted.           | [Customizing a delete](../queries/sql-fragments.md#customizing-a-delete) |
| LEFT JOIN         | query `.leftJoin(...)`            | Left outer join between tables.                                      | [Delete API](../api/delete.md) |
| LEFT OUTER JOIN   | query `.leftOuterJoin(...)`       | Left outer join between tables.                                      | [Delete API](../api/delete.md) |
| OUTPUT            | query `.returning(...)`           | Returns deleted rows or specific columns (Sql Server).               | [Delete returning](../queries/delete.md#delete-returning), [Delete API](../api/delete.md) |
| RETURNING         | query `.returning(...)`           | Returns deleted rows or specific columns.                            | [Delete returning](../queries/delete.md#delete-returning), [Delete API](../api/delete.md) |
| RETURNING INTO    | query `.returning(...)`           | Returns deleted rows or specific columns (Oracle).                   | [Delete returning](../queries/delete.md#delete-returning), [Delete API](../api/delete.md) |
| TOP               | Not supported yet. Use a custom SQL fragment. | Restricts the number of rows that are deleted.           | [Customizing a delete](../queries/sql-fragments.md#customizing-a-delete)           |
| USING             | query `.using(...)`               | Deletes using data from another table.                               | [Delete using other tables or views](../queries/delete.md#delete-using-other-tables-or-views), [Delete API](../api/delete.md) |
| WHERE             | query `.where(...)`               | Filters which rows should be deleted.                                | [Delete](../queries/delete.md), [Delete API](../api/delete.md) |
| WITH              | query `.forUseInQueryAs(...)`     | Common Table Expression (CTE) before DELETE.                         | [CTE usage](../queries/select.md#using-a-select-as-a-view-in-another-select-query-sql-with-clause) |
| WITH RECURSIVE    | query `.forUseInQueryAs(...)`     | Recursive Common Table Expression before DELETE.                     | [Recursive select](../queries/recursive-select.md) |
