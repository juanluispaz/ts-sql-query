import type { IBooleanValueSource, INumberValueSource, IAnyBooleanValueSource, IExecutableSelectQuery, AnyValueSource, ValueSourceOf, ValueSourceValueTypeForResult, RemapValueSourceType, RemapValueSourceTypeWithOptionalType, AggregatedArrayValueSource, IValueSource, RemapIValueSourceType } from "./values"
import type { ForUseInLeftJoin, HasSource, IRawFragment, ITableOrView, NoTableOrViewRequiredOfSameDB, OfDB, OfSameDB } from "../utils/ITableOrView"
import type { WithView } from "../utils/tableOrViewUtils"
import type { resultType, compoundableColumns, valueType, from, using, source, selectColumnsType } from "../utils/symbols"
import type { ResultObjectValues, RequiredColumnNames, ColumnsForCompound, ResultObjectValuesProjectedAsNullable } from "../utils/resultUtils"
import type { NAnyNoTableOrViewRequired, NCompoundableFrom, NDbType, NNoTableOrViewRequiredFrom, NRecursiveFrom, NSource, NWithFrom } from "../utils/sourceName"

export type OrderByMode = 'asc' | 'desc' | 'asc nulls first' | 'asc nulls last' | 'desc nulls first' | 'desc nulls last' | 'insensitive' |
                          'asc insensitive' | 'desc insensitive' | 'asc nulls first insensitive' | 'asc nulls last insensitive' | 
                          'desc nulls first insensitive' | 'desc nulls last insensitive'

export interface SelectCustomization</*in|out*/ FROM extends HasSource<any>, /*in|out*/ _REQUIRED extends HasSource<any>> {
    afterSelectKeyword?: IRawFragment<FROM[typeof source]>
    beforeColumns?: IRawFragment<FROM[typeof source]>
    customWindow?: IRawFragment<FROM[typeof source]>
    beforeOrderByItems?: IRawFragment<FROM[typeof source]>
    afterOrderByItems?: IRawFragment<FROM[typeof source]>
    beforeQuery?: IRawFragment<FROM[typeof source]>
    afterQuery?: IRawFragment<FROM[typeof source]>
    beforeWithQuery?: IRawFragment<FROM[typeof source]>
    afterWithQuery?: IRawFragment<FROM[typeof source]>
    queryExecutionName?: string
    queryExecutionMetadata?: any
}

export interface CompoundSelectCustomization</*in|out*/ FROM extends HasSource<any>, /*in|out*/ _REQUIRED extends HasSource<any>> {
    beforeQuery?: IRawFragment<FROM[typeof source]>
    afterQuery?: IRawFragment<FROM[typeof source]>
    beforeWithQuery?: IRawFragment<FROM[typeof source]>
    afterWithQuery?: IRawFragment<FROM[typeof source]>
    queryExecutionName?: string
    queryExecutionMetadata?: any
}

export interface NotSubselectUsing {
    [using]: HasSource<NAnyNoTableOrViewRequired>
}

export interface SelectExpressionBase</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>> {
    [from]: FROM
    [using]: REQUIRED
}

export interface ICompoundableSelect</*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT> extends IExecutableSelectQuery<REQUIRED[typeof source], ExecutableSelectColumns<COLUMNS>, RESULT> {
    [compoundableColumns]: (input: ColumnsForCompound<NCompoundableFrom<REQUIRED[typeof source]>, COLUMNS>) => ColumnsForCompound<NCompoundableFrom<REQUIRED[typeof source]>, COLUMNS>
    [using]: REQUIRED
}

type ExecutableSelectColumns<COLUMNS> = 
    COLUMNS extends AnyValueSource
    ? RemapIValueSourceType<any, COLUMNS>
    : {
        [P in keyof COLUMNS]: RemapIValueSourceType<any, COLUMNS[P]>
    }

export interface ExecutableSelect</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT> extends SelectExpressionBase<FROM, REQUIRED> {
    [selectColumnsType]: COLUMNS
    [resultType]: RESULT
    /*
     * Results of execute methods returns an anonymous type with a exact copy of the result
     * to allow see easily the type when you over (with the mouse) the variable with the
     * result
     *
     * Please, don't remove it or put in a type declaration
     */
    executeSelectNoneOrOne(this: NotSubselectUsing): Promise<( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] }) | null>
    executeSelectOne(this: NotSubselectUsing): Promise<( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] })>
    executeSelectMany(this: NotSubselectUsing): Promise<( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] })[]>

    executeSelectPage(this: NotSubselectUsing): Promise<{ data: ( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] })[], count: number }>
    executeSelectPage<EXTRAS extends {}>(this: NotSubselectUsing, extras: EXTRAS & { data?: ( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] })[], count?: number }): Promise<{ [Q in keyof SelectPageWithExtras<COLUMNS, RESULT, EXTRAS>]: SelectPageWithExtras<COLUMNS, RESULT, EXTRAS>[Q] }>

    query(): string
    params(): any[]
}

