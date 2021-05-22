import type { IBooleanValueSource, ValueSource, INumberValueSource, IIntValueSource, IIfValueSource, IExecutableSelect } from "./values"
import type { ITableOrViewOf, NoTableOrViewRequired, NoTableOrViewRequiredView, OuterJoinSource } from "../utils/ITableOrView"
import type { OuterJoinTableOrView, WithView, WITH_VIEW } from "../utils/tableOrViewUtils"
import type { AnyDB, TypeWhenSafeDB, TypeSafeDB, NoopDB, MariaDB, PostgreSql, Sqlite, Oracle, SqlServer } from "../databases"
import type { int } from "ts-extended-types"
import type { columnsType, database, requiredTableOrView, compoundable, tableOrViewRef } from "../utils/symbols"

export type OrderByMode = 'asc' | 'desc' | 'asc nulls first' | 'asc nulls last' | 'desc nulls first' | 'desc nulls last' | 'insensitive' |
                          'asc insensitive' | 'desc insensitive' | 'asc nulls first insensitive' | 'asc nulls last insensitive' | 
                          'desc nulls first insensitive' | 'desc nulls last insensitive'

export interface SelectExpressionBase<DB extends AnyDB, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> {
    [database]: DB
    [requiredTableOrView]: REQUIRED_TABLE_OR_VIEW
}

export interface ICompoundableSelect<DB extends AnyDB, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends IExecutableSelect<DB, RESULT, REQUIRED_TABLE_OR_VIEW> {
    [compoundable]: 'CompoundableSelect'
}

export interface ExecutableSelect<DB extends AnyDB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW>, IExecutableSelect<DB, RESULT, REQUIRED_TABLE_OR_VIEW> {
    [columnsType]: COLUMNS
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

    executeSelectPage(this: SelectExpressionBase<TypeSafeDB, NoTableOrViewRequiredView<DB>>): Promise<{ data: { [P in keyof RESULT]: RESULT[P] }[], count: int }>
    executeSelectPage(this: SelectExpressionBase<DB, NoTableOrViewRequiredView<DB>>): Promise<{ data: { [P in keyof RESULT]: RESULT[P] }[], count: number }>
    executeSelectPage<EXTRAS extends {}>(this: SelectExpressionBase<TypeSafeDB, NoTableOrViewRequiredView<DB>>, extras: EXTRAS & { data?: { [P in keyof RESULT]: RESULT[P] }[], count?: int }): Promise<{ [Q in keyof SelectPageWithExtras<RESULT, EXTRAS>]: SelectPageWithExtras<RESULT, EXTRAS>[Q] }>
    executeSelectPage<EXTRAS extends {}>(this: SelectExpressionBase<DB, NoTableOrViewRequiredView<DB>>, extras: EXTRAS & { data?: { [P in keyof RESULT]: RESULT[P] }[], count?: number }): Promise<{ [Q in keyof SelectPageWithExtras<RESULT, EXTRAS>]: SelectPageWithExtras<RESULT, EXTRAS>[Q] }>

    compose<EXTERNAL_PROP extends keyof RESULT & keyof COLUMNS, INTERNAL_PROP extends string, RESULT_PROP extends string>(config: {
        externalProperty: EXTERNAL_PROP,
        internalProperty: INTERNAL_PROP,
        propertyName: RESULT_PROP
    }): ComposeExpression<EXTERNAL_PROP, INTERNAL_PROP, RESULT_PROP, DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    composeDeletingInternalProperty<EXTERNAL_PROP extends keyof RESULT & keyof COLUMNS, INTERNAL_PROP extends string, RESULT_PROP extends string>(config: {
        externalProperty: EXTERNAL_PROP,
        internalProperty: INTERNAL_PROP,
        propertyName: RESULT_PROP
    }): ComposeExpressionDeletingInternalProperty<EXTERNAL_PROP, INTERNAL_PROP, RESULT_PROP, DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    composeDeletingExternalProperty<EXTERNAL_PROP extends keyof RESULT & keyof COLUMNS, INTERNAL_PROP extends string, RESULT_PROP extends string>(config: {
        externalProperty: EXTERNAL_PROP,
        internalProperty: INTERNAL_PROP,
        propertyName: RESULT_PROP
    }): ComposeExpressionDeletingExternalProperty<EXTERNAL_PROP, INTERNAL_PROP, RESULT_PROP, DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>

