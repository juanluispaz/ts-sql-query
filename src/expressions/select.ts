import { BooleanValueSource, ValueSource, NumberValueSource, IntValueSource } from "./values"
import { NoTableOrViewRequired } from "../utils/NoTableOrViewRequired"
import { ITableOrView } from "../utils/ITableOrView"
import { AnyDB } from "../databases/AnyDB"
import { OuterJoinSource } from "../utils/OuterJoinSource"
import { OuterJoinTableOrView } from "../utils/tableOrViewUtils"
import { TypeWhenSafeDB, TypeSafeDB } from "../databases/TypeSafeDB"
import { int } from "ts-extended-types"

export type OrderByMode = 'asc' | 'desc' | 'asc nulls first' | 'asc nulls last' | 'desc nulls first' | 'desc nulls last'

export abstract class SelectExpressionBase<DB extends AnyDB, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> {
    // @ts-ignore
    private ___database: DB
    // @ts-ignore
    private ___requiredTable: REQUIRED_TABLE_OR_VIEW
}

export abstract class ExecutableSelect<DB extends AnyDB, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    /*
     * Results of execute methods returns an anonymous type with a exact copy of the result
     * to allow see easily the type when you over (with the mouse) the variable with the
     * result
     *
     * Please, don't remove it or put in a type declaration
     */
    abstract executeSelectNoneOrOne(this: SelectExpressionBase<DB, NoTableOrViewRequired>): Promise<{ [P in keyof RESULT]: RESULT[P] } | null>
    abstract executeSelectOne(this: SelectExpressionBase<DB, NoTableOrViewRequired>): Promise<{ [P in keyof RESULT]: RESULT[P] }>
    abstract executeSelectMany(this: SelectExpressionBase<DB, NoTableOrViewRequired>): Promise<{ [P in keyof RESULT]: RESULT[P] }[]>
    abstract query(): string
    abstract params(): any[]
}


//{ data?: { [P in keyof RESULT]: RESULT[P] }[], count?: int }
export abstract class ExecutableSelectWithoutGroupBy<DB extends AnyDB, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends ExecutableSelect<DB, RESULT, REQUIRED_TABLE_OR_VIEW> {
    abstract executeSelectPage(this: SelectExpressionBase<TypeSafeDB, NoTableOrViewRequired>): Promise<{ data: { [P in keyof RESULT]: RESULT[P] }[], count: int }>
    abstract executeSelectPage(this: SelectExpressionBase<DB, NoTableOrViewRequired>): Promise<{ data: { [P in keyof RESULT]: RESULT[P] }[], count: number }>
    abstract executeSelectPage<EXTRAS extends {}>(this: SelectExpressionBase<TypeSafeDB, NoTableOrViewRequired>, extras: EXTRAS & { data?: { [P in keyof RESULT]: RESULT[P] }[], count?: int }): Promise<{ [Q in keyof SelectPageWithExtras<RESULT, EXTRAS>]: SelectPageWithExtras<RESULT, EXTRAS>[Q] }>
    abstract executeSelectPage<EXTRAS extends {}>(this: SelectExpressionBase<DB, NoTableOrViewRequired>, extras: EXTRAS & { data?: { [P in keyof RESULT]: RESULT[P] }[], count?: number }): Promise<{ [Q in keyof SelectPageWithExtras<RESULT, EXTRAS>]: SelectPageWithExtras<RESULT, EXTRAS>[Q] }>
}

export abstract class OffsetExecutableSelectExpression<DB extends AnyDB, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends ExecutableSelect<DB, RESULT, REQUIRED_TABLE_OR_VIEW> {
    abstract offset(offset: int): ExecutableSelect<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    abstract offset(offset: number): ExecutableSelect<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    abstract offset(offset: TypeWhenSafeDB<DB, IntValueSource<DB, NoTableOrViewRequired, int | null | undefined>, NumberValueSource<DB, NoTableOrViewRequired, number | null | undefined>>): ExecutableSelect<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
}

export abstract class OffsetExecutableSelectExpressionWithoutGroupBy<DB extends AnyDB, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends ExecutableSelectWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW> {
    abstract offset(offset: int): ExecutableSelectWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    abstract offset(offset: number): ExecutableSelectWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    abstract offset(offset: TypeWhenSafeDB<DB, IntValueSource<DB, NoTableOrViewRequired, int | null | undefined>, NumberValueSource<DB, NoTableOrViewRequired, number | null | undefined>>): ExecutableSelectWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
}

