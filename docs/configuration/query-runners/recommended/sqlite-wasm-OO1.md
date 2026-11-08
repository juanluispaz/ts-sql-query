---
search:
  boost: 0.577
---
<!-- doc-code-template: sqlite -->
# sqlite-wasm OO1

This runner provides integration with the WebAssembly-based [sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm) [Object Oriented API 1](https://sqlite.org/wasm/doc/trunk/api-oo1.md), allowing `ts-sql-query` to execute queries on SQLite databases. It wraps an instance of a connected SQLite database and must be used in combination with a `ts-sql-query` connection.

!!! success "Supported databases"

    - [SQLite](../../supported-databases/sqlite.md)

!!! info "Tested with"

    [@sqlite.org/sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm) `^3.54.1-build1` on **Node.js** and **Bun**.

    This information reflects the driver version pinned in this project's `devDependencies` and the runtimes the test suite runs it on against a real database. Other compatible versions may work but are not actively tested.

!!! tip

    `Sqlite3WasmOO1QueryRunner` supports synchronous query execution. See the [Synchronous query runners](../../../advanced/synchronous-query-runners.md) for more information.

!!! warning "A `Database` is a single connection"

    A `Database` is one connection to SQLite: every query runner created over the same object shares it, and shares its transaction. Two connection objects over one `Database` are not isolated from each other: a rollback in one undoes what the other did meanwhile, and while one has a transaction open, a transaction can't begin in the other. Don't use one object for work that runs at the same time with transactions.

## Using a single connection

Every statement runs on the database object you give the query runner. `new sqlite3.oo1.DB()` with no arguments creates a database in memory.

```ts
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { Sqlite3WasmOO1QueryRunner } from "ts-sql-query/queryRunners/Sqlite3WasmOO1QueryRunner";
import type { Database } from "@sqlite.org/sqlite-wasm";

async function main() {
    const sqlite3 = await sqlite3InitModule();
    const db: Database = new sqlite3.oo1.DB();
    const connection = new DBConnection(new Sqlite3WasmOO1QueryRunner(db));
    // Do your queries here
    connection // ...
}
```

## sqlite-wasm OO1 and UUIDs

To work with [UUIDs in SQLite](../../supported-databases/sqlite.md#uuid-strategies) the default strategy is `uuid-extension`. The [@sqlite.org/sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm) build does not bundle SQLite's optional [uuid extension](https://sqlite.org/src/file?name=ext/misc/uuid.c), but you can provide compatible SQL functions with the OO1 API's `createFunction`:

```ts
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import type { Database } from "@sqlite.org/sqlite-wasm";
import { parse as uuidParse, stringify as uuidStringify, v7 as uuidv7 } from "uuid";

async function main() {
    const sqlite3 = await sqlite3InitModule();
    const db: Database = new sqlite3.oo1.DB();

    // Implement uuid extension functions

    db.createFunction("uuid", (_ctxPtr) => uuidv7());
    db.createFunction("uuid_str", (_ctxPtr, value) => {
        if (!(value instanceof Uint8Array)) {
            throw new TypeError("uuid_str expects a SQLite BLOB");
        }
        return uuidStringify(value);
    });
    db.createFunction("uuid_blob", (_ctxPtr, value) => {
        if (typeof value !== "string") {
            throw new TypeError("uuid_blob expects a UUID string");
        }
        return uuidParse(value);
    });

    // ...
}
```

!!! tip "Generating UUIDs"

    The snippet uses **UUID v7** so that, with the canonical byte order produced by `uuidParse`, the 16-byte blob keeps its chronological ordering on the primary-key index.

!!! warning

    The binary representation used in this implementation is not intended to be compatible with SQLite’s optional UUID extension.

## sqlite-wasm OO1 and exact decimals

A [`customDecimal`](../../column-types.md#exact-decimals) on SQLite is exact with the [decimal strategies](../../supported-databases/sqlite.md#exact-decimals-the-decimal-strategies) that write functions. The @sqlite.org/sqlite-wasm build can't load the decimal extension: register in the connection the functions the strategy writes, written in JavaScript in this module.

### The module `decimalFunctions.ts`

```typescriptreact title="decimalFunctions.ts"
// The functions the decimal strategies of SqliteConnection write, in JavaScript, for a driver that registers
// functions written in JavaScript. `decimal-extension` writes decimal_add, decimal_sub, decimal_mul, decimal_cmp and
// decimal_sum, the functions of SQLite's decimal extension (ext/misc/decimal.c), with its results; `decimal-functions`
// writes them and the tsq_ ones. The SQLite page of the documentation shows this file as it is.

// The functions of SQLite's decimal extension (ext/misc/decimal.c) that the `decimal-extension` decimal strategy
// writes, in JavaScript, for the connectors that can't load the extension (the SQLite page of the documentation
// gives this same code). They give the results of the extension: decimal_add and decimal_sub keep the largest
// scale, decimal_mul keeps the decimals of both operands but trims the zeros at the end down to the smaller scale,
// decimal_sum keeps the largest scale, is 0 when every value is null and null without rows, decimal_cmp gives -1, 0
// or 1, a null operand gives null, and a zero keeps the sign of the operation that gave it ('-0.00'). The
// extension's decimal_add and decimal_sub fail with "out of memory" on a null operand; these return null (the
// library never sends them one).
export interface ExactDecimal { negative: boolean, digits: bigint, scale: number }
export function parseExactDecimal(value: unknown): ExactDecimal | null {
    if (value === null || value === undefined) return null
    const text = String(value).trim()
    let negative = false
    let i = 0
    if (text[i] === '-') { negative = true; i++ } else if (text[i] === '+') { i++ }
    let digits = ''
    let pointAt = -1
    let exponent = 0
    for (; i < text.length; i++) {
        const c = text[i]!
        if (c >= '0' && c <= '9') {
            digits += c
        } else if (c === '.') {
            pointAt = digits.length
        } else if (c === 'e' || c === 'E') {
            exponent = parseInt(text.substring(i + 1), 10) || 0
            break
        }
    }
    let scale = pointAt < 0 ? 0 : digits.length - pointAt
    let magnitude = BigInt(digits || '0')
    scale -= exponent
    if (scale < 0) {
        magnitude *= 10n ** BigInt(-scale)
        scale = 0
    }
    return { negative: negative && magnitude !== 0n, digits: magnitude, scale }
}
export function formatExactDecimal(value: ExactDecimal): string {
    const text = value.digits.toString().padStart(value.scale + 1, '0')
    const integerPart = text.substring(0, text.length - value.scale)
    const fraction = value.scale > 0 ? '.' + text.substring(text.length - value.scale) : ''
    return (value.negative ? '-' : '') + integerPart + fraction
}
export function addExactDecimals(a: ExactDecimal, b: ExactDecimal): ExactDecimal {
    const scale = Math.max(a.scale, b.scale)
    const x = a.digits * 10n ** BigInt(scale - a.scale)
    const y = b.digits * 10n ** BigInt(scale - b.scale)
    if (a.negative === b.negative) return { negative: a.negative, digits: x + y, scale }
    return x < y ? { negative: !a.negative, digits: y - x, scale } : { negative: a.negative, digits: x - y, scale }
}
export function decimalAdd(a: unknown, b: unknown): string | null {
    const x = parseExactDecimal(a)
    const y = parseExactDecimal(b)
    return x && y ? formatExactDecimal(addExactDecimals(x, y)) : null
}
export function decimalSub(a: unknown, b: unknown): string | null {
    const x = parseExactDecimal(a)
    const y = parseExactDecimal(b)
    return x && y ? formatExactDecimal(addExactDecimals(x, { ...y, negative: !y.negative })) : null
}
export function decimalMul(a: unknown, b: unknown): string | null {
    const x = parseExactDecimal(a)
    const y = parseExactDecimal(b)
    if (!x || !y) return null
    let digits = x.digits * y.digits
    let scale = x.scale + y.scale
    const minScale = Math.min(x.scale, y.scale)
    while (scale > minScale && digits % 10n === 0n) {
        digits /= 10n
        scale--
    }
    return formatExactDecimal({ negative: x.negative !== y.negative, digits, scale })
}
export function decimalCmp(a: unknown, b: unknown): number | null {
    const x = parseExactDecimal(a)
    const y = parseExactDecimal(b)
    if (!x || !y) return null
    const difference = addExactDecimals(x, { ...y, negative: !y.negative })
    return difference.digits === 0n ? 0 : difference.negative ? -1 : 1
}
// decimal_sum: the state is null until a row is seen
export function decimalSumStep(total: ExactDecimal | null, value: unknown): ExactDecimal {
    const sum = total ?? { negative: false, digits: 0n, scale: 0 }
    const x = parseExactDecimal(value)
    return x ? addExactDecimals(sum, x) : sum
}
export function decimalSumResult(total: ExactDecimal | null): string | null {
    return total ? formatExactDecimal(total) : null
}
// The functions of the `decimal-functions` decimal strategy that the decimal extension doesn't have, named with the
// prefix of the library (tsq_) so no function of SQLite or of an extension has their name.
// tsq_decimal_key: a text whose order is the order of the numbers, the same for 1.5 and 1.50: '1' for zero; for a
// positive number '2', its exponent (where the point goes, from the first significant digit) plus 500000000 in 10
// digits, and its significant digits; for a negative number '0', the same with every digit inverted (9 - digit),
// and '~' at the end, so a longer number, of greater magnitude, comes before.
export function decimalKey(value: unknown): string | null {
    const x = parseExactDecimal(value)
    if (!x) return null
    if (x.digits === 0n) return '1'
    const text = x.digits.toString()
    const exponent = (text.length - x.scale + 500000000).toString().padStart(10, '0')
    const significant = text.replace(/0+$/, '')
    if (!x.negative) return '2' + exponent + significant
    const invert = (digits: string) => digits.replace(/[0-9]/g, digit => String(9 - Number(digit)))
    return '0' + invert(exponent) + invert(significant) + '~'
}
// tsq_decimal_abs, tsq_decimal_ceil, tsq_decimal_floor, tsq_decimal_round and tsq_decimal_mod: the operations of
// the other databases on a decimal, with their scales: abs and mod keep the scale (mod the larger of both, with the
// sign of the dividend, null when dividing by zero), ceil and floor have no decimals, and round(x, n) has n decimals
// (none when n is negative), rounding half away from zero.
export function decimalAbs(value: unknown): string | null {
    const x = parseExactDecimal(value)
    return x ? formatExactDecimal({ ...x, negative: false }) : null
}
export function decimalToInteger(value: unknown, up: (negative: boolean) => boolean): string | null {
    const x = parseExactDecimal(value)
    if (!x) return null
    const divisor = 10n ** BigInt(x.scale)
    let digits = x.digits / divisor
    if (x.digits % divisor !== 0n && up(x.negative)) digits += 1n
    return formatExactDecimal({ negative: x.negative && digits !== 0n, digits, scale: 0 })
}
export function decimalCeil(value: unknown): string | null {
    // The magnitude goes up for a positive number and down (truncated) for a negative one
    return decimalToInteger(value, negative => !negative)
}
export function decimalFloor(value: unknown): string | null {
    return decimalToInteger(value, negative => negative)
}
export function decimalRound(value: unknown, places: unknown): string | null {
    const x = parseExactDecimal(value)
    if (!x || places === null || places === undefined) return null
    const n = Number(places)
    if (n >= x.scale) {
        return formatExactDecimal({ ...x, digits: x.digits * 10n ** BigInt(n - x.scale), scale: n })
    }
    const divisor = 10n ** BigInt(x.scale - n)
    let digits = x.digits / divisor
    if ((x.digits % divisor) * 2n >= divisor) digits += 1n
    const scale = Math.max(n, 0)
    if (n < 0) digits *= 10n ** BigInt(-n)
    return formatExactDecimal({ negative: x.negative && digits !== 0n, digits, scale })
}
export function decimalMod(a: unknown, b: unknown): string | null {
    const x = parseExactDecimal(a)
    const y = parseExactDecimal(b)
    if (!x || !y || y.digits === 0n) return null
    const scale = Math.max(x.scale, y.scale)
    const digits = (x.digits * 10n ** BigInt(scale - x.scale)) % (y.digits * 10n ** BigInt(scale - y.scale))
    return formatExactDecimal({ negative: x.negative && digits !== 0n, digits, scale })
}
// tsq_decimal_min and tsq_decimal_max: the value, with its scale, that is the smallest or the largest number; the
// first one when several are equal, and null without values
export interface DecimalChoice { value: unknown, number: ExactDecimal }
export function decimalMinStep(chosen: DecimalChoice | null, value: unknown): DecimalChoice | null {
    const x = parseExactDecimal(value)
    if (!x) return chosen
    return !chosen || decimalCmp(value, chosen.value)! < 0 ? { value, number: x } : chosen
}
export function decimalMaxStep(chosen: DecimalChoice | null, value: unknown): DecimalChoice | null {
    const x = parseExactDecimal(value)
    if (!x) return chosen
    return !chosen || decimalCmp(value, chosen.value)! > 0 ? { value, number: x } : chosen
}
export function decimalChoiceResult(chosen: DecimalChoice | null): unknown {
    return chosen ? chosen.value : null
}
```

### Registering the functions

With `createFunction`, importing them from `decimalFunctions.ts`, the module above. An aggregate keeps the state of each aggregation by the address of its aggregate context:

```typescriptreact
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import type { Database } from "@sqlite.org/sqlite-wasm";
import { decimalAbs, decimalAdd, decimalCeil, decimalChoiceResult, decimalCmp, decimalFloor, decimalKey, decimalMaxStep, decimalMinStep, decimalMod, decimalMul, decimalRound, decimalSub, decimalSumResult, decimalSumStep } from "./decimalFunctions";

async function main() {
    const sqlite3 = await sqlite3InitModule();
    const db: Database = new sqlite3.oo1.DB();

    db.createFunction('decimal_add', (_ctxPtr, a, b) => decimalAdd(a, b))
    db.createFunction('decimal_sub', (_ctxPtr, a, b) => decimalSub(a, b))
    db.createFunction('decimal_mul', (_ctxPtr, a, b) => decimalMul(a, b))
    db.createFunction('decimal_cmp', (_ctxPtr, a, b) => decimalCmp(a, b))
    // Only for the decimal-functions strategy
    db.createFunction('tsq_decimal_key', (_ctxPtr, value) => decimalKey(value))
    db.createFunction('tsq_decimal_abs', (_ctxPtr, value) => decimalAbs(value))
    db.createFunction('tsq_decimal_ceil', (_ctxPtr, value) => decimalCeil(value))
    db.createFunction('tsq_decimal_floor', (_ctxPtr, value) => decimalFloor(value))
    db.createFunction('tsq_decimal_round', (_ctxPtr, value, places) => decimalRound(value, places))
    db.createFunction('tsq_decimal_mod', (_ctxPtr, a, b) => decimalMod(a, b))
    function aggregate<T>(name: string, step: (state: T | null, value: unknown) => T | null, result: (state: T | null) => unknown): void {
        const states = new Map<number, T | null>()
        db.createFunction({
            name,
            xStep: (ctxPtr: number, value: unknown) => {
                const key = Number(sqlite3.capi.sqlite3_js_aggregate_context(ctxPtr, 1))
                states.set(key, step(states.get(key) ?? null, value))
            },
            xFinal: (ctxPtr: number) => {
                const key = Number(sqlite3.capi.sqlite3_js_aggregate_context(ctxPtr, 0))
                const state = states.get(key) ?? null
                states.delete(key)
                return result(state) as string | null
            },
        })
    }
    aggregate('decimal_sum', decimalSumStep, decimalSumResult)
    // Only for the decimal-functions strategy
    aggregate('tsq_decimal_min', decimalMinStep, decimalChoiceResult)
    aggregate('tsq_decimal_max', decimalMaxStep, decimalChoiceResult)

    // ...
}
```

## Inside a transaction something else manages

When the connection is already in a transaction that something else began and ends, like your own code or [another library](../combining-with-another-library.md), create the query runner with `forUseInTransaction`. Its statements run in that transaction, and a transaction can't begin on it: `connection.transaction(...)` and `connection.beginTransaction()` reject with `NESTED_TRANSACTION_NOT_SUPPORTED`.

For `ts-sql-query` there is no transaction open, so `executeAfterNextCommit`, the other end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

```ts
import type { Database } from "@sqlite.org/sqlite-wasm";
import { Sqlite3WasmOO1QueryRunner } from "ts-sql-query/queryRunners/Sqlite3WasmOO1QueryRunner";

async function main(db: Database) {
    const connection = new DBConnection(new Sqlite3WasmOO1QueryRunner(db, { forUseInTransaction: true }));
    // Do your queries here, in the transaction
    connection // ...
}
```

## Options of the query runner

The second argument of `Sqlite3WasmOO1QueryRunner`, optional, is an object of type `Sqlite3WasmOO1QueryRunnerConfig`, exported from `ts-sql-query/queryRunners/Sqlite3WasmOO1QueryRunner`:

- **`promise`**: another `Promise` provider, for [synchronous query execution](../../../advanced/synchronous-query-runners.md).
- **`forUseInTransaction`**: the connection is already in a transaction that something else began and ends; see [Inside a transaction something else manages](#inside-a-transaction-something-else-manages).
