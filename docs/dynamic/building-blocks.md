---
search:
  boost: 0.8
---
# Dynamic query building blocks

`ts-sql-query` lets you make a query **dynamic** without dropping out of its declarative style: instead of assembling SQL with `if`s and string concatenation, you express the optional parts inside the query itself, and the library prunes whatever doesn't apply before emitting the SQL.

This page is a guided tour of the **everyday** dynamic building blocks — the ones you reach for in normal CRUD code. For building a *whole* query (its columns, its filter and its order-by) from a model or from the column map, see [Dynamic queries from a business model](from-business-model.md) and [Dynamic queries from the database types](from-database-types.md); for the reusable helper types, see the [Utilities](utilities/conditions.md) pages.

Each section below explains one feature, shows a short example, and links to its full reference.

## Conditional filters: the `*IfValue` methods

Every comparison has an `*IfValue` twin (`equalsIfValue`, `containsIfValue`, `greaterThanIfValue`, …). When the value you pass is `null`, `undefined` (or an empty string, unless the connection enables `allowEmptyString`), the comparison returns a **neutral boolean** that is reduced away before the SQL is generated — even when it is combined with other conditions through `and` / `or`. It is the simplest way to turn an optional backend value into an optional filter:

```ts
const nameContains: string | null | undefined = 'an'

const customers = await connection.selectFrom(tCustomer)
    .where(tCustomer.firstName.containsIfValue(nameContains)) // dropped entirely when nameContains is absent
    .select({ id: tCustomer.id, name: tCustomer.name })
    .executeSelectMany()
```

