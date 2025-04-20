---
search:
  boost: 2
---
# Dynamic queries

This page explains how to write **dynamic SQL queries** using `ts-sql-query` while preserving **type safety**, **composability**, and the **declarative style** of SQL. Instead of using `if` statements or imperative logic to conditionally add filters, projections, or joins, `ts-sql-query` provides a rich set of methods — such as `.equalsIfValue()` and `.onlyWhen()` — that allow you to express **optional logic directly in the query definition**. You can also define **optional joins** that are included only if their columns are used, and safely handle `null` values in projections.

## Introduction

`ts-sql-query` provides several convenience methods ending in `IfValue` to help construct dynamic queries. These methods are automatically ignored when the provided values are `null`, `undefined`, or an empty string (unless the `allowEmptyString` flag in the connection is set to true — by default, it is false). When these methods are used in operations that return boolean values, `ts-sql-query` is smart enough to omit the operation when it is required, even when the operation is part of complex composition with `and`s and `or`s.

**When you realize an insert or update, you can**:

- set a column value conditionally using the method `setIfValue`
- replace a previously set value during the construction of the query using  the method `setIfSet` or the method `setIfSetIfValue`
- set a value if it was not previously set during the construction of the query using the method `setIfNotSet` or the method `setIfNotSetIfValue`
- ignore a previously set value using the method `ignoreIfSet`
- Don't worry if you end up with an `UPDATE` or `DELETE` without a `WHERE` clause — `ts-sql-query` will throw an error to prevent affecting all rows. You can allow explicitly having an update or delete with no where if you create it using the method `updateAllowingNoWhere` or `deleteAllowingNoWhereFrom` respectively

**When you realize a select, you can**:

- specify in your order by clause that the order must be case insensitive when the column type is string (ignored otherwise). To do it, add `insensitive` at the end of the ordering criteria/mode
- add a dynamic `order by` provided by the user without risk of SQL injection and without exposing the internal structure of the database. To build a dynamic `order by` use the method `orderByFromString` with the usual order by syntax (and with the possibility to use the insensitive extension), but using as column's name the name of the property in the resulting object
- You can apply `order by`, `limit` and `offset` optionally calling `orderByFromStringIfValue`, `limitIfValue` and `offsetIfValue`

**Additionally, you can**:

- create a boolean expression that only applies if a certain condition is met, calling the `onlyWhen` method in the boolean expression. The `ignoreWhen` method does the opposite.
- create an expression that only applies if a certain condition is met; otherwise, the value will be null, calling the `onlyWhenOrNull` method in the expression. The `ignoreWhenAsNull` method does the opposite.
- define an optional join in a select query. That join only must be included in the final query if the table involved in the join is used in the final query. For example, a column of the joined table was picked or used in a dynamic where.

## Declarative dynamic queries

`ts-sql-query` embraces a **declarative approach**, in the spirit of SQL itself, when building dynamic queries.

As a result, writing conditions imperatively (e.g., using `if` statements to push filters into an array) **won’t work as expected**, and will bypass type safety and composability.

Instead, use the dynamic variants of comparison functions — those ending in `IfValue`, such as `equalsIfValue`, `containsIfValue`, etc. — to express **optional filters** directly and declaratively.

!!! warning "Avoid imperative control flow when building dynamic queries"

    When building dynamic queries, it's common in many ORMs or query builders to rely on imperative control flow — using `if` statements, mutating arrays, or combining query parts conditionally.

    However, **`ts-sql-query` embraces a declarative approach**, inspired by the spirit of SQL itself. Instead of relying on control structures (`if`, `for`, etc.), you should express dynamic logic using built-in methods like `equalsIfValue`, `onlyWhen`, and `ignoreWhen`, which make your intent explicit, type-safe, and composable.

## Easy dynamic queries

Methods ending in `IfValue` allow you to write dynamic queries in the easiest way; these methods work by ignoring the expression if the value provided is `null`, `undefined`, or an empty string (only when the `allowEmptyString` flag in the connection is not set to true, that is the default behaviour) return a special neutral boolean (ignoring the expression) that is ignored when it is used in `and`s, `or`s, `on`s or `where`s.

```ts
const firstNameContains = 'ohn';
const lastNameContains = null;
const birthdayIs = null;
const searchOrderBy = 'name insensitive, birthday asc nulls last';

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
    .executeSelectMany();
```

