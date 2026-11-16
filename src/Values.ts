import type { HasIsValue, IValues, IWithView, NoTableOrViewRequiredOfSameDB } from './utils/ITableOrView.js'
import { __addWiths, __registerRequiredColumn, __registerTableOrView, __getTableOrViewPrivate } from './utils/ITableOrView.js'
import type { TypeAdapter } from './TypeAdapter.js'
import type { AliasedTableOrView, AsAliasedForUseInLeftJoin, AsForUseInLeftJoin } from './utils/tableOrViewUtils.js'
import type { Column } from './utils/Column.js'
import { __getColumnPrivate } from './utils/Column.js'
import { __flattenSets } from './utils/columnPaths.js'
import { __createDBColumn, __createValueSourceFromBuilder, __asColumn, __asOptionalColumn, __isColumn } from './typeSystem/valueSourceFactory.js'
import { connection, dontCallConstructor, isTableOrViewObject, source, type } from './utils/symbols.js'
import type { IConnection } from './utils/IConnection.js'
import type { RawFragment } from './utils/RawFragment.js'
import { FragmentQueryBuilder } from './queryBuilders/FragmentQueryBuilder.js'
import type { MandatoryInsertSets } from './expressions/insert.js'
import type { NDBWithType, NGetNameFrom, NNoTableOrViewRequiredFrom, NSourceAllowingNoTableOrViewRequired, NValues } from './utils/sourceName.js'
import { __setColumnsForLeftJoin } from './utils/leftJoinUtils.js'
import type { QueryColumns } from './sqlBuilders/SqlBuilder.js'
import { isUsableValue } from './sqlBuilders/SqlBuilder.js'
import { TsSqlProcessingError } from './TsSqlError.js'
import type { AnyValueSource } from './typeSystem/valueSource.js'
import { __getValueSourcePrivate, isValueSource } from './typeSystem/valueSource.js'
import type { DataTypeName, DataTypeValueSources, DataTypeInputs, DataTypeFragments } from './typeSystem/dataTypeNames.js'
import type { AnyTypeClass, IValueSource, TypeClass, ValueSource } from './typeSystem/base.js'
import type { NullableType } from './typeSystem/nullable.js'
import type { FragmentExpression } from './typeSystem/fragments.js'
import { __dataTypeClassFrom } from './typeSystem/dataTypeClasses.js'
// Registers the data types of the library (the only module with side effects)
import './typeSystem/registerDataTypes.js'
import { __adaptedTypeClassOf } from './nodes/adaptedTypeClass.js'

class ValuesOf</*in|out*/ SOURCE extends NValues<any, any>> implements IValues<SOURCE> {
    [isTableOrViewObject]: true = true;
    [source]!: SOURCE
    [type]!: 'values'
    /* implements __ITableOrViewPrivate and WithValuesData as private members*/
    // @ts-ignore
    private __name: string
    // @ts-ignore
    private __as?: string
    // @ts-ignore
    private __forUseInLeftJoin?: boolean
    // @ts-ignore
    private __type: 'values' = 'values'
    // @ts-ignore
    private __template?: RawFragment<any>
    // @ts-ignore
    private __values: object[]

    private __source?: this

    constructor(name: string, values: object[]) {
        this.__name = name
        this.__values = values
    }

    as<ALIAS extends string>(as: ALIAS): AliasedTableOrView<this, ALIAS> {
        const result = new ((this as any).constructor)(this.__name, this.__values) as ValuesOf<any>
        result.__as = as
        result.__source = this.__source || this
        result.__setColumnsName(result as any, '')
        __getTableOrViewPrivate(this).__customizationApply?.(result)
        return result as any
    }
    forUseInLeftJoin(): AsForUseInLeftJoin<this> {
        return this.forUseInLeftJoinAs('') as any
    }
    forUseInLeftJoinAs<ALIAS extends string>(as: ALIAS): AsAliasedForUseInLeftJoin<this, ALIAS> {
        const result = new ((this as any).constructor)(this.__name, this.__values) as ValuesOf<any>
        result.__as = as
        result.__forUseInLeftJoin = true
        result.__source = this.__source || this
        result.__setColumnsName(result as any, '')
        __setColumnsForLeftJoin(result as any)
        __getTableOrViewPrivate(this).__customizationApply?.(result)
        return result as any
    }

