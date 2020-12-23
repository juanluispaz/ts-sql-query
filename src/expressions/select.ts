import type { BooleanValueSource, ValueSource, NumberValueSource, IntValueSource, IfValueSource } from "./values"
import type { ITableOrViewOf, NoTableOrViewRequired, NoTableOrViewRequiredView, OuterJoinSource } from "../utils/ITableOrView"
import type { OuterJoinTableOrView } from "../utils/tableOrViewUtils"
import type { AnyDB, TypeWhenSafeDB, TypeSafeDB } from "../databases"
import type { int } from "ts-extended-types"
import type { database, requiredTableOrView, tableOrViewRef } from "../utils/symbols"

export type OrderByMode = 'asc' | 'desc' | 'asc nulls first' | 'asc nulls last' | 'desc nulls first' | 'desc nulls last'

export interface SelectExpressionBase<DB extends AnyDB, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> {
    [database]: DB
    [requiredTableOrView]: REQUIRED_TABLE_OR_VIEW
}

export interface ExecutableSelect<DB extends AnyDB, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    /*
     * Results of execute methods returns an anonymous type with a exact copy of the result
     * to allow see easily the type when you over (with the mouse) the variable with the
     * result
     *
     * Please, don't remove it or put in a type declaration
     */
    executeSelectNoneOrOne(this: SelectExpressionBase<DB, NoTableOrViewRequiredView<DB>>): Promise<{ [P in keyof RESULT]: RESULT[P] } | null>
    executeSelectOne(this: SelectExpressionBase<DB, NoTableOrViewRequiredView<DB>>): Promise<{ [P in keyof RESULT]: RESULT[P] }>
    executeSelectMany(this: SelectExpressionBase<DB, NoTableOrViewRequiredView<DB>>): Promise<{ [P in keyof RESULT]: RESULT[P] }[]>
    query(): string
    params(): any[]
}


//{ data?: { [P in keyof RESULT]: RESULT[P] }[], count?: int }
export interface ExecutableSelectWithoutGroupBy<DB extends AnyDB, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends ExecutableSelect<DB, RESULT, REQUIRED_TABLE_OR_VIEW> {
    executeSelectPage(this: SelectExpressionBase<TypeSafeDB, NoTableOrViewRequiredView<DB>>): Promise<{ data: { [P in keyof RESULT]: RESULT[P] }[], count: int }>
    executeSelectPage(this: SelectExpressionBase<DB, NoTableOrViewRequiredView<DB>>): Promise<{ data: { [P in keyof RESULT]: RESULT[P] }[], count: number }>
    executeSelectPage<EXTRAS extends {}>(this: SelectExpressionBase<TypeSafeDB, NoTableOrViewRequiredView<DB>>, extras: EXTRAS & { data?: { [P in keyof RESULT]: RESULT[P] }[], count?: int }): Promise<{ [Q in keyof SelectPageWithExtras<RESULT, EXTRAS>]: SelectPageWithExtras<RESULT, EXTRAS>[Q] }>
    executeSelectPage<EXTRAS extends {}>(this: SelectExpressionBase<DB, NoTableOrViewRequiredView<DB>>, extras: EXTRAS & { data?: { [P in keyof RESULT]: RESULT[P] }[], count?: number }): Promise<{ [Q in keyof SelectPageWithExtras<RESULT, EXTRAS>]: SelectPageWithExtras<RESULT, EXTRAS>[Q] }>
}

export interface OffsetExecutableSelectExpression<DB extends AnyDB, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends ExecutableSelect<DB, RESULT, REQUIRED_TABLE_OR_VIEW> {
    offset(offset: int): ExecutableSelect<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    offset(offset: number): ExecutableSelect<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    offset(offset: TypeWhenSafeDB<DB, IntValueSource<NoTableOrViewRequired<DB>, int | null | undefined>, NumberValueSource<NoTableOrViewRequired<DB>, number | null | undefined>>): ExecutableSelect<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
}

export interface OffsetExecutableSelectExpressionWithoutGroupBy<DB extends AnyDB, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends ExecutableSelectWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW> {
    offset(offset: int): ExecutableSelectWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    offset(offset: number): ExecutableSelectWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    offset(offset: TypeWhenSafeDB<DB, IntValueSource<NoTableOrViewRequired<DB>, int | null | undefined>, NumberValueSource<NoTableOrViewRequired<DB>, number | null | undefined>>): ExecutableSelectWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
}

