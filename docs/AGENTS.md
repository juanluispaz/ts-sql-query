# ts-sql-query, for AI agents

A type-safe SQL query builder for TypeScript: not an ORM. The SQL it sends is the query you wrote, and a query that doesn't make sense doesn't compile. It works with MariaDB, MySQL, Oracle, PostgreSQL, SQLite and SQL Server, on Node.js and Bun.

This documentation is the one of the installed version. Prefer it to what you remember or to what is published for other versions: v2 differs a lot from v1. The files of each area, below, are the way to read it.

## Write SQL, declaratively

This is the [philosophy](about/philosophy.md) of the library, and the first thing to get right. A query is described, not programmed, as in SQL itself, and that includes dynamic queries. The shape of the query is written once, and the values decide what applies.

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
- **Stay in SQL.** The library maps no objects and hides no statement: a join, a subquery or an aggregate is written where it happens. Put the work in the query (a join, `aggregateAsArray`) rather than running queries in a loop and merging their rows in JavaScript.

## Where to look

Start with the file of the area of your task. These files are written for you: one per area, so you read what the task needs, and the ones with queries carry only the SQL of your database, which is the one of the `Connection` class the project extends. Tokens are approximate.

| To | Read | Tokens |
|---|---|---|
| Read data: start here | [`llms-queries-<database>.txt`](https://ts-sql-query.readthedocs.io/en/latest/llms-queries-postgresql.txt), with `<database>` being `mariadb`, `mysql`, `oracle`, `postgresql`, `sqlite` or `sqlserver` | 37k |
| Use a select inside another, combine several, or walk a hierarchy | [`llms-queries-advanced-<database>.txt`](https://ts-sql-query.readthedocs.io/en/latest/llms-queries-advanced-postgresql.txt) | 12k |
| Aggregate and group | [`llms-aggregates-<database>.txt`](https://ts-sql-query.readthedocs.io/en/latest/llms-aggregates-postgresql.txt) | 11k |
| Write data | [`llms-mutations-<database>.txt`](https://ts-sql-query.readthedocs.io/en/latest/llms-mutations-postgresql.txt) | 25k |
| Use a transaction | [`llms-transactions.txt`](https://ts-sql-query.readthedocs.io/en/latest/llms-transactions.txt) | 13k |
| Go beyond what the library offers: your own SQL or column type | [`llms-extending-<database>.txt`](https://ts-sql-query.readthedocs.io/en/latest/llms-extending-postgresql.txt) | 19k |
| Go into the detail of a dynamic query: order and page from a request, optional joins, booleans and null, or a condition built with `if`s | [`llms-dynamic-<database>.txt`](https://ts-sql-query.readthedocs.io/en/latest/llms-dynamic-postgresql.txt) | 10k |
| Let the caller choose columns, filters and order, fill a table or offer a query API from a request, hide or refuse values, or write values with a shape | [`llms-extreme-dynamic-<database>.txt`](https://ts-sql-query.readthedocs.io/en/latest/llms-extreme-dynamic-postgresql.txt) | 15k |
| Write a function that returns a dynamic select, and type it | [`llms-dynamic-functions-<database>.txt`](https://ts-sql-query.readthedocs.io/en/latest/llms-dynamic-functions-postgresql.txt) | 21k |
| Type a row of a table | [`llms-types.txt`](https://ts-sql-query.readthedocs.io/en/latest/llms-types.txt) | 6k |
| Declare the tables and the connection | [`llms-configuration-<database>.txt`](https://ts-sql-query.readthedocs.io/en/latest/llms-configuration-postgresql.txt) | 33k |
| Connect a driver | The page of your driver, listed in `llms.txt`, or all of them in [`llms-query-runners.txt`](https://ts-sql-query.readthedocs.io/en/latest/llms-query-runners.txt) | 44k |
| Look up a method | [`llms-api.txt`](https://ts-sql-query.readthedocs.io/en/latest/llms-api.txt) | 53k |
| Understand an error | [`llms-errors.txt`](https://ts-sql-query.readthedocs.io/en/latest/llms-errors.txt) | 22k |
| Find what writes a SQL keyword | [`llms-keywords.txt`](https://ts-sql-query.readthedocs.io/en/latest/llms-keywords.txt) | 12k |
| Know what the library is, and what it can't do | [`llms-general.txt`](https://ts-sql-query.readthedocs.io/en/latest/llms-general.txt) | 8k |
| Move a project from v1 to v2 | [`llms-migrating-from-v1.txt`](https://ts-sql-query.readthedocs.io/en/latest/llms-migrating-from-v1.txt) | 13k |
| See what changed in a version | [`llms-changelog-v2.txt`](https://ts-sql-query.readthedocs.io/en/latest/llms-changelog-v2.txt), or `llms-changelog-v1.txt` | 31k |

The files with `<database>` also come with all the databases, like `llms-queries-all.txt`, to compare them or to move code between them. Otherwise use the one of your database, which is smaller.

[`llms.txt`](https://ts-sql-query.readthedocs.io/en/latest/llms.txt) is the index of all of them, and of what isn't in any: how the native errors of each database map to a reason, and a few pages on a single topic.

To move a project from v1 to v2, read [Migrating from v1](about/changelog/migrating-from-v1.md): some changes don't stop compiling, and change results.

### Coming back to a topic

Once you know the area, go straight to the part you need, in those files or in its page. A page shows the SQL of a query in one tab per database, marked `=== "PostgreSQL"`: read the one of your database.

| To | Read |
|---|---|
| Write a query | [Basic structure](queries/basic-query-structure.md), then [select](queries/select.md), [insert](queries/insert.md), [update](queries/update.md) or [delete](queries/delete.md) |
| Aggregate and group | [Aggregate and group by](queries/aggregate-and-group-by.md) |
| Return nested objects or arrays | [Complex projections](queries/complex-projections.md), [aggregate as an array](queries/aggregate-as-object-array.md) |
| Use a select inside another, or combine several | [CTE (with clause) & subqueries](queries/cte-subqueries.md), [compound select](queries/compound-select.md) |
| Page, or walk a hierarchy | [Select page](queries/select-page.md), [recursive select](queries/recursive-select.md) |
| Upsert | [Insert on conflict](queries/insert-on-conflict.md) |
| Use a transaction | [Transaction](queries/transaction.md) |
| Filter by optional values | [Dynamic queries](queries/dynamic-queries.md), [building blocks](dynamic/building-blocks.md), [booleans and null](dynamic/optional-parts/three-valued-booleans.md) |
| Write SQL the library doesn't offer | [SQL fragments](queries/sql-fragments.md) |
| Let the caller choose columns, filters and order | [Extreme dynamic queries](queries/extreme-dynamic-queries.md), [dynamic filters](dynamic/caller-decides/filters.md), [picking columns](dynamic/caller-decides/picks.md), and [from a business model](dynamic/own-function/from-business-model.md) or [from the database types](dynamic/own-function/from-database-types.md) |
| Fill a table in a user interface, or offer a query API | [Queries from a request](dynamic/caller-decides/queries-from-requests.md) |
| Write a function where the caller chooses columns, filter and order | [Functions that return a dynamic select](dynamic/own-function/dynamic-select-functions.md) |
| Write values whose properties aren't named as the columns | [Insert and update with a shape](queries/shapes.md) |
| Type a row of a table | [Utility types](advanced/utility-types.md), [columns from an object](advanced/columns-from-object.md) |
| Declare tables and the connection | [Connection](configuration/connection.md), [mapping](configuration/mapping.md), [column types](configuration/column-types.md) |
| Connect a driver | [Query runners](configuration/query-runners/): one page per driver |
| Understand an error | [Overview](api/error-management/overview.md), [library errors](api/error-management/library-raised-errors.md); [native mappings](api/error-management/native-mappings/) for a native error of your database |
| Look up a method | [API](api/) |
| See what can't be done | [Limitations](about/limitations.md) |

## Before you write code

- **Let the types work.** The result type is inferred, an optional column being an optional property, so you don't need to write it yourself. A type error usually means the query is wrong: don't cast to get past it. To name a type, use the [utility types](advanced/utility-types.md).
- **Import from public paths only:** the root `ts-sql-query`, or a subpath listed in the `exports` of `package.json`. Never from `__UNSUPPORTED__/`.
- **Choose the `execute*` method by the rows you expect:** `executeSelectOne` throws when there is no row, `executeSelectNoneOrOne` returns `null`, and both throw with more than one.
- **"No value" has an exact meaning in `*IfValue`:** `null`, `undefined` or an empty string, unless the connection allows empty strings: see [dynamic queries](queries/dynamic-queries.md).
- **`equals(null)` doesn't compile, on purpose.** Use `is(...)` for a comparison in which null can equal null, or `isNull()`: see [booleans and null](dynamic/optional-parts/three-valued-booleans.md).
- **An update or delete whose `where` ends up empty is rejected at runtime** (`MISSING_WHERE`). When every row is really meant, say it with `updateAllowingNoWhere` or `deleteAllowingNoWhereFrom`.
- **Handle failures by reason:** the errors are typed, and `error.errorReason.reason` says what happened.
- **Use the query builder before a fragment:** the methods are portable between databases, and a [fragment](queries/sql-fragments.md) is yours to keep valid on each one. Values go in as `${...}`, so they are parameters.
