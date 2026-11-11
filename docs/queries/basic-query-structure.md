---
search:
  boost: 3
---
# Basic query structure

A query is a chain of method calls, and each call is a clause of the SQL: `selectFrom(tCustomer)` is the `from customer`, `where(...)` is the `where`, and so on. Nothing is sent to the database while you write the chain: the query runs when you call one of the `execute` methods.

This page shows how a query reads against its SQL, what each clause is for and in which order the clauses are written. The [Select](select.md) page explains the joins, the order by and the ways of executing a select.

## How a query reads against its SQL

```ts
const customers = connection.selectFrom(tCustomer)
    .innerJoin(tCompany).on(tCustomer.companyId.equals(tCompany.id))
    .where(tCompany.name.equals('ACME'))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        companyName: tCompany.name
    })
    .orderBy('firstName')
    .limit(10)
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        company.name as companyName 
    from customer 
    inner join company on customer.company_id = company.id 
    where company.name = ? 
    order by firstName 
    limit ?
    ```
=== "MySQL"
    ```mysql
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        company.name as companyName 
    from customer 
    inner join company on customer.company_id = company.id 
    where company.name = ? 
    order by firstName 
    limit ?
    ```
=== "Oracle"
    ```oracle
    select 
        customer.id as "id", 
        customer.first_name as "firstName", 
        company.name as "companyName" 
    from customer 
    inner join company on customer.company_id = company.id 
    where company.name = :0 
    order by "firstName" 
    fetch next :1 rows only
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.id as id, 
        customer.first_name as "firstName", 
        company.name as "companyName" 
    from customer 
    inner join company on customer.company_id = company.id 
    where company.name = $1 
    order by "firstName" 
    limit $2
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        company.name as companyName 
    from customer 
    inner join company on customer.company_id = company.id 
    where company.name = ?1 
    order by firstName 
    limit ?2
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        company.name as companyName 
    from customer 
    inner join company on customer.company_id = company.id 
    where company.name = @0 
    order by firstName 
    offset 0 rows fetch next @1 rows only
    ```

The parameters are: `[ 'ACME', 10 ]`

The result type is:
```tsx
const customers: Promise<{
    id: number;
    firstName: string;
    companyName: string;
}[]>
```

Reading one against the other:

- Each property of `select({...})` is a column of the SQL, and its name is the alias of the column and the property of each row in the result.
- The tables speak in TypeScript names, like `tCustomer.firstName`, and the SQL has the names of the database, like `first_name`.
- The values, like `'ACME'` and `10`, travel as parameters: they aren't part of the SQL text.
- `orderBy('firstName')` refers to the property of the select.
- `select` is written after `where` in the chain, and it comes first in the SQL. The library puts each clause in the place SQL requires.

## What each clause is for

The clauses are listed in the order in which a database works with them, which isn't the order of the SQL text:

| Clause | Method | What it's for |
|---|---|---|
| `from` | `selectFrom(table)` | The table the rows come from. |
| `join` | `innerJoin(table).on(...)`, `leftJoin(table).on(...)`... | Adds the columns of the related rows of another table. See [the kinds of join](select.md#the-kinds-of-join). |
| `where` | `where(...)`, then `and(...)` and `or(...)` | Keeps only the rows that meet the condition. |
| `group by` | `groupBy(...)` | Makes one row of each group of rows with the same values. See [Aggregate functions, group by and having](aggregate-and-group-by.md). |
| `having` | `having(...)` | Keeps only the groups that meet the condition: it's a `where` for the groups, and it can use aggregates like `count`. |
| `select` | `select({...})`, `selectOneColumn(...)`, `selectCountAll()` | The values that each row of the result has, and their names. |
| `distinct` | `selectDistinctFrom(table)` | Removes the repeated rows from the result. See [Select distinct](select.md#select-distinct). |
| `order by` | `orderBy(...)` | The order of the rows. Without it, the database can return them in any order. See [Select with joins](select.md#select-with-joins). |
| `limit`, `offset` | `limit(...)`, `offset(...)` | How many rows to return, and how many to skip first. See [Limit and offset](select.md#limit-and-offset). |

The conditions added with `and` and `or` compose as they are written, whatever the priority of `and` over `or` in SQL; the library adds the parentheses that are needed:

- `.where(a).or(b).and(c)` is `(a or b) and c`.
- `.where(a).and(b).or(c)` is `(a and b) or c`.

A query can also be [combined with another one](compound-select.md), [use other queries](cte-subqueries.md), [walk a hierarchy](recursive-select.md), or [add raw SQL](sql-fragments.md#customizing-a-select).

## The order of the clauses

Writing the clauses in another order doesn't change the SQL. These two queries send the same SQL and the same parameters, with the `where` in its place:

```ts
const whereFirst = connection.selectFrom(tCustomer)
    .where(tCustomer.companyId.equals(10))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .orderBy('firstName');

const whereLast = connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .orderBy('firstName')
    .where(tCustomer.companyId.equals(10));
```

The order matters for three reasons:

- **A clause out of place doesn't compile.** Each method returns only what can come next, so the joins must be written before the `where`, `orderBy` isn't available before the `select`, and `offset` isn't available before the `limit`. When TypeScript says that a method doesn't exist on the query, this is usually the reason.
- **Writing the `where` at the end lets you reuse a query:** a function can return the query without the `where`, and each caller adds its own. See [How can I organize my code to reuse some queries in different places?](../about/faqs.md#how-can-i-organize-my-code-to-reuse-some-queries-in-different-places).
- **Writing the `select` before the `groupBy` lets you refer to the columns of the select,** by [their names in the `groupBy`](aggregate-and-group-by.md#grouping-by-the-columns-of-the-select) and [in the `having`](aggregate-and-group-by.md#filtering-the-groups-by-the-columns-of-the-select).

The list of all the valid orders is in [The order of the clauses](select.md#the-order-of-the-clauses).

## Select one row

```ts
const customerId = 10;

const customerWithId = connection.selectFrom(tCustomer)
    .where(tCustomer.id.equals(customerId))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday
    })
    .executeSelectOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as "birthday" 
    from customer 
    where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as birthday 
    from customer 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = @0
    ```

The parameters are: `[ 10 ]`

The result type is:
```tsx
const customerWithId: Promise<{
    id: number;
    firstName: string;
    lastName: string;
    birthday?: Date;
}>
```

`executeSelectOne` returns one row, and its promise rejects when the database doesn't return any. To get `null` when the row isn't found, use `executeSelectNoneOrOne`. All the ways of executing a select are in [Executing a select](select.md#executing-a-select).

## Projecting optional values

By default, when an object is returned, optional values will be projected as optional properties in TypeScript, like `birthday?: Date`; when the value is absent, the property will not be set. However, you can change this behaviour so that all properties are always present, even if they contain `null`, like `birthday: Date | null` where, in case there is no value, the property will be set as null. To change this behaviour, call `projectingOptionalValuesAsNullable()` immediately after defining the projected columns with `select({...})`.

```ts
const customerId = 10;

const customerWithId = connection.selectFrom(tCustomer)
    .where(tCustomer.id.equals(customerId))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday
    })
    .projectingOptionalValuesAsNullable()
    .executeSelectOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as "birthday" 
    from customer 
    where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as birthday 
    from customer 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where id = @0
    ```

The parameters are: `[ 10 ]`

The result type is:
```tsx
const customerWithId: Promise<{
    id: number;
    firstName: string;
    lastName: string;
    birthday: Date | null;
}>
```

!!! note

    Projecting always-required properties that allow null values works in the same way with insert, update or deletes if you call `projectingOptionalValuesAsNullable()` immediately after `returning(...)`. This also applies to `connection.aggregateAsArray(...).projectingOptionalValuesAsNullable()`.

## Constant values

A value that doesn't come from a table is written as a constant with `connection.const(value, type)`; the type is the [column type](../configuration/column-types.md) of the value. When the value can be `null` or `undefined`, use `connection.optionalConst(value, type)`: the constant is optional, like an optional column.

```ts
const noteForTheCustomer: string | null = null;

const customerWithNote = await connection.selectFrom(tCustomer)
    .where(tCustomer.id.equals(10))
    .select({
        id: tCustomer.id,
        source: connection.const('import', 'string'),
        note: connection.optionalConst(noteForTheCustomer, 'string')
    })
    .executeSelectOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id,
        ? as source,
        ? as note
    from customer
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id,
        ? as source,
        ? as note
    from customer
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id",
        :0 as "source",
        :1 as "note"
    from customer
    where id = :2
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id,
        $1::text as source,
        $2::text as note
    from customer
    where id = $3
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id,
        ?1 as source,
        ?2 as note
    from customer
    where id = ?3
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id,
        @0 as source,
        @1 as note
    from customer
    where id = @2
    ```

The parameters are: `[ 'import', null, 10 ]`

The result type is:
```tsx
const customerWithNote: Promise<{
    id: number;
    source: string;
    note?: string;
}>
```

## Queries that depend on what arrives

Everything so far has a fixed shape. A query can also change with what arrives while the program runs: a condition disappears when its value is missing, the order comes from a request, and a table is joined only if something uses it. You don't need `if`s to assemble it: see [Dynamic queries](dynamic-queries.md).

It goes further than that: the filter can arrive as an object, and the caller can choose the columns that come back. See [What a dynamic query can do](../dynamic/building-blocks.md).

## Other options

A select is executed with `executeSelectNoneOrOne()`, `executeSelectOne()`, `executeSelectMany()` or `executeSelectPage()`: see what each one returns and when it fails in [Executing a select](select.md#executing-a-select), and the details of the last one in [Select page](select-page.md).

To return the value of a single column instead of an object, use [`selectOneColumn(column)`](select.md#select-one-column) instead of `select({...})`; to return `count(*)`, use [`selectCountAll()`](select.md#select-count-all).

To see the SQL a query will run and its parameters, without executing it, call `query()` and `params()` on it (every query has them: select, insert, update and delete):

```ts
const customerQuery = connection.selectFrom(tCustomer)
    .where(tCustomer.id.equals(10))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    });

const sql = customerQuery.query();   // on PostgreSQL: select id as id, first_name as "firstName" from customer where id = $1
const params = customerQuery.params(); // [ 10 ]
```