export interface WithableExecutableSelect</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends ExecutableSelect<FROM, REQUIRED, COLUMNS, RESULT>, ICompoundableSelect<REQUIRED, COLUMNS, RESULT> {
    forUseInQueryAs: ForUseInQueryAs<FROM, REQUIRED, COLUMNS>
    forUseAsInlineQueryValue: ForUseAsInlineQueryValue<FROM, REQUIRED, COLUMNS, FEATURES>
    forUseAsInlineAggregatedArrayValue: ForUseAsInlineAggregatedArrayValue<FROM, REQUIRED, COLUMNS, FEATURES>
}

export interface WithableExecutableSelectWithoutWhere</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends ExecutableSelect<FROM, REQUIRED, COLUMNS, RESULT>, ICompoundableSelect<REQUIRED, COLUMNS, RESULT> {
    forUseInQueryAs: ForUseInQueryAs<FROM, REQUIRED, COLUMNS>
    forUseAsInlineQueryValue: ForUseAsInlineQueryValue<FROM, REQUIRED, COLUMNS, FEATURES>
    forUseAsInlineAggregatedArrayValue: ForUseAsInlineAggregatedArrayValue<FROM, REQUIRED, COLUMNS, FEATURES>
}

export interface CompoundedCustomizableExecutableSelect</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends WithableExecutableSelect<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    customizeQuery(customization: CompoundSelectCustomization<FROM, REQUIRED>): WithableExecutableSelect<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface CompoundedOffsetExecutableSelectExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends CompoundedCustomizableExecutableSelect<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    offset(offset: number): CompoundedCustomizableExecutableSelect<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    offsetIfValue(offset: number | null | undefined): CompoundedCustomizableExecutableSelect<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface CompoundedLimitExecutableSelectExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends CompoundedCustomizableExecutableSelect<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    limit(limit: number): CompoundedOffsetExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    limitIfValue(limit: number | null | undefined): CompoundedOffsetExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface CompoundedOrderByExecutableSelectExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends CompoundedLimitExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    orderBy(column: RequiredColumnNames<COLUMNS>, mode?: OrderByMode): CompoundedOrderedExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    orderBy(column: ValueSourceOf<NNoTableOrViewRequiredFrom<REQUIRED[typeof source]>>, mode?: OrderByMode): CompoundedOrderedExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    orderBy(column: IRawFragment<FROM[typeof source]>, mode?: OrderByMode): CompoundedOrderedExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    orderByFromString(orderBy: string): CompoundedOrderedExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    orderByFromStringIfValue(orderBy: string | null | undefined): CompoundedOrderedExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface CompoundedOrderedExecutableSelectExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends CompoundedOrderByExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    orderingSiblingsOnly: OrderingSiblingsOnlyFnType<FEATURES, CompoundedLimitExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>>
}

export interface CompoundableExecutableSelectExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends WithableExecutableSelect<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    union<SELECT extends ICompoundableSelect<FROM, COLUMNS, RESULT>>(select: SELECT): CompoundedExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>
    unionAll<SELECT extends ICompoundableSelect<FROM, COLUMNS, RESULT>>(select: SELECT): CompoundedExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>
    intersect: CompoundFunction<'noopDB' | 'mariaDB' | 'postgreSql' | 'sqlite' | 'sqlServer' | 'oracle', FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>
    intersectAll: CompoundFunction<'noopDB' | 'mariaDB' | 'postgreSql', FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>
    except: CompoundFunction<'noopDB' | 'mariaDB' | 'postgreSql' | 'sqlite' | 'sqlServer' | 'oracle', FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>
    exceptAll: CompoundFunction<'noopDB' | 'mariaDB' | 'postgreSql', FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>
    minus: CompoundFunction<'noopDB' | 'mariaDB' | 'postgreSql' | 'sqlite' | 'sqlServer' | 'oracle', FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>
    minusAll: CompoundFunction<'noopDB' | 'mariaDB' | 'postgreSql', FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>

    recursiveUnion<SELECT extends ICompoundableSelect<FROM, COLUMNS, RESULT>>(fn: (view: WithView<NRecursiveFrom<REQUIRED[typeof source]>, COLUMNS>) => SELECT): OrderByExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'recursive'>
    recursiveUnionAll<SELECT extends ICompoundableSelect<FROM, COLUMNS, RESULT>>(fn: (view: WithView<NRecursiveFrom<REQUIRED[typeof source]>, COLUMNS>) => SELECT): OrderByExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'recursive'>
    recursiveUnionOn(fn: (view: WithView<NRecursiveFrom<REQUIRED[typeof source]>, COLUMNS>) => IBooleanValueSource<NRecursiveFrom<REQUIRED[typeof source]> | FROM[typeof source], any>): OrderByExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'recursive'>
    recursiveUnionAllOn(fn: (view: WithView<NRecursiveFrom<REQUIRED[typeof source]>, COLUMNS>) => IBooleanValueSource<NRecursiveFrom<REQUIRED[typeof source]> | FROM[typeof source], any>): OrderByExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'recursive'>
}

