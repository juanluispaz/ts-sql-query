---
search:
  boost: 0.91
---
# Extreme dynamic queries

Most dynamic queries only need a condition that disappears when its value is missing, and [Dynamic queries](dynamic-queries.md) explains that. This page is for when the query itself takes its shape at run time: the client chooses the columns that come back, the filter arrives as an object from outside, or using a value depends on the permissions of the user.

None of these techniques sends an extra query: each one changes the single query that is built. What they cost is in your code, and the columns or conditions you read in it may not be the ones that run.

## Introduction

Start from what you need, and take the first row that solves it:

| You need to | Use | What it costs |
|---|---|---|
| Leave out a condition when its value is missing | `equalsIfValue`, `containsIfValue`... in [Dynamic queries](dynamic-queries.md#easy-dynamic-queries) | Nothing: start here |
| Apply a condition only when a flag of your code says so | `onlyWhen`, `ignoreWhen` in [Dynamic queries](dynamic-queries.md#ignorable-boolean-expression) | Nothing |
| Join a table only when the query uses it | `optionalJoin` and its family in [Dynamic queries](../dynamic/optional-joins.md) | Leaving out a join can change the number of rows |
| Give everyone the same columns, without the value of those a user can't see | [`onlyWhenOrNull`, `ignoreWhenAsNull`](../dynamic/restricting-values.md#hide-a-value-keeping-the-column) | The caller can't tell a hidden value from a null |
| Decide with `if`s how the conditions combine | [`dynamicBooleanExpressionUsing`](../dynamic/building-conditions.md#a-condition-in-a-variable) | The condition isn't in the text of the query any more |
| Share a condition or some columns between queries | [A function that receives the table](../dynamic/building-conditions.md#bringing-a-condition-from-outside-the-query) | Generic types in the signature of the function |
| Receive the filter as an object, from a search screen or an API ([applied here](../dynamic/queries-from-requests.md)) | [`dynamicConditionFor`](../dynamic/filters.md) | The caller can filter by every field you list, and a wrong filter throws |
| Let the caller choose the columns | [`dynamicPick`, `dynamicPickPaths`](../dynamic/picks.md) | The columns can disappear, so the properties are optional in the result type, and ordering depends on what was picked |
| Return the columns the client asks for with `?fields=` | [`dynamicPickPaths`](../dynamic/picks.md#the-columns-the-client-asks-for) | The names are only known at run time, and the compiler can't check them |
| Refuse a query that uses a value the user can't see | [`allowWhen`, `disallowWhen`](../dynamic/restricting-values.md#restrict-access-to-values) | You have to handle the error |
| All of it in a function of your own, with a precise result type | [Functions that return a dynamic select](../dynamic/dynamic-select-functions.md) | Most of the code is types |

The functions and types used to pick columns, and to type the result, are explained in [Dynamic picks](../dynamic/utilities/picks.md). To type a whole function, see [from the database types](../dynamic/from-database-types.md) or [from a business model](../dynamic/from-business-model.md).

## Complex dynamic boolean expressions

When the conditions can't be said with the `*IfValue` methods and `onlyWhen`, which should be the first option, you can decide with your own `if`s how they combine, keeping the condition in a variable with `connection.dynamicBooleanExpressionUsing(...)`. A function can build it, so several queries can share it: see [A condition in a variable](../dynamic/building-conditions.md#a-condition-in-a-variable) and [Bringing a condition from outside the query](../dynamic/building-conditions.md#bringing-a-condition-from-outside-the-query).

## Select using a dynamic filter

The condition arrives as data: a search screen or another system sends an object that says which fields to compare and how, and you list the fields it can use. The values go as parameters, and a name that isn't in your list is an error.

```ts
const filter = {
    or: [
        { firstName: { startsWithInsensitive: 'John' } },
        { lastName: { containsInsensitive: 'Smi' } }
    ]
}

const customers = await connection.selectFrom(tCustomer)
    .where(connection.dynamicConditionFor({
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName
    }).withValues(filter))
    .select({
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName
    })
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
    where 
           lower(first_name) like concat(lower(?), '%') 
        or lower(last_name) like concat('%', lower(?), '%')
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where 
           lower(first_name) like concat(lower(?), '%') 
        or lower(last_name) like concat('%', lower(?), '%')
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    where 
           lower(first_name) like lower(:0 || '%') escape '\' 
        or lower(last_name) like lower('%' || :1 || '%') escape '\'
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    where 
           first_name ilike ($1 || '%') 
        or last_name ilike ('%' || $2 || '%')
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where 
           lower(first_name) like lower(?1 || '%') escape '\' 
        or lower(last_name) like lower('%' || ?2 || '%') escape '\'
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where 
           lower(first_name) like lower(@0 + '%') 
        or lower(last_name) like lower('%' + @1 + '%')
    ```

The parameters are: `[ 'John', 'Smi' ]`

[Dynamic filters](../dynamic/filters.md) has what a filter can say, what happens with empty values, the errors, and rules of your own.

## Select using a dynamic filter with complex projections

When the select returns nested objects, the filter has the same shape: see [the filter with complex projections](../dynamic/filters.md#select-using-a-dynamic-filter-with-complex-projections).

## Select dynamically picking columns

The caller chooses which columns come back, as in GraphQL. You write all the columns that can be returned, and the query has only those that were picked:

```ts
import { dynamicPickPaths } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"

const availableFields = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName,
    birthday: tCustomer.birthday
}

const customers = await connection.selectFrom(tCustomer)
    .select(dynamicPickPaths(availableFields, ['firstName', 'lastName'], ['id']))
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
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer
    ```

The parameters are: `[]`

[Picking columns dynamically](../dynamic/picks.md) has the two ways of saying what to pick, how it affects the order, and the columns asked for with `?fields=`.

## Select dynamically picking columns with complex projections

The same happens with a pick: see [the pick with complex projections](../dynamic/picks.md#select-dynamically-picking-columns-with-complex-projections).

## Optional joins dynamically picking columns

What the caller picks also decides the joins: if no column of a table is picked, and no condition uses it, an [optional join](../dynamic/optional-joins.md) to it isn't written. See [Optional joins dynamically picking columns](../dynamic/picks.md#optional-joins-dynamically-picking-columns).

## Hide a value keeping the column

`onlyWhenOrNull` and `ignoreWhenAsNull` keep the column and write a null in place of the value, so the shape of the result doesn't depend on the user: see [Hide a value keeping the column](../dynamic/restricting-values.md#hide-a-value-keeping-the-column).

## Restrict access to values

`allowWhen` and `disallowWhen` make a value unusable under some circumstances: if a query needs it, the query isn't sent and you get the error you gave. See [Restrict access to values](../dynamic/restricting-values.md#restrict-access-to-values).

## A function that returns a dynamic select

When you want a function of your own that does all of this, where the caller chooses the columns, the filter and the order, and gets a precise result type, see [Functions that return a dynamic select](../dynamic/dynamic-select-functions.md). It is a complete example, typed from the database and from a model of your own.
