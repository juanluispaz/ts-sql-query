import type { SqlDataType } from '../TypeAdapter.js'
import { BaseType, type ConditionOfType, type ILogicalValue, type IValueWithType, type OptionalityOf, type SourceOf, type ValueSource } from './base.js'
import { EqualableType } from './equalable.js'
import { type CombinedOptionality, type OptionalType, __mergeOptional } from './valueSource.js'
import type { NSource } from '../utils/sourceName.js'
import { computedType, operandTypeName, typeName } from '../utils/symbols.js'
import { __sameTypeClassOf } from '../nodes/dataTypeClassOf.js'
import { __newValueWhenNoValueValueSource, __newBooleanValueWhenNoValueValueSource, __newSqlOperationValueSourceIfValueAlwaysNoop } from '../nodes/ifValue.js'
import { getOptionalType2 } from '../nodes/operands.js'
import { __newSqlOperation1ValueSource, __operation0 } from '../nodes/operations.js'
import { __keptClassOf } from '../nodes/adaptedTypeClass.js'
import { __asNodeValueSource } from '../nodes/NodeStrategy.js'

/*
 * The logical data types: the boolean value, and the two conditions (`if`, `alwaysIf`). They share the group
 * `logical`, so `and` and `or` take any of them. A condition is not a value source: it can't be a column or be
 * projected, and it has a value of its own, the neutral (no condition), which a boolean value doesn't have.
 */

/** What a position that takes a boolean value accepts */
export type IBooleanValue = IValueWithType<'type:boolean:logical:'>

/** The type in the database of a boolean */
export const booleanSqlDataType: SqlDataType = { family: 'boolean' }

/** A boolean value */
export abstract class BooleanType extends EqualableType<boolean, string> {
    static override readonly type = 'boolean'
    static override readonly sqlDataType: SqlDataType = booleanSqlDataType
    declare [typeName]: 'type:boolean:logical:'
    declare [operandTypeName]: 'type:boolean:logical:'

