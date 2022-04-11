import type { SqlServer, TypeUnsafeDB } from "../databases"
import type { databaseName } from "../utils/symbols"

export interface DB<NAME extends string> extends TypeUnsafeDB, SqlServer {
    [databaseName]: NAME
}
