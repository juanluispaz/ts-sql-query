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
| Join a table only when the query uses it | `optionalJoin` and its family in [Dynamic queries](dynamic-queries.md#optional-joins) | Leaving out a join can change the number of rows |
| Give everyone the same columns, without the value of those a user can't see | [`onlyWhenOrNull`, `ignoreWhenAsNull`](#hide-a-value-keeping-the-column) | The caller can't tell a hidden value from a null |
| Decide with `if`s how the conditions combine | [`dynamicBooleanExpressionUsing`](#complex-dynamic-boolean-expressions) | The condition isn't in the text of the query any more |
| Share a condition or some columns between queries | [A function that receives the table](#bringing-a-condition-from-outside-the-query) | Generic types in the signature of the function |
| Receive the filter as an object, from a search screen or an API | [`dynamicConditionFor`](#select-using-a-dynamic-filter) | The caller can filter by every field you list, and a wrong filter throws |
| Let the caller choose the columns | [`dynamicPick`, `dynamicPickPaths`](#select-dynamically-picking-columns) | The columns can disappear, so the properties are optional in the result type, and ordering depends on what was picked |
| Return the columns the client asks for with `?fields=` | [`dynamicPickPaths`](#the-columns-the-client-asks-for) | The names are only known at run time, and the compiler can't check them |
| Refuse a query that uses a value the user can't see | [`allowWhen`, `disallowWhen`](#restrict-access-to-values) | You have to handle the error |
| All of it in one function, with a precise result type | [Full dynamic select](#full-dynamic-select) | Most of the code is types |

!!! warning "These patterns are rarely needed"

    They exist for rare but real cases. They give flexibility in exchange for code that is harder to read and queries that are harder to reason about, so prefer the rows at the top of the table.

The functions and types used to pick columns, and to type the result, are explained in [Dynamic picks](../dynamic/utilities/picks.md). To type a whole function, see [from the database types](../dynamic/from-database-types.md) or [from a business model](../dynamic/from-business-model.md).

## Complex dynamic boolean expressions

The methods ending in `IfValue` remove a condition when its value is missing. When what you add depends on the logic of your code, build the condition with `if`s. `connection.dynamicBooleanExpressionUsing(...)` starts with an empty condition, the [neutral boolean](dynamic-queries.md#the-neutral-boolean) (see also [Booleans and three-valued logic](../dynamic/three-valued-booleans.md)), and each `.and(...)` or `.or(...)` returns a new condition that you keep in the variable. It receives the tables that the conditions use, up to five.

This is the query of [Easy dynamic queries](dynamic-queries.md#easy-dynamic-queries), written with `if`s:

```ts
const firstNameContains = 'ohn';
const lastNameContains = null;
const birthdayIs = null;
const searchOrderBy = 'name insensitive, birthday asc nulls last';

let searchedCustomersWhere = connection.dynamicBooleanExpressionUsing(tCustomer)
if (firstNameContains) {
    searchedCustomersWhere = searchedCustomersWhere.and(tCustomer.firstName.contains(firstNameContains))
}
if (lastNameContains) {
    searchedCustomersWhere = searchedCustomersWhere.or(tCustomer.lastName.contains(lastNameContains))
}
if (birthdayIs) {
    searchedCustomersWhere = searchedCustomersWhere.and(tCustomer.birthday.equals(birthdayIs))
}

const searchedCustomers = connection.selectFrom(tCustomer)
    .where(searchedCustomersWhere)
    .select({
        id: tCustomer.id,
        name: tCustomer.firstName.concat(' ').concat(tCustomer.lastName),
        birthday: tCustomer.birthday
    })
    .orderByFromString(searchOrderBy)
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

If no `if` adds anything, the condition stays neutral and the query has no `where`. Each `.and` or `.or` applies to everything written before it, as the code reads: `.and(a).or(b).and(c)` is `(a or b) and c`.

### Bringing a condition from outside the query

A condition is a value, so a function can build it and any query can use it. When the query uses an alias of the table, the function has to receive that alias: `TableOrViewOf` is the type of the parameter, and `fromRef` gives back the columns of the table, as [Passing tables and views as parameter](../advanced/tables-views-as-parameter.md) explains.

```ts
import { fromRef, type TableOrViewOf } from 'ts-sql-query' // or 'ts-sql-query/extras/types'

function nameContains<CUSTOMER extends TableOrViewOf<typeof tCustomer, 'customer'>>(customerRef: CUSTOMER, text: string | null | undefined) {
    const customer = fromRef(tCustomer, customerRef);

    return customer.firstName.containsInsensitiveIfValue(text)
        .or(customer.lastName.containsInsensitiveIfValue(text));
}

const customer = tCustomer.as('customer');

const customers = await connection.selectFrom(customer)
    .where(nameContains(customer, 'smi'))
    .select({
        id: customer.id,
        firstName: customer.firstName
    })
    .executeSelectMany();
```

A table used in a left join is received with `TableOrViewLeftJoinOf`, as in [Full dynamic select](#full-dynamic-select), which builds its columns and the rules of its filter in the same way.

## Select using a dynamic filter

A dynamic filter is a condition that arrives as data: a search screen or another system sends an object that says which fields to compare and how, and the library turns it into SQL. The values go as parameters, and the names must be the ones you list, so the object can't add SQL of its own.

`connection.dynamicConditionFor(fields)` receives a map: each key is the name the filter uses, and each value is the column or expression it refers to. Its method `withValues(filter)` returns the condition, which goes wherever a boolean is accepted, like a `where`.

| Filter | Condition |
|---|---|
| `{ firstName: { equals: 'John' } }` | The first name is `John` |
| `{ firstName: { startsWith: 'J', endsWith: 'n' } }` | Both comparisons, joined with `and` |
| `{ firstName: { equals: 'John' }, lastName: { equals: 'Smith' } }` | Both fields, joined with `and` |
| `{ and: [a, b] }` | `a` and `b` |
| `{ or: [a, b] }` | `a` or `b` |
| `{ not: a }` | The opposite of `a` |
| `{ firstName: { equalsIfValue: null } }` | No condition: the `IfValue` operators ignore a missing value |
| `{}` | No condition |

The operators of each type are listed in the [Dynamic conditions API](../api/dynamic-conditions.md).

```ts
import { DynamicCondition } from "ts-sql-query" // or "ts-sql-query/dynamic/condition"

const selectFields = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName,
    birthday: tCustomer.birthday,
    companyName: tCompany.name
}

/*
 * You can define as well using the fields object
 * type FilterType = DynamicCondition<typeof selectFields>
 */
type FilterType = DynamicCondition<{
    id: 'int',
    firstName: 'string',
    lastName: 'string',
    birthday: 'localDate',
    companyName: 'string'
}>

const filter: FilterType = {
    or: [
        { firstName: { startsWithInsensitive: 'John' } },
        { lastName: { startsWithInsensitiveIfValue: 'Smi', endsWith: 'th' } }
    ],
    companyName: {equals: 'ACME'}
}

const dynamicWhere = connection.dynamicConditionFor(selectFields).withValues(filter)

const customersWithDynamicCondition = connection.selectFrom(tCustomer)
    .innerJoin(tCompany).on(tCustomer.companyId.equals(tCompany.id))
    .where(dynamicWhere)
    .select(selectFields)
    .orderBy('firstName', 'insensitive')
    .orderBy('lastName', 'asc insensitive')
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
        company.name as companyName 
    from customer 
    inner join company on customer.company_id = company.id 
    where 
        (
               lower(customer.first_name) like concat(lower(?), '%') 
            or (
                    lower(customer.last_name) like concat(lower(?), '%') 
                and customer.last_name like concat('%', ?)
            )
        ) and company.name = ? 
    order by 
        lower(customer.first_name), 
        lower(customer.last_name) asc
    ```
=== "MySQL"
    ```mysql
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday, 
        company.`name` as companyName 
    from customer 
    inner join company on customer.company_id = company.id 
    where 
        (
               lower(customer.first_name) like concat(lower(?), '%') 
            or (
                    lower(customer.last_name) like concat(lower(?), '%') 
                and customer.last_name like concat('%', ?)
            )
        ) and company.`name` = ? 
    order by 
        lower(customer.first_name), 
        lower(customer.last_name) asc
    ```
=== "Oracle"
    ```oracle
    select 
        customer.id as "id", 
        customer.first_name as "firstName", 
        customer.last_name as "lastName", 
        customer.birthday as "birthday", 
        company.name as "companyName" 
    from customer 
    inner join company on customer.company_id = company.id 
    where 
        (
               lower(customer.first_name) like lower(:0 || '%') escape '\' 
            or (
                    lower(customer.last_name) like lower(:1 || '%') escape '\' 
                and customer.last_name like ('%' || :2) escape '\'
            )
        ) and company.name = :3 
    order by 
        lower("firstName"), 
        lower("lastName") asc
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.id as id, 
        customer.first_name as "firstName", 
        customer.last_name as "lastName", 
        customer.birthday as birthday, 
        company.name as "companyName" 
    from customer 
    inner join company on customer.company_id = company.id 
    where 
        (
               customer.first_name ilike ($1 || '%') 
            or (
                    customer.last_name ilike ($2 || '%') 
                and customer.last_name like ('%' || $3)
            )
        ) and company.name = $4 
    order by 
        lower(customer.first_name), 
        lower(customer.last_name) asc
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday, 
        company.name as companyName 
    from customer 
    inner join company on customer.company_id = company.id 
    where 
        (
               lower(customer.first_name) like lower(?1 || '%') escape '\' 
            or (
                    lower(customer.last_name) like lower(?2 || '%') escape '\' 
                and customer.last_name like ('%' || ?3) escape '\'
            )
        ) and company.name = ?4 
    order by 
        lower(customer.first_name), 
        lower(customer.last_name) asc
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        customer.last_name as lastName, 
        customer.birthday as birthday, 
        company.name as companyName 
    from customer 
    inner join company on customer.company_id = company.id 
    where 
        (
               lower(customer.first_name) like lower(@0 + '%') 
            or (
                    lower(customer.last_name) like lower(@1 + '%') 
                and customer.last_name like ('%' + @2)
            )
        ) and company.name = @3 
    order by 
        lower(customer.first_name), 
        lower(customer.last_name) asc
    ```

The parameters are: `[ 'John', 'Smi', 'th', 'ACME' ]`

The result type is:
```tsx
const customersWithDynamicCondition: Promise<{
    id: number;
    firstName: string;
    lastName: string;
    companyName: string;
    birthday?: Date;
}[]>
```

`DynamicCondition`, from `ts-sql-query/dynamic/condition`, is the type of the filter. It's built from type names, as in the example, or from the map of fields. See [Dynamic conditions](../api/dynamic-conditions.md), the [types of a dynamic condition](../dynamic/utilities/conditions.md), and [from a business model](../dynamic/from-business-model.md) to build it from your own types.

With an empty filter there is no condition: a select returns all the rows, and an update or delete with no other condition is rejected with `MISSING_WHERE`.

The caller can use every field of the map, with every operator of its type, so list only what they may use. A field restricted with [`allowWhen`](#restrict-access-to-values) can stay in the map: the query is refused only if the filter uses it.

A filter that comes from outside can be wrong. `withValues` throws when you call it, with a [`TsSqlProcessingError`](../api/error-management/library-raised-errors.md) that has one of these reasons:

| Reason | When |
|---|---|
| `DYNAMIC_CONDITION_UNKNOWN_COLUMN` | A name that isn't in the map, nor a rule |
| `DYNAMIC_CONDITION_UNKNOWN_OPERATION` | An operator that doesn't exist, like `{ id: { nope: 1 } }` |
| `DYNAMIC_CONDITION_INVALID_FILTER` | Something else where an object is expected, like `{ id: 1 }`, or an `and` or `or` that isn't an array |

A filter parsed from JSON has its dates as text. Convert them to `Date` first: a text in a date column reaches the execute method, whose promise is rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE`.

To add a rule that no column can express, like "there is a customer whose name contains this text", pass an object as the second argument of `dynamicConditionFor`, and as the second type argument of `DynamicCondition`. Each key is the name of a rule, and it can be nested to follow the groups of the map. Its value is a function that receives the value of the filter and returns a condition. See [Full dynamic select](#full-dynamic-select) for a complete example.

## Select dynamically picking columns

The caller chooses which columns come back, as in GraphQL. You write all the columns that can be returned in a map, and the function keeps those the caller picks. The query only has those columns.

!!! tip

    Columns that come and go make a query harder to reason about. If the caller can work with the same columns and no value in some of them, prefer [`onlyWhenOrNull`](#hide-a-value-keeping-the-column).

```ts
import { dynamicPick, dynamicPickPaths } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"

const availableFields = {
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName,
    birthday: tCustomer.birthday
}

// Alternative: const fieldsToPickList = ['firstName' as const, 'lastName' as const]
const fieldsToPick = {
    firstName: true,
    lastName: true
}

// Alternative: const pickedFields = dynamicPickPaths(availableFields, fieldsToPickList)
const pickedFields = dynamicPick(availableFields, fieldsToPick)

const customersWithIdPicking = connection.selectFrom(tCustomer)
    .select({
        ...pickedFields,
        id: tCustomer.id // always include the id field in the result
    })
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        first_name as firstName, 
        last_name as lastName, 
        id as id 
    from customer
    ```
=== "MySQL"
    ```mysql
    select 
        first_name as firstName, 
        last_name as lastName, 
        id as id 
    from customer
    ```
=== "Oracle"
    ```oracle
    select 
        first_name as "firstName", 
        last_name as "lastName", 
        id as "id" 
    from customer
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        first_name as "firstName", 
        last_name as "lastName", 
        id as id 
    from customer
    ```
=== "SQLite"
    ```sqlite
    select 
        first_name as firstName, 
        last_name as lastName,
        id as id
    from customer
    ```
=== "SQL Server"
    ```sqlserver
    select 
        first_name as firstName, 
        last_name as lastName, 
        id as id 
    from customer
    ```

The parameters are: `[]`

The result type is:
```tsx
const customersWithIdPicking: Promise<{
    id: number;
    birthday?: Date;
    firstName?: string;
    lastName?: string;
}[]>
```

There are two functions, which differ in how the caller says what to pick:

| Function | Example | To pick the properties of a group |
|---|---|---|
| `dynamicPick` | `dynamicPick(availableFields, { firstName: true, lastName: true }, ['id'])` | List them: `{ company: { id: true, name: true } }` |
| `dynamicPickPaths` | `dynamicPickPaths(availableFields, ['firstName', 'lastName'], ['id'])` | `'company'` for all of them, or `'company.name'` for one |

In `dynamicPick`, only the value `true` picks a property: `false`, a missing property, or a text like `'true'` don't. In both, a name that isn't in the map is ignored.

The optional third argument lists the properties that are always included: they are required in the result type, and the others are optional. The same is achieved by writing them in the `select`, as this example does with `id`. With no property picked and none always included, the query has no columns and the database rejects it.

Ordering depends on what was picked. Given a name, `orderBy` accepts only the properties that are always included, and any other doesn't compile; given a column, like `.orderBy(tCustomer.birthday)`, it doesn't need it in the select. `orderByFromString` and `orderByFromStringArray` receive the name in a text, so they can use any picked property, and they throw `ORDER_BY_COLUMN_NOT_IN_SELECT` when you call them with one that wasn't picked.

To return a type with only the picked properties, see [Expanding result types](../dynamic/utilities/picks.md#expanding-result-types-from-dynamic-picks). A pick also works in an [array aggregate](aggregate-as-object-array.md).

### The columns the client asks for

An endpoint like `GET /customers?fields=firstName,lastName` receives the names as text. Split them, and cast them to the type of the available names, with `DynamicPickPaths`. The cast checks nothing at run time, but it isn't a risk for the query: only the columns of your map can be selected, and any other name is ignored.

```ts
import { dynamicPickPaths, type DynamicPickPaths } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"

const availableFields = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName,
    birthday: tCustomer.birthday
}

type CustomerField = DynamicPickPaths<typeof availableFields, 'id'>

const requestedFields = req.query.fields.split(',') as CustomerField[]

const customers = await connection.selectFrom(tCustomer)
    .select(dynamicPickPaths(availableFields, requestedFields, ['id']))
    .executeSelectMany()
```

The client can ask for any column of the map. If some of them need a permission, mark them with [`allowWhen`](#restrict-access-to-values).

## Optional joins dynamically picking columns

An [optional join](dynamic-queries.md#optional-joins) goes in the query only when the query uses the joined table. Together with a pick, what the caller asks for decides the join: if no column of `tCompany` is picked, and no condition uses it, the query doesn't join it.

```ts
import { dynamicPick, dynamicPickPaths } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"

const availableFields = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName,
    birthday: tCustomer.birthday,
    companyId: tCompany.id,
    companyName: tCompany.name
}

// Alternative: const fieldsToPickList = ['firstName' as const, 'lastName' as const]
const fieldsToPick = {
    firstName: true,
    lastName: true
}

// always include id field as required
// Alternative: const pickedFields = dynamicPickPaths(availableFields, fieldsToPickList, ['id'])
const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id'])

const customerWithOptionalCompany = connection.selectFrom(tCustomer)
    .optionalInnerJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
    .select(pickedFields)
    .where(tCustomer.id.equals(12))
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
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where id = @0
    ```

The parameters are: `[ 12 ]`

The result type is:
```tsx
const customerWithOptionalCompany: Promise<{
    id: number;
    birthday?: Date;
    firstName?: string;
    lastName?: string;
    companyId?: number;
    companyName?: string;
}[]>
```

But when a column provided by the join is picked, like with this `fieldsToPick`, the join is in the query:
```ts
import { dynamicPick, dynamicPickPaths } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"

const availableFields = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName,
    birthday: tCustomer.birthday,
    companyId: tCompany.id,
    companyName: tCompany.name
}

// CHANGED: fieldsToPick requiring more information
const fieldsToPick = {
    firstName: true,
    lastName: true,
    companyName: true
}

// always include id field as required
// Alternative: const pickedFields = dynamicPickPaths(availableFields, fieldsToPickList, ['id'])
const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id'])

const customerWithOptionalCompany = connection.selectFrom(tCustomer)
    .optionalInnerJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
    .select(pickedFields)
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
        company.name as companyName 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = @0
    ```

The parameters are: `[ 12 ]`

!!! warning

    Leaving out a join can change the number of rows returned. In this example, a customer with no company isn't returned when the query has the inner join, and is returned when it doesn't. With a left join, a customer with several rows in the joined table comes several times only when the query has the join. The rows are the same with or without the join only when every row has exactly one row in the joined table, or at most one if it's a left join.

## Hide a value keeping the column

`onlyWhenOrNull(when)` keeps the value when `when` is true, and otherwise replaces it with a null constant in the query. `ignoreWhenAsNull(when)` is the same with the boolean inverted. The query keeps its columns, so its shape doesn't depend on the user. A hidden value is a null for the rest of the query too: a filter on it can't find out what the column holds. [Ignorable expression as null](dynamic-queries.md#ignorable-expression-as-null) shows the code and the SQL. They are different from `onlyWhen` and `ignoreWhen`, which [remove a condition](dynamic-queries.md#ignorable-boolean-expression).

This is what happens with the birthday of a user who can't see it, with each way of handling it:

| Written in the code | The query | The result |
|---|---|---|
| `birthday` left out of a [pick](#select-dynamically-picking-columns) | Has no column for it | The row has no `birthday` |
| `tCustomer.birthday.onlyWhenOrNull(false)` or `tCustomer.birthday.ignoreWhenAsNull(true)` | Has a null constant in its place | The row has no `birthday` |
| `tCustomer.birthday.allowWhen(false, '...')` or `tCustomer.birthday.disallowWhen(true, '...')`, and the query uses it | Isn't sent | The promise is rejected |
| The same, and the query doesn't use it, for example because it wasn't picked | Has no column for it | The row has no `birthday` |

Choose `onlyWhenOrNull` when not seeing a value is normal, like a list with less detail for some roles, and the caller doesn't need to tell it apart from a customer with no birthday. Choose [`allowWhen`](#restrict-access-to-values) when asking for it is a mistake that should be noticed. All of these receive a boolean of your code, so they apply to the whole query, not to each row.

## Restrict access to values

Use this when a value can be used only under some circumstances, like a column that needs a permission. `allowWhen(when, error)`, available in every value, leaves the value as it is while `when` is true. When it's false, the value can be written in your code, but it can't be part of a query: if a query needs it, the query isn't sent to the database and you get the error. `disallowWhen(when, error)` is the same with the boolean inverted.

This protects a list of fields that comes from outside your code, as an endpoint with `?fields=` does. While the client asks for what they may see, it's as if `allowWhen` weren't there. If they ask for a restricted field, because of a missing check, a wrong client, or an attempt to reach restricted data, nothing reaches the database.

It works wherever the query needs the value: in the `select`, in a `where`, `having`, `on`, `group by` or `order by`, in a subquery, a [common table expression](cte-subqueries.md), an [aggregate](aggregate-as-object-array.md), any select of a [compound select](compound-select.md), a [dynamic filter](#select-using-a-dynamic-filter), or an insert, update or delete.

The error arrives through the promise of the execute method, in a form that depends on what you pass:

| You pass | What the promise is rejected with |
|---|---|
| A text | A [`TsSqlQueryExecutionError`](../api/error-management/library-raised-errors.md), with `errorReason` being `{ reason: 'DISALLOWED', message: <your text>, functionName: 'allowWhen' }` or `'disallowWhen'`. Its `message` is `DISALLOWED: <your text>`, and its `cause` is the original `TsSqlProcessingError` |
| An `Error` | That same object |

`query()` and `params()` don't return a promise, so they throw directly: the `TsSqlProcessingError` for a text, and your object for an `Error`.

A typical handler of an HTTP request, which answers with your text:

```ts
import { TsSqlError } from "ts-sql-query"

try {
    const rows = await connection.selectFrom(tCustomer)
        .select(dynamicPick(availableFields, req.body.fields, ['id']))
        .executeSelectMany()
    res.json(rows)
} catch (e) {
    if (e instanceof TsSqlError && e.errorReason.reason === 'DISALLOWED') {
        res.status(403).json({ error: e.errorReason.message })
        return
    }
    throw e
}
```

With your own error you recognize it by its class:

```ts
class NoPermissionError extends Error {}

const canSeeBirthday = false

const customers = connection.selectFrom(tCustomer)
    .select({
        id: tCustomer.id,
        birthday: tCustomer.birthday.allowWhen(canSeeBirthday, new NoPermissionError('You can\'t see the birthday'))
    })
    .executeSelectMany()

customers.catch((e) => {
    if (e instanceof NoPermissionError) {
        // The query wasn't sent
    }
})
```

In this example the restricted column isn't picked, so the query runs:

```ts
import { dynamicPick, dynamicPickPaths } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"

const birthdayVisible = false

const availableFields = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName,
    birthday: tCustomer.birthday.allowWhen(birthdayVisible, "You don't have permission to see the birthday"),
}

// Alternative: const fieldsToPickList = ['firstName' as const, 'lastName' as const]
const fieldsToPick = {
    firstName: true,
    lastName: true
}

// always include id field as required
// Alternative: const pickedFields = dynamicPickPaths(availableFields, fieldsToPickList, ['id'])
const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id'])

const customerWithOptionalCompany = connection.selectFrom(tCustomer)
    .select(pickedFields)
    .where(tCustomer.id.equals(12))
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
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName", 
        last_name as "lastName" 
    from customer 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName, 
        last_name as lastName 
    from customer 
    where id = @0
    ```

The parameters are: `[ 12 ]`

The result type is:
```tsx
const customerWithOptionalCompany: Promise<{
    id: number;
    birthday?: Date;
    firstName?: string;
    lastName?: string;
}[]>
```

But if the `birthday` column is requested, like with this `fieldsToPick`:
```ts
const fieldsToPick = {
    firstName: true,
    lastName: true,
    birthday: true
}
```

No query is sent, and the promise is rejected with the reason `DISALLOWED` and the message "_You don't have permission to see the birthday_", because `birthdayVisible` is `false`.

## Select using a dynamic filter with complex projections

When the select returns [nested objects](complex-projections.md), the filter has the same shape: a field inside a group is inside the same group in the filter, which can have its own `and`, `or` and `not`. The order uses the path of the property, like `company.name`.

```ts
import { DynamicCondition } from "ts-sql-query" // or "ts-sql-query/dynamic/condition"

type QueryFilterType = DynamicCondition<{
    id: 'int',
    name: {
        firstName: 'string',
        lastName: 'string',
    },
    birthday: 'localDate',
    company: {
        id: 'int',
        name: 'string'
    }
}>;

const queryFilter: QueryFilterType = {
    company: { name: {equals: 'ACME'} },
    name: {
        or: [
            { firstName: { containsInsensitive: 'John' } },
            { lastName: { containsInsensitive: 'Smi' } }
        ]
    }
};

const queryOrderBy = 'company.name asc insensitive, birthday desc';

const querySelectFields = {
    id: tCustomer.id,
    name: {
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
    },
    birthday: tCustomer.birthday,
    company: {
        id: tCompany.id,
        name: tCompany.name
    }
};

const queryDynamicWhere = connection.dynamicConditionFor(querySelectFields).withValues(queryFilter);

const customerWithCompanyObject = connection.selectFrom(tCustomer)
    .innerJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
    .select(querySelectFields)
    .where(queryDynamicWhere)
    .orderByFromString(queryOrderBy)
    .executeSelectOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        customer.first_name as `name.firstName`, 
        customer.last_name as `name.lastName`, 
        customer.birthday as birthday, 
        company.id as `company.id`, 
        company.name as `company.name` 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            company.name = ? 
        and (
               lower(customer.first_name) like concat('%', lower(?), '%') 
            or lower(customer.last_name) like concat('%', lower(?), '%')
        ) 
    order by 
        lower(company.name) asc, 
        birthday desc
    ```
=== "MySQL"
    ```mysql
    select 
        customer.id as id, 
        customer.first_name as `name.firstName`, 
        customer.last_name as `name.lastName`, 
        customer.birthday as birthday, 
        company.id as `company.id`, 
        company.`name` as `company.name` 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            company.`name` = ? 
        and (
               lower(customer.first_name) like concat('%', lower(?), '%') 
            or lower(customer.last_name) like concat('%', lower(?), '%')
        ) 
    order by 
        lower(company.`name`) asc, 
        birthday desc
    ```
=== "Oracle"
    ```oracle
    select 
        customer.id as "id", 
        customer.first_name as "name.firstName", 
        customer.last_name as "name.lastName", 
        customer.birthday as "birthday", 
        company.id as "company.id", 
        company.name as "company.name" 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            company.name = :0 
        and (
               lower(customer.first_name) like lower('%' || :1 || '%') escape '\' 
            or lower(customer.last_name) like lower('%' || :2 || '%') escape '\'
        ) 
    order by 
        lower("company.name") asc, 
        "birthday" desc
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.id as id, 
        customer.first_name as "name.firstName", 
        customer.last_name as "name.lastName", 
        customer.birthday as birthday, 
        company.id as "company.id", 
        company.name as "company.name" 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            company.name = $1 
        and (
               customer.first_name ilike ('%' || $2 || '%') 
            or customer.last_name ilike ('%' || $3 || '%')
        ) 
    order by 
        lower(company.name) asc, 
        birthday desc
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.id as id, 
        customer.first_name as "name.firstName", 
        customer.last_name as "name.lastName", 
        customer.birthday as birthday, 
        company.id as "company.id", 
        company.name as "company.name" 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            company.name = ?1 
        and (
               lower(customer.first_name) like lower('%' || ?2 || '%') escape '\' 
            or lower(customer.last_name) like lower('%' || ?3 || '%') escape '\'
        ) 
    order by 
        lower(company.name) asc, 
        birthday desc
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        customer.first_name as [name.firstName], 
        customer.last_name as [name.lastName], 
        customer.birthday as birthday, 
        company.id as [company.id], 
        company.name as [company.name] 
    from customer 
    inner join company on company.id = customer.company_id 
    where 
            company.name = @0 
        and (
               lower(customer.first_name) like lower('%' + @1 + '%') 
            or lower(customer.last_name) like lower('%' + @2 + '%')
        ) 
    order by 
        lower(company.name) asc, 
        birthday desc
    ```

The parameters are: `[ "ACME", "John", "Smi" ]`

The result type is:
```tsx
const customerWithCompanyObject: Promise<{
    id: number;
    name: {
        firstName: string;
        lastName: string;
    };
    company: {
        id: number;
        name: string;
    };
    birthday?: Date;
}>
```

See [Select using a dynamic filter](#select-using-a-dynamic-filter) and [Dynamic conditions](../api/dynamic-conditions.md) for more information.

## Select dynamically picking columns with complex projections

With [nested objects](complex-projections.md), the pick has the same shape as the select. A group with nothing picked isn't in the query, and in the result type each group and its properties are optional.

```ts
import { dynamicPick } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"

const availableFields = {
    id: tCustomer.id,
    name: {
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
    },
    birthday: tCustomer.birthday,
    company: {
        id: tCompany.id,
        name: tCompany.name
    }
};

const fieldsToPick = {
    name: {
        firstName: true,
        lastName: true
    }
};

// always include id field as required
const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id']);

const customerWithOptionalCompany = await connection.selectFrom(tCustomer)
    .optionalInnerJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
    .select(pickedFields)
    .where(tCustomer.id.equals(12))
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as `name.firstName`, 
        last_name as `name.lastName` 
    from customer 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as `name.firstName`, 
        last_name as `name.lastName` 
    from customer 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "name.firstName", 
        last_name as "name.lastName" 
    from customer 
    where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "name.firstName", 
        last_name as "name.lastName" 
    from customer 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as "name.firstName", 
        last_name as "name.lastName" 
    from customer 
    where id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as [name.firstName], 
        last_name as [name.lastName] 
    from customer 
    where id = @0
    ```

The parameters are: `[ 12 ]`

The result type is:
```tsx
const customerWithOptionalCompany: Promise<{
    id: number;
    name?: {
        firstName?: string;
        lastName?: string;
    };
    birthday?: Date;
    company?: {
        id?: number;
        name?: string;
    };
}[]>
```

But when a column provided by the join is picked, like with this `fieldsToPick`, the join is in the query:
```ts
import { dynamicPick } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"

const availableFields = {
    id: tCustomer.id,
    name: {
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
    },
    birthday: tCustomer.birthday,
    company: {
        id: tCompany.id,
        name: tCompany.name
    }
};

// CHANGED: fieldsToPick requiring more information
const fieldsToPick = {
    name: {
        firstName: true,
        lastName: true,
    },
    company: {
        name: true
    }
}

// always include id field as required
const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id']);

const customerWithOptionalCompany = await connection.selectFrom(tCustomer)
    .optionalInnerJoin(tCompany).on(tCompany.id.equals(tCustomer.companyId))
    .select(pickedFields)
    .where(tCustomer.id.equals(12))
    .executeSelectMany();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        customer.first_name as `name.firstName`, 
        customer.last_name as `name.lastName`, 
        company.name as `company.name` 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        customer.id as id, 
        customer.first_name as `name.firstName`, 
        customer.last_name as `name.lastName`, 
        company.`name` as `company.name` 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        customer.id as "id", 
        customer.first_name as "name.firstName", 
        customer.last_name as "name.lastName", 
        company.name as "company.name" 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.id as id, 
        customer.first_name as "name.firstName", 
        customer.last_name as "name.lastName", 
        company.name as "company.name" 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.id as id, 
        customer.first_name as "name.firstName", 
        customer.last_name as "name.lastName", 
        company.name as "company.name" 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        customer.first_name as [name.firstName], 
        customer.last_name as [name.lastName], 
        company.name as [company.name] 
    from customer 
    inner join company on company.id = customer.company_id 
    where customer.id = @0
    ```

The parameters are: `[ 12 ]`

See [Select dynamically picking columns](#select-dynamically-picking-columns), [Optional joins](dynamic-queries.md#optional-joins) and [Optional joins dynamically picking columns](#optional-joins-dynamically-picking-columns) for more information.

## Full dynamic select

This example puts everything together in one function: `getSubcompanies` returns the subcompanies of a company. The caller chooses the columns and passes a filter and an order, and the type of the result has only the columns they asked for. The query joins the favourite customer only when it's needed.

Consider this when a single function serves many callers, like the layer behind a list in a user interface or an API. For a few fixed cases, a few separate queries are easier to read.

The same function can be typed in two ways:

- **[From the database](#from-the-database):** the types come from the available columns, with `DynamicPickPaths`, `PickValuesPath` and `DynamicCondition` over the map. See [Typing dynamic queries from the database types](../dynamic/from-database-types.md).
- **[From the model](#from-the-model):** the signature uses an interface you write, with `DynamicConditionForModel`, `DeepPickPaths`, `DeepPick` and `expandTypeFromDynamicPickPaths`, so no type of a column appears in it. See [Typing dynamic queries from a business model](../dynamic/from-business-model.md) and [Deep utilities](../advanced/deep-utilities.md).

Both receive the order as an array of clauses typed with [`OrderByForModel`](../dynamic/utilities/order-by.md), applied with `orderByFromStringArrayIfValue`, so each clause must be a valid field and mode. `orderByFromString` takes a plain `string`, so this typing is optional.

### From the database

Having this code, which is explained below:

<!-- doc-code-snippet-template: mariadb, mysql, oracle, postgresql, sqlite, sqlserver -->
```typescript
function buildCompanyAvailableFields<CUSTOMER extends TableOrViewLeftJoinOf<typeof tCustomer, 'favouriteCustomer'>>(_connection: DBConnection, favouriteCustomerRef: CUSTOMER) {
    const favouriteCustomer = fromRef(tCustomer, favouriteCustomerRef);

    return {
        id: tCompany.id,
        name: tCompany.name,
        favouriteCustomer: {
            id: favouriteCustomer.id,
            name: favouriteCustomer.firstName.concat(' ').concat(favouriteCustomer.lastName)
        }
    }
}

interface CustomerRules {
    anyCustomerNameContains?: string
    anyCustomerWithBirthdayOn?: Date
}

function buildCompanyConditionExtension<CUSTOMER extends TableOrViewLeftJoinOf<typeof tCustomer, 'favouriteCustomer'>>(connection: DBConnection, favouriteCustomerRef: CUSTOMER) {
    const favouriteCustomer = fromRef(tCustomer, favouriteCustomerRef);

    return {
        customers: (rules: CustomerRules) => {
            let result = connection.dynamicBooleanExpressionUsing(tCompany)

            if (rules.anyCustomerNameContains) {
                const query = connection.subSelectUsing(tCompany)
                    .from(tCustomer)
                    .where(tCustomer.firstName.concat(' ').concat(tCustomer.lastName).containsInsensitive(rules.anyCustomerNameContains))
                    .selectOneColumn(tCustomer.id)
                
                result = result.and(connection.exists(query))
            }

            if (rules.anyCustomerWithBirthdayOn) {
                const query = connection.subSelectUsing(tCompany)
                    .from(tCustomer)
                    .where(tCustomer.birthday.equals(rules.anyCustomerWithBirthdayOn))
                    .selectOneColumn(tCustomer.id)
                
                result = result.and(connection.exists(query))
            }

            return result
        },
        favouriteCustomer: {
            isInAnotherCompanyWithName: (name: string) => {
                const query = connection.selectFrom(tCompany)
                    .where(tCompany.name.containsInsensitive(name))
                    .selectOneColumn(tCompany.favouriteCustomerId)

                return favouriteCustomer.id.in(query)
            }
        }
    }
}

type CompanyFields = DynamicPickPaths<ReturnType<typeof buildCompanyAvailableFields>, 'id'>
type CompanyDynamicCondition = DynamicCondition<ReturnType<typeof buildCompanyAvailableFields>, ReturnType<typeof buildCompanyConditionExtension>>
type CompanyInformation<FIELDS extends CompanyFields> = PickValuesPath<ReturnType<typeof buildCompanyAvailableFields>, FIELDS | 'id'>

async function getSubcompanies<FIELDS extends CompanyFields>(connection: DBConnection, parentCompanyId: number, fields: FIELDS[], condition: CompanyDynamicCondition, orderBy?: OrderByForModel<CompanyInformation<CompanyFields>>[]): Promise<CompanyInformation<FIELDS>[]> {
    const favouriteCustomer = tCustomer.forUseInLeftJoinAs('favouriteCustomer')

    const availableFields = buildCompanyAvailableFields(connection, favouriteCustomer)
    const conditionExtension = buildCompanyConditionExtension(connection, favouriteCustomer)

    const dynamicCondition = connection.dynamicConditionFor(availableFields, conditionExtension).withValues(condition)
    const selectedFields = dynamicPickPaths(availableFields, fields, ['id'])
    
    const companies = await connection
        .selectFrom(tCompany)
        .optionalLeftOuterJoin(favouriteCustomer).on(tCompany.favouriteCustomerId.equals(favouriteCustomer.id))
        .where(dynamicCondition)
        .and(tCompany.parentId.equals(parentCompanyId))
        .select(selectedFields)
        .orderByFromStringArrayIfValue(orderBy)
        .executeSelectMany()

    return expandTypeFromDynamicPickPaths(availableFields, fields, companies, ['id'])
}
```

The pieces of this code are:

| Piece | What it does |
|---|---|
| `buildCompanyAvailableFields` | Returns the map of columns the caller can pick and filter by. Being a function, its type is available to the types below, even though the alias of the left join is created inside `getSubcompanies` |
| `favouriteCustomerRef` | The table as a parameter. `TableOrViewLeftJoinOf<typeof tCustomer, 'favouriteCustomer'>` is the type for `tCustomer.forUseInLeftJoinAs('favouriteCustomer')`, and `fromRef` gives back its columns. See [Passing tables and views as parameter](../advanced/tables-views-as-parameter.md) |
| `buildCompanyConditionExtension` | The rules of the filter that aren't a column: `customers` and `favouriteCustomer.isInAnotherCompanyWithName`. The first one builds its condition with `if`s, using [`dynamicBooleanExpressionUsing`](#complex-dynamic-boolean-expressions) |
| `CompanyFields` | The names the caller can pick, without `id`, which is always returned |
| `CompanyDynamicCondition` | The type of the filter: the columns of the map and the rules |
| `CompanyInformation<FIELDS>` | The type of a row with only the columns in `FIELDS`, plus `id` |
| `expandTypeFromDynamicPickPaths` | Gives the rows that type, and returns them as they are. See [Expanding result types](../dynamic/utilities/picks.md#expanding-result-types-from-dynamic-picks) |

The order is an array of clauses that name properties of the select: as in any [pick](#select-dynamically-picking-columns), naming one that wasn't picked throws `ORDER_BY_COLUMN_NOT_IN_SELECT`.

**If you call `getSubcompanies` as:**
```ts
const companyId = 23
const result = getSubcompanies(connection, companyId, ['name'], {
    name: { containsInsensitive: 'ACME' }
})
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        name as name 
    from company 
    where 
            lower(name) like concat('%', lower(?), '%') 
        and parent_id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        `name` as `name` 
    from company 
    where 
            lower(`name`) like concat('%', lower(?), '%') 
        and parent_id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name" 
    from company 
    where 
            lower(name) like lower('%' || :0 || '%') escape '\' 
        and parent_id = :1
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name 
    from company 
    where 
            name ilike ('%' || $1 || '%') 
        and parent_id = $2
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name 
    from company 
    where 
            lower(name) like lower('%' || ?1 || '%') escape '\' 
        and parent_id = ?2
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name 
    from company 
    where 
            lower(name) like lower('%' + @0 + '%') 
        and parent_id = @1
    ```

The parameters are: `[ "ACME", 23 ]`

The result type is:
```tsx
const result: Promise<{
    id: number;
    name: string;
}[]>
```

**If you call `getSubcompanies` as:**
```ts
const companyId = 23
const result = await getSubcompanies(connection, companyId, ['name', 'favouriteCustomer.name'], { 
    customers: { anyCustomerNameContains: 'smith'} 
})
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company.id as id, 
        company.name as name, 
        concat(favouriteCustomer.first_name, ?, favouriteCustomer.last_name) as `favouriteCustomer.name` 
    from company 
    left outer join customer as favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        exists(
            select id as result 
            from customer 
            where lower(concat(first_name, ?, last_name)) like concat('%', lower(?), '%')
        ) and company.parent_id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        company.id as id, 
        company.`name` as `name`, 
        concat(favouriteCustomer.first_name, ?, favouriteCustomer.last_name) as `favouriteCustomer.name` 
    from company 
    left outer join customer as favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        exists(
            select id as result 
            from customer 
            where lower(concat(first_name, ?, last_name)) like concat('%', lower(?), '%')
        ) and company.parent_id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        company.id as "id", 
        company.name as "name", 
        case when favouriteCustomer.first_name is null or favouriteCustomer.last_name is null then null else favouriteCustomer.first_name || :0 || favouriteCustomer.last_name end as "favouriteCustomer.name" 
    from company 
    left outer join customer favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        exists(
            select id as "result" 
            from customer 
            where lower(first_name || :1 || last_name) like lower('%' || :2 || '%') escape '\'
        ) and company.parent_id = :3
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as id, 
        company.name as name, 
        favouriteCustomer.first_name || $1 || favouriteCustomer.last_name as "favouriteCustomer.name" 
    from company 
    left outer join customer as favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        exists(
            select id as result 
            from customer 
            where (first_name || $2 || last_name) ilike ('%' || $3 || '%')
        ) and company.parent_id = $4
    ```
=== "SQLite"
    ```sqlite
    select 
        company.id as id, 
        company.name as name, 
        favouriteCustomer.first_name || ?1 || favouriteCustomer.last_name as "favouriteCustomer.name" 
    from company 
    left outer join customer as favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        exists(
            select id as result 
            from customer 
            where lower(first_name || ?2 || last_name) like lower('%' || ?3 || '%') escape '\'
        ) and company.parent_id = ?4
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company.id as id, 
        company.name as name, 
        favouriteCustomer.first_name + @0 + favouriteCustomer.last_name as [favouriteCustomer.name] 
    from company 
    left outer join customer as favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        exists(
            select id as [result] 
            from customer 
            where lower(first_name + @1 + last_name) like lower('%' + @2 + '%')
        ) and company.parent_id = @3
    ```

The parameters are: `[ " ", " ", "smith", 23 ]`

The result type is:
```tsx
const result: Promise<{
    id: number;
    name: string;
    favouriteCustomer?: {
        name: string;
    };
}[]>
```

**If you call `getSubcompanies` as:**
```ts
const companyId = 23
const result = getSubcompanies(connection, companyId, ['name'], { 
    favouriteCustomer: { isInAnotherCompanyWithName: 'ACME Inc.' } 
})
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        company.id as id, 
        company.name as name 
    from company 
    left outer join customer as favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        favouriteCustomer.id in (
            select parent_id as result 
            from company 
            where lower(name) like concat('%', lower(?), '%')
        ) and company.parent_id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        company.id as id, 
        company.`name` as `name` 
    from company 
    left outer join customer as favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        favouriteCustomer.id in (
            select parent_id as result 
            from company 
            where lower(`name`) like concat('%', lower(?), '%')
        ) and company.parent_id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        company.id as "id", 
        company.name as "name" 
    from company 
    left outer join customer favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        favouriteCustomer.id in (
            select parent_id as "result" 
            from company 
            where lower(name) like lower('%' || :0 || '%') escape '\'
        ) and company.parent_id = :1
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        company.id as id, 
        company.name as name 
    from company 
    left outer join customer as favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        favouriteCustomer.id in (
            select parent_id as result 
            from company 
            where name ilike ('%' || $1 || '%')
        ) and company.parent_id = $2
    ```
=== "SQLite"
    ```sqlite
    select 
        company.id as id, 
        company.name as name 
    from company 
    left outer join customer as favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        favouriteCustomer.id in (
            select parent_id as result 
            from company 
            where lower(name) like lower('%' || ?1 || '%') escape '\'
        ) and company.parent_id = ?2
    ```
=== "SQL Server"
    ```sqlserver
    select 
        company.id as id, 
        company.name as name 
    from company 
    left outer join customer as favouriteCustomer on company.parent_id = favouriteCustomer.id 
    where 
        favouriteCustomer.id in (
            select parent_id as [result] 
            from company 
            where lower(name) like lower('%' + @0 + '%')
        ) and company.parent_id = @1
    ```

The parameters are: `[ "ACME Inc.", 23 ]`

The result type is:
```tsx
const result: Promise<{
    id: number;
    name: string;
}[]>
```

**If you call `getSubcompanies` as:**
```ts
const companyId = 23
const result = getSubcompanies(connection, companyId, ['name'], { 
        or: [ 
            { customers: { anyCustomerNameContains: 'John' }}, 
            { customers: { anyCustomerWithBirthdayOn: new Date('2000-03-01')} } 
        ] 
    })
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        name as name 
    from company 
    where 
        (
            exists(
                select id as result 
                from customer 
                where lower(concat(first_name, ?, last_name)) like concat('%', lower(?), '%')
            ) or exists(
                select id as result 
                from customer 
                where birthday = ?
            )
        ) and parent_id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        `name` as `name` 
    from company 
    where 
        (
            exists(
                select id as result 
                from customer 
                where lower(concat(first_name, ?, last_name)) like concat('%', lower(?), '%')
            ) or exists(
                select id as result 
                from customer 
                where birthday = ?
            )
        ) and parent_id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        name as "name" 
    from company 
    where 
        (
            exists(
                select id as "result" 
                from customer 
                where lower(first_name || :0 || last_name) like lower('%' || :1 || '%') escape '\'
            ) or exists(
                select id as "result" 
                from customer 
                where birthday = :2
            )
        ) and parent_id = :3
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        name as name 
    from company 
    where 
        (
            exists(
                select id as result 
                from customer 
                where (first_name || $1 || last_name) ilike ('%' || $2 || '%')
            ) or exists(
                select id as result 
                from customer 
                where birthday = $3
            )
        ) and parent_id = $4
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        name as name 
    from company 
    where 
        (
            exists(
                select id as result 
                from customer 
                where lower(first_name || ?1 || last_name) like lower('%' || ?2 || '%') escape '\'
            ) or exists(
                select id as result 
                from customer 
                where birthday = ?3
            )
        ) and parent_id = ?4
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        name as name 
    from company 
    where 
        (exists(
            select id as [result] 
            from customer 
            where lower(first_name + @0 + last_name) like lower('%' + @1 + '%')
        ) or exists(
            select id as [result] 
            from customer 
            where birthday = @2
        ))
        and parent_id = @3
    ```

The parameters are: `[ " ", "John", 2000-03-01T00:00:00.000Z, 23 ]`

The result type is:
```tsx
const result: Promise<{
    id: number;
    name: string;
}[]>
```

### From the model

The same query, typed from an interface you write instead of from the columns. The body still builds the map of columns, which it needs for the SQL, but the signature uses only `CompanyInformationModel`: `DynamicConditionForModel` types the filter, `DeepPickPaths` and `DeepPick` type the pick, and `OrderByForModel` types the order. Each one is explained in [Typing dynamic queries from a business model](../dynamic/from-business-model.md) and [Deep utilities](../advanced/deep-utilities.md).

<!-- doc-code-snippet-template: mariadb, mysql, oracle, postgresql, sqlite, sqlserver -->
```typescript
interface CompanyInformationModel {
    id: number
    name: string
    favouriteCustomer?: {
        id: number
        name: string
    }
}

async function getSubcompaniesFromModel<FIELDS extends DeepPickPaths<CompanyInformationModel>>(connection: DBConnection, parentCompanyId: number, fields: FIELDS[], condition: DynamicConditionForModel<CompanyInformationModel>, orderBy?: OrderByForModel<CompanyInformationModel>[]): Promise<DeepPick<CompanyInformationModel, FIELDS | 'id'>[]> {
    const favouriteCustomer = tCustomer.forUseInLeftJoinAs('favouriteCustomer')

    const availableFields = {
        id: tCompany.id,
        name: tCompany.name,
        favouriteCustomer: {
            id: favouriteCustomer.id,
            name: favouriteCustomer.firstName.concat(' ').concat(favouriteCustomer.lastName)
        }
    }

    const dynamicCondition = connection.dynamicConditionFor(availableFields).withValues(condition)
    const selectedFields = dynamicPickPaths(availableFields, fields, ['id'])

    const companies = await connection
        .selectFrom(tCompany)
        .optionalLeftOuterJoin(favouriteCustomer).on(tCompany.favouriteCustomerId.equals(favouriteCustomer.id))
        .where(dynamicCondition)
        .and(tCompany.parentId.equals(parentCompanyId))
        .select(selectedFields)
        .orderByFromStringArrayIfValue(orderBy)
        .executeSelectMany()

    return expandTypeFromDynamicPickPaths(availableFields, fields, companies, ['id'])
}
```

You call it the same way, but every type the caller sees comes from `CompanyInformationModel`, including the order, which is checked against it:

```ts
const result = await getSubcompaniesFromModel(connection, 23, ['name', 'favouriteCustomer.name'],
    { name: { containsInsensitive: 'ACME' } },
    ['favouriteCustomer.name asc nulls last', 'name desc'])
```

!!! note "The rules of the filter still come from the database"

    `DynamicConditionForModel` turns the fields of the model into the usual operators. A rule of your own, like `customers` or `isInAnotherCompanyWithName` in the previous version, is written against the tables. To keep it, build the extension in the same way, and pass it as the second argument of both `DynamicConditionForModel<Model, Extension>` and `dynamicConditionFor(availableFields, extension)`.

## Summary and when to use these patterns

Use these techniques when the columns or the filters of a query really have to be decided at run time, starting from the simplest row of the [table at the start](#introduction) that solves your case.

If you use them often, consider whether a change in the design of your API would make your system easier to reason about: a few well-defined queries, or the same columns with [hidden values](#hide-a-value-keeping-the-column), are easier to maintain.