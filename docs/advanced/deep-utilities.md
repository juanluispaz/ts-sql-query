---
search:
  boost: 0.61
---
# Deep utilities

The `ts-sql-query/extras/deepUtilities` module (also re-exported from the root `ts-sql-query`) provides the **deep (nested) analogues** of the built-in `Pick<Type, Keys>`, `Omit<Type, Keys>` and `keyof Type`, working over **dotted paths** (`'company.name'`) instead of top-level keys.

They are useful whenever you manipulate a nested plain object — most notably to type a generic [dynamic pick](../dynamic/utilities/picks.md) helper against your own nested business model without a cast, but they are general-purpose utilities you can use on any plain object.

| Built-in (flat) | Deep analogue (dotted paths) |
|-----------------|------------------------------|
| `keyof Type`    | `DeepPickPaths<Type>`        |
| `Pick<Type, Keys>` | `DeepPick<Type, Paths>`   |
| `Omit<Type, Keys>` | `DeepOmit<Type, Paths>`   |
| —               | `deepPick(obj, paths)` (runtime) |
| —               | `deepOmit(obj, paths)` (runtime) |

All of them treat a path like `'company.name'` as a descent into nested objects: selecting a whole object (`'company'`) keeps or drops it intact, while selecting a leaf (`'company.name'`) narrows the inner object. Top-level optionality of the model is always preserved, exactly like `Pick` / `Omit`.

## Types

### DeepPickPaths

**Type**: `DeepPickPaths<Model>`

The union of every legal dotted path of `Model` — the deep analogue of `keyof Model`. For a model with a nested object it yields both the whole-object path and each leaf path.

```ts
import type { DeepPickPaths } from 'ts-sql-query' // or 'ts-sql-query/extras/deepUtilities';

interface CustomerWithCompany {
    id: number;
    firstName: string;
    lastName: string;
    company?: {
        id: number;
        name: string;
    };
}

// Alias to: 'id' | 'firstName' | 'lastName' | 'company' | 'company.id' | 'company.name'
type CustomerPaths = DeepPickPaths<CustomerWithCompany>;
```

### DeepPick

**Type**: `DeepPick<Model, Paths>`

The nested shape of `Model` keeping only the selected dotted `Paths` — the deep analogue of `Pick<Model, Keys>`. Selecting a whole object keeps it intact; selecting a leaf narrows the inner object. Top-level optionality is preserved, exactly like `Pick`.

```ts
import type { DeepPick } from 'ts-sql-query' // or 'ts-sql-query/extras/deepUtilities';

interface CustomerWithCompany {
    id: number;
    firstName: string;
    lastName: string;
    company?: {
        id: number;
        name: string;
    };
}

// Alias to: { firstName: string; company?: { name: string } }
type PickedCustomer = DeepPick<CustomerWithCompany, 'firstName' | 'company.name'>;
```

### DeepOmit

**Type**: `DeepOmit<Model, Paths>`

The nested shape of `Model` with the selected dotted `Paths` removed — the deep analogue of `Omit<Model, Keys>`. Omitting a whole object (`'company'`) drops it entirely; omitting a leaf (`'company.id'`) keeps the inner object and removes only that property. Top-level optionality is preserved, exactly like `Omit`.

```ts
import type { DeepOmit } from 'ts-sql-query' // or 'ts-sql-query/extras/deepUtilities';

interface CustomerWithCompany {
    id: number;
    firstName: string;
    lastName: string;
    company?: {
        id: number;
        name: string;
    };
}

// Alias to: { id: number; firstName: string; company?: { name: string } }
type TrimmedCustomer = DeepOmit<CustomerWithCompany, 'lastName' | 'company.id'>;
```

## Runtime functions

### deepPick

**Function**: `deepPick(obj, paths)`

