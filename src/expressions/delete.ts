import type { IBooleanValueSource, IIfValueSource } from "./values"
import type { ITableOrView, NoTableOrViewRequired } from "../utils/ITableOrView"
import type { AnyDB, TypeSafeDB } from "../databases"
import type { int } from "ts-extended-types"
import type { database, tableOrView, tableOrViewRef } from "../utils/symbols"
import { RawFragment } from "../utils/RawFragment"

export interface DeleteCustomization<DB extends AnyDB> {
    afterDeleteKeyword?: RawFragment<DB>
    afterQuery?: RawFragment<DB>
}

export interface DeleteExpressionOf<DB extends AnyDB> {
    [database]: DB
}

export interface DeleteExpressionBase<TABLE extends ITableOrView<any>> extends DeleteExpressionOf<TABLE[typeof database]> {
    [tableOrView]: TABLE
}

export interface ExecutableDelete<TABLE extends ITableOrView<any>> extends DeleteExpressionBase<TABLE> {
    executeDelete(this: DeleteExpressionOf<TypeSafeDB>, min?: number, max?: number): Promise<int>
    executeDelete(min?: number, max?: number): Promise<number>
    query(): string
    params(): any[]
}

export interface CustomizableExecutableDelete<TABLE extends ITableOrView<any>> extends ExecutableDelete<TABLE> {
    customizeQuery(customization: DeleteCustomization<TABLE[typeof database]>): ExecutableDelete<TABLE>
}

export interface DynamicExecutableDeleteExpression<TABLE extends ITableOrView<any>> extends CustomizableExecutableDelete<TABLE> {
    and(condition: IIfValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
    and(condition: IBooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
    or(condition: IIfValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
    or(condition: IBooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
}

export interface DeleteExpression<TABLE extends ITableOrView<any>> extends DeleteExpressionBase<TABLE> {
    dynamicWhere() : DynamicExecutableDeleteExpression<TABLE>
    where(condition: IIfValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
    where(condition: IBooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
}

export interface DeleteExpressionAllowingNoWhere<TABLE extends ITableOrView<any>> extends CustomizableExecutableDelete<TABLE> {
    dynamicWhere() : DynamicExecutableDeleteExpression<TABLE>
    where(condition: IIfValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
    where(condition: IBooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
}
