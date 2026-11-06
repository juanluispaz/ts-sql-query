---
search:
  boost: 2
---
# Dynamic queries

A dynamic query is a query whose conditions, order or paging depend on what arrives while the program runs. It's what a search form or a list with filters needs: "the customers whose name contains this text, but only if the user wrote a text, ordered by the column the user clicked, and only the requested page".

The usual way of doing this is concatenating pieces of SQL, which is error-prone and opens the door to SQL injection. With `ts-sql-query` you write one query with all the possible parts, and you mark which ones are optional. When the query is executed, the library writes the SQL without the parts that don't apply. The values you pass go as parameters, and a column name that comes from outside, as in `orderByFromString`, is only accepted if it's a property of the select, so what the user sends never becomes SQL text.

## Introduction

Each part of a query has its own way of being optional:

| What depends on the run | What to use | Where it's explained |
|---|---|---|
| A condition applies only if there is a value | `equalsIfValue`, `containsIfValue` and the rest of the `*IfValue` methods | [Easy dynamic queries](#easy-dynamic-queries) |
| A condition with no value means `true`, `false` or another condition | `trueWhenNoValue`, `falseWhenNoValue`, `valueWhenNoValue` | [When there is no value](#when-there-is-no-value) |
| A condition applies only if a flag is set, like a role | `onlyWhen`, `ignoreWhen` | [Ignorable boolean expression](#ignorable-boolean-expression) |
| A selected value is returned only if a flag is set | `onlyWhenOrNull`, `ignoreWhenAsNull` | [Ignorable expression as null](#ignorable-expression-as-null) |
| Your code decides which conditions to add | `dynamicWhere`, `dynamicBooleanExpressionUsing` | [Building a condition step by step](#building-a-condition-step-by-step) |
| The same, in the `on` of a join or in the `having` | `dynamicOn`, `dynamicHaving` | [Dynamic join conditions and having](#dynamic-join-conditions-and-having) |
| The order comes as text, from a request | `orderByFromString`, `orderByFromStringArray` and their `IfValue` variants | [Order by from a string](#order-by-from-a-string) |
| The limit and the offset may be absent | `limitIfValue`, `offsetIfValue` | [Optional limit and offset](#optional-limit-and-offset) |
| A table is joined only if the query uses it | `optionalJoin`, `optionalInnerJoin`, `optionalLeftJoin`, `optionalLeftOuterJoin` | [Optional joins](#optional-joins) |

Inserts and updates have their own family, to set a column only if there is a value (`setIfValue`, `setIfSet`, `setIfNotSet`, `ignoreIfSet`...): see [Manipulating values to insert](insert.md#manipulating-values-to-insert) and [Manipulating values to update](update.md#manipulating-values-to-update).

When the caller also chooses which columns the select returns, or sends the filter as an object, or when using a value must fail with an error because the user can't see it (`allowWhen`, `disallowWhen`), go to [Extreme dynamic queries](extreme-dynamic-queries.md). What's on this page is enough for most queries.

For a short tour of these methods, with one example each, see [Dynamic query building blocks](../dynamic/building-blocks.md).

When the conditions, the order and the page come from a request, like in a table of a user interface or an API for other systems, see [Queries from a request](../dynamic/queries-from-requests.md).

## Declarative dynamic queries

Write the query as a single expression, with the optional parts inside it. In many query builders, a dynamic query is built by adding conditions with `if`s or by filling an array of conditions. Here there is no method that receives a list of conditions, and most of the time you don't need the `if`: `equalsIfValue` already says "only if there is a value", in the place where the condition is, and the query reads the same way whichever values arrive.

```ts
const companyId: number | null = null;

const customers = await connection.selectFrom(tCustomer)
    .where(tCustomer.companyId.equalsIfValue(companyId))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .executeSelectMany();
```

When what to add can't be said with these methods, because it depends on the logic of your code, you can use `if`s by [building the condition step by step](#building-a-condition-step-by-step).

## Easy dynamic queries

The methods ending in `IfValue` compare with a value that may be absent. When they have no value, they return a special [**neutral boolean**](#the-neutral-boolean), which means "there is no condition here": the library removes it from the `and`s, `or`s, `on`s and `where`s it's part of. It isn't the `null` of SQL: [Booleans and three-valued logic](../dynamic/three-valued-booleans.md) explains the difference.

Use them when an absent value means "don't filter by this". `equals` and the other methods without `IfValue` don't accept `null` or `undefined`: see [why an optional value is a dynamic filter](../dynamic/three-valued-booleans.md#optional-backend-values-are-dynamic-queries-the-ifvalue-methods) and not a comparison with null.

In this example, only the first of the three conditions has a value. The order comes as text from the request, and it's explained in [Order by from a string](#order-by-from-a-string):

```ts
const firstNameContains = 'ohn';
const lastNameContains = null;
const birthdayIs = null;
const searchOrderBy = 'name insensitive, birthday asc nulls last';
// const searchOrderBy = ['name insensitive', 'birthday asc nulls last']; // order by as string array

const searchedCustomers = connection.selectFrom(tCustomer)
    .where(
                tCustomer.firstName.containsIfValue(firstNameContains)
            .or(tCustomer.lastName.containsIfValue(lastNameContains))
        ).and(
            tCustomer.birthday.equalsIfValue(birthdayIs)
        )
    .select({
        id: tCustomer.id,
        name: tCustomer.firstName.concat(' ').concat(tCustomer.lastName),
        birthday: tCustomer.birthday
    })
    .orderByFromString(searchOrderBy)
    // .orderByFromStringArray(searchOrderBy) // If you use searchOrderBy as string array
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        concat(first_name, ?, last_name) as name, 
        birthday as birthday 
    from customer 
    where first_name like concat('%', ?, '%') 
    order by 
        lower(concat(first_name, ?, last_name)), 
        birthday is null, 
        birthday asc
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        concat(first_name, ?, last_name) as `name`, 
        birthday as birthday 
    from customer 
    where first_name like concat('%', ?, '%') 
    order by 
        lower(concat(first_name, ?, last_name)), 
        birthday is null, 
        birthday asc
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name || :0 || last_name as "name", 
        birthday as "birthday" 
    from customer 
    where first_name like ('%' || :1 || '%') escape '\' 
    order by 
        lower("name"), 
        "birthday" asc nulls last
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name || $1 || last_name as name, 
        birthday as birthday 
    from customer 
    where first_name like ('%' || $2 || '%') 
    order by 
        lower(first_name || $1 || last_name), 
        birthday asc nulls last
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name || ?1 || last_name as name, 
        birthday as birthday 
    from customer 
    where first_name like ('%' || ?2 || '%') escape '\' 
    order by 
        lower(first_name || ?1 || last_name), 
        birthday asc nulls last
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name + @0 + last_name as name, 
        birthday as birthday 
    from customer 
    where first_name like ('%' + @1 + '%') 
    order by 
        lower(first_name + @0 + last_name), 
        iif(customer.birthday is null, 1, 0), 
        birthday asc
    ```

The parameters are: `[ ' ', 'ohn' ]` (on [MariaDB](../configuration/supported-databases/mariadb.md) and [MySQL](../configuration/supported-databases/mysql.md) the case-insensitive `order by` writes the concatenated expression again, with its separator bound again, giving `[ ' ', 'ohn', ' ' ]`: inside an `order by` expression these databases would take a column of the table with the same name as the alias before the alias, and they can't repeat a parameter)

The result type is:
```tsx
const searchedCustomers: Promise<{
    id: number;
    name: string;
    birthday?: Date;
}[]>
```

### What counts as no value

| Value | For the `*IfValue` methods |
|---|---|
| `null`, `undefined` | No value |
| An empty string, `''` | No value, unless the connection has [`allowEmptyString`](../configuration/connection.md#allowing-empty-string) set to `true` |
| An empty array, `[]`, in `inIfValue` and `notInIfValue` | No value |
| `0`, `false` | A value: `tCustomer.id.equalsIfValue(0)` compares the id with 0 |
| A string with spaces, `' '` | A value |

With `allowEmptyString`, `containsIfValue('')` is a condition too, and it matches every text that isn't null. Without it, an empty string is treated as null everywhere: `equals('')` sends a null to the database.

The methods without `IfValue` behave differently with the same values:

| Call | Result |
|---|---|
| `tCustomer.id.inIfValue([])` | There is no condition, all the rows pass |
| `tCustomer.id.in([])` | A condition that is always false, no row passes |
| `tCustomer.id.notInIfValue([])` | There is no condition, all the rows pass |
| `tCustomer.id.notIn([])` | A condition that is always true, all the rows pass |
| `tCustomer.birthday.isIfValue(null)` | There is no condition, all the rows pass |
| `tCustomer.birthday.isNull()` | Only the rows whose birthday is null pass |

### How conditions without a value combine

A condition without a value disappears, as if it hadn't been written. It isn't taken as `true` or `false`. These are the conditions that are left when `b` and `c` have no value and `a` has one:

| Expression | What is written in the SQL |
|---|---|
| `a.and(b)` | `a` |
| `a.or(b)` | `a` |
| `b.or(a)` | `a` |
| `a.and(b.or(c))` | `a` |
| `b.or(c)` | Nothing |
| `b.negate()` | Nothing |

For example, in the query above:

| `firstNameContains` | `lastNameContains` | `birthdayIs` | The `where` of the query |
|---|---|---|---|
| `'ohn'` | `null` | `null` | `first_name like ...` |
| `'ohn'` | `'mi'` | `null` | `first_name like ... or last_name like ...` |
| `null` | `null` | a date | `birthday = ...` |
| `null` | `null` | `null` | There is no `where`, all the rows are returned |

The last row is what happens when nothing arrives in a select. In a delete or an update, it's an error: see [A condition that ends up empty](#a-condition-that-ends-up-empty). If what you need is to add conditions with your own `if`s, see [`dynamicWhere`](#building-a-condition-step-by-step).

### All the IfValue methods

| On | Methods |
|---|---|
| Any data type | `equalsIfValue`, `notEqualsIfValue`, `isIfValue`, `isNotIfValue`, `inIfValue`, `notInIfValue` |
| Data types with an order: numbers, text, dates, times | `lessThanIfValue`, `greaterThanIfValue`, `lessOrEqualIfValue`, `greaterOrEqualIfValue` |
| Text | `equalsInsensitiveIfValue`, `notEqualsInsensitiveIfValue`, `likeIfValue`, `notLikeIfValue`, `likeInsensitiveIfValue`, `notLikeInsensitiveIfValue`, `startsWithIfValue`, `notStartsWithIfValue`, `endsWithIfValue`, `notEndsWithIfValue`, `startsWithInsensitiveIfValue`, `notStartsWithInsensitiveIfValue`, `endsWithInsensitiveIfValue`, `notEndsWithInsensitiveIfValue`, `containsIfValue`, `notContainsIfValue`, `containsInsensitiveIfValue`, `notContainsInsensitiveIfValue` |

`between` and `notBetween` have no `IfValue` variant. For a range whose ends may be absent, use `greaterOrEqualIfValue` and `lessOrEqualIfValue`, joined with `and`.

Some methods with the same ending don't return a condition, but a text. Without a value, they return the original text unchanged:

- `tCustomer.firstName.concatIfValue(suffix)` and `concatIgnoringNullIfValue` add `suffix` only if it has a value.
- `tCustomer.firstName.replaceAllIfValue(find, replaceWith)` and `replaceAllInsensitiveIfValue` replace only if both have a value.

`nullIfValue` doesn't belong to this family, despite its name: it's the `nullif` of SQL, which returns null when the expression is equal to the value.

To create your own methods that work like these, see [Conditional fragments](sql-fragments.md#conditional-fragments).

### When there is no value

Sometimes an absent value must not remove the condition. For example, a user with no assigned companies has to see no customers, and not all of them. These methods, written at the end of the condition, say what it means when there is no value. When there is a value, they do nothing:

| Method | When there is no value |
|---|---|
| `trueWhenNoValue()` | A condition that is always true |
| `falseWhenNoValue()` | A condition that is always false |
| `valueWhenNoValue(value)` | The given value, which can be `true`, `false` or another condition |

```ts
const allowedCompanyIds: number[] = [];

const customers = await connection.selectFrom(tCustomer)
    .where(tCustomer.companyId.inIfValue(allowedCompanyIds).falseWhenNoValue())
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .executeSelectMany();
```

With an empty list, the `where` is always false, and the query returns no rows. With `valueWhenNoValue`, another condition takes the place of the one without a value:

```ts
const firstName: string | null = null;

const customers = await connection.selectFrom(tCustomer)
    .where(
        tCustomer.firstName.equalsIfValue(firstName)
            .valueWhenNoValue(tCustomer.lastName.equals('Smith'))
    )
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .executeSelectMany();
```

They apply to everything they are written after: in `a.equalsIfValue(x).and(b.equalsIfValue(y)).falseWhenNoValue()`, the condition is false only if neither `x` nor `y` has a value. They also apply to the neutral boolean of `onlyWhen`, `ignoreWhen`, `noValueBoolean` and `dynamicBooleanExpressionUsing`.

They have another use. An `IfValue` condition on its own can't be selected, because it might not exist. With `trueWhenNoValue` or `falseWhenNoValue` it's always a boolean, and you can return it:

```ts
const searchedCompanyId: number | null = 16;

const customers = await connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id,
        isInSearchedCompany: tCustomer.companyId.equalsIfValue(searchedCompanyId).falseWhenNoValue()
    })
    .executeSelectMany();
```

The result type is:
```tsx
const customers: {
    id: number;
    isInSearchedCompany: boolean;
}[]
```

## Ignorable boolean expression

`onlyWhen` and `ignoreWhen`, at the end of a condition, make it depend on a boolean of your code. When the condition doesn't apply, they return the [neutral boolean](#the-neutral-boolean), so it disappears just like an `IfValue` without a value:

| Method | The condition applies when the argument is |
|---|---|
| `onlyWhen(condition)` | `true` |
| `ignoreWhen(condition)` | `false` |

They're useful for restrictions that depend on something that isn't a value of the condition, like the roles of the user:

```ts
const userCompanyId = 16
const onlyCustomersOfUserCompany = true

const customers = await connection.selectFrom(tCustomer)
    .where(tCustomer.companyId.equals(userCompanyId).onlyWhen(onlyCustomersOfUserCompany))
    .select({
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday
    })
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where company_id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where company_id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as "birthday" 
    from customer 
    where company_id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as birthday 
    from customer 
    where company_id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where company_id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer 
    where company_id = @0
    ```

The parameters are: `[ 16 ]`

The result type is:
```tsx
const customers: Promise<{
    firstName: string;
    lastName: string;
    birthday?: Date;
}[]>
```

But when `onlyCustomersOfUserCompany` is false, the condition in the where is left out:
```ts
const userCompanyId = 16
const onlyCustomersOfUserCompany = false // CHANGED

const customers = await connection.selectFrom(tCustomer)
    .where(tCustomer.companyId.equals(userCompanyId).onlyWhen(onlyCustomersOfUserCompany))
    .select({
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday
    })
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer
    ```
=== "MySQL"
    ```mysql
    select 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer
    ```
=== "Oracle"
    ```oracle
    select 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as "birthday" 
    from customer
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as birthday 
    from customer
    ```
=== "SQLite"
    ```sqlite
    select 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer
    ```
=== "SQL Server"
    ```sqlserver
    select 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer
    ```

The parameters are: `[ ]`

`ignoreWhen` says the same thing the other way around, which reads better when the argument is the exception, like an administrator who has no restriction:

```ts
const userCompanyId = 16
const userIsAdmin = true

const customers = await connection.selectFrom(tCustomer)
    .where(tCustomer.companyId.equals(userCompanyId).ignoreWhen(userIsAdmin))
    .select({
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName
    })
    .executeSelectMany()
```

Here the query has no `where`. An `onlyWhen` that leaves a delete or an update without a condition is [an error](#a-condition-that-ends-up-empty).

### The neutral boolean

`connection.noValueBoolean()` returns that neutral boolean directly: a condition that is ignored in `and`s, `or`s, `on`s and `where`s. It is useful to choose between a condition and no condition at all. It belongs to your code and it isn't one of the three values of a boolean in SQL (`true`, `false`, `null`), which [Booleans and three-valued logic](../dynamic/three-valued-booleans.md) explains:

```ts
const canSeeEveryCompany: boolean = true;
const userCompanyId = 1;

const customers = await connection.selectFrom(tCustomer)
    .where(canSeeEveryCompany ? connection.noValueBoolean() : tCustomer.companyId.equals(userCompanyId))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id,
        first_name as firstName
    from customer
    ```
=== "MySQL"
    ```mysql
    select 
        id as id,
        first_name as firstName
    from customer
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id",
        first_name as "firstName"
    from customer
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id,
        first_name as "firstName"
    from customer
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id,
        first_name as firstName
    from customer
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id,
        first_name as firstName
    from customer
    ```

The parameters are: `[]`

The result type is:
```tsx
const customers: Promise<{
    id: number;
    firstName: string;
}[]>
```

## Ignorable expression as null

`onlyWhen` is for conditions, which can disappear from a query. A selected value can't disappear, because the result always has the same properties. `onlyWhenOrNull` and `ignoreWhenAsNull` are written at the end of any expression, and when it doesn't apply, they write a null in its place:

| Method | The expression is used when the argument is | Otherwise |
|---|---|---|
| `onlyWhenOrNull(when)` | `true` | `null` |
| `ignoreWhenAsNull(when)` | `false` | `null` |

Because the value may be null, the property is optional in the result type. They're useful, for example, to hide some columns from the users without a role:

```ts
const customerId = 10
const displayNames = true

const customerWithIdWithRules = connection.selectFrom(tCustomer)
    .where(tCustomer.id.equals(customerId))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName.onlyWhenOrNull(displayNames),
        lastName: tCustomer.lastName.onlyWhenOrNull(displayNames),
        birthday: tCustomer.birthday
    })
    .executeSelectOne()
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
const customerWithIdWithRules: Promise<{
    id: number;
    firstName?: string;
    lastName?: string;
    birthday?: Date;
}>
```

But when `displayNames` is false, the expressions are replaced by null:
```ts
const customerId = 10
const displayNames = false // CHANGED

const customerWithIdWithRules = connection.selectFrom(tCustomer)
    .where(tCustomer.id.equals(customerId))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName.onlyWhenOrNull(displayNames),
        lastName: tCustomer.lastName.onlyWhenOrNull(displayNames),
        birthday: tCustomer.birthday
    })
    .executeSelectOne()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        null as firstName, 
        null as lastName, 
        birthday as birthday 
    from customer 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        null as firstName, 
        null as lastName, 
        birthday as birthday 
    from customer 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        null as "firstName", 
        null as "lastName", 
        birthday as "birthday" 
    from customer 
    where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        null::text as "firstName", 
        null::text as "lastName", 
        birthday as birthday 
    from customer 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        null as firstName, 
        null as lastName, 
        birthday as birthday 
    from customer 
    where id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        null as firstName, 
        null as lastName, 
        birthday as birthday 
    from customer 
    where id = @0
    ```

The parameters are: `[ 10 ]`

## Building a condition step by step

When what to add depends on the logic of your code, and not just on whether a value is present, there are two ways of using `if`s.

`dynamicWhere()` starts the `where` with no condition. Then `and(...)` and `or(...)` add conditions to the query, and there's no need to reassign the variable:

```ts
const companyId: number | undefined = 16;
const onlyWithBirthday = true;

const query = connection.selectFrom(tCustomer)
    .dynamicWhere();
if (companyId !== undefined) {
    query.and(tCustomer.companyId.equals(companyId));
}
if (onlyWithBirthday) {
    query.and(tCustomer.birthday.isNotNull());
}

const customers = await query
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .executeSelectMany();
```

`connection.dynamicBooleanExpressionUsing(...)` creates a [neutral boolean](#the-neutral-boolean) in a variable that you can reassign. It receives the tables or views that the conditions are going to use, up to five. Each `and` and `or` returns a new condition, so assign it to the variable. Unlike `dynamicWhere`, the result isn't tied to a query: you can build it in a function, and use it in a `where`, an `on` or a `having`.

```ts
const firstNameContains: string | null = 'ohn';
const companyName: string | null = 'Acme';

let condition = connection.dynamicBooleanExpressionUsing(tCustomer, tCompany);
if (firstNameContains) {
    condition = condition.and(tCustomer.firstName.contains(firstNameContains));
}
if (companyName) {
    condition = condition.or(tCompany.name.equals(companyName));
}

const customers = await connection.selectFrom(tCustomer)
    .innerJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
    .where(condition)
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .executeSelectMany();
```

The two of them can receive `*IfValue` conditions too, and when no condition is added, the result is [an empty condition](#a-condition-that-ends-up-empty). [Complex dynamic boolean expressions](extreme-dynamic-queries.md#complex-dynamic-boolean-expressions) has a longer example.

## Dynamic join conditions and having

Like `dynamicWhere()`, `dynamicOn()` starts the condition of a join and `dynamicHaving()` the having, with no condition; then `and(...)` and `or(...)` add the conditions while the query is built:

```ts
const onlyCustomersWithBirthday = true;
const minimumCustomers: number | undefined = 2;

const query = connection.selectFrom(tCompany)
    .innerJoin(tCustomer).dynamicOn()
    .and(tCustomer.companyId.equals(tCompany.id));
if (onlyCustomersWithBirthday) {
    query.and(tCustomer.birthday.isNotNull());
}

const grouped = query.groupBy(tCompany.id, tCompany.name).dynamicHaving();
if (minimumCustomers !== undefined) {
    grouped.and(connection.count(tCustomer.id).greaterOrEqual(minimumCustomers));
}

const companies = await grouped
    .select({
        id: tCompany.id,
        name: tCompany.name,
        customerCount: connection.count(tCustomer.id)
    })
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company.id as id,
        company.name as name,
        count(customer.id) as customerCount
    from company
    inner join customer on customer.company_id = company.id and customer.birthday is not null
    group by company.id, company.name
    having count(customer.id) >= ?
    ```
=== "MySQL"
    ```mysql
    select 
        company.id as id,
        company.`name` as `name`,
        count(customer.id) as customerCount
    from company
    inner join customer on customer.company_id = company.id and customer.birthday is not null
    group by company.id, company.`name`
    having count(customer.id) >= ?
    ```
=== "Oracle"
    ```oracle
    select 
        company.id as "id",
        company.name as "name",
        count(customer.id) as "customerCount"
    from company
    inner join customer on customer.company_id = company.id and customer.birthday is not null
    group by company.id, company.name
    having count(customer.id) >= :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as id,
        company.name as name,
        count(customer.id) as "customerCount"
    from company
    inner join customer on customer.company_id = company.id and customer.birthday is not null
    group by company.id, company.name
    having count(customer.id) >= $1
    ```
=== "SQLite"
    ```sqlite
    select 
        company.id as id,
        company.name as name,
        count(customer.id) as customerCount
    from company
    inner join customer on customer.company_id = company.id and customer.birthday is not null
    group by company.id, company.name
    having count(customer.id) >= ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company.id as id,
        company.name as name,
        count(customer.id) as customerCount
    from company
    inner join customer on customer.company_id = company.id and customer.birthday is not null
    group by company.id, company.name
    having count(customer.id) >= @0
    ```

The parameters are: `[ 2 ]`

The result type is:
```tsx
const companies: Promise<{
    id: number;
    name: string;
    customerCount: number;
}[]>
```

## A condition that ends up empty

A condition can be left with nothing written in it: a `dynamicWhere()` without any `and` or `or`, a `where` with only `*IfValue` conditions without a value, or an `onlyWhen(false)`. What happens depends on where it is:

| Where the condition is | What happens |
|---|---|
| The `where` of a select | The query has no `where`, and it returns all the rows |
| The `having` of a select | The query has no `having` |
| The `on` of a join | The `on` is a condition that is always true, so each row is combined with all the rows of the joined table |
| The `where` of a `deleteFrom` or an `update` | The returned promise rejects with the reason `MISSING_WHERE`, and nothing is sent to the database |
| The `where` of a `deleteAllowingNoWhereFrom` or an `updateAllowingNoWhere` | The statement has no `where`, and it affects all the rows of the table |

The error in a delete or an update protects you from a filter that arrives empty by mistake, and that would otherwise change the whole table:

```ts
import { TsSqlError } from "ts-sql-query" // or "ts-sql-query/TsSqlError"

const customerId: number | null = null;

try {
    await connection.deleteFrom(tCustomer)
        .where(tCustomer.id.equalsIfValue(customerId))
        .executeDelete();
} catch (e) {
    if (e instanceof TsSqlError && e.errorReason.reason === 'MISSING_WHERE') {
        // Nothing was deleted, and no query was sent
    }
}
```

The methods of [When there is no value](#when-there-is-no-value) make the condition no longer empty, so they change this:

| Written in a delete or an update | When there is no value |
|---|---|
| `...IfValue(x)` | The `MISSING_WHERE` error |
| `...IfValue(x).falseWhenNoValue()` | The query is sent with a condition that is always false: it affects no rows, and it's not an error |
| `...IfValue(x).trueWhenNoValue()` | The query is sent with a condition that is always true: it affects **all the rows** of the table |

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

The text is a list of clauses separated by commas. Each one is a property of the select followed by a mode, and with no mode the order is ascending. Upper and lower case don't matter, nor do extra spaces: `'  LASTNAME   DESC '` is `lastName desc`. A property inside a nested object of the select is written with a dot, like `'company.name desc'`.

These are all the accepted forms, for a property called `name`:

| Order | Rows without a value where the database puts them | Rows without a value first | Rows without a value last |
|---|---|---|---|
| Ascending | `name`, `name asc` | `name asc nulls first` | `name asc nulls last` |
| Descending | `name desc` | `name desc nulls first` | `name desc nulls last` |
| Ascending, not distinguishing upper and lower case | `name insensitive`, `name asc insensitive` | `name asc nulls first insensitive` | `name asc nulls last insensitive` |
| Descending, not distinguishing upper and lower case | `name desc insensitive` | `name desc nulls first insensitive` | `name desc nulls last insensitive` |

The words must be in that order. They mean the same as in [the order modes](select.md#the-order-modes) of `orderBy`, which explains what each one does in each database, and what `insensitive` does.

### The variants

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

They can be combined with `orderBy` and with each other: each call adds its clauses after the ones already there. They can also be used after a [compound operator](compound-select.md#ordering-the-combined-result).

If you can describe the accepted order with a type, [`OrderByForModel`](../dynamic/utilities/order-by.md) checks it when compiling.

### Errors of the order

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

[Select page](select-page.md) explains how a page is defined, why it must be ordered, and how to get the total of rows too.

## Optional joins

An optional join is a join that the library writes in the SQL only if the query uses the joined table. It's meant for a query whose columns or conditions are decided while it runs: if the query doesn't need the table, the database doesn't have to read it.

Each normal join has an optional variant, and it's written in the SQL in the same way as that join when it's needed:

| Optional join | The same as |
|---|---|
| `optionalJoin(table)` | `join(table)` |
| `optionalInnerJoin(table)` | `innerJoin(table)` |
| `optionalLeftJoin(table.forUseInLeftJoin())` | `leftJoin(table.forUseInLeftJoin())` |
| `optionalLeftOuterJoin(table.forUseInLeftJoin())` | `leftOuterJoin(table.forUseInLeftJoin())` |

They're available in a select, and the type of the columns is the same as with the normal join. In this example, the join is only needed if `companyName` has a value:

```ts
const companyName = 'My company name'

const customers = connection.selectFrom(tCustomer)
    .optionalJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
    .where(tCompany.name.equalsIfValue(companyName))
    .select({
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday
    })
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday 
    from customer 
    join company on company.id = customer.company_id 
    where company.name = ?
    ```
=== "MySQL"
    ```mysql
    select 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday 
    from customer 
    join company on company.id = customer.company_id 
    where company.`name` = ?
    ```
=== "Oracle"
    ```oracle
    select 
        customer.first_name as "firstName", 
        customer.last_name as "lastName", 
        customer.birthday as "birthday" 
    from customer 
    join company on company.id = customer.company_id 
    where company.name = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.first_name as "firstName", 
        customer.last_name as "lastName", 
        customer.birthday as birthday 
    from customer 
    join company on company.id = customer.company_id 
    where company.name = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday 
    from customer 
    join company on company.id = customer.company_id 
    where company.name = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday 
    from customer 
    join company on company.id = customer.company_id 
    where company.name = @0
    ```

The parameters are: `[ "My company name" ]`

The result type is:
```tsx
const customers: Promise<{
    firstName: string;
    lastName: string;
    birthday?: Date;
}[]>
```

But when `companyName` is null or undefined, the condition in the where is left out. The company table isn't used anymore, so the join is left out too:
```ts
const companyName = null // CHANGED

const customers = connection.selectFrom(tCustomer)
    .optionalJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
    .where(tCompany.name.equalsIfValue(companyName))
    .select({
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday
    })
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer
    ```
=== "MySQL"
    ```mysql
    select 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer
    ```
=== "Oracle"
    ```oracle
    select 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as "birthday" 
    from customer
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as birthday 
    from customer
    ```
=== "SQLite"
    ```sqlite
    select 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer
    ```
=== "SQL Server"
    ```sqlserver
    select 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday 
    from customer
    ```

The parameters are: `[ ]`

### When a join is kept and when it's left out

The library looks at what will be written in the query. A join is kept if its table is used in any of these places:

| The table is used in | Example | The join is |
|---|---|---|
| A selected value | `companyName: tCompany.name` | Kept |
| A condition of the `where` or `having` that has a value | `tCompany.name.equalsIfValue('Acme')` | Kept |
| A condition without a value | `tCompany.name.equalsIfValue(null)`, even with `.trueWhenNoValue()` | Left out |
| A condition that doesn't apply | `tCompany.name.equals('Acme').onlyWhen(false)` | Left out |
| A value replaced by null | `tCompany.name.onlyWhenOrNull(false)` | Left out |
| The `group by` | `.groupBy(tCompany.name)` | Kept |
| An `orderBy` with an expression | `.orderBy(tCompany.name)` | Kept |
| The `on` of a normal join | `.join(tOther).on(tOther.id.equals(tCompany.parentId))` | Kept |
| The `on` of another optional join that is kept | The same with `optionalJoin(tOther)`, if `tOther` is used | Kept |
| A subquery written in the query | `connection.subSelectUsing(tCompany)...` | Kept |
| A fragment in [`customizeQuery`](sql-fragments.md#customizing-a-select) | A `rawFragment` that uses `tCompany.name` | Kept |

If an optional join uses another one in its `on`, using the last one keeps both, and using only the first one keeps only the first one.

### It can change the number of rows

!!! warning

    The rows of the result can depend on whether the join is written, so check what the join does with your data.

A join doesn't only add columns: it can also remove and repeat rows. When an optional join is left out, that effect isn't there:

| Rows of the joined table for each row of the initial table | `optionalJoin`, `optionalInnerJoin` | `optionalLeftJoin`, `optionalLeftOuterJoin` |
|---|---|---|
| Exactly one | Same rows with and without the join | Same rows with and without the join |
| Sometimes none | The rows without a match are only there without the join | Same rows with and without the join |
| Sometimes more than one | The rows with several matches are repeated with the join, and once without it | The rows with several matches are repeated with the join, and once without it |

So the typical optional join goes to the row that a foreign key points to, like the company of a customer: a required foreign key gives exactly one row, and a left join covers one that can be null. An optional join to the customers of a company returns a different number of rows depending on whether it's written.

### Optional joins with a value replaced by null

Optional joins go well with [`onlyWhenOrNull`](#ignorable-expression-as-null): the properties of the result are always the same, and the join is written only if they are going to have a value.

```ts
const canSeeCompanyInfo = false

const customerWithOptionalCompany = connection.selectFrom(tCustomer)
    .optionalInnerJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday,
        companyId: tCompany.id.onlyWhenOrNull(canSeeCompanyInfo),
        companyName: tCompany.name.onlyWhenOrNull(canSeeCompanyInfo)
    })
    .where(tCustomer.id.equals(12))
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday, 
        null as companyId, 
        null as companyName 
    from customer 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday, 
        null as companyId, 
        null as companyName 
    from customer 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as "birthday", 
        null as "companyId", 
        null as "companyName" 
    from customer 
    where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName", 
        birthday as birthday, 
        null::int4 as "companyId", 
        null::text as "companyName" 
    from customer 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday, 
        null as companyId, 
        null as companyName 
    from customer 
    where id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName, 
        birthday as birthday, 
        null as companyId, 
        null as companyName 
    from customer 
    where id = @0
    ```

The parameters are: `[ 12 ]`

The result type is:
```tsx
const customerWithOptionalCompany: Promise<{
    id: number;
    firstName: string;
    lastName: string;
    birthday?: Date;
    companyName?: string;
    companyId?: number;
}[]>
```

But when a column provided by the join is required, because `canSeeCompanyInfo` is true:
```ts
const canSeeCompanyInfo = true // CHANGED

const customerWithOptionalCompany = connection.selectFrom(tCustomer)
    .optionalInnerJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday,
        companyId: tCompany.id.onlyWhenOrNull(canSeeCompanyInfo),
        companyName: tCompany.name.onlyWhenOrNull(canSeeCompanyInfo)
    })
    .where(tCustomer.id.equals(12))
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday, 
        company.id as companyId, 
        company.name as companyName 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday, 
        company.id as companyId, 
        company.`name` as companyName 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        customer.id as "id", 
        customer.first_name as "firstName", 
        customer.last_name as "lastName", 
        customer.birthday as "birthday", 
        company.id as "companyId", 
        company.name as "companyName" 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.id as id, 
        customer.first_name as "firstName", 
        customer.last_name as "lastName", 
        customer.birthday as birthday, 
        company.id as "companyId", 
        company.name as "companyName" 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday, 
        company.id as companyId, 
        company.name as companyName 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday, 
        company.id as companyId, 
        company.name as companyName 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = @0
    ```

The parameters are: `[ 12 ]`

With a left join, the columns of the joined table are optional in the result type, as in any left join:

```ts
const canSeeCompanyInfo = true;
const tCompanyForLeftJoin = tCompany.forUseInLeftJoin();

const customerWithOptionalCompany = await connection.selectFrom(tCustomer)
    .optionalLeftJoin(tCompanyForLeftJoin).on(tCompanyForLeftJoin.id.equals(tCustomer.companyId))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        companyName: tCompanyForLeftJoin.name.onlyWhenOrNull(canSeeCompanyInfo)
    })
    .executeSelectMany();
```

The result type is:
```tsx
const customerWithOptionalCompany: {
    id: number;
    firstName: string;
    companyName?: string;
}[]
```

When the columns are chosen by the caller, the join can depend on them too: see [Optional joins dynamically picking columns](extreme-dynamic-queries.md#optional-joins-dynamically-picking-columns).
