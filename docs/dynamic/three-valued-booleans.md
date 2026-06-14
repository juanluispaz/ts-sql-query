---
search:
  boost: 1.5
---
# Booleans and three-valued logic

In SQL a boolean is **three-valued**: it can be `true`, `false` or `null`. TypeScript/JavaScript booleans, in contrast, are **two-valued** (`true` / `false`).

`ts-sql-query` deliberately keeps these two worlds apart, and the distinction matters most when a value comes from your **backend** and might be absent.

## Three-valued logic in SQL

In SQL, `AND`, `OR` and `NOT` operate on three values — `TRUE`, `FALSE` and `NULL` — and `NULL` propagates through them following these truth tables:

| `AND` | `TRUE` | `FALSE` | `NULL` |
|---|---|---|---|
| **`TRUE`** | `TRUE` | `FALSE` | `NULL` |
| **`FALSE`** | `FALSE` | `FALSE` | `FALSE` |
| **`NULL`** | `NULL` | `FALSE` | `NULL` |

| `OR` | `TRUE` | `FALSE` | `NULL` |
|---|---|---|---|
| **`TRUE`** | `TRUE` | `TRUE` | `TRUE` |
| **`FALSE`** | `TRUE` | `FALSE` | `NULL` |
| **`NULL`** | `TRUE` | `NULL` | `NULL` |

| `NOT` | |
|---|---|
| **`TRUE`** | `FALSE` |
| **`FALSE`** | `TRUE` |
| **`NULL`** | `NULL` |

Two rules drive everything: a comparison **involving** `NULL` evaluates to `NULL` (not `TRUE`/`FALSE`), and a `WHERE`, `ON` or `HAVING` keeps a row only when its predicate is **exactly `TRUE`** — rows where it evaluates to `FALSE` *or* `NULL` are discarded.

### Why null behaviour can surprise you

Because a comparison against `NULL` evaluates to `NULL` and only `TRUE` rows survive a filter, several results are counter-intuitive even though they are *usually* what you want:

- `column = value` skips the rows where `column` is `NULL` — the comparison yields `NULL`, not `false`. Usually that's the intent, but the row is silently dropped, not "kept because it isn't equal to `value`".
- `column <> value` **also** skips the `NULL` rows. So `WHERE active = true` and `WHERE active <> true` together do **not** cover every row: the `NULL` ones fall through both.
- `NOT (column = value)` stays `NULL` when `column` is `NULL` — `column = value` is `NULL`, and (per the `NOT` table) `NOT NULL` is `NULL` — so the row is still excluded; negating a predicate does not turn a `NULL` result into `TRUE`.
- `column NOT IN (1, 2, NULL)` returns **no rows at all**: the `NULL` in the list makes the whole expression `NULL` for every row.
- A condition and its negation do not split the table into two complementary halves when nulls are present; the `NULL`-producing rows belong to neither.

These are not `ts-sql-query` behaviours — they are SQL's, shared by every database. In the vast majority of queries the outcome matches what you intend (you rarely want to match a row on a column that has no value), which is why it goes unnoticed; the trap is the *occasional* query where you expected the `NULL` rows to participate. This is also why `ts-sql-query` does not let you feed a possibly-`null`/`undefined` backend value straight into a comparison — doing so would quietly inject this three-valued behaviour where you almost certainly meant "apply this filter only when I have a value". The rest of this page covers the right tools for that.

## Comparing nulls: `equals` (SQL) vs `is` (JavaScript-like)

The place this surprises people most is **comparing two values that may both be `null`** — and here JavaScript and SQL flatly disagree:

- In **JavaScript**, `null === null` is `true` (and `undefined === undefined` is `true`): `null` compares equal to itself.
- In **SQL**, `null = null` is **not** `true` — it is `null`; and so is `null <> null`. A `=` comparison can never confirm that two nulls are equal, which is why SQL has the separate `IS NULL` / `IS NOT DISTINCT FROM` operators.

`ts-sql-query` exposes **both** behaviours as distinct methods, so you pick explicitly which one you mean:

| You write | Emitted SQL | When both sides are `null` | Result type |
|---|---|---|---|
| `a.equals(b)` | `a = b` | `null` | optional boolean |
| `a.notEquals(b)` | `a <> b` | `null` | optional boolean |
| `a.is(b)` | `a is not distinct from b` (`a <=> b` on MySQL/MariaDB) | `true` | boolean (never `null`) |
| `a.isNot(b)` | `a is distinct from b` | `false` | boolean (never `null`) |

- `equals` / `notEquals` follow **SQL**'s `=` / `<>`: three-valued, the result is an **optional** boolean (it may be `null`), and they take a present value — you cannot pass `null` / `undefined` to them.
- `is` / `isNot` follow **JavaScript**'s `===` / `!==`: a **null-safe** comparison that treats `null` as equal to `null`, accepts `null` / `undefined` as the argument, and always returns a **definite** boolean — never `null`.

