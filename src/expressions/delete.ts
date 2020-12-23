import type { BooleanValueSource, IfValueSource } from "./values"
import type { ITableOrView, NoTableOrViewRequired } from "../utils/ITableOrView"
import type { AnyDB, TypeSafeDB } from "../databases"
import type { int } from "ts-extended-types"
import type { database, tableOrView, tableOrViewRef } from "../utils/symbols"


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

export interface DynamicExecutableDeleteExpression<TABLE extends ITableOrView<any>> extends ExecutableDelete<TABLE> {
    and(condition: IfValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
    and(condition: BooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
    or(condition: IfValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
    or(condition: BooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
}

export interface DeleteExpression<TABLE extends ITableOrView<any>> extends DeleteExpressionBase<TABLE> {
    dynamicWhere() : DynamicExecutableDeleteExpression<TABLE>
    where(condition: IfValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
    where(condition: BooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
}

export interface DeleteExpressionAllowingNoWhere<TABLE extends ITableOrView<any>> extends ExecutableDelete<TABLE> {
    dynamicWhere() : DynamicExecutableDeleteExpression<TABLE>
    where(condition: IfValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
    where(condition: BooleanValueSource<TABLE[typeof tableOrViewRef] | NoTableOrViewRequired<TABLE[typeof database]>, boolean | null | undefined>): DynamicExecutableDeleteExpression<TABLE>
}
