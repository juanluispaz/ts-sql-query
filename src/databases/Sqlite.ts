import { AnyDB } from "./AnyDB"

export interface Sqlite extends AnyDB {
    __Sqlite: 'Sqlite'
}