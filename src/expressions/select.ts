import type { BooleanValueSource, ValueSource, NumberValueSource, IntValueSource } from "./values"
import type { ITableOrView, NoTableOrViewRequired, OuterJoinSource } from "../utils/ITableOrView"
import type { OuterJoinTableOrView } from "../utils/tableOrViewUtils"
import type { AnyDB, TypeWhenSafeDB, TypeSafeDB } from "../databases"
import type { int } from "ts-extended-types"
import type { database, requiredTableOrView } from "../utils/symbols"

export type OrderByMode = 'asc' | 'desc' | 'asc nulls first' | 'asc nulls last' | 'desc nulls first' | 'desc nulls last'

export interface SelectExpressionBase<DB extends AnyDB, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> {
    [database]: DB
    [requiredTableOrView]: REQUIRED_TABLE_OR_VIEW
}

export interface ExecutableSelect<DB extends AnyDB, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    /*
     * Results of execute methods returns an anonymous type with a exact copy of the result
     * to allow see easily the type when you over (with the mouse) the variable with the
     * result
     *
     * Please, don't remove it or put in a type declaration
     */
    executeSelectNoneOrOne(this: SelectExpressionBase<DB, NoTableOrViewRequired>): Promise<{ [P in keyof RESULT]: RESULT[P] } | null>
    executeSelectOne(this: SelectExpressionBase<DB, NoTableOrViewRequired>): Promise<{ [P in keyof RESULT]: RESULT[P] }>
    executeSelectMany(this: SelectExpressionBase<DB, NoTableOrViewRequired>): Promise<{ [P in keyof RESULT]: RESULT[P] }[]>
    query(): string
    params(): any[]
}


//{ data?: { [P in keyof RESULT]: RESULT[P] }[], count?: int }
export interface ExecutableSelectWithoutGroupBy<DB extends AnyDB, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends ExecutableSelect<DB, RESULT, REQUIRED_TABLE_OR_VIEW> {
    executeSelectPage(this: SelectExpressionBase<TypeSafeDB, NoTableOrViewRequired>): Promise<{ data: { [P in keyof RESULT]: RESULT[P] }[], count: int }>
    executeSelectPage(this: SelectExpressionBase<DB, NoTableOrViewRequired>): Promise<{ data: { [P in keyof RESULT]: RESULT[P] }[], count: number }>
    executeSelectPage<EXTRAS extends {}>(this: SelectExpressionBase<TypeSafeDB, NoTableOrViewRequired>, extras: EXTRAS & { data?: { [P in keyof RESULT]: RESULT[P] }[], count?: int }): Promise<{ [Q in keyof SelectPageWithExtras<RESULT, EXTRAS>]: SelectPageWithExtras<RESULT, EXTRAS>[Q] }>
    executeSelectPage<EXTRAS extends {}>(this: SelectExpressionBase<DB, NoTableOrViewRequired>, extras: EXTRAS & { data?: { [P in keyof RESULT]: RESULT[P] }[], count?: number }): Promise<{ [Q in keyof SelectPageWithExtras<RESULT, EXTRAS>]: SelectPageWithExtras<RESULT, EXTRAS>[Q] }>
}

export interface OffsetExecutableSelectExpression<DB extends AnyDB, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends ExecutableSelect<DB, RESULT, REQUIRED_TABLE_OR_VIEW> {
    offset(offset: int): ExecutableSelect<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    offset(offset: number): ExecutableSelect<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    offset(offset: TypeWhenSafeDB<DB, IntValueSource<DB, NoTableOrViewRequired, int | null | undefined>, NumberValueSource<DB, NoTableOrViewRequired, number | null | undefined>>): ExecutableSelect<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
}

