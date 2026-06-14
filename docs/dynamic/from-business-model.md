---
search:
  boost: 1.5
---
# Typing dynamic queries from a business model

The dynamic-query helpers (`dynamicConditionFor`, `dynamicPick` / `dynamicPickPaths`, `orderByFromString…`) are normally typed from the **available columns** — the value-source map you build inside the query. That keeps the query layer as the source of truth, but it leaks column types into your public signatures.

This page is the **model-first** recipe book: derive the filter, the picked columns and the order-by from a plain **business model interface**, so the model stays the single source of truth and no value-source type appears in the surface your callers see. Each section below is a complete, self-contained function you can copy. For the **database-first** alternative — deriving the same helpers from the column map instead of a model — see [Typing dynamic queries from the database types](from-database-types.md).

| What the caller controls | Helper to type it | Module |
|---|---|---|
| The **filter** (a criteria object) | `DynamicConditionForModel<Model>` | `ts-sql-query/dynamic/condition` |
| The **columns** returned | `dynamicPickPaths` + `DeepPickPaths` / `DeepPick` + `expandTypeFromDynamicPickPaths` | `ts-sql-query/dynamic/pick` (+ `ts-sql-query/extras/deepUtilities`) |
| The **ordering** | `OrderByForModel<Model>` + `orderByFromStringArray` | `ts-sql-query/dynamic/orderBy` |

All of these are also re-exported from the root `ts-sql-query`. The runtime entry point is always `connection.dynamicConditionFor(...)`, `dynamicPickPaths(...)` and `orderByFromString…(...)`; the model-first types only constrain the **values** you build, so adopting them is opt-in and never changes the emitted SQL.

In every example, the function body still builds an internal map of value sources (`availableFields`) — the database layer is unavoidable to emit the SQL — but its **public signature** references only the business model, so no column type leaks out.

## Filtering: `DynamicConditionForModel`

Derive the [dynamic condition](utilities/conditions.md) filter type from the model. The caller passes a criteria object shaped after the model; you forward it to `dynamicConditionFor(availableFields).withValues(...)`:

```ts
import { DynamicConditionForModel } from "ts-sql-query" // or "ts-sql-query/dynamic/condition"

interface CustomerFilterRow {
    id: number
    name: string
    birthday?: Date
}

async function filterCustomers(connection: DBConnection, filter: DynamicConditionForModel<CustomerFilterRow>): Promise<CustomerFilterRow[]> {
    const availableFields = {
        id: tCustomer.id,
        name: tCustomer.name,
        birthday: tCustomer.birthday
    }

    const dynamicWhere = connection.dynamicConditionFor(availableFields).withValues(filter)

    return connection.selectFrom(tCustomer)
        .where(dynamicWhere)
        .select(availableFields)
        .executeSelectMany()
}

// Every key and operator is checked against the model:
const result = filterCustomers(connection, {
    name: { containsInsensitive: 'ACME' },
    birthday: { greaterThan: new Date('1990-01-01') }
})
```