    /** The opposite of this boolean, SQL `not`: a null stays null */
    negate(): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    negate(): any {
        return __operation0(this, '_negate', BooleanConditionType)
    }
    /**
     * Both booleans, SQL `and`. A condition without a value (of an `*IfValue` method, `onlyWhen` or
     * `ignoreWhen`) is left out, and the result is this boolean
     */
    and(value: boolean): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Both booleans, SQL `and`. A condition without a value (of an `*IfValue` method, `onlyWhen` or
     * `ignoreWhen`) is left out, and the result is this boolean
     */
    and<VALUE extends ILogicalValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    and(value: any): any {
        return __newSqlOperation1ValueSource('_and', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * Either boolean, SQL `or`. A condition without a value (of an `*IfValue` method, `onlyWhen` or
     * `ignoreWhen`) is left out, and the result is this boolean
     */
    or(value: boolean): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Either boolean, SQL `or`. A condition without a value (of an `*IfValue` method, `onlyWhen` or
     * `ignoreWhen`) is left out, and the result is this boolean
     */
    or<VALUE extends ILogicalValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    or(value: any): any {
        return __newSqlOperation1ValueSource('_or', this, value, BooleanConditionType, getOptionalType2(this, value))
    }
    /**
     * This boolean as a condition when `condition` is true; when it is false, no condition: `and` and
     * `or` give the other side, and a `where` with only it is not written
     */
    onlyWhen(condition: boolean): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    onlyWhen(condition: boolean): any {
        const vs = __asNodeValueSource(this)
        if (condition) {
            return vs
        } else {
            return __newSqlOperationValueSourceIfValueAlwaysNoop(BooleanConditionType, vs.__optionalType)
        }
    }
    /**
     * This boolean as a condition when `condition` is false; when it is true, no condition: `and`
     * and `or` give the other side, and a `where` with only it is not written
     */
    ignoreWhen(condition: boolean): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    ignoreWhen(condition: boolean): any {
        const vs = __asNodeValueSource(this)
        if (condition) {
            return __newSqlOperationValueSourceIfValueAlwaysNoop(BooleanConditionType, vs.__optionalType)
        } else {
            return vs
        }
    }
}

/**
 * The boolean of a condition (a comparison, `and`, `or`, `negate`, `exists`, a fragment of a boolean, the neutral), for
 * the run time only: TypeScript sees a `BooleanType` or a condition. Its SQL is a condition, so the SQL builder of a
 * database without a boolean value writes it as it is where a condition goes and turns it into a value elsewhere. What
 * keeps its SQL (`allowWhen`, `valueWhenNoValue`, ...) keeps this data type; a value computed from it (`valueWhenNull`,
 * `max`, ...) is a boolean. The methods only the conditions have (`trueWhenNoValue`, `falseWhenNoValue`,
 * `valueWhenNoValue`) are here, where no boolean value has them
 */
export abstract class BooleanConditionType extends BooleanType {
    /** A value computed from the boolean of a condition is a boolean */
    static readonly [computedType] = BooleanType

    /** The implementation of `trueWhenNoValue` of a condition, declared in `IfType` and `AlwaysIfType`: a condition is a boolean at run time */
    trueWhenNoValue(): any {
        const vs = __asNodeValueSource(this)
        return __newBooleanValueWhenNoValueValueSource('_true', vs, __keptClassOf(vs, __sameTypeClassOf(vs)), vs.__optionalType)
    }
    /** The implementation of `falseWhenNoValue` of a condition, declared in `IfType` and `AlwaysIfType`: a condition is a boolean at run time */
    falseWhenNoValue(): any {
        const vs = __asNodeValueSource(this)
        return __newBooleanValueWhenNoValueValueSource('_false', vs, __keptClassOf(vs, __sameTypeClassOf(vs)), vs.__optionalType)
    }
    /** The implementation of `valueWhenNoValue` of a condition, declared in `IfType` and `AlwaysIfType`: a condition is a boolean at run time */
    valueWhenNoValue(value: any): any {
        const vs = __asNodeValueSource(this)
        const nodeValueWhenNoValue = vs.__node.valueWhenNoValue
        if (nodeValueWhenNoValue) {
            return nodeValueWhenNoValue(vs, value)
        }
        if (value === true) {
            return this.trueWhenNoValue()
        }
        if (value === false) {
            return this.falseWhenNoValue()
        }

        return __newValueWhenNoValueValueSource(value, vs, __keptClassOf(vs, __sameTypeClassOf(vs)), __mergeOptional(vs.__optionalType, __asNodeValueSource(value).__optionalType))
    }
}

/**
 * Whether the value source is written as a condition: the boolean of a condition, but not the reference to a column of
 * a select that is one (the select list writes it as a value)
 */
export function __isCondition(valueSource: unknown): boolean {
    return valueSource instanceof BooleanConditionType && !(valueSource as any).__selectColumnReference
}


/** The root of the conditions */
export abstract class ConditionType extends BaseType<boolean> {
}

/** A condition that is ignored (the neutral) when the value it compares has no value */
export abstract class IfType extends ConditionType {
    declare [typeName]: 'type:if:logical:'
    declare [operandTypeName]: 'type:if:logical:'

    /** The opposite of this condition, SQL `not`. Without a value it stays without a value */
    abstract negate(): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    /**
     * Both conditions, SQL `and`. A side without a value is left out: the result is the other side, and
     * with no value on either side, no condition. With `true`, `false` or a boolean value the result is a
     * boolean value, which always has one
     */
    abstract and(value: boolean): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Both conditions, SQL `and`. A side without a value is left out: the result is the other side, and
     * with no value on either side, no condition. With `true`, `false` or a boolean value the result is a
     * boolean value, which always has one
     */
    abstract and<VALUE extends IBooleanValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    /**
     * Both conditions, SQL `and`. A side without a value is left out: the result is the other side, and
     * with no value on either side, no condition. With `true`, `false` or a boolean value the result is a
     * boolean value, which always has one
     */
    abstract and<VALUE extends ILogicalValue>(value: VALUE): IfValueSource<SourceOf<this> | SourceOf<VALUE>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    /**
     * Either condition, SQL `or`. A side without a value is left out: the result is the other side, and
     * with no value on either side, no condition. With `true`, `false` or a boolean value the result is a
     * boolean value, which always has one
     */
    abstract or(value: boolean): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * Either condition, SQL `or`. A side without a value is left out: the result is the other side, and
     * with no value on either side, no condition. With `true`, `false` or a boolean value the result is a
     * boolean value, which always has one
     */
    abstract or<VALUE extends IBooleanValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    /**
     * Either condition, SQL `or`. A side without a value is left out: the result is the other side, and
     * with no value on either side, no condition. With `true`, `false` or a boolean value the result is a
     * boolean value, which always has one
     */
    abstract or<VALUE extends ILogicalValue>(value: VALUE): IfValueSource<SourceOf<this> | SourceOf<VALUE>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    /** This condition when `condition` is true; when it is false, no condition */
    abstract onlyWhen(condition: boolean): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    /** This condition when `condition` is false; when it is true, no condition */
    abstract ignoreWhen(condition: boolean): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    /**
     * This condition, or `true` when it has no value (an `*IfValue` method without a value,
     * `onlyWhen(false)`, `ignoreWhen(true)`); without a value, a `where` with it matches every
     * row. The result is a boolean value, which can be selected
     */
    abstract trueWhenNoValue(): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * This condition, or `false` when it has no value (an `*IfValue` method without a value,
     * `onlyWhen(false)`, `ignoreWhen(true)`); without a value, a `where` with it matches no
     * rows. The result is a boolean value, which can be selected
     */
    abstract falseWhenNoValue(): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * This condition, or the one given when it has no value. With `true`, `false` or a boolean
     * value the result is a boolean value; with a condition, a condition that can still have
     * no value
     */
    abstract valueWhenNoValue(value: boolean): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    /**
     * This condition, or the one given when it has no value. With `true`, `false` or a boolean
     * value the result is a boolean value; with a condition, a condition that can still have
     * no value
     */
    abstract valueWhenNoValue<VALUE extends IBooleanValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    /**
     * This condition, or the one given when it has no value. With `true`, `false` or a boolean
     * value the result is a boolean value; with a condition, a condition that can still have
     * no value
     */
    abstract valueWhenNoValue<VALUE extends ILogicalValue>(value: VALUE): IfValueSource<SourceOf<this> | SourceOf<VALUE>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
}

/** A condition that always applies, and keeps applying when it is combined with others */
export abstract class AlwaysIfType extends ConditionType {
    declare [typeName]: 'type:alwaysIf:logical:'
    declare [operandTypeName]: 'type:alwaysIf:logical:'

    /** The opposite of this condition, SQL `not`. Without a value it stays without a value */
    abstract negate(): AlwaysIfValueSource<SourceOf<this>, OptionalityOf<this>>
    /**
     * Both conditions, SQL `and`. A side without a value is left out: the result is the other side, and
     * with no value on either side, no condition
     */
    abstract and(value: boolean): AlwaysIfValueSource<SourceOf<this>, OptionalityOf<this>>
    /**
     * Both conditions, SQL `and`. A side without a value is left out: the result is the other side, and
     * with no value on either side, no condition
     */
    abstract and<VALUE extends ILogicalValue>(value: VALUE): AlwaysIfValueSource<SourceOf<this> | SourceOf<VALUE>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    /**
     * Either condition, SQL `or`. A side without a value is left out: the result is the other side, and
     * with no value on either side, no condition
     */
    abstract or(value: boolean): AlwaysIfValueSource<SourceOf<this>, OptionalityOf<this>>
    /**
     * Either condition, SQL `or`. A side without a value is left out: the result is the other side, and
     * with no value on either side, no condition
     */
    abstract or<VALUE extends ILogicalValue>(value: VALUE): AlwaysIfValueSource<SourceOf<this> | SourceOf<VALUE>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    /** This condition when `condition` is true; when it is false, no condition */
    abstract onlyWhen(condition: boolean): AlwaysIfValueSource<SourceOf<this>, OptionalityOf<this>>
    /** This condition when `condition` is false; when it is true, no condition */
    abstract ignoreWhen(condition: boolean): AlwaysIfValueSource<SourceOf<this>, OptionalityOf<this>>
    /** This condition, or `true` when it has no value */
    abstract trueWhenNoValue(): AlwaysIfValueSource<SourceOf<this>, OptionalityOf<this>>
    /** This condition, or `false` when it has no value */
    abstract falseWhenNoValue(): AlwaysIfValueSource<SourceOf<this>, OptionalityOf<this>>
    /** This condition, or the value given when it has no value */
    abstract valueWhenNoValue(value: boolean): AlwaysIfValueSource<SourceOf<this>, OptionalityOf<this>>
    /** This condition, or the value given when it has no value */
    abstract valueWhenNoValue<VALUE extends ILogicalValue>(value: VALUE): AlwaysIfValueSource<SourceOf<this> | SourceOf<VALUE>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
}

/**
 * A condition that can have no value: the result of an `*IfValue` method, `onlyWhen` or
 * `ignoreWhen`. Without a value it is left out: `and` and `or` give the other side, and a
 * `where` with only it is not written. It can't be selected: `trueWhenNoValue` or
 * `falseWhenNoValue` make it a boolean value
 */
export type IfValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = IfType & ConditionOfType<SOURCE, IfType, OPTIONAL_TYPE>
/**
 * A condition whose methods all give this same type, so a variable can be reassigned while
 * a condition is built (the result of `dynamicBooleanExpressionUsing`). Like an
 * `IfValueSource`, it can have no value
 */
export type AlwaysIfValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = AlwaysIfType & ConditionOfType<SOURCE, AlwaysIfType, OPTIONAL_TYPE>

/** A condition, or a boolean value, used as a condition that always applies (the where of a query, the on of a join) */
export function asAlwaysIfValueSource<VALUE extends ILogicalValue>(valueSource: VALUE): AlwaysIfValueSource<SourceOf<VALUE>, OptionalityOf<VALUE>> {
    return valueSource as any
}
