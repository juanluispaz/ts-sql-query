---
search:
  boost: 5
---
# Update Keywords

This page lists the SQL keywords and clauses used in `UPDATE` statements, along with their corresponding methods in `ts-sql-query`. It covers setting column values, filtering rows, using joins, returning old and new values, and engine-specific clauses like `RETURNING` or `OUTPUT`.

| SQL Keyword                                | ts-sql-query Equivalent                    | Notes                                                                     | Link                                                          |
|:-------------------------------------------|:-------------------------------------------|:--------------------------------------------------------------------------|:--------------------------------------------------------------|
| DELETED                                    | table `.oldValues()`                       | Refers to the previous value before an update.                            | [Update returning old values](../queries/update.md#update-returning-old-values), [Update API](../api/update.md) |
| FROM                                       | query `.from(...)`                         | Updates using data from another table.                                    | [Update using other tables or views](../queries/update.md#update-using-other-tables-or-views), [Update API](../api/update.md) |
| INNER JOIN                                 | query `.innerJoin(...)`                    | Inner join between tables.                                                | [Update API](../api/update.md)                                |
| INSERTED                                   | Managed automatically by ts-sql-query      | Refers to the new value after an update.                                  |                                                               |
| JOIN                                       | query `.join(...)`                         | Inner join between tables.                                                | [Update API](../api/update.md)                                |
| LEFT JOIN                                  | query `.leftJoin(...)`                     | Left outer join between tables.                                           | [Update API](../api/update.md)                                |
| LEFT OUTER JOIN                            | query `.leftOuterJoin(...)`                | Left outer join between tables.                                           | [Update API](../api/update.md)                                |
| LIMIT                                      | Not supported yet. Use a custom SQL fragment. | Restricts the number of rows that are deleted.                         | [Customizing an update](../queries/sql-fragments.md#customizing-an-update)   |
| OUTPUT                                     | query `.returning(...)`                    | Returns updated rows or specific columns (SQL Server).                    | [Update returning](../queries/update.md#update-returning), [Update API](../api/update.md) |
| RETURNING                                  | query `.returning(...)`                    | Returns updated rows or specific columns.                                 | [Update returning](../queries/update.md#update-returning), [Update API](../api/update.md) |
| RETURNING INTO                             | query `.returning(...)`                    | Returns updated rows or specific columns (Oracle).                        | [Update returning](../queries/update.md#update-returning), [Update API](../api/update.md) |
| SET                                        | query `.set({...})`                        | Set values.                                                               | [Update](../queries/update.md#general-update), [Update API](../api/update.md) |
| TOP                                        | Not supported yet. Use a custom SQL fragment. | Restricts the number of rows that are deleted.                         | [Customizing an update](../queries/sql-fragments.md#customizing-an-update)    |
| UPDATE                                     | connection `.update(table)`                | Updates records in a table.                                               | [Update](../queries/update.md#general-update), [Update API](../api/update.md) |
| WHERE                                      | query `.where({...})`                      | Filters which rows should be updated.                                     | [Update](../queries/update.md#general-update), [Update API](../api/update.md) |
