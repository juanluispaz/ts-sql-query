import type { BooleanValueSource, ColumnsOf, InputTypeOfColumn } from "./values"
import type { ITableOrView, NoTableOrViewRequired } from "../utils/ITableOrView"
import type { AnyDB, TypeSafeDB } from "../databases"
import type { int } from "ts-extended-types"
import type { database } from "../utils/symbols"

export interface UpdateExpressionBase<DB extends AnyDB> {
    [database]: DB
}

export interface ExecutableUpdate<DB extends AnyDB> extends UpdateExpressionBase<DB> {
    executeUpdate(this: UpdateExpressionBase<TypeSafeDB>, min?: number, max?: number): Promise<int>
    executeUpdate(min?: number, max?: number): Promise<number>
    query(): string
    params(): any[]
}

export interface ExecutableUpdateExpression<DB extends AnyDB, TABLE extends ITableOrView<DB>> extends ExecutableUpdate<DB> {
    set(columns: UpdateSets<DB, TABLE>): ExecutableUpdateExpression<DB, TABLE>
    setIfValue(columns: OptionalUpdateSets<DB, TABLE>): ExecutableUpdateExpression<DB, TABLE>
    setIfSet(columns: UpdateSets<DB, TABLE>): ExecutableUpdateExpression<DB, TABLE>
    setIfSetIfValue(columns: OptionalUpdateSets<DB, TABLE>): ExecutableUpdateExpression<DB, TABLE>
    setIfNotSet(columns: UpdateSets<DB, TABLE>): ExecutableUpdateExpression<DB, TABLE>
    setIfNotSetIfValue(columns: OptionalUpdateSets<DB, TABLE>): ExecutableUpdateExpression<DB, TABLE>
    ignoreIfSet(...columns: ColumnsOf<DB, TABLE>[]): ExecutableUpdateExpression<DB, TABLE>

    dynamicWhere() : DynamicExecutableUpdateExpression<DB, TABLE>
    where(condition: BooleanValueSource<DB, TABLE | NoTableOrViewRequired, boolean | null | undefined>): DynamicExecutableUpdateExpression<DB, TABLE>
}

export interface NotExecutableUpdateExpression<DB extends AnyDB, TABLE extends ITableOrView<DB>> extends UpdateExpressionBase<DB> {
    set(columns: UpdateSets<DB, TABLE>): NotExecutableUpdateExpression<DB, TABLE>
    setIfValue(columns: OptionalUpdateSets<DB, TABLE>): NotExecutableUpdateExpression<DB, TABLE>
    setIfSet(columns: UpdateSets<DB, TABLE>): NotExecutableUpdateExpression<DB, TABLE>
    setIfSetIfValue(columns: OptionalUpdateSets<DB, TABLE>): NotExecutableUpdateExpression<DB, TABLE>
    setIfNotSet(columns: UpdateSets<DB, TABLE>): NotExecutableUpdateExpression<DB, TABLE>
    setIfNotSetIfValue(columns: OptionalUpdateSets<DB, TABLE>): NotExecutableUpdateExpression<DB, TABLE>
    ignoreIfSet(...columns: ColumnsOf<DB, TABLE>[]): NotExecutableUpdateExpression<DB, TABLE>

    dynamicWhere() : DynamicExecutableUpdateExpression<DB, TABLE>
    where(condition: BooleanValueSource<DB, TABLE | NoTableOrViewRequired, boolean | null | undefined>): DynamicExecutableUpdateExpression<DB, TABLE>
}

export interface DynamicExecutableUpdateExpression<DB extends AnyDB, TABLE extends ITableOrView<DB>> extends ExecutableUpdate<DB> {
    and(condition: BooleanValueSource<DB, TABLE | NoTableOrViewRequired, boolean | null | undefined>): DynamicExecutableUpdateExpression<DB, TABLE>
    or(condition: BooleanValueSource<DB, TABLE | NoTableOrViewRequired, boolean | null | undefined>): DynamicExecutableUpdateExpression<DB, TABLE>
}

export interface UpdateExpression<DB extends AnyDB, TABLE extends ITableOrView<DB>> extends UpdateExpressionBase<DB> {
    dynamicSet(): NotExecutableUpdateExpression<DB, TABLE>
    set(columns: UpdateSets<DB, TABLE>): NotExecutableUpdateExpression<DB, TABLE>
    setIfValue(columns: OptionalUpdateSets<DB, TABLE>): NotExecutableUpdateExpression<DB, TABLE>
}

export interface UpdateExpressionAllowingNoWhere<DB extends AnyDB, TABLE extends ITableOrView<DB>> extends UpdateExpressionBase<DB> {
    dynamicSet(): ExecutableUpdateExpression<DB, TABLE>
    set(columns: UpdateSets<DB, TABLE>): ExecutableUpdateExpression<DB, TABLE>
    setIfValue(columns: OptionalUpdateSets<DB, TABLE>): ExecutableUpdateExpression<DB, TABLE>
}

export type UpdateSets<DB extends AnyDB, TABLE extends ITableOrView<DB>> = {
    [P in ColumnsOf<DB, TABLE>]?: InputTypeOfColumn<DB, TABLE, P>
}

export type OptionalUpdateSets<DB extends AnyDB, TABLE extends ITableOrView<DB>> = {
    [P in ColumnsOf<DB, TABLE>]?: InputTypeOfColumn<DB, TABLE, P> | null | undefined
}
