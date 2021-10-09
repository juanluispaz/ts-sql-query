import type { IBooleanValueSource, IValueSource, INumberValueSource, IIntValueSource, IIfValueSource, IExecutableSelectQuery, RemapIValueSourceType } from "./values"
import type { ITableOrViewOf, NoTableOrViewRequired, NoTableOrViewRequiredView, OuterJoinSource, TableOrViewRef } from "../utils/ITableOrView"
import type { OuterJoinTableOrView, WithView, WITH_VIEW } from "../utils/tableOrViewUtils"
import type { AnyDB, TypeWhenSafeDB, TypeSafeDB, NoopDB, MariaDB, PostgreSql, Sqlite, Oracle, SqlServer } from "../databases"
import type { int } from "ts-extended-types"
import type { columnsType, database, requiredTableOrView, compoundable, tableOrViewRef, resultType, compoundableColumns, valueType } from "../utils/symbols"
import type { RawFragment } from "../utils/RawFragment"

export type OrderByMode = 'asc' | 'desc' | 'asc nulls first' | 'asc nulls last' | 'desc nulls first' | 'desc nulls last' | 'insensitive' |
                          'asc insensitive' | 'desc insensitive' | 'asc nulls first insensitive' | 'asc nulls last insensitive' | 
                          'desc nulls first insensitive' | 'desc nulls last insensitive'

export interface SelectCustomization<DB extends AnyDB> {
    afterSelectKeyword?: RawFragment<DB>
    beforeColumns?: RawFragment<DB>
    customWindow?: RawFragment<DB>
    afterQuery?: RawFragment<DB>
}

export interface SelectExpressionBase<DB extends AnyDB, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> {
    [database]: DB
    [requiredTableOrView]: REQUIRED_TABLE_OR_VIEW
}

export interface ICompoundableSelect<DB extends AnyDB, RESULT, COLUMNS, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends IExecutableSelectQuery<DB, RESULT, COLUMNS, REQUIRED_TABLE_OR_VIEW> {
    [compoundable]: { [P in keyof RESULT]-?: RESULT[P] }
    [compoundableColumns]: (input: { [P in RequiredKeys<COLUMNS>]: 'requiredColumn' } & { [P in OptionalKeys<COLUMNS>]: 'dynamicOptionalColumn' }) => { [P in RequiredKeys<COLUMNS>]: 'requiredColumn' } & { [P in OptionalKeys<COLUMNS>]: 'dynamicOptionalColumn' }
}

export interface ExecutableSelect<DB extends AnyDB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    [columnsType]: COLUMNS
    [resultType]: RESULT
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

    query(): string
    params(): any[]
}

export interface ExecutableSelectWithWhere<DB extends AnyDB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends ExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW> {
    compose<EXTERNAL_PROP extends keyof RESULT & ColumnGuard<COLUMNS>, INTERNAL_PROP extends string, RESULT_PROP extends string>(config: {
        externalProperty: EXTERNAL_PROP,
        internalProperty: INTERNAL_PROP,
        propertyName: RESULT_PROP
    }): ComposeExpression<EXTERNAL_PROP, INTERNAL_PROP, RESULT_PROP, DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    composeDeletingInternalProperty<EXTERNAL_PROP extends keyof RESULT & ColumnGuard<COLUMNS>, INTERNAL_PROP extends string, RESULT_PROP extends string>(config: {
        externalProperty: EXTERNAL_PROP,
        internalProperty: INTERNAL_PROP,
        propertyName: RESULT_PROP
    }): ComposeExpressionDeletingInternalProperty<EXTERNAL_PROP, INTERNAL_PROP, RESULT_PROP, DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    composeDeletingExternalProperty<EXTERNAL_PROP extends keyof RESULT & ColumnGuard<COLUMNS>, INTERNAL_PROP extends string, RESULT_PROP extends string>(config: {
        externalProperty: EXTERNAL_PROP,
        internalProperty: INTERNAL_PROP,
        propertyName: RESULT_PROP
    }): ComposeExpressionDeletingExternalProperty<EXTERNAL_PROP, INTERNAL_PROP, RESULT_PROP, DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>

