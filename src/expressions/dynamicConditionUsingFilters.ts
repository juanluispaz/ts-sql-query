import type { DataToProjectOf, DataToProjectOfAny, GetDataToProjectSource } from '../complexProjections/dataToProject.js'
import type { UsableKeyOf } from '../utils/objectUtils.js'
import type { AnyValueSource, IExecutableSelectQuery, TypedValueSource } from '../typeSystem/valueSource.js'
import type { AnyType, ILogicalValueSource, ValueSource } from '../typeSystem/base.js'
import type { valueSourceType } from '../utils/symbols.js'
import type { DataTypeName, DataTypeOfName } from '../typeSystem/dataTypeNames.js'
import type { BooleanType } from '../typeSystem/logical.js'
import type { FilterOperationNamesOf } from '../typeSystem/filterOperations.js'

/** The parameter of each overload of a method of one parameter: up to 4 overloads, numbered, not recursive */
type ParameterOfOverloads<METHOD> =
    METHOD extends { (value: infer A1): any; (value: infer A2): any; (value: infer A3): any; (value: infer A4): any } ? A1 | A2 | A3 | A4 : never

/**
 * The value a filter gives to an operation: without parameters, a boolean (true, the condition; false, its negation);
 * with one, what the method accepts that is not a value source nor a select
 */
type FilterValueOf<METHOD> =
    METHOD extends () => any ? boolean :
    Exclude<ParameterOfOverloads<METHOD>, AnyValueSource | IExecutableSelectQuery<any, any, any>>

/** The filter of a data type: an optional property for each operation it exposes, with the value its method takes */
export type FilterOf<TYPE> = {
    [K in FilterOperationNamesOf<TYPE>]?: FilterValueOf<K extends keyof TYPE ? TYPE[K] : never>
}

/** The filter of each data type known by name, computed once */
type FiltersOfNames = { [NAME in DataTypeName]: FilterOf<DataTypeOfName<NAME>> }

export type FilterTypeOf<TYPE> =
    // The name of a data type, a built-in one or one of the user (`total: 'Money'`)
    TYPE extends DataTypeName ? FiltersOfNames[TYPE] :
    TYPE extends { [valueSourceType]: infer DATA_TYPE } ? FilterOf<DATA_TYPE> :
    // A data type, like the class of a type of the user (`total: MoneyType`)
    TYPE extends AnyType ? FilterOf<TYPE> :
    never

/**
 * How the definition of a dynamic condition declares a column without its value source: by the name of a data type
 * (`'int'`, or the type name of a data type of the user registered with registerDataType, `'Money'`), or by its data
 * type (`MoneyType`, the class of a data type of the user)
 */
export type DynamicColumnType = DataTypeName | AnyType

// The definition of a dynamic condition: up to 5 levels, as a complex projection; the last level only has columns
export type DynamicDefinition = {
    [key: string]: AnyValueSource | DynamicColumnType | DynamicDefinition2
}
type DynamicDefinition2 = {
    [key: string]: AnyValueSource | DynamicColumnType | DynamicDefinition3
}
type DynamicDefinition3 = {
    [key: string]: AnyValueSource | DynamicColumnType | DynamicDefinition4
}
type DynamicDefinition4 = {
    [key: string]: AnyValueSource | DynamicColumnType | DynamicDefinition5
}
type DynamicDefinition5 = {
    [key: string]: AnyValueSource | DynamicColumnType
}

export type DynamicCondition<DEFINITION extends DynamicDefinition, EXTENSION extends DynamicConditionExtension = never> = {
    not?: DynamicCondition<DEFINITION, EXTENSION>
    and?: ReadonlyArray<DynamicCondition<DEFINITION, EXTENSION> | undefined>
    or?: ReadonlyArray<DynamicCondition<DEFINITION, EXTENSION> | undefined>
} & {
    [KEY in NonReplacedField<DEFINITION, EXTENSION>]?:
        DEFINITION[KEY] extends AnyValueSource | DynamicColumnType
        ? ColumnFilterWithExtension<FilterTypeOf<DEFINITION[KEY]>, EXTENSION> : DEFINITION[KEY] extends DynamicDefinition
        ? DynamicCondition<DEFINITION[KEY], KEY extends keyof EXTENSION ? (EXTENSION[KEY] extends DynamicConditionExtension ? EXTENSION[KEY] : never) : never>
        : never
} & {
    [KEY in DynamicConditionExtensionKeys<EXTENSION>]?: EXTENSION[KEY] extends DynamicConditionRule<infer TYPE> ? TYPE : never
}

