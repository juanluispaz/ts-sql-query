---
search:
  boost: 2
---
# Queries from a request

Sometimes the caller of your code decides what to ask for: which rows, in which order and which page. Instead of writing one endpoint or one query for each question, you write one query and the caller sends the parts that vary. This page shows the two usual cases applied; each piece has its details in its own page.

- **A table in a user interface**, where each column has a filter and the user orders by clicking on a column and moves between pages.
- **A query API for other systems**, where external systems get the data they need with the conditions they choose.

Nothing that comes from the request becomes SQL text: the values go as parameters, and the names must be among the ones you list.

## Who decides what

| Part of the query | Who decides | What to use |
|---|---|---|
| The rows the caller is allowed to see | Your code | A normal `where`. The filter is added to it, and can't remove it |
| Which fields can be filtered | Your code | The map you give to [`dynamicConditionFor`](extreme-dynamic-queries.md#select-using-a-dynamic-filter) |
| The condition | The caller, inside those fields | [`withValues(filter)`](extreme-dynamic-queries.md#select-using-a-dynamic-filter) |
| The order | The caller, among the properties of the select | [`orderByFromStringIfValue`](dynamic-queries.md#order-by-from-a-string) |
| The page | The caller, with the maximum you set | `limit`, and [`offsetIfValue`](dynamic-queries.md#optional-limit-and-offset) |
| The columns, if they can vary | The caller, inside the ones you list | [`dynamicPickPaths`](extreme-dynamic-queries.md#the-columns-the-client-asks-for) |

## A table in a user interface

The frontend sends the filters the user filled in, the column clicked and the page. The table also needs the total, to show its page controls, and [`executeSelectPage`](select-page.md) gives it:

```ts
import { DynamicCondition } from "ts-sql-query" // or "ts-sql-query/dynamic/condition"

type CustomerFilter = DynamicCondition<{
    firstName: 'string',
    lastName: 'string',
    birthday: 'localDate'
}>

interface CustomerTableRequest {
    filter?: CustomerFilter,
    order?: string,
    limit?: number,
    offset?: number
}

function getCustomerTable(companyOfTheUser: number, request: CustomerTableRequest) {
    const filterableFields = {
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday
    }

    return connection.selectFrom(tCustomer)
        .where(tCustomer.companyId.equals(companyOfTheUser))
        .and(connection.dynamicConditionFor(filterableFields).withValues(request.filter ?? {}))
        .select({
            id: tCustomer.id,
            firstName: tCustomer.firstName,
            lastName: tCustomer.lastName
        })
        .orderByFromStringIfValue(request.order)
        .orderBy('id')
        .limit(Math.min(request.limit ?? 20, 100))
        .offsetIfValue(request.offset)
        .executeSelectPage();
}
```

These are the parts of that query, and what each one protects:

- `companyOfTheUser` doesn't come from the request, but from the session of the user. Whatever the filter says, the user only sees the customers of that company.
- `orderBy('id')` goes after the order of the request, so [the order leaves no ties](select-page.md#ordering-the-rows) and a row doesn't appear in two pages.
- `Math.min` sets a maximum of rows, whatever the request asks for.

With this request, a user looking for the customers whose last name starts with `S`, ordered by first name, on the third page:

```json
{
    "filter": { "lastName": { "startsWith": "S" }, "firstName": { "contains": "" } },
    "order": "firstName asc",
    "limit": 10,
    "offset": 20
}
```

The empty filter of `firstName`, a box nobody filled in, adds no condition: see [Empty values in a filter](extreme-dynamic-queries.md#empty-values-in-a-filter).

## A query API for other systems

The query has the same parts, and what changes is who is on the other side: you don't control their code, and they can be written in any language.

```ts
import { DynamicCondition } from "ts-sql-query" // or "ts-sql-query/dynamic/condition"

type CustomerQueryFilter = DynamicCondition<{
    id: 'int',
    lastName: 'string',
    birthday: 'localDate'
}>

interface CustomerQuery {
    filter?: CustomerQueryFilter,
    order?: string,
    limit?: number,
    offset?: number
}

function queryCustomers(companyOfTheClient: number, query: CustomerQuery) {
    return connection.selectFrom(tCustomer)
        .where(tCustomer.companyId.equals(companyOfTheClient))
        .and(connection.dynamicConditionFor({
            id: tCustomer.id,
            lastName: tCustomer.lastName,
            birthday: tCustomer.birthday
        }).withValues(query.filter ?? {}))
        .select({
            id: tCustomer.id,
            firstName: tCustomer.firstName,
            lastName: tCustomer.lastName,
            birthday: tCustomer.birthday
        })
        .orderByFromStringIfValue(query.order)
        .orderBy('id')
        .limit(Math.min(query.limit ?? 100, 1000))
        .offsetIfValue(query.offset)
        .executeSelectMany();
}
```

Keep in mind when you offer one:

- **Your conditions go in the code.** The client can filter by any field of the map, with any operator of its type, and it can send an empty filter. So what it may see goes in the `where` you write, and the map lists only what it may use.
- **A system in Java or C# sends everything.** It usually can't leave out a property, so `{ "id": { "equals": 1, "notEquals": null, "in": null } }` means `id = 1`. That's why [a filter with empty values is tolerated](extreme-dynamic-queries.md#empty-values-in-a-filter).
- **Dates arrive as text in JSON.** Convert them to `Date` before calling `withValues`: a text in a date column is rejected.
- **A column can depend on who asks.** Mark it with [`allowWhen`](extreme-dynamic-queries.md#restrict-access-to-values) and it can stay in the map: the query is refused only if the client uses it.
- **Validating more is your choice.** To tell the client that `equals: null` isn't accepted, validate the request first, with a library like Zod.

## Answering an error of the caller

The request can be wrong, and it's an error of the caller and not of your server. These are the reasons to answer as a bad request:

| Reason | What the caller sent | Where it arrives |
|---|---|---|
| `DYNAMIC_CONDITION_UNKNOWN_COLUMN` | A field that isn't in the map | Thrown by `withValues` |
| `DYNAMIC_CONDITION_UNKNOWN_OPERATION` | An operator that doesn't exist | Thrown by `withValues` |
| `DYNAMIC_CONDITION_INVALID_FILTER` | Something that isn't a filter, like `{ "id": 1 }` | Thrown by `withValues` |
| `ORDER_BY_COLUMN_NOT_IN_SELECT` | An order by a property that isn't in the select | Thrown by `orderByFromStringIfValue` |
| `INVALID_ORDER_BY_ORDERING` | An order mode that doesn't exist | Thrown by `orderByFromStringIfValue` |
| `INVALID_VALUE_TO_SEND_TO_DATABASE` | A value of the wrong type, like a text in a number | Through the promise of the execute method |

The first ones are raised while the query is written, and the last one when it's executed. An `await` inside a `try` receives them all:

```ts
import { TsSqlError } from "ts-sql-query" // or "ts-sql-query/TsSqlError"

const badRequestReasons = [
    'DYNAMIC_CONDITION_UNKNOWN_COLUMN',
    'DYNAMIC_CONDITION_UNKNOWN_OPERATION',
    'DYNAMIC_CONDITION_INVALID_FILTER',
    'ORDER_BY_COLUMN_NOT_IN_SELECT',
    'INVALID_ORDER_BY_ORDERING',
    'INVALID_VALUE_TO_SEND_TO_DATABASE'
]

function isErrorOfTheCaller(error: unknown): boolean {
    return error instanceof TsSqlError && badRequestReasons.includes(error.errorReason.reason)
}
```

## More details

- [Select using a dynamic filter](extreme-dynamic-queries.md#select-using-a-dynamic-filter): the operators, the groups of fields and the rules of your own.
- [Order by from a string](dynamic-queries.md#order-by-from-a-string): the text it accepts, and how it combines with `orderBy`.
- [Select page](select-page.md): the limit, the offset, the total, and how to avoid the count.
- [Select dynamically picking columns](extreme-dynamic-queries.md#select-dynamically-picking-columns), when the columns vary too.
- [Functions that return a dynamic select](dynamic-select-functions.md), to type all of this precisely in one function.