    // Note: { [Q in keyof SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] } is used to define the internal object because { [P in keyof MAPPING]: RESULT[MAPPING[P]] } doesn't respect the optional typing of the props
    splitRequired<RESULT_PROP extends string, MAPPED_PROPS extends keyof RESULT & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ExecutableSelectWithWhere<DB, COLUMNS, Omit<RESULT, ValueOf<MAPPING>> & { [key in RESULT_PROP]: { [Q in keyof SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }}, REQUIRED_TABLE_OR_VIEW>
    splitOptional<RESULT_PROP extends string, MAPPED_PROPS extends keyof RESULT & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ExecutableSelectWithWhere<DB, COLUMNS, Omit<RESULT, ValueOf<MAPPING>> & { [key in RESULT_PROP]?: { [Q in keyof SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }}, REQUIRED_TABLE_OR_VIEW>
    split<RESULT_PROP extends string, MAPPED_PROPS extends keyof RESULT & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ExecutableSelectWithWhere<DB, COLUMNS, Omit<RESULT, ValueOf<MAPPING>> & ( {} extends SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }> ? { [key in RESULT_PROP]?: { [Q in keyof SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }} : { [key in RESULT_PROP]: { [Q in keyof SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }}), REQUIRED_TABLE_OR_VIEW>
  
    guidedSplitRequired<RESULT_PROP extends string, MAPPED_PROPS extends keyof GuidedObj<RESULT> & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ExecutableSelectWithWhere<DB, COLUMNS, Omit<RESULT, GuidedPropName<ValueOf<MAPPING>>> & { [key in RESULT_PROP]: { [Q in keyof SelectResult<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>]: SelectResult<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>[Q] }}, REQUIRED_TABLE_OR_VIEW>
    guidedSplitOptional<RESULT_PROP extends string, MAPPED_PROPS extends keyof GuidedObj<RESULT> & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ExecutableSelectWithWhere<DB, COLUMNS, Omit<RESULT, GuidedPropName<ValueOf<MAPPING>>> & { [key in RESULT_PROP]?: { [Q in keyof SelectResult<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>]: SelectResult<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>[Q] }}, REQUIRED_TABLE_OR_VIEW>
}

export interface ComposeExpression<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, DB extends AnyDB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> {
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ExecutableSelectWithWhere<DB, COLUMNS, RESULT & { [key in RESULT_PROP]?: INTERNAL }, REQUIRED_TABLE_OR_VIEW>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ExecutableSelectWithWhere<DB, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL } : { [key in RESULT_PROP]?: INTERNAL }), REQUIRED_TABLE_OR_VIEW>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ExecutableSelectWithWhere<DB, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL[] } : { [key in RESULT_PROP]?: INTERNAL[] }), REQUIRED_TABLE_OR_VIEW>
}
export interface ComposeExpressionDeletingInternalProperty<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, DB extends AnyDB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> {
    // Note: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] } is used to delete the internal prop because Omit<INTERNAL, INTERNAL_PROP> is not expanded in the editor (when see the type)
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ExecutableSelectWithWhere<DB, COLUMNS, RESULT & { [key in RESULT_PROP]?: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }}, REQUIRED_TABLE_OR_VIEW>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ExecutableSelectWithWhere<DB, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }} : { [key in RESULT_PROP]?: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }} ), REQUIRED_TABLE_OR_VIEW>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ExecutableSelectWithWhere<DB, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: Array<{ [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }> } : { [key in RESULT_PROP]?: Array<{ [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }> }), REQUIRED_TABLE_OR_VIEW>
}

export interface ComposeExpressionDeletingExternalProperty<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, DB extends AnyDB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> {
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ExecutableSelectWithWhere<DB, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & { [key in RESULT_PROP]?: INTERNAL }, REQUIRED_TABLE_OR_VIEW>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ExecutableSelectWithWhere<DB, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL } : { [key in RESULT_PROP]?: INTERNAL }), REQUIRED_TABLE_OR_VIEW>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): ExecutableSelectWithWhere<DB, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL[] } : { [key in RESULT_PROP]?: INTERNAL[] }), REQUIRED_TABLE_OR_VIEW>
}

