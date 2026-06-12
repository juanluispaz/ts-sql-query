---
search:
  boost: 0.5
---
# Dynamic conditions

The `ts-sql-query/dynamic/condition` module (also re-exported from the root `ts-sql-query`) holds the types for building [dynamic conditions](../../api/dynamic-conditions.md) — runtime-defined filters consumed by `dynamicConditionFor(...).withValues(...)`. It exports three types:

| Type | Purpose |
|---|---|
| `DynamicCondition<Definition, Extension?>` | The filter type built from a descriptor map or a value-source map. |
| `DynamicConditionForModel<Model, Extension?>` | Derive the filter type from a plain **business model** instead of a descriptor map. |
| `DynamicDefinitionForModel<Model>` | The descriptor map `DynamicConditionForModel` builds on, exposed on its own for composition. |

For the narrative, model-first walkthrough that uses these together with the pick and order-by helpers, see [Typing dynamic queries from a business model](../from-business-model.md).

## DynamicCondition

`DynamicCondition<Definition, Extension?>` is the core filter type. Its `Definition` is either a descriptor map (`{ myInt: 'int', myString: 'string', … }`) or the value-source map you select (`typeof selectFields`), and the optional `Extension` adds your own custom rules. The produced type is the object you pass to `dynamicConditionFor(...).withValues(...)`.

The full reference — every descriptor name, the `EqualableFilter` / `ComparableFilter` / `StringFilter` shapes, the `and` / `or` / `not` logical combinators and the custom-rule extension mechanism — lives in the [Dynamic conditions API](../../api/dynamic-conditions.md) page.

## DynamicConditionForModel

`DynamicConditionForModel<Model, Extension?>` derives the filter type from a plain business model, so the model stays the single source of truth and no value-source type leaks into your public signatures. It is exactly `DynamicCondition<DynamicDefinitionForModel<Model>, Extension>`, so the produced filter is interchangeable with — and emits identical SQL to — the descriptor form.

Each property's TypeScript type is mapped to the matching filter:

| Model property type | Filter |
|---|---|
| `boolean` | `EqualableFilter<boolean>` |
| `number` | `ComparableFilter<number>` |
| `bigint` | `ComparableFilter<bigint>` |
| `string` | `StringFilter` |
| `Date` | `ComparableFilter<Date>` |
| string/number **literal union** | `EqualableFilter<…>` (treated as an enum) |
| nested **object** | recurses into a nested filter |

```ts
import { DynamicConditionForModel, DynamicDefinitionForModel } from "ts-sql-query" // or "ts-sql-query/dynamic/condition"

interface Customer {
    id: number
    name: string
    birthday: Date
    vip: boolean
    status: 'active' | 'inactive'
    company?: {
        id: number
        name: string
    }
}

// the filter type derived from the model
type CustomerFilter = DynamicConditionForModel<Customer>

// the descriptor map it builds on
type CustomerDefinition = DynamicDefinitionForModel<Customer>

// a criteria object, fully checked against the model
const filter: CustomerFilter = {
    name: { containsInsensitive: 'ACME' },
    vip: { equals: true },
    status: { in: ['active'] },
    birthday: { greaterThan: new Date('1990-01-01') },
    company: { name: { equals: 'ACME Corp' } }
}
```

!!! note "Limitations"

    Columns backed by a custom-typed adapter (e.g. a branded `customComparable`, a custom uuid) cannot be told apart from their base TypeScript type when mapping from the model, so they map to the base filter. Non-filterable object values (arrays, `Map`/`Set`, binary buffers) are not mapped. For those fields, fall back to the descriptor map. Custom condition rules are inherently database-level — keep them by passing your extension as the second argument: `DynamicConditionForModel<Model, Extension>`.

## DynamicDefinitionForModel

`DynamicDefinitionForModel<Model>` is the descriptor map produced from the model — the same shape `DynamicCondition` already understands (`number → 'int'`, `bigint → 'bigint'`, `string → 'string'`, `Date → 'localDateTime'`, a literal union → `['enum', …]`, a nested object → a nested definition). It is exposed on its own so you can **compose** it with hand-written descriptor fields:

```ts
import { DynamicCondition, DynamicDefinitionForModel } from "ts-sql-query" // or "ts-sql-query/dynamic/condition"

interface Customer {
    id: number
    name: string
    company?: {
        id: number
        name: string
    }
}

// compose the model-derived descriptor with hand-written descriptor fields
type AuditedFilter = DynamicCondition<DynamicDefinitionForModel<Customer> & { auditedAt: 'localDateTime' }>
```

## See also

- [Typing dynamic queries from a business model](../from-business-model.md) — the model-first guide.
- [Dynamic conditions API](../../api/dynamic-conditions.md) — the full `DynamicCondition` reference.
- [Select using a dynamic filter](../../queries/extreme-dynamic-queries.md#select-using-a-dynamic-filter) — a worked end-to-end example.
