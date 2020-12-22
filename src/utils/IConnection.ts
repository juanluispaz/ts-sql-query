import type { AnyDB } from "../databases"
import type { database, type } from "./symbols"

export interface IConnection<DB extends AnyDB> {
    [database]: DB
    [type]: 'Connection'
}