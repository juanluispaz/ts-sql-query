---
search:
  boost: 3
---
# Select page

A select page returns one page of rows together with the total number of rows that match. It's what a list in a user interface needs to show "21–30 of 146 results" and its page controls.

`executeSelectPage()` is the only execution method that sends two queries: one reads the rows of the page and the other one counts all the matching rows. If you don't need the total, you can [avoid the count query](#avoiding-the-count-query).

You may need only one of the two: `executeSelectMany()` with `limit` and `offset` returns the rows of the page without the total, and `selectCountAll()` with `executeSelectOne()` returns the total without the rows.

For a table in a user interface, whose filters, order and page come from a request, see [Queries from a request](../dynamic/queries-from-requests.md).

## Limit and offset

A page is defined with two numbers. The database takes the rows of the select in their order, skips the first `offset` rows, and returns at most `limit` rows.

These are the pages of a select that returns 146 rows, with 10 rows per page:

| Page | `limit` | `offset` | Rows returned |
|---|---|---|---|
| 1 | 10 | 0 | 1 to 10 |
| 2 | 10 | 10 | 11 to 20 |
| 3 | 10 | 20 | 21 to 30 |
| 15 | 10 | 140 | 141 to 146 |

So the offset is `(pageNumber - 1) * pageSize`, and the number of pages is the total divided by the page size, rounded up:

```ts
const pageNumber = 3
const pageSize = 10

const customerPage = await connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName
    })
    .orderBy('id')
    .limit(pageSize)
    .offset((pageNumber - 1) * pageSize)
    .executeSelectPage();

const totalPages = Math.ceil(customerPage.count / pageSize)
```

The executed query to get the data is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    order by id 
    limit ? 
    offset ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    order by id 
    limit ? 
    offset ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    order by "id" 
    offset :0 rows 
    fetch next :1 rows only
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    order by id 
    limit $1 
    offset $2
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    order by id 
    limit ?1 
    offset ?2
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    order by id 
    offset @0 rows 
    fetch next @1 rows only
    ```

And its parameters are: `[ 10, 20 ]` (on Oracle and SQL Server: `[ 20, 10 ]`)

The executed query to get the count is:

=== "MariaDB"
    ```mariadb
    select count(*) 
    from customer
    ```
=== "MySQL"
    ```mysql
    select count(*) 
    from customer
    ```
=== "Oracle"
    ```oracle
    select count(*) 
    from customer
    ```
===+ "PostgreSQL"
    ```postgresql
    select count(*) 
    from customer
    ```
=== "SQLite"
    ```sqlite
    select count(*) 
    from customer
    ```
=== "SQL Server"
    ```sqlserver
    select count(*) 
    from customer
    ```

And its parameters are: `[]`

Both are optional:

- With `limit` and no `offset`, the page starts at the first row.
- With `offset` and no `limit`, you get all the rows after the skipped ones. MariaDB, MySQL and SQLite don't accept an offset alone, so the library adds `limit 2147483647` for them.
- With neither of them, `data` has all the rows.

A page after the last row isn't an error: `data` is empty and `count` is still the total.

When the values are optional, for example because they come from a request, use [`limitIfValue` and `offsetIfValue`](../dynamic/order-and-page.md#optional-limit-and-offset). They ignore `null` and `undefined`. A `0` is a value: `limitIfValue(0)` asks for no rows.

```ts
const paging: { limit?: number, offset?: number } = { limit: 10 }

const customerPage = await connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .orderBy('id')
    .limitIfValue(paging.limit)
    .offsetIfValue(paging.offset)
    .executeSelectPage();
```

The executed query to get the data is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by id 
    limit ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by id 
    limit ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName" 
    from customer 
    order by "id" 
    fetch next :0 rows only
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName" 
    from customer 
    order by id 
    limit $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by id 
    limit ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by id 
    offset 0 rows 
    fetch next @0 rows only
    ```

And its parameters are: `[ 10 ]`

The executed query to get the count is:

=== "MariaDB"
    ```mariadb
    select count(*) 
    from customer
    ```
