import { AnyDB } from "../databases/AnyDB"
import { ITableOrView } from "./ITableOrView"

export class TableOrViewAlias<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, ALIAS> extends ITableOrView<DB> {
    // @ts-ignore
    private ___table_or_view: TABLE_OR_VIEW
    // @ts-ignore
    private ___alias: ALIAS
}