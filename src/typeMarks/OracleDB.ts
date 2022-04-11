import type { Oracle, TypeUnsafeDB } from "../databases"
import type { databaseName } from "../utils/symbols"

export interface DB<NAME extends string> extends TypeUnsafeDB, Oracle {
    [databaseName]: NAME
}