    // Note: { [Q in keyof SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] } is used to define the internal object because { [P in keyof MAPPING]: RESULT[MAPPING[P]] } doesn't respect the optional typing of the props
    split<RESULT_PROP extends string, MAPPED_PROPS extends keyof RESULT & keyof COLUMNS, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ExecutableSelect<DB, COLUMNS, Omit<RESULT, ValueOf<MAPPING>> & { [key in RESULT_PROP]: { [Q in keyof SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }}, REQUIRED_TABLE_OR_VIEW>
    splitOptional<RESULT_PROP extends string, MAPPED_PROPS extends keyof RESULT & keyof COLUMNS, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ExecutableSelect<DB, COLUMNS, Omit<RESULT, ValueOf<MAPPING>> & { [key in RESULT_PROP]?: { [Q in keyof SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }}, REQUIRED_TABLE_OR_VIEW>

    query(): string
    params(): any[]
}

export interface ComposeExpression<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, DB extends AnyDB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> {
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ExecutableSelect<DB, COLUMNS, RESULT & { [key in RESULT_PROP]?: INTERNAL}, REQUIRED_TABLE_OR_VIEW>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ExecutableSelect<DB, COLUMNS, RESULT & { [key in RESULT_PROP]: INTERNAL}, REQUIRED_TABLE_OR_VIEW>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ExecutableSelect<DB, COLUMNS, RESULT & { [key in RESULT_PROP]: INTERNAL[]}, REQUIRED_TABLE_OR_VIEW>
}
export interface ComposeExpressionDeletingInternalProperty<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, DB extends AnyDB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> {
    // Note: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] } is used to delete the internal prop because Omit<INTERNAL, INTERNAL_PROP> is not expanded in the editor (when see the type)
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ExecutableSelect<DB, COLUMNS, RESULT & { [key in RESULT_PROP]?: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }}, REQUIRED_TABLE_OR_VIEW>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ExecutableSelect<DB, COLUMNS, RESULT & { [key in RESULT_PROP]: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }}, REQUIRED_TABLE_OR_VIEW>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ExecutableSelect<DB, COLUMNS, RESULT & { [key in RESULT_PROP]: Array<{ [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }>}, REQUIRED_TABLE_OR_VIEW>
}

export interface ComposeExpressionDeletingExternalProperty<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, DB extends AnyDB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> {
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ExecutableSelect<DB, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & { [key in RESULT_PROP]?: INTERNAL}, REQUIRED_TABLE_OR_VIEW>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ExecutableSelect<DB, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & { [key in RESULT_PROP]: INTERNAL}, REQUIRED_TABLE_OR_VIEW>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ExecutableSelect<DB, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & { [key in RESULT_PROP]: INTERNAL[]}, REQUIRED_TABLE_OR_VIEW>
}

export interface WithableExecutableSelect<DB extends AnyDB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends ExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW> {
    forUseInQueryAs: ForUseInQueryAs<DB, COLUMNS>
}

export interface OffsetExecutableSelectExpression<DB extends AnyDB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends WithableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW> {
    offset(offset: int): WithableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    offset(offset: number): WithableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    offset(offset: TypeWhenSafeDB<DB, IIntValueSource<NoTableOrViewRequired<DB>, int | null | undefined>, INumberValueSource<NoTableOrViewRequired<DB>, number | null | undefined>>): WithableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
}

export interface OrderByExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends WithableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW> {
    orderBy(column: ORDER_BY_KEYS, mode?: OrderByMode): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    orderByFromString(orderBy: string): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>