    protected column<TYPE extends DataTypeName>(type: TYPE, adapter?: TypeAdapter): DataTypeValueSources<SOURCE, 'required'>[TYPE] & Column
    protected column<TYPE extends NullableType<any>>(type: TypeClass<TYPE>, adapter?: TypeAdapter): ValueSource<SOURCE, TYPE, 'required'> & Column
    protected column(type: string | AnyTypeClass, adapter?: TypeAdapter): any { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        // A `Values` view is writable: each real column receives a value in the
        // provided rows, so it must carry the writable-column marker (like a
        // table column, not a read-only view column). `__asColumn()` sets it,
        // matching `optionalColumn` below. See `Column.ts` for the model.
        return __asColumn(__createDBColumn(this, '', __adaptedTypeClassOf(__dataTypeClassFrom(type), adapter)))
    }

    protected optionalColumn<TYPE extends DataTypeName>(type: TYPE, adapter?: TypeAdapter): DataTypeValueSources<SOURCE, 'optional'>[TYPE] & Column
    protected optionalColumn<TYPE extends NullableType<any>>(type: TypeClass<TYPE>, adapter?: TypeAdapter): ValueSource<SOURCE, TYPE, 'optional'> & Column
    protected optionalColumn(type: string | AnyTypeClass, adapter?: TypeAdapter): any { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        return __asOptionalColumn(__createDBColumn(this, '', __adaptedTypeClassOf(__dataTypeClassFrom(type), adapter)))
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

    // @ts-ignore
    private __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        // The single WITH is defined by the canonical source view: for a `.as(alias)` /
        // `forUseInLeftJoinAs(alias)` clone that is `__source` (the original), for the
        // original it is `this`. Guard against pushing it more than once, so a `Values`
        // referenced multiple times in the same query (e.g. self-joined to its own clone)
        // hoists the WITH clause a single time instead of once per reference. Mirrors
        // `WithViewImpl.__addWiths`, whose `__originalWith` delegation + `!withs.includes`
        // guard does the same for a regular `with(...)` view.
        const target = (this.__source || this) as any
        if (!withs.includes(target)) {
            withs.push(target)
        }
        __addWiths(this.__template, sqlBuilder, withs)
    }

    // @ts-ignore
    private __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        requiredTablesOrViews.add(this)
        __registerTableOrView(this.__template, sqlBuilder, requiredTablesOrViews)
    }

    // @ts-ignore
    private __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        __registerRequiredColumn(this.__template, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }

    // @ts-ignore
    private __getOldValues(_sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return undefined
    }

    // @ts-ignore
    private __getValuesForInsert(_sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return undefined
    }

    // @ts-ignore
    private __isAllowed(_sqlBuilder: HasIsValue): boolean {
        return true
    }

    private __setColumnsName(columns: QueryColumns, prefix: string): void {
        for (const prop in columns) {
            const column = columns[prop]!
            if (!isUsableValue(prop, column, columns)) {
                continue
            }
            if (__isColumn(column)) {
                const columnPrivate = __getColumnPrivate(column)
                columnPrivate.__name = prefix + prop
            } else if (isValueSource(column)) {
                continue // Computed value
            } else {
                this.__setColumnsName(column, prefix + prop + '.')
            }
        }
    }

    // @ts-ignore
    private __getTableOrView(): AnyTableOrView {
        return this
    }
}

export class Values</*in|out*/ CONNECTION extends IConnection<NDBWithType<'postgreSql' | 'sqlite' | 'sqlServer' | 'oracle' | 'mariaDB' | 'mySql' | 'noopDB'>>, /*in|out*/ NAME extends string> extends ValuesOf<NValues<CONNECTION[typeof connection], NAME>> {
    constructor(name: NAME, values: OpaqueValues) {
        super(name, values as any)
    }

    static create<T extends IValues<any>>(type: new (name: NGetNameFrom<T[typeof source]>, values: OpaqueValues) => T, name: NGetNameFrom<T[typeof source]>, values: Array<MandatoryInsertSets<T, NoTableOrViewRequiredOfSameDB<T> | T, undefined>>): T {
        if (values.length <= 0) {
            throw new TsSqlProcessingError({ reason: 'CONSTANT_VALUES_VIEW_CANNOT_BE_EMPTY' }, 'Values requires at least one element in the list')
        }
        const result = new type(name, values as any);
        (result as any).__setColumnsName(result as any, '');
        (result as any).__values = (values as any[]).map(row => __flattenSets(result, undefined, row))
        return result
    }
}

export interface OpaqueValues {
    [dontCallConstructor]: 'use Values.create(type, name, values) instead'
}