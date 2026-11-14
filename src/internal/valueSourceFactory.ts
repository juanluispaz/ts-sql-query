import type { AggregateFunctions0, AggregateFunctions1, AggregateFunctions1or2, SqlOperationStatic0, SqlOperationStatic1, SqlSequenceOperation } from '../sqlBuilders/SqlBuilder.js'
import type { AnyValueSource, IExecutableDeleteQuery, IExecutableInsertQuery, IExecutableSelectQuery, IExecutableUpdateQuery, OptionalType, __AggregatedArrayColumns, __AggregatedArrayMode } from '../expressions/values.js'
import type { AnyTableOrView } from '../utils/ITableOrView.js'
import type { CustomType, TypeAdapter } from '../TypeAdapter.js'
import type { FragmentQueryBuilder } from '../queryBuilders/FragmentQueryBuilder.js'
import { AggregateFunctions0ValueSource, AggregateFunctions1ValueSource, AggregateFunctions1or2ValueSource, AggregateSelectValueSource, AggregateValueAsArrayValueSource, AllowWhenAggregateValueAsArrayValueSource, FragmentValueSource, FunctionCallValueSource, InlineSelectValueSource, SequenceValueSource, SqlOperation1ValueSource, SqlOperation1ValueSourceIfValueOrIgnore, SqlOperationConstValueSource, SqlOperationStatic0ValueSource, SqlOperationStatic1ValueSource, SqlOperationStaticBooleanValueSource, SqlOperationValueSourceIfValueAlwaysNoop, TableOrViewRawFragmentValueSource, ValueSourceFromBuilder, ValueSourceImpl, type InlineSelectData } from './ValueSourceImpl.js'
import { DBColumnImpl, createColumnsFrom } from './DBColumnImpl.js'
import { RawFragmentImpl } from './RawFragmentImpl.js'

// How the rest of the library builds a value source, a column or a raw fragment, and asks which one it has: the only
// module that knows the classes that implement them, so the implementation can change without touching who uses it.

export { createColumnsFrom }

export function __createDBColumn(table: AnyTableOrView, name: string, type: string, customType: CustomType | undefined, typeAdapter: TypeAdapter | undefined): DBColumnImpl {
    return new DBColumnImpl(table, name, type, customType, typeAdapter)
}

export function __createValueSourceFromBuilder(builder: (fragmentBuilder: FragmentQueryBuilder) => AnyValueSource, fragmentBuilder: FragmentQueryBuilder, type: string, customType: CustomType | undefined, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): ValueSourceFromBuilder {
    return new ValueSourceFromBuilder(builder, fragmentBuilder, type, customType, optionalType, typeAdapter)
}

export function __createConst(value: any, type: string, customType: CustomType | undefined, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): SqlOperationConstValueSource {
    return new SqlOperationConstValueSource(value, type, customType, optionalType, typeAdapter)
}

export function __createStatic0(operation: keyof SqlOperationStatic0, type: string, customType: CustomType | undefined, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): SqlOperationStatic0ValueSource {
    return new SqlOperationStatic0ValueSource(operation, type, customType, optionalType, typeAdapter)
}

export function __createStatic1(operation: keyof SqlOperationStatic1, value: any, type: string, customType: CustomType | undefined, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): SqlOperationStatic1ValueSource {
    return new SqlOperationStatic1ValueSource(operation, value, type, customType, optionalType, typeAdapter)
}

export function __createStaticBoolean(operation: '_true' | '_false'): SqlOperationStaticBooleanValueSource {
    return new SqlOperationStaticBooleanValueSource(operation)
}

export function __createIfValueAlwaysNoop(optionalType: OptionalType): SqlOperationValueSourceIfValueAlwaysNoop {
    return new SqlOperationValueSourceIfValueAlwaysNoop(optionalType)
}

export function __createAggregateFunction0(operation: keyof AggregateFunctions0, type: string, customType: CustomType | undefined, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): AggregateFunctions0ValueSource {
    return new AggregateFunctions0ValueSource(operation, type, customType, optionalType, typeAdapter)
}

export function __createAggregateFunction1(operation: keyof AggregateFunctions1, value: any, type: string, customType: CustomType | undefined, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): AggregateFunctions1ValueSource {
    return new AggregateFunctions1ValueSource(operation, value, type, customType, optionalType, typeAdapter)
}

export function __createAggregateFunction1or2(operation: keyof AggregateFunctions1or2, separator: string | undefined, value: any, type: string, customType: CustomType | undefined, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): AggregateFunctions1or2ValueSource {
    return new AggregateFunctions1or2ValueSource(operation, separator, value, type, customType, optionalType, typeAdapter)
}

