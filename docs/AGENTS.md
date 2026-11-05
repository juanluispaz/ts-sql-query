# ts-sql-query, for AI agents

A type-safe SQL query builder for TypeScript: not an ORM. The SQL it sends is the query you wrote, and a query that doesn't make sense doesn't compile. It works with MariaDB, MySQL, Oracle, PostgreSQL, SQLite and SQL Server, on Node.js and Bun.

The documentation of this installed version is in `docs/`, next to this file. Prefer it to what you remember or to the website: v2 differs from v1, and from what is published for other versions. Read only the pages of the task.

## Write SQL, declaratively

This is the [philosophy](docs/about/philosophy.md) of the library, and what agents get wrong most often. A query is described, not programmed, as in SQL itself, and that includes dynamic queries. The shape of the query is written once, and the values decide what applies.

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

| To | Read |
|---|---|
| Write a query | [Basic structure](docs/queries/basic-query-structure.md), then [select](docs/queries/select.md), [insert](docs/queries/insert.md), [update](docs/queries/update.md) or [delete](docs/queries/delete.md) |
| Aggregate and group | [Aggregate and group by](docs/queries/aggregate-and-group-by.md) |
| Return nested objects or arrays | [Complex projections](docs/queries/complex-projections.md), [aggregate as an array](docs/queries/aggregate-as-object-array.md) |
| Page, or walk a hierarchy | [Select page](docs/queries/select-page.md), [recursive select](docs/queries/recursive-select.md) |
| Upsert | [Insert on conflict](docs/queries/insert-on-conflict.md) |
| Use a transaction | [Transaction](docs/queries/transaction.md) |
| Filter by optional values | [Dynamic queries](docs/queries/dynamic-queries.md), [building blocks](docs/dynamic/building-blocks.md), [booleans and null](docs/dynamic/three-valued-booleans.md) |
| Write SQL the library doesn't offer | [SQL fragments](docs/queries/sql-fragments.md) |
| Let the caller choose columns, filters and order | [Extreme dynamic queries](docs/queries/extreme-dynamic-queries.md), and [from a business model](docs/dynamic/from-business-model.md) or [from the database types](docs/dynamic/from-database-types.md) |
| Type a row of a table | [Utility types](docs/advanced/utility-types.md), [columns from an object](docs/advanced/columns-from-object.md) |
| Declare tables and the connection | [Connection](docs/configuration/connection.md), [mapping](docs/configuration/mapping.md), [column types](docs/configuration/column-types.md) |
| Connect a driver | `docs/configuration/query-runners/`: one page per driver |
| Understand an error | [Overview](docs/api/error-management/overview.md), [library errors](docs/api/error-management/library-raised-errors.md); `docs/api/error-management/native-mappings/` for a native error of your database |
| Look up a method | `docs/api/` |
| See what can't be done | [Limitations](docs/about/limitations.md) |
| Migrate from v1 | The breaking changes of [the changelog](docs/CHANGELOG.md), which is long: search it rather than reading it |

The pages show the SQL of a query in one tab per database, marked `=== "PostgreSQL"`: read the one of your database.

To read a whole area instead of a page, `llms/llms.txt` lists a file for each, and for writing queries one per database with only its SQL: for example `llms/llms-queries-postgresql.txt`, about 68k tokens.

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

- **Let the types work.** The result type is inferred: an optional column is an optional property, and a type error usually means the query is wrong. Don't cast to get past it, and don't annotate the result by hand: to name it, use the [utility types](docs/advanced/utility-types.md).
- **Import from public paths only:** the root `ts-sql-query`, or a subpath listed in the `exports` of `package.json`. Never from `__UNSUPPORTED__/`.
- **Choose the `execute*` method by the rows you expect:** `executeSelectOne` throws when there is no row, `executeSelectNoneOrOne` returns `null`, and both throw with more than one.
- **"No value" has an exact meaning in `*IfValue`:** `null`, `undefined` or an empty string, unless the connection allows empty strings: see [dynamic queries](docs/queries/dynamic-queries.md).
- **`equals(null)` doesn't compile, on purpose.** Use `is(...)` for a comparison in which null can equal null, or `isNull()`: see [booleans and null](docs/dynamic/three-valued-booleans.md).
- **An update or delete whose `where` ends up empty is rejected at runtime** (`MISSING_WHERE`): don't work around it unless every row is really meant.
- **Handle failures by reason:** the errors are typed, and `error.errorReason.reason` says what happened.
- **Use the query builder before a fragment:** the methods are portable between databases, and a [fragment](docs/queries/sql-fragments.md) is yours to keep valid on each one. Values go in as `${...}`, so they are parameters.
