import { isValueSource } from './NodeStrategy.js'

/**
 * The date a month of a year or a day of a month was taken from with toPlainYearMonth or toPlainMonthDay, which has the
 * same year, month and day as that value, instead of the date of its reference computed from it; the value otherwise
 */
export function __dateOfCalendarValue<T>(valueSource: T): T {
    const operation = (valueSource as { __operation?: unknown }).__operation
    if (isValueSource(valueSource) && (operation === '_toPlainYearMonth' || operation === '_toPlainMonthDay')) {
        return (valueSource as unknown as { __valueSource: T }).__valueSource
    }
    return valueSource
}
