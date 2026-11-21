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
 * - tsq_duration_part, a part of the ISO 8601 text of a duration, to add or subtract a duration kept as its text.
 * - tsq_duration_text, the ISO 8601 text of a duration of its fields, to write a duration a query computes (until,
 *   since).
 * - tsq_duration_round, the duration from one date and time to another rounded to the calendar, as Temporal's until
 *   with a largest unit of weeks, months or years and a rounding.
 *
 * How they are registered, and why:
 *
 * - Every function but uuid() is deterministic: the same arguments give the same result. They are registered as
 *   deterministic, which SQLite requires to use a function in an index on an expression, a partial index or a generated
 *   column (an index on tsq_decimal_key(column) serves the comparisons of an exact decimal). uuid() isn't: each call
 *   gives a new value.
 * - None is registered as direct only (SQLITE_DIRECTONLY): that flag forbids a function in views, triggers, CHECK
 *   constraints, defaults and indexes, which is where a user may want these.
 * - On sqlite-wasm the deterministic ones are also innocuous (SQLITE_INNOCUOUS: no side effects, nothing but their
 *   arguments), so a database with trusted_schema off still uses them in its schema; the other drivers have no such
 *   option. On sqlite-wasm the number of arguments is given explicitly, because it would otherwise be taken from the
 *   length of the JavaScript function.
 * - decimal_sum is also a window function (it can take out a row that leaves the frame). tsq_decimal_min and
 *   tsq_decimal_max aren't: taking out a row needs every value of the frame in the state, and the same registration is
 *   the plain aggregate, whose state would then grow with the whole group.
 * - registerSqliteFunctions reads the functions the database already has (pragma function_list) once, when it is
 *   called: it is a setup call the user makes, not a query added to the ones the user runs.
 * - A decimal function the database already has with the same name and number of arguments (the real decimal
 *   extension, written in C, exact and faster) is left as it is, and so is a ci_replace the user registered (it may
 *   be a replace on purpose different, like one aware of more of Unicode). The uuid functions are always registered,
 *   replacing the ones the database has: the SQLite of some platforms (macOS) ships the uuid extension, whose uuid()
 *   generates version 4 UUIDs, which don't sort by the time they were generated. The skip option keeps any of them.
 * - uuid() takes the version 7 UUIDs of the runtime only on Bun (Bun.randomUUIDv7), whose UUIDs generated in the same
 *   millisecond keep their order; Node's randomUUIDv7 (node:crypto, Node 24 and later) doesn't keep it (measured:
 *   about half of 100,000 UUIDs generated in a row come out of order), so on Node, and anywhere else, the UUIDs come
 *   from the library's generator, which keeps it.
 */

import type { SqliteFunctionsOptions } from '../../connections/SqliteConfiguration.js'

