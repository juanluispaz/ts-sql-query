import type { OptionalityOf, SourceOf, ValueSource, OperandOf, DataTypeOfClass } from './base.js'
import { NullableType } from './nullable.js'
import type { BooleanType, IfValueSource } from './logical.js'
import type { IExecutableSelectQuery, CombinedOptionality, CombinedOptionalityOfUnion, OptionalType } from './valueSource.js'
import type { NSource } from '../utils/sourceName.js'
import type { optionalType, source } from '../utils/symbols.js'
import type { operandTypeName, typeName } from '../utils/symbols.js'
import { ofStatics } from '../utils/symbols.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import { __dataTypeOfName, type OfStatics } from './dataTypeOfName.js'
import { exposeFilterOperations, filterOperation } from './filterOperations.js'
import { __newSqlOperation1ValueSourceIfValueOrNoop, __newSqlOperationInValueSourceIfValueOrNoop } from '../nodes/ifValue.js'
import { getOptionalType2, getOptionalTypeN, getOptionalTypeOfIn } from '../nodes/operands.js'
import { __newSqlOperation1ValueSource, __newSqlOperationInValueSource } from '../nodes/operations.js'
import { __internalDataType } from './dataTypeRegistry.js'

/**
 * A data type whose values can be compared for equality. A data type of the user extends it with its type name, as a
 * value that only the user knows (the library converts nothing and gives it no SQL data type):
 * `class StatusType extends EqualableType<Status, 'Status'> { static override readonly type = 'Status' }`
 */
export abstract class EqualableType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends NullableType<VALUE_TYPE> {
    declare [typeName]: `type:${TYPE_NAME}:`
    declare [operandTypeName]: `type:${TYPE_NAME}:`
    static override readonly [filterOperation] = exposeFilterOperations(this, NullableType, [
        'equalsIfValue', 'equals', 'notEqualsIfValue', 'notEquals', 'isIfValue', 'is', 'isNotIfValue', 'isNot',
        'inIfValue', 'in', 'notInIfValue', 'notIn',
    ])
    declare [filterOperation]: (typeof EqualableType)[typeof filterOperation]

