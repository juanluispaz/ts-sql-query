import type { EqualableValueSource, ComparableValueSource, IEqualableValueSource, IComparableValueSource, CustomIntValueSource, CustomBigintValueSource, CustomDoubleValueSource, CustomDecimalValueSource, CustomUuidValueSource, CustomLocalDateTimeValueSource, ICustomIntValueSource, ICustomBigintValueSource, ICustomDoubleValueSource, ICustomDecimalValueSource, ICustomUuidValueSource, ICustomLocalDateValueSource, ICustomLocalTimeValueSource, ICustomLocalDateTimeValueSource, CustomLocalDateValueSource, CustomLocalTimeValueSource } from './expressions/values.js'
import type { HasIsValue, IView, IWithView } from './utils/ITableOrView.js'
import { __addWiths, __registerRequiredColumn, __registerTableOrView, __getTableOrViewPrivate } from './utils/ITableOrView.js'
import type { TypeAdapter } from './TypeAdapter.js'
import type { AliasedTableOrView, AsAliasedForUseInLeftJoin, AsForUseInLeftJoin } from './utils/tableOrViewUtils.js'
import { __createDBColumn, __createValueSourceFromBuilder } from './typeSystem/valueSourceFactory.js'
import { connection, isTableOrViewObject, source, type } from './utils/symbols.js'
import type { IConnection } from './utils/IConnection.js'
import type { RawFragment } from './utils/RawFragment.js'
import type { ComparableFragmentExpression, CustomDoubleFragmentExpression, CustomDecimalFragmentExpression, CustomIntFragmentExpression, CustomBigintFragmentExpression, CustomLocalDateFragmentExpression, CustomLocalDateTimeFragmentExpression, CustomLocalTimeFragmentExpression, CustomUuidFragmentExpression, EqualableFragmentExpression } from './expressions/fragment.js'
import { FragmentQueryBuilder } from './queryBuilders/FragmentQueryBuilder.js'
import type { NNoTableOrViewRequiredFrom, NSourceAllowingNoTableOrViewRequired, NView } from './utils/sourceName.js'
import { __setColumnsForLeftJoin } from './utils/leftJoinUtils.js'
import type { CustomType } from './TypeAdapter.js'
import type { AnyValueSource } from './typeSystem/valueSource.js'
import type { BuiltInDataType, BuiltInDataTypeValueSources, BuiltInDataTypeInputs, BuiltInDataTypeFragments } from './typeSystem/builtInDataTypes.js'

class ViewOf</*in|out*/ SOURCE extends NView<any, any>> implements IView<SOURCE> {
    [isTableOrViewObject]: true = true;
    [source]!: SOURCE
    [type]!: 'view'
    /* implements __ITableOrViewPrivate as private members*/
    // @ts-ignore
    private __name: string
    // @ts-ignore
    private __as?: string
    // @ts-ignore
    private __forUseInLeftJoin?: boolean
    // @ts-ignore
    private __type: 'view' = 'view'
    // @ts-ignore
    private __template?: RawFragment<any>

    constructor(name: string) {
        this.__name = name
    }

    as<ALIAS extends string>(as: ALIAS): AliasedTableOrView<this, ALIAS> {
        const result = new ((this as any).constructor)() as ViewOf<any>
        result.__as = as
        __getTableOrViewPrivate(this).__customizationApply?.(result)
        return result as any
    }
    forUseInLeftJoin(): AsForUseInLeftJoin<this> {
        return this.forUseInLeftJoinAs('') as any
    }
    forUseInLeftJoinAs<ALIAS extends string>(as: ALIAS): AsAliasedForUseInLeftJoin<this, ALIAS> {
        const result = new ((this as any).constructor)() as ViewOf<any>
        result.__as = as
        result.__forUseInLeftJoin = true
        __setColumnsForLeftJoin(result as any)
        __getTableOrViewPrivate(this).__customizationApply?.(result)
        return result as any
    }

