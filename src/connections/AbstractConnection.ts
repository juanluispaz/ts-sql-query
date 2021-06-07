import type { SqlBuilder } from "../sqlBuilders/SqlBuilder"
import type { InsertExpression } from "../expressions/insert"
import type { UpdateExpression, UpdateExpressionAllowingNoWhere } from "../expressions/update"
import type { DeleteExpression, DeleteExpressionAllowingNoWhere } from "../expressions/delete"
import type { BooleanValueSource, NumberValueSource, StringValueSource, DateValueSource, TimeValueSource, DateTimeValueSource, EqualableValueSource, IntValueSource, DoubleValueSource, LocalDateValueSource, LocalTimeValueSource, LocalDateTimeValueSource, TypeSafeStringValueSource, StringNumberValueSource, StringIntValueSource, StringDoubleValueSource, ValueSource, RemapValueSourceTypeAsOptional, ComparableValueSource, IfValueSource, IComparableValueSource, IIntValueSource, IDoubleValueSource, IStringIntValueSource, IStringDoubleValueSource, INumberValueSource, IStringNumberValueSource, ITypeSafeStringValueSource, IStringValueSource, IExecutableSelectQuery, BigintValueSource, IBigintValueSource, TypeSafeBigintValueSource, ITypeSafeBigintValueSource } from "../expressions/values"
import type { Default } from "../expressions/Default"
import { TableOrViewRef, NoTableOrViewRequired, NoTableOrViewRequiredView, ITableOf, ITableOrViewOf, ITableOrView, __getTableOrViewPrivate } from "../utils/ITableOrView"
import type { SelectExpression, SelectExpressionFromNoTable, SelectExpressionSubquery } from "../expressions/select"
import type { TypeAdapter, DefaultTypeAdapter } from "../TypeAdapter"
import type { int, double, LocalDate, LocalTime, LocalDateTime, stringInt, stringDouble } from "ts-extended-types"
import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { IConnection } from "../utils/IConnection"
import type { BooleanFragmentExpression, StringIntFragmentExpression, StringNumberFragmentExpression, IntFragmentExpression, NumberFragmentExpression, StringDoubleFragmentExpression, DoubleFragmentExpression, TypeSafeStringFragmentExpression, StringFragmentExpression, LocalDateFragmentExpression, DateFragmentExpression, LocalTimeFragmentExpression, TimeFragmentExpression, LocalDateTimeFragmentExpression, DateTimeFragmentExpression, EqualableFragmentExpression, ComparableFragmentExpression, FragmentBuilder1TypeSafe, FragmentBuilder0, FragmentBuilder1TypeUnsafe, FragmentBuilder2TypeSafe, FragmentBuilder2TypeUnsafe, FragmentBuilder3TypeSafe, FragmentBuilder3TypeUnsafe, FragmentBuilder4TypeSafe, FragmentBuilder4TypeUnsafe, FragmentBuilder5TypeSafe, FragmentBuilder5TypeUnsafe, FragmentBuilder0IfValue, FragmentBuilder1IfValueTypeSafe, FragmentBuilder1IfValueTypeUnsafe, FragmentBuilder2IfValueTypeSafe, FragmentBuilder2IfValueTypeUnsafe, FragmentBuilder3IfValueTypeSafe, FragmentBuilder3IfValueTypeUnsafe, FragmentBuilder4IfValueTypeSafe, FragmentBuilder4IfValueTypeUnsafe, FragmentBuilder5IfValueTypeSafe, FragmentBuilder5IfValueTypeUnsafe, BigintFragmentExpression, TypeSafeBigintFragmentExpression } from "../expressions/fragment"
import type { AnyDB, TypeSafeDB, TypeUnsafeDB } from "../databases"
import { InsertQueryBuilder } from "../queryBuilders/InsertQueryBuilder"
import { UpdateQueryBuilder } from "../queryBuilders/UpdateQueryBuilder"
import { DeleteQueryBuilder } from "../queryBuilders/DeleteQueryBuilder"
import { __getValueSourcePrivate, Argument } from "../expressions/values"
import { SqlOperationStatic0ValueSource, SqlOperationStatic1ValueSource, AggregateFunctions0ValueSource, AggregateFunctions1ValueSource, AggregateFunctions1or2ValueSource, SqlOperationConstValueSource, SqlOperationValueSourceIfValueAlwaysNoop, SqlOperationStaticBooleanValueSource, TableOrViewRawFragmentValueSource } from "../internal/ValueSourceImpl"
import { DefaultImpl } from "../expressions/Default"
import { SelectQueryBuilder } from "../queryBuilders/SelectQueryBuilder"
import ChainedError from "chained-error"
import { FragmentQueryBuilder, FragmentFunctionBuilder, FragmentFunctionBuilderIfValue } from "../queryBuilders/FragmentQueryBuilder"
import { attachSource, attachTransactionSource } from "../utils/attachSource"
import { database, tableOrViewRef, type } from "../utils/symbols"
import { UnwrapPromiseTuple } from "../utils/PromiseProvider"
import { DynamicConditionExpression, Filterable } from "../expressions/dynamicConditionUsingFilters"
import { DynamicConditionBuilder } from "../queryBuilders/DynamicConditionBuilder"
import { RawFragment } from "../utils/RawFragment"
import { RawFragmentImpl } from "../internal/RawFragmentImpl"
import { CustomizedTableOrView } from "../utils/tableOrViewUtils"

export abstract class AbstractConnection<DB extends AnyDB> implements IConnection<DB> {
    [database]: DB
    [type]: 'Connection'
    
    protected __sqlBuilder: SqlBuilder
    protected allowEmptyString: boolean = false
    protected insesitiveCollation?: string
    readonly queryRunner: QueryRunner
    readonly defaultTypeAdapter: DefaultTypeAdapter

    constructor(queryRunner: QueryRunner, sqlBuilder: SqlBuilder) {
        this.defaultTypeAdapter = this as any // transform protected methods to public
        sqlBuilder._defaultTypeAdapter = this.defaultTypeAdapter
        this.__sqlBuilder = sqlBuilder
        this.queryRunner = queryRunner
        sqlBuilder._queryRunner = queryRunner
        sqlBuilder._connectionConfiguration = this as any // transform protected methods to public
    }

    transaction<P extends Promise<any>[]>(fn: () => [...P]): Promise<UnwrapPromiseTuple<P>>
    transaction<T>(fn: () => Promise<T>): Promise<T>
    transaction(fn: () => Promise<any>[] | Promise<any>): Promise<any> {
        const source = new Error('Transaction executed at')
        try {
            return this.queryRunner.executeInTransaction(fn, this.queryRunner).catch((e) => {
                throw attachTransactionSource(new ChainedError(e), source)
            })
        } catch (e) {
            throw new ChainedError(e)
        }
    }

    beginTransaction(): Promise<void> {
        const source = new Error('Query executed at')
        try {
            return this.queryRunner.executeBeginTransaction().catch((e) => {
                throw attachSource(new ChainedError(e), source)
            })
        } catch (e) {
            throw new ChainedError(e)
        }
    }
    commit(): Promise<void> {
        const source = new Error('Query executed at')
        try {
            return this.queryRunner.executeCommit().catch((e) => {
                throw attachSource(new ChainedError(e), source)
            })
        } catch (e) {
            throw new ChainedError(e)
        }
    }
    rollback(): Promise<void> {
        const source = new Error('Query executed at')
        try {
            return this.queryRunner.executeRollback().catch((e) => {
                throw attachSource(new ChainedError(e), source)
            })
        } catch (e) {
            throw new ChainedError(e)
        }
    }

    insertInto<TABLE extends ITableOf<DB, any>>(table: TABLE): InsertExpression<TABLE> {
        return new InsertQueryBuilder(this.__sqlBuilder, table)
    }
    update<TABLE extends ITableOf<DB, any>>(table: TABLE): UpdateExpression<TABLE> {
        return new UpdateQueryBuilder(this.__sqlBuilder, table, false)
    }
    updateAllowingNoWhere<TABLE extends ITableOf<DB, any>>(table: TABLE): UpdateExpressionAllowingNoWhere<TABLE> {
        return new UpdateQueryBuilder(this.__sqlBuilder, table, true)
    }
    deleteFrom<TABLE extends ITableOf<DB, any>>(table: TABLE): DeleteExpression<TABLE> {
        return new DeleteQueryBuilder(this.__sqlBuilder, table, false)
    }
    deleteAllowingNoWhereFrom<TABLE extends ITableOf<DB, any>>(table: TABLE): DeleteExpressionAllowingNoWhere<TABLE> {
        return new DeleteQueryBuilder(this.__sqlBuilder, table, true)
    }
    selectFrom<TABLE_OR_VIEW extends ITableOrViewOf<DB, any>>(table: TABLE_OR_VIEW): SelectExpression<DB, TABLE_OR_VIEW, NoTableOrViewRequiredView<DB>> {
        return new SelectQueryBuilder(this.__sqlBuilder, [table], false) as any // cast to any to improve typescript performace
    }
    selectDistinctFrom<TABLE_OR_VIEW extends ITableOrViewOf<DB, any>>(table: TABLE_OR_VIEW): SelectExpression<DB, TABLE_OR_VIEW, NoTableOrViewRequiredView<DB>> {
        return new SelectQueryBuilder(this.__sqlBuilder, [table], true) as any // cast to any to improve typescript performace
    }
    selectFromNoTable(): SelectExpressionFromNoTable<DB> {
        return new SelectQueryBuilder(this.__sqlBuilder, [], false) as any // cast to any to improve typescript performace
    }
    subSelectUsing<TABLE_OR_VIEW extends ITableOrViewOf<DB, any>>(table: TABLE_OR_VIEW): SelectExpressionSubquery<DB, TABLE_OR_VIEW>
    subSelectUsing<TABLE_OR_VIEW1 extends ITableOrViewOf<DB, any>, TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>>(table1: TABLE_OR_VIEW1, table2: TABLE_OR_VIEW2): SelectExpressionSubquery<DB, TABLE_OR_VIEW1 | TABLE_OR_VIEW2>
    subSelectUsing<TABLE_OR_VIEW1 extends ITableOrViewOf<DB, any>, TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>, TABLE_OR_VIEW3 extends ITableOrViewOf<DB, any>>(table1: TABLE_OR_VIEW1, table2: TABLE_OR_VIEW2, table3: TABLE_OR_VIEW3): SelectExpressionSubquery<DB, TABLE_OR_VIEW1 | TABLE_OR_VIEW2 | TABLE_OR_VIEW3>
    subSelectUsing(...tables: ITableOrView<any>[]): SelectExpressionSubquery<DB, any> {
        const result = new SelectQueryBuilder(this.__sqlBuilder, [], false)
        result.__subSelectUsing = tables
        return result as any // cast to any to improve typescript performace
    }
    subSelectDistinctUsing<TABLE_OR_VIEW extends ITableOrViewOf<DB, any>>(table: TABLE_OR_VIEW): SelectExpressionSubquery<DB, TABLE_OR_VIEW>
    subSelectDistinctUsing<TABLE_OR_VIEW1 extends ITableOrViewOf<DB, any>, TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>>(table1: TABLE_OR_VIEW1, table2: TABLE_OR_VIEW2): SelectExpressionSubquery<DB, TABLE_OR_VIEW1 | TABLE_OR_VIEW2>
    subSelectDistinctUsing<TABLE_OR_VIEW1 extends ITableOrViewOf<DB, any>, TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>, TABLE_OR_VIEW3 extends ITableOrViewOf<DB, any>>(table1: TABLE_OR_VIEW1, table2: TABLE_OR_VIEW2, table3: TABLE_OR_VIEW3): SelectExpressionSubquery<DB, TABLE_OR_VIEW1 | TABLE_OR_VIEW2 | TABLE_OR_VIEW3>
    subSelectDistinctUsing(...tables: ITableOrView<any>[]): SelectExpressionSubquery<DB, any> {
        const result = new SelectQueryBuilder(this.__sqlBuilder, [], false)
        result.__subSelectUsing = tables
        return result as any // cast to any to improve typescript performace
    }

