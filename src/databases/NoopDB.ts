import { AnyDB } from "./AnyDB"

export interface NoopDB extends AnyDB {
    __NoopDB: 'NoopDB'
}