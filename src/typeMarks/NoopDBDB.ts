import type { NoopDB, TypeUnsafeDB } from "../databases"
import type { databaseName } from "../utils/symbols"

export interface DB<NAME extends string> extends TypeUnsafeDB, NoopDB {
    [databaseName]: NAME
}
