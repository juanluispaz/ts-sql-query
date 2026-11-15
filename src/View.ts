import type { HasIsValue, IView, IWithView } from './utils/ITableOrView.js'
import { __addWiths, __registerRequiredColumn, __registerTableOrView, __getTableOrViewPrivate } from './utils/ITableOrView.js'
import type { TypeAdapter } from './TypeAdapter.js'
import type { AliasedTableOrView, AsAliasedForUseInLeftJoin, AsForUseInLeftJoin } from './utils/tableOrViewUtils.js'
import { __createDBColumn, __createValueSourceFromBuilder, __asOptional } from './typeSystem/valueSourceFactory.js'
import { connection, isTableOrViewObject, source, type } from './utils/symbols.js'
import type { IConnection } from './utils/IConnection.js'
import type { RawFragment } from './utils/RawFragment.js'
import { FragmentQueryBuilder } from './queryBuilders/FragmentQueryBuilder.js'
import type { NNoTableOrViewRequiredFrom, NSourceAllowingNoTableOrViewRequired, NView } from './utils/sourceName.js'
import { __setColumnsForLeftJoin } from './utils/leftJoinUtils.js'
import type { AnyValueSource } from './typeSystem/valueSource.js'
import type { BuiltInDataType, BuiltInDataTypeValueSources, BuiltInDataTypeInputs, BuiltInDataTypeFragments } from './typeSystem/builtInDataTypes.js'
import type { AnyTypeClass, IValueSource, TypeClass, ValueSource } from './typeSystem/base.js'
import type { NullableType } from './typeSystem/nullable.js'
import type { FragmentExpression } from './typeSystem/fragments.js'
import { __dataTypeClassFrom } from './typeSystem/dataTypeClasses.js'
// Registers the data types of the library (the only module with side effects)
import './typeSystem/registerDataTypes.js'

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
    protected column<TYPE extends NullableType<any>>(name: string, type: TypeClass<TYPE>, adapter?: TypeAdapter): ValueSource<SOURCE, TYPE, 'required'>
    protected column(name: string, type: string | AnyTypeClass, adapter?: TypeAdapter): any { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        return __createDBColumn(this, name, __dataTypeClassFrom(type), adapter)
    }

    protected optionalColumn<TYPE extends BuiltInDataType>(name: string, type: TYPE, adapter?: TypeAdapter): BuiltInDataTypeValueSources<SOURCE, 'optional'>[TYPE]
    protected optionalColumn<TYPE extends NullableType<any>>(name: string, type: TypeClass<TYPE>, adapter?: TypeAdapter): ValueSource<SOURCE, TYPE, 'optional'>
    protected optionalColumn(name: string, type: string | AnyTypeClass, adapter?: TypeAdapter): any { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        return __asOptional(__createDBColumn(this, name, __dataTypeClassFrom(type), adapter))
    }

    protected virtualColumnFromFragment<TYPE extends BuiltInDataType>(type: TYPE, fn: (fragment: BuiltInDataTypeFragments<NNoTableOrViewRequiredFrom<SOURCE>, 'required'>[TYPE]) => BuiltInDataTypeInputs<NSourceAllowingNoTableOrViewRequired<SOURCE>, 'required'>[TYPE], adapter?: TypeAdapter): BuiltInDataTypeValueSources<SOURCE, 'required'>[TYPE]
    protected virtualColumnFromFragment<TYPE extends NullableType<any>>(type: TypeClass<TYPE>, fn: (fragment: FragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, TYPE, 'required'>) => IValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, TYPE, 'required'>, adapter?: TypeAdapter): ValueSource<SOURCE, TYPE, 'required'>
    protected virtualColumnFromFragment(type: string | AnyTypeClass, fn: (fragment: any) => AnyValueSource, adapter?: TypeAdapter): any { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        const fragmentBuilder =  new FragmentQueryBuilder(__dataTypeClassFrom(type), 'required', adapter)
        return __createValueSourceFromBuilder(fn, fragmentBuilder, __dataTypeClassFrom(type), 'required', adapter)
    }

    protected optionalVirtualColumnFromFragment<TYPE extends BuiltInDataType>(type: TYPE, fn: (fragment: BuiltInDataTypeFragments<NNoTableOrViewRequiredFrom<SOURCE>, 'optional'>[TYPE]) => BuiltInDataTypeInputs<NSourceAllowingNoTableOrViewRequired<SOURCE>, 'optional'>[TYPE], adapter?: TypeAdapter): BuiltInDataTypeValueSources<SOURCE, 'optional'>[TYPE]
    protected optionalVirtualColumnFromFragment<TYPE extends NullableType<any>>(type: TypeClass<TYPE>, fn: (fragment: FragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, TYPE, 'optional'>) => IValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, TYPE, 'optional'>, adapter?: TypeAdapter): ValueSource<SOURCE, TYPE, 'optional'>
    protected optionalVirtualColumnFromFragment(type: string | AnyTypeClass, fn: (fragment: any) => AnyValueSource, adapter?: TypeAdapter): any { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        const fragmentBuilder =  new FragmentQueryBuilder(__dataTypeClassFrom(type), 'optional', adapter)
        return __createValueSourceFromBuilder(fn, fragmentBuilder, __dataTypeClassFrom(type), 'optional', adapter)
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
