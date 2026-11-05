---
search:
  boost: 4
---
# Select
 
This page provides an in-depth explanation of how to construct and customize `SELECT` statements using `ts-sql-query`. It covers advanced projection strategies and optional value handling. Each section includes examples, generated SQL, and the resulting TypeScript types to help understand the mapping and behavior.

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
        lower(customer.first_name), 
        lower(customer.last_name) asc
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
        lower(customer.first_name), 
        lower(customer.last_name) asc
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
    where lower(customer.first_name) like lower(:0 || '%') escape '\' 
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
        lower(customer.first_name), 
        lower(customer.last_name) asc
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
    where lower(customer.first_name) like lower(?1 || '%') escape '\' 
    order by 
        lower(customer.first_name), 
        lower(customer.last_name) asc
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
        lower(customer.first_name), 
        lower(customer.last_name) asc
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

The result type is:
```tsx
const customerWithId: Promise<{
    id: number;
    firstName: string;
    lastName: string;
}>
```

## Select with aggregate functions and group by

See [Aggregate functions, group by and having](aggregate-and-group-by.md).

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

The result of several selects can be combined with `union`, `intersect` and `except`: see [Compound select](compound-select.md).

## CTE (with clause) and subqueries

A select can be used inside another one, as a value, in a condition or as a view with a Common Table Expression (the SQL `with` clause): see [CTE (with clause) & subqueries](cte-subqueries.md).

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
    where company_id = ?1
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

## Select without a table

`selectFromNoTable()` starts a select that has no `from`: its columns are values that don't come from a table, like the result of subqueries, functions or constants. For example, two counts in a single query:

```ts
const counts = await connection.selectFromNoTable()
    .select({
        customers: connection.selectFrom(tCustomer).selectCountAll().forUseAsInlineQueryValue(),
        companies: connection.selectFrom(tCompany).selectCountAll().forUseAsInlineQueryValue()
    })
    .executeSelectOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        (select count(*) as result from customer) as customers, 
        (select count(*) as result from company) as companies
    ```
=== "MySQL"
    ```mysql
    select 
        (select count(*) as result from customer) as customers, 
        (select count(*) as result from company) as companies
    ```
=== "Oracle"
    ```oracle
    select 
        (select count(*) as "result" from customer) as "customers", 
        (select count(*) as "result" from company) as "companies"
    from dual
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        (select count(*) as result from customer) as customers, 
        (select count(*) as result from company) as companies
    ```
=== "SQLite"
    ```sqlite
    select 
        (select count(*) as result from customer) as customers, 
        (select count(*) as result from company) as companies
    ```
=== "SQL Server"
    ```sqlserver
    select 
        (select count(*) as [result] from customer) as customers, 
        (select count(*) as [result] from company) as companies
    ```

The parameters are: `[]`

The result type is:
```tsx
const counts: Promise<{
    customers: number;
    companies: number;
}>
```

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
