---
search:
  boost: 2
---
# Aggregate functions, group by and having

This page describes how to compute aggregated values in a select: the aggregate functions, how to group the rows with `groupBy`, and how to filter the groups with `having`. To return an aggregated array of values or objects, see [Aggregate as an array of objects](aggregate-as-object-array.md).

## Aggregate functions

The aggregate functions are available on the connection:

| Function                          | SQL                                    | Notes                                                                 |
|:----------------------------------|:---------------------------------------|:----------------------------------------------------------------------|
| `countAll()`                      | `count(*)`                             |                                                                       |
| `count(value)`                    | `count(value)`                         |                                                                       |
| `countDistinct(value)`            | `count(distinct value)`                |                                                                       |
| `sum(value)` / `sumDistinct(value)` | `sum(value)` / `sum(distinct value)` | optional: an empty set aggregates to `null`                           |
| `average(value)` / `averageDistinct(value)` | `avg(value)` / `avg(distinct value)` | optional                                                    |
| `max(value)` / `min(value)`       | `max(value)` / `min(value)`            | optional                                                              |
| `stringConcat(value, separator?)` / `stringConcatDistinct(value, separator?)` | `group_concat` / `string_agg` / `listagg` | optional |
| `anyValue(value)`                 | `any_value(value)`                     | optional; not available on MariaDB and SQL Server (see [Any value of the group](#any-value-of-the-group)) |
| `aggregateAsArray(...)` and its variants | | see [Aggregate as an array of objects](aggregate-as-object-array.md) |

See the [Connection API](../api/connection.md) for their signatures.

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

## Grouping by the columns of the select

Every column of the select that is not an aggregate must be grouped. Once the select is written, `groupBy` also accepts the names of its columns (`groupBy('companyId', 'companyName')`): the group by refers to that column of the select instead of writing its expression with new parameters, which the database wouldn't take as the same expression. It repeats the SQL of the select with the same parameters, except on MySQL and MariaDB, whose parameters can't be repeated: there a column that carries a parameter is referred to by its position in the select (`group by 2`). The alias is never used, because a name in a group by refers to a column of the `from` before the alias.

## Grouping by every non-aggregated column

Instead of listing them, once the select is written you can call `groupByNonAggregatedColumns()`: it groups by every column of the select that is not an aggregate and refers to a table or view (a constant is left out, it doesn't need to be grouped). Each one is referred to as a column of the select, like `groupBy('<column name>')` does.

```ts
const customerCountPerCompany = connection.selectFrom(tCompany)
    .innerJoin(tCustomer).on(tCustomer.companyId.equals(tCompany.id))
    .select({
        companyId: tCompany.id,
        companyName: tCompany.name,
        customerCount: connection.count(tCustomer.id)
    })
    .groupByNonAggregatedColumns()
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

## Filtering the groups with having

The `having` clause filters the groups. Its condition can use the aggregate functions, which are not allowed in a `where`.

```ts
const companiesWithSeveralCustomers = connection.selectFrom(tCompany)
    .innerJoin(tCustomer).on(tCustomer.companyId.equals(tCompany.id))
    .groupBy(tCompany.id, tCompany.name)
    .having(connection.count(tCustomer.id).greaterThan(1))
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
    having count(customer.id) > ?
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
    having count(customer.id) > ?
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
    having count(customer.id) > :0
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
    having count(customer.id) > $1
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
    having count(customer.id) > ?1
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
    having count(customer.id) > @0
    ```

The parameters are: `[ 1 ]`

The result type is:
```tsx
const companiesWithSeveralCustomers: Promise<{
    companyId: number;
    companyName: string;
    customerCount: number;
}[]>
```

## Filtering the groups by the columns of the select

Once the select is written, `having` also accepts a function that receives the columns of the select (with the same shape, nested objects included). Each column is written as the same expression the select list computes, with the same parameters, so a grouped expression that carries a parameter can be filtered too; MySQL and MariaDB only accept a column of the select in a `having` through its alias, so it is written that way there.

```ts
const companiesWithSeveralCustomers = connection.selectFrom(tCompany)
    .innerJoin(tCustomer).on(tCustomer.companyId.equals(tCompany.id))
    .select({
        companyId: tCompany.id,
        companyName: tCompany.name,
        customerCount: connection.count(tCustomer.id)
    })
    .groupByNonAggregatedColumns()
    .having(columns => columns.customerCount.greaterThan(1))
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
    having customerCount > ?
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
    having customerCount > ?
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
    having count(customer.id) > :0
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
    having count(customer.id) > $1
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
    having count(customer.id) > ?1
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
    having count(customer.id) > @0
    ```

The parameters are: `[ 1 ]`

The result type is:
```tsx
const companiesWithSeveralCustomers: Promise<{
    companyId: number;
    companyName: string;
    customerCount: number;
}[]>
```

!!! warning "MySQL and MariaDB: an alias named like a grouped column"

    On MySQL and MariaDB a name in a `having` refers to a column of the `group by` before the alias of a column of the select. If a column of the select whose alias is the name of another column grouped as it is (`{ priority: tIssue.priority.modulo(2), raw: tIssue.priority }` grouped by both) is used in `having(columns => …)`, MySQL filters by the grouped column instead, and MariaDB reports the name as ambiguous. Give that column of the select another alias.

## Any value of the group

`anyValue(value)` is the SQL:2023 `any_value` aggregate function: any value of the group, for a column that is not grouped. It's useful when every row of the group has the same value but the column isn't part of the group by, like the name of the company the customers of a group belong to.

```ts
const customerCountPerCompany = connection.selectFrom(tCustomer)
    .innerJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
    .select({
        companyId: tCustomer.companyId,
        companyName: connection.anyValue(tCompany.name),
        customerCount: connection.count(tCustomer.id)
    })
    .groupBy('companyId')
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    -- MariaDB has no any_value aggregate function
    ```
=== "MySQL"
    ```mysql
    select 
        customer.company_id as companyId, 
        any_value(company.`name`) as companyName, 
        count(customer.id) as customerCount 
    from customer 
    inner join company on company.id = customer.company_id 
    group by customer.company_id
    ```
=== "Oracle"
    ```oracle
    select 
        customer.company_id as "companyId", 
        any_value(company.name) as "companyName", 
        count(customer.id) as "customerCount" 
    from customer 
    inner join company on company.id = customer.company_id 
    group by customer.company_id
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.company_id as "companyId", 
        any_value(company.name) as "companyName", 
        count(customer.id) as "customerCount" 
    from customer 
    inner join company on company.id = customer.company_id 
    group by customer.company_id
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.company_id as companyId, 
        company.name as companyName, 
        count(customer.id) as customerCount 
    from customer 
    inner join company on company.id = customer.company_id 
    group by customer.company_id
    ```
=== "SQL Server"
    ```sqlserver
    -- SQL Server has no any_value aggregate function
    ```

The parameters are: `[]`

The result type is:
```tsx
const customerCountPerCompany: Promise<{
    companyId: number;
    companyName?: string;
    customerCount: number;
}[]>
```

!!! note "Support"

    `anyValue` is written `any_value(...)` on PostgreSQL, MySQL and Oracle. SQLite has no such function, but a column outside an aggregate in a grouped query (a bare column) takes the value of one of the rows of the group, so the value is written as it is. MariaDB and SQL Server have no such function and `anyValue` is not offered on their connections.
