import type { BooleanValueSource, ColumnsOf, InputTypeOfColumn } from "./values"
import type { ITableOrView, NoTableOrViewRequired } from "../utils/ITableOrView"
import type { AnyDB, TypeSafeDB } from "../databases"
import type { int } from "ts-extended-types"
import type { database, tableOrView, tableOrViewRef } from "../utils/symbols"

export interface UpdateExpressionOf<DB extends AnyDB> {
    [database]: DB
}

export interface UpdateExpressionBase<TABLE extends ITableOrView<any>> extends UpdateExpressionOf<TABLE[typeof database]> {
    [tableOrView]: TABLE
}

export interface ExecutableUpdate<TABLE extends ITableOrView<any>> extends UpdateExpressionBase<TABLE> {
    executeUpdate(this: UpdateExpressionOf<TypeSafeDB>, min?: number, max?: number): Promise<int>
    executeUpdate(min?: number, max?: number): Promise<number>
    query(): string
    params(): any[]
}

export interface ExecutableUpdateExpression<TABLE extends ITableOrView<any>> extends ExecutableUpdate<TABLE> {
    set(columns: UpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    setIfValue(columns: OptionalUpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    setIfSet(columns: UpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    setIfSetIfValue(columns: OptionalUpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    setIfNotSet(columns: UpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    setIfNotSetIfValue(columns: OptionalUpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    ignoreIfSet(...columns: ColumnsOf<TABLE>[]): ExecutableUpdateExpression<TABLE>

    dynamicWhere() : DynamicExecutableUpdateExpression<TABLE>
    where(condition: BooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableUpdateExpression<TABLE>
}

export interface NotExecutableUpdateExpression<TABLE extends ITableOrView<any>> extends UpdateExpressionBase<TABLE> {
    set(columns: UpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    setIfValue(columns: OptionalUpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    setIfSet(columns: UpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    setIfSetIfValue(columns: OptionalUpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    setIfNotSet(columns: UpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    setIfNotSetIfValue(columns: OptionalUpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    ignoreIfSet(...columns: ColumnsOf<TABLE>[]): NotExecutableUpdateExpression<TABLE>

    dynamicWhere() : DynamicExecutableUpdateExpression<TABLE>
    where(condition: BooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableUpdateExpression<TABLE>
}

export interface DynamicExecutableUpdateExpression<TABLE extends ITableOrView<any>> extends ExecutableUpdate<TABLE> {
    and(condition: BooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableUpdateExpression<TABLE>
    or(condition: BooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableUpdateExpression<TABLE>
}

export interface UpdateExpression<TABLE extends ITableOrView<any>> extends UpdateExpressionBase<TABLE> {
    dynamicSet(): NotExecutableUpdateExpression<TABLE>
    set(columns: UpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    setIfValue(columns: OptionalUpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
}

export interface UpdateExpressionAllowingNoWhere<TABLE extends ITableOrView<any>> extends UpdateExpressionBase<TABLE> {
    dynamicSet(): ExecutableUpdateExpression<TABLE>
    set(columns: UpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    setIfValue(columns: OptionalUpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
}

export type UpdateSets<TABLE extends ITableOrView<any>> = {
    [P in ColumnsOf<TABLE>]?: InputTypeOfColumn<TABLE, P>
}

export type OptionalUpdateSets<TABLE extends ITableOrView<any>> = {
    [P in ColumnsOf<TABLE>]?: InputTypeOfColumn<TABLE, P> | null | undefined
}