export abstract class OrderByExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>, ORDER_BY_KEYS> extends ExecutableSelect<DB, RESULT, REQUIRED_TABLE_OR_VIEW> {
    abstract orderBy(column: ORDER_BY_KEYS, mode?: OrderByMode): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    abstract orderByFromString(orderBy: string): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>

    abstract limit(limit: int): OffsetExecutableSelectExpression<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    abstract limit(limit: number): OffsetExecutableSelectExpression<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    abstract limit(limit: TypeWhenSafeDB<DB, IntValueSource<DB, NoTableOrViewRequired, int | null | undefined>, NumberValueSource<DB, NoTableOrViewRequired, number | null | undefined>>): OffsetExecutableSelectExpression<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
}

export abstract class OrderByExecutableSelectExpressionWithoutGroupBy<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>, ORDER_BY_KEYS> extends ExecutableSelectWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW> {
    abstract orderBy(column: ORDER_BY_KEYS, mode?: OrderByMode): OrderByExecutableSelectExpressionWithoutGroupBy<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    abstract orderByFromString(orderBy: string): OrderByExecutableSelectExpressionWithoutGroupBy<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>

    abstract limit(limit: int): OffsetExecutableSelectExpressionWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    abstract limit(limit: number): OffsetExecutableSelectExpressionWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    abstract limit(limit: TypeWhenSafeDB<DB, IntValueSource<DB, NoTableOrViewRequired, int | null | undefined>, NumberValueSource<DB, NoTableOrViewRequired, number | null | undefined>>): OffsetExecutableSelectExpressionWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
}

