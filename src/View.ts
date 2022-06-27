import { BooleanValueSource, NumberValueSource, StringValueSource, DateValueSource, TimeValueSource, DateTimeValueSource, EqualableValueSource, IntValueSource, DoubleValueSource, LocalDateValueSource, LocalTimeValueSource, LocalDateTimeValueSource, TypeSafeStringValueSource, StringNumberValueSource, StringIntValueSource, StringDoubleValueSource, ComparableValueSource, BigintValueSource, TypeSafeBigintValueSource, __getValueSourceOfObject, __getValueSourcePrivate, TypeSafeUuidValueSource, UuidValueSource } from "./expressions/values"
import { IView, IWithView, TableOrViewOf, __addWiths, __registerRequiredColumn, __registerTableOrView } from "./utils/ITableOrView"
import type { TypeAdapter } from "./TypeAdapter"
import type { AliasedTableOrView, OuterJoinSourceOf } from "./utils/tableOrViewUtils"
import { Column, OptionalColumn } from "./utils/Column"
import type { AnyDB, TypeSafeDB } from "./databases"
import { ColumnImpl } from "./internal/ColumnImpl"
import { database, tableOrViewRef, type, viewName } from "./utils/symbols"
import { IConnection } from "./utils/IConnection"
import { RawFragment } from "./utils/RawFragment"
import type { VIEW } from "./typeMarks/VIEW"

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
    protected column(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'stringInt', adapter?: TypeAdapter): StringIntValueSource<REF, 'required'> & Column
    protected column(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource<REF, 'required'> & Column
    protected column(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'int', adapter?: TypeAdapter): IntValueSource<REF, 'required'> & Column
    protected column(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource<REF, 'required'> & Column
    protected column(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'bigint', adapter?: TypeAdapter): TypeSafeBigintValueSource<REF, 'required'> & Column
    protected column(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource<REF, 'required'> & Column
    protected column(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'stringDouble', adapter?: TypeAdapter): StringDoubleValueSource<REF, 'required'> & Column
    protected column(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource<REF, 'required'> & Column
    protected column(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'double', adapter?: TypeAdapter): DoubleValueSource<REF, 'required'> & Column
    protected column(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource<REF, 'required'> & Column
    protected column(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'string', adapter?: TypeAdapter): TypeSafeStringValueSource<REF, 'required'> & Column
    protected column(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource<REF, 'required'> & Column
    protected column(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'uuid', adapter?: TypeAdapter): TypeSafeUuidValueSource<REF, 'required'> & Column
    protected column(name: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource<REF, 'required'> & Column
    protected column(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource<REF, 'required'> & Column
    protected column(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource<REF, 'required'> & Column
    protected column(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource<REF, 'required'> & Column
    protected column(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource<REF, 'required'> & Column
    protected column(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource<REF, 'required'> & Column
    protected column(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource<REF, 'required'> & Column
    protected column<T, TYPE_NAME extends string>(name: string, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<REF, T, TYPE_NAME, 'required'> & Column
    protected column<T, TYPE_NAME extends string>(name: string, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<REF, T, TYPE_NAME, 'required'> & Column
    protected column<T, TYPE_NAME extends string>(name: string, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<REF, T, TYPE_NAME, 'required'> & Column
    protected column<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<REF, T, T, 'required'> & Column
    protected column<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<REF, T, T, 'required'> & Column
    protected column<T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<REF, T, T, 'required'> & Column
    protected column(name: string, type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any /* EqualableValueSource<REF, T, TYPE_NAME, 'required'> & Column */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
        if (typeof adapter === 'string') {
            return new ColumnImpl(this, name, adapter, adapter2)
        }
        return new ColumnImpl(this, name, type, adapter)
    }

    protected optionalColumn(name: string, type: 'boolean', adapter?: TypeAdapter): BooleanValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'stringInt', adapter?: TypeAdapter): StringIntValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(name: string, type: 'stringInt', adapter?: TypeAdapter): StringNumberValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'int', adapter?: TypeAdapter): IntValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(name: string, type: 'int', adapter?: TypeAdapter): NumberValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'bigint', adapter?: TypeAdapter): TypeSafeBigintValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(name: string, type: 'bigint', adapter?: TypeAdapter): BigintValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'stringDouble', adapter?: TypeAdapter): StringDoubleValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(name: string, type: 'stringDouble', adapter?: TypeAdapter): StringNumberValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'double', adapter?: TypeAdapter): DoubleValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(name: string, type: 'double', adapter?: TypeAdapter): NumberValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'string', adapter?: TypeAdapter): TypeSafeStringValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(name: string, type: 'string', adapter?: TypeAdapter): StringValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'uuid', adapter?: TypeAdapter): TypeSafeUuidValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(name: string, type: 'uuid', adapter?: TypeAdapter): UuidValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'localDate', adapter?: TypeAdapter): LocalDateValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(name: string, type: 'localDate', adapter?: TypeAdapter): DateValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'localTime', adapter?: TypeAdapter): LocalTimeValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(name: string, type: 'localTime', adapter?: TypeAdapter): TimeValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(this: TableOrViewOf<TypeSafeDB>, name: string, type: 'localDateTime', adapter?: TypeAdapter): LocalDateTimeValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn(name: string, type: 'localDateTime', adapter?: TypeAdapter): DateTimeValueSource<REF, 'optional'> & OptionalColumn
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'enum', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<REF, T, TYPE_NAME, 'optional'> & OptionalColumn
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'custom', typeName: TYPE_NAME, adapter?: TypeAdapter): EqualableValueSource<REF, T, TYPE_NAME, 'optional'> & OptionalColumn
    protected optionalColumn<T, TYPE_NAME extends string>(name: string, type: 'customComparable', typeName: TYPE_NAME, adapter?: TypeAdapter): ComparableValueSource<REF, T, TYPE_NAME, 'optional'> & OptionalColumn
    protected optionalColumn<T>(name: string, type: 'enum', typeName: string, adapter?: TypeAdapter): EqualableValueSource<REF, T, T, 'optional'> & OptionalColumn
    protected optionalColumn<T>(name: string, type: 'custom', typeName: string, adapter?: TypeAdapter): EqualableValueSource<REF, T, T, 'optional'> & OptionalColumn
    protected optionalColumn<T>(name: string, type: 'customComparable', typeName: string, adapter?: TypeAdapter): ComparableValueSource<REF, T, T, 'optional'> & OptionalColumn
    protected optionalColumn(name: string, type: string, adapter?: TypeAdapter | string, adapter2?: TypeAdapter): any /* EqualableValueSource<REF, T, TYPE_NAME, 'optional'> & OptionalColumn */ { // Returns any to avoid: Type instantiation is excessively deep and possibly infinite.ts(2589)
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
    private __registerRequiredColumn(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        __registerRequiredColumn(this.__template, requiredColumns, onlyForTablesOrViews)
    }

    // @ts-ignore
    private __getOldValues(): ITableOrView<any> | undefined {
        return undefined
    }

    // @ts-ignore
    private __getValuesForInsert(): ITableOrView<any> | undefined {
        return undefined
    }
}

export class View<Connection extends IConnection<any>, NAME extends string> extends ViewOf<VIEW<Connection[typeof database], NAME>> {
    constructor(name: string) {
        super(name)
    }
}
