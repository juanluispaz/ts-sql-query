---
search:
  boost: 4
---
# Select
 
This page provides an in-depth explanation of how to construct and customize `SELECT` statements using `ts-sql-query`. It covers advanced projection strategies, optional value handling, dynamic ordering, inline subqueries, and compound queries. Each section includes examples, generated SQL, and the resulting TypeScript types to help understand the mapping and behavior.

## Select with joins and order by

```ts
const firstName = 'John';
const lastName = null;

const company = tCompany.as('comp');
const customersWithCompanyName = connection.selectFrom(tCustomer)
    .innerJoin(company).on(tCustomer.companyId.equals(company.id))
    .where(tCustomer.firstName.startsWithInsensitive(firstName))
        .and(tCustomer.lastName.startsWithInsensitiveIfValue(lastName))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday,
        companyName: company.name
    })
    .orderBy('firstName', 'insensitive')
    .orderBy('lastName', 'asc insensitive')
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday, 
        comp.name as companyName 
    from customer 
    inner join company as comp on customer.company_id = comp.id 
    where lower(customer.first_name) like concat(lower(?), '%') 
    order by 
        lower(firstName), 
        lower(lastName) asc
    ```
=== "MySQL"
    ```mysql
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday, 
        comp.`name` as companyName 
    from customer 
    inner join company as comp on customer.company_id = comp.id 
    where lower(customer.first_name) like concat(lower(?), '%') 
    order by 
        lower(firstName), 
        lower(lastName) asc
    ```
=== "Oracle"
    ```oracle
    select 
        customer.id as "id", 
        customer.first_name as "firstName", 
        customer.last_name as "lastName", 
        customer.birthday as "birthday", 
        comp.name as "companyName" 
    from customer 
    inner join company comp on customer.company_id = comp.id 
    where lower(customer.first_name) like lower(:0 || '%') escape '\\' 
    order by 
        lower("firstName"), 
        lower("lastName") asc
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.id as id, 
        customer.first_name as "firstName", 
        customer.last_name as "lastName", 
        customer.birthday as birthday, 
        comp.name as "companyName" 
    from customer 
    inner join company as comp on customer.company_id = comp.id 
    where customer.first_name ilike ($1 || '%') 
    order by 
        lower("firstName"), 
        lower("lastName") asc
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday, 
        comp.name as companyName 
    from customer 
    inner join company as comp on customer.company_id = comp.id 
    where lower(customer.first_name) like lower(? || '%') escape '\\' 
    order by 
        lower(firstName), 
        lower(lastName) asc
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday, 
        comp.name as companyName 
    from customer 
    inner join company as comp on customer.company_id = comp.id 
    where lower(customer.first_name) like lower(@0 + '%') 
    order by 
        lower(firstName), 
        lower(lastName) asc
    ```

The parameters are: `[ 'John' ]`

The result type is:
```tsx
const customersWithCompanyName: Promise<{
    id: number;
    firstName: string;
    lastName: string;
    companyName: string;
    birthday?: Date;
}[]>
```

The name of the columns to order corresponds to the name/path in the query's result. The supported order by modes are:

```ts
type OrderByMode = 'asc' | 'desc' | 'asc nulls first' | 'asc nulls last' | 'desc nulls first' | 'desc nulls last' | 'insensitive' |
 'asc insensitive' | 'desc insensitive' | 'asc nulls first insensitive' | 'asc nulls last insensitive' | 
 'desc nulls first insensitive' | 'desc nulls last insensitive'
```

!!! note

    For the databases that don't support `null first` or `null last`, a proper order by that emulates that behaviour is generated. The `insensitive` modifier makes the ordering key-insensitive according to the [insensitive strategy](../configuration/connection.md#insensitive-strategies) defined in your connection. 
    
    In case the `insensitive` modifier is used in a not string column, the modifier will be just ignored.

!!! tip

    You can project optional values in objects as always-required properties that allow `null` by calling `projectingOptionalValuesAsNullable()` immediately after `select(...)`. This transformation only affects the resulting TypeScript type — the generated SQL remains unchanged. Instead of using optional fields (`?`), all properties are treated as required but typed as potentially `null`, which can simplify downstream type checks when dealing with partial or outer-joined data.

## Select ordering by a not returned column