```ts
const maybeBig: boolean | null | undefined = null

const companies = await connection.selectFrom(tCustomCompany)
    // null-safe, JavaScript-like equality: `null` matches `null`, and the result is always a real boolean
    .where(tCustomCompany.isBig.is(maybeBig))
    .select({ id: tCustomCompany.id, name: tCustomCompany.name })
    .executeSelectMany()
```

Use `equals` when you want plain SQL `=` semantics over present values, and `is` when you want a total, JavaScript-like equality that copes with `null` on either side. (For the *dynamic* case — "apply this filter only if a value was provided" — use `equalsIfValue` / `isIfValue`, covered next.)

## Values coming from the backend are not three-valued

The library's typing for the **values you pass in from TypeScript/JavaScript** into a boolean-producing operation (a comparison such as `equals`, `greaterThan`, …) does **not** accept `boolean | null`, `boolean | undefined` or `boolean | null | undefined`. `equals(value)` requires a present, non-null value:

```ts
const present: boolean = true

const companies = await connection.selectFrom(tCustomCompany)
    .where(tCustomCompany.isBig.equals(present)) // requires a real boolean, never null/undefined
    .select({ id: tCustomCompany.id, name: tCustomCompany.name })
    .executeSelectMany()
```

Earlier versions of `ts-sql-query` fully modelled SQL's three-valued logic for these operations, but in practice it caused surprising behaviour from the TypeScript/JavaScript point of view (a comparison silently evaluating to `null`), so producing a boolean from a possibly-`null`/`undefined` TS value was deprecated. The reason is conceptual: **an optional value in your backend almost never means "compare against null" — it means "this condition is dynamic"** (apply it only when a value is present). That is a dynamic-query concern, not a three-valued-logic one.

## Optional backend values are dynamic queries: the `*IfValue` methods

When the value may be absent, use the `*IfValue` variant of the operation. These methods accept `value | null | undefined` and, when the value is `null`, `undefined` (or an empty string, unless the connection's `allowEmptyString` is enabled), return a **special neutral boolean** that is **reduced away before the final SQL is generated** — it is ignored inside `and`, `or`, `on` and `where`:

```ts
// `isBig` comes from the request and may be absent; absent means "don't filter by it"
const isBig: boolean | null | undefined = undefined

const companies = await connection.selectFrom(tCustomCompany)
    .where(tCustomCompany.isBig.equalsIfValue(isBig)) // omitted entirely when isBig is null/undefined
    .select({ id: tCustomCompany.id, name: tCustomCompany.name })
    .executeSelectMany()
```

Because the neutral boolean is reduced, the whole condition disappears from the emitted SQL when there is no value — even when it is combined with other conditions through `and` / `or`. See [Easy dynamic queries](../queries/dynamic-queries.md#easy-dynamic-queries) for the full treatment (including the generated SQL per database) and the other dynamic-query building blocks (`onlyWhen`, `ignoreWhen`, optional joins, …).

### When the absence should mean `false` instead of being omitted

Sometimes you don't want the condition dropped when there is no value — you want it applied as `false` (or `true`). End the `*IfValue` chain with `falseWhenNoValue()`, `trueWhenNoValue()` or `valueWhenNoValue(...)`:

```ts
const isBig: boolean | null | undefined = undefined

const companies = await connection.selectFrom(tCustomCompany)
    // absent value applies the condition as `false` instead of omitting it
    .where(tCustomCompany.isBig.equalsIfValue(isBig).falseWhenNoValue())
    .select({ id: tCustomCompany.id, name: tCustomCompany.name })
    .executeSelectMany()
```

## Three-valued logic still happens with database values

The restriction above is about **values you inject from the backend**. A `null` produced by the **database itself** is legitimate and fully modelled: reading a nullable boolean column (declared with `optionalColumn('...', 'boolean')`) gives an **optional** boolean value source, and its result is typed as `boolean | null | undefined`. Comparisons between database expressions keep SQL's three-valued semantics on the server side.

If you genuinely need SQL's three-valued behaviour for a comparison — for example to compare two optional database expressions and let the result be `null` — write a custom [SQL fragment](../queries/sql-fragments.md) that returns an `optional` boolean. The FAQ entry [How to compare against a null or undefined value?](../about/limitations.md#how-to-compare-against-a-null-or-undefined-value) shows exactly this pattern.

## See also

- [Easy dynamic queries](../queries/dynamic-queries.md#easy-dynamic-queries) — the `*IfValue` methods and the neutral-boolean reduction in depth.
- [How to compare against a null or undefined value?](../about/limitations.md#how-to-compare-against-a-null-or-undefined-value) — the FAQ on three-valued comparisons and the custom-fragment escape hatch.
- [Custom booleans values](../advanced/custom-booleans-values.md) — storing booleans with non-standard values (e.g. `'Y'` / `'N'`).
