import type { AnyValueSource, IBooleanValueSource, IExecutableDeleteQuery, IIfValueSource, ValueSourceOf, ValueSourceValueTypeForResult } from "./values"
import type { ITableOrView, ITableOrViewOf, NoTableOrViewRequired, OuterJoinSource } from "../utils/ITableOrView"
import type { AnyDB, MariaDB, MySql, NoopDB, Oracle, PostgreSql, Sqlite, SqlServer } from "../databases"
import type { database, tableOrView, tableOrViewRef } from "../utils/symbols"
import type { RawFragment } from "../utils/RawFragment"
import type { OuterJoinTableOrView } from "../utils/tableOrViewUtils"
import type { ResultObjectValues, ResultObjectValuesProjectedAsNullable } from "../utils/resultUtils"

export interface DeleteCustomization<DB extends AnyDB> {
    afterDeleteKeyword?: RawFragment<DB>
    beforeQuery?: RawFragment<DB>
    afterQuery?: RawFragment<DB>
    queryExecutionName?: string
    queryExecutionMetadata?: any
}

export interface DeleteExpressionOf<DB extends AnyDB> {
    [database]: DB
}

export interface DeleteExpressionBase<TABLE extends ITableOrView<any>> extends DeleteExpressionOf<TABLE[typeof database]> {
    [tableOrView]: TABLE
}

export interface ExecutableDelete<TABLE extends ITableOrView<any>> extends DeleteExpressionBase<TABLE>, IExecutableDeleteQuery<TABLE, number> {
    executeDelete(min?: number, max?: number): Promise<number>
    query(): string
    params(): any[]
}

export interface CustomizableExecutableDelete<TABLE extends ITableOrView<any>> extends ExecutableDelete<TABLE> {
    customizeQuery(customization: DeleteCustomization<TABLE[typeof database]>): ExecutableDelete<TABLE>
}

