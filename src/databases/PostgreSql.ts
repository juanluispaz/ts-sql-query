import { AnyDB } from "./AnyDB"

export interface PostgreSql extends AnyDB {
    __PostgreSql: 'PostgreSql'
}