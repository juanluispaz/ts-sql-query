import type { MariaDB } from "../databases"
import type { databaseName } from "../utils/symbols"

export interface DB<NAME extends string> extends MariaDB {
    [databaseName]: NAME
}