export interface DynamicExecutableDeleteExpression<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends ReturnableExecutableDelete<TABLE, USING> {
    and(condition: IIfValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicExecutableDeleteExpression<TABLE, USING>
    and(condition: IBooleanValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicExecutableDeleteExpression<TABLE, USING>
    or(condition: IIfValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicExecutableDeleteExpression<TABLE, USING>
    or(condition: IBooleanValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicExecutableDeleteExpression<TABLE, USING>
}

export interface DeleteWhereExpression<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends DeleteExpressionBase<TABLE> {
    dynamicWhere() : DynamicExecutableDeleteExpression<TABLE, USING>
    where(condition: IIfValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicExecutableDeleteExpression<TABLE, USING>
    where(condition: IBooleanValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicExecutableDeleteExpression<TABLE, USING>
}

export interface DeleteExpression<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends DeleteWhereExpression<TABLE, USING> {
    using: UsingFnType<TABLE, USING>
    join: OnExpressionFnType<TABLE, USING>
    innerJoin: OnExpressionFnType<TABLE, USING>
    leftJoin: OuterJoinOnExpressionFnType<TABLE, USING>
    leftOuterJoin: OuterJoinOnExpressionFnType<TABLE, USING>
}

export interface DeleteWhereExpressionAllowingNoWhere<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends ReturnableExecutableDelete<TABLE, USING> {
    dynamicWhere() : DynamicExecutableDeleteExpression<TABLE, USING>
    where(condition: IIfValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicExecutableDeleteExpression<TABLE, USING>
    where(condition: IBooleanValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicExecutableDeleteExpression<TABLE, USING>
}

export interface DeleteExpressionAllowingNoWhere<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends DeleteWhereExpressionAllowingNoWhere<TABLE, USING> {
    using: UsingFnTypeAllowingNoWhere<TABLE, USING>
    join: OnExpressionFnTypeAllowingNoWhere<TABLE, USING>
    innerJoin: OnExpressionFnTypeAllowingNoWhere<TABLE, USING>
    leftJoin: OuterJoinOnExpressionFnTypeAllowingNoWhere<TABLE, USING>
    leftOuterJoin: OuterJoinOnExpressionFnTypeAllowingNoWhere<TABLE, USING>
}





export interface DeleteWhereJoinExpression<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends DeleteWhereExpression<TABLE, USING> {
    join<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2): OnExpression<TABLE, USING | TABLE_OR_VIEW2>
    innerJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2): OnExpression<TABLE, USING | TABLE_OR_VIEW2>
    leftJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>): OnExpression<TABLE, USING | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>>
    leftOuterJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>): OnExpression<TABLE, USING | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>>
}

export interface DynamicOnExpression<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends DeleteWhereJoinExpression<TABLE, USING> {
    and(condition: IIfValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpression<TABLE, USING>
    and(condition: IBooleanValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpression<TABLE, USING>
    or(condition: IIfValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpression<TABLE, USING>
    or(condition: IBooleanValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpression<TABLE, USING>
}

export interface OnExpression<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends DeleteWhereJoinExpression<TABLE, USING> {
    dynamicOn(): DynamicOnExpression<TABLE, USING>
    on(condition: IIfValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpression<TABLE, USING>
    on(condition: IBooleanValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpression<TABLE, USING>
}

export interface DeleteExpressionWithoutJoin<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends DeleteWhereExpression<TABLE, USING> {
    using<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2): DeleteExpressionWithoutJoin<TABLE, USING | TABLE_OR_VIEW2>
}

export interface DeleteUsingExpression<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends DeleteWhereJoinExpression<TABLE, USING> {
    using<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2): DeleteExpressionWithoutJoin<TABLE, USING | TABLE_OR_VIEW2>
}

type UsingFnType<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> =
    TABLE[typeof database] extends (NoopDB | PostgreSql | SqlServer | MariaDB | MySql) 
    ? <TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2) => DeleteUsingExpression<TABLE, USING | TABLE_OR_VIEW2>
    : never

type OnExpressionFnType<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> =
    TABLE[typeof database] extends (NoopDB | MariaDB | MySql) 
    ? <TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2) => OnExpression<TABLE, USING | TABLE_OR_VIEW2>
    : never

type OuterJoinOnExpressionFnType<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> =
    TABLE[typeof database] extends (NoopDB | MariaDB | MySql) 
    ? <TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>) => OnExpression<TABLE, USING | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>>
    : never





export interface DeleteWhereJoinExpressionAllowingNoWhere<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends DeleteWhereExpressionAllowingNoWhere<TABLE, USING> {
    join<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2): OnExpressionAllowingNoWhere<TABLE, USING | TABLE_OR_VIEW2>
    innerJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2): OnExpressionAllowingNoWhere<TABLE, USING | TABLE_OR_VIEW2>
    leftJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>): OnExpressionAllowingNoWhere<TABLE, USING | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>>
    leftOuterJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>): OnExpressionAllowingNoWhere<TABLE, USING | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>>
}

export interface DynamicOnExpressionAllowingNoWhere<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends DeleteWhereJoinExpressionAllowingNoWhere<TABLE, USING> {
    and(condition: IIfValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpressionAllowingNoWhere<TABLE, USING>
    and(condition: IBooleanValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpressionAllowingNoWhere<TABLE, USING>
    or(condition: IIfValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpressionAllowingNoWhere<TABLE, USING>
    or(condition: IBooleanValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpressionAllowingNoWhere<TABLE, USING>
}

export interface OnExpressionAllowingNoWhere<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends DeleteWhereJoinExpressionAllowingNoWhere<TABLE, USING> {
    dynamicOn(): DynamicOnExpressionAllowingNoWhere<TABLE, USING>
    on(condition: IIfValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpressionAllowingNoWhere<TABLE, USING>
    on(condition: IBooleanValueSource<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, any>): DynamicOnExpressionAllowingNoWhere<TABLE, USING>
}

export interface DeleteExpressionWithoutJoinAllowingNoWhere<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends DeleteWhereExpressionAllowingNoWhere<TABLE, USING> {
    using<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2): DeleteExpressionWithoutJoinAllowingNoWhere<TABLE, USING | TABLE_OR_VIEW2>
}

export interface DeleteUsingExpressionAllowingNoWhere<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends DeleteWhereJoinExpressionAllowingNoWhere<TABLE, USING> {
    using<TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2): DeleteExpressionWithoutJoinAllowingNoWhere<TABLE, USING | TABLE_OR_VIEW2>
}

type UsingFnTypeAllowingNoWhere<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> =
    TABLE[typeof database] extends (NoopDB | PostgreSql | SqlServer | MariaDB | MySql) 
    ? <TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2) => DeleteUsingExpressionAllowingNoWhere<TABLE, USING | TABLE_OR_VIEW2>
    : never

type OnExpressionFnTypeAllowingNoWhere<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> =
    TABLE[typeof database] extends (NoopDB | MariaDB | MySql) 
    ? <TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>>(table: TABLE_OR_VIEW2) => OnExpressionAllowingNoWhere<TABLE, USING | TABLE_OR_VIEW2>
    : never

type OuterJoinOnExpressionFnTypeAllowingNoWhere<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> =
    TABLE[typeof database] extends (NoopDB | MariaDB | MySql) 
    ? <TABLE_OR_VIEW2 extends ITableOrViewOf<TABLE[typeof database], any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>) => OnExpressionAllowingNoWhere<TABLE, USING | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>>
    : never





export interface ReturnableExecutableDelete<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> extends CustomizableExecutableDelete<TABLE> {
    returning: ReturningFnType<TABLE, USING>
    returningOneColumn: ReturningOneColumnFnType<TABLE, USING>
}

export interface ExecutableDeleteReturning<TABLE extends ITableOrView<any>, COLUMNS, RESULT> extends DeleteExpressionBase<TABLE>, IExecutableDeleteQuery<TABLE, RESULT> {
    executeDeleteNoneOrOne(): Promise<( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] }) | null>
    executeDeleteOne(): Promise<( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] })>
    executeDeleteMany(min?: number, max?: number): Promise<( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] })[]>

    query(): string
    params(): any[]
}

