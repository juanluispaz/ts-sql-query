import type { IBooleanValueSource, INumberValueSource, IIntValueSource, IIfValueSource, IExecutableSelectQuery, AnyValueSource, ValueSourceOf, ValueSourceValueTypeForResult, RemapValueSourceType, RemapValueSourceTypeWithOptionalType, AggregatedArrayValueSource, IValueSource } from "./values"
import type { ITableOrViewOf, NoTableOrViewRequired, NoTableOrViewRequiredView, OuterJoinSource } from "../utils/ITableOrView"
import type { OuterJoinTableOrView, WithView, WITH_VIEW } from "../utils/tableOrViewUtils"
import type { AnyDB, TypeWhenSafeDB, TypeSafeDB, TypeUnsafeDB, NoopDB, MariaDB, PostgreSql, Sqlite, Oracle, SqlServer } from "../databases"
import type { int } from "ts-extended-types"
import type { columnsType, database, requiredTableOrView, tableOrViewRef, resultType, compoundableColumns, valueType, strictValueType, neverUsedSymbol } from "../utils/symbols"
import type { RawFragment } from "../utils/RawFragment"
import type { ColumnGuard, GuidedObj, GuidedPropName, RequiredKeysOfPickingColumns, ResultObjectValues, FixOptionalProperties, ValueOf, RequiredColumnNames, ColumnsForCompound, ResultObjectValuesProjectedAsNullable } from "../utils/resultUtils"
import { Column } from "../utils/Column"

export type OrderByMode = 'asc' | 'desc' | 'asc nulls first' | 'asc nulls last' | 'desc nulls first' | 'desc nulls last' | 'insensitive' |
                          'asc insensitive' | 'desc insensitive' | 'asc nulls first insensitive' | 'asc nulls last insensitive' | 
                          'desc nulls first insensitive' | 'desc nulls last insensitive'

export interface SelectCustomization<DB extends AnyDB> {
    afterSelectKeyword?: RawFragment<DB>
    beforeColumns?: RawFragment<DB>
    customWindow?: RawFragment<DB>
    beforeOrderByItems?: RawFragment<DB>
    afterOrderByItems?: RawFragment<DB>
    beforeQuery?: RawFragment<DB>
    afterQuery?: RawFragment<DB>
    beforeWithQuery?: RawFragment<DB>
    afterWithQuery?: RawFragment<DB>
}

export interface SelectExpressionBase<DB extends AnyDB, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> {
    [database]: DB
    [requiredTableOrView]: REQUIRED_TABLE_OR_VIEW
}

