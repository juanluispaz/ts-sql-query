---
search:
  boost: 3
---
# CTE (with clause) & subqueries

A subquery is a select inside another select. It's the way to answer questions that need the result of one select to write another one, like "the customers of the companies whose name contains this text", "the companies that have at least one customer", or "each company with its number of customers".

A Common Table Expression (CTE) is a select with a name, written in the SQL `with` clause before the main select. The main select reads it as if it were a view, so it's the way to read from the result of another select, like "the number of customers per company, and from there, only the companies called ACME". A CTE only exists while that statement runs: nothing is stored in the database.

Don't confuse a subquery in a condition with a join: a join adds the columns of the related rows, and repeats a row once for each related row, while `in` and `exists` only decide whether a row stays in the result. For a query that reads its own results, see [Recursive select](recursive-select.md).

## Choosing the form

| What you need | The select ends with | How you use it |
|---|---|---|
| Filter by a list of values | `selectOneColumn` | Pass it to `in` or `notIn` |
| Filter by whether related rows exist | `selectOneColumn` or `select` | Pass it to `connection.exists` or `connection.notExists` |
| A single value | `selectOneColumn` or `selectCountAll` | Call `forUseAsInlineQueryValue()`, and use the result as any other value |
| An array as a value | `selectOneColumn` or `select` | Call `forUseAsInlineAggregatedArrayValue()`, and use the result as a column of the select |
| Several columns and rows to read from, or the same select more than once | `select` | Call `forUseInQueryAs(name)`, and use the result as a view |

Building a subquery, or calling one of these methods, sends nothing to the database: the subquery becomes part of the SQL of the outer query, and everything runs as a single statement. `executeSelectOne` and the rest of the `executeSelect*` methods are the opposite: they run that select on its own, as a separate query.

## Subquery in a condition

`in` keeps the rows whose value is in the list returned by the subquery, and `notIn` the rows whose value isn't. Both receive the select as it is, made with `selectOneColumn`, and the column must have the same data type as the value you compare it with.

```ts
const orderBy = 'customerFirstName asc nulls first, customerLastName';

const customerWithSelectedCompanies = connection.selectFrom(tCustomer)
    .where(tCustomer.companyId.in(
        connection.selectFrom(tCompany)
            .where(tCompany.name.contains('Cia.'))
            .selectOneColumn(tCompany.id)
    )).select({
        customerId: tCustomer.id,
        customerFirstName: tCustomer.firstName,
        customerLastName: tCustomer.lastName
    }).orderByFromString(orderBy)
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as customerId, 
        first_name as customerFirstName, 
        last_name as customerLastName 
    from customer 
    where company_id in (
        select id as result 
        from company 
        where name like concat('%', ?, '%')
    ) 
    order by 
        customerFirstName asc, 
        customerLastName
    ```
=== "MySQL"
    ```mysql
    select 
        id as customerId, 
        first_name as customerFirstName, 
        last_name as customerLastName 
    from customer 
    where company_id in (
        select id as result 
        from company 
        where `name` like concat('%', ?, '%')
    ) 
    order by 
        customerFirstName asc, 
        customerLastName
    ```
=== "Oracle"
    ```oracle
    select 
        id as "customerId", 
        first_name as "customerFirstName", 
        last_name as "customerLastName" 
    from customer 
    where company_id in (
        select id as "result" 
        from company 
        where name like ('%' || :0 || '%') escape '\'
    ) 
    order by 
        "customerFirstName" asc nulls first, 
        "customerLastName"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as "customerId", 
        first_name as "customerFirstName", 
        last_name as "customerLastName" 
    from customer 
    where company_id in (
        select id as result 
        from company 
        where name like ('%' || $1 || '%')
    ) 
    order by 
        "customerFirstName" asc nulls first, 
        "customerLastName"
    ```
=== "SQLite"
    ```sqlite
    select 
        id as customerId, 
        first_name as customerFirstName, 
        last_name as customerLastName 
    from customer 
    where company_id in (
        select id as result 
        from company 
        where name like ('%' || ?1 || '%') escape '\'
    ) 
    order by 
        customerFirstName asc nulls first, 
        customerLastName
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as customerId, 
        first_name as customerFirstName, 
        last_name as customerLastName 
    from customer 
    where company_id in (
        select id as [result] 
        from company 
        where name like ('%' + @0 + '%')
    ) 
    order by 
        customerFirstName asc, 
        customerLastName
    ```

The parameters are: `[ 'Cia.' ]`

The result type is:
```tsx
const customerWithSelectedCompanies: Promise<{
    customerId: number;
    customerFirstName: string;
    customerLastName: string;
}[]>
```