export abstract class GroupByOrderByExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>, ORDER_BY_KEYS> extends OrderByExecutableSelectExpressionWithoutGroupBy<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    abstract groupBy(...columns: (keyof RESULT)[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    abstract groupBy(...columns: ValueSource<DB, TABLE_OR_VIEW, any>[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export abstract class GroupByOrderByHavingExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>, ORDER_BY_KEYS> extends OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    abstract groupBy(...columns: (keyof RESULT)[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    abstract groupBy(...columns: ValueSource<DB, TABLE_OR_VIEW, any>[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>

    abstract dynamicHaving(): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    abstract having(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export abstract class DynamicHavingExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>, ORDER_BY_KEYS> extends OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    abstract and(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    abstract or(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export abstract class GroupByOrderHavingByExpressionWithoutSelect<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    abstract groupBy(...columns: ValueSource<DB, TABLE_OR_VIEW, any>[]): GroupByOrderHavingByExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    abstract dynamicHaving(): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    abstract having(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    abstract select<RESULT>(columns: SelectValues<DB, TABLE_OR_VIEW, RESULT>): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, SelectResult<RESULT>, REQUIRED_TABLE_OR_VIEW, keyof RESULT>
    abstract selectOneColumn<RESULT>(column: ValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, RESULT>): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, FixSelectOneResult<RESULT>, REQUIRED_TABLE_OR_VIEW, 'result'>
}

export abstract class DynamicHavingExpressionWithoutSelect<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    abstract and(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    abstract or(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    abstract select<RESULT>(columns: SelectValues<DB, TABLE_OR_VIEW, RESULT>): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, SelectResult<RESULT>, REQUIRED_TABLE_OR_VIEW, keyof RESULT>
    abstract selectOneColumn<RESULT>(column: ValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, RESULT>): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, FixSelectOneResult<RESULT>, REQUIRED_TABLE_OR_VIEW, 'result'>
}

export abstract class DynamicWhereExpressionWithoutSelect<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    abstract and(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    abstract or(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    abstract groupBy(...columns: ValueSource<DB, TABLE_OR_VIEW, any>[]): GroupByOrderHavingByExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    abstract select<RESULT>(columns: SelectValues<DB, TABLE_OR_VIEW, RESULT>): GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, SelectResult<RESULT>, REQUIRED_TABLE_OR_VIEW, keyof RESULT>
    abstract selectOneColumn<RESULT>(column: ValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, RESULT>): GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, FixSelectOneResult<RESULT>, REQUIRED_TABLE_OR_VIEW, 'result'>
}

export abstract class DynamicWhereExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>, ORDER_BY_KEYS> extends GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    abstract and(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    abstract or(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export abstract class ExecutableSelectExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>, ORDER_BY_KEYS> extends GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    abstract dynamicWhere(): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    abstract where(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export abstract class SelectWhereExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    abstract select<RESULT>(columns: SelectValues<DB, TABLE_OR_VIEW, RESULT>): ExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, SelectResult<RESULT>, REQUIRED_TABLE_OR_VIEW, keyof RESULT>
    abstract selectOneColumn<RESULT>(column: ValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, RESULT>): ExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, FixSelectOneResult<RESULT>, REQUIRED_TABLE_OR_VIEW, 'result'>
    abstract dynamicWhere(): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    abstract where(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    abstract groupBy(...columns: ValueSource<DB, TABLE_OR_VIEW, any>[]): GroupByOrderHavingByExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
}

export abstract class SelectWhereJoinExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends SelectWhereExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW> {
    abstract join<TABLE_OR_VIEW2 extends ITableOrView<DB>>(table: TABLE_OR_VIEW2): OnExpression<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW>
    abstract innerJoin<TABLE_OR_VIEW2 extends ITableOrView<DB>>(table: TABLE_OR_VIEW2): OnExpression<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW>
    abstract leftJoin<TABLE_OR_VIEW2 extends ITableOrView<DB>, ALIAS>(source: OuterJoinSource<DB, TABLE_OR_VIEW2, ALIAS>): OnExpression<DB, TABLE_OR_VIEW | OuterJoinTableOrView<DB, TABLE_OR_VIEW2, ALIAS>, REQUIRED_TABLE_OR_VIEW>
    abstract leftOuterJoin<TABLE_OR_VIEW2 extends ITableOrView<DB>, ALIAS>(source: OuterJoinSource<DB, TABLE_OR_VIEW2, ALIAS>): OnExpression<DB, TABLE_OR_VIEW | OuterJoinTableOrView<DB, TABLE_OR_VIEW2, ALIAS>, REQUIRED_TABLE_OR_VIEW>
}

export abstract class DynamicOnExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends SelectWhereJoinExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW> {
    abstract and(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    abstract or(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
}

export abstract class OnExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends SelectWhereJoinExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW> {
    abstract dynamicOn(): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    abstract on(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
}

export abstract class SelectExpressionWithoutJoin<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends SelectWhereExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW> {
    abstract from<TABLE_OR_VIEW2 extends ITableOrView<DB>>(table: TABLE_OR_VIEW2): SelectExpressionWithoutJoin<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW>
}

export abstract class SelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends SelectWhereJoinExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW> {
    abstract from<TABLE_OR_VIEW2 extends ITableOrView<DB>>(table: TABLE_OR_VIEW2): SelectExpressionWithoutJoin<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW>
}

export abstract class SelectExpressionSubquery<DB extends AnyDB, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    abstract from<TABLE_OR_VIEW extends ITableOrView<DB>>(table: TABLE_OR_VIEW): SelectExpression<DB, TABLE_OR_VIEW | REQUIRED_TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
}

export abstract class SelectExpressionFromNoTable extends SelectExpressionBase<AnyDB, NoTableOrViewRequired> {
    abstract select<RESULT>(columns: SelectValues<AnyDB, NoTableOrViewRequired, RESULT>): ExecutableSelect<AnyDB, SelectResult<RESULT>, NoTableOrViewRequired>
    abstract selectOneColumn<RESULT>(column: RESULT | ValueSource<AnyDB, NoTableOrViewRequired, RESULT>): ExecutableSelect<AnyDB, FixSelectOneResult<RESULT>, NoTableOrViewRequired>
}

export type SelectValues<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, RESULT> = {
    [P in keyof RESULT]: ValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, RESULT[P]>
}

export type SelectResult<RESULT> = { [P in MandatoryPropertiesOf<RESULT>]: RESULT[P] } & { [P in OptionalPropertiesOf<RESULT>]?: NonNullable<RESULT[P]> }

export type MandatoryPropertiesOf<TYPE> = ({ [K in keyof TYPE]-?: null | undefined extends TYPE[K] ? never : (null extends TYPE[K] ? never : (undefined extends TYPE[K] ? never : K)) })[keyof TYPE]
export type OptionalPropertiesOf<TYPE> = ({ [K in keyof TYPE]-?: null | undefined extends TYPE[K] ? K : (null extends TYPE[K] ? K : (undefined extends TYPE[K] ? K : never)) })[keyof TYPE]
export type FixSelectOneResult<T> = T extends undefined ? null : T

export type SelectPageWithExtras<RESULT, EXTRAS> = { data: { [P in keyof RESULT]: RESULT[P] }[], count: int } & OmitKeys<EXTRAS, 'data' | 'count'>
export type OmitKeys<T, K> = Pick<T, Exclude<keyof T, K>>