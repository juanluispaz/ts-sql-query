import { BooleanValueSource, NumberValueSource, StringValueSource, LocalDateValueSource, LocalTimeValueSource, LocalDateTimeValueSource, EqualableValueSource, ComparableValueSource, BigintValueSource, __getValueSourcePrivate, UuidValueSource, IBooleanValueSource, INumberValueSource, IBigintValueSource, IStringValueSource, IUuidValueSource, ILocalDateValueSource, ILocalTimeValueSource, ILocalDateTimeValueSource, IEqualableValueSource, IComparableValueSource, AnyValueSource, ValueType, CustomIntValueSource, CustomDoubleValueSource, CustomUuidValueSource, CustomLocalDateTimeValueSource, ICustomIntValueSource, ICustomDoubleValueSource, ICustomUuidValueSource, ICustomLocalDateValueSource, ICustomLocalTimeValueSource, ICustomLocalDateTimeValueSource, CustomLocalDateValueSource, CustomLocalTimeValueSource, isValueSource } from "./expressions/values"
import { HasIsValue, IValues, IWithView, NoTableOrViewRequiredOfSameDB, __addWiths, __registerRequiredColumn, __registerTableOrView } from "./utils/ITableOrView"
import type { TypeAdapter } from "./TypeAdapter"
import type { AliasedTableOrView, AsAliasedForUseInLeftJoin, AsForUseInLeftJoin } from "./utils/tableOrViewUtils"
import { __getColumnPrivate, isColumn } from "./utils/Column"
import { DBColumnImpl } from "./internal/DBColumnImpl"
import { connection, dontCallConstructor, isTableOrViewObject, source, type } from "./utils/symbols"
import { IConnection } from "./utils/IConnection"
import type { RawFragment } from "./utils/RawFragment"
import type { BigintFragmentExpression, BooleanFragmentExpression, ComparableFragmentExpression, CustomDoubleFragmentExpression, CustomIntFragmentExpression, CustomLocalDateFragmentExpression, CustomLocalDateTimeFragmentExpression, CustomLocalTimeFragmentExpression, CustomUuidFragmentExpression, LocalDateFragmentExpression, LocalDateTimeFragmentExpression, EqualableFragmentExpression, NumberFragmentExpression, StringFragmentExpression, LocalTimeFragmentExpression, UuidFragmentExpression } from "./expressions/fragment"
import { ValueSourceFromBuilder } from "./internal/ValueSourceImpl"
import { FragmentQueryBuilder } from "./queryBuilders/FragmentQueryBuilder"
import { MandatoryInsertSets } from "./expressions/insert"
import { NDBWithType, NGetNameFrom, NNoTableOrViewRequiredFrom, NValues } from "./utils/sourceName"
import { __setColumnsForLeftJoin } from './utils/leftJoinUtils'
import { QueryColumns, isUsableValue } from './sqlBuilders/SqlBuilder'

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
        result.__setColumnsName(this as any, '')
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
        result.__setColumnsName(this as any, '')
        __setColumnsForLeftJoin(result as any)
        return result as any
    }

    protected column(type: 'boolean', adapter?: TypeAdapter): BooleanValueSource<SOURCE, 'required'>
    protected column(type: 'int', adapter?: TypeAdapter): NumberValueSource<SOURCE, 'required'>
    protected column(type: 'bigint', adapter?: TypeAdapter): BigintValueSource<SOURCE, 'required'>
    protected column(type: 'double', adapter?: TypeAdapter): NumberValueSource<SOURCE, 'required'>
    protected column(type: 'string', adapter?: TypeAdapter): StringValueSource<SOURCE, 'required'>
    protected column(type: 'uuid', adapter?: TypeAdapter): UuidValueSource<SOURCE, 'required'>
    protected column(type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource<SOURCE, 'required'>
    protected column(type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource<SOURCE, 'required'>
    protected column(type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource<SOURCE, 'required'>
    protected column<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected column<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected column<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected column<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected column<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected column<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected column<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected column<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected column<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected column<T>(type: 'customInt', typeName: string, adapter?: TypeAdapter): CustomIntValueSource<SOURCE, T, T, 'required'>
    protected column<T>(type: 'customDouble', typeName: string, adapter?: TypeAdapter): CustomDoubleValueSource<SOURCE, T, T, 'required'>
    protected column<T>(type: 'customUuid', typeName: string, adapter?: TypeAdapter): CustomUuidValueSource<SOURCE, T, T, 'required'>
    protected column<T>(type: 'customLocalDate', typeName: string, adapter?: TypeAdapter): CustomLocalDateValueSource<SOURCE, T, T, 'required'>
    protected column<T>(type: 'customLocalTime', typeName: string, adapter?: TypeAdapter): CustomLocalTimeValueSource<SOURCE, T, T, 'required'>
    protected column<T>(type: 'customLocalDateTime', typeName: string, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<SOURCE, T, T, 'required'>
    protected column<T>(type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, T, 'required'>
    protected column<T>(type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, T, 'required'>
    protected column<T>(type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<SOURCE, T, T, 'required'>
    protected column(type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any /* EqualableValueSource<SOURCE, T, TYPE_NAME, 'required'> */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        if (typeof adapter === 'string') {
            return new DBColumnImpl(this, '', type as ValueType, adapter, adapter2)
        }
        return new DBColumnImpl(this, '', type as ValueType, type, adapter)
    }

    protected optionalColumn(type: 'boolean', adapter?: TypeAdapter): BooleanValueSource<SOURCE, 'optional'>
    protected optionalColumn(type: 'int', adapter?: TypeAdapter): NumberValueSource<SOURCE, 'optional'>
    protected optionalColumn(type: 'bigint', adapter?: TypeAdapter): BigintValueSource<SOURCE, 'optional'>
    protected optionalColumn(type: 'double', adapter?: TypeAdapter): NumberValueSource<SOURCE, 'optional'>
    protected optionalColumn(type: 'string', adapter?: TypeAdapter): StringValueSource<SOURCE, 'optional'>
    protected optionalColumn(type: 'uuid', adapter?: TypeAdapter): UuidValueSource<SOURCE, 'optional'>
    protected optionalColumn(type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource<SOURCE, 'optional'>
    protected optionalColumn(type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource<SOURCE, 'optional'>
    protected optionalColumn(type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource<SOURCE, 'optional'>
    protected optionalColumn<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalColumn<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalColumn<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalColumn<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalColumn<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalColumn<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalColumn<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalColumn<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalColumn<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalColumn<T>(type: 'customInt', typeName: string, adapter?: TypeAdapter): CustomIntValueSource<SOURCE, T, T, 'optional'>
    protected optionalColumn<T>(type: 'customDouble', typeName: string, adapter?: TypeAdapter): CustomDoubleValueSource<SOURCE, T, T, 'optional'>
    protected optionalColumn<T>(type: 'customUuid', typeName: string, adapter?: TypeAdapter): CustomUuidValueSource<SOURCE, T, T, 'optional'>
    protected optionalColumn<T>(type: 'customLocalDate', typeName: string, adapter?: TypeAdapter): CustomLocalDateValueSource<SOURCE, T, T, 'optional'>
    protected optionalColumn<T>(type: 'customLocalTime', typeName: string, adapter?: TypeAdapter): CustomLocalTimeValueSource<SOURCE, T, T, 'optional'>
    protected optionalColumn<T>(type: 'customLocalDateTime', typeName: string, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<SOURCE, T, T, 'optional'>
    protected optionalColumn<T>(type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, T, 'optional'>
    protected optionalColumn<T>(type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, T, 'optional'>
    protected optionalColumn<T>(type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<SOURCE, T, T, 'optional'>
    protected optionalColumn(type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any /* EqualableValueSource<SOURCE, T, TYPE_NAME, 'optional'> */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        if (typeof adapter === 'string') {
            return (new DBColumnImpl(this, '', type as ValueType, adapter, adapter2)).__asOptionalColumn()
        }
        return (new DBColumnImpl(this, '', type as ValueType, type, adapter)).__asOptionalColumn()
    }

    protected virtualColumnFromFragment(type: 'boolean', fn: (fragment: BooleanFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, 'required'>) => IBooleanValueSource<SOURCE, 'required'>, adapter?: TypeAdapter): BooleanValueSource<SOURCE, 'required'>
    protected virtualColumnFromFragment(type: 'int', fn: (fragment: NumberFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, 'required'>) => INumberValueSource<SOURCE, 'required'>, adapter?: TypeAdapter): NumberValueSource<SOURCE, 'required'>
    protected virtualColumnFromFragment(type: 'bigint', fn: (fragment: BigintFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, 'required'>) => IBigintValueSource<SOURCE, 'required'>, adapter?: TypeAdapter): BigintValueSource<SOURCE, 'required'>
    protected virtualColumnFromFragment(type: 'double', fn: (fragment: NumberFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, 'required'>) => INumberValueSource<SOURCE, 'required'>, adapter?: TypeAdapter): NumberValueSource<SOURCE, 'required'>
    protected virtualColumnFromFragment(type: 'string', fn: (fragment: StringFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, 'required'>) => IStringValueSource<SOURCE, 'required'>, adapter?: TypeAdapter): StringValueSource<SOURCE, 'required'>
    protected virtualColumnFromFragment(type: 'uuid', fn: (fragment: UuidFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, 'required'>) => IUuidValueSource<SOURCE, 'required'>, adapter?: TypeAdapter): UuidValueSource<SOURCE, 'required'>
    protected virtualColumnFromFragment(type: 'localDate', fn: (fragment: LocalDateFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, 'required'>) => ILocalDateValueSource<SOURCE, 'required'>, adapter?: TypeAdapter): LocalDateValueSource<SOURCE, 'required'>
    protected virtualColumnFromFragment(type: 'localTime', fn: (fragment: LocalTimeFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, 'required'>) => ILocalTimeValueSource<SOURCE, 'required'>, adapter?: TypeAdapter): LocalTimeValueSource<SOURCE, 'required'>
    protected virtualColumnFromFragment(type: 'localDateTime', fn: (fragment: LocalDateTimeFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, 'required'>) => ILocalDateTimeValueSource<SOURCE, 'required'>, adapter?: TypeAdapter): LocalDateTimeValueSource<SOURCE, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, fn: (fragment: CustomIntFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'required'>) => ICustomIntValueSource<SOURCE, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): CustomIntValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, fn: (fragment: CustomDoubleFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'required'>) => ICustomDoubleValueSource<SOURCE, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): CustomDoubleValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, fn: (fragment: CustomUuidFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'required'>) => ICustomUuidValueSource<SOURCE, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): CustomUuidValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, fn: (fragment: CustomLocalDateFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'required'>) => ICustomLocalDateValueSource<SOURCE, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): CustomLocalDateValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, fn: (fragment: CustomLocalTimeFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'required'>) => ICustomLocalTimeValueSource<SOURCE, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): CustomLocalTimeValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, fn: (fragment: CustomLocalDateTimeFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'required'>) => ICustomLocalDateTimeValueSource<SOURCE, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, fn: (fragment: EqualableFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'required'>) => IEqualableValueSource<SOURCE, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, fn: (fragment: EqualableFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'required'>) => IEqualableValueSource<SOURCE, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, fn: (fragment: ComparableFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'required'>) => IComparableValueSource<SOURCE, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): ComparableValueSource<SOURCE, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T>(type: 'customInt', typeName: string, fn: (fragment: CustomIntFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, T, 'required'>) => ICustomIntValueSource<SOURCE, T, T, 'required'>, adapter?: TypeAdapter): CustomIntValueSource<SOURCE, T, T, 'required'>
    protected virtualColumnFromFragment<T>(type: 'customDouble', typeName: string, fn: (fragment: CustomDoubleFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, T, 'required'>) => ICustomDoubleValueSource<SOURCE, T, T, 'required'>, adapter?: TypeAdapter): CustomDoubleValueSource<SOURCE, T, T, 'required'>
    protected virtualColumnFromFragment<T>(type: 'customUuid', typeName: string, fn: (fragment: CustomUuidFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, T, 'required'>) => ICustomUuidValueSource<SOURCE, T, T, 'required'>, adapter?: TypeAdapter): CustomUuidValueSource<SOURCE, T, T, 'required'>
    protected virtualColumnFromFragment<T>(type: 'customLocalDate', typeName: string, fn: (fragment: CustomLocalDateFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, T, 'required'>) => ICustomLocalDateValueSource<SOURCE, T, T, 'required'>, adapter?: TypeAdapter): CustomLocalDateValueSource<SOURCE, T, T, 'required'>
    protected virtualColumnFromFragment<T>(type: 'customLocalTime', typeName: string, fn: (fragment: CustomLocalTimeFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, T, 'required'>) => ICustomLocalTimeValueSource<SOURCE, T, T, 'required'>, adapter?: TypeAdapter): CustomLocalTimeValueSource<SOURCE, T, T, 'required'>
    protected virtualColumnFromFragment<T>(type: 'customLocalDateTime', typeName: string, fn: (fragment: CustomLocalDateTimeFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, T, 'required'>) => ICustomLocalDateTimeValueSource<SOURCE, T, T, 'required'>, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<SOURCE, T, T, 'required'>
    protected virtualColumnFromFragment<T>(type: 'enum', typeName: string, fn: (fragment: EqualableFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, T, 'required'>) => IEqualableValueSource<SOURCE, T, T, 'required'>, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, T, 'required'>
    protected virtualColumnFromFragment<T>(type: 'custom', typeName: string, fn: (fragment: EqualableFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, T, 'required'>) => IEqualableValueSource<SOURCE, T, T, 'required'>, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, T, 'required'>
    protected virtualColumnFromFragment<T>(type: 'customComparable', typeName: string, fn: (fragment: ComparableFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, T, 'required'>) => IComparableValueSource<SOURCE, T, T, 'required'>, adapter?: TypeAdapter): ComparableValueSource<SOURCE, T, T, 'required'>
    protected virtualColumnFromFragment(type: string, arg1: any, arg2?: any, arg3?: TypeAdapter): any /* EqualableValueSource<SOURCE, T, TYPE_NAME, 'required'> */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        if (typeof arg1 === 'string') {
            const fragmentBuilder =  new FragmentQueryBuilder(type as ValueType, arg1, 'required', arg3)
            return new ValueSourceFromBuilder(arg2 as (fragment: any) => AnyValueSource, fragmentBuilder, type as ValueType, arg1, 'required', arg3)
        }
        const fragmentBuilder =  new FragmentQueryBuilder(type as ValueType, type, 'required', arg2 as TypeAdapter | undefined)
        return new ValueSourceFromBuilder(arg1 as (fragment: any) => AnyValueSource, fragmentBuilder, type as ValueType, type, 'required', arg2 as TypeAdapter | undefined)
    }

    protected optionalVirtualColumnFromFragment(type: 'boolean', fn: (fragment: BooleanFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, 'optional'>) => IBooleanValueSource<SOURCE, 'optional'>, adapter?: TypeAdapter): BooleanValueSource<SOURCE, 'optional'>
    protected optionalVirtualColumnFromFragment(type: 'int', fn: (fragment: NumberFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, 'optional'>) => INumberValueSource<SOURCE, 'optional'>, adapter?: TypeAdapter): NumberValueSource<SOURCE, 'optional'>
    protected optionalVirtualColumnFromFragment(type: 'bigint', fn: (fragment: BigintFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, 'optional'>) => IBigintValueSource<SOURCE, 'optional'>, adapter?: TypeAdapter): BigintValueSource<SOURCE, 'optional'>
    protected optionalVirtualColumnFromFragment(type: 'double', fn: (fragment: NumberFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, 'optional'>) => INumberValueSource<SOURCE, 'optional'>, adapter?: TypeAdapter): NumberValueSource<SOURCE, 'optional'>
    protected optionalVirtualColumnFromFragment(type: 'string', fn: (fragment: StringFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, 'optional'>) => IStringValueSource<SOURCE, 'optional'>, adapter?: TypeAdapter): StringValueSource<SOURCE, 'optional'>
    protected optionalVirtualColumnFromFragment(type: 'uuid', fn: (fragment: UuidFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, 'optional'>) => IUuidValueSource<SOURCE, 'optional'>, adapter?: TypeAdapter): UuidValueSource<SOURCE, 'optional'>
    protected optionalVirtualColumnFromFragment(type: 'localDate', fn: (fragment: LocalDateFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, 'optional'>) => ILocalDateValueSource<SOURCE, 'optional'>, adapter?: TypeAdapter): LocalDateValueSource<SOURCE, 'optional'>
    protected optionalVirtualColumnFromFragment(type: 'localTime', fn: (fragment: LocalTimeFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, 'optional'>) => ILocalTimeValueSource<SOURCE, 'optional'>, adapter?: TypeAdapter): LocalTimeValueSource<SOURCE, 'optional'>
    protected optionalVirtualColumnFromFragment(type: 'localDateTime', fn: (fragment: LocalDateTimeFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, 'optional'>) => ILocalDateTimeValueSource<SOURCE, 'optional'>, adapter?: TypeAdapter): LocalDateTimeValueSource<SOURCE, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, fn: (fragment: CustomIntFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'optional'>) => ICustomIntValueSource<SOURCE, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): CustomIntValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, fn: (fragment: CustomDoubleFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'optional'>) => ICustomDoubleValueSource<SOURCE, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): CustomDoubleValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, fn: (fragment: CustomUuidFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'optional'>) => ICustomUuidValueSource<SOURCE, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): CustomUuidValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, fn: (fragment: CustomLocalDateFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'optional'>) => ICustomLocalDateValueSource<SOURCE, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): CustomLocalDateValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, fn: (fragment: CustomLocalTimeFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'optional'>) => ICustomLocalTimeValueSource<SOURCE, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): CustomLocalTimeValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, fn: (fragment: CustomLocalDateTimeFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'optional'>) => ICustomLocalDateTimeValueSource<SOURCE, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, fn: (fragment: EqualableFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'optional'>) => IEqualableValueSource<SOURCE, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, fn: (fragment: EqualableFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'optional'>) => IEqualableValueSource<SOURCE, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, fn: (fragment: ComparableFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, TYPE_NAME, 'optional'>) => IComparableValueSource<SOURCE, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): ComparableValueSource<SOURCE, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T>(type: 'customInt', typeName: string, fn: (fragment: CustomIntFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, T, 'optional'>) => ICustomIntValueSource<SOURCE, T, T, 'optional'>, adapter?: TypeAdapter): CustomIntValueSource<SOURCE, T, T, 'optional'>
    protected optionalVirtualColumnFromFragment<T>(type: 'customDouble', typeName: string, fn: (fragment: CustomDoubleFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, T, 'optional'>) => ICustomDoubleValueSource<SOURCE, T, T, 'optional'>, adapter?: TypeAdapter): CustomDoubleValueSource<SOURCE, T, T, 'optional'>
    protected optionalVirtualColumnFromFragment<T>(type: 'customUuid', typeName: string, fn: (fragment: CustomUuidFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, T, 'optional'>) => ICustomUuidValueSource<SOURCE, T, T, 'optional'>, adapter?: TypeAdapter): CustomUuidValueSource<SOURCE, T, T, 'optional'>
    protected optionalVirtualColumnFromFragment<T>(type: 'customLocalDate', typeName: string, fn: (fragment: CustomLocalDateFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, T, 'optional'>) => ICustomLocalDateValueSource<SOURCE, T, T, 'optional'>, adapter?: TypeAdapter): CustomLocalDateValueSource<SOURCE, T, T, 'optional'>
    protected optionalVirtualColumnFromFragment<T>(type: 'customLocalTime', typeName: string, fn: (fragment: CustomLocalTimeFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, T, 'optional'>) => ICustomLocalTimeValueSource<SOURCE, T, T, 'optional'>, adapter?: TypeAdapter): CustomLocalTimeValueSource<SOURCE, T, T, 'optional'>
    protected optionalVirtualColumnFromFragment<T>(type: 'customLocalDateTime', typeName: string, fn: (fragment: CustomLocalDateTimeFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, T, 'optional'>) => ICustomLocalDateTimeValueSource<SOURCE, T, T, 'optional'>, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<SOURCE, T, T, 'optional'>
    protected optionalVirtualColumnFromFragment<T>(type: 'enum', typeName: string, fn: (fragment: EqualableFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, T, 'optional'>) => IEqualableValueSource<SOURCE, T, T, 'optional'>, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, T, 'optional'>
    protected optionalVirtualColumnFromFragment<T>(type: 'custom', typeName: string, fn: (fragment: EqualableFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, T, 'optional'>) => IEqualableValueSource<SOURCE, T, T, 'optional'>, adapter?: TypeAdapter): EqualableValueSource<SOURCE, T, T, 'optional'>
    protected optionalVirtualColumnFromFragment<T>(type: 'customComparable', typeName: string, fn: (fragment: ComparableFragmentExpression<NNoTableOrViewRequiredFrom<SOURCE>, T, T, 'optional'>) => IComparableValueSource<SOURCE, T, T, 'optional'>, adapter?: TypeAdapter): ComparableValueSource<SOURCE, T, T, 'optional'>
    protected optionalVirtualColumnFromFragment(type: string, arg1: any, arg2?: any, arg3?: TypeAdapter): any /* EqualableValueSource<SOURCE, T, TYPE_NAME, 'optional'> */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        if (typeof arg1 === 'string') {
            const fragmentBuilder =  new FragmentQueryBuilder(type as ValueType, arg1, 'optional', arg3)
            return new ValueSourceFromBuilder(arg2 as (fragment: any) => AnyValueSource, fragmentBuilder, type as ValueType, arg1, 'optional', arg3)
        }
        const fragmentBuilder =  new FragmentQueryBuilder(type as ValueType, type, 'optional', arg2 as TypeAdapter | undefined)
        return new ValueSourceFromBuilder(arg1 as (fragment: any) => AnyValueSource, fragmentBuilder, type as ValueType, type, 'optional', arg2 as TypeAdapter | undefined)
    }

    // @ts-ignore
    private __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        if (this.__source) {
            withs.push(this.__source as any)
        } else {
            withs.push(this as any)
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
            if (isColumn(column)) {
                const columnPrivate = __getColumnPrivate(column)
                columnPrivate.__name = prefix + prop
            } else if (isValueSource(column)) {
                continue // Computed value
            } else {
                prefix = prefix + prop + '.'
                this.__setColumnsName(column, prefix)
            }
        }
    }

    // @ts-ignore
    private __getTableOrView(): AnyTableOrView {
        return this
    }
}

export class Values</*in|out*/ CONNECTION extends IConnection<NDBWithType<'postgreSql' | 'sqlite' | 'sqlServer' | 'noopDB'>>, /*in|out*/ NAME extends string> extends ValuesOf<NValues<CONNECTION[typeof connection], NAME>> {
    constructor(name: NAME, values: OpaqueValues) {
        super(name, values as any)
    }

    static create<T extends IValues<any>>(type: new (name: NGetNameFrom<T[typeof source]>, values: OpaqueValues) => T, name: NGetNameFrom<T[typeof source]>, values: Array<MandatoryInsertSets<T, NoTableOrViewRequiredOfSameDB<T> | T, undefined>>): T {
        if (values.length <= 0) {
            throw new Error('Values requires at least one element in the list')
        }
        const result = new type(name, values as any);
        (result as any).__setColumnsName(result as any, '')
        return result
    }
}

export interface OpaqueValues {
    [dontCallConstructor]: 'use Values.create(type, name, values) instead'
}