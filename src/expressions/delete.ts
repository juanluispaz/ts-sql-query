import type { AnyValueSource, IAnyBooleanValueSource, IExecutableDeleteQuery, ValueSourceOf, ValueSourceValueTypeForResult } from "./values"
import type { ForUseInLeftJoin, HasSource, IRawFragment, ITableOrView, OfDB, OfSameDB } from "../utils/ITableOrView"
import type { NNoTableOrViewRequiredFrom, NSource } from "../utils/sourceName"
import type { source, from, using } from "../utils/symbols"
import type { DataToProject } from "../complexProjections/dataToProject"
import type { ResultObjectValuesProjectedAsNullable } from "../complexProjections/resultWithOptionalsAsNull"
import type { ResultObjectValues } from "../complexProjections/resultWithOptionalsAsUndefined"

export interface DeleteCustomization</*in|out*/ _TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> {
    afterDeleteKeyword?: IRawFragment<USING[typeof source]>
    beforeQuery?: IRawFragment<USING[typeof source]>
    afterQuery?: IRawFragment<USING[typeof source]>
    queryExecutionName?: string
    queryExecutionMetadata?: any
}

export interface DeleteExpressionBase</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> {
    [from]: TABLE
    [using]: USING
}

export interface ExecutableDelete</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends DeleteExpressionBase<TABLE, USING>, IExecutableDeleteQuery<NNoTableOrViewRequiredFrom<TABLE[typeof source]>, number> {
    executeDelete(min?: number, max?: number): Promise<number>
    query(): string
    params(): any[]
}

export interface CustomizableExecutableDelete</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends ExecutableDelete<TABLE, USING> {
    customizeQuery(customization: DeleteCustomization<TABLE, USING>): ExecutableDelete<TABLE, USING>
}

export interface DynamicExecutableDeleteExpression</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends ReturnableExecutableDelete<TABLE, USING> {
    and(condition: IAnyBooleanValueSource<USING[typeof source], any>): DynamicExecutableDeleteExpression<TABLE, USING>
    or(condition: IAnyBooleanValueSource<USING[typeof source], any>): DynamicExecutableDeleteExpression<TABLE, USING>
}

export interface DeleteWhereExpression</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends DeleteExpressionBase<TABLE, USING> {
    dynamicWhere() : DynamicExecutableDeleteExpression<TABLE, USING>
    where(condition: IAnyBooleanValueSource<USING[typeof source], any>): DynamicExecutableDeleteExpression<TABLE, USING>
}

export interface DeleteExpression</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends DeleteWhereExpression<TABLE, USING> {
    using: UsingFnType<TABLE, USING>
    join: OnExpressionFnType<TABLE, USING>
    innerJoin: OnExpressionFnType<TABLE, USING>
    leftJoin: LeftJoinOnExpressionFnType<TABLE, USING>
    leftOuterJoin: LeftJoinOnExpressionFnType<TABLE, USING>
}

export interface DeleteWhereExpressionAllowingNoWhere</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends ReturnableExecutableDelete<TABLE, USING> {
    dynamicWhere() : DynamicExecutableDeleteExpression<TABLE, USING>
    where(condition: IAnyBooleanValueSource<USING[typeof source], any>): DynamicExecutableDeleteExpression<TABLE, USING>
}

export interface DeleteExpressionAllowingNoWhere</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends DeleteWhereExpressionAllowingNoWhere<TABLE, USING> {
    using: UsingFnTypeAllowingNoWhere<TABLE, USING>
    join: OnExpressionFnTypeAllowingNoWhere<TABLE, USING>
    innerJoin: OnExpressionFnTypeAllowingNoWhere<TABLE, USING>
    leftJoin: LeftJoinOnExpressionFnTypeAllowingNoWhere<TABLE, USING>
    leftOuterJoin: LeftJoinOnExpressionFnTypeAllowingNoWhere<TABLE, USING>
}





export interface DeleteWhereJoinExpression</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends DeleteWhereExpression<TABLE, USING> {
    join<T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>): OnExpression<TABLE, USING | T2>
    innerJoin<T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>): OnExpression<TABLE, USING | T2>
    leftJoin<T2 extends ForUseInLeftJoin<any>>(source: T2 & OfSameDB<TABLE>): OnExpression<TABLE, USING | T2>
    leftOuterJoin<T2 extends ForUseInLeftJoin<any>>(source: T2 & OfSameDB<TABLE>): OnExpression<TABLE, USING | T2>
}