export interface ICompoundableSelect<DB extends AnyDB, RESULT, COLUMNS, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends IExecutableSelectQuery<DB, RESULT, COLUMNS, REQUIRED_TABLE_OR_VIEW> {
    [compoundableColumns]: (input: ColumnsForCompound<any, COLUMNS>) => ColumnsForCompound<any, COLUMNS>
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
    executeSelectNoneOrOne(this: SelectExpressionBase<DB, NoTableOrViewRequiredView<DB>>): Promise<( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] }) | null>
    executeSelectOne(this: SelectExpressionBase<DB, NoTableOrViewRequiredView<DB>>): Promise<( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] })>
    executeSelectMany(this: SelectExpressionBase<DB, NoTableOrViewRequiredView<DB>>): Promise<( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] })[]>

    executeSelectPage(this: SelectExpressionBase<TypeSafeDB, NoTableOrViewRequiredView<DB>>): Promise<{ data: ( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] })[], count: int }>
    executeSelectPage(this: SelectExpressionBase<DB, NoTableOrViewRequiredView<DB>>): Promise<{ data: ( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] })[], count: number }>
    executeSelectPage<EXTRAS extends {}>(this: SelectExpressionBase<TypeSafeDB, NoTableOrViewRequiredView<DB>>, extras: EXTRAS & { data?: ( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] })[], count?: int }): Promise<{ [Q in keyof SelectPageWithExtras<COLUMNS, RESULT, EXTRAS>]: SelectPageWithExtras<COLUMNS, RESULT, EXTRAS>[Q] }>
    executeSelectPage<EXTRAS extends {}>(this: SelectExpressionBase<DB, NoTableOrViewRequiredView<DB>>, extras: EXTRAS & { data?: ( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] })[], count?: number }): Promise<{ [Q in keyof SelectPageWithExtras<COLUMNS, RESULT, EXTRAS>]: SelectPageWithExtras<COLUMNS, RESULT, EXTRAS>[Q] }>

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

    // Note: { [Q in keyof SplitResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: SplitResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] } is used to define the internal object because { [P in keyof MAPPING]: RESULT[MAPPING[P]] } doesn't respect the optional typing of the props
    splitRequired<RESULT_PROP extends string, MAPPED_PROPS extends keyof RESULT & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ExecutableSelectWithWhere<DB, COLUMNS, Omit<RESULT, ValueOf<MAPPING>> & { [key in RESULT_PROP]: { [Q in keyof FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }}, REQUIRED_TABLE_OR_VIEW>
    splitOptional<RESULT_PROP extends string, MAPPED_PROPS extends keyof RESULT & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ExecutableSelectWithWhere<DB, COLUMNS, Omit<RESULT, ValueOf<MAPPING>> & { [key in RESULT_PROP]?: { [Q in keyof FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }}, REQUIRED_TABLE_OR_VIEW>
    split<RESULT_PROP extends string, MAPPED_PROPS extends keyof RESULT & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ExecutableSelectWithWhere<DB, COLUMNS, Omit<RESULT, ValueOf<MAPPING>> & ( {} extends FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }> ? { [key in RESULT_PROP]?: { [Q in keyof FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }} : { [key in RESULT_PROP]: { [Q in keyof FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }}), REQUIRED_TABLE_OR_VIEW>
  
    guidedSplitRequired<RESULT_PROP extends string, MAPPED_PROPS extends keyof GuidedObj<RESULT> & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ExecutableSelectWithWhere<DB, COLUMNS, Omit<RESULT, GuidedPropName<ValueOf<MAPPING>>> & { [key in RESULT_PROP]: { [Q in keyof FixOptionalProperties<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>]: FixOptionalProperties<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>[Q] }}, REQUIRED_TABLE_OR_VIEW>
    guidedSplitOptional<RESULT_PROP extends string, MAPPED_PROPS extends keyof GuidedObj<RESULT> & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): ExecutableSelectWithWhere<DB, COLUMNS, Omit<RESULT, GuidedPropName<ValueOf<MAPPING>>> & { [key in RESULT_PROP]?: { [Q in keyof FixOptionalProperties<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>]: FixOptionalProperties<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>[Q] }}, REQUIRED_TABLE_OR_VIEW>
}

export interface ComposeExpression<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, DB extends AnyDB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> {
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ExecutableSelectWithWhere<DB, COLUMNS, RESULT & { [key in RESULT_PROP]?: INTERNAL }, REQUIRED_TABLE_OR_VIEW>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ExecutableSelectWithWhere<DB, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeysOfPickingColumns<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL } : { [key in RESULT_PROP]?: INTERNAL }), REQUIRED_TABLE_OR_VIEW>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ExecutableSelectWithWhere<DB, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeysOfPickingColumns<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL[] } : { [key in RESULT_PROP]?: INTERNAL[] }), REQUIRED_TABLE_OR_VIEW>
    withOptionalMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ExecutableSelectWithWhere<DB, COLUMNS, RESULT & { [key in RESULT_PROP]?: INTERNAL[] }, REQUIRED_TABLE_OR_VIEW>
}
export interface ComposeExpressionDeletingInternalProperty<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, DB extends AnyDB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> {
    // Note: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] } is used to delete the internal prop because Omit<INTERNAL, INTERNAL_PROP> is not expanded in the editor (when see the type)
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ExecutableSelectWithWhere<DB, COLUMNS, RESULT & { [key in RESULT_PROP]?: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }}, REQUIRED_TABLE_OR_VIEW>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ExecutableSelectWithWhere<DB, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeysOfPickingColumns<COLUMNS> ? { [key in RESULT_PROP]: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }} : { [key in RESULT_PROP]?: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }} ), REQUIRED_TABLE_OR_VIEW>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ExecutableSelectWithWhere<DB, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeysOfPickingColumns<COLUMNS> ? { [key in RESULT_PROP]: Array<{ [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }> } : { [key in RESULT_PROP]?: Array<{ [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }> }), REQUIRED_TABLE_OR_VIEW>
    withOptionalMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ExecutableSelectWithWhere<DB, COLUMNS, RESULT & { [key in RESULT_PROP]?: Array<{ [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }> }, REQUIRED_TABLE_OR_VIEW>
}

export interface ComposeExpressionDeletingExternalProperty<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, DB extends AnyDB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> {
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ExecutableSelectWithWhere<DB, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & { [key in RESULT_PROP]?: INTERNAL }, REQUIRED_TABLE_OR_VIEW>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ExecutableSelectWithWhere<DB, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & ( EXTERNAL_PROP extends RequiredKeysOfPickingColumns<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL } : { [key in RESULT_PROP]?: INTERNAL }), REQUIRED_TABLE_OR_VIEW>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ExecutableSelectWithWhere<DB, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & ( EXTERNAL_PROP extends RequiredKeysOfPickingColumns<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL[] } : { [key in RESULT_PROP]?: INTERNAL[] }), REQUIRED_TABLE_OR_VIEW>
    withOptionalMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): ExecutableSelectWithWhere<DB, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & { [key in RESULT_PROP]?: INTERNAL[] }, REQUIRED_TABLE_OR_VIEW>
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

    // Note: { [Q in keyof SplitResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: SplitResult<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] } is used to define the internal object because { [P in keyof MAPPING]: RESULT[MAPPING[P]] } doesn't respect the optional typing of the props
    splitRequired<RESULT_PROP extends string, MAPPED_PROPS extends keyof RESULT & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, Omit<RESULT, ValueOf<MAPPING>> & { [key in RESULT_PROP]: { [Q in keyof FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }}, REQUIRED_TABLE_OR_VIEW>
    splitOptional<RESULT_PROP extends string, MAPPED_PROPS extends keyof RESULT & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, Omit<RESULT, ValueOf<MAPPING>> & { [key in RESULT_PROP]?: { [Q in keyof FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }}, REQUIRED_TABLE_OR_VIEW>
    split<RESULT_PROP extends string, MAPPED_PROPS extends keyof RESULT & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, Omit<RESULT, ValueOf<MAPPING>> & ( {} extends FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }> ? { [key in RESULT_PROP]?: { [Q in keyof FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }} : { [key in RESULT_PROP]: { [Q in keyof FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>]: FixOptionalProperties<{ [P in keyof MAPPING]: RESULT[MAPPING[P]] }>[Q] }}), REQUIRED_TABLE_OR_VIEW>
  
    guidedSplitRequired<RESULT_PROP extends string, MAPPED_PROPS extends keyof GuidedObj<RESULT> & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, Omit<RESULT, GuidedPropName<ValueOf<MAPPING>>> & { [key in RESULT_PROP]: { [Q in keyof FixOptionalProperties<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>]: FixOptionalProperties<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>[Q] }}, REQUIRED_TABLE_OR_VIEW>
    guidedSplitOptional<RESULT_PROP extends string, MAPPED_PROPS extends keyof GuidedObj<RESULT> & ColumnGuard<COLUMNS>, MAPPING extends { [P: string]: MAPPED_PROPS }>(propertyName: RESULT_PROP, mappig: MAPPING): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, Omit<RESULT, GuidedPropName<ValueOf<MAPPING>>> & { [key in RESULT_PROP]?: { [Q in keyof FixOptionalProperties<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>]: FixOptionalProperties<{ [P in keyof MAPPING]: GuidedObj<RESULT>[MAPPING[P]] }>[Q] }}, REQUIRED_TABLE_OR_VIEW>
}

export interface SplitedComposedExecutableSelectWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends ExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW> {
    dynamicWhere(): SplitedComposedDynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    where(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): SplitedComposedDynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    where(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): SplitedComposedDynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
}

export interface SplitedComposedDynamicWhereExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> extends ExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): SplitedComposedDynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): SplitedComposedDynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): SplitedComposedDynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): SplitedComposedDynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>
}

