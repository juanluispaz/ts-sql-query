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

## Before or after the select

`groupBy` can be written before the `select` (in the logical order of the query, like the example above) or after it, and what it offers depends on that:

- **Before the select**, `groupBy` receives the expressions to group by (`groupBy(tCompany.id, tCompany.name)`).
- **After the select**, it also accepts the names of the columns of the select (see [Grouping by the columns of the select](#grouping-by-the-columns-of-the-select)), and two more ways become available because they read the columns of the select: [`groupByNonAggregatedColumns()`](#grouping-by-every-non-aggregated-column) and [`having(columns => …)`](#filtering-the-groups-by-the-columns-of-the-select).

## Grouping by the columns of the select

Once the select is written, `groupBy` accepts the names of its columns. The group by refers to that column of the select:

```ts
const customerCountPerCompany = connection.selectFrom(tCompany)
    .innerJoin(tCustomer).on(tCustomer.companyId.equals(tCompany.id))
    .select({
        companyId: tCompany.id,
        companyName: tCompany.name,
        customerCount: connection.count(tCustomer.id)
    })
    .groupBy('companyId', 'companyName')
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

### A column of the select that carries a parameter

When the column of the select is an expression with a parameter, writing the expression again in the group by would give it new parameters, and the database wouldn't take it as the same expression. Instead, the group by repeats the SQL of the select with the same parameters; MySQL and MariaDB can't repeat a parameter (each `?` is a new one), so there the column is referred to by its position in the select. The alias of the column is never used, because a name in a group by refers to a column of the `from` before the alias.

```ts
const customerCountPerInitial = connection.selectFrom(tCustomer)
    .select({
        initial: tCustomer.lastName.substr(0, 1),
        customerCount: connection.count(tCustomer.id)
    })
    .groupBy('initial')
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        substr(last_name, ?, ?) as initial, 
        count(id) as customerCount 
    from customer 
    group by 1
    ```
=== "MySQL"
    ```mysql
    select 
        substr(last_name, ?, ?) as initial, 
        count(id) as customerCount 
    from customer 
    group by 1
    ```
=== "Oracle"
    ```oracle
    select 
        substr(last_name, :0, :1) as "initial", 
        count(id) as "customerCount" 
    from customer 
    group by substr(last_name, :0, :1)
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        substr(last_name, $1, $2) as initial, 
        count(id) as "customerCount" 
    from customer 
    group by substr(last_name, $1, $2)
    ```
=== "SQLite"
    ```sqlite
    select 
        substr(last_name, ?1, ?2) as initial, 
        count(id) as customerCount 
    from customer 
    group by substr(last_name, ?1, ?2)
    ```
=== "SQL Server"
    ```sqlserver
    select 
        substring(last_name, @0, @1) as initial, 
        count(id) as customerCount 
    from customer 
    group by substring(last_name, @0, @1)
    ```

The parameters are: `[ 1, 1 ]`

The result type is:
```tsx
const customerCountPerInitial: Promise<{
    initial: string;
    customerCount: number;
}[]>
```

## Grouping by every non-aggregated column

Instead of listing the columns to group by, once the select is written you can call `groupByNonAggregatedColumns()`: it groups by every column of the select that is not an aggregate and refers to a table or view. A constant is left out, because it doesn't need to be grouped (in the example, `kind`). Each grouped column is referred to as a column of the select, like [`groupBy('<column name>')`](#grouping-by-the-columns-of-the-select) does.

```ts
const customerCountPerCompany = connection.selectFrom(tCompany)
    .innerJoin(tCustomer).on(tCustomer.companyId.equals(tCompany.id))
    .select({
        companyId: tCompany.id,
        companyName: tCompany.name,
        kind: connection.const('company', 'string'),
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
        ? as kind, 
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
        ? as kind, 
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
        :0 as "kind", 
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
        $1::text as kind, 
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
        ?1 as kind, 
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
        @0 as kind, 
        count(customer.id) as customerCount 
    from company 
    inner join customer on customer.company_id = company.id 
    group by 
        company.id, 
        company.name
    ```

The parameters are: `[ 'company' ]`

The result type is:
```tsx
const customerCountPerCompany: Promise<{
    companyId: number;
    companyName: string;
    kind: string;
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
