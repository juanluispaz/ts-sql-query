---
search:
  boost: 5
---
# Select Keywords

Look for an SQL keyword of a `SELECT` to find the method that writes it. For the keywords inside a value, like `LIKE` or `COUNT`, see [function and operator keywords](functions-operators.md).

| SQL Keyword | ts-sql-query Equivalent | Notes | Link |
|:---|:---|:---|:---|
| AS (in from) | table/view `.as(...)`, or `.forUseInLeftJoinAs(...)` in a left join | Alias of a table. | [Select with joins](../queries/select.md#select-with-joins), [Select with left join](../queries/select.md#select-with-left-join) |
| AS (in select) | The name of the property in the projection: `.select({ alias: tCustomer.name })` | Alias of a column. | [Basic query structure](../queries/basic-query-structure.md), [Complex projections](../queries/complex-projections.md) |
| ASC | query `.orderBy(col, 'asc')`, or `.orderBy(col)` | Ascending order. | [The order modes](../queries/select.md#the-order-modes), [Select API](../api/select.md) |
| COLLATE (in order by), LOWER (in order by) | query `.orderBy(col, 'insensitive')`, `'asc insensitive'`, `'desc insensitive'` | Order ignoring the case. Also with `nulls first` and `nulls last`. | [The order modes](../queries/select.md#the-order-modes), [Select API](../api/select.md) |
| CONNECT BY | query `.connectBy(...)` | The parent-child relationship of the rows in a hierarchical query; [Oracle](../configuration/supported-databases/oracle.md)-specific. | [Recursive connect by](../queries/recursive-select.md#recursive-connect-by), [Select API](../api/select.md) |
| CONNECT BY NOCYCLE | query `.connectByNoCycle(...)` | The same, avoiding the cycles; [Oracle](../configuration/supported-databases/oracle.md)-specific. | [Recursive connect by](../queries/recursive-select.md#recursive-connect-by), [Select API](../api/select.md) |
| CROSS JOIN, FROM a, b | query `.from(...)` | Combines each row of one table with each row of the other one. Written as `from a, b`. | [Several tables in the from](../queries/select.md#several-tables-in-the-from), [Select API](../api/select.md) |
| DESC | query `.orderBy(col, 'desc')` | Descending order. | [The order modes](../queries/select.md#the-order-modes), [Select API](../api/select.md) |
| DUAL, SELECT without FROM | connection `.selectFromNoTable()` | A select with no table. `from dual` on Oracle. | [Select without a table](../queries/select.md#select-without-a-table), [Connection API](../api/connection.md) |
| EXCEPT | query `.except(...)` | The rows of the first query that aren't in the second one, without duplicates. Written as `minus` on Oracle. | [Select compound](../queries/compound-select.md#what-each-operator-does), [Select API](../api/select.md) |
| EXCEPT ALL | query `.exceptAll(...)` | The same, keeping the duplicates. | [Select compound](../queries/compound-select.md#what-each-operator-does), [Select API](../api/select.md) |
| FETCH NEXT, FETCH FIRST | query `.limit(...)` | Limits the number of rows. Written as `fetch next` on Oracle and SQL Server. | [Limit and offset](../queries/select.md#limit-and-offset), [Select page](../queries/select-page.md), [Select API](../api/select.md) |
| FOR UPDATE | A custom SQL fragment | Locks the selected rows. | [How can I implement select for update?](../about/faqs.md#how-can-i-implement-select-for-update) |
| FROM | connection `.selectFrom(table)` | The table to read. | [Basic query structure](../queries/basic-query-structure.md), [Connection API](../api/connection.md) |
| FROM (SELECT ...), WITH | query `.forUseInQueryAs(...)` | A select used as a view: a common table expression (CTE), written in the from when the database has no `with`. | [A select used as a view](../queries/cte-subqueries.md#a-select-used-as-a-view-the-with-clause), [Does ts-sql-query support common table expressions (CTE)?](../about/faqs.md#does-ts-sql-query-support-common-table-expressions-cte), [Select API](../api/select.md) |
| FULL JOIN, FULL OUTER JOIN | Not available. Restructure the query using a union. | Full outer join. |  |
| GROUP BY | query `.groupBy(...)`, `.groupByNonAggregatedColumns()` | Groups the rows for the aggregates. | [Aggregate functions, group by and having](../queries/aggregate-and-group-by.md), [Select API](../api/select.md) |
| HAVING | query `.having(...)` | Filters the groups. | [Filtering the groups with having](../queries/aggregate-and-group-by.md#filtering-the-groups-with-having), [Select API](../api/select.md) |
| INNER JOIN | query `.innerJoin(...)` | Inner join. | [Select with joins](../queries/select.md#select-with-joins), [Select API](../api/select.md) |
| INTERSECT | query `.intersect(...)` | The rows in both queries, without duplicates. | [Select compound](../queries/compound-select.md#what-each-operator-does), [Select API](../api/select.md) |
| INTERSECT ALL | query `.intersectAll(...)` | The same, keeping the duplicates. | [Select compound](../queries/compound-select.md#what-each-operator-does), [Select API](../api/select.md) |
| JOIN | query `.join(...)` | Inner join. | [Select with joins](../queries/select.md#select-with-joins), [Select API](../api/select.md) |
| LEFT JOIN | query `.leftJoin(...)` | Left outer join. | [Select with left join](../queries/select.md#select-with-left-join), [Select API](../api/select.md) |
| LEFT OUTER JOIN | query `.leftOuterJoin(...)` | Left outer join. | [Select with left join](../queries/select.md#select-with-left-join), [Select API](../api/select.md) |
| LIMIT | query `.limit(...)`, `.limitIfValue(...)` | Limits the number of rows. | [Limit and offset](../queries/select.md#limit-and-offset), [Select page](../queries/select-page.md), [Select API](../api/select.md), [Optional limit and offset](../dynamic/optional-parts/order-and-page.md#optional-limit-and-offset) |
| MINUS | query `.minus(...)` | The same as `except`. Oracle is the database where it's written as `minus`. | [Select compound](../queries/compound-select.md#what-each-operator-does), [Select API](../api/select.md) |
| MINUS ALL | query `.minusAll(...)` | The same as `exceptAll`. | [Select compound](../queries/compound-select.md#what-each-operator-does), [Select API](../api/select.md) |
| NULLS FIRST | query `.orderBy(col, 'asc nulls first')`, `.orderBy(col, 'desc nulls first')` | The nulls before the other values. | [The order modes](../queries/select.md#the-order-modes), [Select API](../api/select.md) |
| NULLS LAST | query `.orderBy(col, 'asc nulls last')`, `.orderBy(col, 'desc nulls last')` | The nulls after the other values. | [The order modes](../queries/select.md#the-order-modes), [Select API](../api/select.md) |
| OFFSET | query `.offset(...)`, `.offsetIfValue(...)` | Skips rows. | [Limit and offset](../queries/select.md#limit-and-offset), [Select page](../queries/select-page.md), [Select API](../api/select.md), [Optional limit and offset](../dynamic/optional-parts/order-and-page.md#optional-limit-and-offset) |
| ON | query `.join(...).on(...)`, followed by `.and(...)`, `.or(...)` | The condition of a join. | [Select with joins](../queries/select.md#select-with-joins), [Select API](../api/select.md) |
| ORDER BY | query `.orderBy(...)`, `.orderByFromString(...)` | Orders the result. | [What you can order by](../queries/select.md#what-you-can-order-by), [Order by from a string](../dynamic/optional-parts/order-and-page.md#order-by-from-a-string), [Select API](../api/select.md) |
| ORDER SIBLINGS BY | query `.orderBy(...).orderingSiblingsOnly()` | Orders the rows with the same parent in a hierarchical query; [Oracle](../configuration/supported-databases/oracle.md)-specific. | [Recursive connect by](../queries/recursive-select.md#recursive-connect-by), [Select API](../api/select.md) |
| OVER, PARTITION BY (window functions) | No method. Use a custom SQL fragment. | A function computed over a window of rows. | [A window](../queries/sql-fragments.md#a-window) |
| PRIOR | Given as a function to `.connectBy(...)` and `.connectByNoCycle(...)` | The parent row in the hierarchy; [Oracle](../configuration/supported-databases/oracle.md)-specific. | [Recursive connect by](../queries/recursive-select.md#recursive-connect-by), [Select API](../api/select.md) |
| RECURSIVE, WITH RECURSIVE | query `.recursiveUnion(...)`, `.recursiveUnionAll(...)`, `.recursiveUnionOn(...)`, `.recursiveUnionAllOn(...)` | A recursive common table expression (CTE). | [Recursive select](../queries/recursive-select.md), [Select API](../api/select.md) |
| RIGHT JOIN, RIGHT OUTER JOIN | Not available. Restructure the query to use a left join. | Right outer join. |  |
| SELECT | connection `.selectFrom(...)`, then query `.select({...})` | The columns to return. | [Basic query structure](../queries/basic-query-structure.md), [Connection API](../api/connection.md) |
| SELECT * | `.select(tCustomer)`, which writes the columns one by one. | Every column of a table. | [Select all the columns of a table](../advanced/columns-from-object.md#select-all-the-columns-of-a-table) |
| (SELECT ...) as a value | query `.forUseAsInlineQueryValue()` | A subquery that returns a single value. | [Inline subquery as value](../queries/cte-subqueries.md#inline-subquery-as-value) |
| SELECT COUNT(*) | query `.selectCountAll()` | Counts the rows. | [Select count all](../queries/select.md#select-count-all), [Select API](../api/select.md) |
| SELECT DISTINCT | connection `.selectDistinctFrom(...)` | Removes the duplicates. | [Select distinct](../queries/select.md#select-distinct), [Connection API](../api/connection.md) |
| START WITH | query `.startWith(...)` | The root rows of a hierarchical query; [Oracle](../configuration/supported-databases/oracle.md)-specific. | [Recursive connect by](../queries/recursive-select.md#recursive-connect-by), [Select API](../api/select.md) |
| TOP | query `.limit(...)` | Limits the number of rows. Written as `fetch next` on SQL Server. | [Limit and offset](../queries/select.md#limit-and-offset), [Select page](../queries/select-page.md), [Select API](../api/select.md) |
| UNION | query `.union(...)` | The rows of both queries, without duplicates. | [Select compound](../queries/compound-select.md#what-each-operator-does), [Select API](../api/select.md) |
| UNION ALL | query `.unionAll(...)` | The rows of both queries. | [Select compound](../queries/compound-select.md#what-each-operator-does), [Select API](../api/select.md) |
| VALUES (in from or with) | `Values.create(...)` | Constant rows used as a table. | [Constant values view API](../api/constant-values-view.md) |
| WHERE | query `.where(...)`, followed by `.and(...)`, `.or(...)` | Filters the rows. | [Basic query structure](../queries/basic-query-structure.md), [Select API](../api/select.md) |