```ts
const customerId = 10;

const customerWithId = connection.selectFrom(tCustomer)
    .where(tCustomer.id.equals(customerId))
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
    where id = ? 
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

The result type is:
```tsx
const customerWithId: Promise<{
    id: number;
    firstName: string;
    lastName: string;
}>
```

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
        where name like ('%' || :0 || '%') escape '\\'
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
        where name like ('%' || ? || '%') escape '\\'
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

## Select with aggregate functions and group by

```ts
const customerCountPerCompany = connection.selectFrom(tCompany)
    .innerJoin(tCustomer).on(tCustomer.companyId.equals(tCompany.id))
    .groupBy(tCompany.id, tCompany.name)
    .select({
        companyId: tCompany.id,
        companyName: tCompany.name,
        customerCount: connection.count(tCustomer.id)
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company.id as companyId, 
        company.name as companyName, 
        count(customer.id) as customerCount 
    from company 
    inner join customer on customer.company_id = company.id 
    group by 
        company.id, 
        company.name
    ```
=== "MySQL"
    ```mysql
    select 
        company.id as companyId, 
        company.`name` as companyName, 
        count(customer.id) as customerCount 
    from company 
    inner join customer on customer.company_id = company.id 
    group by 
        company.id, 
        company.`name`
    ```
=== "Oracle"
    ```oracle
    select 
        company.id as "companyId", 
        company.name as "companyName", 
        count(customer.id) as "customerCount" 
    from company 
    inner join customer on customer.company_id = company.id 
    group by 
        company.id, 
        company.name
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as "companyId", 
        company.name as "companyName", 
        count(customer.id) as "customerCount" 
    from company 
    inner join customer on customer.company_id = company.id 
    group by 
        company.id, 
        company.name
    ```
=== "SQLite"
    ```sqlite
    select 
        company.id as companyId, 
        company.name as companyName, 
        count(customer.id) as customerCount 
    from company 
    inner join customer on customer.company_id = company.id 
    group by 
        company.id, 
        company.name
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company.id as companyId, 
        company.name as companyName, 
        count(customer.id) as customerCount 
    from company 
    inner join customer on customer.company_id = company.id 
    group by 
        company.id, 
        company.name
    ```

The parameters are: `[]`

The result type is:
```tsx
const customerCountPerCompany: Promise<{
    companyId: number;
    companyName: string;
    customerCount: number;
}[]>
```

## Select with left join

To use a table or view in a left join, you must create a left join representation first by calling the method `forUseInLeftJoin` or `forUseInLeftJoinAs`.

```ts
const parent = tCompany.forUseInLeftJoinAs('parent');

const leftJoinCompany = connection.selectFrom(tCompany)
    .leftJoin(parent).on(tCompany.parentId.equals(parent.id))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        parentId: parent.id,
        parentName: parent.name
    }).executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company.id as id, 
        company.name as name, 
        parent.id as parentId, 
        parent.name as parentName 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```
=== "MySQL"
    ```mysql
    select 
        company.id as id, 
        company.`name` as `name`, 
        parent.id as parentId, 
        parent.`name` as parentName 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```
=== "Oracle"
    ```oracle
    select 
        company.id as "id", 
        company.name as "name", 
        parent.id as "parentId", 
        parent.name as "parentName" 
    from company 
    left join company parent on company.parent_id = parent.id
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as id, 
        company.name as name, 
        parent.id as "parentId", 
        parent.name as "parentName" 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```
=== "SQLite"
    ```sqlite
    select 
        company.id as id, 
        company.name as name, 
        parent.id as parentId, 
        parent.name as parentName 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company.id as id, 
        company.name as name, 
        parent.id as parentId, 
        parent.name as parentName 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```

The parameters are: `[]`

The result type is:
```tsx
const leftJoinCompany: Promise<{
    id: number;
    name: string;
    parentId?: number;
    parentName?: string;
}[]>
```

## Select with left join and complex projections

When you are doing a left join, you probably want to use [Complex projections](complex-projections.md):

```ts
const parent = tCompany.forUseInLeftJoinAs('parent');

