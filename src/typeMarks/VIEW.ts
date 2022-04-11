import type { AnyDB } from "../databases";
import type { TableOrViewRef } from "../utils/ITableOrView";
import type { type, viewName } from "../utils/symbols";

export interface VIEW<DB extends AnyDB, NAME extends string> extends TableOrViewRef<DB> {
    [viewName]: NAME
    [type]: 'view'
}