See [Easy dynamic queries](../queries/dynamic-queries.md#easy-dynamic-queries) for the full method set and the generated SQL, and [Booleans and three-valued logic](three-valued-booleans.md) for why an optional value is a dynamic filter rather than a `null` comparison.

## Apply a condition only under a flag: `onlyWhen` / `ignoreWhen`

When a condition should apply only if some runtime flag is set — a permission, a role, a feature toggle — end the boolean expression with `onlyWhen(condition)`. If `condition` is `false` the expression becomes the neutral boolean and is ignored; `ignoreWhen(condition)` is the inverse:

```ts
const restrictToMyCompany = true
const myCompanyId = 16

const customers = await connection.selectFrom(tCustomer)
    .where(tCustomer.companyId.equals(myCompanyId).onlyWhen(restrictToMyCompany))
    .select({ id: tCustomer.id, name: tCustomer.name })
    .executeSelectMany()
```

See [Ignorable boolean expression](../queries/dynamic-queries.md#ignorable-boolean-expression) for the details.

## Build a condition imperatively: `dynamicBooleanExpressionUsing`

When `*IfValue` composition isn't enough — you need to grow a boolean expression with your own `if`s — start from `connection.dynamicBooleanExpressionUsing(...table...)`, which gives you the neutral boolean to `and` / `or` onto:

```ts
const firstNameContains: string | null | undefined = 'an'
const lastNameContains: string | null | undefined = null

let dynamicWhere = connection.dynamicBooleanExpressionUsing(tCustomer)
dynamicWhere = dynamicWhere.and(tCustomer.firstName.containsIfValue(firstNameContains))
dynamicWhere = dynamicWhere.or(tCustomer.lastName.containsIfValue(lastNameContains))

const customers = await connection.selectFrom(tCustomer)
    .where(dynamicWhere)
    .select({ id: tCustomer.id, name: tCustomer.name })
    .executeSelectMany()
```

See [Complex dynamic boolean expressions](../queries/extreme-dynamic-queries.md#complex-dynamic-boolean-expressions).

## Optional projected values: `onlyWhenOrNull` / `ignoreWhenAsNull`

The same idea applied to a **selected value** instead of a condition: end an expression with `onlyWhenOrNull(condition)` to project the value only when `condition` is `true`, and `null` otherwise (`ignoreWhenAsNull` is the inverse). Useful to hide columns the current user is not allowed to see, while keeping a single query:

```ts
const displayNames = true

const customer = await connection.selectFrom(tCustomer)
    .where(tCustomer.id.equals(10))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName.onlyWhenOrNull(displayNames), // null when displayNames is false
        lastName: tCustomer.lastName.onlyWhenOrNull(displayNames)
    })
    .executeSelectOne()
```

See [Ignorable expression as null](../queries/dynamic-queries.md#ignorable-expression-as-null).

## Optional joins

A join can be marked **optional** so it is emitted only when the joined table is actually used in the final query (a column of it was selected, or it took part in a dynamic `WHERE` that survived). Create the join with `optionalJoin`, `optionalInnerJoin`, `optionalLeftJoin` or `optionalLeftOuterJoin`. Combined with `*IfValue`, the join disappears together with the condition that needed it:

```ts
const companyName: string | null | undefined = undefined

const customers = await connection.selectFrom(tCustomer)
    .optionalJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId)) // omitted when tCompany is unused
    .where(tCompany.name.equalsIfValue(companyName))
    .select({ id: tCustomer.id, name: tCustomer.name })
    .executeSelectMany()
```

See [Optional joins](../queries/dynamic-queries.md#optional-joins).

## Dynamic `order by`, `limit` and `offset`

Take an order-by from the user without exposing the database structure or risking SQL injection: `orderByFromString` (and `orderByFromStringArray` for a pre-split list) accept the order-by written with the **result property names**, plus an `insensitive` modifier for case-insensitive string ordering. The `*IfValue` variants — `orderByFromStringIfValue`, `orderByFromStringArrayIfValue`, `limitIfValue`, `offsetIfValue` — apply the clause only when a value is provided:

```ts
const orderBy: string | null | undefined = 'name insensitive, birthday asc nulls last'
const max: number | null | undefined = 20
const skip: number | null | undefined = undefined

const customers = await connection.selectFrom(tCustomer)
    .select({ id: tCustomer.id, name: tCustomer.name, birthday: tCustomer.birthday })
    .orderByFromStringIfValue(orderBy)
    .limitIfValue(max)   // applied only when max is present
    .offsetIfValue(skip) // skipped here: skip is undefined
    .executeSelectMany()
```

For a **type-safe** order-by validated against a model or the columns, pair these with `OrderByForModel<…>[]` — see [Dynamic order by](utilities/order-by.md). The order-by syntax and paging are detailed in [Select page](../queries/select-page.md).

## Dynamic inserts and updates: `setIfValue` and friends

Updates and inserts have their own conditional setters. `setIfValue(columns)` sets only the columns whose value is present (skipping `null` / `undefined` / empty), so you don't have to branch on which fields changed:

```ts
const newFirstName: string | null | undefined = 'John'
const newBirthday: Date | null | undefined = undefined

const updatedRows = await connection.update(tCustomer)
    .setIfValue({
        firstName: newFirstName,  // set
        birthday: newBirthday     // skipped: undefined
    })
    .where(tCustomer.id.equals(10))
    .executeUpdate()
```

The full family lets you layer sets during query construction: `setIfSet` / `setIfSetIfValue` (only overwrite an already-set column), `setIfNotSet` / `setIfNotSetIfValue` (only set a not-yet-set column) and `ignoreIfSet(...columns)` (drop a previously set column). And as a safety net, `ts-sql-query` refuses to run an `UPDATE` / `DELETE` that ended up without a `WHERE`; opt in explicitly with `updateAllowingNoWhere(...)` / `deleteAllowingNoWhereFrom(...)`. See the [Update](../queries/update.md) and [Insert](../queries/insert.md) pages.

## See also

- [Dynamic queries](../queries/dynamic-queries.md) — the full reference for these methods, with the generated SQL per database.
- [Booleans and three-valued logic](three-valued-booleans.md) — why optional backend values are dynamic filters, and `equals` vs `is`.
- [Dynamic queries from a business model](from-business-model.md) / [from the database types](from-database-types.md) — building an entire query (columns + filter + order-by) dynamically.
- [Utilities](utilities/conditions.md) — the reusable helper types behind the model-first and column-first patterns.
