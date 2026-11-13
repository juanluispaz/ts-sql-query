---
search:
  boost: 0.92
---
# SQL fragments

A SQL fragment is a piece of SQL written by you, which the library puts in the query as you wrote it. It's what you use when the library doesn't offer what you need: a function or an operator of your database, a hint for the optimizer, a clause like `for update`.

Use the methods of the library first. They are translated to each database and checked by the compiler. The text of a fragment isn't: the library doesn't read it, so it goes to the database as it is, and a mistake in it shows up when the database rejects the query.

## Which tool to use

| You need | Use | Details |
|---|---|---|
| A value or a condition, written once in a query | `fragmentWithType` | [Inline fragments](#inline-fragments) |
| The same fragment in several queries, as a function with arguments | `buildFragmentWithArgs` | [Reusable fragments](#reusable-fragments) |
| A condition that disappears when a value is missing | `buildFragmentWithArgsIfValue` | [Conditional fragments](#conditional-fragments) |
| A function whose result is optional only when one of its arguments is | `buildFragmentWithMaybeOptionalArgs` | [Nullable fragments](#nullable-fragments) |
| An aggregate function | `aggregateFragmentWithType`, `buildAggregateFragmentWithArgs`, `buildAggregateFragmentWithArgsIfValue`, `buildAggregateFragmentWithMaybeOptionalArgs` | [Aggregate fragments](#aggregate-fragments) |
| A computed column, available in a table or view like the others | `virtualColumnFromFragment`, `optionalVirtualColumnFromFragment` | [Virtual columns](#virtual-columns) |
| SQL with no type: an order by item, the name of a constraint | `rawFragment` | [Raw fragments](#raw-fragments) |
| Another way of writing a table in the `from` | `createTableOrViewCustomization` | [Table or view customization](#table-or-view-customization) |
| SQL at a fixed position of the statement, or a name for its execution | `customizeQuery` | [Customizing queries](#customizing-queries-with-raw-sql) |

`fragmentWithType` and `aggregateFragmentWithType` have no arguments: you write them directly in the query, and they are public methods of the connection. The `build...` methods are `protected`: you call them in your connection class, and the result is a function you can use in any query.

There are two kinds of fragment, and the difference is the type:

| | Typed fragment (`fragmentWithType` and the rest) | `rawFragment` |
|---|---|---|
| Its type | The one you declare | None |
| In `select`, `where`, `having`, or inside another expression | Yes | No |
| Methods like `.concat` or `.equals` | Yes | No |
| In `orderBy` | Yes | Yes |
| In the hooks of `customizeQuery`, a table customization, `onConflictOnConstraint` | No | Yes |
| What it takes in `${...}` | A value | A value, or a whole query |
| How many `${...}` | Up to seven | Any number |

## Values in a fragment

The text of the template goes to the database as it is. Only what you put in `${...}` goes through the library:

| In `${...}` | What is written in the SQL |
|---|---|
| A column, like `${tCustomer.firstName}` | The name of the column, with its table when it's needed |
| A value, like `${connection.const(id, 'int')}` | A parameter: a placeholder in the SQL, with the value sent apart |
| An expression, like `${tCustomer.id.add(1)}` | Its SQL, with its parameters |
| A query, only in a `rawFragment` | Its SQL, with its parameters |

The parameters are what keeps the values safe: the database receives the query and the values separately, so a value is never read as SQL. This query looks for a customer with that strange name, and it finds none, whatever the value says:

```ts
const searchedName = "x' or '1'='1";

const customersWithName = connection.selectFrom(tCustomer)
    .where(connection.fragmentWithType('boolean', 'required').sql`lower(${tCustomer.firstName}) = lower(${connection.const(searchedName, 'string')})`)
    .select({
        id: tCustomer.id
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select id as id 
    from customer 
    where lower(first_name) = lower(?)
    ```
=== "MySQL"
    ```mysql
    select id as id 
    from customer 
    where lower(first_name) = lower(?)
    ```
=== "Oracle"
    ```oracle
    select id as "id" 
    from customer 
    where lower(first_name) = lower(:0)
    ```
===+ "PostgreSQL"
    ```postgresql
    select id as id 
    from customer 
    where lower(first_name) = lower($1)
    ```
=== "SQLite"
    ```sqlite
    select id as id 
    from customer 
    where lower(first_name) = lower(?1)
    ```
=== "SQL Server"
    ```sqlserver
    select id as id 
    from customer 
    where lower(first_name) = lower(@0)
    ```

The parameters are: `[ "x' or '1'='1" ]`

The result type is:
```tsx
const customersWithName: Promise<{
    id: number;
}[]>
```

A plain value in `${...}` doesn't compile, so it can't end up in the text by mistake: pass it with `connection.const(value, type)` or as an [argument](#reusable-fragments).

!!! warning "What keeps a fragment safe depends on you"

    - **Never build the text of a fragment from the data of a request.** The text of a template is written in your code, and it takes a cast to make it something else. That cast opens the door to SQL injection, and the library can't protect you from it.
    - **A parameter stands for a value only**, never for the name of a column or a keyword. If a request chooses a column, choose between fragments written in your code.
    - **Don't write quotes around `${...}`.** In `'%${name}%'` the placeholder ends up inside a text, so it isn't a parameter: PostgreSQL rejects the query, and SQLite looks for the characters `%?1%`. Join the pieces in SQL, as in `'%' || ${name} || '%'`, with the operator of your database.

## Defining custom SQL expressions

These are the ways of writing a typed fragment. All of them give a value that you use like any other expression of the library.

### Inline fragments

`fragmentWithType` receives the type of the value and whether it can be null, and its `sql` receives the template. The example uses functions every database has, so it runs anywhere; in your queries you can write whatever your database offers.

```ts
const id = 10;

const customersUsingCustomFragment = connection.selectFrom(tCustomer)
    .where(connection.fragmentWithType('boolean', 'required').sql`abs(${tCustomer.id}) = abs(${connection.const(id, 'int')})`)
    .select({
        lowerFirstName: connection.fragmentWithType('string', 'required').sql`lower(${tCustomer.firstName})`,
        name: tCustomer.firstName.concat(' ').concat(tCustomer.lastName)
    })
    .executeSelectNoneOrOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        lower(first_name) as lowerFirstName, 
        concat(first_name, ?, last_name) as name 
    from customer 
    where abs(id) = abs(?)
    ```
=== "MySQL"
    ```mysql
    select 
        lower(first_name) as lowerFirstName, 
        concat(first_name, ?, last_name) as name 
    from customer 
    where abs(id) = abs(?)
    ```
=== "Oracle"
    ```oracle
    select 
        lower(first_name) as "lowerFirstName", 
        first_name || :0 || last_name as "name" 
    from customer 
    where abs(id) = abs(:1)
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        lower(first_name) as "lowerFirstName", 
        first_name || $1 || last_name as name 
    from customer 
    where abs(id) = abs($2)
    ```
=== "SQLite"
    ```sqlite
    select 
        lower(first_name) as lowerFirstName, 
        first_name || ?1 || last_name as name 
    from customer 
    where abs(id) = abs(?2)
    ```
=== "SQL Server"
    ```sqlserver
    select 
        lower(first_name) as lowerFirstName, 
        first_name + @0 + last_name as name 
    from customer 
    where abs(id) = abs(@1)
    ```

The parameters are: `[ ' ', 10 ]`

The result type is:
```tsx
const customersUsingCustomFragment: Promise<{
    lowerFirstName: string;
    name: string;
} | null>
```

A typed fragment is a value like any other: you can select it, compare it and call its methods, like `` connection.fragmentWithType('string', 'required').sql`lower(${tCustomer.firstName})`.concat('!') ``. It doesn't need any `${...}`.

### The type you declare

`fragmentWithType(type, 'required' | 'optional', adapter?)` takes the same [data types as a column](../configuration/column-types.md). For a custom type or an enum, it also takes a name and the TypeScript type, as a column does:

```ts
const customersWithAgeGroup = connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id,
        ageGroup: connection.fragmentWithType<'adult' | 'minor', 'ageGroup'>('enum', 'ageGroup', 'required')
            .sql`case when ${tCustomer.id} > 100 then 'adult' else 'minor' end`
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        case when id > 100 then 'adult' else 'minor' end as ageGroup 
    from customer
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        case when id > 100 then 'adult' else 'minor' end as ageGroup 
    from customer
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        case when id > 100 then 'adult' else 'minor' end as "ageGroup" 
    from customer
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        case when id > 100 then 'adult' else 'minor' end as "ageGroup" 
    from customer
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        case when id > 100 then 'adult' else 'minor' end as ageGroup 
    from customer
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        case when id > 100 then 'adult' else 'minor' end as ageGroup 
    from customer
    ```

The parameters are: `[]`

The library can't read your SQL, so it trusts what you declare:

- At compile time, the type decides which methods the fragment offers, what it can be compared with, and the type of the property in the result. `'optional'` makes the property optional.
- Reading the result, the value goes through the same checks and conversions as a column of that type. What you declared and what the database returned have to agree:

| Declared | The database returns | Result |
|---|---|---|
| `'int', 'required'` | `5` | `5` |
| `'int', 'required'` | `null` | The promise is rejected with `MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE` |
| `'int', 'optional'` | `null` | The row doesn't have the property |
| `'int', 'required'` | `'abc'` | The promise is rejected with `INVALID_VALUE_RECEIVED_FROM_DATABASE` |
| `'string', 'required'` | `1` | The promise is rejected with `INVALID_VALUE_RECEIVED_FROM_DATABASE` |

So declare `'optional'` whenever the SQL can give null: the optionality of what you put in `${...}` doesn't reach the fragment. `` fragmentWithType('int', 'required').sql`extract(year from ${tCustomer.birthday})` `` is required because you say so, and a customer with no birthday makes the query fail. These checks only happen to the values the query returns: nothing is checked for a fragment used in a `where` or an `orderBy`. See [the errors the library raises](../api/error-management/library-raised-errors.md).

### Reusable fragments

A function in your connection avoids repeating a fragment, and the rest of your queries use it as if the library offered it.

If you define your connection like:


```ts
import { PostgreSqlConnection } from "ts-sql-query/postgresql";

class DBConnection extends PostgreSqlConnection<'DBConnection'> { 

    bitwiseShiftLeft = this.buildFragmentWithArgs(
        this.arg('int', 'required'),
        this.arg('int', 'required')
    ).as((left, right) => {
        // The fragment here is: ${left} << ${right}
        // Could be another fragment like a function call: myFunction(${left}, ${right})
        return this.fragmentWithType('int', 'required').sql`${left} << ${right}`
    })
}
```


`bitwiseShiftLeft` receives two `int`, and returns an `int`. `buildFragmentWithArgs` receives the definition of each argument, up to five of them, and `as` receives a function with each argument as a value you can put in `${...}`:

| Argument | What you can pass | In the SQL |
|---|---|---|
| `this.arg(type, 'required' \| 'optional', adapter?)` | A value, a column or an expression | A parameter for a value, the SQL of the rest |
| `this.valueArg(type, 'required' \| 'optional', adapter?)` | Only a value | A parameter |

A `'required'` argument doesn't accept `null` or `undefined`. A custom type or an enum takes its name too, as in `fragmentWithType`.

You use the function as a regular database function:

```ts
const bitwiseMovements = 1;
const multiplier = 2;

const companiesUsingCustomFunctionFragment = connection.selectFrom(tCompany)
    .where(tCompany.id.multiply(multiplier).equals(connection.bitwiseShiftLeft(tCompany.id, bitwiseMovements)))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        idMultiplyBy2: connection.bitwiseShiftLeft(tCompany.id, bitwiseMovements)
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        name as name, 
        id << ? as idMultiplyBy2 
    from company 
    where (id * ?) = (id << ?)
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        name as name, 
        id << ? as idMultiplyBy2 
    from company 
    where (id * ?) = (id << ?)
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name", 
        id * power(2, :0) as "idMultiplyBy2" 
    from company 
    where (id * :1) = (id * power(2, :2))
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name, 
        id << $1 as "idMultiplyBy2" 
    from company 
    where (id * $2) = (id << $3)
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name, 
        id << ?1 as idMultiplyBy2 
    from company 
    where (id * ?2) = (id << ?3)
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name, 
        id << @0 as idMultiplyBy2 
    from company 
    where (id * @1) = (id << @2)
    ```

The parameters are: `[ 1, 2, 1 ]`

The result type is:
```tsx
const companiesUsingCustomFunctionFragment: Promise<{
    id: number;
    name: string;
    idMultiplyBy2: number;
}[]>
```

!!! note

    The text isn't translated, so this example only works where the database has that operator: SQL Server has `<<` from 2022, and Oracle doesn't have it, so its connection writes `${left} * power(2, ${right})`, as its tab shows.

    PostgreSQL has to find out the type of a parameter from the SQL around it. `id << $1` works, but with values on both sides, `$1 << $2`, it rejects the query with `operator is not unique`. Write a cast in the fragment: `${left}::int << ${right}::int`.

### Conditional fragments

A function that behaves like the [methods ending in `IfValue`](dynamic-queries.md#all-the-ifvalue-methods): it's left out of the query when it doesn't receive a value, so you can write a filter that only applies when there is something to filter by.

`buildFragmentWithArgsIfValue` creates a function that returns a condition. It's left out when an optional argument created with `valueArg` receives `null`, `undefined`, or an empty string (unless the `allowEmptyString` flag of the connection is set to true). `0` is a value. An argument created with `arg` never leaves it out: a `null` in it goes to the database as a parameter. As in the other `IfValue` methods, the library takes care of the `and` and `or` it was part of.

If you define your connection like:


```ts
import { PostgreSqlConnection } from "ts-sql-query/postgresql";

class DBConnection extends PostgreSqlConnection<'DBConnection'> { 

    valuePlusOneEqualsIfValue = this.buildFragmentWithArgsIfValue(
        this.arg('int', 'required'),
        this.valueArg('int', 'optional')
    ).as((left, right) => {
        // The fragment here is: ${left} + 1 = ${right}
        // Could be another fragment like a function call: myFunction(${left}, ${right})
        return this.fragmentWithType('boolean', 'required').sql`${left} + 1 = ${right}`
    })
}
```


`valuePlusOneEqualsIfValue` receives an `int`, which can be a column, and an optional `int` value. When you use it with no value, the condition isn't written:

```ts
const noValue = null
const withValue = 2

const companiesUsingCustomFunctionFragmentIfValue = connection.selectFrom(tCompany)
    .where(connection.valuePlusOneEqualsIfValue(tCompany.id, noValue))
        .or(connection.valuePlusOneEqualsIfValue(tCompany.id, withValue))
    .select({
        id: tCompany.id,
        name: tCompany.name,
    })
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        name as name 
    from company 
    where id + 1 = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        name as name 
    from company 
    where id + 1 = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name" 
    from company 
    where id + 1 = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name 
    from company 
    where id + 1 = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name 
    from company 
    where id + 1 = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name 
    from company 
    where id + 1 = @0
    ```

The parameters are: `[ 2 ]`

The result type is:
```tsx
const companiesUsingCustomFunctionFragmentIfValue: Promise<{
    id: number;
    name: string;
}[]>
```

### Nullable fragments

A function whose result is optional only when one of the arguments it receives is. If you define your connection like:

```ts
import { PostgreSqlConnection } from "ts-sql-query/postgresql";

class DBConnection extends PostgreSqlConnection<'DBConnection'> { 

    bitwiseShiftLeft = this.buildFragmentWithMaybeOptionalArgs(
        this.arg('int', 'optional'),
        this.arg('int', 'optional')
    ).as((left, right) => {
        // The fragment here is: ${left} << ${right}
        // Could be another fragment like a function call: myFunction(${left}, ${right})
        return this.fragmentWithType('int', 'optional').sql`${left} << ${right}`
    })
}
```


`bitwiseShiftLeft` receives two `int`, which can be values, columns or expressions. Its result is optional if an argument is an optional column or expression, or a value that is `null` or `undefined`, and required otherwise. So with `tCompany.id` and a number, as here, it's required.

!!! warning

    When using `buildFragmentWithMaybeOptionalArgs`, you must ensure that:
    
    - All arguments that might be omitted are explicitly marked as `optional`.
    - The return fragment must also be declared as `optional`.

    Otherwise, type inference will not correctly reflect the presence of optional values in the resulting expression.

```ts
const bitwiseMovements = 1;
const multiplier = 2;

const companiesUsingCustomFunctionFragment = connection.selectFrom(tCompany)
    .where(tCompany.id.multiply(multiplier).equals(connection.bitwiseShiftLeft(tCompany.id, bitwiseMovements)))
    .select({
        id: tCompany.id,
        name: tCompany.name,
        idMultiplyBy2: connection.bitwiseShiftLeft(tCompany.id, bitwiseMovements)
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        name as name, 
        id << ? as idMultiplyBy2 
    from company 
    where (id * ?) = (id << ?)
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        name as name, 
        id << ? as idMultiplyBy2 
    from company 
    where (id * ?) = (id << ?)
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name", 
        id * power(2, :0) as "idMultiplyBy2" 
    from company 
    where (id * :1) = (id * power(2, :2))
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name, 
        id << $1 as "idMultiplyBy2" 
    from company 
    where (id * $2) = (id << $3)
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name, 
        id << ?1 as idMultiplyBy2 
    from company 
    where (id * ?2) = (id << ?3)
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name, 
        id << @0 as idMultiplyBy2 
    from company 
    where (id * @1) = (id << @2)
    ```

The parameters are: `[ 1, 2, 1 ]`

The result type is:
```tsx
const companiesUsingCustomFunctionFragment: Promise<{
    id: number;
    name: string;
    idMultiplyBy2: number;
}[]>
```

### Aggregate fragments

An **aggregate function** collapses many rows into a single value, like `COUNT`, `SUM` or an aggregate of your database that the library doesn't offer. For a fragment that is one, use the aggregate version of each method:

- `aggregateFragmentWithType` is the aggregate version of `fragmentWithType`.
- `buildAggregateFragmentWithArgs` is the aggregate version of `buildFragmentWithArgs`.
- `buildAggregateFragmentWithArgsIfValue` is the aggregate version of `buildFragmentWithArgsIfValue`.
- `buildAggregateFragmentWithMaybeOptionalArgs` is the aggregate version of `buildFragmentWithMaybeOptionalArgs`.

They behave like their non-aggregate versions, and their value is **marked as an aggregate**. As with the built-in aggregate functions (`count`, `sum`, `avg`...), the compiler rejects it in `where`, `and`, `or`, `groupBy` and the `on` of a join, and accepts it in `having`, `select` and `orderBy`. A misplaced aggregate is then a compilation error instead of an error of the database.

```ts
import { PostgreSqlConnection } from "ts-sql-query/postgresql";

class DBConnection extends PostgreSqlConnection<'DBConnection'> {

    // A custom aggregate not exposed by the default API.
    countFilteredPositive = this.buildAggregateFragmentWithArgs(
        this.arg('int', 'required')
    ).as((value) => {
        return this.aggregateFragmentWithType('int', 'required').sql`count(*) filter (where ${value} > 0)`
    })
}
```

For a one-off aggregate you don't need a function: `` connection.aggregateFragmentWithType('int', 'optional').sql`...` `` works inline, as `fragmentWithType` does.

#### What changes when a fragment is an aggregate

The library can't read your SQL, so it knows there is an aggregate only if you mark it, or if you pass the aggregate in a `${...}`. It uses that in two places:

- [`executeSelectPage`](select-page.md#what-the-total-counts): a select with an aggregate and no `group by` returns one row, and the total has to say so.
- `groupByNonAggregatedColumns`: an aggregate must stay out of the `group by`.

This is what happens depending on how the aggregate is written, in a select over a table of four rows:

| How it's written | Example | The total of `executeSelectPage` | `groupByNonAggregatedColumns` |
|---|---|---|---|
| Marked | `` aggregateFragmentWithType('int', 'required').sql`sum(${tCustomer.id})` `` | `1`, the rows of the result | Leaves it out of the `group by` |
| In a `${...}` | `` fragmentWithType('int', 'required').sql`abs(${connection.count(tCustomer.id)})` `` | `1`, the rows of the result | Leaves it out of the `group by` |
| Only in the text | `` fragmentWithType('int', 'required').sql`sum(${tCustomer.id})` `` | `4`, the rows of the table, while `data` has one row | Adds it to the `group by`, and the database rejects the query |

So mark every fragment with an aggregate in its text:

```ts
const totalCustomers = connection.selectFrom(tCustomer)
    .select({
        customers: connection.aggregateFragmentWithType('int', 'required').sql`count(*)`
    })
    .executeSelectPage();

const idsPerCompany = connection.selectFrom(tCustomer)
    .select({
        companyId: tCustomer.companyId,
        total: connection.aggregateFragmentWithType('int', 'required').sql`sum(${tCustomer.id})`
    })
    .groupByNonAggregatedColumns()
    .orderBy('companyId')
    .executeSelectMany();
```

The executed query to get the data is:

=== "MariaDB"
    ```mariadb
    select count(*) as customers 
    from customer
    ```
=== "MySQL"
    ```mysql
    select count(*) as customers 
    from customer
    ```
=== "Oracle"
    ```oracle
    select count(*) as "customers" 
    from customer
    ```
===+ "PostgreSQL"
    ```postgresql
    select count(*) as customers 
    from customer
    ```
=== "SQLite"
    ```sqlite
    select count(*) as customers 
    from customer
    ```
=== "SQL Server"
    ```sqlserver
    select count(*) as customers 
    from customer
    ```

And its parameters are: `[]`

The executed query to get the count is:

=== "MariaDB"
    ```mariadb
    with 
        result_for_count as ( 
            select count(*) as customers  
            from customer 
        ) 
    select count(*) 
    from result_for_count
    ```
=== "MySQL"
    ```mysql
    with 
        result_for_count as ( 
            select count(*) as customers  
            from customer 
        ) 
    select count(*) 
    from result_for_count
    ```
=== "Oracle"
    ```oracle
    with 
        result_for_count as ( 
            select count(*) as customers  
            from customer 
        ) 
    select count(*) 
    from result_for_count
    ```
===+ "PostgreSQL"
    ```postgresql
    with 
        result_for_count as ( 
            select count(*) as customers  
            from customer 
        ) 
    select count(*) 
    from result_for_count
    ```
=== "SQLite"
    ```sqlite
    with 
        result_for_count as ( 
            select count(*) as customers  
            from customer 
        ) 
    select count(*) 
    from result_for_count
    ```
=== "SQL Server"
    ```sqlserver
    with 
        result_for_count as ( 
            select count(*) as customers  
            from customer 
        ) 
    select count(*) 
    from result_for_count
    ```

And its parameters are: `[]`

The executed query to get the count is:

=== "MariaDB"
    ```mariadb
    select 
        company_id as companyId, 
        sum(id) as total 
    from customer 
    group by company_id 
    order by companyId
    ```
=== "MySQL"
    ```mysql
    select 
        company_id as companyId, 
        sum(id) as total 
    from customer 
    group by company_id 
    order by companyId
    ```
=== "Oracle"
    ```oracle
    select 
        company_id as "companyId", 
        sum(id) as "total" 
    from customer 
    group by company_id 
    order by "companyId"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company_id as "companyId", 
        sum(id) as total 
    from customer 
    group by company_id 
    order by "companyId"
    ```
=== "SQLite"
    ```sqlite
    select 
        company_id as companyId, 
        sum(id) as total 
    from customer 
    group by company_id 
    order by companyId
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company_id as companyId, 
        sum(id) as total 
    from customer 
    group by company_id 
    order by companyId
    ```

And its parameters are: `[]`

### Virtual columns

A virtual column doesn't exist in the database: it's a property of your table or view, and each query that uses it writes its SQL. Use one when a computation belongs to the table, so that queries don't repeat a fragment. Its optionality is in the name of the method: `virtualColumnFromFragment` is required, and `optionalVirtualColumnFromFragment` is optional.

```ts
import { Table } from "ts-sql-query"

const tCustomerWithAge = new class TCustomerWithAge extends Table<DBConnection, 'TCustomerWithAge'> {
    id = this.autogeneratedPrimaryKey('id', 'int');
    firstName = this.column('first_name', 'string');
    birthday = this.optionalColumn('birthday', 'localDate');

    upperFirstName = this.virtualColumnFromFragment('string', (fragment) => fragment.sql`upper(${this.firstName})`);
    age = this.optionalVirtualColumnFromFragment('int', (fragment) => fragment.sql`calculateAge(${this.birthday})`);

    constructor() {
        super('customer');
    }
}();
```

The `${...}` of the `fragment` only takes the columns of that table. A type adapter can go as the last argument, and a custom type or an enum takes its name after the type. When the table has an alias, the fragment uses it. A virtual column can't be set in an insert or an update, and it's also available in a view and in [`Values`](../api/constant-values-view.md). [Mapping](../configuration/mapping.md#virtual-columns) has a query that uses one.

### Raw fragments

`rawFragment` is a piece of SQL with no type. It can't be selected or compared; it goes where the library expects SQL and not a value:

- In [`orderBy`](#ordering-by-a-fragment).
- In the [hooks of `customizeQuery`](#customizing-queries-with-raw-sql).
- In a [table customization](#table-or-view-customization).
- In [`onConflictOnConstraint`](insert-on-conflict.md).

This is how you use features the library doesn't support, for example the temporal tables of [SQL Server](../configuration/supported-databases/sqlserver.md):

```typescriptreact
const from = connection.const(new Date('2019-01-01'), 'localDateTime')
const to = connection.const(new Date('2020-01-01'), 'localDateTime')
const fragment = connection.rawFragment`for system_time between ${from} and ${to}`
```

The [table customization](#table-or-view-customization) below shows a complete query using this clause.

Besides values, a `rawFragment` takes a whole query in `${...}`: a select, or an insert, an update or a delete where the database accepts it. Its SQL and its parameters go in that position. If that query uses a [CTE](cte-subqueries.md), the `with` goes up to the query that contains the fragment.

### Ordering by a fragment

`orderBy` receives a typed fragment or a `rawFragment`, when what you need isn't a property of the select. This query shows one company first, and the rest by name:

```ts
const preferredCompanyId = 2;

const companiesInOrder = connection.selectFrom(tCompany)
    .select({
        id: tCompany.id,
        name: tCompany.name
    })
    .orderBy(connection.rawFragment`case when ${tCompany.id} = ${connection.const(preferredCompanyId, 'int')} then 0 else 1 end`)
    .orderBy('name')
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        name as name 
    from company 
    order by 
        case when company.id = ? then 0 else 1 end, 
        name
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        name as name 
    from company 
    order by 
        case when company.id = ? then 0 else 1 end, 
        name
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name" 
    from company 
    order by 
        case when company.id = :0 then 0 else 1 end, 
        "name"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name 
    from company 
    order by 
        case when company.id = $1 then 0 else 1 end, 
        name
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name 
    from company 
    order by 
        case when company.id = ?1 then 0 else 1 end, 
        name
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name 
    from company 
    order by 
        case when company.id = @0 then 0 else 1 end, 
        name
    ```

The parameters are: `[ 2 ]`

The result type is:
```tsx
const companiesInOrder: Promise<{
    id: number;
    name: string;
}[]>
```

What it means for the rest of the query:

- The fragment doesn't change the columns: the rows have only what you selected.
- The [order mode](select.md#the-order-modes) goes as the second argument: `` .orderBy(connection.rawFragment`...`, 'desc nulls last') ``. The `insensitive` modes only apply to a fragment typed as a string: a `rawFragment` has no type, so `insensitive` isn't applied to it, and you write the conversion in the fragment.
- A table used in the fragment counts as used, so an [optional join](../dynamic/optional-parts/optional-joins.md) of that table stays in the query, and in the count of a page, where it can change the number of rows.
- [`executeSelectPage`](select-page.md#getting-the-page-and-the-total) leaves the `order by` out of its count, and with it the fragment and its parameters.
- With `groupBy`, the `orderBy` can have an aggregate: an [aggregate fragment](#aggregate-fragments), or `` connection.rawFragment`count(*)` ``.
- In a [compound select](compound-select.md#ordering-the-combined-result), the fragment can't use tables, because the order applies to the combined result, so it refers to the name of a column of the result: `` .orderBy(connection.rawFragment`name desc`) ``.

## Table or view customization

Some databases need something extra next to the name of a table in the `from`. For example, [SQL Server](../configuration/supported-databases/sqlserver.md) and [MariaDB](../configuration/supported-databases/mariadb.md) have temporal tables that track all the changes in a table, so you can read a row as it was at a specific moment, which you indicate in the `from`. [Oracle](../configuration/supported-databases/oracle.md) offers something similar called "Oracle Flashback Technology", with a different syntax.

`createTableOrViewCustomization` is a `protected` method for that, which you call in your connection class. It receives a function that returns the raw fragment to write. That function receives the name of the table, its alias, and up to five arguments of yours. The result is a function that receives the table or view, a name for the customization, and your arguments.

**Example**:

You must define the connection with the customization function as:

<!-- doc-code-snippet-template: sqlserver -->
```ts
class DBConnection extends SqlServerConnection<'DBConnection'> { 

    forSystemTimeBetween = this.createTableOrViewCustomization<Date, Date>((table, alias, fromDate, toDate) => {
        const from = this.const(fromDate, 'localDateTime')
        const to = this.const(toDate, 'localDateTime')
        return this.rawFragment`${table} for system_time between ${from} and ${to} ${alias}`
    })
}
```

When you write the query, you use the customization function as:

<!-- doc-code-snippet-template: sqlserver -->
```ts
const customerIn2019 = connection.forSystemTimeBetween(tCustomer, 'customerIn2019', new Date('2019-01-01'), new Date('2020-01-01'))

const customerInSystemTime = connection.selectFrom(customerIn2019)
    .where(customerIn2019.id.equals(10))
    .select({
        id: customerIn2019.id,
        firstName: customerIn2019.firstName,
        lastName: customerIn2019.lastName,
        birthday: customerIn2019.birthday
    })
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer for system_time between ? and ?  
    where id = ?
    ```
=== "MySQL"
    ```mysql
    --
    --
    --
    -- MySQL doesn't support temporal tables
    --
    --
    --
    ```
=== "Oracle"
    ```oracle
    --
    --
    --
    -- Oracle doesn't support for system_time, see the flashback version query below
    --
    --
    --
    ```
===+ "PostgreSQL"
    ```postgresql
    --
    --
    --
    -- PostgreSQL doesn't support temporal tables
    --
    --
    --
    ```
=== "SQLite"
    ```sqlite
    --
    --
    --
    -- SQLite doesn't support temporal tables
    --
    --
    --
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer for system_time between @0 and @1  
    where id = @2
    ```

The parameters are: `[ 2019-01-01T00:00:00.000Z, 2020-01-01T00:00:00.000Z, 10 ]`

The result type is:
```tsx
const customerInSystemTime: Promise<{
    id: number;
    firstName: string;
    lastName: string;
    birthday?: Date;
}[]>
```

On [Oracle](../configuration/supported-databases/oracle.md), use a flashback version query instead, for example `${table} versions between timestamp minvalue and maxvalue ${alias}`; explicit bounds older than the last DDL of the table fail with `ORA-01466`.

## Customizing queries with raw SQL

`customizeQuery` writes raw fragments in fixed positions of a statement, called hooks, when what you need doesn't have a method: a hint, `for update`, a clause of your database. It also gives a name and metadata to the execution of the query.

These are all the hooks, and what each statement offers:

| Hook | Select | Compound select | Insert | Update | Delete |
|---|---|---|---|---|---|
| `beforeQuery` | Yes | Yes | Yes | Yes | Yes |
| `afterSelectKeyword` | Yes | No | No | No | No |
| `beforeColumns` | Yes | No | No | No | No |
| `customWindow` | Yes | No | No | No | No |
| `beforeOrderByItems` | Yes | No | No | No | No |
| `afterOrderByItems` | Yes | No | No | No | No |
| `afterInsertKeyword` | No | No | Yes | No | No |
| `afterUpdateKeyword` | No | No | No | Yes | No |
| `afterDeleteKeyword` | No | No | No | No | Yes |
| `afterQuery` | Yes | Yes | Yes | Yes | Yes |
| `beforeWithQuery` | Yes | Yes | No | No | No |
| `afterWithQuery` | Yes | Yes | No | No | No |
| `queryExecutionName` | Yes | Yes | Yes | Yes | Yes |
| `queryExecutionMetadata` | Yes | Yes | Yes | Yes | Yes |

What applies to all of them:

- `customizeQuery` can be called only once in a query, so all the hooks go in the same object. It usually goes last, before the execute method.
- A hook receives a `rawFragment`, except the two for the execution. The fragment can use the tables of the query, and the values go as parameters.
- The library adds the spaces, the commas of the `order by`, and the `window` keyword. The rest of the text is yours, and it has to be valid in your database: the examples of this page only show where each hook writes.
- Hooks are written in the [count of a select page](select-page.md#customizing-and-monitoring-the-queries) too, except the ones of the `order by`.

### Customizing a select

Each hook writes in this position of the query:

```text
/* beforeQuery */ with ...
select /* afterSelectKeyword */ distinct /* beforeColumns */ columns
from ...
where ...
group by ...
having ...
window /* customWindow */
order by /* beforeOrderByItems */, the items of orderBy, /* afterOrderByItems */
limit ... offset ...
/* afterQuery */
```

| Hook | What it writes |
|-------------------------|-----------------------------------------------------------------------------|
| `beforeQuery`           | At the beginning of the query, before the `with`.                           |
| `afterSelectKeyword`    | Immediately after the `select` keyword, before the `distinct`.              |
| `beforeColumns`         | Before the column list, after the `distinct`.                               |
| `customWindow`          | A `window` clause. The library writes the `window` keyword.                 |
| `beforeOrderByItems`    | An item of the `order by`, before the items of `orderBy`.                   |
| `afterOrderByItems`     | An item of the `order by`, after the items of `orderBy`.                    |
| `afterQuery`            | At the end of the query, after the `limit` and the `offset`.                |
| `beforeWithQuery`       | When the select is used as a CTE, before the opening parenthesis of the `with`. |
| `afterWithQuery`        | When the select is used as a CTE, after the closing parenthesis of the `with`. |
| `queryExecutionName`    | Nothing in the SQL: a name for the execution of the query.                  |
| `queryExecutionMetadata`| Nothing in the SQL: any value for the execution of the query.               |


!!! warning "`afterSelectKeyword` and `beforeColumns` are for hints and modifiers, not for columns"

    Use these two hooks for optimizer hints or select modifiers (like `/*+ ... */` or `SQL_NO_CACHE`), never to add columns to the select list. `ts-sql-query` relies on the position of the columns it writes in the select list: for example, on some databases `groupBy('<column name>')` is emitted as `group by <position of the column>`, and an extra column placed before the list shifts those positions, making the query group by a different column. To use a raw SQL fragment as a value, select it as a column with an [inline fragment](#inline-fragments), or pass the `rawFragment` to `orderBy`.

This select adds a hint and locks the row it reads:

```ts
const customizedSelect = connection.selectFrom(tCustomer)
    .where(tCustomer.id.equals(10))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday
    }).customizeQuery({
        afterSelectKeyword: connection.rawFragment`/*+ some hints */`,
        afterQuery: connection.rawFragment`for update`
    })
    .executeSelectOne()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select /*+ some hints */ 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ? for update
    ```
=== "MySQL"
    ```mysql
    select /*+ some hints */ 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ? for update
    ```
=== "Oracle"
    ```oracle
    select /*+ some hints */ 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as "birthday" 
    from customer 
    where id = :0 for update
    ```
===+ "PostgreSQL"
    ```postgresql
    select /*+ some hints */ 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as birthday 
    from customer 
    where id = $1 for update
    ```
=== "SQLite"
    ```sqlite
    select /*+ some hints */ 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ?1 for update
    ```
=== "SQL Server"
    ```sqlserver
    select /*+ some hints */ 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = @0 for update
    ```

The parameters are: `[ 10 ]`

The result type is:
```tsx
const customizedSelect: Promise<{
    id: number;
    firstName: string;
    lastName: string;
    birthday?: Date;
}>
```

This query has all the hooks that write in a select executed directly, except the window, which has [its own example](#a-window):

```ts
const customersWithHooks = connection.selectFrom(tCustomer)
    .where(tCustomer.companyId.equals(1))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .orderBy('firstName')
    .limit(10)
    .customizeQuery({
        beforeQuery: connection.rawFragment`/* beforeQuery */`,
        afterSelectKeyword: connection.rawFragment`/* afterSelectKeyword */`,
        beforeColumns: connection.rawFragment`/* beforeColumns */`,
        beforeOrderByItems: connection.rawFragment`${tCustomer.lastName} desc`,
        afterOrderByItems: connection.rawFragment`${tCustomer.id} desc`,
        afterQuery: connection.rawFragment`/* afterQuery */`
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    /* beforeQuery */ select /* afterSelectKeyword */ /* beforeColumns */ 
        id as id, 
        first_name as firstName 
    from customer 
    where company_id = ? 
    order by 
        customer.last_name desc, 
        firstName, 
        customer.id desc 
    limit ? /* afterQuery */
    ```
=== "MySQL"
    ```mysql
    /* beforeQuery */ select /* afterSelectKeyword */ /* beforeColumns */ 
        id as id, 
        first_name as firstName 
    from customer 
    where company_id = ? 
    order by 
        customer.last_name desc, 
        firstName, 
        customer.id desc 
    limit ? /* afterQuery */
    ```
=== "Oracle"
    ```oracle
    /* beforeQuery */ select /* afterSelectKeyword */ /* beforeColumns */ 
        id as "id", 
        first_name as "firstName" 
    from customer 
    where company_id = :0 
    order by 
        customer.last_name desc, 
        "firstName", 
        customer.id desc 
    fetch next :1 rows only /* afterQuery */
    ```
===+ "PostgreSQL"
    ```postgresql
    /* beforeQuery */ select /* afterSelectKeyword */ /* beforeColumns */ 
        id as id, 
        first_name as "firstName" 
    from customer 
    where company_id = $1 
    order by 
        customer.last_name desc, 
        "firstName", 
        customer.id desc 
    limit $2 /* afterQuery */
    ```
=== "SQLite"
    ```sqlite
    /* beforeQuery */ select /* afterSelectKeyword */ /* beforeColumns */ 
        id as id, 
        first_name as firstName 
    from customer 
    where company_id = ?1 
    order by 
        customer.last_name desc, 
        firstName, 
        customer.id desc 
    limit ?2 /* afterQuery */
    ```
=== "SQL Server"
    ```sqlserver
    /* beforeQuery */ select /* afterSelectKeyword */ /* beforeColumns */ 
        id as id, 
        first_name as firstName 
    from customer 
    where company_id = @0 
    order by 
        customer.last_name desc, 
        firstName, 
        customer.id desc 
    offset 0 rows fetch next @1 rows only /* afterQuery */
    ```

The parameters are: `[ 1, 10 ]`

The result type is:
```tsx
const customersWithHooks: Promise<{
    id: number;
    firstName: string;
}[]>
```

#### A window

The library has no [window functions](../about/limitations.md), so you write them in a fragment. `customWindow` defines a named window, and a column refers to it with `over`. MySQL has this clause from 8.0.2, and SQL Server from 2022.

```ts
const customersWithPosition = connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id,
        position: connection.fragmentWithType('int', 'required').sql`row_number() over company_window`
    })
    .orderBy('id')
    .customizeQuery({
        customWindow: connection.rawFragment`company_window as (partition by ${tCustomer.companyId} order by ${tCustomer.id})`
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        row_number() over company_window as `position` 
    from customer 
    window company_window as (partition by company_id order by id) 
    order by id
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        row_number() over company_window as `position` 
    from customer 
    window company_window as (partition by company_id order by id) 
    order by id
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        row_number() over company_window as "position" 
    from customer 
    window company_window as (partition by company_id order by id) 
    order by "id"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        row_number() over company_window as position 
    from customer 
    window company_window as (partition by company_id order by id) 
    order by id
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        row_number() over company_window as position 
    from customer 
    window company_window as (partition by company_id order by id) 
    order by id
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        row_number() over company_window as position 
    from customer 
    window company_window as (partition by company_id order by id) 
    order by id
    ```

The result type is:
```tsx
const customersWithPosition: Promise<{
    id: number;
    position: number;
}[]>
```

#### A select used inside another query

The hooks stay with their select, and the query that uses it has its own:

- When the select is [a CTE](cte-subqueries.md), `beforeQuery` and `afterQuery` are written inside its parentheses, and `beforeWithQuery` and `afterWithQuery` around them, for what the database accepts there, such as `materialized` on PostgreSQL and SQLite. In a select executed directly there is no `with` for these two to go in, and they aren't written.
- When the select is [an inline value](cte-subqueries.md#inline-subquery-as-value), `beforeQuery` and `afterQuery` are written inside its parentheses.

```ts
const customerIds = connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id
    })
    .customizeQuery({
        beforeWithQuery: connection.rawFragment`/* beforeWithQuery */`,
        afterWithQuery: connection.rawFragment`/* afterWithQuery */`
    })
    .forUseInQueryAs('customer_ids');

const idsFromCte = connection.selectFrom(customerIds)
    .select({
        id: customerIds.id
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    with 
        customer_ids as /* beforeWithQuery */ (
            select id as id 
            from customer
        ) /* afterWithQuery */ 
    select id as id 
    from customer_ids
    ```
=== "MySQL"
    ```mysql
    with 
        customer_ids as /* beforeWithQuery */ (
            select id as id 
            from customer
        ) /* afterWithQuery */ 
    select id as id 
    from customer_ids
    ```
=== "Oracle"
    ```oracle
    with 
        customer_ids as /* beforeWithQuery */ (
            select id as id 
            from customer
        ) /* afterWithQuery */ 
    select id as "id" 
    from customer_ids
    ```
===+ "PostgreSQL"
    ```postgresql
    with 
        customer_ids as /* beforeWithQuery */ (
            select id as id 
            from customer
        ) /* afterWithQuery */ 
    select id as id 
    from customer_ids
    ```
=== "SQLite"
    ```sqlite
    with 
        customer_ids as /* beforeWithQuery */ (
            select id as id 
            from customer
        ) /* afterWithQuery */ 
    select id as id 
    from customer_ids
    ```
=== "SQL Server"
    ```sqlserver
    with 
        customer_ids as /* beforeWithQuery */ (
            select id as id 
            from customer
        ) /* afterWithQuery */ 
    select id as id 
    from customer_ids
    ```

The result type is:
```tsx
const idsFromCte: Promise<{
    id: number;
}[]>
```

!!! note "Recursive selects consumed as a CTE"

    When a recursive `SELECT` (built with `recursiveUnion` / `recursiveUnionAll` / `recursiveUnionOn` / `recursiveUnionAllOn`) is materialized as a common table expression with [`forUseInQueryAs`](recursive-select.md), its outer `select ... from <cte>` projection is dropped — the query that consumes the CTE supplies that projection instead. Because of that, the projection-only hooks `afterSelectKeyword`, `beforeColumns` and `customWindow` customize a `SELECT` clause that no longer exists in the emitted CTE, so they are **not applicable** in this case and have no effect. The other hooks still apply: `beforeQuery` / `afterQuery` bracket the `anchor UNION recursive` body and `beforeWithQuery` / `afterWithQuery` wrap the CTE parentheses. All the hooks — including `afterSelectKeyword`, `beforeColumns` and `customWindow` — take effect as documented when the recursive query is executed directly (`executeSelectMany()`, and so on) instead of being consumed as a CTE.

### Customizing a compound select

A [compound select](compound-select.md) as a whole has fewer hooks, because it has no `select` keyword or columns of its own. To reach those, call `customizeQuery` on the select inside it, before combining it.

| Hook | What it writes |
|-------------------------|-----------------------------------------------------------------------------|
| `beforeQuery`           | At the beginning of the compound select.                                    |
| `afterQuery`            | At the end of the compound select.                                          |
| `beforeWithQuery`       | When it's used as a CTE, before the opening parenthesis of the `with`.      |
| `afterWithQuery`        | When it's used as a CTE, after the closing parenthesis of the `with`.       |
| `queryExecutionName`    | Nothing in the SQL: a name for the execution of the query.                  |
| `queryExecutionMetadata`| Nothing in the SQL: any value for the execution of the query.               |

```ts
const allIds = connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id
    }).unionAll(
        connection.selectFrom(tCompany)
        .select({
            id: tCompany.id
        })
    ).customizeQuery({
        beforeQuery: connection.rawFragment`/* beforeQuery */`,
        afterQuery: connection.rawFragment`/* afterQuery */`
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    /* beforeQuery */ select id as id 
    from customer 
    
    union all 
    
    select id as id 
    from company /* afterQuery */
    ```
=== "MySQL"
    ```mysql
    /* beforeQuery */ select id as id 
    from customer 
    
    union all 
    
    select id as id 
    from company /* afterQuery */
    ```
=== "Oracle"
    ```oracle
    /* beforeQuery */ select id as "id" 
    from customer 
    
    union all 
    
    select id as "id" 
    from company /* afterQuery */
    ```
===+ "PostgreSQL"
    ```postgresql
    /* beforeQuery */ select id as id 
    from customer 
    
    union all 
    
    select id as id 
    from company /* afterQuery */
    ```
=== "SQLite"
    ```sqlite
    /* beforeQuery */ select id as id 
    from customer 
    
    union all 
    
    select id as id 
    from company /* afterQuery */
    ```
=== "SQL Server"
    ```sqlserver
    /* beforeQuery */ select id as id 
    from customer 
    
    union all 
    
    select id as id 
    from company /* afterQuery */
    ```

The result type is:
```tsx
const allIds: Promise<{
    id: number;
}[]>
```

### Customizing an insert

| Hook | What it writes |
|-------------------------|-----------------------------------------------------------------------|
| `beforeQuery`           | At the beginning of the query.                                        |
| `afterInsertKeyword`    | Immediately after the `insert` keyword, such as `or ignore` on SQLite. |
| `afterQuery`            | At the end of the query, after the `returning`.                       |
| `queryExecutionName`    | Nothing in the SQL: a name for the execution of the query.            |
| `queryExecutionMetadata`| Nothing in the SQL: any value for the execution of the query.         |

```ts
const customizedInsert = connection.insertInto(tCustomer).set({
        firstName: 'John',
        lastName: 'Smith',
        companyId: 1
    }).customizeQuery({
        beforeQuery: connection.rawFragment`/* before query */`,
        afterInsertKeyword: connection.rawFragment`/*+ some hints */`,
        afterQuery: connection.rawFragment`log errors reject limit unlimited`
    }).executeInsert()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    /* before query */ insert /*+ some hints */ 
    into customer (first_name, last_name, company_id) 
    values (?, ?, ?) 
    log errors reject limit unlimited
    ```
=== "MySQL"
    ```mysql
    /* before query */ insert /*+ some hints */ 
    into customer (first_name, last_name, company_id) 
    values (?, ?, ?) 
    log errors reject limit unlimited
    ```
=== "Oracle"
    ```oracle
    /* before query */ insert /*+ some hints */ 
    into customer (first_name, last_name, company_id) 
    values (:0, :1, :2) 
    log errors reject limit unlimited
    ```
===+ "PostgreSQL"
    ```postgresql
    /* before query */ insert /*+ some hints */ 
    into customer (first_name, last_name, company_id) 
    values ($1, $2, $3) 
    log errors reject limit unlimited
    ```
=== "SQLite"
    ```sqlite
    /* before query */ insert /*+ some hints */ 
    into customer (first_name, last_name, company_id) 
    values (?1, ?2, ?3) 
    log errors reject limit unlimited
    ```
=== "SQL Server"
    ```sqlserver
    /* before query */ insert /*+ some hints */ 
    into customer (first_name, last_name, company_id) 
    values (@0, @1, @2) 
    log errors reject limit unlimited
    ```

The parameters are: `[ 'John', 'Smith', 1 ]`

The result type is:
```tsx
const customizedInsert: Promise<number>
```

### Customizing an update

| Hook | What it writes |
|-------------------------|-----------------------------------------------------------------------|
| `beforeQuery`           | At the beginning of the query.                                        |
| `afterUpdateKeyword`    | Immediately after the `update` keyword, such as `or ignore` on SQLite. |
| `afterQuery`            | At the end of the query, after the `returning`.                       |
| `queryExecutionName`    | Nothing in the SQL: a name for the execution of the query.            |
| `queryExecutionMetadata`| Nothing in the SQL: any value for the execution of the query.         |

```ts
const customizedUpdate = connection.update(tCustomer).set({
        firstName: 'John',
        lastName: 'Smith'
    }).where(tCustomer.id.equals(10))
    .customizeQuery({
        beforeQuery: connection.rawFragment`/* before query */`,
        afterUpdateKeyword: connection.rawFragment`/*+ some hints */`,
        afterQuery: connection.rawFragment`keep plan`,
    })
    .executeUpdate()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    /* before query */ update /*+ some hints */ customer 
    set 
        first_name = ?, 
        last_name = ? 
    where id = ? 
    keep plan
    ```
=== "MySQL"
    ```mysql
    /* before query */ update /*+ some hints */ customer 
    set 
        first_name = ?, 
        last_name = ? 
    where id = ? 
    keep plan
    ```
=== "Oracle"
    ```oracle
    /* before query */ update /*+ some hints */ customer 
    set 
        first_name = :0, 
        last_name = :1 
    where id = :2 
    keep plan
    ```
===+ "PostgreSQL"
    ```postgresql
    /* before query */ update /*+ some hints */ customer 
    set 
        first_name = $1, 
        last_name = $2 
    where id = $3 
    keep plan
    ```
=== "SQLite"
    ```sqlite
    /* before query */ update /*+ some hints */ customer 
    set 
        first_name = ?1, 
        last_name = ?2 
    where id = ?3 
    keep plan
    ```
=== "SQL Server"
    ```sqlserver
    /* before query */ update /*+ some hints */ customer 
    set 
        first_name = @0, 
        last_name = @1 
    where id = @2 
    keep plan
    ```

The parameters are: `[ 'John', 'Smith', 10 ]`

The result type is:
```tsx
const customizedUpdate: Promise<number>
```

### Customizing a delete

| Hook | What it writes |
|-------------------------|-----------------------------------------------------------------------|
| `beforeQuery`           | At the beginning of the query.                                        |
| `afterDeleteKeyword`    | Immediately after the `delete` keyword.                               |
| `afterQuery`            | At the end of the query, after the `returning`.                       |
| `queryExecutionName`    | Nothing in the SQL: a name for the execution of the query.            |
| `queryExecutionMetadata`| Nothing in the SQL: any value for the execution of the query.         |

```ts
const customizedDelete = connection.deleteFrom(tCustomer)
    .where(tCustomer.id.equals(10))
    .customizeQuery({
        beforeQuery: connection.rawFragment`/* before query */`,
        afterDeleteKeyword: connection.rawFragment`/*+ some hints */`,
        afterQuery: connection.rawFragment`keep plan`,
    })
    .executeDelete()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    /* before query */ delete /*+ some hints */ 
    from customer 
    where id = ? 
    keep plan
    ```
=== "MySQL"
    ```mysql
    /* before query */ delete /*+ some hints */ 
    from customer 
    where id = ? 
    keep plan
    ```
=== "Oracle"
    ```oracle
    /* before query */ delete /*+ some hints */ 
    from customer 
    where id = :0 
    keep plan
    ```
===+ "PostgreSQL"
    ```postgresql
    /* before query */ delete /*+ some hints */ 
    from customer 
    where id = $1 
    keep plan
    ```
=== "SQLite"
    ```sqlite
    /* before query */ delete /*+ some hints */ 
    from customer 
    where id = ?1 
    keep plan
    ```
=== "SQL Server"
    ```sqlserver
    /* before query */ delete /*+ some hints */ 
    from customer 
    where id = @0 
    keep plan
    ```

The parameters are: `[ 10 ]`

The result type is:
```tsx
const customizedDelete: Promise<number>
```
### A name and metadata for the execution

`queryExecutionName` and `queryExecutionMetadata` don't change the SQL. They reach your [query runner](../configuration/query-runners/general-purpose/InterceptorQueryRunner.md), which reads them in the context of the query, as [`executionName`](../advanced/query-execution-metadata.md#retrieve-the-execution-name-of-a-query) and [`executionMetadata`](../advanced/query-execution-metadata.md#retrieve-additional-execution-metadata), for example to measure each query with a name you recognize. The other statements have them too.

```ts
const customersOfTheList = connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id
    })
    .customizeQuery({
        queryExecutionName: 'Customers of the list',
        queryExecutionMetadata: { screen: 'customer-list' }
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select id as id 
    from customer
    ```
=== "MySQL"
    ```mysql
    select id as id 
    from customer
    ```
=== "Oracle"
    ```oracle
    select id as "id" 
    from customer
    ```
===+ "PostgreSQL"
    ```postgresql
    select id as id 
    from customer
    ```
=== "SQLite"
    ```sqlite
    select id as id 
    from customer
    ```
=== "SQL Server"
    ```sqlserver
    select id as id 
    from customer
    ```

The parameters are: `[]`
