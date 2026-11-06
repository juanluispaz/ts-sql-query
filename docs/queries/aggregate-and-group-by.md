---
search:
  boost: 2
---
# Aggregate functions, group by and having

An aggregate function turns many rows into one value: how many there are, their sum, their average, the lowest or the highest. A `group by` splits the rows into groups that have the same values, and gives one row of the result for each group, with the aggregates computed over the rows of that group. They answer questions like "how many customers does each company have", "which companies have more than five customers", or "what is the age of the oldest customer of each company".

To return an array of values or objects for each group, instead of a single value, see [Aggregate as an array of objects](aggregate-as-object-array.md).

## What an aggregate and a group by do

The examples of this section and the next ones use these rows of `customer`:

| `firstName` | `companyId` | `age` |
|---|---|---|
| Ann | 1 | 30 |
| Bob | 1 | 40 |
| Carl | 1 | 40 |
| Dana | 2 | 20 |
| Eve | 2 | null |
| Frank | 3 | null |

This query makes one group for each `companyId`, and returns one row for each group:

```ts
const customersPerCompany = await connection.selectFrom(tCustomer)
    .select({
        companyId: tCustomer.companyId,
        customers: connection.countAll(),
        totalAge: connection.sum(tCustomer.age)
    })
    .groupBy('companyId')
    .orderBy('companyId')
    .executeSelectMany();
```

The result is:

| `companyId` | `customers` | `totalAge` |
|---|---|---|
| 1 | 3 | 110 |
| 2 | 2 | 20 |
| 3 | 1 | no value |

The result type is:
```tsx
const customersPerCompany: {
    companyId: number;
    customers: number;
    totalAge?: number;
}[]
```

The sum of company 2 ignores the null of Eve. Company 3 has no ages to add, so its sum has no value, and that's why `totalAge` is optional in the type. See [Nulls and groups with no values](#nulls-and-groups-with-no-values).

## Where and having: before and after the grouping

Both of them filter, at a different moment: `where` keeps **rows** before they are grouped, and `having` keeps **groups** after the aggregates are computed. So a condition with an aggregate can only be in the `having`; in a `where` it doesn't compile.

The database applies the clauses in this order, whatever the order in which you write them:

| Step | Clause | What it does here |
|---|---|---|
| 1 | `from` and joins | Gets the rows. |
| 2 | `where` | Removes rows. The aggregates don't see them. |
| 3 | `group by` | Makes the groups, and the aggregates are computed. |
| 4 | `having` | Removes groups. |
| 5 | `select` | Gives the values of each row of the result. |
| 6 | `order by` | Orders the rows of the result. |
| 7 | `limit`, `offset` | Takes a part of the rows of the result. |

