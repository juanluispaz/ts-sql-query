---
search:
  boost: 0.7
---
# Dynamic picks

Picking columns dynamically lets the caller choose which columns a query returns, and [Picking columns dynamically](../picks.md) explains how it works and shows it with its queries. This page is the reference of what `ts-sql-query/dynamic/pick` exports, which is also exported from the root `ts-sql-query`.

| Export | What it's for | Where it's used |
|---|---|---|
| [`dynamicPick`](#dynamicpick) | Keeps the fields marked in an object, like `{ firstName: true }` | In the `select` of the query |
| [`dynamicPickPaths`](#dynamicpickpaths) | Keeps the fields named in a list, like `['firstName', 'company.name']` | In the `select` of the query |
| [`DynamicPick`](#dynamicpick_1) | The type of what `dynamicPick` receives | The parameter of your function, or the type of a request |
| [`DynamicPickPaths`](#dynamicpickpaths_1) | The type of each name that `dynamicPickPaths` receives | The parameter of your function, or the type of a request |
| [`Pickable`](#pickable) | What a map of available fields must be | A function of yours that receives the map as a type parameter |
| [`PickValuesPath`, `PickValuesPathWithAllProperties`, and their `ProjectedAsNullable` twins](#types-of-the-result) | The type of a row, given what was picked | The return type of your function |
| [`expandTypeFromDynamicPickPaths`, `expandTypeProjectedAsNullableFromDynamicPickPaths`](#expanding-result-types-from-dynamic-picks) | Gives the rows the type of what was picked | The `return` of your function |

## Functions that pick the columns

### dynamicPick

`dynamicPick(availableFields, fieldsToPick, alwaysIncluded?)` returns a new object with the properties of `availableFields` whose value in `fieldsToPick` is `true`. For a nested object, `{ company: true }` picks all of it, and `{ company: { name: true } }` picks one property.

```ts
import { dynamicPick } from 'ts-sql-query' // or 'ts-sql-query/dynamic/pick';

const availableFields = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName,
    birthday: tCustomer.birthday
};

const fieldsToPick = {
    firstName: true,
    birthday: true
};

const pickedFields = dynamicPick(availableFields, fieldsToPick, ['id']);
```

`alwaysIncluded` is optional, and it lists the properties that are returned whatever is picked. They are required in the result type, and the others are optional. With nothing picked and nothing always included, the query has no columns and the database rejects it, so a property that is always included, usually the id, avoids that.

### dynamicPickPaths

`dynamicPickPaths(availableFields, pathsToPick, alwaysIncluded?)` does the same from a list of names. A nested object is `'company'` for all of it, and `'company.name'` for one property. `alwaysIncluded` works as in `dynamicPick`.

```ts
import { dynamicPickPaths } from 'ts-sql-query' // or 'ts-sql-query/dynamic/pick';

const pickedFields = dynamicPickPaths(availableFields, ['firstName', 'birthday'], ['id'])
```

## Types of what is picked

### DynamicPick

`DynamicPick<Type, MandatoryFields?>` is the type of the object that `dynamicPick` receives. Each property is an optional `boolean`. A nested object accepts `true` for all of it, or an object with its shape. `MandatoryFields` lists the ones that are always included, which aren't offered.

```ts
import type { DynamicPick } from 'ts-sql-query' // or 'ts-sql-query/dynamic/pick';

type FieldsToPick = DynamicPick<typeof availableFields, 'id'>
```

### DynamicPickPaths

`DynamicPickPaths<Type, MandatoryPaths?>` is the type of one name that `dynamicPickPaths` receives: a union with the name of each property and each nested object, and the path of what is inside them, like `'company' | 'company.name'`. `MandatoryPaths` lists the ones that are always included, which aren't offered.

```ts
import type { DynamicPickPaths } from 'ts-sql-query' // or 'ts-sql-query/dynamic/pick';

type FieldsToPickList = DynamicPickPaths<typeof availableFields, 'id'>
```

### Pickable

`Pickable` is the type that all the maps of available fields fit: an object whose values are columns, expressions, or nested objects of them. Use it to write a function that receives the map as a type parameter:

```ts
import { dynamicPickPaths, DynamicPickPaths, Pickable } from 'ts-sql-query' // or 'ts-sql-query/dynamic/pick';

function pickFields<FIELDS extends Pickable>(fields: FIELDS, paths: DynamicPickPaths<FIELDS>[]) {
    return dynamicPickPaths(fields, paths)
}

const pickedFields = pickFields(availableFields, ['firstName', 'birthday'])
```

## Types of the result

These types give the type of a row from the map of available fields and the names that were picked. They differ in what they do with the properties that weren't picked, and with the optional values:

| Type | Properties not picked | Optional values | With `availableFields` and `'firstName' \| 'birthday'` |
|---|---|---|---|
| `PickValuesPath` | Not in the type | Optional | `{ firstName: string; birthday?: Date }` |
| `PickValuesPathWithAllProperties` | Optional | Optional | `{ firstName: string; birthday?: Date; id?: number; lastName?: string }` |
| `PickValuesPathProjectedAsNullable` | Not in the type | Required, and they allow `null` | `{ firstName: string; birthday: Date \| null }` |
| `PickValuesPathWithAllPropertiesProjectedAsNullable` | Optional | Required, and they allow `null` | `{ firstName: string; birthday: Date \| null; id?: number; lastName?: string }` |

Use `PickValuesPath` for a type with only what was picked, and `PickValuesPathWithAllProperties` when the callers expect all the properties to exist in the type, as the result of `select` with a pick has them. Use a `ProjectedAsNullable` twin when the query calls [`projectingOptionalValuesAsNullable`](../../queries/basic-query-structure.md#projecting-optional-values).

```ts
import type { PickValuesPath, PickValuesPathWithAllProperties, PickValuesPathProjectedAsNullable, PickValuesPathWithAllPropertiesProjectedAsNullable } from 'ts-sql-query' // or 'ts-sql-query/dynamic/pick';

type OnlyPicked = PickValuesPath<typeof availableFields, 'firstName' | 'birthday'>
type AllProperties = PickValuesPathWithAllProperties<typeof availableFields, 'firstName' | 'birthday'>
type OnlyPickedAsNullable = PickValuesPathProjectedAsNullable<typeof availableFields, 'firstName' | 'birthday'>
type AllPropertiesAsNullable = PickValuesPathWithAllPropertiesProjectedAsNullable<typeof availableFields, 'firstName' | 'birthday'>
```

## Expanding result types from dynamic picks

A function that receives the names to pick as a type parameter can declare a return type with only those properties, but TypeScript can't relate that type to the rows of the query while the names are still generic. `expandTypeFromDynamicPickPaths` gives the rows that type, without a cast. It does nothing at run time: it returns what it receives.

| Argument | What it is |
|---|---|
| First | The map of available fields |
| Second | The names that were picked |
| Third | The result of the query: the rows of `executeSelectMany`, the row of `executeSelectOne`, the row or `null` of `executeSelectNoneOrOne`, or the object with `data` and `count` of `executeSelectPage` |
| Fourth, optional | The properties that are always included: the same list you passed to `dynamicPickPaths` |

The value it returns can be returned from your function as any of these types, written over a generic `FIELDS`:

| Return type of your function | When | Complete example |
|---|---|---|
| `PickValuesPath<typeof availableFields, FIELDS \| 'id'>` | The types come from the columns | [Typing from the database types](../from-database-types.md#picking-columns-dynamicpickpaths-pickvaluespath) |
| `Pick<Model, FIELDS \| 'id'>` | An interface of yours, and the names are its top-level properties | The next example |
| `DeepPick<Model, FIELDS \| 'id'>` | An interface of yours, and the names can reach inside nested objects, like `'company.name'` | [Typing from a business model](../from-business-model.md#picking-columns-dynamicpickpaths-deeppick), and [Deep utilities](../../advanced/deep-utilities.md) for `DeepPick` and `DeepPickPaths` |

```ts
import { dynamicPickPaths, expandTypeFromDynamicPickPaths } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"

interface CustomerInformation {
    id: number;
    firstName: string;
    lastName: string;
    birthday?: Date;
}

async function getCustomersInformation<FIELDS extends keyof CustomerInformation>(connection: DBConnection, fields: FIELDS[]): Promise<Pick<CustomerInformation, FIELDS | 'id'>[]> {
    const availableFields = {
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        birthday: tCustomer.birthday
    }
    
    // always include id field as required
    const pickedFields = dynamicPickPaths(availableFields, fields, ['id'])
    
    const customers = await connection.selectFrom(tCustomer)
        .select(pickedFields)
        .executeSelectMany()

    return expandTypeFromDynamicPickPaths(availableFields, fields, customers, ['id']);
}

const customers = await getCustomersInformation(connection, ['firstName', 'lastName'])
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

!!! warning "Objects with a required property that wasn't picked"

    The type of a dynamic pick can't know everything decided at run time. When an object has required properties and you pick only its optional ones, the object can be absent from a row with no value in them. `PickValuesPath` says so, but the result of `expandTypeFromDynamicPickPaths` declares it present, because it has to be assignable to `DeepPick<Model, FIELDS>` over a generic `FIELDS`. The same happens when a mandatory property is next to a picked `asRequiredInOptionalObject` one, or when a mandatory property from a left join is next to a picked one from another table. Check for the object when your pick can leave it out.

The third argument can also be a page of results. The function then returns `data` with the type of what was picked, and the rest as it was:

```ts
import { dynamicPickPaths, expandTypeFromDynamicPickPaths, DynamicPickPaths } from 'ts-sql-query' // or 'ts-sql-query/dynamic/pick';

const customerFields = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName
}

async function getCustomersPage<FIELDS extends DynamicPickPaths<typeof customerFields, 'id'>>(connection: DBConnection, fields: FIELDS[]) {
    const page = await connection.selectFrom(tCustomer)
        .select(dynamicPickPaths(customerFields, fields, ['id']))
        .orderBy('id')
        .limit(10)
        .offset(0)
        .executeSelectPage()

    return expandTypeFromDynamicPickPaths(customerFields, fields, page, ['id'])
}

const customersPage = await getCustomersPage(connection, ['firstName'])
```

The executed query to get the data is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by id 
    limit ? 
    offset ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by id 
    limit ? 
    offset ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name as "firstName" 
    from customer 
    order by "id" 
    offset :0 rows 
    fetch next :1 rows only
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name as "firstName" 
    from customer 
    order by id 
    limit $1 
    offset $2
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by id 
    limit ?1 
    offset ?2
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name as firstName 
    from customer 
    order by id 
    offset @0 rows 
    fetch next @1 rows only
    ```

And its parameters are: `[ 10, 0 ]` (on Oracle and SQL Server: `[ 0, 10 ]`)

The executed query to get the count is:

=== "MariaDB"
    ```mariadb
    select count(*) 
    from customer
    ```
=== "MySQL"
    ```mysql
    select count(*) 
    from customer
    ```
=== "Oracle"
    ```oracle
    select count(*) 
    from customer
    ```
===+ "PostgreSQL"
    ```postgresql
    select count(*) 
    from customer
    ```
=== "SQLite"
    ```sqlite
    select count(*) 
    from customer
    ```
=== "SQL Server"
    ```sqlserver
    select count(*) 
    from customer
    ```

And its parameters are: `[]`

### expandTypeProjectedAsNullableFromDynamicPickPaths

When the query calls [`projectingOptionalValuesAsNullable`](../../queries/basic-query-structure.md#projecting-optional-values), use `expandTypeProjectedAsNullableFromDynamicPickPaths`, which has the same arguments. Its result can be returned as `PickValuesPathProjectedAsNullable`:

```ts
import { dynamicPickPaths, expandTypeProjectedAsNullableFromDynamicPickPaths, DynamicPickPaths, PickValuesPathProjectedAsNullable } from 'ts-sql-query' // or 'ts-sql-query/dynamic/pick';

const customerFields = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    birthday: tCustomer.birthday
}

type CustomerField = DynamicPickPaths<typeof customerFields, 'id'>
type CustomerRow<FIELDS extends CustomerField> = PickValuesPathProjectedAsNullable<typeof customerFields, FIELDS | 'id'>

async function getCustomers<FIELDS extends CustomerField>(connection: DBConnection, fields: FIELDS[]): Promise<CustomerRow<FIELDS>[]> {
    const customers = await connection.selectFrom(tCustomer)
        .select(dynamicPickPaths(customerFields, fields, ['id']))
        .projectingOptionalValuesAsNullable()
        .executeSelectMany()

    return expandTypeProjectedAsNullableFromDynamicPickPaths(customerFields, fields, customers, ['id'])
}

const customers = await getCustomers(connection, ['birthday'])
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        birthday as birthday 
    from customer
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        birthday as birthday 
    from customer
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        birthday as "birthday" 
    from customer
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        birthday as birthday 
    from customer
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        birthday as birthday 
    from customer
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        birthday as birthday 
    from customer
    ```

The parameters are: `[]`