    /**
     * The data type of a value of a type of yours that is only compared for equality, of that type name, for a
     * specific use, like a column: `this.column('color', EqualableType.of<Color, 'Color'>('Color'))`. Each family has
     * it, with what its data type needs (`EnumType.of` takes its values too); it gives the same class each time for the
     * same type name. A data type, like `IntType` or a class of yours, has no `of`
     */
    static of<VALUE_TYPE, TYPE_NAME extends string>(typeName: TYPE_NAME, ...options: never[]): DataTypeOfClass<EqualableType<VALUE_TYPE, TYPE_NAME>>
    static of(typeName: string, ...options: unknown[]): unknown {
        return __dataTypeOfName(this, typeName, options)
    }
    /** The statics of the data type `of` makes for its options: a family without options takes none */
    static [ofStatics](options: readonly unknown[]): OfStatics | undefined {
        if (options.length) {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'of', value: options }, 'The data types of ' + this.name + ' take no options, only their type name')
        }
        return undefined
    }

    /**
     * As `equals`, but the condition disappears when the value is missing: null, undefined, an empty string (unless the
     * connection allows empty strings) or an empty array
     */
    equalsIfValue(value: VALUE_TYPE | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    equalsIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_equals', this, value, __internalDataType('condition'), getOptionalType2(this, value))
    }
    /**
     * Whether this value is equal to the one given, SQL `=`. With a null on either side the result is
     * null, which a `where` doesn't match: use `is` to match a null
     */
    equals(value: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether this value is equal to the one given, SQL `=`. With a null on either side the result is
     * null, which a `where` doesn't match: use `is` to match a null
     */
    equals<VALUE extends OperandOf<this>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    equals(value: any): any {
        return __newSqlOperation1ValueSource('_equals', this, value, __internalDataType('condition'), getOptionalType2(this, value))
    }
    /**
     * As `notEquals`, but the condition disappears when the value is missing: null, undefined, an empty string (unless
     * the connection allows empty strings) or an empty array
     */
    notEqualsIfValue(value: VALUE_TYPE | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    notEqualsIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_notEquals', this, value, __internalDataType('condition'), getOptionalType2(this, value))
    }
    /**
     * Whether this value is different from the one given, SQL `<>`. With a null on either side the
     * result is null, which a `where` doesn't match: use `isNot` to compare with a null
     */
    notEquals(value: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether this value is different from the one given, SQL `<>`. With a null on either side the
     * result is null, which a `where` doesn't match: use `isNot` to compare with a null
     */
    notEquals<VALUE extends OperandOf<this>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    notEquals(value: any): any {
        return __newSqlOperation1ValueSource('_notEquals', this, value, __internalDataType('condition'), getOptionalType2(this, value))
    }
    /**
     * As `is`, but the condition disappears when the value is missing: null, undefined, an empty string (unless the
     * connection allows empty strings) or an empty array:
     * `isIfValue(null)` adds no condition: use `is(null)` to look for a null
     */
    isIfValue(value: VALUE_TYPE | null | undefined): IfValueSource<SourceOf<this>, 'required'>
    /* The `is`/`isNot` family is a TOTAL predicate: `IS [NOT] DISTINCT FROM` (and the per-dialect emulation of it)
     * answers true or false even when an operand is NULL — which is the reason to reach for it instead of `equals`.
     * So the result is ALWAYS `'required'`, whatever the receiver and the operand are. Merging them, the way an
     * ordinary comparison does (`getOptionalType2`), would report a NULL the operator cannot produce, and that
     * over-report reaches the SQL: the dialects with no native boolean in a projected position would emit the
     * 3-branch `case … else null end` with an unreachable branch. The `*IfValue` twins carry the same `'required'`
     * into the neutral they become when the operand has no value — a neutral inherits the optional type of the
     * expression it stands for, and for a total predicate that is `'required'`. */
    isIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_is', this, value, __internalDataType('condition'), 'required')
    }
    /**
     * Whether this value is equal to the one given, comparing null as a value: two nulls are equal, and the
     * result is never null (`is not distinct from`, `<=>` on MariaDB and MySQL, `is` on SQLite, an
     * equivalent expression on Oracle and SQL Server)
     */
    is(value: VALUE_TYPE | null | undefined): ValueSource<SourceOf<this>, BooleanType, 'required'>
    /**
     * Whether this value is equal to the one given, comparing null as a value: two nulls are equal, and the
     * result is never null (`is not distinct from`, `<=>` on MariaDB and MySQL, `is` on SQLite, an
     * equivalent expression on Oracle and SQL Server)
     */
    is<VALUE extends OperandOf<this>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, 'required'>
    is(value: any): any {
        return __newSqlOperation1ValueSource('_is', this, value, __internalDataType('condition'), 'required')
    }
    /**
     * As `isNot`, but the condition disappears when the value is missing: null, undefined, an empty string (unless the
     * connection allows empty strings) or an empty array:
     * `isNotIfValue(null)` adds no condition: use `isNot(null)` to exclude the nulls
     */
    isNotIfValue(value: VALUE_TYPE | null | undefined): IfValueSource<SourceOf<this>, 'required'>
    isNotIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_isNot', this, value, __internalDataType('condition'), 'required')
    }
    /**
     * Whether this value is different from the one given, comparing null as a value: a null is different
     * from any value and not from another null, and the result is never null (`is distinct from`, `not
     * <=>` on MariaDB and MySQL, `is not` on SQLite, an equivalent expression on Oracle and SQL Server)
     */
    isNot(value: VALUE_TYPE | null | undefined): ValueSource<SourceOf<this>, BooleanType, 'required'>
    /**
     * Whether this value is different from the one given, comparing null as a value: a null is different
     * from any value and not from another null, and the result is never null (`is distinct from`, `not
     * <=>` on MariaDB and MySQL, `is not` on SQLite, an equivalent expression on Oracle and SQL Server)
     */
    isNot<VALUE extends OperandOf<this>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, 'required'>
    isNot(value: any): any {
        return __newSqlOperation1ValueSource('_isNot', this, value, __internalDataType('condition'), 'required')
    }

    /**
     * As `in`, but the condition disappears when the value is missing: null, undefined, an empty string (unless the
     * connection allows empty strings) or an empty array: an empty list adds no condition, where `in` is always false
     */
    inIfValue(values: readonly VALUE_TYPE[] | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    inIfValue(value: any): any {
        return __newSqlOperationInValueSourceIfValueOrNoop('_in', this, value, __internalDataType('condition'), getOptionalType2(this, value))
    }
    /**
     * Whether this value is one of the given ones, SQL `in`: a list of values, a value of the same data
     * type, or the rows of a select of one column. An empty list is always false
     */
    in(values: readonly VALUE_TYPE[]): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether this value is one of the given ones, SQL `in`: a list of values, a value of the same data
     * type, or the rows of a select of one column. An empty list is always false
     */
    in<VALUE extends OperandOf<this>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    /**
     * Whether this value is one of the given ones, SQL `in`: a list of values, a value of the same data
     * type, or the rows of a select of one column. An empty list is always false
     */
    in<SOURCE2 extends NSource>(select: IExecutableSelectQuery<SOURCE2, OperandOf<this>, VALUE_TYPE>): ValueSource<SourceOf<this> | SOURCE2, BooleanType, OptionalityOf<this>>
    /**
     * Whether this value is one of the given ones, SQL `in`: a list of values, a value of the same data
     * type, or the rows of a select of one column. An empty list is always false
     */
    in<SOURCE2 extends NSource>(select: IExecutableSelectQuery<SOURCE2, OperandOf<this>, VALUE_TYPE | null | undefined>): ValueSource<SourceOf<this> | SOURCE2, BooleanType, 'optional'>
    in(value: any): any {
        return __newSqlOperationInValueSource('_in', this, value, __internalDataType('condition'), getOptionalTypeOfIn(this, value))
    }
    /**
     * As `notIn`, but the condition disappears when the value is missing: null, undefined, an empty string (unless
     * the connection allows empty strings) or an empty array: an empty list adds no condition, where `notIn` is always
     * true
     */
    notInIfValue(values: readonly VALUE_TYPE[] | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    notInIfValue(value: any): any {
        return __newSqlOperationInValueSourceIfValueOrNoop('_notIn', this, value, __internalDataType('condition'), getOptionalType2(this, value))
    }
    /**
     * Whether this value is none of the given ones, SQL `not in`: a list of values, a value of the same
     * data type, or the rows of a select of one column. An empty list is always true. If the select
     * returns a null, no row matches: take the nulls out of it
     */
    notIn(values: readonly VALUE_TYPE[]): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Whether this value is none of the given ones, SQL `not in`: a list of values, a value of the same
     * data type, or the rows of a select of one column. An empty list is always true. If the select
     * returns a null, no row matches: take the nulls out of it
     */
    notIn<VALUE extends OperandOf<this>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    /**
     * Whether this value is none of the given ones, SQL `not in`: a list of values, a value of the same
     * data type, or the rows of a select of one column. An empty list is always true. If the select
     * returns a null, no row matches: take the nulls out of it
     */
    notIn<SOURCE2 extends NSource>(select: IExecutableSelectQuery<SOURCE2, OperandOf<this>, VALUE_TYPE>): ValueSource<SourceOf<this> | SOURCE2, BooleanType, OptionalityOf<this>>
    /**
     * Whether this value is none of the given ones, SQL `not in`: a list of values, a value of the same
     * data type, or the rows of a select of one column. An empty list is always true. If the select
     * returns a null, no row matches: take the nulls out of it
     */
    notIn<SOURCE2 extends NSource>(select: IExecutableSelectQuery<SOURCE2, OperandOf<this>, VALUE_TYPE | null | undefined>): ValueSource<SourceOf<this> | SOURCE2, BooleanType, 'optional'>
    notIn(value: any): any {
        return __newSqlOperationInValueSource('_notIn', this, value, __internalDataType('condition'), getOptionalTypeOfIn(this, value))
    }
    /**
     * As `in`, with the values given as arguments: each one a value or a value source of the same data
     * type. Without arguments it is always false
     */
    inN(...value: VALUE_TYPE[]): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * As `in`, with the values given as arguments: each one a value or a value source of the same data
     * type. Without arguments it is always false
     */
    inN<SOURCE2 extends NSource, OPTIONAL_TYPE2 extends OptionalType>(...value: Array<VALUE_TYPE | (OperandOf<this> & { [source]: SOURCE2, [optionalType]: OPTIONAL_TYPE2 })>): ValueSource<SourceOf<this> | SOURCE2, BooleanType, CombinedOptionality<OptionalityOf<this>, CombinedOptionalityOfUnion<OPTIONAL_TYPE2>>>
    inN(...value: any[]): any {
        return __newSqlOperationInValueSource('_in', this, value, __internalDataType('condition'), getOptionalTypeN(this, value))
    }
    /**
     * As `notIn`, with the values given as arguments: each one a value or a value source of the same
     * data type. Without arguments it is always true
     */
    notInN(...value: VALUE_TYPE[]): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * As `notIn`, with the values given as arguments: each one a value or a value source of the same
     * data type. Without arguments it is always true
     */
    notInN<SOURCE2 extends NSource, OPTIONAL_TYPE2 extends OptionalType>(...value: Array<VALUE_TYPE | (OperandOf<this> & { [source]: SOURCE2, [optionalType]: OPTIONAL_TYPE2 })>): ValueSource<SourceOf<this> | SOURCE2, BooleanType, CombinedOptionality<OptionalityOf<this>, CombinedOptionalityOfUnion<OPTIONAL_TYPE2>>>
    notInN(...value: any[]): any {
        return __newSqlOperationInValueSource('_notIn', this, value, __internalDataType('condition'), getOptionalTypeN(this, value))
    }
}