The rest of the clauses are in [What each clause is for](basic-query-structure.md#what-each-clause-is-for).

This query uses both, with the rows above:

```ts
const companiesWithSeveralAges = await connection.selectFrom(tCustomer)
    .where(tCustomer.age.isNotNull())
    .select({
        companyId: tCustomer.companyId,
        customers: connection.countAll()
    })
    .groupBy('companyId')
    .having(columns => columns.customers.greaterOrEqual(2))
    .orderBy('companyId')
    .executeSelectMany();
```

The number of customers per company changes with each filter:

| Filter | `companyId`: `customers` |
|---|---|
| None | 1: 3, 2: 2, 3: 1 |
| `.where(tCustomer.age.isNotNull())` | 1: 3, 2: 1 |
| `.having(columns => columns.customers.greaterOrEqual(2))` | 1: 3, 2: 2 |
| Both | 1: 3 |

With the `where`, Eve and Frank are removed before counting, so company 2 has only one customer and company 3 has no group at all. With both, the `having` sees the count after the `where`, and company 2 no longer reaches 2.

Use the `where` for a condition on the rows, and the `having` for a condition on the aggregates. A condition on a column of the group by gives the same result in both places, but in the `where` the database has fewer rows to group.

The `having` can be continued with `and` and `or`, like the `where`: `.having(a).and(b)`. To build it step by step, see [`dynamicHaving()`](../dynamic/building-conditions.md#dynamic-join-conditions-and-having).

## Aggregate functions

The aggregate functions are available on the connection. The results in this table are for all the rows above, with no group by, where the values of `age` are `30, 40, 40, 20, null, null`:

| Function | SQL | What it returns | Result | With no rows, or only nulls |
|---|---|---|---|---|
| `connection.countAll()` | `count(*)` | The number of rows, whatever their values | `6` | `0` with no rows; nulls are counted |
| `connection.count(tCustomer.age)` | `count(age)` | The number of rows where the value isn't null | `4` | `0` |
| `connection.countDistinct(tCustomer.age)` | `count(distinct age)` | The number of different values, without null | `3` | `0` |
| `connection.sum(tCustomer.age)` | `sum(age)` | The sum of the values | `130` | No value |
| `connection.sumDistinct(tCustomer.age)` | `sum(distinct age)` | The sum of the different values | `90` | No value |
| `connection.average(tCustomer.age)` | `avg(...)` | The average of the values: the nulls don't count as values, or as zeros | `32.5` | No value |
| `connection.averageDistinct(tCustomer.age)` | `avg(distinct ...)` | The average of the different values | `30` | No value |
| `connection.min(tCustomer.age)` | `min(age)` | The lowest value | `20` | No value |
| `connection.max(tCustomer.age)` | `max(age)` | The highest value | `40` | No value |
| `connection.stringConcat(tCustomer.firstName, ', ')` | See [each database](#how-each-function-is-written-in-each-database) | The values joined in a text, with the separator | `'Ann, Bob, Carl, Dana, Eve, Frank'`, in any order | No value |
| `connection.stringConcatDistinct(tCustomer.firstName)` | See [each database](#how-each-function-is-written-in-each-database) | The different values joined in a text | `'Ann,Bob,Carl,Dana,Eve,Frank'`, in any order | No value |
| `connection.anyValue(tCustomer.firstName)` | See [each database](#how-each-function-is-written-in-each-database) | [Any value of the group](#any-value-of-the-group) | One of the first names | No value with no rows |
| `connection.aggregateAsArray(...)` and its variants | | An array for each group | See [Aggregate as an array of objects](aggregate-as-object-array.md) | |

The result type depends on the function:

| Function | Receives | Result type |
|---|---|---|
| `countAll`, `count`, `countDistinct` | `countAll` nothing, the others any value | `number`, always with a value |
| `sum`, `sumDistinct` | A number, a `bigint` or a custom numeric type | The same type, optional |
| `average`, `averageDistinct` | A number, a `bigint` or a custom numeric type | `number`, optional |
| `min`, `max` | A value that can be compared, like a number, a text or a date | The same type, optional |
| `stringConcat`, `stringConcatDistinct` | A text | `string`, optional |
| `anyValue` | Any value | The same type, optional |

An aggregate is a value like any other, so it can receive an expression, like `connection.sum(tCustomer.age.add(1))`, and it can be part of one, like `connection.sum(tCustomer.age).add(1)`. An aggregate inside another one doesn't compile, except on Oracle.

For an aggregate function the library doesn't offer, use [`aggregateFragmentWithType`](sql-fragments.md#aggregate-fragments).

See the [Connection API](../api/connection.md) for their signatures.

### Nulls and groups with no values

Every function except `countAll` ignores the nulls. So `average` divides by the number of values that aren't null: `130 / 4 = 32.5`, not `130 / 6`.

When there are no values to work with, because there are no rows or they are all null, `count` returns `0`, and the other functions return null. The result type says so: the property is optional, like `totalAge?: number`, and it's absent from the object. With [`projectingOptionalValuesAsNullable()`](complex-projections.md#optional-values-as-null) it's `null` instead.

This holds even when the column is required: a `sum` over a required column has no value when there are no rows, so it's optional as well.

To get a value when there is none, for example a `0`, use `valueWhenNull`. The property is then required:

```ts
const totalAgePerCompany = await connection.selectFrom(tCustomer)
    .select({
        companyId: tCustomer.companyId,
        totalAge: connection.sum(tCustomer.age).valueWhenNull(0)
    })
    .groupBy('companyId')
    .orderBy('companyId')
    .executeSelectMany();
```

With the rows above, company 3 gets `totalAge: 0`.

The difference between `countAll` and `count` matters with a left join. A company with no customers still has one row, with the columns of `customer` in null: `countAll` counts that row, and `count` over a column of `customer` doesn't. For the number of customers per company, including the companies with none, use `count`:

```ts
const tCustomerOfCompany = tCustomer.forUseInLeftJoin();

const customersOfEachCompany = await connection.selectFrom(tCompany)
    .leftJoin(tCustomerOfCompany).on(tCustomerOfCompany.companyId.equals(tCompany.id))
    .select({
        companyId: tCompany.id,
        customers: connection.count(tCustomerOfCompany.id)
    })
    .groupBy('companyId')
    .orderBy('companyId')
    .executeSelectMany();
```

### Concatenating text

`stringConcat` receives the separator as an optional second argument, and `,` is the default one. An empty text, `''`, joins the values with nothing between them.

```ts
const customerNamesPerCompany = await connection.selectFrom(tCustomer)
    .select({
        companyId: tCustomer.companyId,
        firstNames: connection.stringConcat(tCustomer.firstName, ', ')
    })
    .groupBy('companyId')
    .orderBy('companyId')
    .executeSelectMany();
```

With the rows above, company 1 gets `'Ann, Bob, Carl'`, or the same names in another order: the order of the values in the text isn't defined, and there's no argument to choose it. Oracle returns them sorted, because `listagg` requires an order, and the library orders by the value itself.

`stringConcatDistinct` removes the repeated values first:

```ts
const differentLastNames = await connection.selectFrom(tCustomer)
    .selectOneColumn(connection.stringConcatDistinct(tCustomer.lastName))
    .executeSelectOne();
```

The separator of `stringConcatDistinct` isn't available on SQLite, and the function isn't available on SQL Server; there it doesn't compile. On Oracle it needs [Oracle 19c or later](../configuration/supported-databases/oracle.md).

A very long text has a limit on some databases: MySQL and MariaDB cut it, by default at 1024 bytes and with only a warning ([MySQL](../configuration/supported-databases/mysql.md#stringconcat-truncates-long-results), [MariaDB](../configuration/supported-databases/mariadb.md#stringconcat-truncates-long-results)), and Oracle and SQL Server return an error.

### How each function is written in each database

`countAll`, `count`, `countDistinct`, `sum`, `sumDistinct`, `min` and `max` are written in the same way on all of them, as in [the table above](#aggregate-functions). The rest are different:

=== "MariaDB"
    | Function | SQL |
    |---|---|
    | `average(value)` with whole numbers | `avg(cast(value as double))`; before MariaDB 10.4, `avg((value * 1.0e0))` |
    | `averageDistinct(value)` with whole numbers | `avg(distinct cast(value as double))`; before MariaDB 10.4, `avg(distinct (value * 1.0e0))` |
    | `average(value)`, `averageDistinct(value)` with a `double` | `avg(value)`, `avg(distinct value)` |
    | `stringConcat(value)` | `group_concat(value)` |
    | `stringConcat(value, ', ')` | `group_concat(value separator ', ')` |
    | `stringConcat(value, '')` | `group_concat(value separator '')` |
    | `stringConcatDistinct(value)` | `group_concat(distinct value)` |
    | `stringConcatDistinct(value, ', ')` | `group_concat(distinct value separator ', ')` |
    | `stringConcatDistinct(value, '')` | `group_concat(distinct value separator '')` |
    | `anyValue(value)` | Not offered |
=== "MySQL"
    | Function | SQL |
    |---|---|
    | `average(value)` with whole numbers | `avg(cast(value as double))`; before MySQL 8.0.17, `avg((value * 1.0e0))` |
    | `averageDistinct(value)` with whole numbers | `avg(distinct cast(value as double))`; before MySQL 8.0.17, `avg(distinct (value * 1.0e0))` |
    | `average(value)`, `averageDistinct(value)` with a `double` | `avg(value)`, `avg(distinct value)` |
    | `stringConcat(value)` | `group_concat(value)` |
    | `stringConcat(value, ', ')` | `group_concat(value separator ', ')` |
    | `stringConcat(value, '')` | `group_concat(value separator '')` |
    | `stringConcatDistinct(value)` | `group_concat(distinct value)` |
    | `stringConcatDistinct(value, ', ')` | `group_concat(distinct value separator ', ')` |
    | `stringConcatDistinct(value, '')` | `group_concat(distinct value separator '')` |
    | `anyValue(value)` | `any_value(value)` |
=== "Oracle"
    | Function | SQL |
    |---|---|
    | `average(value)` with whole numbers | `avg(cast(value as float))` |
    | `averageDistinct(value)` with whole numbers | `avg(distinct cast(value as float))` |
    | `average(value)`, `averageDistinct(value)` with a `double` | `avg(value)`, `avg(distinct value)` |
    | `stringConcat(value)` | `listagg(value, ',') within group (order by value)` |
    | `stringConcat(value, ', ')` | `listagg(value, :0) within group (order by value)` |
    | `stringConcat(value, '')` | `listagg(value) within group (order by value)` |
    | `stringConcatDistinct(value)` | `listagg(distinct value, ',') within group (order by value)` |
    | `stringConcatDistinct(value, ', ')` | `listagg(distinct value, :0) within group (order by value)` |
    | `stringConcatDistinct(value, '')` | `listagg(distinct value) within group (order by value)` |
    | `anyValue(value)` | `any_value(value)` |
===+ "PostgreSQL"
    | Function | SQL |
    |---|---|
    | `average(value)` with whole numbers | `avg(value::float)` |
    | `averageDistinct(value)` with whole numbers | `avg(distinct value::float)` |
    | `average(value)`, `averageDistinct(value)` with a `double` | `avg(value)`, `avg(distinct value)` |
    | `stringConcat(value)` | `string_agg(value, ',')` |
    | `stringConcat(value, ', ')` | `string_agg(value, $1)` |
    | `stringConcat(value, '')` | `string_agg(value, '')` |
    | `stringConcatDistinct(value)` | `string_agg(distinct value, ',')` |
    | `stringConcatDistinct(value, ', ')` | `string_agg(distinct value, $1)` |
    | `stringConcatDistinct(value, '')` | `string_agg(distinct value, '')` |
    | `anyValue(value)` | `any_value(value)` |
=== "SQLite"
    | Function | SQL |
    |---|---|
    | `average(value)` with whole numbers | `avg(cast(value as real))` |
    | `averageDistinct(value)` with whole numbers | `avg(distinct cast(value as real))` |
    | `average(value)`, `averageDistinct(value)` with a `double` | `avg(value)`, `avg(distinct value)` |
    | `stringConcat(value)` | `group_concat(value)` |
    | `stringConcat(value, ', ')` | `group_concat(value, ?1)` |
    | `stringConcat(value, '')` | `group_concat(value, '')` |
    | `stringConcatDistinct(value)` | `group_concat(distinct value)` |
    | `stringConcatDistinct(value, ', ')`, `stringConcatDistinct(value, '')` | Not offered |
    | `anyValue(value)` | `value` (see [Any value of the group](#any-value-of-the-group)) |
=== "SQL Server"
    | Function | SQL |
    |---|---|
    | `average(value)` with whole numbers | `avg(cast(value as float))` |
    | `averageDistinct(value)` with whole numbers | `avg(distinct cast(value as float))` |
    | `average(value)`, `averageDistinct(value)` with a `double` | `avg(value)`, `avg(distinct value)` |
    | `stringConcat(value)` | `string_agg(value, ',')` |
    | `stringConcat(value, ', ')` | `string_agg(value, ', ')` |
    | `stringConcat(value, '')` | `string_agg(value, '')` |
    | `stringConcatDistinct(value)`, with or without a separator | Not offered |
    | `anyValue(value)` | Not offered |

Whole numbers are `int`, `bigint` and `customInt` values. They are cast so that the average keeps its fraction on every database: `average` of `1`, `2` and `4` is `2.3333...`, and not `2`.

## Aggregates without a group by

Without a `group by`, all the rows are a single group, so the query returns exactly one row. It's executed with `executeSelectOne`:

```ts
const customerStatistics = await connection.selectFrom(tCustomer)
    .select({
        customers: connection.countAll(),
        withAge: connection.count(tCustomer.age),
        averageAge: connection.average(tCustomer.age),
        oldest: connection.max(tCustomer.age)
    })
    .executeSelectOne();
```

With the rows above, the result is `{ customers: 6, withAge: 4, averageAge: 32.5, oldest: 40 }`.

The row is returned even if there are no rows to aggregate. With a `where` that no row meets, the result is `{ customers: 0, withAge: 0 }`, without the other properties. With a `group by` it's different: no rows means no groups, so `executeSelectMany` returns an empty list.

All the columns of the select must then be aggregates or constants: a column of a table, with no group by, doesn't compile (see [the next section](#grouping-by-every-non-aggregated-column)).

If all you want is the number of rows, [`selectCountAll()`](select.md#select-count-all) is a shortcut for `selectOneColumn(connection.countAll())`. With a group by before it, it returns a list with the count of each group. In the same way, a `selectOneColumn` of an aggregate returns a list with one value per group, and it's `null` for a group with no value, like `(number | null)[]` for a `sum`.

To page a query with aggregates, see [What the total counts](select-page.md#what-the-total-counts).

## How to choose the group by

There are three ways of writing the group by. The first two refer to the columns of the select, so they are the recommended ones: the library writes each column with the same SQL the select list computes, which the database always takes as the same expression.

| Way | Where it goes | What it groups by |
|---|---|---|
| [`.groupByNonAggregatedColumns()`](#grouping-by-every-non-aggregated-column) | After the `select` | Every column of the select that isn't an aggregate and refers to a table or view |
| [`.groupBy('companyId')`](#grouping-by-the-columns-of-the-select) | After the `select` | The columns of the select with those property names. A property in a nested object is written with its path, like `'company.id'`. A property that is an aggregate isn't accepted |
| [`.groupBy(tCustomer.companyId)`](#group-by-with-the-expressions) | Before or after the `select` | The columns or expressions you give, which don't need to be in the select |

The third way is the one to use for grouping by something you don't return. Here the customers are grouped by company, without returning the company:

```ts
const customerCounts = await connection.selectFrom(tCustomer)
    .groupBy(tCustomer.companyId)
    .select({
        customers: connection.countAll()
    })
    .executeSelectMany();
```

With a nested object in the select, the group by uses the path of the property:

```ts
const customersPerCompanyId = await connection.selectFrom(tCustomer)
    .select({
        company: {
            id: tCustomer.companyId
        },
        customers: connection.countAll()
    })
    .groupBy('company.id')
    .orderBy('company.id')
    .executeSelectMany();
```

An expression with a parameter can't be written again in the group by: see [An expression that carries a parameter, written again](#an-expression-that-carries-a-parameter-written-again). The other ways of writing the group by and the having before the select are at the end of the page, in [Grouping and filtering before the select](#grouping-and-filtering-before-the-select).

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

## Ordering by an aggregate

`orderBy` receives the name of a property of the select, so an aggregate of the select is ordered by its name. These are the companies with the most customers first:

```ts
const companiesByCustomers = await connection.selectFrom(tCustomer)
    .select({
        companyId: tCustomer.companyId,
        customers: connection.countAll()
    })
    .groupBy('companyId')
    .orderBy('customers', 'desc')
    .orderBy('companyId')
    .executeSelectMany();
```

With the rows above, the result is the companies `1`, `2` and `3`, with `3`, `2` and `1` customers.

An aggregate that isn't returned goes in the `orderBy` as an expression:

```ts
const companyIdsByCustomers = await connection.selectFrom(tCustomer)
    .select({
        companyId: tCustomer.companyId
    })
    .groupBy('companyId')
    .orderBy(connection.countAll(), 'desc')
    .orderBy('companyId')
    .executeSelectMany();
```

An aggregate can have no value, and the databases don't agree on where the nulls go. Say it with the [order mode](select.md#the-order-modes). Here company 3, which has no ages to add, goes last:

```ts
const companiesByTotalAge = await connection.selectFrom(tCustomer)
    .select({
        companyId: tCustomer.companyId,
        totalAge: connection.sum(tCustomer.age)
    })
    .groupBy('companyId')
    .orderBy('totalAge', 'desc nulls last')
    .executeSelectMany();
```

## Any value of the group

`anyValue(value)` is the SQL:2023 `any_value` aggregate function: any value of the group, for a column that is not grouped. It's useful when every row of the group has the same value but the column isn't part of the group by, like the name of the company the customers of a group belong to. If some rows of the group have null in that column, the result can be null even if others have a value.

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

    - MySQL: *Unknown column 'company.parent_id' in 'having clause'*.
    - MariaDB: *Unknown column 'company.parent_id' in 'HAVING'*.
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