The executed query is:
```sql
select id as id, first_name || $1 || last_name as name, birthday as birthday 
from customer 
where first_name like ('%' || $2 || '%') 
order by lower(name), birthday asc nulls last
```

The parameters are: `[ ' ', 'ohn' ]`

The result type is:
```tsx
const customerWithId: Promise<{
    id: number;
    name: string;
    birthday?: Date;
}[]>
```

## Ignorable boolean expression

You can create a boolean expression that only applies if a certain condition is met, calling the `onlyWhen` method at the end of the boolean expression; in case the condition is false it returns a special neutral boolean (ignoring the expression) that is ignored when it is used in `and`s, `or`s, `on`s or `where`s. You can also use the `ignoreWhen` method at the end of the boolean expression to do the opposite; in case the condition is true it returns a special neutral boolean that is ignored. The `onlyWhen` and `ignoreWhen` methods can be useful to apply restrictions in the query, by example, when the user have some roles.

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
```sql
select first_name as firstName, last_name as lastName, birthday as birthday 
from customer 
where company_id = $1
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

But in the case of `onlyCustomersOfUserCompany` is false, the condition in the where is omitted:
```ts
const onlyCustomersOfUserCompany = false
```

The executed query is:
```sql
select first_name as firstName, last_name as lastName, birthday as birthday 
from customer
```

The parameters are: `[ ]`

## Ignorable expression as null

You can create an expression that only applies if a certain condition is met, calling the `onlyWhenOrNull` method at the end of the expression; in case the condition is false it returns a null constant (ignoring the expression). You can also use the `ignoreWhenAsNull` method at the end of the expression to do the opposite; in case the condition is true it returns a null constant. The `onlyWhenOrNull` and `ignoreWhenAsNull` methods can be useful to apply restrictions in the query, by example, when the user have some roles.

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
```sql
select id as id, first_name as "firstName", last_name as "lastName", birthday as birthday 
from customer 
where id = $1
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

But in the case of `displayNames` is false, the omitted expressions are replaced by null:
```ts
const displayNames = false
```

The executed query is:
```sql
select id as id, null::text as "firstName", null::text as "lastName", birthday as birthday 
from customer 
where id = $1
```

The parameters are: `[ 10 ]`

## Optional joins

You can write selects where the columns are picked dynamically, but maybe a join is required depending on the picked columns. `ts-sql-query` allows you to specify that a join should only be included in the final query if the table involved in the join is used in the final query (by example, a column from that table was selected or used in a dynamic `WHERE` clause). 

To indicate the join can be optionally included in the query, you must create the join using one of the following methods:

- `optionalJoin`
- `optionalInnerJoin`
- `optionalLeftJoin`
- `optionalLeftOuterJoin`

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
```sql
select customer.id as id, customer.first_name as firstName, customer.last_name as lastName, customer.birthday as birthday 
from customer join company on company.id = customer.company_id 
where company.name = $1
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

But in the case of `companyName` is null or undefined, the condition in the where is omitted; in consequence, the company table is not used; thus the join is omitted:
```ts
const companyName = null
```

The executed query is:
```sql
select id as id, first_name as firstName, last_name as lastName, birthday as birthday
from customer
```

The parameters are: `[ ]`

!!! warning

    An omitted join can change the number of returned rows depending on your data structure. This behaviour doesn't happen when all rows of the initial table have one row in the joined table (or none if you use a left join), but not many rows.

**You can also use optional joins with ignorable expression as null**

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
```sql
select id as id, first_name as firstName, last_name as lastName, birthday as birthday, null::int4 as companyId, null::text as companyName
from customer 
where id = $1
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

But in the case of a column provided by the join is required, like when `canSeeCompanyInfo` is:
```ts
const canSeeCompanyInfo = true
```

The executed query is:
```sql
select customer.id as id, customer.first_name as firstName, customer.last_name as lastName, customer.birthday as birthday, company.id as companyId, company.name as companyName 
from customer inner join company on company.id = customer.company_id 
where customer.id = $1
```

The parameters are: `[ 12 ]`

!!! warning

    An omitted join can change the number of returned rows depending on your data structure. This behaviour doesn't happen when all rows of the initial table have one row in the joined table (or none if you use a left join), but not many rows.