export interface CompoundableExecutableSelectExpressionWithoutWhere</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends WithableExecutableSelectWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    union<SELECT extends ICompoundableSelect<FROM, COLUMNS, RESULT>>(select: SELECT): CompoundedExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>
    unionAll<SELECT extends ICompoundableSelect<FROM, COLUMNS, RESULT>>(select: SELECT): CompoundedExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>
    intersect: CompoundFunction<'noopDB' | 'mariaDB' | 'postgreSql' | 'sqlite' | 'sqlServer' | 'oracle', FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>
    intersectAll: CompoundFunction<'noopDB' | 'mariaDB' | 'postgreSql', FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>
    except: CompoundFunction<'noopDB' | 'mariaDB' | 'postgreSql' | 'sqlite' | 'sqlServer' | 'oracle', FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>
    exceptAll: CompoundFunction<'noopDB' | 'mariaDB' | 'postgreSql', FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>
    minus: CompoundFunction<'noopDB' | 'mariaDB' | 'postgreSql' | 'sqlite' | 'sqlServer' | 'oracle', FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>
    minusAll: CompoundFunction<'noopDB' | 'mariaDB' | 'postgreSql', FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>

    recursiveUnion<SELECT extends ICompoundableSelect<FROM, COLUMNS, RESULT>>(fn: (view: WithView<NRecursiveFrom<REQUIRED[typeof source]>, COLUMNS>) => SELECT): OrderByExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'recursive'>
    recursiveUnionAll<SELECT extends ICompoundableSelect<FROM, COLUMNS, RESULT>>(fn: (view: WithView<NRecursiveFrom<REQUIRED[typeof source]>, COLUMNS>) => SELECT): OrderByExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'recursive'>
    recursiveUnionOn(fn: (view: WithView<NRecursiveFrom<REQUIRED[typeof source]>, COLUMNS>) => IBooleanValueSource<NRecursiveFrom<REQUIRED[typeof source]> | FROM[typeof source], any>): OrderByExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'recursive'>
    recursiveUnionAllOn(fn: (view: WithView<NRecursiveFrom<REQUIRED[typeof source]>, COLUMNS>) => IBooleanValueSource<NRecursiveFrom<REQUIRED[typeof source]> | FROM[typeof source], any>): OrderByExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'recursive'>
}

export interface WhereableCompoundableExecutableSelectExpressionWithoutWhere</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends CompoundableExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    dynamicWhere(): DynamicWhereLastCompoundableCustomizableExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    where(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicWhereLastCompoundableCustomizableExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface DynamicWhereLastCompoundableCustomizableExecutableSelectExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends WithableExecutableSelect<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    and(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicWhereLastCompoundableCustomizableExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    or(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicWhereLastCompoundableCustomizableExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface CompoundableCustomizableExecutableSelectExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends CompoundableExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    customizeQuery(customization: SelectCustomization<FROM, REQUIRED>): CompoundableExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface CompoundableCustomizableExecutableSelectExpressionWitoutWhere</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends CompoundableExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    customizeQuery(customization: SelectCustomization<FROM, REQUIRED>): WhereableCompoundableExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface OffsetExecutableSelectExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends CompoundableCustomizableExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    offset(offset: number): CompoundableCustomizableExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    offsetIfValue(offset: number | null | undefined): CompoundableCustomizableExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}
export interface LimitExecutableSelectExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends CompoundableCustomizableExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    limit(limit: number): OffsetExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    limitIfValue(limit: number | null | undefined): OffsetExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface OrderByExecutableSelectExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends LimitExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    orderBy(column: RequiredColumnNames<COLUMNS>, mode?: OrderByMode): OrderedExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    orderBy(column: ValueSourceOf<FROM[typeof source]>, mode?: OrderByMode): OrderedExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    orderBy(column: IRawFragment<FROM[typeof source]>, mode?: OrderByMode): OrderedExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    orderByFromString(orderBy: string): OrderedExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    orderByFromStringIfValue(orderBy: string | null | undefined): OrderedExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface OrderByExecutableSelectExpressionProjectableAsNullable</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends OrderByExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    projectingOptionalValuesAsNullable(): OrderByExecutableSelectExpression<FROM, REQUIRED, COLUMNS, ResultObjectValuesProjectedAsNullable<COLUMNS>, FEATURES>
}

export interface OrderedExecutableSelectExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends OrderByExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    orderingSiblingsOnly: OrderingSiblingsOnlyFnType<FEATURES, LimitExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>>
}

export interface CompoundedExecutableSelectExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends CompoundedOrderByExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    union<SELECT extends ICompoundableSelect<FROM, COLUMNS, RESULT>>(select: SELECT): CompoundedExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>
    unionAll<SELECT extends ICompoundableSelect<FROM, COLUMNS, RESULT>>(select: SELECT): CompoundedExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>
    intersect: CompoundFunction<'noopDB' | 'mariaDB' | 'postgreSql' | 'sqlite' | 'sqlServer' | 'oracle', FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>
    intersectAll: CompoundFunction<'noopDB' | 'mariaDB' | 'postgreSql', FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>
    except: CompoundFunction<'noopDB' | 'mariaDB' | 'postgreSql' | 'sqlite' | 'sqlServer' | 'oracle', FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>
    exceptAll: CompoundFunction<'noopDB' | 'mariaDB' | 'postgreSql', FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>
    minus: CompoundFunction<'noopDB' | 'mariaDB' | 'postgreSql' | 'sqlite' | 'sqlServer' | 'oracle', FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>
    minusAll: CompoundFunction<'noopDB' | 'mariaDB' | 'postgreSql', FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'compound'>
}