/** A scalar SQL function */
export interface SqliteScalarFunction {
    readonly name: string
    readonly arity: number
    readonly deterministic: boolean
    /** Registered even when the database already has a function with its name and number of arguments */
    readonly replacesExisting?: boolean | undefined
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

// The generator of version 7 UUIDs of Bun, looked for the first time one is generated
let runtimeUuidV7: (() => string) | null | undefined

/**
 * A version 7 UUID: from Bun (Bun.randomUUIDv7) on Bun, else from the library. Node's randomUUIDv7 isn't used: the
 * UUIDs it generates in the same millisecond don't keep their order.
 */
function uuidV7(): string {
    if (runtimeUuidV7 === undefined) {
        const bun = (globalThis as { Bun?: { randomUUIDv7?: () => string } }).Bun
        if (typeof bun?.randomUUIDv7 === 'function') {
            const randomUUIDv7 = bun.randomUUIDv7
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

// Durations

/**
 * tsq_duration_part: a part of the ISO 8601 text of a duration, as the same function of the library on the other
 * databases reads it: 'M' the months (its years too), 'D' the days (its weeks too), 'S' the whole seconds of its time,
 * 'N' the nanoseconds of the second; 'years', 'months', 'weeks', 'days', 'hours', 'minutes' and 'seconds' (without its
 * fraction) each field as written; each with the sign of the duration; 'sign' the sign of the duration (-1, 0 or 1);
 * 'largest' the largest field that isn't zero (0 the years ... 6 the seconds, 7 the milliseconds, 8 the microseconds, 9
 * the nanoseconds; 10 for a duration of zero); null for a null text
 */
function durationPart(value: unknown, part: unknown): number | null {
    if (value === null || value === undefined) {
        return null
    }
    const text = String(value).trim().toUpperCase()
    let i = 0
    let sign = 1
    if (text[0] === '-' || text[0] === '+') {
        sign = text[0] === '-' ? -1 : 1
        i = 1
    }
    i++
    let number = ''
    let inTime = false
    let result = 0
    let nonzero = false
    let largest = 10
    for (; i < text.length; i++) {
        const c = text[i]!
        if (c === 'T') {
            inTime = true
        } else if ('0123456789.,'.includes(c)) {
            number += c === ',' ? '.' : c
        } else {
            const whole = Number(number.split('.')[0] || '0')
            if (/[1-9]/.test(number)) {
                nonzero = true
                const fraction = Number(((number.split('.')[1] ?? '') + '000000000').slice(0, 9))
                const index = c === 'Y' ? 0 : c === 'M' && !inTime ? 1 : c === 'W' ? 2 : c === 'D' ? 3 : c === 'H' ? 4 : c === 'M' ? 5
                    : whole !== 0 ? 6 : fraction >= 1_000_000 ? 7 : fraction >= 1000 ? 8 : 9
                largest = Math.min(largest, index)
            }
            if (part === 'M' && !inTime && c === 'Y') {
                result += 12 * whole
            } else if (part === 'M' && !inTime && c === 'M') {
                result += whole
            } else if (part === 'D' && c === 'W') {
                result += 7 * whole
            } else if (part === 'D' && c === 'D') {
                result += whole
            } else if (part === 'S' && inTime && c === 'H') {
                result += 3600 * whole
            } else if (part === 'S' && inTime && c === 'M') {
                result += 60 * whole
            } else if (part === 'S' && c === 'S') {
                result += whole
            } else if (part === 'N' && c === 'S' && number.includes('.')) {
                result = Number((number.split('.')[1]! + '000000000').slice(0, 9))
            } else if ((part === 'years' && !inTime && c === 'Y') || (part === 'months' && !inTime && c === 'M') || (part === 'weeks' && c === 'W') || (part === 'days' && c === 'D')
                || (part === 'hours' && inTime && c === 'H') || (part === 'minutes' && inTime && c === 'M') || (part === 'seconds' && c === 'S')) {
                result = whole
            }
            number = ''
        }
    }
    if (part === 'sign') {
        return nonzero ? sign : 0
    }
    if (part === 'largest') {
        return largest
    }
    return sign * result + 0
}

/** The absolute value of a bigint */
function absoluteBigint(value: bigint): bigint {
    return value < 0n ? -value : value
}

/** An integer argument of SQL as a bigint; null for null */
function bigintArgument(value: unknown): bigint | null {
    if (value === null || value === undefined) {
        return null
    }
    if (typeof value === 'string' && /^-?\d+$/.test(value)) {
        // An integer given as its text: a driver gives an integer beyond 2^53 to a function as a rounded number
        return BigInt(value)
    }
    return typeof value === 'bigint' ? value : BigInt(Math.trunc(Number(value)))
}

/**
 * tsq_duration_text: the ISO 8601 text of a duration of its fields, as Temporal's toString writes it, as the same
 * function of the library on the other databases: the years, months, weeks and days, and the nanoseconds of its time,
 * balanced up to the largest unit given: the months go to the years ('year'), the days of the time to the days ('day'),
 * and the weeks of the days to the weeks too ('week'); the time is written in hours, minutes and seconds ('week', 'day', 'hour'), minutes and seconds
 * ('minute') or seconds ('second'); every field with the sign of the duration; null when a field is null
 */
function durationText(years: unknown, months: unknown, weeks: unknown, days: unknown, nanoseconds: unknown, unit: unknown): string | null {
    if (typeof nanoseconds === 'string' && !/^-?\d+$/.test(nanoseconds)) {
        // The nanoseconds given as text are a real: SQLite turned an integer that overflowed its 64 bits (a difference
        // of more than 292 years) into one, which has lost digits
        throw new Error("tsq_duration_text: the nanoseconds of the time don't fit in the 64-bit integers of SQLite")
    }
    let y = bigintArgument(years)
    let mo = bigintArgument(months)
    let w = bigintArgument(weeks)
    let d = bigintArgument(days)
    let ns = bigintArgument(nanoseconds)
    if (y === null || mo === null || w === null || d === null || ns === null) {
        return null
    }
    if (unit === 'year') {
        y += mo / 12n
        mo %= 12n
    }
    if (unit === 'week' || unit === 'day') {
        d += ns / 86_400_000_000_000n
        ns %= 86_400_000_000_000n
        if (unit === 'week') {
            w += d / 7n
            d %= 7n
        }
    }
    const negative = y < 0n || mo < 0n || w < 0n || d < 0n || ns < 0n
    let date = ''
    if (y !== 0n) date += absoluteBigint(y) + 'Y'
    if (mo !== 0n) date += absoluteBigint(mo) + 'M'
    if (w !== 0n) date += absoluteBigint(w) + 'W'
    if (d !== 0n) date += absoluteBigint(d) + 'D'
    ns = absoluteBigint(ns)
    let time = ''
    if ((unit === 'week' || unit === 'day' || unit === 'hour') && ns >= 3_600_000_000_000n) {
        time += ns / 3_600_000_000_000n + 'H'
        ns %= 3_600_000_000_000n
    }
    if (unit !== 'second' && ns >= 60_000_000_000n) {
        time += ns / 60_000_000_000n + 'M'
        ns %= 60_000_000_000n
    }
    if (ns > 0n) {
        const fraction = ns % 1_000_000_000n
        time += String(ns / 1_000_000_000n) + (fraction > 0n ? '.' + String(fraction).padStart(9, '0').replace(/0+$/, '') : '') + 'S'
    }
    if (date === '' && time === '') {
        return 'PT0S'
    }
    return (negative ? '-' : '') + 'P' + date + (time === '' ? '' : 'T' + time)
}

/** The days from 1970-01-01 to a date of the proleptic Gregorian calendar */
function daysFromCivil(year: number, month: number, day: number): number {
    const y = month <= 2 ? year - 1 : year
    const era = Math.floor(y / 400)
    const yearOfEra = y - era * 400
    const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1
    const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear
    return era * 146097 + dayOfEra - 719468
}

/** The days of the month of the year */
function daysInMonth(year: number, month: number): number {
    if (month === 2) {
        return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28
    }
    return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31
}

/** The days from 1970-01-01 to the date plus the months, its day kept in the month (Jan 31 plus a month is Feb 29) */
function daysOfDatePlusMonths(year: number, month: number, day: number, months: number): number {
    const index = year * 12 + month - 1 + months
    const y = Math.floor(index / 12)
    const m = index - y * 12 + 1
    return daysFromCivil(y, m, Math.min(day, daysInMonth(y, m)))
}

/**
 * Whether the second value plus what a rounding added (the days from the end to it and the nanoseconds beyond) isn't
 * before the end, for a duration of the sign given
 */
function reachesEnd(sign: bigint, days: number, nanoseconds: bigint): boolean {
    return sign * (BigInt(days) * 86_400_000_000_000n + nanoseconds) >= 0n
}

/** Whether a value between r1 and r2 (at num of den beyond r1) is rounded to r2, by Temporal's mode and its sign */
function roundsAway(num: bigint, den: bigint, mode: string, negative: boolean, r1IsEven: boolean): boolean {
    if (num === 0n) {
        return false
    }
    if (num >= den) {
        return true
    }
    const unsigned = mode === 'ceil' ? (negative ? 'zero' : 'infinity') : mode === 'floor' ? (negative ? 'infinity' : 'zero')
        : mode === 'halfCeil' ? (negative ? 'halfZero' : 'halfInfinity') : mode === 'halfFloor' ? (negative ? 'halfInfinity' : 'halfZero')
            : mode === 'expand' ? 'infinity' : mode === 'trunc' ? 'zero' : mode === 'halfExpand' ? 'halfInfinity' : mode === 'halfTrunc' ? 'halfZero' : 'halfEven'
    if (unsigned === 'zero') {
        return false
    }
    if (unsigned === 'infinity') {
        return true
    }
    const twice = 2n * num
    if (twice !== den) {
        return twice > den
    }
    return unsigned === 'halfInfinity' || (unsigned === 'halfEven' && !r1IsEven)
}

const nanosecondsOfUnit: Record<string, bigint | undefined> = {
    day: 86_400_000_000_000n, hour: 3_600_000_000_000n, minute: 60_000_000_000n, second: 1_000_000_000n, millisecond: 1_000_000n, microsecond: 1000n, nanosecond: 1n,
}

/**
 * tsq_duration_round: the duration from one date and time (its year, month, day and nanoseconds of the day) to another,
 * as Temporal's until with a largest unit of weeks, months or years ('week', 'month', 'year') rounded to the smallest
 * unit, the increment and the mode given (the mode of until: since passes it negated, and -1 as sign to negate the
 * result), as Temporal rounds it to the calendar from the first date; its ISO 8601 text. A date is one at 00:00
 */
function durationRound(year1: unknown, month1: unknown, day1: unknown, nanoseconds1: unknown, year2: unknown, month2: unknown, day2: unknown, nanoseconds2: unknown, largestUnit: unknown, smallestUnit: unknown, roundingIncrement: unknown, roundingMode: unknown, negation: unknown): string | null {
    const ns1 = bigintArgument(nanoseconds1)
    const ns2 = bigintArgument(nanoseconds2)
    const increment = bigintArgument(roundingIncrement)
    const resultSign = bigintArgument(negation)
    if (year1 === null || month1 === null || day1 === null || year2 === null || month2 === null || day2 === null || ns1 === null || ns2 === null || increment === null || resultSign === null) {
        return null
    }
    const y1 = Number(year1)
    const m1 = Number(month1)
    const d1 = Number(day1)
    const y2 = Number(year2)
    const m2 = Number(month2)
    const d2 = Number(day2)
    const largest = String(largestUnit)
    const smallest = String(smallestUnit)
    const mode = String(roundingMode)
    const day = 86_400_000_000_000n
    const e1 = daysFromCivil(y1, m1, d1)
    const e2 = daysFromCivil(y2, m2, d2)
    // The date of the second value moved a day when its time has the sign its date hasn't
    let time = ns2 - ns1
    let e2Adjusted = e2
    if (time > 0n && e2 < e1) {
        e2Adjusted = e2 + 1
        time -= day
    } else if (time < 0n && e2 > e1) {
        e2Adjusted = e2 - 1
        time += day
    }
    let years = 0n
    let months = 0n
    let weeks = 0n
    let days: bigint
    if (largest === 'week') {
        const allDays = BigInt(e2Adjusted - e1)
        weeks = allDays / 7n
        days = allDays - weeks * 7n
    } else {
        // The whole months that don't pass the second date with the day of the first one
        const z = e2Adjusted + 719468
        const era = Math.floor(z / 146097)
        const dayOfEra = z - era * 146097
        const yearOfEra = Math.floor((dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365)
        const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100))
        const mp = Math.floor((5 * dayOfYear + 2) / 153)
        const dA = dayOfYear - Math.floor((153 * mp + 2) / 5) + 1
        const mA = mp < 10 ? mp + 3 : mp - 9
        const yA = yearOfEra + era * 400 + (mA <= 2 ? 1 : 0)
        const k = Math.trunc(((yA * 12 + mA) * 32 + dA - (y1 * 12 + m1) * 32 - d1) / 32)
        years = largest === 'year' ? BigInt(Math.trunc(k / 12)) : 0n
        months = BigInt(k) - years * 12n
        days = BigInt(e2Adjusted - daysOfDatePlusMonths(y1, m1, d1, k))
    }
    const sign = (BigInt(e2 - e1) * day + ns2 - ns1) < 0n ? -1n : 1n
    if (smallest === 'year' || smallest === 'month' || smallest === 'week') {
        let r1: bigint
        let startMonths = years * 12n + months
        let endMonths = startMonths
        let startWeeks = 0n
        let endWeeks = 0n
        if (smallest === 'year') {
            r1 = years / increment * increment
            startMonths = r1 * 12n
            endMonths = (r1 + increment * sign) * 12n
        } else if (smallest === 'month') {
            r1 = months / increment * increment
            startMonths = years * 12n + r1
            endMonths = startMonths + increment * sign
        } else {
            r1 = (largest === 'week' ? weeks : days / 7n) / increment * increment
            startWeeks = r1
            endWeeks = r1 + increment * sign
        }
        const start = daysOfDatePlusMonths(y1, m1, d1, Number(startMonths)) + Number(startWeeks) * 7
        const end = daysOfDatePlusMonths(y1, m1, d1, Number(endMonths)) + Number(endWeeks) * 7
        let num = BigInt(e2 - start) * day + ns2 - ns1
        let den = BigInt(end - start) * day
        num = num < 0n ? -num : num
        den = den < 0n ? -den : den
        // The progress from r1 in increments, rounded: past r2 when the second value is beyond it
        const whole = num / den
        const rest = num - whole * den
        const steps = whole + (rest !== 0n && roundsAway(rest, den, mode, sign < 0n, ((r1 < 0n ? -r1 : r1) / increment + whole) % 2n === 0n) ? 1n : 0n)
        const units = r1 + increment * sign * steps
        const up = steps > 0n
        days = 0n
        time = 0n
        if (smallest === 'year') {
            years = units
            months = 0n
        } else if (smallest === 'month') {
            months = units
            if (up && largest === 'year' && sign * BigInt(daysOfDatePlusMonths(y1, m1, d1, Number(years * 12n + units)) - daysOfDatePlusMonths(y1, m1, d1, Number((years + sign) * 12n))) >= 0n) {
                years += sign
                months = 0n
            }
        } else {
            weeks = units
        }
    } else {
        // The days and the time rounded, and the next week, month or year when that reaches it
        const step = nanosecondsOfUnit[smallest]! * increment
        const toRound = days * day + time
        const remainder = toRound % step
        let rounded = toRound - remainder
        if (remainder !== 0n) {
            const up = roundsAway(remainder < 0n ? -remainder : remainder, step, mode, toRound < 0n, (rounded / step) % 2n === 0n)
            if (up) {
                rounded += step * (toRound < 0n ? -1n : 1n)
            }
        }
        const expanded = rounded / day !== toRound / day
        days = rounded / day
        time = rounded - days * day
        if (expanded && largest === 'week' && reachesEnd(sign, e2 - (e1 + Number(weeks + sign) * 7), ns2 - ns1 + rounded - toRound)) {
            weeks += sign
            days = 0n
            time = 0n
        } else if (expanded && largest !== 'week' && reachesEnd(sign, e2 - daysOfDatePlusMonths(y1, m1, d1, Number(years * 12n + months + sign)), ns2 - ns1 + rounded - toRound)) {
            days = 0n
            time = 0n
            if (largest === 'year' && reachesEnd(sign, e2 - daysOfDatePlusMonths(y1, m1, d1, Number((years + sign) * 12n)), ns2 - ns1 + rounded - toRound)) {
                years += sign
                months = 0n
            } else {
                months += sign
            }
        }
    }
    return durationText(years * resultSign, months * resultSign, weeks * resultSign, days * resultSign, time * resultSign, 'hour')
}

/**
 * a / b (b positive) as a double rounded once, to the nearest (ties to even), as Temporal divides: the integer q from
 * 2^52 to 2^53 and the exponent s with q * 2^-s the nearest to a / b, computed with integers
 */
function exactQuotient(a: bigint, b: bigint): number {
    if (a === 0n) {
        return 0
    }
    let x = absoluteBigint(a)
    let y = b
    let s = 0
    const low = 2n ** 52n
    const high = 2n ** 53n
    while (x >= y * high) {
        y *= 2n
        s--
    }
    while (x < y * low) {
        x *= 2n
        s++
    }
    let q = x / y
    const twice = 2n * (x - q * y)
    if (twice > y || (twice === y && q % 2n === 1n)) {
        q += 1n
    }
    const result = Number(q) * Math.pow(2, -s)
    return a < 0n ? -result : result
}

/**
 * tsq_duration_total: a duration (its months, its years too; its weeks; its days; the whole seconds of its time and the
 * nanoseconds of the second, each with the sign of the duration) in a unit ('year' ... 'nanosecond'), as Temporal's
 * total, as the same function of the library on the other databases. With a date of reference (its year, month and
 * day; 0, 0, 0 without one) the duration is added to it, the months first and the day kept in the month, and the unit
 * counted from it, a month or a year with the days of the calendar there; without one a day is 24 hours, and a
 * duration with months or weeks, or a unit of them, is an error. A double, rounded once; null when an argument is null
 */
function durationTotal(months: unknown, weeks: unknown, days: unknown, seconds: unknown, nanoseconds: unknown, year: unknown, month: unknown, dayOfMonth: unknown, unit: unknown): number | null {
    if (typeof nanoseconds === 'string' && !/^-?\d+$/.test(nanoseconds)) {
        // The nanoseconds of a difference given as text are a real: SQLite turned an integer that overflowed its 64 bits
        // (a difference of more than 292 years) into one, which has lost digits
        throw new Error("tsq_duration_total: the nanoseconds of the time don't fit in the 64-bit integers of SQLite")
    }
    const mo = bigintArgument(months)
    const w = bigintArgument(weeks)
    const d = bigintArgument(days)
    const sec = bigintArgument(seconds)
    const ns = bigintArgument(nanoseconds)
    if (mo === null || w === null || d === null || sec === null || ns === null || year === null || month === null || dayOfMonth === null || unit === null) {
        return null
    }
    const y1 = Number(year)
    const m1 = Number(month)
    const d1 = Number(dayOfMonth)
    const name = String(unit)
    const day = 86_400_000_000_000n
    const calendar = name === 'year' || name === 'month' || name === 'week'
    if (m1 === 0) {
        if (mo !== 0n || w !== 0n || calendar) {
            throw new Error('tsq_duration_total: a duration with years, months or weeks, or a total in years, months or weeks, needs a date of reference')
        }
        return exactQuotient((d * 86_400n + sec) * 1_000_000_000n + ns, nanosecondsOfUnit[name]!)
    }
    // The duration added to the date at 00:00: the months, then the days, the weeks and the whole days of the time
    const time = sec * 1_000_000_000n + ns
    let overflow = time / day
    if (time - overflow * day < 0n) {
        overflow -= 1n
    }
    const timeOfDay = time - overflow * day
    const e1 = daysFromCivil(y1, m1, d1)
    const e2 = daysOfDatePlusMonths(y1, m1, d1, Number(mo)) + Number(w * 7n + d + overflow)
    if (!calendar) {
        return exactQuotient(BigInt(e2 - e1) * day + timeOfDay, nanosecondsOfUnit[name]!)
    }
    if (e2 === e1 && timeOfDay === 0n) {
        return 0
    }
    // The whole units from the date to the end without passing it (as until), and the progress to the next one
    const e2Adjusted = timeOfDay > 0n && e2 < e1 ? e2 + 1 : e2
    const sign = BigInt(e2 - e1) * day + timeOfDay < 0n ? -1 : 1
    let r1: number
    if (name === 'week') {
        r1 = Math.trunc((e2Adjusted - e1) / 7)
    } else {
        const z = e2Adjusted + 719468
        const era = Math.floor(z / 146097)
        const dayOfEra = z - era * 146097
        const yearOfEra = Math.floor((dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365)
        const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100))
        const mp = Math.floor((5 * dayOfYear + 2) / 153)
        const dA = dayOfYear - Math.floor((153 * mp + 2) / 5) + 1
        const mA = mp < 10 ? mp + 3 : mp - 9
        const yA = yearOfEra + era * 400 + (mA <= 2 ? 1 : 0)
        const k = Math.trunc(((yA * 12 + mA) * 32 + dA - (y1 * 12 + m1) * 32 - d1) / 32)
        r1 = name === 'month' ? k : Math.trunc(k / 12)
    }
    let start = unitsFrom(y1, m1, d1, e1, name, r1)
    let end = unitsFrom(y1, m1, d1, e1, name, r1 + sign)
    if (absoluteBigint(BigInt(e2 - start) * day + timeOfDay) >= absoluteBigint(BigInt(end - start) * day)) {
        // The end beyond the next unit (the day of the date wasn't in the month of the end): from that unit
        r1 += sign
        start = end
        end = unitsFrom(y1, m1, d1, e1, name, r1 + sign)
    }
    const den = absoluteBigint(BigInt(end - start) * day)
    return exactQuotient(BigInt(r1) * den + BigInt(sign) * absoluteBigint(BigInt(e2 - start) * day + timeOfDay), den)
}

/**
 * tsq_duration_add: the sum of two durations, the second times sign (1 to add it, -1 to subtract it), each given by its
 * largest field that isn't zero (tsq_duration_part 'largest'), its days, the whole seconds of its time and the
 * nanoseconds of the second, each with its sign, as Temporal's add and subtract, as the same function of the library on
 * the other databases: a duration with years, months or weeks is an error, a day is 24 hours, and the sum is balanced up
 * to the largest field of the two; its ISO 8601 text. Null when an argument is null
 */
function durationAdd(largest1: unknown, days1: unknown, seconds1: unknown, nanoseconds1: unknown, largest2: unknown, days2: unknown, seconds2: unknown, nanoseconds2: unknown, sign: unknown): string | null {
    const d1 = bigintArgument(days1)
    const s1 = bigintArgument(seconds1)
    const n1 = bigintArgument(nanoseconds1)
    const d2 = bigintArgument(days2)
    const s2 = bigintArgument(seconds2)
    const n2 = bigintArgument(nanoseconds2)
    const k = bigintArgument(sign)
    if (largest1 === null || largest2 === null || d1 === null || s1 === null || n1 === null || d2 === null || s2 === null || n2 === null || k === null) {
        return null
    }
    const largest = Math.min(Number(largest1), Number(largest2))
    if (largest <= 2) {
        throw new Error("tsq_duration_add: a duration with years, months or weeks can't be added nor subtracted")
    }
    const day = 86_400_000_000_000n
    const total = (d1 + k * d2) * day + (s1 + k * s2) * 1_000_000_000n + n1 + k * n2
    const days = largest === 3 ? total / day : 0n
    return durationText(0n, 0n, 0n, days, total - days * day, largest <= 4 ? 'hour' : largest === 5 ? 'minute' : 'second')
}

/** The days from 1970-01-01 to a date plus a number of weeks, months or years ('week', 'month', 'year'), the day kept in the month */
function unitsFrom(year: number, month: number, day: number, days: number, unit: string, units: number): number {
    return unit === 'week' ? days + 7 * units : daysOfDatePlusMonths(year, month, day, unit === 'month' ? units : 12 * units)
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
    { name: 'uuid', arity: 0, deterministic: false, replacesExisting: true, fn: uuidV7 },
    { name: 'uuid_str', arity: 1, deterministic: pure, replacesExisting: true, fn: uuidStr as SqliteScalarFunction['fn'] },
    { name: 'uuid_blob', arity: 1, deterministic: pure, replacesExisting: true, fn: uuidBlob as SqliteScalarFunction['fn'] },
    { name: 'ci_replace', arity: 3, deterministic: pure, fn: ciReplace as SqliteScalarFunction['fn'] },
    { name: 'tsq_duration_part', arity: 2, deterministic: pure, fn: durationPart as SqliteScalarFunction['fn'] },
    { name: 'tsq_duration_text', arity: 6, deterministic: pure, fn: durationText as SqliteScalarFunction['fn'] },
    { name: 'tsq_duration_round', arity: 13, deterministic: pure, fn: durationRound as SqliteScalarFunction['fn'] },
    { name: 'tsq_duration_total', arity: 9, deterministic: pure, fn: durationTotal as SqliteScalarFunction['fn'] },
    { name: 'tsq_duration_add', arity: 9, deterministic: pure, fn: durationAdd as SqliteScalarFunction['fn'] },
]

export const sqliteAggregateFunctions: readonly SqliteAggregateFunction[] = [
    { name: 'decimal_sum', arity: 1, step: decimalSumStep, inverse: decimalSumInverse, result: decimalSumResult },
    { name: 'tsq_decimal_min', arity: 1, step: decimalMinStep, result: decimalChoiceResult },
    { name: 'tsq_decimal_max', arity: 1, step: decimalMaxStep, result: decimalChoiceResult },
]

/** A function of the database, as pragma function_list gives it */
interface SqliteFunctionOfTheDatabase { readonly name: unknown, readonly narg: unknown }

/**
 * The functions to register: the ones of the library that the options don't skip, except the ones the database already
 * has with the same name and number of arguments (a function with a variable number of arguments, narg -1, takes any)
 * and that don't replace an existing one (the uuid functions do). readFunctions runs sqliteFunctionListQuery on the
 * database; when the list can't be read, every one the options don't skip.
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
        scalar: sqliteScalarFunctions.filter(fn => fn.replacesExisting ? !skip.has(fn.name) : !has(fn.name, fn.arity)),
        aggregate: sqliteAggregateFunctions.filter(fn => !has(fn.name, fn.arity)),
    }
}

/** The query that lists the functions of the database, run once by registerSqliteFunctions */
export const sqliteFunctionListQuery = 'select name, narg from pragma_function_list'
