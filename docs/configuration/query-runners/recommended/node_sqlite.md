---
search:
  boost: 0.577
---
<!-- doc-code-template: sqlite -->
# node:sqlite

This runner provides integration with Node.js' built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html) `DatabaseSync` API, allowing `ts-sql-query` to execute queries on SQLite databases without installing an additional SQLite driver. It wraps an instance of a connected SQLite database and must be used in combination with a `ts-sql-query` connection.

!!! success "Supported databases"

    - [SQLite](../../supported-databases/sqlite.md)

!!! info "Tested with"

    The built-in `node:sqlite` module, on **Node.js** and **Bun**.

    This information reflects the runtimes the test suite runs it on against a real database.

!!! warning "Runtime requirements"

    | Runtime | What it needs |
    |---|---|
    | **Node 26** | Nothing |
    | **Node 24** | Nothing |
    | **Node 22.13 or newer** | Nothing |
    | **Node 22.5 to 22.12** | Launch Node with `--experimental-sqlite`. `DatabaseSync.function()` isn't there, so you can't [register the functions for UUIDs](#nodesqlite-and-uuids); the rest of the queries work |
    | **Bun 1.4 or newer** | Nothing: it has its own implementation, with `function()` |

    To launch with the flag: `node --experimental-sqlite app.js`, or `NODE_OPTIONS=--experimental-sqlite tsx app.ts`. From Node 22.13 the flag isn't needed. Node 22 and 24 write a warning that the module is experimental; Node 26 doesn't.

!!! tip

    node:sqlite `DatabaseSync` supports synchronous query execution. See the [Synchronous query runners](../../../advanced/synchronous-query-runners.md) for more information.

!!! warning "A `DatabaseSync` is a single connection"

    A `DatabaseSync` is one connection to SQLite: every query runner created over the same object shares it, and shares its transaction. Two connection objects over one `DatabaseSync` are not isolated from each other: a rollback in one undoes what the other did meanwhile, and while one has a transaction open, a transaction can't begin in the other. Don't use one object for requests that run at the same time with transactions: open a `DatabaseSync` for each one, which is another connection to the same file.

## Using a single connection

Every statement runs on the database object you give the query runner.

```ts
import { DatabaseSync } from "node:sqlite";
import { NodeSqliteQueryRunner } from "ts-sql-query/queryRunners/NodeSqliteQueryRunner";

const db = new DatabaseSync('foobar.db', options);

async function main() {
    const connection = new DBConnection(new NodeSqliteQueryRunner(db));
    // Do your queries here
    connection // ...
}
```

## Large integers

By default, `node:sqlite` reads integers as JavaScript numbers and fails when one is outside JavaScript's safe integer range: the query rejects with `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE`. If your queries may return larger integers, create the database with `new DatabaseSync('foobar.db', { readBigInts: true })`, where your runtime has that option (Node 24.4 or newer). Every integer then arrives as a `BigInt`, and `ts-sql-query` converts it to the type the column declares: an `int` column still gives a `number`.

## node:sqlite and UUIDs

To work with [UUIDs in SQLite](../../supported-databases/sqlite.md#uuid-strategies) the default strategy is `uuid-extension`. Node.js does not bundle SQLite's optional [uuid extension](https://sqlite.org/src/file?name=ext/misc/uuid.c), but you can provide compatible SQL functions with `DatabaseSync.function`.

```ts
import { Buffer } from "node:buffer";
import { DatabaseSync, type SQLInputValue, type SQLOutputValue } from "node:sqlite";
import { parse as uuidParse, stringify as uuidStringify, v7 as uuidv7 } from "uuid";

type NodeSqliteFunction = (...args: SQLOutputValue[]) => SQLInputValue;

const uuid: NodeSqliteFunction = () => uuidv7();
const uuidStr: NodeSqliteFunction = (value) => {
    if (!(value instanceof Uint8Array)) {
        throw new TypeError("uuid_str expects a SQLite BLOB");
    }
    return uuidStringify(value);
};
const uuidBlob: NodeSqliteFunction = (value) => {
    if (typeof value !== "string") {
        throw new TypeError("uuid_blob expects a UUID string");
    }
    return Buffer.from(uuidParse(value));
};

const db = new DatabaseSync('foobar.db', options);

// Implement uuid extension functions

db.function("uuid", uuid);
db.function("uuid_str", uuidStr);
db.function("uuid_blob", uuidBlob);

// ...
```

!!! tip "Generating UUIDs"

    The snippet uses **UUID v7** so that, with the canonical byte order produced by `uuidParse`, the 16-byte blob keeps its chronological ordering on the primary-key index.

!!! warning

    The binary representation used in this implementation is not intended to be compatible with SQLite’s optional UUID extension.

## node:sqlite and exact decimals

A [`customDecimal`](../../column-types.md#exact-decimals) on SQLite is exact with the [decimal strategies](../../supported-databases/sqlite.md#exact-decimals-the-decimal-strategies) that write functions: register in the connection the functions the strategy writes, written in JavaScript in this module.

### The module `decimalFunctions.ts`

```typescriptreact title="decimalFunctions.ts"
// The functions the decimal strategies of SqliteConnection write, in JavaScript, for a driver that registers
// functions written in JavaScript. The strategies with functions write decimal_add, decimal_sub, decimal_mul,
// decimal_cmp and decimal_sum, the functions of SQLite's decimal extension (ext/misc/decimal.c), with its results, and
// tsq_ ones: 'decimal-extension and tsq-functions' the roundings and the modulo, 'decimal-functions' also the order,
// the grouping, min and max. The SQLite page of the documentation shows this file as it is.

// The functions of SQLite's decimal extension (ext/misc/decimal.c) that the decimal strategies with functions
// write, in JavaScript, for the connectors that can't load the extension (the SQLite page of the documentation
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
// The functions of the library that the decimal extension doesn't have, which the decimal strategies with functions
// write (see each function), named with the prefix of the library (tsq_) so no function of SQLite or of an extension
// has their name.
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

Importing them from `decimalFunctions.ts`, the module above:

```typescriptreact
import { DatabaseSync } from "node:sqlite";
import { decimalAbs, decimalAdd, decimalCeil, decimalChoiceResult, decimalCmp, decimalFloor, decimalKey, decimalMaxStep, decimalMinStep, decimalMod, decimalMul, decimalRound, decimalSub, decimalSumResult, decimalSumStep } from "./decimalFunctions";

const db = new DatabaseSync('foobar.db');

db.function('decimal_add', { deterministic: true }, decimalAdd)
db.function('decimal_sub', { deterministic: true }, decimalSub)
db.function('decimal_mul', { deterministic: true }, decimalMul)
db.function('decimal_cmp', { deterministic: true }, decimalCmp)
db.aggregate('decimal_sum', { start: null, step: decimalSumStep, result: decimalSumResult })
// The library's own: tsq_decimal_ceil, _floor, _round and _mod for every strategy with functions, the others
// only for 'decimal-functions' and its canonical text variant
db.function('tsq_decimal_key', { deterministic: true }, decimalKey)
db.function('tsq_decimal_abs', { deterministic: true }, decimalAbs)
db.function('tsq_decimal_ceil', { deterministic: true }, decimalCeil)
db.function('tsq_decimal_floor', { deterministic: true }, decimalFloor)
db.function('tsq_decimal_round', { deterministic: true }, decimalRound)
db.function('tsq_decimal_mod', { deterministic: true }, decimalMod)
db.aggregate('tsq_decimal_min', { start: null, step: decimalMinStep, result: decimalChoiceResult })
db.aggregate('tsq_decimal_max', { start: null, step: decimalMaxStep, result: decimalChoiceResult })
```

## Inside a transaction something else manages

When the connection is already in a transaction that something else began and ends, like your own code or [another library](../combining-with-another-library.md), create the query runner with `forUseInTransaction`. Its statements run in that transaction, and a transaction can't begin on it: `connection.transaction(...)` and `connection.beginTransaction()` reject with `NESTED_TRANSACTION_NOT_SUPPORTED`.

For `ts-sql-query` there is no transaction open, so `executeAfterNextCommit`, the other end-of-transaction functions and `getTransactionMetadata()` throw `NOT_IN_TRANSACTION`.

```ts
import { DatabaseSync } from "node:sqlite";
import { NodeSqliteQueryRunner } from "ts-sql-query/queryRunners/NodeSqliteQueryRunner";

const db = new DatabaseSync('foobar.db', options);

async function main() {
    const connection = new DBConnection(new NodeSqliteQueryRunner(db, { forUseInTransaction: true }));
    // Do your queries here, in the transaction
    connection // ...
}
```

## Options of the query runner

The second argument of `NodeSqliteQueryRunner`, optional, is an object of type `NodeSqliteQueryRunnerConfig`, exported from `ts-sql-query/queryRunners/NodeSqliteQueryRunner`:

- **`promise`**: another `Promise` provider, for [synchronous query execution](../../../advanced/synchronous-query-runners.md).
- **`forUseInTransaction`**: the connection is already in a transaction that something else began and ends; see [Inside a transaction something else manages](#inside-a-transaction-something-else-manages).