    limit(limit: int): OffsetExecutableSelectExpression<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    limit(limit: number): OffsetExecutableSelectExpression<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    limit(limit: TypeWhenSafeDB<DB, IIntValueSource<NoTableOrViewRequired<DB>, int | null | undefined>, INumberValueSource<NoTableOrViewRequired<DB>, number | null | undefined>>): OffsetExecutableSelectExpression<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
}

export interface CompoundableExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>, ICompoundableSelect<DB, RESULT, REQUIRED_TABLE_OR_VIEW> {
    union<SELECT extends ICompoundableSelect<DB, RESULT, any>>(select: SELECT): CompoundedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], ORDER_BY_KEYS>
    unionAll<SELECT extends ICompoundableSelect<DB, RESULT, any>>(select: SELECT): CompoundedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], ORDER_BY_KEYS>
    intersect: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    intersectAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    except: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    exceptAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    minus: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    minusAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface CompoundedExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    union<SELECT extends ICompoundableSelect<DB, RESULT, any>>(select: SELECT): CompoundedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], ORDER_BY_KEYS>
    unionAll<SELECT extends ICompoundableSelect<DB, RESULT, any>>(select: SELECT): CompoundedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], ORDER_BY_KEYS>
    intersect: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    intersectAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    except: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    exceptAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    minus: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    minusAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface GroupByOrderByExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends CompoundableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    groupBy(...columns: (keyof RESULT)[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    groupBy(...columns: ValueSource<TABLE_OR_VIEW[typeof tableOrViewRef], any>[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface GroupByOrderByHavingExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends CompoundableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    groupBy(...columns: (keyof RESULT)[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    groupBy(...columns: ValueSource<TABLE_OR_VIEW[typeof tableOrViewRef], any>[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>

    dynamicHaving(): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    having(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    having(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface DynamicHavingExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends CompoundableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface GroupByOrderHavingByExpressionWithoutSelect<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    groupBy(...columns: ValueSource<TABLE_OR_VIEW[typeof tableOrViewRef], any>[]): GroupByOrderHavingByExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    dynamicHaving(): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    having(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    having(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    select<COLUMNS extends SelectColumns<DB, TABLE_OR_VIEW>>(columns: COLUMNS): CompoundableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, SelectResult<ResultValues<COLUMNS>>, REQUIRED_TABLE_OR_VIEW, keyof COLUMNS>
    selectOneColumn<RESULT>(column: ValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, RESULT>): CompoundableExecutableSelectExpression<DB, TABLE_OR_VIEW, undefined, FixSelectOneResult<RESULT>, REQUIRED_TABLE_OR_VIEW, 'result'>
}

export interface DynamicHavingExpressionWithoutSelect<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    select<COLUMNS extends SelectColumns<DB, TABLE_OR_VIEW>>(columns: COLUMNS): CompoundableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, SelectResult<ResultValues<COLUMNS>>, REQUIRED_TABLE_OR_VIEW, keyof COLUMNS>
    selectOneColumn<RESULT>(column: ValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, RESULT>): CompoundableExecutableSelectExpression<DB, TABLE_OR_VIEW, undefined, FixSelectOneResult<RESULT>, REQUIRED_TABLE_OR_VIEW, 'result'>
}

export interface DynamicWhereExpressionWithoutSelect<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    groupBy(...columns: ValueSource<TABLE_OR_VIEW[typeof tableOrViewRef], any>[]): GroupByOrderHavingByExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    select<COLUMNS extends SelectColumns<DB, TABLE_OR_VIEW>>(columns: COLUMNS): GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, SelectResult<ResultValues<COLUMNS>>, REQUIRED_TABLE_OR_VIEW, keyof COLUMNS>
    selectOneColumn<RESULT>(column: ValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, RESULT>): GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, undefined, FixSelectOneResult<RESULT>, REQUIRED_TABLE_OR_VIEW, 'result'>
}

export interface DynamicWhereExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface ExecutableSelectExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    dynamicWhere(): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    where(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    where(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface SelectWhereExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    select<COLUMNS extends SelectColumns<DB, TABLE_OR_VIEW>>(columns: COLUMNS): ExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, SelectResult<ResultValues<COLUMNS>>, REQUIRED_TABLE_OR_VIEW, keyof COLUMNS>
    selectOneColumn<RESULT>(column: ValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, RESULT>): ExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, undefined, FixSelectOneResult<RESULT>, REQUIRED_TABLE_OR_VIEW, 'result'>
    dynamicWhere(): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    where(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    where(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    groupBy(...columns: ValueSource<TABLE_OR_VIEW[typeof tableOrViewRef], any>[]): GroupByOrderHavingByExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
}

export interface SelectWhereJoinExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectWhereExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW> {
    join<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>>(table: TABLE_OR_VIEW2): OnExpression<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW>
    innerJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>>(table: TABLE_OR_VIEW2): OnExpression<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW>
    leftJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>): OnExpression<DB, TABLE_OR_VIEW | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>, REQUIRED_TABLE_OR_VIEW>
    leftOuterJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>): OnExpression<DB, TABLE_OR_VIEW | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>, REQUIRED_TABLE_OR_VIEW>
}

export interface DynamicOnExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectWhereJoinExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
}

export interface OnExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectWhereJoinExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW> {
    dynamicOn(): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    on(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    on(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
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
    select<COLUMNS extends SelectColumns<DB, NoTableOrViewRequiredView<DB>>>(columns: COLUMNS): WithableExecutableSelect<AnyDB, COLUMNS, SelectResult<ResultValues<COLUMNS>>, NoTableOrViewRequiredView<DB>>
    selectOneColumn<RESULT>(column: RESULT | ValueSource<NoTableOrViewRequired<DB>, RESULT>): WithableExecutableSelect<AnyDB, undefined, FixSelectOneResult<RESULT>, NoTableOrViewRequiredView<DB>>
}

export type SelectColumns<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> = {
    [P: string]: ValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>
}

export type ResultValues<COLUMNS> = {
    [P in keyof COLUMNS]: ValueSourceResult<COLUMNS[P]>
}

type ValueSourceResult<T> = T extends ValueSource<any, infer R> ? R : never

export type SelectResult<RESULT> = { [P in MandatoryPropertiesOf<RESULT>]: RESULT[P] } & { [P in OptionalPropertiesOf<RESULT>]?: NonNullable<RESULT[P]> }

export type MandatoryPropertiesOf<TYPE> = ({ [K in keyof TYPE]-?: null | undefined extends TYPE[K] ? never : (null extends TYPE[K] ? never : (undefined extends TYPE[K] ? never : K)) })[keyof TYPE]
export type OptionalPropertiesOf<TYPE> = ({ [K in keyof TYPE]-?: null | undefined extends TYPE[K] ? K : (null extends TYPE[K] ? K : (undefined extends TYPE[K] ? K : never)) })[keyof TYPE]
export type FixSelectOneResult<T> = T extends undefined ? null : T

export type SelectPageWithExtras<RESULT, EXTRAS> = { data: { [P in keyof RESULT]: RESULT[P] }[], count: int } & Omit<EXTRAS, 'data' | 'count'>

type ForUseInQueryAs<DB extends AnyDB, COLUMNS> =
    COLUMNS extends undefined
    ? never
    : <ALIAS extends string>(as: ALIAS) => WithView<WITH_VIEW<DB, ALIAS>, COLUMNS>

type CompoundFunction<SUPPORTED_DB extends AnyDB, DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> = 
    DB extends SUPPORTED_DB
    ? <SELECT extends ICompoundableSelect<DB, RESULT, any>>(select: SELECT) => CompoundedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], ORDER_BY_KEYS>
    : never

type ValueOf<T> = T[keyof T]