import type { PostgreSql } from "../databases"
import type { databaseName } from "../utils/symbols"

export interface DB<NAME extends string> extends PostgreSql {
    [databaseName]: NAME
}