The `orderByFromString` of this example has nothing to do with the subquery: it's explained in [Order by from a string](dynamic-queries.md#order-by-from-a-string).

!!! warning

    With `notIn`, take the nulls out of the subquery. If it returns a null among its values, `notIn` keeps no row at all, because the database can't say that a value is different from an unknown one. Add a condition with `isNotNull` to the subquery, or use `notExists`, which doesn't have this problem.

## Subquery checking that rows exist

`connection.exists` is true when the subquery returns at least one row, and `connection.notExists` when it returns none. Only whether there are rows matters, not the columns they have. The subquery usually refers to the row of the outer query, which is what `subSelectUsing` is for, as explained in [Inline subquery referencing the outer query](#inline-subquery-referencing-the-outer-query).

The companies that have at least one customer:

```ts
const companiesWithCustomers = await connection.selectFrom(tCompany)
    .where(connection.exists(
        connection.subSelectUsing(tCompany)
            .from(tCustomer)
            .where(tCustomer.companyId.equals(tCompany.id))
            .selectOneColumn(tCustomer.id)
    ))
    .select({
        id: tCompany.id,
        name: tCompany.name
    })
    .orderBy('id')
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        name as name 
    from company 
    where exists(select id as result from customer where company_id = company.id) 
    order by id
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        `name` as `name` 
    from company 
    where exists(select id as result from customer where company_id = company.id) 
    order by id
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name" 
    from company 
    where exists(select id as "result" from customer where company_id = company.id) 
    order by "id"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name 
    from company 
    where exists(select id as result from customer where company_id = company.id) 
    order by id
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name 
    from company 
    where exists(select id as result from customer where company_id = company.id) 
    order by id
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name 
    from company 
    where exists(select id as [result] from customer where company_id = company.id) 
    order by id
    ```

The parameters are: `[]`

The result type is:
```tsx
const companiesWithCustomers: {
    id: number;
    name: string;
}[]
```

## Inline subquery as value

A select that returns one column and one row can be used as a value. Call `forUseAsInlineQueryValue` instead of executing it, and use the result as any other value of that data type: in the columns of a select, in a condition, or in an `orderBy`.

```ts
const acmeId = connection.selectFrom(tCompany)
    .where(tCompany.name.equals('ACME'))
    .selectOneColumn(tCompany.id)
    .forUseAsInlineQueryValue();

const acmeCustomers = connection.selectFrom(tCustomer)
    .where(tCustomer.companyId.equals(acmeId))
    .select({
        id: tCustomer.id,
        name: tCustomer.firstName.concat(' ').concat(tCustomer.lastName)
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        concat(first_name, ?, last_name) as name 
    from customer 
    where company_id = (
        select id as result 
        from company 
        where name = ?
    )
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        concat(first_name, ?, last_name) as `name` 
    from customer 
    where company_id = (
        select id as result 
        from company 
        where `name` = ?
    )
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name || :0 || last_name as "name" 
    from customer 
    where company_id = (
        select id as "result" 
        from company 
        where name = :1
    )
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name || $1 || last_name as name 
    from customer 
    where company_id = (
        select id as result 
        from company 
        where name = $2
    )
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name || ?1 || last_name as name 
    from customer 
    where company_id = (
        select id as result 
        from company 
        where name = ?2
    )
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name + @0 + last_name as name 
    from customer 
    where company_id = (
        select id as [result] 
        from company 
        where name = @1
    )
    ```

The parameters are: `[ ' ', 'ACME' ]`

The result type is:
```tsx
const acmeCustomers: Promise<{
    name: string;
    id: number;
}[]>
```

The number of rows the subquery returns decides the value:

- **One row:** the value is the column of that row.
- **No rows:** the value is null. That's why the value of an inline subquery is optional in the result, even if the column is required in its table. Use `valueWhenNull` to give another value and make it required.
- **More than one row:** write the subquery so this can't happen, with a condition that matches one row at most, or with an `orderBy` and `limit(1)`. The databases don't all react in the same way: PostgreSQL rejects the query, while SQLite takes the first row.

## Inline subquery referencing the outer query

The subqueries above have a single result for the whole query. A subquery can also use the columns of the row of the outer query, like "the number of customers of **this** company"; it's known as a correlated subquery. It can't run on its own, because its result depends on the outer row: it's as if it ran once for each row of the outer query, although the database can optimize it.

To write it, start the subquery with `subSelectUsing`, passing the tables or views of the outer query that it uses (up to five, including a table prepared with `forUseInLeftJoin` and a CTE). These tables don't go to the `from` of the subquery; you write its own with `from`. A subquery started with `selectFrom` can't refer to the outer query, and a correlated subquery can only be used in a query that has those tables: otherwise, the code doesn't compile. It can't be executed on its own either, so it doesn't offer the `executeSelect*` methods.

```ts
const numberOfCustomers = connection
    .subSelectUsing(tCompany)
    .from(tCustomer)
    .where(tCustomer.companyId.equals(tCompany.id))
    .selectCountAll()
    .forUseAsInlineQueryValue();  // At this point is a value that you can use in other query

const companiesWithNumberOfCustomers = connection.selectFrom(tCompany)
    .select({
        id: tCompany.id,
        name: tCompany.name,
        numberOfCustomers: numberOfCustomers
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        name as name, 
        (
            select count(*) as result 
            from customer 
            where company_id = company.id
        ) as numberOfCustomers 
    from company
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        `name` as `name`, 
        (
            select count(*) as result 
            from customer 
            where company_id = company.id
        ) as numberOfCustomers 
    from company
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name", 
        (
            select count(*) as "result" 
            from customer 
            where company_id = company.id
        ) as "numberOfCustomers" 
    from company
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name, 
        (
            select count(*) as result 
            from customer 
            where company_id = company.id
        ) as "numberOfCustomers" 
    from company
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name, 
        (
            select count(*) as result 
            from customer 
            where company_id = company.id
        ) as numberOfCustomers 
    from company
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name, 
        (
            select count(*) as [result] 
            from customer 
            where company_id = company.id
        ) as numberOfCustomers 
    from company
    ```

The parameters are: `[ ]`

The result type is:
```tsx
const companiesWithNumberOfCustomers: Promise<{
    id: number;
    name: string;
    numberOfCustomers: number;
}[]>
```

!!! tip

    In the previous example, `.selectCountAll()` is more convenient than `.selectOneColumn(connection.countAll())`, because a count always returns one row, so its value isn't optional. With `.selectOneColumn(connection.countAll())` you need `.valueWhenNull(0)` to get the same result type.

When the subquery reads the same table as the outer query, give it another name with `as`, so that each column says which of the two it belongs to. For each customer, the number of other customers with the same last name:

```ts
const otherCustomer = tCustomer.as('otherCustomer');

const customersWithNamesakes = await connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id,
        numberOfNamesakes: connection
            .subSelectUsing(tCustomer)
            .from(otherCustomer)
            .where(otherCustomer.lastName.equals(tCustomer.lastName))
            .and(otherCustomer.id.notEquals(tCustomer.id))
            .selectCountAll()
            .forUseAsInlineQueryValue()
    })
    .orderBy('id')
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        (select count(*) as result from customer as otherCustomer where otherCustomer.last_name = customer.last_name and otherCustomer.id <> customer.id) as numberOfNamesakes 
    from customer 
    order by id
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        (select count(*) as result from customer as otherCustomer where otherCustomer.last_name = customer.last_name and otherCustomer.id <> customer.id) as numberOfNamesakes 
    from customer 
    order by id
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        (select count(*) as "result" from customer otherCustomer where otherCustomer.last_name = customer.last_name and otherCustomer.id <> customer.id) as "numberOfNamesakes" 
    from customer 
    order by "id"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        (select count(*) as result from customer as otherCustomer where otherCustomer.last_name = customer.last_name and otherCustomer.id <> customer.id) as "numberOfNamesakes" 
    from customer 
    order by id
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        (select count(*) as result from customer as otherCustomer where otherCustomer.last_name = customer.last_name and otherCustomer.id <> customer.id) as numberOfNamesakes 
    from customer 
    order by id
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        (select count(*) as [result] from customer as otherCustomer where otherCustomer.last_name = customer.last_name and otherCustomer.id <> customer.id) as numberOfNamesakes 
    from customer 
    order by id
    ```

The parameters are: `[]`

## Inline subquery with distinct values referencing the outer query

`subSelectDistinctUsing` works like `subSelectUsing`, but the subquery returns distinct rows (`select distinct`), as `selectDistinctFrom` does for a subquery that doesn't refer to the outer query.

For example, the distinct last names of the customers of each company. `forUseAsInlineAggregatedArrayValue` turns all the rows of the subquery into an array, with one element per row, or an empty array if there are no rows. See [Aggregate as an array of objects](aggregate-as-object-array.md) for more about it:

```ts
const lastNamesOfTheCustomers = connection
    .subSelectDistinctUsing(tCompany)
    .from(tCustomer)
    .where(tCustomer.companyId.equals(tCompany.id))
    .selectOneColumn(tCustomer.lastName)
    .forUseAsInlineAggregatedArrayValue();

const companiesWithTheLastNamesOfTheirCustomers = await connection.selectFrom(tCompany)
    .select({
        id: tCompany.id,
        name: tCompany.name,
        lastNames: lastNamesOfTheCustomers
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    -- MariaDB doesn't support a distinct subquery that references an outer table as an aggregated array
    ```
=== "MySQL"
    ```mysql
    select 
        id as id,
        `name` as `name`,
        cast((select json_arrayagg(a_1_.result) from (select distinct last_name as result from customer where company_id = company.id) as a_1_) as char) as lastNames
    from company
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id",
        name as "name",
        (select json_arrayagg(a_1_.result) from (select distinct last_name as result from customer where company_id = company.id) a_1_) as "lastNames"
    from company
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id,
        name as name,
        ((select json_agg(a_1_.result) from (select distinct last_name as result from customer where company_id = company.id) as a_1_))::text as "lastNames"
    from company
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id,
        name as name,
        (select json_group_array(a_1_.result) from (select distinct last_name as result from customer where company_id = company.id) as a_1_) as lastNames
    from company
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id,
        name as name,
        (select json_arrayagg(a_1_.[result] null on null) from (select distinct last_name as [result] from customer where company_id = company.id) as a_1_) as lastNames
    from company
    ```

The parameters are: `[]`

The result type is:
```tsx
const companiesWithTheLastNamesOfTheirCustomers: Promise<{
    id: number;
    name: string;
    lastNames: string[];
}[]>
```

## A select used as a view (the with clause)

You can define a select query and use it as if it were a view in another select query. Call `forUseInQueryAs` instead of executing the query: it returns a view that you use in `selectFrom` and in the joins, and that ends up in the `with` clause of the SQL, with the name you passed. Each CTE of a query needs its own name.

Use a CTE instead of a subquery when:

- You need several columns or rows of the select, and not only a value or a list. `from` and the joins receive tables and views, not a select, so a CTE is the way to read from the result of a select.
- You want to use the same select more than once, without repeating it in the SQL.
- The query is easier to read in steps, each one with a name.

```ts
const customerCountPerCompanyWith = connection.selectFrom(tCompany)
    .innerJoin(tCustomer).on(tCustomer.companyId.equals(tCompany.id))
    .select({
        companyId: tCompany.id,
        companyName: tCompany.name,
        customerCount: connection.count(tCustomer.id)
    }).groupBy('companyId', 'companyName')
    .forUseInQueryAs('customerCountPerCompany');

const customerCountPerAcmeCompanies = connection.selectFrom(customerCountPerCompanyWith)
    .where(customerCountPerCompanyWith.companyName.containsInsensitive('ACME'))
    .select({
        acmeCompanyId: customerCountPerCompanyWith.companyId,
        acmeCompanyName: customerCountPerCompanyWith.companyName,
        acmeCustomerCount: customerCountPerCompanyWith.customerCount
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    with 
        customerCountPerCompany as (
            select 
                company.id as companyId, 
                company.name as companyName, 
                count(customer.id) as customerCount 
            from company 
            inner join customer on customer.company_id = company.id 
            group by 
                company.id, 
                company.name
        ) 
    select 
        companyId as acmeCompanyId, 
        companyName as acmeCompanyName, 
        customerCount as acmeCustomerCount 
    from customerCountPerCompany 
    where lower(companyName) like concat('%', lower(?), '%')
    ```
=== "MySQL"
    ```mysql
    with 
        customerCountPerCompany as (
            select 
                company.id as companyId, 
                company.`name` as companyName, 
                count(customer.id) as customerCount 
            from company 
            inner join customer on customer.company_id = company.id 
            group by 
                company.id, 
                company.`name`
        ) 
    select 
        companyId as acmeCompanyId, 
        companyName as acmeCompanyName, 
        customerCount as acmeCustomerCount 
    from customerCountPerCompany 
    where lower(companyName) like concat('%', lower(?), '%')
    ```
=== "Oracle"
    ```oracle
    with 
        customerCountPerCompany as (
            select 
                company.id as companyId, 
                company.name as companyName, 
                count(customer.id) as customerCount 
            from company 
            inner join customer on customer.company_id = company.id 
            group by 
                company.id, 
                company.name
        ) 
    select 
        companyId as "acmeCompanyId", 
        companyName as "acmeCompanyName", 
        customerCount as "acmeCustomerCount" 
    from customerCountPerCompany 
    where lower(companyName) like lower('%' || :0 || '%') escape '\'
    ```
===+ "PostgreSQL"
    ```postgresql
    with 
        customerCountPerCompany as (
            select 
                company.id as companyId, 
                company.name as companyName, 
                count(customer.id) as customerCount 
            from company 
            inner join customer on customer.company_id = company.id 
            group by 
                company.id, 
                company.name
        ) 
    select 
        companyId as "acmeCompanyId", 
        companyName as "acmeCompanyName", 
        customerCount as "acmeCustomerCount" 
    from customerCountPerCompany 
    where companyName ilike ('%' || $1 || '%')
    ```
=== "SQLite"
    ```sqlite
    with 
        customerCountPerCompany as (
            select 
                company.id as companyId, 
                company.name as companyName, 
                count(customer.id) as customerCount 
            from company 
            inner join customer on customer.company_id = company.id 
            group by 
                company.id, 
                company.name
        ) 
    select 
        companyId as acmeCompanyId, 
        companyName as acmeCompanyName, 
        customerCount as acmeCustomerCount 
    from customerCountPerCompany 
    where lower(companyName) like lower('%' || ?1 || '%') escape '\'
    ```
=== "SQL Server"
    ```sqlserver
    with 
        customerCountPerCompany as (
            select 
                company.id as companyId, 
                company.name as companyName, 
                count(customer.id) as customerCount 
            from company 
            inner join customer on customer.company_id = company.id 
            group by 
                company.id, 
                company.name
        ) 
    select 
        companyId as acmeCompanyId, 
        companyName as acmeCompanyName, 
        customerCount as acmeCustomerCount 
    from customerCountPerCompany 
    where lower(companyName) like lower('%' + @0 + '%')
    ```

The parameters are: `[ 'ACME' ]`

The result type is:
```tsx
const customerCountPerAcmeCompanies: Promise<{
    acmeCompanyId: number;
    acmeCompanyName: string;
    acmeCustomerCount: number;
}[]>
```

### The columns of the view

The view has one column for each property of the `select`, with its name and data type, like `customerCountPerCompanyWith.companyName` in the previous example. `forUseInQueryAs` needs an object with the columns, so it's used after `select`, and not after `selectOneColumn`.

A nested object keeps its shape in the view, and you can read a single column or the whole object. In the SQL, the name of its column is the path to it, like `company.name`:

```ts
const customerWithCompany = connection.selectFrom(tCustomer)
    .innerJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
    .select({
        id: tCustomer.id,
        company: {
            id: tCompany.id,
            name: tCompany.name
        }
    })
    .forUseInQueryAs('customerWithCompany');

const customersOfAcme = await connection.selectFrom(customerWithCompany)
    .where(customerWithCompany.company.name.contains('ACME'))
    .select({
        id: customerWithCompany.id,
        company: customerWithCompany.company
    })
    .orderBy('id')
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    with 
        customerWithCompany as ( 
            select 
                customer.id as id, 
                company.id as `company.id`, 
                company.name as `company.name` 
            from customer 
            inner join company on company.id = customer.company_id 
        ) 
    select 
        id as id, 
        `company.id` as `company.id`, 
        `company.name` as `company.name` 
    from customerWithCompany 
    where `company.name` like concat('%', ?, '%') 
    order by id
    ```
=== "MySQL"
    ```mysql
    with 
        customerWithCompany as ( 
            select 
                customer.id as id, 
                company.id as `company.id`, 
                company.`name` as `company.name` 
            from customer 
            inner join company on company.id = customer.company_id 
        ) 
    select 
        id as id, 
        `company.id` as `company.id`, 
        `company.name` as `company.name` 
    from customerWithCompany 
    where `company.name` like concat('%', ?, '%') 
    order by id
    ```
=== "Oracle"
    ```oracle
    with 
        customerWithCompany as ( 
            select 
                customer.id as id, 
                company.id as "company.id", 
                company.name as "company.name" 
            from customer 
            inner join company on company.id = customer.company_id 
        ) 
    select 
        id as "id", 
        "company.id" as "company.id", 
        "company.name" as "company.name" 
    from customerWithCompany 
    where "company.name" like ('%' || :0 || '%') escape '\' 
    order by "id"
    ```
===+ "PostgreSQL"
    ```postgresql
    with 
        customerWithCompany as ( 
            select 
                customer.id as id, 
                company.id as "company.id", 
                company.name as "company.name" 
            from customer 
            inner join company on company.id = customer.company_id 
        ) 
    select 
        id as id, 
        "company.id" as "company.id", 
        "company.name" as "company.name" 
    from customerWithCompany 
    where "company.name" like ('%' || $1 || '%') 
    order by id
    ```
=== "SQLite"
    ```sqlite
    with 
        customerWithCompany as ( 
            select 
                customer.id as id, 
                company.id as "company.id", 
                company.name as "company.name" 
            from customer 
            inner join company on company.id = customer.company_id 
        ) 
    select 
        id as id, 
        "company.id" as "company.id", 
        "company.name" as "company.name" 
    from customerWithCompany 
    where "company.name" like ('%' || ?1 || '%') escape '\' 
    order by id
    ```
=== "SQL Server"
    ```sqlserver
    with 
        customerWithCompany as ( 
            select 
                customer.id as id, 
                company.id as [company.id], 
                company.name as [company.name] 
            from customer 
            inner join company on company.id = customer.company_id 
        ) 
    select 
        id as id, 
        [company.id] as [company.id], 
        [company.name] as [company.name] 
    from customerWithCompany 
    where [company.name] like ('%' + @0 + '%') 
    order by id
    ```

The parameters are: `[ 'ACME' ]`

The result type is:
```tsx
const customersOfAcme: {
    id: number;
    company: {
        id: number;
        name: string;
    };
}[]
```

A column is required in the view only if it's required in the `select`. Any other one is optional, for example a column that comes from a left join inside the CTE.

### Left join with a view

A view can be used in a left join in the same way as a table: call `forUseInLeftJoin` to get the view for the left join, or `forUseInLeftJoinAs` to also give it another name. All its columns are optional in that join, as explained in [Select with left join](select.md#select-with-left-join).

This is another way to get the number of customers of each company, which also keeps the companies without customers. A correlated subquery counts the customers once for each company, and this form counts them once for all of them; which one is faster depends on the database and the data.

```ts
const customerCountPerCompany = connection.selectFrom(tCustomer)
    .select({
        companyId: tCustomer.companyId,
        customerCount: connection.count(tCustomer.id)
    }).groupBy('companyId')
    .forUseInQueryAs('customerCountPerCompany')
    .forUseInLeftJoin();

const companiesWithCustomerCount = await connection.selectFrom(tCompany)
    .leftJoin(customerCountPerCompany).on(customerCountPerCompany.companyId.equals(tCompany.id))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        customerCount: customerCountPerCompany.customerCount.valueWhenNull(0)
    })
    .orderBy('id')
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    with 
        customerCountPerCompany as ( 
            select 
                company_id as companyId, 
                count(id) as customerCount 
            from customer 
            group by company_id 
        ) 
    select 
        company.id as id, 
        company.name as name, 
        ifnull(customerCountPerCompany.customerCount, ?) as customerCount 
    from company 
    left join customerCountPerCompany on customerCountPerCompany.companyId = company.id 
    order by id
    ```
=== "MySQL"
    ```mysql
    with 
        customerCountPerCompany as ( 
            select 
                company_id as companyId, 
                count(id) as customerCount 
            from customer 
            group by company_id 
        ) 
    select 
        company.id as id, 
        company.`name` as `name`, 
        ifnull(customerCountPerCompany.customerCount, ?) as customerCount 
    from company 
    left join customerCountPerCompany on customerCountPerCompany.companyId = company.id 
    order by id
    ```
=== "Oracle"
    ```oracle
    with 
        customerCountPerCompany as ( 
            select 
                company_id as companyId, 
                count(id) as customerCount 
            from customer 
            group by company_id 
        ) 
    select 
        company.id as "id", 
        company.name as "name", 
        nvl(customerCountPerCompany.customerCount, :0) as "customerCount" 
    from company 
    left join customerCountPerCompany on customerCountPerCompany.companyId = company.id 
    order by "id"
    ```
===+ "PostgreSQL"
    ```postgresql
    with 
        customerCountPerCompany as ( 
            select 
                company_id as companyId, 
                count(id) as customerCount 
            from customer 
            group by company_id 
        ) 
    select 
        company.id as id, 
        company.name as name, 
        coalesce(customerCountPerCompany.customerCount, $1) as "customerCount" 
    from company 
    left join customerCountPerCompany on customerCountPerCompany.companyId = company.id 
    order by id
    ```
=== "SQLite"
    ```sqlite
    with 
        customerCountPerCompany as ( 
            select 
                company_id as companyId, 
                count(id) as customerCount 
            from customer 
            group by company_id 
        ) 
    select 
        company.id as id, 
        company.name as name, 
        ifnull(customerCountPerCompany.customerCount, ?1) as customerCount 
    from company 
    left join customerCountPerCompany on customerCountPerCompany.companyId = company.id 
    order by id
    ```
=== "SQL Server"
    ```sqlserver
    with 
        customerCountPerCompany as ( 
            select 
                company_id as companyId, 
                count(id) as customerCount 
            from customer 
            group by company_id 
        ) 
    select 
        company.id as id, 
        company.name as name, 
        coalesce(customerCountPerCompany.customerCount, @0) as customerCount 
    from company 
    left join customerCountPerCompany on customerCountPerCompany.companyId = company.id 
    order by id
    ```

The parameters are: `[ 0 ]`

The result type is:
```tsx
const companiesWithCustomerCount: {
    id: number;
    name: string;
    customerCount: number;
}[]
```

### Using a view more than once

To use a view twice in the same query, give another name to one of them with `as`. The `with` clause has the select only once. The pairs of customers of the same company:

```ts
const customerOfCompany = connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id,
        companyId: tCustomer.companyId
    })
    .forUseInQueryAs('customerOfCompany');

const otherCustomerOfCompany = customerOfCompany.as('otherCustomerOfCompany');

const pairsOfCustomers = await connection.selectFrom(customerOfCompany)
    .innerJoin(otherCustomerOfCompany).on(otherCustomerOfCompany.companyId.equals(customerOfCompany.companyId))
        .and(otherCustomerOfCompany.id.greaterThan(customerOfCompany.id))
    .select({
        customerId: customerOfCompany.id,
        otherCustomerId: otherCustomerOfCompany.id
    })
    .orderBy('customerId')
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    with 
        customerOfCompany as ( 
            select 
                id as id, 
                company_id as companyId 
            from customer 
        ) 
    select 
        customerOfCompany.id as customerId, 
        otherCustomerOfCompany.id as otherCustomerId 
    from customerOfCompany 
    inner join customerOfCompany as otherCustomerOfCompany on otherCustomerOfCompany.companyId = customerOfCompany.companyId and otherCustomerOfCompany.id > customerOfCompany.id 
    order by customerId
    ```
=== "MySQL"
    ```mysql
    with 
        customerOfCompany as ( 
            select 
                id as id, 
                company_id as companyId 
            from customer 
        ) 
    select 
        customerOfCompany.id as customerId, 
        otherCustomerOfCompany.id as otherCustomerId 
    from customerOfCompany 
    inner join customerOfCompany as otherCustomerOfCompany on otherCustomerOfCompany.companyId = customerOfCompany.companyId and otherCustomerOfCompany.id > customerOfCompany.id 
    order by customerId
    ```
=== "Oracle"
    ```oracle
    with 
        customerOfCompany as ( 
            select 
                id as id, 
                company_id as companyId 
            from customer 
        ) 
    select 
        customerOfCompany.id as "customerId", 
        otherCustomerOfCompany.id as "otherCustomerId" 
    from customerOfCompany 
    inner join customerOfCompany otherCustomerOfCompany on otherCustomerOfCompany.companyId = customerOfCompany.companyId and otherCustomerOfCompany.id > customerOfCompany.id 
    order by "customerId"
    ```
===+ "PostgreSQL"
    ```postgresql
    with 
        customerOfCompany as ( 
            select 
                id as id, 
                company_id as companyId 
            from customer 
        ) 
    select 
        customerOfCompany.id as "customerId", 
        otherCustomerOfCompany.id as "otherCustomerId" 
    from customerOfCompany 
    inner join customerOfCompany as otherCustomerOfCompany on otherCustomerOfCompany.companyId = customerOfCompany.companyId and otherCustomerOfCompany.id > customerOfCompany.id 
    order by "customerId"
    ```
=== "SQLite"
    ```sqlite
    with 
        customerOfCompany as ( 
            select 
                id as id, 
                company_id as companyId 
            from customer 
        ) 
    select 
        customerOfCompany.id as customerId, 
        otherCustomerOfCompany.id as otherCustomerId 
    from customerOfCompany 
    inner join customerOfCompany as otherCustomerOfCompany on otherCustomerOfCompany.companyId = customerOfCompany.companyId and otherCustomerOfCompany.id > customerOfCompany.id 
    order by customerId
    ```
=== "SQL Server"
    ```sqlserver
    with 
        customerOfCompany as ( 
            select 
                id as id, 
                company_id as companyId 
            from customer 
        ) 
    select 
        customerOfCompany.id as customerId, 
        otherCustomerOfCompany.id as otherCustomerId 
    from customerOfCompany 
    inner join customerOfCompany as otherCustomerOfCompany on otherCustomerOfCompany.companyId = customerOfCompany.companyId and otherCustomerOfCompany.id > customerOfCompany.id 
    order by customerId
    ```

The parameters are: `[]`

### A view that reads from another view

A CTE can read from another one, which lets you write a query in steps. The `with` clause lists them in the order they need, each one only once:

```ts
const customerCountPerCompanyView = connection.selectFrom(tCustomer)
    .select({
        companyId: tCustomer.companyId,
        customerCount: connection.count(tCustomer.id)
    }).groupBy('companyId')
    .forUseInQueryAs('customerCountPerCompany');

const bigCompany = connection.selectFrom(customerCountPerCompanyView)
    .where(customerCountPerCompanyView.customerCount.greaterOrEqual(2))
    .select({
        companyId: customerCountPerCompanyView.companyId
    })
    .forUseInQueryAs('bigCompany');

const bigCompanies = await connection.selectFrom(bigCompany)
    .select({
        companyId: bigCompany.companyId
    })
    .orderBy('companyId')
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    with 
        customerCountPerCompany as ( 
            select 
                company_id as companyId, 
                count(id) as customerCount 
            from customer 
            group by company_id 
        ), 
        bigCompany as ( 
            select companyId as companyId 
            from customerCountPerCompany 
            where customerCount >= ? 
        ) 
    select companyId as companyId 
    from bigCompany 
    order by companyId
    ```
=== "MySQL"
    ```mysql
    with 
        customerCountPerCompany as ( 
            select 
                company_id as companyId, 
                count(id) as customerCount 
            from customer 
            group by company_id 
        ), 
        bigCompany as ( 
            select companyId as companyId 
            from customerCountPerCompany 
            where customerCount >= ? 
        ) 
    select companyId as companyId 
    from bigCompany 
    order by companyId
    ```
=== "Oracle"
    ```oracle
    with 
        customerCountPerCompany as ( 
            select 
                company_id as companyId, 
                count(id) as customerCount 
            from customer 
            group by company_id 
        ), 
        bigCompany as ( 
            select companyId as companyId 
            from customerCountPerCompany 
            where customerCount >= :0 
        ) 
    select companyId as "companyId" 
    from bigCompany 
    order by "companyId"
    ```
===+ "PostgreSQL"
    ```postgresql
    with 
        customerCountPerCompany as ( 
            select 
                company_id as companyId, 
                count(id) as customerCount 
            from customer 
            group by company_id 
        ), 
        bigCompany as ( 
            select companyId as companyId 
            from customerCountPerCompany 
            where customerCount >= $1 
        ) 
    select companyId as "companyId" 
    from bigCompany 
    order by "companyId"
    ```
=== "SQLite"
    ```sqlite
    with 
        customerCountPerCompany as ( 
            select 
                company_id as companyId, 
                count(id) as customerCount 
            from customer 
            group by company_id 
        ), 
        bigCompany as ( 
            select companyId as companyId 
            from customerCountPerCompany 
            where customerCount >= ?1 
        ) 
    select companyId as companyId 
    from bigCompany 
    order by companyId
    ```
=== "SQL Server"
    ```sqlserver
    with 
        customerCountPerCompany as ( 
            select 
                company_id as companyId, 
                count(id) as customerCount 
            from customer 
            group by company_id 
        ), 
        bigCompany as ( 
            select companyId as companyId 
            from customerCountPerCompany 
            where customerCount >= @0 
        ) 
    select companyId as companyId 
    from bigCompany 
    order by companyId
    ```

The parameters are: `[ 2 ]`

### Where else a view can be used

- **In a subquery:** a view can be the table of a subquery of the outer query. The `with` clause still goes at the beginning of the whole query, and the outer query can read the same view.
- **In an optional join:** if an [optional join](../dynamic/optional-joins.md) isn't needed and is dropped from the query, its view is dropped from the `with` clause too.
- **In the other statements:** a view can be read by an [insert from select](insert.md#insert-from-select), an [update](update.md#update-using-other-tables-or-views) and a [delete](delete.md#delete-using-other-tables-or-views) using other tables or views.

### A view that refers to the outer query

A select started with `subSelectUsing` can also be a CTE, to be read from a subquery of that outer query. The `with` clause then goes inside the subquery, because it needs the row of the outer query. It's offered only in the databases that accept it, see [Availability in each database](#availability-in-each-database).

### Adding raw SQL to the with clause

`customizeQuery` has `beforeWithQuery` and `afterWithQuery`, for what the database accepts around the select of a CTE, as explained in [Customizing a select](sql-fragments.md#customizing-a-select).

## Recursive select

A [recursive select](recursive-select.md) is a CTE that reads its own results, built with `recursiveUnion` and its variants. Executed directly, the library writes the CTE for you. Calling `forUseInQueryAs` on it makes it a view like the ones of this page.

## Availability in each database

| Database | `with` clause | A correlated select as a CTE | A correlated inline array with `distinct`, `groupBy` or a compound operator |
|---|---|---|---|
| PostgreSQL | Yes | Yes | Yes |
| SQLite | Yes | Yes | Yes |
| SQL Server | Yes | Not offered | Yes |
| Oracle | Yes | Not offered | Yes |
| MariaDB | Yes; in front of an update or a delete, from MariaDB 12.3 | Not offered | Not offered |
| MySQL | From MySQL 8.0; with an older `compatibilityVersion`, the library writes the select in the `from` instead | Yes | Yes |

"Not offered" means that the method doesn't exist for that case in the types of that database, so the code doesn't compile. Inline arrays have their own requirements, explained in [Aggregate as an array of objects](aggregate-as-object-array.md).