export interface ComposeExpressionWithoutWhere<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> {
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT & { [key in RESULT_PROP]?: INTERNAL }, REQUIRED_TABLE_OR_VIEW>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeysOfPickingColumns<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL } : { [key in RESULT_PROP]?: INTERNAL }), REQUIRED_TABLE_OR_VIEW>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeysOfPickingColumns<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL[] } : { [key in RESULT_PROP]?: INTERNAL[] }), REQUIRED_TABLE_OR_VIEW>
}
export interface ComposeExpressionDeletingInternalPropertyWithoutWhere<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> {
    // Note: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] } is used to delete the internal prop because Omit<INTERNAL, INTERNAL_PROP> is not expanded in the editor (when see the type)
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT & { [key in RESULT_PROP]?: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }}, REQUIRED_TABLE_OR_VIEW>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeysOfPickingColumns<COLUMNS> ? { [key in RESULT_PROP]: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }} : { [key in RESULT_PROP]?: { [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }} ), REQUIRED_TABLE_OR_VIEW>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT & ( EXTERNAL_PROP extends RequiredKeysOfPickingColumns<COLUMNS> ? { [key in RESULT_PROP]: Array<{ [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }> } : { [key in RESULT_PROP]?: Array<{ [P in keyof Omit<INTERNAL, INTERNAL_PROP>]: Omit<INTERNAL, INTERNAL_PROP>[P] }> }), REQUIRED_TABLE_OR_VIEW>
}

export interface ComposeExpressionDeletingExternalPropertyWithoutWhere<EXTERNAL_PROP extends keyof RESULT, INTERNAL_PROP extends string, RESULT_PROP extends string, DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> {
    withNoneOrOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & { [key in RESULT_PROP]?: INTERNAL }, REQUIRED_TABLE_OR_VIEW>
    withOne<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & ( EXTERNAL_PROP extends RequiredKeysOfPickingColumns<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL } : { [key in RESULT_PROP]?: INTERNAL }), REQUIRED_TABLE_OR_VIEW>
    withMany<INTERNAL extends {[key in INTERNAL_PROP]: RESULT[EXTERNAL_PROP]}>(fn: (ids: Array<NonNullable<RESULT[EXTERNAL_PROP]>>) => Promise<INTERNAL[]>): SplitedComposedExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, Omit<RESULT, EXTERNAL_PROP> & ( EXTERNAL_PROP extends RequiredKeysOfPickingColumns<COLUMNS> ? { [key in RESULT_PROP]: INTERNAL[] } : { [key in RESULT_PROP]?: INTERNAL[] }), REQUIRED_TABLE_OR_VIEW>
}

export interface WithableExecutableSelect<DB extends AnyDB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends ExecutableSelectWithWhere<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>, IExecutableSelectQuery<DB, RESULT, COLUMNS, REQUIRED_TABLE_OR_VIEW>, ICompoundableSelect<DB, RESULT, COLUMNS, REQUIRED_TABLE_OR_VIEW> {
    forUseInQueryAs: ForUseInQueryAs<DB, COLUMNS, REQUIRED_TABLE_OR_VIEW, FEATURES>
    forUseAsInlineQueryValue: ForUseAsInlineQueryValue<DB, COLUMNS, REQUIRED_TABLE_OR_VIEW, FEATURES>
    forUseAsInlineAggregatedArrayValue: ForUseAsInlineAggregatedArrayValue<DB, COLUMNS, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface WithableExecutableSelectWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends ExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW>, IExecutableSelectQuery<DB, RESULT, COLUMNS, REQUIRED_TABLE_OR_VIEW>, ICompoundableSelect<DB, RESULT, COLUMNS, REQUIRED_TABLE_OR_VIEW> {
    forUseInQueryAs: ForUseInQueryAs<DB, COLUMNS, REQUIRED_TABLE_OR_VIEW, FEATURES>
    forUseAsInlineQueryValue: ForUseAsInlineQueryValue<DB, COLUMNS, REQUIRED_TABLE_OR_VIEW, FEATURES>
    forUseAsInlineAggregatedArrayValue: ForUseAsInlineAggregatedArrayValue<DB, COLUMNS, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface CompoundedCustomizableExecutableSelect<DB extends AnyDB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends WithableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    customizeQuery(customization: { afterQuery?: RawFragment<DB> }): WithableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface CompoundedOffsetExecutableSelectExpression<DB extends AnyDB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends CompoundedCustomizableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    offset(offset: int): CompoundedCustomizableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    offset(offset: number): CompoundedCustomizableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    offset(offset: TypeWhenSafeDB<DB, IIntValueSource<NoTableOrViewRequired<DB>, 'required'>, INumberValueSource<NoTableOrViewRequired<DB>, 'required'>>): CompoundedCustomizableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    offsetIfValue(offset: int | null | undefined): CompoundedCustomizableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    offsetIfValue(offset: number | null | undefined): CompoundedCustomizableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface CompoundedLimitExecutableSelectExpression<DB extends AnyDB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends CompoundedCustomizableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    limit(limit: int): CompoundedOffsetExecutableSelectExpression<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    limit(limit: number): CompoundedOffsetExecutableSelectExpression<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    limit(limit: TypeWhenSafeDB<DB, IIntValueSource<NoTableOrViewRequired<DB>, 'required'>, INumberValueSource<NoTableOrViewRequired<DB>, 'required'>>): CompoundedOffsetExecutableSelectExpression<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    limitIfValue(limit: int | null | undefined): CompoundedOffsetExecutableSelectExpression<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    limitIfValue(limit: number | null | undefined): CompoundedOffsetExecutableSelectExpression<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface CompoundedOrderByExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends CompoundedLimitExecutableSelectExpression<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    orderBy(column: RequiredColumnNames<COLUMNS>, mode?: OrderByMode): CompoundedOrderedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    orderBy(column: ValueSourceOf<NoTableOrViewRequired<DB>>, mode?: OrderByMode): CompoundedOrderedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    orderBy(column: RawFragment<DB>, mode?: OrderByMode): CompoundedOrderedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    orderByFromString(orderBy: string): CompoundedOrderedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    orderByFromStringIfValue(orderBy: string | null | undefined): CompoundedOrderedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface CompoundedOrderedExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends CompoundedOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    orderingSiblingsOnly: OrderingSiblingsOnlyFnType<FEATURES, CompoundedLimitExecutableSelectExpression<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>>
}

export interface CompoundableExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends WithableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    union<SELECT extends ICompoundableSelect<DB, RESULT, ColumnsForCompound<any, COLUMNS>, any>>(select: SELECT): CompoundedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], FEATURES | 'compound'>
    unionAll<SELECT extends ICompoundableSelect<DB, RESULT, ColumnsForCompound<any, COLUMNS>, any>>(select: SELECT): CompoundedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], FEATURES | 'compound'>
    intersect: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'compound'>
    intersectAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'compound'>
    except: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'compound'>
    exceptAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'compound'>
    minus: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'compound'>
    minusAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'compound'>

    recursiveUnion<SELECT extends ICompoundableSelect<DB, RESULT, ColumnsForCompound<any, COLUMNS>, any>>(fn: (view: WithView<WITH_VIEW<DB, 'recursive'>, COLUMNS>) => SELECT): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], FEATURES | 'recursive'>
    recursiveUnionAll<SELECT extends ICompoundableSelect<DB, RESULT, ColumnsForCompound<any, COLUMNS>, any>>(fn: (view: WithView<WITH_VIEW<DB, 'recursive'>, COLUMNS>) => SELECT): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], FEATURES | 'recursive'>
    recursiveUnionOn(fn: (view: WithView<WITH_VIEW<DB, 'recursive'>, COLUMNS>) => IBooleanValueSource<WITH_VIEW<DB, 'recursive'> | TABLE_OR_VIEW[typeof tableOrViewRef], any>): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'recursive'>
    recursiveUnionAllOn(fn: (view: WithView<WITH_VIEW<DB, 'recursive'>, COLUMNS>) => IBooleanValueSource<WITH_VIEW<DB, 'recursive'> | TABLE_OR_VIEW[typeof tableOrViewRef], any>): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'recursive'>
}

export interface CompoundableExecutableSelectExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends WithableExecutableSelectWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    union<SELECT extends ICompoundableSelect<DB, RESULT, ColumnsForCompound<any, COLUMNS>, any>>(select: SELECT): CompoundedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], FEATURES | 'compound'>
    unionAll<SELECT extends ICompoundableSelect<DB, RESULT, ColumnsForCompound<any, COLUMNS>, any>>(select: SELECT): CompoundedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], FEATURES | 'compound'>
    intersect: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'compound'>
    intersectAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'compound'>
    except: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'compound'>
    exceptAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'compound'>
    minus: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'compound'>
    minusAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'compound'>

    recursiveUnion<SELECT extends ICompoundableSelect<DB, RESULT, ColumnsForCompound<any, COLUMNS>, any>>(fn: (view: WithView<WITH_VIEW<DB, 'recursive'>, COLUMNS>) => SELECT): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], FEATURES | 'recursive'>
    recursiveUnionAll<SELECT extends ICompoundableSelect<DB, RESULT, ColumnsForCompound<any, COLUMNS>, any>>(fn: (view: WithView<WITH_VIEW<DB, 'recursive'>, COLUMNS>) => SELECT): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], FEATURES | 'recursive'>
    recursiveUnionOn(fn: (view: WithView<WITH_VIEW<DB, 'recursive'>, COLUMNS>) => IBooleanValueSource<WITH_VIEW<DB, 'recursive'> | TABLE_OR_VIEW[typeof tableOrViewRef], any>): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'recursive'>
    recursiveUnionAllOn(fn: (view: WithView<WITH_VIEW<DB, 'recursive'>, COLUMNS>) => IBooleanValueSource<WITH_VIEW<DB, 'recursive'> | TABLE_OR_VIEW[typeof tableOrViewRef], any>): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'recursive'>
}

export interface WhereableCompoundableExecutableSelectExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends CompoundableExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    dynamicWhere(): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    where(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    where(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends WithableExecutableSelect<DB, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface CompoundableCustomizableExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends CompoundableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    customizeQuery(customization: SelectCustomization<DB>): CompoundableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface CompoundableCustomizableExecutableSelectExpressionWitoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends CompoundableExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    customizeQuery(customization: SelectCustomization<DB>): WhereableCompoundableExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface OffsetExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>,  COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends CompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    offset(offset: int): CompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    offset(offset: number): CompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    offset(offset: TypeWhenSafeDB<DB, IIntValueSource<NoTableOrViewRequired<DB>, 'required'>, INumberValueSource<NoTableOrViewRequired<DB>, 'required'>>): CompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    offsetIfValue(offset: int | null | undefined): CompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    offsetIfValue(offset: number | null | undefined): CompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}
export interface LimitExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends CompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    limit(limit: int): OffsetExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    limit(limit: number): OffsetExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    limit(limit: TypeWhenSafeDB<DB, IIntValueSource<NoTableOrViewRequired<DB>, 'required'>, INumberValueSource<NoTableOrViewRequired<DB>, 'required'>>): OffsetExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    limitIfValue(limit: int | null | undefined): OffsetExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    limitIfValue(limit: number | null | undefined): OffsetExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface OrderByExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends LimitExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    orderBy(column: RequiredColumnNames<COLUMNS>, mode?: OrderByMode): OrderedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    orderBy(column: ValueSourceOf<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>>, mode?: OrderByMode): OrderedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    orderBy(column: RawFragment<DB>, mode?: OrderByMode): OrderedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    orderByFromString(orderBy: string): OrderedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    orderByFromStringIfValue(orderBy: string | null | undefined): OrderedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface OrderByExecutableSelectExpressionProjectableAsNullable<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    projectingOptionalValuesAsNullable(): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, ResultObjectValuesProjectedAsNullable<COLUMNS>, REQUIRED_TABLE_OR_VIEW, FEATURES | 'projectingOptionalValuesAsNullable'>
}

export interface OrderedExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    orderingSiblingsOnly: OrderingSiblingsOnlyFnType<FEATURES, LimitExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>>
}

export interface CompoundedExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends CompoundedOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    union<SELECT extends ICompoundableSelect<DB, RESULT, ColumnsForCompound<any, COLUMNS>, any>>(select: SELECT): CompoundedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], FEATURES | 'compound'>
    unionAll<SELECT extends ICompoundableSelect<DB, RESULT, ColumnsForCompound<any, COLUMNS>, any>>(select: SELECT): CompoundedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], FEATURES | 'compound'>
    intersect: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'compound'>
    intersectAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'compound'>
    except: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'compound'>
    exceptAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'compound'>
    minus: CompoundFunction<NoopDB | MariaDB | PostgreSql | Sqlite | SqlServer | Oracle, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'compound'>
    minusAll: CompoundFunction<NoopDB | MariaDB | PostgreSql, DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'compound'>
}