export interface OrderableExecutableSelectExpressionWithoutWhere</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends CompoundableCustomizableExecutableSelectExpressionWitoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    orderBy(column: RequiredColumnNames<COLUMNS>, mode?: OrderByMode): OrderedExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    orderBy(column: ValueSourceOf<FROM[typeof source]>, mode?: OrderByMode): OrderedExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    orderBy(column: IRawFragment<FROM[typeof source]>, mode?: OrderByMode): OrderedExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    orderByFromString(orderBy: string): OrderedExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    orderByFromStringIfValue(orderBy: string | null | undefined): OrderedExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>

    limit(limit: number): OffsetExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    limitIfValue(limit: number | null | undefined): OffsetExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface LimitExecutableSelectExpressionWithoutWhere</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends CompoundableCustomizableExecutableSelectExpressionWitoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    dynamicWhere(): DynamicWhereLimitExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    where(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicWhereLimitExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    
    limit(limit: number): OffsetExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    limitIfValue(limit: number | null | undefined): OffsetExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface OrderByExecutableSelectExpressionWithoutWhere</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends LimitExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    orderBy(column: RequiredColumnNames<COLUMNS>, mode?: OrderByMode): OrderedExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    orderBy(column: ValueSourceOf<FROM[typeof source]>, mode?: OrderByMode): OrderedExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    orderBy(column: IRawFragment<FROM[typeof source]>, mode?: OrderByMode): OrderedExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    orderByFromString(orderBy: string): OrderedExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    orderByFromStringIfValue(orderBy: string | null | undefined): OrderedExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface OrderedExecutableSelectExpressionWithoutWhere</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends OrderByExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    orderingSiblingsOnly: OrderingSiblingsOnlyFnType<FEATURES, LimitExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>>
}