export interface OrderByExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends ExecutableSelect<DB, RESULT, REQUIRED_TABLE_OR_VIEW> {
    orderBy(column: ORDER_BY_KEYS, mode?: OrderByMode): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    orderByFromString(orderBy: string): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>

    limit(limit: int): OffsetExecutableSelectExpression<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    limit(limit: number): OffsetExecutableSelectExpression<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    limit(limit: TypeWhenSafeDB<DB, IntValueSource<NoTableOrViewRequired<DB>, int | null | undefined>, NumberValueSource<NoTableOrViewRequired<DB>, number | null | undefined>>): OffsetExecutableSelectExpression<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
}

export interface OrderByExecutableSelectExpressionWithoutGroupBy<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends ExecutableSelectWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW> {
    orderBy(column: ORDER_BY_KEYS, mode?: OrderByMode): OrderByExecutableSelectExpressionWithoutGroupBy<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    orderByFromString(orderBy: string): OrderByExecutableSelectExpressionWithoutGroupBy<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>

    limit(limit: int): OffsetExecutableSelectExpressionWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    limit(limit: number): OffsetExecutableSelectExpressionWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
    limit(limit: TypeWhenSafeDB<DB, IntValueSource<NoTableOrViewRequired<DB>, int | null | undefined>, NumberValueSource<NoTableOrViewRequired<DB>, number | null | undefined>>): OffsetExecutableSelectExpressionWithoutGroupBy<DB, RESULT, REQUIRED_TABLE_OR_VIEW>
}

