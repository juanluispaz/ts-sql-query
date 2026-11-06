---
search:
  boost: 1.5
---
# Booleans and three-valued logic

A boolean in JavaScript is `true` or `false`. A boolean in SQL can also be `null`, which means "unknown", and that's why it's called three-valued logic. When a column has no value, a comparison with it is neither true nor false: it's `null`, and the row is left out of the result.

This page answers three questions: why a comparison with null filters a row out, when to use `equals` and when to use `is`, and why `equals` doesn't accept a `null` from your code, and what the `*IfValue` methods do instead.

## Why a comparison with null filters a row out

A comparison with a null doesn't answer yes or no. `parent_id = 1` is `null` when `parent_id` is null, because the value is unknown. So is `parent_id <> 1`, and even `null = null`.

A `where` keeps a row only when its condition is true. A row whose condition is false or `null` is discarded. The `on` of a join and the `having` work the same way.

These are the results on three companies whose `parentId` is `1`, `2` and `null`:

| Condition | On `1` | On `2` | On `null` | Rows kept by a `where` |
|---|---|---|---|---|
| `tCompany.parentId.equals(1)` | `true` | `false` | `null` | `1` |
| `tCompany.parentId.notEquals(1)` | `false` | `true` | `null` | `2` |
| `tCompany.parentId.equals(1).negate()` | `false` | `true` | `null` | `2` |

The company without a parent isn't in any of the three. `equals(1)` and `notEquals(1)` together don't return all the rows, and `negate()` doesn't bring the row back, because the opposite of unknown is still unknown.

Most of the time this is what you want: a company without a parent isn't a child of company 1. The problem comes when you expect those rows, as in "the companies whose parent isn't company 1", which must include the ones without a parent. For that, use `isNot`, explained in the next section.

To ask whether a column has a value, use `isNull()` and `isNotNull()`. They aren't comparisons, and their answer is always `true` or `false`.

## `equals` or `is`: comparing values that may be null

In JavaScript, `null === null` is `true`. In SQL, `null = null` is `null`. The library has a method for each of the two meanings:

| You write | Like | SQL in PostgreSQL | When one side is null | When both are null | Result type |
|---|---|---|---|---|---|
| `a.equals(b)` | `=` of SQL | `a = b` | `null` | `null` | Required if both sides are required, optional otherwise |
| `a.notEquals(b)` | `<>` of SQL | `a <> b` | `null` | `null` | Required if both sides are required, optional otherwise |
| `a.is(b)` | `===` of JavaScript | `a is not distinct from b` | `false` | `true` | Always required |
| `a.isNot(b)` | `!==` of JavaScript | `a is distinct from b` | `true` | `false` | Always required |

`b` can be another column or expression of the query in all of them. A value from your code is different: `equals` and `notEquals` only accept a value that isn't `null` or `undefined`, while `is` and `isNot` accept them too, and take `undefined` as `null`.

With the same three companies:

| Condition | On `1` | On `2` | On `null` | Rows kept by a `where` |
|---|---|---|---|---|
| `tCompany.parentId.is(1)` | `true` | `false` | `false` | `1` |
| `tCompany.parentId.isNot(1)` | `false` | `true` | `true` | `2`, `null` |
| `tCompany.parentId.is(null)` | `false` | `false` | `true` | `null` |
| `tCompany.parentId.isNot(null)` | `true` | `true` | `false` | `1`, `2` |

Use `equals` when a row without a value must not match, which is the usual case. Use `is` when null counts as one more value, as when a variable that may be null must find the rows that have null in the column. If you already know you are looking for null, `isNull()` says it more clearly than `is(null)`.

```ts
const parentId: number | null = null

const companies = await connection.selectFrom(tCompany)
    .where(tCompany.parentId.is(parentId))
    .select({
        id: tCompany.id,
        name: tCompany.name
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
    where parent_id <=> ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        `name` as `name` 
    from company 
    where parent_id <=> ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name" 
    from company 
    where decode(parent_id, :0, 1, 0 ) = 1
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name 
    from company 
    where parent_id is not distinct 
    from $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name 
    from company 
    where parent_id is ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name 
    from company 
    where parent_id is null
    ```