export interface OffsetExecutableSelectExpressionWithoutWhere</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends CompoundableCustomizableExecutableSelectExpressionWitoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    offset(offset: number): CompoundableCustomizableExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    offsetIfValue(offset: number | null | undefined): CompoundableCustomizableExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>

    dynamicWhere(): DynamicWhereCompoundableCustomizableExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    where(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface CompoundableCustomizableExpressionWithoutWhere</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends CompoundableCustomizableExecutableSelectExpressionWitoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    dynamicWhere(): DynamicWhereCompoundableCustomizableExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    where(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface DynamicWhereLimitExecutableSelectExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends CompoundableCustomizableExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    and(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicWhereLimitExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    or(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicWhereLimitExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>

    limit(limit: number): OffsetExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    limitIfValue(limit: number | null | undefined): OffsetExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface DynamicWhereCompoundableCustomizableExecutableSelectExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends CompoundableCustomizableExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    and(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    or(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicWhereCompoundableCustomizableExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface RecursivelyConnectedExecutableSelectExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends OrderByExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    groupBy(...columns: RequiredColumnNames<COLUMNS>[]): GroupByOrderByHavingExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'groupBy'>
    groupBy(...columns: ValueSourceOf<FROM[typeof source]>[]): GroupByOrderByHavingExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'groupBy'>
}

export interface GroupByOrderByExecutableSelectExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends RecursivelyConnectedExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    startWith: StartWithFnType<FROM, REQUIRED, RecursivelyConnectedExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'connectBy'>>
    connectBy: ConnectByFnType<FROM, REQUIRED, RecursivelyConnectedExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'connectBy'>>
    connectByNoCycle: ConnectByFnType<FROM, REQUIRED, RecursivelyConnectedExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'connectBy'>>
}

export interface GroupByOrderByExecutableSelectExpressionProjectableAsNullable</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends GroupByOrderByExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    projectingOptionalValuesAsNullable(): GroupByOrderByExecutableSelectExpression<FROM, REQUIRED, COLUMNS, ResultObjectValuesProjectedAsNullable<COLUMNS>, FEATURES>
}

export interface GroupByOrderByHavingExecutableSelectExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends OrderByExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    groupBy(...columns: RequiredColumnNames<COLUMNS>[]): GroupByOrderByHavingExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'groupBy'>
    groupBy(...columns: ValueSourceOf<FROM[typeof source]>[]): GroupByOrderByHavingExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'groupBy'>

    dynamicHaving(): DynamicHavingExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    having(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicHavingExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface DynamicHavingExecutableSelectExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends OrderByExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    and(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicHavingExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    or(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicHavingExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface GroupByOrderHavingByExpressionWithoutSelect</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ FEATURES> extends SelectExpressionBase<FROM, REQUIRED> {
    groupBy(...columns: ValueSourceOf<FROM[typeof source]>[]): GroupByOrderHavingByExpressionWithoutSelect<FROM, REQUIRED, FEATURES | 'groupBy'>

    dynamicHaving(): DynamicHavingExpressionWithoutSelect<FROM, REQUIRED, FEATURES>
    having(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicHavingExpressionWithoutSelect<FROM, REQUIRED, FEATURES>

    dynamicWhere(): DynamicWhereSelectExpressionWithoutSelect<FROM, REQUIRED, FEATURES>
    where(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicWhereSelectExpressionWithoutSelect<FROM, REQUIRED, FEATURES>

    select<COLUMNS extends SelectColumns<FROM[typeof source]>>(columns: COLUMNS): WhereableExecutableSelectExpressionWithGroupByProjectableAsNullable<FROM, REQUIRED, COLUMNS, ResultObjectValues<COLUMNS>, FEATURES>
    selectOneColumn<COLUMN extends ValueSourceOf<FROM[typeof source]>>(column: COLUMN): WhereableExecutableSelectExpressionWithGroupBy<FROM, REQUIRED, COLUMN, ValueSourceValueTypeForResult<COLUMN>, FEATURES>
    selectCountAll(): WhereableExecutableSelectExpressionWithGroupBy<FROM, REQUIRED, INumberValueSource<NNoTableOrViewRequiredFrom<REQUIRED[typeof source]>, 'required'>, number, FEATURES | 'requiredResult'>
}

export interface DynamicHavingExpressionWithoutSelect</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ FEATURES> extends SelectExpressionBase<FROM, REQUIRED> {
    and(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicHavingExpressionWithoutSelect<FROM, REQUIRED, FEATURES>
    or(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicHavingExpressionWithoutSelect<FROM, REQUIRED, FEATURES>

    dynamicWhere(): DynamicWhereSelectExpressionWithoutSelect<FROM, REQUIRED, FEATURES>
    where(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicWhereSelectExpressionWithoutSelect<FROM, REQUIRED, FEATURES>

    select<COLUMNS extends SelectColumns<FROM[typeof source]>>(columns: COLUMNS): WhereableExecutableSelectExpressionWithGroupByProjectableAsNullable<FROM, REQUIRED, COLUMNS, ResultObjectValues<COLUMNS>, FEATURES>
    selectOneColumn<COLUMN extends ValueSourceOf<FROM[typeof source]>>(column: COLUMN): WhereableExecutableSelectExpressionWithGroupBy<FROM, REQUIRED, COLUMN, ValueSourceValueTypeForResult<COLUMN>, FEATURES>
    selectCountAll(): WhereableExecutableSelectExpressionWithGroupBy<FROM, REQUIRED, INumberValueSource<NNoTableOrViewRequiredFrom<REQUIRED[typeof source]>, 'required'>, number, FEATURES | 'requiredResult'>
}

export interface DynamicWhereSelectExpressionWithoutSelect</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ FEATURES> extends SelectExpressionBase<FROM, REQUIRED> {
    and(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicWhereSelectExpressionWithoutSelect<FROM, REQUIRED, FEATURES>
    or(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicWhereSelectExpressionWithoutSelect<FROM, REQUIRED, FEATURES>

    select<COLUMNS extends SelectColumns<FROM[typeof source]>>(columns: COLUMNS): OrderByExecutableSelectExpressionProjectableAsNullable<FROM, REQUIRED, COLUMNS, ResultObjectValues<COLUMNS>, FEATURES>
    selectOneColumn<COLUMN extends ValueSourceOf<FROM[typeof source]>>(column: COLUMN): OrderByExecutableSelectExpression<FROM, REQUIRED, COLUMN, ValueSourceValueTypeForResult<COLUMN>, FEATURES>
    selectCountAll(): OrderByExecutableSelectExpression<FROM, REQUIRED, INumberValueSource<NNoTableOrViewRequiredFrom<REQUIRED[typeof source]>, 'required'>, number, FEATURES| 'requiredResult'>
}

export interface RecursivelyConnectedExpressionWithoutSelect</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ FEATURES> extends SelectExpressionBase<FROM, REQUIRED> {
    groupBy(...columns: ValueSourceOf<FROM[typeof source]>[]): GroupByOrderHavingByExpressionWithoutSelect<FROM, REQUIRED, FEATURES | 'groupBy'>

    select<COLUMNS extends SelectColumns<FROM[typeof source]>>(columns: COLUMNS): GroupByOrderByExecutableSelectExpressionProjectableAsNullable<FROM, REQUIRED, COLUMNS, ResultObjectValues<COLUMNS>, FEATURES>
    selectOneColumn<COLUMN extends ValueSourceOf<FROM[typeof source]>>(column: COLUMN): GroupByOrderByExecutableSelectExpression<FROM, REQUIRED, COLUMN, ValueSourceValueTypeForResult<COLUMN>, FEATURES>
    selectCountAll(): GroupByOrderByExecutableSelectExpression<FROM, REQUIRED, INumberValueSource<NNoTableOrViewRequiredFrom<REQUIRED[typeof source]>, 'required'>, number, FEATURES | 'requiredResult'>
}

export interface DynamicWhereExpressionWithoutSelect</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ FEATURES> extends RecursivelyConnectedExpressionWithoutSelect<FROM, REQUIRED, FEATURES> {
    and(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicWhereExpressionWithoutSelect<FROM, REQUIRED, FEATURES>
    or(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicWhereExpressionWithoutSelect<FROM, REQUIRED, FEATURES>

    startWith: StartWithFnType<FROM, REQUIRED, RecursivelyConnectedExpressionWithoutSelect<FROM, REQUIRED, FEATURES | 'connectBy'>>
    connectBy: ConnectByFnType<FROM, REQUIRED, RecursivelyConnectedExpressionWithoutSelect<FROM, REQUIRED, FEATURES | 'connectBy'>>
    connectByNoCycle: ConnectByFnType<FROM, REQUIRED, RecursivelyConnectedExpressionWithoutSelect<FROM, REQUIRED, FEATURES | 'connectBy'>>
}

export interface DynamicWhereExecutableSelectExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends GroupByOrderByExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    and(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicWhereExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    or(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicWhereExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface WhereableExecutableSelectExpressionWithGroupBy</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends OrderableExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    dynamicWhere(): DynamicWhereExecutableSelectExpressionWithGroupBy<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    where(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicWhereExecutableSelectExpressionWithGroupBy<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface WhereableExecutableSelectExpressionWithGroupByProjectableAsNullable</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends WhereableExecutableSelectExpressionWithGroupBy<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    projectingOptionalValuesAsNullable(): WhereableExecutableSelectExpressionWithGroupBy<FROM, REQUIRED, COLUMNS, ResultObjectValuesProjectedAsNullable<COLUMNS>, FEATURES>
}

export interface DynamicWhereExecutableSelectExpressionWithGroupBy</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends OrderByExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    and(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicWhereExecutableSelectExpressionWithGroupBy<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    or(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicWhereExecutableSelectExpressionWithGroupBy<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface GroupByOrderByHavingExecutableSelectExpressionWithoutWhere</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends WhereableExecutableSelectExpressionWithGroupBy<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    groupBy(...columns: RequiredColumnNames<COLUMNS>[]): GroupByOrderByHavingExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'groupBy'>
    groupBy(...columns: ValueSourceOf<FROM[typeof source]>[]): GroupByOrderByHavingExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'groupBy'>

    dynamicHaving(): DynamicHavingExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    having(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicHavingExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface DynamicHavingExecutableSelectExpressionWithoutWhere</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends WhereableExecutableSelectExpressionWithGroupBy<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    and(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicHavingExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    or(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicHavingExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface RecursivelyConnectedExecutableSelectExpressionWithoutWhere</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends OrderableExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    groupBy(...columns: RequiredColumnNames<COLUMNS>[]): GroupByOrderByHavingExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'groupBy'>
    groupBy(...columns: ValueSourceOf<FROM[typeof source]>[]): GroupByOrderByHavingExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'groupBy'>
    
    dynamicWhere(): DynamicWhereExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    where(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicWhereExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
}

export interface ExecutableSelectExpressionWithoutWhere</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends RecursivelyConnectedExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    startWith: StartWithFnType<FROM, REQUIRED, RecursivelyConnectedExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'connectBy'>>
    connectBy: ConnectByFnType<FROM, REQUIRED, RecursivelyConnectedExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'connectBy'>>
    connectByNoCycle: ConnectByFnType<FROM, REQUIRED, RecursivelyConnectedExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES | 'connectBy'>>
}

export interface ExecutableSelectExpressionWithoutWhereProjectableAsNullable</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ COLUMNS, /*in|out*/ RESULT, /*in|out*/ FEATURES> extends ExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, RESULT, FEATURES> {
    projectingOptionalValuesAsNullable(): ExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMNS, ResultObjectValuesProjectedAsNullable<COLUMNS>, FEATURES>
}

export interface RecursivelyConnectedSelectWhereExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ FEATURES> extends SelectExpressionBase<FROM, REQUIRED> {
    select<COLUMNS extends SelectColumns<FROM[typeof source]>>(columns: COLUMNS): ExecutableSelectExpressionWithoutWhereProjectableAsNullable<FROM, REQUIRED, COLUMNS, ResultObjectValues<COLUMNS>, FEATURES>
    selectOneColumn<COLUMN extends ValueSourceOf<FROM[typeof source]>>(column: COLUMN): ExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, COLUMN, ValueSourceValueTypeForResult<COLUMN>, FEATURES>
    selectCountAll(): ExecutableSelectExpressionWithoutWhere<FROM, REQUIRED, INumberValueSource<NNoTableOrViewRequiredFrom<REQUIRED[typeof source]>, 'required'>, number, FEATURES| 'requiredResult'>
    dynamicWhere(): DynamicWhereExpressionWithoutSelect<FROM, REQUIRED, FEATURES>
    where(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicWhereExpressionWithoutSelect<FROM, REQUIRED, FEATURES>
    groupBy(...columns: ValueSourceOf<FROM[typeof source]>[]): GroupByOrderHavingByExpressionWithoutSelect<FROM, REQUIRED, FEATURES | 'groupBy'>
}

export interface SelectWhereExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ FEATURES> extends RecursivelyConnectedSelectWhereExpression<FROM, REQUIRED, FEATURES> {
    startWith: StartWithFnType<FROM, REQUIRED, RecursivelyConnectedSelectWhereExpression<FROM, REQUIRED, FEATURES | 'connectBy'>>
    connectBy: ConnectByFnType<FROM, REQUIRED, RecursivelyConnectedSelectWhereExpression<FROM, REQUIRED, FEATURES | 'connectBy'>>
    connectByNoCycle: ConnectByFnType<FROM, REQUIRED, RecursivelyConnectedSelectWhereExpression<FROM, REQUIRED, FEATURES | 'connectBy'>>
}

export interface SelectWhereJoinExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ FEATURES> extends SelectWhereExpression<FROM, REQUIRED, FEATURES> {
    join<T2 extends ITableOrView<any>>(table: T2 & OfSameDB<REQUIRED>): OnExpression<FROM | T2, REQUIRED, FEATURES>
    innerJoin<T2 extends ITableOrView<any>>(table: T2 & OfSameDB<REQUIRED>): OnExpression<FROM | T2, REQUIRED, FEATURES>
    leftJoin<T2 extends ForUseInLeftJoin<any>>(source: T2 & OfSameDB<REQUIRED>): OnExpression<FROM | T2, REQUIRED, FEATURES>
    leftOuterJoin<T2 extends ForUseInLeftJoin<any>>(source: T2 & OfSameDB<REQUIRED>): OnExpression<FROM | T2, REQUIRED, FEATURES>
    optionalJoin<T2 extends ITableOrView<any>>(table: T2 & OfSameDB<REQUIRED>): OnExpression<FROM | T2, REQUIRED, FEATURES>
    optionalInnerJoin<T2 extends ITableOrView<any>>(table: T2 & OfSameDB<REQUIRED>): OnExpression<FROM | T2, REQUIRED, FEATURES>
    optionalLeftJoin<T2 extends ForUseInLeftJoin<any>>(source: T2 & OfSameDB<REQUIRED>): OnExpression<FROM | T2, REQUIRED, FEATURES>
    optionalLeftOuterJoin<T2 extends ForUseInLeftJoin<any>>(source: T2 & OfSameDB<REQUIRED>): OnExpression<FROM | T2, REQUIRED, FEATURES>
}

export interface DynamicOnExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ FEATURES> extends SelectWhereJoinExpression<FROM, REQUIRED, FEATURES> {
    and(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicOnExpression<FROM, REQUIRED, FEATURES>
    or(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicOnExpression<FROM, REQUIRED, FEATURES>
}

export interface OnExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ FEATURES> extends SelectWhereJoinExpression<FROM, REQUIRED, FEATURES> {
    dynamicOn(): DynamicOnExpression<FROM, REQUIRED, FEATURES>
    on(condition: IAnyBooleanValueSource<FROM[typeof source], any>): DynamicOnExpression<FROM, REQUIRED, FEATURES>
}

export interface SelectExpressionWithoutJoin</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ FEATURES> extends SelectWhereExpression<FROM, REQUIRED, FEATURES> {
    from<T2 extends ITableOrView<any>>(table: T2 & OfSameDB<REQUIRED>): SelectExpressionWithoutJoin<FROM | T2, REQUIRED, FEATURES>
}

export interface SelectExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ FEATURES> extends SelectWhereJoinExpression<FROM, REQUIRED, FEATURES> {
    from<T2 extends ITableOrView<any>>(table: T2 & OfSameDB<REQUIRED>): SelectExpressionWithoutJoin<FROM | T2, REQUIRED, FEATURES>
}

export interface SelectExpressionSubquery</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ FEATURES> extends SelectExpressionBase<FROM, REQUIRED> {
    from<T extends ITableOrView<any>>(table: T & OfSameDB<REQUIRED>): SelectExpression<FROM | T, REQUIRED, FEATURES>
}

export interface SelectExpressionFromNoTable</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ FEATURES> extends SelectWhereExpression<FROM, REQUIRED, FEATURES> {
}

export type SelectColumns<SOURCE extends NSource> = {
    [P: string]:  ValueSourceOf<SOURCE> | SelectColumns<SOURCE>
    [P: number | symbol]: never
}

type SelectPageWithExtras<COLUMNS, RESULT, EXTRAS> = { data: ( COLUMNS extends AnyValueSource ? RESULT : { [P in keyof RESULT]: RESULT[P] })[], count: number } & Omit<EXTRAS, 'data' | 'count'>

type ForUseInQueryAs<_FROM extends HasSource<any>, REQUIRED extends HasSource<any>, COLUMNS> =
    unknown extends REQUIRED ? <ALIAS extends string>(as: ALIAS) => WithView<NWithFrom<REQUIRED[typeof source], ALIAS>, COLUMNS> // this is the case when te arguments are of type any
    : [COLUMNS] extends [undefined]
    ? never
    : [COLUMNS] extends [AnyValueSource]
    ? never
    : [REQUIRED] extends [OfDB<'sqlServer' | 'oracle' | 'mariaDB'>]
    ? (
        [REQUIRED] extends [NoTableOrViewRequiredOfSameDB<REQUIRED>]
        ? <ALIAS extends string>(as: ALIAS) => WithView<NWithFrom<REQUIRED[typeof source], ALIAS>, COLUMNS>
        : never // Not supported by SqlServer (No inner with), Oracle (No outer references in inner with) and MariaDB (No outer references in inner with)
    ) : <ALIAS extends string>(as: ALIAS) => WithView<NWithFrom<REQUIRED[typeof source], ALIAS>, COLUMNS>

type ForUseAsInlineQueryValue<_FROM extends HasSource<any>, REQUIRED extends HasSource<any>, COLUMNS, FEATURES> =
    COLUMNS extends AnyValueSource
    ? (
        'requiredResult' extends FEATURES
        ? () => RemapValueSourceType<REQUIRED[typeof source], COLUMNS>
        : () => RemapValueSourceTypeWithOptionalType<REQUIRED[typeof source], COLUMNS, 'optional'> 
    ) : never

type ForUseAsInlineAggregatedArrayValue<FROM extends HasSource<any>, REQUIRED extends HasSource<any>, COLUMNS, FEATURES> =
    [REQUIRED] extends [OfDB<'sqlServer' | 'oracle' | 'mariaDB'>]
    ? (
        [REQUIRED] extends [NoTableOrViewRequiredOfSameDB<REQUIRED>]
        ? ForUseAsInlineAggregatedArrayValueFn<FROM, REQUIRED, COLUMNS>
        : 'recursive' extends FEATURES
        ? never // Not supported by SqlServer (No inner with), Oracle (No outer references in inner with) and MariaDB (No outer references in inner with)
        : REQUIRED extends OfDB<'sqlServer' | 'oracle'>
        ? ForUseAsInlineAggregatedArrayValueFn<FROM, REQUIRED, COLUMNS>
        // Only in MariaDB
        : 'compound' extends FEATURES
        ? never // Not supported by MariaDB (No outer references in inner from)
        : 'groupBy' extends FEATURES
        ? never // Not supported by MariaDB (No outer references in inner from)
        : 'distinct' extends FEATURES
        ? never // Not supported by MariaDB (No outer references in inner from)
        : ForUseAsInlineAggregatedArrayValueFn<FROM, REQUIRED, COLUMNS>
    ) : ForUseAsInlineAggregatedArrayValueFn<FROM, REQUIRED, COLUMNS>

type ForUseAsInlineAggregatedArrayValueFn<_FROM extends HasSource<any>, REQUIRED extends HasSource<any>, COLUMNS> =
    COLUMNS extends IValueSource<any, any, any, any>
    ? () => AggregatedArrayValueSource<REQUIRED[typeof source], Array<COLUMNS[typeof valueType]>, 'required'>
    : () => AggregatedArrayValueSource<REQUIRED[typeof source], Array<{ [P in keyof ResultObjectValues<COLUMNS>]: ResultObjectValues<COLUMNS>[P] }>, 'required'>

type CompoundFunction<SUPPORTED_DB extends NDbType, FROM extends HasSource<any>, REQUIRED extends HasSource<any>, COLUMNS, RESULT, FEATURES> = 
    [REQUIRED] extends [OfDB<SUPPORTED_DB>]
    ? <SELECT extends ICompoundableSelect<FROM, COLUMNS, RESULT>>(select: SELECT) => CompoundedExecutableSelectExpression<FROM, REQUIRED, COLUMNS, RESULT, FEATURES>
    : never

type StartWithFnType<FROM extends HasSource<any>, REQUIRED extends HasSource<any>, NEXT> =
    [REQUIRED] extends [OfDB<'noopDB' | 'oracle'>]
        ? StartWithFn<FROM, REQUIRED, NEXT>
        : never

export interface StartWithFn</*in|out*/ FROM extends HasSource<any>, /*in|out*/ REQUIRED extends HasSource<any>, /*in|out*/ NEXT> {
    (condition: IAnyBooleanValueSource<FROM[typeof source], any>): ConnectByExpression<FROM, REQUIRED, NEXT>
}

export interface ConnectByExpression</*in|out*/ FROM extends HasSource<any>, /*in|out*/ _REQUIRED extends HasSource<any>, NEXT> {
    connectBy(condition: (prior: <COLUMN extends ValueSourceOf<FROM[typeof source]>>(column: COLUMN) => COLUMN) => IBooleanValueSource<FROM[typeof source], any>): NEXT
    connectByNoCycle(condition: (prior: <COLUMN extends ValueSourceOf<FROM[typeof source]>>(column: COLUMN) => COLUMN) => IBooleanValueSource<FROM[typeof source], any>): NEXT
}

type ConnectByFnType<FROM extends HasSource<any>, REQUIRED extends HasSource<any>, NEXT> =
    [REQUIRED] extends [OfDB<'noopDB' | 'oracle'>]
        ? (condition: (prior: <COLUMN extends ValueSourceOf<FROM[typeof source]>>(column: COLUMN) => COLUMN) => IBooleanValueSource<FROM[typeof source], any>) => NEXT
        : never

type OrderingSiblingsOnlyFnType<FEATURES, NEXT> =
    'connectBy' extends FEATURES
        ? () => NEXT
        : never
