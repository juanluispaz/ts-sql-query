import { InsertQueryBuilder } from "../queryBuilders/InsertQueryBuilder"
import { UpdateQueryBuilder } from "../queryBuilders/UpdateQueryBuilder"
import { DeleteQueryBuilder } from "../queryBuilders/DeleteQueryBuilder"
import { SqlBuilder } from "../sqlBuilders/SqlBuilder"
import { InsertExpression } from "../expressions/insert"
import { UpdateExpression, UpdateExpressionAllowingNoWhere } from "../expressions/update"
import { DeleteExpression, DeleteExpressionAllowingNoWhere } from "../expressions/delete"
import { BooleanValueSource, NumberValueSource, StringValueSource, DateValueSource, TimeValueSource, DateTimeValueSource, EqualableValueSource, IntValueSource, DoubleValueSource, LocalDateValueSource, LocalTimeValueSource, LocalDateTimeValueSource, TypeSafeStringValueSource, StringNumberValueSource, StringIntValueSource, StringDoubleValueSource, ValueSource, RemapValueSourceTypeAsOptional, ComparableValueSource, __getValueSourcePrivate } from "../expressions/values"
import { SqlOperationStatic0ValueSource, SqlOperationStatic1ValueSource, AggregateFunctions0ValueSource, AggregateFunctions1ValueSource, AggregateFunctions1or2ValueSource } from "../internal/ValueSourceImpl"
import { NoTableOrViewRequired } from "../utils/NoTableOrViewRequired"
import { Default, DefaultImpl } from "../expressions/Default"
import { ITableOrView, ITable } from "../utils/ITableOrView"
import { AnyDB } from "../databases/AnyDB"
import { SelectQueryBuilder } from "../queryBuilders/SelectQueryBuilder"
import { SelectExpression, SelectExpressionFromNoTable, SelectExpressionSubquery, ExecutableSelect } from "../expressions/select"
import { TypeSafeDB } from "../databases/TypeSafeDB"
import { TypeUnsafeDB } from "../databases/TypeUnsafeDB"
import { TypeAdapter, DefaultTypeAdapter } from "../TypeAdapter"
import { int, double, LocalDate, LocalTime, LocalDateTime, stringInt, stringDouble } from "ts-extended-types"
import { QueryRunner } from "../queryRunners/QueryRunner"
import ChainedError from "chained-error"
import { IConnection } from "../utils/IConnection"
import { BooleanFragmentExpression, StringIntFragmentExpression, StringNumberFragmentExpression, IntFragmentExpression, NumberFragmentExpression, StringDoubleFragmentExpression, DoubleFragmentExpression, TypeSafeStringFragmentExpression, StringFragmentExpression, LocalDateFragmentExpression, DateFragmentExpression, LocalTimeFragmentExpression, TimeFragmentExpression, LocalDateTimeFragmentExpression, DateTimeFragmentExpression, EqualableFragmentExpression } from "../expressions/fragment"
import { FragmentQueryBuilder } from "../queryBuilders/FragmentQueryBuilder"

export abstract class AbstractConnection<DB extends AnyDB, NAME, SQL_BUILDER extends SqlBuilder> extends IConnection<DB, NAME> {
    protected __sqlBuilder: SQL_BUILDER
    readonly queryRunner: QueryRunner
    readonly defaultTypeAdapter: DefaultTypeAdapter

    constructor(queryRunner: QueryRunner, sqlBuilder: SQL_BUILDER) {
        super()
        this.defaultTypeAdapter = this as any // transform protected methods to public
        sqlBuilder._defaultTypeAdapter = this.defaultTypeAdapter
        this.__sqlBuilder = sqlBuilder
        this.queryRunner = queryRunner
        sqlBuilder._queryRunner = queryRunner
    }

    beginTransaction(): Promise<void> {
        return this.queryRunner.executeBeginTransaction()
    }
    commit(): Promise<void> {
        return this.queryRunner.executeCommit()
    }
    rollback(): Promise<void> {
        return this.queryRunner.executeRollback()
    }

