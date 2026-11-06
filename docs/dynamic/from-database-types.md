---
search:
  boost: 1.5
---
# Typing dynamic queries from the database types

This is the **database-first** counterpart of [Typing dynamic queries from a business model](from-business-model.md). Here every helper type is derived from the **available columns** — the `availableFields` value-source map you build inside the query — using `typeof availableFields`. There is no hand-written model interface: the column map is the single source of truth, and the filter, the picked result and the order-by are all computed from it.

| What the caller controls | Helper to type it | Module |
|---|---|---|
| The **filter** (a criteria object) | `DynamicCondition<typeof availableFields, Extension?>` | `ts-sql-query/dynamic/condition` |
| The **columns** returned | `DynamicPickPaths<typeof availableFields>` + `PickValuesPath<typeof availableFields, …>` + `dynamicPickPaths` + `expandTypeFromDynamicPickPaths` | `ts-sql-query/dynamic/pick` |
| The **ordering** | `OrderByForModel<Row>` over the computed result row | `ts-sql-query/dynamic/orderBy` |

All of these are also re-exported from the root `ts-sql-query`. Each section below is a complete, self-contained function you can copy.

Use this approach when the columns are the natural source of truth and you don't mind the column types appearing in your signatures. When you want to keep value-source types out of your public API — and type everything against a plain business interface instead — use the [model-first](from-business-model.md) variant.

## Filtering: `DynamicCondition`

Derive the [dynamic condition](utilities/conditions.md) filter type from the columns with `DynamicCondition<typeof availableFields>`. The caller passes a criteria object shaped after the fields; you forward it to `dynamicConditionFor(availableFields).withValues(...)`:

```ts
import { DynamicCondition } from "ts-sql-query" // or "ts-sql-query/dynamic/condition"

const availableFields = {
    id: tCustomer.id,
    name: tCustomer.name,
    birthday: tCustomer.birthday
}

// the filter type derived from the columns
type CustomerFilter = DynamicCondition<typeof availableFields>

async function filterCustomers(connection: DBConnection, filter: CustomerFilter) {
    const dynamicWhere = connection.dynamicConditionFor(availableFields).withValues(filter)

    return connection.selectFrom(tCustomer)
        .where(dynamicWhere)
        .select(availableFields)
        .executeSelectMany()
}

// every key and operator is checked against the columns
const result = filterCustomers(connection, {
    name: { containsInsensitive: 'ACME' },
    birthday: { greaterThan: new Date('1990-01-01') }
})
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        concat(first_name, ?, last_name) as name, 
        birthday as birthday 
    from customer 
    where 
            lower(concat(first_name, ?, last_name)) like concat('%', lower(?), '%') 
        and birthday > ?
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        concat(first_name, ?, last_name) as `name`, 
        birthday as birthday 
    from customer 
    where 
            lower(concat(first_name, ?, last_name)) like concat('%', lower(?), '%') 
        and birthday > ?
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name || :0 || last_name as "name", 
        birthday as "birthday" 
    from customer 
    where 
            lower(first_name || :1 || last_name) like lower('%' || :2 || '%') escape '\' 
        and birthday > :3
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name || $1 || last_name as name, 
        birthday as birthday 
    from customer 
    where 
            (first_name || $2 || last_name) ilike ('%' || $3 || '%') 
        and birthday > $4
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name || ?1 || last_name as name, 
        birthday as birthday 
    from customer 
    where 
            lower(first_name || ?2 || last_name) like lower('%' || ?3 || '%') escape '\' 
        and birthday > ?4
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name + @0 + last_name as name, 
        birthday as birthday 
    from customer 
    where 
            lower(first_name + @1 + last_name) like lower('%' + @2 + '%') 
        and birthday > @3
    ```

The parameters are: `[ ' ', ' ', 'ACME', '1990-01-01T00:00:00.000Z' ]` (on SQLite: `[ ' ', ' ', 'ACME', '1990-01-01' ]`)

To add custom rules, build an extension and pass its type as the second argument — `DynamicCondition<typeof availableFields, typeof extension>` — and the value as the second argument of `dynamicConditionFor(availableFields, extension)`. See the [Dynamic conditions API](../api/dynamic-conditions.md) for the extension mechanism.

## Picking columns: `DynamicPickPaths` + `PickValuesPath`

Let the caller choose **which columns** come back, typed against the field map's dotted paths. `DynamicPickPaths<typeof availableFields, 'id'>` is the set of pickable paths (with the always-included `id` excluded from the choices); `PickValuesPath<typeof availableFields, FIELDS | 'id'>` is the result type for a given selection; `dynamicPickPaths` selects them at runtime and `expandTypeFromDynamicPickPaths` re-types the rows to match:

