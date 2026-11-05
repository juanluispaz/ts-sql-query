---
search:
  boost: 3
---
# CTE (with clause) & subqueries

This page explains how to use a select inside another one: in a condition, as a value of the select, referencing the outer query, and as a view with a Common Table Expression (CTE), the SQL `with` clause. For a query that refers to itself, see [Recursive select](recursive-select.md).

## Select with subquery and dynamic order by

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

## Inline subquery as value

To use a select query that returns one column as an inline query value, you must get the value representation by calling the method `forUseAsInlineQueryValue` and then use the value representation as with any other value in a secondary query.

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

## Inline subquery referencing outer query

To use a select query that returns one column as an inline query value that references the outer query's tables, you must start the subquery calling `subSelectUsing` and providing by argument the external tables or views required to execute the subquery, and then get the value representation, in the end, by calling the method `forUseAsInlineQueryValue` and then use the value representation as with any other value in the outer query.

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

    In the previous example, it is more convenient to use `.selectCountAll()` instead of `.selectOneColumn(connection.countAll())` because the returned value will not be optional; if not, you will not need to use `.selectOneColumn(connection.countAll()).valueWhenNull(0)` to achive same optionality result.

## Inline subquery with distinct values referencing outer query

`subSelectDistinctUsing` works like `subSelectUsing`, but the subquery returns distinct rows (`select distinct`). For example, the distinct last names of the customers of each company, as an [aggregated array](aggregate-as-object-array.md):

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

## Using a select as a view in another select query (SQL with clause)

You can define a select query and use it as if it were a view in another select query.

To allow it, you must call the `forUseInQueryAs` method instead of executing the query. This returns a view-like representation that will be included as a `WITH` clause in the final SQL, using the name passed to `forUseInQueryAs`.

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
