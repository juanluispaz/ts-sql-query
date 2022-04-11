import type { MariaDB, TypeSafeDB } from "../databases"
import type { databaseName } from "../utils/symbols"

export interface DB<NAME extends string> extends TypeSafeDB, MariaDB {
    [databaseName]: NAME
}
