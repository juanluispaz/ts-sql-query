---
search:
  boost: 4
---
# Select
 
A select reads rows from the database. This page explains what you can ask for beyond the [basic structure](basic-query-structure.md): reading from several tables, ordering the rows, removing the repeated ones, returning a part of them or a single value, and which method to use to execute the select depending on how many rows you expect.

The rest of the features have their own pages: [aggregates and group by](aggregate-and-group-by.md), [compound selects](compound-select.md), [CTEs and subqueries](cte-subqueries.md), [recursive selects](recursive-select.md), [pages of rows](select-page.md) and [complex projections](complex-projections.md).

## The kinds of join

A join adds to each row the columns of the related rows of another table, and `on(...)` says which rows are related. The kinds of join differ in what happens to a row that has no related row:

| Method | SQL | The rows it keeps |
|---|---|---|
| `join`, `innerJoin` | `join`, `inner join` | Only the rows that have a related row. The others are dropped. |
| `leftJoin`, `leftOuterJoin` | `left join`, `left outer join` | All the rows of the left side. When a row has no related row, the columns of the joined table are `null`. |
| [`optionalJoin`, `optionalInnerJoin`, `optionalLeftJoin`, `optionalLeftOuterJoin`](#optional-joins) | The same, or nothing | The same, but the join is written only when the query uses the joined table. |

The two names of each kind are the same join; the only difference is the word written in the SQL.

These are the results of joining each company with its parent, in a table of companies that has `Acme` without a parent, and `Acme Spain` and `Acme France` with `Acme` as their parent:

| Join | Company | Parent |
|---|---|---|
| `innerJoin` | `Acme Spain` | `Acme` |
| | `Acme France` | `Acme` |
| `leftJoin` | `Acme` | `null` |
| | `Acme Spain` | `Acme` |
| | `Acme France` | `Acme` |

So an inner join removes a row when it has no related row, which includes the rows where the column of the `on` is `null`, because `null` is not equal to any value. Use a left join when the related row may not exist and you want the row anyway.

Neither of them keeps the number of rows when a row has several related rows: it appears once for each of them. Joining each company with its children returns `Acme` twice, once for `Acme Spain` and once for `Acme France`.

The same table can be used twice in a query only with different names. `tCompany.as('parent')` gives a table another name for an inner join, and `tCompany.forUseInLeftJoinAs('parent')` for a left join.

`on` accepts `and(...)` and `or(...)` after it to add more conditions. To build the condition while the query is built, see [`dynamicOn`](../dynamic/building-conditions.md#dynamic-join-conditions-and-having).

There are no methods for a `right join`, which you can write as a left join starting from the other table, or for a `full join`.

### Several tables in the from

`from(...)` adds another table to the `from`, with no condition of its own: the database combines each row of one table with each row of the other one, and the `where` says which combinations to keep. With the condition below, it returns the same rows as an inner join; without a `where`, it returns all the combinations. A select with a second `from` can't have joins.

```ts
const customersWithCompany = connection.selectFrom(tCustomer)
    .from(tCompany)
    .where(tCustomer.companyId.equals(tCompany.id))
    .select({
        id: tCustomer.id,
        companyName: tCompany.name
    })
    .executeSelectMany();
```

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

Without an `orderBy`, the database can return the rows in any order. Each call to `orderBy` adds a criterion, and each criterion only decides between the rows that are tied in the previous ones.

### What you can order by

`orderBy` receives one of these, followed by the [order mode](#the-order-modes):

- **The name of a property of the select**, like `'firstName'`, or its path in a [complex projection](complex-projections.md), like `'company.name'`. The name is checked by the compiler. When the select has [one column](#select-one-column), the name is `'result'`.
- **A column or an expression**, which doesn't need to be returned: see [Select ordering by a not returned column](#select-ordering-by-a-not-returned-column).
- **A [raw SQL fragment](sql-fragments.md#raw-fragments)**, for what the library has no method for.

```ts
const customersInOrder = await connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName
    })
    .orderBy('lastName', 'desc')
    .orderBy(tCustomer.birthday, 'asc nulls last')
    .orderBy(connection.rawFragment`lower(${tCustomer.firstName})`)
    .executeSelectMany();
```

When the order comes from outside your code, like a request from a user, use `orderByFromString(...)` or `orderByFromStringArray(...)`, which receive the same names and modes as text: see [Order by from a string](dynamic-queries.md#order-by-from-a-string).

### The order modes

The mode is the second argument of `orderBy`, like `.orderBy('name', 'desc nulls last insensitive')`. Without it, the order is ascending:

| Mode | Order | Rows without a value | Upper and lower case |
|---|---|---|---|
| `asc` | From the lowest to the highest | Where the database puts them | As the collation says |
| `desc` | From the highest to the lowest | Where the database puts them | As the collation says |
| `asc nulls first` | From the lowest to the highest | First | As the collation says |
| `asc nulls last` | From the lowest to the highest | Last | As the collation says |
| `desc nulls first` | From the highest to the lowest | First | As the collation says |
| `desc nulls last` | From the highest to the lowest | Last | As the collation says |
| `insensitive` | From the lowest to the highest | Where the database puts them | Not distinguished |
| `asc insensitive` | From the lowest to the highest | Where the database puts them | Not distinguished |
| `desc insensitive` | From the highest to the lowest | Where the database puts them | Not distinguished |
| `asc nulls first insensitive` | From the lowest to the highest | First | Not distinguished |
| `asc nulls last insensitive` | From the lowest to the highest | Last | Not distinguished |
| `desc nulls first insensitive` | From the highest to the lowest | First | Not distinguished |
| `desc nulls last insensitive` | From the highest to the lowest | Last | Not distinguished |

`nulls first` and `nulls last` say where the rows without a value go. Without them, the place of the nulls depends on the database: with `asc`, MariaDB, MySQL, SQLite and SQL Server put them first, and PostgreSQL puts them last. Say it explicitly when it matters.

On the databases that don't have `nulls first` or `nulls last`, the library writes an order by that gives the same result.

`insensitive` orders the text without distinguishing upper and lower case. Whether a text is ordered that way depends on its [collation](../configuration/collations.md): with a case-sensitive one, the usual in PostgreSQL, SQLite and Oracle, the upper case letters can go together before the lower case ones, so you get `Bea, Carla, ana`, while the insensitive order is `ana, Bea, Carla`. It's written `lower(column)`, or `column collate <name>` when the connection has an [`insensitiveCollation`](../configuration/collations.md#the-tools). A database can't use a plain index on the column for an order written that way, so if the column is already case-insensitive you don't need it. In a column that isn't text, `insensitive` is ignored.

## Select ordering by a not returned column

`orderBy` also accepts a column or an expression, so you can order by a value that the select doesn't return:

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

A left join keeps the rows that have no related row, so any column of the joined table can be `null`, even a required one. The types must say so, which is why a left join can't receive the table itself, and passing it doesn't compile: you must create a left join representation first by calling the method `forUseInLeftJoin()`, or `forUseInLeftJoinAs('name')` to also give it another name. It's a copy of the table where all the columns are optional.

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

In this example, `parentId` and `parentName` are optional in the result, although `id` and `name` are required in the table. A company without a parent doesn't have those properties.

!!! tip

    You can project optional values in objects as always-required properties that allow `null` by calling `projectingOptionalValuesAsNullable()` immediately after `select(...)`. This transformation only affects the resulting TypeScript type — the generated SQL remains unchanged. Instead of using optional fields (`?`), all properties are treated as required but typed as potentially `null`, which can simplify downstream type checks when dealing with partial or outer-joined data.

### A condition in the on or in the where

In a left join, the place of a condition about the joined table changes the result. Take the companies whose parent is called `Acme`.

In the `on`, the condition decides which rows are related, so all the companies are kept; `parentName` has a value only in the ones with that parent:

```ts
const parent = tCompany.forUseInLeftJoinAs('parent');

const companies = await connection.selectFrom(tCompany)
    .leftJoin(parent).on(tCompany.parentId.equals(parent.id))
        .and(parent.name.equals('Acme'))
    .select({
        name: tCompany.name,
        parentName: parent.name
    })
    .executeSelectMany();
```

In the `where`, the condition is checked after the join, on all the rows. The rows without a parent have `null` there, the condition isn't met, and they are removed, so the result is the same as with an inner join:

```ts
const parent = tCompany.forUseInLeftJoinAs('parent');

const companies = await connection.selectFrom(tCompany)
    .leftJoin(parent).on(tCompany.parentId.equals(parent.id))
    .where(parent.name.equals('Acme'))
    .select({
        name: tCompany.name,
        parentName: parent.name
    })
    .executeSelectMany();
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

## Optional joins

An optional join is written in the SQL only when the query uses the joined table: for example, when one of its columns is selected, or when it's in a `where` condition that wasn't removed because it has no value. It's meant for queries whose columns or conditions are decided while the query runs, so a table that isn't needed isn't read. See [Optional joins](../dynamic/optional-joins.md) for its use.

Leaving out an inner join also changes which rows are returned: the rows that it would drop are no longer dropped.

## Select with a compound operator (union, intersect, except)

The result of several selects can be combined with `union`, `intersect` and `except`: see [Compound select](compound-select.md).

## CTE (with clause) and subqueries

A select can be used inside another one, as a value, in a condition or as a view with a Common Table Expression (the SQL `with` clause): see [CTE (with clause) & subqueries](cte-subqueries.md).

## Select distinct

`selectDistinctFrom(table)` starts a select that removes the repeated rows from the result. Two rows are the same when all the columns of the select have the same value, and in this comparison two nulls are taken as the same value. So use it with the columns whose repetition you want to remove: if the select includes a value that identifies the row, like the id, nothing is removed.

```ts
const firstNames = connection.selectDistinctFrom(tCustomer)
    .select({
        firstName: tCustomer.firstName
    })
    .orderBy('firstName')
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select distinct first_name as firstName 
    from customer 
    order by firstName
    ```
=== "MySQL"
    ```mysql
    select distinct first_name as firstName 
    from customer 
    order by firstName
    ```
=== "Oracle"
    ```oracle
    select distinct first_name as "firstName" 
    from customer 
    order by "firstName"
    ```
===+ "PostgreSQL"
    ```postgresql
    select distinct first_name as "firstName" 
    from customer 
    order by "firstName"
    ```
=== "SQLite"
    ```sqlite
    select distinct first_name as firstName 
    from customer 
    order by firstName
    ```
=== "SQL Server"
    ```sqlserver
    select distinct first_name as firstName 
    from customer 
    order by firstName
    ```

The parameters are: `[]`

The result type is:
```tsx
const firstNames: Promise<{
    firstName: string;
}[]>
```

Order a distinct select by the properties of the select: a column that isn't returned can have several values in the row that remains, and PostgreSQL rejects the query.

To do the same in a subquery that refers to the outer query, use [`subSelectDistinctUsing`](cte-subqueries.md#inline-subquery-with-distinct-values-referencing-outer-query).

## Select one column

`selectOneColumn(column)` is written instead of `select({...})` when you want only one value from each row. The result is the value itself instead of an object with a property: `string` instead of `{ firstName: string }`, and `string[]` with `executeSelectMany`. It accepts any value that can be a column of a select, like an expression or an aggregate.

```ts
const firstNames = await connection.selectFrom(tCustomer)
    .selectOneColumn(tCustomer.firstName)
    .orderBy('result')
    .executeSelectMany();
```

In SQL the column is called `result`, and this is the name to use in `orderBy`.

With an optional column there is no property to leave out, so a missing value is `null`. In `selectFrom(tCustomer).selectOneColumn(tCustomer.birthday)`, the rows have the type `Date | null`. This also means that `executeSelectNoneOrOne` returns `null` both when there's no row and when the row has no value; if you need to tell them apart, use `select({...})`.

## Limit and offset

`limit(n)` returns at most `n` rows, and `offset(n)` skips the first `n` rows. Both apply after the order, so without an `orderBy` the database decides which rows you get. `offset` is written after `limit`.

`limitIfValue` and `offsetIfValue` do the same but they ignore `null` and `undefined`. So `limitIfValue(undefined).offset(10)` is how you write an offset without a limit.

[Select page](select-page.md#limit-and-offset) explains how to use them to read a list page by page, together with the total of rows.

## Executing a select

The method that executes the select says how many rows you expect, and it's what decides the type of the result. The library checks the rows it receives; it doesn't add anything to the query to get fewer of them.

| Method | Minimum rows | Maximum rows | Returns | When there are too few or too many rows |
|---|---|---|---|---|
| `executeSelectNoneOrOne()` | 0 | 1 | The row, or `null` when there's none | More than one: error `MORE_THAN_ONE_ROW` |
| `executeSelectOne()` | 1 | 1 | The row | None: error `NO_RESULT`. More than one: error `MORE_THAN_ONE_ROW` |
| `executeSelectMany()` | 0 | No maximum | An array of rows, empty when there's none | Never |
| `executeSelectPage()` | 0 | No maximum | `{ data, count }`: the rows and the total | Never. See [Select page](select-page.md) |

The error is a rejected promise with a [`TsSqlError`](../api/error-management/overview.md), and the name above is in `errorReason.reason`.

To choose between them:

- Use `executeSelectOne` when the row must exist, like reading by the id something you know is there. If it isn't, that's an error in your program.
- Use `executeSelectNoneOrOne` when the row may not exist, like looking for a customer by email.
- Use `executeSelectMany` for anything else.

`executeSelectOne` and `executeSelectNoneOrOne` don't choose a row when there are several: they throw an error. To get the first row of a list, say which one it is with `orderBy` and `limit(1)`:

```ts
const lastCustomer = await connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .orderBy('id', 'desc')
    .limit(1)
    .executeSelectNoneOrOne();
```

## Select count all

`selectCountAll()` returns the number of rows that the select finds. The result is a single number, so it's executed with `executeSelectOne`; without a `group by`, the query always returns one row, with `0` when no rows are found.

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

`selectFromNoTable()` starts a select that has no `from`: its columns are values that don't come from a table, like the result of subqueries, functions or constants. The result has one row, so it's executed with `executeSelectOne`. For example, two counts in a single query:

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

The clauses can be written in several orders, and the library generates the SQL in the order SQL requires. [The order of the clauses](basic-query-structure.md#the-order-of-the-clauses) explains why it's useful.

Part of the order is fixed: the `from` and the joins go first, and `order by`, `limit`, `offset` and `customizeQuery` go in this order after the `select`. `having` goes right after its `group by`. What can move is the `where`, and the `select` around the `group by`.

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