export interface DynamicOnExpression</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends DeleteWhereJoinExpression<TABLE, USING> {
    and(condition: IAnyBooleanValueSource<USING[typeof source], any>): DynamicOnExpression<TABLE, USING>
    or(condition: IAnyBooleanValueSource<USING[typeof source], any>): DynamicOnExpression<TABLE, USING>
}

export interface OnExpression</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends DeleteWhereJoinExpression<TABLE, USING> {
    dynamicOn(): DynamicOnExpression<TABLE, USING>
    on(condition: IAnyBooleanValueSource<USING[typeof source], any>): DynamicOnExpression<TABLE, USING>
}

export interface DeleteExpressionWithoutJoin</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends DeleteWhereExpression<TABLE, USING> {
    using<T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>): DeleteExpressionWithoutJoin<TABLE, USING | T2>
}

export interface DeleteUsingExpression</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends DeleteWhereJoinExpression<TABLE, USING> {
    using<T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>): DeleteExpressionWithoutJoin<TABLE, USING | T2>
}

type UsingFnType<TABLE extends HasSource<any>, USING extends HasSource<any>> =
    TABLE extends OfDB<'noopDB' | 'postgreSql' | 'sqlServer' | 'mariaDB' | 'mySql'> 
    ? <T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>) => DeleteUsingExpression<TABLE, USING | T2>
    : never

type OnExpressionFnType<TABLE extends HasSource<any>, USING extends HasSource<any>> =
    TABLE extends OfDB<'noopDB' | 'mariaDB' | 'mySql'>
    ? <T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>) => OnExpression<TABLE, USING | T2>
    : never

type LeftJoinOnExpressionFnType<TABLE extends HasSource<any>, USING extends HasSource<any>> =
    TABLE extends OfDB<'noopDB' | 'mariaDB' | 'mySql'>
    ? <T2 extends ForUseInLeftJoin<any>>(source: T2 & OfSameDB<TABLE>) => OnExpression<TABLE, USING | T2>
    : never





export interface DeleteWhereJoinExpressionAllowingNoWhere</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends DeleteWhereExpressionAllowingNoWhere<TABLE, USING> {
    join<T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>): OnExpressionAllowingNoWhere<TABLE, USING | T2>
    innerJoin<T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>): OnExpressionAllowingNoWhere<TABLE, USING | T2>
    leftJoin<T2 extends ForUseInLeftJoin<any>>(source: T2 & OfSameDB<TABLE>): OnExpressionAllowingNoWhere<TABLE, USING | T2>
    leftOuterJoin<T2 extends ForUseInLeftJoin<any>>(source: T2 & OfSameDB<TABLE>): OnExpressionAllowingNoWhere<TABLE, USING | T2>
}

export interface DynamicOnExpressionAllowingNoWhere</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends DeleteWhereJoinExpressionAllowingNoWhere<TABLE, USING> {
    and(condition: IAnyBooleanValueSource<USING[typeof source], any>): DynamicOnExpressionAllowingNoWhere<TABLE, USING>
    or(condition: IAnyBooleanValueSource<USING[typeof source], any>): DynamicOnExpressionAllowingNoWhere<TABLE, USING>
}

export interface OnExpressionAllowingNoWhere</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends DeleteWhereJoinExpressionAllowingNoWhere<TABLE, USING> {
    dynamicOn(): DynamicOnExpressionAllowingNoWhere<TABLE, USING>
    on(condition: IAnyBooleanValueSource<USING[typeof source], any>): DynamicOnExpressionAllowingNoWhere<TABLE, USING>
}

export interface DeleteExpressionWithoutJoinAllowingNoWhere</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends DeleteWhereExpressionAllowingNoWhere<TABLE, USING> {
    using<T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>): DeleteExpressionWithoutJoinAllowingNoWhere<TABLE, USING | T2>
}

export interface DeleteUsingExpressionAllowingNoWhere</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends DeleteWhereJoinExpressionAllowingNoWhere<TABLE, USING> {
    using<T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>): DeleteExpressionWithoutJoinAllowingNoWhere<TABLE, USING | T2>
}

