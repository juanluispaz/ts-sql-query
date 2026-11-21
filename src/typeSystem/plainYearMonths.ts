import type { SqlDataType } from '../TypeAdapter.js'
import { ComparableType } from './comparable.js'
import { EqualableType } from './equalable.js'
import { localDateSqlDataType } from './localDates.js'
import type { TemporalPlainMonthDay, TemporalPlainYearMonth } from './temporal.js'
import type { OptionalityOf, SourceOf, ValueSource } from './base.js'
import type { SqlFunction0 } from '../sqlBuilders/SqlBuilder.js'
import { __operation0 } from '../nodes/operations.js'
import { IntType } from './number.js'
import { StringType } from './strings.js'

/*
 * A month of a year (plainYearMonth, a Temporal.PlainYearMonth) and a day of a month (plainMonthDay, a
 * Temporal.PlainMonthDay), as Temporal has them. No database has a type for them: each is kept in a date, the one of its
 * reference, as Temporal keeps it inside (the 1st of the month for a month of a year, the year 1972, a leap year, for a
 * day of a month), so the database compares, orders and computes with its own dates.
 */

/** A part of the date of the value: an int */
function partOf(valueSource: unknown, operation: keyof SqlFunction0): any {
    return __operation0(valueSource as any, operation, IntType)
}

/**
 * The family of a month of a year whose value is like a Temporal.PlainYearMonth, compared and ordered as Temporal
 * compares them. A data type of the user extends it with its type name, sent and read as one:
 * `class BillingMonthType extends PlainYearMonthsType<BillingMonth, 'BillingMonth'> { static override readonly type = 'BillingMonth' }`
 */
export abstract class PlainYearMonthsType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE, TYPE_NAME> {
    static override readonly sqlDataType: SqlDataType | undefined = localDateSqlDataType

    /** The year, as an int: Temporal's `year` */
    year(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    year(): any {
        return partOf(this, '_year')
    }
    /** The month, from 1 (January) to 12, as an int: Temporal's `month` */
    month(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    month(): any {
        return partOf(this, '_month')
    }
    /** The code of the month, `'M01'` to `'M12'`: Temporal's `monthCode` */
    monthCode(): ValueSource<SourceOf<this>, StringType, OptionalityOf<this>>
    monthCode(): any {
        return __operation0(this as any, '_monthCode', StringType)
    }
}

/**
 * The family of a day of a month whose value is like a Temporal.PlainMonthDay, compared only for equality, as Temporal
 * has no order of them. A data type of the user extends it with its type name, sent and read as one:
 * `class AnniversaryType extends PlainMonthDaysType<Anniversary, 'Anniversary'> { static override readonly type = 'Anniversary' }`
 */
export abstract class PlainMonthDaysType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends EqualableType<VALUE_TYPE, TYPE_NAME> {
    static override readonly sqlDataType: SqlDataType | undefined = localDateSqlDataType

    /** The code of the month, `'M01'` to `'M12'`: Temporal's `monthCode` (a Temporal.PlainMonthDay has no `month`) */
    monthCode(): ValueSource<SourceOf<this>, StringType, OptionalityOf<this>>
    monthCode(): any {
        return __operation0(this as any, '_monthCode', StringType)
    }
    /** The day of the month, from 1 to 31, as an int: Temporal's `day` */
    day(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    day(): any {
        return partOf(this, '_day')
    }
}

/** A month of a year, a Temporal.PlainYearMonth */
export abstract class PlainYearMonthType extends PlainYearMonthsType<TemporalPlainYearMonth, 'plainYearMonth'> {
    static override readonly type = 'plainYearMonth'
}

/** A day of a month, a Temporal.PlainMonthDay */
export abstract class PlainMonthDayType extends PlainMonthDaysType<TemporalPlainMonthDay, 'plainMonthDay'> {
    static override readonly type = 'plainMonthDay'
}
