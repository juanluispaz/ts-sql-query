---
search:
  boost: 2
---
# Aggregate as an array of objects

An array aggregate returns the related rows of a one-to-many relation as an array inside each row of the result: each company with the array of its customers. It's the way to answer questions like "the companies, each one with its customers" with a single query, without running another query per company and without grouping the rows in your code.

Don't confuse it with a plain join: a join repeats the company once per customer, while an array aggregate returns the company once, with its customers inside:

| Plain join: company | Plain join: customer |
|---|---|
| Acme | Ann |
| Acme | Bob |
| Globex | (no customer) |

| Array aggregate: company | Array aggregate: customers |
|---|---|
| Acme | `[Ann, Bob]` |
| Globex | `[]` |

## When to use it

| Option | Choose it when | Take into account |
|---|---|---|
| Plain join | You need the combinations of rows, one per result row, or you filter and order by the related columns | The company is repeated; you need to group the rows yourself if you want them nested |
| Array aggregate | You need each row with its related rows, and there are few of them per row | The whole array is a single value: the database has to build it and the driver to return it, and each database limits how large a value can be |
| A separate query | The related rows are many, need paging, or you load them only for some rows | One more round trip to the database, and you need to match the rows in your code |

## The functions and their forms

The database builds the array: a JSON aggregate function turns the rows of each group into a single JSON value, which comes back as one column of the row. The library parses that JSON and gives you a JavaScript array, with [each value converted to its type](#how-the-values-go-through-json).

There are two ways to write it:

| Form | How it works | Returns |
|---|---|---|
| `connection.aggregateAsArray({...})` | Aggregate function, used with a join and a group by | Array of objects |
| `connection.aggregateAsArrayOfOneColumn(value)` | The same | Array of values |
| `connection.aggregateAsArrayDistinct({...})` | The same, without duplicated objects | Array of objects |
| `connection.aggregateAsArrayOfOneColumnDistinct(value)` | The same, without duplicated values | Array of values |
| `query.forUseAsInlineAggregatedArrayValue()` | Turns a whole query into a value of another query | Array of objects, or of values if the query uses `selectOneColumn` |

The aggregate functions are the shortest way when the query already joins the related table and has a single array. Choose the inline query when any of these applies:

- The array needs its own [order or limit](#ordering-and-limiting-the-array): the aggregate functions don't offer them.
- You want more than one array in a row. With an aggregate function, two joins to two related tables multiply each other: each customer is combined with each order, and both arrays have repeated elements. Each inline query computes its array apart.
- You want [arrays inside an array](#arrays-inside-an-array). An aggregate function can't go inside another one: it doesn't compile.
- The outer query shouldn't have a group by.

## Aggregate as an array of objects

Each property of the object passed to `aggregateAsArray` is a property of the elements of the array, and it can also be a nested object, as in the [complex projections](complex-projections.md). The object can come from [`dynamicPick`](../dynamic/caller-decides/picks.md) too.

The left join keeps the companies with no customers. With an inner join they would have no row in the result. The other columns of the select go in the group by, and `groupByNonAggregatedColumns()` [writes it for you](aggregate-and-group-by.md#grouping-by-every-non-aggregated-column). In this example `asOptionalNonEmptyArray()` leaves out the property when [there are no customers](#when-there-are-no-values).

```ts
const tCustomerLeftJoin = tCustomer.forUseInLeftJoin();

const acmeCompanyWithCustomers = connection.selectFrom(tCompany)
    .leftJoin(tCustomerLeftJoin).on(tCustomerLeftJoin.companyId.equals(tCompany.id))
    .where(tCompany.id.equals(1))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        customers: connection.aggregateAsArray({
            id: tCustomerLeftJoin.id,
            firstName: tCustomerLeftJoin.firstName,
            lastName: tCustomerLeftJoin.lastName
        }).asOptionalNonEmptyArray()
    })
    .groupBy('id', 'name')
    .executeSelectOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company.id as id, 
        company.name as name, 
        cast(json_arrayagg(json_object(
            'id', customer.id, 
            'firstName', customer.first_name, 
            'lastName', customer.last_name
        )) as char) as customers 
    from company 
    left join customer on customer.company_id = company.id 
    where company.id = ? 
    group by company.id, company.name
    ```
=== "MySQL"
    ```mysql
    select 
        company.id as id, 
        company.`name` as `name`, 
        cast(json_arrayagg(json_object(
            'id', customer.id, 
            'firstName', customer.first_name, 
            'lastName', customer.last_name
        )) as char) as customers 
    from company 
    left join customer on customer.company_id = company.id 
    where company.id = ? 
    group by company.id, company.`name`
    ```
=== "Oracle"
    ```oracle
    select 
        company.id as "id", 
        company.name as "name", 
        json_arrayagg(json_object(
            'id' value customer.id, 
            'firstName' value customer.first_name, 
            'lastName' value customer.last_name
        )) as "customers" 
    from company 
    left join customer on customer.company_id = company.id 
    where company.id = :0 
    group by company.id, company.name
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as id, 
        company.name as name, 
        (json_agg(json_build_object(
            'id', customer.id, 
            'firstName', customer.first_name, 
            'lastName', customer.last_name
        )))::text as customers 
    from company 
    left join customer on customer.company_id = company.id 
    where company.id = $1 
    group by company.id, company.name
    ```
=== "SQLite"
    ```sqlite
    select 
        company.id as id, 
        company.name as name, 
        json_group_array(json_object(
            'id', customer.id, 'firstName', 
            customer.first_name, 'lastName', 
            customer.last_name
        )) as customers 
    from company 
    left join customer on customer.company_id = company.id 
    where company.id = ?1 
    group by company.id, company.name
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company.id as id, 
        company.name as name, 
        json_arrayagg(json_object(
            'id':customer.id, 
            'firstName':customer.first_name, 
            'lastName':customer.last_name
        )) as customers 
    from company 
    left join customer on customer.company_id = company.id 
    where company.id = @0 
    group by company.id, company.name
    ```

The parameters are: `[ 1 ]`

The result type is:
```tsx
const acmeCompanyWithCustomers: Promise<{
    id: number;
    name: string;
    customers?: {
        id: number;
        firstName: string;
        lastName: string;
    }[];
}>
```

!!! note

    You can treat optional properties as required values that allow `null` by calling `projectingOptionalValuesAsNullable()` immediately after `aggregateAsArray(...)`. See [Optional values in the elements](#optional-values-in-the-elements).

!!! note "SQL Server: native JSON aggregates require SQL Server 2025+"

    The `json_arrayagg` and `json_object` aggregates shown above are emitted only when the connection's [`compatibilityVersion`](../configuration/supported-databases/sqlserver.md) is at least `17_000_000` (SQL Server 2025), which is the default. On older versions, set `compatibilityVersion` to your actual version (e.g. `16_000_000` for SQL Server 2022); the same query is then emitted using `string_agg`/`string_escape` to build the JSON output.

## Aggregate as an array of values

Use `aggregateAsArrayOfOneColumn` when you want a list of values and not of objects. It receives the value to put in the array, which can be a column or an expression.

```ts
const tCustomerLeftJoin = tCustomer.forUseInLeftJoin();

const acmeCompanyWithCustomers = connection.selectFrom(tCompany)
    .leftJoin(tCustomerLeftJoin).on(tCustomerLeftJoin.companyId.equals(tCompany.id))
    .where(tCompany.id.equals(1))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        customers: connection.aggregateAsArrayOfOneColumn(tCustomerLeftJoin.firstName.concat(' ').concat(tCustomerLeftJoin.lastName))
    })
    .groupBy('id', 'name')
    .executeSelectOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company.id as id, 
        company.name as name, 
        cast(json_arrayagg(concat(customer.first_name, ?, customer.last_name)) as char) as customers 
    from company 
    left join customer on customer.company_id = company.id 
    where company.id = ? 
    group by company.id, company.name
    ```
=== "MySQL"
    ```mysql
    select 
        company.id as id, 
        company.`name` as `name`, 
        cast(json_arrayagg(concat(customer.first_name, ?, customer.last_name)) as char) as customers 
    from company 
    left join customer on customer.company_id = company.id 
    where company.id = ? 
    group by company.id, company.`name`
    ```
=== "Oracle"
    ```oracle
    select 
        company.id as "id", 
        company.name as "name", 
        json_arrayagg(case when customer.first_name is null or customer.last_name is null then null else customer.first_name || :0 || customer.last_name end) as "customers" 
    from company 
    left join customer on customer.company_id = company.id 
    where company.id = :1 
    group by company.id, company.name
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as id, 
        company.name as name, 
        (json_agg(customer.first_name || $1 || customer.last_name))::text as customers 
    from company 
    left join customer on customer.company_id = company.id 
    where company.id = $2 
    group by company.id, company.name
    ```
=== "SQLite"
    ```sqlite
    select 
        company.id as id, 
        company.name as name, 
        json_group_array(customer.first_name || ?1 || customer.last_name) as customers 
    from company 
    left join customer on customer.company_id = company.id 
    where company.id = ?2 
    group by company.id, company.name
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company.id as id, 
        company.name as name, 
        json_arrayagg(customer.first_name + @0 + customer.last_name null on null) as customers 
    from company 
    left join customer on customer.company_id = company.id 
    where company.id = @1 
    group by company.id, company.name
    ```

The parameters are: `[ " ", 1 ]`

The result type is:
```tsx
const acmeCompanyWithCustomers: Promise<{
    id: number;
    name: string;
    customers: string[];
}>
```

## Removing the duplicates

`aggregateAsArrayOfOneColumnDistinct` and `aggregateAsArrayDistinct` work like the functions above, but each value or object is only once in the array. In the object form, two objects are the same when all their properties are the same. For example, the different last names of the customers of a company:

```ts
const tCustomerLeftJoin = tCustomer.forUseInLeftJoin();

const acmeCompanyWithLastNames = connection.selectFrom(tCompany)
    .leftJoin(tCustomerLeftJoin).on(tCustomerLeftJoin.companyId.equals(tCompany.id))
    .where(tCompany.id.equals(1))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        lastNames: connection.aggregateAsArrayOfOneColumnDistinct(tCustomerLeftJoin.lastName)
    })
    .groupBy('id', 'name')
    .executeSelectOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company.id as id, 
        company.name as name, 
        cast(json_arrayagg(distinct customer.last_name) as char) as lastNames 
    from company 
    left join customer on customer.company_id = company.id 
    where company.id = ? 
    group by 
        company.id, 
        company.name
    ```
=== "MySQL"
    ```mysql
    -- Not available on MySQL
    ```
=== "Oracle"
    ```oracle
    -- Not available on Oracle
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as id, 
        company.name as name, 
        (json_agg(distinct customer.last_name))::text as "lastNames" 
    from company 
    left join customer on customer.company_id = company.id 
    where company.id = $1 
    group by 
        company.id, 
        company.name
    ```
=== "SQLite"
    ```sqlite
    select 
        company.id as id, 
        company.name as name, 
        json_group_array(distinct customer.last_name) as lastNames 
    from company 
    left join customer on customer.company_id = company.id 
    where company.id = ?1 
    group by 
        company.id, 
        company.name
    ```
=== "SQL Server"
    ```sqlserver
    -- Not available on SQL Server
    ```

The parameters are: `[ 1 ]`

!!! warning "Limitation"

    [MySQL](../configuration/supported-databases/mysql.md), [Oracle](../configuration/supported-databases/oracle.md), and [SQL Server](../configuration/supported-databases/sqlserver.md) don't accept the `DISTINCT` quantifier inside their JSON-array aggregation function. If you try to use `aggregateAsArrayDistinct` or `aggregateAsArrayOfOneColumnDistinct` on any of these databases, you will get a compilation error. A workaround is to remove the duplicates inside a subquery created with `subSelectDistinctUsing`, as shown in [Inline subquery with distinct values referencing the outer query](cte-subqueries.md#inline-subquery-with-distinct-values-referencing-the-outer-query).

## An inline query as an array of objects

An inline query is a subquery that returns the array for each row of the outer query. `subSelectUsing` receives the tables of the outer query that the subquery refers to, as explained in [Inline subquery referencing the outer query](cte-subqueries.md#inline-subquery-referencing-the-outer-query). Calling `forUseAsInlineAggregatedArrayValue()` at the end gives you a value to use in the select of the outer query, which doesn't need a join or a group by.

```ts
const aggregatedCustomersOfAcme = connection.subSelectUsing(tCompany).from(tCustomer)
    .where(tCustomer.companyId.equals(tCompany.id))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName
    })
    .orderBy('id')
    .forUseAsInlineAggregatedArrayValue()

const acmeCompanyWithCustomers = await connection.selectFrom(tCompany)
    .where(tCompany.id.equals(1))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        customers: aggregatedCustomersOfAcme
    })
    .executeSelectOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        name as name, 
        cast((
            select json_arrayagg(json_object(
                'id', id, 
                'firstName', first_name, 
                'lastName', last_name
            ) order by id) 
            from customer 
            where company_id = company.id
        ) as char) as customers 
        from company 
        where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        `name` as `name`, 
        cast((
            select json_arrayagg(json_object(
                'id', a_1_.id, 
                'firstName', a_1_.firstName, 
                'lastName', a_1_.lastName
            )) 
            from (
                select 
                    id as id, 
                    first_name as firstName, 
                    last_name as lastName 
                from customer 
                where company_id = company.id 
                order by id 
                limit 2147483647
            ) as a_1_
        ) as char) as customers 
    from company 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name", 
        (
            select json_arrayagg(json_object(
                'id' value a_1_.id, 
                'firstName' value a_1_.firstName, 
                'lastName' value a_1_.lastName
            )) 
            from (
                select 
                    id as id, 
                    first_name as firstName, 
                    last_name as lastName 
                from customer 
                where company_id = company.id 
                order by id 
                offset 0 rows
            ) a_1_
        ) as "customers" 
        from company 
        where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name, 
        ((
            select json_agg(json_build_object(
                'id', a_1_.id, 
                'firstName', a_1_.firstName,
                'lastName', a_1_.lastName
            )) 
            from (
                select 
                    id as id, 
                    first_name as firstName, 
                    last_name as lastName 
                from customer 
                where company_id = company.id 
                order by id
            ) as a_1_
        ))::text as customers 
    from company 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name, 
        (
            select json_group_array(json_object(
                'id', a_1_.id, 
                'firstName', a_1_.firstName, 
                'lastName', a_1_.lastName
            )) 
            from (
                select 
                    id as id, 
                    first_name as firstName, 
                    last_name as lastName 
                from customer 
                where company_id = company.id 
                order by id
            ) as a_1_
        ) as customers 
    from company 
    where id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name, 
        (
            select 
                id as id, 
                first_name as firstName, 
                last_name as lastName 
            from customer 
            where company_id = company.id 
            order by id 
            offset 0 rows 
            for json path
        ) as customers 
    from company 
    where id = @0
    ```

The parameters are: `[ 1 ]`

The result type is:
```tsx
const acmeCompanyWithCustomers: Promise<{
    id: number;
    name: string;
    customers: {
        id: number;
        firstName: string;
        lastName: string;
    }[];
}>
```

!!! tip

    - The `forUseAsInlineAggregatedArrayValue()` method ensures the query is correctly wrapped to preserve clauses like `ORDER BY`.
    - You can treat optional values in objects as always-required properties that allow `null` by calling `projectingOptionalValuesAsNullable()` immediately after `select(...)`.

## An inline query as an array of values

When the inline query uses `selectOneColumn`, the result is an array of values. Inside the query, the name of that column for `orderBy` is `result`.

```ts
const aggregatedCustomersOfAcme = connection.subSelectUsing(tCompany).from(tCustomer)
    .where(tCustomer.companyId.equals(tCompany.id))
    .selectOneColumn(tCustomer.firstName.concat(' ').concat(tCustomer.lastName))
    .orderBy('result')
    .forUseAsInlineAggregatedArrayValue();

const acmeCompanyWithCustomers = connection.selectFrom(tCompany)
    .where(tCompany.id.equals(1))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        customers: aggregatedCustomersOfAcme
    })
    .executeSelectOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        name as name, 
        cast((
            select json_arrayagg(concat(first_name, ?, last_name) order by concat(first_name, ?, last_name)) 
            from customer 
            where company_id = company.id
        ) as char) as customers 
    from company 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        `name` as `name`, 
        cast((
            select json_arrayagg(a_1_.result) 
            from (
                select concat(first_name, ?, last_name) as result 
                from customer 
                where company_id = company.id 
                order by result 
                limit 2147483647
            ) as a_1_
        ) as char) as customers 
        from company 
        where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name", 
        (
            select json_arrayagg(a_1_.result) 
            from (
                select first_name || :0 || last_name as result 
                from customer 
                where company_id = company.id 
                order by result offset 0 rows
            ) a_1_
        ) as "customers" 
    from company 
    where id = :1
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name, 
        ((
            select json_agg(a_1_.result) 
            from (
                select first_name || $1 || last_name as result 
                from customer 
                where company_id = company.id 
                order by result
            ) as a_1_
        ))::text as customers 
        from company 
        where id = $2
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name, 
        (
            select json_group_array(a_1_.result) 
            from (
                select first_name || ?1 || last_name as result 
                from customer 
                where company_id = company.id 
                order by result
            ) as a_1_
        ) as customers 
    from company 
    where id = ?2
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name, 
        (
            select json_arrayagg(a_1_.[result] null on null) 
            from (
                select first_name + @0 + last_name as [result] 
                from customer 
                where company_id = company.id 
                order by [result] 
                offset 0 rows
            ) as a_1_
        ) as customers 
        from company 
        where id = @1
    ```

The parameters are: `[ " ", 1 ]` (On [MariaDB](../configuration/supported-databases/mariadb.md): `[" ", " ", 1]`)

The result type is:
```tsx
const acmeCompanyWithCustomers: Promise<{
    id: number;
    name: string;
    customers: string[];
}>
```

!!! note
    
    The `forUseAsInlineAggregatedArrayValue()` method takes care of wrapping the inline query in another query (when it is required) to ensure clauses like order by works as expected.

    The same technique can be used with recursive queries, as shown below.

## Ordering and limiting the array

The order of the elements of an array isn't defined unless you ask for it, and the `orderBy` of the outer query orders the rows of the result, not the elements inside each array.

The aggregate functions offer no way of indicating the order. To have it, write the array as an inline query: its `orderBy`, `limit` and `offset` apply to the array of each row. For example, each company with its last three customers:

```ts
const lastCustomers = connection.subSelectUsing(tCompany).from(tCustomer)
    .where(tCustomer.companyId.equals(tCompany.id))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .orderBy('id', 'desc')
    .limit(3)
    .forUseAsInlineAggregatedArrayValue();

const companies = await connection.selectFrom(tCompany)
    .select({
        id: tCompany.id,
        name: tCompany.name,
        lastCustomers: lastCustomers
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        name as name, 
        cast((select json_arrayagg(json_object('id', id, 'firstName', first_name) order by id desc limit ?) from customer where company_id = company.id) as char) as lastCustomers 
    from company
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        `name` as `name`, 
        cast((select json_arrayagg(json_object('id', a_1_.id, 'firstName', a_1_.firstName)) from (select id as id, first_name as firstName from customer where company_id = company.id order by id desc limit ?) as a_1_) as char) as lastCustomers 
    from company
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name", 
        (select json_arrayagg(json_object('id' value a_1_.id, 'firstName' value a_1_.firstName)) from (select id as id, first_name as firstName from customer where company_id = company.id order by id desc fetch next :0 rows only) a_1_) as "lastCustomers" 
    from company
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name, 
        ((select json_agg(json_build_object('id', a_1_.id, 'firstName', a_1_.firstName)) from (select id as id, first_name as firstName from customer where company_id = company.id order by id desc limit $1) as a_1_))::text as "lastCustomers" 
    from company
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name, 
        (select json_group_array(json_object('id', a_1_.id, 'firstName', a_1_.firstName)) from (select id as id, first_name as firstName from customer where company_id = company.id order by id desc limit ?1) as a_1_) as lastCustomers 
    from company
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name, 
        (select id as id, first_name as firstName from customer where company_id = company.id order by id desc offset 0 rows fetch next @0 rows only for json path) as lastCustomers 
    from company
    ```

The parameters are: `[ 3 ]`

## Arrays inside an array

An inline query can be a property of the elements of another inline query, with the outer query of each one being the next level. For example, each company with its child companies, and each of those with its customers:

```ts
const childCompany = tCompany.as('childCompany');

const customersOfTheChild = connection.subSelectUsing(childCompany).from(tCustomer)
    .where(tCustomer.companyId.equals(childCompany.id))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .forUseAsInlineAggregatedArrayValue();

const childrenOfTheCompany = connection.subSelectUsing(tCompany).from(childCompany)
    .where(childCompany.parentId.equals(tCompany.id))
    .select({
        id: childCompany.id,
        name: childCompany.name,
        customers: customersOfTheChild
    })
    .forUseAsInlineAggregatedArrayValue();

const companies = await connection.selectFrom(tCompany)
    .select({
        id: tCompany.id,
        name: tCompany.name,
        children: childrenOfTheCompany
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        name as name, 
        cast((select json_arrayagg(json_object('id', childCompany.id, 'name', childCompany.name, 'customers', (select json_arrayagg(json_object('id', id, 'firstName', first_name)) from customer where company_id = childCompany.id))) from company as childCompany where childCompany.parent_id = company.id) as char) as children 
    from company
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        `name` as `name`, 
        cast((select json_arrayagg(json_object('id', childCompany.id, 'name', childCompany.`name`, 'customers', (select json_arrayagg(json_object('id', id, 'firstName', first_name)) from customer where company_id = childCompany.id))) from company as childCompany where childCompany.parent_id = company.id) as char) as children 
    from company
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name", 
        (select json_arrayagg(json_object('id' value childCompany.id, 'name' value childCompany.name, 'customers' value (select json_arrayagg(json_object('id' value id, 'firstName' value first_name)) from customer where company_id = childCompany.id))) from company childCompany where childCompany.parent_id = company.id) as "children" 
    from company
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name, 
        ((select json_agg(json_build_object('id', childCompany.id, 'name', childCompany.name, 'customers', (select json_agg(json_build_object('id', id, 'firstName', first_name)) from customer where company_id = childCompany.id))) from company as childCompany where childCompany.parent_id = company.id))::text as children 
    from company
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name, 
        (select json_group_array(json_object('id', childCompany.id, 'name', childCompany.name, 'customers', (select json_group_array(json_object('id', id, 'firstName', first_name)) from customer where company_id = childCompany.id))) from company as childCompany where childCompany.parent_id = company.id) as children 
    from company
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name, 
        (select childCompany.id as id, childCompany.name as name, (select id as id, first_name as firstName from customer where company_id = childCompany.id for json path) as customers from company as childCompany where childCompany.parent_id = company.id for json path) as children 
    from company
    ```

The parameters are: `[]`

## Recursive query as an inline array of objects

A [recursive query](recursive-select.md) can be the source of the array too. Here, the company comes with the array of all its ancestors: its parent, the parent of its parent, and so on.

```ts
const parentCompany = tCompany.as('parentCompany')

const parentCompanies = connection.subSelectUsing(tCompany)
    .from(parentCompany)
    .select({
        id: parentCompany.id,
        name: parentCompany.name,
        parentId: parentCompany.parentId
    })
    .where(parentCompany.id.equals(tCompany.parentId))
    .recursiveUnionAllOn((child) => {
        return child.parentId.equals(parentCompany.id)
    })
    .forUseAsInlineAggregatedArrayValue();

const lowCompany = await connection.selectFrom(tCompany)
    .select({
        id: tCompany.id,
        name: tCompany.name,
        parentId: tCompany.parentId,
        parents: parentCompanies
    })
    .where(tCompany.id.equals(10))
    .executeSelectOne()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    --
    --
    --
    -- MariaDB doesn't support referencing an outer table (using `subSelectUsing`) on the recursive query
    --
    --
    --
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        `name` as `name`, 
        parent_id as parentId, 
        cast((
            with recursive 
                recursive_select_1 as (
                    select 
                        parentCompany.id as id, 
                        parentCompany.`name` as `name`, 
                        parentCompany.parent_id as parentId 
                    from company as parentCompany 
                    where parentCompany.id = company.parent_id 
                    
                    union all 
                    
                    select 
                        parentCompany.id as id, 
                        parentCompany.`name` as `name`, 
                        parentCompany.parent_id as parentId 
                    from company as parentCompany 
                    join recursive_select_1 on recursive_select_1.parentId = parentCompany.id
                ) 
            select json_arrayagg(json_object(
                'id', id, 
                'name', `name`, 
                'parentId', parentId
            )) 
            from recursive_select_1
        ) as char) as parents 
    from company 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    --
    --
    --
    -- Oracle doesn't support referencing an outer table (using `subSelectUsing`) on the recursive query
    --
    --
    --
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name, 
        parent_id as "parentId", 
        ((
            with recursive 
                recursive_select_1 as (
                    select 
                        parentCompany.id as id, 
                        parentCompany.name as name, 
                        parentCompany.parent_id as parentId 
                    from company as parentCompany 
                    where parentCompany.id = company.parent_id 
                    
                    union all 
                    
                    select 
                        parentCompany.id as id, 
                        parentCompany.name as name, 
                        parentCompany.parent_id as parentId 
                    from company as parentCompany 
                    join recursive_select_1 on recursive_select_1.parentId = parentCompany.id
                ) 
            select json_agg(json_build_object(
                'id', id, 
                'name', name, 
                'parentId', parentId
            )) 
            from recursive_select_1
        ))::text as parents 
    from company 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name, 
        parent_id as parentId, 
        (
            with recursive 
                recursive_select_1 as (
                    select 
                        parentCompany.id as id, 
                        parentCompany.name as name, 
                        parentCompany.parent_id as parentId 
                    from company as parentCompany 
                    where parentCompany.id = company.parent_id 
                    
                    union all 
                    
                    select 
                        parentCompany.id as id, 
                        parentCompany.name as name, 
                        parentCompany.parent_id as parentId 
                    from company as parentCompany 
                    join recursive_select_1 on recursive_select_1.parentId = parentCompany.id
                ) 
            select json_group_array(json_object(
                'id', id, 
                'name', name, 
                'parentId', parentId
            )) 
            from recursive_select_1
        ) as parents 
    from company 
    where id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    --
    --
    --
    -- SQL Server doesn't support referencing an outer table (using `subSelectUsing`) on the recursive query
    --
    --
    --
    ```

The parameters are: `[ 10 ]`

The result type is:
```tsx
const lowCompany: Promise<{
    id: number;
    name: string;
    parents: {
        id: number;
        name: string;
        parentId?: number;
    }[];
    parentId?: number;
}>
```

!!! warning "Limitation"

    [SQL Server](../configuration/supported-databases/sqlserver.md), [Oracle](../configuration/supported-databases/oracle.md), and [MariaDB](../configuration/supported-databases/mariadb.md) don't support recursive queries that reference outer tables (using `subSelectUsing`). If you try to use this query on any of these databases, you will get a compilation error. A workaround is to avoid the outer reference in the recursive query indicating the parent id in the `parentCompanies` query.

## When there are no values

A company with no customers has no values for the array. Depending on the database and the form of the query, that comes back as a null, an empty array, or an array with an empty element; the library treats all of them in the same way, and by default you get an empty array.

These methods of the resulting value change that, and they are the same for the aggregate functions and the inline queries:

| Method | Result with no values | Type of the property |
|---|---|---|
| `useEmptyArrayForNoValue()` (default) | An empty array | `T[]` |
| `asOptionalNonEmptyArray()` | No property (`undefined`), never an empty array | `T[]`, optional |
| `asRequiredInOptionalObject()` | The nested object that contains the array is left out, as explained in [Optional nested objects with required fields](complex-projections.md#optional-nested-objects-with-required-fields) | `T[]`, in an optional object |

## An array only when it's required

`onlyWhenOrNull(when)` computes the array only when the argument is `true`. When it's `false`, the query has a `null` in its place and the property is left out of the result; if you prefer an empty array in that case, call `useEmptyArrayForNoValue()` afterwards. `ignoreWhenAsNull(when)` is the opposite: it leaves out the array when the argument is `true`. In both, the property is optional in the type.

With an inline query, the subquery isn't sent to the database at all. With an aggregate function, the `null` takes the place of the function, but the join and the group by you wrote stay in the query. For example, with a boolean `includeCustomers`:

<!-- doc-code-snippet-result: { id: 1, name: 'ACME' } -->
```ts
const includeCustomers = false;

const customersOfTheCompany = connection.subSelectUsing(tCompany).from(tCustomer)
    .where(tCustomer.companyId.equals(tCompany.id))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .forUseAsInlineAggregatedArrayValue()
    .onlyWhenOrNull(includeCustomers);

const company = await connection.selectFrom(tCompany)
    .where(tCompany.id.equals(1))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        customers: customersOfTheCompany
    })
    .executeSelectOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        name as name, 
        cast(null as char) as customers 
    from company 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        `name` as `name`, 
        cast(null as char) as customers 
    from company 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name", 
        null as "customers" 
    from company 
    where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name, 
        (null)::text as customers 
    from company 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name, 
        null as customers 
    from company 
    where id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name, 
        null as customers 
    from company 
    where id = @0
    ```

The parameters are: `[ 1 ]`

`allowWhen` and `disallowWhen` are available too; they [throw an error](../dynamic/caller-decides/restricting-values.md#refuse-a-query-that-uses-a-value) instead of leaving out the value.

## Optional values in the elements

**In an array of values**, a null is removed from the array: the type is `string[]`, not `(string | null)[]`. An array can then have fewer elements than the rows that produced it.

**In an array of objects**, an optional property with no value is left out of the element by default, like in a select. To have it always present, with `null` when it has no value, call `projectingOptionalValuesAsNullable()`. It goes immediately after `aggregateAsArray(...)`:

<!-- doc-code-snippet-result: { id: 1, customers: [] } -->
```ts
const tCustomerLeftJoin = tCustomer.forUseInLeftJoin();

const acmeCompanyWithCustomers = await connection.selectFrom(tCompany)
    .leftJoin(tCustomerLeftJoin).on(tCustomerLeftJoin.companyId.equals(tCompany.id))
    .where(tCompany.id.equals(1))
    .select({
        id: tCompany.id,
        customers: connection.aggregateAsArray({
            id: tCustomerLeftJoin.id,
            birthday: tCustomerLeftJoin.birthday
        }).projectingOptionalValuesAsNullable()
    })
    .groupBy('id')
    .executeSelectOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company.id as id, 
        cast(json_arrayagg(json_object('id', customer.id, 'birthday', customer.birthday)) as char) as customers 
    from company 
    left join customer on customer.company_id = company.id 
    where company.id = ? 
    group by company.id
    ```
=== "MySQL"
    ```mysql
    select 
        company.id as id, 
        cast(json_arrayagg(json_object('id', customer.id, 'birthday', customer.birthday)) as char) as customers 
    from company 
    left join customer on customer.company_id = company.id 
    where company.id = ? 
    group by company.id
    ```
=== "Oracle"
    ```oracle
    select 
        company.id as "id", 
        json_arrayagg(json_object('id' value customer.id, 'birthday' value customer.birthday)) as "customers" 
    from company 
    left join customer on customer.company_id = company.id 
    where company.id = :0 
    group by company.id
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as id, 
        (json_agg(json_build_object('id', customer.id, 'birthday', customer.birthday)))::text as customers 
    from company 
    left join customer on customer.company_id = company.id 
    where company.id = $1 
    group by company.id
    ```
=== "SQLite"
    ```sqlite
    select 
        company.id as id, 
        json_group_array(json_object('id', customer.id, 'birthday', customer.birthday)) as customers 
    from company 
    left join customer on customer.company_id = company.id 
    where company.id = ?1 
    group by company.id
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company.id as id, 
        json_arrayagg(json_object('id':customer.id, 'birthday':customer.birthday)) as customers 
    from company 
    left join customer on customer.company_id = company.id 
    where company.id = @0 
    group by company.id
    ```

The parameters are: `[ 1 ]`

In an inline query it goes immediately after `select(...)`:

<!-- doc-code-snippet-result: { id: 1, customers: [] } -->
```ts
const customersOfTheCompany = connection.subSelectUsing(tCompany).from(tCustomer)
    .where(tCustomer.companyId.equals(tCompany.id))
    .select({
        id: tCustomer.id,
        birthday: tCustomer.birthday
    })
    .projectingOptionalValuesAsNullable()
    .orderBy('id')
    .forUseAsInlineAggregatedArrayValue();

const acmeCompanyWithCustomers = await connection.selectFrom(tCompany)
    .where(tCompany.id.equals(1))
    .select({
        id: tCompany.id,
        customers: customersOfTheCompany
    })
    .executeSelectOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        cast((select json_arrayagg(json_object('id', id, 'birthday', birthday) order by id) from customer where company_id = company.id) as char) as customers 
    from company 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        cast((select json_arrayagg(json_object('id', a_1_.id, 'birthday', a_1_.birthday)) from (select id as id, birthday as birthday from customer where company_id = company.id order by id limit 2147483647) as a_1_) as char) as customers 
    from company 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        (select json_arrayagg(json_object('id' value a_1_.id, 'birthday' value a_1_.birthday)) from (select id as id, birthday as birthday from customer where company_id = company.id order by id offset 0 rows) a_1_) as "customers" 
    from company 
    where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        ((select json_agg(json_build_object('id', a_1_.id, 'birthday', a_1_.birthday)) from (select id as id, birthday as birthday from customer where company_id = company.id order by id) as a_1_))::text as customers 
    from company 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        (select json_group_array(json_object('id', a_1_.id, 'birthday', a_1_.birthday)) from (select id as id, birthday as birthday from customer where company_id = company.id order by id) as a_1_) as customers 
    from company 
    where id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        (select id as id, birthday as birthday from customer where company_id = company.id order by id offset 0 rows for json path) as customers 
    from company 
    where id = @0
    ```

The parameters are: `[ 1 ]`

In both, the type of the elements is `{ id: number; birthday: Date | null }`, and not `{ id: number; birthday?: Date }`. This only applies to the array where you call it: `projectingOptionalValuesAsNullable()` on the outer select doesn't change the elements of an `aggregateAsArray` in it.

The elements of the two forms follow different rules, because of what each one is:

- **`aggregateAsArray`**: each element is treated as a [nested object](complex-projections.md#rules-for-nested-object-projections). An element whose properties are all null is left out of the array, and so is an element with no value in a column marked with `asRequiredInOptionalObject`, or, when all the columns come from the same left join, in a column that's required in its table. This is what removes the empty element of a left join with no match.
- **Inline query**: each element is a row of the query, as in any select, and it's kept even when all its properties are null.

## How the values go through JSON

The values travel as JSON, which has no dates or big integers, so the library converts each value back to the type of its column. For these types of column you get the same as with a plain column:

| Type of the column | Value in the array |
|---|---|
| `int`, `double` | `number` |
| `bigint` | `bigint`, with all its digits, also above 2^53: the library parses the JSON without rounding the numbers |
| `string` | `string` |
| `boolean`, also with a `CustomBooleanTypeAdapter` | `boolean` |
| `localDate`, `localTime`, `localDateTime` | `Date` |
| `uuid` | `string`, also in the databases where it's stored in binary: the query converts it to text |

A number arrives as its text, so that no precision is lost, and it's the type of the column that converts it. A custom type, `customInt` and `customDouble` included, needs [its conversion registered](../configuration/column-types.md#custom-types); without it, a number of a custom type arrives in the array as text.

An `int` above `Number.MAX_SAFE_INTEGER` raises the `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE` error instead of returning a wrong value. Use `bigint` for those columns.

A [type adapter](../configuration/column-types.md) runs for each value of the array. It receives the value as it's in the JSON, which is not always what the driver gives for a plain column: a column stored as binary, for example, doesn't arrive as bytes. Take it into account if you use that column in an array.

## Availability in each database

| Database | JSON aggregate | `aggregateAsArrayDistinct`, `aggregateAsArrayOfOneColumnDistinct` | Inline query with `distinct`, group by or compound, referencing the outer query | Recursive inline query referencing the outer query | Minimum version |
|---|---|---|---|---|---|
| PostgreSQL | `json_agg` | Yes | Yes | Yes | |
| SQLite | `json_group_array` | Yes | Yes | Yes | |
| MariaDB | `json_arrayagg` | Yes | Not offered | Not offered | MariaDB 10.5 |
| MySQL | `json_arrayagg` | Not offered | Yes | Yes | MySQL 8.0.14 |
| Oracle | `json_arrayagg` | Not offered | Yes | Not offered | |
| SQL Server | `json_arrayagg`, `for json path` in the inline queries of objects | Not offered | Yes | Not offered | |

What is not offered doesn't compile on that connection. On an older version than the one in the table, the database rejects the query.

On SQL Server, `json_arrayagg` needs SQL Server 2025: with a lower [`compatibilityVersion`](../configuration/supported-databases/sqlserver.md) the library builds the JSON with `string_agg` and `string_escape`.
