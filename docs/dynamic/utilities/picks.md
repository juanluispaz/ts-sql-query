---
search:
  boost: 0.7
---
# Dynamic picks

The `ts-sql-query/dynamic/pick` module (also re-exported from the root `ts-sql-query`) provides the helpers for building a query with dynamic column selection. It exports the runtime functions that pick fields and the types that describe the picked input and infer the result:

| Export | Purpose |
|---|---|
| `dynamicPick(...)` | Select fields from a boolean object map (`{ name: true, … }`). |
| `dynamicPickPaths(...)` | Select fields from a list of dotted paths (`['name', 'company.name']`). |
| `expandTypeFromDynamicPickPaths(...)` / `expandTypeProjectedAsNullableFromDynamicPickPaths(...)` | Re-type already-fetched rows so they match the picked shape without a cast. |
| `DynamicPick<Type>` / `DynamicPickPaths<Type>` | The input types for the two pick functions (a boolean map / a path union). |
| `PickValuesPath<…>` / `PickValuesPathWithAllProperties<…>` (and their `…ProjectedAsNullable` variants) | The result types computed from the selected fields. |
| `Pickable` | The base constraint for an available-fields map. |

When using `dynamicPick` or `dynamicPickPaths`, you often need these helper types to specify the input structure of fields the caller can choose from, and to compute the type of the result based on the selected fields.

!!! warning "Context: continuation of Extreme Dynamic Queries"

    This page is part of the advanced dynamic query patterns covered in [Extreme Dynamic Queries](../../queries/extreme-dynamic-queries.md).  
    It provides detailed reference for the utility functions and types used to define and infer types in dynamically picked projections.

    If you haven’t read that page yet, we recommend starting there to understand the practical use cases and query-building patterns that these helpers support.

## Functions to select fields dynamically

### dynamicPick

**Function**: `dynamicPick(availableFields, fieldsToPick, alwaysIncluded?)`

Returns a new object including only the properties in `availableFields` that are marked as `true` in `fieldsToPick`. Nested objects are also supported.

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

!!! note "Picking nothing"
    With no field picked and no mandatory field, the query has no columns: the SQL is `select  from …`, which the database rejects. Keep at least one mandatory field, usually the id.

!!! note "Including mandatory fields"

    The third argument (`alwaysIncluded`) is optional. It ensures that certain fields are always included, regardless of what the user picks.  
    However, we recommend including these directly in the `.select()` block when possible, for clarity.

### dynamicPickPaths

**Function**: `dynamicPickPaths(availableFields, pathsToPick, alwaysIncluded?)`

Like `dynamicPick`, but instead of a shape object, you provide an array of property names or paths (e.g. `'name.firstName'`).

```ts
import { dynamicPickPaths } from 'ts-sql-query' // or 'ts-sql-query/dynamic/pick';

const pickedFields = dynamicPickPaths(availableFields, ['firstName', 'birthday'], ['id'])
```

!!! note "Including mandatory fields"

    The third argument (`alwaysIncluded`) is optional. It ensures that certain fields are always included, regardless of what the user picks.  
    However, we recommend including these directly in the `.select()` block when possible, for clarity.

## Types to define dynamic pick inputs and outputs

These utility types help ensure proper typing when defining dynamic picks or returning their results.

### DynamicPick

**Type**: `DynamicPick<Type, MandatoryFields>`

Use this type to define the shape of a `fieldsToPick` object, where the user sets `true` to include each field. A group of properties accepts `true` to include all of it, or an object with the shape of the group to choose inside it.

```ts
import type { DynamicPick } from 'ts-sql-query' // or 'ts-sql-query/dynamic/pick';

type FieldsToPick = DynamicPick<typeof availableFields, 'id'>
```

### DynamicPickPaths

**Type**: `DynamicPickPaths<Type, MandatoryPaths>`

Use this type when your fields are selected by path strings (e.g. `'name.firstName'`).

