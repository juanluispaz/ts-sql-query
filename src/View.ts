import type { BooleanValueSource, NumberValueSource, StringValueSource, DateValueSource, TimeValueSource, DateTimeValueSource, EqualableValueSource, IntValueSource, DoubleValueSource, LocalDateValueSource, LocalTimeValueSource, LocalDateTimeValueSource, TypeSafeStringValueSource, StringNumberValueSource, StringIntValueSource, StringDoubleValueSource, ComparableValueSource, BigintValueSource, TypeSafeBigintValueSource } from "./expressions/values"
import { IView, IWithView, TableOrViewOf, TableOrViewRef, __addWiths, __registerTableOrView } from "./utils/ITableOrView"
import type { int, double, LocalDate, LocalTime, LocalDateTime, stringInt, stringDouble } from "ts-extended-types"
import type { TypeAdapter } from "./TypeAdapter"
import type { AliasedTableOrView, OuterJoinSourceOf } from "./utils/tableOrViewUtils"
import { Column, OptionalColumn, __getColumnOfTable, __getColumnPrivate } from "./utils/Column"
import type { AnyDB, TypeSafeDB } from "./databases"
import { ColumnImpl } from "./internal/ColumnImpl"
import { database, tableOrViewRef, type, viewName } from "./utils/symbols"
import { IConnection } from "./utils/IConnection"
import { RawFragment } from "./utils/RawFragment"

interface VIEW<DB extends AnyDB, NAME extends string> extends TableOrViewRef<DB> {
    [viewName]: NAME
    [type]: 'view'
}

class ViewOf<REF extends VIEW<AnyDB, any>> implements IView<REF> {
    [database]: REF[typeof database]
    [type]: 'view'
    [viewName]: REF[typeof viewName]
    [tableOrViewRef]: REF
    /* implements __ITableOrViewPrivate as private members*/
    // @ts-ignore
    private __name: string
    // @ts-ignore
    private __as?: string
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
        for (const prop in result) {
            const column = __getColumnOfTable(result, prop)
            if (column) {
                __getColumnPrivate(column).__isOptional = true
            }
        }
        return result as any
    }

    protected column(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource<REF, boolean> & Column
    protected column(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'stringInt', adapter?: TypeAdapter): StringIntValueSource<REF, stringInt> & Column
    protected column(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource<REF, number | string> & Column
    protected column(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'int', adapter?: TypeAdapter): IntValueSource<REF, int> & Column
    protected column(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource<REF, number> & Column
    protected column(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'bigint', adapter?: TypeAdapter): TypeSafeBigintValueSource<REF, bigint> & Column
    protected column(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource<REF, bigint> & Column
    protected column(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'stringDouble', adapter?: TypeAdapter): StringDoubleValueSource<REF, stringDouble> & Column
    protected column(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource<REF, number | string> & Column
    protected column(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'double', adapter?: TypeAdapter): DoubleValueSource<REF, double> & Column
    protected column(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource<REF, number> & Column
    protected column(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'string', adapter?: TypeAdapter): TypeSafeStringValueSource<REF, string> & Column
    protected column(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource<REF, string> & Column
    protected column(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource<REF, LocalDate> & Column
    protected column(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource<REF, Date> & Column
    protected column(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource<REF, LocalTime> & Column
    protected column(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource<REF, Date> & Column
    protected column(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource<REF, LocalDateTime> & Column
    protected column(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource<REF, Date> & Column
    protected column<T, TYPE_NAME extends string>(name: string, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<REF, T, TYPE_NAME> & Column
    protected column<T, TYPE_NAME extends string>(name: string, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<REF, T, TYPE_NAME> & Column
    protected column<T, TYPE_NAME extends string>(name: string, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<REF, T, TYPE_NAME> & Column
    protected column<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<REF, T, T> & Column
    protected column<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<REF, T, T> & Column
    protected column<T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<REF, T, T> & Column
    protected column(name: string, type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any /* EqualableValueSource<REF, T, TYPE_NAME> & Column */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        if (typeof adapter === 'string') {
            return new ColumnImpl(this, name, adapter, adapter2)
        }
        return new ColumnImpl(this, name, type, adapter)
    }

    protected optionalColumn(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource<REF, boolean | null | undefined> & OptionalColumn
    protected optionalColumn(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'stringInt', adapter?: TypeAdapter): StringIntValueSource<REF, stringInt | null | undefined> & OptionalColumn
    protected optionalColumn(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource<REF, number | string | null | undefined> & OptionalColumn
    protected optionalColumn(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'int', adapter?: TypeAdapter): IntValueSource<REF, int | null | undefined> & OptionalColumn
    protected optionalColumn(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource<REF, number | null | undefined> & OptionalColumn
    protected optionalColumn(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'bigint', adapter?: TypeAdapter): TypeSafeBigintValueSource<REF, bigint | null | undefined> & OptionalColumn
    protected optionalColumn(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource<REF, bigint | null | undefined> & OptionalColumn
    protected optionalColumn(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'stringDouble', adapter?: TypeAdapter): StringDoubleValueSource<REF, stringDouble | null | undefined> & OptionalColumn
    protected optionalColumn(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource<REF, number | string | null | undefined> & OptionalColumn
    protected optionalColumn(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'double', adapter?: TypeAdapter): DoubleValueSource<REF, double | null | undefined> & OptionalColumn
    protected optionalColumn(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource<REF, number | null | undefined> & OptionalColumn
    protected optionalColumn(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'string', adapter?: TypeAdapter): TypeSafeStringValueSource<REF, string | null | undefined> & OptionalColumn
    protected optionalColumn(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource<REF, string | null | undefined> & OptionalColumn
    protected optionalColumn(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource<REF, LocalDate | null | undefined> & OptionalColumn
    protected optionalColumn(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource<REF, Date | null | undefined> & OptionalColumn
    protected optionalColumn(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource<REF, LocalTime | null | undefined> & OptionalColumn
    protected optionalColumn(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource<REF, Date | null | undefined> & OptionalColumn
    protected optionalColumn(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource<REF, LocalDateTime | null | undefined> & OptionalColumn
    protected optionalColumn(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource<REF, Date | null | undefined> & OptionalColumn
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<REF, T | null | undefined, TYPE_NAME> & OptionalColumn
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<REF, T | null | undefined, TYPE_NAME> & OptionalColumn
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<REF, T | null | undefined, TYPE_NAME> & OptionalColumn
    protected optionalColumn<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<REF, T | null | undefined, T> & OptionalColumn
    protected optionalColumn<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<REF, T | null | undefined, T> & OptionalColumn
    protected optionalColumn<T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<REF, T | null | undefined, T> & OptionalColumn
    protected optionalColumn(name: string, type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any /* EqualableValueSource<REF, T | null | undefined, TYPE_NAME> & OptionalColumn */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        if (typeof adapter === 'string') {
            return (new ColumnImpl(this, name, adapter, adapter2)).__asOptionalColumn()
        }
        return (new ColumnImpl(this, name, type, adapter)).__asOptionalColumn()
    }

    // @ts-ignore
    private __addWiths(withs: Array<IWithView<any>>): void {
        __addWiths(this.__template, withs)
    }

    // @ts-ignore
    private __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void {
        requiredTablesOrViews.add(this)
        __registerTableOrView(this.__template, requiredTablesOrViews)
    }

    // @ts-ignore
    private __getOldValues(): ITableOrView<any> | undefined {
        return undefined
    }
}

export class View<Connection extends IConnection<any>, NAME extends string> extends ViewOf<VIEW<Connection[typeof database], NAME>> {
    constructor(name: string) {
        super(name)
    }
}
