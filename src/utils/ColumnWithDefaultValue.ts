import { Column } from "./Column"

export class ColumnWithDefaultValue extends Column {
    // @ts-ignore
    private __hasDefault: true
}