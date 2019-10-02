import { BooleanValueSource } from "./values"
import { NoTableOrViewRequired } from "../utils/NoTableOrViewRequired"
import { ITableOrView } from "../utils/ITableOrView"
import { AnyDB } from "../databases/AnyDB"
import { TypeSafeDB } from "../databases/TypeSafeDB"
import { int } from "ts-extended-types"

export abstract class DeleteExpressionBase<DB extends AnyDB> {
    // @ts-ignore
    protected ___database: DB
}

export abstract class ExecutableDelete<DB extends AnyDB> extends DeleteExpressionBase<DB> {
    abstract executeDelete(this: DeleteExpressionBase<TypeSafeDB>, min?: number, max?: number): Promise<int>
    abstract executeDelete(min?: number, max?: number): Promise<number>
    abstract query(): string
    abstract params(): any[]
}

export abstract class DynamicExecutableDeleteExpression<DB extends AnyDB, TABLE extends ITableOrView<DB>> extends ExecutableDelete<DB> {
    abstract and(condition: BooleanValueSource<DB, TABLE | NoTableOrViewRequired, boolean | null | undefined>): DynamicExecutableDeleteExpression<DB, TABLE>
    abstract or(condition: BooleanValueSource<DB, TABLE | NoTableOrViewRequired, boolean | null | undefined>): DynamicExecutableDeleteExpression<DB, TABLE>
}

export abstract class DeleteExpression<DB extends AnyDB, TABLE extends ITableOrView<DB>> extends DeleteExpressionBase<DB> {
    abstract dynamicWhere() : DynamicExecutableDeleteExpression<DB, TABLE>
    abstract where(condition: BooleanValueSource<DB, TABLE | NoTableOrViewRequired, boolean | null | undefined>): DynamicExecutableDeleteExpression<DB, TABLE>
}

export abstract class DeleteExpressionAllowingNoWhere<DB extends AnyDB, TABLE extends ITableOrView<DB>> extends ExecutableDelete<DB> {
    abstract dynamicWhere() : DynamicExecutableDeleteExpression<DB, TABLE>
    abstract where(condition: BooleanValueSource<DB, TABLE | NoTableOrViewRequired, boolean | null | undefined>): DynamicExecutableDeleteExpression<DB, TABLE>
}
