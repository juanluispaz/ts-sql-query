import { AnyDB } from "../databases/AnyDB"
import { ITableOrView } from "./ITableOrView"

export class OuterJoinSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, ALIAS> {
    // @ts-ignore
    private ___outer_join_database: DB
    // @ts-ignore
    private ___outer_join_table_or_view: TABLE_OR_VIEW
    // @ts-ignore
    private ___outer_join_alias: ALIAS
}