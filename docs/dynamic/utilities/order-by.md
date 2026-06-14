---
search:
  boost: 0.7
---
# Dynamic order by

The `ts-sql-query/dynamic/orderBy` module (also re-exported from the root `ts-sql-query`) holds the types for typing a dynamic order-by against a business model. Ordering is not a condition, so it ships in its own module. It exports two types:

| Type | Purpose |
|---|---|
| `OrderByForModel<Model>` | A single order-by clause typed against a model's orderable leaves. |
| `OrderByMode` | The union of valid ordering modes (`'asc'`, `'desc'`, `'asc nulls last'`, `'insensitive'`, …). |

These only type the **value** you build — `orderByFromString(...)` and `orderByFromStringArray(...)` keep taking a plain `string` / `string[]`, so the typing is fully opt-in. For the narrative, model-first walkthrough, see [Typing dynamic queries from a business model](../from-business-model.md).

## OrderByForModel

`OrderByForModel<Model>` is a **single** order-by clause: a model field path optionally followed by an ordering mode. Mirroring `orderByFromString`'s runtime, the orderable targets are the model's scalar **leaves**, addressed by their dotted path — so in a complex projection `'customer.name'` is orderable, while `'customer'` (the object itself) is not, and array fields (aggregated arrays) are excluded.

```ts
import type { OrderByForModel } from "ts-sql-query" // or "ts-sql-query/dynamic/orderBy"

interface Invoice {
    id: number
    total: number
    issuedAt: Date
    customer?: {
        id: number
        name: string
    }
}

// 'id' | 'total' | 'issuedAt' | 'customer.name' | 'total asc' | 'issuedAt desc nulls last' | …
type InvoiceOrder = OrderByForModel<Invoice>
```

For a **multi-column** order-by, type the value as an array of clauses — `OrderByForModel<Model>[]` — and feed it to `orderByFromStringArray(...)` (or `orderByFromStringArrayIfValue(...)` when entries may be `null` / `undefined` / empty). Each element is one clause; the builder joins them, so the value stays fully typed end to end with no manual `.join`:

```ts
import type { OrderByForModel } from "ts-sql-query" // or "ts-sql-query/dynamic/orderBy"

interface Invoice {
    id: number
    total: number
    issuedAt: Date
    customer?: {
        id: number
        name: string
    }
}

// each clause is validated against the model's orderable leaves and modes;
// pass the array to orderByFromStringArray(...) / orderByFromStringArrayIfValue(...)
const orderBy: OrderByForModel<Invoice>[] = ['customer.name asc nulls last', 'issuedAt desc']
```

See [Ordering](../from-business-model.md#ordering-orderbyformodel) on the model-first guide for a complete `select(...).orderByFromStringArrayIfValue(orderBy)` function.

## OrderByMode

`OrderByMode` is the union of every valid ordering mode that `OrderByForModel` appends to a field path — the same modes accepted by the `orderBy(column, mode)` method and by `orderByFromString(...)`: `'asc'`, `'desc'`, the `nulls first` / `nulls last` variants, `'insensitive'`, and the insensitive combinations. Use it when you want to reference the mode set on its own (e.g. to type a separate `mode` argument):

```ts
import type { OrderByMode } from "ts-sql-query" // or "ts-sql-query/dynamic/orderBy"

// 'asc' | 'desc' | 'asc nulls first' | 'asc nulls last' | 'insensitive' | …
const mode: OrderByMode = 'desc nulls last'
```

The mode is applied to the SQL ordering exactly as documented for [`orderBy`](../../api/select.md) and [`orderByFromString`](../../queries/select.md).

## See also

- [Typing dynamic queries from a business model](../from-business-model.md) — the model-first guide.
- [Select API → orderBy](../../api/select.md) — the runtime ordering methods and modes.