=== "MySQL"
    ```mysql
    select count(*) 
    from customer
    ```
=== "Oracle"
    ```oracle
    select count(*) 
    from customer
    ```
===+ "PostgreSQL"
    ```postgresql
    select count(*) 
    from customer
    ```
=== "SQLite"
    ```sqlite
    select count(*) 
    from customer
    ```
=== "SQL Server"
    ```sqlserver
    select count(*) 
    from customer
    ```

And its parameters are: `[]`

## Ordering the rows

Always order a page. Without an `order by`, the database can return the rows in any order, and that order can change from one query to the next. Each page is a separate query, so a row could appear in two pages, or in none.

The order must also leave no ties. If you order by name and several customers share the name, the database can place them differently in each query, with the same result. Add a column that identifies the row as the last criterion, for example `.orderBy('firstName').orderBy('lastName').orderBy('id')`.

SQL Server doesn't accept `offset` and `fetch` without an `order by`. If you don't write one, the library orders by the first primary key column in the select, or else by the first column. This makes the query valid, but it's better to choose the order yourself.

!!! tip

    An offset is a position, so a row inserted or deleted before it, between two requests, moves the rows: the next page repeats a row or skips one. The database also has to go through the skipped rows, so very large offsets are slow. When the user only moves forward, you can avoid both problems by using a `where` with the last value seen instead of the offset, like `tCustomer.id.greaterThan(lastSeenId)`, ordering by that column.

## Getting the page and the total

This query looks for the customers whose first or last name starts with some text, and returns the third page of 10 rows:

```ts
const customerName = 'Smi'

const customerPageWithName = connection.selectFrom(tCustomer)
    .where(
        tCustomer.firstName.startsWithInsensitive(customerName)
    ).or(
        tCustomer.lastName.startsWithInsensitive(customerName)
    ).select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName
    })
    .orderBy('firstName')
    .orderBy('lastName')
    .limit(10)
    .offset(20)
    .executeSelectPage();
```

