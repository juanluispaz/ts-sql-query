---
search:
  boost: 1.5
---
# Restricting values

Which values can be seen often depends on who asks. A list can have less detail for some roles, and a field can need a permission. There are two ways of handling a value the user can't see: hide it and keep the column, or refuse the query that uses it.

## Hide a value keeping the column

`onlyWhenOrNull(when)` keeps the value when `when` is true, and otherwise replaces it with a null constant in the query. `ignoreWhenAsNull(when)` is the same with the boolean inverted. The query keeps its columns, so its shape doesn't depend on the user. A hidden value is a null for the rest of the query too: a filter on it can't find out what the column holds. [Ignorable values: onlyWhenOrNull](../queries/dynamic-queries.md#ignorable-values-onlywhenornull) shows the code and the SQL. They are different from `onlyWhen` and `ignoreWhen`, which [remove a condition](../queries/dynamic-queries.md#ignorable-conditions-onlywhen-and-ignorewhen).

This is what happens with the birthday of a user who can't see it, with each way of handling it:

| Written in the code | The query | The result |
|---|---|---|
| `birthday` left out of a [pick](picks.md) | Has no column for it | The row has no `birthday` |
| `tCustomer.birthday.onlyWhenOrNull(false)` or `tCustomer.birthday.ignoreWhenAsNull(true)` | Has a null constant in its place | The row has no `birthday` |
| `tCustomer.birthday.allowWhen(false, '...')` or `tCustomer.birthday.disallowWhen(true, '...')`, and the query uses it | Isn't sent | The promise is rejected |
| The same, and the query doesn't use it, for example because it wasn't picked | Has no column for it | The row has no `birthday` |

Choose `onlyWhenOrNull` when not seeing a value is normal, like a list with less detail for some roles, and the caller doesn't need to tell it apart from a customer with no birthday. Choose [`allowWhen`](#refuse-a-query-that-uses-a-value) when asking for it is a mistake that should be noticed. All of these receive a boolean of your code, so they apply to the whole query, not to each row.

## Refuse a query that uses a value

Use this when a value can be used only under some circumstances, like a column that needs a permission. `allowWhen(when, error)`, available in every value, leaves the value as it is while `when` is true. When it's false, the value can be written in your code, but it can't be part of a query: if a query needs it, the query isn't sent to the database and you get the error. `disallowWhen(when, error)` is the same with the boolean inverted.

This protects a list of fields that comes from outside your code, as an endpoint with `?fields=` does. While the client asks for what they may see, it's as if `allowWhen` weren't there. If they ask for a restricted field, because of a missing check, a wrong client, or an attempt to reach restricted data, nothing reaches the database.

It works wherever the query needs the value: in the `select`, in a `where`, `having`, `on`, `group by` or `order by`, in a subquery, a [common table expression](../queries/cte-subqueries.md), an [aggregate](../queries/aggregate-as-object-array.md), any select of a [compound select](../queries/compound-select.md), a [dynamic filter](filters.md), or an insert, update or delete.

The error arrives through the promise of the execute method, in a form that depends on what you pass:

| You pass | What the promise is rejected with |
|---|---|
| A text | A [`TsSqlQueryExecutionError`](../api/error-management/library-raised-errors.md), with `errorReason` being `{ reason: 'DISALLOWED', message: <your text>, functionName: 'allowWhen' }` or `'disallowWhen'`. Its `message` is `DISALLOWED: <your text>`, and its `cause` is the original `TsSqlProcessingError` |
| An `Error` | That same object |

`query()` and `params()` don't return a promise, so they throw directly: the `TsSqlProcessingError` for a text, and your object for an `Error`.

A typical handler of an HTTP request, which answers with your text:

```ts
import { TsSqlError } from "ts-sql-query"

try {
    const rows = await connection.selectFrom(tCustomer)
        .select(dynamicPick(availableFields, req.body.fields, ['id']))
        .executeSelectMany()
    res.json(rows)
} catch (e) {
    if (e instanceof TsSqlError && e.errorReason.reason === 'DISALLOWED') {
        res.status(403).json({ error: e.errorReason.message })
        return
    }
    throw e
}
```

With your own error you recognize it by its class:

```ts
class NoPermissionError extends Error {}

const canSeeBirthday = false

const customers = connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id,
        birthday: tCustomer.birthday.allowWhen(canSeeBirthday, new NoPermissionError('You can\'t see the birthday'))
    })
    .executeSelectMany()

customers.catch((e) => {
    if (e instanceof NoPermissionError) {
        // The query wasn't sent
    }
})
```

In this example the restricted column isn't picked, so the query runs:

```ts
import { dynamicPick, dynamicPickPaths } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"

const birthdayVisible = false

const availableFields = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName,
    birthday: tCustomer.birthday.allowWhen(birthdayVisible, "You don't have permission to see the birthday"),
}

// Alternative: const fieldsToPickList = ['firstName' as const, 'lastName' as const]
const fieldsToPick = {
    firstName: true,
    lastName: true
}

// always include id field as required
// Alternative: const pickedFields = dynamicPickPaths(availableFields, fieldsToPickList, ['id'])
const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id'])

const customerWithOptionalCompany = connection.selectFrom(tCustomer)
    .select(pickedFields)
    .where(tCustomer.id.equals(12))
    .executeSelectMany()
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
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where id = @0
    ```

The parameters are: `[ 12 ]`

The result type is:
```tsx
const customerWithOptionalCompany: Promise<{
    id: number;
    birthday?: Date;
    firstName?: string;
    lastName?: string;
}[]>
```

But if the `birthday` column is requested, like with this `fieldsToPick`:
```ts
const fieldsToPick = {
    firstName: true,
    lastName: true,
    birthday: true
}
```

No query is sent, and the promise is rejected with the reason `DISALLOWED` and the message "_You don't have permission to see the birthday_", because `birthdayVisible` is `false`.