Each model property maps to a filter: `boolean` → `EqualableFilter<boolean>`, `number` → `ComparableFilter<number>`, `bigint` → `ComparableFilter<bigint>`, `string` → `StringFilter`, `Date` → `ComparableFilter<Date>`, a string/number **literal union** → `EqualableFilter<…>` (an enum), and a **nested object** recurses. See the [Dynamic conditions](utilities/conditions.md) utility page for the full reference, and the *[Limitations](#limitations)* below.

## Picking columns: `dynamicPickPaths` + `DeepPick`

Let the caller choose **which columns** come back, typed against the model's dotted paths. `DeepPickPaths<Model>` is the set of pickable paths; `DeepPick<Model, FIELDS>` is the narrowed result; `dynamicPickPaths` selects them at runtime and `expandTypeFromDynamicPickPaths` re-types the rows so they match `DeepPick` without a cast:

```ts
import { dynamicPickPaths, expandTypeFromDynamicPickPaths } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"
import type { DeepPick, DeepPickPaths } from "ts-sql-query" // or "ts-sql-query/extras/deepUtilities"

interface CustomerPickRow {
    id: number
    name: string
    company?: {
        id: number
        name: string
    }
}

async function pickCustomerColumns<FIELDS extends DeepPickPaths<CustomerPickRow>>(connection: DBConnection, fields: FIELDS[]): Promise<DeepPick<CustomerPickRow, FIELDS | 'id'>[]> {
    const company = tCompany.forUseInLeftJoinAs('company')

    const availableFields = {
        id: tCustomer.id,
        name: tCustomer.name,
        company: {
            id: company.id,
            name: company.name
        }
    }

    // always include id; the optional left join is pruned when no company field is picked
    const selectedFields = dynamicPickPaths(availableFields, fields, ['id'])

    const customers = await connection.selectFrom(tCustomer)
        .optionalLeftOuterJoin(company).on(company.id.equals(tCustomer.companyId))
        .select(selectedFields)
        .executeSelectMany()

    return expandTypeFromDynamicPickPaths(availableFields, fields, customers, ['id'])
}

// 'name' | 'company.name' are valid paths; the result is typed DeepPick<CustomerPickRow, ...>
const result = pickCustomerColumns(connection, ['name', 'company.name'])
```

Use the built-in `Pick<Model, K>` when the picked fields are **top-level** keys, and `DeepPick<Model, PATHS>` when you pick fields inside nested objects through dotted paths. `DeepPick` / `DeepPickPaths` (and their `Omit` counterparts) are documented in full on the [Deep utilities](../advanced/deep-utilities.md) page; the pick functions on the [Dynamic picks](utilities/picks.md) page.

## Ordering: `OrderByForModel`

Type the order-by value against the model's orderable leaves. `OrderByForModel<Model>` is a **single** clause (a field path optionally followed by a mode); a multi-column order-by is an `OrderByForModel<Model>[]` fed to `orderByFromStringArray(...)` (or `…IfValue` when entries may be absent):

```ts
import type { OrderByForModel } from "ts-sql-query" // or "ts-sql-query/dynamic/orderBy"

interface CustomerSortRow {
    id: number
    name: string
    birthday?: Date
}

async function sortCustomers(connection: DBConnection, orderBy: OrderByForModel<CustomerSortRow>[]): Promise<CustomerSortRow[]> {
    const availableFields = {
        id: tCustomer.id,
        name: tCustomer.name,
        birthday: tCustomer.birthday
    }

    return connection.selectFrom(tCustomer)
        .select(availableFields)
        .orderByFromStringArrayIfValue(orderBy)
        .executeSelectMany()
}

// each clause is constrained to the model's leaves and the valid ordering modes
const result = sortCustomers(connection, ['name asc', 'birthday desc nulls last'])
```

The orderable targets are the model's scalar **leaves**, addressed by their dotted path — so in a complex projection `'company.name'` is orderable, while `'company'` (the object itself) is not, and array fields are excluded. The modes union is exported as `OrderByMode`; see the [Dynamic order by](utilities/order-by.md) utility page.

## Putting it all together

A single function whose **entire public surface** — picked `fields`, `filter`, `orderBy` and the returned rows — is derived from one business model, combining the three families:

```ts
import { dynamicPickPaths, expandTypeFromDynamicPickPaths } from "ts-sql-query" // or "ts-sql-query/dynamic/pick"
import { DynamicConditionForModel } from "ts-sql-query" // or "ts-sql-query/dynamic/condition"
import type { OrderByForModel } from "ts-sql-query" // or "ts-sql-query/dynamic/orderBy"
import type { DeepPick, DeepPickPaths } from "ts-sql-query" // or "ts-sql-query/extras/deepUtilities"

interface CustomerDirectoryRow {
    id: number
    name: string
    birthday?: Date
    company?: {
        id: number
        name: string
    }
}

async function listCustomerDirectory<FIELDS extends DeepPickPaths<CustomerDirectoryRow>>(
    connection: DBConnection,
    fields: FIELDS[],
    filter: DynamicConditionForModel<CustomerDirectoryRow>,
    orderBy?: OrderByForModel<CustomerDirectoryRow>[]
): Promise<DeepPick<CustomerDirectoryRow, FIELDS | 'id'>[]> {
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

// fields, filter and orderBy are all validated against CustomerDirectoryRow
const result = listCustomerDirectory(connection, ['name', 'company.name'],
    { name: { containsInsensitive: 'ACME' }, company: { name: { equals: 'ACME Corp' } } },
    ['company.name asc nulls last', 'name desc'])
```

This is the same end-to-end function shown, side by side with its database-first twin, in [Extreme dynamic queries — From the model](../queries/extreme-dynamic-queries.md#from-the-model).

## Limitations

Columns backed by a custom-typed adapter (e.g. a branded `customComparable`, a custom uuid) cannot be told apart from their base TypeScript type when mapping from the model, so they map to the base filter. Non-filterable object values (arrays, `Map`/`Set`, binary buffers) are not mapped. For those fields, fall back to the descriptor map (which spells the type out explicitly).

Arbitrary custom condition rules (the extension passed as the second argument of `dynamicConditionFor`) are inherently database-level. To keep them, build the extension as usual and pass it as the second type argument: `DynamicConditionForModel<Model, Extension>` — and to `dynamicConditionFor(availableFields, extension)`.

## See also

- [Dynamic conditions](utilities/conditions.md), [Dynamic picks](utilities/picks.md) and [Dynamic order by](utilities/order-by.md) — the per-module utility reference for each exported `ts-sql-query/dynamic/*` module.
- [Dynamic conditions API](../api/dynamic-conditions.md) — the underlying `DynamicCondition` type and the descriptor-map form `DynamicConditionForModel` builds on.
- [Deep utilities](../advanced/deep-utilities.md) — the model-first dynamic **pick** counterpart (`DeepPickPaths` / `DeepPick`).
- [Extreme dynamic queries — From the model](../queries/extreme-dynamic-queries.md#from-the-model) — the same end-to-end function next to its database-first twin.
