import { Column } from "./Column"

export class PrimaryKeyColumn extends Column {
    // @ts-ignore
    private __isPrimaryKey: true
}