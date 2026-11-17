import type { IView } from './utils/ITableOrView.js'
import { TableOrViewRuntime, __asTableOrViewRoot } from './internal/TableOrViewRoot.js'
import { __inCreation } from './utils/inCreation.js'
import type { TypeAdapter } from './TypeAdapter.js'
import type { AliasedTableOrView, AsAliasedForUseInLeftJoin, AsForUseInLeftJoin } from './utils/tableOrViewUtils.js'
import { __createDBColumn, __createValueSourceFromBuilder, __asOptional } from './typeSystem/valueSourceFactory.js'
import type { connection, isTableOrViewObject, source, type } from './utils/symbols.js'
import type { IConnection } from './utils/IConnection.js'
import { FragmentQueryBuilder } from './queryBuilders/FragmentQueryBuilder.js'
import type { NNoTableOrViewRequiredFrom, NSourceAllowingNoTableOrViewRequired, NView } from './utils/sourceName.js'
import { __setColumnsForLeftJoin } from './utils/leftJoinUtils.js'
import type { AnyValueSource } from './typeSystem/valueSource.js'
import type { DataTypeName, DataTypeValueSources, DataTypeInputs, DataTypeFragments } from './typeSystem/dataTypeNames.js'
import type { AnyTypeClass, IValueSource, TypeClass, ValueSource } from './typeSystem/base.js'
import type { NullableType } from './typeSystem/nullable.js'
import type { FragmentExpression } from './typeSystem/fragments.js'
import { __dataTypeClassFrom } from './typeSystem/dataTypeClasses.js'
// Registers the data types of the library (the only module with side effects)
import './typeSystem/registerDataTypes.js'
import { __adaptedTypeClassOf } from './nodes/adaptedTypeClass.js'

/** A view: at run time a TableOrViewRoot, which TypeScript doesn't see */
class ViewOf</*in|out*/ SOURCE extends NView<any, any>> extends TableOrViewRuntime implements IView<SOURCE> {
    /** For TypeScript only: what the view is, its source and its kind */
    declare readonly [isTableOrViewObject]: true
    declare [source]: SOURCE
    declare [type]: 'view'

    constructor(name: string) {
        super(name)
    }

    as<ALIAS extends string>(as: ALIAS): AliasedTableOrView<this, ALIAS> {
        const result = __inCreation(__asTableOrViewRoot(new ((this as any).constructor)()))
        result.__as = as
        __asTableOrViewRoot(this).__customizationApply?.(result)
        return result as any
    }
    forUseInLeftJoin(): AsForUseInLeftJoin<this> {
        return this.forUseInLeftJoinAs('') as any
    }
    forUseInLeftJoinAs<ALIAS extends string>(as: ALIAS): AsAliasedForUseInLeftJoin<this, ALIAS> {
        const result = __inCreation(__asTableOrViewRoot(new ((this as any).constructor)()))
        result.__as = as
        result.__forUseInLeftJoin = true
        __setColumnsForLeftJoin(result as any)
        __asTableOrViewRoot(this).__customizationApply?.(result)
        return result as any
    }

    protected column<TYPE extends DataTypeName>(name: string, type: TYPE, adapter?: TypeAdapter): DataTypeValueSources<SOURCE, 'required'>[TYPE]
    protected column<TYPE extends NullableType<any>>(name: string, type: TypeClass<TYPE>, adapter?: TypeAdapter): ValueSource<SOURCE, TYPE, 'required'>
    protected column(name: string, type: string | AnyTypeClass, adapter?: TypeAdapter): any { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        return __createDBColumn(this, name, __adaptedTypeClassOf(__dataTypeClassFrom(type), adapter))
    }

    protected optionalColumn<TYPE extends DataTypeName>(name: string, type: TYPE, adapter?: TypeAdapter): DataTypeValueSources<SOURCE, 'optional'>[TYPE]
    protected optionalColumn<TYPE extends NullableType<any>>(name: string, type: TypeClass<TYPE>, adapter?: TypeAdapter): ValueSource<SOURCE, TYPE, 'optional'>
    protected optionalColumn(name: string, type: string | AnyTypeClass, adapter?: TypeAdapter): any { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        return __asOptional(__createDBColumn(this, name, __adaptedTypeClassOf(__dataTypeClassFrom(type), adapter)))
    }

    protected virtualColumnFromFragment<TYPE extends DataTypeName>(type: TYPE, fn: (fragment: DataTypeFragments<NNoTableOrViewRequiredFrom<SOURCE>, 'required'>[TYPE]) => DataTypeInputs<NSourceAllowingNoTableOrViewRequired<SOURCE>, 'required'>[TYPE], adapter?: TypeAdapter): DataTypeValueSources<SOURCE, 'required'>[TYPE]
    protected virtualColumnFromFragment<TYPE extends NullableType<any>>(type: TypeClass<TYPE>, fn: (fragment: FragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, TYPE, 'required'>) => IValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, TYPE, 'required'>, adapter?: TypeAdapter): ValueSource<SOURCE, TYPE, 'required'>
    protected virtualColumnFromFragment(type: string | AnyTypeClass, fn: (fragment: any) => AnyValueSource, adapter?: TypeAdapter): any { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        const fragmentBuilder =  new FragmentQueryBuilder(__dataTypeClassFrom(type), 'required', adapter)
        return __createValueSourceFromBuilder(fn, fragmentBuilder, __dataTypeClassFrom(type), 'required', adapter)
    }

    protected optionalVirtualColumnFromFragment<TYPE extends DataTypeName>(type: TYPE, fn: (fragment: DataTypeFragments<NNoTableOrViewRequiredFrom<SOURCE>, 'optional'>[TYPE]) => DataTypeInputs<NSourceAllowingNoTableOrViewRequired<SOURCE>, 'optional'>[TYPE], adapter?: TypeAdapter): DataTypeValueSources<SOURCE, 'optional'>[TYPE]
    protected optionalVirtualColumnFromFragment<TYPE extends NullableType<any>>(type: TypeClass<TYPE>, fn: (fragment: FragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, TYPE, 'optional'>) => IValueSource<NSourceAllowingNoTableOrViewRequired<SOURCE>, TYPE, 'optional'>, adapter?: TypeAdapter): ValueSource<SOURCE, TYPE, 'optional'>
    protected optionalVirtualColumnFromFragment(type: string | AnyTypeClass, fn: (fragment: any) => AnyValueSource, adapter?: TypeAdapter): any { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        const fragmentBuilder =  new FragmentQueryBuilder(__dataTypeClassFrom(type), 'optional', adapter)
        return __createValueSourceFromBuilder(fn, fragmentBuilder, __dataTypeClassFrom(type), 'optional', adapter)
    }
}

export class View</*in|out*/ CONNECTION extends IConnection<any>, NAME extends string> extends ViewOf<NView<CONNECTION[typeof connection], NAME>> {
    constructor(name: string) {
        super(name)
    }
}
