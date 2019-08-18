import { AnyDB } from "./AnyDB"

export interface SqlServer extends AnyDB {
    __SqlServer: 'SqlServer'
}