export interface ExecutableSelectWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends ExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW> {
    compose<EXTERNAL_PROP extends keyof RESULT & ColumnGuard<COLUMNS>, INTERNAL_PROP extends string, RESULT_PROP extends string>(config: {
        externalProperty: EXTERNAL_PROP,
        internalProperty: INTERNAL_PROP,
        propertyName: RESULT_PROP
    }): ComposeExpressionWithoutWhere<EXTERNAL_PROP, INTERNAL_PROP, RESULT_PROP, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    composeDeletingInternalProperty<EXTERNAL_PROP extends keyof RESULT & ColumnGuard<COLUMNS>, INTERNAL_PROP extends string, RESULT_PROP extends string>(config: {
        externalProperty: EXTERNAL_PROP,
        internalProperty: INTERNAL_PROP,
        propertyName: RESULT_PROP
    }): ComposeExpressionDeletingInternalPropertyWithoutWhere<EXTERNAL_PROP, INTERNAL_PROP, RESULT_PROP, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    composeDeletingExternalProperty<EXTERNAL_PROP extends keyof RESULT & ColumnGuard<COLUMNS>, INTERNAL_PROP extends string, RESULT_PROP extends string>(config: {
        externalProperty: EXTERNAL_PROP,
        internalProperty: INTERNAL_PROP,
        propertyName: RESULT_PROP
    }): ComposeExpressionDeletingExternalPropertyWithoutWhere<EXTERNAL_PROP, INTERNAL_PROP, RESULT_PROP, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>

    // Note: { [Q in keyof SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] } is used to define the internal object because { [P in keyof MAPPING]: RESULT[MAPPING[P]] } doesn't respect the optional typing of the props
    splitRequired<RESULT_PROP extends string, MAPPED_PROPS extends keyof RESULT & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, Omit<RESULT, ValueOf<MAPPING>> & { [key in RESULT_PROP]: { [Q in keyof SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }}, REQUIRED_TABLE_OR_VIEW>
    splitOptional<RESULT_PROP extends string, MAPPED_PROPS extends keyof RESULT & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, Omit<RESULT, ValueOf<MAPPING>> & { [key in RESULT_PROP]?: { [Q in keyof SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }}, REQUIRED_TABLE_OR_VIEW>
    split<RESULT_PROP extends string, MAPPED_PROPS extends keyof RESULT & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, Omit<RESULT, ValueOf<MAPPING>> & ( {} extends SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }> ? { [key in RESULT_PROP]?: { [Q in keyof SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }} : { [key in RESULT_PROP]: { [Q in keyof SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: SelectResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }}), REQUIRED_TABLE_OR_VIEW>
  
    guidedSplitRequired<RESULT_PROP extends string, MAPPED_PROPS extends keyof GuidedObj<RESULT> & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, Omit<RESULT, GuidedPropName<ValueOf<MAPPING>>> & { [key in RESULT_PROP]: { [Q in keyof SelectResult<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>]: SelectResult<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>[Q] }}, REQUIRED_TABLE_OR_VIEW>
    guidedSplitOptional<RESULT_PROP extends string, MAPPED_PROPS extends keyof GuidedObj<RESULT> & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, Omit<RESULT, GuidedPropName<ValueOf<MAPPING>>> & { [key in RESULT_PROP]?: { [Q in keyof SelectResult<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>]: SelectResult<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>[Q] }}, REQUIRED_TABLE_OR_VIEW>
}

export interface SplitedComposedExecutableSelectWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends ExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW> {
    dynamicWhere(): SplitedComposedDynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    where(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): SplitedComposedDynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    where(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): SplitedComposedDynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
}

export interface SplitedComposedDynamicWhereExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends ExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): SplitedComposedDynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): SplitedComposedDynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): SplitedComposedDynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): SplitedComposedDynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
}

export interface ComposeExpressionWithoutWhere<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> {
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT & { [key in RESULT_PROP]?: INTERNAL }, REQUIRED_TABLE_OR_VIEW>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL } : { [key in RESULT_PROP]?: INTERNAL }), REQUIRED_TABLE_OR_VIEW>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL[] } : { [key in RESULT_PROP]?: INTERNAL[] }), REQUIRED_TABLE_OR_VIEW>
}
export interface ComposeExpressionDeletingInternalPropertyWithoutWhere<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> {
    // Note: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] } is used to delete the internal prop because Omit<INTERNAL, INTERNAL_PROP> is not expanded in the editor (when see the type)
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT & { [key in RESULT_PROP]?: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }}, REQUIRED_TABLE_OR_VIEW>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }} : { [key in RESULT_PROP]?: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }} ), REQUIRED_TABLE_OR_VIEW>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: Array<{ [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }> } : { [key in RESULT_PROP]?: Array<{ [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }> }), REQUIRED_TABLE_OR_VIEW>
}

