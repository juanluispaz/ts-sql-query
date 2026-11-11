---
search:
  boost: 0.61
---
# Deep utilities

These are the versions for nested objects of the built-in `Pick<Type, Keys>`, `Omit<Type, Keys>` and `keyof Type`: they work with **dotted paths**, like `'company.name'`, instead of top-level keys. They are exported from `ts-sql-query`.

You use them when you work with a nested plain object. In this library, the usual case is typing a function that makes a [dynamic pick](../dynamic/helper-types/picks.md) from your own nested business model, without a cast, but they work on any plain object.

| Built-in (flat) | Deep analogue (dotted paths) |
|-----------------|------------------------------|
| `keyof Type`    | `DeepPickPaths<Type>`        |
| `Pick<Type, Keys>` | `DeepPick<Type, Paths>`   |
| `Omit<Type, Keys>` | `DeepOmit<Type, Paths>`   |
| —               | `deepPick(obj, paths)` (runtime) |
| —               | `deepOmit(obj, paths)` (runtime) |

A path can name a whole object (`'company'`), which is kept or dropped as it is, or a property inside it (`'company.name'`), which narrows the inner object. A property that was optional stays optional, as with `Pick` and `Omit`.

## Types

### DeepPickPaths

**Type**: `DeepPickPaths<Model>`

The union of every valid path of `Model`, like `keyof Model` for nested objects. For a nested object it has the path of the whole object and the path of each property inside it.

```ts
import type { DeepPickPaths } from 'ts-sql-query'

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

`Model` with only the selected `Paths`, like `Pick<Model, Keys>` for nested objects.

```ts
import type { DeepPick } from 'ts-sql-query'

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

`Model` without the selected `Paths`, like `Omit<Model, Keys>` for nested objects. Omitting a whole object (`'company'`) drops it; omitting a property inside it (`'company.id'`) keeps the object without that property.

```ts
import type { DeepOmit } from 'ts-sql-query'

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

Returns a new object with only the properties of `obj` selected by `paths`. Its type is `DeepPick`.

The objects on the way to a property are created as needed. If one of them is `null`, the `null` is kept, and if it's `undefined` or absent, that path is skipped.

```ts
import { deepPick } from 'ts-sql-query'

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

To always include some paths, whatever the caller selects, add them to the array yourself: `deepPick(obj, ['id', ...fields])`. Unlike [`dynamicPickPaths`](../dynamic/helper-types/picks.md#dynamicpickpaths), `deepPick` has no `alwaysIncluded` argument.

### deepOmit

**Function**: `deepOmit(obj, paths)`

Returns a copy of `obj` without the properties selected by `paths`. Its type is `DeepOmit`. Omitting a path inside an object copies that object, so `obj` doesn't change. The values no path touches are the same ones, not copies.

```ts
import { deepOmit } from 'ts-sql-query'

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

Some built-in objects are a single value, so paths don't go inside them: dates, binary buffers (`Uint8Array`, `ArrayBuffer`, ...), `Map`, `Set` and their weak versions, arrays, regular expressions, promises and functions. A `birthday` property of type `Date` is the path `'birthday'`, never `'birthday.year'`.

A **plain custom object** can't be told apart from a nested object by its type, for example a column whose value is a JSON object typed as `{ ... }`. `DeepPickPaths` gives paths for its properties too. Either pick it whole, or type that property in your model with something that isn't a plain object.

## Relationship with dynamic picks

When the fields a caller picks are top-level keys, the built-in `Pick` and `keyof` are enough. When they are inside nested objects, use `DeepPick` and `DeepPickPaths`.

A generic function that returns `DeepPick<ResultModel, FIELDS>` is assignable to `DeepPick<BusinessModel, FIELDS>` when the models match, which lets a function typed from your own interface return its result without a cast. See [Picking columns](../dynamic/own-function/from-business-model.md#picking-columns-dynamicpickpaths-deeppick) for a complete example that passes a `dynamicPickPaths(...)` selection through `expandTypeFromDynamicPickPaths(...)` and returns a value typed as `DeepPick<Model, FIELDS | 'id'>`.
