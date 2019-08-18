import { AnyDB } from "./AnyDB"

export interface MariaDB extends AnyDB {
    __MariaDB: 'MariaDB'
}