import { BooleanValueSource, NumberValueSource, StringValueSource, DateValueSource, TimeValueSource, DateTimeValueSource, EqualableValueSource, IntValueSource, DoubleValueSource, LocalDateValueSource, LocalTimeValueSource, LocalDateTimeValueSource, TypeSafeStringValueSource, StringNumberValueSource, StringIntValueSource, StringDoubleValueSource } from "./expressions/values"
import { ColumnImpl } from "./internal/ColumnImpl"
import { OptionalColumn } from "./utils/OptionalColumn"
import { AnyDB } from "./databases/AnyDB"
import { ITableOrView, IView } from "./utils/ITableOrView"
import { TypeSafeDB } from "./databases/TypeSafeDB"
import { int, double, LocalDate, LocalTime, LocalDateTime, stringInt, stringDouble } from "ts-extended-types"
import { TypeAdapter } from "./TypeAdapter"
import { AliasedTableOrView, OuterJoinSourceOf } from "./utils/tableOrViewUtils"
import { Column } from "./utils/Column"

export class View<DB extends AnyDB> extends IView<DB> {
    /* implements __ITableOrViewPrivate as private members*/
    // @ts-ignore
    private __name: string
    // @ts-ignore
    private __as?: string
    // @ts-ignore
    private __type: 'view' = 'view'

    constructor(name: string) {
        super()
        this.__name = name
    }

    as<ALIAS extends string>(as: ALIAS): AliasedTableOrView<DB, this, ALIAS> {
        const result = new ((this as any).constructor)() as View<DB>
        result.__as = as
        return result as any
    }
    forUseInLeftJoin(): OuterJoinSourceOf<DB, this, ''> {
        return this as any
    }
    forUseInLeftJoinAs<ALIAS extends string>(as: ALIAS): OuterJoinSourceOf<DB, this, ALIAS> {
        return this.as(as) as any
    }

    protected column(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource<DB, this, boolean> & Column
    protected column(this: ITableOrView<TypeSafeDB>, name: string, type: 'stringInt', adapter?: TypeAdapter): StringIntValueSource<DB, this, stringInt> & Column
    protected column(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource<DB, this, number | string> & Column
    protected column(this: ITableOrView<TypeSafeDB>, name: string, type: 'int', adapter?: TypeAdapter): IntValueSource<DB, this, int> & Column
    protected column(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource<DB, this, number> & Column
    protected column(this: ITableOrView<TypeSafeDB>, name: string, type: 'stringDouble', adapter?: TypeAdapter): StringDoubleValueSource<DB, this, stringDouble> & Column
    protected column(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource<DB, this, number | string> & Column
    protected column(this: ITableOrView<TypeSafeDB>, name: string, type: 'double', adapter?: TypeAdapter): DoubleValueSource<DB, this, double> & Column
    protected column(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource<DB, this, number> & Column
    protected column(this: ITableOrView<TypeSafeDB>, name: string, type: 'string', adapter?: TypeAdapter): TypeSafeStringValueSource<DB, this, string> & Column
    protected column(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource<DB, this, string> & Column
    protected column(this: ITableOrView<TypeSafeDB>, name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource<DB, this, LocalDate> & Column
    protected column(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource<DB, this, Date> & Column
    protected column(this: ITableOrView<TypeSafeDB>, name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource<DB, this, LocalTime> & Column
    protected column(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource<DB, this, Date> & Column
    protected column(this: ITableOrView<TypeSafeDB>, name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource<DB, this, LocalDateTime> & Column
    protected column(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource<DB, this, Date> & Column
    protected column<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<DB, this, T> & Column
    protected column<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<DB, this, T> & Column
    protected column<_T>(name: string, type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any /* EqualableValueSource<DB, this, T> & Column */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        if (typeof adapter === 'string') {
            return new ColumnImpl(this, name, adapter, adapter2)
        }
        return new ColumnImpl(this, name, type, adapter)
    }

    protected optionalColumn(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource<DB, this, boolean | null | undefined> & OptionalColumn
    protected optionalColumn(this: ITableOrView<TypeSafeDB>, name: string, type: 'stringInt', adapter?: TypeAdapter): StringIntValueSource<DB, this, stringInt | null | undefined> & OptionalColumn
    protected optionalColumn(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource<DB, this, number | string | null | undefined> & OptionalColumn
    protected optionalColumn(this: ITableOrView<TypeSafeDB>, name: string, type: 'int', adapter?: TypeAdapter): IntValueSource<DB, this, int | null | undefined> & OptionalColumn
    protected optionalColumn(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource<DB, this, number | null | undefined> & OptionalColumn
    protected optionalColumn(this: ITableOrView<TypeSafeDB>, name: string, type: 'stringDouble', adapter?: TypeAdapter): StringDoubleValueSource<DB, this, stringDouble | null | undefined> & OptionalColumn
    protected optionalColumn(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource<DB, this, number | string | null | undefined> & OptionalColumn
    protected optionalColumn(this: ITableOrView<TypeSafeDB>, name: string, type: 'double', adapter?: TypeAdapter): DoubleValueSource<DB, this, double | null | undefined> & OptionalColumn
    protected optionalColumn(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource<DB, this, number | null | undefined> & OptionalColumn
    protected optionalColumn(this: ITableOrView<TypeSafeDB>, name: string, type: 'string', adapter?: TypeAdapter): TypeSafeStringValueSource<DB, this, string | null | undefined> & OptionalColumn
    protected optionalColumn(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource<DB, this, string | null | undefined> & OptionalColumn
    protected optionalColumn(this: ITableOrView<TypeSafeDB>, name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource<DB, this, LocalDate | null | undefined> & OptionalColumn
    protected optionalColumn(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource<DB, this, Date | null | undefined> & OptionalColumn
    protected optionalColumn(this: ITableOrView<TypeSafeDB>, name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource<DB, this, LocalTime | null | undefined> & OptionalColumn
    protected optionalColumn(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource<DB, this, Date | null | undefined> & OptionalColumn
    protected optionalColumn(this: ITableOrView<TypeSafeDB>, name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource<DB, this, LocalDateTime | null | undefined> & OptionalColumn
    protected optionalColumn(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource<DB, this, Date | null | undefined> & OptionalColumn
    protected optionalColumn<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<DB, this, T | null | undefined> & OptionalColumn
    protected optionalColumn<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<DB, this, T | null | undefined> & OptionalColumn
    protected optionalColumn<_T>(name: string, type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any /* EqualableValueSource<DB, this, T | null | undefined> & OptionalColumn */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        if (typeof adapter === 'string') {
            return (new ColumnImpl(this, name, adapter, adapter2)).__asOptionalColumn()
        }
        return (new ColumnImpl(this, name, type, adapter)).__asOptionalColumn()
    }
}