The executed query to get the data is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where 
           lower(first_name) like concat(lower(?), '%') 
        or lower(last_name) like concat(lower(?), '%') 
    order by 
        firstName, 
        lastName 
    limit ? 
    offset ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where 
           lower(first_name) like concat(lower(?), '%') 
        or lower(last_name) like concat(lower(?), '%') 
    order by 
        firstName, 
        lastName 
    limit ? 
    offset ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    where 
           lower(first_name) like lower(:0 || '%') escape '\' 
        or lower(last_name) like lower(:1 || '%') escape '\' 
    order by 
        "firstName", 
        "lastName" 
    offset :2 rows 
    fetch next :3 rows only
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    where 
           first_name ilike ($1 || '%') 
        or last_name ilike ($2 || '%') 
    order by 
        "firstName", 
        "lastName" 
    limit $3 
    offset $4
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where 
           lower(first_name) like lower(?1 || '%') escape '\' 
        or lower(last_name) like lower(?2 || '%') escape '\' 
    order by 
        firstName, 
        lastName 
    limit ?3 
    offset ?4
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where 
           lower(first_name) like lower(@0 + '%') 
        or lower(last_name) like lower(@1 + '%') 
    order by 
        firstName, 
        lastName 
    offset @2 rows 
    fetch next @3 rows only
    ```

And its parameters are: `[ 'Smi', 'Smi', 10, 20 ]`

The executed query to get the count is:

=== "MariaDB"
    ```mariadb
    select count(*) 
    from customer 
    where 
           lower(first_name) like concat(lower(?), '%') 
        or lower(last_name) like concat(lower(?), '%')
    ```
=== "MySQL"
    ```mysql
    select count(*) 
    from customer 
    where 
           lower(first_name) like concat(lower(?), '%') 
        or lower(last_name) like concat(lower(?), '%')
    ```
=== "Oracle"
    ```oracle
    select count(*) 
    from customer 
    where 
           lower(first_name) like lower(:0 || '%') escape '\' 
        or lower(last_name) like lower(:1 || '%') escape '\'
    ```
===+ "PostgreSQL"
    ```postgresql
    select count(*) 
    from customer 
    where 
           first_name ilike ($1 || '%') 
        or last_name ilike ($2 || '%')
    ```
=== "SQLite"
    ```sqlite
    select count(*) 
    from customer 
    where 
           lower(first_name) like lower(?1 || '%') escape '\' 
        or lower(last_name) like lower(?2 || '%') escape '\'
    ```
=== "SQL Server"
    ```sqlserver
    select count(*) 
    from customer 
    where 
           lower(first_name) like lower(@0 + '%') 
        or lower(last_name) like lower(@1 + '%')
    ```

And its parameters are: `[ 'Smi', 'Smi' ]`

The result type is:
```tsx
const customerPageWithName: Promise<{
    data: {
        id: number;
        firstName: string;
        lastName: string;
    }[];
    count: number;
}>
```

The rows are in `data` and the total is in `count`. With `selectOneColumn`, `data` is an array of values instead of objects.

The count query is the same select without what only defines the page: it has no `limit`, no `offset` and no `order by`, since none of them changes how many rows match. The parameters of the page aren't sent either.

The queries are sent one after the other, first the rows and then the count. If the first one fails, the second one isn't sent. `query()` and `params()` return only the query of the rows.

## Which queries are sent

`executeSelectPage` receives an optional object. If it has `data` or `count`, the query that would get that value isn't sent, and your value is returned instead:

| Call | Query of the rows | Count query | Result |
|---|---|---|---|
| `executeSelectMany()` | Sent | Not sent | The rows |
| `executeSelectPage()` | Sent | Sent | `{ data, count }` |
| `executeSelectPage({ count })` | Sent | Not sent | `{ data, count }`, with your `count` |
| `executeSelectPage({ data })` | Not sent | Sent | `{ data, count }`, with your `data` |
| `executeSelectPage({ data, count })` | Not sent | Not sent | `{ data, count }`, with your values |

A `count` of `0` and an empty `data` are values too, so they also avoid the query. The library returns your values as they are, without checking them.

There is no option to change how the count is written. If you need a different one, like an estimate or a count kept somewhere else, get it yourself and pass it as `count`.

## Avoiding the count query

To count, the database has to go through all the matching rows, while the page can stop once it has enough of them. So the count can be the most expensive of the two queries.

### You don't need the total

Use `executeSelectMany()` with the same `limit` and `offset`. Only one query is sent:

```ts
const customers = await connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .orderBy('id')
    .limit(10)
    .offset(20)
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by id 
    limit ? 
    offset ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by id 
    limit ? 
    offset ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName" 
    from customer 
    order by "id" 
    offset :0 rows 
    fetch next :1 rows only
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName" 
    from customer 
    order by id 
    limit $1 
    offset $2
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by id 
    limit ?1 
    offset ?2
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by id 
    offset @0 rows 
    fetch next @1 rows only
    ```

The parameters are: `[ 10, 20 ]` (on Oracle and SQL Server: `[ 20, 10 ]`)

If all you need is to know whether there is a next page, ask for one more row than you are going to show, with `limit(pageSize + 1)`: if it comes back, there is a next page.

### You already know the total

A common case is a total got with the first page, which the client sends back when it asks for the next ones. Pass it as `count`, and only the query of the rows is sent:

```ts
const knownCount = 146

const customerPage = await connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .orderBy('id')
    .limit(10)
    .offset(20)
    .executeSelectPage({ count: knownCount });
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by id 
    limit ? 
    offset ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by id 
    limit ? 
    offset ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName" 
    from customer 
    order by "id" 
    offset :0 rows 
    fetch next :1 rows only
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName" 
    from customer 
    order by id 
    limit $1 
    offset $2
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by id 
    limit ?1 
    offset ?2
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by id 
    offset @0 rows 
    fetch next @1 rows only
    ```

The parameters are: `[ 10, 20 ]` (on Oracle and SQL Server: `[ 20, 10 ]`)

The total you pass can be out of date if the rows have changed since you got it.

### You only need the total

Pass the rows as `data`, and only the count query is sent. The library returns them as they are, so they can be an empty list, or the rows you already have. You can keep the same query you use to get the page: because only the count is requested, its `orderBy`, `limit` and `offset` aren't used.

<!-- doc-code-snippet-result: 146 -->
```ts
const customers: { id: number, firstName: string }[] = [] // Or the rows you already have

