import { TsSqlProcessingError } from '../TsSqlError.js'

/**
 * The digits of the text of a customDecimal sent to the database: its precision and scale as a decimal type counts
 * them (`-0012.50` is decimal(4, 2)) and its significant digits (`0.0120` has 2); undefined when it isn't a plain
 * decimal text (the type adapter of the user may send something else, which is left as it is).
 */
export function customDecimalDigitsOf(value: unknown): { precision: number, scale: number, significantDigits: number } | undefined {
    const match = typeof value === 'string' ? /^-?0*(\d*)(?:\.(\d+))?$/.exec(value) : null
    if (!match) {
        return undefined
    }
    const integerDigits = match[1]!
    const decimals = match[2] ?? ''
    const significant = (integerDigits + decimals).replace(/^0+/, '').replace(/0+$/, '')
    return { precision: Math.max(integerDigits.length, 1) + decimals.length, scale: decimals.length, significantDigits: significant.length }
}

/** Rejects the customDecimal value of the parameter at that index, which the decimals of the database can't hold */
export function rejectCustomDecimalParam(value: unknown, type: string, index: number, widestDecimal: string): never {
    throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type, paramIndex: index }, 'Invalid customDecimal value to send to the db: ' + value + ' doesn\'t fit the widest decimal of the database, ' + widestDecimal)
}
