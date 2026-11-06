---
search:
  boost: 1.5
---
# Picking columns dynamically

The caller chooses which columns come back, as in GraphQL. You write all the columns that can be returned in a map, and the function keeps those the caller picks. The query only has those columns.

!!! tip

    Columns that come and go make a query harder to reason about. If the caller can work with the same columns and no value in some of them, prefer [`onlyWhenOrNull`](restricting-values.md#hide-a-value-keeping-the-column).

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
| `dynamicPick` | `dynamicPick(availableFields, { firstName: true, lastName: true }, ['id'])` | `{ company: true }` for all of them, or `{ company: { name: true } }` for one |
| `dynamicPickPaths` | `dynamicPickPaths(availableFields, ['firstName', 'lastName'], ['id'])` | `'company'` for all of them, or `'company.name'` for one |

In `dynamicPick`, only the value `true` picks a property: `false`, a missing property, or a text like `'true'` don't. In both, a name that isn't in the map is ignored.

The optional third argument lists the properties that are always included: they are required in the result type, and the others are optional. The same is achieved by writing them in the `select`, as this example does with `id`. With no property picked and none always included, the query has no columns and the database rejects it.

Ordering depends on what was picked. Given a name, `orderBy` accepts only the properties that are always included, and any other doesn't compile; given a column, like `.orderBy(tCustomer.birthday)`, it doesn't need it in the select. `orderByFromString` and `orderByFromStringArray` receive the name in a text, so they can use any picked property, and they throw `ORDER_BY_COLUMN_NOT_IN_SELECT` when you call them with one that wasn't picked.

To return a type with only the picked properties, see [Expanding result types](utilities/picks.md#expanding-result-types-from-dynamic-picks). A pick also works in an [array aggregate](../queries/aggregate-as-object-array.md).

## The columns the client asks for

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

const req = { query: { fields: 'firstName,lastName' } }
const requestedFields = req.query.fields.split(',') as CustomerField[]

const customers = await connection.selectFrom(tCustomer)
    .select(dynamicPickPaths(availableFields, requestedFields, ['id']))
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

The client can ask for any column of the map. If some of them need a permission, mark them with [`allowWhen`](restricting-values.md#refuse-a-query-that-uses-a-value).

## The joins follow what is picked

An [optional join](optional-joins.md) goes in the query only when the query uses the joined table. Together with a pick, what the caller asks for decides the join: if no column of `tCompany` is picked, and no condition uses it, the query doesn't join it.

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

## Picking with nested objects

With [nested objects](../queries/complex-projections.md), the pick has the same shape as the select. A group with nothing picked isn't in the query, and in the result type each group and its properties are optional.

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