const customerPage = await connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .orderBy('id')
    .limit(10)
    .offset(20)
    .executeSelectPage({ data: customers });
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select count(*) 
    from customer
    ```
=== "MySQL"
    ```mysql
    select count(*) 
    from customer
    ```
=== "Oracle"
    ```oracle
    select count(*) 
    from customer
    ```
===+ "PostgreSQL"
    ```postgresql
    select count(*) 
    from customer
    ```
=== "SQLite"
    ```sqlite
    select count(*) 
    from customer
    ```
=== "SQL Server"
    ```sqlserver
    select count(*) 
    from customer
    ```

The parameters are: `[]`

## Extra properties

Any other property of the object you pass is returned in the result, next to `data` and `count`, with its type. It saves you from assembling the response of a list yourself:

```ts
const pageNumber = 3
const pageSize = 10

const customerPage = await connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .orderBy('id')
    .limit(pageSize)
    .offset((pageNumber - 1) * pageSize)
    .executeSelectPage({ pageNumber, pageSize });
```

The executed query to get the data is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by id 
    limit ? 
    offset ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by id 
    limit ? 
    offset ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName" 
    from customer 
    order by "id" 
    offset :0 rows 
    fetch next :1 rows only
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName" 
    from customer 
    order by id 
    limit $1 
    offset $2
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by id 
    limit ?1 
    offset ?2
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by id 
    offset @0 rows 
    fetch next @1 rows only
    ```

And its parameters are: `[ 10, 20 ]` (on Oracle and SQL Server: `[ 20, 10 ]`)

The executed query to get the count is:

=== "MariaDB"
    ```mariadb
    select count(*) 
    from customer
    ```
=== "MySQL"
    ```mysql
    select count(*) 
    from customer
    ```
=== "Oracle"
    ```oracle
    select count(*) 
    from customer
    ```
===+ "PostgreSQL"
    ```postgresql
    select count(*) 
    from customer
    ```
=== "SQLite"
    ```sqlite
    select count(*) 
    from customer
    ```
=== "SQL Server"
    ```sqlserver
    select count(*) 
    from customer
    ```

And its parameters are: `[]`

The result type is:
```tsx
const customerPage: {
    data: {
        id: number;
        firstName: string;
    }[];
    count: number;
    pageNumber: number;
    pageSize: number;
}
```

## What the total counts

The total is the number of rows that the select would return without `limit` and `offset`. In a simple select, it's enough to replace the columns with `count(*)`, as in the query above. When the rows of the result aren't the rows of the tables, the library counts over the whole select, without replacing anything:

- With a **`group by`**, the total is the number of groups, after the `having`.
- With an **aggregate and no `group by`**, like `selectCountAll()`, the select returns one row, so the total is `1`.
- With **`selectDistinctFrom`**, the total is the number of different rows.
- With a [**compound select**](compound-select.md), the total is the number of rows of the combined result, so `union` counts them after removing the duplicates. The `order by`, `limit` and `offset` written after the operator apply to the combined result.
- With a [**recursive select**](recursive-select.md), the total is the number of rows of the recursive result.
- With [**`customizeQuery`**](sql-fragments.md#customizing-a-select), the select is counted in the same way, so that what you added is also in the count query (see [below](#customizing-and-monitoring-the-queries)).

For example, a page of the number of customers per company:

```ts
const customersPerCompany = connection.selectFrom(tCustomer)
    .select({
        companyId: tCustomer.companyId,
        customers: connection.countAll()
    })
    .groupBy('companyId')
    .orderBy('companyId')
    .limit(10)
    .executeSelectPage();
```

The executed query to get the count is:

=== "MariaDB"
    ```mariadb
    with 
        result_for_count as (
            select 
                company_id as companyId, 
                count(*) as customers 
            from customer 
            group by company_id
        ) 
    select count(*) 
    from result_for_count
    ```
=== "MySQL"
    ```mysql
    with 
        result_for_count as (
            select 
                company_id as companyId, 
                count(*) as customers 
            from customer 
            group by company_id
        ) 
    select count(*) 
    from result_for_count
    ```
=== "Oracle"
    ```oracle
    with 
        result_for_count as (
            select 
                company_id as companyId, 
                count(*) as customers 
            from customer 
            group by company_id
        ) 
    select count(*) 
    from result_for_count
    ```
===+ "PostgreSQL"
    ```postgresql
    with 
        result_for_count as (
            select 
                company_id as companyId, 
                count(*) as customers 
            from customer 
            group by company_id
        ) 
    select count(*) 
    from result_for_count
    ```
=== "SQLite"
    ```sqlite
    with 
        result_for_count as (
            select 
                company_id as companyId, 
                count(*) as customers 
            from customer 
            group by company_id
        ) 
    select count(*) 
    from result_for_count
    ```
=== "SQL Server"
    ```sqlserver
    with 
        result_for_count as (
            select 
                company_id as companyId, 
                count(*) as customers 
            from customer 
            group by company_id
        ) 
    select count(*) 
    from result_for_count
    ```

And a page of a compound select:

```ts
const namesPage = connection.selectFrom(tCustomer)
    .select({
        name: tCustomer.firstName
    }).union(
        connection.selectFrom(tCompany)
        .select({
            name: tCompany.name
        })
    )
    .orderBy('name')
    .limit(10)
    .executeSelectPage();
```

The executed query to get the count is:

=== "MariaDB"
    ```mariadb
    with 
        result_for_count as (
            select first_name as name 
            from customer 
            
            union 
            
            select name as name 
            from company
        ) 
    select count(*) 
    from result_for_count
    ```
=== "MySQL"
    ```mysql
    with 
        result_for_count as (
            select first_name as `name` 
            from customer 
            
            union 
            
            select `name` as `name` 
            from company
        ) 
    select count(*) 
    from result_for_count
    ```
=== "Oracle"
    ```oracle
    with 
        result_for_count(name) as (
            select first_name as name 
            from customer 
            
            union 
            
            select name as name 
            from company
        ) 
    select count(*) 
    from result_for_count
    ```
===+ "PostgreSQL"
    ```postgresql
    with 
        result_for_count as (
            select first_name as name 
            from customer 
            
            union 
            
            select name as name 
            from company
        ) 
    select count(*) 
    from result_for_count
    ```
=== "SQLite"
    ```sqlite
    with 
        result_for_count as (
            select first_name as name 
            from customer 
            
            union 
            
            select name as name 
            from company
        ) 
    select count(*) 
    from result_for_count
    ```
=== "SQL Server"
    ```sqlserver
    with 
        result_for_count as (
            select first_name as name 
            from customer 
            
            union 
            
            select name as name 
            from company
        ) 
    select count(*) 
    from result_for_count
    ```

When the `compatibilityVersion` of a MySQL connection is below 8.0, which has no `with`, the select is counted as a subquery in the `from`: `select count(*) from (...) as result_for_count`.

## When the rows change between the two queries

The two queries are separate, and they aren't sent inside a transaction of their own. If another transaction commits changes between them, the total can disagree with the page. For a list this is usually acceptable. If it isn't, run `executeSelectPage` in a [transaction](transaction.md) with an [isolation level](transaction.md#transaction-isolation) that keeps showing the same data to both queries.

## Customizing and monitoring the queries

What you set with [`customizeQuery`](sql-fragments.md#customizing-a-select) belongs to the statement, so it's also applied to the count query. The exceptions are `beforeOrderByItems` and `afterOrderByItems`, which the count query doesn't include, because it has no `order by`.

`queryExecutionName` and `queryExecutionMetadata` reach both queries as well. To tell them apart in a query runner, for example to log them separately, use [`isSelectPageCountQuery`](../advanced/query-execution-metadata.md#detect-if-the-query-is-for-select-page-count).
