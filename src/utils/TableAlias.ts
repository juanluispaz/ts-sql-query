import { AnyDB } from "../databases/AnyDB"
import { ITableOrView } from "./ITableOrView"

export class TableOrViewAlias<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, ALIAS> extends ITableOrView<DB> {
    // @ts-ignore
    protected ___table_or_view: TABLE_OR_VIEW
    // @ts-ignore
    protected ___alias: ALIAS
}