```ts
import type { DynamicPickPaths } from 'ts-sql-query' // or 'ts-sql-query/dynamic/pick';

type FieldsToPickList = DynamicPickPaths<typeof availableFields, 'id'>
```

### PickValuesPath

**Type**: `PickValuesPath<Type, PickedPaths>`

Use this type to infer the result of a query that dynamically selects a subset of fields. The output will include **only** the selected fields.

```ts
import type { PickValuesPath } from 'ts-sql-query' // or 'ts-sql-query/dynamic/pick';

type ResultType = PickValuesPath<typeof availableFields, 'firstName' | 'birthday'>
```

!!! note "Typed result with projected required fields"
    If your query projects optional values in objects as always-required properties, use `PickValuesPathProjectedAsNullable` instead of `PickValuesPath`.

### PickValuesPathWithAllProperties

**Type**: `PickValuesPathWithAllProperties<Type, PickedPaths>`

Similar to `PickValuesPath`, but includes **all** properties from the original object: selected ones as their column says (required, unless the column is optional), and unselected ones as optional.

```ts
import type { PickValuesPathWithAllProperties } from 'ts-sql-query' // or 'ts-sql-query/dynamic/pick';

type ResultType = PickValuesPathWithAllProperties<typeof availableFields, 'firstName' | 'birthday'>
```

!!! note "Full result shape with projected required fields"
    If your query projects optional values in objects as always-required properties, use `PickValuesPathWithAllPropertiesProjectedAsNullable` instead of `PickValuesPathWithAllProperties`.

!!! note "Choosing between `PickValuesPath` and `PickValuesPathWithAllProperties`"

    Use `PickValuesPath` if you want a precise type with *only* the picked fields.  
    Use `PickValuesPathWithAllProperties` if you want to preserve a consistent structure where unpicked fields are still present, but optional — matching the behavior of `.select()` queries.

## Expanding result types from dynamic picks

When you are dynamically picking columns, you will probably want to create a function that receives the list of columns in a generic way, allowing the output to be properly typed with the requested columns.

To achieve that, use the function `expandTypeFromDynamicPickPaths` from `ts-sql-query/dynamic/pick`. It recalculates the return type based on the original picking rules, ensuring correct inference at the type level.

!!! note "When projecting optional fields as required"
    If your query projects optional fields in objects as always-required properties, use `expandTypeProjectedAsNullableFromDynamicPickPaths` instead of `expandTypeFromDynamicPickPaths`.

!!! warning "Objects with a required property that wasn't picked"
    The type of a dynamic pick can't know everything decided at runtime. When an object has required properties and you pick only its optional ones, the object can be absent from a row with no value in them: `PickValuesPath` says so, but the result of `expandTypeFromDynamicPickPaths` declares it present, and it has to, to be assignable to `DeepPick<Model, FIELDS>` over a generic `FIELDS`. The same happens when a mandatory property sits next to a picked `asRequiredInOptionalObject` one, or a mandatory property from a left join sits next to a picked one from another table. Check for the object when your pick can leave it out.

**Arguments**:

- The first argument is the full set of `availableFields`.
- The second is the set of picked paths.
- The third is the actual query result (as returned by `.executeSelectMany()`).
- The fourth (optional) is a list of fields that must always be present in the result, even if they were not explicitly picked.

### Creating definitions based on your database types

