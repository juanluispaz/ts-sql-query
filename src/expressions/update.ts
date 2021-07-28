import type { IBooleanValueSource, ColumnsForSetOf, IIfValueSource, InputTypeOfColumn } from "./values"
import type { ITableOrView, NoTableOrViewRequired } from "../utils/ITableOrView"
import type { AnyDB, TypeSafeDB } from "../databases"
import type { int } from "ts-extended-types"
import type { database, tableOrView, tableOrViewRef } from "../utils/symbols"
import type { RawFragment } from "../utils/RawFragment"

export interface UpdateCustomization<DB extends AnyDB> {
    afterUpdateKeyword?: RawFragment<DB>
    afterQuery?: RawFragment<DB>
}

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

export interface CustomizableExecutableUpdate<TABLE extends ITableOrView<any>> extends ExecutableUpdate<TABLE> {
    customizeQuery(customization: UpdateCustomization<TABLE[typeof database]>): ExecutableUpdate<TABLE>
}

export interface ExecutableUpdateExpression<TABLE extends ITableOrView<any>> extends CustomizableExecutableUpdate<TABLE> {
    set(columns: UpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    setIfValue(columns: OptionalUpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    setIfSet(columns: UpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    setIfSetIfValue(columns: OptionalUpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    setIfNotSet(columns: UpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    setIfNotSetIfValue(columns: OptionalUpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    ignoreIfSet(...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE>

    setIfHasValue(columns: UpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    setIfHasValueIfValue(columns: OptionalUpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    setIfHasNoValue(columns: UpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    setIfHasNoValueIfValue(columns: OptionalUpdateSets<TABLE>): ExecutableUpdateExpression<TABLE>
    ignoreIfHasValue(...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE>
    ignoreIfHasNoValue(...columns: ColumnsForSetOf<TABLE>[]): ExecutableUpdateExpression<TABLE>
    ignoreAnySetWithNoValue(): ExecutableUpdateExpression<TABLE>

    dynamicWhere() : DynamicExecutableUpdateExpression<TABLE>
    where(condition: IIfValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableUpdateExpression<TABLE>
    where(condition: IBooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableUpdateExpression<TABLE>
}

export interface NotExecutableUpdateExpression<TABLE extends ITableOrView<any>> extends UpdateExpressionBase<TABLE> {
    set(columns: UpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    setIfValue(columns: OptionalUpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    setIfSet(columns: UpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    setIfSetIfValue(columns: OptionalUpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    setIfNotSet(columns: UpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    setIfNotSetIfValue(columns: OptionalUpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    ignoreIfSet(...columns: ColumnsForSetOf<TABLE>[]): NotExecutableUpdateExpression<TABLE>

    setIfHasValue(columns: UpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    setIfHasValueIfValue(columns: OptionalUpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    setIfHasNoValue(columns: UpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    setIfHasNoValueIfValue(columns: OptionalUpdateSets<TABLE>): NotExecutableUpdateExpression<TABLE>
    ignoreIfHasValue(...columns: ColumnsForSetOf<TABLE>[]): NotExecutableUpdateExpression<TABLE>
    ignoreIfHasNoValue(...columns: ColumnsForSetOf<TABLE>[]): NotExecutableUpdateExpression<TABLE>
    ignoreAnySetWithNoValue(): NotExecutableUpdateExpression<TABLE>

    dynamicWhere() : DynamicExecutableUpdateExpression<TABLE>
    where(condition: IIfValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableUpdateExpression<TABLE>
    where(condition: IBooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableUpdateExpression<TABLE>
}

export interface DynamicExecutableUpdateExpression<TABLE extends ITableOrView<any>> extends CustomizableExecutableUpdate<TABLE> {
    and(condition: IIfValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableUpdateExpression<TABLE>
    and(condition: IBooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableUpdateExpression<TABLE>
    or(condition: IIfValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableUpdateExpression<TABLE>
    or(condition: IBooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableUpdateExpression<TABLE>
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
    [P in ColumnsForSetOf<TABLE>]?: InputTypeOfColumn<TABLE, P>
}

export type OptionalUpdateSets<TABLE extends ITableOrView<any>> = {
    [P in ColumnsForSetOf<TABLE>]?: InputTypeOfColumn<TABLE, P> | null | undefined
}
