import { ITableOrView } from "./ITableOrView"

export class NoTableOrViewRequired extends ITableOrView<any> {
    // @ts-ignore
    protected ___NoTableRequired: 'NoTableRequired'
}
