---
search:
  boost: 1.5
---
# Order and page from a request

The order of a list and the page being shown usually come from outside your code: the column the user clicked, the number of the page. The order arrives as text, and any of these values can be missing, so a query needs methods that receive them as they come.

| What arrives | What to use |
|---|---|
| The order, as text | [`orderByFromString`](#order-by-from-a-string) |
| The order, as a list of clauses, or something that may be missing | [The variants of orderByFromString](#the-variants-of-orderbyfromstring) |
| The limit and the offset, which may be missing | [`limitIfValue`, `offsetIfValue`](#optional-limit-and-offset) |

What arrives as text never becomes SQL: a name is only accepted if it's a property of the select. [Queries from a request](queries-from-requests.md) puts this together with the filter, and [`OrderByForModel`](utilities/order-by.md) checks the order when compiling.

## Order by from a string

`orderByFromString` receives the order as text, as it would come in a request. It has the syntax of an SQL `order by`, but it uses the **names of the properties of the select**, not the columns of the table. So the request can't name anything that the select doesn't return, and the structure of the database isn't exposed:

```ts
const orderBy = 'lastName desc, firstName insensitive';

const customers = await connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName
    })
    .orderByFromString(orderBy)
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    order by 
        lastName desc, 
        lower(first_name)
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    order by 
        lastName desc, 
        lower(first_name)
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    order by 
        "lastName" desc, 
        lower("firstName")
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    order by 
        "lastName" desc, 
        lower(first_name)
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    order by 
        lastName desc, 
        lower(first_name)
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    order by 
        lastName desc, 
        lower(first_name)
    ```

The parameters are: `[]`

The text is a list of clauses separated by commas. Each one is a property of the select followed by a mode, and with no mode the order is ascending. Upper and lower case don't matter, nor do extra spaces: `'  LASTNAME   DESC '` is `lastName desc`. A property inside a nested object of the select is written with a dot, like `'company.name desc'`.

These are all the accepted forms, for a property called `name`:

| Order | Rows without a value where the database puts them | Rows without a value first | Rows without a value last |
|---|---|---|---|
| Ascending | `name`, `name asc` | `name asc nulls first` | `name asc nulls last` |
| Descending | `name desc` | `name desc nulls first` | `name desc nulls last` |
| Ascending, not distinguishing upper and lower case | `name insensitive`, `name asc insensitive` | `name asc nulls first insensitive` | `name asc nulls last insensitive` |
| Descending, not distinguishing upper and lower case | `name desc insensitive` | `name desc nulls first insensitive` | `name desc nulls last insensitive` |

The words must be in that order. They mean the same as in [the order modes](../queries/select.md#the-order-modes) of `orderBy`, which explains what each one does in each database, and what `insensitive` does.

### The variants of orderByFromString

| Method | Receives | What it does |
|---|---|---|
| `orderByFromString` | `string` | Orders by the clauses of the text |
| `orderByFromStringArray` | `readonly string[]` | The same, when the clauses are already separated. Each element is one clause, so it can't have commas. An empty array adds no order |
| `orderByFromStringIfValue` | `string \| null \| undefined` | Like `orderByFromString`, but without a value it adds no order |
| `orderByFromStringArrayIfValue` | `ReadonlyArray<string \| null \| undefined> \| null \| undefined` | Like `orderByFromStringArray`, but without a value it adds no order, and it skips the elements of the array without a value |

```ts
const orderBy: Array<string | null | undefined> = ['lastName desc', null, 'firstName insensitive'];

const customers = await connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName
    })
    .orderByFromStringArrayIfValue(orderBy)
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    order by 
        lastName desc, 
        lower(first_name)
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    order by 
        lastName desc, 
        lower(first_name)
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    order by 
        "lastName" desc, 
        lower("firstName")
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    order by 
        "lastName" desc, 
        lower(first_name)
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    order by 
        lastName desc, 
        lower(first_name)
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    order by 
        lastName desc, 
        lower(first_name)
    ```

The parameters are: `[]`

They can be combined with `orderBy` and with each other: each call adds its clauses after the ones already there. They can also be used after a [compound operator](../queries/compound-select.md#ordering-the-combined-result).

If you can describe the accepted order with a type, [`OrderByForModel`](utilities/order-by.md) checks it when compiling.

### An order that can't be understood

A text that can't be understood is an error, and nothing is sent to the database:

| `errorReason.reason` | When | Examples | Other properties of `errorReason` |
|---|---|---|---|
| `ORDER_BY_COLUMN_NOT_IN_SELECT` | The name isn't a property of the select. This includes the name of a column of the table, a nested object as a whole, and an empty clause | `'unknown'`, `'first_name'`, `'company'`, `''`, `'id,'` | `column` |
| `INVALID_ORDER_BY_ORDERING` | The mode isn't one of the table above | `'name sideways'`, `'name nulls first'`, `'name insensitive desc'` | `column`, `ordering` |

The values in `column` and `ordering` are in lower case, because the text is converted to lower case before reading it.

Unlike the errors of an execution, these two don't arrive through the promise: the call to `orderByFromString` throws them while the query is being written, so a `.catch` on `executeSelectMany()` doesn't see them. When the order comes from a request, wrap the whole query in a `try` and answer with an error for the request:

```ts
import { TsSqlError } from "ts-sql-query" // or "ts-sql-query/TsSqlError"

const orderBy: string = 'firstName sideways';

try {
    await connection.selectFrom(tCustomer)
        .select({
            id: tCustomer.id,
            firstName: tCustomer.firstName
        })
        .orderByFromString(orderBy)
        .executeSelectMany();
} catch (e) {
    if (e instanceof TsSqlError && (e.errorReason.reason === 'ORDER_BY_COLUMN_NOT_IN_SELECT' || e.errorReason.reason === 'INVALID_ORDER_BY_ORDERING')) {
        console.log('The order of the request is not valid, column: ' + e.errorReason.column);
    } else {
        throw e;
    }
}
```

## Optional limit and offset

`limitIfValue` and `offsetIfValue` are `limit` and `offset` for a value that may be absent. Without a value they do nothing. As in the rest of the family, `null` and `undefined` have no value, while `0` does:

| Call | Result |
|---|---|
| `limitIfValue(10)` | At most 10 rows |
| `limitIfValue(0)` | Asks for no rows |
| `limitIfValue(null)` | No limit |
| `offsetIfValue(20)` | Skips 20 rows |
| `offsetIfValue(0)` | Skips none, and the `offset` is written in the SQL |
| `offsetIfValue(undefined)` | No offset |

This query joins them with the other optional parts, for a list that receives everything from a request:

```ts
const request: { name?: string, orderBy?: string, limit?: number, offset?: number } = { name: 'ohn', limit: 10 };

const customers = await connection.selectFrom(tCustomer)
    .where(tCustomer.firstName.containsIfValue(request.name))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .orderByFromStringIfValue(request.orderBy)
    .limitIfValue(request.limit)
    .offsetIfValue(request.offset)
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where first_name like concat('%', ?, '%') 
    limit ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where first_name like concat('%', ?, '%') 
    limit ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName" 
    from customer 
    where first_name like ('%' || :0 || '%') escape '\' 
    fetch next :1 rows only
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName" 
    from customer 
    where first_name like ('%' || $1 || '%') 
    limit $2
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where first_name like ('%' || ?1 || '%') escape '\' 
    limit ?2
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where first_name like ('%' + @0 + '%') 
    order by 1 
    offset 0 rows 
    fetch next @1 rows only
    ```

The parameters are: `[ 'ohn', 10 ]`

[Select page](../queries/select-page.md) explains how a page is defined, why it must be ordered, and how to get the total of rows too.
