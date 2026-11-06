---
search:
  boost: 0.11
---
# Limitations

The first two sections are things the library doesn't write, and what to do instead. The others answer questions that look like limitations, and aren't.

## Does ts-sql-query support window functions?

No, and there are no plans to support them: each database implements them in a different way. You have two ways of using them:

- Create a view in the database that uses them, and [map the view](../configuration/mapping.md#mapping-the-views).
- Write them in a [SQL fragment](../queries/sql-fragments.md). For the `window` clause of a select, `customizeQuery` has [`customWindow`](../queries/sql-fragments.md#customizing-a-select).

## Is it possible to include INSERT, UPDATE, or DELETE statements in a WITH clause?

No. PostgreSQL accepts these statements in a `with` clause, but `ts-sql-query` doesn't write them: what goes in a `with` clause is a [select](../queries/cte-subqueries.md#a-select-used-as-a-view-the-with-clause).

## How to compare against a null or undefined value?

In SQL, a comparison with `null` isn't true or false: it's `null`, and a `where` discards the row. To avoid this surprise, `equals` and the other comparisons don't accept a `null` or an `undefined` from your code. You choose what to do when there is no value, here with a variable `parentId` of type `number | null`:

| When there is no value | Use |
|---|---|
| The condition disappears | `tCompany.parentId.equalsIfValue(parentId)` |
| No row is found | `tCompany.parentId.equalsIfValue(parentId).falseWhenNoValue()` |
| The rows with `null` in the column are found | `tCompany.parentId.is(parentId)` |
| The comparison of SQL is made, so no row is found | `tCompany.parentId.equals(connection.optionalConst(parentId, 'int'))` |

See [Optional conditions: the IfValue methods](../queries/dynamic-queries.md#optional-conditions-the-ifvalue-methods) and [Booleans and three-valued logic](../dynamic/optional-parts/three-valued-booleans.md).

## How to order by a column not returned in the SELECT projection?

Pass the column to `orderBy`:

```ts
const customerWithId = connection.selectFrom(tCustomer)
    .where(tCustomer.id.equals(10))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName
    })
    .orderBy(tCustomer.birthday, 'desc nulls last')
    .executeSelectOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where id = ? 
    order by customer.birthday desc
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where id = ? 
    order by customer.birthday desc
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    where id = :0 
    order by customer.birthday desc nulls last
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    where id = $1 
    order by customer.birthday desc nulls last
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where id = ?1 
    order by customer.birthday desc nulls last
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where id = @0 
    order by customer.birthday desc
    ```

The parameters are: `[ 10 ]`

## How to handle optional values returned by a SELECT COUNT(*) inline subquery?

Use `selectCountAll()`: a count always returns one row, so its value isn't optional. See [Inline subquery referencing the outer query](../queries/cte-subqueries.md#inline-subquery-referencing-the-outer-query).
