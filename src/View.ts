import type { BooleanValueSource, NumberValueSource, StringValueSource, DateValueSource, TimeValueSource, DateTimeValueSource, EqualableValueSource, IntValueSource, DoubleValueSource, LocalDateValueSource, LocalTimeValueSource, LocalDateTimeValueSource, TypeSafeStringValueSource, StringNumberValueSource, StringIntValueSource, StringDoubleValueSource, ComparableValueSource } from "./expressions/values"
import type { IView, TableOrViewOf, TableOrViewRef } from "./utils/ITableOrView"
import type { int, double, LocalDate, LocalTime, LocalDateTime, stringInt, stringDouble } from "ts-extended-types"
import type { TypeAdapter } from "./TypeAdapter"
import type { AliasedTableOrView, OuterJoinSourceOf } from "./utils/tableOrViewUtils"
import type { Column, OptionalColumn } from "./utils/Column"
import type { AnyDB, TypeSafeDB } from "./databases"
import { ColumnImpl } from "./internal/ColumnImpl"
import { database, tableOrViewRef, type, viewName } from "./utils/symbols"
import { IConnection } from "./utils/IConnection"

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

    constructor(name: string) {
        this.__name = name
    }

    as<ALIAS extends string>(as: ALIAS): AliasedTableOrView<this, ALIAS> {
        const result = new ((this as any).constructor)() as ViewOf<any>
        result.__as = as
        return result as any
    }
    forUseInLeftJoin(): OuterJoinSourceOf<this, ''> {
        return this as any
    }
    forUseInLeftJoinAs<ALIAS extends string>(as: ALIAS): OuterJoinSourceOf<this, ALIAS> {
        return this.as(as) as any
    }

    protected column(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource<REF, boolean> & Column
    protected column(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'stringInt', adapter?: TypeAdapter): StringIntValueSource<REF, stringInt> & Column
    protected column(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource<REF, number | string> & Column
    protected column(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'int', adapter?: TypeAdapter): IntValueSource<REF, int> & Column
    protected column(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource<REF, number> & Column
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
    protected column<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<REF, T> & Column
    protected column<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<REF, T> & Column
    protected column<T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<REF, T> & Column
    protected column<_T>(name: string, type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any /* EqualableValueSource<V, T> & Column */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
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
    protected optionalColumn<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<REF, T | null | undefined> & OptionalColumn
    protected optionalColumn<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<REF, T | null | undefined> & OptionalColumn
    protected optionalColumn<T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<REF, T | null | undefined> & OptionalColumn
    protected optionalColumn<_T>(name: string, type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any /* EqualableValueSource<V, T | null | undefined> & OptionalColumn */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        if (typeof adapter === 'string') {
            return (new ColumnImpl(this, name, adapter, adapter2)).__asOptionalColumn()
        }
        return (new ColumnImpl(this, name, type, adapter)).__asOptionalColumn()
    }
}

export class View<Connection extends IConnection<any>, NAME extends string> extends ViewOf<VIEW<Connection[typeof database], NAME>> {
    constructor(name: string) {
        super(name)
    }
}
