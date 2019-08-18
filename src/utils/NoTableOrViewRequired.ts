import { ITableOrView } from "./ITableOrView"

export class NoTableOrViewRequired extends ITableOrView<any> {
    // @ts-ignore
    private ___NoTableRequired: 'NoTableRequired'
}