```ts
import { dynamicPickPaths, expandTypeFromDynamicPickPaths, DynamicPickPaths, PickValuesPath } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"

const company = tCompany.forUseInLeftJoinAs('company')

const availableFields = {
    id: tCustomer.id,
    name: tCustomer.name,
    company: {
        id: company.id,
        name: company.name
    }
}

// the pickable paths (id is always included) and the result type for a selection
type CustomerFields = DynamicPickPaths<typeof availableFields, 'id'>
type CustomerInfo<FIELDS extends CustomerFields> = PickValuesPath<typeof availableFields, FIELDS | 'id'>

async function pickCustomerColumns<FIELDS extends CustomerFields>(connection: DBConnection, fields: FIELDS[]): Promise<CustomerInfo<FIELDS>[]> {
    // always include id; the optional left join is pruned when no company field is picked
    const selectedFields = dynamicPickPaths(availableFields, fields, ['id'])

    const customers = await connection.selectFrom(tCustomer)
        .optionalLeftOuterJoin(company).on(company.id.equals(tCustomer.companyId))
        .select(selectedFields)
        .executeSelectMany()

    return expandTypeFromDynamicPickPaths(availableFields, fields, customers, ['id'])
}

// 'name' | 'company.name' are valid paths; the result is typed PickValuesPath<…>
const result = pickCustomerColumns(connection, ['name', 'company.name'])
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        concat(customer.first_name, ?, customer.last_name) as name, 
        company.name as `company.name` 
    from customer 
    left outer join company as company on company.id = customer.company_id
    ```
=== "MySQL"
    ```mysql
    select 
        customer.id as id, 
        concat(customer.first_name, ?, customer.last_name) as `name`, 
        company.`name` as `company.name` 
    from customer 
    left outer join company as company on company.id = customer.company_id
    ```
=== "Oracle"
    ```oracle
    select 
        customer.id as "id", 
        customer.first_name || :0 || customer.last_name as "name", 
        company.name as "company.name" 
    from customer 
    left outer join company company on company.id = customer.company_id
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.id as id, 
        customer.first_name || $1 || customer.last_name as name, 
        company.name as "company.name" 
    from customer 
    left outer join company as company on company.id = customer.company_id
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.id as id, 
        customer.first_name || ?1 || customer.last_name as name, 
        company.name as "company.name" 
    from customer 
    left outer join company as company on company.id = customer.company_id
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        customer.first_name + @0 + customer.last_name as name, 
        company.name as [company.name] 
    from customer 
    left outer join company as company on company.id = customer.company_id
    ```

The parameters are: `[ ' ' ]`

`PickValuesPath` keeps the optional properties optional and narrows nested objects to the picked paths. The `…WithAllProperties` and `…ProjectedAsNullable` variants are described on the [Dynamic picks](utilities/picks.md) utility page.

## Ordering: `OrderByForModel` over the result row

There is no column-derived order-by type; instead, compute the **result row** type from the columns and type the order-by against it with `OrderByForModel<Row>`:

```ts
import type { OrderByForModel } from "ts-sql-query" // or "ts-sql-query/dynamic/orderBy"
import type { DynamicPickPaths, PickValuesPath } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"

const availableFields = {
    id: tCustomer.id,
    name: tCustomer.name,
    birthday: tCustomer.birthday
}

// the full result row, used to constrain the order-by to the orderable columns
type CustomerRow = PickValuesPath<typeof availableFields, DynamicPickPaths<typeof availableFields>>

async function sortCustomers(connection: DBConnection, orderBy: OrderByForModel<CustomerRow>[]) {
    return connection.selectFrom(tCustomer)
        .select(availableFields)
        .orderByFromStringArrayIfValue(orderBy)
        .executeSelectMany()
}

// each clause is constrained to the row's leaves and the valid ordering modes
const result = sortCustomers(connection, ['name asc', 'birthday desc nulls last'])
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        concat(first_name, ?, last_name) as name, 
        birthday as birthday 
    from customer 
    order by 
        name asc, 
        birthday desc
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        concat(first_name, ?, last_name) as `name`, 
        birthday as birthday 
    from customer 
    order by 
        `name` asc, 
        birthday desc
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        first_name || :0 || last_name as "name", 
        birthday as "birthday" 
    from customer 
    order by 
        "name" asc, 
        "birthday" desc nulls last
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        first_name || $1 || last_name as name, 
        birthday as birthday 
    from customer 
    order by 
        name asc, 
        birthday desc nulls last
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        first_name || ?1 || last_name as name, 
        birthday as birthday 
    from customer 
    order by 
        name asc, 
        birthday desc nulls last
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        first_name + @0 + last_name as name, 
        birthday as birthday 
    from customer 
    order by 
        name asc, 
        birthday desc
    ```

The parameters are: `[ ' ' ]`

`orderByFromString(...)` / `orderByFromStringArray(...)` keep taking a plain `string` / `string[]`, so the `OrderByForModel` typing is opt-in.

## Putting it all together

A single function whose picked `fields`, `filter`, `orderBy` and returned rows are all derived from one `availableFields` column map, combining the three families:

```ts
import { dynamicPickPaths, expandTypeFromDynamicPickPaths, DynamicPickPaths, PickValuesPath } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"
import { DynamicCondition } from "ts-sql-query" // or "ts-sql-query/dynamic/condition"
import type { OrderByForModel } from "ts-sql-query" // or "ts-sql-query/dynamic/orderBy"

const company = tCompany.forUseInLeftJoinAs('company')

const availableFields = {
    id: tCustomer.id,
    name: tCustomer.name,
    birthday: tCustomer.birthday,
    company: {
        id: company.id,
        name: company.name
    }
}

type CustomerFields = DynamicPickPaths<typeof availableFields, 'id'>
type CustomerInfo<FIELDS extends CustomerFields> = PickValuesPath<typeof availableFields, FIELDS | 'id'>
type CustomerFilter = DynamicCondition<typeof availableFields>

async function listCustomerDirectory<FIELDS extends CustomerFields>(
    connection: DBConnection,
    fields: FIELDS[],
    filter: CustomerFilter,
    orderBy?: OrderByForModel<CustomerInfo<CustomerFields>>[]
): Promise<CustomerInfo<FIELDS>[]> {
    const dynamicWhere = connection.dynamicConditionFor(availableFields).withValues(filter)
    const selectedFields = dynamicPickPaths(availableFields, fields, ['id'])

    const customers = await connection.selectFrom(tCustomer)
        .optionalLeftOuterJoin(company).on(company.id.equals(tCustomer.companyId))
        .where(dynamicWhere)
        .select(selectedFields)
        .orderByFromStringArrayIfValue(orderBy)
        .executeSelectMany()

    return expandTypeFromDynamicPickPaths(availableFields, fields, customers, ['id'])
}

// fields, filter and orderBy are all validated against the column map
const result = listCustomerDirectory(connection, ['name', 'company.name'],
    { name: { containsInsensitive: 'ACME' }, company: { name: { equals: 'ACME Corp' } } },
    ['company.name asc nulls last', 'name desc'])
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        customer.id as id, 
        concat(customer.first_name, ?, customer.last_name) as name, 
        company.name as `company.name` 
    from customer 
    left outer join company as company on company.id = customer.company_id 
    where 
            lower(concat(customer.first_name, ?, customer.last_name)) like concat('%', lower(?), '%') 
        and company.name = ? 
    order by 
        company.name is null, 
        `company.name` asc, 
        name desc
    ```
=== "MySQL"
    ```mysql
    select 
        customer.id as id, 
        concat(customer.first_name, ?, customer.last_name) as `name`, 
        company.`name` as `company.name` 
    from customer 
    left outer join company as company on company.id = customer.company_id 
    where 
            lower(concat(customer.first_name, ?, customer.last_name)) like concat('%', lower(?), '%') 
        and company.`name` = ? 
    order by 
        company.`name` is null, 
        `company.name` asc, 
        `name` desc
    ```
=== "Oracle"
    ```oracle
    select 
        customer.id as "id", 
        customer.first_name || :0 || customer.last_name as "name", 
        company.name as "company.name" 
    from customer 
    left outer join company company on company.id = customer.company_id 
    where 
            lower(customer.first_name || :1 || customer.last_name) like lower('%' || :2 || '%') escape '\' 
        and company.name = :3 
    order by 
        "company.name" asc nulls last, 
        "name" desc
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        customer.id as id, 
        customer.first_name || $1 || customer.last_name as name, 
        company.name as "company.name" 
    from customer 
    left outer join company as company on company.id = customer.company_id 
    where 
            (customer.first_name || $2 || customer.last_name) ilike ('%' || $3 || '%') 
        and company.name = $4 
    order by 
        "company.name" asc nulls last, 
        name desc
    ```
=== "SQLite"
    ```sqlite
    select 
        customer.id as id, 
        customer.first_name || ?1 || customer.last_name as name, 
        company.name as "company.name" 
    from customer 
    left outer join company as company on company.id = customer.company_id 
    where 
            lower(customer.first_name || ?2 || customer.last_name) like lower('%' || ?3 || '%') escape '\' 
        and company.name = ?4 
    order by 
        "company.name" asc nulls last, 
        name desc
    ```
=== "SQL Server"
    ```sqlserver
    select 
        customer.id as id, 
        customer.first_name + @0 + customer.last_name as name, 
        company.name as [company.name] 
    from customer 
    left outer join company as company on company.id = customer.company_id 
    where 
            lower(customer.first_name + @1 + customer.last_name) like lower('%' + @2 + '%') 
        and company.name = @3 
    order by 
        iif(company.name is null, 1, 0), 
        [company.name] asc, 
        name desc
    ```

The parameters are: `[ ' ', ' ', 'ACME', 'ACME Corp' ]`

The same end-to-end function — including a custom-rule extension and an optional join built through a reusable `buildAvailableFields` helper — is shown in full in [Extreme dynamic queries — From the database](dynamic-select-functions.md#from-the-database), next to its model-first twin.

## See also

- [Typing dynamic queries from a business model](from-business-model.md) — the model-first counterpart of this page.
- [Dynamic conditions](utilities/conditions.md), [Dynamic picks](utilities/picks.md) and [Dynamic order by](utilities/order-by.md) — the per-module utility reference.
- [Functions that return a dynamic select](dynamic-select-functions.md) — both approaches side by side in one worked example.