export interface ComposeExpressionDeletingExternalPropertyWithoutWhere<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> {
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & { [key in RESULT_PROP]?: INTERNAL }, REQUIRED_TABLE_OR_VIEW>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL } : { [key in RESULT_PROP]?: INTERNAL }), REQUIRED_TABLE_OR_VIEW>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<RESULT[EXTERNAL_PROP]>) => Promise<INTERNAL[]>): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & ( EXTERNAL_PROP extends RequiredKeys<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL[] } : { [key in RESULT_PROP]?: INTERNAL[] }), REQUIRED_TABLE_OR_VIEW>
}

export interface WithableExecutableSelect<DB extends AnyDB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends ExecutableSelectWithWhere<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>, IExecutableSelectQuery<DB, RESULT, COLUMNS, REQUIRED_TABLE_OR_VIEW>, ICompoundableSelect<DB, RESULT, COLUMNS, REQUIRED_TABLE_OR_VIEW> {
    forUseInQueryAs: ForUseInQueryAs<DB, COLUMNS>
}

export interface WithableExecutableSelectWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends ExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>, IExecutableSelectQuery<DB, RESULT, COLUMNS, REQUIRED_TABLE_OR_VIEW>, ICompoundableSelect<DB, RESULT, COLUMNS, REQUIRED_TABLE_OR_VIEW> {
    forUseInQueryAs: ForUseInQueryAs<DB, COLUMNS>
}

export interface CompoundedCustomizableExecutableSelect<DB extends AnyDB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends WithableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW> {
    customizeQuery(customization: { afterQuery?: RawFragment<DB> }): WithableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
}

export interface CompoundedOffsetExecutableSelectExpression<DB extends AnyDB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends CompoundedCustomizableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW> {
    offset(offset: int): CompoundedCustomizableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    offset(offset: number): CompoundedCustomizableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    offset(offset: TypeWhenSafeDB<DB, IIntValueSource<NoTableOrViewRequired<DB>, int | null | undefined>, INumberValueSource<NoTableOrViewRequired<DB>, number | null | undefined>>): CompoundedCustomizableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
}

export interface CompoundedOrderByExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends CompoundedCustomizableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW> {
    orderBy(column: ORDER_BY_KEYS, mode?: OrderByMode): CompoundedOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    orderByFromString(orderBy: string): CompoundedOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>

    limit(limit: int): CompoundedOffsetExecutableSelectExpression<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    limit(limit: number): CompoundedOffsetExecutableSelectExpression<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    limit(limit: TypeWhenSafeDB<DB, IIntValueSource<NoTableOrViewRequired<DB>, int | null | undefined>, INumberValueSource<NoTableOrViewRequired<DB>, number | null | undefined>>): CompoundedOffsetExecutableSelectExpression<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
}

