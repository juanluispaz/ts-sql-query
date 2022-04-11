import type { PostgreSql, TypeUnsafeDB } from "../databases"
import type { databaseName } from "../utils/symbols"

export interface DB<NAME extends string> extends TypeUnsafeDB, PostgreSql {
    [databaseName]: NAME
}
