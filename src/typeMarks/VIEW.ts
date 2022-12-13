import type { AnyDB } from "../databases";
import type { ITableOrViewRef } from "../utils/ITableOrView";
import type { type, viewName } from "../utils/symbols";

export interface VIEW<DB extends AnyDB, NAME extends string> extends ITableOrViewRef<DB> {
    [viewName]: NAME
    [type]: 'view'
}