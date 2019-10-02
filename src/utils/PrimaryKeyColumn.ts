import { Column } from "./Column"

export class PrimaryKeyColumn extends Column {
    // @ts-ignore
    protected __isPrimaryKey: true
}