import type { BooleanValueSource } from "./values"
import type { ITableOrView, NoTableOrViewRequired } from "../utils/ITableOrView"
import type { AnyDB, TypeSafeDB } from "../databases"
import type { int } from "ts-extended-types"
import type { database } from "../utils/symbols"

export interface DeleteExpressionBase<DB extends AnyDB> {
    [database]: DB
}

export interface ExecutableDelete<DB extends AnyDB> extends DeleteExpressionBase<DB> {
    executeDelete(this: DeleteExpressionBase<TypeSafeDB>, min?: number, max?: number): Promise<int>
    executeDelete(min?: number, max?: number): Promise<number>
    query(): string
    params(): any[]
}

export interface DynamicExecutableDeleteExpression<DB extends AnyDB, TABLE extends ITableOrView<DB>> extends ExecutableDelete<DB> {
    and(condition: BooleanValueSource<DB, TABLE | NoTableOrViewRequired, boolean | null | undefined>): DynamicExecutableDeleteExpression<DB, TABLE>
    or(condition: BooleanValueSource<DB, TABLE | NoTableOrViewRequired, boolean | null | undefined>): DynamicExecutableDeleteExpression<DB, TABLE>
}

export interface DeleteExpression<DB extends AnyDB, TABLE extends ITableOrView<DB>> extends DeleteExpressionBase<DB> {
    dynamicWhere() : DynamicExecutableDeleteExpression<DB, TABLE>
    where(condition: BooleanValueSource<DB, TABLE | NoTableOrViewRequired, boolean | null | undefined>): DynamicExecutableDeleteExpression<DB, TABLE>
}

export interface DeleteExpressionAllowingNoWhere<DB extends AnyDB, TABLE extends ITableOrView<DB>> extends ExecutableDelete<DB> {
    dynamicWhere() : DynamicExecutableDeleteExpression<DB, TABLE>
    where(condition: BooleanValueSource<DB, TABLE | NoTableOrViewRequired, boolean | null | undefined>): DynamicExecutableDeleteExpression<DB, TABLE>
}
