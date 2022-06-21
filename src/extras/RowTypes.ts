import { MandatoryInsertSets } from "../expressions/insert";
import { UpdateSets } from "../expressions/update";
import { ColumnKeys } from "../extras/utils";
import { ITableOrView } from "../utils/ITableOrView";
import { ResultObjectValues } from "../utils/resultUtils";

export type SelectedRow<TABLE extends ITableOrView<any>> = ResultObjectValues<{
    [K in ColumnKeys<TABLE>]: TABLE[K];
}>

export type InsertableRow<TABLE extends ITableOrView<any>> = MandatoryInsertSets<TABLE>

export type UpdatableRow<TABLE extends ITableOrView<any>> = UpdateSets<TABLE, TABLE>;