const leftJoinCompany = await connection.selectFrom(tCompany)
    .leftJoin(parent).on(tCompany.parentId.equals(parent.id))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        parent: {
            id: parent.id,
            name: parent.name
        }
    }).executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company.id as id, 
        company.name as name, 
        parent.id as `parent.id`, 
        parent.name as `parent.name` 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```
=== "MySQL"
    ```mysql
    select 
        company.id as id, 
        company.`name` as `name`, 
        parent.id as `parent.id`, 
        parent.`name` as `parent.name` 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```
=== "Oracle"
    ```oracle
    select 
        company.id as "id", 
        company.name as "name", 
        parent.id as "parent.id", 
        parent.name as "parent.name" 
    from company 
    left join company parent on company.parent_id = parent.id
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as id, 
        company.name as name, 
        parent.id as "parent.id", 
        parent.name as "parent.name" 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```
=== "SQLite"
    ```sqlite
    select 
        company.id as id, 
        company.name as name, 
        parent.id as "parent.id", 
        parent.name as "parent.name" 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company.id as id, 
        company.name as name, 
        parent.id as [parent.id], 
        parent.name as [parent.name] 
    from company 
    left join company as parent on company.parent_id = parent.id
    ```

The parameters are: `[]`

The result type is:
```tsx
const leftJoinCompany: Promise<{
    id: number;
    name: string;
    parent?: {
        id: number;
        name: string;
    };
}[]>
```

## Select with a compound operator (union, intersect, except)

```ts
const allDataWithName = connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id,
        name: tCustomer.firstName.concat(' ').concat(tCustomer.lastName),
        type: connection.const<'customer' | 'company'>('customer', 'enum', 'customerOrCompany')
    }).unionAll(
        connection.selectFrom(tCompany)
        .select({
            id: tCompany.id,
            name: tCompany.name,
            type: connection.const<'customer' | 'company'>('company', 'enum', 'customerOrCompany')
        })
    ).executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        concat(first_name, ?, last_name) as name, 
        ? as type 
    from customer 
    
    union all 
    
    select 
        id as id, 
        name as name, 
        ? as type 
    from company
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        concat(first_name, ?, last_name) as `name`, 
        ? as `type` 
    from customer 
    
    union all 
    
    select 
        id as id, 
        `name` as `name`, 
        ? as `type` 
    from company
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name || :0 || last_name as "name", 
        :1 as "type" 
    from customer 
    
    union all 
    
    select 
        id as "id", 
        name as "name", 
        :2 as "type" 
    from company
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name || $1 || last_name as name, 
        $2 as type 
    from customer 
    
    union all 
    
    select 
        id as id, 
        name as name, 
        $3 as type 
    from company
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name || ? || last_name as name, 
        ? as type 
    from customer 
    
    union all 
    
    select 
        id as id, 
        name as name, 
        ? as type 
    from company
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name + @0 + last_name as name, 
        @1 as type 
    from customer 
    
    union all 
    
    select 
        id as id, 
        name as name, 
        @2 as type 
    from company
    ```

The parameters are: `[ ' ', 'customer', 'company' ]`

The result type is:
```tsx
const allDataWithName: Promise<{
    id: number;
    name: string;
    type: "customer" | "company";
}[]>
```

!!! warning

    All combined queries in a compound operator must return the same number of columns with compatible types and matching column names.

!!! note

    Depending on your database, the supported compound operators are: `union`, `unionAll`, `intersect`, `intersectAll`, `except`,  `exceptAll`, `minus` (alias for `except`), `minusAll` (alias for `exceptAll`)

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
    where lower(companyName) like lower('%' || :0 || '%') escape '\\'
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
    where lower(companyName) like lower('%' || ? || '%') escape '\\'
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

## Select count all

```ts
const companyId = 10;

