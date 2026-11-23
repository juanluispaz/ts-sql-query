import type { SqlDataType } from '../TypeAdapter.js'

/*
 * The values of an exact decimal: its text, with a point as the decimal separator and without an exponent
 * (`-12.50`); a dnum, the tuple of the integer of its digits and the number of its decimals (`[-1250n, 2]`,
 * https://github.com/bpierre/dnum); and a scaled bigint, the integer of its digits with the scale of its data type
 * (`-1250n` with the scale 2). They keep the decimals as given: `1.50` has 2, `1.5` has 1. The number of decimals is
 * 0 or more, as dnum has it: an integer is its digits, also of a column of a negative scale (`numeric(7, -2)` gives
 * `12300`), as the database writes it.
 */

/** Whether the value is a dnum: a bigint and a number of decimals that is a safe integer, 0 or more */
export function isDnumValue(value: unknown): value is readonly [bigint, number] {
    if (!Array.isArray(value) || value.length !== 2) {
        return false
    }
    const decimals: unknown = value[1]
    return typeof value[0] === 'bigint' && typeof decimals === 'number' && Number.isSafeInteger(decimals) && decimals >= 0
}

/** The text of a dnum, with all its decimals: `[-1250n, 2]` is `-12.50`, `[5n, 3]` is `0.005`, `[12n, 0]` is `12` */
export function textOfDnum(value: readonly [bigint, number]): string {
    return textOfScaledDigits(value[0], value[1])
}

/**
 * The text of the integer of the digits of an exact decimal with that scale, 0 or more: `-1250n` with 2 is `-12.50`,
 * `5n` with 3 is `0.005`, `12n` with 0 is `12`
 */
export function textOfScaledDigits(digits: bigint, decimals: number): string {
    if (decimals === 0) {
        return digits.toString()
    }
    const negative = digits < 0n
    let text = (negative ? -digits : digits).toString()
    if (text.length <= decimals) {
        text = '0'.repeat(decimals - text.length + 1) + text
    }
    const point = text.length - decimals
    return (negative ? '-' : '') + text.substring(0, point) + '.' + text.substring(point)
}

/**
 * The integer of the digits of the text of an exact decimal with that scale, 0 or more (`-12.50` with 2 is `-1250n`,
 * `1.5` with 2 is `150n`), or undefined when the text has a digit other than a zero beyond the scale, which the value
 * can't keep
 */
export function scaledDigitsOfText(text: string, scale: number): bigint | undefined {
    const point = text.indexOf('.')
    const integerPart = point < 0 ? text : text.substring(0, point)
    const fraction = point < 0 ? '' : text.substring(point + 1)
    if (fraction.length <= scale) {
        return BigInt(integerPart + fraction + '0'.repeat(scale - fraction.length))
    }
    for (let i = scale, length = fraction.length; i < length; i++) {
        if (fraction.charCodeAt(i) !== 48 /* 0 */) {
            return undefined
        }
    }
    return BigInt(integerPart + fraction.substring(0, scale))
}

/** The dnum of the text of an exact decimal (`-12.50` is `[-1250n, 2]`), with as many decimals as the text has */
export function dnumOfText(text: string): readonly [bigint, number] {
    const point = text.indexOf('.')
    if (point < 0) {
        return [BigInt(text), 0]
    }
    return [BigInt(text.substring(0, point) + text.substring(point + 1)), text.length - point - 1]
}

/**
 * The number of decimals the SQL data type says a value has (the scale of a `numeric(18, 4)`; none for a negative
 * scale, as `numeric(5, -2)`, whose values are integers), or undefined when it doesn't say it
 */
export function decimalsOfSqlDataType(sqlDataType: SqlDataType | undefined): number | undefined {
    if (sqlDataType?.family !== 'exact numeric') {
        return undefined
    }
    const scale = sqlDataType.scale
    if (scale === undefined || !Number.isSafeInteger(scale)) {
        return undefined
    }
    return scale < 0 ? 0 : scale
}

/**
 * The text of an exact decimal with the number of decimals given: zeros added at its end up to them, or the zeros at
 * its end beyond them removed. A digit other than a zero beyond them is kept: the value never loses a digit
 * (`1.5` with 2 is `1.50`, `1.500` with 2 is `1.50`, `1.505` with 2 stays `1.505`, `2.00` with 0 is `2`)
 */
export function exactDecimalTextWithDecimals(text: string, decimals: number): string {
    const point = text.indexOf('.')
    const current = point < 0 ? 0 : text.length - point - 1
    if (current === decimals) {
        return text
    }
    if (current < decimals) {
        return (point < 0 ? text + '.' : text) + '0'.repeat(decimals - current)
    }
    // More decimals than the ones given: only the zeros at the end beyond them go
    let end = text.length
    const limit = point + 1 + decimals
    while (end > limit && text.charCodeAt(end - 1) === 48 /* 0 */) {
        end--
    }
    if (end === point + 1) {
        // Every decimal was a zero, and none is wanted: the point goes too
        end = point
    }
    return end === text.length ? text : text.substring(0, end)
}