    insertInto<DBT extends DB, TABLE extends ITable<DBT>>(table: TABLE): InsertExpression<DBT, TABLE> {
        return new InsertQueryBuilder(this.__sqlBuilder, table)
    }
    update<DBT extends DB, TABLE extends ITable<DBT>>(table: TABLE): UpdateExpression<DBT, TABLE> {
        return new UpdateQueryBuilder(this.__sqlBuilder, table, false)
    }
    updateAllowingNoWhere<DBT extends DB, TABLE extends ITable<DBT>>(table: TABLE): UpdateExpressionAllowingNoWhere<DBT, TABLE> {
        return new UpdateQueryBuilder(this.__sqlBuilder, table, true)
    }
    deleteFrom<DBT extends DB, TABLE extends ITable<DBT>>(table: TABLE): DeleteExpression<DBT, TABLE> {
        return new DeleteQueryBuilder(this.__sqlBuilder, table, false)
    }
    deleteAllowingNoWhereFrom<DBT extends DB, TABLE extends ITable<DBT>>(table: TABLE): DeleteExpressionAllowingNoWhere<DBT, TABLE> {
        return new DeleteQueryBuilder(this.__sqlBuilder, table, true)
    }
    selectFrom<DBT extends DB, TABLE_OR_VIEW extends ITableOrView<DBT>>(table: TABLE_OR_VIEW): SelectExpression<DBT, TABLE_OR_VIEW, NoTableOrViewRequired> {
        return new SelectQueryBuilder(this.__sqlBuilder, [table], false) as any // cast to any to improve typescript performace
    }
    selectDistinctFrom<DBT extends DB, TABLE_OR_VIEW extends ITableOrView<DBT>>(table: TABLE_OR_VIEW): SelectExpression<DBT, TABLE_OR_VIEW, NoTableOrViewRequired> {
        return new SelectQueryBuilder(this.__sqlBuilder, [table], true) as any // cast to any to improve typescript performace
    }
    selectFromNoTable(): SelectExpressionFromNoTable {
        return new SelectQueryBuilder(this.__sqlBuilder, [], false) as any // cast to any to improve typescript performace
    }
    subSelectUsing<TABLE_OR_VIEW extends ITableOrView<DB>>(table: TABLE_OR_VIEW): SelectExpressionSubquery<DB, TABLE_OR_VIEW>
    subSelectUsing<TABLE_OR_VIEW1 extends ITableOrView<DB>, TABLE_OR_VIEW2 extends ITableOrView<DB>>(table1: TABLE_OR_VIEW1, table2: TABLE_OR_VIEW2): SelectExpressionSubquery<DB, TABLE_OR_VIEW1 | TABLE_OR_VIEW2>
    subSelectUsing<TABLE_OR_VIEW1 extends ITableOrView<DB>, TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(table1: TABLE_OR_VIEW1, table2: TABLE_OR_VIEW2, table3: TABLE_OR_VIEW3): SelectExpressionSubquery<DB, TABLE_OR_VIEW1 | TABLE_OR_VIEW2 | TABLE_OR_VIEW3>
    subSelectUsing<TABLE_OR_VIEW1 extends ITableOrView<DB>, TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(_table1: TABLE_OR_VIEW1, _table2?: TABLE_OR_VIEW2, _table3?: TABLE_OR_VIEW3): SelectExpressionSubquery<DB, TABLE_OR_VIEW1 | TABLE_OR_VIEW2 | TABLE_OR_VIEW3> {
        return new SelectQueryBuilder(this.__sqlBuilder, [], false) as any // cast to any to improve typescript performace
    }
    subSelectDistinctUsing<TABLE_OR_VIEW extends ITableOrView<DB>>(table: TABLE_OR_VIEW): SelectExpressionSubquery<DB, TABLE_OR_VIEW>
    subSelectDistinctUsing<TABLE_OR_VIEW1 extends ITableOrView<DB>, TABLE_OR_VIEW2 extends ITableOrView<DB>>(table1: TABLE_OR_VIEW1, table2: TABLE_OR_VIEW2): SelectExpressionSubquery<DB, TABLE_OR_VIEW1 | TABLE_OR_VIEW2>
    subSelectDistinctUsing<TABLE_OR_VIEW1 extends ITableOrView<DB>, TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(table1: TABLE_OR_VIEW1, table2: TABLE_OR_VIEW2, table3: TABLE_OR_VIEW3): SelectExpressionSubquery<DB, TABLE_OR_VIEW1 | TABLE_OR_VIEW2 | TABLE_OR_VIEW3>
    subSelectDistinctUsing<TABLE_OR_VIEW1 extends ITableOrView<DB>, TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(_table1: TABLE_OR_VIEW1, _table2?: TABLE_OR_VIEW2, _table3?: TABLE_OR_VIEW3): SelectExpressionSubquery<DB, TABLE_OR_VIEW1 | TABLE_OR_VIEW2 | TABLE_OR_VIEW3> {
        return new SelectQueryBuilder(this.__sqlBuilder, [], true) as any // cast to any to improve typescript performace
    }

    default(): Default {
        return new DefaultImpl()
    }
    pi(this: IConnection<TypeSafeDB, NAME>): DoubleValueSource<DB, NoTableOrViewRequired, double>
    pi(): NumberValueSource<DB, NoTableOrViewRequired, number>
    pi(): NumberValueSource<DB, NoTableOrViewRequired, number> & DoubleValueSource<DB, NoTableOrViewRequired, double> {
        return new SqlOperationStatic0ValueSource('_pi', 'double', undefined)
    }
    random(this: IConnection<TypeSafeDB, NAME>): DoubleValueSource<DB, NoTableOrViewRequired, double>
    random(): NumberValueSource<DB, NoTableOrViewRequired, number>
    random(): NumberValueSource<DB, NoTableOrViewRequired, number> & DoubleValueSource<DB, NoTableOrViewRequired, double> {
        return new SqlOperationStatic0ValueSource('_random', 'double', undefined)
    }
    currentDate(this: IConnection<TypeSafeDB, NAME>): LocalDateValueSource<DB, NoTableOrViewRequired, LocalDate>
    currentDate(): DateValueSource<DB, NoTableOrViewRequired, Date>
    currentDate(): DateValueSource<DB, NoTableOrViewRequired, Date> & LocalDateValueSource<DB, NoTableOrViewRequired, LocalDate> {
        return new SqlOperationStatic0ValueSource('_currentDate', 'localDate', undefined)
    }
    currentTime(this: IConnection<TypeSafeDB, NAME>): LocalTimeValueSource<DB, NoTableOrViewRequired, LocalTime>
    currentTime(): TimeValueSource<DB, NoTableOrViewRequired, Date>
    currentTime(): TimeValueSource<DB, NoTableOrViewRequired, Date> & LocalTimeValueSource<DB, NoTableOrViewRequired, LocalTime> {
        return new SqlOperationStatic0ValueSource('_currentTime', 'localTime', undefined)
    }
    currentDateTime(this: IConnection<TypeSafeDB, NAME>): LocalDateTimeValueSource<DB, NoTableOrViewRequired, LocalDateTime>
    currentDateTime(): DateTimeValueSource<DB, NoTableOrViewRequired, Date>
    currentDateTime(): DateTimeValueSource<DB, NoTableOrViewRequired, Date> & LocalDateTimeValueSource<DB, NoTableOrViewRequired, LocalDateTime> {
        return new SqlOperationStatic0ValueSource('_currentTimestamp', 'localDateTime', undefined)
    }
    currentTimestamp(this: IConnection<TypeSafeDB, NAME>): LocalDateTimeValueSource<DB, NoTableOrViewRequired, LocalDateTime>
    currentTimestamp(): DateTimeValueSource<DB, NoTableOrViewRequired, Date>
    currentTimestamp(): DateTimeValueSource<DB, NoTableOrViewRequired, Date> & LocalDateTimeValueSource<DB, NoTableOrViewRequired, LocalDateTime> {
        return new SqlOperationStatic0ValueSource('_currentTimestamp', 'localDateTime', undefined)
    }