export interface OffsetExecutableSelectExpressionWithoutGroupBy<DB extends AnyDB, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends ExecutableSelectWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW> {
    offset(offset: int): ExecutableSelectWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    offset(offset: number): ExecutableSelectWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    offset(offset: TypeWhenSafeDB<DB, IntValueSource<DB, NoTableOrViewRequired, int | null | undefined>, NumberValueSource<DB, NoTableOrViewRequired, number | null | undefined>>): ExecutableSelectWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
}

export interface OrderByExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>, ORDER_BY_KEYS> extends ExecutableSelect<DB, RESULT, REQUIRED_TABLE_OR_VIEW> {
    orderBy(column: ORDER_BY_KEYS, mode?: OrderByMode): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    orderByFromString(orderBy: string): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>

    limit(limit: int): OffsetExecutableSelectExpression<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    limit(limit: number): OffsetExecutableSelectExpression<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    limit(limit: TypeWhenSafeDB<DB, IntValueSource<DB, NoTableOrViewRequired, int | null | undefined>, NumberValueSource<DB, NoTableOrViewRequired, number | null | undefined>>): OffsetExecutableSelectExpression<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
}

export interface OrderByExecutableSelectExpressionWithoutGroupBy<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>, ORDER_BY_KEYS> extends ExecutableSelectWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW> {
    orderBy(column: ORDER_BY_KEYS, mode?: OrderByMode): OrderByExecutableSelectExpressionWithoutGroupBy<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    orderByFromString(orderBy: string): OrderByExecutableSelectExpressionWithoutGroupBy<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>

    limit(limit: int): OffsetExecutableSelectExpressionWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    limit(limit: number): OffsetExecutableSelectExpressionWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    limit(limit: TypeWhenSafeDB<DB, IntValueSource<DB, NoTableOrViewRequired, int | null | undefined>, NumberValueSource<DB, NoTableOrViewRequired, number | null | undefined>>): OffsetExecutableSelectExpressionWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
}