Returns a new object keeping only the properties of `obj` selected by `paths` (dotted paths into nested objects). It is the runtime companion of the `DeepPick` type — the deep analogue of how [`dynamicPickPaths`](../dynamic/utilities/picks.md#dynamicpickpaths) relates to `PickValuesPath`.

Intermediate objects are created as needed; a path whose intermediate value is `null`/`undefined` is skipped.

```ts
import { deepPick } from 'ts-sql-query' // or 'ts-sql-query/extras/deepUtilities';

const customer = {
    id: 1,
    firstName: 'John',
    lastName: 'Doe',
    company: { id: 7, name: 'Acme', plan: 'pro' },
};

// keep only id, firstName and company.name
const picked = deepPick(customer, ['id', 'firstName', 'company.name']);
// picked: { id: number; firstName: string; company: { name: string } }
```

!!! note "Forcing fields into a dynamic selection"

    Unlike [`dynamicPickPaths`](../dynamic/utilities/picks.md#dynamicpickpaths), `deepPick` has no `alwaysIncluded` argument: it is a plain `Pick` analogue. When you need some paths always present regardless of a caller-provided selection, add them to the `paths` array yourself (e.g. `deepPick(obj, ['id', ...fields])`). The mandatory-field ergonomics live in the dynamic-query helpers (`dynamicPickPaths` / `expandTypeFromDynamicPickPaths`).

### deepOmit

**Function**: `deepOmit(obj, paths)`

Returns a shallow copy of `obj` with the properties selected by `paths` removed — the runtime companion of the `DeepOmit` type. Omitting a bare key drops it whole; omitting a dotted path keeps the intermediate object (copied, never mutated) and removes only the leaf. Values not touched by any path are copied by reference.

```ts
import { deepOmit } from 'ts-sql-query' // or 'ts-sql-query/extras/deepUtilities';

const customer = {
    id: 1,
    firstName: 'John',
    lastName: 'Doe',
    company: { id: 7, name: 'Acme', plan: 'pro' },
};

// drop lastName entirely and the id inside company
const trimmed = deepOmit(customer, ['lastName', 'company.id']);
// trimmed: { id: number; firstName: string; company: { name: string; plan: string } }
```

## Terminal object values

`DeepPick` / `DeepPickPaths` (and their omit counterparts) treat the built-in object types that represent a single terminal value as **leaves** — they are **not** descended into: dates, binary buffers (`Uint8Array`, `ArrayBuffer`, …), `Map`/`Set`, arrays, regular expressions and functions. So a `birthday` field typed as a date is the path `'birthday'`, never `'birthday.year'`.

The one shape that cannot be detected at the type level is a **plain custom object value** — for example a column whose value is a JSON object typed as `{ … }`. It is indistinguishable from a nested projection, so `DeepPickPaths` descends into it and produces dotted sub-paths for its members (this is a limitation shared by every structural deep-pick type). If you have such a column, type that property in your business model as a terminal value your code treats as opaque (or pick it whole), so it is not mistaken for a nested projection.

## Relationship with dynamic picks

These utilities are the recommended way to type a generic dynamic-pick helper against your **own nested business model**. When the picked fields are top-level keys, the built-in `Pick` / `keyof` are enough; when you pick fields inside nested objects through dotted paths, use `DeepPick` / `DeepPickPaths` instead.

See [Utility for dynamic picks → Creating definitions based on your nested business types](../dynamic/utilities/picks.md#creating-definitions-based-on-your-nested-business-types) for a complete example that pipes a `dynamicPickPaths(...)` selection through `expandTypeFromDynamicPickPaths(...)` and returns a value typed as `DeepPick<Model, FIELDS | 'id'>` without a cast.

!!! note "Why a plain path-driven type"

    `DeepPick` is intentionally a plain path-driven recursive mapped type. That shape stays covariant in its first type argument over a generic path union, which is what lets a generic helper returning `DeepPick<ResultModel, FIELDS>` be assignable to a caller's hand-written `DeepPick<BusinessModel, FIELDS>`. More elaborate community deep-pick types (built on `UnionToIntersection` / deep-simplify helpers) lose that covariance and cannot be used this way.
