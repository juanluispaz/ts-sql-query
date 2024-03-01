import type { MySql } from "../databases"
import type { databaseName } from "../utils/symbols"

export interface DB<NAME extends string> extends MySql {
    [databaseName]: NAME
}