export interface GroupByOrderByExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>, ORDER_BY_KEYS> extends OrderByExecutableSelectExpressionWithoutGroupBy<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    groupBy(...columns: (keyof RESULT)[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    groupBy(...columns: ValueSource<DB, TABLE_OR_VIEW, any>[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface GroupByOrderByHavingExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>, ORDER_BY_KEYS> extends OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    groupBy(...columns: (keyof RESULT)[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    groupBy(...columns: ValueSource<DB, TABLE_OR_VIEW, any>[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>

    dynamicHaving(): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    having(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface DynamicHavingExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>, ORDER_BY_KEYS> extends OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    and(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface GroupByOrderHavingByExpressionWithoutSelect<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    groupBy(...columns: ValueSource<DB, TABLE_OR_VIEW, any>[]): GroupByOrderHavingByExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    dynamicHaving(): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    having(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    select<RESULT>(columns: SelectValues<DB, TABLE_OR_VIEW, RESULT>): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, SelectResult<RESULT>, REQUIRED_TABLE_OR_VIEW, keyof RESULT>
    selectOneColumn<RESULT>(column: ValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, RESULT>): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, FixSelectOneResult<RESULT>, REQUIRED_TABLE_OR_VIEW, 'result'>
}

export interface DynamicHavingExpressionWithoutSelect<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    and(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    or(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    select<RESULT>(columns: SelectValues<DB, TABLE_OR_VIEW, RESULT>): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, SelectResult<RESULT>, REQUIRED_TABLE_OR_VIEW, keyof RESULT>
    selectOneColumn<RESULT>(column: ValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, RESULT>): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, FixSelectOneResult<RESULT>, REQUIRED_TABLE_OR_VIEW, 'result'>
}

export interface DynamicWhereExpressionWithoutSelect<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    and(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    or(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    groupBy(...columns: ValueSource<DB, TABLE_OR_VIEW, any>[]): GroupByOrderHavingByExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    select<RESULT>(columns: SelectValues<DB, TABLE_OR_VIEW, RESULT>): GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, SelectResult<RESULT>, REQUIRED_TABLE_OR_VIEW, keyof RESULT>
    selectOneColumn<RESULT>(column: ValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, RESULT>): GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, FixSelectOneResult<RESULT>, REQUIRED_TABLE_OR_VIEW, 'result'>
}

export interface DynamicWhereExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>, ORDER_BY_KEYS> extends GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    and(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface ExecutableSelectExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>, ORDER_BY_KEYS> extends GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    dynamicWhere(): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    where(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface SelectWhereExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    select<RESULT>(columns: SelectValues<DB, TABLE_OR_VIEW, RESULT>): ExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, SelectResult<RESULT>, REQUIRED_TABLE_OR_VIEW, keyof RESULT>
    selectOneColumn<RESULT>(column: ValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, RESULT>): ExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, FixSelectOneResult<RESULT>, REQUIRED_TABLE_OR_VIEW, 'result'>
    dynamicWhere(): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    where(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    groupBy(...columns: ValueSource<DB, TABLE_OR_VIEW, any>[]): GroupByOrderHavingByExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
}

export interface SelectWhereJoinExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends SelectWhereExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW> {
    join<TABLE_OR_VIEW2 extends ITableOrView<DB>>(table: TABLE_OR_VIEW2): OnExpression<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW>
    innerJoin<TABLE_OR_VIEW2 extends ITableOrView<DB>>(table: TABLE_OR_VIEW2): OnExpression<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW>
    leftJoin<TABLE_OR_VIEW2 extends ITableOrView<DB>, ALIAS>(source: OuterJoinSource<DB, TABLE_OR_VIEW2, ALIAS>): OnExpression<DB, TABLE_OR_VIEW | OuterJoinTableOrView<DB, TABLE_OR_VIEW2, ALIAS>, REQUIRED_TABLE_OR_VIEW>
    leftOuterJoin<TABLE_OR_VIEW2 extends ITableOrView<DB>, ALIAS>(source: OuterJoinSource<DB, TABLE_OR_VIEW2, ALIAS>): OnExpression<DB, TABLE_OR_VIEW | OuterJoinTableOrView<DB, TABLE_OR_VIEW2, ALIAS>, REQUIRED_TABLE_OR_VIEW>
}

export interface DynamicOnExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends SelectWhereJoinExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW> {
    and(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    or(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
}

export interface OnExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends SelectWhereJoinExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW> {
    dynamicOn(): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    on(condition: BooleanValueSource<DB, TABLE_OR_VIEW | NoTableOrViewRequired, boolean | null | undefined>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
}

export interface SelectExpressionWithoutJoin<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends SelectWhereExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW> {
    from<TABLE_OR_VIEW2 extends ITableOrView<DB>>(table: TABLE_OR_VIEW2): SelectExpressionWithoutJoin<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW>
}

export interface SelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends SelectWhereJoinExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW> {
    from<TABLE_OR_VIEW2 extends ITableOrView<DB>>(table: TABLE_OR_VIEW2): SelectExpressionWithoutJoin<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW>
}

export interface SelectExpressionSubquery<DB extends AnyDB, REQUIRED_TABLE_OR_VIEW extends ITableOrView<DB>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    from<TABLE_OR_VIEW extends ITableOrView<DB>>(table: TABLE_OR_VIEW): SelectExpression<DB, TABLE_OR_VIEW | REQUIRED_TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
}

export interface SelectExpressionFromNoTable extends SelectExpressionBase<AnyDB, NoTableOrViewRequired> {
    select<RESULT>(columns: SelectValues<AnyDB, NoTableOrViewRequired, RESULT>): ExecutableSelect<AnyDB, SelectResult<RESULT>, NoTableOrViewRequired>
    selectOneColumn<RESULT>(column: RESULT | ValueSource<AnyDB, NoTableOrViewRequired, RESULT>): ExecutableSelect<AnyDB, FixSelectOneResult<RESULT>, NoTableOrViewRequired>
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