import type { OptionalityOf, SourceOf, ValueSource, OperandOf } from './base.js'
import { EqualableType } from './equalable.js'
import type { IfValueSource } from './logical.js'
import type { CombinedOptionality } from './valueSource.js'
import { comparableValueSource } from '../utils/symbols.js'
import { exposeFilterOperations, filterOperation } from './filterOperations.js'
import type { NSource } from '../utils/sourceName.js'
import type { TypedValueSource } from './valueSource.js'
import { BooleanConditionType, BooleanType } from './logical.js'
import { __newSqlOperation1ValueSourceIfValueOrNoop } from '../nodes/ifValue.js'
import { getOptionalType2, getOptionalType3 } from '../nodes/operands.js'
import { __newSqlOperation1ValueSource, __newSqlOperation2ValueSource } from '../nodes/operations.js'

/** What a position that takes a value source of any data type with an order accepts (max, min) */
export interface IAnyComparableValueSource</*in|out*/ SOURCE extends NSource> extends TypedValueSource<SOURCE, any, any> {
    [comparableValueSource]: 'ComparableValueSource'
}

/**
 * A data type whose values have an order. A data type of the user extends it with its type name, as a value that only
 * the user knows (the library converts nothing and gives it no SQL data type):
 * `class VersionType extends ComparableType<Version, 'Version'> { static override readonly type = 'Version' }`
 */
export abstract class ComparableType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends EqualableType<VALUE_TYPE, TYPE_NAME> {
    declare [comparableValueSource]: 'ComparableValueSource'
    static override readonly [filterOperation] = exposeFilterOperations(this, EqualableType, [
        'lessThanIfValue', 'lessThan', 'greaterThanIfValue', 'greaterThan', 'lessOrEqualIfValue', 'lessOrEqual',
        'greaterOrEqualIfValue', 'greaterOrEqual',
    ], {
        // The names of version 1 that version 2 renamed: the systems that send a filter written for version 1 keep
        // working
        smaller: 'lessThan', smallerIfValue: 'lessThanIfValue', larger: 'greaterThan', largerIfValue: 'greaterThanIfValue',
        smallAs: 'lessOrEqual', smallAsIfValue: 'lessOrEqualIfValue', largeAs: 'greaterOrEqual',
        largeAsIfValue: 'greaterOrEqualIfValue', lessOrEquals: 'lessOrEqual', lessOrEqualsIfValue: 'lessOrEqualIfValue',
        greaterOrEquals: 'greaterOrEqual', greaterOrEqualsIfValue: 'greaterOrEqualIfValue',
    })
    declare [filterOperation]: (typeof ComparableType)[typeof filterOperation]
    /**
     * As `lessThan`, but the condition disappears when the value is missing: null, undefined, an empty string (unless
     * the connection allows empty strings) or an empty array
     */
    lessThanIfValue(value: VALUE_TYPE | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    lessThanIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_lessThan', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /** Whether this value is less than the one given, SQL `<` */
    lessThan(value: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /** Whether this value is less than the one given, SQL `<` */
    lessThan<VALUE extends OperandOf<this>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    lessThan(value: any): any {
        return __newSqlOperation1ValueSource('_lessThan', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `greaterThan`, but the condition disappears when the value is missing: null, undefined, an empty string
     * (unless the connection allows empty strings) or an empty array
     */
    greaterThanIfValue(value: VALUE_TYPE | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    greaterThanIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_greaterThan', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /** Whether this value is greater than the one given, SQL `>` */
    greaterThan(value: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /** Whether this value is greater than the one given, SQL `>` */
    greaterThan<VALUE extends OperandOf<this>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    greaterThan(value: any): any {
        return __newSqlOperation1ValueSource('_greaterThan', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `lessOrEqual`, but the condition disappears when the value is missing: null, undefined, an empty string
     * (unless the connection allows empty strings) or an empty array
     */
    lessOrEqualIfValue(value: VALUE_TYPE | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    lessOrEqualIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_lessOrEqual', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /** Whether this value is less than or equal to the one given, SQL `<=` */
    lessOrEqual(value: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /** Whether this value is less than or equal to the one given, SQL `<=` */
    lessOrEqual<VALUE extends OperandOf<this>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    lessOrEqual(value: any): any {
        return __newSqlOperation1ValueSource('_lessOrEqual', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * As `greaterOrEqual`, but the condition disappears when the value is missing: null, undefined, an empty string
     * (unless the connection allows empty strings) or an empty array
     */
    greaterOrEqualIfValue(value: VALUE_TYPE | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    greaterOrEqualIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_greaterOrEqual', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /** Whether this value is greater than or equal to the one given, SQL `>=` */
    greaterOrEqual(value: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /** Whether this value is greater than or equal to the one given, SQL `>=` */
    greaterOrEqual<VALUE extends OperandOf<this>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    greaterOrEqual(value: any): any {
        return __newSqlOperation1ValueSource('_greaterOrEqual', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * Whether this value is between the two given, both included, SQL `between`: the same as
     * `value >= value1 and value <= value2`. With the first bound greater than the second nothing
     * matches
     */
    between(value: VALUE_TYPE, value2: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether this value is between the two given, both included, SQL `between`: the same as
     * `value >= value1 and value <= value2`. With the first bound greater than the second nothing
     * matches
     */
    between<VALUE2 extends OperandOf<this>>(value: VALUE_TYPE, value2: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE2>>>
    /**
     * Whether this value is between the two given, both included, SQL `between`: the same as
     * `value >= value1 and value <= value2`. With the first bound greater than the second nothing
     * matches
     */
    between<VALUE extends OperandOf<this>>(value: VALUE, value2: VALUE_TYPE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    /**
     * Whether this value is between the two given, both included, SQL `between`: the same as
     * `value >= value1 and value <= value2`. With the first bound greater than the second nothing
     * matches
     */
    between<VALUE extends OperandOf<this>, VALUE2 extends OperandOf<this>>(value: VALUE, value2: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE> | SourceOf<VALUE2>, BooleanType, CombinedOptionality<CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>, OptionalityOf<VALUE2>>>
    between(value: any, value2: any): any {
        return __newSqlOperation2ValueSource('_between', this, value, value2, BooleanConditionType, getOptionalType3(this, value, value2))
    }
    /**
     * Whether this value is out of the two given, SQL `not between`: less than the first or
     * greater than the second
     */
    notBetween(value: VALUE_TYPE, value2: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether this value is out of the two given, SQL `not between`: less than the first or
     * greater than the second
     */
    notBetween<VALUE2 extends OperandOf<this>>(value: VALUE_TYPE, value2: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE2>>>
    /**
     * Whether this value is out of the two given, SQL `not between`: less than the first or
     * greater than the second
     */
    notBetween<VALUE extends OperandOf<this>>(value: VALUE, value2: VALUE_TYPE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    /**
     * Whether this value is out of the two given, SQL `not between`: less than the first or
     * greater than the second
     */
    notBetween<VALUE extends OperandOf<this>, VALUE2 extends OperandOf<this>>(value: VALUE, value2: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE> | SourceOf<VALUE2>, BooleanType, CombinedOptionality<CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>, OptionalityOf<VALUE2>>>
    notBetween(value: any, value2: any): any {
        return __newSqlOperation2ValueSource('_notBetween', this, value, value2, BooleanConditionType, getOptionalType3(this, value, value2))
    }
}