type UsingFnTypeAllowingNoWhere<TABLE extends HasSource<any>, USING extends HasSource<any>> =
    TABLE extends OfDB<'noopDB' | 'postgreSql' | 'sqlServer' | 'mariaDB' | 'mySql'>
    ? <T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>) => DeleteUsingExpressionAllowingNoWhere<TABLE, USING | T2>
    : never

type OnExpressionFnTypeAllowingNoWhere<TABLE extends HasSource<any>, USING extends HasSource<any>> =
    TABLE extends OfDB<'noopDB' | 'mariaDB' | 'mySql'>
    ? <T2 extends ITableOrView<any>>(table: T2 & OfSameDB<TABLE>) => OnExpressionAllowingNoWhere<TABLE, USING | T2>
    : never

type LeftJoinOnExpressionFnTypeAllowingNoWhere<TABLE extends HasSource<any>, USING extends HasSource<any>> =
    TABLE extends OfDB<'noopDB' | 'mariaDB' | 'mySql'>
    ? <T2 extends ForUseInLeftJoin<any>>(source: T2 & OfSameDB<TABLE>) => OnExpressionAllowingNoWhere<TABLE, USING | T2>
    : never





export interface ReturnableExecutableDelete</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>> extends CustomizableExecutableDelete<TABLE, USING> {
    returning: ReturningFnType<TABLE, USING>
    returningOneColumn: ReturningOneColumnFnType<TABLE, USING>
}

export interface ExecutableDeleteReturning</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT> extends DeleteExpressionBase<TABLE, USING>, IExecutableDeleteQuery<NNoTableOrViewRequiredFrom<TABLE[typeof source]>, RESULT> {
    executeDeleteNoneOrOne(): Promise<( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] }) | null>
    executeDeleteOne(): Promise<( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] })>
    executeDeleteMany(min?: number, max?: number): Promise<( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] })[]>

    query(): string
    params(): any[]
}

export interface ComposableCustomizableExecutableDelete</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT> extends ExecutableDeleteReturning<TABLE, USING, COLUMNS, RESULT> {
    customizeQuery(customization: DeleteCustomization<TABLE, USING>): ExecutableDeleteReturning<TABLE, USING, COLUMNS, RESULT>
}

export interface CustomizableExecutableDeleteProjectableAsNullable</*in|out*/ TABLE extends HasSource<any>, /*in|out*/ USING extends HasSource<any>, /*in|out*/ COLUMNS> extends ComposableCustomizableExecutableDelete<TABLE, USING, COLUMNS, ResultObjectValues<COLUMNS>> {
    projectingOptionalValuesAsNullable(): ComposableCustomizableExecutableDelete<TABLE, USING, COLUMNS, ResultObjectValuesProjectedAsNullable<COLUMNS>>
}

type ReturningFnType<TABLE extends HasSource<any>, USING extends HasSource<any>> =
    TABLE extends OfDB<'noopDB' | 'postgreSql' | 'sqlServer' | 'mariaDB' | 'oracle'>
    ? <COLUMNS extends DeleteReturningColumns<USING[typeof source]>>(columns: COLUMNS) => CustomizableExecutableDeleteProjectableAsNullable<TABLE, USING, COLUMNS>
    : TABLE extends OfDB<'sqlite'>
    ? <COLUMNS extends DeleteReturningColumns<TABLE[typeof source] | NNoTableOrViewRequiredFrom<TABLE[typeof source]>>>(columns: COLUMNS) => CustomizableExecutableDeleteProjectableAsNullable<TABLE, USING, COLUMNS>
    : never

type ReturningOneColumnFnType<TABLE extends HasSource<any>, USING extends HasSource<any>> =
    TABLE extends OfDB<'noopDB' | 'postgreSql' | 'sqlServer' | 'mariaDB' | 'oracle'>
    ? <COLUMN extends ValueSourceOf<USING[typeof source]>>(column: COLUMN) => ComposableCustomizableExecutableDelete<TABLE, USING, COLUMN, ValueSourceValueTypeForResult<COLUMN>>
    : TABLE  extends OfDB<'sqlite'>
    ? <COLUMN extends ValueSourceOf<TABLE[typeof source] | NNoTableOrViewRequiredFrom<TABLE[typeof source]>>>(column: COLUMN) => ComposableCustomizableExecutableDelete<TABLE, USING, COLUMN, ValueSourceValueTypeForResult<COLUMN>>
    : never

export type DeleteReturningColumns</*in|out*/ SOURCE extends NSource> = DataToProject<SOURCE>