import { ITableOrView, __getTableOrViewPrivate } from "../utils/ITableOrView"
import { ValueSourceImpl } from "./ValueSourceImpl"
import { Column, __ColumnPrivate } from "../utils/Column"
import { OptionalColumn } from "../utils/OptionalColumn"
import { ColumnWithDefaultValue } from "../utils/ColumnWithDefaultValue"
import { PrimaryKeyColumn } from "../utils/PrimaryKeyColumn"
import { AnyDB } from "../databases/AnyDB"
import { PrimaryKeyAutogeneratedColumn } from "../utils/PrimaryKeyAutogeneratedColumn"
import { TypeAdapter } from "../TypeAdapter"
import { SqlBuilder } from "../sqlBuilders/SqlBuilder"

export class ColumnImpl<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>> extends ValueSourceImpl implements __ColumnPrivate {
    __name: string
    __table_or_view: TABLE_OR_VIEW
    __isOptional: boolean = false
    __hasDefault: boolean = false
    __isPrimaryKey: boolean = false
    __isAutogeneratedPrimaryKey: boolean = false
    __sequenceName?: string

    constructor(table: TABLE_OR_VIEW, name: string, columnType: string, typeAdapter: TypeAdapter | undefined) {
        super(columnType, typeAdapter)
        this.__name = name
        this.__table_or_view = table
    }

    __toSql(_SqlBuilder: SqlBuilder, _params: any[]): string {
        let table = __getTableOrViewPrivate(this.__table_or_view)
        return _SqlBuilder._escape(table.__as || table.__name) + '.' + _SqlBuilder._escape(this.__name)
    }

    __asColumn(): this & Column {
        return (this as this & Column)
    }

    __asOptionalColumn(): this & OptionalColumn {
        this.__isOptional = true
        return (this as this & OptionalColumn)
    }

    __asColumnWithDefaultValue(): this & ColumnWithDefaultValue {
        this.__hasDefault = true
        return (this as this & ColumnWithDefaultValue)
    }

    __asOptionalColumnWithDefaultValue(): this & OptionalColumn & ColumnWithDefaultValue {
        this.__isOptional = true
        this.__hasDefault = true
        return (this as this & OptionalColumn & ColumnWithDefaultValue)
    }

    __asAutogeneratedPrimaryKey(): this & ColumnWithDefaultValue & PrimaryKeyColumn & PrimaryKeyAutogeneratedColumn {
        this.__hasDefault = true
        this.__isPrimaryKey = true
        this.__isAutogeneratedPrimaryKey = true
        return (this as this & ColumnWithDefaultValue & PrimaryKeyColumn & PrimaryKeyAutogeneratedColumn)
    }

    __asAutogeneratedPrimaryKeyBySequence(sequenceName: string): this & ColumnWithDefaultValue & PrimaryKeyColumn & PrimaryKeyAutogeneratedColumn {
        this.__hasDefault = true
        this.__isPrimaryKey = true
        this.__isAutogeneratedPrimaryKey = true
        this.__sequenceName = sequenceName
        return (this as this & ColumnWithDefaultValue & PrimaryKeyColumn & PrimaryKeyAutogeneratedColumn)
    }

    __asPrimaryKey(): this & PrimaryKeyColumn {
        this.__isPrimaryKey = true
        return (this as this & PrimaryKeyColumn)
    }
}
