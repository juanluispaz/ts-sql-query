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
| A condition applies only if there is a value | `equalsIfValue`, `containsIfValue` and the rest of the `*IfValue` methods | [Optional conditions: the IfValue methods](#optional-conditions-the-ifvalue-methods) |
| A condition with no value means `true`, `false` or another condition | `trueWhenNoValue`, `falseWhenNoValue`, `valueWhenNoValue` | [When there is no value](#when-there-is-no-value) |
| A condition applies only if a flag is set, like a role | `onlyWhen`, `ignoreWhen` | [Ignorable conditions: onlyWhen and ignoreWhen](#ignorable-conditions-onlywhen-and-ignorewhen) |
| A selected value is returned only if a flag is set | `onlyWhenOrNull`, `ignoreWhenAsNull` | [Ignorable values: onlyWhenOrNull](#ignorable-values-onlywhenornull) |
| The order comes as text, from a request | `orderByFromString`, `orderByFromStringArray` and their `IfValue` variants | [Order by from a string](#order-by-from-a-string) |
| The limit and the offset may be absent | `limitIfValue`, `offsetIfValue` | [Optional limit and offset](../dynamic/order-and-page.md#optional-limit-and-offset) |
| A table is joined only if the query uses it | `optionalJoin`, `optionalInnerJoin`, `optionalLeftJoin`, `optionalLeftOuterJoin` | [Optional joins](../dynamic/optional-joins.md) |
| Your code decides which conditions to add, when nothing above can express them | `dynamicWhere`, `dynamicBooleanExpressionUsing` | [Building a condition step by step](../dynamic/building-conditions.md) |
| The same, in the `on` of a join or in the `having` | `dynamicOn`, `dynamicHaving` | [Dynamic join conditions and having](../dynamic/building-conditions.md#dynamic-join-conditions-and-having) |

Inserts and updates have their own family, to set a column only if there is a value (`setIfValue`, `setIfSet`, `setIfNotSet`, `ignoreIfSet`...): see [Manipulating values to insert](insert.md#manipulating-values-to-insert) and [Manipulating values to update](update.md#manipulating-values-to-update).

When the caller also chooses which columns the select returns, or sends the filter as an object, or when using a value must fail with an error because the user can't see it (`allowWhen`, `disallowWhen`), go to [Extreme dynamic queries](extreme-dynamic-queries.md). What's on this page is enough for most queries.

To see how far the dynamism of the library goes, and everything it offers, see [What a dynamic query can do](../dynamic/building-blocks.md).

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

When what to add can't be said with these methods, because it depends on the logic of your code, you can use `if`s by [building the condition step by step](../dynamic/building-conditions.md).

## Optional conditions: the IfValue methods

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

The last row is what happens when nothing arrives in a select. In a delete or an update, it's an error: see [A condition that ends up empty](#a-condition-that-ends-up-empty). If what you need is to add conditions with your own `if`s, see [`dynamicWhere`](../dynamic/building-conditions.md).

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

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where false
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where false
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName" 
    from customer 
    where (0=1)
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName" 
    from customer 
    where false
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where 0
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where (0=1)
    ```

The parameters are: `[]`

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

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where last_name = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where last_name = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName" 
    from customer 
    where last_name = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName" 
    from customer 
    where last_name = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where last_name = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName 
    from customer 
    where last_name = @0
    ```

The parameters are: `[ 'Smith' ]`

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

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        company_id = ? as isInSearchedCompany 
    from customer
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        company_id = ? as isInSearchedCompany 
    from customer
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        case when company_id = :0 then 1 else 0 end as "isInSearchedCompany" 
    from customer
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        company_id = $1 as "isInSearchedCompany" 
    from customer
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        company_id = ?1 as isInSearchedCompany 
    from customer
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        cast(case when company_id = @0 then 1 else 0 end as bit) as isInSearchedCompany 
    from customer
    ```

The parameters are: `[ 16 ]`

The result type is:
```tsx
const customers: {
    id: number;
    isInSearchedCompany: boolean;
}[]
```

## Ignorable conditions: onlyWhen and ignoreWhen

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

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        first_name as firstName, 
        last_name as lastName 
    from customer
    ```
=== "MySQL"
    ```mysql
    select 
        first_name as firstName, 
        last_name as lastName 
    from customer
    ```
=== "Oracle"
    ```oracle
    select 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer
    ```
=== "SQLite"
    ```sqlite
    select 
        first_name as firstName, 
        last_name as lastName 
    from customer
    ```
=== "SQL Server"
    ```sqlserver
    select 
        first_name as firstName, 
        last_name as lastName 
    from customer
    ```

The parameters are: `[]`

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

## Ignorable values: onlyWhenOrNull

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

A clause is a property followed by a mode, like `'name desc nulls last insensitive'`, and a name that isn't a property of the select is an error, so the request can't reach anything else. [Order and page from a request](../dynamic/order-and-page.md) has every form it accepts, its variants for a list of clauses and for a value that may be missing, and how to answer a wrong order.

## Optional limit and offset

`limitIfValue` and `offsetIfValue` are `limit` and `offset` for a value that may be absent: without a value they do nothing, and `0` is a value. See [Optional limit and offset](../dynamic/order-and-page.md#optional-limit-and-offset), and [Select page](select-page.md) to also get the total of rows.

## Optional joins

An optional join is a join the library writes in the SQL only if the query uses the joined table. If a table is only needed for a condition without a value, or for a column that wasn't picked, the database doesn't have to read it:

```ts
const companyName: string | null = null

const customers = await connection.selectFrom(tCustomer)
    .optionalJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
    .where(tCompany.name.equalsIfValue(companyName))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName
    })
    .executeSelectMany()
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

Here `companyName` has no value, so the query has no condition and no join.

!!! warning

    Leaving out a join can change the number of rows: an inner join removes the rows without a match, and any join repeats the rows with several matches.

[Optional joins](../dynamic/optional-joins.md) says when a join is kept and when each join changes the rows.

## Building a condition step by step

The methods above cover the usual cases, and they keep the query readable: prefer them. Only when what to add depends on logic they can't express, `dynamicWhere()` and `connection.dynamicBooleanExpressionUsing(...)` let you add conditions with your own `if`s, at the price of a condition that is no longer in the text of the query. See [Building a condition step by step](../dynamic/building-conditions.md).

## Dynamic join conditions and having

`dynamicOn()` and `dynamicHaving()` do the same for the `on` of a join and the `having`, with the same price: see [Dynamic join conditions and having](../dynamic/building-conditions.md#dynamic-join-conditions-and-having).

## When the query takes its shape at run time

Everything on this page is written in the query. The dynamism of the library goes much further than that, and [Dynamic queries](../dynamic/building-blocks.md) goes through all of it:

- The filter arrives as an object, from a search screen or another system, and it becomes a condition: [dynamic filters](../dynamic/filters.md).
- The caller chooses which columns come back, and the join goes away if nothing needs it: [picking columns](../dynamic/picks.md).
- A value the user can't see is hidden, or the query that uses it is refused: [restricting values](../dynamic/restricting-values.md).
- A table of a user interface, or an API for other systems, gets everything from one request: [queries from a request](../dynamic/queries-from-requests.md).
- A function of your own receives all of that, and the type of its result has only the columns asked for: [functions that return a dynamic select](../dynamic/dynamic-select-functions.md).