export interface CompoundableExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends WithableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW> {
    union<SELECT extends ICompoundableSelect<DB, RESULT, ColumnsForCompound<any, COLUMNS>, any>>(select: SELECT): CompoundedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], ORDER_BY_KEYS>
    unionAll<SELECT extends ICompoundableSelect<DB, RESULT, ColumnsForCompound<any, COLUMNS>, any>>(select: SELECT): CompoundedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], ORDER_BY_KEYS>
    intersect: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    intersectAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    except: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    exceptAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    minus: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    minusAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>

    recursiveUnion<SELECT extends ICompoundableSelect<DB, RESULT, ColumnsForCompound<any, COLUMNS>, any>>(fn: (view: WithView<WITH_VIEW<DB, 'recursive'>, COLUMNS>) => SELECT): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], ORDER_BY_KEYS>
    recursiveUnionAll<SELECT extends ICompoundableSelect<DB, RESULT, ColumnsForCompound<any, COLUMNS>, any>>(fn: (view: WithView<WITH_VIEW<DB, 'recursive'>, COLUMNS>) => SELECT): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], ORDER_BY_KEYS>
    recursiveUnionOn(fn: (view: WithView<WITH_VIEW<DB, 'recursive'>, COLUMNS>) => IBooleanValueSource<WITH_VIEW<DB, 'recursive'> | TABLE_OR_VIEW[typeof tableOrViewRef], boolean | null | undefined>): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    recursiveUnionAllOn(fn: (view: WithView<WITH_VIEW<DB, 'recursive'>, COLUMNS>) => IBooleanValueSource<WITH_VIEW<DB, 'recursive'> | TABLE_OR_VIEW[typeof tableOrViewRef], boolean | null | undefined>): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface CompoundableExecutableSelectExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends WithableExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW> {
    union<SELECT extends ICompoundableSelect<DB, RESULT, ColumnsForCompound<any, COLUMNS>, any>>(select: SELECT): CompoundedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], ORDER_BY_KEYS>
    unionAll<SELECT extends ICompoundableSelect<DB, RESULT, ColumnsForCompound<any, COLUMNS>, any>>(select: SELECT): CompoundedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], ORDER_BY_KEYS>
    intersect: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    intersectAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    except: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    exceptAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    minus: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    minusAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>

    recursiveUnion<SELECT extends ICompoundableSelect<DB, RESULT, ColumnsForCompound<any, COLUMNS>, any>>(fn: (view: WithView<WITH_VIEW<DB, 'recursive'>, COLUMNS>) => SELECT): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], ORDER_BY_KEYS>
    recursiveUnionAll<SELECT extends ICompoundableSelect<DB, RESULT, ColumnsForCompound<any, COLUMNS>, any>>(fn: (view: WithView<WITH_VIEW<DB, 'recursive'>, COLUMNS>) => SELECT): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], ORDER_BY_KEYS>
    recursiveUnionOn(fn: (view: WithView<WITH_VIEW<DB, 'recursive'>, COLUMNS>) => IBooleanValueSource<WITH_VIEW<DB, 'recursive'> | TABLE_OR_VIEW[typeof tableOrViewRef], boolean | null | undefined>): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    recursiveUnionAllOn(fn: (view: WithView<WITH_VIEW<DB, 'recursive'>, COLUMNS>) => IBooleanValueSource<WITH_VIEW<DB, 'recursive'> | TABLE_OR_VIEW[typeof tableOrViewRef], boolean | null | undefined>): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface WhereableCompoundableExecutableSelectExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends CompoundableExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    dynamicWhere(): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    where(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    where(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends WithableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface CompoundableCustomizableExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends CompoundableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    customizeQuery(customization: SelectCustomization<DB>): CompoundableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface CompoundableCustomizableExecutableSelectExpressionWitoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends CompoundableExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    customizeQuery(customization: SelectCustomization<DB>): WhereableCompoundableExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface OffsetExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>,  COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends CompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    offset(offset: int): CompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    offset(offset: number): CompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    offset(offset: TypeWhenSafeDB<DB, IIntValueSource<NoTableOrViewRequired<DB>, int | null | undefined>, INumberValueSource<NoTableOrViewRequired<DB>, number | null | undefined>>): CompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface OrderByExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends CompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    orderBy(column: ORDER_BY_KEYS, mode?: OrderByMode): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    orderByFromString(orderBy: string): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>

    limit(limit: int): OffsetExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    limit(limit: number): OffsetExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    limit(limit: TypeWhenSafeDB<DB, IIntValueSource<NoTableOrViewRequired<DB>, int | null | undefined>, INumberValueSource<NoTableOrViewRequired<DB>, number | null | undefined>>): OffsetExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface CompoundedExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends CompoundedOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    union<SELECT extends ICompoundableSelect<DB, RESULT, ColumnsForCompound<any, COLUMNS>, any>>(select: SELECT): CompoundedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], ORDER_BY_KEYS>
    unionAll<SELECT extends ICompoundableSelect<DB, RESULT, ColumnsForCompound<any, COLUMNS>, any>>(select: SELECT): CompoundedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], ORDER_BY_KEYS>
    intersect: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    intersectAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    except: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    exceptAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    minus: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    minusAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface OrderByExecutableSelectExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends CompoundableCustomizableExecutableSelectExpressionWitoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    orderBy(column: ORDER_BY_KEYS, mode?: OrderByMode): OrderedExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    orderByFromString(orderBy: string): OrderedExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>

    limit(limit: int): OffsetExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    limit(limit: number): OffsetExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    limit(limit: TypeWhenSafeDB<DB, IIntValueSource<NoTableOrViewRequired<DB>, int | null | undefined>, INumberValueSource<NoTableOrViewRequired<DB>, number | null | undefined>>): OffsetExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface OrderedExecutableSelectExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends CompoundableCustomizableExecutableSelectExpressionWitoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    orderBy(column: ORDER_BY_KEYS, mode?: OrderByMode): OrderedExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    orderByFromString(orderBy: string): OrderedExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>

    limit(limit: int): OffsetExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    limit(limit: number): OffsetExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    limit(limit: TypeWhenSafeDB<DB, IIntValueSource<NoTableOrViewRequired<DB>, int | null | undefined>, INumberValueSource<NoTableOrViewRequired<DB>, number | null | undefined>>): OffsetExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>

    dynamicWhere(): DynamicWhereOffsetExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    where(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereOffsetExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    where(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereOffsetExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface OffsetExecutableSelectExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>,  COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends CompoundableCustomizableExecutableSelectExpressionWitoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    offset(offset: int): CompoundableCustomizableExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    offset(offset: number): CompoundableCustomizableExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    offset(offset: TypeWhenSafeDB<DB, IIntValueSource<NoTableOrViewRequired<DB>, int | null | undefined>, INumberValueSource<NoTableOrViewRequired<DB>, number | null | undefined>>): CompoundableCustomizableExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>

    dynamicWhere(): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    where(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    where(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface CompoundableCustomizableExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>,  COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends CompoundableCustomizableExecutableSelectExpressionWitoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    dynamicWhere(): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    where(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    where(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface DynamicWhereOffsetExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>,  COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends CompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereOffsetExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereOffsetExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereOffsetExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereOffsetExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>

    limit(limit: int): OffsetExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    limit(limit: number): OffsetExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    limit(limit: TypeWhenSafeDB<DB, IIntValueSource<NoTableOrViewRequired<DB>, int | null | undefined>, INumberValueSource<NoTableOrViewRequired<DB>, number | null | undefined>>): OffsetExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>,  COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends CompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface GroupByOrderByExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    groupBy(...columns: RequiredKeys<COLUMNS>[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    groupBy(...columns: IValueSource<TABLE_OR_VIEW[typeof tableOrViewRef], any>[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface GroupByOrderByHavingExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    groupBy(...columns: RequiredKeys<COLUMNS>[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    groupBy(...columns: IValueSource<TABLE_OR_VIEW[typeof tableOrViewRef], any>[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>

    dynamicHaving(): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    having(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    having(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface DynamicHavingExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface GroupByOrderHavingByExpressionWithoutSelect<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    groupBy(...columns: IValueSource<TABLE_OR_VIEW[typeof tableOrViewRef], any>[]): GroupByOrderHavingByExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    dynamicHaving(): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    having(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    having(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    dynamicWhere(): DynamicWhereSelectExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    where(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereSelectExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    where(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereSelectExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    select<COLUMNS extends SelectColumns<DB, TABLE_OR_VIEW>>(columns: COLUMNS): WhereableExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMNS, SelectResult<ResultValues<COLUMNS>>, REQUIRED_TABLE_OR_VIEW, keyof COLUMNS>
    selectOneColumn<COLUMN extends IValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>>(column: COLUMN): WhereableExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMN, FixSelectOneResult<COLUMN[typeof valueType]>, REQUIRED_TABLE_OR_VIEW, 'result'>
}

export interface DynamicHavingExpressionWithoutSelect<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    dynamicWhere(): DynamicWhereSelectExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    where(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereSelectExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    where(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereSelectExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    select<COLUMNS extends SelectColumns<DB, TABLE_OR_VIEW>>(columns: COLUMNS): WhereableExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMNS, SelectResult<ResultValues<COLUMNS>>, REQUIRED_TABLE_OR_VIEW, keyof COLUMNS>
    selectOneColumn<COLUMN extends IValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>>(column: COLUMN): WhereableExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMN, FixSelectOneResult<COLUMN[typeof valueType]>, REQUIRED_TABLE_OR_VIEW, 'result'>
}

export interface DynamicWhereSelectExpressionWithoutSelect<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereSelectExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereSelectExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereSelectExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereSelectExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    select<COLUMNS extends SelectColumns<DB, TABLE_OR_VIEW>>(columns: COLUMNS): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, SelectResult<ResultValues<COLUMNS>>, REQUIRED_TABLE_OR_VIEW, keyof COLUMNS>
    selectOneColumn<COLUMN extends IValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>>(column: COLUMN): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMN, FixSelectOneResult<COLUMN[typeof valueType]>, REQUIRED_TABLE_OR_VIEW, 'result'>
}

export interface DynamicWhereExpressionWithoutSelect<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    groupBy(...columns: IValueSource<TABLE_OR_VIEW[typeof tableOrViewRef], any>[]): GroupByOrderHavingByExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>

    select<COLUMNS extends SelectColumns<DB, TABLE_OR_VIEW>>(columns: COLUMNS): GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, SelectResult<ResultValues<COLUMNS>>, REQUIRED_TABLE_OR_VIEW, keyof COLUMNS>
    selectOneColumn<COLUMN extends IValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>>(column: COLUMN): GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMN, FixSelectOneResult<COLUMN[typeof valueType]>, REQUIRED_TABLE_OR_VIEW, 'result'>
}

export interface DynamicWhereExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface WhereableExecutableSelectExpressionWithGroupBy<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends OrderByExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    dynamicWhere(): DynamicWhereExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    where(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    where(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface DynamicWhereExecutableSelectExpressionWithGroupBy<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface GroupByOrderByHavingExecutableSelectExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends WhereableExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    groupBy(...columns: RequiredKeys<COLUMNS>[]): GroupByOrderByHavingExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    groupBy(...columns: IValueSource<TABLE_OR_VIEW[typeof tableOrViewRef], any>[]): GroupByOrderByHavingExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>

    dynamicHaving(): DynamicHavingExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    having(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    having(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface DynamicHavingExecutableSelectExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends WhereableExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicHavingExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface ExecutableSelectExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> extends OrderByExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS> {
    groupBy(...columns: RequiredKeys<COLUMNS>[]): GroupByOrderByHavingExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    groupBy(...columns: IValueSource<TABLE_OR_VIEW[typeof tableOrViewRef], any>[]): GroupByOrderByHavingExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    
    dynamicWhere(): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    where(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
    where(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, ORDER_BY_KEYS>
}

export interface SelectWhereExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    select<COLUMNS extends SelectColumns<DB, TABLE_OR_VIEW>>(columns: COLUMNS): ExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, SelectResult<ResultValues<COLUMNS>>, REQUIRED_TABLE_OR_VIEW, keyof COLUMNS>
    selectOneColumn<COLUMN extends IValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>>(column: COLUMN): ExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMN, FixSelectOneResult<COLUMN[typeof valueType]>, REQUIRED_TABLE_OR_VIEW, 'result'>
    dynamicWhere(): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    where(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    where(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, boolean | null | undefined>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
    groupBy(...columns: IValueSource<TABLE_OR_VIEW[typeof tableOrViewRef], any>[]): GroupByOrderHavingByExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW>
}

export interface SelectWhereJoinExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends SelectWhereExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW> {
    join<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>>(table: TABLE_OR_VIEW2): OnExpression<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW>
    innerJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>>(table: TABLE_OR_VIEW2): OnExpression<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW>
    leftJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>): OnExpression<DB, TABLE_OR_VIEW | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>, REQUIRED_TABLE_OR_VIEW>
    leftOuterJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>): OnExpression<DB, TABLE_OR_VIEW | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>, REQUIRED_TABLE_OR_VIEW>
    optionalJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>>(table: TABLE_OR_VIEW2): OnExpression<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW>
    optionalInnerJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>>(table: TABLE_OR_VIEW2): OnExpression<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW>
    optionalLeftJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>): OnExpression<DB, TABLE_OR_VIEW | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>, REQUIRED_TABLE_OR_VIEW>
    optionalLeftOuterJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>): OnExpression<DB, TABLE_OR_VIEW | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>, REQUIRED_TABLE_OR_VIEW>
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

export interface SelectExpressionFromNoTable<DB extends AnyDB> extends SelectWhereExpression<AnyDB, NoTableOrViewRequiredView<DB>, NoTableOrViewRequiredView<DB>> {
}

export type SelectColumns<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> = {
    [P: string]: IValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>
}

export type ResultValues<COLUMNS> = {
    [P in keyof COLUMNS]: ValueSourceResult<COLUMNS[P]>
}

type ValueSourceResult<T> = T extends IValueSource<any, infer R> ? R : never

export type SelectResult<RESULT> = 
    undefined extends string ? RESULT // tsc is working with strict mode disabled. There is no way to infer the optional properties. Keep as required is a better approximation.
    : { [P in MandatoryPropertiesOf<RESULT>]: RESULT[P] } & { [P in OptionalPropertiesOf<RESULT>]?: NonNullable<RESULT[P]> }

export type MandatoryPropertiesOf<TYPE> = ({ [K in keyof TYPE]-?: null | undefined extends TYPE[K] ? never : (null extends TYPE[K] ? never : (undefined extends TYPE[K] ? never : K)) })[keyof TYPE]
export type OptionalPropertiesOf<TYPE> = ({ [K in keyof TYPE]-?: null | undefined extends TYPE[K] ? K : (null extends TYPE[K] ? K : (undefined extends TYPE[K] ? K : never)) })[keyof TYPE]
export type FixSelectOneResult<T> = T extends undefined ? null : T

export type SelectPageWithExtras<RESULT, EXTRAS> = { data: { [P in keyof RESULT]: RESULT[P] }[], count: int } & Omit<EXTRAS, 'data' | 'count'>

type ForUseInQueryAs<DB extends AnyDB, COLUMNS> =
    COLUMNS extends undefined
    ? never
    : COLUMNS extends IValueSource<any, any>
    ? never
    : <ALIAS extends string>(as: ALIAS) => WithView<WITH_VIEW<DB, ALIAS>, COLUMNS>

type CompoundFunction<SUPPORTED_DB extends AnyDB, DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, ORDER_BY_KEYS> = 
    DB extends SUPPORTED_DB
    ? <SELECT extends ICompoundableSelect<DB, RESULT, ColumnsForCompound<any, COLUMNS>, any>>(select: SELECT) => CompoundedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], ORDER_BY_KEYS>
    : never

type ValueOf<T> = T[keyof T]

type RequiredKeys<T> = T extends IValueSource<any, any> ? never : { [K in keyof T]-?: {} extends Pick<T, K> ? never : K }[keyof T]
type OptionalKeys<T> = T extends IValueSource<any, any> ? never : { [K in keyof T]-?: {} extends Pick<T, K> ? K : never }[keyof T]

type GuidedObj<T> = T & { [K in keyof T as K extends string | number ? `${K}!` : never]-?: NonNullable<T[K]>} & { [K in keyof T as K extends string | number ? `${K}?` : never]?: T[K]}
type GuidedPropName<T> = T extends `${infer Q}!` ? Q : T extends `${infer Q}?` ? Q : T

type ColumnGuard<T> = T extends null | undefined ? never : T extends never ? never : T extends IValueSource<any, any> ? never : unknown

export type ColumnsForCompound<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, COLUMNS> = COLUMNS extends IValueSource<any, any> 
    ? RemapIValueSourceType<TABLE_OR_VIEW, COLUMNS> 
    :{ [K in keyof COLUMNS]-?: 
        COLUMNS[K] extends IValueSource<any, any>
        ? RemapIValueSourceType<TABLE_OR_VIEW, COLUMNS[K]>
        : never 
    }
