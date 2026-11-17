import type { AnyTableOrView, HasIsValue, IValues, IWithView, NoTableOrViewRequiredOfSameDB } from './utils/ITableOrView.js'
import { TableOrViewRoot, __asTableOrViewRoot } from './internal/TableOrViewRoot.js'
import type { TypeAdapter } from './TypeAdapter.js'
import type { AliasedTableOrView, AsAliasedForUseInLeftJoin, AsForUseInLeftJoin } from './utils/tableOrViewUtils.js'
import type { Column } from './utils/Column.js'
import { __flattenSets } from './utils/columnPaths.js'
import { __createDBColumn, __createValueSourceFromBuilder, __asColumn, __asOptionalColumn, __isColumn, __asDBColumnValueSource, __asNodeValueSource, __inCreation, isValueSource } from './typeSystem/valueSourceFactory.js'
import type { connection, dontCallConstructor, isTableOrViewObject, source, type } from './utils/symbols.js'
import type { IConnection } from './utils/IConnection.js'
import { FragmentQueryBuilder } from './queryBuilders/FragmentQueryBuilder.js'
import type { MandatoryInsertSets } from './expressions/insert.js'
import type { NDBWithType, NGetNameFrom, NNoTableOrViewRequiredFrom, NSourceAllowingNoTableOrViewRequired, NValues } from './utils/sourceName.js'
import { __setColumnsForLeftJoin } from './utils/leftJoinUtils.js'
import type { QueryColumns, WithValuesData } from './sqlBuilders/SqlBuilder.js'
import { isUsableValue } from './sqlBuilders/SqlBuilder.js'
import { TsSqlProcessingError } from './TsSqlError.js'
import type { AnyValueSource } from './typeSystem/valueSource.js'
import type { DataTypeName, DataTypeValueSources, DataTypeInputs, DataTypeFragments } from './typeSystem/dataTypeNames.js'
import type { AnyTypeClass, IValueSource, TypeClass, ValueSource } from './typeSystem/base.js'
import type { NullableType } from './typeSystem/nullable.js'
import type { FragmentExpression } from './typeSystem/fragments.js'
import { __dataTypeClassFrom } from './typeSystem/dataTypeClasses.js'
// Registers the data types of the library (the only module with side effects)
import './typeSystem/registerDataTypes.js'
import { __adaptedTypeClassOf } from './nodes/adaptedTypeClass.js'

/**
 * Values at run time: a TableOrViewRoot with its rows, written as a `with`. ValuesOf extends it through a cast TypeScript
 * doesn't see, so the public type has only what ValuesOf declares
 */
class ValuesRoot extends TableOrViewRoot implements WithValuesData {
    /** The rows, each one with the value of every column */
    readonly __values: object[]
    /** The values a copy (`as`, `forUseInLeftJoinAs`) was made from: the `with` the query writes */
    declare readonly __source?: ValuesRoot | undefined

    constructor(name: string, values: object[]) {
        super(name)
        this.__values = values
    }

    /** A copy with the same rows, written with the `with` of the values it was made from */
    __copy(): ValuesRoot {
        const result = __inCreation(new (this.constructor as new (name: string, values: object[]) => ValuesRoot)(this.__name, this.__values))
        result.__source = this.__source || this
        result.__setColumnsName(result as any, '')
        return result
    }

    override __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        // The values are one `with`, the one of the values a copy was made from: written once, however many copies of them
        // the query uses (a self-join of the values with a copy of them)
        const target = (this.__source || this) as any
        if (!withs.includes(target)) {
            withs.push(target)
        }
        super.__addWiths(sqlBuilder, withs)
    }

    /** Each column is named by its path in the values, which is how the rows give its value */
    __setColumnsName(columns: QueryColumns, prefix: string): void {
        for (const prop in columns) {
            const column = columns[prop]!
            if (!isUsableValue(prop, column, columns)) {
                continue
            }
            if (__isColumn(column)) {
                const nodeColumn = __asDBColumnValueSource(column)
                // The columns of the values being created
                __inCreation(nodeColumn).__name = prefix + prop
            } else if (isValueSource(column)) {
                continue // Computed value
            } else {
                this.__setColumnsName(column, prefix + prop + '.')
            }
        }
    }

    __getTableOrView(): AnyTableOrView {
        return this
    }
}

const ValuesRuntime = ValuesRoot as unknown as abstract new (name: string, values: object[]) => object

/** Values: at run time a ValuesRoot, which TypeScript doesn't see */
class ValuesOf</*in|out*/ SOURCE extends NValues<any, any>> extends ValuesRuntime implements IValues<SOURCE> {
    /** For TypeScript only: what the values are, their source and their kind */
    declare readonly [isTableOrViewObject]: true
    declare [source]: SOURCE
    declare [type]: 'values'

    constructor(name: string, values: object[]) {
        super(name, values)
    }

    as<ALIAS extends string>(as: ALIAS): AliasedTableOrView<this, ALIAS> {
        const result = __inCreation((this as unknown as ValuesRoot).__copy())
        result.__as = as
        __asTableOrViewRoot(this).__customizationApply?.(result)
        return result as any
    }
    forUseInLeftJoin(): AsForUseInLeftJoin<this> {
        return this.forUseInLeftJoinAs('') as any
    }
    forUseInLeftJoinAs<ALIAS extends string>(as: ALIAS): AsAliasedForUseInLeftJoin<this, ALIAS> {
        const result = __inCreation((this as unknown as ValuesRoot).__copy())
        result.__as = as
        result.__forUseInLeftJoin = true
        __setColumnsForLeftJoin(result as any)
        __asTableOrViewRoot(this).__customizationApply?.(result)
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
}

export class Values</*in|out*/ CONNECTION extends IConnection<NDBWithType<'postgreSql' | 'sqlite' | 'sqlServer' | 'oracle' | 'mariaDB' | 'mySql' | 'noopDB'>>, /*in|out*/ NAME extends string> extends ValuesOf<NValues<CONNECTION[typeof connection], NAME>> {
    constructor(name: NAME, values: OpaqueValues) {
        super(name, values as any)
    }

    static create<T extends IValues<any>>(type: new (name: NGetNameFrom<T[typeof source]>, values: OpaqueValues) => T, name: NGetNameFrom<T[typeof source]>, values: Array<MandatoryInsertSets<T, NoTableOrViewRequiredOfSameDB<T> | T, undefined>>): T {
        if (values.length <= 0) {
            throw new TsSqlProcessingError({ reason: 'CONSTANT_VALUES_VIEW_CANNOT_BE_EMPTY' }, 'Values requires at least one element in the list')
        }
        const result = new type(name, values as any)
        const valuesRoot = result as unknown as ValuesRoot
        valuesRoot.__setColumnsName(result as any, '')
        // The rows, with the columns named by their path
        __inCreation(valuesRoot).__values = (values as any[]).map(row => __flattenSets(result, undefined, row))
        return result
    }
}

export interface OpaqueValues {
    [dontCallConstructor]: 'use Values.create(type, name, values) instead'
}