export function __createAggregateValueAsArray(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode: __AggregatedArrayMode, optionalType: OptionalType, distinct: boolean): AggregateValueAsArrayValueSource {
    return new AggregateValueAsArrayValueSource(aggregatedArrayColumns, aggregatedArrayMode, optionalType, distinct)
}

export function __createAggregateSelect(selectData: InlineSelectData, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode: __AggregatedArrayMode, optionalType: OptionalType): AggregateSelectValueSource {
    return new AggregateSelectValueSource(selectData, aggregatedArrayColumns, aggregatedArrayMode, optionalType)
}

export function __createInlineSelect(selectData: InlineSelectData, required: boolean): InlineSelectValueSource {
    return new InlineSelectValueSource(selectData, required)
}

export function __createFunctionCall(functionName: string, functionParams: AnyValueSource[], type: string, customType: CustomType | undefined, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): FunctionCallValueSource {
    return new FunctionCallValueSource(functionName, functionParams, type, customType, optionalType, typeAdapter)
}

export function __createFragment(sql: TemplateStringsArray, sqlParams: AnyValueSource[], type: string, customType: CustomType | undefined, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined, isAggregate: boolean | undefined): FragmentValueSource {
    return new FragmentValueSource(sql, sqlParams, type, customType, optionalType, typeAdapter, isAggregate)
}

export function __createTableOrViewRawFragment(tableOrView: AnyTableOrView, operation: '_rawFragmentTableName' | '_rawFragmentTableAlias'): TableOrViewRawFragmentValueSource {
    return new TableOrViewRawFragmentValueSource(tableOrView, operation)
}

export function __createSequence(operation: keyof SqlSequenceOperation, sequenceName: string, type: string, customType: CustomType | undefined, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): SequenceValueSource {
    return new SequenceValueSource(operation, sequenceName, type, customType, optionalType, typeAdapter)
}

export function __createRawFragment(template: TemplateStringsArray, params: Array<AnyValueSource | IExecutableSelectQuery<any, any, any> | IExecutableInsertQuery<any, any> | IExecutableUpdateQuery<any, any> | IExecutableDeleteQuery<any, any>>): RawFragmentImpl {
    return new RawFragmentImpl(template, params)
}

/** The column of the previous row in a hierarchical query (`connect by prior` of Oracle) */
export function __priorOf(column: AnyValueSource): AnyValueSource {
    return (column as ValueSourceImpl).__prior()
}

/** Whether the value source is the condition that is always ignored (the start of a dynamic condition) */
export function __isIfValueAlwaysNoop(value: unknown): value is SqlOperationValueSourceIfValueAlwaysNoop {
    return value instanceof SqlOperationValueSourceIfValueAlwaysNoop
}

/** An operation of one operand, applied always or only when the operand has a value */
export type __Operation1ValueSource = SqlOperation1ValueSource | SqlOperation1ValueSourceIfValueOrIgnore

/** Whether the value source is an operation of one operand that is always applied */
export function __isOperation1(value: unknown): value is SqlOperation1ValueSource {
    return value instanceof SqlOperation1ValueSource
}

/** Whether the value source is an operation of one operand that is ignored when the operand has no value */
export function __isOperation1IfValueOrIgnore(value: unknown): value is SqlOperation1ValueSourceIfValueOrIgnore {
    return value instanceof SqlOperation1ValueSourceIfValueOrIgnore
}

/** Whether the value source is a constant */
export function __isConst(value: unknown): value is SqlOperationConstValueSource {
    return value instanceof SqlOperationConstValueSource
}

/** Whether the value source is a select used as a value */
export function __isInlineSelect(value: unknown): value is InlineSelectValueSource {
    return value instanceof InlineSelectValueSource
}

/** Whether the value source is a fragment of SQL */
export function __isFragment(value: unknown): value is FragmentValueSource {
    return value instanceof FragmentValueSource
}

/** Whether the value source is the name or the alias of a table or view in a raw fragment */
export function __isTableOrViewRawFragment(value: unknown): value is TableOrViewRawFragmentValueSource {
    return value instanceof TableOrViewRawFragmentValueSource
}

/** Whether the value source is an aggregate as array (`aggregateAsArray`, `aggregateAsArrayOfOneColumn`, …) */
export function __isAggregateValueAsArray(value: unknown): value is AggregateValueAsArrayValueSource {
    return value instanceof AggregateValueAsArrayValueSource
}

/** Whether the value source is an aggregate as array guarded by `allowWhen` / `disallowWhen` */
export function __isAllowWhenAggregateValueAsArray(value: unknown): value is AllowWhenAggregateValueAsArrayValueSource {
    return value instanceof AllowWhenAggregateValueAsArrayValueSource
}

/** Whether the value is a raw fragment */
export function __isRawFragment(value: unknown): value is RawFragmentImpl {
    return value instanceof RawFragmentImpl
}
