import type { AnyDB } from "../databases"
import type { database, databaseName } from "./symbols"

export interface IConnection<DB extends AnyDB, NAME> extends AnyDB {
    [databaseName]: NAME
    [database]: DB
}