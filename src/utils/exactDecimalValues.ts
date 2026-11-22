import type { SqlDataType } from '../TypeAdapter.js'

/*
 * The values of an exact decimal: its text, with a point as the decimal separator and without an exponent
 * (`-12.50`), and a dnum, the tuple of the integer of its digits and the number of its decimals
 * (`[-1250n, 2]`, https://github.com/bpierre/dnum). Both keep the decimals as given: `1.50` has 2, `1.5` has 1.
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
    const digits = value[0]
    const decimals = value[1]
    const negative = digits < 0n
    let text = (negative ? -digits : digits).toString()
    if (decimals === 0) {
        return negative ? '-' + text : text
    }
    if (text.length <= decimals) {
        text = '0'.repeat(decimals - text.length + 1) + text
    }
    const point = text.length - decimals
    return (negative ? '-' : '') + text.substring(0, point) + '.' + text.substring(point)
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
 * The number of decimals the SQL data type says a value has (the scale of a `numeric(18, 4)`), or undefined when it
 * doesn't say it
 */
export function decimalsOfSqlDataType(sqlDataType: SqlDataType | undefined): number | undefined {
    if (sqlDataType?.family !== 'exact numeric') {
        return undefined
    }
    const scale = sqlDataType.scale
    if (scale === undefined || !Number.isSafeInteger(scale) || scale < 0) {
        return undefined
    }
    return scale
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
