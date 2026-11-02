---
search:
  boost: 2
---
# Aggregate functions, group by and having

This page describes how to compute aggregated values in a select: the aggregate functions, how to group the rows with `groupBy`, and how to filter the groups with `having`. To return an aggregated array of values or objects, see [Aggregate as an array of objects](aggregate-as-object-array.md).

The first sections show the recommended way: write the select first and refer to its columns in the group by and the having. The library then writes each column with the same SQL the select list computes, which the database always takes as the same expression. The ways of writing the group by and the having before the select, with the expressions written again, are at the end ([Grouping and filtering before the select](#grouping-and-filtering-before-the-select)).

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

## Grouping by every non-aggregated column

Every column of the select that is not an aggregate must be grouped. If the select has an aggregate and a column that refers to a table or view is neither aggregated nor grouped, because there is no group by at all, the query doesn't compile: executing it or using it as a subquery reports *The select has an aggregate and other columns that are not aggregated: group them with groupByNonAggregatedColumns() or groupBy(...)*. (A group by that leaves some column out is not detected; the database reports it, or, when it allows it, like PostgreSQL grouping by a primary key, accepts it.)

The recommended way is to write the select first and call `groupByNonAggregatedColumns()`: it groups by every column of the select that is not an aggregate and refers to a table or view, so the group by always matches the select. A constant is left out, because it doesn't need to be grouped (in the example, `kind`). Each grouped column is referred to as a column of the select, written with the same SQL and parameters the select list uses (see [Grouping by the columns of the select](#grouping-by-the-columns-of-the-select)).

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

## Grouping by the columns of the select

To choose the columns to group by yourself, once the select is written `groupBy` accepts the names of its columns, and the group by refers to that column of the select:

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

### A column of the select that isn't in the group by

!!! danger "SQLite and MariaDB return the value of any row of the group"

    A column of the select that isn't in the group by, and isn't an aggregate function, has no single value in each group. Put it in the group by with [`groupByNonAggregatedColumns()`](#grouping-by-every-non-aggregated-column), or choose the value with an [aggregate function](#choosing-the-value-with-an-aggregate-function).

The names given to `groupBy` don't need to include every column of the select. For example, the customers grouped by company, with the first name of the customer left out of the group by:

```ts
const customerCountPerCompany = connection.selectFrom(tCustomer)
    .select({
        companyId: tCustomer.companyId,
        firstName: tCustomer.firstName,
        customerCount: connection.count(tCustomer.id)
    })
    .groupBy('companyId')
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company_id as companyId, 
        first_name as firstName, 
        count(id) as customerCount 
    from customer 
    group by company_id
    ```
=== "MySQL"
    ```mysql
    select 
        company_id as companyId, 
        first_name as firstName, 
        count(id) as customerCount 
    from customer 
    group by company_id
    ```
=== "Oracle"
    ```oracle
    select 
        company_id as "companyId", 
        first_name as "firstName", 
        count(id) as "customerCount" 
    from customer 
    group by company_id
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company_id as "companyId", 
        first_name as "firstName", 
        count(id) as "customerCount" 
    from customer 
    group by company_id
    ```
=== "SQLite"
    ```sqlite
    select 
        company_id as companyId, 
        first_name as firstName, 
        count(id) as customerCount 
    from customer 
    group by company_id
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company_id as companyId, 
        first_name as firstName, 
        count(id) as customerCount 
    from customer 
    group by company_id
    ```

The parameters are: `[]`

!!! failure "Rejected by PostgreSQL, SQL Server, Oracle and MySQL; any value on SQLite and MariaDB"

    A company has several customers, so the first name has several values in each group. Most databases reject the query:

    - PostgreSQL: *column "customer.first_name" must appear in the GROUP BY clause or be used in an aggregate function*.
    - SQL Server: *Column 'customer.first_name' is invalid in the select list because it is not contained in either an aggregate function or the GROUP BY clause*.
    - Oracle: *ORA-00979: must appear in the GROUP BY clause or be used in an aggregate function*.
    - MySQL: *Expression #2 of SELECT list is not in GROUP BY clause and contains nonaggregated column '…customer.first_name' which is not functionally dependent on columns in GROUP BY clause; this is incompatible with sql_mode=only_full_group_by*.

    SQLite and MariaDB accept it without any error, and each row gets the first name of one of the customers of the company, which one isn't defined. The same happens when that column is used in the `order by`, or in [`having(columns => …)`](#filtering-the-groups-by-the-columns-of-the-select).

    A column that has a single value in each group is fine: PostgreSQL and MySQL accept it when the group by has the primary key of its table (like the name of the company when the query is grouped by the id of the company), and [`groupByNonAggregatedColumns()`](#grouping-by-every-non-aggregated-column) puts it in the group by for every database.

#### Choosing the value with an aggregate function

When the column must stay out of the group by, an aggregate function chooses its value in each group. For example, the first name that comes first alphabetically:

```ts
const customerCountPerCompany = connection.selectFrom(tCustomer)
    .select({
        companyId: tCustomer.companyId,
        firstName: connection.min(tCustomer.firstName),
        customerCount: connection.count(tCustomer.id)
    })
    .groupBy('companyId')
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company_id as companyId, 
        min(first_name) as firstName, 
        count(id) as customerCount 
    from customer 
    group by company_id
    ```
=== "MySQL"
    ```mysql
    select 
        company_id as companyId, 
        min(first_name) as firstName, 
        count(id) as customerCount 
    from customer 
    group by company_id
    ```
=== "Oracle"
    ```oracle
    select 
        company_id as "companyId", 
        min(first_name) as "firstName", 
        count(id) as "customerCount" 
    from customer 
    group by company_id
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company_id as "companyId", 
        min(first_name) as "firstName", 
        count(id) as "customerCount" 
    from customer 
    group by company_id
    ```
=== "SQLite"
    ```sqlite
    select 
        company_id as companyId, 
        min(first_name) as firstName, 
        count(id) as customerCount 
    from customer 
    group by company_id
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company_id as companyId, 
        min(first_name) as firstName, 
        count(id) as customerCount 
    from customer 
    group by company_id
    ```

The parameters are: `[]`

When any value of the group will do, [`anyValue(...)`](#any-value-of-the-group) says so explicitly.

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

## Grouping and filtering before the select

`groupBy` and `having` can also be written before the `select`, in the logical order of the query. There they receive the expressions to group by and the condition, written again, and the ways that read the columns of the select are not available: [`groupByNonAggregatedColumns()`](#grouping-by-every-non-aggregated-column), the names of its columns in [`groupBy`](#grouping-by-the-columns-of-the-select) and [`having(columns => …)`](#filtering-the-groups-by-the-columns-of-the-select) are only offered after the select.

!!! danger "The database can reject these queries"

    Written before the select, the group by and the having can make the database reject the query: when [an expression that carries a parameter is written again](#an-expression-that-carries-a-parameter-written-again), or when the having uses [a column that isn't in the group by](#a-column-that-isnt-in-the-group-by-in-the-having). Write the select first and refer to its columns instead: [`groupByNonAggregatedColumns()`](#grouping-by-every-non-aggregated-column), [`groupBy('<column name>')`](#grouping-by-the-columns-of-the-select) and [`having(columns => …)`](#filtering-the-groups-by-the-columns-of-the-select).

### Group by with the expressions

!!! danger "An expression that carries a parameter"

    The database rejects the query when an expression that carries a parameter is written again in the group by: see [An expression that carries a parameter, written again](#an-expression-that-carries-a-parameter-written-again). Write the select first and use [`groupBy('<column name>')`](#grouping-by-the-columns-of-the-select) or [`groupByNonAggregatedColumns()`](#grouping-by-every-non-aggregated-column).

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

### Filtering the groups with having

!!! danger "Conditions the database can reject"

    The database rejects the query when the condition uses [a column that isn't in the group by](#a-column-that-isnt-in-the-group-by-in-the-having) or [an expression that carries a parameter written again](#an-expression-that-carries-a-parameter-written-again). Write the select first and use [`having(columns => …)`](#filtering-the-groups-by-the-columns-of-the-select) with [`groupByNonAggregatedColumns()`](#grouping-by-every-non-aggregated-column).

The `having` clause filters the groups; written before the select, it receives the condition. The condition can use the aggregate functions, which are not allowed in a `where`.

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

### A column that isn't in the group by, in the having

!!! danger "MySQL, MariaDB, SQL Server and Oracle reject the query"

    A column used in the having outside an aggregate function must be in the group by on these databases, even when it has a single value in each group. Write the select first and use [`groupByNonAggregatedColumns()`](#writing-the-select-first), or move the condition to [the `where`](#moving-the-condition-to-the-where).

The having of the previous example only uses an aggregate function. A condition of the `having` can also use a column of a table without an aggregate function. For example, the companies with several customers, keeping only the companies that belong to another company:

```ts
const subsidiariesWithSeveralCustomers = connection.selectFrom(tCompany)
    .innerJoin(tCustomer).on(tCustomer.companyId.equals(tCompany.id))
    .groupBy(tCompany.id)
    .having(connection.count(tCustomer.id).greaterThan(1).and(tCompany.parentId.isNotNull()))
    .select({
        companyId: tCompany.id,
        customerCount: connection.count(tCustomer.id)
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company.id as companyId, 
        count(customer.id) as customerCount 
    from company 
    inner join customer on customer.company_id = company.id 
    group by company.id 
    having count(customer.id) > ? and company.parent_id is not null
    ```
=== "MySQL"
    ```mysql
    select 
        company.id as companyId, 
        count(customer.id) as customerCount 
    from company 
    inner join customer on customer.company_id = company.id 
    group by company.id 
    having count(customer.id) > ? and company.parent_id is not null
    ```
=== "Oracle"
    ```oracle
    select 
        company.id as "companyId", 
        count(customer.id) as "customerCount" 
    from company 
    inner join customer on customer.company_id = company.id 
    group by company.id 
    having count(customer.id) > :0 and company.parent_id is not null
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as "companyId", 
        count(customer.id) as "customerCount" 
    from company 
    inner join customer on customer.company_id = company.id 
    group by company.id 
    having count(customer.id) > $1 and company.parent_id is not null
    ```
=== "SQLite"
    ```sqlite
    select 
        company.id as companyId, 
        count(customer.id) as customerCount 
    from company 
    inner join customer on customer.company_id = company.id 
    group by company.id 
    having count(customer.id) > ?1 and company.parent_id is not null
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company.id as companyId, 
        count(customer.id) as customerCount 
    from company 
    inner join customer on customer.company_id = company.id 
    group by company.id 
    having count(customer.id) > @0 and company.parent_id is not null
    ```

The parameters are: `[ 1 ]`

!!! failure "Rejected by MySQL, MariaDB, SQL Server and Oracle"

    Each group is one company, so the parent of the company has a single value in each group. PostgreSQL accepts the query, because the group by has the primary key of the company, and so does SQLite, which takes the value of one of the rows of the group. The other databases reject it:

    - MySQL and MariaDB: *Unknown column 'company.parent_id' in HAVING*.
    - SQL Server: *Column 'company.parent_id' is invalid in the HAVING clause because it is not contained in either an aggregate function or the GROUP BY clause*.
    - Oracle: *ORA-00979: must appear in the GROUP BY clause or be used in an aggregate function*.

#### Writing the select first

The recommended way is to write the select first, with the column in it, and to build the group by with [`groupByNonAggregatedColumns()`](#grouping-by-every-non-aggregated-column): every column of the select that isn't an aggregate goes into the group by, so [`having(columns => …)`](#filtering-the-groups-by-the-columns-of-the-select) can use it on every database:

```ts
const subsidiariesWithSeveralCustomers = connection.selectFrom(tCompany)
    .innerJoin(tCustomer).on(tCustomer.companyId.equals(tCompany.id))
    .select({
        companyId: tCompany.id,
        parentId: tCompany.parentId,
        customerCount: connection.count(tCustomer.id)
    })
    .groupByNonAggregatedColumns()
    .having(columns => columns.customerCount.greaterThan(1).and(columns.parentId.isNotNull()))
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company.id as companyId, 
        company.parent_id as parentId, 
        count(customer.id) as customerCount 
    from company 
    inner join customer on customer.company_id = company.id 
    group by 
        company.id, 
        company.parent_id 
    having customerCount > ? and parentId is not null
    ```
=== "MySQL"
    ```mysql
    select 
        company.id as companyId, 
        company.parent_id as parentId, 
        count(customer.id) as customerCount 
    from company 
    inner join customer on customer.company_id = company.id 
    group by 
        company.id, 
        company.parent_id 
    having customerCount > ? and parentId is not null
    ```
=== "Oracle"
    ```oracle
    select 
        company.id as "companyId", 
        company.parent_id as "parentId", 
        count(customer.id) as "customerCount" 
    from company 
    inner join customer on customer.company_id = company.id 
    group by 
        company.id, 
        company.parent_id 
    having count(customer.id) > :0 and company.parent_id is not null
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as "companyId", 
        company.parent_id as "parentId", 
        count(customer.id) as "customerCount" 
    from company 
    inner join customer on customer.company_id = company.id 
    group by 
        company.id, 
        company.parent_id 
    having count(customer.id) > $1 and company.parent_id is not null
    ```
=== "SQLite"
    ```sqlite
    select 
        company.id as companyId, 
        company.parent_id as parentId, 
        count(customer.id) as customerCount 
    from company 
    inner join customer on customer.company_id = company.id 
    group by 
        company.id, 
        company.parent_id 
    having count(customer.id) > ?1 and company.parent_id is not null
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company.id as companyId, 
        company.parent_id as parentId, 
        count(customer.id) as customerCount 
    from company 
    inner join customer on customer.company_id = company.id 
    group by 
        company.id, 
        company.parent_id 
    having count(customer.id) > @0 and company.parent_id is not null
    ```

The parameters are: `[ 1 ]`

#### Moving the condition to the where

A condition that uses no aggregate function is about each row, not about the group, so it can be written in the `where`: the rows are filtered before they are grouped, and the result is the same. Every database accepts it:

```ts
const subsidiariesWithSeveralCustomers = connection.selectFrom(tCompany)
    .innerJoin(tCustomer).on(tCustomer.companyId.equals(tCompany.id))
    .where(tCompany.parentId.isNotNull())
    .groupBy(tCompany.id)
    .having(connection.count(tCustomer.id).greaterThan(1))
    .select({
        companyId: tCompany.id,
        customerCount: connection.count(tCustomer.id)
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company.id as companyId, 
        count(customer.id) as customerCount 
    from company 
    inner join customer on customer.company_id = company.id 
    where company.parent_id is not null 
    group by company.id 
    having count(customer.id) > ?
    ```
=== "MySQL"
    ```mysql
    select 
        company.id as companyId, 
        count(customer.id) as customerCount 
    from company 
    inner join customer on customer.company_id = company.id 
    where company.parent_id is not null 
    group by company.id 
    having count(customer.id) > ?
    ```
=== "Oracle"
    ```oracle
    select 
        company.id as "companyId", 
        count(customer.id) as "customerCount" 
    from company 
    inner join customer on customer.company_id = company.id 
    where company.parent_id is not null 
    group by company.id 
    having count(customer.id) > :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as "companyId", 
        count(customer.id) as "customerCount" 
    from company 
    inner join customer on customer.company_id = company.id 
    where company.parent_id is not null 
    group by company.id 
    having count(customer.id) > $1
    ```
=== "SQLite"
    ```sqlite
    select 
        company.id as companyId, 
        count(customer.id) as customerCount 
    from company 
    inner join customer on customer.company_id = company.id 
    where company.parent_id is not null 
    group by company.id 
    having count(customer.id) > ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company.id as companyId, 
        count(customer.id) as customerCount 
    from company 
    inner join customer on customer.company_id = company.id 
    where company.parent_id is not null 
    group by company.id 
    having count(customer.id) > @0
    ```

The parameters are: `[ 1 ]`

#### Adding the column to the group by

When the condition can't be moved to the `where`, because it combines the column with an aggregate function using `or`, add the column to the group by. The column has a single value in each group, so the groups don't change. For example, the companies with several customers, and every company that doesn't belong to another one, whatever its number of customers:

```ts
const companiesToReview = connection.selectFrom(tCompany)
    .innerJoin(tCustomer).on(tCustomer.companyId.equals(tCompany.id))
    .groupBy(tCompany.id, tCompany.parentId)
    .having(connection.count(tCustomer.id).greaterThan(1).or(tCompany.parentId.isNull()))
    .select({
        companyId: tCompany.id,
        customerCount: connection.count(tCustomer.id)
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company.id as companyId, 
        count(customer.id) as customerCount 
    from company 
    inner join customer on customer.company_id = company.id 
    group by company.id, company.parent_id 
    having count(customer.id) > ? or company.parent_id is null
    ```
=== "MySQL"
    ```mysql
    select 
        company.id as companyId, 
        count(customer.id) as customerCount 
    from company 
    inner join customer on customer.company_id = company.id 
    group by company.id, company.parent_id 
    having count(customer.id) > ? or company.parent_id is null
    ```
=== "Oracle"
    ```oracle
    select 
        company.id as "companyId", 
        count(customer.id) as "customerCount" 
    from company 
    inner join customer on customer.company_id = company.id 
    group by company.id, company.parent_id 
    having count(customer.id) > :0 or company.parent_id is null
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as "companyId", 
        count(customer.id) as "customerCount" 
    from company 
    inner join customer on customer.company_id = company.id 
    group by company.id, company.parent_id 
    having count(customer.id) > $1 or company.parent_id is null
    ```
=== "SQLite"
    ```sqlite
    select 
        company.id as companyId, 
        count(customer.id) as customerCount 
    from company 
    inner join customer on customer.company_id = company.id 
    group by company.id, company.parent_id 
    having count(customer.id) > ?1 or company.parent_id is null
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company.id as companyId, 
        count(customer.id) as customerCount 
    from company 
    inner join customer on customer.company_id = company.id 
    group by company.id, company.parent_id 
    having count(customer.id) > @0 or company.parent_id is null
    ```

The parameters are: `[ 1 ]`

### An expression that carries a parameter, written again

!!! danger "The database rejects the query"

    Write the select first and use [`groupBy('<column name>')`](#grouping-by-the-columns-of-the-select), [`groupByNonAggregatedColumns()`](#grouping-by-every-non-aggregated-column) or [`having(columns => …)`](#filtering-the-groups-by-the-columns-of-the-select), which repeat the SQL of the select with the same parameters.

Each time an expression that carries a parameter is written, it gets new parameters. For example, the number of customers per initial of the last name, grouped by the expression written again:

```ts
const customerCountPerInitial = connection.selectFrom(tCustomer)
    .groupBy(tCustomer.lastName.substr(0, 1))
    .select({
        initial: tCustomer.lastName.substr(0, 1),
        customerCount: connection.count(tCustomer.id)
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        substr(last_name, ?, ?) as initial, 
        count(id) as customerCount 
    from customer 
    group by substr(last_name, ?, ?)
    ```
=== "MySQL"
    ```mysql
    select 
        substr(last_name, ?, ?) as initial, 
        count(id) as customerCount 
    from customer 
    group by substr(last_name, ?, ?)
    ```
=== "Oracle"
    ```oracle
    select 
        substr(last_name, :0, :1) as "initial", 
        count(id) as "customerCount" 
    from customer 
    group by substr(last_name, :2, :3)
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        substr(last_name, $1, $2) as initial, 
        count(id) as "customerCount" 
    from customer 
    group by substr(last_name, $3, $4)
    ```
=== "SQLite"
    ```sqlite
    select 
        substr(last_name, ?1, ?2) as initial, 
        count(id) as customerCount 
    from customer 
    group by substr(last_name, ?3, ?4)
    ```
=== "SQL Server"
    ```sqlserver
    select 
        substring(last_name, @0, @1) as initial, 
        count(id) as customerCount 
    from customer 
    group by substring(last_name, @2, @3)
    ```

The parameters are: `[ 1, 1, 1, 1 ]`

!!! failure "Rejected by PostgreSQL, SQL Server and Oracle, and by MySQL in a prepared statement"

    The group by gets new parameters (`$3` and `$4` on PostgreSQL) while the select has `$1` and `$2`, so the database doesn't take them as the same expression:

    - PostgreSQL: *column must appear in the GROUP BY clause or be used in an aggregate function*.
    - SQL Server: *is invalid in the select list because it is not contained in either an aggregate function or the GROUP BY clause*.
    - Oracle: *ORA-00979*.
    - MySQL, when the query runs as a prepared statement, like with Bun SQL: *isn't in GROUP BY*.

    The same happens with such an expression in a `having`, where MySQL and MariaDB also reject it (*unknown column in HAVING*). Plain columns and aggregates, which carry no parameter, are not affected.