```ts
import { dynamicPickPaths, expandTypeFromDynamicPickPaths, DynamicPickPaths, PickValuesPath } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"

const customerInformationFields = {
    id: tCustomer.id,
    firstName: tCustomer.firstName,
    lastName: tCustomer.lastName,
    birthday: tCustomer.birthday,
}

type CustomerInformationFields = DynamicPickPaths<typeof customerInformationFields>
type CustomerInformation<FIELDS extends CustomerInformationFields> = PickValuesPath<typeof customerInformationFields, FIELDS | 'id'>

async function getCustomersInformation<FIELDS extends CustomerInformationFields>(connection: DBConnection, fields: FIELDS[]): Promise<CustomerInformation<FIELDS>[]> {
    
    // always include id field as required
    const pickedFields = dynamicPickPaths(customerInformationFields, fields, ['id'])
    
    const customers = await connection.selectFrom(tCustomer)
        .select(pickedFields)
        .executeSelectMany()

    return expandTypeFromDynamicPickPaths(customerInformationFields, fields, customers, ['id'])
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

### Creating definitions based on your business types

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

### Creating definitions based on your nested business types

The example above returns a flat `Pick<...>`, which works when the picked fields are **top-level** keys of your business type. When your business type is **nested** and you want to pick fields deep inside it using dotted paths (e.g. `'company.name'`), use `DeepPick` and `DeepPickPaths` — the deep analogues of the built-in `Pick` and `keyof` (see [Deep utilities](../../advanced/deep-utilities.md) for the full reference):

- `DeepPickPaths<Model>` is the union of every legal dotted path of `Model` (the deep `keyof`).
- `DeepPick<Model, Paths>` keeps only the selected paths, narrowing the nested objects (the deep `Pick`). Top-level optionality is preserved, just like `Pick`.

```ts
import { dynamicPickPaths, expandTypeFromDynamicPickPaths } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"
import type { DeepPick, DeepPickPaths } from "ts-sql-query" // or "ts-sql-query/extras/deepUtilities"

interface CustomerWithCompany {
    id: number;
    firstName: string;
    lastName: string;
    company?: {
        id: number;
        name: string;
    };
}

async function getCustomersWithCompany<FIELDS extends DeepPickPaths<CustomerWithCompany>>(connection: DBConnection, fields: FIELDS[]): Promise<DeepPick<CustomerWithCompany, FIELDS | 'id'>[]> {
    const company = tCompany.forUseInLeftJoinAs('company')
    const availableFields = {
        id: tCustomer.id,
        firstName: tCustomer.firstName,
        lastName: tCustomer.lastName,
        company: {
            id: company.id,
            name: company.name,
        },
    }

    // always include id field as required
    const pickedFields = dynamicPickPaths(availableFields, fields, ['id'])

    const customers = await connection.selectFrom(tCustomer)
        .optionalLeftOuterJoin(company).on(company.id.equals(tCustomer.companyId))
        .select(pickedFields)
        .executeSelectMany()

    return expandTypeFromDynamicPickPaths(availableFields, fields, customers, ['id']);
}

const customers = await getCustomersWithCompany(connection, ['firstName', 'company.name'])
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        company.name as `company.name` 
    from customer 
    left outer join company as company on company.id = customer.company_id
    ```
=== "MySQL"
    ```mysql
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        company.`name` as `company.name` 
    from customer 
    left outer join company as company on company.id = customer.company_id
    ```
=== "Oracle"
    ```oracle
    select 
        customer.id as "id", 
        customer.first_name as "firstName", 
        company.name as "company.name" 
    from customer 
    left outer join company company on company.id = customer.company_id
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.id as id, 
        customer.first_name as "firstName", 
        company.name as "company.name" 
    from customer 
    left outer join company as company on company.id = customer.company_id
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        company.name as "company.name" 
    from customer 
    left outer join company as company on company.id = customer.company_id
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        customer.first_name as firstName, 
        company.name as [company.name] 
    from customer 
    left outer join company as company on company.id = customer.company_id
    ```

The parameters are: `[]`

!!! note "Flat `Pick` vs nested `DeepPick`"

    Use the built-in `Pick<Model, FIELDS | 'id'>` when the picked fields are top-level keys.  
    Use `DeepPick<Model, FIELDS | 'id'>` when you pick fields inside nested objects through dotted paths.

`DeepPick`, `DeepPickPaths` and their `Omit` counterpart `DeepOmit`, together with the runtime companions `deepPick` / `deepOmit`, are documented in full — including how terminal object values (dates, buffers, `Map`/`Set`, …) are treated — on the dedicated [Deep utilities](../../advanced/deep-utilities.md) page.