    const(value: boolean, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource<DB, NoTableOrViewRequired, boolean>
    const(value: boolean | null | undefined, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource<DB, NoTableOrViewRequired, boolean | null | undefined>
    const(this: IConnection<TypeSafeDB, NAME>, value: stringInt, type: 'stringInt', adapter?: TypeAdapter): StringIntValueSource<DB, NoTableOrViewRequired, stringInt>
    const(this: IConnection<TypeSafeDB, NAME>, value: stringInt | null | undefined, type: 'stringInt', adapter?: TypeAdapter): StringIntValueSource<DB, NoTableOrViewRequired, stringInt | null | undefined>
    const(this: IConnection<TypeUnsafeDB, NAME>, value: number | string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource<DB, NoTableOrViewRequired, number | string>
    const(this: IConnection<TypeUnsafeDB, NAME>, value: number | string | null | undefined, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource<DB, NoTableOrViewRequired, number | string | null | undefined>
    const(this: IConnection<TypeSafeDB, NAME>, value: int, type: 'int', adapter?: TypeAdapter): IntValueSource<DB, NoTableOrViewRequired, int>
    const(this: IConnection<TypeSafeDB, NAME>, value: int | null | undefined, type: 'int', adapter?: TypeAdapter): IntValueSource<DB, NoTableOrViewRequired, int | null | undefined>
    const(this: IConnection<TypeUnsafeDB, NAME>, value: number, type: 'int', adapter?: TypeAdapter): NumberValueSource<DB, NoTableOrViewRequired, number>
    const(this: IConnection<TypeUnsafeDB, NAME>, value: number | null | undefined, type: 'int', adapter?: TypeAdapter): NumberValueSource<DB, NoTableOrViewRequired, number | null | undefined>
    const(this: IConnection<TypeSafeDB, NAME>, value: stringDouble, type: 'stringDouble', adapter?: TypeAdapter): StringDoubleValueSource<DB, NoTableOrViewRequired, stringDouble>
    const(this: IConnection<TypeSafeDB, NAME>, value: stringDouble | null | undefined, type: 'stringDouble', adapter?: TypeAdapter): StringDoubleValueSource<DB, NoTableOrViewRequired, stringDouble | null | undefined>
    const(this: IConnection<TypeUnsafeDB, NAME>, value: number | string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource<DB, NoTableOrViewRequired, number | string>
    const(this: IConnection<TypeUnsafeDB, NAME>, value: number | string | null | undefined, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource<DB, NoTableOrViewRequired, number | string | null | undefined>
    const(this: IConnection<TypeSafeDB, NAME>, value: double, type: 'double', adapter?: TypeAdapter): DoubleValueSource<DB, NoTableOrViewRequired, double>
    const(this: IConnection<TypeSafeDB, NAME>, value: double | null | undefined, type: 'double', adapter?: TypeAdapter): DoubleValueSource<DB, NoTableOrViewRequired, double | null | undefined>
    const(this: IConnection<TypeUnsafeDB, NAME>, value: number, type: 'double', adapter?: TypeAdapter): NumberValueSource<DB, NoTableOrViewRequired, number>
    const(this: IConnection<TypeUnsafeDB, NAME>, value: number | null | undefined, type: 'double', adapter?: TypeAdapter): NumberValueSource<DB, NoTableOrViewRequired, number | null | undefined>
    const(this: IConnection<TypeSafeDB, NAME>, value: string, type: 'string', adapter?: TypeAdapter): TypeSafeStringValueSource<DB, NoTableOrViewRequired, string>
    const(this: IConnection<TypeSafeDB, NAME>, value: string | null | undefined, type: 'string', adapter?: TypeAdapter): TypeSafeStringValueSource<DB, NoTableOrViewRequired, string | null | undefined>
    const(this: IConnection<TypeUnsafeDB, NAME>, value: string, type: 'string', adapter?: TypeAdapter): StringValueSource<DB, NoTableOrViewRequired, string>
    const(this: IConnection<TypeUnsafeDB, NAME>, value: string | null | undefined, type: 'string', adapter?: TypeAdapter): StringValueSource<DB, NoTableOrViewRequired, string | null | undefined>
    const(this: IConnection<TypeSafeDB, NAME>, value: LocalDate, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource<DB, NoTableOrViewRequired, LocalDate>
    const(this: IConnection<TypeSafeDB, NAME>, value: LocalDate | null | undefined, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource<DB, NoTableOrViewRequired, LocalDate | null | undefined>
    const(this: IConnection<TypeUnsafeDB, NAME>, value: Date, type: 'localDate', adapter?: TypeAdapter): DateValueSource<DB, NoTableOrViewRequired, Date>
    const(this: IConnection<TypeUnsafeDB, NAME>, value: Date | null | undefined, type: 'localDate', adapter?: TypeAdapter): DateValueSource<DB, NoTableOrViewRequired, Date | null | undefined>
    const(this: IConnection<TypeSafeDB, NAME>, value: LocalTime, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource<DB, NoTableOrViewRequired, LocalTime>
    const(this: IConnection<TypeSafeDB, NAME>, value: LocalTime | null | undefined, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource<DB, NoTableOrViewRequired, LocalTime | null | undefined>
    const(this: IConnection<TypeUnsafeDB, NAME>, value: Date, type: 'localTime', adapter?: TypeAdapter): TimeValueSource<DB, NoTableOrViewRequired, Date>
    const(this: IConnection<TypeUnsafeDB, NAME>, value: Date | null | undefined, type: 'localTime', adapter?: TypeAdapter): TimeValueSource<DB, NoTableOrViewRequired, Date | null | undefined>
    const(this: IConnection<TypeSafeDB, NAME>, value: LocalDateTime, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource<DB, NoTableOrViewRequired, LocalDateTime>
    const(this: IConnection<TypeSafeDB, NAME>, value: LocalDateTime | null | undefined, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource<DB, NoTableOrViewRequired, LocalDateTime | null | undefined>
    const(this: IConnection<TypeUnsafeDB, NAME>, value: Date, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource<DB, NoTableOrViewRequired, Date>
    const(this: IConnection<TypeUnsafeDB, NAME>, value: Date | null | undefined, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource<DB, NoTableOrViewRequired, Date | null | undefined>
    const<T>(value: T, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<DB, NoTableOrViewRequired, T>
    const<T>(value: T, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<DB, NoTableOrViewRequired, T>
    const<_T>(value: any, type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any /* EqualableValueSource<DB, NoTableRequired, T> */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        if (typeof adapter === 'string') {
            return new SqlOperationStatic1ValueSource('_const', value, adapter, adapter2)
        }
        if (type === 'boolean') {
            if (value === true) {
                return new SqlOperationStatic0ValueSource('_true', type, adapter)
            } else if (value === false) {
                return new SqlOperationStatic0ValueSource('_false', type, adapter)
            }
        }
        return new SqlOperationStatic1ValueSource('_const', value, type, adapter)
    }

    true<TABLE_OR_VIEW extends ITableOrView<DB> = NoTableOrViewRequired>(): BooleanValueSource<DB, TABLE_OR_VIEW, boolean> {
        return new SqlOperationStatic0ValueSource('_true', 'boolean', undefined)
    }
    false<TABLE_OR_VIEW extends ITableOrView<DB> = NoTableOrViewRequired>(): BooleanValueSource<DB, TABLE_OR_VIEW, boolean> {
        return new SqlOperationStatic0ValueSource('_false', 'boolean', undefined)
    }
    exists<TABLE_OR_VIEW extends ITableOrView<DB>>(select: ExecutableSelect<DB, any, TABLE_OR_VIEW>): BooleanValueSource<DB, TABLE_OR_VIEW, boolean> {
        return new SqlOperationStatic1ValueSource('_exists', select, 'boolean', undefined)
    }
    notExists<TABLE_OR_VIEW extends ITableOrView<DB>>(select: ExecutableSelect<DB, any, TABLE_OR_VIEW>): BooleanValueSource<DB, TABLE_OR_VIEW, boolean> {
        return new SqlOperationStatic1ValueSource('_notExists', select, 'boolean', undefined)
    }

    protected executeProcedure(procedureName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[]): Promise<void> {
        try {
            const queryParams: any[] = []
            const query = this.__sqlBuilder._buildCallProcedure(queryParams, procedureName, params)
            return this.__sqlBuilder._queryRunner.executeProcedure(query, queryParams).catch((e) => {
                throw new ChainedError(e)
            })
        } catch (e) {
            throw new ChainedError(e)
        }
    }

    protected executeFunction(functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'boolean', required: 'required', adapter?: TypeAdapter): Promise<boolean>
    protected executeFunction(functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'boolean', required: 'optional', adapter?: TypeAdapter): Promise<boolean | null>
    protected executeFunction(this: IConnection<TypeSafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'stringInt', required: 'required', adapter?: TypeAdapter): Promise<stringInt>
    protected executeFunction(this: IConnection<TypeSafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'stringInt', required: 'optional', adapter?: TypeAdapter): Promise<stringInt | null>
    protected executeFunction(this: IConnection<TypeUnsafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'stringInt', required: 'required', adapter?: TypeAdapter): Promise<number>
    protected executeFunction(this: IConnection<TypeUnsafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'stringInt', required: 'optional', adapter?: TypeAdapter): Promise<number | null>
    protected executeFunction(this: IConnection<TypeSafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'int', required: 'required', adapter?: TypeAdapter): Promise<int>
    protected executeFunction(this: IConnection<TypeSafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'int', required: 'optional', adapter?: TypeAdapter): Promise<int | null>
    protected executeFunction(this: IConnection<TypeUnsafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'int', required: 'required', adapter?: TypeAdapter): Promise<number>
    protected executeFunction(this: IConnection<TypeUnsafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'int', required: 'optional', adapter?: TypeAdapter): Promise<number | null>
    protected executeFunction(this: IConnection<TypeSafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'stringDouble', required: 'required', adapter?: TypeAdapter): Promise<stringDouble>
    protected executeFunction(this: IConnection<TypeSafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'stringDouble', required: 'optional', adapter?: TypeAdapter): Promise<stringDouble | null>
    protected executeFunction(this: IConnection<TypeUnsafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'stringDouble', required: 'required', adapter?: TypeAdapter): Promise<number>
    protected executeFunction(this: IConnection<TypeUnsafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'stringDouble', required: 'optional', adapter?: TypeAdapter): Promise<number | null>
    protected executeFunction(this: IConnection<TypeSafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'double', required: 'required', adapter?: TypeAdapter): Promise<double>
    protected executeFunction(this: IConnection<TypeSafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'double', required: 'optional', adapter?: TypeAdapter): Promise<double | null>
    protected executeFunction(this: IConnection<TypeUnsafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'double', required: 'required', adapter?: TypeAdapter): Promise<number>
    protected executeFunction(this: IConnection<TypeUnsafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'double', required: 'optional', adapter?: TypeAdapter): Promise<number | null>
    protected executeFunction(functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'string', required: 'required', adapter?: TypeAdapter): Promise<string>
    protected executeFunction(functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'string', required: 'optional', adapter?: TypeAdapter): Promise<string | null>
    protected executeFunction(this: IConnection<TypeSafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'localDate', required: 'required', adapter?: TypeAdapter): Promise<LocalDate>
    protected executeFunction(this: IConnection<TypeSafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'localDate', required: 'optional', adapter?: TypeAdapter): Promise<LocalDate | null>
    protected executeFunction(this: IConnection<TypeUnsafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'localDate', required: 'required', adapter?: TypeAdapter): Promise<Date>
    protected executeFunction(this: IConnection<TypeUnsafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'localDate', required: 'optional', adapter?: TypeAdapter): Promise<Date | null>
    protected executeFunction(this: IConnection<TypeSafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'localTime', required: 'required', adapter?: TypeAdapter): Promise<LocalTime>
    protected executeFunction(this: IConnection<TypeSafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'localTime', required: 'optional', adapter?: TypeAdapter): Promise<LocalTime | null>
    protected executeFunction(this: IConnection<TypeUnsafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'localTime', required: 'required', adapter?: TypeAdapter): Promise<Date>
    protected executeFunction(this: IConnection<TypeUnsafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'localTime', required: 'optional', adapter?: TypeAdapter): Promise<Date | null>
    protected executeFunction(this: IConnection<TypeSafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'localDateTime', required: 'required', adapter?: TypeAdapter): Promise<LocalDateTime>
    protected executeFunction(this: IConnection<TypeSafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'localDateTime', required: 'optional', adapter?: TypeAdapter): Promise<LocalDateTime | null>
    protected executeFunction(this: IConnection<TypeUnsafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'localDateTime', required: 'required', adapter?: TypeAdapter): Promise<Date>
    protected executeFunction(this: IConnection<TypeUnsafeDB, NAME>, functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'localDateTime', required: 'optional', adapter?: TypeAdapter): Promise<Date | null>
    protected executeFunction<T>(functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'enum', typeName: string, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T>(functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'enum', typeName: string, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<T>(functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'custom', typeName: string, required: 'required', adapter?: TypeAdapter): Promise<T>
    protected executeFunction<T>(functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: 'custom', typeName: string, required: 'optional', adapter?: TypeAdapter): Promise<T | null>
    protected executeFunction<_T>(functionName: string, params: ValueSource<DB, NoTableOrViewRequired, any>[], returnType: string, required: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): Promise<any> {
        try {
            if (typeof adapter === 'string') {
                returnType = required
            } else {
                adapter2 = adapter
            }
            const queryParams: any[] = []
            const query = this.__sqlBuilder._buildCallFunction(queryParams, functionName, params)
            return this.__sqlBuilder._queryRunner.executeFunction(query, queryParams).then((value) => {
                if (adapter2) {
                    return adapter2.transformValueFromDB(value, returnType, this.__sqlBuilder._defaultTypeAdapter)
                } else {
                    return this.__sqlBuilder._defaultTypeAdapter.transformValueFromDB(value, returnType)
                }
            }).catch((e) => {
                throw new ChainedError(e)
            })
        } catch (e) {
            throw new ChainedError(e)
        }
    }

    /*
    // It doesn't work on TS 3.5.3 because 'Type instantiation is excessively deep and possibly infinite.'
    fragment(sql: TemplateStringsArray):  FragmentExpression<DB, NoTableRequired>
    fragment<T1 extends ITable<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>): FragmentExpression<DB, T1>
    fragment<T1 extends ITable<DB>, T2 extends ITable<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>): FragmentExpression<DB, T1 | T2>
    fragment<T1 extends ITable<DB>, T2 extends ITable<DB>, T3 extends ITable<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>): FragmentExpression<DB, T1 | T2 | T3>
    fragment<T1 extends ITable<DB>, T2 extends ITable<DB>, T3 extends ITable<DB>, T4 extends ITable<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>): FragmentExpression<DB, T1 | T2 | T3 | T4>
    fragment<T1 extends ITable<DB>, T2 extends ITable<DB>, T3 extends ITable<DB>, T4 extends ITable<DB>, T5 extends ITable<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>): FragmentExpression<DB, T1 | T2 | T3 | T4 | T5>
    fragment<T1 extends ITable<DB>, T2 extends ITable<DB>, T3 extends ITable<DB>, T4 extends ITable<DB>, T5 extends ITable<DB>, T6 extends ITable<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>): FragmentExpression<DB, T1 | T2 | T3 | T4 | T5 | T6>
    fragment<T1 extends ITable<DB>, T2 extends ITable<DB>, T3 extends ITable<DB>, T4 extends ITable<DB>, T5 extends ITable<DB>, T6 extends ITable<DB>, T7 extends ITable<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>, p7: ValueSource<DB, T7, any>): FragmentExpression<DB, T1 | T2 | T3 | T4 | T5 | T6 | T7>
    fragment<T extends ITable<DB>>(sql: TemplateStringsArray, ...p: ValueSource<DB, T, any>[]): FragmentExpression<DB, T>
    fragment(sql: TemplateStringsArray, ...p: ValueSource<DB, any, any>[]): FragmentExpression<DB, any> {
        return new FragmentQueryBuilder(sql, p) as any
    }
    */

    fragmentWithType(type: 'boolean', required: 'required', adapter?: TypeAdapter): BooleanFragmentExpression<DB, boolean>
    fragmentWithType(type: 'boolean', required: 'optional', adapter?: TypeAdapter): BooleanFragmentExpression<DB, boolean | null | undefined>
    fragmentWithType(this: IConnection<TypeSafeDB, NAME>, type: 'stringInt', required: 'required', adapter?: TypeAdapter): StringIntFragmentExpression<DB, stringInt>
    fragmentWithType(this: IConnection<TypeSafeDB, NAME>, type: 'stringInt', required: 'optional', adapter?: TypeAdapter): StringIntFragmentExpression<DB, stringInt | null | undefined>
    fragmentWithType(this: IConnection<TypeUnsafeDB, NAME>, type: 'stringInt', required: 'required', adapter?: TypeAdapter): StringNumberFragmentExpression<DB, number>
    fragmentWithType(this: IConnection<TypeUnsafeDB, NAME>, type: 'stringInt', required: 'optional', adapter?: TypeAdapter): StringNumberFragmentExpression<DB, number | null | undefined>
    fragmentWithType(this: IConnection<TypeSafeDB, NAME>, type: 'int', required: 'required', adapter?: TypeAdapter): IntFragmentExpression<DB, int>
    fragmentWithType(this: IConnection<TypeSafeDB, NAME>, type: 'int', required: 'optional', adapter?: TypeAdapter): IntFragmentExpression<DB, int | null | undefined>
    fragmentWithType(this: IConnection<TypeUnsafeDB, NAME>, type: 'int', required: 'required', adapter?: TypeAdapter): NumberFragmentExpression<DB, number>
    fragmentWithType(this: IConnection<TypeUnsafeDB, NAME>, type: 'int', required: 'optional', adapter?: TypeAdapter): NumberFragmentExpression<DB, number | null | undefined>
    fragmentWithType(this: IConnection<TypeSafeDB, NAME>, type: 'stringDouble', required: 'required', adapter?: TypeAdapter): StringDoubleFragmentExpression<DB, stringDouble>
    fragmentWithType(this: IConnection<TypeSafeDB, NAME>, type: 'stringDouble', required: 'optional', adapter?: TypeAdapter): StringDoubleFragmentExpression<DB, stringDouble | null | undefined>
    fragmentWithType(this: IConnection<TypeUnsafeDB, NAME>, type: 'stringDouble', required: 'required', adapter?: TypeAdapter): StringNumberFragmentExpression<DB, number>
    fragmentWithType(this: IConnection<TypeUnsafeDB, NAME>, type: 'stringDouble', required: 'optional', adapter?: TypeAdapter): StringNumberFragmentExpression<DB, number | null | undefined>
    fragmentWithType(this: IConnection<TypeSafeDB, NAME>, type: 'double', required: 'required', adapter?: TypeAdapter): DoubleFragmentExpression<DB, double>
    fragmentWithType(this: IConnection<TypeSafeDB, NAME>, type: 'double', required: 'optional', adapter?: TypeAdapter): DoubleFragmentExpression<DB, double | null | undefined>
    fragmentWithType(this: IConnection<TypeUnsafeDB, NAME>, type: 'double', required: 'required', adapter?: TypeAdapter): NumberFragmentExpression<DB, number>
    fragmentWithType(this: IConnection<TypeUnsafeDB, NAME>, type: 'double', required: 'optional', adapter?: TypeAdapter): NumberFragmentExpression<DB, number | null | undefined>
    fragmentWithType(this: IConnection<TypeSafeDB, NAME>, type: 'string', required: 'required', adapter?: TypeAdapter): TypeSafeStringFragmentExpression<DB, string>
    fragmentWithType(this: IConnection<TypeSafeDB, NAME>, type: 'string', required: 'optional', adapter?: TypeAdapter): TypeSafeStringFragmentExpression<DB, string | null | undefined>
    fragmentWithType(this: IConnection<TypeUnsafeDB, NAME>, type: 'string', required: 'required', adapter?: TypeAdapter): StringFragmentExpression<DB, string>
    fragmentWithType(this: IConnection<TypeUnsafeDB, NAME>, type: 'string', required: 'optional', adapter?: TypeAdapter): StringFragmentExpression<DB, string | null | undefined>
    fragmentWithType(this: IConnection<TypeSafeDB, NAME>, type: 'localDate', required: 'required', adapter?: TypeAdapter): LocalDateFragmentExpression<DB, LocalDate>
    fragmentWithType(this: IConnection<TypeSafeDB, NAME>, type: 'localDate', required: 'optional', adapter?: TypeAdapter): LocalDateFragmentExpression<DB, LocalDate | null | undefined>
    fragmentWithType(this: IConnection<TypeUnsafeDB, NAME>, type: 'localDate', required: 'required', adapter?: TypeAdapter):  DateFragmentExpression<DB, Date>
    fragmentWithType(this: IConnection<TypeUnsafeDB, NAME>, type: 'localDate', required: 'optional', adapter?: TypeAdapter):  DateFragmentExpression<DB, Date | null | undefined>
    fragmentWithType(this: IConnection<TypeSafeDB, NAME>, type: 'localTime', required: 'required', adapter?: TypeAdapter): LocalTimeFragmentExpression<DB, LocalTime>
    fragmentWithType(this: IConnection<TypeSafeDB, NAME>, type: 'localTime', required: 'optional', adapter?: TypeAdapter): LocalTimeFragmentExpression<DB, LocalTime | null | undefined>
    fragmentWithType(this: IConnection<TypeUnsafeDB, NAME>, type: 'localTime', required: 'required', adapter?: TypeAdapter): TimeFragmentExpression<DB, Date>
    fragmentWithType(this: IConnection<TypeUnsafeDB, NAME>, type: 'localTime', required: 'optional', adapter?: TypeAdapter): TimeFragmentExpression<DB, Date | null | undefined>
    fragmentWithType(this: IConnection<TypeSafeDB, NAME>, type: 'localDateTime', required: 'required', adapter?: TypeAdapter): LocalDateTimeFragmentExpression<DB, LocalDateTime>
    fragmentWithType(this: IConnection<TypeSafeDB, NAME>, type: 'localDateTime', required: 'optional', adapter?: TypeAdapter): LocalDateTimeFragmentExpression<DB, LocalDateTime | null | undefined>
    fragmentWithType(this: IConnection<TypeUnsafeDB, NAME>, type: 'localDateTime', required: 'required', adapter?: TypeAdapter): DateTimeFragmentExpression<DB, Date>
    fragmentWithType(this: IConnection<TypeUnsafeDB, NAME>, type: 'localDateTime', required: 'optional', adapter?: TypeAdapter): DateTimeFragmentExpression<DB, Date | null | undefined>
    fragmentWithType<T>(type: 'enum', typeName: string, required: 'required', adapter?: TypeAdapter): EqualableFragmentExpression<DB, T>
    fragmentWithType<T>(type: 'enum', typeName: string, required: 'optional', adapter?: TypeAdapter): EqualableFragmentExpression<DB, T | null | undefined>
    fragmentWithType<T>(type: 'custom', typeName: string, required: 'required', adapter?: TypeAdapter): EqualableFragmentExpression<DB, T>
    fragmentWithType<T>(type: 'custom', typeName: string, required: 'optional', adapter?: TypeAdapter): EqualableFragmentExpression<DB, T | null | undefined>
    fragmentWithType<_T>(type: string, required: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any {
        if (typeof adapter === 'string') {
            type = required
        } else {
            adapter2 = adapter
        }
        return new FragmentQueryBuilder(type, adapter2)
    }

    // Agregate functions
    countAll(this: IConnection<TypeSafeDB, NAME>): IntValueSource<DB, NoTableOrViewRequired, int>
    countAll(): NumberValueSource<DB, NoTableOrViewRequired, number>
    countAll(): AggregateFunctions0ValueSource {
        return new AggregateFunctions0ValueSource('_countAll', 'int', undefined)
    }
    count<TABLE_OR_VIEW extends ITableOrView<DB>>(this: IConnection<TypeSafeDB, NAME>, value: ValueSource<DB, TABLE_OR_VIEW, any>): IntValueSource<DB, TABLE_OR_VIEW, int>
    count<TABLE_OR_VIEW extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW, any>): NumberValueSource<DB, TABLE_OR_VIEW, number>
    count<TABLE_OR_VIEW extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW, any>): ValueSource<DB, TABLE_OR_VIEW, any> {
        return new AggregateFunctions1ValueSource('_count', value, 'int', undefined)
    }
    countDistinct<TABLE_OR_VIEW extends ITableOrView<DB>>(this: IConnection<TypeSafeDB, NAME>, value: ValueSource<DB, TABLE_OR_VIEW, any>): IntValueSource<DB, TABLE_OR_VIEW, int>
    countDistinct<TABLE_OR_VIEW extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW, any>): NumberValueSource<DB, TABLE_OR_VIEW, number>
    countDistinct<TABLE_OR_VIEW extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW, any>): ValueSource<DB, TABLE_OR_VIEW, any> {
        return new AggregateFunctions1ValueSource('_countDistinct', value, 'int', undefined)
    }
    max<TABLE_OR_VIEW extends ITableOrView<DB>, TYPE extends ComparableValueSource<DB, TABLE_OR_VIEW, any>>(value: TYPE): RemapValueSourceTypeAsOptional<DB, TABLE_OR_VIEW, TYPE> {
        const valuePrivate = __getValueSourcePrivate(value)
        return (new AggregateFunctions1ValueSource('_max', value, valuePrivate.__columnType, valuePrivate.__typeAdapter)) as any
    }
    min<TABLE_OR_VIEW extends ITableOrView<DB>, TYPE extends ComparableValueSource<DB, TABLE_OR_VIEW, any>>(value: TYPE): RemapValueSourceTypeAsOptional<DB, TABLE_OR_VIEW, TYPE> {
        const valuePrivate = __getValueSourcePrivate(value)
        return (new AggregateFunctions1ValueSource('_min', value, valuePrivate.__columnType, valuePrivate.__typeAdapter)) as any
    }
    sum<TABLE_OR_VIEW extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW, int | null | undefined>): IntValueSource<DB, TABLE_OR_VIEW, int | null | undefined>
    sum<TABLE_OR_VIEW extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW, double | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW, double | null | undefined>
    sum<TABLE_OR_VIEW extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW, stringInt | null | undefined>): StringIntValueSource<DB, TABLE_OR_VIEW, stringInt | null | undefined>
    sum<TABLE_OR_VIEW extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW, stringDouble | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW, stringDouble | null | undefined>
    sum<TABLE_OR_VIEW extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW, number | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW, number | null | undefined>
    sum<TABLE_OR_VIEW extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW, number | string | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW, number | string | null | undefined>
    sum<TABLE_OR_VIEW extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW, any>): ValueSource<DB, TABLE_OR_VIEW, any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1ValueSource('_sum', value, valuePrivate.__columnType, valuePrivate.__typeAdapter)
    }
    sumDistinct<TABLE_OR_VIEW extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW, int | null | undefined>): IntValueSource<DB, TABLE_OR_VIEW, int | null | undefined>
    sumDistinct<TABLE_OR_VIEW extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW, double | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW, double | null | undefined>
    sumDistinct<TABLE_OR_VIEW extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW, stringInt | null | undefined>): StringIntValueSource<DB, TABLE_OR_VIEW, stringInt | null | undefined>
    sumDistinct<TABLE_OR_VIEW extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW, stringDouble | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW, stringDouble | null | undefined>
    sumDistinct<TABLE_OR_VIEW extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW, number | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW, number | null | undefined>
    sumDistinct<TABLE_OR_VIEW extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW, number | string | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW, number | string | null | undefined>
    sumDistinct<TABLE_OR_VIEW extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW, any>): ValueSource<DB, TABLE_OR_VIEW, any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1ValueSource('_sumDistinct', value, valuePrivate.__columnType, valuePrivate.__typeAdapter)
    }
    average<TABLE_OR_VIEW extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW, int | null | undefined>): IntValueSource<DB, TABLE_OR_VIEW, int | null | undefined>
    average<TABLE_OR_VIEW extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW, double | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW, double | null | undefined>
    average<TABLE_OR_VIEW extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW, stringInt | null | undefined>): StringIntValueSource<DB, TABLE_OR_VIEW, stringInt | null | undefined>
    average<TABLE_OR_VIEW extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW, stringDouble | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW, stringDouble | null | undefined>
    average<TABLE_OR_VIEW extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW, number | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW, number | null | undefined>
    average<TABLE_OR_VIEW extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW, number | string | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW, number | string | null | undefined>
    average<TABLE_OR_VIEW extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW, any>): ValueSource<DB, TABLE_OR_VIEW, any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1ValueSource('_average', value, valuePrivate.__columnType, valuePrivate.__typeAdapter)
    }
    averageDistinct<TABLE_OR_VIEW extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW, int | null | undefined>): IntValueSource<DB, TABLE_OR_VIEW, int | null | undefined>
    averageDistinct<TABLE_OR_VIEW extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW, double | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW, double | null | undefined>
    averageDistinct<TABLE_OR_VIEW extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW, stringInt | null | undefined>): StringIntValueSource<DB, TABLE_OR_VIEW, stringInt | null | undefined>
    averageDistinct<TABLE_OR_VIEW extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW, stringDouble | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW, stringDouble | null | undefined>
    averageDistinct<TABLE_OR_VIEW extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW, number | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW, number | null | undefined>
    averageDistinct<TABLE_OR_VIEW extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW, number | string | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW, number | string | null | undefined>
    averageDistinct<TABLE_OR_VIEW extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW, any>): ValueSource<DB, TABLE_OR_VIEW, any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1ValueSource('_averageDistinct', value, valuePrivate.__columnType, valuePrivate.__typeAdapter)
    }
    stringConcat<TABLE_OR_VIEW extends ITableOrView<DB>>(value: TypeSafeStringValueSource<DB, TABLE_OR_VIEW, string | null | undefined>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, string | null | undefined>
    stringConcat<TABLE_OR_VIEW extends ITableOrView<DB>>(value: StringValueSource<DB, TABLE_OR_VIEW, string | null | undefined>): StringValueSource<DB, TABLE_OR_VIEW, string | null | undefined>
    stringConcat<TABLE_OR_VIEW extends ITableOrView<DB>>(value: TypeSafeStringValueSource<DB, TABLE_OR_VIEW, string | null | undefined>, separator: string): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, string | null | undefined>
    stringConcat<TABLE_OR_VIEW extends ITableOrView<DB>>(value: StringValueSource<DB, TABLE_OR_VIEW, string | null | undefined>, separator: string): StringValueSource<DB, TABLE_OR_VIEW, string | null | undefined>
    stringConcat<TABLE_OR_VIEW extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW, any>, separator?: string): ValueSource<DB, TABLE_OR_VIEW, any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1or2ValueSource('_stringConcat', separator, value, valuePrivate.__columnType, valuePrivate.__typeAdapter)
    }
    stringConcatDistinct<TABLE_OR_VIEW extends ITableOrView<DB>>(value: TypeSafeStringValueSource<DB, TABLE_OR_VIEW, string | null | undefined>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, string | null | undefined>
    stringConcatDistinct<TABLE_OR_VIEW extends ITableOrView<DB>>(value: StringValueSource<DB, TABLE_OR_VIEW, string | null | undefined>): StringValueSource<DB, TABLE_OR_VIEW, string | null | undefined>
    stringConcatDistinct<TABLE_OR_VIEW extends ITableOrView<DB>>(value: TypeSafeStringValueSource<DB, TABLE_OR_VIEW, string | null | undefined>, separator: string): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, string | null | undefined>
    stringConcatDistinct<TABLE_OR_VIEW extends ITableOrView<DB>>(value: StringValueSource<DB, TABLE_OR_VIEW, string | null | undefined>, separator: string): StringValueSource<DB, TABLE_OR_VIEW, string | null | undefined>
    stringConcatDistinct<TABLE_OR_VIEW extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW, any>, separator?: string): ValueSource<DB, TABLE_OR_VIEW, any> {
        const valuePrivate = __getValueSourcePrivate(value)
        return new AggregateFunctions1or2ValueSource('_stringConcatDistinct', separator, value, valuePrivate.__columnType, valuePrivate.__typeAdapter)
    }

    protected transformValueFromDB(value: any, type: string): any {
        if (value === undefined) {
            return null
        }
        if (value === null) {
            return null
        }
        if (value === '') {
            return null
        }
        switch (type) {
            case 'boolean':
                if (typeof value === 'number') {
                    return !!value
                }
                if (typeof value === 'boolean') {
                    return value
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
                    return value
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
                throw new Error('Invalid stringInt value received from the db: ' + value)
            case 'double':
                if (typeof value === 'number') {
                    return value
                }
                if (typeof value === 'string') {
                    const result = +value
                    if (result + '' !== value) {
                        throw new Error('Invalid double value received from the db: ' + value)
                    }
                    return value
                }
                throw new Error('Invalid double value received from the db: ' + value)
            case 'stringDouble':
                if (typeof value === 'number') {
                    return value
                }
                if (typeof value === 'string') {
                    if (!/^-?\d+(\.\d+)?$/g.test(value)) {
                        throw new Error('Invalid stringDouble value received from the db: ' + value)
                    }
                    return value
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
                (result as any).___type___ = 'LocalTime'
                return result
            }
            case 'localTime': {
                let result: Date
                if (value instanceof Date) {
                    result = value
                } else if (typeof value === 'string') {
                    result = new Date('1970-01-01 ' + value)
                } else {
                    throw new Error('Invalid localDate value received from the db: ' + value)
                }
                if (isNaN(result.getTime())) {
                    throw new Error('Invalid localDate value received from the db: ' + value)
                }
                (result as any).___type___ = 'LocalDate'
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
    protected transformValueToDB(value: any, type: string): any {
        if (value === undefined) {
            return null
        }
        if (value === null) {
            return null
        }
        if (value === '') {
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
                    if (!/^-?\d+(\.\d+)?$/g.test(value)) {
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

}
