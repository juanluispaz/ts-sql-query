import { Column } from "./Column"

export class ColumnWithDefaultValue extends Column {
    // @ts-ignore
    protected __hasDefault: true
}