export interface ComposableCustomizableExecutableDelete<TABLE extends ITableOrView<any>, COLUMNS, RESULT> extends ExecutableDeleteReturning<TABLE, COLUMNS, RESULT> {
    customizeQuery(customization: DeleteCustomization<TABLE[typeof database]>): ExecutableDeleteReturning<TABLE, COLUMNS, RESULT>
}

export interface ComposableCustomizableExecutableDeleteProjectableAsNullable<TABLE extends ITableOrView<any>, COLUMNS> extends ComposableCustomizableExecutableDelete<TABLE, COLUMNS, ResultObjectValues<COLUMNS>> {
    projectingOptionalValuesAsNullable(): ComposableCustomizableExecutableDelete<TABLE, COLUMNS, ResultObjectValuesProjectedAsNullable<COLUMNS>>
}

type ReturningFnType<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> =
    TABLE[typeof database] extends (NoopDB | PostgreSql | SqlServer | Sqlite | MariaDB | Oracle) 
    ? <COLUMNS extends DeleteColumns<TABLE, USING>>(columns: COLUMNS) => ComposableCustomizableExecutableDeleteProjectableAsNullable<TABLE, COLUMNS>
    : never

type ReturningOneColumnFnType<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> =
    TABLE[typeof database] extends (NoopDB | PostgreSql | SqlServer | Sqlite | MariaDB | Oracle) 
    ? <COLUMN extends ValueSourceOf<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>>>(column: COLUMN) => ComposableCustomizableExecutableDelete<TABLE, COLUMN, ValueSourceValueTypeForResult<COLUMN>>
    : never

export type DeleteColumns<TABLE extends ITableOrView<any>, USING extends ITableOrView<any>> = {
    [P: string]: ValueSourceOf<USING[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>> | DeleteColumns<TABLE, USING>
    [P: number | symbol]: never
}