const numberOfCustomers = connection.selectFrom(tCustomer)
    .where(tCustomer.companyId.equals(companyId))
    .selectCountAll() // Shortcut to .selectOneColumn(connection.countAll())
    .executeSelectOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select count(*) as result 
    from customer 
    where company_id = ?
    ```
=== "MySQL"
    ```mysql
    select count(*) as result 
    from customer 
    where company_id = ?
    ```
=== "Oracle"
    ```oracle
    select count(*) as "result" 
    from customer 
    where company_id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select count(*) as result 
    from customer 
    where company_id = $1
    ```
=== "SQLite"
    ```sqlite
    select count(*) as result 
    from customer 
    where company_id = ?
    ```
=== "SQL Server"
    ```sqlserver
    select count(*) as [result] 
    from customer 
    where company_id = @0
    ```

The parameters are: `[ 10 ]`

The result type is:
```tsx
const numberOfCustomers: Promise<number>
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
        first_name || ? || last_name as name 
    from customer 
    where company_id = (
        select id as result 
        from company 
        where name = ?
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

## Select clauses order

The order of clauses in a select query must follow one of the supported logical patterns:

!!! warning

    These orders are enforced by the library to ensure SQL correctness across databases. Below is a list of valid clause orders.

- **Logical order**: from, join, **WHERE**, **group by**, **having**, **select**, order by, limit, offset, customizeQuery
- **Alternative logical order 1**: from, join, **group by**, **having**, **WHERE**, **select**, order by, limit, offset, customizeQuery
- **Alternative logical order 2**: from, join, **group by**, **having**, **select**, **WHERE**, order by, limit, offset, customizeQuery
- **Alternative logical order 3**: from, join, **group by**, **having**, **select**, order by, **WHERE**, limit, offset, customizeQuery
- **Alternative logical order 4**: from, join, **group by**, **having**, **select**, order by, limit, offset, **WHERE**, customizeQuery
- **Alternative logical order 5**: from, join, **group by**, **having**, **select**, order by, limit, offset, customizeQuery, **WHERE**
  
- **Alternative order 1**: from, join, **select**, **WHERE**, **group by**, **having**, order by, limit, offset, customizeQuery
- **Alternative order 2**: from, join, **select**, **group by**, **having**, **WHERE**, order by, limit, offset, customizeQuery
- **Alternative order 3**: from, join, **select**, **group by**, **having**, order by, **WHERE**, limit, offset, customizeQuery
- **Alternative order 4**: from, join, **select**, **group by**, **having**, order by, limit, offset, **WHERE**, customizeQuery
- **Alternative order 5**: from, join, **select**, **group by**, **having**, order by, limit, offset, customizeQuery, **WHERE**

??? note "Oracle variants"

    [Oracle](../configuration/supported-databases/oracle.md) support _start with_, _connect by_ and _ordering siblings only_. The _ordering siblings only_ modifier changes the previous `order by` to `order siblings by`.

    - **Logical order**: from, join, _start with_, _connect by_, **WHERE**, **group by**, **having**, **select**, order by, _ordering siblings only_, limit, offset, customizeQuery
    - **Alternative logical order 0**: from, join, **WHERE**, _start with_, _connect by_, **group by**, **having**, **select**, order by, _ordering siblings only_, limit, offset, customizeQuery
    - **Alternative logical order 1**: from, join, _start with_, _connect by_, **group by**, **having**, **WHERE**, **select**, order by, _ordering siblings only_, limit, offset, customizeQuery
    - **Alternative logical order 2**: from, join, _start with_, _connect by_, **group by**, **having**, **select**, **WHERE**, order by, _ordering siblings only_, limit, offset, customizeQuery
    - **Alternative logical order 3**: from, join, _start with_, _connect by_, **group by**, **having**, **select**, order by, _ordering siblings only_, **WHERE**, limit, offset, customizeQuery
    - **Alternative logical order 4**: from, join, _start with_, _connect by_, **group by**, **having**, **select**, order by, _ordering siblings only_, limit, offset, **WHERE**, customizeQuery
    - **Alternative logical order 5**: from, join, _start with_, _connect by_, **group by**, **having**, **select**, order by, _ordering siblings only_, limit, offset, customizeQuery, **WHERE**

    - **Alternative order 1**: from, join, _start with_, _connect by_, **select**, **WHERE**, **group by**, **having**, order by, _ordering siblings only_, limit, offset, customizeQuery
    - **Alternative order 2**: from, join, _start with_, _connect by_, **select**, **group by**, **having**, **WHERE**, order by, _ordering siblings only_, limit, offset, customizeQuery
    - **Alternative order 3**: from, join, _start with_, _connect by_, **select**, **group by**, **having**, order by, _ordering siblings only_, **WHERE**, limit, offset, customizeQuery
    - **Alternative order 4**: from, join, _start with_, _connect by_, **select**, **group by**, **having**, order by, _ordering siblings only_, limit, offset, **WHERE**, customizeQuery
    - **Alternative order 5**: from, join, _start with_, _connect by_, **select**, **group by**, **having**, order by, _ordering siblings only_, limit, offset, customizeQuery, **WHERE**
    - **Logical order (Oracle variant)**: from, join, **WHERE**, _start with_, _connect by_, **group by**, **having**, **select**, order by, _ordering siblings only_, limit, offset, customizeQuery

    - **Second alternative order 0**: from, join, **select**, **WHERE**, _start with_, _connect by_, **group by**, **having**, order by, _ordering siblings only_, limit, offset, customizeQuery
    - **Second alternative order 1**: from, join, **select**, _start with_, _connect by_, **WHERE**, **group by**, **having**, order by, _ordering siblings only_, limit, offset, customizeQuery
    - **Second alternative order 2**: from, join, **select**, _start with_, _connect by_, **group by**, **having**, **WHERE**, order by, _ordering siblings only_, limit, offset, customizeQuery
    - **Second alternative order 3**: from, join, **select**, _start with_, _connect by_, **group by**, **having**, order by, _ordering siblings only_, **WHERE**, limit, offset, customizeQuery
    - **Second alternative order 4**: from, join, **select**, _start with_, _connect by_, **group by**, **having**, order by, _ordering siblings only_, limit, offset, **WHERE**, customizeQuery
    - **Second alternative order 5**: from, join, **select**, _start with_, _connect by_, **group by**, **having**, order by, _ordering siblings only_, limit, offset, customizeQuery, **WHERE**
