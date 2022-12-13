import type { AnyDB } from "../databases";
import type { ITableOrViewRef } from "../utils/ITableOrView";
import type { tableName, type } from "../utils/symbols";

export interface TABLE<DB extends AnyDB, NAME extends string> extends ITableOrViewRef<DB> {
    [tableName]: NAME
    [type]: 'table'
}