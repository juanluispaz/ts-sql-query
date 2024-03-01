import { BooleanValueSource, NumberValueSource, StringValueSource, DateValueSource, TimeValueSource, DateTimeValueSource, EqualableValueSource, ComparableValueSource, BigintValueSource, __getValueSourceOfObject, __getValueSourcePrivate, UuidValueSource, IBooleanValueSource, INumberValueSource, IBigintValueSource, IStringValueSource, IUuidValueSource, IDateValueSource, ITimeValueSource, IDateTimeValueSource, IEqualableValueSource, IComparableValueSource, AnyValueSource, ValueType, CustomIntValueSource, CustomDoubleValueSource, CustomUuidValueSource, CustomLocalDateTimeValueSource, ICustomIntValueSource, ICustomDoubleValueSource, ICustomUuidValueSource, ICustomLocalDateValueSource, ICustomLocalTimeValueSource, ICustomLocalDateTimeValueSource, CustomLocalDateValueSource, CustomLocalTimeValueSource } from "./expressions/values"
import { HasIsValue, IView, IWithView, __addWiths, __registerRequiredColumn, __registerTableOrView } from "./utils/ITableOrView"
import type { TypeAdapter } from "./TypeAdapter"
import type { AliasedTableOrView, OuterJoinSourceOf } from "./utils/tableOrViewUtils"
import { Column, OptionalColumn } from "./utils/Column"
import type { AnyDB } from "./databases"
import { ColumnImpl } from "./internal/ColumnImpl"
import { database, tableOrViewRef, type, viewName } from "./utils/symbols"
import { IConnection } from "./utils/IConnection"
import { RawFragment } from "./utils/RawFragment"
import type { VIEW } from "./typeMarks/VIEW"
import type { BigintFragmentExpression, BooleanFragmentExpression, ComparableFragmentExpression, CustomDoubleFragmentExpression, CustomIntFragmentExpression, CustomLocalDateFragmentExpression, CustomLocalDateTimeFragmentExpression, CustomLocalTimeFragmentExpression, CustomUuidFragmentExpression, DateFragmentExpression, DateTimeFragmentExpression, EqualableFragmentExpression, NumberFragmentExpression, StringFragmentExpression, TimeFragmentExpression, UuidFragmentExpression } from "./expressions/fragment"
import { ValueSourceFromBuilder } from "./internal/ValueSourceImpl"
import { FragmentQueryBuilder } from "./queryBuilders/FragmentQueryBuilder"

