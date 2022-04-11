import type { AnyDB } from "../databases";
import type { TableOrViewRef } from "../utils/ITableOrView";
import type { tableName, type } from "../utils/symbols";

export interface TABLE<DB extends AnyDB, NAME extends string> extends TableOrViewRef<DB> {
    [tableName]: NAME
    [type]: 'table'
}