    default(): Default {
        return new DefaultImpl()
    }
    pi(this: IConnection<TypeSafeDB>): DoubleValueSource<NoTableOrViewRequired<DB>, double>
    pi(): NumberValueSource<NoTableOrViewRequired<DB>, number>
    pi(): NumberValueSource<NoTableOrViewRequired<DB>, number> & DoubleValueSource<NoTableOrViewRequired<DB>, double> {
        return new SqlOperationStatic0ValueSource(false, '_pi', 'double', undefined)
    }
    random(this: IConnection<TypeSafeDB>): DoubleValueSource<NoTableOrViewRequired<DB>, double>
    random(): NumberValueSource<NoTableOrViewRequired<DB>, number>
    random(): NumberValueSource<NoTableOrViewRequired<DB>, number> & DoubleValueSource<NoTableOrViewRequired<DB>, double> {
        return new SqlOperationStatic0ValueSource(false, '_random', 'double', undefined)
    }
    currentDate(this: IConnection<TypeSafeDB>): LocalDateValueSource<NoTableOrViewRequired<DB>, LocalDate>
    currentDate(): DateValueSource<NoTableOrViewRequired<DB>, Date>
    currentDate(): DateValueSource<NoTableOrViewRequired<DB>, Date> & LocalDateValueSource<NoTableOrViewRequired<DB>, LocalDate> {
        return new SqlOperationStatic0ValueSource(false, '_currentDate', 'localDate', undefined)
    }
    currentTime(this: IConnection<TypeSafeDB>): LocalTimeValueSource<NoTableOrViewRequired<DB>, LocalTime>
    currentTime(): TimeValueSource<NoTableOrViewRequired<DB>, Date>
    currentTime(): TimeValueSource<NoTableOrViewRequired<DB>, Date> & LocalTimeValueSource<NoTableOrViewRequired<DB>, LocalTime> {
        return new SqlOperationStatic0ValueSource(false, '_currentTime', 'localTime', undefined)
    }
    currentDateTime(this: IConnection<TypeSafeDB>): LocalDateTimeValueSource<NoTableOrViewRequired<DB>, LocalDateTime>
    currentDateTime(): DateTimeValueSource<NoTableOrViewRequired<DB>, Date>
    currentDateTime(): DateTimeValueSource<NoTableOrViewRequired<DB>, Date> & LocalDateTimeValueSource<NoTableOrViewRequired<DB>, LocalDateTime> {
        return new SqlOperationStatic0ValueSource(false, '_currentTimestamp', 'localDateTime', undefined)
    }
    currentTimestamp(this: IConnection<TypeSafeDB>): LocalDateTimeValueSource<NoTableOrViewRequired<DB>, LocalDateTime>
    currentTimestamp(): DateTimeValueSource<NoTableOrViewRequired<DB>, Date>
    currentTimestamp(): DateTimeValueSource<NoTableOrViewRequired<DB>, Date> & LocalDateTimeValueSource<NoTableOrViewRequired<DB>, LocalDateTime> {
        return new SqlOperationStatic0ValueSource(false, '_currentTimestamp', 'localDateTime', undefined)
    }