The parameters are: `[ null ]` (on SQL Server: `[]`)

Each database writes `is` and `isNot` in its own way: MySQL and MariaDB use `a <=> b` and `not (a <=> b)`, SQLite uses `a is b` and `a is not b`, and Oracle uses a `decode`. SQL Server uses `a = b` and `a <> b` when neither side can be null, a `case` expression otherwise, and `a is null` or `a is not null` when the argument is a null known while the query is built.

The type of the result shows which answers are possible. The result of `equals` with a value follows the column: on a required column it's a required boolean, and on an optional column it's an optional one, because the database can answer `null`. The result of `is` is always required:

```ts
const companies = await connection.selectFrom(tCompany)
    .select({
        id: tCompany.id,
        isTheFirstCompany: tCompany.id.equals(1),
        childOfTheFirstWithEquals: tCompany.parentId.equals(1),
        childOfTheFirstWithIs: tCompany.parentId.is(1)
    })
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        id = ? as isTheFirstCompany, 
        parent_id = ? as childOfTheFirstWithEquals, 
        parent_id <=> ? as childOfTheFirstWithIs 
    from company
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        id = ? as isTheFirstCompany, 
        parent_id = ? as childOfTheFirstWithEquals, 
        parent_id <=> ? as childOfTheFirstWithIs 
    from company
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        case when id = :0 then 1 else 0 end as "isTheFirstCompany", 
        case when parent_id = :1 then 1 when not (parent_id = :2) then 0 else null end as "childOfTheFirstWithEquals", 
        case when decode(parent_id, :3, 1, 0 ) = 1 then 1 else 0 end as "childOfTheFirstWithIs" 
    from company
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        id = $1 as "isTheFirstCompany", 
        parent_id = $2 as "childOfTheFirstWithEquals", 
        parent_id is not distinct 
    from $3 as "childOfTheFirstWithIs" 
    from company
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        id = ?1 as isTheFirstCompany, 
        parent_id = ?2 as childOfTheFirstWithEquals, 
        parent_id is ?3 as childOfTheFirstWithIs 
    from company
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        cast(case when id = @0 then 1 else 0 end as bit) as isTheFirstCompany, 
        cast(case when parent_id = @1 then 1 when not (parent_id = @2) then 0 else null end as bit) as childOfTheFirstWithEquals, 
        cast(case when case when parent_id = @3 then 1 else 0 end = 1 then 1 else 0 end as bit) as childOfTheFirstWithIs 
    from company
    ```

The parameters are: `[ 1, 1, 1 ]` (on Oracle and SQL Server: `[ 1, 1, 1, 1 ]`)

The result type is:
```tsx
const companies: {
    id: number;
    isTheFirstCompany: boolean;
    childOfTheFirstWithEquals?: boolean;
    childOfTheFirstWithIs: boolean;
}[]
```

## Why an optional value means a dynamic condition: the IfValue methods

`equals`, `greaterThan` and the other comparisons don't accept a `null` or an `undefined` from your code. In this query, `parentId` is a `number`, and with `number | null` it wouldn't compile:

```ts
const parentId: number = 1

const companies = await connection.selectFrom(tCompany)
    .where(tCompany.parentId.equals(parentId))
    .select({
        id: tCompany.id,
        name: tCompany.name
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
    where parent_id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        `name` as `name` 
    from company 
    where parent_id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name" 
    from company 
    where parent_id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name 
    from company 
    where parent_id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name 
    from company 
    where parent_id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name 
    from company 
    where parent_id = @0
    ```

The parameters are: `[ 1 ]`

The reason is what a missing value means. When a value of your backend may be absent, such as a filter of a search form, it almost never means "compare with null". It means that this condition is dynamic: apply it only if there is a value. A comparison with null would do something else: as seen above, it's never true, so the query would return no rows and give no error.

The `*IfValue` methods say that. They accept `null` and `undefined`, and without a value there is no condition in the query:

```ts
// It comes from the request and may be absent: absent means "don't filter by it"
const parentId: number | null | undefined = undefined

const companies = await connection.selectFrom(tCompany)
    .where(tCompany.parentId.equalsIfValue(parentId))
    .select({
        id: tCompany.id,
        name: tCompany.name
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
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        `name` as `name` 
    from company
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name" 
    from company
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name 
    from company
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name 
    from company
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name 
    from company
    ```

The parameters are: `[]`

Without a value, these methods return the [neutral boolean](../../queries/dynamic-queries.md#the-neutral-boolean), which isn't the `null` of SQL. A `null` reaches the database and makes the row be discarded. The neutral boolean never reaches it: the library removes it from the `and`, `or`, `on` or `where` it's part of, so the condition isn't written at all.

So the question to ask is what the query must do when the value is missing:

| When the value is `null` or `undefined`, the query must | Write |
|---|---|
| Not filter by it | `tCompany.parentId.equalsIfValue(x)` |
| Return the rows that have null in the column | `tCompany.parentId.is(x)` |
| Return no rows | `tCompany.parentId.equalsIfValue(x).falseWhenNoValue()` |
| Use another condition | `tCompany.parentId.equalsIfValue(x).valueWhenNoValue(otherCondition)` |

`isIfValue` belongs to the first row and not to the second: `isIfValue(null)` has no value, so it writes no condition and doesn't look for the nulls.

[Optional conditions: the IfValue methods](../../queries/dynamic-queries.md#optional-conditions-the-ifvalue-methods) has all these methods, [what counts as no value](../../queries/dynamic-queries.md#what-counts-as-no-value) and how they combine.

### When the absence should mean `false` instead of being omitted

Sometimes a missing value must not remove the condition. For example, a user who has no company assigned must see no rows, and not all of them. End the condition with `falseWhenNoValue()`, `trueWhenNoValue()` or `valueWhenNoValue(...)`:

```ts
const parentId: number | null | undefined = undefined

const companies = await connection.selectFrom(tCompany)
    .where(tCompany.parentId.equalsIfValue(parentId).falseWhenNoValue())
    .select({
        id: tCompany.id,
        name: tCompany.name
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
    where false
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        `name` as `name` 
    from company 
    where false
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name" 
    from company 
    where (0=1)
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name 
    from company 
    where false
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name 
    from company 
    where 0
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name 
    from company 
    where (0=1)
    ```

The parameters are: `[]`

## A null that comes from the database

What's above is about values from your code. A null that comes from the database is normal, and the types say where it can happen: a column declared with `optionalColumn` is optional in the result, as `tCompany.parentId` is `parentId?: number`.

Two expressions of the query are compared directly, even if they are optional. If any of them is optional the result is an optional boolean, and the database answers as in the tables of this page:

```ts
const companies = await connection.selectFrom(tCompany)
    .select({
        id: tCompany.id,
        isItsOwnParent: tCompany.id.equals(tCompany.parentId)
    })
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        id = parent_id as isItsOwnParent 
    from company
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        id = parent_id as isItsOwnParent 
    from company
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        case when id = parent_id then 1 when not (id = parent_id) then 0 else null end as "isItsOwnParent" 
    from company
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        id = parent_id as "isItsOwnParent" 
    from company
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        id = parent_id as isItsOwnParent 
    from company
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        cast(case when id = parent_id then 1 when not (id = parent_id) then 0 else null end as bit) as isItsOwnParent 
    from company
    ```

The parameters are: `[]`

The result type is:
```tsx
const companies: {
    id: number;
    isItsOwnParent?: boolean;
}[]
```

An optional boolean column behaves in the same way. With `billable = this.optionalColumn('billable', 'boolean')`, `.where(tWorklog.billable)` keeps the rows where it's true, `.where(tWorklog.billable.negate())` keeps the rows where it's false, and the rows where it's null are in neither.

To return `true` or `false` when the answer is `null`, you have two options, with a required result in both:

| You write | On a row where `parentId` is null |
|---|---|
| `tCompany.parentId.equals(1).valueWhenNull(false)` | `false`, the value you pass |
| `tCompany.parentId.is(1)` | `false`, because null isn't `1` |

If you really want a comparison in the database with a value of your code that may be null, turn the value into an expression with `connection.optionalConst`. The null is sent as a parameter, and the query returns no rows:

```ts
const parentId: number | null = null

const companies = await connection.selectFrom(tCompany)
    .where(tCompany.parentId.equals(connection.optionalConst(parentId, 'int')))
    .select({
        id: tCompany.id,
        name: tCompany.name
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
    where parent_id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        `name` as `name` 
    from company 
    where parent_id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name" 
    from company 
    where parent_id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name 
    from company 
    where parent_id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name 
    from company 
    where parent_id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name 
    from company 
    where parent_id = @0
    ```

The parameters are: `[ null ]`

[How to compare against a null or undefined value?](../../about/limitations.md#how-to-compare-against-a-null-or-undefined-value), in the limitations page, sums up these options.

## `and`, `or` and `negate` with a null

A condition can be `null`, so `and`, `or` and `negate` have to work with it. With `and`, a `false` decides the result. With `or`, a `true` decides it. If nothing decides it and there is a null, the result is `null`:

| `a` | `b` | `a.and(b)` | `a.or(b)` | `a.negate()` |
|---|---|---|---|---|
| `true` | `true` | `true` | `true` | `false` |
| `true` | `false` | `false` | `true` | `false` |
| `true` | `null` | `null` | `true` | `false` |
| `false` | `true` | `false` | `true` | `true` |
| `false` | `false` | `false` | `false` | `true` |
| `false` | `null` | `false` | `null` | `true` |
| `null` | `true` | `null` | `true` | `null` |
| `null` | `false` | `false` | `null` | `null` |
| `null` | `null` | `null` | `null` | `null` |

That's why a condition and its opposite don't always return all the rows: `tCompany.parentId.equals(1).or(tCompany.parentId.notEquals(1))` is `null` on a company without a parent, and that company isn't returned.

## `notIn` with a subquery that returns a null

`id not in (1, null)` means `id <> 1 and id <> null`. The second part is always `null`, so by the table above the whole condition can't be true, and the query returns no rows, whatever `id` is.

A list of values from your code can't have a null, because its type doesn't allow it. A subquery on an optional column can return one. To get the companies that aren't the parent of any company, leave the nulls out of the subquery. Without its `where`, this query would return nothing as soon as one company has no parent:

```ts
const companiesThatAreParents = connection.selectFrom(tCompany)
    .where(tCompany.parentId.isNotNull())
    .selectOneColumn(tCompany.parentId)

const companies = await connection.selectFrom(tCompany)
    .where(tCompany.id.notIn(companiesThatAreParents))
    .select({
        id: tCompany.id,
        name: tCompany.name
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
    where id not in (select parent_id as result from company where parent_id is not null)
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        `name` as `name` 
    from company 
    where id not in (select parent_id as result from company where parent_id is not null)
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name" 
    from company 
    where id not in (select parent_id as "result" from company where parent_id is not null)
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name 
    from company 
    where id not in (select parent_id as result from company where parent_id is not null)
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name 
    from company 
    where id not in (select parent_id as result from company where parent_id is not null)
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name 
    from company 
    where id not in (select parent_id as [result] from company where parent_id is not null)
    ```

The parameters are: `[]`

`in` with the same subquery returns the rows that match: the rest are `false` or `null`, and both are discarded.

Used as a value of the select, `in` and `notIn` with a subquery on an optional column are optional in the result type, because the answer can be `null`: with the assignees `1`, `2` and `null`, `tIssue.id.in(assignees)` is `true` for the issue `1` and `null` for the issue `4`. A subquery on a required column keeps the type of the left side.

## See also

- [Optional conditions: the IfValue methods](../../queries/dynamic-queries.md#optional-conditions-the-ifvalue-methods): the `*IfValue` methods and the neutral boolean in depth.
- [How to compare against a null or undefined value?](../../about/limitations.md#how-to-compare-against-a-null-or-undefined-value): the same question in the limitations page.
- [Custom booleans values](../../advanced/custom-booleans-values.md): booleans stored with other values, such as `'Y'` and `'N'`.
