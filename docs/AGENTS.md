# ts-sql-query, for AI agents

A type-safe SQL query builder for TypeScript: not an ORM. The SQL it sends is the query you wrote, and a query that doesn't make sense doesn't compile. It works with MariaDB, MySQL, Oracle, PostgreSQL, SQLite and SQL Server, on Node.js and Bun.

This documentation is the one of the installed version. Prefer it to what you remember or to what is published for other versions: v2 differs a lot from v1. Read only what the task needs: a page, or the file of an area.

## Write SQL, declaratively

This is the [philosophy](about/philosophy.md) of the library, and what agents get wrong most often. A query is described, not programmed, as in SQL itself, and that includes dynamic queries. The shape of the query is written once, and the values decide what applies.

Don't do this:

```tsx
let where = connection.dynamicBooleanExpressionUsing(tCustomer)
if (firstName) {
    where = where.and(tCustomer.firstName.contains(firstName))
}
if (lastName) {
    where = where.and(tCustomer.lastName.contains(lastName))
}
```

Do this:

```ts
const firstName: string | null | undefined = 'John';
const lastName: string | null | undefined = undefined;

const customers = await connection.selectFrom(tCustomer)
    .where(tCustomer.firstName.containsIfValue(firstName))
        .and(tCustomer.lastName.containsIfValue(lastName))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName
    })
    .executeSelectMany();
```

- **Reach for what declares it:** the `*IfValue` methods, `setIfValue`, `onlyWhen` / `ignoreWhen`, `orderByFromString`, the optional joins (`optionalInnerJoin`, `optionalLeftOuterJoin`), `dynamicConditionFor` and `dynamicPick`. Each page of "Filter by optional values" below shows them. Control flow around a query (`if`, `for`) is the last resort: `dynamicBooleanExpressionUsing` exists for the condition these can't express, not as the way to start.
- **Stay in SQL.** The library maps no objects and hides no statement: a join, a subquery or an aggregate is written where it happens. Put the work in the query (a join, `aggregateAsArray`) rather than running queries in a loop and merging their rows in JavaScript, and don't wrap the library in a model layer of your own.

## Where to look

### A whole area

For writing queries, the file of your database has each query only with its SQL, so it costs a third less than the pages. Tokens are approximate.

| To | Read | Tokens |
|---|---|---|
| Write queries: start here | [`llms-queries-<database>.txt`](https://ts-sql-query.readthedocs.io/llms-queries-postgresql.txt), with `<database>` being `mariadb`, `mysql`, `oracle`, `postgresql`, `sqlite` or `sqlserver` | 67k |
| Let the caller choose columns, filters and order | [`llms-extreme-dynamic-<database>.txt`](https://ts-sql-query.readthedocs.io/llms-extreme-dynamic-postgresql.txt) | 22k |
| Type a row of a table | [`llms-types.txt`](https://ts-sql-query.readthedocs.io/llms-types.txt) | 5k |
| Declare the tables and the connection | [`llms-configuration.txt`](https://ts-sql-query.readthedocs.io/llms-configuration.txt) | 48k |
| Connect a driver | [`llms-query-runners.txt`](https://ts-sql-query.readthedocs.io/llms-query-runners.txt) | 31k |
| Look up a method | [`llms-api.txt`](https://ts-sql-query.readthedocs.io/llms-api.txt) | 42k |
| Understand an error | [`llms-errors.txt`](https://ts-sql-query.readthedocs.io/llms-errors.txt) | 21k |

[`llms.txt`](https://ts-sql-query.readthedocs.io/llms.txt) is the index of all of them.

### One page

Usually enough, and much cheaper than a whole area.

| To | Read |
|---|---|
| Write a query | [Basic structure](queries/basic-query-structure.md), then [select](queries/select.md), [insert](queries/insert.md), [update](queries/update.md) or [delete](queries/delete.md) |
| Aggregate and group | [Aggregate and group by](queries/aggregate-and-group-by.md) |
| Return nested objects or arrays | [Complex projections](queries/complex-projections.md), [aggregate as an array](queries/aggregate-as-object-array.md) |
| Page, or walk a hierarchy | [Select page](queries/select-page.md), [recursive select](queries/recursive-select.md) |
| Upsert | [Insert on conflict](queries/insert-on-conflict.md) |
| Use a transaction | [Transaction](queries/transaction.md) |
| Filter by optional values | [Dynamic queries](queries/dynamic-queries.md), [building blocks](dynamic/building-blocks.md), [booleans and null](dynamic/three-valued-booleans.md) |
| Write SQL the library doesn't offer | [SQL fragments](queries/sql-fragments.md) |
| Let the caller choose columns, filters and order | [Extreme dynamic queries](queries/extreme-dynamic-queries.md), and [from a business model](dynamic/from-business-model.md) or [from the database types](dynamic/from-database-types.md) |
| Type a row of a table | [Utility types](advanced/utility-types.md), [columns from an object](advanced/columns-from-object.md) |
| Declare tables and the connection | [Connection](configuration/connection.md), [mapping](configuration/mapping.md), [column types](configuration/column-types.md) |
| Connect a driver | [Query runners](configuration/query-runners/): one page per driver |
| Understand an error | [Overview](api/error-management/overview.md), [library errors](api/error-management/library-raised-errors.md); [native mappings](api/error-management/native-mappings/) for a native error of your database |
| Look up a method | [API](api/) |
| See what can't be done | [Limitations](about/limitations.md) |
| Migrate from v1 | The breaking changes of [the changelog](CHANGELOG.md), which is long: search it rather than reading it |

The pages show the SQL of a query in one tab per database, marked `=== "PostgreSQL"`: read the one of your database.

## A query

```ts
const customerId = 10;

const customerWithId = await connection.selectFrom(tCustomer)
    .where(tCustomer.id.equals(customerId))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        birthday: tCustomer.birthday
    })
    .executeSelectOne();
```

## Before you write code

- **Let the types work.** The result type is inferred: an optional column is an optional property, and a type error usually means the query is wrong. Don't cast to get past it, and don't annotate the result by hand: to name it, use the [utility types](advanced/utility-types.md).
- **Import from public paths only:** the root `ts-sql-query`, or a subpath listed in the `exports` of `package.json`. Never from `__UNSUPPORTED__/`.
- **Choose the `execute*` method by the rows you expect:** `executeSelectOne` throws when there is no row, `executeSelectNoneOrOne` returns `null`, and both throw with more than one.
- **"No value" has an exact meaning in `*IfValue`:** `null`, `undefined` or an empty string, unless the connection allows empty strings: see [dynamic queries](queries/dynamic-queries.md).
- **`equals(null)` doesn't compile, on purpose.** Use `is(...)` for a comparison in which null can equal null, or `isNull()`: see [booleans and null](dynamic/three-valued-booleans.md).
- **An update or delete whose `where` ends up empty is rejected at runtime** (`MISSING_WHERE`): don't work around it unless every row is really meant.
- **Handle failures by reason:** the errors are typed, and `error.errorReason.reason` says what happened.
- **Use the query builder before a fragment:** the methods are portable between databases, and a [fragment](queries/sql-fragments.md) is yours to keep valid on each one. Values go in as `${...}`, so they are parameters.