    const(value: boolean, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource<NoTableOrViewRequired<DB>, boolean>
    const(this: IConnection<TypeSafeDB>, value: stringInt, type: 'stringInt', adapter?: TypeAdapter): StringIntValueSource<NoTableOrViewRequired<DB>, stringInt>
    const(this: IConnection<TypeUnsafeDB>, value: number | string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource<NoTableOrViewRequired<DB>, number | string>
    const(this: IConnection<TypeSafeDB>, value: int, type: 'int', adapter?: TypeAdapter): IntValueSource<NoTableOrViewRequired<DB>, int>
    const(this: IConnection<TypeUnsafeDB>, value: number, type: 'int', adapter?: TypeAdapter): NumberValueSource<NoTableOrViewRequired<DB>, number>
    const(this: IConnection<TypeSafeDB>, value: bigint, type: 'bigint', adapter?: TypeAdapter): TypeSafeBigintValueSource<NoTableOrViewRequired<DB>, bigint>
    const(this: IConnection<TypeUnsafeDB>, value: bigint, type: 'bigint', adapter?: TypeAdapter): BigintValueSource<NoTableOrViewRequired<DB>, bigint>
    const(this: IConnection<TypeSafeDB>, value: stringDouble, type: 'stringDouble', adapter?: TypeAdapter): StringDoubleValueSource<NoTableOrViewRequired<DB>, stringDouble>
    const(this: IConnection<TypeUnsafeDB>, value: number | string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource<NoTableOrViewRequired<DB>, number | string>
    const(this: IConnection<TypeSafeDB>, value: double, type: 'double', adapter?: TypeAdapter): DoubleValueSource<NoTableOrViewRequired<DB>, double>
    const(this: IConnection<TypeUnsafeDB>, value: number, type: 'double', adapter?: TypeAdapter): NumberValueSource<NoTableOrViewRequired<DB>, number>
    const(this: IConnection<TypeSafeDB>, value: string, type: 'string', adapter?: TypeAdapter): TypeSafeStringValueSource<NoTableOrViewRequired<DB>, string>
    const(this: IConnection<TypeUnsafeDB>, value: string, type: 'string', adapter?: TypeAdapter): StringValueSource<NoTableOrViewRequired<DB>, string>
    const(this: IConnection<TypeSafeDB>, value: LocalDate, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource<NoTableOrViewRequired<DB>, LocalDate>
    const(this: IConnection<TypeUnsafeDB>, value: Date, type: 'localDate', adapter?: TypeAdapter): DateValueSource<NoTableOrViewRequired<DB>, Date>
    const(this: IConnection<TypeSafeDB>, value: LocalTime, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource<NoTableOrViewRequired<DB>, LocalTime>
    const(this: IConnection<TypeUnsafeDB>, value: Date, type: 'localTime', adapter?: TypeAdapter): TimeValueSource<NoTableOrViewRequired<DB>, Date>
    const(this: IConnection<TypeSafeDB>, value: LocalDateTime, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource<NoTableOrViewRequired<DB>, LocalDateTime>
    const(this: IConnection<TypeUnsafeDB>, value: Date, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource<NoTableOrViewRequired<DB>, Date>
    const<T>(value: T, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<NoTableOrViewRequired<DB>, T>
    const<T>(value: T, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<NoTableOrViewRequired<DB>, T>
    const<T>(value: T, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<NoTableOrViewRequired<DB>, T>
    const<_T>(value: any, type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any /* EqualableValueSource<NoTableRequired, T> */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        if (typeof adapter === 'string') {
            return new SqlOperationConstValueSource(false, value, adapter, adapter2)
        }
        return new SqlOperationConstValueSource(false, value, type, adapter)
    }

    optionalConst(value: boolean | null | undefined, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource<NoTableOrViewRequired<DB>, boolean | null | undefined>
    optionalConst(this: IConnection<TypeSafeDB>, value: stringInt | null | undefined, type: 'stringInt', adapter?: TypeAdapter): StringIntValueSource<NoTableOrViewRequired<DB>, stringInt | null | undefined>
    optionalConst(this: IConnection<TypeUnsafeDB>, value: number | string | null | undefined, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource<NoTableOrViewRequired<DB>, number | string | null | undefined>
    optionalConst(this: IConnection<TypeSafeDB>, value: int | null | undefined, type: 'int', adapter?: TypeAdapter): IntValueSource<NoTableOrViewRequired<DB>, int | null | undefined>
    optionalConst(this: IConnection<TypeUnsafeDB>, value: number | null | undefined, type: 'int', adapter?: TypeAdapter): NumberValueSource<NoTableOrViewRequired<DB>, number | null | undefined>
    optionalConst(this: IConnection<TypeSafeDB>, value: bigint | null | undefined, type: 'bigint', adapter?: TypeAdapter): TypeSafeBigintValueSource<NoTableOrViewRequired<DB>, bigint | null | undefined>
    optionalConst(this: IConnection<TypeUnsafeDB>, value: bigint | null | undefined, type: 'bigint', adapter?: TypeAdapter): BigintValueSource<NoTableOrViewRequired<DB>, bigint | null | undefined>
    optionalConst(this: IConnection<TypeSafeDB>, value: stringDouble | null | undefined, type: 'stringDouble', adapter?: TypeAdapter): StringDoubleValueSource<NoTableOrViewRequired<DB>, stringDouble | null | undefined>
    optionalConst(this: IConnection<TypeUnsafeDB>, value: number | string | null | undefined, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource<NoTableOrViewRequired<DB>, number | string | null | undefined>
    optionalConst(this: IConnection<TypeSafeDB>, value: double | null | undefined, type: 'double', adapter?: TypeAdapter): DoubleValueSource<NoTableOrViewRequired<DB>, double | null | undefined>
    optionalConst(this: IConnection<TypeUnsafeDB>, value: number | null | undefined, type: 'double', adapter?: TypeAdapter): NumberValueSource<NoTableOrViewRequired<DB>, number | null | undefined>
    optionalConst(this: IConnection<TypeSafeDB>, value: string | null | undefined, type: 'string', adapter?: TypeAdapter): TypeSafeStringValueSource<NoTableOrViewRequired<DB>, string | null | undefined>
    optionalConst(this: IConnection<TypeUnsafeDB>, value: string | null | undefined, type: 'string', adapter?: TypeAdapter): StringValueSource<NoTableOrViewRequired<DB>, string | null | undefined>
    optionalConst(this: IConnection<TypeSafeDB>, value: LocalDate | null | undefined, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource<NoTableOrViewRequired<DB>, LocalDate | null | undefined>
    optionalConst(this: IConnection<TypeUnsafeDB>, value: Date | null | undefined, type: 'localDate', adapter?: TypeAdapter): DateValueSource<NoTableOrViewRequired<DB>, Date | null | undefined>
    optionalConst(this: IConnection<TypeSafeDB>, value: LocalTime | null | undefined, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource<NoTableOrViewRequired<DB>, LocalTime | null | undefined>
    optionalConst(this: IConnection<TypeUnsafeDB>, value: Date | null | undefined, type: 'localTime', adapter?: TypeAdapter): TimeValueSource<NoTableOrViewRequired<DB>, Date | null | undefined>
    optionalConst(this: IConnection<TypeSafeDB>, value: LocalDateTime | null | undefined, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource<NoTableOrViewRequired<DB>, LocalDateTime | null | undefined>
    optionalConst(this: IConnection<TypeUnsafeDB>, value: Date | null | undefined, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource<NoTableOrViewRequired<DB>, Date | null | undefined>
    optionalConst<T>(value: T | null | undefined, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<NoTableOrViewRequired<DB>, T | null | undefined>
    optionalConst<T>(value: T | null | undefined, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<NoTableOrViewRequired<DB>, T | null | undefined>
    optionalConst<T>(value: T | null | undefined, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<NoTableOrViewRequired<DB>, T | null | undefined>
    optionalConst<_T>(value: any, type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any /* EqualableValueSource<NoTableRequired, T> */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        if (typeof adapter === 'string') {
            return new SqlOperationConstValueSource(true, value, adapter, adapter2)
        }
        return new SqlOperationConstValueSource(true, value, type, adapter)
    }

    true<TABLE_OR_VIEW extends ITableOrViewOf<DB, any> = NoTableOrViewRequiredView<DB>>(): BooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef], boolean> {
        return new SqlOperationStaticBooleanValueSource('_true')
    }
    false<TABLE_OR_VIEW extends ITableOrViewOf<DB, any> = NoTableOrViewRequiredView<DB>>(): BooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef], boolean> {
        return new SqlOperationStaticBooleanValueSource('_false')
    }
    exists<TABLE_OR_VIEW extends ITableOrViewOf<DB, any>>(select: IExecutableSelectQuery<DB, any, TABLE_OR_VIEW>): BooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef], boolean> {
        return new SqlOperationStatic1ValueSource(false, '_exists', select, 'boolean', undefined)
    }
    notExists<TABLE_OR_VIEW extends ITableOrViewOf<DB, any>>(select: IExecutableSelectQuery<DB, any, TABLE_OR_VIEW>): BooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef], boolean> {
        return new SqlOperationStatic1ValueSource(false, '_notExists', select, 'boolean', undefined)
    }

    protected executeProcedure(procedureName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[]): Promise<void> {
        try {
            const queryParams: any[] = []
            const query = this.__sqlBuilder._buildCallProcedure(queryParams, procedureName, params)
            const source = new Error('Query executed at')
            return this.__sqlBuilder._queryRunner.executeProcedure(query, queryParams).catch((e) => {
                throw new ChainedError(e)
            }).catch((e) => {
                throw attachSource(new ChainedError(e), source)
            })
        } catch (e) {
            throw new ChainedError(e)
        }
    }

    protected executeFunction(functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'boolean', required: 'required', adapter?: TypeAdapter): Promise<boolean>
    protected executeFunction(functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'boolean', required: 'optional', adapter?: TypeAdapter): Promise<boolean | null>
    protected executeFunction(this: IConnection<TypeSafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'stringInt', required: 'required', adapter?: TypeAdapter): Promise<stringInt>
    protected executeFunction(this: IConnection<TypeSafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'stringInt', required: 'optional', adapter?: TypeAdapter): Promise<stringInt | null>
    protected executeFunction(this: IConnection<TypeUnsafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'stringInt', required: 'required', adapter?: TypeAdapter): Promise<number | string>
    protected executeFunction(this: IConnection<TypeUnsafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'stringInt', required: 'optional', adapter?: TypeAdapter): Promise<number | string | null>
    protected executeFunction(this: IConnection<TypeSafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'int', required: 'required', adapter?: TypeAdapter): Promise<int>
    protected executeFunction(this: IConnection<TypeSafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'int', required: 'optional', adapter?: TypeAdapter): Promise<int | null>
    protected executeFunction(this: IConnection<TypeUnsafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'int', required: 'required', adapter?: TypeAdapter): Promise<number>
    protected executeFunction(this: IConnection<TypeUnsafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'int', required: 'optional', adapter?: TypeAdapter): Promise<number | null>
    protected executeFunction(functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'bigint', required: 'required', adapter?: TypeAdapter): Promise<bigint>
    protected executeFunction(functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'bigint', required: 'optional', adapter?: TypeAdapter): Promise<bigint | null>
    protected executeFunction(this: IConnection<TypeSafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'stringDouble', required: 'required', adapter?: TypeAdapter): Promise<stringDouble>
    protected executeFunction(this: IConnection<TypeSafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'stringDouble', required: 'optional', adapter?: TypeAdapter): Promise<stringDouble | null>
    protected executeFunction(this: IConnection<TypeUnsafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'stringDouble', required: 'required', adapter?: TypeAdapter): Promise<number | string>
    protected executeFunction(this: IConnection<TypeUnsafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'stringDouble', required: 'optional', adapter?: TypeAdapter): Promise<number | string | null>
    protected executeFunction(this: IConnection<TypeSafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'double', required: 'required', adapter?: TypeAdapter): Promise<double>
    protected executeFunction(this: IConnection<TypeSafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'double', required: 'optional', adapter?: TypeAdapter): Promise<double | null>
    protected executeFunction(this: IConnection<TypeUnsafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'double', required: 'required', adapter?: TypeAdapter): Promise<number>
    protected executeFunction(this: IConnection<TypeUnsafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'double', required: 'optional', adapter?: TypeAdapter): Promise<number | null>
    protected executeFunction(functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'string', required: 'required', adapter?: TypeAdapter): Promise<string>
    protected executeFunction(functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'string', required: 'optional', adapter?: TypeAdapter): Promise<string | null>
    protected executeFunction(this: IConnection<TypeSafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'localDate', required: 'required', adapter?: TypeAdapter): Promise<LocalDate>
    protected executeFunction(this: IConnection<TypeSafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'localDate', required: 'optional', adapter?: TypeAdapter): Promise<LocalDate | null>
    protected executeFunction(this: IConnection<TypeUnsafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'localDate', required: 'required', adapter?: TypeAdapter): Promise<Date>
    protected executeFunction(this: IConnection<TypeUnsafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'localDate', required: 'optional', adapter?: TypeAdapter): Promise<Date | null>
    protected executeFunction(this: IConnection<TypeSafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'localTime', required: 'required', adapter?: TypeAdapter): Promise<LocalTime>
    protected executeFunction(this: IConnection<TypeSafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'localTime', required: 'optional', adapter?: TypeAdapter): Promise<LocalTime | null>
    protected executeFunction(this: IConnection<TypeUnsafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'localTime', required: 'required', adapter?: TypeAdapter): Promise<Date>
    protected executeFunction(this: IConnection<TypeUnsafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'localTime', required: 'optional', adapter?: TypeAdapter): Promise<Date | null>
    protected executeFunction(this: IConnection<TypeSafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'localDateTime', required: 'required', adapter?: TypeAdapter): Promise<LocalDateTime>
    protected executeFunction(this: IConnection<TypeSafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'localDateTime', required: 'optional', adapter?: TypeAdapter): Promise<LocalDateTime | null>
    protected executeFunction(this: IConnection<TypeUnsafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'localDateTime', required: 'required', adapter?: TypeAdapter): Promise<Date>
    protected executeFunction(this: IConnection<TypeUnsafeDB>, functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'localDateTime', required: 'optional', adapter?: TypeAdapter): Promise<Date | null>
    protected executeFunction<T>(functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'enum', typeName: string, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T>(functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'enum', typeName: string, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<T>(functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'custom', typeName: string, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T>(functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'custom', typeName: string, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<T>(functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'customComparable', typeName: string, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T>(functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: 'customComparable', typeName: string, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<_T>(functionName: string, params: ValueSource<NoTableOrViewRequired<DB>, any>[], returnType: string, required: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): Promise<any> {
        try {
            if (typeof adapter === 'string') {
                returnType = required
                required = adapter
            } else {
                adapter2 = adapter
            }
            const queryParams: any[] = []
            const query = this.__sqlBuilder._buildCallFunction(queryParams, functionName, params)
            const source = new Error('Query executed at')
            return this.__sqlBuilder._queryRunner.executeFunction(query, queryParams).then((value) => {
                let result
                if (adapter2) {
                    result = adapter2.transformValueFromDB(value, returnType, this.__sqlBuilder._defaultTypeAdapter)
                } else {
                    result = this.__sqlBuilder._defaultTypeAdapter.transformValueFromDB(value, returnType)
                }
                if (result === null || result === undefined) {
                    if (required !== 'optional') {
                        throw new Error('Expected a value as result of the function `' + functionName + '`, but null or undefined value was found')
                    }
                }
                return result
            }).catch((e) => {
                throw new ChainedError(e)
            }).catch((e) => {
                throw attachSource(new ChainedError(e), source)
            })
        } catch (e) {
            throw new ChainedError(e)
        }
    }

    fragmentWithType(type: 'boolean', required: 'required', adapter?: TypeAdapter): BooleanFragmentExpression<DB, boolean>
    fragmentWithType(type: 'boolean', required: 'optional', adapter?: TypeAdapter): BooleanFragmentExpression<DB, boolean | null | undefined>
    fragmentWithType(this: IConnection<TypeSafeDB>, type: 'stringInt', required: 'required', adapter?: TypeAdapter): StringIntFragmentExpression<DB, stringInt>
    fragmentWithType(this: IConnection<TypeSafeDB>, type: 'stringInt', required: 'optional', adapter?: TypeAdapter): StringIntFragmentExpression<DB, stringInt | null | undefined>
    fragmentWithType(this: IConnection<TypeUnsafeDB>, type: 'stringInt', required: 'required', adapter?: TypeAdapter): StringNumberFragmentExpression<DB, number | string>
    fragmentWithType(this: IConnection<TypeUnsafeDB>, type: 'stringInt', required: 'optional', adapter?: TypeAdapter): StringNumberFragmentExpression<DB, number | string | null | undefined>
    fragmentWithType(this: IConnection<TypeSafeDB>, type: 'int', required: 'required', adapter?: TypeAdapter): IntFragmentExpression<DB, int>
    fragmentWithType(this: IConnection<TypeSafeDB>, type: 'int', required: 'optional', adapter?: TypeAdapter): IntFragmentExpression<DB, int | null | undefined>
    fragmentWithType(this: IConnection<TypeUnsafeDB>, type: 'int', required: 'required', adapter?: TypeAdapter): NumberFragmentExpression<DB, number>
    fragmentWithType(this: IConnection<TypeUnsafeDB>, type: 'int', required: 'optional', adapter?: TypeAdapter): NumberFragmentExpression<DB, number | null | undefined>
    fragmentWithType(this: IConnection<TypeSafeDB>, type: 'bigint', required: 'required', adapter?: TypeAdapter): TypeSafeBigintFragmentExpression<DB, bigint>
    fragmentWithType(this: IConnection<TypeSafeDB>, type: 'bigint', required: 'optional', adapter?: TypeAdapter): TypeSafeBigintFragmentExpression<DB, bigint | null | undefined>
    fragmentWithType(this: IConnection<TypeUnsafeDB>, type: 'bigint', required: 'required', adapter?: TypeAdapter): BigintFragmentExpression<DB, bigint>
    fragmentWithType(this: IConnection<TypeUnsafeDB>, type: 'bigint', required: 'optional', adapter?: TypeAdapter): BigintFragmentExpression<DB, bigint | null | undefined>
    fragmentWithType(this: IConnection<TypeSafeDB>, type: 'stringDouble', required: 'required', adapter?: TypeAdapter): StringDoubleFragmentExpression<DB, stringDouble>
    fragmentWithType(this: IConnection<TypeSafeDB>, type: 'stringDouble', required: 'optional', adapter?: TypeAdapter): StringDoubleFragmentExpression<DB, stringDouble | null | undefined>
    fragmentWithType(this: IConnection<TypeUnsafeDB>, type: 'stringDouble', required: 'required', adapter?: TypeAdapter): StringNumberFragmentExpression<DB, number | string>
    fragmentWithType(this: IConnection<TypeUnsafeDB>, type: 'stringDouble', required: 'optional', adapter?: TypeAdapter): StringNumberFragmentExpression<DB, number | string | null | undefined>
    fragmentWithType(this: IConnection<TypeSafeDB>, type: 'double', required: 'required', adapter?: TypeAdapter): DoubleFragmentExpression<DB, double>
    fragmentWithType(this: IConnection<TypeSafeDB>, type: 'double', required: 'optional', adapter?: TypeAdapter): DoubleFragmentExpression<DB, double | null | undefined>
    fragmentWithType(this: IConnection<TypeUnsafeDB>, type: 'double', required: 'required', adapter?: TypeAdapter): NumberFragmentExpression<DB, number>
    fragmentWithType(this: IConnection<TypeUnsafeDB>, type: 'double', required: 'optional', adapter?: TypeAdapter): NumberFragmentExpression<DB, number | null | undefined>
    fragmentWithType(this: IConnection<TypeSafeDB>, type: 'string', required: 'required', adapter?: TypeAdapter): TypeSafeStringFragmentExpression<DB, string>
    fragmentWithType(this: IConnection<TypeSafeDB>, type: 'string', required: 'optional', adapter?: TypeAdapter): TypeSafeStringFragmentExpression<DB, string | null | undefined>
    fragmentWithType(this: IConnection<TypeUnsafeDB>, type: 'string', required: 'required', adapter?: TypeAdapter): StringFragmentExpression<DB, string>
    fragmentWithType(this: IConnection<TypeUnsafeDB>, type: 'string', required: 'optional', adapter?: TypeAdapter): StringFragmentExpression<DB, string | null | undefined>
    fragmentWithType(this: IConnection<TypeSafeDB>, type: 'localDate', required: 'required', adapter?: TypeAdapter): LocalDateFragmentExpression<DB, LocalDate>
    fragmentWithType(this: IConnection<TypeSafeDB>, type: 'localDate', required: 'optional', adapter?: TypeAdapter): LocalDateFragmentExpression<DB, LocalDate | null | undefined>
    fragmentWithType(this: IConnection<TypeUnsafeDB>, type: 'localDate', required: 'required', adapter?: TypeAdapter):  DateFragmentExpression<DB, Date>
    fragmentWithType(this: IConnection<TypeUnsafeDB>, type: 'localDate', required: 'optional', adapter?: TypeAdapter):  DateFragmentExpression<DB, Date | null | undefined>
    fragmentWithType(this: IConnection<TypeSafeDB>, type: 'localTime', required: 'required', adapter?: TypeAdapter): LocalTimeFragmentExpression<DB, LocalTime>
    fragmentWithType(this: IConnection<TypeSafeDB>, type: 'localTime', required: 'optional', adapter?: TypeAdapter): LocalTimeFragmentExpression<DB, LocalTime | null | undefined>
    fragmentWithType(this: IConnection<TypeUnsafeDB>, type: 'localTime', required: 'required', adapter?: TypeAdapter): TimeFragmentExpression<DB, Date>
    fragmentWithType(this: IConnection<TypeUnsafeDB>, type: 'localTime', required: 'optional', adapter?: TypeAdapter): TimeFragmentExpression<DB, Date | null | undefined>
    fragmentWithType(this: IConnection<TypeSafeDB>, type: 'localDateTime', required: 'required', adapter?: TypeAdapter): LocalDateTimeFragmentExpression<DB, LocalDateTime>
    fragmentWithType(this: IConnection<TypeSafeDB>, type: 'localDateTime', required: 'optional', adapter?: TypeAdapter): LocalDateTimeFragmentExpression<DB, LocalDateTime | null | undefined>
    fragmentWithType(this: IConnection<TypeUnsafeDB>, type: 'localDateTime', required: 'required', adapter?: TypeAdapter): DateTimeFragmentExpression<DB, Date>
    fragmentWithType(this: IConnection<TypeUnsafeDB>, type: 'localDateTime', required: 'optional', adapter?: TypeAdapter): DateTimeFragmentExpression<DB, Date | null | undefined>
    fragmentWithType<T>(type: 'enum', typeName: string, required: 'required', adapter?: TypeAdapter): EqualableFragmentExpression<DB, T>
    fragmentWithType<T>(type: 'enum', typeName: string, required: 'optional', adapter?: TypeAdapter): EqualableFragmentExpression<DB, T | null | undefined>
    fragmentWithType<T>(type: 'custom', typeName: string, required: 'required', adapter?: TypeAdapter): EqualableFragmentExpression<DB, T>
    fragmentWithType<T>(type: 'custom', typeName: string, required: 'optional', adapter?: TypeAdapter): EqualableFragmentExpression<DB, T | null | undefined>
    fragmentWithType<T>(type: 'customComparable', typeName: string, required: 'required', adapter?: TypeAdapter): ComparableFragmentExpression<DB, T>
    fragmentWithType<T>(type: 'customComparable', typeName: string, required: 'optional', adapter?: TypeAdapter): ComparableFragmentExpression<DB, T | null | undefined>
    fragmentWithType<_T>(type: string, required: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any {
        if (typeof adapter === 'string') {
            type = required
            required = adapter
        } else {
            adapter2 = adapter
        }
        const optional = required === 'optional'
        return new FragmentQueryBuilder(type, optional, adapter2)
    }

    protected arg(type: 'boolean', required: 'required', adapter?: TypeAdapter): Argument<'boolean', 'required', 'combined', boolean>
    protected arg(type: 'boolean', required: 'optional', adapter?: TypeAdapter): Argument<'boolean', 'optional', 'combined', boolean>
    protected arg(this: IConnection<TypeSafeDB>, type: 'stringInt', required: 'required', adapter?: TypeAdapter): Argument<'stringInt', 'required', 'combined', stringInt>
    protected arg(this: IConnection<TypeSafeDB>, type: 'stringInt', required: 'optional', adapter?: TypeAdapter): Argument<'stringInt', 'optional', 'combined', stringInt>
    protected arg(this: IConnection<TypeUnsafeDB>, type: 'stringInt', required: 'required', adapter?: TypeAdapter): Argument<'stringInt', 'required', 'combined', number | string>
    protected arg(this: IConnection<TypeUnsafeDB>, type: 'stringInt', required: 'optional', adapter?: TypeAdapter): Argument<'stringInt', 'optional', 'combined', number | string>
    protected arg(this: IConnection<TypeSafeDB>, type: 'int', required: 'required', adapter?: TypeAdapter): Argument<'int', 'required', 'combined', int>
    protected arg(this: IConnection<TypeSafeDB>, type: 'int', required: 'optional', adapter?: TypeAdapter): Argument<'int', 'optional', 'combined', int>
    protected arg(this: IConnection<TypeUnsafeDB>, type: 'int', required: 'required', adapter?: TypeAdapter): Argument<'int', 'required', 'combined', number>
    protected arg(this: IConnection<TypeUnsafeDB>, type: 'int', required: 'optional', adapter?: TypeAdapter): Argument<'int', 'optional', 'combined', number>
    protected arg(type: 'bigint', required: 'required', adapter?: TypeAdapter): Argument<'bigint', 'required', 'combined', bigint>
    protected arg(type: 'bigint', required: 'optional', adapter?: TypeAdapter): Argument<'bigint', 'optional', 'combined', bigint>
    protected arg(this: IConnection<TypeSafeDB>, type: 'stringDouble', required: 'required', adapter?: TypeAdapter): Argument<'stringDouble', 'required', 'combined', stringDouble>
    protected arg(this: IConnection<TypeSafeDB>, type: 'stringDouble', required: 'optional', adapter?: TypeAdapter): Argument<'stringDouble', 'optional', 'combined', stringDouble>
    protected arg(this: IConnection<TypeUnsafeDB>, type: 'stringDouble', required: 'required', adapter?: TypeAdapter): Argument<'stringDouble', 'required', 'combined', number | string>
    protected arg(this: IConnection<TypeUnsafeDB>, type: 'stringDouble', required: 'optional', adapter?: TypeAdapter): Argument<'stringDouble', 'optional', 'combined', number | string>
    protected arg(this: IConnection<TypeSafeDB>, type: 'double', required: 'required', adapter?: TypeAdapter): Argument<'double', 'required', 'combined', double>
    protected arg(this: IConnection<TypeSafeDB>, type: 'double', required: 'optional', adapter?: TypeAdapter): Argument<'double', 'optional', 'combined', double>
    protected arg(this: IConnection<TypeUnsafeDB>, type: 'double', required: 'required', adapter?: TypeAdapter): Argument<'double', 'required', 'combined', number>
    protected arg(this: IConnection<TypeUnsafeDB>, type: 'double', required: 'optional', adapter?: TypeAdapter): Argument<'double', 'optional', 'combined', number>
    protected arg(type: 'string', required: 'required', adapter?: TypeAdapter): Argument<'string', 'required', 'combined', string>
    protected arg(type: 'string', required: 'optional', adapter?: TypeAdapter): Argument<'string', 'optional', 'combined', string>
    protected arg(this: IConnection<TypeSafeDB>, type: 'localDate', required: 'required', adapter?: TypeAdapter): Argument<'localDate', 'required', 'combined', LocalDate>
    protected arg(this: IConnection<TypeSafeDB>, type: 'localDate', required: 'optional', adapter?: TypeAdapter): Argument<'localDate', 'optional', 'combined', LocalDate>
    protected arg(this: IConnection<TypeUnsafeDB>, type: 'localDate', required: 'required', adapter?: TypeAdapter): Argument<'localDate', 'required', 'combined', Date>
    protected arg(this: IConnection<TypeUnsafeDB>, type: 'localDate', required: 'optional', adapter?: TypeAdapter): Argument<'localDate', 'optional', 'combined', Date>
    protected arg(this: IConnection<TypeSafeDB>, type: 'localTime', required: 'required', adapter?: TypeAdapter): Argument<'localTime', 'required', 'combined', LocalTime>
    protected arg(this: IConnection<TypeSafeDB>, type: 'localTime', required: 'optional', adapter?: TypeAdapter): Argument<'localTime', 'optional', 'combined', LocalTime>
    protected arg(this: IConnection<TypeUnsafeDB>, type: 'localTime', required: 'required', adapter?: TypeAdapter): Argument<'localTime', 'required', 'combined', Date>
    protected arg(this: IConnection<TypeUnsafeDB>, type: 'localTime', required: 'optional', adapter?: TypeAdapter): Argument<'localTime', 'optional', 'combined', Date>
    protected arg(this: IConnection<TypeSafeDB>, type: 'localDateTime', required: 'required', adapter?: TypeAdapter): Argument<'localDateTime', 'required', 'combined', LocalDateTime>
    protected arg(this: IConnection<TypeSafeDB>, type: 'localDateTime', required: 'optional', adapter?: TypeAdapter): Argument<'localDateTime', 'optional', 'combined', LocalDateTime>
    protected arg(this: IConnection<TypeUnsafeDB>, type: 'localDateTime', required: 'required', adapter?: TypeAdapter): Argument<'localDateTime', 'required', 'combined', Date>
    protected arg(this: IConnection<TypeUnsafeDB>, type: 'localDateTime', required: 'optional', adapter?: TypeAdapter): Argument<'localDateTime', 'optional', 'combined', Date>
    protected arg<T>(type: 'enum', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'enum', 'required', 'combined', T>
    protected arg<T>(type: 'enum', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'enum', 'optional', 'combined', T>
    protected arg<T>(type: 'custom', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'custom', 'required', 'combined', T>
    protected arg<T>(type: 'custom', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'custom', 'optional', 'combined', T>
    protected arg<T>(type: 'customComparable', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'customComparable', 'required', 'combined', T>
    protected arg<T>(type: 'customComparable', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'customComparable', 'optional', 'combined', T>
    protected arg<_T>(type: string, required: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any {
        if (typeof adapter === 'string') {
            return new Argument(type as any, adapter, required as any, 'combined', adapter2)
        } else {
            return new Argument(type as any, type, required as any, 'combined', adapter)
        }
    }

    protected valueArg(type: 'boolean', required: 'required', adapter?: TypeAdapter): Argument<'boolean', 'required', 'value', boolean>
    protected valueArg(type: 'boolean', required: 'optional', adapter?: TypeAdapter): Argument<'boolean', 'optional', 'value', boolean>
    protected valueArg(this: IConnection<TypeSafeDB>, type: 'stringInt', required: 'required', adapter?: TypeAdapter): Argument<'stringInt', 'required', 'value', stringInt>
    protected valueArg(this: IConnection<TypeSafeDB>, type: 'stringInt', required: 'optional', adapter?: TypeAdapter): Argument<'stringInt', 'optional', 'value', stringInt>
    protected valueArg(this: IConnection<TypeUnsafeDB>, type: 'stringInt', required: 'required', adapter?: TypeAdapter): Argument<'stringInt', 'required', 'value', number | string>
    protected valueArg(this: IConnection<TypeUnsafeDB>, type: 'stringInt', required: 'optional', adapter?: TypeAdapter): Argument<'stringInt', 'optional', 'value', number | string>
    protected valueArg(this: IConnection<TypeSafeDB>, type: 'int', required: 'required', adapter?: TypeAdapter): Argument<'int', 'required', 'value', int>
    protected valueArg(this: IConnection<TypeSafeDB>, type: 'int', required: 'optional', adapter?: TypeAdapter): Argument<'int', 'optional', 'value', int>
    protected valueArg(this: IConnection<TypeUnsafeDB>, type: 'int', required: 'required', adapter?: TypeAdapter): Argument<'int', 'required', 'value', number>
    protected valueArg(this: IConnection<TypeUnsafeDB>, type: 'int', required: 'optional', adapter?: TypeAdapter): Argument<'int', 'optional', 'value', number>
    protected valueArg(type: 'bigint', required: 'required', adapter?: TypeAdapter): Argument<'bigint', 'required', 'value', bigint>
    protected valueArg(type: 'bigint', required: 'optional', adapter?: TypeAdapter): Argument<'bigint', 'optional', 'value', bigint>
    protected valueArg(this: IConnection<TypeSafeDB>, type: 'stringDouble', required: 'required', adapter?: TypeAdapter): Argument<'stringDouble', 'required', 'value', stringDouble>
    protected valueArg(this: IConnection<TypeSafeDB>, type: 'stringDouble', required: 'optional', adapter?: TypeAdapter): Argument<'stringDouble', 'optional', 'value', stringDouble>
    protected valueArg(this: IConnection<TypeUnsafeDB>, type: 'stringDouble', required: 'required', adapter?: TypeAdapter): Argument<'stringDouble', 'required', 'value', number | string>
    protected valueArg(this: IConnection<TypeUnsafeDB>, type: 'stringDouble', required: 'optional', adapter?: TypeAdapter): Argument<'stringDouble', 'optional', 'value', number | string>
    protected valueArg(this: IConnection<TypeSafeDB>, type: 'double', required: 'required', adapter?: TypeAdapter): Argument<'double', 'required', 'value', double>
    protected valueArg(this: IConnection<TypeSafeDB>, type: 'double', required: 'optional', adapter?: TypeAdapter): Argument<'double', 'optional', 'value', double>
    protected valueArg(this: IConnection<TypeUnsafeDB>, type: 'double', required: 'required', adapter?: TypeAdapter): Argument<'double', 'required', 'value', number>
    protected valueArg(this: IConnection<TypeUnsafeDB>, type: 'double', required: 'optional', adapter?: TypeAdapter): Argument<'double', 'optional', 'value', number>
    protected valueArg(type: 'string', required: 'required', adapter?: TypeAdapter): Argument<'string', 'required', 'value', string>
    protected valueArg(type: 'string', required: 'optional', adapter?: TypeAdapter): Argument<'string', 'optional', 'value', string>
    protected valueArg(this: IConnection<TypeSafeDB>, type: 'localDate', required: 'required', adapter?: TypeAdapter): Argument<'localDate', 'required', 'value', LocalDate>
    protected valueArg(this: IConnection<TypeSafeDB>, type: 'localDate', required: 'optional', adapter?: TypeAdapter): Argument<'localDate', 'optional', 'value', LocalDate>
    protected valueArg(this: IConnection<TypeUnsafeDB>, type: 'localDate', required: 'required', adapter?: TypeAdapter): Argument<'localDate', 'required', 'value', Date>
    protected valueArg(this: IConnection<TypeUnsafeDB>, type: 'localDate', required: 'optional', adapter?: TypeAdapter): Argument<'localDate', 'optional', 'value', Date>
    protected valueArg(this: IConnection<TypeSafeDB>, type: 'localTime', required: 'required', adapter?: TypeAdapter): Argument<'localTime', 'required', 'value', LocalTime>
    protected valueArg(this: IConnection<TypeSafeDB>, type: 'localTime', required: 'optional', adapter?: TypeAdapter): Argument<'localTime', 'optional', 'value', LocalTime>
    protected valueArg(this: IConnection<TypeUnsafeDB>, type: 'localTime', required: 'required', adapter?: TypeAdapter): Argument<'localTime', 'required', 'value', Date>
    protected valueArg(this: IConnection<TypeUnsafeDB>, type: 'localTime', required: 'optional', adapter?: TypeAdapter): Argument<'localTime', 'optional', 'value', Date>
    protected valueArg(this: IConnection<TypeSafeDB>, type: 'localDateTime', required: 'required', adapter?: TypeAdapter): Argument<'localDateTime', 'required', 'value', LocalDateTime>
    protected valueArg(this: IConnection<TypeSafeDB>, type: 'localDateTime', required: 'optional', adapter?: TypeAdapter): Argument<'localDateTime', 'optional', 'value', LocalDateTime>
    protected valueArg(this: IConnection<TypeUnsafeDB>, type: 'localDateTime', required: 'required', adapter?: TypeAdapter): Argument<'localDateTime', 'required', 'value', Date>
    protected valueArg(this: IConnection<TypeUnsafeDB>, type: 'localDateTime', required: 'optional', adapter?: TypeAdapter): Argument<'localDateTime', 'optional', 'value', Date>
    protected valueArg<T>(type: 'enum', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'enum', 'required', 'value', T>
    protected valueArg<T>(type: 'enum', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'enum', 'optional', 'value', T>
    protected valueArg<T>(type: 'custom', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'custom', 'required', 'value', T>
    protected valueArg<T>(type: 'custom', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'custom', 'optional', 'value', T>
    protected valueArg<T>(type: 'customComparable', typeName: string, required: 'required', adapter?: TypeAdapter): Argument<'customComparable', 'required', 'value', T>
    protected valueArg<T>(type: 'customComparable', typeName: string, required: 'optional', adapter?: TypeAdapter): Argument<'customComparable', 'optional', 'value', T>
    protected valueArg<_T>(type: string, required: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any {
        if (typeof adapter === 'string') {
            return new Argument(type as any, adapter, required as any, 'value', adapter2)
        } else {
            return new Argument(type as any, type, required as any, 'value', adapter)
        }
    }

    protected buildFragmentWithArgs(): FragmentBuilder0<DB>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any, any>>(this: IConnection<TypeSafeDB>, a1: A1): FragmentBuilder1TypeSafe<DB, A1>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any, any>>(this: IConnection<TypeUnsafeDB>, a1: A1): FragmentBuilder1TypeUnsafe<DB, A1>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>>(this: IConnection<TypeSafeDB>, a1: A1, a2: A2): FragmentBuilder2TypeSafe<DB, A1, A2>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>>(this: IConnection<TypeUnsafeDB>, a1: A1, a2: A2): FragmentBuilder2TypeUnsafe<DB, A1, A2>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>>(this: IConnection<TypeSafeDB>, a1: A1, a2: A2, a3: A3): FragmentBuilder3TypeSafe<DB, A1, A2, A3>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>>(this: IConnection<TypeUnsafeDB>, a1: A1, a2: A2, a3: A3): FragmentBuilder3TypeUnsafe<DB, A1, A2, A3>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>>(this: IConnection<TypeSafeDB>, a1: A1, a2: A2, a3: A3, a4: A4): FragmentBuilder4TypeSafe<DB, A1, A2, A3, A4>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>>(this: IConnection<TypeUnsafeDB>, a1: A1, a2: A2, a3: A3, a4: A4): FragmentBuilder4TypeUnsafe<DB, A1, A2, A3, A4>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>, A5 extends Argument<any, any, any, any>>(this: IConnection<TypeSafeDB>, a1: A1, a2: A2, a3: A3, a4: A4, a5: A5): FragmentBuilder5TypeSafe<DB, A1, A2, A3, A4, A5>
    protected buildFragmentWithArgs<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>, A5 extends Argument<any, any, any, any>>(this: IConnection<TypeUnsafeDB>, a1: A1, a2: A2, a3: A3, a4: A4, a5: A5): FragmentBuilder5TypeUnsafe<DB, A1, A2, A3, A4, A5>
    protected buildFragmentWithArgs(...args: Argument<any, any, any, any>[]): any {
        return new FragmentFunctionBuilder(args)
    }

    protected buildFragmentWithArgsIfValue(): FragmentBuilder0IfValue<DB>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>>(this: IConnection<TypeSafeDB>, a1: A1): FragmentBuilder1IfValueTypeSafe<DB, A1>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>>(this: IConnection<TypeUnsafeDB>, a1: A1): FragmentBuilder1IfValueTypeUnsafe<DB, A1>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>>(this: IConnection<TypeSafeDB>, a1: A1, a2: A2): FragmentBuilder2IfValueTypeSafe<DB, A1, A2>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>>(this: IConnection<TypeUnsafeDB>, a1: A1, a2: A2): FragmentBuilder2IfValueTypeUnsafe<DB, A1, A2>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>>(this: IConnection<TypeSafeDB>, a1: A1, a2: A2, a3: A3): FragmentBuilder3IfValueTypeSafe<DB, A1, A2, A3>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>>(this: IConnection<TypeUnsafeDB>, a1: A1, a2: A2, a3: A3): FragmentBuilder3IfValueTypeUnsafe<DB, A1, A2, A3>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>>(this: IConnection<TypeSafeDB>, a1: A1, a2: A2, a3: A3, a4: A4): FragmentBuilder4IfValueTypeSafe<DB, A1, A2, A3, A4>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>>(this: IConnection<TypeUnsafeDB>, a1: A1, a2: A2, a3: A3, a4: A4): FragmentBuilder4IfValueTypeUnsafe<DB, A1, A2, A3, A4>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>, A5 extends Argument<any, any, any, any>>(this: IConnection<TypeSafeDB>, a1: A1, a2: A2, a3: A3, a4: A4, a5: A5): FragmentBuilder5IfValueTypeSafe<DB, A1, A2, A3, A4, A5>
    protected buildFragmentWithArgsIfValue<A1 extends Argument<any, any, any, any>, A2 extends Argument<any, any, any, any>, A3 extends Argument<any, any, any, any>, A4 extends Argument<any, any, any, any>, A5 extends Argument<any, any, any, any>>(this: IConnection<TypeUnsafeDB>, a1: A1, a2: A2, a3: A3, a4: A4, a5: A5): FragmentBuilder5IfValueTypeUnsafe<DB, A1, A2, A3, A4, A5>
    protected buildFragmentWithArgsIfValue(...args: Argument<any, any, any, any>[]): any {
        return new FragmentFunctionBuilderIfValue(this as any, args) // make this protected fields as public
    }

    rawFragment(sql: TemplateStringsArray, ...params: Array<ValueSource<any, any> | IExecutableSelectQuery<DB, any, any>>): RawFragment<DB> {
        return new RawFragmentImpl(sql, params)
    }

    protected createTableOrViewCustomization(fn: (table: ValueSource<NoTableOrViewRequired<DB>, unknown>, alias: ValueSource<NoTableOrViewRequired<DB>, unknown>) => RawFragment<DB>): (<TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, NAME extends string>(tableOrView: TABLE_OR_VIEW, name: NAME) => CustomizedTableOrView<TABLE_OR_VIEW, NAME>)
    protected createTableOrViewCustomization<P1>(fn: (table: ValueSource<NoTableOrViewRequired<DB>, unknown>, alias: ValueSource<NoTableOrViewRequired<DB>, unknown>, p1: P1) => RawFragment<DB>): (<TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, NAME extends string>(tableOrView: TABLE_OR_VIEW, name: NAME, p1: P1) => CustomizedTableOrView<TABLE_OR_VIEW, NAME>)
    protected createTableOrViewCustomization<P1, P2>(fn: (table: ValueSource<NoTableOrViewRequired<DB>, unknown>, alias: ValueSource<NoTableOrViewRequired<DB>, unknown>, p1: P1, p2: P2) => RawFragment<DB>): (<TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, NAME extends string>(tableOrView: TABLE_OR_VIEW, name: NAME, p1: P1, p2: P2) => CustomizedTableOrView<TABLE_OR_VIEW, NAME>)
    protected createTableOrViewCustomization<P1, P2, P3>(fn: (table: ValueSource<NoTableOrViewRequired<DB>, unknown>, alias: ValueSource<NoTableOrViewRequired<DB>, unknown>, p1: P1, p2: P2, p3: P3) => RawFragment<DB>): (<TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, NAME extends string>(tableOrView: TABLE_OR_VIEW, name: NAME, p1: P1, p2: P2, p3: P3) => CustomizedTableOrView<TABLE_OR_VIEW, NAME>)
    protected createTableOrViewCustomization<P1, P2, P3, P4>(fn: (table: ValueSource<NoTableOrViewRequired<DB>, unknown>, alias: ValueSource<NoTableOrViewRequired<DB>, unknown>, p1: P1, p2: P2, p3: P3, p4: P4) => RawFragment<DB>): (<TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, NAME extends string>(tableOrView: TABLE_OR_VIEW, name: NAME, p1: P1, p2: P2, p3: P3, p4: P4) => CustomizedTableOrView<TABLE_OR_VIEW, NAME>)
    protected createTableOrViewCustomization<P1, P2, P3, P4, P5>(fn: (table: ValueSource<NoTableOrViewRequired<DB>, unknown>, alias: ValueSource<NoTableOrViewRequired<DB>, unknown>, p1: P1, p2: P2, p3: P3, p4: P4, p5: P5) => RawFragment<DB>): (<TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, NAME extends string>(tableOrView: TABLE_OR_VIEW, name: NAME, p1: P1, p2: P2, p3: P3, p4: P4, p5: P5) => CustomizedTableOrView<TABLE_OR_VIEW, NAME>)
    protected createTableOrViewCustomization(fn: (table: ValueSource<NoTableOrViewRequired<DB>, unknown>, alias: ValueSource<NoTableOrViewRequired<DB>, unknown>, ...params: any[]) => RawFragment<DB>): (<TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, NAME extends string>(tableOrView: TABLE_OR_VIEW, name: NAME, ...params: any[]) => CustomizedTableOrView<TABLE_OR_VIEW, NAME>) {
        return (tableOrView: ITableOrViewOf<DB, any>, name: string, ...params: any[]) => {
            const as = __getTableOrViewPrivate(tableOrView).__as
            const result = (tableOrView as any).as(as)
            const table = new TableOrViewRawFragmentValueSource(result, '_rawFragmentTableName')
            const alias = new TableOrViewRawFragmentValueSource(result, '_rawFragmentTableAlias')
            const template = fn(table, alias, ...params)
            const p = __getTableOrViewPrivate(result)
            p.__template = template
            p.__customizationName = name
            return result as any
        }
    }

    noValueBoolean<TABLE_OR_VIEW extends ITableOrViewOf<DB, any> = NoTableOrViewRequiredView<DB>>(): IfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef], boolean> {
        return new SqlOperationValueSourceIfValueAlwaysNoop()
    }

    // Agregate functions
    countAll(this: IConnection<TypeSafeDB>): IntValueSource<NoTableOrViewRequired<DB>, int>
    countAll(): NumberValueSource<NoTableOrViewRequired<DB>, number>
    countAll(): ValueSource<NoTableOrViewRequired<DB>, number> {
        return new AggregateFunctions0ValueSource('_countAll', 'int', undefined)
    }
    count<TABLE_OR_VIEW extends TableOrViewRef<DB>>(this: IConnection<TypeSafeDB>, value: ValueSource<TABLE_OR_VIEW, any>): IntValueSource<TABLE_OR_VIEW, int>
    count<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: ValueSource<TABLE_OR_VIEW, any>): NumberValueSource<TABLE_OR_VIEW, number>
    count<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: ValueSource<TABLE_OR_VIEW, any>): ValueSource<TABLE_OR_VIEW, any> {
        return new AggregateFunctions1ValueSource(false, '_count', value, 'int', undefined)
    }
    countDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(this: IConnection<TypeSafeDB>, value: ValueSource<TABLE_OR_VIEW, any>): IntValueSource<TABLE_OR_VIEW, int>
    countDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: ValueSource<TABLE_OR_VIEW, any>): NumberValueSource<TABLE_OR_VIEW, number>
    countDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: ValueSource<TABLE_OR_VIEW, any>): ValueSource<TABLE_OR_VIEW, any> {
        return new AggregateFunctions1ValueSource(false, '_countDistinct', value, 'int', undefined)
    }
    max<TABLE_OR_VIEW extends TableOrViewRef<DB>, TYPE extends IComparableValueSource<TABLE_OR_VIEW, any>>(value: TYPE): RemapValueSourceTypeAsOptional<TABLE_OR_VIEW, TYPE> {
        const valuePrivate = __getValueSourcePrivate(value)
        return (new AggregateFunctions1ValueSource(true, '_max', value, valuePrivate.__valueType, valuePrivate.__typeAdapter)) as any
    }
    min<TABLE_OR_VIEW extends TableOrViewRef<DB>, TYPE extends IComparableValueSource<TABLE_OR_VIEW, any>>(value: TYPE): RemapValueSourceTypeAsOptional<TABLE_OR_VIEW, TYPE> {
        const valuePrivate = __getValueSourcePrivate(value)
        return (new AggregateFunctions1ValueSource(true, '_min', value, valuePrivate.__valueType, valuePrivate.__typeAdapter)) as any
    }
    sum<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IIntValueSource<TABLE_OR_VIEW, int | null | undefined>): IntValueSource<TABLE_OR_VIEW, int | null | undefined>
    sum<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IDoubleValueSource<TABLE_OR_VIEW, double | null | undefined>): DoubleValueSource<TABLE_OR_VIEW, double | null | undefined>
    sum<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IStringIntValueSource<TABLE_OR_VIEW, stringInt | null | undefined>): StringIntValueSource<TABLE_OR_VIEW, stringInt | null | undefined>
    sum<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IStringDoubleValueSource<TABLE_OR_VIEW, stringDouble | null | undefined>): StringDoubleValueSource<TABLE_OR_VIEW, stringDouble | null | undefined>
    sum<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: INumberValueSource<TABLE_OR_VIEW, number | null | undefined>): NumberValueSource<TABLE_OR_VIEW, number | null | undefined>
    sum<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IStringNumberValueSource<TABLE_OR_VIEW, number | string | null | undefined>): StringNumberValueSource<TABLE_OR_VIEW, number | string | null | undefined>
    sum<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: ITypeSafeBigintValueSource<TABLE_OR_VIEW, bigint | null | undefined>): TypeSafeBigintValueSource<TABLE_OR_VIEW, bigint | null | undefined>
    sum<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IBigintValueSource<TABLE_OR_VIEW, bigint | null | undefined>): BigintValueSource<TABLE_OR_VIEW, bigint | null | undefined>
    sum<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: ValueSource<TABLE_OR_VIEW, any>): ValueSource<TABLE_OR_VIEW, any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1ValueSource(true, '_sum', value, valuePrivate.__valueType, valuePrivate.__typeAdapter)
    }
    sumDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IIntValueSource<TABLE_OR_VIEW, int | null | undefined>): IntValueSource<TABLE_OR_VIEW, int | null | undefined>
    sumDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IDoubleValueSource<TABLE_OR_VIEW, double | null | undefined>): DoubleValueSource<TABLE_OR_VIEW, double | null | undefined>
    sumDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IStringIntValueSource<TABLE_OR_VIEW, stringInt | null | undefined>): StringIntValueSource<TABLE_OR_VIEW, stringInt | null | undefined>
    sumDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IStringDoubleValueSource<TABLE_OR_VIEW, stringDouble | null | undefined>): StringDoubleValueSource<TABLE_OR_VIEW, stringDouble | null | undefined>
    sumDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: INumberValueSource<TABLE_OR_VIEW, number | null | undefined>): NumberValueSource<TABLE_OR_VIEW, number | null | undefined>
    sumDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IStringNumberValueSource<TABLE_OR_VIEW, number | string | null | undefined>): StringNumberValueSource<TABLE_OR_VIEW, number | string | null | undefined>
    sumDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: ITypeSafeBigintValueSource<TABLE_OR_VIEW, bigint | null | undefined>): TypeSafeBigintValueSource<TABLE_OR_VIEW, bigint | null | undefined>
    sumDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IBigintValueSource<TABLE_OR_VIEW, bigint | null | undefined>): BigintValueSource<TABLE_OR_VIEW, bigint | null | undefined>
    sumDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: ValueSource<TABLE_OR_VIEW, any>): ValueSource<TABLE_OR_VIEW, any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1ValueSource(true, '_sumDistinct', value, valuePrivate.__valueType, valuePrivate.__typeAdapter)
    }
    average<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IIntValueSource<TABLE_OR_VIEW, int | null | undefined>): IntValueSource<TABLE_OR_VIEW, int | null | undefined>
    average<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IDoubleValueSource<TABLE_OR_VIEW, double | null | undefined>): DoubleValueSource<TABLE_OR_VIEW, double | null | undefined>
    average<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IStringIntValueSource<TABLE_OR_VIEW, stringInt | null | undefined>): StringIntValueSource<TABLE_OR_VIEW, stringInt | null | undefined>
    average<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IStringDoubleValueSource<TABLE_OR_VIEW, stringDouble | null | undefined>): StringDoubleValueSource<TABLE_OR_VIEW, stringDouble | null | undefined>
    average<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: INumberValueSource<TABLE_OR_VIEW, number | null | undefined>): NumberValueSource<TABLE_OR_VIEW, number | null | undefined>
    average<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IStringNumberValueSource<TABLE_OR_VIEW, number | string | null | undefined>): StringNumberValueSource<TABLE_OR_VIEW, number | string | null | undefined>
    average<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: ITypeSafeBigintValueSource<TABLE_OR_VIEW, bigint | null | undefined>): TypeSafeBigintValueSource<TABLE_OR_VIEW, bigint | null | undefined>
    average<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IBigintValueSource<TABLE_OR_VIEW, bigint | null | undefined>): BigintValueSource<TABLE_OR_VIEW, bigint | null | undefined>
    average<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: ValueSource<TABLE_OR_VIEW, any>): ValueSource<TABLE_OR_VIEW, any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1ValueSource(true, '_average', value, valuePrivate.__valueType, valuePrivate.__typeAdapter)
    }
    averageDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IIntValueSource<TABLE_OR_VIEW, int | null | undefined>): IntValueSource<TABLE_OR_VIEW, int | null | undefined>
    averageDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IDoubleValueSource<TABLE_OR_VIEW, double | null | undefined>): DoubleValueSource<TABLE_OR_VIEW, double | null | undefined>
    averageDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IStringIntValueSource<TABLE_OR_VIEW, stringInt | null | undefined>): StringIntValueSource<TABLE_OR_VIEW, stringInt | null | undefined>
    averageDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IStringDoubleValueSource<TABLE_OR_VIEW, stringDouble | null | undefined>): StringDoubleValueSource<TABLE_OR_VIEW, stringDouble | null | undefined>
    averageDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: INumberValueSource<TABLE_OR_VIEW, number | null | undefined>): NumberValueSource<TABLE_OR_VIEW, number | null | undefined>
    averageDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IStringNumberValueSource<TABLE_OR_VIEW, number | string | null | undefined>): StringNumberValueSource<TABLE_OR_VIEW, number | string | null | undefined>
    averageDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: ITypeSafeBigintValueSource<TABLE_OR_VIEW, bigint | null | undefined>): TypeSafeBigintValueSource<TABLE_OR_VIEW, bigint | null | undefined>
    averageDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IBigintValueSource<TABLE_OR_VIEW, bigint | null | undefined>): BigintValueSource<TABLE_OR_VIEW, bigint | null | undefined>
    averageDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: ValueSource<TABLE_OR_VIEW, any>): ValueSource<TABLE_OR_VIEW, any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1ValueSource(true, '_averageDistinct', value, valuePrivate.__valueType, valuePrivate.__typeAdapter)
    }
    stringConcat<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: ITypeSafeStringValueSource<TABLE_OR_VIEW, string | null | undefined>): TypeSafeStringValueSource<TABLE_OR_VIEW, string | null | undefined>
    stringConcat<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IStringValueSource<TABLE_OR_VIEW, string | null | undefined>): StringValueSource<TABLE_OR_VIEW, string | null | undefined>
    stringConcat<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: ITypeSafeStringValueSource<TABLE_OR_VIEW, string | null | undefined>, separator: string): TypeSafeStringValueSource<TABLE_OR_VIEW, string | null | undefined>
    stringConcat<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IStringValueSource<TABLE_OR_VIEW, string | null | undefined>, separator: string): StringValueSource<TABLE_OR_VIEW, string | null | undefined>
    stringConcat<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: ValueSource<TABLE_OR_VIEW, any>, separator?: string): ValueSource<TABLE_OR_VIEW, any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1or2ValueSource(true, '_stringConcat', separator, value, valuePrivate.__valueType, valuePrivate.__typeAdapter)
    }
    stringConcatDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: ITypeSafeStringValueSource<TABLE_OR_VIEW, string | null | undefined>): TypeSafeStringValueSource<TABLE_OR_VIEW, string | null | undefined>
    stringConcatDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IStringValueSource<TABLE_OR_VIEW, string | null | undefined>): StringValueSource<TABLE_OR_VIEW, string | null | undefined>
    stringConcatDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: ITypeSafeStringValueSource<TABLE_OR_VIEW, string | null | undefined>, separator: string): TypeSafeStringValueSource<TABLE_OR_VIEW, string | null | undefined>
    stringConcatDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: IStringValueSource<TABLE_OR_VIEW, string | null | undefined>, separator: string): StringValueSource<TABLE_OR_VIEW, string | null | undefined>
    stringConcatDistinct<TABLE_OR_VIEW extends TableOrViewRef<DB>>(value: ValueSource<TABLE_OR_VIEW, any>, separator?: string): ValueSource<TABLE_OR_VIEW, any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1or2ValueSource(true, '_stringConcatDistinct', separator, value, valuePrivate.__valueType, valuePrivate.__typeAdapter)
    }

    dynamicConditionFor<DEFINITION extends Filterable>(definition: DEFINITION): DynamicConditionExpression<DEFINITION> {
        return new DynamicConditionBuilder(definition)
    }

    protected transformValueFromDB(value: unknown, type: string): unknown {
        if (value === undefined) {
            return null
        }
        if (value === null) {
            return null
        }
        if (value === '' && !this.allowEmptyString) {
            return null
        }
        switch (type) {
            case 'boolean':
                if (typeof value === 'boolean') {
                    return value
                }
                if (typeof value === 'number') {
                    return !!value
                }
                if (typeof value === 'bigint') {
                    return !!value
                }
                throw new Error('Invalid boolean value received from the db: ' + value)
            case 'int':
                if (typeof value === 'number') {
                    if (!Number.isInteger(value)) {
                        throw new Error('Invalid int value received from the db: ' + value)
                    }
                    return value
                }
                if (typeof value === 'string') {
                    const result = +value
                    if (isNaN(result)) {
                        throw new Error('Invalid int value received from the db: ' + value)
                    }
                    return result
                }
                if (typeof value === 'bigint') {
                    const result = Number(value)
                    if (!Number.isSafeInteger(result)) {
                        throw new Error('Unnoticed precition lost transforming a bigint to int number. Value: ' + value)
                    }
                    return result
                }
                throw new Error('Invalid int value received from the db: ' + value)
            case 'stringInt':
                if (typeof value === 'number') {
                    if (!Number.isInteger(value)) {
                        throw new Error('Invalid stringInt value received from the db: ' + value)
                    }
                    return value
                }
                if (typeof value === 'string') {
                    if (!/^-?\d+$/g.test(value)) {
                        throw new Error('Invalid stringInt value received from the db: ' + value)
                    }
                    return value
                }
                if (typeof value === 'bigint') {
                    const result = Number(value)
                    if (!Number.isSafeInteger(result)) {
                        return '' + value
                    }
                    return result
                }
                throw new Error('Invalid stringInt value received from the db: ' + value)
            case 'bigint':
                if (typeof value === 'number') {
                    if (!Number.isInteger(value)) {
                        throw new Error('Invalid bigint value received from the db: ' + value)
                    }
                    return BigInt(value)
                }
                if (typeof value === 'string') {
                    try {
                        return BigInt(value)
                    } catch {
                        throw new Error('Invalid bigint value received from the db: ' + value)
                    }
                }
                if (typeof value === 'bigint') {
                    return value
                }
                throw new Error('Invalid int value received from the db: ' + value)
            case 'double':
                if (typeof value === 'number') {
                    return value
                }
                if (typeof value === 'string') {
                    const result = +value
                    if (result + '' !== value) { // Here the comparation is not isNaN(result) because NaN is a valid value as well Infinity and -Infinity
                        throw new Error('Invalid double value received from the db: ' + value)
                    }
                    return result
                }
                if (typeof value === 'bigint') {
                    return Number(value)
                }
                throw new Error('Invalid double value received from the db: ' + value)
            case 'stringDouble':
                if (typeof value === 'number') {
                    return value
                }
                if (typeof value === 'string') {
                    if (!/^(-?\d+(\.\d+)?|NaN|-?Infinity)$/g.test(value)) {
                        throw new Error('Invalid stringDouble value received from the db: ' + value)
                    }
                    return value
                }
                if (typeof value === 'bigint') {
                    const result = Number(value)
                    if (!Number.isSafeInteger(result)) {
                        return '' + value
                    }
                    return result
                }
                throw new Error('Invalid stringDouble value received from the db: ' + value)
            case 'string':
                if (typeof value === 'string') {
                    return value
                }
                throw new Error('Invalid string value received from the db: ' + value)
            case 'localDate': {
                let result: Date
                if (value instanceof Date) {
                    // This time fix works in almost every timezone (from -10 to +13, but not +14, -11, -12, almost uninhabited)
                    result = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
                    result.setUTCMinutes(600)
                } else if (typeof value === 'string') {
                    result = new Date(value + ' 00:00') // If time is omited, UTC timezone will be used instead the local one
                    // This time fix works in almost every timezone (from -10 to +13, but not +14, -11, -12, almost uninhabited)
                    result = new Date(Date.UTC(result.getFullYear(), result.getMonth(), result.getDate()))
                    result.setUTCMinutes(600)
                } else {
                    throw new Error('Invalid localDate value received from the db: ' + value)
                }
                if (isNaN(result.getTime())) {
                    throw new Error('Invalid localDate value received from the db: ' + value)
                }
                (result as any).___type___ = 'localDate'
                return result
            }
            case 'localTime': {
                let result: Date
                if (value instanceof Date) {
                    result = value
                } else if (typeof value === 'string') {
                    result = new Date('1970-01-01 ' + value)
                } else {
                    throw new Error('Invalid localTime value received from the db: ' + value)
                }
                if (isNaN(result.getTime())) {
                    throw new Error('Invalid localTime value received from the db: ' + value)
                }
                (result as any).___type___ = 'localTime'
                return result
            }
            case 'localDateTime': {
                let result: Date
                if (value instanceof Date) {
                    result = value
                } else if (typeof value === 'string') {
                    result = new Date(value)
                } else {
                    throw new Error('Invalid localDateTime value received from the db: ' + value)
                }
                if (isNaN(result.getTime())) {
                    throw new Error('Invalid localDateTime value received from the db: ' + value)
                }
                (result as any).___type___ = 'LocalDateTime'
                return result
            }
            default:
                return value
        }
    }
    protected transformValueToDB(value: unknown, type: string): unknown {
        if (value === undefined) {
            return null
        }
        if (value === null) {
            return null
        }
        if (value === '' && !this.allowEmptyString) {
            return null
        }
        switch (type) {
            case 'boolean':
                if (typeof value === 'boolean') {
                    return value
                }
                throw new Error('Invalid boolean value to send to the db: ' + value)
            case 'int':
                if (typeof value === 'number') {
                    if (!Number.isInteger(value)) {
                        throw new Error('Invalid int value to send to the db: ' + value)
                    }
                    return value
                }
                throw new Error('Invalid int value to send to the db: ' + value)
            case 'bigint':
                if (typeof value === 'bigint') {
                    return value
                }
                throw new Error('Invalid int value to send to the db: ' + value)
            case 'stringInt':
                if (typeof value === 'number') {
                    if (!Number.isInteger(value)) {
                        throw new Error('Invalid stringInt value to send to the db: ' + value)
                    }
                    return value
                }
                if (typeof value === 'string') {
                    if (!/^-?\d+$/g.test(value)) {
                        throw new Error('Invalid stringInt value to send to the db: ' + value)
                    }
                    return value
                }
                throw new Error('Invalid stringInt value to send to the db: ' + value)
            case 'double':
                if (typeof value === 'number') {
                    return value
                }
                throw new Error('Invalid double value to send to the db: ' + value)
            case 'stringDouble':
                if (typeof value === 'number') {
                    return value
                }
                if (typeof value === 'string') {
                    if (!/^(-?\d+(\.\d+)?|NaN|-?Infinity)$/g.test(value)) {
                        throw new Error('Invalid stringDouble value to send to the db: ' + value)
                    }
                    return value
                }
                throw new Error('Invalid stringDouble value to send to the db: ' + value)
            case 'string':
                if (typeof value === 'string') {
                    return value
                }
                throw new Error('Invalid string value to send to the db: ' + value)
            case 'localDate':
                if (value instanceof Date && !isNaN(value.getTime())) {
                    return value
                }
                throw new Error('Invalid localDate value to send to the db: ' + value)
            case 'localTime':
                if (value instanceof Date && !isNaN(value.getTime())) {
                    let result = ''
                    if (value.getHours() > 9) {
                        result += value.getHours()
                    } else {
                        result += '0' + value.getHours()
                    }
                    result += ':'
                    if (value.getMinutes() > 9) {
                        result += value.getMinutes()
                    } else {
                        result += '0' + value.getMinutes()
                    }
                    result += ':'
                    if (value.getSeconds() > 9) {
                        result += value.getSeconds()
                    } else {
                        result += '0' + value.getSeconds()
                    }
                    if (value.getMilliseconds() > 0) {
                        result += '.'
                        if (value.getMilliseconds() > 99) {
                            result += value.getMilliseconds()
                        } else if (value.getMilliseconds() > 9) {
                            result += '0' + value.getMilliseconds()
                        } else {
                            result += '00' + value.getMilliseconds()
                        }
                    }
                    return result
                }
                throw new Error('Invalid localTime value to send to the db: ' + value)
            case 'localDateTime':
                if (value instanceof Date && !isNaN(value.getTime())) {
                    return value
                }
                throw new Error('Invalid localDateTime value to send to the db: ' + value)
            default:
                return value
        }
    }

    protected isReservedKeyword(word: string): boolean {
        return this.__sqlBuilder._isReservedKeyword(word)

    }
    protected forceAsIdentifier(identifier: string): string {
        return this.__sqlBuilder._forceAsIdentifier(identifier)
    }
    protected escape(identifier: string, strict: boolean): string {
        if (strict && !/^[a-zA-Z_][a-zA-Z0-9_]+$/.test(identifier)) {
            return this.forceAsIdentifier(identifier)
        }
        if (this.isReservedKeyword(identifier) || identifier.indexOf(' ') >= 0) {
            return this.forceAsIdentifier(identifier)
        }
        return identifier
    }

}
