import { BooleanValueSource, ColumnsOf, InputTypeOfColumn } from "./values"
import { NoTableOrViewRequired } from "../utils/NoTableOrViewRequired"
import { ITableOrView } from "../utils/ITableOrView"
import { AnyDB } from "../databases/AnyDB"
import { TypeSafeDB } from "../databases/TypeSafeDB"
import { int } from "ts-extended-types"

export abstract class UpdateExpressionBase<DB extends AnyDB> {
    // @ts-ignore
    protected ___database: DB
}

export abstract class ExecutableUpdate<DB extends AnyDB> extends UpdateExpressionBase<DB> {
    abstract executeUpdate(this: UpdateExpressionBase<TypeSafeDB>, min?: number, max?: number): Promise<int>
    abstract executeUpdate(min?: number, max?: number): Promise<number>
    abstract query(): string
    abstract params(): any[]
}

export abstract class ExecutableUpdateExpression<DB extends AnyDB, TABLE extends ITableOrView<DB>> extends ExecutableUpdate<DB> {
    abstract set(columns: UpdateSets<DB, TABLE>): ExecutableUpdateExpression<DB, TABLE>
    abstract setIfValue(columns: OptionalUpdateSets<DB, TABLE>): ExecutableUpdateExpression<DB, TABLE>
    abstract setIfSet(columns: UpdateSets<DB, TABLE>): ExecutableUpdateExpression<DB, TABLE>
    abstract setIfSetIfValue(columns: OptionalUpdateSets<DB, TABLE>): ExecutableUpdateExpression<DB, TABLE>
    abstract setIfNotSet(columns: UpdateSets<DB, TABLE>): ExecutableUpdateExpression<DB, TABLE>
    abstract setIfNotSetIfValue(columns: OptionalUpdateSets<DB, TABLE>): ExecutableUpdateExpression<DB, TABLE>
    abstract ignoreIfSet(...columns: ColumnsOf<DB, TABLE>[]): ExecutableUpdateExpression<DB, TABLE>

    abstract dynamicWhere() : DynamicExecutableUpdateExpression<DB, TABLE>
    abstract where(condition: BooleanValueSource<DB, TABLE | NoTableOrViewRequired, boolean | null | undefined>): DynamicExecutableUpdateExpression<DB, TABLE>
}

export abstract class NotExecutableUpdateExpression<DB extends AnyDB, TABLE extends ITableOrView<DB>> extends UpdateExpressionBase<DB> {
    abstract set(columns: UpdateSets<DB, TABLE>): NotExecutableUpdateExpression<DB, TABLE>
    abstract setIfValue(columns: OptionalUpdateSets<DB, TABLE>): NotExecutableUpdateExpression<DB, TABLE>
    abstract setIfSet(columns: UpdateSets<DB, TABLE>): NotExecutableUpdateExpression<DB, TABLE>
    abstract setIfSetIfValue(columns: OptionalUpdateSets<DB, TABLE>): NotExecutableUpdateExpression<DB, TABLE>
    abstract setIfNotSet(columns: UpdateSets<DB, TABLE>): NotExecutableUpdateExpression<DB, TABLE>
    abstract setIfNotSetIfValue(columns: OptionalUpdateSets<DB, TABLE>): NotExecutableUpdateExpression<DB, TABLE>
    abstract ignoreIfSet(...columns: ColumnsOf<DB, TABLE>[]): NotExecutableUpdateExpression<DB, TABLE>

    abstract dynamicWhere() : DynamicExecutableUpdateExpression<DB, TABLE>
    abstract where(condition: BooleanValueSource<DB, TABLE | NoTableOrViewRequired, boolean | null | undefined>): DynamicExecutableUpdateExpression<DB, TABLE>
}

export abstract class DynamicExecutableUpdateExpression<DB extends AnyDB, TABLE extends ITableOrView<DB>> extends ExecutableUpdate<DB> {
    abstract and(condition: BooleanValueSource<DB, TABLE | NoTableOrViewRequired, boolean | null | undefined>): DynamicExecutableUpdateExpression<DB, TABLE>
    abstract or(condition: BooleanValueSource<DB, TABLE | NoTableOrViewRequired, boolean | null | undefined>): DynamicExecutableUpdateExpression<DB, TABLE>
}

export abstract class UpdateExpression<DB extends AnyDB, TABLE extends ITableOrView<DB>> extends UpdateExpressionBase<DB> {
    abstract dynamicSet(): NotExecutableUpdateExpression<DB, TABLE>
    abstract set(columns: UpdateSets<DB, TABLE>): NotExecutableUpdateExpression<DB, TABLE>
    abstract setIfValue(columns: OptionalUpdateSets<DB, TABLE>): NotExecutableUpdateExpression<DB, TABLE>
}

export abstract class UpdateExpressionAllowingNoWhere<DB extends AnyDB, TABLE extends ITableOrView<DB>> extends UpdateExpressionBase<DB> {
    abstract dynamicSet(): ExecutableUpdateExpression<DB, TABLE>
    abstract set(columns: UpdateSets<DB, TABLE>): ExecutableUpdateExpression<DB, TABLE>
    abstract setIfValue(columns: OptionalUpdateSets<DB, TABLE>): ExecutableUpdateExpression<DB, TABLE>
}

export type UpdateSets<DB extends AnyDB, TABLE extends ITableOrView<DB>> = {
    [P in ColumnsOf<DB, TABLE>]?: InputTypeOfColumn<DB, TABLE, P>
}

export type OptionalUpdateSets<DB extends AnyDB, TABLE extends ITableOrView<DB>> = {
    [P in ColumnsOf<DB, TABLE>]?: InputTypeOfColumn<DB, TABLE, P> | null | undefined
}