class ViewOf<REF extends VIEW<AnyDB, any>> implements IView<REF> {
    [database]!: REF[typeof database]
    [type]!: 'view'
    [viewName]!: REF[typeof viewName]
    [tableOrViewRef]!: REF
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
        return result as any
    }
    forUseInLeftJoin(): OuterJoinSourceOf<this, ''> {
        return this.forUseInLeftJoinAs('')
    }
    forUseInLeftJoinAs<ALIAS extends string>(as: ALIAS): OuterJoinSourceOf<this, ALIAS> {
        const result = new ((this as any).constructor)() as ViewOf<any>
        result.__as = as
        result.__forUseInLeftJoin = true
        for (const prop in result) {
            const column = __getValueSourceOfObject(result, prop)
            if (column) {
                const columnPrivate = __getValueSourcePrivate(column)
                if (columnPrivate.__optionalType === 'required') {
                    columnPrivate.__optionalType = 'originallyRequired'
                }
            }
        }
        return result as any
    }

    protected column(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource<REF, 'required'> & Column
    protected column(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource<REF, 'required'> & Column
    protected column(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource<REF, 'required'> & Column
    protected column(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource<REF, 'required'> & Column
    protected column(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource<REF, 'required'> & Column
    protected column(name: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource<REF, 'required'> & Column
    protected column(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource<REF, 'required'> & Column
    protected column(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource<REF, 'required'> & Column
    protected column(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource<REF, 'required'> & Column
    protected column<T, TYPE_NAME extends string>(name: string, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<REF, T, TYPE_NAME, 'required'> & Column
    protected column<T, TYPE_NAME extends string>(name: string, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<REF, T, TYPE_NAME, 'required'> & Column
    protected column<T, TYPE_NAME extends string>(name: string, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<REF, T, TYPE_NAME, 'required'> & Column
    protected column<T, TYPE_NAME extends string>(name: string, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<REF, T, TYPE_NAME, 'required'> & Column
    protected column<T, TYPE_NAME extends string>(name: string, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<REF, T, TYPE_NAME, 'required'> & Column
    protected column<T, TYPE_NAME extends string>(name: string, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<REF, T, TYPE_NAME, 'required'> & Column
    protected column<T, TYPE_NAME extends string>(name: string, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<REF, T, TYPE_NAME, 'required'> & Column
    protected column<T, TYPE_NAME extends string>(name: string, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<REF, T, TYPE_NAME, 'required'> & Column
    protected column<T, TYPE_NAME extends string>(name: string, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<REF, T, TYPE_NAME, 'required'> & Column
    protected column<T>(name: string, type: 'customInt', typeName: string, adapter?: TypeAdapter): CustomIntValueSource<REF, T, T, 'required'> & Column
    protected column<T>(name: string, type: 'customDouble', typeName: string, adapter?: TypeAdapter): CustomDoubleValueSource<REF, T, T, 'required'> & Column
    protected column<T>(name: string, type: 'customUuid', typeName: string, adapter?: TypeAdapter): CustomUuidValueSource<REF, T, T, 'required'> & Column
    protected column<T>(name: string, type: 'customLocalDate', typeName: string, adapter?: TypeAdapter): CustomLocalDateValueSource<REF, T, T, 'required'> & Column
    protected column<T>(name: string, type: 'customLocalTime', typeName: string, adapter?: TypeAdapter): CustomLocalTimeValueSource<REF, T, T, 'required'> & Column
    protected column<T>(name: string, type: 'customLocalDateTime', typeName: string, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<REF, T, T, 'required'> & Column
    protected column<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<REF, T, T, 'required'> & Column
    protected column<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<REF, T, T, 'required'> & Column
    protected column<T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<REF, T, T, 'required'> & Column
    protected column(name: string, type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any /* EqualableValueSource<REF, T, TYPE_NAME, 'required'> & Column */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        if (typeof adapter === 'string') {
            return new ColumnImpl(this, name, type as ValueType, adapter, adapter2)
        }
        return new ColumnImpl(this, name, type as ValueType, type, adapter)
    }

    protected optionalColumn(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(name: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customInt', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomIntValueSource<REF, T, TYPE_NAME, 'optional'> & OptionalColumn
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customDouble', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomDoubleValueSource<REF, T, TYPE_NAME, 'optional'> & OptionalColumn
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customUuid', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomUuidValueSource<REF, T, TYPE_NAME, 'optional'> & OptionalColumn
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customLocalDate', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateValueSource<REF, T, TYPE_NAME, 'optional'> & OptionalColumn
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customLocalTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalTimeValueSource<REF, T, TYPE_NAME, 'optional'> & OptionalColumn
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customLocalDateTime', typeName: TYPE_NAME, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<REF, T, TYPE_NAME, 'optional'> & OptionalColumn
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<REF, T, TYPE_NAME, 'optional'> & OptionalColumn
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<REF, T, TYPE_NAME, 'optional'> & OptionalColumn
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<REF, T, TYPE_NAME, 'optional'> & OptionalColumn
    protected optionalColumn<T>(name: string, type: 'customInt', typeName: string, adapter?: TypeAdapter): CustomIntValueSource<REF, T, T, 'optional'> & OptionalColumn
    protected optionalColumn<T>(name: string, type: 'customDouble', typeName: string, adapter?: TypeAdapter): CustomDoubleValueSource<REF, T, T, 'optional'> & OptionalColumn
    protected optionalColumn<T>(name: string, type: 'customUuid', typeName: string, adapter?: TypeAdapter): CustomUuidValueSource<REF, T, T, 'optional'> & OptionalColumn
    protected optionalColumn<T>(name: string, type: 'customLocalDate', typeName: string, adapter?: TypeAdapter): CustomLocalDateValueSource<REF, T, T, 'optional'> & OptionalColumn
    protected optionalColumn<T>(name: string, type: 'customLocalTime', typeName: string, adapter?: TypeAdapter): CustomLocalTimeValueSource<REF, T, T, 'optional'> & OptionalColumn
    protected optionalColumn<T>(name: string, type: 'customLocalDateTime', typeName: string, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<REF, T, T, 'optional'> & OptionalColumn
    protected optionalColumn<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<REF, T, T, 'optional'> & OptionalColumn
    protected optionalColumn<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<REF, T, T, 'optional'> & OptionalColumn
    protected optionalColumn<T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<REF, T, T, 'optional'> & OptionalColumn
    protected optionalColumn(name: string, type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any /* EqualableValueSource<REF, T, TYPE_NAME, 'optional'> & OptionalColumn */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        if (typeof adapter === 'string') {
            return (new ColumnImpl(this, name, type as ValueType, adapter, adapter2)).__asOptionalColumn()
        }
        return (new ColumnImpl(this, name, type as ValueType, type, adapter)).__asOptionalColumn()
    }

    protected virtualColumnFromFragment(type: 'boolean', fn: (fragment: BooleanFragmentExpression<REF[typeof database], 'required'>) => IBooleanValueSource<REF, 'required'>, adapter?: TypeAdapter): BooleanValueSource<REF, 'required'>
    protected virtualColumnFromFragment(type: 'int', fn: (fragment: NumberFragmentExpression<REF[typeof database], 'required'>) => INumberValueSource<REF, 'required'>, adapter?: TypeAdapter): NumberValueSource<REF, 'required'>
    protected virtualColumnFromFragment(type: 'bigint', fn: (fragment: BigintFragmentExpression<REF[typeof database], 'required'>) => IBigintValueSource<REF, 'required'>, adapter?: TypeAdapter): BigintValueSource<REF, 'required'>
    protected virtualColumnFromFragment(type: 'double', fn: (fragment: NumberFragmentExpression<REF[typeof database], 'required'>) => INumberValueSource<REF, 'required'>, adapter?: TypeAdapter): NumberValueSource<REF, 'required'>
    protected virtualColumnFromFragment(type: 'string', fn: (fragment: StringFragmentExpression<REF[typeof database], 'required'>) => IStringValueSource<REF, 'required'>, adapter?: TypeAdapter): StringValueSource<REF, 'required'>
    protected virtualColumnFromFragment(type: 'uuid', fn: (fragment: UuidFragmentExpression<REF[typeof database], 'required'>) => IUuidValueSource<REF, 'required'>, adapter?: TypeAdapter): UuidValueSource<REF, 'required'>
    protected virtualColumnFromFragment(type: 'localDate', fn: (fragment: DateFragmentExpression<REF[typeof database], 'required'>) => IDateValueSource<REF, 'required'>, adapter?: TypeAdapter): DateValueSource<REF, 'required'>
    protected virtualColumnFromFragment(type: 'localTime', fn: (fragment: TimeFragmentExpression<REF[typeof database], 'required'>) => ITimeValueSource<REF, 'required'>, adapter?: TypeAdapter): TimeValueSource<REF, 'required'>
    protected virtualColumnFromFragment(type: 'localDateTime', fn: (fragment: DateTimeFragmentExpression<REF[typeof database], 'required'>) => IDateTimeValueSource<REF, 'required'>, adapter?: TypeAdapter): DateTimeValueSource<REF, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, fn: (fragment: CustomIntFragmentExpression<REF[typeof database], T, TYPE_NAME, 'required'>) => ICustomIntValueSource<REF, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): CustomIntValueSource<REF, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, fn: (fragment: CustomDoubleFragmentExpression<REF[typeof database], T, TYPE_NAME, 'required'>) => ICustomDoubleValueSource<REF, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): CustomDoubleValueSource<REF, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, fn: (fragment: CustomUuidFragmentExpression<REF[typeof database], T, TYPE_NAME, 'required'>) => ICustomUuidValueSource<REF, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): CustomUuidValueSource<REF, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, fn: (fragment: CustomLocalDateFragmentExpression<REF[typeof database], T, TYPE_NAME, 'required'>) => ICustomLocalDateValueSource<REF, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): CustomLocalDateValueSource<REF, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, fn: (fragment: CustomLocalTimeFragmentExpression<REF[typeof database], T, TYPE_NAME, 'required'>) => ICustomLocalTimeValueSource<REF, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): CustomLocalTimeValueSource<REF, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, fn: (fragment: CustomLocalDateTimeFragmentExpression<REF[typeof database], T, TYPE_NAME, 'required'>) => ICustomLocalDateTimeValueSource<REF, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<REF, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, fn: (fragment: EqualableFragmentExpression<REF[typeof database], T, TYPE_NAME, 'required'>) => IEqualableValueSource<REF, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): EqualableValueSource<REF, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, fn: (fragment: EqualableFragmentExpression<REF[typeof database], T, TYPE_NAME, 'required'>) => IEqualableValueSource<REF, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): EqualableValueSource<REF, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, fn: (fragment: ComparableFragmentExpression<REF[typeof database], T, TYPE_NAME, 'required'>) => IComparableValueSource<REF, T, TYPE_NAME, 'required'>, adapter?: TypeAdapter): ComparableValueSource<REF, T, TYPE_NAME, 'required'>
    protected virtualColumnFromFragment<T>(type: 'customInt', typeName: string, fn: (fragment: CustomIntFragmentExpression<REF[typeof database], T, T, 'required'>) => ICustomIntValueSource<REF, T, T, 'required'>, adapter?: TypeAdapter): CustomIntValueSource<REF, T, T, 'required'>
    protected virtualColumnFromFragment<T>(type: 'customDouble', typeName: string, fn: (fragment: CustomDoubleFragmentExpression<REF[typeof database], T, T, 'required'>) => ICustomDoubleValueSource<REF, T, T, 'required'>, adapter?: TypeAdapter): CustomDoubleValueSource<REF, T, T, 'required'>
    protected virtualColumnFromFragment<T>(type: 'customUuid', typeName: string, fn: (fragment: CustomUuidFragmentExpression<REF[typeof database], T, T, 'required'>) => ICustomUuidValueSource<REF, T, T, 'required'>, adapter?: TypeAdapter): CustomUuidValueSource<REF, T, T, 'required'>
    protected virtualColumnFromFragment<T>(type: 'customLocalDate', typeName: string, fn: (fragment: CustomLocalDateFragmentExpression<REF[typeof database], T, T, 'required'>) => ICustomLocalDateValueSource<REF, T, T, 'required'>, adapter?: TypeAdapter): CustomLocalDateValueSource<REF, T, T, 'required'>
    protected virtualColumnFromFragment<T>(type: 'customLocalTime', typeName: string, fn: (fragment: CustomLocalTimeFragmentExpression<REF[typeof database], T, T, 'required'>) => ICustomLocalTimeValueSource<REF, T, T, 'required'>, adapter?: TypeAdapter): CustomLocalTimeValueSource<REF, T, T, 'required'>
    protected virtualColumnFromFragment<T>(type: 'customLocalDateTime', typeName: string, fn: (fragment: CustomLocalDateTimeFragmentExpression<REF[typeof database], T, T, 'required'>) => ICustomLocalDateTimeValueSource<REF, T, T, 'required'>, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<REF, T, T, 'required'>
    protected virtualColumnFromFragment<T>(type: 'enum', typeName: string, fn: (fragment: EqualableFragmentExpression<REF[typeof database], T, T, 'required'>) => IEqualableValueSource<REF, T, T, 'required'>, adapter?: TypeAdapter): EqualableValueSource<REF, T, T, 'required'>
    protected virtualColumnFromFragment<T>(type: 'custom', typeName: string, fn: (fragment: EqualableFragmentExpression<REF[typeof database], T, T, 'required'>) => IEqualableValueSource<REF, T, T, 'required'>, adapter?: TypeAdapter): EqualableValueSource<REF, T, T, 'required'>
    protected virtualColumnFromFragment<T>(type: 'customComparable', typeName: string, fn: (fragment: ComparableFragmentExpression<REF[typeof database], T, T, 'required'>) => IComparableValueSource<REF, T, T, 'required'>, adapter?: TypeAdapter): ComparableValueSource<REF, T, T, 'required'>
    protected virtualColumnFromFragment(type: string, arg1: any, arg2?: any, arg3?: TypeAdapter): any /* EqualableValueSource<REF, T, TYPE_NAME, 'required'> */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        if (typeof arg1 === 'string') {
            const fragmentBuilder =  new FragmentQueryBuilder(type as ValueType, arg1, 'required', arg3)
            return new ValueSourceFromBuilder(arg2 as (fragment: any) => AnyValueSource, fragmentBuilder, type as ValueType, arg1, 'required', arg3)
        }
        const fragmentBuilder =  new FragmentQueryBuilder(type as ValueType, type, 'required', arg2 as TypeAdapter | undefined)
        return new ValueSourceFromBuilder(arg1 as (fragment: any) => AnyValueSource, fragmentBuilder, type as ValueType, type, 'required', arg2 as TypeAdapter | undefined)
    }

    protected optionalVirtualColumnFromFragment(type: 'boolean', fn: (fragment: BooleanFragmentExpression<REF[typeof database], 'optional'>) => IBooleanValueSource<REF, 'optional'>, adapter?: TypeAdapter): BooleanValueSource<REF, 'optional'>
    protected optionalVirtualColumnFromFragment(type: 'int', fn: (fragment: NumberFragmentExpression<REF[typeof database], 'optional'>) => INumberValueSource<REF, 'optional'>, adapter?: TypeAdapter): NumberValueSource<REF, 'optional'>
    protected optionalVirtualColumnFromFragment(type: 'bigint', fn: (fragment: BigintFragmentExpression<REF[typeof database], 'optional'>) => IBigintValueSource<REF, 'optional'>, adapter?: TypeAdapter): BigintValueSource<REF, 'optional'>
    protected optionalVirtualColumnFromFragment(type: 'double', fn: (fragment: NumberFragmentExpression<REF[typeof database], 'optional'>) => INumberValueSource<REF, 'optional'>, adapter?: TypeAdapter): NumberValueSource<REF, 'optional'>
    protected optionalVirtualColumnFromFragment(type: 'string', fn: (fragment: StringFragmentExpression<REF[typeof database], 'optional'>) => IStringValueSource<REF, 'optional'>, adapter?: TypeAdapter): StringValueSource<REF, 'optional'>
    protected optionalVirtualColumnFromFragment(type: 'uuid', fn: (fragment: UuidFragmentExpression<REF[typeof database], 'optional'>) => IUuidValueSource<REF, 'optional'>, adapter?: TypeAdapter): UuidValueSource<REF, 'optional'>
    protected optionalVirtualColumnFromFragment(type: 'localDate', fn: (fragment: DateFragmentExpression<REF[typeof database], 'optional'>) => IDateValueSource<REF, 'optional'>, adapter?: TypeAdapter): DateValueSource<REF, 'optional'>
    protected optionalVirtualColumnFromFragment(type: 'localTime', fn: (fragment: TimeFragmentExpression<REF[typeof database], 'optional'>) => ITimeValueSource<REF, 'optional'>, adapter?: TypeAdapter): TimeValueSource<REF, 'optional'>
    protected optionalVirtualColumnFromFragment(type: 'localDateTime', fn: (fragment: DateTimeFragmentExpression<REF[typeof database], 'optional'>) => IDateTimeValueSource<REF, 'optional'>, adapter?: TypeAdapter): DateTimeValueSource<REF, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customInt', typeName: TYPE_NAME, fn: (fragment: CustomIntFragmentExpression<REF[typeof database], T, TYPE_NAME, 'optional'>) => ICustomIntValueSource<REF, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): CustomIntValueSource<REF, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customDouble', typeName: TYPE_NAME, fn: (fragment: CustomDoubleFragmentExpression<REF[typeof database], T, TYPE_NAME, 'optional'>) => ICustomDoubleValueSource<REF, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): CustomDoubleValueSource<REF, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customUuid', typeName: TYPE_NAME, fn: (fragment: CustomUuidFragmentExpression<REF[typeof database], T, TYPE_NAME, 'optional'>) => ICustomUuidValueSource<REF, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): CustomUuidValueSource<REF, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDate', typeName: TYPE_NAME, fn: (fragment: CustomLocalDateFragmentExpression<REF[typeof database], T, TYPE_NAME, 'optional'>) => ICustomLocalDateValueSource<REF, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): CustomLocalDateValueSource<REF, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalTime', typeName: TYPE_NAME, fn: (fragment: CustomLocalTimeFragmentExpression<REF[typeof database], T, TYPE_NAME, 'optional'>) => ICustomLocalTimeValueSource<REF, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): CustomLocalTimeValueSource<REF, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customLocalDateTime', typeName: TYPE_NAME, fn: (fragment: CustomLocalDateTimeFragmentExpression<REF[typeof database], T, TYPE_NAME, 'optional'>) => ICustomLocalDateTimeValueSource<REF, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<REF, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'enum', typeName: TYPE_NAME, fn: (fragment: EqualableFragmentExpression<REF[typeof database], T, TYPE_NAME, 'optional'>) => IEqualableValueSource<REF, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): EqualableValueSource<REF, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'custom', typeName: TYPE_NAME, fn: (fragment: EqualableFragmentExpression<REF[typeof database], T, TYPE_NAME, 'optional'>) => IEqualableValueSource<REF, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): EqualableValueSource<REF, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T, TYPE_NAME extends string>(type: 'customComparable', typeName: TYPE_NAME, fn: (fragment: ComparableFragmentExpression<REF[typeof database], T, TYPE_NAME, 'optional'>) => IComparableValueSource<REF, T, TYPE_NAME, 'optional'>, adapter?: TypeAdapter): ComparableValueSource<REF, T, TYPE_NAME, 'optional'>
    protected optionalVirtualColumnFromFragment<T>(type: 'customInt', typeName: string, fn: (fragment: CustomIntFragmentExpression<REF[typeof database], T, T, 'optional'>) => ICustomIntValueSource<REF, T, T, 'optional'>, adapter?: TypeAdapter): CustomIntValueSource<REF, T, T, 'optional'>
    protected optionalVirtualColumnFromFragment<T>(type: 'customDouble', typeName: string, fn: (fragment: CustomDoubleFragmentExpression<REF[typeof database], T, T, 'optional'>) => ICustomDoubleValueSource<REF, T, T, 'optional'>, adapter?: TypeAdapter): CustomDoubleValueSource<REF, T, T, 'optional'>
    protected optionalVirtualColumnFromFragment<T>(type: 'customUuid', typeName: string, fn: (fragment: CustomUuidFragmentExpression<REF[typeof database], T, T, 'optional'>) => ICustomUuidValueSource<REF, T, T, 'optional'>, adapter?: TypeAdapter): CustomUuidValueSource<REF, T, T, 'optional'>
    protected optionalVirtualColumnFromFragment<T>(type: 'customLocalDate', typeName: string, fn: (fragment: CustomLocalDateFragmentExpression<REF[typeof database], T, T, 'optional'>) => ICustomLocalDateValueSource<REF, T, T, 'optional'>, adapter?: TypeAdapter): CustomLocalDateValueSource<REF, T, T, 'optional'>
    protected optionalVirtualColumnFromFragment<T>(type: 'customLocalTime', typeName: string, fn: (fragment: CustomLocalTimeFragmentExpression<REF[typeof database], T, T, 'optional'>) => ICustomLocalTimeValueSource<REF, T, T, 'optional'>, adapter?: TypeAdapter): CustomLocalTimeValueSource<REF, T, T, 'optional'>
    protected optionalVirtualColumnFromFragment<T>(type: 'customLocalDateTime', typeName: string, fn: (fragment: CustomLocalDateTimeFragmentExpression<REF[typeof database], T, T, 'optional'>) => ICustomLocalDateTimeValueSource<REF, T, T, 'optional'>, adapter?: TypeAdapter): CustomLocalDateTimeValueSource<REF, T, T, 'optional'>
    protected optionalVirtualColumnFromFragment<T>(type: 'enum', typeName: string, fn: (fragment: EqualableFragmentExpression<REF[typeof database], T, T, 'optional'>) => IEqualableValueSource<REF, T, T, 'optional'>, adapter?: TypeAdapter): EqualableValueSource<REF, T, T, 'optional'>
    protected optionalVirtualColumnFromFragment<T>(type: 'custom', typeName: string, fn: (fragment: EqualableFragmentExpression<REF[typeof database], T, T, 'optional'>) => IEqualableValueSource<REF, T, T, 'optional'>, adapter?: TypeAdapter): EqualableValueSource<REF, T, T, 'optional'>
    protected optionalVirtualColumnFromFragment<T>(type: 'customComparable', typeName: string, fn: (fragment: ComparableFragmentExpression<REF[typeof database], T, T, 'optional'>) => IComparableValueSource<REF, T, T, 'optional'>, adapter?: TypeAdapter): ComparableValueSource<REF, T, T, 'optional'>
    protected optionalVirtualColumnFromFragment(type: string, arg1: any, arg2?: any, arg3?: TypeAdapter): any /* EqualableValueSource<REF, T, TYPE_NAME, 'optional'> */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        if (typeof arg1 === 'string') {
            const fragmentBuilder =  new FragmentQueryBuilder(type as ValueType, arg1, 'optional', arg3)
            return new ValueSourceFromBuilder(arg2 as (fragment: any) => AnyValueSource, fragmentBuilder, type as ValueType, arg1, 'optional', arg3)
        }
        const fragmentBuilder =  new FragmentQueryBuilder(type as ValueType, type, 'optional', arg2 as TypeAdapter | undefined)
        return new ValueSourceFromBuilder(arg1 as (fragment: any) => AnyValueSource, fragmentBuilder, type as ValueType, type, 'optional', arg2 as TypeAdapter | undefined)
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
    private __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
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

export class View<Connection extends IConnection<any>, NAME extends string> extends ViewOf<VIEW<Connection[typeof database], NAME>> {
    constructor(name: string) {
        super(name)
    }
}
