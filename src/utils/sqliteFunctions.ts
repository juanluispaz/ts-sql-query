/*
 * The SQL functions the library may write on SQLite, in JavaScript, for the query runners that register them on their
 * driver (registerSqliteFunctions):
 *
 * - The functions of SQLite's decimal extension (ext/misc/decimal.c) the decimal strategies with functions write:
 *   decimal_add, decimal_sub, decimal_mul, decimal_cmp and decimal_sum, with the results of the extension. decimal_add
 *   and decimal_sub keep the largest scale, decimal_mul keeps the decimals of both operands but trims the zeros at the
 *   end down to the smaller scale, decimal_sum keeps the largest scale, is 0 when every value is null and null without
 *   rows, decimal_cmp gives -1, 0 or 1, a null operand gives null, and a zero keeps the sign of the operation that gave
 *   it ('-0.00'). The extension's decimal_add and decimal_sub fail with "out of memory" on a null operand; these return
 *   null (the library never sends them one).
 * - The functions of the library the decimal extension doesn't have, named with the prefix of the library (tsq_) so no
 *   function of SQLite or of an extension has their name: tsq_decimal_key, tsq_decimal_abs, tsq_decimal_ceil,
 *   tsq_decimal_floor, tsq_decimal_round, tsq_decimal_mod, tsq_decimal_min and tsq_decimal_max.
 * - The functions of SQLite's uuid extension (ext/misc/uuid.c) the uuid strategy 'uuid-extension' writes: uuid,
 *   uuid_str and uuid_blob. uuid() generates a version 7 UUID (the extension generates a version 4), whose text and
 *   whose blob sort by the time they were generated.
 * - ci_replace, a case-insensitive replace, for the connections whose replaceAllInsensitiveFunction is 'ci_replace'.
 *
 * Every function but uuid() is deterministic: the same arguments give the same result.
 *
 * A function the database already has with the same name and number of arguments (a loaded extension, like the real
 * decimal or uuid extension, or a function the user registered) is never replaced: registerSqliteFunctions reads the
 * functions of the database (pragma function_list) when it is called, before registering, and leaves those.
 */

import type { SqliteFunctionsOptions } from '../connections/SqliteConfiguration.js'

/** A scalar SQL function */
export interface SqliteScalarFunction {
    readonly name: string
    readonly arity: number
    readonly deterministic: boolean
    readonly fn: (...args: unknown[]) => unknown
}

/**
 * An aggregate SQL function, whose state starts as null for each group. With inverse, it is also a window function:
 * inverse takes out of the state a row that leaves the frame, and result gives the value of the current frame too.
 */
export interface SqliteAggregateFunction {
    readonly name: string
    readonly arity: number
    readonly step: (state: any, value: unknown) => any
    readonly inverse?: ((state: any, value: unknown) => any) | undefined
    readonly result: (state: any) => unknown
}

// Decimals

interface ExactDecimal { negative: boolean, digits: bigint, scale: number }