export interface OrderableExecutableSelectExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends CompoundableCustomizableExecutableSelectExpressionWitoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    orderBy(column: RequiredColumnNames<COLUMNS>, mode?: OrderByMode): OrderedExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    orderBy(column: ValueSourceOf<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>>, mode?: OrderByMode): OrderedExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    orderBy(column: RawFragment<DB>, mode?: OrderByMode): OrderedExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    orderByFromString(orderBy: string): OrderedExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    orderByFromStringIfValue(orderBy: string | null | undefined): OrderedExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>

    limit(limit: int): OffsetExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    limit(limit: number): OffsetExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    limit(limit: TypeWhenSafeDB<DB, IIntValueSource<NoTableOrViewRequired<DB>, 'required'>, INumberValueSource<NoTableOrViewRequired<DB>, 'required'>>): OffsetExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    limitIfValue(limit: int | null | undefined): OffsetExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    limitIfValue(limit: number | null | undefined): OffsetExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface LimitExecutableSelectExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends CompoundableCustomizableExecutableSelectExpressionWitoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    dynamicWhere(): DynamicWhereLimitExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    where(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereLimitExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    where(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereLimitExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    
    limit(limit: int): OffsetExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    limit(limit: number): OffsetExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    limit(limit: TypeWhenSafeDB<DB, IIntValueSource<NoTableOrViewRequired<DB>, 'required'>, INumberValueSource<NoTableOrViewRequired<DB>, 'required'>>): OffsetExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    limitIfValue(limit: int | null | undefined): OffsetExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    limitIfValue(limit: number | null | undefined): OffsetExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface OrderByExecutableSelectExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends LimitExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    orderBy(column: RequiredColumnNames<COLUMNS>, mode?: OrderByMode): OrderedExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    orderBy(column: ValueSourceOf<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>>, mode?: OrderByMode): OrderedExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    orderBy(column: RawFragment<DB>, mode?: OrderByMode): OrderedExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    orderByFromString(orderBy: string): OrderedExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    orderByFromStringIfValue(orderBy: string | null | undefined): OrderedExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface OrderedExecutableSelectExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends OrderByExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    orderingSiblingsOnly: OrderingSiblingsOnlyFnType<FEATURES, LimitExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>>
}

export interface OffsetExecutableSelectExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>,  COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends CompoundableCustomizableExecutableSelectExpressionWitoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    offset(offset: int): CompoundableCustomizableExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    offset(offset: number): CompoundableCustomizableExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    offset(offset: TypeWhenSafeDB<DB, IIntValueSource<NoTableOrViewRequired<DB>, 'required'>, INumberValueSource<NoTableOrViewRequired<DB>, 'required'>>): CompoundableCustomizableExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    offsetIfValue(offset: int | null | undefined): CompoundableCustomizableExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    offsetIfValue(offset: number | null | undefined): CompoundableCustomizableExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>

    dynamicWhere(): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    where(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    where(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface CompoundableCustomizableExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>,  COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends CompoundableCustomizableExecutableSelectExpressionWitoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    dynamicWhere(): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    where(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    where(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface DynamicWhereLimitExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>,  COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends CompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereLimitExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereLimitExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereLimitExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereLimitExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>

    limit(limit: int): OffsetExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    limit(limit: number): OffsetExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    limit(limit: TypeWhenSafeDB<DB, IIntValueSource<NoTableOrViewRequired<DB>, 'required'>, INumberValueSource<NoTableOrViewRequired<DB>, 'required'>>): OffsetExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    limitIfValue(limit: int | null | undefined): OffsetExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    limitIfValue(limit: number | null | undefined): OffsetExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>,  COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends CompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface RecursivelyConnectedExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    groupBy(...columns: RequiredColumnNames<COLUMNS>[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'groupBy'>
    groupBy(...columns: ValueSourceOf<TABLE_OR_VIEW[typeof tableOrViewRef]>[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'groupBy'>
}

export interface GroupByOrderByExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends RecursivelyConnectedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    startWith: StartWithFnType<DB, TABLE_OR_VIEW, RecursivelyConnectedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'connectBy'>>
    connectBy: ConnectByFnType<DB, TABLE_OR_VIEW, RecursivelyConnectedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'connectBy'>>
    connectByNoCycle: ConnectByFnType<DB, TABLE_OR_VIEW, RecursivelyConnectedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'connectBy'>>
}

export interface GroupByOrderByExecutableSelectExpressionProjectableAsNullable<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    projectingOptionalValuesAsNullable(): GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, ResultObjectValuesProjectedAsNullable<COLUMNS>, REQUIRED_TABLE_OR_VIEW, FEATURES | 'projectingOptionalValuesAsNullable'>
}

export interface GroupByOrderByHavingExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    groupBy(...columns: RequiredColumnNames<COLUMNS>[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'groupBy'>
    groupBy(...columns: ValueSourceOf<TABLE_OR_VIEW[typeof tableOrViewRef]>[]): GroupByOrderByHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'groupBy'>

    dynamicHaving(): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    having(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    having(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface DynamicHavingExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicHavingExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface GroupByOrderHavingByExpressionWithoutSelect<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    groupBy(...columns: ValueSourceOf<TABLE_OR_VIEW[typeof tableOrViewRef]>[]): GroupByOrderHavingByExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES | 'groupBy'>

    dynamicHaving(): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
    having(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
    having(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>

    dynamicWhere(): DynamicWhereSelectExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
    where(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereSelectExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
    where(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereSelectExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>

    select<COLUMNS extends SelectColumns<DB, TABLE_OR_VIEW>>(columns: COLUMNS): WhereableExecutableSelectExpressionWithGroupByProjectableAsNullable<DB, TABLE_OR_VIEW, COLUMNS, ResultObjectValues<COLUMNS>, REQUIRED_TABLE_OR_VIEW, FEATURES>
    selectOneColumn<COLUMN extends ValueSourceOf<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>>>(column: COLUMN): WhereableExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMN, ValueSourceValueTypeForResult<COLUMN>, REQUIRED_TABLE_OR_VIEW, FEATURES>
    selectCountAll(this: SelectExpressionBase<TypeSafeDB, any>): WhereableExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, IIntValueSource<NoTableOrViewRequired<DB>, 'required'>, int, REQUIRED_TABLE_OR_VIEW, FEATURES | 'requiredResult'>
    selectCountAll(this: SelectExpressionBase<TypeUnsafeDB, any>): WhereableExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, INumberValueSource<NoTableOrViewRequired<DB>, 'required'>, number, REQUIRED_TABLE_OR_VIEW, FEATURES| 'requiredResult'>
}

export interface DynamicHavingExpressionWithoutSelect<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicHavingExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>

    dynamicWhere(): DynamicWhereSelectExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
    where(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereSelectExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
    where(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereSelectExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>

    select<COLUMNS extends SelectColumns<DB, TABLE_OR_VIEW>>(columns: COLUMNS): WhereableExecutableSelectExpressionWithGroupByProjectableAsNullable<DB, TABLE_OR_VIEW, COLUMNS, ResultObjectValues<COLUMNS>, REQUIRED_TABLE_OR_VIEW, FEATURES>
    selectOneColumn<COLUMN extends ValueSourceOf<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>>>(column: COLUMN): WhereableExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMN, ValueSourceValueTypeForResult<COLUMN>, REQUIRED_TABLE_OR_VIEW, FEATURES>
    selectCountAll(this: SelectExpressionBase<TypeSafeDB, any>): WhereableExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, IIntValueSource<NoTableOrViewRequired<DB>, 'required'>, int, REQUIRED_TABLE_OR_VIEW, FEATURES | 'requiredResult'>
    selectCountAll(this: SelectExpressionBase<TypeUnsafeDB, any>): WhereableExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, INumberValueSource<NoTableOrViewRequired<DB>, 'required'>, number, REQUIRED_TABLE_OR_VIEW, FEATURES| 'requiredResult'>
}

export interface DynamicWhereSelectExpressionWithoutSelect<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereSelectExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereSelectExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereSelectExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereSelectExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>

    select<COLUMNS extends SelectColumns<DB, TABLE_OR_VIEW>>(columns: COLUMNS): OrderByExecutableSelectExpressionProjectableAsNullable<DB, TABLE_OR_VIEW, COLUMNS, ResultObjectValues<COLUMNS>, REQUIRED_TABLE_OR_VIEW, FEATURES>
    selectOneColumn<COLUMN extends ValueSourceOf<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>>>(column: COLUMN): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMN, ValueSourceValueTypeForResult<COLUMN>, REQUIRED_TABLE_OR_VIEW, FEATURES>
    selectCountAll(this: SelectExpressionBase<TypeSafeDB, any>): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, IIntValueSource<NoTableOrViewRequired<DB>, 'required'>, int, REQUIRED_TABLE_OR_VIEW, FEATURES | 'requiredResult'>
    selectCountAll(this: SelectExpressionBase<TypeUnsafeDB, any>): OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, INumberValueSource<NoTableOrViewRequired<DB>, 'required'>, number, REQUIRED_TABLE_OR_VIEW, FEATURES| 'requiredResult'>
}

export interface RecursivelyConnectedExpressionWithoutSelect<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    groupBy(...columns: ValueSourceOf<TABLE_OR_VIEW[typeof tableOrViewRef]>[]): GroupByOrderHavingByExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES | 'groupBy'>

    select<COLUMNS extends SelectColumns<DB, TABLE_OR_VIEW>>(columns: COLUMNS): GroupByOrderByExecutableSelectExpressionProjectableAsNullable<DB, TABLE_OR_VIEW, COLUMNS, ResultObjectValues<COLUMNS>, REQUIRED_TABLE_OR_VIEW, FEATURES>
    selectOneColumn<COLUMN extends ValueSourceOf<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>>>(column: COLUMN): GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMN, ValueSourceValueTypeForResult<COLUMN>, REQUIRED_TABLE_OR_VIEW, FEATURES>
    selectCountAll(this: SelectExpressionBase<TypeSafeDB, any>): GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, IIntValueSource<NoTableOrViewRequired<DB>, 'required'>, int, REQUIRED_TABLE_OR_VIEW, FEATURES | 'requiredResult'>
    selectCountAll(this: SelectExpressionBase<TypeUnsafeDB, any>): GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, INumberValueSource<NoTableOrViewRequired<DB>, 'required'>, number, REQUIRED_TABLE_OR_VIEW, FEATURES| 'requiredResult'>
}

export interface DynamicWhereExpressionWithoutSelect<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends RecursivelyConnectedExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>

    startWith: StartWithFnType<DB, TABLE_OR_VIEW, RecursivelyConnectedExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES | 'connectBy'>>
    connectBy: ConnectByFnType<DB, TABLE_OR_VIEW, RecursivelyConnectedExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES | 'connectBy'>>
    connectByNoCycle: ConnectByFnType<DB, TABLE_OR_VIEW, RecursivelyConnectedExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES | 'connectBy'>>
}

export interface DynamicWhereExecutableSelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends GroupByOrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface WhereableExecutableSelectExpressionWithGroupBy<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends OrderableExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    dynamicWhere(): DynamicWhereExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    where(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    where(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface WhereableExecutableSelectExpressionWithGroupByProjectableAsNullable<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends WhereableExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    projectingOptionalValuesAsNullable(): WhereableExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMNS, ResultObjectValuesProjectedAsNullable<COLUMNS>, REQUIRED_TABLE_OR_VIEW, FEATURES | 'projectingOptionalValuesAsNullable'>
}

export interface DynamicWhereExecutableSelectExpressionWithGroupBy<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends OrderByExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface GroupByOrderByHavingExecutableSelectExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends WhereableExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    groupBy(...columns: RequiredColumnNames<COLUMNS>[]): GroupByOrderByHavingExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'groupBy'>
    groupBy(...columns: ValueSourceOf<TABLE_OR_VIEW[typeof tableOrViewRef]>[]): GroupByOrderByHavingExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'groupBy'>

    dynamicHaving(): DynamicHavingExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    having(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicHavingExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    having(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicHavingExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface DynamicHavingExecutableSelectExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends WhereableExecutableSelectExpressionWithGroupBy<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicHavingExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicHavingExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicHavingExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicHavingExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface RecursivelyConnectedExecutableSelectExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends OrderableExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    groupBy(...columns: RequiredColumnNames<COLUMNS>[]): GroupByOrderByHavingExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'groupBy'>
    groupBy(...columns: ValueSourceOf<TABLE_OR_VIEW[typeof tableOrViewRef]>[]): GroupByOrderByHavingExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'groupBy'>
    
    dynamicWhere(): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    where(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
    where(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface ExecutableSelectExpressionWithoutWhere<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends RecursivelyConnectedExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    startWith: StartWithFnType<DB, TABLE_OR_VIEW, RecursivelyConnectedExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'connectBy'>>
    connectBy: ConnectByFnType<DB, TABLE_OR_VIEW, RecursivelyConnectedExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'connectBy'>>
    connectByNoCycle: ConnectByFnType<DB, TABLE_OR_VIEW, RecursivelyConnectedExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES | 'connectBy'>>
}

export interface ExecutableSelectExpressionWithoutWhereProjectableAsNullable<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends ExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    projectingOptionalValuesAsNullable(): ExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMNS, ResultObjectValuesProjectedAsNullable<COLUMNS>, REQUIRED_TABLE_OR_VIEW, FEATURES | 'projectingOptionalValuesAsNullable'>
}

export interface RecursivelyConnectedSelectWhereExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    select<COLUMNS extends SelectColumns<DB, TABLE_OR_VIEW>>(columns: COLUMNS): ExecutableSelectExpressionWithoutWhereProjectableAsNullable<DB, TABLE_OR_VIEW, COLUMNS, ResultObjectValues<COLUMNS>, REQUIRED_TABLE_OR_VIEW, FEATURES>
    selectOneColumn<COLUMN extends ValueSourceOf<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>>>(column: COLUMN): ExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, COLUMN, ValueSourceValueTypeForResult<COLUMN>, REQUIRED_TABLE_OR_VIEW, FEATURES>
    selectCountAll(this: SelectExpressionBase<TypeSafeDB, any>): ExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, IIntValueSource<NoTableOrViewRequired<DB>, 'required'>, int, REQUIRED_TABLE_OR_VIEW, FEATURES | 'requiredResult'>
    selectCountAll(this: SelectExpressionBase<TypeUnsafeDB, any>): ExecutableSelectExpressionWithoutWhere<DB, TABLE_OR_VIEW, INumberValueSource<NoTableOrViewRequired<DB>, 'required'>, number, REQUIRED_TABLE_OR_VIEW, FEATURES| 'requiredResult'>
    dynamicWhere(): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
    where(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
    where(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicWhereExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
    groupBy(...columns: ValueSourceOf<TABLE_OR_VIEW[typeof tableOrViewRef]>[]): GroupByOrderHavingByExpressionWithoutSelect<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES | 'groupBy'>
}

export interface SelectWhereExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends RecursivelyConnectedSelectWhereExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    startWith: StartWithFnType<DB, TABLE_OR_VIEW, RecursivelyConnectedSelectWhereExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES | 'connectBy'>>
    connectBy: ConnectByFnType<DB, TABLE_OR_VIEW, RecursivelyConnectedSelectWhereExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES | 'connectBy'>>
    connectByNoCycle: ConnectByFnType<DB, TABLE_OR_VIEW, RecursivelyConnectedSelectWhereExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES | 'connectBy'>>
}

export interface SelectWhereJoinExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends SelectWhereExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    join<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>>(table: TABLE_OR_VIEW2): OnExpression<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW, FEATURES>
    innerJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>>(table: TABLE_OR_VIEW2): OnExpression<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW, FEATURES>
    leftJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>): OnExpression<DB, TABLE_OR_VIEW | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>, REQUIRED_TABLE_OR_VIEW, FEATURES>
    leftOuterJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>): OnExpression<DB, TABLE_OR_VIEW | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>, REQUIRED_TABLE_OR_VIEW, FEATURES>
    optionalJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>>(table: TABLE_OR_VIEW2): OnExpression<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW, FEATURES>
    optionalInnerJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>>(table: TABLE_OR_VIEW2): OnExpression<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW, FEATURES>
    optionalLeftJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>): OnExpression<DB, TABLE_OR_VIEW | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>, REQUIRED_TABLE_OR_VIEW, FEATURES>
    optionalLeftOuterJoin<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>, ALIAS>(source: OuterJoinSource<TABLE_OR_VIEW2, ALIAS>): OnExpression<DB, TABLE_OR_VIEW | OuterJoinTableOrView<TABLE_OR_VIEW2, ALIAS>, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface DynamicOnExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends SelectWhereJoinExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    and(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
    and(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
    or(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
    or(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface OnExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends SelectWhereJoinExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    dynamicOn(): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
    on(condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
    on(condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): DynamicOnExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface SelectExpressionWithoutJoin<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends SelectWhereExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    from<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>>(table: TABLE_OR_VIEW2): SelectExpressionWithoutJoin<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface SelectExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends SelectWhereJoinExpression<DB, TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES> {
    from<TABLE_OR_VIEW2 extends ITableOrViewOf<DB, any>>(table: TABLE_OR_VIEW2): SelectExpressionWithoutJoin<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface SelectExpressionSubquery<DB extends AnyDB, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> extends SelectExpressionBase<DB, REQUIRED_TABLE_OR_VIEW> {
    from<TABLE_OR_VIEW extends ITableOrViewOf<DB, any>>(table: TABLE_OR_VIEW): SelectExpression<DB, TABLE_OR_VIEW | REQUIRED_TABLE_OR_VIEW, REQUIRED_TABLE_OR_VIEW, FEATURES>
}

export interface SelectExpressionFromNoTable<DB extends AnyDB, FEATURES> extends SelectWhereExpression<AnyDB, NoTableOrViewRequiredView<DB>, NoTableOrViewRequiredView<DB>, FEATURES> {
}

export type SelectColumns<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> = {
    [P: string]: ValueSourceOf<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>> | SelectColumns<DB, TABLE_OR_VIEW>
    [P: number | symbol]: never
}

type SelectPageWithExtras<COLUMNS, RESULT, EXTRAS> = { data: ( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] })[], count: int } & Omit<EXTRAS, 'data' | 'count'>

type ForUseInQueryAs<DB extends AnyDB, COLUMNS, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> =
    typeof neverUsedSymbol extends FEATURES 
    ? /* value when FEATURES=any*/ <ALIAS extends string>(as: ALIAS) => WithView<WITH_VIEW<DB, ALIAS>, COLUMNS> 
    : 'projectingOptionalValuesAsNullable' extends FEATURES ? never
    : COLUMNS extends undefined
    ? never
    : COLUMNS extends AnyValueSource
    ? never
    : DB extends SqlServer | Oracle | MariaDB 
    ? (
        REQUIRED_TABLE_OR_VIEW extends NoTableOrViewRequiredView<DB>
        ? <ALIAS extends string>(as: ALIAS) => WithView<WITH_VIEW<DB, ALIAS>, COLUMNS>
        : never // Not supported by SqlServer (No inner with), Oracle (No outer references in inner with) and MariaDB (No outer references in inner with)
    ) : <ALIAS extends string>(as: ALIAS) => WithView<WITH_VIEW<DB, ALIAS>, COLUMNS>

type ForUseAsInlineQueryValue<DB extends AnyDB, COLUMNS, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> =
    typeof neverUsedSymbol extends FEATURES 
    ? /* value when FEATURES=any*/ () => RemapValueSourceType<REQUIRED_TABLE_OR_VIEW[typeof tableOrViewRef], COLUMNS> 
    : 'projectingOptionalValuesAsNullable' extends FEATURES ? never
    : COLUMNS extends AnyValueSource
    ? (
        'requiredResult' extends FEATURES
        ? () => RemapValueSourceType<REQUIRED_TABLE_OR_VIEW[typeof tableOrViewRef], COLUMNS>
        : () => RemapValueSourceTypeWithOptionalType<REQUIRED_TABLE_OR_VIEW[typeof tableOrViewRef], COLUMNS, 'optional'> 
    ) : never

type ForUseAsInlineAggregatedArrayValue<DB extends AnyDB, COLUMNS, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> =
    typeof neverUsedSymbol extends FEATURES 
    ? /* value when FEATURES=any*/ ForUseAsInlineAggregatedArrayValueFn<DB, COLUMNS, REQUIRED_TABLE_OR_VIEW> 
    : 'projectingOptionalValuesAsNullable' extends FEATURES ? never
    : DB extends SqlServer | Oracle | MariaDB 
    ? (
        REQUIRED_TABLE_OR_VIEW extends NoTableOrViewRequiredView<DB>
        ? ForUseAsInlineAggregatedArrayValueFn<DB, COLUMNS, REQUIRED_TABLE_OR_VIEW>
        : 'recursive' extends FEATURES
        ? never // Not supported by SqlServer (No inner with), Oracle (No outer references in inner with) and MariaDB (No outer references in inner with)
        : DB extends SqlServer | Oracle
        ? ForUseAsInlineAggregatedArrayValueFn<DB, COLUMNS, REQUIRED_TABLE_OR_VIEW>
        // Only in MariaDB
        : 'compound' extends FEATURES
        ? never // Not supported by MariaDB (No outer references in inner from)
        : 'groupBy' extends FEATURES
        ? never // Not supported by MariaDB (No outer references in inner from)
        : 'distinct' extends FEATURES
        ? never // Not supported by MariaDB (No outer references in inner from)
        : ForUseAsInlineAggregatedArrayValueFn<DB, COLUMNS, REQUIRED_TABLE_OR_VIEW>
    ) : ForUseAsInlineAggregatedArrayValueFn<DB, COLUMNS, REQUIRED_TABLE_OR_VIEW>

type ForUseAsInlineAggregatedArrayValueFn<DB extends AnyDB, COLUMNS, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> =
    COLUMNS extends IValueSource<any, any, any, any>
    ? () => AggregatedArrayValueSource<REQUIRED_TABLE_OR_VIEW[typeof tableOrViewRef], Array<COLUMNS[typeof valueType]>, COLUMNS extends { [strictValueType]: infer STRICT_TYPE } ? Array<STRICT_TYPE> : Array<COLUMNS[typeof valueType]>, 'required'>
    : () => AggregatedArrayValueSource<REQUIRED_TABLE_OR_VIEW[typeof tableOrViewRef], Array<{ [P in keyof ResultObjectValues<COLUMNS>]: ResultObjectValues<COLUMNS>[P] }>, Array<{ [P in keyof ResultObjectValuesProjectedAsNullable<COLUMNS>]: ResultObjectValuesProjectedAsNullable<COLUMNS>[P] }>, 'required'>

type CompoundFunction<SUPPORTED_DB extends AnyDB, DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, FEATURES> = 
    DB extends SUPPORTED_DB
    ? <SELECT extends ICompoundableSelect<DB, RESULT, ColumnsForCompound<any, COLUMNS>, any>>(select: SELECT) => CompoundedExecutableSelectExpression<DB, TABLE_OR_VIEW, COLUMNS, RESULT, REQUIRED_TABLE_OR_VIEW | SELECT[typeof requiredTableOrView], FEATURES>
    : never

type StartWithFnType<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, NEXT> =
    DB extends (NoopDB | Oracle)
        ? StartWithFn<DB, TABLE_OR_VIEW, NEXT>
        : never

export interface StartWithFn<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, NEXT> {
    (condition: IIfValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): ConnectByExpression<DB, TABLE_OR_VIEW, NEXT>
    (condition: IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): ConnectByExpression<DB, TABLE_OR_VIEW, NEXT>
}

export interface ConnectByExpression<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, NEXT> {
    connectBy(condition: (prior: <COLUMN extends ValueSourceOf<TABLE_OR_VIEW[typeof tableOrViewRef]>>(column: COLUMN & Column) => COLUMN) => IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): NEXT
    connectByNoCycle(condition: (prior: <COLUMN extends ValueSourceOf<TABLE_OR_VIEW[typeof tableOrViewRef]>>(column: COLUMN & Column) => COLUMN) => IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>): NEXT
}

type ConnectByFnType<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrViewOf<DB, any>, NEXT> =
    DB extends (NoopDB | Oracle)
        ? (condition: (prior: <COLUMN extends ValueSourceOf<TABLE_OR_VIEW[typeof tableOrViewRef]>>(column: COLUMN & Column) => COLUMN) => IBooleanValueSource<TABLE_OR_VIEW[typeof tableOrViewRef] | NoTableOrViewRequired<DB>, any>) => NEXT
        : never

type OrderingSiblingsOnlyFnType<FEATURES, NEXT> =
    'connectBy' extends FEATURES
        ? () => NEXT
        : never