    protected column<TYPE extends BuiltInDataType>(name: string, type: TYPE, adapter?: TypeAdapter): BuiltInDataTypeValueSources<SOURCE, 'required'>[TYPE]
    protected column<T, TYPE_NAME extends string>(name: string, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected column<T, TYPE_NAME extends string>(name: string, type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomBigintValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected column<T, TYPE_NAME extends string>(name: string, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected column<T, TYPE_NAME extends string>(name: string, type: 'customDecimal', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDecimalValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected column<T, TYPE_NAME extends string>(name: string, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected column<T, TYPE_NAME extends string>(name: string, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected column<T, TYPE_NAME extends string>(name: string, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected column<T, TYPE_NAME extends string>(name: string, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected column<T, TYPE_NAME extends string>(name: string, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected column<T, TYPE_NAME extends string>(name: string, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected column<T, TYPE_NAME extends string>(name: string, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected column(name: string, type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any /* EqualableValueSource<SOURCE, T, TYPE_NAME, 'required'> */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        if (typeof adapter === 'string') {
            return __createDBColumn(this, name, adapter, type as CustomType, adapter2)
        }
        return __createDBColumn(this, name, type, undefined, adapter)
    }

    protected optionalColumn<TYPE extends BuiltInDataType>(name: string, type: TYPE, adapter?: TypeAdapter): BuiltInDataTypeValueSources<SOURCE, 'optional'>[TYPE]
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customBigint', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomBigintValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customDecimal', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDecimalValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalColumn(name: string, type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any /* EqualableValueSource<SOURCE, T, TYPE_NAME, 'optional'> */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        if (typeof adapter === 'string') {
            return (__createDBColumn(this, name, adapter, type as CustomType, adapter2)).__asOptional()
        }
        return (__createDBColumn(this, name, type, undefined, adapter)).__asOptional()
    }

    protected virtualColumnFromFragment<TYPE extends BuiltInDataType>(type: TYPE, fn: (fragment: BuiltInDataTypeFragments<NNoTableOrViewRequiredFrom<SOURCE>, 'required'>[TYPE]) => BuiltInDataTypeInputs<NSourceAllowingNoTableOrViewRequired<SOURCE>, 'required'>[TYPE], adapter?: TypeAdapter): BuiltInDataTypeValueSources<SOURCE, 'required'>[TYPE]
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, fn: (fragment: CustomIntFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'required'>) => ICustomIntValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): CustomIntValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, fn: (fragment: CustomBigintFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'required'>) => ICustomBigintValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): CustomBigintValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, fn: (fragment: CustomDoubleFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'required'>) => ICustomDoubleValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): CustomDoubleValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customDecimal', typeName: TYPE_NAME, fn: (fragment: CustomDecimalFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'required'>) => ICustomDecimalValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): CustomDecimalValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, fn: (fragment: CustomUuidFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'required'>) => ICustomUuidValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): CustomUuidValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, fn: (fragment: CustomLocalDateFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'required'>) => ICustomLocalDateValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): CustomLocalDateValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, fn: (fragment: CustomLocalTimeFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'required'>) => ICustomLocalTimeValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): CustomLocalTimeValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, fn: (fragment: CustomLocalDateTimeFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'required'>) => ICustomLocalDateTimeValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, fn: (fragment: EqualableFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'required'>) => IEqualableValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, fn: (fragment: EqualableFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'required'>) => IEqualableValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, fn: (fragment: ComparableFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'required'>) => IComparableValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): ComparableValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment(type: string, arg1: any, arg2?: any, arg3?: TypeAdapter): any /* EqualableValueSource<SOURCE, T, TYPE_NAME, 'required'> */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        if (typeof arg1 === 'string') {
            const fragmentBuilder =  new FragmentQueryBuilder(arg1, type as CustomType, 'required', arg3)
            return __createValueSourceFromBuilder(arg2 as (fragment: any) => AnyValueSource, fragmentBuilder, arg1, type as CustomType, 'required', arg3)
        }
        const fragmentBuilder =  new FragmentQueryBuilder(type, undefined, 'required', arg2 as TypeAdapter | undefined)
        return __createValueSourceFromBuilder(arg1 as (fragment: any) => AnyValueSource, fragmentBuilder, type, undefined, 'required', arg2 as TypeAdapter | undefined)
    }

    protected optionalVirtualColumnFromFragment<TYPE extends BuiltInDataType>(type: TYPE, fn: (fragment: BuiltInDataTypeFragments<NNoTableOrViewRequiredFrom<SOURCE>, 'optional'>[TYPE]) => BuiltInDataTypeInputs<NSourceAllowingNoTableOrViewRequired<SOURCE>, 'optional'>[TYPE], adapter?: TypeAdapter): BuiltInDataTypeValueSources<SOURCE, 'optional'>[TYPE]
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, fn: (fragment: CustomIntFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'optional'>) => ICustomIntValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): CustomIntValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customBigint', typeName: TYPE_NAME, fn: (fragment: CustomBigintFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'optional'>) => ICustomBigintValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): CustomBigintValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, fn: (fragment: CustomDoubleFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'optional'>) => ICustomDoubleValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): CustomDoubleValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customDecimal', typeName: TYPE_NAME, fn: (fragment: CustomDecimalFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'optional'>) => ICustomDecimalValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): CustomDecimalValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, fn: (fragment: CustomUuidFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'optional'>) => ICustomUuidValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): CustomUuidValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, fn: (fragment: CustomLocalDateFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'optional'>) => ICustomLocalDateValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): CustomLocalDateValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, fn: (fragment: CustomLocalTimeFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'optional'>) => ICustomLocalTimeValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): CustomLocalTimeValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, fn: (fragment: CustomLocalDateTimeFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'optional'>) => ICustomLocalDateTimeValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, fn: (fragment: EqualableFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'optional'>) => IEqualableValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, fn: (fragment: EqualableFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'optional'>) => IEqualableValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, fn: (fragment: ComparableFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'optional'>) => IComparableValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): ComparableValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment(type: string, arg1: any, arg2?: any, arg3?: TypeAdapter): any /* EqualableValueSource<SOURCE, T, TYPE_NAME, 'optional'> */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        if (typeof arg1 === 'string') {
            const fragmentBuilder =  new FragmentQueryBuilder(arg1, type as CustomType, 'optional', arg3)
            return __createValueSourceFromBuilder(arg2 as (fragment: any) => AnyValueSource, fragmentBuilder, arg1, type as CustomType, 'optional', arg3)
        }
        const fragmentBuilder =  new FragmentQueryBuilder(type, undefined, 'optional', arg2 as TypeAdapter | undefined)
        return __createValueSourceFromBuilder(arg1 as (fragment: any) => AnyValueSource, fragmentBuilder, type, undefined, 'optional', arg2 as TypeAdapter | undefined)
    }

    // @ts-ignore
    private __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        __addWiths(this.__template, sqlBuilder, withs)
    }

    // @ts-ignore
    private __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        requiredTablesOrViews.add(this)
        __registerTableOrView(this.__template, sqlBuilder, requiredTablesOrViews)
    }

    // @ts-ignore
    private __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<DBColumnn>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        __registerRequiredColumn(this.__template, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }

    // @ts-ignore
    private __getOldValues(_sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return undefined
    }

    // @ts-ignore
    private __getValuesForInsert(_sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return undefined
    }

    // @ts-ignore
    private __isAllowed(_sqlBuilder: HasIsValue): boolean {
        return true
    }
}

export class View</*in|out*/ CONNECTION extends IConnection<any>, NAME extends string> extends ViewOf<NView<CONNECTION[typeof connection], NAME>> {
    constructor(name: string) {
        super(name)
    }
}