export type MapValueSourceToFilter<TYPE> =
    TYPE extends { [valueSourceType]: infer DATA_TYPE } ? FilterOf<DATA_TYPE> :
    // A value source without a data type: no operation
    TYPE extends TypedValueSource<any, any, any> ? Record<never, never> :
    never

export type Filterable = DataToProjectOfAny

export type DynamicConditionExtension = DataToProjectOf<DynamicConditionRule<any>>
export type DynamicConditionRule<T> = (rule: T) => ILogicalValueSource<any, any>

type NonReplacedField<DEFINITION, EXTENSION> = Exclude<UsableKeyOf<DEFINITION>, DynamicConditionExtensionKeys<EXTENSION>> 
type DynamicConditionExtensionKeys<EXTENSION> = {[K in keyof EXTENSION]: EXTENSION[K] extends DynamicConditionRule<any> ? K : never }[keyof EXTENSION]

// The extension rules as usable inside a column's filter. The runtime forwards
// the *whole* extension to every value-source column (see
// `DynamicConditionBuilder.processColumnFilter` /
// `processAdditionalColumnFilter`), so any extension key can be applied under
// any column: a function rule maps to its argument type, and a nested object of
// rules recurses to the same shape (to any depth).
type DynamicConditionColumnExtension<EXTENSION> = {
    [KEY in keyof EXTENSION]?:
        EXTENSION[KEY] extends DynamicConditionRule<infer TYPE> ? TYPE
        : EXTENSION[KEY] extends DynamicConditionExtension ? DynamicConditionColumnExtension<EXTENSION[KEY]>
        : never
}

// A column filter (its built-in operators) widened with the column-scoped
// extension rules. An extension key shadows a same-named built-in operator,
// mirroring the runtime which checks the extension before the operators. With
// no extension (`never`) the column keeps exactly its built-in operators.
type ColumnFilterWithExtension<COLUMN_FILTER, EXTENSION> =
    [EXTENSION] extends [never] ? COLUMN_FILTER
    : Omit<COLUMN_FILTER, keyof EXTENSION> & DynamicConditionColumnExtension<EXTENSION>

// RESCURSIVE type
export type DynamicFilter<DEFINITION extends Filterable, EXTENSION extends DynamicConditionExtension = never> = {
    not?: DynamicFilter<DEFINITION, EXTENSION>
    and?: ReadonlyArray<DynamicFilter<DEFINITION, EXTENSION> | undefined>
    or?: ReadonlyArray<DynamicFilter<DEFINITION, EXTENSION> | undefined>
} & {
    [KEY in NonReplacedField<DEFINITION, EXTENSION>]?:
        DEFINITION[KEY] extends AnyValueSource
        ? ColumnFilterWithExtension<MapValueSourceToFilter<DEFINITION[KEY]>, EXTENSION> : DEFINITION[KEY] extends Filterable
        ? DynamicFilter<DEFINITION[KEY], KEY extends keyof EXTENSION ? (EXTENSION[KEY] extends DynamicConditionExtension ? EXTENSION[KEY] : never) : never>
        : never
} & ([EXTENSION] extends [never] ? unknown : {
    [KEY in DynamicConditionExtensionKeys<EXTENSION>]?: EXTENSION[KEY] extends DynamicConditionRule<infer TYPE> ? TYPE : never
})

export interface DynamicConditionExpression<DEFINITION extends Filterable, EXTENSION extends DynamicConditionExtension> {
    // It is optional because some members can be optionals, another strategy will be look inside the object looking for 
    // any optional, but is provides low value
    withValues(filter: DynamicFilter<DEFINITION, EXTENSION>): ValueSource<SourceOf<DEFINITION> | SourceOf<EXTENSION>, BooleanType, 'optional'>
}

type SourceOf<TYPE> = [TYPE] extends [never] ? never : GetDataToProjectSource<TYPE>