export interface GroupByOrderByExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends OrderByExecutableSelectExpressionWithoutGroupBy<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    groupBy(...columns: (keyof RESULT)[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    groupBy(...columns: ValueSource<TABLE_OR_VIEW[typeof tableOrViewRef], any>[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface GroupByOrderByHavingExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    groupBy(...columns: (keyof RESULT)[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    groupBy(...columns: ValueSource<TABLE_OR_VIEW[typeof tableOrViewRef], any>[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>

    dynamicHaving(): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    having(condition: IfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    having(condition: BooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface DynamicHavingExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    and(condition: IfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    and(condition: BooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: IfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: BooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface GroupByOrderHavingByExpressionWithoutSelect<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    groupBy(...columns: ValueSource<TABLE_OR_VIEW[typeof tableOrViewRef], any>[]): GroupByOrderHavingByExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    dynamicHaving(): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    having(condition: IfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    having(condition: BooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    select<RESULT>(columns: SelectValues<DB, TABLE_OR_VIEW, RESULT>): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, SelectResult<RESULT>, REQUIRED_TABLE_OR_VIEW, keyof RESULT>
    selectOneColumn<RESULT>(column: ValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, RESULT>): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, FixSelectOneResult<RESULT>, REQUIRED_TABLE_OR_VIEW, 'result'>
}

export interface DynamicHavingExpressionWithoutSelect<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    and(condition: IfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    and(condition: BooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    or(condition: IfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    or(condition: BooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    select<RESULT>(columns: SelectValues<DB, TABLE_OR_VIEW, RESULT>): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, SelectResult<RESULT>, REQUIRED_TABLE_OR_VIEW, keyof RESULT>
    selectOneColumn<RESULT>(column: ValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, RESULT>): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, FixSelectOneResult<RESULT>, REQUIRED_TABLE_OR_VIEW, 'result'>
}

export interface DynamicWhereExpressionWithoutSelect<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    and(condition: IfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    and(condition: BooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    or(condition: IfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    or(condition: BooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    groupBy(...columns: ValueSource<TABLE_OR_VIEW[typeof tableOrViewRef], any>[]): GroupByOrderHavingByExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    select<RESULT>(columns: SelectValues<DB, TABLE_OR_VIEW, RESULT>): GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, SelectResult<RESULT>, REQUIRED_TABLE_OR_VIEW, keyof RESULT>
    selectOneColumn<RESULT>(column: ValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, RESULT>): GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, FixSelectOneResult<RESULT>, REQUIRED_TABLE_OR_VIEW, 'result'>
}

export interface DynamicWhereExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    and(condition: IfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    and(condition: BooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: IfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: BooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface ExecutableSelectExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    dynamicWhere(): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    where(condition: IfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    where(condition: BooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface SelectWhereExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    select<RESULT>(columns: SelectValues<DB, TABLE_OR_VIEW, RESULT>): ExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, SelectResult<RESULT>, REQUIRED_TABLE_OR_VIEW, keyof RESULT>
    selectOneColumn<RESULT>(column: ValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, RESULT>): ExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, FixSelectOneResult<RESULT>, REQUIRED_TABLE_OR_VIEW, 'result'>
    dynamicWhere(): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    where(condition: IfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    where(condition: BooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    groupBy(...columns: ValueSource<TABLE_OR_VIEW[typeof tableOrViewRef], any>[]): GroupByOrderHavingByExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
}

export interface SelectWhereJoinExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectWhereExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW> {
    join<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>>(table: TABLE_OR_VIEW2): OnExpression<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW>
    innerJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>>(table: TABLE_OR_VIEW2): OnExpression<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW>
    leftJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>): OnExpression<DB, TABLE_OR_VIEW | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>, REQUIRED_TABLE_OR_VIEW>
    leftOuterJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>): OnExpression<DB, TABLE_OR_VIEW | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>, REQUIRED_TABLE_OR_VIEW>
}

export interface DynamicOnExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectWhereJoinExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW> {
    and(condition: IfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    and(condition: BooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    or(condition: IfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    or(condition: BooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
}

export interface OnExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectWhereJoinExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW> {
    dynamicOn(): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    on(condition: IfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    on(condition: BooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
}

export interface SelectExpressionWithoutJoin<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectWhereExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW> {
    from<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>>(table: TABLE_OR_VIEW2): SelectExpressionWithoutJoin<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW>
}

export interface SelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectWhereJoinExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW> {
    from<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>>(table: TABLE_OR_VIEW2): SelectExpressionWithoutJoin<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW>
}

export interface SelectExpressionSubquery<DB extends AnyDB, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    from<TABLE_OR_VIEW extends ITableOrViewOf<DB, any>>(table: TABLE_OR_VIEW): SelectExpression<DB, TABLE_OR_VIEW | REQUIRED_TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
}

export interface SelectExpressionFromNoTable<DB extends AnyDB> extends SelectExpressionBase<AnyDB, NoTableOrViewRequiredView<DB>> {
    select<RESULT>(columns: SelectValues<DB, NoTableOrViewRequiredView<DB>, RESULT>): ExecutableSelect<AnyDB, SelectResult<RESULT>, NoTableOrViewRequiredView<DB>>
    selectOneColumn<RESULT>(column: RESULT | ValueSource<NoTableOrViewRequired<DB>, RESULT>): ExecutableSelect<AnyDB, FixSelectOneResult<RESULT>, NoTableOrViewRequiredView<DB>>
}

export type SelectValues<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, RESULT> = {
    [P in keyof RESULT]: ValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, RESULT[P]>
}

export type SelectResult<RESULT> = { [P in MandatoryPropertiesOf<RESULT>]: RESULT[P] } & { [P in OptionalPropertiesOf<RESULT>]?: NonNullable<RESULT[P]> }

export type MandatoryPropertiesOf<TYPE> = ({ [K in keyof TYPE]-?: null | undefined extends TYPE[K] ? never : (null extends TYPE[K] ? never : (undefined extends TYPE[K] ? never : K)) })[keyof TYPE]
export type OptionalPropertiesOf<TYPE> = ({ [K in keyof TYPE]-?: null | undefined extends TYPE[K] ? K : (null extends TYPE[K] ? K : (undefined extends TYPE[K] ? K : never)) })[keyof TYPE]
export type FixSelectOneResult<T> = T extends undefined ? null : T

export type SelectPageWithExtras<RESULT, EXTRAS> = { data: { [P in keyof RESULT]: RESULT[P] }[], count: int } & OmitKeys<EXTRAS, 'data' | 'count'>
export type OmitKeys<T, K> = Pick<T, Exclude<keyof T, K>>