function parseExactDecimal(value: unknown): ExactDecimal | null {
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

function formatExactDecimal(value: ExactDecimal): string {
    const text = value.digits.toString().padStart(value.scale + 1, '0')
    const integerPart = text.substring(0, text.length - value.scale)
    const fraction = value.scale > 0 ? '.' + text.substring(text.length - value.scale) : ''
    return (value.negative ? '-' : '') + integerPart + fraction
}

function addExactDecimals(a: ExactDecimal, b: ExactDecimal): ExactDecimal {
    const scale = Math.max(a.scale, b.scale)
    const x = a.digits * 10n ** BigInt(scale - a.scale)
    const y = b.digits * 10n ** BigInt(scale - b.scale)
    if (a.negative === b.negative) return { negative: a.negative, digits: x + y, scale }
    return x < y ? { negative: !a.negative, digits: y - x, scale } : { negative: a.negative, digits: x - y, scale }
}

function decimalAdd(a: unknown, b: unknown): string | null {
    const x = parseExactDecimal(a)
    const y = parseExactDecimal(b)
    return x && y ? formatExactDecimal(addExactDecimals(x, y)) : null
}

function decimalSub(a: unknown, b: unknown): string | null {
    const x = parseExactDecimal(a)
    const y = parseExactDecimal(b)
    return x && y ? formatExactDecimal(addExactDecimals(x, { ...y, negative: !y.negative })) : null
}

function decimalMul(a: unknown, b: unknown): string | null {
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

function decimalCmp(a: unknown, b: unknown): number | null {
    const x = parseExactDecimal(a)
    const y = parseExactDecimal(b)
    if (!x || !y) return null
    const difference = addExactDecimals(x, { ...y, negative: !y.negative })
    return difference.digits === 0n ? 0 : difference.negative ? -1 : 1
}

function decimalSumStep(total: ExactDecimal | null, value: unknown): ExactDecimal {
    const sum = total ?? { negative: false, digits: 0n, scale: 0 }
    const x = parseExactDecimal(value)
    return x ? addExactDecimals(sum, x) : sum
}

// As a window function: a row that leaves the frame is subtracted; the scale stays the largest one seen, as in the
// extension
function decimalSumInverse(total: ExactDecimal | null, value: unknown): ExactDecimal | null {
    const x = parseExactDecimal(value)
    return total && x ? addExactDecimals(total, { ...x, negative: !x.negative }) : total
}

function decimalSumResult(total: ExactDecimal | null): string | null {
    return total ? formatExactDecimal(total) : null
}

/**
 * tsq_decimal_key: a text whose order is the order of the numbers, the same for 1.5 and 1.50: '1' for zero; for a
 * positive number '2', its exponent (where the point goes, from the first significant digit) plus 500000000 in 10
 * digits, and its significant digits; for a negative number '0', the same with every digit inverted (9 - digit), and
 * '~' at the end, so a longer number, of greater magnitude, comes before.
 */
function decimalKey(value: unknown): string | null {
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

/*
 * tsq_decimal_abs, tsq_decimal_ceil, tsq_decimal_floor, tsq_decimal_round and tsq_decimal_mod: the operations of the
 * other databases on a decimal, with their scales: abs and mod keep the scale (mod the larger of both, with the sign of
 * the dividend, null when dividing by zero), ceil and floor have no decimals, and round(x, n) has n decimals (none
 * when n is negative), rounding half away from zero.
 */
function decimalAbs(value: unknown): string | null {
    const x = parseExactDecimal(value)
    return x ? formatExactDecimal({ ...x, negative: false }) : null
}

function decimalToInteger(value: unknown, up: (negative: boolean) => boolean): string | null {
    const x = parseExactDecimal(value)
    if (!x) return null
    const divisor = 10n ** BigInt(x.scale)
    let digits = x.digits / divisor
    if (x.digits % divisor !== 0n && up(x.negative)) digits += 1n
    return formatExactDecimal({ negative: x.negative && digits !== 0n, digits, scale: 0 })
}

function decimalCeil(value: unknown): string | null {
    // The magnitude goes up for a positive number and down (truncated) for a negative one
    return decimalToInteger(value, negative => !negative)
}

function decimalFloor(value: unknown): string | null {
    return decimalToInteger(value, negative => negative)
}

function decimalRound(value: unknown, places: unknown): string | null {
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

function decimalMod(a: unknown, b: unknown): string | null {
    const x = parseExactDecimal(a)
    const y = parseExactDecimal(b)
    if (!x || !y || y.digits === 0n) return null
    const scale = Math.max(x.scale, y.scale)
    const digits = (x.digits * 10n ** BigInt(scale - x.scale)) % (y.digits * 10n ** BigInt(scale - y.scale))
    return formatExactDecimal({ negative: x.negative && digits !== 0n, digits, scale })
}

/*
 * tsq_decimal_min and tsq_decimal_max: the value, with its scale, that is the smallest or the largest number; the
 * first one when several are equal, and null without values. They aren't window functions: taking a row out of the
 * frame would need every value of the frame in the state, and the same function also serves as a plain aggregate,
 * where that state would grow with every row of the group.
 */
interface DecimalChoice { value: unknown }

function decimalMinStep(chosen: DecimalChoice | null, value: unknown): DecimalChoice | null {
    if (!parseExactDecimal(value)) return chosen
    return !chosen || decimalCmp(value, chosen.value)! < 0 ? { value } : chosen
}

function decimalMaxStep(chosen: DecimalChoice | null, value: unknown): DecimalChoice | null {
    if (!parseExactDecimal(value)) return chosen
    return !chosen || decimalCmp(value, chosen.value)! > 0 ? { value } : chosen
}

function decimalChoiceResult(chosen: DecimalChoice | null): unknown {
    return chosen ? chosen.value : null
}

// UUIDs

const hexDigits = '0123456789abcdef'

function uuidBytesToText(bytes: Uint8Array): string {
    let text = ''
    for (let i = 0; i < 16; i++) {
        if (i === 4 || i === 6 || i === 8 || i === 10) {
            text += '-'
        }
        text += hexDigits[bytes[i]! >> 4]! + hexDigits[bytes[i]! & 15]!
    }
    return text
}

/**
 * The 16 bytes of a UUID given as a blob of 16 bytes, or as a text of 32 hexadecimal digits, optionally between braces
 * and with dashes between them, as the uuid extension takes it; null otherwise
 */
function uuidBytesOf(value: unknown): Uint8Array | null {
    if (value instanceof Uint8Array) {
        return value.length === 16 ? value : null
    }
    if (typeof value !== 'string') {
        return null
    }
    let text = value
    if (text.startsWith('{') && text.endsWith('}')) {
        text = text.substring(1, text.length - 1)
    }
    text = text.replace(/-/g, '')
    if (!/^[0-9a-fA-F]{32}$/.test(text)) {
        return null
    }
    const bytes = new Uint8Array(16)
    for (let i = 0; i < 16; i++) {
        bytes[i] = parseInt(text.substring(i * 2, i * 2 + 2), 16)
    }
    return bytes
}

// The time and the counter of the last UUID generated, so the UUIDs generated in the same millisecond keep their order
let lastUuidTime = 0
let lastUuidCounter = 0

/**
 * A version 7 UUID (RFC 9562): the milliseconds since the epoch in its first 48 bits, the version, a 12-bit counter
 * that starts at a random value each millisecond and grows within it, the variant, and 62 random bits. For a runtime
 * that doesn't generate them (see uuidV7)
 */
function uuidV7OfTheLibrary(): string {
    const bytes = new Uint8Array(16)
    globalThis.crypto.getRandomValues(bytes)
    let time = Date.now()
    if (time > lastUuidTime) {
        lastUuidTime = time
        lastUuidCounter = ((bytes[6]! & 0x07) << 8) | bytes[7]!
    } else {
        lastUuidCounter++
        if (lastUuidCounter > 0xfff) {
            lastUuidTime++
            lastUuidCounter = 0
        }
        time = lastUuidTime
    }
    bytes[0] = Math.floor(time / 2 ** 40) & 0xff
    bytes[1] = Math.floor(time / 2 ** 32) & 0xff
    bytes[2] = (time >>> 24) & 0xff
    bytes[3] = (time >>> 16) & 0xff
    bytes[4] = (time >>> 8) & 0xff
    bytes[5] = time & 0xff
    bytes[6] = 0x70 | (lastUuidCounter >> 8)
    bytes[7] = lastUuidCounter & 0xff
    bytes[8] = 0x80 | (bytes[8]! & 0x3f)
    return uuidBytesToText(bytes)
}

// The generator of version 7 UUIDs of the runtime, looked for the first time one is generated
let runtimeUuidV7: (() => string) | null | undefined

/**
 * A version 7 UUID, from the runtime when it generates them (Bun.randomUUIDv7 on Bun, randomUUIDv7 of node:crypto on
 * Node 24 and later), else from the library (Node 22, a browser)
 */
function uuidV7(): string {
    if (runtimeUuidV7 === undefined) {
        const bun = (globalThis as { Bun?: { randomUUIDv7?: () => string } }).Bun
        const nodeCrypto = (globalThis as { process?: { getBuiltinModule?: (name: string) => { randomUUIDv7?: () => string } | undefined } }).process?.getBuiltinModule?.('node:crypto')
        if (typeof bun?.randomUUIDv7 === 'function') {
            const randomUUIDv7 = bun.randomUUIDv7
            runtimeUuidV7 = () => randomUUIDv7()
        } else if (typeof nodeCrypto?.randomUUIDv7 === 'function') {
            const randomUUIDv7 = nodeCrypto.randomUUIDv7
            runtimeUuidV7 = () => randomUUIDv7()
        } else {
            runtimeUuidV7 = null
        }
    }
    return runtimeUuidV7 ? runtimeUuidV7() : uuidV7OfTheLibrary()
}

function uuidStr(value: unknown): string | null {
    const bytes = uuidBytesOf(value)
    return bytes ? uuidBytesToText(bytes) : null
}

function uuidBlob(value: unknown): Uint8Array | null {
    const bytes = uuidBytesOf(value)
    // A copy, so the blob given back is never the one received
    return bytes ? new Uint8Array(bytes) : null
}

// Texts

function ciReplace(source: unknown, find: unknown, replacement: unknown): unknown {
    if (source === null || source === undefined || find === null || find === undefined || replacement === null || replacement === undefined) {
        return source
    }
    const escaped = String(find).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return String(source).replace(new RegExp(escaped, 'gi'), () => String(replacement))
}

// The functions

const pure = true

export const sqliteScalarFunctions: readonly SqliteScalarFunction[] = [
    { name: 'decimal_add', arity: 2, deterministic: pure, fn: decimalAdd as SqliteScalarFunction['fn'] },
    { name: 'decimal_sub', arity: 2, deterministic: pure, fn: decimalSub as SqliteScalarFunction['fn'] },
    { name: 'decimal_mul', arity: 2, deterministic: pure, fn: decimalMul as SqliteScalarFunction['fn'] },
    { name: 'decimal_cmp', arity: 2, deterministic: pure, fn: decimalCmp as SqliteScalarFunction['fn'] },
    { name: 'tsq_decimal_key', arity: 1, deterministic: pure, fn: decimalKey as SqliteScalarFunction['fn'] },
    { name: 'tsq_decimal_abs', arity: 1, deterministic: pure, fn: decimalAbs as SqliteScalarFunction['fn'] },
    { name: 'tsq_decimal_ceil', arity: 1, deterministic: pure, fn: decimalCeil as SqliteScalarFunction['fn'] },
    { name: 'tsq_decimal_floor', arity: 1, deterministic: pure, fn: decimalFloor as SqliteScalarFunction['fn'] },
    { name: 'tsq_decimal_round', arity: 2, deterministic: pure, fn: decimalRound as SqliteScalarFunction['fn'] },
    { name: 'tsq_decimal_mod', arity: 2, deterministic: pure, fn: decimalMod as SqliteScalarFunction['fn'] },
    { name: 'uuid', arity: 0, deterministic: false, fn: uuidV7 },
    { name: 'uuid_str', arity: 1, deterministic: pure, fn: uuidStr as SqliteScalarFunction['fn'] },
    { name: 'uuid_blob', arity: 1, deterministic: pure, fn: uuidBlob as SqliteScalarFunction['fn'] },
    { name: 'ci_replace', arity: 3, deterministic: pure, fn: ciReplace as SqliteScalarFunction['fn'] },
]

export const sqliteAggregateFunctions: readonly SqliteAggregateFunction[] = [
    { name: 'decimal_sum', arity: 1, step: decimalSumStep, inverse: decimalSumInverse, result: decimalSumResult },
    { name: 'tsq_decimal_min', arity: 1, step: decimalMinStep, result: decimalChoiceResult },
    { name: 'tsq_decimal_max', arity: 1, step: decimalMaxStep, result: decimalChoiceResult },
]

/** A function of the database, as pragma function_list gives it */
interface SqliteFunctionOfTheDatabase { readonly name: unknown, readonly narg: unknown }

/**
 * The functions to register: the ones of the library that the database doesn't have yet with the same name and number
 * of arguments (a function with a variable number of arguments, narg -1, takes any), and that the options don't skip.
 * readFunctions runs sqliteFunctionListQuery on the database; when the list can't be read, the ones the options don't
 * skip.
 */
export function sqliteFunctionsToRegister(readFunctions: () => unknown, options: SqliteFunctionsOptions | undefined): { scalar: SqliteScalarFunction[], aggregate: SqliteAggregateFunction[] } {
    let existing: readonly SqliteFunctionOfTheDatabase[] | undefined
    try {
        existing = readFunctions() as SqliteFunctionOfTheDatabase[]
    } catch {
        existing = undefined
    }
    const skip = new Set((options?.skip ?? []).map(name => name.toLowerCase()))
    const has = (name: string, arity: number) => skip.has(name) || !!existing?.some(fn => String(fn.name).toLowerCase() === name && (Number(fn.narg) === arity || Number(fn.narg) === -1))
    return {
        scalar: sqliteScalarFunctions.filter(fn => !has(fn.name, fn.arity)),
        aggregate: sqliteAggregateFunctions.filter(fn => !has(fn.name, fn.arity)),
    }
}

/** The query that lists the functions of the database, run once by registerSqliteFunctions */
export const sqliteFunctionListQuery = 'select name, narg from pragma_function_list'
